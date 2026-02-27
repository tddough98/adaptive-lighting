import type { ScaleLinear } from 'd3';
import type { ResolvedCurve } from '../../types/curves';
import { interpolateWithSharpness } from '../../utils/curvemath';

interface SharpnessPointMarkersProps {
  resolved: ResolvedCurve;
  xScale: ScaleLinear<number, number>;
  yScale: ScaleLinear<number, number>;
}

/** Midpoint hour between two times, handling midnight wrap. */
function midpointHour(a: number, b: number): number {
  if (b >= a) return (a + b) / 2;
  // Wraps midnight
  const mid = (a + b + 24) / 2;
  return mid >= 24 ? mid - 24 : mid;
}

export function SharpnessPointMarkers({
  resolved,
  xScale,
  yScale,
}: SharpnessPointMarkersProps) {
  const { p1, p2, p4, p5, eveningSharpness, morningSharpness, minValue, maxValue } = resolved;

  // Evening sharpness point: midpoint of P1→P2 transition
  const eveningMidHour = midpointHour(p1, p2);
  const eveningMidValue = interpolateWithSharpness(
    0.5,
    eveningSharpness,
    maxValue,
    minValue,
  );

  // Morning sharpness point: midpoint of P4→P5 transition
  const morningMidHour = midpointHour(p4, p5);
  const morningMidValue = interpolateWithSharpness(
    0.5,
    morningSharpness,
    minValue,
    maxValue,
  );

  const markers = [
    { hour: eveningMidHour, value: eveningMidValue, label: 'Eve' },
    { hour: morningMidHour, value: morningMidValue, label: 'Morn' },
  ];

  return (
    <g className="sharpness-markers">
      {markers.map((m) => (
        <circle
          key={m.label}
          cx={xScale(m.hour)}
          cy={yScale(m.value)}
          r={4}
          fill="var(--accent-colortemp)"
          stroke="var(--bg-card)"
          strokeWidth={1.5}
        />
      ))}
    </g>
  );
}
