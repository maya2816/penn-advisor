import { useMemo, useState } from "react";
import courses from "../../data/courses.json" with { type: "json" };
import { gpaFromCourses } from "../../utils/gradePoints.js";
import { getPrereqStatus } from "../../utils/prereqStatus.js";
import { CourseRecordRow } from "./CourseRecordRow.jsx";
import { PrereqStatusChip } from "./PrereqStatusChip.jsx";
import { RatingBadge, computeTermMean } from "./RatingBadge.jsx";
import { AddPlannedCourseInline } from "./AddPlannedCourseInline.jsx";

/**
 * TimelineTermCard — one card on the chronological timeline. Renders
 * in one of three modes:
 *
 *   - "completed":   transcript-backed history. Locked against add/
 *                    remove of courses. Each row is a CourseRecordRow
 *                    so the audit-pin chip is still editable.
 *
 *   - "in-progress": all courses are flagged inProgress. Same locking
 *                    as completed (you change them by uploading a new
 *                    transcript), but a Penn-blue side stripe + "IN
 *                    PROGRESS" pill tell the student this is "now".
 *
 *   - "planned":     editable. Each course can be removed via the ×
 *                    button. Shows a per-course PrereqStatusChip and a
 *                    mutex warning if any planned course conflicts
 *                    with a completed course. Has an
 *                    AddPlannedCourseInline at the bottom and a small
 *                    "Remove term" button (only visible when empty).
 *
 * The parent (`SemestersPanel`) supplies the broader context the card
 * needs: the full `completedCourses`, the full `planByTerm`, and the
 * current `term` so we can compute "what's planned in earlier terms"
 * for the prereq status chips.
 */
export function TimelineTermCard({
  kind,
  term,
  courses: termCourses, // for completed/in-progress: full course objects; for planned: id strings
  programId,
  completedCourses,
  planByTerm,
  attributionMap,
  sectionStyleMap,
  timeline, // ordered timeline so we know which terms are earlier
  onAddCourse,
  onRemoveCourse,
  onRemoveTerm,
}) {
  if (kind === "completed" || kind === "in-progress") {
    return (
      <CompletedOrInProgressCard
        kind={kind}
        term={term}
        courseObjects={termCourses}
        programId={programId}
        attributionMap={attributionMap}
        sectionStyleMap={sectionStyleMap}
      />
    );
  }
  return (
    <PlannedCard
      term={term}
      ids={termCourses}
      programId={programId}
      completedCourses={completedCourses}
      planByTerm={planByTerm}
      timeline={timeline}
      onAddCourse={onAddCourse}
      onRemoveCourse={onRemoveCourse}
      onRemoveTerm={onRemoveTerm}
    />
  );
}

// ---------- COMPLETED / IN-PROGRESS ----------

function cuForCompletedCourse(c) {
  const t = Number(c.cu);
  if (Number.isFinite(t) && t > 0) return t;
  return courses[c.id]?.cu ?? 1;
}

