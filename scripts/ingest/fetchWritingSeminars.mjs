/**
 * scripts/ingest/fetchWritingSeminars.mjs
 *
 * Fetches the SEAS handbook page that lists writing seminars and tags
 * every matched course in courses.json with `tags: ["writing_seminar"]`.
 *
 * Why a tag rather than an attribute? The catalog has no "EUWR" attribute
 * — the writing seminar list is curated by SEAS, not by Penn's central
 * catalog system. Modeling it as a tag (a free-form per-course label) lets
 * the engine's `must_include_tag` constraint reference it without
 * conflating it with the EU* attributes.
 *
 * Idempotent. Caches HTML at src/data/raw/writing_seminars.html.
 *
 * Run with:
 *   node scripts/ingest/fetchWritingSeminars.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const COURSES_PATH = resolve(ROOT, "src/data/courses.json");
const CACHE_PATH = resolve(ROOT, "src/data/raw/writing_seminars.html");
const URL =
  "https://ugrad.seas.upenn.edu/student-handbook/courses-requirements/writing-courses/";

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

function addUnique(arr, val) {
  if (!arr.includes(val)) arr.push(val);
}

async function fetchHtml(url, cachePath, force) {
  if (!force && existsSync(cachePath)) {
    return readFileSync(cachePath, "utf8");
  }
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (PennAdvisor data ingest)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, html);
  return html;
}

/**
 * Strip HTML tags down to text and harvest every "ABCD 1234" / "ABCD1234"
 * code. The page has 49 such codes (mostly WRIT), all writing seminars.
 */
function extractCourseCodes(html) {
  const text = html.replace(/<[^>]+>/g, " ");
  const matches = text.match(/\b[A-Z]{2,5}\s*\d{3,4}\b/g) || [];
  return [...new Set(matches.map((m) => m.replace(/\s+/g, "")))];
}

// ---------- main ----------

async function main() {
  const force = process.argv.includes("--force");
  console.log(`\nFetching ${URL}${force ? " (forced)" : ""}`);
  const html = await fetchHtml(URL, CACHE_PATH, force);
  console.log(`  ${html.length} bytes`);

  const codes = extractCourseCodes(html);
  console.log(`  Extracted ${codes.length} distinct course codes`);

  const courses = existsSync(COURSES_PATH)
    ? JSON.parse(readFileSync(COURSES_PATH, "utf8"))
    : {};
  for (const id of Object.keys(courses)) {
    courses[id] = migrateEntry({ id, ...courses[id] });
  }

  let mergedCount = 0;
  let createdCount = 0;
  for (const id of codes) {
    if (courses[id]) {
      addUnique(courses[id].tags, "writing_seminar");
      mergedCount += 1;
    } else {
      courses[id] = migrateEntry({
        id,
        title: id, // We don't have a real title from this page; populated later by the catalog scraper.
        cu: 1,
        level: parseLevel(id),
        tags: ["writing_seminar"],
      });
      createdCount += 1;
    }
  }

  const sorted = Object.fromEntries(
    Object.keys(courses).sort().map((id) => [id, courses[id]])
  );
  writeFileSync(COURSES_PATH, JSON.stringify(sorted, null, 2) + "\n");

  console.log("\n=== fetchWritingSeminars summary ===");
  console.log(`  merged into existing entries: ${mergedCount}`);
  console.log(`  created new entries:          ${createdCount}`);
  console.log(`  total in courses.json now:    ${Object.keys(sorted).length}`);
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
