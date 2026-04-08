/**
 * Deterministic soft Tailwind chip classes per top-level requirement section (by child order).
 * Unassigned courses use UNASSIGNED_CHIP (amber/neutral).
 */

const PALETTE = [
  "border border-sky-200/90 bg-sky-100 text-sky-950",
  "border border-emerald-200/90 bg-emerald-100 text-emerald-950",
  "border border-violet-200/90 bg-violet-100 text-violet-950",
  "border border-amber-200/90 bg-amber-100 text-amber-950",
  "border border-rose-200/90 bg-rose-100 text-rose-950",
  "border border-cyan-200/90 bg-cyan-100 text-cyan-950",
  "border border-indigo-200/90 bg-indigo-100 text-indigo-950",
  "border border-teal-200/90 bg-teal-100 text-teal-950",
];

/** Chip classes for courses not tied to a requirement slot */
export const UNASSIGNED_CHIP =
  "border border-amber-200/90 bg-amber-50 text-amber-950";

/** Transcript course excluded from degree audit assignment */
export const EXTRA_CREDIT_CHIP =
  "border border-slate-300 bg-slate-100 text-slate-800";

/**
 * @param {Array<{ id?: string, label?: string }>|undefined|null} rootChildren completion.root.children
 * @returns {Record<string, string>} sectionId -> chip class string
 */
export function buildSectionStyleMap(rootChildren) {
  const map = {};
  if (!rootChildren?.length) return map;
  rootChildren.forEach((sec, i) => {
    const id = sec.id ?? sec.label;
    if (id) map[id] = PALETTE[i % PALETTE.length];
  });
  return map;
}

const FALLBACK_SECTION_CHIP = "border border-slate-200 bg-slate-100 text-slate-900";

/**
 * @param {string|undefined} sectionId
 * @param {Record<string, string>} styleMap
 */
export function getSectionChipClass(sectionId, styleMap) {
  if (!sectionId) return FALLBACK_SECTION_CHIP;
  return styleMap[sectionId] ?? FALLBACK_SECTION_CHIP;
}
