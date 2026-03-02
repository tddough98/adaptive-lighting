interface ModeIconProps {
  x: number;
  y: number;
}

/** Small sun icon indicating sun-relative time mode. */
export function SunModeIcon({ x, y }: ModeIconProps) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={2.5} fill="#f5a623" />
      {/* 4 rays */}
      <line x1={0} y1={-4.5} x2={0} y2={-3.5} stroke="#f5a623" strokeWidth={0.8} />
      <line x1={0} y1={3.5} x2={0} y2={4.5} stroke="#f5a623" strokeWidth={0.8} />
      <line x1={-4.5} y1={0} x2={-3.5} y2={0} stroke="#f5a623" strokeWidth={0.8} />
      <line x1={3.5} y1={0} x2={4.5} y2={0} stroke="#f5a623" strokeWidth={0.8} />
    </g>
  );
}

/** Small clock icon indicating absolute time mode. */
export function ClockModeIcon({ x, y }: ModeIconProps) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={3.5} fill="none" stroke="var(--text-secondary)" strokeWidth={0.8} />
      {/* Hour hand */}
      <line x1={0} y1={0} x2={0} y2={-2} stroke="var(--text-secondary)" strokeWidth={0.8} />
      {/* Minute hand */}
      <line x1={0} y1={0} x2={1.5} y2={0} stroke="var(--text-secondary)" strokeWidth={0.6} />
    </g>
  );
}
