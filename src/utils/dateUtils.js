/**
 * dateUtils.js
 *
 * Role: Parse Penn transcript issue dates and detect stale transcripts.
 *
 * Input: strings like "26-MAR-2026" from Path Penn PDFs.
 * Output: Date | null; boolean for staleness vs. a month threshold.
 */

const MONTHS = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

/**
 * @param {string | null | undefined} s
 * @returns {Date | null}
 */
export function parsePennTranscriptDate(s) {
  if (!s || typeof s !== "string") return null;
  const t = s.trim();
  const m = t.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const mon = MONTHS[m[2].toUpperCase()];
    if (mon == null) return null;
    return new Date(parseInt(m[3], 10), mon, parseInt(m[1], 10));
  }
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/**
 * @param {string | null | undefined} dateIssued
 * @param {number} staleAfterMonths
 */
export function isTranscriptStale(dateIssued, staleAfterMonths = 3) {
  const d = parsePennTranscriptDate(dateIssued);
  if (!d) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - staleAfterMonths);
  return d < cutoff;
}
