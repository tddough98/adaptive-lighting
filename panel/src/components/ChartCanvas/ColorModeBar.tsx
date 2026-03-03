import { useCallback, useMemo, useRef, useState } from 'react';
import type { ScaleLinear } from 'd3';
import type { CurveSetAction, CurveSample, SunTimes } from '../../types/curves';
import { kelvinToRgb } from '../../utils/colormap';
import { formatHour, formatRelativeOffset } from '../../utils/timeformat';
import { useDrag } from '../../hooks/useDrag';
import { SunModeIcon, ClockModeIcon } from './ModeIcons';

interface ColorModeBarProps {
  xScale: ScaleLinear<number, number>;
  innerWidth: number;
  colorTempStartHour: number;
  colorTempEndHour: number;
  colorTempSamples: CurveSample[];
  margins: { left: number; right: number };
  onBoundaryDrag: (action: CurveSetAction) => void;
  onBoundaryDragEnd: (action: CurveSetAction) => void;
  startIsRelative: boolean;
  endIsRelative: boolean;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
  sunTimes: SunTimes;
  readOnly?: boolean;
}

const BAR_HEIGHT = 24;
const HANDLE_RADIUS = 8;
const HANDLE_TOP = 16; // vertical space above bar for labels
const MIN_GAP_HOURS = 0.5;
const SNAP_MINUTES = 1;
const DOUBLE_CLICK_MS = 300;
const DOUBLE_CLICK_RADIUS = 5;
const HANDLE_STROKE = '#ea580c';

