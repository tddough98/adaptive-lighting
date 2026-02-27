import { useCallback, useState } from 'react';
import type { ScaleLinear } from 'd3';
import type {
  ChartMargins,
  CurveName,
  CurveSetAction,
  ResolvedCurve,
} from '../../types/curves';
import {
  constrainYValue,
  getPeakConstraints,
  getValleyConstraints,
  snapToMinutes,
} from '../../utils/constraints';
import { useDrag } from '../../hooks/useDrag';

interface ExtremePointMarkersProps {
  resolved: ResolvedCurve;
  xScale: ScaleLinear<number, number>;
  yScale: ScaleLinear<number, number>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  margins: ChartMargins;
  curveName: CurveName;
  onPointDrag: (action: CurveSetAction) => void;
  onPointDragEnd: (action: CurveSetAction) => void;
}

/** Clamp hour within [min, max], handling midnight wrap for arcs. */
function clampHourInArc(hour: number, min: number, max: number): number {
  if (min <= max) {
    // Same-day range
    return Math.max(min, Math.min(max, hour));
  }
  // Midnight-wrapping range: min > max means e.g. 23.25→5.25
  // If hour is in the valid arc, keep it; otherwise clamp to nearest bound
  if (hour >= min || hour <= max) return hour;
  // Outside the arc — pick the closer bound
  const distToMin = Math.min(Math.abs(hour - min), 24 - Math.abs(hour - min));
  const distToMax = Math.min(Math.abs(hour - max), 24 - Math.abs(hour - max));
  return distToMin <= distToMax ? min : max;
}

// Triangle path pointing up (peak) — centered at origin
const TRIANGLE_UP = 'M 0,-7 L 6,5 L -6,5 Z';
// Triangle path pointing down (valley) — centered at origin
const TRIANGLE_DOWN = 'M 0,7 L 6,-5 L -6,-5 Z';

export function ExtremePointMarkers({
  resolved,
  xScale,
  yScale,
  svgRef,
  margins,
  curveName,
  onPointDrag,
  onPointDragEnd,
}: ExtremePointMarkersProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { dragState, startDrag } = useDrag<CurveSetAction>({
    svgRef,
    onDrag: onPointDrag,
    onDragEnd: onPointDragEnd,
  });

  const makePeakConstrainFn = useCallback(
    () => {
      return (svgX: number, svgY: number): CurveSetAction => {
        const plotX = svgX - margins.left;
        const rawHour = xScale.invert(plotX);
        const { minHour, maxHour } = getPeakConstraints(resolved);
        const clamped = clampHourInArc(rawHour, minHour, maxHour);
        const snapped = snapToMinutes(clamped, 5);

        const plotY = svgY - margins.top;
        const rawY = yScale.invert(plotY);
        const minY = Math.max(resolved.p1Value, resolved.p5Value);
        const newValue = constrainYValue(rawY, minY, resolved.maxValue);

        return {
          type: 'UPDATE_PEAK',
          curveName,
          newHour: snapped,
          newValue,
        };
      };
    },
    [margins.left, margins.top, xScale, yScale, curveName, resolved],
  );

  const makeValleyConstrainFn = useCallback(
    () => {
      return (svgX: number, svgY: number): CurveSetAction => {
        const plotX = svgX - margins.left;
        const rawHour = xScale.invert(plotX);
        const { minHour, maxHour } = getValleyConstraints(resolved);
        const clamped = clampHourInArc(rawHour, minHour, maxHour);
        const snapped = snapToMinutes(clamped, 5);

        const plotY = svgY - margins.top;
        const rawY = yScale.invert(plotY);
        const maxY = Math.min(resolved.p2Value, resolved.p4Value);
        const newValue = constrainYValue(rawY, resolved.minValue, maxY);

        return {
          type: 'UPDATE_VALLEY',
          curveName,
          newHour: snapped,
          newValue,
        };
      };
    },
    [margins.left, margins.top, xScale, yScale, curveName, resolved],
  );

  const markers = [
    {
      id: 'peak',
      hour: resolved.peakHour,
      value: resolved.peakValue,
      path: TRIANGLE_UP,
      fill: '#ffc107',       // Gold
      constrainFn: makePeakConstrainFn(),
    },
    {
      id: 'valley',
      hour: resolved.valleyHour,
      value: resolved.valleyValue,
      path: TRIANGLE_DOWN,
      fill: '#42a5f5',       // Blue
      constrainFn: makeValleyConstrainFn(),
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

        return (
          <g key={m.id} transform={`translate(${cx},${cy})`}>
            <path
              d={m.path}
              fill={m.fill}
              stroke="var(--bg-card)"
              strokeWidth={1.5}
              style={{
                cursor: 'move',
                transform: `scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease',
              }}
              filter={isDragging ? 'url(#drag-glow)' : undefined}
              onMouseDown={startDrag(m.id, m.constrainFn)}
              onMouseEnter={() => setHoveredId(m.id)}
              onMouseLeave={() => setHoveredId(null)}
            />
          </g>
        );
      })}
    </g>
  );
}
