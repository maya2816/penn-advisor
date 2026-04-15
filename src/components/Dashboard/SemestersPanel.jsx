import { useMemo } from "react";
import { buildAttributionMap } from "../../utils/courseAttributionMap.js";
import { buildSectionStyleMap } from "../../utils/sectionCategoryStyles.js";
import { buildTimeline } from "../../utils/timelineBuilder.js";
import { OpenRequirementsPanel } from "./OpenRequirementsPanel.jsx";
import { TimelineTermCard } from "./TimelineTermCard.jsx";

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

  return (
    <div className="space-y-8">
      <OpenRequirementsPanel
        completion={completion}
        completedCourses={completedCourses}
        planByTerm={planByTerm}
        programId={programId}
        profile={profile}
        onAddTerm={handleAddTerm}
        onApplyAutoPlan={handleApplyAutoPlan}
      />

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
          Your completed terms (locked), what you&apos;re taking now, and any planned future terms.
          Click a course chip to change where it counts in the audit.
        </p>
      </div>

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
    </div>
  );
}
