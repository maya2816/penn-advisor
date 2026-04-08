/**
 * ProgressRing — pure SVG circular progress indicator.
 *
 * No chart library. ~40 lines of math:
 *   - circle circumference = 2πr
 *   - stroke-dasharray draws the full ring
 *   - stroke-dashoffset reveals only the progress portion
 *   - stroke-linecap=round gives the ends a soft Healthcare-style cap
 *
 * Renders the percent label and a sublabel inside the ring.
 */
export function ProgressRing({
  value,        // current
  total,        // max
  size = 192,   // diameter in px
  stroke = 14,  // stroke width
  label,        // sub-line of text under the percentage
}) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#011F5B"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 600ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="num text-4xl font-bold text-slate-900">
          {value}
          <span className="text-xl text-muted">/{total}</span>
        </div>
        {label && <div className="mt-1 text-xs uppercase tracking-wider text-muted">{label}</div>}
      </div>
    </div>
  );
}
