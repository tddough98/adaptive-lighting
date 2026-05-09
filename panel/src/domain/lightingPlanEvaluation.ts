import type {
  ColorModeConfig,
  CurveDefinition,
  CurveSample,
  CurveSet,
  ResolvedCurve,
  SunTimes,
} from '../types/curves';
import { resolveCurve } from '../utils/curvemath';
import { generateCurveSamples } from '../utils/pathgen';

export interface EvaluatedColorModeWindow {
  startHour: number;
  endHour: number;
}

export interface LightingPlanEvaluation {
  brightnessSamples: CurveSample[];
  colorTempSamples: CurveSample[];
  resolvedBrightness: ResolvedCurve;
  resolvedColorTemp: ResolvedCurve;
  colorModeWindow: EvaluatedColorModeWindow;
  sunTimes: SunTimes;
  currentHour: number;
}

export interface LightingCurveEvaluation {
  resolved: ResolvedCurve;
  samples: CurveSample[];
}

export function evaluateColorModeWindow(
  config: ColorModeConfig,
  sunTimes: SunTimes,
): EvaluatedColorModeWindow {
  return {
    startHour: config.colorTempStartHour !== null
      ? config.colorTempStartHour
      : sunTimes.sunriseHour + config.startOffsetMinutes / 60,
    endHour: config.colorTempEndHour !== null
      ? config.colorTempEndHour
      : sunTimes.sunsetHour + config.endOffsetMinutes / 60,
  };
}

export function evaluateLightingCurve(
  curve: CurveDefinition,
  sunTimes: SunTimes,
): LightingCurveEvaluation {
  const resolved = resolveCurve(curve, sunTimes);

  return {
    resolved,
    samples: generateCurveSamples(resolved),
  };
}

export function evaluateLightingPlan(
  curveSet: CurveSet,
  sunTimes: SunTimes,
  currentHour: number,
): LightingPlanEvaluation {
  const brightness = evaluateLightingCurve(curveSet.brightness, sunTimes);
  const colorTemp = evaluateLightingCurve(curveSet.colorTemp, sunTimes);

  return {
    brightnessSamples: brightness.samples,
    colorTempSamples: colorTemp.samples,
    resolvedBrightness: brightness.resolved,
    resolvedColorTemp: colorTemp.resolved,
    colorModeWindow: evaluateColorModeWindow(curveSet.colorMode, sunTimes),
    sunTimes,
    currentHour,
  };
}
