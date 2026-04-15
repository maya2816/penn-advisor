/**
 * planGenerator.js
 *
 * The auto-plan generator for the redesigned Semesters tab. Pure
 * function; no React, no context.
 *
 * Goal: turn "9 unmet leaves with 16 CU left" into a sensible
 * `planByTerm` map that the student can edit, instead of leaving them
 * staring at a blank Plan view.
 *
 * Algorithm in five steps:
 *
 *   1. GAP LIST. Use the existing `getIncompleteGaps()` from
 *      programRequirementIndex.js to find every leaf that isn't full.
 *      Each gap carries its raw program node (the `.from` pool) and
 *      the missing CU count.
 *
 *   2. PICK COURSES PER GAP. For each gap, walk its `from` pool to
 *      pick enough courses to cover the missing CU. Default 1 CU per
 *      course (the AI BSE catalog uses mostly integer CUs, and we
 *      don't optimize for fractional packing).
 *
 *      For `course_ids` pools we walk in declaration order (Penn lists
 *      the canonical first option first, e.g. `CIS4210` before
 *      `CIS5210`). For attribute pools we sort by (prereq count
 *      ascending, course-number ascending) so we prefer intro-level
 *      classes with no chain.
 *
 *      We track a `taken` set across all gaps to avoid double-picking
 *      a single course for two slots, and a `mutexBlocked` set so we
 *      never pick a course that conflicts with a completed course or
 *      another picked course.
 *
 *   3. TOPO-SORT BY PREREQ DEPTH. Each picked course is given a depth
 *      = longest path from itself back to a leaf with no prereqs.
 *      Courses are then sorted ascending so prerequisites come first
 *      in the timeline.
 *
 *   4. BUILD FUTURE TERM SEQUENCE. Generate Spring/Fall labels from
 *      the term immediately AFTER the student's latest completed or
 *      in-progress term, up to the targetTerm (inclusive). If no
 *      target is set, generate 8 future terms. (We skip Summer in the
 *      default sequence — most Penn students don't take Summer.)
 *
 *   5. DISTRIBUTE COURSES. Walk the topo-sorted list. For each course,
 *      assign it to the earliest term where:
 *        - all of its prereqs are in completedSet OR planned earlier
 *        - the term doesn't already have ≥4 CU planned (soft cap)
 *      If no term qualifies, drop into the last term (overflow) and
 *      record a warning.
 *
 * Pure module: returns `{ planByTerm, warnings }` and never mutates
 * its inputs.
 */

import courses from "../data/courses.json" with { type: "json" };
import {
  getIncompleteGaps,
  getProgramRequirement,
  courseIdsMatchingLeafPool,
} from "./programRequirementIndex.js";
import { compareSemesterLabels } from "./semesterOrder.js";

const SOFT_CU_PER_TERM = 4;
const DEFAULT_FUTURE_TERMS = 8;

const catalogList = Object.values(courses);

// ---------- term sequence helpers ----------

/** Spring → Fall → Spring → Fall (skipping Summer). */
function nextTermAfter(label) {
  const m = label?.match(/^(Spring|Summer|Fall)\s+(\d{4})$/);
  if (!m) return null;
  const term = m[1];
  const year = parseInt(m[2], 10);
  if (term === "Spring") return `Fall ${year}`;
  // Treat Summer or Fall as feeding into the next Spring.
  if (term === "Summer") return `Fall ${year}`;
  return `Spring ${year + 1}`;
}

function buildFutureTermSequence(startTerm, targetTerm, max) {
  const out = [];
  let cur = startTerm;
  while (cur && out.length < max) {
    out.push(cur);
    if (targetTerm && cur === targetTerm) break;
    cur = nextTermAfter(cur);
  }
  return out;
}

/** Latest completed-or-in-progress term in the student's transcript. */
function latestTranscriptTerm(completedCourses) {
  const seen = new Set();
  for (const c of completedCourses || []) {
    if (c.semester) seen.add(c.semester);
  }
  const sorted = [...seen].sort(compareSemesterLabels);
  return sorted[sorted.length - 1] || null;
}

// ---------- prereq depth (topo helper) ----------

/**
 * Longest dependency chain from this course back to a course with no
 * prereqs. Returns 0 for leaves. Cycles return their detected depth
 * to avoid infinite loops; the catalog shouldn't have cycles.
 */
