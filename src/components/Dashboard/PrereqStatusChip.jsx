/**
 * PrereqStatusChip — small status pill rendered on planned course tiles
 * to show whether the course's prerequisites are satisfied by what the
 * student has completed plus what's planned in earlier terms.
 *
 * Three states (driven by getPrereqStatus()):
 *   - "satisfied":  green dot + "Prereqs ready"
 *   - "missing":    amber dot + "Needs CIS 1210" (or "Needs N prereqs" if >1)
 *   - "no-prereqs": render nothing (not every course has prereqs and the
 *                   absence shouldn't add visual noise)
 */
export function PrereqStatusChip({ status, missing }) {
  if (status === "no-prereqs") return null;

  if (status === "satisfied") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        Prereqs ready
      </span>
    );
  }

  // status === "missing"
  const list = missing || [];
  const label =
    list.length === 1
      ? `Needs ${list[0].replace(/^([A-Z]+)/, "$1 ")}`
      : `Needs ${list.length} prereqs`;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
      title={list.map((id) => id.replace(/^([A-Z]+)/, "$1 ")).join(", ")}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
      {label}
    </span>
  );
}
