import { useState } from "react";
import { SectionAccordion } from "./SectionAccordion.jsx";
import { CourseAttribution } from "./CourseAttribution.jsx";

/**
 * DegreeRequirementsPanel — accordion list + course attribution (neutral styling).
 */

export function DegreeRequirementsPanel({ completion, completedCourses, onOpenSection }) {
  const sections = completion.root.children || [];
  const [openId, setOpenId] = useState(() => sections[0]?.id ?? null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Requirement areas</h2>
        <p className="mt-1 text-sm text-slate-600">
          Expand a row for progress, or open the full breakdown for every sub-requirement.
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((sec) => (
          <SectionAccordion
            key={sec.id}
            section={sec}
            expanded={openId === sec.id}
            onToggle={() => setOpenId((id) => (id === sec.id ? null : sec.id))}
            onOpenDrawer={onOpenSection}
          />
        ))}
      </div>

      <CourseAttribution completion={completion} completedCourses={completedCourses} />
    </div>
  );
}
