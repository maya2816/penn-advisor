import { useMemo, useState } from "react";
import { AppShell } from "../components/Layout/AppShell.jsx";
import { Hero } from "../components/Dashboard/Hero.jsx";
import { SectionCard } from "../components/Dashboard/SectionCard.jsx";
import { SectionDetail } from "../components/Dashboard/SectionDetail.jsx";
import { CourseAttribution } from "../components/Dashboard/CourseAttribution.jsx";
import { useStudent } from "../state/StudentContext.jsx";

/**
 * DashboardPage — composes the Hero + 6-card SectionGrid + SectionDetail
 * drawer + chat sidebar slot. Reads the cached `completion` from
 * StudentContext (no engine work happens at render time).
 *
 * Bucketing warnings to sections:
 *   The engine emits flat `prereqViolations` and `mutexConflicts` arrays
 *   with course IDs but no section label. To show "⚠ 2 alerts" on the
 *   right card, we walk the section tree and check which courses each
 *   section's leaves consumed, then count warnings whose course IDs
 *   match. Computed once via useMemo per completion change.
 */
export function DashboardPage() {
  const { completion, completedCourses } = useStudent();
  const [openSection, setOpenSection] = useState(null);

  // Map from sectionId → set of course IDs consumed by any leaf in that section.
  const courseToSection = useMemo(() => {
    const map = {};
    if (!completion) return map;
    for (const sec of completion.root.children || []) {
      const ids = collectSatisfiedBy(sec);
      for (const id of ids) {
        // A course can technically only end up in one section because of
        // the consumed-set logic in the engine, so first-write-wins is fine.
        map[id] = sec.id;
      }
    }
    return map;
  }, [completion]);

  // Map from sectionId → warning count (prereq violations + mutex conflicts).
  const warningsBySection = useMemo(() => {
    const counts = {};
    if (!completion) return counts;
    for (const v of completion.prereqViolations || []) {
      const secId = courseToSection[v.courseId];
      if (secId) counts[secId] = (counts[secId] || 0) + 1;
    }
    for (const c of completion.mutexConflicts || []) {
      const secIdA = courseToSection[c.courseA];
      const secIdB = courseToSection[c.courseB];
      // Attribute the conflict to whichever section consumed either course;
      // dedupe so the same pair isn't counted twice if both halves end up
      // in the same section.
      const target = secIdA || secIdB;
      if (target) counts[target] = (counts[target] || 0) + 1;
    }
    return counts;
  }, [completion, courseToSection]);

  if (!completion) return null; // RequireSetup should make this unreachable

  return (
    <AppShell>
      <div className="grid grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          <Hero completion={completion} courseCount={completedCourses.length} />

          <div className="grid grid-cols-3 gap-4">
            {completion.root.children?.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                warningCount={warningsBySection[section.id] || 0}
                onOpen={setOpenSection}
              />
            ))}
          </div>

          <CourseAttribution
            completion={completion}
            completedCourses={completedCourses}
          />
        </div>

        <aside className="rounded-2xl border border-border bg-white p-6 shadow-card">
          <h2 className="text-base font-semibold text-slate-900">Penn Advisor</h2>
          <p className="mt-2 text-sm text-muted">
            Chat sidebar arrives in Session B. The slot is reserved here so the layout
            doesn&apos;t shift when it lands.
          </p>
        </aside>
      </div>

      <SectionDetail section={openSection} onClose={() => setOpenSection(null)} />
    </AppShell>
  );
}

/** Recursively collect every satisfiedBy course id under a section. */
function collectSatisfiedBy(node) {
  const out = [];
  const visit = (n) => {
    if (n.satisfiedBy?.length) out.push(...n.satisfiedBy);
    if (n.children) for (const c of n.children) visit(c);
  };
  visit(node);
  return out;
}
