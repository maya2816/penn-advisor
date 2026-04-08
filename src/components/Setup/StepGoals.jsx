/**
 * StepGoals.jsx
 *
 * Role: Optional wizard step — up to three career-interest chips plus optional
 * free-text notes for chat / advising context.
 *
 * Inputs: careerInterests, goalsFreeText, onChange(patch), onBack, onNext.
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

const FREE_TEXT_MAX = 500;

export function StepGoals({ careerInterests, goalsFreeText, onChange, onBack, onNext }) {
  const selected = new Set(careerInterests || []);

  const toggle = (label) => {
    const next = new Set(selected);
    if (next.has(label)) next.delete(label);
    else if (next.size < 3) next.add(label);
    onChange({ careerInterests: [...next] });
  };

  const text = goalsFreeText ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Goals (optional)
        </h2>
        <p className="mt-2 text-sm text-muted">
          Helps the advisor tailor suggestions. Pick up to three interests, add a short note if
          you like, or skip.
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
        <label
          htmlFor="goals-free-text"
          className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
        >
          Anything else? (optional)
        </label>
        <textarea
          id="goals-free-text"
          value={text}
          maxLength={FREE_TEXT_MAX}
          rows={4}
          placeholder="e.g. Interested in a stats minor, prefer morning classes, considering study abroad…"
          onChange={(e) => onChange({ goalsFreeText: e.target.value.slice(0, FREE_TEXT_MAX) })}
          className="w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-muted focus:border-penn focus:outline-none focus:ring-2 focus:ring-penn/20"
        />
        <div className="mt-1 flex justify-end text-xs text-muted">
          <span className="num">
            {text.length} / {FREE_TEXT_MAX}
          </span>
        </div>
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
