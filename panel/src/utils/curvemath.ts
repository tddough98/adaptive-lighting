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
 *
 * Sharpness controls both the transition shape AND where the curve is
 * at the midpoint (progress=0.5):
 *   sharpness=0 → value ≈ startVal at midpoint (transition happens late)
 *   sharpness=0.5 → value = (startVal+endVal)/2 (symmetric S-curve)
 *   sharpness=1 → value ≈ endVal at midpoint (transition happens early)
 *
 * Uses a biased tanh S-curve: the sigmoid center shifts so the curve
 * passes through the sharpness-determined value at progress=0.5, with
 * adaptive steepness to ensure endpoints are reached.
 */
export function interpolateWithSharpness(
  progress: number,
  sharpness: number,
  startVal: number,
  endVal: number,
): number {
  // Clamp to avoid atanh(±1) singularity
  const s = Math.max(0.01, Math.min(0.99, sharpness));
  const u = 2 * s - 1;
  const halfArg = Math.atanh(u);

  // Adaptive k: base steepness of 5, increased for extreme biases
  // to ensure the curve still reaches ~0/1 at both endpoints.
  const k = Math.max(5, 5 + 2 * Math.abs(halfArg));

  // Bias: shift the sigmoid center so that at progress=0.5, t = s
  const b = 0.5 - halfArg / k;

  const t = (Math.tanh((progress - b) * k) + 1) / 2;
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
