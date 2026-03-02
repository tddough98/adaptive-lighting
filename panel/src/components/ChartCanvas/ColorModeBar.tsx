import { useCallback, useMemo, useRef } from 'react';
import type { ScaleLinear } from 'd3';
import type { CurveSetAction } from '../../types/curves';
import { kelvinToRgb } from '../../utils/colormap';
import { useDrag } from '../../hooks/useDrag';

interface ColorModeBarProps {
  xScale: ScaleLinear<number, number>;
  innerWidth: number;
  colorTempStartHour: number;
  colorTempEndHour: number;
  minK: number;
  maxK: number;
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

/** Number of color stops for the Kelvin gradient */
const KELVIN_STOPS = 8;

export function ColorModeBar({
  xScale,
  innerWidth,
  colorTempStartHour,
  colorTempEndHour,
  minK,
  maxK,
  margins,
  onBoundaryDrag,
  onBoundaryDragEnd,
}: ColorModeBarProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const totalWidth = innerWidth + margins.left + margins.right;
  const svgHeight = BAR_HEIGHT + 8; // bar + bottom padding

  // Kelvin zone gradient stops (warm → cool)
  const kelvinStops = useMemo(() => {
    const stops: { offset: string; color: string }[] = [];
    for (let i = 0; i <= KELVIN_STOPS; i++) {
      const t = i / KELVIN_STOPS;
      const k = minK + t * (maxK - minK);
      stops.push({ offset: `${(t * 100).toFixed(1)}%`, color: kelvinToRgb(k) });
    }
    return stops;
  }, [minK, maxK]);

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
          {/* RGB rainbow gradient for nighttime zones */}
          <linearGradient id="cmb-rgb-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff0000" />
            <stop offset="50%" stopColor="#00ff00" />
            <stop offset="100%" stopColor="#0000ff" />
          </linearGradient>
          {/* Kelvin gradient for daytime zone */}
          <linearGradient id="cmb-kelvin-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            {kelvinStops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <clipPath id="cmb-clip">
            <rect x={0} y={0} width={innerWidth} height={BAR_HEIGHT} rx={4} />
          </clipPath>
        </defs>

        {/* Clipped zone rectangles */}
        <g clipPath="url(#cmb-clip)">
          {/* Left RGB zone (0 → startX) */}
          <rect
            x={0}
            y={0}
            width={startX}
            height={BAR_HEIGHT}
            fill="url(#cmb-rgb-gradient)"
          />
          {/* Kelvin zone (startX → endX) */}
          <rect
            x={startX}
            y={0}
            width={endX - startX}
            height={BAR_HEIGHT}
            fill="url(#cmb-kelvin-gradient)"
          />
          {/* Right RGB zone (endX → innerWidth) */}
          <rect
            x={endX}
            y={0}
            width={innerWidth - endX}
            height={BAR_HEIGHT}
            fill="url(#cmb-rgb-gradient)"
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
            fontSize={9}
            fontWeight={600}
            fill="rgba(255,255,255,0.7)"
          >
            RGB
          </text>
        )}
        {endX - startX > 30 && (
          <text
            x={dayCenter}
            y={BAR_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fontWeight={600}
            fill="rgba(255,255,255,0.7)"
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
            fontSize={9}
            fontWeight={600}
            fill="rgba(255,255,255,0.7)"
          >
            RGB
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
