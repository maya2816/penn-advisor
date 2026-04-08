/**
 * SuggestedPrompts.jsx — starter chips (Phase 1–optimized copy).
 */

const PROMPTS = [
  "How many credits do I have left in each requirement?",
  "What should I prioritize next given my remaining requirements?",
  "Help me sketch a multi-semester plan (offerings not guaranteed)",
];

export function SuggestedPrompts({ onPick, disabled }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Try asking</p>
      <ul className="flex flex-col gap-2">
        {PROMPTS.map((label) => (
          <li key={label}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(label)}
              className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-left text-xs font-medium leading-snug text-slate-700 shadow-card transition hover:border-penn/25 hover:bg-penn-50/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
