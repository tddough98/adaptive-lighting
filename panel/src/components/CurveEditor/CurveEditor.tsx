import { useCallback, useMemo } from 'react';
import { scaleLinear } from 'd3';
import type { CurveSet, CurveSetAction, SunTimes } from '../../types/curves';
import type { CurveData } from '../../hooks/useCurveData';
import { brightnessToColor, kelvinToRgb, kelvinToRgbTuple } from '../../utils/colormap';
import { lerpColorHsv, rgbTupleToString } from '../../utils/colorInterpolation';
import { isInArc } from '../../utils/curvemath';
import { resolveColorModeBoundaries } from '../../hooks/useCurveSetReducer';
import { SingleCurvePanel } from './SingleCurvePanel';
import { LinkedToggle } from './LinkedToggle';
import { ColorModeBar } from '../ChartCanvas/ColorModeBar';
import './CurveEditor.css';

interface CurveEditorProps {
  data: CurveData;
  curveSet: CurveSet;
  sunTimes: SunTimes;
  onPointDrag: (action: CurveSetAction) => void;
  onPointDragEnd: (action: CurveSetAction) => void;
  onToggleLinked: () => void;
  readOnly?: boolean;
}

const BRIGHTNESS_Y_DOMAIN: [number, number] = [0, 100];
const BRIGHTNESS_Y_TICKS = [0, 25, 50, 75, 100];

// Must match SingleCurvePanel layout
const CHART_WIDTH = 540;
const CHART_MARGINS = { top: 16, right: 20, bottom: 36, left: 50 };
const INNER_WIDTH = CHART_WIDTH - CHART_MARGINS.left - CHART_MARGINS.right;

const formatBrightnessTickCb = (d: number) => `${d}%`;
const formatColorTempTickCb = (d: number) => `${d}K`;

const NOOP = () => {};

export function CurveEditor({
  data,
  curveSet,
  sunTimes,
  onPointDrag,
  onPointDragEnd,
  onToggleLinked,
  readOnly = false,
}: CurveEditorProps) {
  const effectiveDrag = readOnly ? NOOP : onPointDrag;
  const effectiveDragEnd = readOnly ? NOOP : onPointDragEnd;
  const { startHour, endHour } = resolveColorModeBoundaries(curveSet.colorMode, sunTimes);
  const { sleepRgbColor } = curveSet.colorMode;
  const minK = curveSet.colorTemp.minValue;
  const maxK = curveSet.colorTemp.maxValue;

  const minRgb = useMemo(() => kelvinToRgbTuple(minK), [minK]);

  const mapBrightnessColor = useCallback(
    (value: number, _hour: number) => brightnessToColor(value),
    [],
  );

  const mapColorTempModeAware = useCallback(
    (value: number, hour: number) => {
      if (isInArc(hour, startHour, endHour)) {
        return kelvinToRgb(value);
      }
      // Nighttime: HSV lerp toward sleepRgbColor
      const t = maxK > minK ? 1 - (value - minK) / (maxK - minK) : 0;
      const clamped = Math.max(0, Math.min(1, t));
      return rgbTupleToString(lerpColorHsv(minRgb, sleepRgbColor, clamped));
    },
    [startHour, endHour, minK, maxK, minRgb, sleepRgbColor],
  );

  // Pure Kelvin colors for Y-axis (always daytime/color_temp mode)
  const mapColorTempValueOnly = useCallback(
    (value: number) => kelvinToRgb(value),
    [],
  );

  const barXScale = useMemo(
    () => scaleLinear().domain([0, 24]).range([0, INNER_WIDTH]),
    [],
  );

  const colorTempYDomain: [number, number] = useMemo(
    () => [minK, maxK],
    [minK, maxK],
  );

  const colorTempYTicks = useMemo(() => {
    const [min, max] = colorTempYDomain;
    return Array.from({ length: 5 }, (_, i) =>
      Math.round((min + (i / 4) * (max - min)) / 50) * 50,
    );
  }, [colorTempYDomain]);

  const MIN_KELVIN = 1500, MAX_KELVIN = 6500, MIN_GAP = 200;

  const constrainColorTempRange = useCallback(
    (newMin: number, newMax: number): [number, number] => {
      const cMin = Math.max(MIN_KELVIN, Math.min(MAX_KELVIN - MIN_GAP, newMin));
      const cMax = Math.max(cMin + MIN_GAP, Math.min(MAX_KELVIN, newMax));
      return [cMin, cMax];
    },
    [],
  );

  const makeColorTempAction = useCallback(
    (newMin: number, newMax: number): CurveSetAction =>
      ({ type: 'UPDATE_COLOR_TEMP_RANGE', newMin, newMax }),
    [],
  );

  return (
    <div className="curve-editor-layout">
      <div className="curve-editor-panels">
        <SingleCurvePanel
          curveName="brightness"
          title="Brightness"
          samples={data.brightnessSamples}
          resolved={data.resolvedBrightness}
          curveSet={curveSet}
          sunTimes={sunTimes}
          currentHour={data.currentHour}
          yDomain={BRIGHTNESS_Y_DOMAIN}
          yTicks={BRIGHTNESS_Y_TICKS}
          yAxisLabel="Brightness %"
          yTickFormat={formatBrightnessTickCb}
          curveColor="var(--accent-brightness)"
          gradientId="bg-gradient-brightness"
          mapValueToColor={mapBrightnessColor}
          onPointDrag={effectiveDrag}
          onPointDragEnd={effectiveDragEnd}
          readOnly={readOnly}
        />
        <div className="curve-editor-linked-row">
          <LinkedToggle linked={curveSet.linked} onToggle={onToggleLinked} readOnly={readOnly} />
        </div>
        <div className="color-temp-panel-with-bar">
          <SingleCurvePanel
            curveName="colorTemp"
            title="Color Temperature"
            samples={data.colorTempSamples}
            resolved={data.resolvedColorTemp}
            curveSet={curveSet}
            sunTimes={sunTimes}
            currentHour={data.currentHour}
            yDomain={colorTempYDomain}
            yTicks={colorTempYTicks}
            yAxisLabel="Color Temp (K)"
            yTickFormat={formatColorTempTickCb}
            curveColor="var(--accent-colortemp)"
            dashArray="6 3"
            gradientId="bg-gradient-colortemp"
            mapValueToColor={mapColorTempModeAware}
            mapValueOnly={mapColorTempValueOnly}
            onPointDrag={effectiveDrag}
            onPointDragEnd={effectiveDragEnd}
            readOnly={readOnly}
            tickDrag={readOnly ? undefined : {
              domain: colorTempYDomain,
              onDrag: onPointDrag,
              onDragEnd: onPointDragEnd,
              constrainRange: constrainColorTempRange,
              makeAction: makeColorTempAction,
            }}
          />
          <ColorModeBar
            xScale={barXScale}
            innerWidth={INNER_WIDTH}
            colorTempStartHour={startHour}
            colorTempEndHour={endHour}
            samples={data.colorTempSamples}
            mapSampleToColor={mapColorTempModeAware}
            margins={{ left: CHART_MARGINS.left, right: CHART_MARGINS.right }}
            onBoundaryDrag={effectiveDrag}
            onBoundaryDragEnd={effectiveDragEnd}
          />
        </div>
      </div>
    </div>
  );
}
