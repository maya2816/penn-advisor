import { useMemo, useState } from "react";
import courses from "../../data/courses.json" with { type: "json" };
import { CourseSearch } from "../Setup/CourseSearch.jsx";
import { GRAD_TERM_OPTIONS } from "../../utils/graduationTerms.js";
import { compareSemesterLabels } from "../../utils/semesterOrder.js";
import { gpaFromCourses } from "../../utils/gradePoints.js";

/**
 * SemestersPanel — transcript record (CU + estimated GPA per term) vs draft planning.
 */

function cuForCourse(c) {
  const t = Number(c.cu);
  if (Number.isFinite(t) && t > 0) return t;
  return courses[c.id]?.cu ?? 1;
}

export function SemestersPanel({ completedCourses, planByTerm, setPlanByTerm }) {
  const [mode, setMode] = useState("record");
  const [newTermLabel, setNewTermLabel] = useState(GRAD_TERM_OPTIONS[0] || "Fall 2026");
  const [planIntoTerm, setPlanIntoTerm] = useState(GRAD_TERM_OPTIONS[0] || "Fall 2026");

  const completedByTerm = useMemo(() => {
    const m = {};
    for (const c of completedCourses) {
      const key = c.semester || "Manually added";
      (m[key] ||= []).push(c);
    }
    return m;
  }, [completedCourses]);

  const allTerms = useMemo(() => {
    const s = new Set([...Object.keys(completedByTerm), ...Object.keys(planByTerm || {})]);
    return [...s].sort(compareSemesterLabels);
  }, [completedByTerm, planByTerm]);

  const completedTermKeys = useMemo(() => {
    return Object.keys(completedByTerm)
      .filter((k) => (completedByTerm[k] || []).length > 0)
      .sort(compareSemesterLabels);
  }, [completedByTerm]);

  const allPlannedIds = useMemo(
    () => new Set(Object.values(planByTerm || {}).flat()),
    [planByTerm]
  );

  const completedIds = useMemo(() => new Set(completedCourses.map((c) => c.id)), [completedCourses]);

  const searchExclude = useMemo(
    () => [...completedIds, ...allPlannedIds],
    [completedIds, allPlannedIds]
  );

  const planTermOptions = useMemo(() => {
    const merged = [...new Set([...GRAD_TERM_OPTIONS, ...allTerms])];
    merged.sort(compareSemesterLabels);
    return merged;
  }, [allTerms]);

  const addEmptyTerm = () => {
    const label = newTermLabel.trim();
    if (!label) return;
    if (planByTerm[label] !== undefined) return;
    setPlanByTerm({ ...planByTerm, [label]: [] });
    setPlanIntoTerm(label);
  };

  const removePlannedTerm = (term) => {
    if (!(term in planByTerm)) return;
    const next = { ...planByTerm };
    delete next[term];
    setPlanByTerm(next);
    if (planIntoTerm === term) setPlanIntoTerm(planTermOptions[0] || "");
  };

  const addPlanned = (term, id) => {
    if (!term || completedIds.has(id)) return;
    const list = planByTerm[term] || [];
    if (list.includes(id)) return;
    setPlanByTerm({ ...planByTerm, [term]: [...list, id] });
  };

  const removePlanned = (term, id) => {
    setPlanByTerm({
      ...planByTerm,
      [term]: (planByTerm[term] || []).filter((x) => x !== id),
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Semesters</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
          <span className="font-medium text-slate-800">Record</span> summarizes completed work from
          your saved transcript (CU and an estimated term GPA from letter grades).{" "}
          <span className="font-medium text-slate-800">Plan</span> is a draft schedule only — it does
          not change the degree audit until courses are completed and recorded.
        </p>
      </div>

      <div className="inline-flex rounded-full border border-slate-200/80 bg-white/90 p-1 shadow-panel backdrop-blur-sm">
        {[
          { id: "record", label: "Record" },
          { id: "plan", label: "Plan" },
        ].map((t) => {
          const on = mode === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setMode(t.id)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                on
                  ? "bg-penn text-white shadow-sm"
                  : "text-muted hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {mode === "record" && (
        <div className="space-y-4">
          {completedTermKeys.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-muted">
              No completed terms on file yet. Finish setup with a transcript, or use Plan to sketch
              future terms.
            </p>
          ) : (
            completedTermKeys.map((term) => {
              const list = completedByTerm[term] || [];
              const termCu = list.reduce((s, c) => s + cuForCourse(c), 0);
              const gpa = gpaFromCourses(list, cuForCourse);
              return (
                <article
                  key={term}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card"
                >
                  <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/80 px-6 py-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{term}</h3>
                      <p className="num mt-1 text-xs text-muted">
                        <span className="font-semibold text-slate-800">{termCu}</span> CU
                        {gpa != null && (
                          <>
                            {" · "}
                            Est. GPA{" "}
                            <span className="font-semibold text-slate-800">{gpa.toFixed(2)}</span>
                          </>
                        )}
                        {gpa == null && (
                          <span className="text-slate-400"> · No letter grades for GPA estimate</span>
                        )}
                      </p>
                    </div>
                  </header>
                  <ul className="space-y-2 px-6 py-5">
                    {list.map((c) => (
                      <li
                        key={`${c.id}-${c.semester || ""}`}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-mono text-sm font-semibold text-slate-900">
                              {c.id.replace(/^([A-Z]+)/, "$1 ")}
                            </span>
                            <p className="mt-0.5 truncate text-xs text-slate-600">
                              {courses[c.id]?.title || ""}
                            </p>
                          </div>
                          <div className="num shrink-0 text-right text-xs text-slate-500">
                            <div className="font-medium tabular-nums text-slate-700">
                              {cuForCourse(c)} CU
                            </div>
                            {c.grade && <div className="mt-0.5">{c.grade}</div>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })
          )}
        </div>
      )}

      {mode === "plan" && (
        <>
          <div className="grid gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-panel lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                Track a new term (empty plan)
              </label>
              <div className="flex flex-wrap gap-2">
                <select
                  value={newTermLabel}
                  onChange={(e) => setNewTermLabel(e.target.value)}
                  className="min-w-[160px] flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm"
                >
                  {GRAD_TERM_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addEmptyTerm}
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Add term
                </button>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                Add planned course to term
              </label>
              <div className="flex flex-wrap gap-2">
                <select
                  value={planIntoTerm}
                  onChange={(e) => setPlanIntoTerm(e.target.value)}
                  className="min-w-[160px] flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm"
                >
                  {planTermOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/30 p-3">
                <CourseSearch existing={searchExclude} onAdd={(id) => addPlanned(planIntoTerm, id)} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {allTerms.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-muted">
                No terms yet. Add a term above to start planning.
              </p>
            ) : (
              allTerms.map((term) => (
                <article
                  key={term}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card"
                >
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/80 px-6 py-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{term}</h3>
                      <p className="num mt-0.5 text-xs text-muted">
                        {(completedByTerm[term] || []).length} completed
                        {(planByTerm[term] || []).length > 0 && (
                          <>
                            {" · "}
                            <span className="font-medium text-penn">
                              {(planByTerm[term] || []).length} planned
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    {term in planByTerm && (
                      <button
                        type="button"
                        onClick={() => removePlannedTerm(term)}
                        className="text-xs font-medium text-slate-500 transition hover:text-slate-900"
                      >
                        Clear planned courses
                      </button>
                    )}
                  </header>

                  <div className="grid gap-6 px-6 py-5 lg:grid-cols-2">
                    <div>
                      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        Completed
                      </h4>
                      {(completedByTerm[term] || []).length === 0 ? (
                        <p className="text-sm text-slate-500">None for this term.</p>
                      ) : (
                        <ul className="space-y-2">
                          {(completedByTerm[term] || []).map((c) => (
                            <li
                              key={c.id}
                              className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="font-mono text-sm font-semibold text-slate-900">
                                    {c.id.replace(/^([A-Z]+)/, "$1 ")}
                                  </span>
                                  <p className="mt-0.5 truncate text-xs text-slate-600">
                                    {courses[c.id]?.title || ""}
                                  </p>
                                </div>
                                {c.grade && (
                                  <span className="num shrink-0 text-xs font-medium text-slate-500">
                                    {c.grade}
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        Planned
                      </h4>
                      {(planByTerm[term] || []).length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No draft courses. Pick this term on the right and search above to add one.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {(planByTerm[term] || []).map((id) => (
                            <li
                              key={id}
                              className="rounded-xl border border-dashed border-penn/30 bg-penn-50/40 px-4 py-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="inline-block rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-penn">
                                    Planned
                                  </span>
                                  <div className="mt-1 font-mono text-sm font-semibold text-penn">
                                    {id.replace(/^([A-Z]+)/, "$1 ")}
                                  </div>
                                  <p className="mt-0.5 truncate text-xs text-slate-600">
                                    {courses[id]?.title || ""}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removePlanned(term, id)}
                                  className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white/80 hover:text-slate-800"
                                  aria-label={`Remove planned ${id}`}
                                >
                                  ×
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
