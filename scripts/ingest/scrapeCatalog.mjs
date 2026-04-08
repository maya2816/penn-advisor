/**
 * scripts/ingest/scrapeCatalog.mjs
 *
 * For every (filtered) course in courses.json, fetches its detail page from
 * https://catalog.upenn.edu/search/?P=<DEPT>%20<NUMBER>, parses the
 * `<p class="courseblockextra">` paragraphs, and merges any "Prerequisite:"
 * and "Mutually Exclusive:" data back into courses.json.
 *
 * Also opportunistically updates `title` and `cu` from the detail page when
 * the existing entry has only the placeholder values from earlier ingest
 * passes (the catalog detail page is the most authoritative source).
 *
 * STEM filter: by default, only courses in CIS, ESE, NETS, MATH, MEAM, BE,
 * CBE, MSE, ENGR, ENM, BIOL, CHEM, PHYS, STAT, ECON, COGS, LING, PHIL get
 * scraped. Pass --all to scrape every course in courses.json.
 *
 * Idempotent. Caches HTML per course at src/data/raw/catalog_cache/<ID>.html.
 * Pass --force to bypass the cache for a full refresh.
 *
 * Run with:
 *   node scripts/ingest/scrapeCatalog.mjs           # STEM filter, use cache
 *   node scripts/ingest/scrapeCatalog.mjs --all     # every course
 *   node scripts/ingest/scrapeCatalog.mjs --force   # bypass cache
 *
 * Rate limit: 500ms between live network fetches (cached fetches are
 * instant). The prior academic-manager Python codebase used the same delay.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const COURSES_PATH = resolve(ROOT, "src/data/courses.json");
const CACHE_DIR = resolve(ROOT, "src/data/raw/catalog_cache");

const STEM_DEPARTMENTS = new Set([
  "CIS", "ESE", "NETS", "MATH", "MEAM", "BE", "CBE", "MSE",
  "ENGR", "ENM", "BIOL", "CHEM", "PHYS", "STAT", "ECON",
  "COGS", "LING", "PHIL", "AMCS",
]);

const RATE_LIMIT_MS = 500;

// ---------- helpers ----------

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

function normalizeId(s) {
  return s.replace(/\s+/g, "");
}

/** Split "CIS1210" into { dept: "CIS", number: "1210" }. Returns null if malformed. */
function splitId(id) {
  const m = id.match(/^([A-Z]+)(\d+)$/);
  return m ? { dept: m[1], number: m[2] } : null;
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
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const html = await res.text();
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, html);
  return { html, fromCache: false };
}

/**
 * Parse one detail-page HTML into a structured course block, or null if no
 * matching course was found on the page (e.g. course was retired).
 *
 * Returns:
 *   { title, cu, prerequisites: string[], mutuallyExclusive: string[] }
 */
function parseDetailPage(html, expectedId) {
  const $ = cheerio.load(html);

  // Page structure (search result for an exact course code):
  //   <h3>CIS 4230  Ethical Algorithm Design</h3>
  //   <div class="courseblock">
  //     <p class="courseblockextra noindent">...description...</p>
  //     <p class="courseblockextra noindent">Fall or Spring</p>
  //     <p class="courseblockextra noindent">Mutually Exclusive: <a class="bubblelink code">CIS 5230</a></p>
  //     <p class="courseblockextra noindent">Prerequisite: <a class="bubblelink code">CIS 1210</a></p>
  //     <p class="courseblockextra noindent">1 Course Unit</p>
  //   </div>
  //
  // The h3 lives OUTSIDE the courseblock, so we find it independently and
  // verify the code matches what we asked for. The first courseblock then
  // contains the prereq/mutex paragraphs.
  let foundId = null;
  let title = null;
  $("h3").each((_, el) => {
    if (foundId) return;
    const t = $(el).text().trim();
    const m = t.match(/^([A-Z]+)\s*(\d+)\s+(.+?)\s*$/);
    if (!m) return;
    const id = normalizeId(m[1] + m[2]);
    if (id === expectedId) {
      foundId = id;
      title = m[3].trim();
    }
  });
  if (!foundId) return null;

  const block = $("div.courseblock").first();
  if (block.length === 0) return null;

  const result = {
    title,
    cu: null,
    prerequisites: [],
    mutuallyExclusive: [],
  };

  block.find("p.courseblockextra").each((_, p) => {
    const $p = $(p);
    const text = $p.text().trim();

    // Course Units line: "1 Course Unit", "0.5-1 Course Units"
    if (/Course Units?$/.test(text)) {
      const cuMatch = text.match(/^([\d.]+)/);
      if (cuMatch) result.cu = parseFloat(cuMatch[1]);
      return;
    }

    if (text.startsWith("Prerequisite:")) {
      $p.find("a.bubblelink.code").each((_, a) => {
        result.prerequisites.push(normalizeId($(a).text().trim()));
      });
      return;
    }

    if (text.startsWith("Mutually Exclusive:")) {
      $p.find("a.bubblelink.code").each((_, a) => {
        result.mutuallyExclusive.push(normalizeId($(a).text().trim()));
      });
      return;
    }
  });

  return result;
}