function prereqDepth(courseId, memo = new Map(), stack = new Set()) {
  if (memo.has(courseId)) return memo.get(courseId);
  if (stack.has(courseId)) return 0; // cycle guard
  const cat = courses[courseId];
  const prereqs = (cat?.prerequisites || []).filter((p) => courses[p]);
  if (prereqs.length === 0) {
    memo.set(courseId, 0);
    return 0;
  }
  stack.add(courseId);
  let max = 0;
  for (const p of prereqs) {
    const d = prereqDepth(p, memo, stack) + 1;
    if (d > max) max = d;
  }
  stack.delete(courseId);
  memo.set(courseId, max);
  return max;
}

// ---------- gap → course picker ----------

/** Picks ordered candidate course ids for a gap, given the eligible pool. */
function rankCandidates(eligibleIds) {
  const arr = [...eligibleIds];
  arr.sort((a, b) => {
    const pa = (courses[a]?.prerequisites || []).filter((p) => courses[p]).length;
    const pb = (courses[b]?.prerequisites || []).filter((p) => courses[p]).length;
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });
  return arr;
}

/** Returns the eligible-id Set for a gap's `from` pool. */
function eligibleIdsForGap(rawLeaf) {
  const from = rawLeaf?.from;
  if (!from) return new Set();
  if (from.any) return new Set(catalogList.map((c) => c.id));
  if (from.course_ids?.length) return new Set(from.course_ids);
  const matched = courseIdsMatchingLeafPool(rawLeaf, catalogList);
  return matched instanceof Set ? matched : new Set();
}

/** Mutex blocker check: would adding `candidateId` collide with any id in `blockSet`? */
function isMutexBlocked(candidateId, blockSet) {
  const cat = courses[candidateId];
  const mutex = cat?.mutuallyExclusive || [];
  for (const m of mutex) {
    if (blockSet.has(m)) return true;
  }
  // Also check the reverse direction (B says it's mutex with A even if A doesn't say so).
  for (const id of blockSet) {
    const other = courses[id]?.mutuallyExclusive || [];
    if (other.includes(candidateId)) return true;
  }
  return false;
}

/**
 * For one gap, return up to `need` course ids picked from the pool,
 * avoiding the `taken` set, the `completedSet`, and any mutex blocks.
 */
function pickCoursesForGap({ gap, taken, completedSet, mutexBlocked }) {
  const eligible = eligibleIdsForGap(gap.raw);
  const ranked = rankCandidates(eligible);
  const picked = [];
  let needCu = gap.missing;
  for (const id of ranked) {
    if (needCu <= 0) break;
    if (taken.has(id)) continue;
    if (completedSet.has(id)) continue;
    if (isMutexBlocked(id, taken)) continue;
    if (isMutexBlocked(id, completedSet)) continue;
    if (mutexBlocked.has(id)) continue;
    picked.push(id);
    taken.add(id);
    needCu -= courses[id]?.cu ?? 1;
  }
  return picked;
}

// ---------- prereq-aware distribution ----------

function planFitsInTerm(courseId, termCuSoFar) {
  const cu = courses[courseId]?.cu ?? 1;
  return termCuSoFar + cu <= SOFT_CU_PER_TERM;
}

function prereqsSatisfiedBy(courseId, completedSet, plannedSoFar) {
  const prereqs = (courses[courseId]?.prerequisites || []).filter((p) => courses[p]);
  for (const p of prereqs) {
    if (completedSet.has(p)) continue;
    if (plannedSoFar.has(p)) continue;
    return false;
  }
  return true;
}

// ---------- main entry point ----------

/**
 * @typedef {Object} PlanGeneratorInput
 * @property {object} completion           computeCompletion() result
 * @property {Array<{id: string, semester?: string|null, inProgress?: boolean}>} completedCourses
 * @property {string} programId
 * @property {string|null} [targetTerm]    e.g. "Spring 2027"
 * @property {string|null} [startTerm]     overrides the auto-detected next term
 */

/**
 * @typedef {Object} PlanGeneratorResult
 * @property {Record<string, string[]>} planByTerm
 * @property {string[]} warnings
 */

/**
 * @param {PlanGeneratorInput} input
 * @returns {PlanGeneratorResult}
 */
