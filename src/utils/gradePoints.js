/**
 * Map transcript letter grades to a 4.0 scale for estimated term / cumulative GPA.
 * Pass/fail and non-GPA marks return null (excluded from the average).
 */

const TABLE = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  "D-": 0.7,
  F: 0.0,
};

/**
 * @param {string} [grade]
 * @returns {number|null}
 */
export function letterGradeToPoints(grade) {
  if (!grade || typeof grade !== "string") return null;
  const g = grade.trim().toUpperCase();
  if (g === "P" || g === "NP" || g === "W" || g === "I" || g === "GR" || g === "AUD") {
    return null;
  }
  return TABLE[g] ?? null;
}

/**
 * @param {Array<{ grade?: string }>} courses
 * @param {(c: { grade?: string }) => number} getCu  Credit units counting toward GPA
 * @returns {number|null}
 */
export function gpaFromCourses(courses, getCu) {
  let pts = 0;
  let honor = 0;
  for (const c of courses) {
    const p = letterGradeToPoints(c.grade);
    const cu = getCu(c);
    if (p == null || !(cu > 0)) continue;
    pts += p * cu;
    honor += cu;
  }
  return honor > 0 ? pts / honor : null;
}
