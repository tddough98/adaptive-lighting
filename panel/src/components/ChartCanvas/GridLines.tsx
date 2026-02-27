import type { ScaleLinear } from 'd3';

interface GridLinesProps {
  width: number;
  height: number;
  xScale: ScaleLinear<number, number>;
  yScale: ScaleLinear<number, number>;
}

const Y_TICKS = [0, 25, 50, 75, 100];
const X_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

export function GridLines({ width, height, xScale, yScale }: GridLinesProps) {
  return (
    <g className="grid-lines">
      {Y_TICKS.map((v) => (
        <line
          key={`h-${v}`}
          x1={0}
          x2={width}
          y1={yScale(v)}
          y2={yScale(v)}
          stroke="var(--grid-line)"
          strokeWidth={0.5}
        />
      ))}
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
