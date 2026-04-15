/**
 * timelineBuilder.js
 *
 * Combines the student's transcript-backed courses (`completedCourses`)
 * with their planned future terms (`planByTerm`) into a single
 * chronologically ordered timeline that the redesigned Semesters tab
 * renders top to bottom: completed → in-progress → planned.
 *
 * The "kind" of each term card determines the UI affordances:
 *
 *   - "completed":   all courses in this term have a real letter grade
 *                    (no inProgress flag). Card is visually locked;
 *                    only the audit-pin chip on each row is editable.
 *
 *   - "in-progress": every course in this term has inProgress=true (the
 *                    student is currently enrolled). Card is locked
 *                    against add/remove because the source of truth is
 *                    the next transcript upload. The audit-pin chip
 *                    remains editable so the student can pre-decide
 *                    where these courses will count.
 *
 *   - "planned":     the term lives in `planByTerm` and is NOT also a
 *                    completed term. Card is fully editable: add and
 *                    remove courses freely.
 *
 * Edge cases:
 *
 *   - A term may appear in BOTH completedByTerm and planByTerm if the
 *     student plans a course in a term they've already started. In that
 *     case the completed/in-progress entry wins (the term is rendered
 *     once with kind=completed-or-in-progress) and any extra ids in
 *     planByTerm[term] are dropped from the timeline build (the
 *     SemestersPanel layer can decide whether to surface a warning).
 *
 *   - A term in completedCourses where every course is inProgress AND
 *     no graded courses exist becomes kind="in-progress". A term mixing
 *     graded + in-progress is treated as "completed" (the in-progress
 *     courses likely belong to a different term but were grouped due
 *     to a transcript quirk).
 *
 *   - A term key of "Manually added" (used when the parser couldn't
 *     find a semester header) is preserved at the end of the
 *     completed list, regardless of date sort.
 *
 * Pure function. Returns a NEW array on each call.
 */

import { compareSemesterLabels } from "./semesterOrder.js";

const MANUAL_KEY = "Manually added";

/**
 * @typedef {Object} TimelineEntry
 * @property {"completed"|"in-progress"|"planned"} kind
 * @property {string} term
 * @property {object[]} courses  full course objects (for completed/in-progress)
 *                               OR plain id strings (for planned)
 */

/**
 * @param {{
 *   completedCourses: Array<{
 *     id: string,
 *     semester?: string|null,
 *     inProgress?: boolean,
 *     grade?: string|null,
 *     [key: string]: unknown
 *   }>,
 *   planByTerm: Record<string, string[]>
 * }} input
 * @returns {TimelineEntry[]}
 */
export function buildTimeline({ completedCourses, planByTerm }) {
  // Group transcript courses by their semester string. Anything without
  // a semester goes into the "Manually added" bucket.
  /** @type {Record<string, object[]>} */
  const byTerm = {};
  for (const c of completedCourses || []) {
    const key = c.semester || MANUAL_KEY;
    (byTerm[key] ||= []).push(c);
  }

  const transcriptKeys = Object.keys(byTerm);
  const plannedKeys = Object.keys(planByTerm || {});

  // Identify which transcript terms count as "in-progress": every course
  // in the term has inProgress=true (and there's at least one course).
  // A term with even one graded course is considered completed for
  // display purposes.
  const isInProgress = (key) => {
    const list = byTerm[key];
    if (!list || list.length === 0) return false;
    return list.every((c) => c.inProgress === true);
  };

  // Build the ordered transcript portion. We sort the real semesters
  // chronologically and append "Manually added" at the very end of the
  // transcript section if present.
  const transcriptDated = transcriptKeys
    .filter((k) => k !== MANUAL_KEY)
    .sort(compareSemesterLabels);
  const orderedTranscript = transcriptKeys.includes(MANUAL_KEY)
    ? [...transcriptDated, MANUAL_KEY]
    : transcriptDated;

  /** @type {TimelineEntry[]} */
  const out = [];
  for (const term of orderedTranscript) {
    out.push({
      kind: isInProgress(term) ? "in-progress" : "completed",
      term,
      courses: byTerm[term],
    });
  }

  // Append planned terms — only those NOT already represented by the
  // transcript (a transcript term wins if there's overlap).
  const transcriptTermSet = new Set(transcriptKeys);
  const futurePlanned = plannedKeys
    .filter((k) => !transcriptTermSet.has(k))
    .filter((k) => Array.isArray(planByTerm[k])) // ignore malformed entries
    .sort(compareSemesterLabels);

  for (const term of futurePlanned) {
    out.push({
      kind: "planned",
      term,
      courses: planByTerm[term].slice(),
    });
  }

  return out;
}
