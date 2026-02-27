import type { ScaleLinear } from 'd3';
import type { CurveDefinition, ResolvedCurve } from '../../types/curves';
import { formatHour } from '../../utils/timeformat';

interface TimePointMarkersProps {
  resolved: ResolvedCurve;
  curveDefinition: CurveDefinition;
  yScale: ScaleLinear<number, number>;
  xScale: ScaleLinear<number, number>;
}

export function TimePointMarkers({
  resolved,
  curveDefinition,
  yScale,
  xScale,
}: TimePointMarkersProps) {
  const { maxValue, minValue } = resolved;

  const points = [
    {
      label: 'P1',
      hour: resolved.p1,
      value: maxValue,
      isRelative: curveDefinition.transitionStart.isRelative,
    },
    {
      label: 'P2',
      hour: resolved.p2,
      value: minValue,
      isRelative: curveDefinition.holdStart.isRelative,
    },
    {
      label: 'P4',
      hour: resolved.p4,
      value: minValue,
      isRelative: curveDefinition.holdEnd.isRelative,
    },
    {
      label: 'P5',
      hour: resolved.p5,
      value: maxValue,
      isRelative: curveDefinition.transitionEnd.isRelative,
    },
  ];

  return (
    <g className="time-point-markers">
      {points.map((pt) => {
        const cx = xScale(pt.hour);
        const cy = yScale(pt.value);
        return (
          <g key={pt.label}>
            <circle
              cx={cx}
              cy={cy}
              r={5}
              fill="var(--bg-card)"
              stroke="#fff"
              strokeWidth={1.5}
              strokeDasharray={pt.isRelative ? '3 2' : undefined}
            />
            <text
              x={cx}
              y={cy - 10}
              textAnchor="middle"
              fill="var(--text-secondary)"
              fontSize={8}
            >
              {pt.label} {formatHour(pt.hour)}
            </text>
          </g>
        );
      })}
    </g>
  );
}
