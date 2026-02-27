import { useCallback, useState } from 'react';
import type { ScaleLinear } from 'd3';
import type {
  ChartMargins,
  CurveName,
  CurveSetAction,
  ResolvedCurve,
} from '../../types/curves';
import { constrainSharpness } from '../../utils/constraints';
import { useDrag } from '../../hooks/useDrag';

interface SharpnessPointMarkersProps {
  resolved: ResolvedCurve;
  xScale: ScaleLinear<number, number>;
  yScale: ScaleLinear<number, number>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  margins: ChartMargins;
  curveName: CurveName;
  onPointDrag: (action: CurveSetAction) => void;
  onPointDragEnd: (action: CurveSetAction) => void;
}

/** Midpoint hour between two times, handling midnight wrap. */
function midpointHour(a: number, b: number): number {
  if (b >= a) return (a + b) / 2;
  const mid = (a + b + 24) / 2;
  return mid >= 24 ? mid - 24 : mid;
}

export function SharpnessPointMarkers({
  resolved,
  xScale,
  yScale,
  svgRef,
  margins,
  curveName,
  onPointDrag,
  onPointDragEnd,
}: SharpnessPointMarkersProps) {
  const { p1, p2, p4, p5, eveningSharpness, morningSharpness, p1Value, p2Value, p4Value, p5Value } = resolved;
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { dragState, startDrag } = useDrag<CurveSetAction>({
    svgRef,
    onDrag: onPointDrag,
    onDragEnd: onPointDragEnd,
  });

  const makeConstrainFn = useCallback(
    (which: 'evening' | 'morning') => {
      return (_svgX: number, svgY: number): CurveSetAction => {
        const plotY = svgY - margins.top;
        const rawValue = yScale.invert(plotY);

        let rawSharpness: number;
        if (which === 'evening') {
          // Evening (p1Value→p2Value): sharpness = how far from p1Value toward p2Value
          const range = p1Value - p2Value;
          rawSharpness = range !== 0 ? (p1Value - rawValue) / range : 0;
        } else {
          // Morning (p4Value→p5Value): sharpness = how far from p4Value toward p5Value
          const range = p5Value - p4Value;
          rawSharpness = range !== 0 ? (rawValue - p4Value) / range : 0;
        }
        const newSharpness = constrainSharpness(rawSharpness);

        return {
          type: 'UPDATE_SHARPNESS',
          curveName,
          which,
          newSharpness,
        };
      };
    },
    [margins.top, yScale, curveName, p1Value, p2Value, p4Value, p5Value],
  );

  // Marker Y = curve value at midpoint using per-point values
  const eveningMarkerValue = p1Value - eveningSharpness * (p1Value - p2Value);
  const morningMarkerValue = p4Value + morningSharpness * (p5Value - p4Value);

  const markers = [
    {
      id: 'evening' as const,
      hour: midpointHour(p1, p2),
      value: eveningMarkerValue,
    },
    {
      id: 'morning' as const,
      hour: midpointHour(p4, p5),
      value: morningMarkerValue,
    },
  ];

  return (
    <g className="sharpness-markers">
      {markers.map((m) => {
        const cx = xScale(m.hour);
        const cy = yScale(m.value);
        const isDragging =
          dragState.isDragging && dragState.activePointId === m.id;
        const isHovered = hoveredId === m.id;
        const scale = isDragging ? 1.2 : isHovered ? 1.2 : 1;

        return (
          <g key={m.id} transform={`translate(${cx},${cy})`}>
            <circle
              r={6}
              fill="var(--accent-colortemp)"
              stroke="var(--bg-card)"
              strokeWidth={1.5}
              style={{
                cursor: 'ns-resize',
                transform: `scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease',
              }}
              filter={isDragging ? 'url(#drag-glow)' : undefined}
              onMouseDown={startDrag(m.id, makeConstrainFn(m.id))}
              onMouseEnter={() => setHoveredId(m.id)}
              onMouseLeave={() => setHoveredId(null)}
            />
          </g>
        );
      })}
    </g>
  );
}
