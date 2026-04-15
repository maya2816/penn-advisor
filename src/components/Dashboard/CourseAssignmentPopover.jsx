import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import courses from "../../data/courses.json" with { type: "json" };
import { getEligibleRequirementLeaves } from "../../utils/eligibleRequirementLeaves.js";
import {
  collectEditableRequirementFlags,
  getProgramRequirement,
} from "../../utils/programRequirementIndex.js";
import { useStudent } from "../../state/StudentContext.jsx";

/**
 * CourseAssignmentPopover — single source of truth for editing how a
 * completed course routes through the degree audit.
 *
 * Replaces the old per-term SemesterAssignmentModal: instead of opening a
 * full modal that lists every course in a semester, the student clicks one
 * course's chip and gets a focused popover that shows ONLY the legal
 * options for THAT course. Far fewer clicks; spatial context is preserved.
 *
 * The popover is anchored to whatever element triggered it (a chip on the
 * Semesters tab, or a course code button inside a leaf list on the Overview
 * tab). It positions itself just below the anchor by default and flips
 * above if it would overflow the viewport. Outside-click and Escape both
 * close without saving; explicit Save commits the patch through
 * StudentContext.
 *
 * Three audit-assignment modes:
 *   - Automatic: engine decides (clears pinnedSlot, sets degreeCredit=degree)
 *   - Pin to a specific eligible leaf: course.pinnedSlot = leafId
 *   - Does not count toward degree: course.degreeCredit = "extra"
 *
 * Plus a collapsed "Catalog overrides" expander folded in from the old
 * Advanced section in CourseRecordRow — lets the student toggle catalog
 * attributes/tags so attribute-based pools (EUNS, EUSS, writing_seminar,
 * etc.) pick the course up.
 */
