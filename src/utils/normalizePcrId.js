/**
 * normalizePcrId.js
 *
 * The Penn Course Review API returns course IDs in DASH-DELIMITED form
 * (`CIS-120`, `LAWM-5060`, `AAMW-5360`). Penn Advisor's internal catalog
 * uses NO-SEPARATOR form (`CIS120`, `LAWM5060`, `AAMW5360`). Every place
 * that calls the PCR API must convert in both directions:
 *
 *   - OUTBOUND: building a request URL like
 *     `/api/base/current/courses/CIS-4190/` from our internal `CIS4190`
 *   - INBOUND: storing a PCR response's `id` field as a key in
 *     `courses.json` keyed by our internal format
 *
 * This module is the single source of truth for both conversions and
 * MUST be used at every API integration point. A bug here would silently
 * break course lookups across the entire app, so the function is small,
 * pure, and exhaustively edge-cased.
 *
 * Penn course code shape (per the catalog):
 *   - 2 to 5 uppercase letters for the department prefix (CIS, ESE,
 *     MATH, NETS, MEAM, AAMW, LAWM, NRSC, etc.)
 *   - 3 or 4 digits for the course number (1xxx, 2xxx, ..., 9xxx)
 *   - Optional 1-letter suffix for sub-sections (rare; e.g., CIS-120A)
 *
 * Both functions are idempotent: passing an already-normalized ID
 * returns it unchanged. Both return `null` for unparseable input
 * rather than throwing.
 */

// Match: 2-5 uppercase letters + 3-4 digits + optional 1-letter suffix.
// Allows an optional dash, space, or any whitespace between the letters
// and the digits — so the same regex parses CIS-120, CIS 120, and CIS120.
const COURSE_CODE_RE = /^([A-Z]{2,5})[\s-]?(\d{3,4})([A-Z]?)$/;

/**
 * Convert a PCR-style id (or any reasonable course-code shape) to
 * Penn Advisor's internal no-separator format.
 *
 * Examples:
 *   pcrIdToInternal("CIS-120")    → "CIS120"
 *   pcrIdToInternal("CIS-4190")   → "CIS4190"
 *   pcrIdToInternal("CIS120")     → "CIS120"   (idempotent)
 *   pcrIdToInternal("CIS 120")    → "CIS120"
 *   pcrIdToInternal("AAMW-5360")  → "AAMW5360"
 *   pcrIdToInternal("CIS-120A")   → "CIS120A"
 *   pcrIdToInternal("not-a-code") → null
 *
 * @param {string} input
 * @returns {string|null}
 */
export function pcrIdToInternal(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toUpperCase();
  const m = trimmed.match(COURSE_CODE_RE);
  if (!m) return null;
  const [, dept, num, suffix] = m;
  return `${dept}${num}${suffix}`;
}

/**
 * Convert Penn Advisor's internal id to PCR's dash-delimited format
 * for use in API URLs.
 *
 * Examples:
 *   internalIdToPcr("CIS120")    → "CIS-120"
 *   internalIdToPcr("CIS4190")   → "CIS-4190"
 *   internalIdToPcr("CIS-120")   → "CIS-120"  (idempotent)
 *   internalIdToPcr("CIS 120")   → "CIS-120"
 *   internalIdToPcr("AAMW5360")  → "AAMW-5360"
 *   internalIdToPcr("CIS120A")   → "CIS-120A"
 *   internalIdToPcr("garbage")   → null
 *
 * @param {string} input
 * @returns {string|null}
 */
export function internalIdToPcr(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toUpperCase();
  const m = trimmed.match(COURSE_CODE_RE);
  if (!m) return null;
  const [, dept, num, suffix] = m;
  return `${dept}-${num}${suffix}`;
}

/**
 * Cheap predicate: does this string look like a Penn course code in
 * either format? Useful for guarding tool inputs from the LLM advisor
 * before calling the PCR client.
 *
 * @param {string} input
 * @returns {boolean}
 */
export function isCourseCode(input) {
  return pcrIdToInternal(input) !== null;
}
