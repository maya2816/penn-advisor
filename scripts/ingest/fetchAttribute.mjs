/**
 * scripts/ingest/fetchAttribute.mjs
 *
 * Fetches one of Penn's catalog attribute pages
 * (https://catalog.upenn.edu/attributes/<code>/) and merges every listed
 * course into src/data/courses.json, tagging each with the attribute.
 *
 * Generic. Run with:
 *   node scripts/ingest/fetchAttribute.mjs euns
 *   node scripts/ingest/fetchAttribute.mjs euss
 *   node scripts/ingest/fetchAttribute.mjs euhm
 *   node scripts/ingest/fetchAttribute.mjs eutbs
 *
 * Idempotent. Caches the raw HTML in src/data/raw/attributes/<code>.html
 * so re-runs are instant. Pass --force to bypass the cache and refetch.
 *
 * Auto-migrates every existing courses.json entry to the latest schema
 * (same self-healing pattern as normalizeTechElectives.mjs).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const COURSES_PATH = resolve(ROOT, "src/data/courses.json");
const CACHE_DIR = resolve(ROOT, "src/data/raw/attributes");

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
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const html = await res.text();
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, html);
  return html;
}

/**
 * Parse the .sc_courselist table out of one of Penn's attribute pages.
 * Returns an array of { id, title, cu }.
 */
function parseAttributePage(html) {
  const $ = cheerio.load(html);
  const out = [];
  $("table.sc_courselist tr").each((_, tr) => {
    const code = $(tr).find(".codecol").text().trim();
    if (!code) return; // skip the noscript header row
    const cells = $(tr).find("td");
    // The structure is: [.codecol, title cell, .hourscol]
    const title = $(cells[1]).text().trim();
    const hours = $(tr).find(".hourscol").text().trim();
    const cu = parseFloat(hours) || 1;
    out.push({ id: normalizeId(code), title, cu });
  });
  return out;
}

// ---------- main ----------

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const code = args.find((a) => !a.startsWith("--"))?.toLowerCase();
  if (!code) {
    console.error("Usage: node scripts/ingest/fetchAttribute.mjs <code> [--force]");
    console.error("  e.g.: node scripts/ingest/fetchAttribute.mjs euns");
    process.exit(1);
  }
  const ATTRIBUTE = code.toUpperCase();
  const url = `https://catalog.upenn.edu/attributes/${code}/`;
  const cachePath = resolve(CACHE_DIR, `${code}.html`);

  console.log(`\nFetching ${url}${force ? " (forced)" : ""}`);
  const html = await fetchHtml(url, cachePath, force);
  const fromCache = !force && existsSync(cachePath);
  console.log(`  ${html.length} bytes ${fromCache ? "(cached)" : "(network)"}`);

  const parsed = parseAttributePage(html);
  console.log(`  Parsed ${parsed.length} courses from .sc_courselist table`);

  // Load current courses.json (migrate every entry to the latest schema).
  const courses = existsSync(COURSES_PATH)
    ? JSON.parse(readFileSync(COURSES_PATH, "utf8"))
    : {};
  for (const id of Object.keys(courses)) {
    courses[id] = migrateEntry({ id, ...courses[id] });
  }

  // Merge.
  let mergedCount = 0;
  let createdCount = 0;
  for (const p of parsed) {
    if (courses[p.id]) {
      addUnique(courses[p.id].attributes, ATTRIBUTE);
      mergedCount += 1;
    } else {
      courses[p.id] = migrateEntry({
        id: p.id,
        title: p.title,
        cu: p.cu,
        level: parseLevel(p.id),
        attributes: [ATTRIBUTE],
      });
      createdCount += 1;
    }
  }

  // Write sorted.
  const sorted = Object.fromEntries(
    Object.keys(courses).sort().map((id) => [id, courses[id]])
  );
  writeFileSync(COURSES_PATH, JSON.stringify(sorted, null, 2) + "\n");

  console.log(`\n=== fetchAttribute(${ATTRIBUTE}) summary ===`);
  console.log(`  merged into existing entries: ${mergedCount}`);
  console.log(`  created new entries:          ${createdCount}`);
  console.log(`  total in courses.json now:    ${Object.keys(sorted).length}`);
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
