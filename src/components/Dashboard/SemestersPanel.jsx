import { useMemo, useState } from "react";
import { buildAttributionMap } from "../../utils/courseAttributionMap.js";
import { buildSectionStyleMap } from "../../utils/sectionCategoryStyles.js";
import { buildTimeline } from "../../utils/timelineBuilder.js";
import { OpenRequirementsPanel } from "./OpenRequirementsPanel.jsx";
import { TimelineTermCard } from "./TimelineTermCard.jsx";
import { HorizontalPlannerView } from "./HorizontalPlannerView.jsx";
import { RequirementsBank } from "./RequirementsBank.jsx";

/** Spring → Fall → Spring (skip Summer). */
function nextTermAfter(label) {
  const m = label?.match(/^(Spring|Summer|Fall)\s+(\d{4})$/);
  if (!m) return null;
  const [, term, y] = m;
  const year = parseInt(y, 10);
  if (term === "Spring") return `Fall ${year}`;
  if (term === "Summer") return `Fall ${year}`;
  return `Spring ${year + 1}`;
}

/**
 * SemestersPanel — chronological degree timeline.
 *
 * Replaces the old Record/Plan sub-tab UI with one continuous vertical
 * timeline: completed terms (transcript-backed, locked) → in-progress
 * term (locked, blue side stripe) → planned terms (dashed Penn blue,
 * fully editable). The visual styling tells the student what's
 * editable; there are no sub-tabs to switch between past and future.
 *
 * Top of the page: an OpenRequirementsPanel summarizes what's left to
 * take and offers two CTAs:
 *   - "Suggest a plan to finish by [target term]" — auto-plan generator
 *   - "+ Add a term" — append an empty planned term card
 *
 * The card list itself is a single `timeline.map()` over
 * `buildTimeline({completedCourses, planByTerm})`, with each entry
 * rendered by `TimelineTermCard`.
 */
export function SemestersPanel({
  completion,
  programId,
  completedCourses,
  planByTerm,
  setPlanByTerm,
  profile,
}) {
  const attributionMap = useMemo(() => buildAttributionMap(completion), [completion]);
  const sectionStyleMap = useMemo(
    () => buildSectionStyleMap(completion?.root?.children),
    [completion]
  );

  const timeline = useMemo(
    () => buildTimeline({ completedCourses, planByTerm }),
    [completedCourses, planByTerm]
  );

  const handleAddTerm = (label) => {
    if (!label) return;
    if (planByTerm[label] !== undefined) return; // already exists
    setPlanByTerm({ ...planByTerm, [label]: [] });
  };

  const handleRemoveTerm = (label) => {
    if (!(label in planByTerm)) return;
    const next = { ...planByTerm };
    delete next[label];
    setPlanByTerm(next);
  };

  const handleAddCourse = (term, courseId) => {
    if (!term || !courseId) return;
    const list = planByTerm[term] || [];
    if (list.includes(courseId)) return;
    setPlanByTerm({ ...planByTerm, [term]: [...list, courseId] });
  };

  const handleRemoveCourse = (term, courseId) => {
    setPlanByTerm({
      ...planByTerm,
      [term]: (planByTerm[term] || []).filter((x) => x !== courseId),
    });
  };

  const handleApplyAutoPlan = (newPlan) => {
    setPlanByTerm(newPlan || {});
  };

  const [viewMode, setViewMode] = useState("grid"); // "grid" (horizontal) or "list" (vertical timeline)

  return (
    <div className="space-y-8">
      <OpenRequirementsPanel
        completion={completion}
        programId={programId}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
            {viewMode === "grid"
              ? "Your full degree at a glance. Switch to list view to edit course assignments."
              : "Your completed terms (locked), current, and planned future terms. Click a course chip to change where it counts."}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            title="Grid view (Carta-style)"
            className={`rounded-md px-2.5 py-1.5 transition ${
              viewMode === "grid"
                ? "bg-penn text-white shadow-sm"
                : "text-muted hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            title="List view (detailed timeline)"
            className={`rounded-md px-2.5 py-1.5 transition ${
              viewMode === "list"
                ? "bg-penn text-white shadow-sm"
                : "text-muted hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            const last = timeline[timeline.length - 1]?.term;
            const next = last ? nextTermAfter(last) : "Fall 2026";
            handleAddTerm(next || "Fall 2026");
          }}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-penn/40 hover:bg-penn-50/40 hover:text-penn"
        >
          <span className="text-base leading-none">+</span> Add semester
        </button>
      </div>

      {viewMode === "grid" ? (
        <HorizontalPlannerView
          timeline={timeline}
          attributionMap={attributionMap}
          completedCourses={completedCourses}
          planByTerm={planByTerm}
          onAddCourse={handleAddCourse}
          onRemoveCourse={handleRemoveCourse}
          onRemoveTerm={handleRemoveTerm}
        />
      ) : (
        <div className="space-y-3">
          {timeline.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-muted">
              No terms on file yet. Upload your transcript to see your history, or add a planned
              term above to start sketching.
            </p>
          ) : (
            timeline.map((entry) => (
              <TimelineTermCard
                key={entry.term}
                kind={entry.kind}
                term={entry.term}
                courses={entry.courses}
                programId={programId}
                completedCourses={completedCourses}
                planByTerm={planByTerm}
                attributionMap={attributionMap}
                sectionStyleMap={sectionStyleMap}
                timeline={timeline}
                onAddCourse={handleAddCourse}
                onRemoveCourse={handleRemoveCourse}
                onRemoveTerm={handleRemoveTerm}
              />
            ))
          )}
        </div>
      )}

      <RequirementsBank
        completion={completion}
        programId={programId}
        completedCourses={completedCourses}
        planByTerm={planByTerm}
        setPlanByTerm={setPlanByTerm}
        profile={profile}
        onApplyAutoPlan={handleApplyAutoPlan}
      />
    </div>
  );
}
