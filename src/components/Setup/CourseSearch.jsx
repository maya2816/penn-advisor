import { useEffect, useMemo, useState } from "react";
import courses from "../../data/courses.json" with { type: "json" };

/**
 * CourseSearch — autocomplete for adding individual courses.
 *
 * Implementation notes:
 * - 6,242 courses is small enough to filter in-memory on every keystroke,
 *   but we still debounce by 80ms to keep the input feeling snappy.
 * - Matches against both course id and title, case-insensitive.
 * - Hides courses that are already in the `existing` set so the student
 *   doesn't accidentally add the same course twice.
 * - Click a result to call `onAdd(courseId)` and clear the input.
 */
export function CourseSearch({ existing, onAdd }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 80);
    return () => clearTimeout(t);
  }, [query]);

  const existingSet = useMemo(() => new Set(existing), [existing]);

  // Pre-flatten the catalog once. We re-do this if `courses` ever changes,
  // which it doesn't at runtime.
  const catalog = useMemo(() => Object.values(courses), []);

  const results = useMemo(() => {
    const q = debounced.trim().toUpperCase().replace(/\s+/g, "");
    if (q.length < 2) return [];
    const out = [];
    for (const c of catalog) {
      if (existingSet.has(c.id)) continue;
      const idMatch = c.id.includes(q);
      const titleMatch = c.title.toUpperCase().includes(q);
      if (idMatch || titleMatch) {
        out.push(c);
        if (out.length >= 12) break; // cap result list for keyboard scanability
      }
    }
    return out;
  }, [debounced, catalog, existingSet]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by course code or title (e.g. CIS 1100, Calculus, Machine Learning)"
        className="w-full rounded-lg border border-border bg-white px-4 py-3 text-sm placeholder:text-muted focus:border-penn focus:outline-none focus:ring-2 focus:ring-penn/20"
      />
      {results.length > 0 && (
        <ul className="max-h-72 overflow-auto rounded-lg border border-border bg-white shadow-card">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onAdd(c.id);
                  setQuery("");
                  setDebounced("");
                }}
                className="flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left text-sm transition hover:bg-slate-50"
              >
                <div>
                  <div className="font-medium text-slate-900">
                    {c.id.replace(/^([A-Z]+)/, "$1 ")}
                  </div>
                  <div className="text-xs text-muted">{c.title}</div>
                </div>
                <span className="num text-xs text-muted">{c.cu} CU</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {debounced.trim().length >= 2 && results.length === 0 && (
        <p className="text-sm text-muted">No matching courses.</p>
      )}
    </div>
  );
}
