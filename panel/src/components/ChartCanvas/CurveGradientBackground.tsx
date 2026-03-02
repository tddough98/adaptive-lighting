import { useMemo } from 'react';
import type { ScaleLinear } from 'd3';
import type { CurveSample } from '../../types/curves';

interface CurveGradientBackgroundProps {
  samples: CurveSample[];
  width: number;
  height: number;
  xScale: ScaleLinear<number, number>;
  gradientId: string;
  mapValueToColor: (value: number, hour: number) => string;
  opacity?: number;
}

export function CurveGradientBackground({
  samples,
  width,
  height,
  xScale,
  gradientId,
  mapValueToColor,
  opacity = 1,
}: CurveGradientBackgroundProps) {
  const stops = useMemo(() => {
    if (samples.length === 0) return [];
    const result: { offset: string; color: string }[] = [];
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const pct = (xScale(s.hour) / width) * 100;
      result.push({
        offset: `${pct.toFixed(1)}%`,
        color: mapValueToColor(s.value, s.hour),
      });
    }
    // Ensure last sample is included
    const last = samples[samples.length - 1];
    const lastPct = (xScale(last.hour) / width) * 100;
    if (result.length === 0 || result[result.length - 1].offset !== `${lastPct.toFixed(1)}%`) {
      result.push({
        offset: `${lastPct.toFixed(1)}%`,
        color: mapValueToColor(last.value, last.hour),
      });
    }
    return result;
  }, [samples, xScale, width, mapValueToColor]);

  return (
    <g className="curve-gradient-bg">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {stops.map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={`url(#${gradientId})`}
        opacity={opacity}
        rx={4}
      />
    </g>
  );
}
