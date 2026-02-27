import { useCallback, useState } from 'react';
import type { ScaleLinear } from 'd3';
import type {
  ChartMargins,
  CurveDefinition,
  CurveSet,
  CurveSetAction,
  ResolvedCurve,
  SunTimes,
  TimingPointType,
} from '../../types/curves';
import { formatHour } from '../../utils/timeformat';
import {
  absoluteHourToTimingValue,
  constrainYValue,
  getTimePointConstraints,
  snapToMinutes,
} from '../../utils/constraints';
import { useDrag } from '../../hooks/useDrag';

interface TimePointMarkersProps {
  resolved: ResolvedCurve;
  curveDefinition: CurveDefinition;
  yScale: ScaleLinear<number, number>;
  xScale: ScaleLinear<number, number>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  margins: ChartMargins;
  sunTimes: SunTimes;
  curveSet: CurveSet;
  onPointDrag: (action: CurveSetAction) => void;
  onPointDragEnd: (action: CurveSetAction) => void;
}

const LABELS: Record<TimingPointType, string> = {
  transition_start: 'P1',
  hold_start: 'P2',
  hold_end: 'P4',
  transition_end: 'P5',
};

export function TimePointMarkers({
  resolved,
  curveDefinition,
  yScale,
  xScale,
  svgRef,
  margins,
  sunTimes,
  curveSet,
  onPointDrag,
  onPointDragEnd,
}: TimePointMarkersProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { dragState, startDrag } = useDrag<CurveSetAction>({
    svgRef,
    onDrag: onPointDrag,
    onDragEnd: onPointDragEnd,
  });

  const makeConstrainFn = useCallback(
    (pointType: TimingPointType) => {
      return (svgX: number, svgY: number): CurveSetAction => {
        // X: time constraint (same as before)
        const plotX = svgX - margins.left;
        const rawHour = xScale.invert(plotX);
        const constraints = getTimePointConstraints(pointType, curveSet, sunTimes);
        const clamped = Math.max(
          constraints.minHour,
          Math.min(constraints.maxHour, rawHour),
        );
        const snapped = snapToMinutes(clamped, constraints.snapMinutes);
        const newValue = absoluteHourToTimingValue(snapped, pointType, sunTimes);

        // Y: value constraint
        const plotY = svgY - margins.top;
        const rawY = yScale.invert(plotY);
        const newYValue = constrainYValue(rawY, resolved.minValue, resolved.maxValue);

        return {
          type: 'UPDATE_TIME_POINT',
          curveName: 'brightness',
          pointType,
          newValue,
          newYValue,
        };
      };
    },
    [margins.left, margins.top, xScale, yScale, curveSet, sunTimes, resolved.maxValue],
  );

  const points = [
    {
      type: 'transition_start' as const,
      hour: resolved.p1,
      value: resolved.p1Value,
      isRelative: curveDefinition.transitionStart.isRelative,
    },
    {
      type: 'hold_start' as const,
      hour: resolved.p2,
      value: resolved.p2Value,
      isRelative: curveDefinition.holdStart.isRelative,
    },
    {
      type: 'hold_end' as const,
      hour: resolved.p4,
      value: resolved.p4Value,
      isRelative: curveDefinition.holdEnd.isRelative,
    },
    {
      type: 'transition_end' as const,
      hour: resolved.p5,
      value: resolved.p5Value,
      isRelative: curveDefinition.transitionEnd.isRelative,
    },
  ];

  return (
    <g className="time-point-markers">
      {points.map((pt) => {
        const label = LABELS[pt.type];
        const cx = xScale(pt.hour);
        const cy = yScale(pt.value);
        const isDragging =
          dragState.isDragging && dragState.activePointId === pt.type;
        const isHovered = hoveredId === pt.type;
        const scale = isDragging ? 1.2 : isHovered ? 1.2 : 1;

        return (
          <g key={label} transform={`translate(${cx},${cy})`}>
            {/* Label with time */}
            <text
              x={0}
              y={-14}
              textAnchor="middle"
              fill="var(--text-secondary)"
              fontSize={8}
            >
              {label} {formatHour(pt.hour)}
            </text>
            {/* Circle marker */}
            <circle
              r={8}
              fill="var(--bg-card)"
              stroke="#4caf50"
              strokeWidth={2}
              strokeDasharray={pt.isRelative ? '3 2' : undefined}
              style={{
                cursor: 'move',
                transform: `scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease',
              }}
              filter={isDragging ? 'url(#drag-glow)' : undefined}
              onMouseDown={startDrag(pt.type, makeConstrainFn(pt.type))}
              onMouseEnter={() => setHoveredId(pt.type)}
              onMouseLeave={() => setHoveredId(null)}
            />
          </g>
        );
      })}
    </g>
  );
}
