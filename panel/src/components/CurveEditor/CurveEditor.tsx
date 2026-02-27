import { useCallback } from 'react';
import type { CurveSet, CurveSetAction, SunTimes } from '../../types/curves';
import type { CurveData } from '../../hooks/useCurveData';
import { brightnessToColor, kelvinToRgb } from '../../utils/colormap';
import { SingleCurvePanel } from './SingleCurvePanel';
import { LinkedToggle } from './LinkedToggle';
import './CurveEditor.css';

interface CurveEditorProps {
  data: CurveData;
  curveSet: CurveSet;
  sunTimes: SunTimes;
  onPointDrag: (action: CurveSetAction) => void;
  onPointDragEnd: (action: CurveSetAction) => void;
  onToggleLinked: () => void;
}

const BRIGHTNESS_Y_DOMAIN: [number, number] = [0, 100];
const BRIGHTNESS_Y_TICKS = [0, 25, 50, 75, 100];
const COLOR_TEMP_Y_DOMAIN: [number, number] = [2000, 5500];
const COLOR_TEMP_Y_TICKS = [2000, 2875, 3750, 4625, 5500];

const formatBrightnessTickCb = (d: number) => `${d}%`;
const formatColorTempTickCb = (d: number) => `${d}K`;

export function CurveEditor({
  data,
  curveSet,
  sunTimes,
  onPointDrag,
  onPointDragEnd,
  onToggleLinked,
}: CurveEditorProps) {
  const mapBrightnessColor = useCallback(brightnessToColor, []);
  const mapColorTempColor = useCallback(kelvinToRgb, []);

  return (
    <div className="curve-editor-layout">
      <div className="curve-editor-header">
        <LinkedToggle linked={curveSet.linked} onToggle={onToggleLinked} />
      </div>
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
          onPointDrag={onPointDrag}
          onPointDragEnd={onPointDragEnd}
        />
        <SingleCurvePanel
          curveName="colorTemp"
          title="Color Temperature"
          samples={data.colorTempSamples}
          resolved={data.resolvedColorTemp}
          curveSet={curveSet}
          sunTimes={sunTimes}
          currentHour={data.currentHour}
          yDomain={COLOR_TEMP_Y_DOMAIN}
          yTicks={COLOR_TEMP_Y_TICKS}
          yAxisLabel="Color Temp (K)"
          yTickFormat={formatColorTempTickCb}
          curveColor="var(--accent-colortemp)"
          dashArray="6 3"
          gradientId="bg-gradient-colortemp"
          mapValueToColor={mapColorTempColor}
          onPointDrag={onPointDrag}
          onPointDragEnd={onPointDragEnd}
        />
      </div>
    </div>
  );
}
