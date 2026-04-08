import courses from "../../data/courses.json" with { type: "json" };

/**
 * StepConfirm — final review before saving and navigating to /dashboard.
 *
 * Shows summary stats (courses, total CU, semesters covered) and the
 * full list grouped by semester for scannability. The student can go
 * back to add or remove. The Confirm button calls `onConfirm()` which
 * the parent wires to: save to context → persist to localStorage →
 * navigate to /dashboard.
 *
 * Input shape: `added` is Array<{ id: string, semester?: string|null }>.
 */
export function StepConfirm({ courses: added, onBack, onConfirm }) {
  // Group by semester. null/missing → "Manually added".
  const bySemester = added.reduce((acc, c) => {
    const key = c.semester || "Manually added";
    (acc[key] ||= []).push(c);
    return acc;
  }, {});

  const totalCu = added.reduce((sum, c) => sum + (courses[c.id]?.cu ?? 1), 0);
  const semesterKeys = Object.keys(bySemester).sort((a, b) => {
    const ka = a === "Manually added" ? Number.POSITIVE_INFINITY : semesterSortKey(a);
    const kb = b === "Manually added" ? Number.POSITIVE_INFINITY : semesterSortKey(b);
    return ka - kb;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Review your courses
        </h2>
        <p className="mt-2 text-sm text-muted">
          One last look. You can edit these any time after setup.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-white p-4 shadow-card">
          <div className="text-xs uppercase tracking-wider text-muted">Courses</div>
          <div className="mt-1 num text-2xl font-semibold text-slate-900">{added.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-card">
          <div className="text-xs uppercase tracking-wider text-muted">Total CU</div>
          <div className="mt-1 num text-2xl font-semibold text-slate-900">{totalCu}</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-card">
          <div className="text-xs uppercase tracking-wider text-muted">Semesters</div>
          <div className="mt-1 num text-2xl font-semibold text-slate-900">
            {semesterKeys.filter((k) => k !== "Manually added").length}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-5 shadow-card">
        <ul className="space-y-4">
          {semesterKeys.map((sem) => (
            <li key={sem}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {sem}
                </span>
                <span className="num text-xs text-muted">({bySemester[sem].length})</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {bySemester[sem]
                  .slice()
                  .sort((a, b) => a.id.localeCompare(b.id))
                  .map(({ id }) => (
                    <span
                      key={id}
                      className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700"
                      title={courses[id]?.title || id}
                    >
                      {id.replace(/^([A-Z]+)/, "$1 ")}
                    </span>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg px-4 py-2 text-sm text-muted transition hover:bg-slate-100 hover:text-slate-900"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-penn px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-penn-500"
        >
          Save and view dashboard
        </button>
      </div>
    </div>
  );
}

/**
 * Sort key matching the one in StepCourses.CourseGroupedList — ordered
 * by year then term (Spring → Summer → Fall).
 */
function semesterSortKey(label) {
  if (!label) return Number.POSITIVE_INFINITY;
  const m = label.match(/^(Fall|Spring|Summer)\s+(\d{4})$/);
  if (!m) return Number.POSITIVE_INFINITY;
  const term = { Spring: 0, Summer: 1, Fall: 2 }[m[1]] ?? 9;
  return parseInt(m[2], 10) * 10 + term;
}
