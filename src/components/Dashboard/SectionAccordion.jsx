/**
 * SectionAccordion — one requirement area; expand for progress bar + inline leaf breakdown.
 */

import { useMemo } from "react";
import courses from "../../data/courses.json" with { type: "json" };

function formatCourseCode(id) {
  return id.replace(/^([A-Z]+)/, "$1 ");
}

function resolveCu(id, byId) {
  const sc = byId[id];
  const cat = courses[id];
  if (sc != null) {
    const t = Number(sc.cu);
    if (Number.isFinite(t) && t > 0) return t;
  }
  return cat?.cu ?? 1;
}

function resolveTitle(id) {
  return courses[id]?.title ?? id;
}

const sectionShell = {
  complete: "border-emerald-200/80 bg-emerald-50/25",
  partial: "border-penn/15 bg-penn-50/40",
  unmet: "border-slate-200/80 bg-slate-50/30",
};

const headerShell = {
  complete: "bg-emerald-50/40",
  partial: "bg-penn-50/30",
  unmet: "bg-slate-50/40",
};

const leafAccent = {
  complete: "border-l-emerald-500/70",
  partial: "border-l-penn/80",
  unmet: "border-l-amber-500/70",
};

export function SectionAccordion({ section, expanded, onToggle, completedCourses }) {
  const pct = section.requiredCu > 0 ? Math.min(1, section.completedCu / section.requiredCu) : 0;
  const sectionMissing = Math.max(0, section.requiredCu - section.completedCu);

  const byId = useMemo(
    () => Object.fromEntries((completedCourses || []).map((c) => [c.id, c])),
    [completedCourses]
  );

  const leaves = section.children?.length > 0 ? section.children : [section];

  const statusStyle = {
    complete: { label: "Complete", dot: "bg-emerald-500", text: "text-emerald-800" },
    partial: { label: "In progress", dot: "bg-penn", text: "text-penn" },
    unmet: { label: "Not started", dot: "bg-slate-300", text: "text-slate-500" },
  }[section.status];

  const shell = sectionShell[section.status];
  const headBg = expanded ? headerShell[section.status] : "";

  return (
    <div
      className={`overflow-hidden rounded-2xl border shadow-card transition hover:border-slate-300/90 ${shell}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-4 px-5 py-4 text-left transition ${headBg}`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${statusStyle.dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900">{section.label}</h3>
          <p className={`mt-0.5 text-xs font-medium ${statusStyle.text}`}>{statusStyle.label}</p>
        </div>
        <div className="num shrink-0 text-right text-sm font-semibold tabular-nums text-slate-700">
          <div>
            {section.completedCu}/{section.requiredCu}
            <span className="ml-1 text-xs font-normal text-muted">CU</span>
          </div>
          {sectionMissing > 0 && (
            <div className="mt-0.5 text-xs font-normal text-muted">
              <span className="num text-slate-600">{sectionMissing}</span> CU left
            </div>
          )}
        </div>
        <span
          className={`shrink-0 text-muted transition ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        >
          <Chevron />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100/80 px-5 pb-4 pt-3">
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-penn to-penn-400 transition-all duration-500"
              style={{ width: `${pct * 100}%` }}
            />
          </div>

          <div className="divide-y divide-slate-100">
            {leaves.map((leaf) => {
              const isComplete = leaf.status === "complete";
              const missing = Math.max(0, leaf.requiredCu - leaf.completedCu);
              const ids = leaf.satisfiedBy || [];
              const accent = leafAccent[leaf.status] || leafAccent.unmet;
              return (
                <div key={leaf.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm font-medium text-slate-900">{leaf.label}</span>
                    <span className="num text-xs text-muted">
                      {leaf.completedCu}/{leaf.requiredCu} CU
                      {!isComplete && missing > 0 && (
                        <>
                          {" "}
                          ·{" "}
                          <span className="font-semibold text-slate-700">{missing}</span> missing
                        </>
                      )}
                    </span>
                  </div>

                  {ids.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {ids.map((id) => (
                        <li
                          key={id}
                          className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-l-2 pl-2.5 py-1.5 ${accent} rounded-r-md hover:bg-white/60`}
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-semibold text-penn">
                              {formatCourseCode(id)}
                            </span>
                            <p className="mt-0.5 text-xs leading-snug text-slate-600">
                              {resolveTitle(id)}
                            </p>
                          </div>
                          <span className="num shrink-0 text-xs font-medium tabular-nums text-slate-600">
                            {resolveCu(id, byId)} CU
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {!isComplete && missing > 0 && ids.length === 0 && (
                    <p className="mt-2 text-xs text-muted">
                      Need <span className="num font-semibold text-slate-700">{missing}</span> more
                      CU
                    </p>
                  )}
                </div>
              );
            })}
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
