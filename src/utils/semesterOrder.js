/**
 * semesterOrder.js — sort labels like "Fall 2023" / "Spring 2024" for timelines.
 */

export function semesterSortKey(label) {
  if (!label || label === "Manually added") return Number.POSITIVE_INFINITY;
  const m = label.match(/^(Fall|Spring|Summer)\s+(\d{4})$/);
  if (!m) return Number.POSITIVE_INFINITY;
  const term = { Spring: 0, Summer: 1, Fall: 2 }[m[1]] ?? 9;
  return parseInt(m[2], 10) * 10 + term;
}

export function compareSemesterLabels(a, b) {
  return semesterSortKey(a) - semesterSortKey(b);
}

/** Map term label to linear index for rough "semesters until graduation". */
export function termToIndex(label) {
  const m = label?.match(/^(Spring|Summer|Fall)\s+(\d{4})$/);
  if (!m) return null;
  const t = { Spring: 0, Summer: 1, Fall: 2 }[m[1]];
  if (t === undefined) return null;
  return parseInt(m[2], 10) * 3 + t;
}

/** Approximate current academic term from calendar date. */
export function estimatedCurrentTermIndex() {
  const d = new Date();
  const y = d.getFullYear();
  const mo = d.getMonth();
  if (mo >= 7) return y * 3 + 2;
  if (mo <= 4) return y * 3 + 0;
  return y * 3 + 1;
}
