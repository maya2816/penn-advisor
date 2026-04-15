import { useMemo, useState } from "react";
import { GRAD_TERM_OPTIONS } from "../../utils/graduationTerms.js";
import { compareSemesterLabels } from "../../utils/semesterOrder.js";
import {
  getIncompleteGaps,
  getProgramRequirement,
} from "../../utils/programRequirementIndex.js";
import { generatePlan } from "../../utils/planGenerator.js";

/**
 * OpenRequirementsPanel — top-of-page card on the redesigned Semesters
 * tab. Summarizes everything that's still left to take, grouped by
 * requirement section, and offers two primary CTAs:
 *
 *   1. "Suggest a plan to finish by [target term]" — runs the auto-plan
 *      generator and confirms before overwriting any existing plan.
 *   2. "+ Add a term" — adds an empty planned term card so the student
 *      can build their plan manually.
 *
 * The target term defaults to `profile.targetGraduationTerm` (set
 * during setup); falls back to the first option in GRAD_TERM_OPTIONS.
 *
 * Stateless except for the confirmation modal flag.
 */
export function OpenRequirementsPanel({
  completion,
  completedCourses: _completedCourses, // unused but kept for future use
  planByTerm,
  programId,
  profile,
  onAddTerm,
  onApplyAutoPlan,
}) {
  const [selectedTargetTerm, setSelectedTargetTerm] = useState(
    profile?.targetGraduationTerm || GRAD_TERM_OPTIONS[0]
  );
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [warningsToShow, setWarningsToShow] = useState([]);

  const programReq = useMemo(() => getProgramRequirement(programId), [programId]);

  const gaps = useMemo(() => {
    if (!completion || !programReq) return [];
    return getIncompleteGaps(completion, programReq);
  }, [completion, programReq]);

  // Group gaps by their parent section. The completion tree carries
  // section labels at root.children[].label, and each leaf id is dot-
  // namespaced like "ai.electives" — we can map back to the section
  // label by walking the tree once.
  const gapsBySection = useMemo(() => {
    if (!completion?.root?.children?.length || gaps.length === 0) return [];

    const leafIdToSection = {};
    for (const sec of completion.root.children) {
      const visit = (n) => {
        if (n.id) leafIdToSection[n.id] = sec.label;
        if (n.children) for (const c of n.children) visit(c);
      };
      visit(sec);
    }

    const groups = new Map();
    for (const g of gaps) {
      const sectionLabel = leafIdToSection[g.id] || "Other";
      if (!groups.has(sectionLabel)) groups.set(sectionLabel, []);
      groups.get(sectionLabel).push(g);
    }
    return [...groups.entries()];
  }, [completion, gaps]);

  const totalMissingCu = gaps.reduce((s, g) => s + g.missing, 0);

  const hasExistingPlan = Object.values(planByTerm || {}).some((arr) => arr?.length > 0);

  const runAutoPlan = () => {
    const result = generatePlan({
      completion,
      completedCourses: _completedCourses,
      programId,
      targetTerm: selectedTargetTerm || null,
    });
    onApplyAutoPlan(result.planByTerm);
    setWarningsToShow(result.warnings);
    setConfirmOverwrite(false);
  };

  const handleSuggestClick = () => {
    if (hasExistingPlan) {
      setConfirmOverwrite(true);
    } else {
      runAutoPlan();
    }
  };

  // Pick a sensible "+ Add a term" default: the chronologically next
  // term after the latest planned (or the first GRAD_TERM_OPTIONS).
  const handleAddTerm = () => {
    const plannedKeys = Object.keys(planByTerm || {});
    let next;
    if (plannedKeys.length > 0) {
      const sorted = plannedKeys.sort(compareSemesterLabels);
      const last = sorted[sorted.length - 1];
      next = nextTermAfter(last) || GRAD_TERM_OPTIONS[0];
    } else {
      next = selectedTargetTerm || GRAD_TERM_OPTIONS[0];
    }
    onAddTerm(next);
  };

  if (gaps.length === 0) {
    return (
      <section className="rounded-3xl border border-emerald-200/60 bg-emerald-50/40 p-6 shadow-panel">
        <h2 className="text-lg font-semibold text-emerald-900">All requirements complete</h2>
        <p className="mt-1 text-sm text-emerald-800">
          Every requirement area is satisfied. You can still add planned terms below to track future
          electives.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={handleAddTerm}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 transition hover:bg-emerald-50"
          >
            <span className="text-base leading-none">+</span> Add a term
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Open requirements</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            <span className="num font-semibold text-slate-900">{totalMissingCu}</span> CU left
            across <span className="num font-semibold text-slate-900">{gapsBySection.length}</span>{" "}
            requirement {gapsBySection.length === 1 ? "area" : "areas"}.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-y-4 sm:grid-cols-[max-content_1fr] sm:gap-x-8">
        {gapsBySection.map(([sectionLabel, list]) => (
          <SectionGapRow key={sectionLabel} sectionLabel={sectionLabel} gaps={list} />
        ))}
      </div>

      {warningsToShow.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
          <p className="mb-1 font-semibold">Plan generated with warnings:</p>
          <ul className="ml-4 list-disc space-y-0.5">
            {warningsToShow.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setWarningsToShow([])}
            className="mt-1 text-[11px] font-medium text-amber-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-slate-600">Finish by</label>
          <select
            value={selectedTargetTerm}
            onChange={(e) => setSelectedTargetTerm(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50/40 px-2.5 py-1.5 text-xs"
          >
            {GRAD_TERM_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSuggestClick}
            className="rounded-full bg-penn px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-penn-500"
          >
            Suggest a plan
          </button>
        </div>

        <button
          type="button"
          onClick={handleAddTerm}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-penn/40 hover:bg-penn-50/40 hover:text-penn"
        >
          <span className="text-base leading-none">+</span> Add a term
        </button>
      </div>

      {confirmOverwrite && (
        <ConfirmOverwriteDialog
          targetTerm={selectedTargetTerm}
          onCancel={() => setConfirmOverwrite(false)}
          onConfirm={runAutoPlan}
        />
      )}
    </section>
  );
}

function SectionGapRow({ sectionLabel, gaps }) {
  return (
    <>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {sectionLabel}
      </div>
      <ul className="space-y-1">
        {gaps.map((g) => (
          <li key={g.id} className="flex items-baseline gap-2 text-sm">
            <span className="text-slate-700">{g.label}</span>
            <span className="num shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              {g.missing} CU
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function ConfirmOverwriteDialog({ targetTerm, onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lift">
        <h3 className="text-base font-semibold text-slate-900">Replace your current plan?</h3>
        <p className="mt-2 text-sm text-slate-600">
          You already have planned courses. Generating a new plan to finish by{" "}
          <span className="font-medium text-slate-900">{targetTerm}</span> will replace them.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-penn px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-penn-500"
          >
            Replace plan
          </button>
        </div>
      </div>
    </div>
  );
}

/** Local copy of the term-walker (Spring/Fall, skipping Summer). */
function nextTermAfter(label) {
  const m = label?.match(/^(Spring|Summer|Fall)\s+(\d{4})$/);
  if (!m) return null;
  const term = m[1];
  const year = parseInt(m[2], 10);
  if (term === "Spring") return `Fall ${year}`;
  if (term === "Summer") return `Fall ${year}`;
  return `Spring ${year + 1}`;
}