// ---------- main ----------

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const all = args.includes("--all");

  // Load + migrate courses.json.
  const courses = JSON.parse(readFileSync(COURSES_PATH, "utf8"));
  for (const id of Object.keys(courses)) {
    courses[id] = migrateEntry({ id, ...courses[id] });
  }

  // Build the work list.
  const allIds = Object.keys(courses).sort();
  const filtered = all
    ? allIds
    : allIds.filter((id) => {
        const split = splitId(id);
        return split && STEM_DEPARTMENTS.has(split.dept);
      });

  console.log(`\nScraping ${filtered.length} of ${allIds.length} courses` +
              `${all ? " (--all)" : " (STEM filter)"}` +
              `${force ? " --force" : ""}`);
  console.log(`Cache dir: ${CACHE_DIR}`);
  console.log(`Rate limit: ${RATE_LIMIT_MS}ms between live fetches`);
  console.log("");

  let cachedCount = 0;
  let networkCount = 0;
  let parsedCount = 0;
  let updatedCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;
  let lastNetworkAt = 0;

  for (let i = 0; i < filtered.length; i++) {
    const id = filtered[i];
    const split = splitId(id);
    if (!split) {
      errorCount += 1;
      continue;
    }
    const url = `https://catalog.upenn.edu/search/?P=${split.dept}%20${split.number}`;
    const cachePath = resolve(CACHE_DIR, `${id}.html`);

    let html, fromCache;
    try {
      // Rate limit ONLY when we're about to hit the network.
      if (force || !existsSync(cachePath)) {
        const elapsed = Date.now() - lastNetworkAt;
        if (elapsed < RATE_LIMIT_MS) {
          await sleep(RATE_LIMIT_MS - elapsed);
        }
        lastNetworkAt = Date.now();
      }
      ({ html, fromCache } = await fetchHtml(url, cachePath, force));
    } catch (err) {
      errorCount += 1;
      console.log(`  [${i + 1}/${filtered.length}] ${id}  ERROR: ${err.message}`);
      continue;
    }

    if (fromCache) cachedCount += 1; else networkCount += 1;

    const parsed = parseDetailPage(html, id);
    if (!parsed) {
      notFoundCount += 1;
      // Progress: print every 50.
      if ((i + 1) % 50 === 0 || i === filtered.length - 1) {
        process.stdout.write(`  [${i + 1}/${filtered.length}] cached:${cachedCount} net:${networkCount} parsed:${parsedCount} 404:${notFoundCount}\r`);
      }
      continue;
    }
    parsedCount += 1;

    // Merge into the entry. The catalog detail page is authoritative for
    // title and cu (overrides earlier placeholder values). Prereqs/mutex
    // are merged additively in case multiple sources contribute.
    const entry = courses[id];
    let touched = false;
    if (parsed.title && entry.title === id) {
      entry.title = parsed.title;
      touched = true;
    } else if (parsed.title && entry.title !== parsed.title) {
      // Catalog wins.
      entry.title = parsed.title;
      touched = true;
    }
    if (parsed.cu != null && entry.cu !== parsed.cu) {
      entry.cu = parsed.cu;
      touched = true;
    }
    if (parsed.prerequisites.length > 0) {
      entry.prerequisites = parsed.prerequisites;
      touched = true;
    }
    if (parsed.mutuallyExclusive.length > 0) {
      entry.mutuallyExclusive = parsed.mutuallyExclusive;
      touched = true;
    }
    if (touched) updatedCount += 1;

    // Progress.
    if ((i + 1) % 50 === 0 || i === filtered.length - 1) {
      process.stdout.write(`  [${i + 1}/${filtered.length}] cached:${cachedCount} net:${networkCount} parsed:${parsedCount} 404:${notFoundCount}\r`);
    }
  }

  console.log("\n");

  // Write back sorted.
  const sorted = Object.fromEntries(
    Object.keys(courses).sort().map((id) => [id, courses[id]])
  );
  writeFileSync(COURSES_PATH, JSON.stringify(sorted, null, 2) + "\n");

  console.log("=== scrapeCatalog summary ===");
  console.log(`  Courses considered:        ${filtered.length}`);
  console.log(`  Pages from cache:          ${cachedCount}`);
  console.log(`  Pages fetched from net:    ${networkCount}`);
  console.log(`  Pages successfully parsed: ${parsedCount}`);
  console.log(`  Pages with no match:       ${notFoundCount}`);
  console.log(`  Errors:                    ${errorCount}`);
  console.log(`  Course entries updated:    ${updatedCount}`);
  console.log(`  Total in courses.json:     ${Object.keys(sorted).length}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
