/**
 * graduationTerms.js
 *
 * Role: Build Spring/Fall graduation term labels for setup dropdowns.
 * Export: GRAD_TERM_OPTIONS (string[]).
 */

function buildGradTerms() {
  const y = new Date().getFullYear();
  const terms = [];
  for (let i = 0; i < 8; i++) {
    const yy = y + Math.floor(i / 2);
    const term = i % 2 === 0 ? "Spring" : "Fall";
    terms.push(`${term} ${yy}`);
  }
  return terms;
}

export const GRAD_TERM_OPTIONS = buildGradTerms();
