/**
 * scripts/ingest/scrapeAllCourses.mjs
 *
 * Walks Penn's full course catalog by department and ingests EVERY
 * course into courses.json. This is the safety net that fills the
 * gaps left by attribute-based scraping (which only catches courses
 * that happen to have one of EUNS/EUSS/EUHS/EUTB/TECH_ELECTIVE).
 *
 * How it works:
 *   1. Fetch https://catalog.upenn.edu/courses/ — the A-Z index.
 *      Extract every department slug (cims, cis, math, ...).
 *   2. For each department, fetch
 *      https://catalog.upenn.edu/courses/<dept>/ — one page with EVERY
 *      course in that department. ~244 departments total.
 *   3. Parse each `<p class="courseblocktitle">` for "CIS 1100 Title"
 *      and the following `<p class="courseblockextra">` paragraphs for
 *      Prerequisite / Mutually Exclusive / Course Unit lines.
 *   4. Merge into courses.json. Idempotent.
 *
 * Caches each department page in src/data/raw/dept_cache/<dept>.html
 * so re-runs are instant. --force bypasses the cache.
 *
 * Total runtime on cold cache: ~2 minutes (244 pages × 500ms).
 *
 * Run with:
 *   node scripts/ingest/scrapeAllCourses.mjs           # use cache
 *   node scripts/ingest/scrapeAllCourses.mjs --force   # bypass cache
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const COURSES_PATH = resolve(ROOT, "src/data/courses.json");
const CACHE_DIR = resolve(ROOT, "src/data/raw/dept_cache");
const INDEX_CACHE = resolve(ROOT, "src/data/raw/courses_index.html");

const RATE_LIMIT_MS = 500;

// ---------- helpers ----------

function normalizeId(s) {
  return s.replace(/\s+/g, "");
}

function parseLevel(id) {
  const m = id.match(/(\d+)/);
  if (!m) return 0;
  return Math.floor(parseInt(m[1], 10) / 1000) * 1000;
}

function migrateEntry(entry) {
  return {
    id: entry.id,
    title: entry.title ?? entry.id,
    cu: entry.cu ?? 1,
    level: entry.level ?? parseLevel(entry.id),
    attributes: Array.isArray(entry.attributes) ? entry.attributes : [],
    prerequisites: Array.isArray(entry.prerequisites) ? entry.prerequisites : [],
    mutuallyExclusive: Array.isArray(entry.mutuallyExclusive) ? entry.mutuallyExclusive : [],
    tech_elective_status: entry.tech_elective_status ?? null,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
  };
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url, cachePath, force) {
  if (!force && existsSync(cachePath)) {
    return { html: readFileSync(cachePath, "utf8"), fromCache: true };
  }
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (PennAdvisor data ingest)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, html);
  return { html, fromCache: false };
}

/**
 * Get the list of department slugs from the A-Z index page.
 * Cached at src/data/raw/courses_index.html.
 */
async function getDepartmentSlugs(force) {
  const url = "https://catalog.upenn.edu/courses/";
  const { html } = await fetchHtml(url, INDEX_CACHE, force);
  const $ = cheerio.load(html);
  const slugs = new Set();
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(/^\/courses\/([a-z]+)\/?$/);
    if (m) slugs.add(m[1]);
  });
  return [...slugs].sort();
}

/**
 * Parse a single department index page into an array of course objects.
 * Each <div class="courseblock"> has:
 *   <p class="courseblocktitle">CIS 1100  Introduction to ...</p>
 *   <p class="courseblockextra">description...</p>
 *   <p class="courseblockextra">term offered</p>
 *   <p class="courseblockextra">Also Offered As: COML 0021, ...</p>  (optional)
 *   <p class="courseblockextra">Prerequisite: <a>CIS 1200</a></p>     (optional)
 *   <p class="courseblockextra">Mutually Exclusive: <a>CIS 5230</a></p>(optional)
 *   <p class="courseblockextra">1 Course Unit</p>
 */
