import { useMemo } from "react";
import courses from "../../data/courses.json" with { type: "json" };
import { RatingBadge, computeTermMean } from "./RatingBadge.jsx";

/**
 * HorizontalPlannerView — Carta-style horizontal semester grid.
 *
 * Each term is a column, courses are simple cards stacked vertically
 * within each column. Designed for a "full picture at a glance" view
 * that makes sense during a demo or an advising conversation.
 *
 * Read-only: no editing affordances. The vertical timeline view
 * (the default) is for editing; this view is for scanning.
 *
 * Inspired by Stanford Carta's Planner view.
 */
export function HorizontalPlannerView({ timeline }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-muted">
        No terms to display. Upload your transcript to see your course history.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${timeline.length}, minmax(200px, 260px))`,
        }}
      >
        {timeline.map((entry) => (
          <TermColumn key={entry.term} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function TermColumn({ entry }) {
  const { kind, term, courses: termCourses } = entry;

  // For completed/in-progress: termCourses is an array of course objects
  // For planned: termCourses is an array of course-id strings
  const isPlanned = kind === "planned";
  const isInProgress = kind === "in-progress";

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
  const meanDiff = computeTermMean(
    courseList.map((c) => ({ id: c.id })),
    courses,
    "difficulty"
  );
  const meanWork = computeTermMean(
    courseList.map((c) => ({ id: c.id })),
    courses,
    "workRequired"
  );

  const columnStyle = isPlanned
    ? "border-2 border-dashed border-penn/30 bg-penn-50/10"
    : isInProgress
      ? "border-l-4 border-l-penn border border-slate-200/80 bg-white"
      : "border border-slate-200/80 bg-white";

  return (
    <div className={`flex flex-col rounded-2xl shadow-card ${columnStyle}`}>
      {/* Header */}
      <div className="border-b border-slate-100 px-4 py-3 text-center">
        <h3 className="text-sm font-semibold text-slate-900">{term}</h3>
        <p className="num mt-0.5 text-xs text-muted">
          {totalCu} CU
          {isInProgress && (
            <span className="ml-1.5 rounded-full bg-penn-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-penn">
              IP
            </span>
          )}
          {isPlanned && (
            <span className="ml-1.5 rounded-full bg-penn-50/60 px-1.5 py-0.5 text-[9px] font-bold uppercase text-penn">
              Plan
            </span>
          )}
        </p>
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
          <CourseCard key={c.id} course={c} isPlanned={isPlanned} />
        ))}
        {courseList.length === 0 && (
          <p className="py-4 text-center text-xs text-muted">No courses</p>
        )}
      </div>
    </div>
  );
}

function CourseCard({ course, isPlanned }) {
  const { id, title, cu, grade, difficulty, workRequired } = course;

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 transition hover:shadow-sm ${
        isPlanned
          ? "border-penn/20 bg-white/80"
          : "border-slate-100 bg-slate-50/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-slate-900">
          {id.replace(/^([A-Z]+)/, "$1 ")}
        </span>
        <span className="num shrink-0 text-[10px] text-muted">
          {cu} CU
          {grade && <span className="ml-1 font-medium text-slate-700">{grade}</span>}
        </span>
      </div>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">
        {title}
      </p>
      {(difficulty != null || workRequired != null) && (
        <div className="mt-1.5 flex gap-1">
          <RatingBadge value={difficulty} label="D" />
          <RatingBadge value={workRequired} label="W" />
        </div>
      )}
    </div>
  );
}
