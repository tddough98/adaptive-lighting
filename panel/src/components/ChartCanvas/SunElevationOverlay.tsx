import { useMemo } from 'react';
import { line as d3Line } from 'd3';
import type { ScaleLinear } from 'd3';
import type { CurveSample } from '../../types/curves';

interface SunElevationOverlayProps {
  samples: CurveSample[];
  xScale: ScaleLinear<number, number>;
  sunYScale: ScaleLinear<number, number>;
  innerWidth: number;
}

export function SunElevationOverlay({
  samples,
  xScale,
  sunYScale,
  innerWidth,
}: SunElevationOverlayProps) {
  const pathD = useMemo(() => {
    const generator = d3Line<CurveSample>()
      .x((d) => xScale(d.hour))
      .y((d) => sunYScale(d.value));
    return generator(samples) ?? '';
  }, [samples, xScale, sunYScale]);

  const horizonY = sunYScale(0);

  return (
    <g className="sun-elevation-overlay">
      <line
        x1={0}
        y1={horizonY}
        x2={innerWidth}
        y2={horizonY}
        stroke="rgba(180, 180, 180, 0.4)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <path
        d={pathD}
        fill="none"
        stroke="white"
        strokeWidth={3.5}
      />
      <path
        d={pathD}
        fill="none"
        stroke="black"
        strokeWidth={1.5}
      />
    </g>
  );
}
