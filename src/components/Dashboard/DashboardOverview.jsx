import { ProgressRing } from "./ProgressRing.jsx";
import { isTranscriptStale } from "../../utils/dateUtils.js";
import {
  estimatedCurrentTermIndex,
  termToIndex,
} from "../../utils/semesterOrder.js";

/**
 * DashboardOverview — glance-first summary: progress, what’s left, optional pace.
 */

export function DashboardOverview({ completion, courseCount, profile }) {
  const sectionCount = completion.root.children?.length ?? 0;
  const sectionsComplete =
    completion.root.children?.filter((c) => c.status === "complete").length ?? 0;
  const sectionsOpen = sectionCount - sectionsComplete;

  const cuDone = completion.totalCuCompleted;
  const cuNeed = completion.totalCuRequired;
  const cuLeft = Math.max(0, cuNeed - cuDone);

  const stale = profile?.dateIssued && isTranscriptStale(profile.dateIssued, 3);

  const paceLine = (() => {
    const target = profile?.targetGraduationTerm;
    if (!target || cuLeft <= 0) return null;
    const end = termToIndex(target);
    const cur = estimatedCurrentTermIndex();
    if (end == null || cur == null || end <= cur) return null;
    const termsLeft = end - cur;
    if (termsLeft <= 0) return null;
    const perTerm = cuLeft / termsLeft;
    return `About ${perTerm.toFixed(1)} CU per remaining term to finish by ${target} (estimate).`;
  })();

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-dashboard-hero bg-subtle-radial shadow-panel">
      <div className="grid gap-10 p-8 lg:grid-cols-[auto_1fr] lg:items-center lg:p-10">
        <div className="flex justify-center lg:justify-start">
          <div className="rounded-full bg-white/60 p-4 shadow-panel backdrop-blur-sm">
            <ProgressRing
              value={cuDone}
              total={cuNeed}
              size={200}
              stroke={14}
              label="Course units"
            />
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-penn/70">
              {completion.programName}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              <span className="num text-slate-900">{cuDone}</span>
              <span className="text-xl font-normal text-slate-500">/{cuNeed}</span>
              <span className="ml-2 text-xl font-normal text-slate-600">
                course units complete
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600">
              You have about{" "}
              <span className="num font-semibold text-slate-800">{cuLeft}</span> CU left across{" "}
              <span className="num font-semibold text-slate-800">{sectionsOpen}</span> open
              requirement{sectionsOpen === 1 ? "" : "s"} (of {sectionCount} areas).
            </p>
            {paceLine && (
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{paceLine}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-8 border-t border-slate-200/60 pt-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Courses on record
              </p>
              <p className="num mt-1 text-2xl font-semibold text-slate-900">{courseCount}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Requirement areas done
              </p>
              <p className="num mt-1 text-2xl font-semibold text-slate-900">
                {sectionsComplete}
                <span className="text-lg font-normal text-slate-400">/{sectionCount}</span>
              </p>
            </div>
            {profile?.targetGraduationTerm && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Target graduation
                </p>
                <p className="mt-1 text-lg font-medium text-slate-800">
                  {profile.targetGraduationTerm}
                </p>
              </div>
            )}
          </div>

          {profile && (profile.name || profile.gpa != null) && (
            <div className="rounded-2xl border border-white/80 bg-white/70 px-5 py-4 shadow-sm backdrop-blur-sm">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
                {profile.name && (
                  <span className="font-semibold text-slate-900">{profile.name}</span>
                )}
                {profile.pennId && (
                  <span className="num text-muted">ID {profile.pennId}</span>
                )}
                {profile.gpa != null && (
                  <span className="num text-muted">
                    GPA <span className="font-semibold text-slate-800">{profile.gpa.toFixed(2)}</span>
                  </span>
                )}
                {profile.earnedHrs != null && (
                  <span className="num text-muted">Earned {profile.earnedHrs} CU</span>
                )}
                {profile.inProgressCu != null && profile.inProgressCu > 0 && (
                  <span className="num text-slate-600">
                    In progress {profile.inProgressCu} CU
                  </span>
                )}
                {profile.dateIssued && (
                  <span className="num text-muted">Transcript {profile.dateIssued}</span>
                )}
              </div>
              {stale && (
                <p className="mt-2 text-xs text-slate-500">
                  Transcript is older than three months — upload a current copy from Path Penn when
                  you can.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