export function generatePlan({
  completion,
  completedCourses,
  programId,
  targetTerm = null,
  startTerm = null,
}) {
  const warnings = [];
  const planByTerm = {};

  if (!completion || !programId) {
    return { planByTerm, warnings: ["No completion or programId provided."] };
  }

  const programReq = getProgramRequirement(programId);
  if (!programReq) {
    return { planByTerm, warnings: [`Unknown program: ${programId}`] };
  }

  const gaps = getIncompleteGaps(completion, programReq);
  if (gaps.length === 0) {
    return { planByTerm, warnings: [] }; // already complete
  }

  // 1. Build the completed-id set (treating in-progress as if completed).
  const completedSet = new Set((completedCourses || []).map((c) => c.id));

  // 2. Pick candidate courses per gap, avoiding double-picks and mutex.
  const taken = new Set();
  const mutexBlocked = new Set(); // reserved for future use
  const allPicked = [];
  for (const gap of gaps) {
    const picked = pickCoursesForGap({
      gap,
      taken,
      completedSet,
      mutexBlocked,
    });
    if (picked.length === 0 && gap.missing > 0) {
      warnings.push(
        `${gap.label}: couldn't find ${gap.missing} CU of eligible courses.`
      );
    }
    allPicked.push(...picked);
  }

  if (allPicked.length === 0) {
    return { planByTerm, warnings };
  }

  // 3. Topo-sort by prereq depth (intro courses first).
  const depthMemo = new Map();
  const sortedPicks = [...allPicked].sort(
    (a, b) => prereqDepth(a, depthMemo) - prereqDepth(b, depthMemo)
  );

  // 4. Build the future term sequence.
  const lastTerm = latestTranscriptTerm(completedCourses);
  const firstFuture = startTerm || (lastTerm ? nextTermAfter(lastTerm) : "Fall 2026");
  const sequence = buildFutureTermSequence(firstFuture, targetTerm, DEFAULT_FUTURE_TERMS);

  if (sequence.length === 0) {
    return {
      planByTerm,
      warnings: [...warnings, "No future terms available — adjust the target graduation."],
    };
  }

  for (const t of sequence) planByTerm[t] = [];

  // 5. Distribute. Walk sorted picks; for each, find the earliest term
  //    where prereqs are satisfied and the soft CU cap isn't exceeded.
  const plannedCumulative = new Set(); // ids planned in any earlier term so far
  const plannedByTerm = {};             // term → Set of ids planned this run
  for (const t of sequence) plannedByTerm[t] = new Set();
  const cuByTerm = Object.fromEntries(sequence.map((t) => [t, 0]));

  for (const courseId of sortedPicks) {
    let placed = false;
    for (const term of sequence) {
      // Snapshot of "what's planned in EARLIER terms" for the prereq check.
      const earlierIdx = sequence.indexOf(term);
      const earlierIds = new Set();
      for (let i = 0; i < earlierIdx; i++) {
        for (const id of plannedByTerm[sequence[i]]) earlierIds.add(id);
      }
      if (!prereqsSatisfiedBy(courseId, completedSet, earlierIds)) continue;
      if (!planFitsInTerm(courseId, cuByTerm[term])) continue;
      planByTerm[term].push(courseId);
      plannedByTerm[term].add(courseId);
      plannedCumulative.add(courseId);
      cuByTerm[term] += courses[courseId]?.cu ?? 1;
      placed = true;
      break;
    }
    if (!placed) {
      // Overflow into the last term and warn.
      const last = sequence[sequence.length - 1];
      planByTerm[last].push(courseId);
      plannedByTerm[last].add(courseId);
      plannedCumulative.add(courseId);
      cuByTerm[last] += courses[courseId]?.cu ?? 1;
      warnings.push(
        `${courseId}: couldn't fit within the ${SOFT_CU_PER_TERM} CU/term soft target — overflowed into ${last}.`
      );
    }
  }

  // Strip empty terms from the result so the UI doesn't render blank
  // cards for terms the auto-planner didn't use.
  const filtered = {};
  for (const [term, ids] of Object.entries(planByTerm)) {
    if (ids.length > 0) filtered[term] = ids;
  }

  return { planByTerm: filtered, warnings };
}
