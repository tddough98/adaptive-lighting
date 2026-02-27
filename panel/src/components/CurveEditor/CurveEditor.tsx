import { useMemo, useRef } from 'react';
import { scaleLinear } from 'd3';
import type { CurveSet, CurveSetAction, SunTimes } from '../../types/curves';
import type { ChartMargins } from '../../types/curves';
import type { CurveData } from '../../hooks/useCurveData';
import { ChartCanvas } from '../ChartCanvas/ChartCanvas';
import { GridLines } from '../ChartCanvas/GridLines';
import { SunEventMarkers } from '../ChartCanvas/SunEventMarkers';
import { CurvePath } from '../ChartCanvas/CurvePath';
import { CurrentTimeIndicator } from '../ChartCanvas/CurrentTimeIndicator';
import { TimePointMarkers } from '../ChartCanvas/TimePointMarkers';
import { SharpnessPointMarkers } from '../ChartCanvas/SharpnessPointMarkers';
import { ExtremePointMarkers } from '../ChartCanvas/ExtremePointMarkers';
import { XAxisLabels } from '../XAxisLabels';
import { YAxisLabels } from '../YAxisLabels';
import { Legend } from '../Legend';
import './CurveEditor.css';

const WIDTH = 860;
const HEIGHT = 340;
const MARGINS: ChartMargins = { top: 16, right: 60, bottom: 36, left: 56 };

interface CurveEditorProps {
  data: CurveData;
  curveSet: CurveSet;
  sunTimes: SunTimes;
  onPointDrag: (action: CurveSetAction) => void;
  onPointDragEnd: (action: CurveSetAction) => void;
}

export function CurveEditor({
  data,
  curveSet,
  sunTimes,
  onPointDrag,
  onPointDragEnd,
}: CurveEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const innerWidth = WIDTH - MARGINS.left - MARGINS.right;
  const innerHeight = HEIGHT - MARGINS.top - MARGINS.bottom;

  const xScale = useMemo(
    () => scaleLinear().domain([0, 24]).range([0, innerWidth]),
    [innerWidth],
  );

  const yBrightnessScale = useMemo(
    () => scaleLinear().domain([0, 100]).range([innerHeight, 0]),
    [innerHeight],
  );

  const yColorTempScale = useMemo(
    () => scaleLinear().domain([2000, 5500]).range([innerHeight, 0]),
    [innerHeight],
  );

  return (
    <div className="curve-editor">
      <ChartCanvas
        ref={svgRef}
        width={WIDTH}
        height={HEIGHT}
        margins={MARGINS}
      >
        <GridLines
          width={innerWidth}
          height={innerHeight}
          xScale={xScale}
          yScale={yBrightnessScale}
        />
        <SunEventMarkers
          sunTimes={data.sunTimes}
          height={innerHeight}
          xScale={xScale}
        />
        <CurvePath
          samples={data.brightnessSamples}
          xScale={xScale}
          yScale={yBrightnessScale}
          color="var(--accent-brightness)"
        />
        <CurvePath
          samples={data.colorTempSamples}
          xScale={xScale}
          yScale={yColorTempScale}
          color="var(--accent-colortemp)"
          dashArray="6 3"
        />
        <CurrentTimeIndicator
          currentHour={data.currentHour}
          brightnessSamples={data.brightnessSamples}
          colorTempSamples={data.colorTempSamples}
          height={innerHeight}
          xScale={xScale}
          yBrightnessScale={yBrightnessScale}
          yColorTempScale={yColorTempScale}
        />
        {/* ColorTemp markers rendered first (lower z-order) */}
        <TimePointMarkers
          resolved={data.resolvedColorTemp}
          curveDefinition={curveSet.colorTemp}
          yScale={yColorTempScale}
          xScale={xScale}
          svgRef={svgRef}
          margins={MARGINS}
          sunTimes={sunTimes}
          curveSet={curveSet}
          curveName="colorTemp"
          onPointDrag={onPointDrag}
          onPointDragEnd={onPointDragEnd}
        />
        <SharpnessPointMarkers
          resolved={data.resolvedColorTemp}
          xScale={xScale}
          yScale={yColorTempScale}
          svgRef={svgRef}
          margins={MARGINS}
          curveName="colorTemp"
          onPointDrag={onPointDrag}
          onPointDragEnd={onPointDragEnd}
        />
        <ExtremePointMarkers
          resolved={data.resolvedColorTemp}
          xScale={xScale}
          yScale={yColorTempScale}
          svgRef={svgRef}
          margins={MARGINS}
          curveName="colorTemp"
          onPointDrag={onPointDrag}
          onPointDragEnd={onPointDragEnd}
        />
        {/* Brightness markers rendered last (higher z-order) */}
        <TimePointMarkers
          resolved={data.resolvedBrightness}
          curveDefinition={curveSet.brightness}
          yScale={yBrightnessScale}
          xScale={xScale}
          svgRef={svgRef}
          margins={MARGINS}
          sunTimes={sunTimes}
          curveSet={curveSet}
          curveName="brightness"
          onPointDrag={onPointDrag}
          onPointDragEnd={onPointDragEnd}
        />
        <SharpnessPointMarkers
          resolved={data.resolvedBrightness}
          xScale={xScale}
          yScale={yBrightnessScale}
          svgRef={svgRef}
          margins={MARGINS}
          curveName="brightness"
          onPointDrag={onPointDrag}
          onPointDragEnd={onPointDragEnd}
        />
        <ExtremePointMarkers
          resolved={data.resolvedBrightness}
          xScale={xScale}
          yScale={yBrightnessScale}
          svgRef={svgRef}
          margins={MARGINS}
          curveName="brightness"
          onPointDrag={onPointDrag}
          onPointDragEnd={onPointDragEnd}
        />
        <XAxisLabels
          xScale={xScale}
          height={innerHeight}
        />
        <YAxisLabels
          yBrightnessScale={yBrightnessScale}
          yColorTempScale={yColorTempScale}
          width={innerWidth}
        />
      </ChartCanvas>
      <Legend />
    </div>
  );
}
