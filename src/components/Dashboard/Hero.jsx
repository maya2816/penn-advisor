import { ProgressRing } from "./ProgressRing.jsx";
import { isTranscriptStale } from "../../utils/dateUtils.js";

/**
 * Hero.jsx
 *
 * Role: Dashboard header — CU ring, stats from CompletionStatus, and optional
 * transcript-derived profile (name, GPA, earned hours, stale-data hint).
 *
 * Inputs: completion, courseCount, profile (from StudentContext, may be null).
 */

export function Hero({ completion, courseCount, profile }) {
  const sectionCount = completion.root.children?.length ?? 0;
  const sectionsComplete =
    completion.root.children?.filter((c) => c.status === "complete").length ?? 0;
  const warningsCount =
    (completion.warnings?.length || 0) +
    (completion.prereqViolations?.length || 0) +
    (completion.mutexConflicts?.length || 0);

  const stale = profile?.dateIssued && isTranscriptStale(profile.dateIssued, 3);

  return (
    <div className="rounded-2xl border border-border bg-white p-8 shadow-card">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <ProgressRing
          value={completion.totalCuCompleted}
          total={completion.totalCuRequired}
          size={208}
          stroke={16}
          label="Course Units"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-xs uppercase tracking-wider text-muted">
            {completion.programName}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Your degree progress
          </h1>

          {profile && (profile.name || profile.gpa != null) && (
            <div className="mt-4 rounded-xl border border-border bg-slate-50/80 px-4 py-3 text-sm">
              {profile.name && (
                <div className="font-medium text-slate-900">{profile.name}</div>
              )}
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted">
                {profile.pennId && <span className="num">Penn ID {profile.pennId}</span>}
                {profile.gpa != null && (
                  <span className="num">
                    GPA <span className="font-semibold text-slate-800">{profile.gpa.toFixed(2)}</span>
                  </span>
                )}
                {profile.earnedHrs != null && (
                  <span className="num">Earned {profile.earnedHrs} CU</span>
                )}
                {profile.inProgressCu != null && profile.inProgressCu > 0 && (
                  <span className="num text-warning">In progress {profile.inProgressCu} CU</span>
                )}
                {profile.dateIssued && (
                  <span className="num">Transcript {profile.dateIssued}</span>
                )}
              </div>
              {stale && (
                <p className="mt-2 text-xs font-medium text-warning">
                  This transcript may be out of date (issued more than 3 months ago). Consider
                  uploading a fresh copy from Path Penn.
                </p>
              )}
            </div>
          )}

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
