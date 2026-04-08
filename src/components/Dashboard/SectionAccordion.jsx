/**
 * SectionAccordion — one requirement area; expand for bar + link to drawer.
 * No warning UI (per product direction).
 */

export function SectionAccordion({
  section,
  expanded,
  onToggle,
  onOpenDrawer,
}) {
  const pct = section.requiredCu > 0 ? Math.min(1, section.completedCu / section.requiredCu) : 0;

  const statusStyle = {
    complete: { label: "Complete", dot: "bg-emerald-500", text: "text-emerald-800" },
    partial: { label: "In progress", dot: "bg-penn", text: "text-penn" },
    unmet: { label: "Not started", dot: "bg-slate-300", text: "text-slate-500" },
  }[section.status];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card transition hover:border-slate-300/90">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${statusStyle.dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900">{section.label}</h3>
          <p className={`mt-0.5 text-xs font-medium ${statusStyle.text}`}>{statusStyle.label}</p>
        </div>
        <div className="num shrink-0 text-sm font-semibold tabular-nums text-slate-700">
          {section.completedCu}/{section.requiredCu}
          <span className="ml-1 text-xs font-normal text-muted">CU</span>
        </div>
        <span
          className={`shrink-0 text-muted transition ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        >
          <Chevron />
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 px-5 pb-5 pt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-penn to-penn-400 transition-all duration-500"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              Detailed leaf requirements and course assignments
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDrawer(section);
              }}
              className="rounded-full bg-penn px-4 py-2 text-xs font-semibold text-white transition hover:bg-penn-500"
            >
              Open breakdown
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="inline">
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
