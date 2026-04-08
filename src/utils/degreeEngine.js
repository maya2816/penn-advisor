/**
 * degreeEngine.js
 *
 * Pure function: takes a student's completed courses + a program ID,
 * returns a structured completion report.
 *
 * Pipeline:
 *   1. Load the program's requirement tree and the courses dictionary.
 *   2. Flatten the tree to a list of LEAF requirements (the ones that
 *      actually consume courses; parent sections are pure rollups).
 *   3. Build "slots" for the assignment solver:
 *        - Exclusive leaves with explicit course_ids pools become solver
 *          slots (they're the ones with the double-counting problem).
 *        - Non-exclusive leaves (attribute pools, "any", or single-course
 *          required slots) are filled greedily by the engine itself.
 *   4. Walk the tree bottom-up to compute completedCu and status.
 *   5. Apply soft constraints (max_cu_at_level, must_include_tag, etc.)
 *      as warnings, not hard fails.
 */

import programs from "../data/programs.json" with { type: "json" };
import courses from "../data/courses.json" with { type: "json" };
import { solve } from "./assignmentSolver.js";

/**
 * @typedef {Object} StudentCourse
 * @property {string}   id            "CIS4300"
 * @property {string}   [section]     Course section title (for LAWM 5060 etc.)
 * @property {string[]} [tags]        Free-form tags, e.g. ["writing_seminar"]
 * @property {string[]} [attributes]  Catalog attributes, e.g. ["EUNS","EUSS"]
 * @property {string}   [pinnedSlot]  User override: force-assign to this requirement id
 */

/**
 * @typedef {Object} RequirementStatus
 * @property {string}   id
 * @property {string}   label
 * @property {number}   requiredCu
 * @property {number}   completedCu
 * @property {'complete'|'partial'|'unmet'} status
 * @property {string[]} satisfiedBy        Course IDs assigned to this leaf
 * @property {RequirementStatus[]} [children]
 */

/**
 * @typedef {Object} CompletionStatus
 * @property {string}             programId
 * @property {string}             programName
 * @property {number}             totalCuRequired
 * @property {number}             totalCuCompleted
 * @property {RequirementStatus}  root
 * @property {string[]}           unassignedCourses
 * @property {Array<{slotId:string,candidates:string[]}>} conflicts
 * @property {string[]}           warnings
 * @property {Array<{courseId:string,missing:string[]}>}  prereqViolations
 *   Each entry: a course the student claims credit for whose prerequisites
 *   include `missing` IDs the student has NOT also taken. The IDs may be
 *   real Penn courses or stale catalog references — downstream consumers
 *   decide how to render the difference.
 * @property {Array<{courseA:string,courseB:string}>}     mutexConflicts
 *   Each entry: a pair of student-completed courses that are listed as
 *   mutually exclusive of each other in the catalog (typically a cross-
 *   listed undergrad/grad pair). Surfaced as a warning, not a hard fail.
 */

// ---------- helpers ----------

const getCourse = (id) => courses[id] || null;

/** A leaf is a requirement node with a `from` field and no children. */
const isLeaf = (node) => Boolean(node.from) && !node.children;

/** Recursively walk the tree and call fn(node, parent) on every node. */
function walk(node, fn, parent = null) {
  fn(node, parent);
  if (node.children) for (const c of node.children) walk(c, fn, node);
}

/** Does a course satisfy a `from` pool? */
function courseMatchesPool(course, pool) {
  if (!course) return false;
  if (pool.any) return true;
  if (pool.course_ids) return pool.course_ids.includes(course.id);
  if (pool.attribute) return (course.attributes || []).includes(pool.attribute);
  if (pool.attributes) {
    const set = new Set(course.attributes || []);
    return pool.attributes.some((a) => set.has(a));
  }
  return false;
}

// ---------- main ----------

/**
 * Compute degree-completion status.
 *
 * @param {StudentCourse[]} completedCourses
 * @param {string}          programId
 * @returns {CompletionStatus}
 */
