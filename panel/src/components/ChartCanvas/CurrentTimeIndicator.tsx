import type { ScaleLinear } from 'd3';
import type { CurveSample } from '../../types/curves';

interface CurrentTimeIndicatorProps {
  currentHour: number;
  brightnessSamples: CurveSample[];
  colorTempSamples: CurveSample[];
  height: number;
  xScale: ScaleLinear<number, number>;
  yBrightnessScale: ScaleLinear<number, number>;
  yColorTempScale: ScaleLinear<number, number>;
}

export function CurrentTimeIndicator({
  currentHour,
  brightnessSamples,
  colorTempSamples,
  height,
  xScale,
  yBrightnessScale,
  yColorTempScale,
}: CurrentTimeIndicatorProps) {
  const x = xScale(currentHour);

  // Find the closest sample to get the value at current hour
  const bVal = findClosestValue(brightnessSamples, currentHour);
  const ctVal = findClosestValue(colorTempSamples, currentHour);

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
      {/* Brightness dot */}
      <circle
        cx={x}
        cy={yBrightnessScale(bVal)}
        r={4}
        fill="var(--accent-brightness)"
        stroke="var(--bg-card)"
        strokeWidth={1.5}
      />
      {/* Color temp dot */}
      <circle
        cx={x}
        cy={yColorTempScale(ctVal)}
        r={4}
        fill="var(--accent-colortemp)"
        stroke="var(--bg-card)"
        strokeWidth={1.5}
      />
    </g>
  );
}

function findClosestValue(samples: CurveSample[], hour: number): number {
  // Use the curve math directly for accuracy
  if (samples.length === 0) return 0;
  // Linear search for closest sample
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
