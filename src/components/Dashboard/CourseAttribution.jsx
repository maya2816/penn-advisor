import { useMemo } from "react";
import courses from "../../data/courses.json" with { type: "json" };

/**
 * CourseAttribution — how each saved course maps into the requirement tree.
 * Unassigned rows use neutral styling (not warning tones).
 */

export function CourseAttribution({ completion, completedCourses }) {
  const attributionMap = useMemo(() => {
    const map = {};
    const visit = (node, sectionLabel) => {
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
      if (!a.section && b.section) return 1;
      if (a.section && !b.section) return -1;
      if (a.section !== b.section) return (a.section || "").localeCompare(b.section || "");
      return a.id.localeCompare(b.id);
    });
    return list;
  }, [completedCourses, attributionMap]);

  const unassignedCount = rows.filter((r) => !r.section).length;

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-panel">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Course map</h2>
        <p className="mt-1 text-sm text-slate-600">
          <span className="num font-medium text-slate-800">{rows.length}</span> courses on file
          {unassignedCount > 0 && (
            <>
              {" · "}
              <span className="num text-slate-600">
                {unassignedCount} not tied to a requirement slot
              </span>
            </>
          )}
          . The engine assigns each course to the best-matching requirement automatically.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/40 px-4 py-3 transition hover:bg-slate-50/80"
          >
            <div className="min-w-0 flex-1">
              <div className="font-mono text-sm font-semibold text-slate-900">
                {row.id.replace(/^([A-Z]+)/, "$1 ")}
              </div>
              <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-600">
                {row.title}
              </div>
            </div>
            {row.section ? (
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {row.section}
                </div>
                <div className="mt-0.5 text-xs font-medium text-penn">{row.leaf}</div>
              </div>
            ) : (
              <span className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Unassigned
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
