/**
 * scripts/ingest/normalizeTechElectives.mjs
 *
 * Reads the raw Penn CIS tech-electives JSON (saved verbatim at
 * src/data/raw/tech_electives_raw.json) and merges it into
 * src/data/courses.json.
 *
 * Idempotent — running it twice produces the same output as running it once.
 *
 * What it does, step by step:
 *   1. Reads the existing courses.json (or starts with {} if missing).
 *   2. Migrates every existing entry to the latest schema by adding the new
 *      fields (prerequisites, mutuallyExclusive, tech_elective_status) with
 *      sensible defaults if they aren't already present. This is the
 *      "auto-migrate" step.
 *   3. Reads the raw tech-electives JSON.
 *   4. For each entry whose `status` is unrestricted/restricted/ask:
 *        - normalizes "ACCT 1010" -> "ACCT1010"
 *        - if the course already exists in courses.json, merges:
 *            attributes += "TECH_ELECTIVE"
 *            tech_elective_status = <status from source>
 *        - otherwise creates a new entry with defaults.
 *   5. Writes courses.json back, sorted by id for clean diffs.
 *   6. Prints a summary of what happened.
 *
 * Run with:
 *   node scripts/ingest/normalizeTechElectives.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const COURSES_PATH = resolve(ROOT, "src/data/courses.json");
const RAW_PATH = resolve(ROOT, "src/data/raw/tech_electives_raw.json");

// ---------- helpers ----------

/** Strip the space from "ACCT 1010" -> "ACCT1010". Idempotent. */
function normalizeId(course4d) {
  return course4d.replace(/\s+/g, "");
}

/** Parse the level (1000 / 2000 / 3000 / ...) from a course id. */
function parseLevel(id) {
  const m = id.match(/(\d+)/);
  if (!m) return 0;
  // First digit * 1000. CIS1100 -> 1000, ESE6500 -> 6000, LING0500 -> 0.
  return Math.floor(parseInt(m[1], 10) / 1000) * 1000;
}

/** Ensure a course entry has every field the latest schema requires. */
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

/** Add a value to an array iff it isn't already there. Mutates in place. */
function addUnique(arr, val) {
  if (!arr.includes(val)) arr.push(val);
}

// ---------- main ----------

function main() {
  // 1. Load courses.json
  const courses = existsSync(COURSES_PATH)
    ? JSON.parse(readFileSync(COURSES_PATH, "utf8"))
    : {};

  // 2. Migrate every existing entry to the latest schema.
  let migratedCount = 0;
  for (const id of Object.keys(courses)) {
    const before = JSON.stringify(courses[id]);
    courses[id] = migrateEntry({ id, ...courses[id] });
    if (JSON.stringify(courses[id]) !== before) migratedCount += 1;
  }

  // 3. Load raw tech electives.
  if (!existsSync(RAW_PATH)) {
    console.error(`ERROR: raw input not found at ${RAW_PATH}`);
    console.error(`Run: curl -o ${RAW_PATH} https://advising.cis.upenn.edu/assets/json/37cu_csci_tech_elective_list.json`);
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(RAW_PATH, "utf8"));

  // 4. Merge.
  const KEEP_STATUSES = new Set(["unrestricted", "restricted", "ask"]);
  let createdCount = 0;
  let mergedCount = 0;
  let droppedCount = 0;
  const warnings = [];

  for (const entry of raw) {
    if (!KEEP_STATUSES.has(entry.status)) {
      droppedCount += 1;
      continue;
    }
    const id = normalizeId(entry.course4d);

    if (courses[id]) {
      // Merge into existing entry.
      addUnique(courses[id].attributes, "TECH_ELECTIVE");
      // If multiple sources disagree on status, keep the most permissive.
      // Order of permissiveness: unrestricted > restricted > ask.
      const order = { unrestricted: 3, restricted: 2, ask: 1 };
      const current = courses[id].tech_elective_status;
      if (!current || order[entry.status] > order[current]) {
        courses[id].tech_elective_status = entry.status;
      }
      // Optional sanity check: title mismatch worth noting.
      if (courses[id].title !== entry.title) {
        // The catalog title is authoritative; we don't overwrite. But log it.
        // (Suppress for now — too noisy.)
      }
      mergedCount += 1;
    } else {
      // Create a new entry.
      courses[id] = migrateEntry({
        id,
        title: entry.title,
        cu: 1,
        level: parseLevel(id),
        attributes: ["TECH_ELECTIVE"],
        prerequisites: [],
        mutuallyExclusive: [],
        tech_elective_status: entry.status,
      });
      createdCount += 1;
    }
  }

  // 5. Write sorted output.
  const sorted = Object.fromEntries(
    Object.keys(courses)
      .sort()
      .map((id) => [id, courses[id]])
  );
  writeFileSync(COURSES_PATH, JSON.stringify(sorted, null, 2) + "\n");

  // 6. Summary.
  console.log("\n=== normalizeTechElectives summary ===");
  console.log(`Existing courses migrated to latest schema: ${migratedCount}`);
  console.log(`Tech-electives kept (unrestricted/restricted/ask): ${mergedCount + createdCount}`);
  console.log(`  - merged into existing entries:               ${mergedCount}`);
  console.log(`  - created new entries:                        ${createdCount}`);
  console.log(`Tech-electives dropped (status=no):             ${droppedCount}`);
  console.log(`Total courses now in courses.json:              ${Object.keys(sorted).length}`);
  if (warnings.length) {
    console.log("\nWarnings:");
    for (const w of warnings) console.log("  - " + w);
  }
}

main();
