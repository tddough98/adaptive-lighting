import { useCallback, useRef, useState } from 'react';
import type { ScaleLinear } from 'd3';
import type {
  ChartMargins,
  CurveDefinition,
  CurveName,
  CurveSet,
  CurveSetAction,
  ResolvedCurve,
  SunTimes,
  TimingPointType,
} from '../../types/curves';
import { formatHour, formatRelativeOffset } from '../../utils/timeformat';
import {
  absoluteHourToTimingValue,
  clampHourInArc,
  constrainYValue,
  getTimePointConstraints,
  snapToMinutes,
} from '../../utils/constraints';
import { useDrag } from '../../hooks/useDrag';
import { SunModeIcon, ClockModeIcon } from './ModeIcons';

interface TimePointMarkersProps {
  resolved: ResolvedCurve;
  curveDefinition: CurveDefinition;
  yScale: ScaleLinear<number, number>;
  xScale: ScaleLinear<number, number>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  margins: ChartMargins;
  sunTimes: SunTimes;
  curveSet: CurveSet;
  curveName: CurveName;
  curveColor: string;
  onPointDrag: (action: CurveSetAction) => void;
  onPointDragEnd: (action: CurveSetAction) => void;
  readOnly?: boolean;
}

const LABELS: Record<TimingPointType, string> = {
  transition_start: 'P1',
  hold_start: 'P2',
  hold_end: 'P4',
  transition_end: 'P5',
};

const POINT_FIELDS: Record<TimingPointType, keyof CurveDefinition> = {
  transition_start: 'transitionStart',
  hold_start: 'holdStart',
  hold_end: 'holdEnd',
  transition_end: 'transitionEnd',
};

const DOUBLE_CLICK_MS = 300;
const DOUBLE_CLICK_RADIUS = 5;

export function TimePointMarkers({
  resolved,
  curveDefinition,
  yScale,
  xScale,
  svgRef,
  margins,
  sunTimes,
  curveSet,
  curveName,
  curveColor,
  onPointDrag,
  onPointDragEnd,
  readOnly,
}: TimePointMarkersProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const lastMouseDown = useRef<{ pointId: string; time: number; x: number; y: number } | null>(null);

  const { dragState, startDrag } = useDrag<CurveSetAction>({
    svgRef,
    onDrag: onPointDrag,
    onDragEnd: onPointDragEnd,
  });

  const makeConstrainFn = useCallback(
    (pointType: TimingPointType) => {
      return (svgX: number, svgY: number): CurveSetAction => {
        const plotX = svgX - margins.left;
        const rawHour = ((xScale.invert(plotX) % 24) + 24) % 24;
        const constraints = getTimePointConstraints(pointType, curveSet, sunTimes, curveName);
        const clamped = clampHourInArc(rawHour, constraints.minHour, constraints.maxHour);
        let snapped = snapToMinutes(clamped, constraints.snapMinutes);
        if (snapped >= 24) snapped -= 24;
        const field = POINT_FIELDS[pointType];
        const point = curveDefinition[field];
        const tp = point as { isRelative: boolean; anchor?: 'sunset' | 'sunrise' };
        const newValue = absoluteHourToTimingValue(snapped, tp.isRelative, tp.anchor, sunTimes);

        const plotY = svgY - margins.top;
        const rawY = yScale.invert(plotY);
        const newYValue = constrainYValue(rawY, resolved.minValue, resolved.maxValue);

        return {
          type: 'UPDATE_TIME_POINT',
          curveName,
          pointType,
          newValue,
          newYValue,
          sunTimes,
        };
      };
    },
    [margins.left, margins.top, xScale, yScale, curveSet, sunTimes, curveName, resolved, curveDefinition],
  );

  const handleMouseDown = useCallback(
    (pointType: TimingPointType, e: React.MouseEvent) => {
      const now = Date.now();
      const prev = lastMouseDown.current;

      if (
        prev &&
        prev.pointId === pointType &&
        now - prev.time < DOUBLE_CLICK_MS &&
        Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < DOUBLE_CLICK_RADIUS
      ) {
        // Double-click detected — toggle time lock
        lastMouseDown.current = null;
        e.preventDefault();
        e.stopPropagation();
        onPointDragEnd({
          type: 'TOGGLE_TIME_LOCK',
          curveName,
          pointId: pointType,
          sunTimes,
        });
        return;
      }

      lastMouseDown.current = { pointId: pointType, time: now, x: e.clientX, y: e.clientY };
      // Proceed with normal drag
      startDrag(pointType, makeConstrainFn(pointType))(e);
    },
    [curveName, sunTimes, onPointDragEnd, startDrag, makeConstrainFn],
  );

  const points = [
    {
      type: 'transition_start' as const,
      hour: resolved.p1,
      value: resolved.p1Value,
      isRelative: curveDefinition.transitionStart.isRelative,
      anchor: curveDefinition.transitionStart.anchor,
      storedValue: curveDefinition.transitionStart.value,
    },
    {
      type: 'hold_start' as const,
      hour: resolved.p2,
      value: resolved.p2Value,
      isRelative: curveDefinition.holdStart.isRelative,
      anchor: curveDefinition.holdStart.anchor,
      storedValue: curveDefinition.holdStart.value,
    },
    {
      type: 'hold_end' as const,
      hour: resolved.p4,
      value: resolved.p4Value,
      isRelative: curveDefinition.holdEnd.isRelative,
      anchor: curveDefinition.holdEnd.anchor,
      storedValue: curveDefinition.holdEnd.value,
    },
    {
      type: 'transition_end' as const,
      hour: resolved.p5,
      value: resolved.p5Value,
      isRelative: curveDefinition.transitionEnd.isRelative,
      anchor: curveDefinition.transitionEnd.anchor,
      storedValue: curveDefinition.transitionEnd.value,
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

        const timeLabel = pt.isRelative && pt.anchor
          ? formatRelativeOffset(pt.storedValue, pt.anchor)
          : formatHour(pt.hour);

        return (
          <g key={label} transform={`translate(${cx},${cy})`}>
            {/* Time label */}
            <g transform="translate(0,-14)">
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--text-secondary)"
                fontSize={8}
              >
                {timeLabel}
              </text>
            </g>
            {/* Circle marker with mode icon inside */}
            <g
              style={{
                cursor: readOnly ? 'default' : 'move',
                transform: `scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease',
                opacity: readOnly ? 0.7 : 1,
              }}
              filter={isDragging ? 'url(#drag-glow)' : undefined}
              onMouseDown={readOnly ? undefined : (e) => handleMouseDown(pt.type, e)}
              onMouseEnter={() => setHoveredId(pt.type)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <circle
                r={8}
                fill="var(--bg-card)"
                stroke={curveColor}
                strokeWidth={2}
              />
              {pt.isRelative
                ? <SunModeIcon x={0} y={0} />
                : <ClockModeIcon x={0} y={0} />
              }
            </g>
          </g>
        );
      })}
    </g>
  );
}
