/**
 * scripts/ingest/validatePcrSnapshot.mjs
 *
 * Pre-migration sanity check. Compares the PCR snapshot
 * (src/data/raw/pcr_snapshot.json) against our courses.json and
 * programs.json to ensure critical AI BSE courses are present and
 * the merge didn't lose anything important.
 *
 * Reports:
 *   1. Coverage: how many courses PCR adds vs our existing catalog
 *   2. AI BSE critical courses: every course referenced by the
 *      program tree — are they in PCR, in our catalog, or missing?
 *   3. Schema enrichment: how many courses gained descriptions/ratings
 *   4. Delta: courses in PCR but not ours, and vice versa
 *
 * Run with:
 *   node scripts/ingest/validatePcrSnapshot.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pcrIdToInternal } from "../../src/utils/normalizePcrId.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const COURSES_PATH = resolve(ROOT, "src/data/courses.json");
const SNAPSHOT_PATH = resolve(ROOT, "src/data/raw/pcr_snapshot.json");
const PROGRAMS_PATH = resolve(ROOT, "src/data/programs.json");

function collectProgramCourseIds(node) {
  const ids = new Set();
  if (node.from?.course_ids) {
    for (const id of node.from.course_ids) ids.add(id);
  }
  if (node.children) {
    for (const c of node.children) {
      for (const id of collectProgramCourseIds(c)) ids.add(id);
    }
  }
  return ids;
}

async function main() {
  if (!existsSync(SNAPSHOT_PATH)) {
    console.error("ERROR: PCR snapshot not found. Run fetchPcrCatalog.mjs first.");
    process.exit(1);
  }

  const courses = JSON.parse(readFileSync(COURSES_PATH, "utf8"));
  const pcrRaw = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  const programs = JSON.parse(readFileSync(PROGRAMS_PATH, "utf8"));

  const catalogIds = new Set(Object.keys(courses));
  const pcrIds = new Set(pcrRaw.map((c) => pcrIdToInternal(c.id)).filter(Boolean));

  // Section 1: Overall coverage
  const inBoth = [...pcrIds].filter((id) => catalogIds.has(id));
  const inPcrOnly = [...pcrIds].filter((id) => !catalogIds.has(id));
  const inCatalogOnly = [...catalogIds].filter((id) => !pcrIds.has(id));

  console.log("=== 1. Overall Coverage ===");
  console.log(`  Our catalog:     ${catalogIds.size} courses`);
  console.log(`  PCR snapshot:    ${pcrIds.size} courses`);
  console.log(`  In both:         ${inBoth.length}`);
  console.log(`  PCR-only (new):  ${inPcrOnly.length}`);
  console.log(`  Catalog-only:    ${inCatalogOnly.length} (not offered this semester)`);

  // Section 2: AI BSE critical courses
  const program = programs.SEAS_AI_BSE;
  if (!program) {
    console.log("\n=== 2. Program Check: SKIPPED (no SEAS_AI_BSE in programs.json) ===");
  } else {
    const programIds = collectProgramCourseIds(program.requirement);
    console.log(`\n=== 2. AI BSE Critical Courses (${programIds.size} referenced) ===`);
    let inPcr = 0, inCatalog = 0, missing = 0;
    const missingList = [];
    for (const id of programIds) {
      const hasPcr = pcrIds.has(id);
      const hasCat = catalogIds.has(id);
      if (hasPcr) inPcr++;
      if (hasCat) inCatalog++;
      if (!hasCat) {
        missing++;
        missingList.push(id);
      }
    }
    console.log(`  In PCR current:  ${inPcr} / ${programIds.size}`);
    console.log(`  In our catalog:  ${inCatalog} / ${programIds.size}`);
    if (missingList.length > 0) {
      console.log(`  MISSING from catalog: ${missingList.join(", ")}`);
    } else {
      console.log(`  ✓ All program courses present in catalog`);
    }
  }

  // Section 3: Schema enrichment
  let withDesc = 0, withRating = 0, withPrereqs = 0, withMutex = 0, withAttrs = 0;
  for (const e of Object.values(courses)) {
    if (e.description && e.description.length > 0) withDesc++;
    if (e.courseQuality != null) withRating++;
    if (e.prerequisites?.length > 0) withPrereqs++;
    if (e.mutuallyExclusive?.length > 0) withMutex++;
    if (e.attributes?.length > 0) withAttrs++;
  }
  console.log(`\n=== 3. Schema Enrichment ===`);
  console.log(`  With descriptions:  ${withDesc} (${(100 * withDesc / catalogIds.size).toFixed(0)}%)`);
  console.log(`  With ratings:       ${withRating} (${(100 * withRating / catalogIds.size).toFixed(0)}%)`);
  console.log(`  With prerequisites: ${withPrereqs}`);
  console.log(`  With mutex:         ${withMutex}`);
  console.log(`  With attributes:    ${withAttrs}`);

  // Section 4: Title mismatches (PCR vs ours) on important courses
  if (program) {
    const programIds = collectProgramCourseIds(program.requirement);
    const mismatches = [];
    for (const id of programIds) {
      const ours = courses[id]?.title;
      const pcr = pcrRaw.find((c) => pcrIdToInternal(c.id) === id);
      if (pcr && ours && pcr.title !== ours) {
        mismatches.push({ id, ours, pcr: pcr.title });
      }
    }
    if (mismatches.length > 0) {
      console.log(`\n=== 4. Title Mismatches (AI BSE courses) ===`);
      for (const m of mismatches.slice(0, 15)) {
        console.log(`  ${m.id}: ours="${m.ours}" vs pcr="${m.pcr}"`);
      }
    } else {
      console.log(`\n=== 4. Title Mismatches: none for AI BSE courses ===`);
    }
  }

  console.log("\n✓ Validation complete.");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
