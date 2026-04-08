import { useEffect, useId, useMemo, useRef, useState } from "react";
import courses from "../../data/courses.json" with { type: "json" };
import {
  collectEditableRequirementFlags,
  getProgramRequirement,
} from "../../utils/programRequirementIndex.js";
import {
  EXTRA_CREDIT_CHIP,
  getSectionChipClass,
  UNASSIGNED_CHIP,
} from "../../utils/sectionCategoryStyles.js";

function courseDisplayCode(id) {
  return id.replace(/^([A-Z]+)/, "$1 ");
}

/**
 * One Record-tab course row: code/title | audit chip | CU/grade.
 * Catalog attribute/tag overrides live under Advanced (collapsed).
 */

export function CourseRecordRow({
  course,
  programId,
  attribution,
  sectionStyleMap,
  cu,
  rowKey,
  onUpdateCourse,
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef(null);

  const reqRoot = useMemo(() => getProgramRequirement(programId), [programId]);
  const { attributes: attrKeys, tags: tagKeys } = useMemo(
    () => (reqRoot ? collectEditableRequirementFlags(reqRoot) : { attributes: [], tags: [] }),
    [reqRoot]
  );

  const hasEditor = Boolean(programId && (attrKeys.length > 0 || tagKeys.length > 0));

  const cat = courses[course.id];
  const catalogAttrs = useMemo(() => new Set(cat?.attributes || []), [course.id]);
  const catalogTags = useMemo(() => new Set(cat?.tags || []), [course.id]);
  const studentAttrs = new Set(course.attributes || []);
  const studentTags = new Set(course.tags || []);

  const patchField = (field, key, turnOn) => {
    const cur = new Set(course[field] || []);
    if (turnOn) cur.add(key);
    else cur.delete(key);
    onUpdateCourse(course.id, { [field]: [...cur] });
  };

  useEffect(() => {
    if (!editorOpen) return;
    const id = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const input = panel?.querySelector('input[type="checkbox"]:not([disabled])');
      if (input instanceof HTMLElement) input.focus();
      else {
        const btn = panel?.querySelector("button");
        if (btn instanceof HTMLElement) btn.focus();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [editorOpen]);

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

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1 sm:basis-0">
            <span className="font-mono text-sm font-semibold text-slate-900">
              {course.id.replace(/^([A-Z]+)/, "$1 ")}
            </span>
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-600">{title}</p>
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2 sm:basis-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:px-2">
            <div
              className="flex min-w-0 flex-col items-center gap-1 sm:items-center"
              title={
                isExtra
                  ? "Excluded from degree audit — transcript only"
                  : assigned
                    ? `${attribution.section} — ${attribution.leaf}`
                    : "Not tied to a requirement slot in the current audit"
              }
            >
              <span
                className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-center text-[11px] font-semibold leading-tight shadow-sm ${chipClasses}`}
              >
                <span className="truncate">
                  {isExtra ? "Extra transcript" : assigned ? attribution.section : "Unassigned"}
                </span>
              </span>
              {isExtra && (
                <span className="max-w-[14rem] text-center text-[10px] text-muted sm:max-w-[12rem]">
                  Does not count toward degree requirements
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

            {hasEditor && (
              <button
                type="button"
                aria-expanded={editorOpen}
                aria-controls={panelId}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditorOpen((o) => !o);
                }}
                className="inline-flex shrink-0 items-center justify-center self-center rounded-lg border border-dashed border-slate-300 bg-transparent px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-penn/20"
              >
                Advanced: catalog overrides
              </button>
            )}
          </div>

          <div className="num flex shrink-0 flex-col items-end text-xs text-slate-600 sm:min-w-[3.5rem]">
            <span className="font-medium tabular-nums text-slate-800">{cu} CU</span>
            {course.grade && <span className="mt-0.5">{course.grade}</span>}
          </div>
        </div>

        {hasEditor && editorOpen && (
          <div
            ref={panelRef}
            id={panelId}
            role="region"
            aria-label="Advanced catalog overrides for this course"
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-slate-900">
                Advanced: catalog overrides
              </h4>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-penn/30"
              >
                Done
              </button>
            </div>
            <div className="space-y-4">
              {attrKeys.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Attributes
                  </p>
                  <ul className="space-y-1.5">
                    {attrKeys.map((key) => {
                      const fromCatalog = catalogAttrs.has(key);
                      const fromStudent = studentAttrs.has(key);
                      const checked = fromCatalog || fromStudent;
                      const lockOff = fromCatalog && !fromStudent;
                      return (
                        <li key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${rowKey}-attr-${key}`}
                            checked={checked}
                            disabled={lockOff}
                            onChange={(e) => patchField("attributes", key, e.target.checked)}
                            className="rounded border-slate-300 text-penn focus:ring-penn/30"
                          />
                          <label
                            htmlFor={`${rowKey}-attr-${key}`}
                            className="text-xs text-slate-700"
                            title={
                              lockOff
                                ? "From catalog — cannot remove here"
                                : undefined
                            }
                          >
                            {key}
                            {lockOff && (
                              <span className="ml-1 text-[10px] text-muted">(catalog)</span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {tagKeys.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Tags
                  </p>
                  <ul className="space-y-1.5">
                    {tagKeys.map((key) => {
                      const fromCatalog = catalogTags.has(key);
                      const fromStudent = studentTags.has(key);
                      const checked = fromCatalog || fromStudent;
                      const lockOff = fromCatalog && !fromStudent;
                      return (
                        <li key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${rowKey}-tag-${key}`}
                            checked={checked}
                            disabled={lockOff}
                            onChange={(e) => patchField("tags", key, e.target.checked)}
                            className="rounded border-slate-300 text-penn focus:ring-penn/30"
                          />
                          <label
                            htmlFor={`${rowKey}-tag-${key}`}
                            className="text-xs text-slate-700"
                            title={lockOff ? "From catalog" : undefined}
                          >
                            {key}
                            {lockOff && (
                              <span className="ml-1 text-[10px] text-muted">(catalog)</span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
