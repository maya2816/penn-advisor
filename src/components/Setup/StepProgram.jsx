import programs from "../../data/programs.json" with { type: "json" };
import { GRAD_TERM_OPTIONS } from "../../utils/graduationTerms.js";

/**
 * StepProgram.jsx
 *
 * Role: Pick primary degree program + optional target graduation term.
 * (Graduation lives here so path length and chat context are anchored early.)
 *
 * Inputs: value (programId), targetGraduationTerm, onPick, onTargetGraduationChange, onNext.
 */

export function StepProgram({
  value,
  onPick,
  targetGraduationTerm,
  onTargetGraduationChange,
  onNext,
}) {
  const entries = Object.values(programs);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Pick your program
        </h2>
        <p className="mt-2 text-sm text-muted">
          More programs are coming. For now, we model SEAS BSE Artificial Intelligence.
        </p>
      </div>

      <div className="grid gap-3">
        {entries.map((p) => {
          const selected = p.program_id === value;
          return (
            <button
              key={p.program_id}
              type="button"
              onClick={() => onPick(p.program_id)}
              className={`flex items-center justify-between rounded-xl border-2 px-5 py-4 text-left transition ${
                selected
                  ? "border-penn bg-penn-50 shadow-card"
                  : "border-border bg-white hover:border-penn-200 hover:bg-slate-50"
              }`}
            >
              <div>
                <div className="text-base font-semibold text-slate-900">{p.name}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {p.school} · Catalog {p.catalog_year} ·{" "}
                  <span className="num">{p.total_cu} CU</span>
                </div>
              </div>
              <div
                className={`h-5 w-5 rounded-full border-2 ${
                  selected ? "border-penn bg-penn" : "border-slate-300"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
          Target graduation (optional)
        </label>
        <select
          value={targetGraduationTerm || ""}
          onChange={(e) => onTargetGraduationChange(e.target.value || null)}
          className="w-full max-w-md rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option value="">Prefer not to say</option>
          {GRAD_TERM_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted">
          Used for timeline hints later (e.g. how many semesters you have left), not for the degree audit.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!value}
          onClick={onNext}
          className="rounded-lg bg-penn px-6 py-2.5 text-sm font-medium text-white transition hover:bg-penn-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Next
        </button>
      </div>
    </div>
  );
}
