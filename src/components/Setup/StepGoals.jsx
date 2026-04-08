/**
 * StepGoals.jsx
 *
 * Role: Optional wizard step — career interests (≤3) and target graduation
 * term for future chat personalization.
 *
 * Inputs: controlled `careerInterests`, `targetGraduationTerm`, `onChange(patch)`.
 * Output: Next/Back navigation; parent merges patch into draft profile.
 */

const OPTIONS = [
  "AI Research",
  "Software Engineering",
  "Quant Finance",
  "Robotics",
  "Product",
  "Healthcare AI",
  "Startup founder",
  "Grad school",
  "Not sure yet",
];

/** @param {{ careerInterests: string[], targetGraduationTerm: string | null, onChange: (p: object) => void, onBack: () => void, onNext: () => void }} props */
export function StepGoals({
  careerInterests,
  targetGraduationTerm,
  onChange,
  onBack,
  onNext,
}) {
  const selected = new Set(careerInterests || []);

  const toggle = (label) => {
    const next = new Set(selected);
    if (next.has(label)) next.delete(label);
    else if (next.size < 3) next.add(label);
    onChange({ careerInterests: [...next] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Goals (optional)
        </h2>
        <p className="mt-2 text-sm text-muted">
          Helps the advisor tailor suggestions. Pick up to three interests, or skip.
        </p>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Career interests
        </div>
        <div className="flex flex-wrap gap-2">
          {OPTIONS.map((opt) => {
            const on = selected.has(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  on
                    ? "border-penn bg-penn text-white"
                    : "border-border bg-white text-slate-700 hover:border-penn-200"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
          Target graduation
        </label>
        <select
          value={targetGraduationTerm || ""}
          onChange={(e) =>
            onChange({
              targetGraduationTerm: e.target.value || null,
            })
          }
          className="w-full max-w-md rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option value="">Prefer not to say</option>
          {GRAD_TERM_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg px-4 py-2 text-sm text-muted transition hover:bg-slate-100 hover:text-slate-900"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-penn px-6 py-2.5 text-sm font-medium text-white transition hover:bg-penn-500"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/** Next several Spring/Fall pairs from the current calendar year */
function buildGradTerms() {
  const y = new Date().getFullYear();
  const terms = [];
  for (let i = 0; i < 8; i++) {
    const yy = y + Math.floor(i / 2);
    const term = i % 2 === 0 ? "Spring" : "Fall";
    terms.push(`${term} ${yy}`);
  }
  return terms;
}

const GRAD_TERM_OPTIONS = buildGradTerms();
