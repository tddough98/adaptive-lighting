import { useMemo } from 'react';
import { line as d3Line } from 'd3';
import type { ScaleLinear } from 'd3';
import type { CurveSample } from '../../types/curves';

interface CurvePathProps {
  samples: CurveSample[];
  xScale: ScaleLinear<number, number>;
  yScale: ScaleLinear<number, number>;
  color: string;
  dashArray?: string;
}

export function CurvePath({ samples, xScale, yScale, color, dashArray }: CurvePathProps) {
  const pathD = useMemo(() => {
    const generator = d3Line<CurveSample>()
      .x((d) => xScale(d.hour))
      .y((d) => yScale(d.value));
    return generator(samples) ?? '';
  }, [samples, xScale, yScale]);

  return (
    <path
      d={pathD}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeDasharray={dashArray}
    />
  );
}