function CompletedOrInProgressCard({
  kind,
  term,
  courseObjects,
  programId,
  attributionMap,
  sectionStyleMap,
}) {
  const totalCu = courseObjects.reduce((s, c) => s + cuForCompletedCourse(c), 0);
  const gpa = kind === "completed" ? gpaFromCourses(courseObjects, cuForCompletedCourse) : null;
  const isInProgress = kind === "in-progress";
  const meanDiff = computeTermMean(courseObjects, courses, "difficulty");
  const meanWork = computeTermMean(courseObjects, courses, "workRequired");

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-card ${
        isInProgress ? "border-l-4 border-l-penn border-y-slate-200/80 border-r-slate-200/80" : "border-slate-200/80"
      }`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">{term}</h3>
            {isInProgress && (
              <span className="rounded-full bg-penn-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-penn">
                In progress
              </span>
            )}
          </div>
          <p className="num mt-0.5 text-xs text-muted">
            <span className="font-semibold text-slate-800">{totalCu}</span> CU
            {gpa != null && (
              <>
                {" · "}
                Semester GPA{" "}
                <span className="font-semibold text-slate-800">{gpa.toFixed(2)}</span>
              </>
            )}
          </p>
          {(meanDiff != null || meanWork != null) && (
            <div className="mt-1 flex gap-2">
              <RatingBadge value={meanDiff} label="Avg diff" />
              <RatingBadge value={meanWork} label="Avg work" />
            </div>
          )}
        </div>
      </header>

      <ul className="divide-y divide-slate-100 px-5 py-3">
        {courseObjects.map((c, idx) => (
          <CourseRecordRow
            key={`${term}-${c.id}-${idx}`}
            course={c}
            programId={programId}
            attribution={attributionMap?.[c.id]}
            sectionStyleMap={sectionStyleMap}
            cu={cuForCompletedCourse(c)}
          />
        ))}
      </ul>
    </div>
  );
}

// ---------- PLANNED ----------

function PlannedCard({
  term,
  ids,
  programId,
  completedCourses,
  planByTerm,
  timeline,
  onAddCourse,
  onRemoveCourse,
  onRemoveTerm,
}) {
  // Build the "completed by now" set: every course on the transcript
  // (graded or in-progress) counts as "in the timeline before this
  // planned term" because all transcript terms come before any
  // planned term in the chronological model.
  const completedSet = useMemo(
    () => new Set((completedCourses || []).map((c) => c.id)),
    [completedCourses]
  );

  // "Planned before this term": every id in any planned term that
  // sorts strictly earlier than this one in the timeline.
  const plannedBefore = useMemo(() => {
    const set = new Set();
    if (!timeline) return set;
    for (const entry of timeline) {
      if (entry.kind !== "planned") continue;
      if (entry.term === term) break;
      for (const id of entry.courses || []) set.add(id);
    }
    return set;
  }, [timeline, term]);

  // All planned ids anywhere (used to exclude duplicates from search).
  const allPlannedIds = useMemo(
    () => new Set(Object.values(planByTerm || {}).flat()),
    [planByTerm]
  );

  // Mutex collision check against completed courses.
  const mutexConflictFor = (id) => {
    const cat = courses[id];
    const mutex = cat?.mutuallyExclusive || [];
    for (const m of mutex) {
      if (completedSet.has(m)) return m;
    }
    for (const cid of completedSet) {
      const otherMutex = courses[cid]?.mutuallyExclusive || [];
      if (otherMutex.includes(id)) return cid;
    }
    return null;
  };

  const totalPlannedCu = ids.reduce((s, id) => s + (courses[id]?.cu ?? 1), 0);
  const isEmpty = ids.length === 0;
  const plannedMeanDiff = computeTermMean(ids, courses, "difficulty");
  const plannedMeanWork = computeTermMean(ids, courses, "workRequired");

  const existingForSearch = useMemo(
    () => [...completedSet, ...allPlannedIds],
    [completedSet, allPlannedIds]
  );

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-dashed border-penn/30 bg-penn-50/20 shadow-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">{term}</h3>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-penn">
              Planned
            </span>
          </div>
          <p className="num mt-0.5 text-xs text-muted">
            <span className="font-semibold text-slate-800">{totalPlannedCu}</span> CU planned
          </p>
          {(plannedMeanDiff != null || plannedMeanWork != null) && (
            <div className="mt-1 flex gap-2">
              <RatingBadge value={plannedMeanDiff} label="Avg diff" />
              <RatingBadge value={plannedMeanWork} label="Avg work" />
            </div>
          )}
        </div>
        {isEmpty && (
          <button
            type="button"
            onClick={() => onRemoveTerm(term)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:border-rose-300 hover:bg-rose-50/50 hover:text-rose-700"
          >
            Remove term
          </button>
        )}
      </header>

      {ids.length > 0 && (
        <ul className="space-y-2 px-5 pb-4">
          {ids.map((id) => (
            <PlannedCourseRow
              key={id}
              id={id}
              term={term}
              completedSet={completedSet}
              plannedBefore={plannedBefore}
              mutexWith={mutexConflictFor(id)}
              onRemove={() => onRemoveCourse(term, id)}
            />
          ))}
        </ul>
      )}

      <div className="px-5 pb-4">
        <AddPlannedCourseInline
          completedSet={completedSet}
          plannedBefore={plannedBefore}
          existing={existingForSearch}
          onAdd={(id) => onAddCourse(term, id)}
        />
      </div>
    </div>
  );
}

function PlannedCourseRow({ id, term: _term, completedSet, plannedBefore, mutexWith, onRemove }) {
  const cat = courses[id];
  const cu = cat?.cu ?? 1;
  const title = cat?.title || "";
  const prereqStatus = useMemo(
    () => getPrereqStatus(id, { completedSet, plannedBefore }),
    [id, completedSet, plannedBefore]
  );

  return (
    <li className="flex items-start justify-between gap-3 rounded-xl border border-white/60 bg-white px-4 py-2.5 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-sm font-semibold text-slate-900">
            {id.replace(/^([A-Z]+)/, "$1 ")}
          </span>
          <PrereqStatusChip status={prereqStatus.status} missing={prereqStatus.missing} />
          {mutexWith && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-800"
              title={`Conflicts with ${mutexWith.replace(/^([A-Z]+)/, "$1 ")} (already completed)`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />
              Conflicts with {mutexWith.replace(/^([A-Z]+)/, "$1 ")}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-600">{title}</p>
      </div>
      <div className="num flex shrink-0 flex-col items-end gap-1 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span className="font-medium tabular-nums">{cu} CU</span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${id}`}
            className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
          >
            ×
          </button>
        </div>
        <div className="flex gap-1">
          <RatingBadge value={cat?.difficulty} label="Diff" />
          <RatingBadge value={cat?.workRequired} label="Work" />
        </div>
      </div>
    </li>
  );
}
