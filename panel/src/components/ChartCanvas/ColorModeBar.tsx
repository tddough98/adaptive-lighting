import { useCallback, useMemo, useRef } from 'react';
import type { ScaleLinear } from 'd3';
import type { CurveSetAction, CurveSample } from '../../types/curves';
import { kelvinToRgb } from '../../utils/colormap';
import { useDrag } from '../../hooks/useDrag';

interface ColorModeBarProps {
  xScale: ScaleLinear<number, number>;
  innerWidth: number;
  colorTempStartHour: number;
  colorTempEndHour: number;
  colorTempSamples: CurveSample[];
  margins: { left: number; right: number };
  onBoundaryDrag: (action: CurveSetAction) => void;
  onBoundaryDragEnd: (action: CurveSetAction) => void;
}

const BAR_HEIGHT = 24;
const HANDLE_WIDTH = 6;
const MIN_GAP_HOURS = 0.5;
const SNAP_MINUTES = 15;
function snapTo15Min(hour: number): number {
  const totalMinutes = hour * 60;
  return Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES / 60;
}

/** Number of evenly-spaced stops for the full-bar curve gradient */
const CURVE_STOPS = 24;
/** Number of stops for the Kelvin text label gradient */
const LABEL_STOPS = 8;

export function ColorModeBar({
  xScale,
  innerWidth,
  colorTempStartHour,
  colorTempEndHour,
  colorTempSamples,
  margins,
  onBoundaryDrag,
  onBoundaryDragEnd,
}: ColorModeBarProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const totalWidth = innerWidth + margins.left + margins.right;
  const svgHeight = BAR_HEIGHT + 8; // bar + bottom padding

  // Full-bar gradient stops from actual curve values (0→24h)
  const curveStops = useMemo(() => {
    if (colorTempSamples.length === 0) return [];
    const stops: { offset: string; color: string }[] = [];
    for (let i = 0; i <= CURVE_STOPS; i++) {
      const t = i / CURVE_STOPS;
      const hour = t * 24;
      let closest = colorTempSamples[0];
      for (const s of colorTempSamples) {
        if (Math.abs(s.hour - hour) < Math.abs(closest.hour - hour)) {
          closest = s;
        }
      }
      stops.push({ offset: `${(t * 100).toFixed(1)}%`, color: kelvinToRgb(closest.value) });
    }
    return stops;
  }, [colorTempSamples]);

  // Separate gradient for "Kelvin" text label: full minK→maxK range
  const kelvinLabelStops = useMemo(() => {
    if (colorTempSamples.length === 0) return [];
    let minK = Infinity, maxK = -Infinity;
    for (const s of colorTempSamples) {
      if (s.value < minK) minK = s.value;
      if (s.value > maxK) maxK = s.value;
    }
    const stops: { offset: string; color: string }[] = [];
    for (let i = 0; i <= LABEL_STOPS; i++) {
      const t = i / LABEL_STOPS;
      const k = minK + t * (maxK - minK);
      stops.push({ offset: `${(t * 100).toFixed(1)}%`, color: kelvinToRgb(k) });
    }
    return stops;
  }, [colorTempSamples]);

  // Drag for start handle
  const startConstrainFn = useCallback(
    (svgX: number): CurveSetAction => {
      const rawHour = xScale.invert(svgX - margins.left);
      const snapped = snapTo15Min(Math.max(0, Math.min(24, rawHour)));
      const clamped = Math.min(snapped, colorTempEndHour - MIN_GAP_HOURS);
      return {
        type: 'UPDATE_COLOR_MODE_BOUNDARY',
        boundary: 'start',
        newHour: Math.max(0, clamped),
      };
    },
    [xScale, margins.left, colorTempEndHour],
  );

  const endConstrainFn = useCallback(
    (svgX: number): CurveSetAction => {
      const rawHour = xScale.invert(svgX - margins.left);
      const snapped = snapTo15Min(Math.max(0, Math.min(24, rawHour)));
      const clamped = Math.max(snapped, colorTempStartHour + MIN_GAP_HOURS);
      return {
        type: 'UPDATE_COLOR_MODE_BOUNDARY',
        boundary: 'end',
        newHour: Math.min(24, clamped),
      };
    },
    [xScale, margins.left, colorTempStartHour],
  );

  const { startDrag: startDragStart } = useDrag<CurveSetAction>({
    svgRef,
    onDrag: onBoundaryDrag,
    onDragEnd: onBoundaryDragEnd,
  });

  const { startDrag: startDragEnd } = useDrag<CurveSetAction>({
    svgRef,
    onDrag: onBoundaryDrag,
    onDragEnd: onBoundaryDragEnd,
  });

  const startX = xScale(colorTempStartHour);
  const endX = xScale(colorTempEndHour);

  // Zone label positions (centered in each segment)
  const nightLeftCenter = startX / 2;
  const dayCenter = (startX + endX) / 2;
  const nightRightCenter = (endX + innerWidth) / 2;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${totalWidth} ${svgHeight}`}
      width="100%"
      className="color-mode-bar-svg"
    >
      <g transform={`translate(${margins.left}, 0)`}>
        <defs>
          {/* Full-bar gradient from actual curve values */}
          <linearGradient id="cmb-curve-gradient" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={innerWidth} y2={0}>
            {curveStops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          {/* Kelvin label gradient: full min→max range */}
          <linearGradient id="cmb-kelvin-label-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            {kelvinLabelStops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <clipPath id="cmb-clip">
            <rect x={0} y={0} width={innerWidth} height={BAR_HEIGHT} rx={4} />
          </clipPath>
        </defs>

        {/* Clipped bar filled with curve-derived gradient */}
        <g clipPath="url(#cmb-clip)">
          <rect
            x={0}
            y={0}
            width={innerWidth}
            height={BAR_HEIGHT}
            fill="url(#cmb-curve-gradient)"
          />
        </g>

        {/* Border */}
        <rect
          x={0}
          y={0}
          width={innerWidth}
          height={BAR_HEIGHT}
          fill="none"
          stroke="var(--bg-card-border)"
          strokeWidth={1}
          rx={4}
        />

        {/* Zone labels */}
        {startX > 40 && (
          <text
            x={nightLeftCenter}
            y={BAR_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={600}
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={1}
            paintOrder="stroke"
          >
            <tspan fill="#ff4444">R</tspan>
            <tspan fill="#44ff44">G</tspan>
            <tspan fill="#4444ff">B</tspan>
          </text>
        )}
        {endX - startX > 30 && (
          <text
            x={dayCenter}
            y={BAR_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={600}
            fill="url(#cmb-kelvin-label-gradient)"
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={1}
            paintOrder="stroke"
          >
            Kelvin
          </text>
        )}
        {innerWidth - endX > 40 && (
          <text
            x={nightRightCenter}
            y={BAR_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={600}
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={1}
            paintOrder="stroke"
          >
            <tspan fill="#ff4444">R</tspan>
            <tspan fill="#44ff44">G</tspan>
            <tspan fill="#4444ff">B</tspan>
          </text>
        )}

        {/* Start handle */}
        <g
          className="color-mode-handle"
          onMouseDown={startDragStart('color-mode-start', startConstrainFn)}
          style={{ cursor: 'ew-resize' }}
        >
          <rect
            x={startX - HANDLE_WIDTH / 2}
            y={0}
            width={HANDLE_WIDTH}
            height={BAR_HEIGHT}
            fill="rgba(255,255,255,0.9)"
            rx={2}
          />
          <line
            x1={startX}
            y1={3}
            x2={startX}
            y2={BAR_HEIGHT - 3}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={1}
          />
        </g>

        {/* End handle */}
        <g
          className="color-mode-handle"
          onMouseDown={startDragEnd('color-mode-end', endConstrainFn)}
          style={{ cursor: 'ew-resize' }}
        >
          <rect
            x={endX - HANDLE_WIDTH / 2}
            y={0}
            width={HANDLE_WIDTH}
            height={BAR_HEIGHT}
            fill="rgba(255,255,255,0.9)"
            rx={2}
          />
          <line
            x1={endX}
            y1={3}
            x2={endX}
            y2={BAR_HEIGHT - 3}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={1}
          />
        </g>
      </g>
    </svg>
  );
}
