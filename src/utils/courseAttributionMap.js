/**
 * Map each course id to the requirement section + leaf label the engine assigned it to,
 * by walking completion.root.children and nested satisfiedBy (same rules as the old CourseAttribution).
 *
 * @param {{ root?: { children?: unknown[] } } | null | undefined} completion
 * @returns {Record<string, { section: string, leaf: string }>}
 */
export function buildAttributionMap(completion) {
  const map = {};
  if (!completion?.root?.children?.length) return map;

  const visit = (node, sectionLabel) => {
    if (node.satisfiedBy?.length) {
      for (const id of node.satisfiedBy) {
        map[id] = { section: sectionLabel, leaf: node.label };
      }
    }
    if (node.children) {
      for (const c of node.children) visit(c, sectionLabel);
    }
  };

  for (const sec of completion.root.children) {
    visit(sec, sec.label);
  }
  return map;
}
