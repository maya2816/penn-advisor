/**
 * SectionCard — one of the 6 cards in the section grid.
 *
 * Shows the section label, progress bar, X/Y CU, status pill, and an
 * inline warning chip if any prereq violations or mutex conflicts touch
 * a course in this section. Click to open the SectionDetail drawer.
 *
 * The warning chip count is computed at the page level and passed in,
 * since the engine doesn't (yet) tag warnings with which section they
 * belong to — the page does the bucketing by walking the leaves and
 * checking which courses they consumed.
 */
export function SectionCard({ section, warningCount, onOpen }) {
  const pct = section.requiredCu > 0
    ? Math.min(1, section.completedCu / section.requiredCu)
    : 0;

  const statusToken = {
    complete: { label: "Complete", className: "bg-success-soft text-success" },
    partial:  { label: "In progress", className: "bg-penn-50 text-penn" },
    unmet:    { label: "Not started", className: "bg-slate-100 text-muted" },
  }[section.status];

  return (
    <button
      type="button"
      onClick={() => onOpen(section)}
      className="group flex w-full flex-col rounded-2xl border border-border bg-white p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">{section.label}</h3>
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${statusToken.className}`}
        >
          {statusToken.label}
        </span>
      </div>

      <div className="mt-4 num text-2xl font-bold text-slate-900">
        {section.completedCu}
        <span className="text-base font-normal text-muted">/{section.requiredCu} CU</span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-penn transition-[width] duration-500 ease-out"
          style={{ width: `${pct * 100}%` }}
        />
      </div>

      {/* Inline warnings */}
      <div className="mt-4 flex items-center justify-between text-xs">
        {warningCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-1 font-medium text-warning">
            ⚠ {warningCount} {warningCount === 1 ? "alert" : "alerts"}
          </span>
        ) : (
          <span className="text-muted">No alerts</span>
        )}
        <span className="text-muted opacity-0 transition group-hover:opacity-100">
          View details →
        </span>
      </div>
    </button>
  );
}
