import { useMemo, useState } from "react";
import { DndContext, DragOverlay, useDraggable } from "@dnd-kit/core";
import courses from "../../data/courses.json" with { type: "json" };
import { CourseSearch } from "../Setup/CourseSearch.jsx";
import { GRAD_TERM_OPTIONS } from "../../utils/graduationTerms.js";
import { compareSemesterLabels } from "../../utils/semesterOrder.js";
import {
  getIncompleteGaps,
  getProgramRequirement,
  courseIdsMatchingLeafPool,
} from "../../utils/programRequirementIndex.js";
import { generatePlan } from "../../utils/planGenerator.js";

const catalogList = Object.values(courses);

/**
 * RequirementsBank — horizontal bank of unfilled requirement slots.
 *
 * Rendered as a horizontally scrollable row of dashed slot cards,
 * grouped by section. Each card is DRAGGABLE — drop it onto a planned
 * semester column to assign it there (or click to search inline).
 *
 * The bank sits BESIDE the planned semesters so the student can see
 * both at once — "what I still need" next to "where I'm putting it."
 */
export function RequirementsBank({
  completion,
  programId,
  completedCourses,
  planByTerm,
  setPlanByTerm,
  profile,
  onApplyAutoPlan,
}) {
  const [selectedTargetTerm, setSelectedTargetTerm] = useState(
    profile?.targetGraduationTerm || GRAD_TERM_OPTIONS[0]
  );
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [planWarnings, setPlanWarnings] = useState([]);

  const programReq = useMemo(() => getProgramRequirement(programId), [programId]);

  const gaps = useMemo(() => {
    if (!completion || !programReq) return [];
    return getIncompleteGaps(completion, programReq);
  }, [completion, programReq]);

  const gapsBySection = useMemo(() => {
    if (!completion?.root?.children?.length || gaps.length === 0) return [];
    const leafToSection = {};
    for (const sec of completion.root.children) {
      const visit = (n) => {
        if (n.id) leafToSection[n.id] = sec.label;
        if (n.children) for (const c of n.children) visit(c);
      };
      visit(sec);
    }
    const groups = new Map();
    for (const g of gaps) {
      const section = leafToSection[g.id] || "Other";
      if (!groups.has(section)) groups.set(section, []);
      groups.get(section).push(g);
    }
    return [...groups.entries()];
  }, [completion, gaps]);

  const totalMissing = gaps.reduce((s, g) => s + g.missing, 0);

  const completedIds = useMemo(
    () => new Set((completedCourses || []).map((c) => c.id)),
    [completedCourses]
  );
  const allPlannedIds = useMemo(
    () => new Set(Object.values(planByTerm || {}).flat()),
    [planByTerm]
  );
  const existingForSearch = useMemo(
    () => [...completedIds, ...allPlannedIds],
    [completedIds, allPlannedIds]
  );

  const hasExistingPlan = Object.values(planByTerm || {}).some((a) => a?.length > 0);

  const handleSuggestPlan = () => {
    if (hasExistingPlan) { setConfirmOverwrite(true); return; }
    runAutoPlan();
  };

  const runAutoPlan = () => {
    const result = generatePlan({
      completion, completedCourses, programId,
      targetTerm: selectedTargetTerm || null,
    });
    onApplyAutoPlan(result.planByTerm);
    setPlanWarnings(result.warnings);
    setConfirmOverwrite(false);
  };

  const firstPlannedTerm = useMemo(() => {
    const planned = Object.keys(planByTerm || {}).sort(compareSemesterLabels);
    return planned[0] || null;
  }, [planByTerm]);

  if (gaps.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 px-4 py-3">
        <p className="text-sm font-medium text-emerald-900">
          All requirement areas satisfied.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Remaining Requirements</h3>
          <p className="mt-0.5 text-xs text-muted">
            <span className="num font-semibold text-slate-800">{totalMissing}</span> CU left.
            Drag a slot to a planned semester, or click to assign a course.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-slate-600">Finish by</label>
          <select
            value={selectedTargetTerm}
            onChange={(e) => setSelectedTargetTerm(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50/40 px-2 py-1 text-xs"
          >
            {GRAD_TERM_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSuggestPlan}
            className="rounded-full bg-penn px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-penn-500"
          >
            Suggest a plan
          </button>
        </div>
      </div>

      {/* Horizontal scrollable row of slot cards */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 pb-2">
          {gapsBySection.map(([section, sectionGaps]) => (
            <div key={section} className="flex items-start gap-2">
              <div className="flex shrink-0 items-center">
                <span className="mr-2 -rotate-90 whitespace-nowrap text-[9px] font-bold uppercase tracking-widest text-slate-400 sm:rotate-0">
                  {section}
                </span>
              </div>
              {sectionGaps.map((gap) => (
                <SlotCard
                  key={gap.id}
                  gap={gap}
                  existingForSearch={existingForSearch}
                  firstPlannedTerm={firstPlannedTerm}
                  planByTerm={planByTerm}
                  setPlanByTerm={setPlanByTerm}
                />
              ))}
              <div className="w-px self-stretch bg-slate-200/60" />
            </div>
          ))}
        </div>
      </div>

      {planWarnings.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
          <ul className="ml-4 list-disc space-y-0.5">
            {planWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {confirmOverwrite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={(e) => e.target === e.currentTarget && setConfirmOverwrite(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lift">
            <h3 className="text-base font-semibold text-slate-900">Replace your current plan?</h3>
            <p className="mt-2 text-sm text-slate-600">This will replace all planned courses.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOverwrite(false)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={runAutoPlan} className="rounded-full bg-penn px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-penn-500">Replace plan</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SlotCard({ gap, existingForSearch, firstPlannedTerm, planByTerm, setPlanByTerm }) {
  const [searchOpen, setSearchOpen] = useState(false);

  const allowedIds = useMemo(() => {
    if (!gap.raw) return undefined;
    return courseIdsMatchingLeafPool(gap.raw, catalogList);
  }, [gap.raw]);

  const handleAddCourse = (courseId) => {
    let targetTerm = firstPlannedTerm;
    if (!targetTerm) {
      targetTerm = GRAD_TERM_OPTIONS[0] || "Fall 2026";
      setPlanByTerm({ ...planByTerm, [targetTerm]: [courseId] });
    } else {
      const list = planByTerm[targetTerm] || [];
      setPlanByTerm({ ...planByTerm, [targetTerm]: [...list, courseId] });
    }
    setSearchOpen(false);
  };

  if (searchOpen) {
    return (
      <div className="w-[220px] shrink-0 rounded-xl border border-penn/30 bg-white p-2 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-700">{gap.label}</span>
          <button type="button" onClick={() => setSearchOpen(false)} className="text-[10px] text-slate-400 hover:text-slate-700">×</button>
        </div>
        <CourseSearch existing={existingForSearch} allowedIds={allowedIds} onAdd={handleAddCourse} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setSearchOpen(true)}
      className="flex w-[140px] shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/30 px-2 py-3 text-center transition hover:border-penn hover:bg-penn-50/20"
    >
      <span className="text-[11px] font-semibold leading-tight text-slate-700">{gap.label}</span>
      <span className="num mt-0.5 text-[10px] text-muted">{gap.missing} CU</span>
      <span className="mt-1.5 text-[9px] text-penn">Click to assign</span>
    </button>
  );
}
