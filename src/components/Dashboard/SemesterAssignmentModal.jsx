import { useEffect, useMemo, useState } from "react";
import catalog from "../../data/courses.json" with { type: "json" };
import { getEligibleRequirementLeaves } from "../../utils/eligibleRequirementLeaves.js";

/**
 * Semester-level UI: set degree audit assignment (automatic, pin to eligible leaf, or extra credit).
 *
 * @param {{ open: boolean, term: string, courses: object[], programId: string, onClose: () => void, onApply: (patches: Array<{ pinnedSlot: string|null, degreeCredit: 'degree'|'extra' }>) => void }} props
 */
export function SemesterAssignmentModal({ open, term, courses, programId, onClose, onApply }) {
  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    if (!open || !courses?.length) return;
    setDrafts(
      courses.map((c) =>
        c.degreeCredit === "extra"
          ? { mode: "extra", leafId: "" }
          : c.pinnedSlot
            ? { mode: "pin", leafId: c.pinnedSlot }
            : { mode: "auto", leafId: "" }
      )
    );
  }, [open, courses]);

  const eligibleByIndex = useMemo(() => {
    if (!programId || !courses?.length) return [];
    return courses.map((c) => getEligibleRequirementLeaves(c, programId));
  }, [courses, programId]);

  const canApply = useMemo(() => {
    return drafts.every((d) => d.mode !== "pin" || d.leafId);
  }, [drafts]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !courses?.length) return null;

  const handleApply = () => {
    if (!canApply) return;
    onApply(
      drafts.map((d) => ({
        pinnedSlot: d.mode === "pin" && d.leafId ? d.leafId : null,
        degreeCredit: d.mode === "extra" ? "extra" : "degree",
      }))
    );
    onClose();
  };

  const setDraft = (i, patch) => {
    setDrafts((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift"
        role="dialog"
        aria-modal="true"
        aria-labelledby="semester-assign-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="semester-assign-title" className="text-lg font-semibold text-slate-900">
            Where these count in your degree
          </h2>
          <p className="mt-1 text-sm text-muted">
            <span className="font-medium text-slate-700">{term}</span> — choose how each course is
            used in the audit. Automatic lets the app assign; “Does not count toward degree” keeps
            the course on your transcript only (e.g. extra courses).
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ul className="space-y-6">
            {courses.map((c, i) => {
              const title = catalog[c.id]?.title || "";
              const eligible = eligibleByIndex[i] || [];
              const bySection = new Map();
              for (const o of eligible) {
                if (!bySection.has(o.sectionLabel)) bySection.set(o.sectionLabel, []);
                bySection.get(o.sectionLabel).push(o);
              }

              const d = drafts[i] ?? { mode: "auto", leafId: "" };

              return (
                <li
                  key={`${term}-${c.id}-${i}`}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-sm font-semibold text-slate-900">
                        {c.id.replace(/^([A-Z]+)/, "$1 ")}
                      </span>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{title}</p>
                    </div>
                    <span className="num shrink-0 text-xs text-muted">
                      {c.cu ?? catalog[c.id]?.cu} CU
                      {c.grade ? ` · ${c.grade}` : ""}
                    </span>
                  </div>

                  <fieldset className="mt-3 space-y-2">
                    <legend className="sr-only">Assignment for {c.id}</legend>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`assign-${i}`}
                        checked={d.mode === "auto"}
                        onChange={() => setDraft(i, { mode: "auto", leafId: "" })}
                        className="text-penn focus:ring-penn/30"
                      />
                      Automatic
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`assign-${i}`}
                        checked={d.mode === "pin"}
                        onChange={() =>
                          setDraft(i, {
                            mode: "pin",
                            leafId: d.leafId || eligible[0]?.leafId || "",
                          })
                        }
                        className="text-penn focus:ring-penn/30"
                      />
                      Count toward a specific requirement
                    </label>
                    {d.mode === "pin" && (
                      <div className="ml-6 mt-1">
                        {eligible.length === 0 ? (
                          <p className="text-xs text-amber-800">
                            No requirement slots match this course in the catalog. Try Automatic or
                            Advanced catalog overrides on the course row.
                          </p>
                        ) : (
                          <select
                            value={d.leafId}
                            onChange={(e) => setDraft(i, { leafId: e.target.value })}
                            className="mt-1 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="">Select requirement…</option>
                            {[...bySection.entries()].map(([sectionLabel, opts]) => (
                              <optgroup key={sectionLabel} label={sectionLabel}>
                                {opts.map((o) => (
                                  <option key={o.leafId} value={o.leafId}>
                                    {o.leafLabel}
                                    {o.bracketHint ? ` ${o.bracketHint}` : ""}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`assign-${i}`}
                        checked={d.mode === "extra"}
                        onChange={() => setDraft(i, { mode: "extra", leafId: "" })}
                        className="text-penn focus:ring-penn/30"
                      />
                      Does not count toward degree
                    </label>
                  </fieldset>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canApply}
            onClick={handleApply}
            className="rounded-full bg-penn px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-penn-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save assignments
          </button>
        </div>
      </div>
    </div>
  );
}
