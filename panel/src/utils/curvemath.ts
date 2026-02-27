import type {
  CurveDefinition,
  CurvePhase,
  ResolvedCurve,
  SunTimes,
  TimingPoint,
} from '../types/curves';

/** Convert a TimingPoint to an absolute decimal hour (0–24). */
export function resolveTime(point: TimingPoint, sunTimes: SunTimes): number {
  if (!point.isRelative) {
    return point.value;
  }
  const base =
    point.anchor === 'sunset' ? sunTimes.sunsetHour : sunTimes.sunriseHour;
  // value is in minutes
  let hour = base + point.value / 60;
  // Normalise to [0, 24)
  if (hour < 0) hour += 24;
  if (hour >= 24) hour -= 24;
  return hour;
}

/** Resolve all timing points in a CurveDefinition to absolute hours. */
export function resolveCurve(
  curve: CurveDefinition,
  sunTimes: SunTimes,
): ResolvedCurve {
  return {
    p1: resolveTime(curve.transitionStart, sunTimes),
    p2: resolveTime(curve.holdStart, sunTimes),
    p4: resolveTime(curve.holdEnd, sunTimes),
    p5: resolveTime(curve.transitionEnd, sunTimes),
    eveningSharpness: curve.eveningSharpness,
    morningSharpness: curve.morningSharpness,
    minValue: curve.minValue,
    maxValue: curve.maxValue,
  };
}

/** Determine which phase a given hour falls in. Handles midnight crossover. */
export function getPhase(
  hour: number,
  p1: number,
  p2: number,
  p4: number,
  p5: number,
): CurvePhase {
  if (p2 > p4) {
    // Overnight hold (e.g. 23:00 → 05:30)
    if (hour >= p2 || hour <= p4) return 'hold';
    if (hour > p4 && hour < p5) return 'morning_transition';
    if (hour >= p1 && hour < p2) return 'evening_transition';
    return 'day';
  }
  // Same-day hold (unusual but supported)
  if (hour >= p2 && hour <= p4) return 'hold';
  if (hour > p4 && hour < p5) return 'morning_transition';
  if (hour >= p1 && hour < p2) return 'evening_transition';
  return 'day';
}

/**
 * Interpolate between start and end values with adjustable sharpness.
 * Uses tanh-based S-curve: k = 2 + sharpness * 8
 */
export function interpolateWithSharpness(
  progress: number,
  sharpness: number,
  startVal: number,
  endVal: number,
): number {
  let t: number;
  if (sharpness <= 0) {
    t = progress;
  } else {
    const k = 2 + sharpness * 8;
    t = (Math.tanh((progress - 0.5) * k) + 1) / 2;
  }
  return startVal + (endVal - startVal) * t;
}

/** Helper: elapsed hours between two times, handling midnight wrap. */
function elapsedHours(from: number, to: number): number {
  return to >= from ? to - from : to + 24 - from;
}

/** Calculate the curve value (brightness % or color temp K) at a given hour. */
export function calculateValueAtHour(
  hour: number,
  resolved: ResolvedCurve,
): number {
  const { p1, p2, p4, p5, minValue, maxValue } = resolved;
  const phase = getPhase(hour, p1, p2, p4, p5);

  switch (phase) {
    case 'day':
      return maxValue;

    case 'hold':
      return minValue;

    case 'evening_transition': {
      const duration = elapsedHours(p1, p2);
      const elapsed = elapsedHours(p1, hour);
      const progress = duration > 0 ? elapsed / duration : 0;
      return interpolateWithSharpness(
        progress,
        resolved.eveningSharpness,
        maxValue,
        minValue,
      );
    }

    case 'morning_transition': {
      const duration = elapsedHours(p4, p5);
      const elapsed = elapsedHours(p4, hour);
      const progress = duration > 0 ? elapsed / duration : 0;
      return interpolateWithSharpness(
        progress,
        resolved.morningSharpness,
        minValue,
        maxValue,
      );
    }
  }
}
