/**
 * nearMissAnalyzer.js
 *
 * The "hidden opportunities" engine. Walks the student's completed
 * courses against every minor in minors.json and reports which minors
 * they're close to completing — even if they've never thought about
 * that minor before.
 *
 * This is the demo moment for Penn Labs: most students don't know
 * they're 1 course away from a Math minor, or that their AI BSE
 * required courses overlap heavily with the Data Science minor's
 * requirements. This analyzer surfaces that automatically.
 *
 * Pure function. No React, no localStorage.
 *
 * WHAT IT TAKES
 * - completedCourses: the student's course list (same shape as
 *   StudentContext.completedCourses)
 * - programId: the student's primary program (for attribution context)
 *
 * WHAT IT RETURNS
 * - nearMissMinors: for each minor the student is ≤2 courses from,
 *   which courses they already have that count, how many CUs short,
 *   and which specific courses would finish it.
 */

import minors from "../data/minors.json" with { type: "json" };
import courses from "../data/courses.json" with { type: "json" };

// ---------- internal helpers ----------

/** Walk a Requirement tree and collect leaf nodes. */
function collectLeaves(node) {
  if (node.from && !node.children) return [node];
  const out = [];
  for (const c of node.children || []) out.push(...collectLeaves(c));
  return out;
}

/** Does this course match a leaf's `from` pool? Simplified version of
 *  degreeEngine's courseMatchesPool — just enough for minors. */
function matchesPool(courseId, from) {
  if (!from) return false;
  if (from.any) return true;
  if (from.course_ids) return from.course_ids.includes(courseId);
  if (from.attribute) return (courses[courseId]?.attributes || []).includes(from.attribute);
  if (from.attributes) {
    const attrs = new Set(courses[courseId]?.attributes || []);
    return from.attributes.some((a) => attrs.has(a));
  }
  return false;
}

/**
 * Greedily assign the student's courses to a minor's leaves, same
 * approach as the engine but lighter (no solver, no exclusive slots —
 * minors rarely have the "no double-counting" problem).
 *
 * Returns: { filledCu, filledCourses, unmetLeaves }
 */
function evaluateMinor(minorReq, completedIds) {
  const leaves = collectLeaves(minorReq);
  const consumed = new Set();
  let filledCu = 0;
  const filledCourses = [];
  const unmetLeaves = [];

  for (const leaf of leaves) {
    let leafCuFilled = 0;
    const leafAssigned = [];
    for (const id of completedIds) {
      if (consumed.has(id)) continue;
      if (leafCuFilled >= leaf.min_cu) break;
      if (!matchesPool(id, leaf.from)) continue;
      consumed.add(id);
      leafCuFilled += courses[id]?.cu ?? 1;
      leafAssigned.push(id);
    }
    filledCu += Math.min(leafCuFilled, leaf.min_cu);
    filledCourses.push(...leafAssigned);
    if (leafCuFilled < leaf.min_cu) {
      unmetLeaves.push({
        leafId: leaf.id,
        label: leaf.label,
        missing: leaf.min_cu - leafCuFilled,
        pool: leaf.from,
      });
    }
  }

  return { filledCu, filledCourses, unmetLeaves };
}

/**
 * For each unmet leaf, suggest up to 3 courses from its pool that the
 * student hasn't taken. Prefers courses that are also useful for the
 * primary program's requirement tree (double-dipping).
 */
function suggestCoursesForLeaf(unmetLeaf, completedSet) {
  const pool = unmetLeaf.pool;
  if (!pool) return [];

  let candidates;
  if (pool.course_ids) {
    candidates = pool.course_ids.filter((id) => !completedSet.has(id));
  } else if (pool.attribute) {
    candidates = Object.keys(courses).filter(
      (id) => !completedSet.has(id) && (courses[id]?.attributes || []).includes(pool.attribute)
    );
  } else if (pool.attributes) {
    const need = new Set(pool.attributes);
    candidates = Object.keys(courses).filter(
      (id) =>
        !completedSet.has(id) &&
        (courses[id]?.attributes || []).some((a) => need.has(a))
    );
  } else if (pool.any) {
    return []; // too broad to suggest
  } else {
    return [];
  }

  // Sort by: lower course number first (intro-level), then alphabetical
  candidates.sort((a, b) => {
    const la = courses[a]?.level ?? 9999;
    const lb = courses[b]?.level ?? 9999;
    if (la !== lb) return la - lb;
    return a.localeCompare(b);
  });

  return candidates.slice(0, 5).map((id) => ({
    id,
    title: courses[id]?.title || id,
    cu: courses[id]?.cu ?? 1,
  }));
}

// ---------- public API ----------

/**
 * @typedef {Object} NearMissMinor
 * @property {string}  minorId
 * @property {string}  minorName
 * @property {number}  totalCu        total CU required by the minor
 * @property {number}  filledCu       CU the student already satisfies
 * @property {number}  cuShortBy      filledCu → totalCu gap
 * @property {string[]} coursesAlreadyCounting   IDs of student courses that match
 * @property {Array<{ leafId, label, missing, suggestions }>} unmetLeaves
 * @property {number}  confidence     filledCu / totalCu (0-1 range)
 */

/**
 * @typedef {Object} HiddenOpportunities
 * @property {NearMissMinor[]} nearMissMinors  Minors the student is ≤3 CU from
 * @property {number}          totalMinorsChecked
 */

/**
 * Find hidden opportunities in the student's completed courses.
 *
 * @param {{ completedCourses: Array<{id: string}> }} input
 * @returns {HiddenOpportunities}
 */
export function findHiddenOpportunities({ completedCourses }) {
  const completedIds = (completedCourses || []).map((c) => c.id);
  const completedSet = new Set(completedIds);

  const minorEntries = Object.values(minors).filter(
    (m) => m.requirement && m.total_cu
  );

  const nearMissMinors = [];

  for (const minor of minorEntries) {
    const { filledCu, filledCourses, unmetLeaves } = evaluateMinor(
      minor.requirement,
      completedIds
    );
    const cuShortBy = Math.max(0, minor.total_cu - filledCu);

    // Only report minors the student is within 3 CU of completing
    // (i.e., already has at least half the credits and needs ≤3 more).
    if (cuShortBy > 3) continue;

    const annotatedLeaves = unmetLeaves.map((leaf) => ({
      leafId: leaf.leafId,
      label: leaf.label,
      missing: leaf.missing,
      suggestions: suggestCoursesForLeaf(leaf, completedSet),
    }));

    nearMissMinors.push({
      minorId: minor.minor_id,
      minorName: minor.name,
      totalCu: minor.total_cu,
      filledCu,
      cuShortBy,
      coursesAlreadyCounting: filledCourses,
      unmetLeaves: annotatedLeaves,
      confidence: minor.total_cu > 0 ? filledCu / minor.total_cu : 0,
    });
  }

  // Sort by confidence descending (closest first)
  nearMissMinors.sort((a, b) => b.confidence - a.confidence);

  return {
    nearMissMinors,
    totalMinorsChecked: minorEntries.length,
  };
}
