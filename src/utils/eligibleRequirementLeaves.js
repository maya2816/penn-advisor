/**
 * Requirement leaves a completed course can legally satisfy (same pool rules as degreeEngine).
 * Returns stable leaf ids + human displayLabel for pickers.
 */

import programs from "../data/programs.json" with { type: "json" };
import courses from "../data/courses.json" with { type: "json" };
import { courseMatchesPool } from "./degreeEngine.js";

const isLeaf = (node) => Boolean(node?.from) && !node?.children;

/** @param {object} sc raw completed course from student record */
export function mergeCourseForEligibility(sc) {
  const cat = courses[sc.id] || null;
  const transcriptCu = Number(sc.cu);
  const cu =
    Number.isFinite(transcriptCu) && transcriptCu > 0 ? transcriptCu : (cat?.cu ?? 1);
  return {
    id: sc.id,
    cu,
    level: cat?.level ?? 0,
    title: cat?.title ?? sc.id,
    section: sc.section,
    tags: [...new Set([...(cat?.tags || []), ...(sc.tags || [])])],
    attributes: [...new Set([...(cat?.attributes || []), ...(sc.attributes || [])])],
  };
}

/** @param {object} from requirement from pool */
function bracketHint(from) {
  if (!from) return null;
  if (from.attribute) return `(${from.attribute})`;
  if (from.attributes?.length) return `(${from.attributes.join(" or ")})`;
  return null;
}

function buildDisplayLabel(sectionLabel, leafLabel, hint) {
  if (sectionLabel === leafLabel) {
    return hint ? `${leafLabel} ${hint}` : leafLabel;
  }
  const base = `${sectionLabel} — ${leafLabel}`;
  return hint ? `${base} ${hint}` : base;
}

function walkCollect(node, sectionId, sectionLabel, acc) {
  if (isLeaf(node)) {
    acc.push({ node, sectionId, sectionLabel });
    return;
  }
  for (const c of node.children || []) {
    walkCollect(c, sectionId, sectionLabel, acc);
  }
}

function collectProgramLeaves(requirementRoot) {
  const acc = [];
  for (const sec of requirementRoot.children || []) {
    const sid = sec.id ?? sec.label;
    const slabel = sec.label ?? sec.id;
    walkCollect(sec, sid, slabel, acc);
  }
  return acc;
}

function leafEligible(mergedCourse, node) {
  if (node.exclusive && node.from?.course_ids) {
    return node.from.course_ids.includes(mergedCourse.id);
  }
  return courseMatchesPool(mergedCourse, node.from);
}

/**
 * @param {object} completedCourse entry from completedCourses
 * @param {string} programId
 * @returns {Array<{ leafId: string, leafLabel: string, sectionId: string, sectionLabel: string, bracketHint: string|null, displayLabel: string }>}
 */
export function getEligibleRequirementLeaves(completedCourse, programId) {
  const program = programs[programId];
  if (!program?.requirement) return [];
  const merged = mergeCourseForEligibility(completedCourse);
  const out = [];
  for (const { node, sectionId, sectionLabel } of collectProgramLeaves(program.requirement)) {
    if (!leafEligible(merged, node)) continue;
    const hint = bracketHint(node.from);
    const leafLabel = node.label || node.id;
    out.push({
      leafId: node.id,
      leafLabel,
      sectionId,
      sectionLabel,
      bracketHint: hint,
      displayLabel: buildDisplayLabel(sectionLabel, leafLabel, hint),
    });
  }
  return out;
}
