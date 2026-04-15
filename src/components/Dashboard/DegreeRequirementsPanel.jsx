import { useState } from "react";
import { SectionAccordion } from "./SectionAccordion.jsx";

/**
 * DegreeRequirementsPanel — accordion list with inline leaf + course breakdown.
 *
 * Receives `programId` so each section can plumb it down to the per-course
 * popover that lets the student re-pin a course's audit slot inline.
 */

export function DegreeRequirementsPanel({ completion, completedCourses, programId }) {
  const sections = completion.root.children || [];
  const [openId, setOpenId] = useState(() => sections[0]?.id ?? null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Requirement areas</h2>
        <p className="mt-1 text-sm text-slate-600">
          Expand a row to see each sub-requirement, assigned courses (code, title, CU), and what is
          still missing. Click any course code to change where it counts.
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((sec) => (
          <SectionAccordion
            key={sec.id}
            section={sec}
            expanded={openId === sec.id}
            onToggle={() => setOpenId((id) => (id === sec.id ? null : sec.id))}
            completedCourses={completedCourses}
            programId={programId}
          />
        ))}
      </div>
    </div>
  );
}
