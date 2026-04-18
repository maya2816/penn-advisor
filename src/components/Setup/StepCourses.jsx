import { useRef, useState } from "react";
import { CourseSearch } from "./CourseSearch.jsx";
import { parseTranscriptPdf } from "../../utils/transcriptParser.js";
import programs from "../../data/programs.json" with { type: "json" };
import courses from "../../data/courses.json" with { type: "json" };

// Supported programs — used to validate uploaded transcripts.
const SUPPORTED_MAJORS = new Set(
  Object.values(programs).map((p) => p.name?.toLowerCase()?.trim()).filter(Boolean)
);

/**
 * StepCourses — enter your completed courses via one of two inputs.
 *
 * Two tabs (in order):
 *   1. Upload transcript (DEFAULT): drop or pick a Penn transcript PDF →
 *      `parseTranscriptPdf()` returns a rich TranscriptData object with
 *      student identity, totals, and per-course CU/grade/semester. We
 *      bubble the full data up via onChange so the wizard can later
 *      surface name + GPA on the dashboard.
 *   2. Search and add: autocomplete → adds one course at a time
 *      (manual fallback for students who don't have a transcript handy
 *      or who want to add a course Penn hasn't published yet).
 *
 * The "Paste transcript" tab was removed in 2026-04-08 because Penn
 * transcript PDFs are not copy-paste friendly — the column layout
 * scrambles when you select text — so the upload path is the only
 * realistic transcript-based input.
 */
export function StepCourses({ courses: added, onChange, onParsedTranscript, onBack, onNext }) {
  const [tab, setTab] = useState("upload");
  const [parseFeedback, setParseFeedback] = useState(null);
  const [uploadState, setUploadState] = useState({ status: "idle", filename: null, error: null });
  const fileInputRef = useRef(null);

  // `added` is Array<{ id, semester?, cu?, grade?, inProgress?, placeholder? }>.
  const addedIds = new Set(added.map((c) => c.id));

  const handleAddUnknown = (uc) => {
    if (addedIds.has(uc.id)) return;
    onChange([
      ...added,
      { id: uc.id, semester: uc.semester, cu: uc.cu ?? 1, placeholder: true },
    ]);
    setParseFeedback((prev) =>
      prev ? { ...prev, unknown: prev.unknown.filter((u) => u.id !== uc.id) } : prev
    );
  };

  const handleFile = async (file) => {
    if (!file) return;
    setParseFeedback(null);
    setUploadState({ status: "loading", filename: file.name, error: null });
    try {
      const data = await parseTranscriptPdf(file);

      // Split parsed courses into known (in catalog) and unknown.
      // Known courses get auto-added; unknowns get a clickable
      // "add anyway" chip in the feedback callout.
      const known = data.courses.filter((c) => c.inCatalog);
      const unknown = data.courses.filter((c) => !c.inCatalog);

      const newOnes = known
        .filter((c) => !addedIds.has(c.id))
        .map((c) => ({
          id: c.id,
          semester: c.semester,
          cu: c.cu,
          grade: c.grade,
          inProgress: c.inProgress,
        }));

      if (newOnes.length > 0) {
        onChange([...added, ...newOnes]);
      }

      // Validate the transcript's program against supported programs.
      const detectedMajor = data.student?.major?.toLowerCase()?.trim();
      if (detectedMajor && !SUPPORTED_MAJORS.has(detectedMajor)) {
        const supportedList = Object.values(programs).map((p) => p.name).join(", ");
        setParseFeedback({
          added: 0,
          dup: 0,
          unknown: [],
          programWarning: `Penn Advisor currently supports: ${supportedList}. Your transcript shows "${data.student.major}". Courses were still imported, but the degree audit may not match your actual program requirements.`,
          student: data.student,
          totals: data.totals,
        });
      }

      // Bubble the rich transcript data (student name, totals, etc.)
      // up to the wizard so it can stash it in StudentContext.
      if (typeof onParsedTranscript === "function") {
        onParsedTranscript(data);
      }

      setParseFeedback({
        added: newOnes.length,
        dup: known.length - newOnes.length,
        unknown,
        student: data.student,
        totals: data.totals,
      });
      setUploadState({ status: "done", filename: file.name, error: null });
    } catch (err) {
      console.error(err);
      setUploadState({
        status: "error",
        filename: file.name,
        error: err?.message || "Could not read this PDF.",
      });
    }
  };

  const handleAddOne = (id) => {
    if (!addedIds.has(id)) onChange([...added, { id, semester: null }]);
  };

  const handleRemove = (id) => {
    onChange(added.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Add your completed courses
        </h2>
        <p className="mt-2 text-sm text-muted">
          Upload your Penn transcript PDF for the fastest path, or search and add courses one at a time.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border">
        {[
          { key: "upload", label: "Upload transcript" },
          { key: "search", label: "Search and add" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative -mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-penn text-penn"
                : "border-transparent text-muted hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "upload" ? (
        <div className="space-y-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file && file.type === "application/pdf") handleFile(file);
            }}
            className="cursor-pointer rounded-xl border-2 border-dashed border-border bg-slate-50 p-10 text-center transition hover:border-penn hover:bg-penn-50"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-penn text-white">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="text-sm font-medium text-slate-900">
              {uploadState.status === "loading"
                ? "Reading transcript…"
                : uploadState.status === "done"
                ? `Loaded ${uploadState.filename}`
                : "Drop your transcript PDF here, or click to choose"}
            </div>
            <div className="mt-1 text-xs text-muted">
              Penn transcripts from Path Penn work best. Your file never leaves your browser.
            </div>
            {uploadState.status === "error" && (
              <div className="mt-3 inline-block rounded-md bg-danger-soft px-3 py-1 text-xs text-danger">
                {uploadState.error}
              </div>
            )}
          </div>
          <ParseFeedback feedback={parseFeedback} onAddUnknown={handleAddUnknown} />
        </div>
      ) : (
        <CourseSearch existing={added.map((c) => c.id)} onAdd={handleAddOne} />
      )}

      {/* Running list, grouped by semester so the user can sanity-check
          that the parser put each course in the right term. */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Your courses
            <span className="ml-2 num text-xs text-muted">({added.length})</span>
          </h3>
        </div>
        {added.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-slate-50 p-6 text-center text-sm text-muted">
            No courses added yet.
          </p>
        ) : (
          <CourseGroupedList added={added} onRemove={handleRemove} />
        )}
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
          disabled={added.length === 0}
          onClick={onNext}
          className="rounded-lg bg-penn px-6 py-2.5 text-sm font-medium text-white transition hover:bg-penn-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Review
        </button>
      </div>
    </div>
  );
}

