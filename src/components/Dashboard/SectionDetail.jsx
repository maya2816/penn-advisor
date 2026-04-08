import { useEffect } from "react";
import courses from "../../data/courses.json" with { type: "json" };

/**
 * SectionDetail — slide-out drawer that shows the leaves of a section
 * and which courses fill them.
 *
 * Renders nothing if no section is selected. ESC closes. Click the
 * backdrop to dismiss.
 *
 * For sections with children (like Computing or AI), shows each leaf
 * with its label, X/Y CU, satisfied-by course chips, and missing-CU
 * line if it's not complete.
 */
export function SectionDetail({ section, onClose }) {
  // ESC to close.
  useEffect(() => {
    if (!section) return;
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [section, onClose]);

  if (!section) return null;

  // For attribute-pool sections (like Tech Electives) the section IS the
  // leaf. For multi-leaf sections (Computing, Math/Sci, AI, etc.), iterate
  // children. We treat both uniformly by falling back to a single-element
  // array.
  const leaves = section.children?.length > 0 ? section.children : [section];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px]"
      />
      {/* Drawer */}
      <aside
        className="fixed right-0 top-0 z-50 h-full w-[min(100%,480px)] overflow-y-auto border-l border-slate-200/80 bg-white shadow-lift"
        style={{ animation: "slideIn 240ms ease-out" }}
      >
        <div className="sticky top-0 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/50 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{section.label}</h2>
              <div className="mt-1 num text-sm text-muted">
                {section.completedCu} / {section.requiredCu} CU
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-muted transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          {leaves.map((leaf) => {
            const isComplete = leaf.status === "complete";
            const missing = Math.max(0, leaf.requiredCu - leaf.completedCu);
            return (
              <div
                key={leaf.id}
                className="rounded-xl border border-border bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium text-slate-900">{leaf.label}</div>
                  <div className="num text-xs text-muted">
                    {leaf.completedCu} / {leaf.requiredCu} CU
                  </div>
                </div>

                {leaf.satisfiedBy?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {leaf.satisfiedBy.map((id) => {
                      const c = courses[id];
                      return (
                        <span
                          key={id}
                          title={c?.title || id}
                          className="rounded-lg bg-penn-50 px-2 py-1 font-mono text-[11px] font-medium text-penn"
                        >
                          {id.replace(/^([A-Z]+)/, "$1 ")}
                        </span>
                      );
                    })}
                  </div>
                )}

                {!isComplete && missing > 0 && (
                  <div className="mt-3 text-xs text-muted">
                    Need <span className="num font-semibold text-slate-700">{missing}</span> more CU
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
