import programs from "../../data/programs.json" with { type: "json" };

/**
 * StepProgram — pick which degree program you're in.
 *
 * The MVP only ships SEAS_AI_BSE, but we iterate over `programs.json` so
 * adding more programs in a future phase is zero-touch UI work.
 */
export function StepProgram({ value, onPick, onNext }) {
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
