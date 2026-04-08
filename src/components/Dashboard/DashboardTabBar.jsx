/**
 * DashboardTabBar — pill-style primary navigation (desktop).
 */

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "degree", label: "Degree requirements" },
  { id: "semesters", label: "Semesters" },
];

export function DashboardTabBar({ active, onChange }) {
  return (
    <div className="inline-flex rounded-full border border-slate-200/80 bg-white/90 p-1 shadow-panel backdrop-blur-sm">
      {TABS.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
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
  );
}