export function CourseAssignmentPopover({
  course,
  programId,
  anchorRef,
  open,
  onClose,
}) {
  const { setCompletedCourses } = useStudent();
  const popoverRef = useRef(null);
  const headingId = useId();

  // Local draft state — only commits to context on Save.
  const initialMode = useMemo(() => {
    if (course?.degreeCredit === "extra") return "extra";
    if (course?.pinnedSlot) return "pin";
    return "auto";
  }, [course]);
  const [mode, setMode] = useState(initialMode);
  const [pinnedLeafId, setPinnedLeafId] = useState(course?.pinnedSlot ?? "");
  const [draftAttributes, setDraftAttributes] = useState(course?.attributes ?? []);
  const [draftTags, setDraftTags] = useState(course?.tags ?? []);

  // Re-seed when the popover opens for a different course / re-opens after a save.
  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setPinnedLeafId(course?.pinnedSlot ?? "");
    setDraftAttributes(course?.attributes ?? []);
    setDraftTags(course?.tags ?? []);
  }, [open, course, initialMode]);

  // Eligible leaves come from the engine's own pool-matching logic, so we
  // never present an option the engine would reject.
  const eligible = useMemo(() => {
    if (!course || !programId) return [];
    return getEligibleRequirementLeaves(course, programId);
  }, [course, programId]);

  const eligibleBySection = useMemo(() => {
    const m = new Map();
    for (const o of eligible) {
      if (!m.has(o.sectionLabel)) m.set(o.sectionLabel, []);
      m.get(o.sectionLabel).push(o);
    }
    return [...m.entries()];
  }, [eligible]);

  // Default the pin dropdown to the first eligible leaf when the user
  // switches into "pin" mode for the first time and hasn't picked one yet.
  useEffect(() => {
    if (mode === "pin" && !pinnedLeafId && eligible.length > 0) {
      setPinnedLeafId(eligible[0].leafId);
    }
  }, [mode, pinnedLeafId, eligible]);

  // Catalog override flags — the program-tree decides which keys make sense
  // to expose; the catalog itself "locks on" any flag the course already has.
  const reqRoot = useMemo(() => getProgramRequirement(programId), [programId]);
  const editableFlags = useMemo(
    () => (reqRoot ? collectEditableRequirementFlags(reqRoot) : { attributes: [], tags: [] }),
    [reqRoot]
  );
  const cat = course ? courses[course.id] : null;
  const catalogAttrs = useMemo(() => new Set(cat?.attributes || []), [cat]);
  const catalogTags = useMemo(() => new Set(cat?.tags || []), [cat]);

  // Toggle helpers (operate on the LOCAL draft, only persisted on Save).
  const toggleAttribute = (key, on) => {
    setDraftAttributes((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return [...next];
    });
  };
  const toggleTag = (key, on) => {
    setDraftTags((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return [...next];
    });
  };

  // Outside-click + Escape close.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      const pop = popoverRef.current;
      const anchor = anchorRef?.current;
      if (!pop) return;
      if (pop.contains(e.target)) return;
      if (anchor && anchor.contains(e.target)) return;
      onClose();
    };
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    // Use mousedown so the popover closes BEFORE a follow-up click reaches
    // some other element underneath. Capture so we run before React's
    // synthetic event delegation.
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose, anchorRef]);

  // Position relative to the anchor. We use a fixed-position popover so it
  // can escape clipping containers (the term card uses overflow-hidden).
  // We measure the anchor on open and on window resize, then flip above
  // if there isn't enough room below.
  const [position, setPosition] = useState({ top: 0, left: 0, placement: "below" });

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef?.current;
    const pop = popoverRef.current;
    if (!anchor || !pop) return;

    const compute = () => {
      const a = anchor.getBoundingClientRect();
      const popH = pop.offsetHeight;
      const popW = pop.offsetWidth;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const margin = 8;

      const spaceBelow = vh - a.bottom;
      const spaceAbove = a.top;
      const placement = spaceBelow >= popH + margin || spaceBelow >= spaceAbove ? "below" : "above";

      let top =
        placement === "below" ? a.bottom + margin : Math.max(margin, a.top - popH - margin);
      let left = a.left;
      if (left + popW + margin > vw) left = Math.max(margin, vw - popW - margin);
      if (left < margin) left = margin;

      setPosition({ top, left, placement });
    };

    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open, anchorRef]);

  if (!open || !course) return null;

  const handleSave = () => {
    const patch = {
      pinnedSlot: mode === "pin" && pinnedLeafId ? pinnedLeafId : null,
      degreeCredit: mode === "extra" ? "extra" : "degree",
      attributes: draftAttributes,
      tags: draftTags,
    };
    setCompletedCourses((prev) =>
      prev.map((c) => (c.id === course.id ? { ...c, ...patch } : c))
    );
    onClose();
  };

  const title = cat?.title || course.id;
  const cu = course.cu ?? cat?.cu ?? 1;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      className="fixed z-50 w-[340px] rounded-2xl border border-slate-200 bg-white shadow-lift"
      style={{ top: position.top, left: position.left }}
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id={headingId} className="font-mono text-sm font-semibold text-slate-900">
            {course.id.replace(/^([A-Z]+)/, "$1 ")}
          </h3>
          <span className="num text-[11px] text-muted">
            {cu} CU{course.grade ? ` · ${course.grade}` : ""}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-600">{title}</p>
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
        <fieldset className="space-y-2.5">
          <legend className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
            How this counts in the audit
          </legend>

          <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-50">
            <input
              type="radio"
              name={`assign-${course.id}`}
              checked={mode === "auto"}
              onChange={() => setMode("auto")}
              className="mt-0.5 text-penn focus:ring-penn/30"
            />
            <span>
              <span className="font-medium text-slate-900">Automatic</span>
              <span className="ml-1.5 text-xs text-slate-500">— let the engine pick the best slot</span>
            </span>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-50 ${
              eligible.length === 0 ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            <input
              type="radio"
              name={`assign-${course.id}`}
              checked={mode === "pin"}
              disabled={eligible.length === 0}
              onChange={() => setMode("pin")}
              className="mt-0.5 text-penn focus:ring-penn/30"
            />
            <span className="flex-1">
              <span className="font-medium text-slate-900">Count toward a specific requirement</span>
              {eligible.length === 0 && (
                <span className="mt-1 block text-xs text-amber-700">
                  No requirement slot in this program matches this course.
                </span>
              )}
              {mode === "pin" && eligible.length > 0 && (
                <select
                  value={pinnedLeafId}
                  onChange={(e) => setPinnedLeafId(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                >
                  {eligibleBySection.map(([sectionLabel, opts]) => (
                    <optgroup key={sectionLabel} label={sectionLabel}>
                      {opts.map((o) => (
                        <option key={o.leafId} value={o.leafId}>
                          {o.leafLabel}
                          {o.bracketHint ? ` ${o.bracketHint}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-50">
            <input
              type="radio"
              name={`assign-${course.id}`}
              checked={mode === "extra"}
              onChange={() => setMode("extra")}
              className="mt-0.5 text-penn focus:ring-penn/30"
            />
            <span>
              <span className="font-medium text-slate-900">Does not count toward degree</span>
              <span className="ml-1.5 text-xs text-slate-500">— transcript only, no audit slot</span>
            </span>
          </label>
        </fieldset>

        {(editableFlags.attributes.length > 0 || editableFlags.tags.length > 0) && (
          <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 open:pb-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700 marker:text-slate-400">
              Catalog overrides (advanced)
            </summary>
            <p className="mt-2 text-[11px] text-muted">
              Add attributes/tags so attribute-based pools (e.g. EUNS, writing seminar) pick this course up.
              Catalog-sourced flags are locked on.
            </p>

            {editableFlags.attributes.length > 0 && (
              <div className="mt-2.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Attributes
                </p>
                <ul className="space-y-1">
                  {editableFlags.attributes.map((key) => {
                    const fromCatalog = catalogAttrs.has(key);
                    const fromStudent = draftAttributes.includes(key);
                    const checked = fromCatalog || fromStudent;
                    const lockOff = fromCatalog && !fromStudent;
                    return (
                      <li key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={lockOff}
                          onChange={(e) => toggleAttribute(key, e.target.checked)}
                          className="rounded border-slate-300 text-penn focus:ring-penn/30"
                        />
                        <span className="text-[11px] text-slate-700">
                          {key}
                          {lockOff && <span className="ml-1 text-[10px] text-muted">(catalog)</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {editableFlags.tags.length > 0 && (
              <div className="mt-2.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Tags
                </p>
                <ul className="space-y-1">
                  {editableFlags.tags.map((key) => {
                    const fromCatalog = catalogTags.has(key);
                    const fromStudent = draftTags.includes(key);
                    const checked = fromCatalog || fromStudent;
                    const lockOff = fromCatalog && !fromStudent;
                    return (
                      <li key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={lockOff}
                          onChange={(e) => toggleTag(key, e.target.checked)}
                          className="rounded border-slate-300 text-penn focus:ring-penn/30"
                        />
                        <span className="text-[11px] text-slate-700">
                          {key}
                          {lockOff && <span className="ml-1 text-[10px] text-muted">(catalog)</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </details>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={mode === "pin" && !pinnedLeafId}
          className="rounded-full bg-penn px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-penn-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