function snapToMinute(hour: number): number {
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
  startIsRelative,
  endIsRelative,
  startOffsetMinutes,
  endOffsetMinutes,
  sunTimes,
  readOnly = false,
}: ColorModeBarProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const totalWidth = innerWidth + margins.left + margins.right;
  const svgHeight = HANDLE_TOP + BAR_HEIGHT + 8; // label space + bar + bottom padding

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const lastMouseDown = useRef<{ pointId: string; time: number; x: number; y: number } | null>(null);

  // Full-bar gradient stops from actual curve values (0->24h)
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

  // Separate gradient for "Kelvin" text label: full minK->maxK range
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

  // Constraint functions for drag
  const startConstrainFn = useCallback(
    (svgX: number, _svgY: number): CurveSetAction => {
      const rawHour = xScale.invert(svgX - margins.left);
      const snapped = snapToMinute(Math.max(0, Math.min(24, rawHour)));
      const clamped = Math.min(snapped, colorTempEndHour - MIN_GAP_HOURS);
      return {
        type: 'UPDATE_COLOR_MODE_BOUNDARY',
        boundary: 'start',
        newHour: Math.max(0, clamped),
        sunTimes,
      };
    },
    [xScale, margins.left, colorTempEndHour, sunTimes],
  );

  const endConstrainFn = useCallback(
    (svgX: number, _svgY: number): CurveSetAction => {
      const rawHour = xScale.invert(svgX - margins.left);
      const snapped = snapToMinute(Math.max(0, Math.min(24, rawHour)));
      const clamped = Math.max(snapped, colorTempStartHour + MIN_GAP_HOURS);
      return {
        type: 'UPDATE_COLOR_MODE_BOUNDARY',
        boundary: 'end',
        newHour: Math.min(24, clamped),
        sunTimes,
      };
    },
    [xScale, margins.left, colorTempStartHour, sunTimes],
  );

  // Single unified useDrag instance
  const { dragState, startDrag } = useDrag<CurveSetAction>({
    svgRef,
    onDrag: onBoundaryDrag,
    onDragEnd: onBoundaryDragEnd,
  });

  // Double-click-aware mousedown handler (same pattern as TimePointMarkers)
  const handleMouseDown = useCallback(
    (boundary: 'start' | 'end', e: React.MouseEvent) => {
      if (readOnly) return;
      const pointId = `color-mode-${boundary}`;
      const now = Date.now();
      const prev = lastMouseDown.current;

      if (
        prev &&
        prev.pointId === pointId &&
        now - prev.time < DOUBLE_CLICK_MS &&
        Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < DOUBLE_CLICK_RADIUS
      ) {
        // Double-click detected - toggle lock mode
        lastMouseDown.current = null;
        e.preventDefault();
        e.stopPropagation();
        onBoundaryDragEnd({
          type: 'TOGGLE_COLOR_MODE_BOUNDARY_LOCK',
          boundary,
          sunTimes,
        });
        return;
      }

      lastMouseDown.current = { pointId, time: now, x: e.clientX, y: e.clientY };
      const constrainFn = boundary === 'start' ? startConstrainFn : endConstrainFn;
      startDrag(pointId, constrainFn)(e);
    },
    [readOnly, sunTimes, onBoundaryDragEnd, startDrag, startConstrainFn, endConstrainFn],
  );

  const startX = xScale(colorTempStartHour);
  const endX = xScale(colorTempEndHour);

  // Zone label positions (centered in each segment)
  const nightLeftCenter = startX / 2;
  const dayCenter = (startX + endX) / 2;
  const nightRightCenter = (endX + innerWidth) / 2;

  // Handle center Y is at the bar's vertical center (shifted down by HANDLE_TOP)
  const handleCY = HANDLE_TOP + BAR_HEIGHT / 2;

  // Time labels for each handle
  const startTimeLabel = startIsRelative
    ? formatRelativeOffset(startOffsetMinutes, 'sunrise')
    : formatHour(colorTempStartHour);
  const endTimeLabel = endIsRelative
    ? formatRelativeOffset(endOffsetMinutes, 'sunset')
    : formatHour(colorTempEndHour);

  const handles: Array<{
    id: 'start' | 'end';
    cx: number;
    isRelative: boolean;
    timeLabel: string;
  }> = [
    { id: 'start', cx: startX, isRelative: startIsRelative, timeLabel: startTimeLabel },
    { id: 'end', cx: endX, isRelative: endIsRelative, timeLabel: endTimeLabel },
  ];

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
          {/* Kelvin label gradient: full min->max range */}
          <linearGradient id="cmb-kelvin-label-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            {kelvinLabelStops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <clipPath id="cmb-clip">
            <rect x={0} y={HANDLE_TOP} width={innerWidth} height={BAR_HEIGHT} rx={4} />
          </clipPath>
          {/* Drag glow filter for active handle */}
          <filter id="cmb-drag-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feFlood floodColor={HANDLE_STROKE} floodOpacity="0.4" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Clipped bar filled with curve-derived gradient (shifted down) */}
        <g clipPath="url(#cmb-clip)">
          <rect
            x={0}
            y={HANDLE_TOP}
            width={innerWidth}
            height={BAR_HEIGHT}
            fill="url(#cmb-curve-gradient)"
          />
        </g>

        {/* Border */}
        <rect
          x={0}
          y={HANDLE_TOP}
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
            y={HANDLE_TOP + BAR_HEIGHT / 2}
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
            y={HANDLE_TOP + BAR_HEIGHT / 2}
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
            y={HANDLE_TOP + BAR_HEIGHT / 2}
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

        {/* Circular handle markers */}
        {handles.map((h) => {
          const isDragging = dragState.isDragging && dragState.activePointId === `color-mode-${h.id}`;
          const isHovered = hoveredId === h.id;
          const scale = isDragging || isHovered ? 1.2 : 1;

          return (
            <g key={h.id} transform={`translate(${h.cx},${handleCY})`}>
              {/* Time label above handle */}
              <text
                x={0}
                y={-BAR_HEIGHT / 2 - HANDLE_RADIUS - 2}
                textAnchor="middle"
                dominantBaseline="auto"
                fill="var(--text-secondary)"
                fontSize={8}
              >
                {h.timeLabel}
              </text>
              {/* Circle marker with mode icon */}
              <g
                className="color-mode-handle"
                style={{
                  cursor: readOnly ? 'default' : 'ew-resize',
                  transform: `scale(${scale})`,
                  transition: isDragging ? 'none' : 'transform 0.15s ease',
                  opacity: readOnly ? 0.7 : 1,
                }}
                filter={isDragging ? 'url(#cmb-drag-glow)' : undefined}
                onMouseDown={(e) => handleMouseDown(h.id, e)}
                onMouseEnter={() => setHoveredId(h.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <circle
                  r={HANDLE_RADIUS}
                  fill="var(--bg-card)"
                  stroke={HANDLE_STROKE}
                  strokeWidth={2}
                />
                {h.isRelative
                  ? <SunModeIcon x={0} y={0} />
                  : <ClockModeIcon x={0} y={0} />
                }
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
