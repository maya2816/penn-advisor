import { useState } from "react";
import { AppShell } from "../components/Layout/AppShell.jsx";
import { DashboardTabBar } from "../components/Dashboard/DashboardTabBar.jsx";
import { DashboardOverview } from "../components/Dashboard/DashboardOverview.jsx";
import { DegreeRequirementsPanel } from "../components/Dashboard/DegreeRequirementsPanel.jsx";
import { SemestersPanel } from "../components/Dashboard/SemestersPanel.jsx";
import { ChatSidebar } from "../components/Chat/ChatSidebar.jsx";
import { ChatProvider } from "../state/ChatContext.jsx";
import { useStudent } from "../state/StudentContext.jsx";

/**
 * DashboardPage — Overview (summary + degree audit) | Semesters.
 */

export function DashboardPage() {
  const {
    completion,
    programId,
    completedCourses,
    profile,
    planByTerm,
    setPlanByTerm,
  } = useStudent();
  const [tab, setTab] = useState("overview");

  if (!completion) return null;

  return (
    <AppShell>
      <ChatProvider>
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
                <div className="space-y-10">
                  <DashboardOverview
                    completion={completion}
                    courseCount={completedCourses.length}
                    profile={profile}
                  />
                  <DegreeRequirementsPanel
                    completion={completion}
                    completedCourses={completedCourses}
                    programId={programId}
                  />
                </div>
              )}

              {tab === "semesters" && (
                <SemestersPanel
                  completion={completion}
                  programId={programId}
                  completedCourses={completedCourses}
                  planByTerm={planByTerm}
                  setPlanByTerm={setPlanByTerm}
                  profile={profile}
                />
              )}
            </div>

            <aside className="xl:sticky xl:top-24 xl:self-start">
              <ChatSidebar />
            </aside>
          </div>
        </div>
      </ChatProvider>
    </AppShell>
  );
}
