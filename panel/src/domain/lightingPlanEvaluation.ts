import type {
  ColorModeConfig,
  CurveDefinition,
  CurveSample,
  CurveSet,
  ResolvedCurve,
  SunTimes,
} from '../types/curves';
import { resolveCurve } from '../utils/curvemath';
import { clampHourInArc, getPeakConstraints, getValleyConstraints, MIN_GAP_HOURS } from '../utils/constraints';
import { generateCurveSamples } from '../utils/pathgen';

export interface EvaluatedColorModeWindow {
  startHour: number;
  endHour: number;
}

export interface LightingPlanClipping {
  brightness: boolean;
  colorTemp: boolean;
  colorModeWindow: boolean;
}

export interface LightingPlanEvaluation {
  brightnessSamples: CurveSample[];
  colorTempSamples: CurveSample[];
  resolvedBrightness: ResolvedCurve;
  resolvedColorTemp: ResolvedCurve;
  intendedBrightness: ResolvedCurve;
  intendedColorTemp: ResolvedCurve;
  colorModeWindow: EvaluatedColorModeWindow;
  intendedColorModeWindow: EvaluatedColorModeWindow;
  clipping: LightingPlanClipping;
  sunTimes: SunTimes;
  currentHour: number;
}

export interface LightingCurveEvaluation {
  resolved: ResolvedCurve;
  intended: ResolvedCurve;
  samples: CurveSample[];
  clipped: boolean;
}

function normalizeHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

function sameHour(left: number, right: number): boolean {
  return Math.abs(normalizeHour(left) - normalizeHour(right)) < 1e-9;
}

function sameResolvedCurve(left: ResolvedCurve, right: ResolvedCurve): boolean {
  return (
    sameHour(left.p1, right.p1) &&
    sameHour(left.p2, right.p2) &&
    sameHour(left.p4, right.p4) &&
    sameHour(left.p5, right.p5) &&
    sameHour(left.peakHour, right.peakHour) &&
    sameHour(left.valleyHour, right.valleyHour)
  );
}

function clampLinearHour(
  hour: number,
  minHour: number,
  maxHour: number,
  collisionBoundary: 'min' | 'max',
): number {
  if (minHour > maxHour) {
    // Full collision policy: p1 yields to p2 (max), p5 yields to p4 (min).
    return normalizeHour(collisionBoundary === 'min' ? minHour : maxHour);
  }
  return normalizeHour(Math.max(minHour, Math.min(maxHour, hour)));
}

function withTiming(source: ResolvedCurve, timing: ResolvedCurve): ResolvedCurve {
  return {
    ...source,
    p1: timing.p1,
    p2: timing.p2,
    p4: timing.p4,
    p5: timing.p5,
    peakHour: timing.peakHour,
    valleyHour: timing.valleyHour,
  };
}

function clipResolvedCurveTiming(resolved: ResolvedCurve, sunTimes: SunTimes): ResolvedCurve {
  const p1 = clampLinearHour(
    resolved.p1,
    Math.max(sunTimes.sunsetHour - 3, resolved.peakHour + MIN_GAP_HOURS),
    resolved.p2 - MIN_GAP_HOURS,
    'max',
  );
  const p5 = clampLinearHour(
    resolved.p5,
    resolved.p4 + MIN_GAP_HOURS,
    Math.min(sunTimes.sunriseHour + 3, resolved.peakHour - MIN_GAP_HOURS),
    'min',
  );
  const withTransitions = { ...resolved, p1, p5 };
  const valleyConstraints = getValleyConstraints(withTransitions);
  const valleyHour = normalizeHour(clampHourInArc(
    withTransitions.valleyHour,
    valleyConstraints.minHour,
    valleyConstraints.maxHour,
  ));
  const withValley = { ...withTransitions, valleyHour };
  const peakConstraints = getPeakConstraints(withValley);
  const peakHour = normalizeHour(clampHourInArc(
    withValley.peakHour,
    peakConstraints.minHour,
    peakConstraints.maxHour,
  ));

  return { ...withValley, peakHour };
}

function clipColorModeWindow(window: EvaluatedColorModeWindow): EvaluatedColorModeWindow {
  // Color Mode Window is treated as a non-wrapping daytime interval until Slice 9 finalizes the wire format.
  let startHour = Math.max(0, Math.min(24, window.startHour));
  let endHour = Math.max(0, Math.min(24, window.endHour));
  const minGap = 0.5;

  if (startHour > endHour - minGap) {
    startHour = Math.max(0, endHour - minGap);
  }
  if (endHour < startHour + minGap) {
    endHour = Math.min(24, startHour + minGap);
  }

  return { startHour, endHour };
}

function sameColorModeWindow(left: EvaluatedColorModeWindow, right: EvaluatedColorModeWindow): boolean {
  return sameHour(left.startHour, right.startHour) && sameHour(left.endHour, right.endHour);
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
  const intended = resolveCurve(curve, sunTimes);
  const resolved = clipResolvedCurveTiming(intended, sunTimes);

  return {
    intended,
    resolved,
    samples: generateCurveSamples(resolved),
    clipped: !sameResolvedCurve(intended, resolved),
  };
}

export function evaluateLightingPlan(
  curveSet: CurveSet,
  sunTimes: SunTimes,
  currentHour: number,
): LightingPlanEvaluation {
  const brightness = evaluateLightingCurve(curveSet.brightness, sunTimes);
  const rawColorTemp = evaluateLightingCurve(curveSet.colorTemp, sunTimes);
  // Linked timing uses brightness as the evaluated authority and reasserts shared timing if draft state drifts.
  const colorTempResolved = curveSet.linked
    ? withTiming(rawColorTemp.resolved, brightness.resolved)
    : rawColorTemp.resolved;
  const colorTemp = {
    ...rawColorTemp,
    resolved: colorTempResolved,
    samples: generateCurveSamples(colorTempResolved),
    clipped: rawColorTemp.clipped || !sameResolvedCurve(rawColorTemp.intended, colorTempResolved),
  };
  const intendedColorModeWindow = evaluateColorModeWindow(curveSet.colorMode, sunTimes);
  const colorModeWindow = clipColorModeWindow(intendedColorModeWindow);

  return {
    brightnessSamples: brightness.samples,
    colorTempSamples: colorTemp.samples,
    resolvedBrightness: brightness.resolved,
    resolvedColorTemp: colorTemp.resolved,
    intendedBrightness: brightness.intended,
    intendedColorTemp: colorTemp.intended,
    colorModeWindow,
    intendedColorModeWindow,
    clipping: {
      brightness: brightness.clipped,
      colorTemp: colorTemp.clipped,
      colorModeWindow: !sameColorModeWindow(intendedColorModeWindow, colorModeWindow),
    },
    sunTimes,
    currentHour,
  };
}
