import type { ScaleLinear } from 'd3';
import type { CurveSample } from '../../types/curves';

interface SingleCurveTimeIndicatorProps {
  currentHour: number;
  samples: CurveSample[];
  height: number;
  xScale: ScaleLinear<number, number>;
  yScale: ScaleLinear<number, number>;
  accentColor: string;
}

function findClosestValue(samples: CurveSample[], hour: number): number {
  if (samples.length === 0) return 0;
  let closest = samples[0];
  let minDist = Math.abs(samples[0].hour - hour);
  for (let i = 1; i < samples.length; i++) {
    const dist = Math.abs(samples[i].hour - hour);
    if (dist < minDist) {
      minDist = dist;
      closest = samples[i];
    }
  }
  return closest.value;
}

export function SingleCurveTimeIndicator({
  currentHour,
  samples,
  height,
  xScale,
  yScale,
  accentColor,
}: SingleCurveTimeIndicatorProps) {
  const x = xScale(currentHour);
  const val = findClosestValue(samples, currentHour);

  return (
    <g className="current-time">
      <line
        x1={x}
        x2={x}
        y1={0}
        y2={height}
        stroke="var(--now-line)"
        strokeWidth={1.5}
        opacity={0.8}
      />
      <text
        x={x}
        y={height + 12}
        textAnchor="middle"
        fill="var(--now-line)"
        fontSize={9}
        fontWeight={600}
      >
        NOW
      </text>
      <circle
        cx={x}
        cy={yScale(val)}
        r={4}
        fill={accentColor}
        stroke="var(--bg-card)"
        strokeWidth={1.5}
      />
    </g>
  );
}
