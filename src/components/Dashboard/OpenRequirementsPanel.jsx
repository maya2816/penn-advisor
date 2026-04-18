import { useMemo } from "react";
import {
  getIncompleteGaps,
  getProgramRequirement,
} from "../../utils/programRequirementIndex.js";

/**
 * OpenRequirementsPanel — compact summary of remaining requirements.
 *
 * Shows a single line with total CU left and a comma-separated list of
 * gap labels. Expands to a grouped breakdown on click. The "Suggest a
 * plan" CTA now lives in RequirementsBank; this component is purely
 * informational.
 */
export function OpenRequirementsPanel({
  completion,
  programId,
}) {
  const programReq = useMemo(() => getProgramRequirement(programId), [programId]);

  const gaps = useMemo(() => {
    if (!completion || !programReq) return [];
    return getIncompleteGaps(completion, programReq);
  }, [completion, programReq]);

  const totalMissingCu = gaps.reduce((s, g) => s + g.missing, 0);

  if (gaps.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 px-4 py-3">
        <p className="text-sm font-medium text-emerald-900">
          All requirement areas satisfied.
        </p>
      </div>
    );
  }

  // Group gaps by section for the expanded view
  const leafToSection = {};
  if (completion?.root?.children) {
    for (const sec of completion.root.children) {
      const visit = (n) => {
        if (n.id) leafToSection[n.id] = sec.label;
        if (n.children) for (const c of n.children) visit(c);
      };
      visit(sec);
    }
  }

  return (
    <details className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm">
        <span>
          <span className="font-semibold text-slate-900">Open requirements:</span>{" "}
          <span className="num font-medium text-slate-700">{totalMissingCu} CU</span>{" "}
          <span className="text-muted">
            — {gaps.map((g) => `${g.label} (${g.missing})`).join(", ")}
          </span>
        </span>
        <span className="ml-2 shrink-0 text-xs text-muted">▾ Details</span>
      </summary>
      <div className="border-t border-slate-100 px-4 py-3">
        <div className="space-y-2">
          {gaps.map((g) => (
            <div key={g.id} className="flex items-baseline justify-between gap-3 text-xs">
              <div>
                <span className="font-medium text-slate-700">{g.label}</span>
                <span className="ml-2 text-muted">{leafToSection[g.id] || ""}</span>
              </div>
              <span className="num shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                {g.missing} CU
              </span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
