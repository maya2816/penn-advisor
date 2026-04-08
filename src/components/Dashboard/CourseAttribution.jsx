import { useMemo } from "react";
import courses from "../../data/courses.json" with { type: "json" };

/**
 * CourseAttribution — flat list of every course the student entered,
 * showing where the engine assigned it.
 *
 * Read-only for now. The pin/swap interaction (let users override the
 * engine's choice) is a future enhancement; the data layer already
 * supports it via the `pinnedSlot` field on StudentCourse, so adding
 * a dropdown later is purely UI work.
 *
 * Layout: 2-column grid of compact rows. Each row shows the course
 * code (mono), title, and a chip with the section + leaf the course
 * is currently filling — or "Unassigned" in a soft warning tone if
 * the solver couldn't place it.
 */
export function CourseAttribution({ completion, completedCourses }) {
  // Build a map: courseId → { sectionLabel, leafLabel } so each row can
  // show its current attribution in one lookup.
  const attributionMap = useMemo(() => {
    const map = {};
    const visit = (node, sectionLabel) => {
      // Leaves carry satisfiedBy directly. We tag each consumed course
      // with the *top-level section* label (Computing, Math/Sci, AI, …)
      // and the leaf label (Calculus Part I, Machine Learning, …).
      if (node.satisfiedBy?.length) {
        for (const id of node.satisfiedBy) {
          map[id] = { section: sectionLabel, leaf: node.label };
        }
      }
      if (node.children) {
        for (const c of node.children) visit(c, sectionLabel);
      }
    };
    for (const sec of completion.root.children || []) {
      visit(sec, sec.label);
    }
    return map;
  }, [completion]);

  // Sort: assigned courses first (alphabetical by section), then unassigned.
  const rows = useMemo(() => {
    const list = completedCourses.map((sc) => {
      const cat = courses[sc.id];
      const att = attributionMap[sc.id];
      return {
        id: sc.id,
        title: cat?.title ?? sc.id,
        section: att?.section ?? null,
        leaf: att?.leaf ?? null,
      };
    });
    list.sort((a, b) => {
      // Unassigned at the bottom
      if (!a.section && b.section) return 1;
      if (a.section && !b.section) return -1;
      if (a.section !== b.section) return (a.section || "").localeCompare(b.section || "");
      return a.id.localeCompare(b.id);
    });
    return list;
  }, [completedCourses, attributionMap]);

  const unassignedCount = rows.filter((r) => !r.section).length;

  return (
    <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Your courses</h2>
          <p className="mt-0.5 text-xs text-muted">
            <span className="num">{rows.length}</span> on file
            {unassignedCount > 0 && (
              <>
                {" · "}
                <span className="text-warning">
                  <span className="num">{unassignedCount}</span> unassigned
                </span>
              </>
            )}
            {" · "}
            <span className="text-muted">Engine picks the best assignment automatically</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition hover:bg-slate-50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-slate-900">
                  {row.id.replace(/^([A-Z]+)/, "$1 ")}
                </span>
              </div>
              <div className="truncate text-xs text-muted">{row.title}</div>
            </div>
            {row.section ? (
              <div className="shrink-0 text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted">
                  {row.section}
                </div>
                <div className="text-xs font-medium text-penn">{row.leaf}</div>
              </div>
            ) : (
              <span className="shrink-0 rounded-md bg-warning-soft px-2 py-1 text-[10px] font-semibold uppercase text-warning">
                Unassigned
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
