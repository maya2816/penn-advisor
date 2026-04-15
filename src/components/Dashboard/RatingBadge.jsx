/**
 * RatingBadge — small presentational chip showing a PCR rating value
 * with a color indicator. Used on course tiles (Semesters tab) and in
 * term header means.
 *
 * Color scale (0-4, matches PCR's rating range):
 *   0.0 – 1.5  green  (easy / light)
 *   1.5 – 2.5  amber  (moderate)
 *   2.5 – 4.0  rose   (hard / heavy)
 *
 * Renders nothing if `value` is null/undefined (course has no rating
 * data from PCR). This is intentional — no badge is better than a
 * misleading "0.0" badge on courses PCR hasn't reviewed.
 */
export function RatingBadge({ value, label }) {
  if (value == null) return null;

  const tone =
    value <= 1.5
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : value <= 2.5
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-rose-50 text-rose-800 border-rose-200";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold leading-tight ${tone}`}
      title={`${label}: ${value.toFixed(2)} / 4.0 (from Penn Course Review)`}
    >
      {label && <span className="opacity-70">{label}</span>}
      <span className="num">{value.toFixed(1)}</span>
    </span>
  );
}

/**
 * Computes the mean of a rating field across a list of course objects,
 * skipping courses without that field. Returns null if no courses have
 * the field (so the caller can skip rendering entirely).
 *
 * @param {Array<{id: string}>} courseList  course objects or ids
 * @param {Record<string, object>} catalog  courses.json keyed by id
 * @param {string} field  "difficulty" | "workRequired" | "courseQuality" | "instructorQuality"
 * @returns {number|null}
 */
export function computeTermMean(courseList, catalog, field) {
  let sum = 0;
  let count = 0;
  for (const c of courseList) {
    const id = typeof c === "string" ? c : c.id;
    const val = catalog[id]?.[field];
    if (typeof val === "number" && isFinite(val)) {
      sum += val;
      count += 1;
    }
  }
  return count > 0 ? sum / count : null;
}
