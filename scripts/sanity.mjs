/**
 * scripts/sanity.mjs
 *
 * Throwaway smoke test for the data layer. Run with:
 *   node scripts/sanity.mjs
 *
 * Exercises three cases that together cover the engine's interesting paths:
 *   A) Empty student            -> everything should be 'unmet', total = 0
 *   B) Partial junior           -> CU rollup, partial sections, conflicts list
 *   C) Double-counted course    -> assignment solver picks one slot, not both
 */

import { computeCompletion } from "../src/utils/degreeEngine.js";

function summarize(label, result) {
  console.log("\n=== " + label + " ===");
  console.log(
    `Total CU: ${result.totalCuCompleted} / ${result.totalCuRequired}`
  );
  for (const child of result.root.children || []) {
    console.log(
      `  [${child.status.padEnd(8)}] ${child.label.padEnd(34)} ${child.completedCu}/${child.requiredCu}`
    );
    if (child.children) {
      for (const leaf of child.children) {
        const got = leaf.satisfiedBy.length ? ` <- ${leaf.satisfiedBy.join(",")}` : "";
        console.log(
          `      [${leaf.status.padEnd(8)}] ${leaf.label.padEnd(30)} ${leaf.completedCu}/${leaf.requiredCu}${got}`
        );
      }
    }
  }
  if (result.unassignedCourses.length) {
    console.log(`  Unassigned: ${result.unassignedCourses.join(", ")}`);
  }
  if (result.conflicts.length) {
    console.log(`  Conflicts:`);
    for (const c of result.conflicts) {
      console.log(`    - ${c.slotId}: ${c.candidates.join(", ")}`);
    }
  }
  if (result.warnings.length) {
    console.log(`  Warnings:`);
    for (const w of result.warnings) console.log(`    - ${w}`);
  }
  if (result.prereqViolations?.length) {
    console.log(`  Prereq violations:`);
    for (const v of result.prereqViolations) {
      console.log(`    - ${v.courseId} is missing: ${v.missing.join(", ")}`);
    }
  }
  if (result.mutexConflicts?.length) {
    console.log(`  Mutex conflicts:`);
    for (const c of result.mutexConflicts) {
      console.log(`    - ${c.courseA} <-> ${c.courseB}`);
    }
  }
}

// --- Case A: empty student ---
summarize("A) Empty student", computeCompletion([], "SEAS_AI_BSE"));

// --- Case B: partial junior who has knocked out most of the core ---
const juniorIds = [
  "CIS1100", "CIS1200", "CIS1210", "CIS2450", "CIS3200",
  "MATH1400", "MATH1410", "CIS1600", "ESE2030", "ESE3010", "ESE4020",
  "CIS5210", "CIS5190", "ESE2100", "ESE3040", "CIS5300",
];
summarize(
  "B) Partial junior",
  computeCompletion(juniorIds.map((id) => ({ id })), "SEAS_AI_BSE")
);

// --- Case C: the conflict case ---
// Student took both CIS5300 (V&L) AND CIS4300 (also V&L, also AI Project).
// The solver should put CIS5300 in V&L and CIS4300 in AI Project (or vice
// versa) — what matters is that BOTH the V&L and AI Project slots are
// filled, not double-counted on a single course.
const conflictIds = [...juniorIds, "CIS4300"];
summarize(
  "C) Conflict (CIS4300 + CIS5300 both eligible for V&L)",
  computeCompletion(conflictIds.map((id) => ({ id })), "SEAS_AI_BSE")
);

// --- Case E: full attribute coverage ---
// A near-complete student: junior core + nat-sci + cog-sci + writing seminar
// + 2 more SS/H + 1 SS/H/TBS + free elective + 3 tech electives + AI ethics +
// AI project + senior design.
// Goal: prove every attribute-based requirement actually fires.
const fullCoverage = [
  // Computing (5)
  "CIS1100","CIS1200","CIS1210","CIS2450","CIS3200",
  // Math/Sci core (6) + nat-sci elective from EUNS list
  "MATH1400","MATH1410","CIS1600","ESE2030","ESE3010","ESE4020","ASTR1211",
  // AI 6 categories (6 CU)
  "CIS5210","CIS5190","ESE2100","ESE3040","CIS5300","NETS2120",
  // AI electives (6 more CU)
  "CIS3500","ESE3060","ESE6740","CIS6200","CIS5800","NETS3120",
  // Senior design (2)
  "CIS4000","CIS4010",
  // Tech electives (3)
  "BE2000","ECON4100","PHIL4721",
  // General electives:
  //   AI Ethics
  "CIS4230",
  //   Cog Sci
  "COGS1001",
  //   3 SS/H including a writing seminar (the writing seminar counts as 1 of the 3)
  "WRIT0020","AFRC0008","AFRC0010",
  //   2 SS/H/TBS
  "AAMW5120","AAMW5190",
  //   Free elective
  "ENGL1310",
];
summarize(
  "E) Full attribute coverage",
  computeCompletion(fullCoverage.map((id) => ({ id })), "SEAS_AI_BSE")
);

// --- Case D: tech electives via the TECH_ELECTIVE attribute ---
// Add three courses tagged TECH_ELECTIVE by the normalizer to the junior's
// list. We expect the Technical Electives section (3/3) to go complete.
// Picking three from different statuses to verify all three count.
const withTechElectives = [
  ...juniorIds,
  "BE2000",   // unrestricted
  "ECON4100", // unrestricted
  "PHIL4721", // unrestricted
];
summarize(
  "D) Tech electives (BE2000 + ECON4100 + PHIL4721)",
  computeCompletion(withTechElectives.map((id) => ({ id })), "SEAS_AI_BSE")
);

// --- Case F: prereq violation ---
// CIS4190 (Applied ML) requires CIS1210. We give the student CIS4190 but
// withhold CIS1210. Engine should still let CIS4190 fill the ML slot, but
// emit a prereqViolations entry so the dashboard / advisor can flag it.
const prereqMissing = [
  "CIS1100","CIS1200", // note: NOT CIS1210
  "CIS4190",           // requires CIS1210
];
summarize(
  "F) Prereq violation (CIS4190 without CIS1210)",
  computeCompletion(prereqMissing.map((id) => ({ id })), "SEAS_AI_BSE")
);

// --- Case G: mutex conflict ---
// Student claims credit for both CIS4190 and CIS5190 — same course taught
// in two cross-listed sections. Engine should still complete the ML slot
// (with one of them), but emit a mutexConflicts entry.
const mutexPair = [
  ...juniorIds.filter((id) => id !== "CIS5190"), // remove CIS5190 from base junior
  "CIS4190",
  "CIS5190",
];
summarize(
  "G) Mutex conflict (CIS4190 + CIS5190)",
  computeCompletion(mutexPair.map((id) => ({ id })), "SEAS_AI_BSE")
);
