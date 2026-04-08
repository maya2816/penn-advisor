import programs from "../data/programs.json" with { type: "json" };

/** @param {object} node */
function isProgramLeaf(node) {
  return Boolean(node?.from) && !node.children;
}

/** @param {object} node @param {(n: object) => void} fn */
function walkProgram(node, fn) {
  fn(node);
  if (node.children) for (const c of node.children) walkProgram(c, fn);
}

/**
 * @param {object} programRequirement root requirement node
 * @returns {Map<string, object>}
 */
export function buildRawLeafById(programRequirement) {
  const map = new Map();
  walkProgram(programRequirement, (node) => {
    if (isProgramLeaf(node)) map.set(node.id, node);
  });
  return map;
}

/**
 * Attribute codes and tags that appear in the program tree (for manual overrides).
 * @param {object} programRequirement
 * @returns {{ attributes: string[], tags: string[] }}
 */
export function collectEditableRequirementFlags(programRequirement) {
  const attributes = new Set();
  const tags = new Set();
  walkProgram(programRequirement, (node) => {
    if (!isProgramLeaf(node)) return;
    const from = node.from;
    if (from?.attribute) attributes.add(from.attribute);
    if (from?.attributes) for (const a of from.attributes) attributes.add(a);
    for (const c of node.constraints || []) {
      if (c.type === "must_include_tag" && c.tag) tags.add(c.tag);
    }
  });
  return {
    attributes: [...attributes].sort(),
    tags: [...tags].sort(),
  };
}

/**
 * Completion status leaves (deepest nodes under each top section).
 * @param {{ root?: { children?: object[] } }} completion
 */
export function collectCompletionLeaves(completion) {
  if (!completion?.root?.children?.length) return [];
  const out = [];
  for (const sec of completion.root.children) {
    const walk = (n) => {
      if (n.children?.length) for (const c of n.children) walk(c);
      else out.push(n);
    };
    walk(sec);
  }
  return out;
}

/**
 * @param {{ root?: { children?: object[] } }} completion
 * @param {object} programRequirement
 */
export function getIncompleteGaps(completion, programRequirement) {
  const byId = buildRawLeafById(programRequirement);
  return collectCompletionLeaves(completion)
    .filter((l) => l.status !== "complete")
    .map((l) => ({
      id: l.id,
      label: l.label,
      missing: Math.max(0, l.requiredCu - l.completedCu),
      status: l.status,
      raw: byId.get(l.id) ?? null,
    }));
}

/**
 * Course IDs that satisfy this program leaf's `from` pool, or null = no restriction (e.g. `any`).
 * @param {object|null} rawLeaf
 * @param {object[]} catalogList Object.values(courses)
 */
export function courseIdsMatchingLeafPool(rawLeaf, catalogList) {
  if (!rawLeaf?.from) return null;
  const from = rawLeaf.from;
  if (from.any) return null;
  if (from.course_ids?.length) return new Set(from.course_ids);
  if (from.attribute) {
    const out = new Set();
    for (const c of catalogList) {
      if ((c.attributes || []).includes(from.attribute)) out.add(c.id);
    }
    return out;
  }
  if (from.attributes?.length) {
    const need = new Set(from.attributes);
    const out = new Set();
    for (const c of catalogList) {
      const attrs = c.attributes || [];
      if (attrs.some((a) => need.has(a))) out.add(c.id);
    }
    return out;
  }
  return null;
}

/**
 * @param {string} programId
 * @returns {object|null} program.requirement root
 */
export function getProgramRequirement(programId) {
  const p = programs[programId];
  return p?.requirement ?? null;
}
