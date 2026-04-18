import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import courses from "../../data/courses.json" with { type: "json" };
import { RatingBadge, computeTermMean } from "./RatingBadge.jsx";
import { AddPlannedCourseInline } from "./AddPlannedCourseInline.jsx";

/**
 * HorizontalPlannerView — Carta-style horizontal semester grid.
 *
 * Each term is a column with a status label (Completed / In Progress /
 * Planned), courses are cards stacked vertically. Each card shows the
 * course code, title, CU, grade, difficulty/workload badges, and an
 * attribution label showing which requirement it satisfies.
 *
 * Planned columns are interactive: + to add courses, × to remove.
 * Completed/in-progress columns are read-only (edit via the list view).
 */
export function HorizontalPlannerView({
  timeline,
  attributionMap,
  completedCourses,
  planByTerm,
  onAddCourse,
  onRemoveCourse,
  onRemoveTerm,
}) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-muted">
        No terms to display. Upload your transcript to see your course history.
      </div>
    );
  }

  const completedSet = useMemo(
    () => new Set((completedCourses || []).map((c) => c.id)),
    [completedCourses]
  );
  const allPlannedIds = useMemo(
    () => new Set(Object.values(planByTerm || {}).flat()),
    [planByTerm]
  );
  const existingForSearch = useMemo(
    () => [...completedSet, ...allPlannedIds],
    [completedSet, allPlannedIds]
  );

  return (
    <div className="overflow-x-auto pb-4">
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${timeline.length}, minmax(200px, 260px))`,
        }}
      >
        {timeline.map((entry) => (
          <TermColumn
            key={entry.term}
            entry={entry}
            attributionMap={attributionMap}
            completedSet={completedSet}
            existingForSearch={existingForSearch}
            onAddCourse={onAddCourse}
            onRemoveCourse={onRemoveCourse}
            onRemoveTerm={onRemoveTerm}
          />
        ))}
      </div>
    </div>
  );
}

const STATUS_STYLES = {
  completed: {
    label: "Completed",
    bar: "bg-emerald-100 text-emerald-800",
    column: "border border-slate-200/80 bg-white",
  },
  "in-progress": {
    label: "In Progress",
    bar: "bg-penn-50 text-penn",
    column: "border-l-4 border-l-penn border border-slate-200/80 bg-white",
  },
  planned: {
    label: "Planned",
    bar: "bg-slate-100 text-slate-600",
    column: "border-2 border-dashed border-penn/30 bg-penn-50/10",
  },
};

function TermColumn({
  entry,
  attributionMap,
  completedSet,
  existingForSearch,
  onAddCourse,
  onRemoveCourse,
  onRemoveTerm,
}) {
  const { kind, term, courses: termCourses } = entry;
  const isPlanned = kind === "planned";
  const status = STATUS_STYLES[kind] || STATUS_STYLES.completed;

  const courseList = useMemo(() => {
    if (isPlanned) {
      return (termCourses || []).map((id) => {
        const cat = courses[id];
        return {
          id,
          title: cat?.title || id,
          cu: cat?.cu ?? 1,
          grade: null,
          difficulty: cat?.difficulty ?? null,
          workRequired: cat?.workRequired ?? null,
        };
      });
    }
    return (termCourses || []).map((c) => {
      const cat = courses[c.id];
      return {
        id: c.id,
        title: cat?.title || c.id,
        cu: c.cu ?? cat?.cu ?? 1,
        grade: c.grade || null,
        difficulty: cat?.difficulty ?? null,
        workRequired: cat?.workRequired ?? null,
      };
    });
  }, [termCourses, isPlanned]);

  const totalCu = courseList.reduce((s, c) => s + c.cu, 0);
  const meanDiff = computeTermMean(courseList.map((c) => ({ id: c.id })), courses, "difficulty");
  const meanWork = computeTermMean(courseList.map((c) => ({ id: c.id })), courses, "workRequired");

  const isEmpty = courseList.length === 0;

  // Only planned columns are droppable (completed/in-progress are locked)
  const { setNodeRef: setDropRef, isOver } = isPlanned
    ? useDroppable({ id: `drop:${term}` })
    : { setNodeRef: undefined, isOver: false };

  const dropHighlight = isOver ? "ring-2 ring-penn/40 ring-inset bg-penn-50/20" : "";

  return (
    <div
      ref={setDropRef}
      className={`flex flex-col rounded-2xl shadow-card ${status.column} ${dropHighlight} transition-all`}
    >
      {/* Header */}
      <div className="border-b border-slate-100 px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{term}</h3>
          {isPlanned && isEmpty && onRemoveTerm && (
            <button
              type="button"
              onClick={() => onRemoveTerm(term)}
              className="rounded p-0.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              title="Remove this term"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        {/* Status label */}
        <div className={`mx-auto mt-1.5 w-fit rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${status.bar}`}>
          {status.label}
        </div>

        <p className="num mt-1 text-xs text-muted">{totalCu} CU</p>

        {(meanDiff != null || meanWork != null) && (
          <div className="mt-1 flex justify-center gap-1">
            <RatingBadge value={meanDiff} label="D" />
            <RatingBadge value={meanWork} label="W" />
          </div>
        )}
      </div>

      {/* Course cards */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {courseList.map((c) => (
          <CourseCard
            key={c.id}
            course={c}
            isPlanned={isPlanned}
            attribution={attributionMap?.[c.id]}
            onRemove={isPlanned && onRemoveCourse ? () => onRemoveCourse(term, c.id) : null}
          />
        ))}
        {isEmpty && (
          <p className="py-4 text-center text-xs text-muted">No courses</p>
        )}
      </div>

      {/* Add course (planned terms only) */}
      {isPlanned && onAddCourse && (
        <div className="border-t border-slate-100/50 px-3 pb-3 pt-2">
          <AddPlannedCourseButton
            term={term}
            completedSet={completedSet}
            existingForSearch={existingForSearch}
            onAdd={(id) => onAddCourse(term, id)}
          />
        </div>
      )}
    </div>
  );
}

function CourseCard({ course, isPlanned, attribution, onRemove }) {
  const { id, title, cu, grade, difficulty, workRequired } = course;

  return (
    <div
      className={`group relative rounded-xl border px-3 py-2.5 transition hover:shadow-sm ${
        isPlanned ? "border-penn/20 bg-white/80" : "border-slate-100 bg-slate-50/40"
      }`}
    >
      {/* Remove button (planned only) */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -right-1 -top-1 hidden rounded-full bg-white p-0.5 shadow-sm group-hover:block hover:bg-rose-50 hover:text-rose-600"
          title="Remove"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}

      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-slate-900">
          {id.replace(/^([A-Z]+)/, "$1 ")}
        </span>
        <span className="num shrink-0 text-[10px] text-muted">
          {cu} CU
          {grade && <span className="ml-1 font-medium text-slate-700">{grade}</span>}
        </span>
      </div>

      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">{title}</p>

      {/* Attribution label */}
      {attribution?.section ? (
        <p className="mt-1 truncate text-[9px] font-medium text-penn">
          {attribution.section}
          {attribution.leaf && attribution.leaf !== attribution.section && (
            <span className="text-penn/60"> — {attribution.leaf}</span>
          )}
        </p>
      ) : (
        <p className="mt-1 text-[9px] text-slate-400">Unassigned</p>
      )}

      {(difficulty != null || workRequired != null) && (
        <div className="mt-1 flex gap-1">
          <RatingBadge value={difficulty} label="D" />
          <RatingBadge value={workRequired} label="W" />
        </div>
      )}
    </div>
  );
}

/**
 * Compact "+ Add" button for planned columns. Wraps AddPlannedCourseInline
 * but only shows when expanded.
 */
function AddPlannedCourseButton({ term, completedSet, existingForSearch, onAdd }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-slate-300 bg-white py-1.5 text-[11px] font-medium text-slate-500 transition hover:border-penn hover:bg-penn-50/40 hover:text-penn"
      >
        + Add course
      </button>
    );
  }

  return (
    <AddPlannedCourseInline
      completedSet={completedSet}
      plannedBefore={new Set()}
      existing={existingForSearch}
      onAdd={(id) => {
        onAdd(id);
        setOpen(false);
      }}
    />
  );
}
