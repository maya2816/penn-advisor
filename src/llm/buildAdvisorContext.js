/**
 * buildAdvisorContext.js — compact JSON snapshot of student + audit for the advisor LLM.
 */

import { compareSemesterLabels } from "../utils/semesterOrder.js";
import { findHiddenOpportunities } from "../utils/nearMissAnalyzer.js";

const LIMITATIONS =
  "Course offerings by semester (Fall/Spring) are not in this data—multi-semester plans are tentative and not registration advice.";

const MAX_STUDENT_COURSE_SUMMARY = 20;

/**
 * Collect requirement leaves that are unmet or partial (depth-first on status tree).
 * @param {import('../utils/degreeEngine.js').RequirementStatus} node
 * @param {Array<{id:string,label:string,requiredCu:number,completedCu:number,status:string,satisfiedBy:string[]}>} out
 */
function collectUnmetLeaves(node, out) {
  if (node.children?.length) {
    for (const c of node.children) collectUnmetLeaves(c, out);
    return;
  }
  if (node.status === "unmet" || node.status === "partial") {
    out.push({
      id: node.id,
      label: node.label,
      requiredCu: node.requiredCu,
      completedCu: node.completedCu,
      status: node.status,
      satisfiedBy: node.satisfiedBy || [],
    });
  }
}

/**
 * @param {object} params
 * @param {import('../utils/degreeEngine.js').CompletionStatus | null} params.completion
 * @param {Array<{id:string,semester?:string|null,cu?:number,grade?:string|null,inProgress?:boolean}>} params.completedCourses
 * @param {Record<string, unknown> | null} [params.profile]
 * @param {Record<string, Array<{id:string}>>} [params.planByTerm]
 */
export function buildAdvisorContext({ completion, completedCourses, profile, planByTerm }) {
  const leaves = [];
  if (completion?.root) collectUnmetLeaves(completion.root, leaves);

  const bySem = [...completedCourses].sort((a, b) =>
    compareSemesterLabels(a.semester || "", b.semester || "")
  );
  const tail = bySem.slice(-MAX_STUDENT_COURSE_SUMMARY);
  const studentCourseSummary = tail.map((c) => ({
    id: c.id,
    semester: c.semester ?? null,
    cu: c.cu,
    grade: c.grade ?? null,
    inProgress: Boolean(c.inProgress),
  }));

  const plannedTerms = {};
  if (planByTerm && typeof planByTerm === "object") {
    for (const [term, courses] of Object.entries(planByTerm)) {
      if (Array.isArray(courses)) {
        plannedTerms[term] = { count: courses.length, ids: courses.map((x) => x.id).filter(Boolean) };
      }
    }
  }

  const completedIds = completedCourses.map((c) => c.id);

  return {
    limitations: LIMITATIONS,
    programId: completion?.programId ?? null,
    programName: completion?.programName ?? null,
    totals: completion
      ? { requiredCu: completion.totalCuRequired, completedCu: completion.totalCuCompleted }
      : null,
    leaves,
    warnings: completion?.warnings ?? [],
    prereqViolations: completion?.prereqViolations ?? [],
    mutexConflicts: completion?.mutexConflicts ?? [],
    conflicts: completion?.conflicts ?? [],
    unassignedCourses: completion?.unassignedCourses ?? [],
    completedCourseIds: completedIds,
    studentCourseSummary,
    plannedTerms,
    profile: profile
      ? {
          name: profile.name ?? null,
          gpa: profile.gpa ?? null,
          goalsFreeText: profile.goalsFreeText ?? null,
          careerInterests: profile.careerInterests ?? null,
          targetGraduationTerm: profile.targetGraduationTerm ?? null,
        }
      : null,
    // Pre-computed hint so the LLM knows it's worth calling the tool
    // without the student explicitly asking about minors.
    opportunitiesHint: (() => {
      try {
        const opps = findHiddenOpportunities({ completedCourses });
        const count = opps.nearMissMinors.length;
        const qualified = opps.nearMissMinors.filter((m) => m.cuShortBy === 0);
        const nearMiss = opps.nearMissMinors.filter((m) => m.cuShortBy > 0 && m.cuShortBy <= 2);
        const parts = [];
        if (qualified.length > 0) parts.push(`${qualified.length} minor(s) ALREADY QUALIFIED FOR`);
        if (nearMiss.length > 0) parts.push(`${nearMiss.length} minor(s) within 1-2 courses`);
        return count > 0
          ? `${count} near-miss minors detected (${parts.join(", ")}). Call find_hidden_opportunities for details.`
          : "No near-miss minors detected.";
      } catch {
        return null;
      }
    })(),
  };
}
