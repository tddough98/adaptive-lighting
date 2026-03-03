import type { ScaleLinear } from 'd3';

interface GridLinesProps {
  height: number;
  xScale: ScaleLinear<number, number>;
}

const X_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

export function GridLines({ height, xScale }: GridLinesProps) {
  return (
    <g className="grid-lines">
      {X_TICKS.map((h) => (
        <line
          key={`v-${h}`}
          x1={xScale(h)}
          x2={xScale(h)}
          y1={0}
          y2={height}
          stroke="var(--grid-line)"
          strokeWidth={0.5}
        />
      ))}
    </g>
  );
}
