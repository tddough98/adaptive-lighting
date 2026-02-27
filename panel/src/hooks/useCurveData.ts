import { useMemo } from 'react';
import type { CurveSet, CurveSample, ResolvedCurve, SunTimes } from '../types/curves';
import { resolveCurve } from '../utils/curvemath';
import { generateCurveSamples } from '../utils/pathgen';

export interface CurveData {
  brightnessSamples: CurveSample[];
  colorTempSamples: CurveSample[];
  resolvedBrightness: ResolvedCurve;
  resolvedColorTemp: ResolvedCurve;
  sunTimes: SunTimes;
  currentHour: number;
}

export function useCurveData(
  curveSet: CurveSet,
  sunTimes: SunTimes,
  currentHour: number,
): CurveData {
  const resolvedBrightness = useMemo(
    () => resolveCurve(curveSet.brightness, sunTimes),
    [curveSet.brightness, sunTimes],
  );

  const resolvedColorTemp = useMemo(
    () => resolveCurve(curveSet.colorTemp, sunTimes),
    [curveSet.colorTemp, sunTimes],
  );

  const brightnessSamples = useMemo(
    () => generateCurveSamples(resolvedBrightness),
    [resolvedBrightness],
  );

  const colorTempSamples = useMemo(
    () => generateCurveSamples(resolvedColorTemp),
    [resolvedColorTemp],
  );

  return {
    brightnessSamples,
    colorTempSamples,
    resolvedBrightness,
    resolvedColorTemp,
    sunTimes,
    currentHour,
  };
}
