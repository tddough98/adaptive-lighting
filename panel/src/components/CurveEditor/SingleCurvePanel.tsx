import { useCallback, useMemo, useRef } from 'react';
import { scaleLinear } from 'd3';
import type {
  ChartMargins,
  CurveName,
  CurveSample,
  CurveSet,
  CurveSetAction,
  ResolvedCurve,
  SunTimes,
} from '../../types/curves';
import type { TickDragConfig } from '../YAxisLabels';
import { ChartCanvas } from '../ChartCanvas/ChartCanvas';
import { CurveGradientBackground } from '../ChartCanvas/CurveGradientBackground';
import { GridLines } from '../ChartCanvas/GridLines';
import { SunEventMarkers } from '../ChartCanvas/SunEventMarkers';
import { CurvePath } from '../ChartCanvas/CurvePath';
import { SingleCurveTimeIndicator } from '../ChartCanvas/SingleCurveTimeIndicator';
import { TimePointMarkers } from '../ChartCanvas/TimePointMarkers';
import { ExtremePointMarkers } from '../ChartCanvas/ExtremePointMarkers';
import { XAxisLabels } from '../XAxisLabels';
import { YAxisLabels } from '../YAxisLabels';
import { YAxisColorbar } from '../ChartCanvas/YAxisColorbar';

const WIDTH = 540;
const HEIGHT = 310;
const MARGINS: ChartMargins = { top: 16, right: 20, bottom: 36, left: 50 };

interface SingleCurvePanelProps {
  curveName: CurveName;
  title: string;
  samples: CurveSample[];
  resolved: ResolvedCurve;
  curveSet: CurveSet;
  sunTimes: SunTimes;
  currentHour: number;
  yDomain: [number, number];
  yTicks: number[];
  yAxisLabel: string;
  yTickFormat: (d: number) => string;
  curveColor: string;
  dashArray?: string;
  gradientId: string;
  mapValueToColor: (value: number, hour: number) => string;
  mapValueOnly?: (value: number) => string;
  onPointDrag: (action: CurveSetAction) => void;
  onPointDragEnd: (action: CurveSetAction) => void;
  readOnly?: boolean;
  className?: string;
  tickDrag?: {
    domain: [number, number];
    onDrag: (action: CurveSetAction) => void;
    onDragEnd: (action: CurveSetAction) => void;
    constrainRange: (newMin: number, newMax: number) => [number, number];
    makeAction: (newMin: number, newMax: number) => CurveSetAction;
  };
}

export function SingleCurvePanel({
  curveName,
  title,
  samples,
  resolved,
  curveSet,
  sunTimes,
  currentHour,
  yDomain,
  yTicks,
  yAxisLabel,
  yTickFormat,
  curveColor,
  dashArray,
  gradientId,
  mapValueToColor,
  mapValueOnly,
  onPointDrag,
  onPointDragEnd,
  readOnly,
  className,
  tickDrag,
}: SingleCurvePanelProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const innerWidth = WIDTH - MARGINS.left - MARGINS.right;
  const innerHeight = HEIGHT - MARGINS.top - MARGINS.bottom;

  // For Y-axis display: always use daytime (color_temp mode) colors
  const yAxisColorFn = useCallback(
    (value: number) => mapValueOnly ? mapValueOnly(value) : mapValueToColor(value, 12),
    [mapValueOnly, mapValueToColor],
  );

  const xScale = useMemo(
    () => scaleLinear().domain([0, 24]).range([0, innerWidth]),
    [innerWidth],
  );

  const yScale = useMemo(
    () => scaleLinear().domain(yDomain).range([innerHeight, 0]),
    [innerHeight, yDomain],
  );

  return (
    <div className={`single-curve-panel${className ? ` ${className}` : ''}`}>
      <div className="single-curve-panel-title" style={{ color: curveColor }}>
        {title}
      </div>
      <ChartCanvas
        ref={svgRef}
        width={WIDTH}
        height={HEIGHT}
        margins={MARGINS}
      >
        <CurveGradientBackground
          samples={samples}
          width={innerWidth}
          height={innerHeight}
          xScale={xScale}
          gradientId={gradientId}
          mapValueToColor={mapValueToColor}
        />
        <GridLines
          width={innerWidth}
          height={innerHeight}
          xScale={xScale}
          yScale={yScale}
          yTicks={yTicks}
        />
        <SunEventMarkers
          sunTimes={sunTimes}
          height={innerHeight}
          xScale={xScale}
        />
        <CurvePath
          samples={samples}
          xScale={xScale}
          yScale={yScale}
          color={curveColor}
          dashArray={dashArray}
        />
        <SingleCurveTimeIndicator
          currentHour={currentHour}
          samples={samples}
          height={innerHeight}
          xScale={xScale}
          yScale={yScale}
          accentColor={curveColor}
        />
        <TimePointMarkers
          resolved={resolved}
          curveDefinition={curveSet[curveName]}
          yScale={yScale}
          xScale={xScale}
          svgRef={svgRef}
          margins={MARGINS}
          sunTimes={sunTimes}
          curveSet={curveSet}
          curveName={curveName}
          onPointDrag={onPointDrag}
          onPointDragEnd={onPointDragEnd}
          readOnly={readOnly}
        />
        <ExtremePointMarkers
          resolved={resolved}
          xScale={xScale}
          yScale={yScale}
          svgRef={svgRef}
          margins={MARGINS}
          curveName={curveName}
          onPointDrag={onPointDrag}
          onPointDragEnd={onPointDragEnd}
          readOnly={readOnly}
        />
        <XAxisLabels
          xScale={xScale}
          height={innerHeight}
        />
        <YAxisColorbar
          yScale={yScale}
          yDomain={yDomain}
          mapValueToColor={yAxisColorFn}
          gradientId={gradientId}
        />
        <YAxisLabels
          yScale={yScale}
          yTicks={yTicks}
          label={yAxisLabel}
          accentColor={curveColor}
          tickFormat={yTickFormat}
          mapValueToColor={yAxisColorFn}
          tickDrag={tickDrag ? {
            svgRef,
            margins: MARGINS,
            ...tickDrag,
          } satisfies TickDragConfig : undefined}
        />
      </ChartCanvas>
    </div>
  );
}
