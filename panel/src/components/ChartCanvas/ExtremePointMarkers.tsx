import { useCallback, useRef, useState } from 'react';
import type { ScaleLinear } from 'd3';
import type {
  ChartMargins,
  CurveDefinition,
  CurveName,
  CurveSetAction,
  ResolvedCurve,
  SunTimes,
} from '../../types/curves';
import {
  clampHourInArc,
  constrainYValue,
  getPeakConstraints,
  getValleyConstraints,
  snapToMinutes,
} from '../../utils/constraints';
import { useDrag } from '../../hooks/useDrag';
import { formatHour, formatRelativeOffset } from '../../utils/timeformat';
import { SunModeIcon, ClockModeIcon } from './ModeIcons';

interface ExtremePointMarkersProps {
  resolved: ResolvedCurve;
  curveDefinition: CurveDefinition;
  xScale: ScaleLinear<number, number>;
  yScale: ScaleLinear<number, number>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  margins: ChartMargins;
  curveName: CurveName;
  sunTimes: SunTimes;
  onPointDrag: (action: CurveSetAction) => void;
  onPointDragEnd: (action: CurveSetAction) => void;
  readOnly?: boolean;
}

// Triangle path pointing up (peak) — centered at origin
const TRIANGLE_UP = 'M 0,-7 L 6,5 L -6,5 Z';
// Triangle path pointing down (valley) — centered at origin
const TRIANGLE_DOWN = 'M 0,7 L 6,-5 L -6,-5 Z';

const DOUBLE_CLICK_MS = 300;
const DOUBLE_CLICK_RADIUS = 5;

export function ExtremePointMarkers({
  resolved,
  curveDefinition,
  xScale,
  yScale,
  svgRef,
  margins,
  curveName,
  sunTimes,
  onPointDrag,
  onPointDragEnd,
  readOnly,
}: ExtremePointMarkersProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const lastMouseDown = useRef<{ pointId: string; time: number; x: number; y: number } | null>(null);

  const { dragState, startDrag } = useDrag<CurveSetAction>({
    svgRef,
    onDrag: onPointDrag,
    onDragEnd: onPointDragEnd,
  });

  const makePeakConstrainFn = useCallback(
    () => {
      return (svgX: number, svgY: number): CurveSetAction => {
        const plotX = svgX - margins.left;
        const rawHour = ((xScale.invert(plotX) % 24) + 24) % 24;
        const { minHour, maxHour } = getPeakConstraints(resolved);
        const clamped = clampHourInArc(rawHour, minHour, maxHour);
        let snapped = snapToMinutes(clamped, 5);
        if (snapped >= 24) snapped -= 24;

        const plotY = svgY - margins.top;
        const rawY = yScale.invert(plotY);
        const newValue = constrainYValue(rawY, resolved.minValue, resolved.maxValue);

        return {
          type: 'UPDATE_PEAK',
          curveName,
          newHour: snapped,
          newValue,
          sunTimes,
        };
      };
    },
    [margins.left, margins.top, xScale, yScale, curveName, resolved, sunTimes],
  );

  const makeValleyConstrainFn = useCallback(
    () => {
      return (svgX: number, svgY: number): CurveSetAction => {
        const plotX = svgX - margins.left;
        const rawHour = ((xScale.invert(plotX) % 24) + 24) % 24;
        const { minHour, maxHour } = getValleyConstraints(resolved);
        const clamped = clampHourInArc(rawHour, minHour, maxHour);
        let snapped = snapToMinutes(clamped, 5);
        if (snapped >= 24) snapped -= 24;

        const plotY = svgY - margins.top;
        const rawY = yScale.invert(plotY);
        const newValue = constrainYValue(rawY, resolved.minValue, resolved.maxValue);

        return {
          type: 'UPDATE_VALLEY',
          curveName,
          newHour: snapped,
          newValue,
          sunTimes,
        };
      };
    },
    [margins.left, margins.top, xScale, yScale, curveName, resolved, sunTimes],
  );

  const handleMouseDown = useCallback(
    (pointId: 'peak' | 'valley', constrainFn: (svgX: number, svgY: number) => CurveSetAction, e: React.MouseEvent) => {
      const now = Date.now();
      const prev = lastMouseDown.current;

      if (
        prev &&
        prev.pointId === pointId &&
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
          pointId,
          sunTimes,
        });
        return;
      }

      lastMouseDown.current = { pointId, time: now, x: e.clientX, y: e.clientY };
      startDrag(pointId, constrainFn)(e);
    },
    [curveName, sunTimes, onPointDragEnd, startDrag],
  );

  const peak = curveDefinition.peak;
  const valley = curveDefinition.valley;

  const markers = [
    {
      id: 'peak' as const,
      hour: resolved.peakHour,
      value: resolved.peakValue,
      path: TRIANGLE_UP,
      fill: '#ffc107',       // Gold
      constrainFn: makePeakConstrainFn(),
      label: 'Peak',
      labelYOffset: -14,
      isRelative: peak.isRelative,
      anchor: peak.anchor,
      offsetMinutes: peak.offsetMinutes,
    },
    {
      id: 'valley' as const,
      hour: resolved.valleyHour,
      value: resolved.valleyValue,
      path: TRIANGLE_DOWN,
      fill: '#42a5f5',       // Blue
      constrainFn: makeValleyConstrainFn(),
      label: 'Valley',
      labelYOffset: 18,
      isRelative: valley.isRelative,
      anchor: valley.anchor,
      offsetMinutes: valley.offsetMinutes,
    },
  ];

  return (
    <g className="extreme-point-markers">
      {markers.map((m) => {
        const cx = xScale(m.hour);
        const cy = yScale(m.value);
        const isDragging =
          dragState.isDragging && dragState.activePointId === m.id;
        const isHovered = hoveredId === m.id;
        const scale = isDragging ? 1.2 : isHovered ? 1.2 : 1;

        const timeLabel = m.isRelative && m.anchor && m.offsetMinutes != null
          ? formatRelativeOffset(m.offsetMinutes, m.anchor)
          : formatHour(m.hour);

        return (
          <g key={m.id} transform={`translate(${cx},${cy})`}>
            {/* Label with time */}
            <g transform={`translate(0,${m.labelYOffset})`}>
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--text-secondary)"
                fontSize={8}
              >
                {m.label} {timeLabel}
              </text>
            </g>
            {/* Triangle marker with mode icon inside */}
            <g
              style={{
                cursor: readOnly ? 'default' : 'move',
                transform: `scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease',
                opacity: readOnly ? 0.7 : 1,
              }}
              filter={isDragging ? 'url(#drag-glow)' : undefined}
              onMouseDown={readOnly ? undefined : (e) => handleMouseDown(m.id, m.constrainFn, e)}
              onMouseEnter={() => setHoveredId(m.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <path
                d={m.path}
                fill={m.fill}
                stroke="var(--bg-card)"
                strokeWidth={1.5}
              />
              {m.isRelative
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
