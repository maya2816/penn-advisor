/**
 * scripts/ingest/fetchPcrCatalog.mjs
 *
 * Fetches the Penn Course Review catalog for the current semester and
 * MERGES it with our existing courses.json. The merge strategy:
 *
 *   - PCR provides NEW fields we don't have: description, courseQuality,
 *     difficulty, workRequired, instructorQuality. These get added to
 *     every course PCR knows about.
 *   - PCR also updates: title, cu (from credits). PCR is the fresher
 *     source for these since it's updated every semester.
 *   - Our EXISTING data keeps: prerequisites, mutuallyExclusive,
 *     attributes, tech_elective_status, tags. The PCR list endpoint
 *     doesn't return these fields (only the per-course detail endpoint
 *     does, and even then prereqs are unreliable text). Our scraped
 *     data is the better source for these.
 *   - Courses in PCR but NOT in our catalog get added with basic fields
 *     (no prereqs/attrs — those would come from future overlay scripts
 *     or individual detail lookups).
 *   - Courses in our catalog but NOT in PCR stay unchanged (they exist
 *     in the catalog but aren't offered this semester).
 *
 * The raw PCR response is saved to src/data/raw/pcr_snapshot.json for
 * auditing. The merged result replaces src/data/courses.json.
 *
 * Run with:
 *   node scripts/ingest/fetchPcrCatalog.mjs           # current semester
 *   node scripts/ingest/fetchPcrCatalog.mjs --semester=2026A  # specific
 *
 * Idempotent. Re-running overwrites the snapshot and re-merges.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pcrIdToInternal } from "../../src/utils/normalizePcrId.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const COURSES_PATH = resolve(ROOT, "src/data/courses.json");
const SNAPSHOT_PATH = resolve(ROOT, "src/data/raw/pcr_snapshot.json");
const PCR_BASE = "https://penncoursereview.com";

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
    // PCR-enriched fields (null if never populated):
    description: entry.description ?? null,
    courseQuality: entry.courseQuality ?? null,
    difficulty: entry.difficulty ?? null,
    workRequired: entry.workRequired ?? null,
    instructorQuality: entry.instructorQuality ?? null,
  };
}

// ---------- main ----------

async function main() {
  const args = process.argv.slice(2);
  const semesterArg = args.find((a) => a.startsWith("--semester="));
  const semester = semesterArg ? semesterArg.split("=")[1] : "current";

  console.log(`\nFetching PCR catalog for semester="${semester}"...`);
  const url = `${PCR_BASE}/api/base/${semester}/courses/`;

  let res;
  try {
    res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "PennAdvisor-Ingest/1.0",
      },
    });
  } catch (err) {
    console.error("ERROR: network fetch failed:", err.message);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`ERROR: HTTP ${res.status} from ${url}`);
    process.exit(1);
  }

  const pcrData = await res.json();
  if (!Array.isArray(pcrData)) {
    console.error("ERROR: expected array from PCR, got", typeof pcrData);
    process.exit(1);
  }

  console.log(`  Received ${pcrData.length} courses from PCR (semester ${semester})`);

  // Save raw snapshot
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(pcrData, null, 2));
  console.log(`  Raw snapshot saved to ${SNAPSHOT_PATH}`);

  // Load existing courses.json
  const existing = existsSync(COURSES_PATH)
    ? JSON.parse(readFileSync(COURSES_PATH, "utf8"))
    : {};

  // Migrate every existing entry to the latest schema (adds new PCR fields with null).
  for (const id of Object.keys(existing)) {
    existing[id] = migrateEntry({ id, ...existing[id] });
  }

  let mergedCount = 0;
  let createdCount = 0;
  let skippedCount = 0;

  for (const pcr of pcrData) {
    const id = pcrIdToInternal(pcr.id);
    if (!id) {
      skippedCount += 1;
      continue;
    }

    // PCR fields we always trust (fresher source):
    const pcrTitle = pcr.title || null;
    const pcrCu = typeof pcr.credits === "number" ? pcr.credits : null;
    const pcrDesc = pcr.description || null;
    const pcrCQ = typeof pcr.course_quality === "number" ? pcr.course_quality : null;
    const pcrDiff = typeof pcr.difficulty === "number" ? pcr.difficulty : null;
    const pcrWork = typeof pcr.work_required === "number" ? pcr.work_required : null;
    const pcrIQ = typeof pcr.instructor_quality === "number" ? pcr.instructor_quality : null;

    if (existing[id]) {
      // MERGE: PCR updates title/cu/description/ratings; everything
      // else stays from our existing data.
      const e = existing[id];
      if (pcrTitle) e.title = pcrTitle;
      if (pcrCu != null && pcrCu > 0) e.cu = pcrCu;
      e.description = pcrDesc;
      e.courseQuality = pcrCQ;
      e.difficulty = pcrDiff;
      e.workRequired = pcrWork;
      e.instructorQuality = pcrIQ;
      mergedCount += 1;
    } else {
      // CREATE: new course from PCR with basic fields only.
      existing[id] = migrateEntry({
        id,
        title: pcrTitle || id,
        cu: pcrCu ?? 1,
        level: parseLevel(id),
        description: pcrDesc,
        courseQuality: pcrCQ,
        difficulty: pcrDiff,
        workRequired: pcrWork,
        instructorQuality: pcrIQ,
      });
      createdCount += 1;
    }
  }

  // Write sorted result.
  const sorted = Object.fromEntries(
    Object.keys(existing).sort().map((id) => [id, existing[id]])
  );
  writeFileSync(COURSES_PATH, JSON.stringify(sorted, null, 2) + "\n");

  const totalEntries = Object.keys(sorted).length;

  console.log(`\n=== fetchPcrCatalog summary ===`);
  console.log(`  PCR courses received:     ${pcrData.length}`);
  console.log(`  Merged into existing:     ${mergedCount}`);
  console.log(`  Created new entries:      ${createdCount}`);
  console.log(`  Skipped (bad id format):  ${skippedCount}`);
  console.log(`  Total in courses.json:    ${totalEntries}`);

  // Quick coverage stats.
  let withDesc = 0, withRatings = 0;
  for (const e of Object.values(sorted)) {
    if (e.description) withDesc++;
    if (e.courseQuality != null) withRatings++;
  }
  console.log(`  With descriptions:        ${withDesc} (${(100 * withDesc / totalEntries).toFixed(0)}%)`);
  console.log(`  With ratings:             ${withRatings} (${(100 * withRatings / totalEntries).toFixed(0)}%)`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
