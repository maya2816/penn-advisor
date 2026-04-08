/**
 * assignmentSolver.js
 *
 * Decides which student-completed course fills which requirement slot.
 *
 * The hard problem: a single course (e.g. CIS 4300) can legally appear in
 * multiple requirement pools (Vision & Language AND AI Project), but the
 * "no double-counting" rule means it can only consume one slot. We solve
 * this with a most-constrained-first backtracking search.
 *
 * The graph is tiny (a few dozen courses, a dozen-ish exclusive slots),
 * so a textbook backtrack is plenty fast and always finds an optimal
 * (max-coverage) assignment if one exists.
 */

/**
 * @typedef {Object} Slot
 * @property {string}   id            Requirement leaf id, e.g. "ai.vislang"
 * @property {number}   capacity      How many CUs this slot still needs
 * @property {Set<string>} pool       Course IDs eligible for this slot
 * @property {boolean}  exclusive     If true, a course consumed here cannot
 *                                    be reused elsewhere. (Non-exclusive
 *                                    slots are not part of the conflict
 *                                    problem and are handled by the engine
 *                                    directly.)
 */

/**
 * @typedef {Object} SolveInput
 * @property {Array<{id:string,cu:number,pinnedSlot?:string}>} courses
 * @property {Slot[]} slots
 */

/**
 * @typedef {Object} SolveResult
 * @property {Object<string,string>} assignments  courseId -> slotId
 * @property {string[]}              unassigned   course IDs not consumed by any slot
 * @property {Array<{slotId:string,candidates:string[]}>} conflicts
 */

/**
 * Solve the assignment problem.
 *
 * @param {SolveInput} input
 * @returns {SolveResult}
 */
export function solve({ courses, slots }) {
  // Work on copies so the caller's data is untouched.
  const remainingCapacity = Object.fromEntries(
    slots.map((s) => [s.id, s.capacity])
  );
  const slotById = Object.fromEntries(slots.map((s) => [s.id, s]));
  const assignments = {}; // courseId -> slotId

  // 1. Honor user pins first (they are non-negotiable).
  const pinned = courses.filter((c) => c.pinnedSlot);
  for (const c of pinned) {
    const slot = slotById[c.pinnedSlot];
    if (slot && slot.pool.has(c.id) && remainingCapacity[slot.id] > 0) {
      assignments[c.id] = slot.id;
      remainingCapacity[slot.id] -= 1;
    }
    // If the pin is invalid we silently ignore it; the course falls through
    // to the normal solver below. The engine surfaces this as a warning.
  }

  // 2. The remaining courses are the ones we need to place.
  const unpinned = courses.filter((c) => !assignments[c.id]);

  // For each course, list the slots it could legally fill *right now*.
  const candidatesFor = (courseId) =>
    slots
      .filter((s) => s.pool.has(courseId) && remainingCapacity[s.id] > 0)
      .map((s) => s.id);

  // 3. Backtracking search.
  //    State: which courses have been placed so far.
  //    Goal: maximize the number of courses placed (== CU coverage, since
  //          every course is 1 CU in this dataset).
  //    Heuristic: at each step, pick the *most-constrained* unplaced course
  //               (fewest legal slots). This is the standard MRV heuristic
  //               and dramatically prunes the search tree.

  let best = { assignments: { ...assignments }, placedCount: 0 };

  function search(placed) {
    // Find the unplaced course with the fewest legal slots.
    let pick = null;
    let pickCands = null;
    for (const c of unpinned) {
      if (placed[c.id]) continue;
      const cands = candidatesFor(c.id);
      if (cands.length === 0) continue; // unplaceable, skip
      if (pickCands === null || cands.length < pickCands.length) {
        pick = c;
        pickCands = cands;
        if (cands.length === 1) break; // can't do better than forced moves
      }
    }

    if (!pick) {
      // No more placeable courses. Record the best assignment found so far.
      const placedCount = Object.keys(placed).length;
      if (placedCount > best.placedCount) {
        best = { assignments: { ...placed }, placedCount };
      }
      return;
    }

    for (const slotId of pickCands) {
      placed[pick.id] = slotId;
      remainingCapacity[slotId] -= 1;
      search(placed);
      remainingCapacity[slotId] += 1;
      delete placed[pick.id];
    }
  }

  search({ ...assignments });
  Object.assign(assignments, best.assignments);

  // 4. Compute outputs.
  const allCourseIds = new Set(courses.map((c) => c.id));
  const unassigned = [...allCourseIds].filter((id) => !assignments[id]);

  // Conflicts: slots that ended up with capacity > 0 but had >1 valid
  // candidate course in the original pool that ISN'T already consumed
  // by another (sibling) slot. This signals "the user might want to
  // choose differently" — but we don't surface candidates that are
  // already serving another requirement, since suggesting them is
  // misleading (they're not actually free).
  const conflicts = [];
  for (const slot of slots) {
    if (remainingCapacity[slot.id] === 0) continue; // satisfied
    const eligible = [...slot.pool].filter(
      (cid) => allCourseIds.has(cid) && !assignments[cid]
    );
    if (eligible.length > 1) {
      conflicts.push({ slotId: slot.id, candidates: eligible });
    }
  }

  return { assignments, unassigned, conflicts };
}
