import { useState } from "react";
import { AppShell } from "../components/Layout/AppShell.jsx";
import { DashboardTabBar } from "../components/Dashboard/DashboardTabBar.jsx";
import { DashboardOverview } from "../components/Dashboard/DashboardOverview.jsx";
import { DegreeRequirementsPanel } from "../components/Dashboard/DegreeRequirementsPanel.jsx";
import { SemestersPanel } from "../components/Dashboard/SemestersPanel.jsx";
import { SectionDetail } from "../components/Dashboard/SectionDetail.jsx";
import { useStudent } from "../state/StudentContext.jsx";

/**
 * DashboardPage — tabbed layout: Overview | Degree | Semesters; drawer for section detail.
 */

export function DashboardPage() {
  const {
    completion,
    completedCourses,
    profile,
    planByTerm,
    setPlanByTerm,
  } = useStudent();
  const [tab, setTab] = useState("overview");
  const [openSection, setOpenSection] = useState(null);

  if (!completion) return null;

  return (
    <AppShell>
      <div className="relative min-h-[calc(100vh-4rem)]">
        <div
          className="pointer-events-none absolute inset-0 bg-subtle-radial opacity-70"
          aria-hidden
        />

        <div className="relative grid grid-cols-1 gap-8 xl:grid-cols-[1fr_320px] xl:gap-10">
          <div className="space-y-8 pb-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Dashboard
                </h1>
                <p className="mt-1 text-lg font-medium text-slate-900">Degree planning workspace</p>
              </div>
              <DashboardTabBar active={tab} onChange={setTab} />
            </div>

            {tab === "overview" && (
              <DashboardOverview
                completion={completion}
                courseCount={completedCourses.length}
                profile={profile}
              />
            )}

            {tab === "degree" && (
              <DegreeRequirementsPanel
                completion={completion}
                completedCourses={completedCourses}
                onOpenSection={setOpenSection}
              />
            )}

            {tab === "semesters" && (
              <SemestersPanel
                completedCourses={completedCourses}
                planByTerm={planByTerm}
                setPlanByTerm={setPlanByTerm}
              />
            )}
          </div>

          <aside className="xl:sticky xl:top-24 xl:self-start">
            <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-b from-white to-penn-50/30 p-8 shadow-lift">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-penn text-lg font-bold text-white shadow-md">
                P
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Advisor chat</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                A conversational assistant for course questions and planning will connect here. The
                layout stays fixed so turning it on won&apos;t shift your audit.
              </p>
              <div className="mt-6 rounded-2xl border border-dashed border-penn/20 bg-white/60 px-4 py-6 text-center text-xs font-medium text-muted">
                Coming soon
              </div>
            </div>
          </aside>
        </div>
      </div>

      <SectionDetail section={openSection} onClose={() => setOpenSection(null)} />
    </AppShell>
  );
}
