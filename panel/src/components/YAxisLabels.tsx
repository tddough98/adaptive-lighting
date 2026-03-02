import { useCallback, useRef } from 'react';
import type { ScaleLinear } from 'd3';
import type { ChartMargins, CurveSetAction } from '../types/curves';
import { contrastTextColor } from '../utils/colormap';
import { useDrag, type ConstrainFn } from '../hooks/useDrag';

export interface TickDragConfig {
  svgRef: React.RefObject<SVGSVGElement | null>;
  margins: ChartMargins;
  domain: [number, number];
  onDrag: (action: CurveSetAction) => void;
  onDragEnd: (action: CurveSetAction) => void;
  constrainRange: (newMin: number, newMax: number) => [number, number];
  makeAction: (newMin: number, newMax: number) => CurveSetAction;
}

interface YAxisLabelsProps {
  yScale: ScaleLinear<number, number>;
  yTicks: number[];
  label: string;
  accentColor: string;
  tickFormat: (d: number) => string;
  mapValueToColor: (d: number) => string;
  tickDrag?: TickDragConfig;
}

const PILL_HEIGHT = 13;
const PILL_FONT_SIZE = 9;
const PILL_X_PAD = 4;
const CHAR_WIDTH = 5.5;

// Dummy no-op refs/callbacks for when drag is disabled
const NOOP_SVG_REF = { current: null };
const NOOP = () => {};

export function YAxisLabels({
  yScale,
  yTicks,
  label,
  accentColor,
  tickFormat,
  mapValueToColor,
  tickDrag,
}: YAxisLabelsProps) {
  const drag = tickDrag;

  const makeConstrainFn = useCallback(
    (tickValue: number) =>
      (_svgX: number, svgY: number): CurveSetAction => {
        if (!drag) return { type: 'TOGGLE_LINKED' }; // unreachable dummy
        const [min, max] = drag.domain;
        const mid = (min + max) / 2;
        const plotY = svgY - drag.margins.top;
        const innerH = yScale.range()[0]; // range is [innerHeight, 0], so range()[0] = innerHeight

        let newMin: number, newMax: number;
        if (tickValue >= mid) {
          // Top-half tick: anchor = min (bottom). Solve for newMax.
          const frac = innerH - plotY;
          newMax = frac > 1
            ? min + (tickValue - min) * innerH / frac
            : 40000;
          newMin = min;
        } else {
          // Bottom-half tick: anchor = max (top). Solve for newMin.
          newMin = plotY > 1
            ? max - (max - tickValue) * innerH / plotY
            : 1000;
          newMax = max;
        }

        [newMin, newMax] = drag.constrainRange(newMin, newMax);
        return drag.makeAction(newMin, newMax);
      },
    [drag, yScale],
  );

  const { dragState, startDrag } = useDrag<CurveSetAction>({
    svgRef: drag?.svgRef ?? NOOP_SVG_REF,
    onDrag: drag?.onDrag ?? NOOP,
    onDragEnd: drag?.onDragEnd ?? NOOP,
  });

  const frozenGridRef = useRef<{ step: number; base: number } | null>(null);

  const wrappedStartDrag = useCallback(
    (pointId: string, constrainFn: ConstrainFn<CurveSetAction>) => {
      const handler = startDrag(pointId, constrainFn);
      return (e: React.MouseEvent) => {
        frozenGridRef.current = yTicks.length > 1
          ? { step: yTicks[1] - yTicks[0], base: yTicks[0] }
          : null;
        handler(e);
      };
    },
    [startDrag, yTicks],
  );

  const [domainMin, domainMax] = yScale.domain();
  const midY = yScale((domainMin + domainMax) / 2);

  let displayTicks: number[];
  if (dragState.isDragging && frozenGridRef.current) {
    const { step, base } = frozenGridRef.current;
    const firstTick = base + Math.ceil((domainMin - base) / step) * step;
    displayTicks = [];
    for (let t = firstTick; t <= domainMax + 0.5; t += step) {
      displayTicks.push(Math.round(t));
    }
  } else {
    displayTicks = yTicks;
  }

  return (
    <>
      {displayTicks.map((tickValue) => {
        const y = yScale(tickValue);
        const formatted = tickFormat(tickValue);
        const bgColor = mapValueToColor(tickValue);
        const textColor = contrastTextColor(bgColor);
        const pillWidth = formatted.length * CHAR_WIDTH + PILL_X_PAD * 2;

        return (
          <g
            key={tickValue}
            transform={`translate(0, ${y})`}
            cursor={drag ? 'ns-resize' : undefined}
            onMouseDown={drag ? wrappedStartDrag(`tick-${tickValue}`, makeConstrainFn(tickValue)) : undefined}
          >
            <rect
              x={-pillWidth - 2}
              y={-PILL_HEIGHT / 2}
              width={pillWidth}
              height={PILL_HEIGHT}
              rx={3}
              fill={bgColor}
            />
            <text
              x={-2 - PILL_X_PAD}
              y={0}
              textAnchor="end"
              dominantBaseline="central"
              fill={textColor}
              fontSize={PILL_FONT_SIZE}
              fontWeight={400}
            >
              {formatted}
            </text>
          </g>
        );
      })}
      <text
        transform="rotate(-90)"
        x={-midY}
        y={-44}
        textAnchor="middle"
        fill={accentColor}
        fontSize={10}
        fontWeight={500}
      >
        {label}
      </text>
    </>
  );
}
