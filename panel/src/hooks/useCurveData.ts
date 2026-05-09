import { useMemo } from 'react';
import {
  evaluateColorModeWindow,
  evaluateLightingCurve,
  type LightingPlanEvaluation,
} from '../domain/lightingPlanEvaluation';
import type { CurveSet, SunTimes } from '../types/curves';

export function useCurveData(
  curveSet: CurveSet,
  sunTimes: SunTimes,
  currentHour: number,
): LightingPlanEvaluation {
  const brightness = useMemo(
    () => evaluateLightingCurve(curveSet.brightness, sunTimes),
    [curveSet.brightness, sunTimes],
  );

  const colorTemp = useMemo(
    () => evaluateLightingCurve(curveSet.colorTemp, sunTimes),
    [curveSet.colorTemp, sunTimes],
  );

  const colorModeWindow = useMemo(
    () => evaluateColorModeWindow(curveSet.colorMode, sunTimes),
    [curveSet.colorMode, sunTimes],
  );

  return useMemo(
    () => ({
      brightnessSamples: brightness.samples,
      colorTempSamples: colorTemp.samples,
      resolvedBrightness: brightness.resolved,
      resolvedColorTemp: colorTemp.resolved,
      colorModeWindow,
      sunTimes,
      currentHour,
    }),
    [brightness, colorTemp, colorModeWindow, sunTimes, currentHour],
  );
}
