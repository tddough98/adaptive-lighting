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
  CLIP_VISIBLE_THRESHOLD_PX,
  isRepeatPointerDown,
  pointerDownRecord,
  timingPointDragAction,
} from '../../interaction/timeBearingControl';
import { useDrag } from '../../hooks/useDrag';
import { SunModeIcon, ClockModeIcon } from './ModeIcons';

interface TimePointMarkersProps {
  resolved: ResolvedCurve;
  intendedResolved: ResolvedCurve;
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

export function TimePointMarkers({
  resolved,
  intendedResolved,
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
        return timingPointDragAction({
          svgX,
          svgY,
          margins,
          xScale,
          yScale,
          curveSet,
          curveDefinition,
          resolved,
          sunTimes,
          curveName,
          pointType,
        });
      };
    },
    [margins, xScale, yScale, curveSet, curveDefinition, resolved, sunTimes, curveName],
  );

  const handleMouseDown = useCallback(
    (pointType: TimingPointType, e: React.MouseEvent) => {
      const prev = lastMouseDown.current;

      if (isRepeatPointerDown(prev, pointType, e)) {
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

      lastMouseDown.current = pointerDownRecord(pointType, e);
      // Proceed with normal drag
      startDrag(pointType, makeConstrainFn(pointType))(e);
    },
    [curveName, sunTimes, onPointDragEnd, startDrag, makeConstrainFn],
  );

  const evaluatedByType: Record<TimingPointType, { hour: number; value: number }> = {
    transition_start: { hour: resolved.p1, value: resolved.p1Value },
    hold_start: { hour: resolved.p2, value: resolved.p2Value },
    hold_end: { hour: resolved.p4, value: resolved.p4Value },
    transition_end: { hour: resolved.p5, value: resolved.p5Value },
  };

  const points = [
    {
      type: 'transition_start' as const,
      hour: intendedResolved.p1,
      value: intendedResolved.p1Value,
      isRelative: curveDefinition.transitionStart.isRelative,
      anchor: curveDefinition.transitionStart.anchor,
      storedValue: curveDefinition.transitionStart.value,
    },
    {
      type: 'hold_start' as const,
      hour: intendedResolved.p2,
      value: intendedResolved.p2Value,
      isRelative: curveDefinition.holdStart.isRelative,
      anchor: curveDefinition.holdStart.anchor,
      storedValue: curveDefinition.holdStart.value,
    },
    {
      type: 'hold_end' as const,
      hour: intendedResolved.p4,
      value: intendedResolved.p4Value,
      isRelative: curveDefinition.holdEnd.isRelative,
      anchor: curveDefinition.holdEnd.anchor,
      storedValue: curveDefinition.holdEnd.value,
    },
    {
      type: 'transition_end' as const,
      hour: intendedResolved.p5,
      value: intendedResolved.p5Value,
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
        const evaluated = evaluatedByType[pt.type];
        const evaluatedCx = xScale(evaluated.hour);
        const evaluatedCy = yScale(evaluated.value);
        const isClipped = Math.abs(evaluatedCx - cx) > CLIP_VISIBLE_THRESHOLD_PX ||
          Math.abs(evaluatedCy - cy) > CLIP_VISIBLE_THRESHOLD_PX;
        const isDragging =
          dragState.isDragging && dragState.activePointId === pt.type;
        const isHovered = hoveredId === pt.type;
        const scale = isDragging ? 1.2 : isHovered ? 1.2 : 1;

        const timeLabel = pt.isRelative && pt.anchor
          ? formatRelativeOffset(pt.storedValue, pt.anchor)
          : formatHour(pt.hour);

        return (
          <g key={label} transform={`translate(${cx},${cy})`}>
            {isClipped && (
              <g>
                <title>{`${label} evaluated at ${formatHour(evaluated.hour)}`}</title>
                <line
                  x1={0}
                  y1={0}
                  x2={evaluatedCx - cx}
                  y2={evaluatedCy - cy}
                  stroke={curveColor}
                  strokeWidth={1}
                  strokeDasharray="3 2"
                  opacity={0.6}
                />
                <circle
                  cx={evaluatedCx - cx}
                  cy={evaluatedCy - cy}
                  r={4}
                  fill="var(--bg-card)"
                  stroke={curveColor}
                  strokeWidth={1.5}
                  opacity={0.9}
                />
              </g>
            )}
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
              <title>{`${label} draft intent at ${formatHour(pt.hour)}`}</title>
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
