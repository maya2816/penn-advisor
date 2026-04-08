import { ProgressRing } from "./ProgressRing.jsx";

/**
 * Hero — top of the dashboard. Big circular CU progress ring on the left,
 * stat row on the right.
 *
 * The 4 stat cards are derived from the CompletionStatus tree:
 *   - Total CU done
 *   - Sections complete (e.g. "4 of 6")
 *   - Warnings count (prereq violations + mutex conflicts + soft warnings)
 *   - Course count
 */
export function Hero({ completion, courseCount }) {
  const sectionCount = completion.root.children?.length ?? 0;
  const sectionsComplete =
    completion.root.children?.filter((c) => c.status === "complete").length ?? 0;
  const warningsCount =
    (completion.warnings?.length || 0) +
    (completion.prereqViolations?.length || 0) +
    (completion.mutexConflicts?.length || 0);

  return (
    <div className="rounded-2xl border border-border bg-white p-8 shadow-card">
      <div className="flex items-center gap-10">
        <ProgressRing
          value={completion.totalCuCompleted}
          total={completion.totalCuRequired}
          size={208}
          stroke={16}
          label="Course Units"
        />
        <div className="flex-1">
          <div className="mb-1 text-xs uppercase tracking-wider text-muted">
            {completion.programName}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Your degree progress
          </h1>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Stat
              label="Sections complete"
              value={`${sectionsComplete} / ${sectionCount}`}
              tone="default"
            />
            <Stat
              label="Courses on file"
              value={courseCount}
              tone="default"
            />
            <Stat
              label="Warnings"
              value={warningsCount}
              tone={warningsCount > 0 ? "warning" : "success"}
            />
            <Stat
              label="CUs remaining"
              value={Math.max(0, completion.totalCuRequired - completion.totalCuCompleted)}
              tone="default"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const toneClasses =
    tone === "warning"
      ? "bg-warning-soft text-warning"
      : tone === "success"
      ? "bg-success-soft text-success"
      : "bg-slate-50 text-slate-900";
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="num text-2xl font-semibold text-slate-900">{value}</span>
        {tone !== "default" && (
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${toneClasses}`}
          >
            {tone === "warning" ? "Action" : "Clear"}
          </span>
        )}
      </div>
    </div>
  );
}
