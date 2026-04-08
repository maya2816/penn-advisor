import { useMemo } from "react";
import courses from "../../data/courses.json" with { type: "json" };
import {
  collectEditableRequirementFlags,
  getProgramRequirement,
} from "../../utils/programRequirementIndex.js";

/**
 * Attribution line + per-course attributes/tags editor (merged with catalog in degreeEngine).
 */

function formatCode(id) {
  return id.replace(/^([A-Z]+)/, "$1 ");
}

export function CourseRecordRowMeta({ course, programId, attribution, onUpdateCourse }) {
  const reqRoot = useMemo(() => getProgramRequirement(programId), [programId]);
  const { attributes: attrKeys, tags: tagKeys } = useMemo(
    () => (reqRoot ? collectEditableRequirementFlags(reqRoot) : { attributes: [], tags: [] }),
    [reqRoot]
  );

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

  if (!programId || (!attrKeys.length && !tagKeys.length)) {
    return (
      <div className="mt-2 border-t border-slate-100 pt-2">
        <AttributionLine attribution={attribution} />
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
      <AttributionLine attribution={attribution} />
      <details className="group" onClick={(e) => e.stopPropagation()}>
        <summary className="cursor-pointer list-none text-xs font-semibold text-penn hover:underline [&::-webkit-details-marker]:hidden">
          Edit attributes / tags
        </summary>
        <div
          className="mt-2 space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
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
                        id={`${course.id}-attr-${key}`}
                        checked={checked}
                        disabled={lockOff}
                        onChange={(e) => patchField("attributes", key, e.target.checked)}
                        className="rounded border-slate-300 text-penn focus:ring-penn/30"
                      />
                      <label
                        htmlFor={`${course.id}-attr-${key}`}
                        className="text-xs text-slate-700"
                        title={lockOff ? "From catalog — remove by changing catalog data, not here" : ""}
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
                        id={`${course.id}-tag-${key}`}
                        checked={checked}
                        disabled={lockOff}
                        onChange={(e) => patchField("tags", key, e.target.checked)}
                        className="rounded border-slate-300 text-penn focus:ring-penn/30"
                      />
                      <label
                        htmlFor={`${course.id}-tag-${key}`}
                        className="text-xs text-slate-700"
                        title={lockOff ? "From catalog" : ""}
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
      </details>
    </div>
  );
}

function AttributionLine({ attribution }) {
  if (attribution?.section) {
    return (
      <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] leading-snug text-muted">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          Counts toward
        </span>
        <span className="font-medium text-slate-700">{attribution.section}</span>
        <span aria-hidden>·</span>
        <span className="text-penn">{attribution.leaf}</span>
      </div>
    );
  }
  return (
    <div className="text-[11px] text-muted">
      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
        Unassigned
      </span>
      <span className="ml-2">Not tied to a requirement slot in the current audit.</span>
    </div>
  );
}
