import type { ScaleLinear } from 'd3';

interface RightYAxisLabelsProps {
  sunYScale: ScaleLinear<number, number>;
  innerWidth: number;
  ticks: number[];
}

export function RightYAxisLabels({
  sunYScale,
  innerWidth,
  ticks,
}: RightYAxisLabelsProps) {
  const midY = sunYScale(0);

  return (
    <>
      {ticks.map((tickValue) => (
        <g key={tickValue} transform={`translate(${innerWidth}, ${sunYScale(tickValue)})`}>
          <text
            x={4}
            y={0}
            textAnchor="start"
            dominantBaseline="central"
            fill="rgba(160, 160, 160, 0.7)"
            fontSize={9}
          >
            {tickValue}°
          </text>
        </g>
      ))}
      <text
        transform="rotate(90)"
        x={midY}
        y={-(innerWidth + 40)}
        textAnchor="middle"
        fill="rgba(255, 180, 0, 0.5)"
        fontSize={10}
        fontWeight={500}
      >
        Sun Elevation
      </text>
    </>
  );
}