/**
 * Renders the post-parse feedback line plus the optional callout box
 * with clickable "Add anyway" chips for unknown courses, and a
 * one-line summary of the parsed student identity.
 */
function ParseFeedback({ feedback, onAddUnknown }) {
  if (!feedback) return null;
  return (
    <div className="space-y-2 text-xs">
      {feedback.programWarning && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Program notice:</span> {feedback.programWarning}
        </div>
      )}
      {feedback.student?.name && (
        <p className="rounded-lg border border-success/30 bg-success-soft/40 px-3 py-2 text-success">
          <span className="font-semibold">Detected:</span> {feedback.student.name}
          {feedback.student.pennId && (
            <span className="ml-2 text-success/80">· Penn ID {feedback.student.pennId}</span>
          )}
          {feedback.totals?.gpa != null && (
            <span className="ml-2 text-success/80">· GPA <span className="num">{feedback.totals.gpa.toFixed(2)}</span></span>
          )}
        </p>
      )}
      <p className="text-muted">
        Added <span className="font-semibold text-success">{feedback.added}</span>
        {feedback.dup > 0 && `, ${feedback.dup} already added`}
        {feedback.unknown.length > 0 && (
          <>
            {", "}
            <span className="text-warning">
              {feedback.unknown.length} not in catalog
            </span>
          </>
        )}
      </p>
      {feedback.unknown.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning-soft/40 p-3">
          <p className="mb-2 text-xs text-warning">
            These courses were detected but aren&apos;t in our catalog yet (often
            brand-new offerings). Click to add anyway as a placeholder:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {feedback.unknown.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onAddUnknown(u)}
                className="rounded-md border border-warning/50 bg-white px-2 py-1 font-mono text-[11px] text-slate-800 transition hover:border-penn hover:bg-penn-50"
              >
                + {u.id.replace(/^([A-Z]+)/, "$1 ")}
                {u.semester && (
                  <span className="ml-1 text-[10px] text-muted">[{u.semester}]</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Sorts a "Fall 2023" / "Spring 2024" / "Summer 2025" string by
 * (year, term-order). Returns a number suitable for Array.sort.
 */
function semesterSortKey(label) {
  if (!label) return Number.POSITIVE_INFINITY; // unsorted goes last
  const m = label.match(/^(Fall|Spring|Summer)\s+(\d{4})$/);
  if (!m) return Number.POSITIVE_INFINITY;
  const term = { Spring: 0, Summer: 1, Fall: 2 }[m[1]] ?? 9;
  return parseInt(m[2], 10) * 10 + term;
}

/**
 * Renders the running list of added courses grouped by semester.
 * Courses without a semester (added via search) are bucketed under
 * "Manually added" at the bottom.
 */
function CourseGroupedList({ added, onRemove }) {
  const groups = {};
  for (const c of added) {
    const key = c.semester || "Manually added";
    (groups[key] ||= []).push(c);
  }
  const groupKeys = Object.keys(groups).sort((a, b) => {
    const ka = a === "Manually added" ? Number.POSITIVE_INFINITY : semesterSortKey(a);
    const kb = b === "Manually added" ? Number.POSITIVE_INFINITY : semesterSortKey(b);
    return ka - kb;
  });

  return (
    <div className="space-y-4">
      {groupKeys.map((key) => (
        <div key={key}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              {key}
            </span>
            <span className="num text-xs text-muted">({groups[key].length})</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {groups[key].map((c) => {
              const cat = courses[c.id];
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {c.id.replace(/^([A-Z]+)/, "$1 ")}
                      </span>
                      {c.grade && (
                        <span className={`num text-[10px] font-semibold uppercase tracking-wider ${
                          c.inProgress ? "text-warning" : "text-muted"
                        }`}>
                          {c.inProgress ? "In progress" : c.grade}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted">{cat?.title || c.id}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(c.id)}
                    className="ml-2 rounded p-1 text-muted transition hover:bg-danger-soft hover:text-danger"
                    aria-label={`Remove ${c.id}`}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
