import { useMemo } from 'react';
import type { ScaleLinear } from 'd3';

interface YAxisColorbarProps {
  yScale: ScaleLinear<number, number>;
  yDomain: [number, number];
  mapValueToColor: (value: number) => string;
  gradientId: string;
}

const NUM_STOPS = 20;

export function YAxisColorbar({
  yScale,
  yDomain,
  mapValueToColor,
  gradientId,
}: YAxisColorbarProps) {
  const colorbarGradientId = `${gradientId}-yaxis-colorbar`;

  const stops = useMemo(() => {
    const [min, max] = yDomain;
    const result: { offset: string; color: string }[] = [];
    for (let i = 0; i <= NUM_STOPS; i++) {
      const t = i / NUM_STOPS;
      const value = min + t * (max - min);
      result.push({
        offset: `${(t * 100).toFixed(1)}%`,
        color: mapValueToColor(value),
      });
    }
    return result;
  }, [yDomain, mapValueToColor]);

  const top = yScale(yDomain[1]);
  const bottom = yScale(yDomain[0]);
  const barHeight = bottom - top;

  return (
    <g className="y-axis-colorbar">
      <defs>
        <linearGradient id={colorbarGradientId} x1="0" y1="1" x2="0" y2="0">
          {stops.map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <rect
        x={-8}
        y={top}
        width={5}
        height={barHeight}
        fill={`url(#${colorbarGradientId})`}
        rx={2}
      />
    </g>
  );
}
