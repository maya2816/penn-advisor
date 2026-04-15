/**
 * prereqStatus.js
 *
 * Per-course prerequisite satisfaction check, used by the Semesters
 * planner to render the green/amber/none "Prereqs ready" chip on each
 * planned course tile.
 *
 * The catalog stores per-course prereqs as a flat array of course ids
 * in `courses[id].prerequisites`. This module's job is to compare that
 * list against the union of (a) the student's completed-courses set
 * and (b) the courses planned in earlier terms — and report what's
 * missing, if anything.
 *
 * IMPORTANT EDGE CASE: Penn's catalog sometimes references retired or
 * renumbered courses in its prereq lists (e.g., CIS 3200 references
 * CIS 2620, which doesn't exist in our catalog). We TREAT THOSE AS
 * SATISFIED — they're a data quality issue, not a real gap, and
 * blocking on them would surface confusing warnings to the student.
 * The chat advisor can still flag them as a separate concern later.
 *
 * Pure function, no React, no localStorage.
 */

import courses from "../data/courses.json" with { type: "json" };

/**
 * @typedef {Object} PrereqStatusResult
 * @property {"satisfied"|"missing"|"no-prereqs"} status
 * @property {string[]} missing  Course IDs not yet in the timeline (real
 *                                courses that exist in courses.json but
 *                                aren't in completed or plannedBefore).
 *                                Always empty unless status === "missing".
 */

/**
 * @param {string} courseId  e.g. "CIS4190"
 * @param {{ completedSet: Set<string>, plannedBefore: Set<string> }} ctx
 * @returns {PrereqStatusResult}
 */
export function getPrereqStatus(courseId, { completedSet, plannedBefore }) {
  const cat = courses[courseId];
  const prereqs = cat?.prerequisites ?? [];
  if (prereqs.length === 0) {
    return { status: "no-prereqs", missing: [] };
  }

  const missing = [];
  for (const p of prereqs) {
    // A prereq pointing to a course not in our catalog is treated as
    // "satisfied" — it's a Penn data quality issue, not a real gap.
    // (See e.g. CIS 3200 → CIS 2620 in the current catalog.)
    if (!courses[p]) continue;
    if (completedSet.has(p)) continue;
    if (plannedBefore.has(p)) continue;
    missing.push(p);
  }

  if (missing.length === 0) {
    return { status: "satisfied", missing: [] };
  }
  return { status: "missing", missing };
}