function parseDeptPage(html) {
  const $ = cheerio.load(html);
  const out = [];
  $("div.courseblock").each((_, block) => {
    const $block = $(block);
    const titleP = $block.find("p.courseblocktitle").first();
    if (titleP.length === 0) return;
    const titleText = titleP.text().trim();
    // Format: "CIS 1100  Introduction to Computer Programming"
    const m = titleText.match(/^([A-Z]+)\s*(\d+[A-Z]?)\s+(.+?)\s*$/);
    if (!m) return;
    const dept = m[1];
    const number = m[2];
    // Skip courses with letter suffixes (e.g. "1234A") — they're cross-listings,
    // not real catalog entries. The numeric form is also present in the same page.
    if (!/^\d+$/.test(number)) return;
    const id = normalizeId(dept + number);
    const title = m[3].trim();

    let cu = 1;
    const prerequisites = [];
    const mutuallyExclusive = [];

    $block.find("p.courseblockextra").each((_, p) => {
      const $p = $(p);
      const text = $p.text().trim();
      // CU: "1 Course Unit" or "0.5 Course Units" or "1.5 Course Units"
      const cuMatch = text.match(/^([\d.]+)\s*Course Units?$/);
      if (cuMatch) {
        cu = parseFloat(cuMatch[1]);
        return;
      }
      if (text.startsWith("Prerequisite:")) {
        $p.find("a.bubblelink.code").each((_, a) => {
          prerequisites.push(normalizeId($(a).text().trim()));
        });
        return;
      }
      if (text.startsWith("Mutually Exclusive:")) {
        $p.find("a.bubblelink.code").each((_, a) => {
          mutuallyExclusive.push(normalizeId($(a).text().trim()));
        });
        return;
      }
    });

    out.push({ id, title, cu, prerequisites, mutuallyExclusive });
  });
  return out;
}

// ---------- main ----------

async function main() {
  const force = process.argv.includes("--force");

  console.log("\nFetching department index…");
  const depts = await getDepartmentSlugs(force);
  console.log(`  ${depts.length} departments`);

  // Load + migrate courses.json.
  const courses = existsSync(COURSES_PATH)
    ? JSON.parse(readFileSync(COURSES_PATH, "utf8"))
    : {};
  for (const id of Object.keys(courses)) {
    courses[id] = migrateEntry({ id, ...courses[id] });
  }

  let cachedCount = 0;
  let networkCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let lastNetworkAt = 0;

  for (let i = 0; i < depts.length; i++) {
    const dept = depts[i];
    const url = `https://catalog.upenn.edu/courses/${dept}/`;
    const cachePath = resolve(CACHE_DIR, `${dept}.html`);

    let html, fromCache;
    try {
      if (force || !existsSync(cachePath)) {
        const elapsed = Date.now() - lastNetworkAt;
        if (elapsed < RATE_LIMIT_MS) await sleep(RATE_LIMIT_MS - elapsed);
        lastNetworkAt = Date.now();
      }
      ({ html, fromCache } = await fetchHtml(url, cachePath, force));
    } catch (err) {
      console.log(`  [${i + 1}/${depts.length}] ${dept.toUpperCase()}  ERROR: ${err.message}`);
      continue;
    }
    if (fromCache) cachedCount += 1; else networkCount += 1;

    const parsed = parseDeptPage(html);

    let deptCreated = 0;
    let deptUpdated = 0;
    for (const p of parsed) {
      if (courses[p.id]) {
        const e = courses[p.id];
        let touched = false;
        // Catalog title is authoritative.
        if (e.title === p.id || e.title !== p.title) {
          e.title = p.title;
          touched = true;
        }
        if (e.cu !== p.cu) {
          e.cu = p.cu;
          touched = true;
        }
        // Only fill prereqs/mutex if currently empty (don't overwrite a
        // previously-populated value with an empty one if the dept page
        // happened to omit it).
        if (e.prerequisites.length === 0 && p.prerequisites.length > 0) {
          e.prerequisites = p.prerequisites;
          touched = true;
        }
        if (e.mutuallyExclusive.length === 0 && p.mutuallyExclusive.length > 0) {
          e.mutuallyExclusive = p.mutuallyExclusive;
          touched = true;
        }
        if (touched) {
          updatedCount += 1;
          deptUpdated += 1;
        }
      } else {
        courses[p.id] = migrateEntry({
          id: p.id,
          title: p.title,
          cu: p.cu,
          level: parseLevel(p.id),
          attributes: [],
          prerequisites: p.prerequisites,
          mutuallyExclusive: p.mutuallyExclusive,
        });
        createdCount += 1;
        deptCreated += 1;
      }
    }

    process.stdout.write(
      `  [${i + 1}/${depts.length}] ${dept.toUpperCase().padEnd(6)} ` +
      `${parsed.length.toString().padStart(4)} courses · ` +
      `+${deptCreated} new · *${deptUpdated} updated · ` +
      `${fromCache ? "cached" : "network"}\n`
    );
  }

  // Write back sorted.
  const sorted = Object.fromEntries(
    Object.keys(courses).sort().map((id) => [id, courses[id]])
  );
  writeFileSync(COURSES_PATH, JSON.stringify(sorted, null, 2) + "\n");

  console.log("\n=== scrapeAllCourses summary ===");
  console.log(`  Departments visited:  ${depts.length}`);
  console.log(`  Pages from cache:     ${cachedCount}`);
  console.log(`  Pages from network:   ${networkCount}`);
  console.log(`  New course entries:   ${createdCount}`);
  console.log(`  Updated entries:      ${updatedCount}`);
  console.log(`  Total in courses.json: ${Object.keys(sorted).length}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
