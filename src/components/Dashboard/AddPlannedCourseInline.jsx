import { useEffect, useMemo, useState } from "react";
import courses from "../../data/courses.json" with { type: "json" };
import { getPrereqStatus } from "../../utils/prereqStatus.js";

/**
 * AddPlannedCourseInline — per-term inline course adder used inside a
 * planned `TimelineTermCard`.
 *
 * Click "+ Add a course" → expands to a search input. As the student
 * types, results are filtered against the catalog and SORTED with
 * prereq-satisfied courses first (a small visual separator divides
 * the two groups). Click a result to add it to that term; the
 * component collapses back to the "+" button afterward.
 *
 * The prereq context is computed by the parent and passed in as
 * `completedSet` and `plannedBefore` so we don't re-walk the timeline
 * here. The parent also supplies `existing` (course IDs already
 * planned anywhere) so we don't show duplicates.
 *
 * Props:
 *   - completedSet:    Set<string>  course IDs the student has done
 *   - plannedBefore:   Set<string>  course IDs planned in earlier terms
 *   - existing:        string[]     course IDs to exclude from results
 *   - onAdd:           (id) => void
 */
const catalog = Object.values(courses);

export function AddPlannedCourseInline({
  completedSet,
  plannedBefore,
  existing,
  onAdd,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 80);
    return () => clearTimeout(t);
  }, [query]);

  const existingSet = useMemo(() => new Set(existing || []), [existing]);

  // Filter + classify by prereq status, then sort: satisfied first,
  // then missing, then alphabetical within each group. Cap at 12.
  const results = useMemo(() => {
    const q = debounced.trim().toUpperCase().replace(/\s+/g, "");
    if (q.length < 2) return { satisfied: [], missing: [] };

    const satisfied = [];
    const missing = [];

    for (const c of catalog) {
      if (existingSet.has(c.id)) continue;
      const idMatch = c.id.includes(q);
      const titleMatch = c.title.toUpperCase().includes(q);
      if (!idMatch && !titleMatch) continue;
      const ps = getPrereqStatus(c.id, { completedSet, plannedBefore });
      if (ps.status === "missing") {
        missing.push({ ...c, prereqStatus: ps });
      } else {
        satisfied.push({ ...c, prereqStatus: ps });
      }
      if (satisfied.length + missing.length >= 24) break; // hard cap before sort
    }

    satisfied.sort((a, b) => a.id.localeCompare(b.id));
    missing.sort((a, b) => a.id.localeCompare(b.id));
    return {
      satisfied: satisfied.slice(0, 12),
      missing: missing.slice(0, 12 - Math.min(satisfied.length, 12)),
    };
  }, [debounced, completedSet, plannedBefore, existingSet]);

  const totalShown = results.satisfied.length + results.missing.length;
  const noResults = debounced.trim().length >= 2 && totalShown === 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-penn hover:bg-penn-50/40 hover:text-penn focus:outline-none focus:ring-2 focus:ring-penn/30"
      >
        <span className="text-base leading-none">+</span> Add a course
      </button>
    );
  }

  const handlePick = (id) => {
    onAdd(id);
    setQuery("");
    setDebounced("");
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by code or title (e.g. CIS 4500, Database)"
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-penn focus:outline-none focus:ring-2 focus:ring-penn/20"
        />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setQuery("");
            setDebounced("");
          }}
          className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>

      {totalShown > 0 && (
        <ul className="max-h-72 space-y-0.5 overflow-auto rounded-lg border border-slate-100">
          {results.satisfied.length > 0 && (
            <>
              <li className="bg-emerald-50/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                Prereqs satisfied
              </li>
              {results.satisfied.map((c) => (
                <ResultRow key={c.id} course={c} onPick={handlePick} />
              ))}
            </>
          )}
          {results.missing.length > 0 && (
            <>
              <li className="bg-amber-50/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                Prereqs not yet planned
              </li>
              {results.missing.map((c) => (
                <ResultRow key={c.id} course={c} onPick={handlePick} />
              ))}
            </>
          )}
        </ul>
      )}

      {noResults && <p className="text-xs text-slate-500">No matching courses.</p>}
    </div>
  );
}

function ResultRow({ course, onPick }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(course.id)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="font-mono text-xs font-semibold text-slate-900">
            {course.id.replace(/^([A-Z]+)/, "$1 ")}
          </div>
          <div className="truncate text-[11px] text-slate-600">{course.title}</div>
        </div>
        <span className="num shrink-0 text-[10px] text-slate-500">{course.cu} CU</span>
      </button>
    </li>
  );
}
