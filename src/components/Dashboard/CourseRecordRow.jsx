import { useRef, useState } from "react";
import courses from "../../data/courses.json" with { type: "json" };
import {
  EXTRA_CREDIT_CHIP,
  getSectionChipClass,
  UNASSIGNED_CHIP,
} from "../../utils/sectionCategoryStyles.js";
import { CourseAssignmentPopover } from "./CourseAssignmentPopover.jsx";
import { RatingBadge } from "./RatingBadge.jsx";

function courseDisplayCode(id) {
  return id.replace(/^([A-Z]+)/, "$1 ");
}

/**
 * One Record-tab course row: code/title | clickable audit chip | CU/grade.
 *
 * The chip is now a button that opens the inline CourseAssignmentPopover —
 * the single source of truth for editing how the course counts in the
 * audit. The old Advanced overrides expander is gone; its catalog
 * attribute/tag editing is folded into the popover too.
 */
export function CourseRecordRow({
  course,
  programId,
  attribution,
  sectionStyleMap,
  cu,
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const chipRef = useRef(null);

  const isExtra = course.degreeCredit === "extra";
  const assigned = Boolean(attribution?.section) && !isExtra;
  const chipClasses = isExtra
    ? EXTRA_CREDIT_CHIP
    : assigned
      ? getSectionChipClass(attribution.sectionId, sectionStyleMap || {})
      : UNASSIGNED_CHIP;

  const leafRedundant =
    !attribution?.leaf ||
    attribution.leaf === courseDisplayCode(course.id) ||
    attribution.leaf === attribution.section;
  const showLeafSubtitle = assigned && !leafRedundant;

  const title = courses[course.id]?.title || "";

  const chipLabel = isExtra
    ? "Extra transcript"
    : assigned
      ? attribution.section
      : "Unassigned";

  const tooltip = isExtra
    ? "Excluded from degree audit — transcript only. Click to change."
    : assigned
      ? `${attribution.section} — ${attribution.leaf}. Click to change.`
      : "Not tied to a requirement slot in the current audit. Click to assign.";

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="min-w-0 flex-1 sm:basis-0">
          <span className="font-mono text-sm font-semibold text-slate-900">
            {courseDisplayCode(course.id)}
          </span>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-600">{title}</p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-stretch gap-1 sm:basis-0 sm:items-center sm:px-2">
          <button
            ref={chipRef}
            type="button"
            onClick={() => setPopoverOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={popoverOpen}
            title={tooltip}
            className={`group inline-flex max-w-full items-center gap-1 rounded-full px-3 py-1 text-center text-[11px] font-semibold leading-tight shadow-sm transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-penn/30 ${chipClasses}`}
          >
            <span className="truncate">{chipLabel}</span>
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-60 transition group-hover:opacity-100"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {isExtra && (
            <span className="max-w-[14rem] text-center text-[10px] text-muted sm:max-w-[12rem]">
              Does not count toward degree
            </span>
          )}
          {showLeafSubtitle && (
            <span className="max-w-[14rem] truncate text-center text-[10px] text-muted sm:max-w-[12rem]">
              {attribution.leaf}
            </span>
          )}
          {!isExtra && !assigned && (
            <span className="text-center text-[10px] text-slate-500">
              No requirement slot in the current audit
            </span>
          )}
        </div>

        <div className="num flex shrink-0 flex-col items-end gap-1 text-xs text-slate-600 sm:min-w-[3.5rem]">
          <span className="font-medium tabular-nums text-slate-800">{cu} CU</span>
          {course.grade && <span>{course.grade}</span>}
          <div className="flex gap-1">
            <RatingBadge value={cat?.difficulty} label="Diff" />
            <RatingBadge value={cat?.workRequired} label="Work" />
          </div>
        </div>
      </div>

      <CourseAssignmentPopover
        course={course}
        programId={programId}
        anchorRef={chipRef}
        open={popoverOpen}
        onClose={() => setPopoverOpen(false)}
      />
    </li>
  );
}
