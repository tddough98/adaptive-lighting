import { useCallback, useMemo } from 'react';
import { scaleLinear } from 'd3';
import type { CurveSet, CurveSetAction, SunTimes } from '../../types/curves';
import type { CurveData } from '../../hooks/useCurveData';
import { brightnessToColor, kelvinToRgb } from '../../utils/colormap';
import { resolveColorModeBoundaries } from '../../hooks/useCurveSetReducer';
import { getSunElevationSamples } from '../../utils/sunElevation';
import { MONTVALE_COORDS } from '../../data/defaults';
import { SingleCurvePanel } from './SingleCurvePanel';
import { LinkedToggle } from './LinkedToggle';
import { ColorModeBar } from '../ChartCanvas/ColorModeBar';
import './CurveEditor.css';

interface CurveEditorProps {
  data: CurveData;
  curveSet: CurveSet;
  sunTimes: SunTimes;
  currentDate: Date;
  onPointDrag: (action: CurveSetAction) => void;
  onPointDragEnd: (action: CurveSetAction) => void;
  onToggleLinked: () => void;
  readOnly?: boolean;
}

const BRIGHTNESS_Y_DOMAIN: [number, number] = [0, 100];
const BRIGHTNESS_Y_TICKS = [0, 25, 50, 75, 100];

// Must match SingleCurvePanel layout
const CHART_WIDTH = 540;
const CHART_MARGINS = { top: 16, right: 46, bottom: 36, left: 50 };
const INNER_WIDTH = CHART_WIDTH - CHART_MARGINS.left - CHART_MARGINS.right;

const formatBrightnessTickCb = (d: number) => `${d}%`;
const formatColorTempTickCb = (d: number) => `${d}K`;

const NOOP = () => {};

export function CurveEditor({
  data,
  curveSet,
  sunTimes,
  currentDate,
  onPointDrag,
  onPointDragEnd,
  onToggleLinked,
  readOnly = false,
}: CurveEditorProps) {
  const effectiveDrag = readOnly ? NOOP : onPointDrag;
  const effectiveDragEnd = readOnly ? NOOP : onPointDragEnd;

  const sunElevationSamples = useMemo(
    () => getSunElevationSamples(currentDate, MONTVALE_COORDS.lat, MONTVALE_COORDS.lng),
    [currentDate],
  );
  const { startHour, endHour } = resolveColorModeBoundaries(curveSet.colorMode, sunTimes);
  const minK = curveSet.colorTemp.minValue;
  const maxK = curveSet.colorTemp.maxValue;

  const mapBrightnessColor = useCallback(
    (value: number, _hour: number) => brightnessToColor(value),
    [],
  );

  // Chart background: always pure Kelvin colors (no RGB/CT zone distinction)
  const mapColorTempKelvinOnly = useCallback(
    (value: number, _hour: number) => kelvinToRgb(value),
    [],
  );

  // NOTE: Mode-aware color mapping (HSV lerp toward sleepRgbColor outside CT window)
  // was removed here. See git history for mapColorTempModeAware — will be restored
  // when users can choose arbitrary RGB sleep colors.

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
          sunElevationSamples={sunElevationSamples}
        />
        <div className="curve-editor-linked-row">
          <LinkedToggle linked={curveSet.linked} onToggle={onToggleLinked} readOnly={readOnly} />
        </div>
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
          gradientId="bg-gradient-colortemp"
          mapValueToColor={mapColorTempKelvinOnly}
          mapValueOnly={mapColorTempValueOnly}
          onPointDrag={effectiveDrag}
          onPointDragEnd={effectiveDragEnd}
          readOnly={readOnly}
          className="single-curve-panel--flat-bottom"
          sunElevationSamples={sunElevationSamples}
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
          colorTempSamples={data.colorTempSamples}
          margins={{ left: CHART_MARGINS.left, right: CHART_MARGINS.right }}
          onBoundaryDrag={effectiveDrag}
          onBoundaryDragEnd={effectiveDragEnd}
        />
      </div>
    </div>
  );
}