export function computeCompletion(completedCourses, programId) {
  const program = programs[programId];
  if (!program) {
    throw new Error(`Unknown program: ${programId}`);
  }

  // Normalize student courses: merge attributes from the catalog so that
  // attribute-based pools (EUNS, EUSS, ...) work even if the student input
  // didn't repeat them.
  const studentCourses = completedCourses.map((sc) => {
    const cat = getCourse(sc.id);
    return {
      id: sc.id,
      cu: cat?.cu ?? 1,
      level: cat?.level ?? 0,
      title: cat?.title ?? sc.id,
      section: sc.section,
      tags: [...new Set([...(cat?.tags || []), ...(sc.tags || [])])],
      attributes: [...new Set([...(cat?.attributes || []), ...(sc.attributes || [])])],
      pinnedSlot: sc.pinnedSlot,
    };
  });

  const studentById = Object.fromEntries(studentCourses.map((c) => [c.id, c]));

  // 1. Collect leaves and split into "exclusive solver slots" vs. "engine-filled".
  /** @type {Array<{node:any, parents:any[]}>} */
  const leaves = [];
  walk(program.requirement, (node, parent) => {
    if (isLeaf(node)) leaves.push({ node, parent });
  });

  const solverSlots = [];
  const engineLeaves = [];
  for (const leaf of leaves) {
    const { node } = leaf;
    if (node.exclusive && node.from.course_ids) {
      solverSlots.push({
        id: node.id,
        capacity: node.min_cu,
        pool: new Set(node.from.course_ids),
        exclusive: true,
      });
    } else {
      engineLeaves.push(leaf);
    }
  }

  // 2. Run the solver on the exclusive leaves.
  const eligibleForSolver = studentCourses.filter((sc) =>
    solverSlots.some((s) => s.pool.has(sc.id))
  );
  const { assignments, conflicts } = solve({
    courses: eligibleForSolver,
    slots: solverSlots,
  });

  // 3. Bucket courses by leaf id.
  /** @type {Object<string,string[]>} */
  const courseIdsByLeaf = {};
  for (const [courseId, slotId] of Object.entries(assignments)) {
    (courseIdsByLeaf[slotId] ||= []).push(courseId);
  }

  // Track which courses have already been consumed by an exclusive slot;
  // they cannot also count toward non-exclusive leaves.
  const consumed = new Set(Object.keys(assignments));

  // 4. Greedy fill for non-exclusive leaves (in tree order).
  //    These are: required-course leaves (single course_id), choose-one
  //    pools that are NOT exclusive, attribute-based pools, and "any".
  const warnings = [];
  for (const { node } of engineLeaves) {
    courseIdsByLeaf[node.id] ||= [];
    let need = node.min_cu;

    for (const sc of studentCourses) {
      if (need <= 0) break;
      if (consumed.has(sc.id)) continue;
      if (!courseMatchesPool(sc, node.from)) continue;

      // Constraint: section_title_required (LAWM 5060 -> AI Ethics)
      const sectionConstraint = (node.constraints || []).find(
        (c) => c.type === "section_title_required" && c.course_id === sc.id
      );
      if (sectionConstraint && sc.section !== sectionConstraint.value) {
        warnings.push(
          `${sc.id} only counts toward ${node.label} if its section is "${sectionConstraint.value}".`
        );
        continue;
      }

      courseIdsByLeaf[node.id].push(sc.id);
      consumed.add(sc.id);
      need -= sc.cu;
    }

    // Constraint: must_include_tag (Writing Seminar inside SS/H 3-CU)
    const tagConstraint = (node.constraints || []).find(
      (c) => c.type === "must_include_tag"
    );
    if (tagConstraint) {
      const inSlot = courseIdsByLeaf[node.id].map((id) => studentById[id]);
      const hasTag = inSlot.some((sc) => (sc?.tags || []).includes(tagConstraint.tag));
      if (inSlot.length > 0 && !hasTag) {
        warnings.push(
          `${node.label}: must include a course tagged "${tagConstraint.tag}".`
        );
      }
    }

    // Constraint: max_cu_at_level (Tech Electives: at most 1 CU at 1000-level)
    const levelConstraint = (node.constraints || []).find(
      (c) => c.type === "max_cu_at_level"
    );
    if (levelConstraint) {
      const inSlot = courseIdsByLeaf[node.id].map((id) => studentById[id]);
      const cuAtLevel = inSlot
        .filter((sc) => sc?.level === levelConstraint.level)
        .reduce((s, sc) => s + (sc?.cu || 0), 0);
      if (cuAtLevel > levelConstraint.cu) {
        warnings.push(
          `${node.label}: at most ${levelConstraint.cu} CU may be at the ${levelConstraint.level}-level (currently ${cuAtLevel}).`
        );
      }
    }
  }

  // 5. Walk the tree bottom-up to build the RequirementStatus tree.
  function buildStatus(node) {
    if (isLeaf(node)) {
      const satisfiedBy = courseIdsByLeaf[node.id] || [];
      const completedCu = satisfiedBy.reduce(
        (s, id) => s + (studentById[id]?.cu ?? 1),
        0
      );
      return {
        id: node.id,
        label: node.label || node.id,
        requiredCu: node.min_cu,
        completedCu,
        status:
          completedCu >= node.min_cu
            ? "complete"
            : completedCu > 0
            ? "partial"
            : "unmet",
        satisfiedBy,
      };
    }

    const children = (node.children || []).map(buildStatus);
    const completedCu = children.reduce(
      (s, c) => s + Math.min(c.completedCu, c.requiredCu),
      0
    );
    return {
      id: node.id,
      label: node.label || node.id,
      requiredCu: node.min_cu,
      completedCu,
      status:
        completedCu >= node.min_cu
          ? "complete"
          : completedCu > 0
          ? "partial"
          : "unmet",
      satisfiedBy: [],
      children,
    };
  }

  const root = buildStatus(program.requirement);

  // 6. Prerequisite violations.
  //    For every course the student took, look up its catalog entry's
  //    `prerequisites` and confirm each one is also in the student's
  //    completed set. We check ALL completed courses (not just consumed
  //    ones) so the student is alerted even when the course in question
  //    only fills an elective slot.
  //
  //    A prereq id pointing to a course that doesn't exist in our catalog
  //    (e.g. a renumbered/retired course) is still reported as "missing".
  //    The dashboard / LLM can decide whether to call it a data-quality
  //    issue or a real gap.
  const completedSet = new Set(studentCourses.map((c) => c.id));
  const prereqViolations = [];
  for (const sc of studentCourses) {
    const cat = getCourse(sc.id);
    if (!cat || !cat.prerequisites?.length) continue;
    const missing = cat.prerequisites.filter((p) => !completedSet.has(p));
    if (missing.length > 0) {
      prereqViolations.push({ courseId: sc.id, missing });
    }
  }

  // 7. Mutex conflicts.
  //    For every pair of completed courses, check whether either is listed
  //    as mutually exclusive of the other in the catalog. The catalog data
  //    is bidirectional in practice (CIS4190's mutex says CIS5190 and vice
  //    versa), but we tolerate one-sided data by checking both directions.
  //    We dedupe pairs by sorting (courseA < courseB).
  const mutexConflicts = [];
  for (let i = 0; i < studentCourses.length; i++) {
    for (let j = i + 1; j < studentCourses.length; j++) {
      const a = studentCourses[i].id;
      const b = studentCourses[j].id;
      const catA = getCourse(a);
      const catB = getCourse(b);
      const aSaysB = catA?.mutuallyExclusive?.includes(b);
      const bSaysA = catB?.mutuallyExclusive?.includes(a);
      if (aSaysB || bSaysA) {
        const [courseA, courseB] = a < b ? [a, b] : [b, a];
        mutexConflicts.push({ courseA, courseB });
      }
    }
  }

  // 8. Outputs.
  const unassignedCourses = studentCourses
    .map((c) => c.id)
    .filter((id) => !consumed.has(id));

  return {
    programId,
    programName: program.name,
    totalCuRequired: program.total_cu,
    totalCuCompleted: root.completedCu,
    root,
    unassignedCourses,
    conflicts,
    warnings,
    prereqViolations,
    mutexConflicts,
  };
}
