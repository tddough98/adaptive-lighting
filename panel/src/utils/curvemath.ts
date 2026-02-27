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
    p1Value: curve.transitionStart.yValue,
    p2Value: curve.holdStart.yValue,
    p4Value: curve.holdEnd.yValue,
    p5Value: curve.transitionEnd.yValue,
    peakHour: curve.peak.hour,
    peakValue: curve.peak.value,
    valleyHour: curve.valley.hour,
    valleyValue: curve.valley.value,
    eveningSharpness: curve.eveningSharpness,
    morningSharpness: curve.morningSharpness,
    minValue: curve.minValue,
    maxValue: curve.maxValue,
  };
}

/** Check if hour is within the arc from start to end (handles midnight wrap). */
export function isInArc(hour: number, start: number, end: number): boolean {
  if (start <= end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

/** Determine which phase a given hour falls in (6-segment model). */
export function getPhase(
  hour: number,
  p1: number,
  p2: number,
  valleyHour: number,
  p4: number,
  p5: number,
  peakHour: number,
): CurvePhase {
  if (isInArc(hour, p1, p2)) return 'evening_transition';
  if (isInArc(hour, p2, valleyHour)) return 'descent_to_valley';
  if (isInArc(hour, valleyHour, p4)) return 'ascent_from_valley';
  if (isInArc(hour, p4, p5)) return 'morning_transition';
  if (isInArc(hour, p5, peakHour)) return 'ascent_to_peak';
  return 'descent_from_peak';
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

/** Cosine interpolation for smooth zero-derivative joins. */
export function cosineInterpolate(
  progress: number,
  startVal: number,
  endVal: number,
): number {
  const t = (1 - Math.cos(progress * Math.PI)) / 2;
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
  const {
    p1, p2, p4, p5,
    p1Value, p2Value, p4Value, p5Value,
    peakHour, peakValue, valleyHour, valleyValue,
  } = resolved;

  const phase = getPhase(hour, p1, p2, valleyHour, p4, p5, peakHour);

  switch (phase) {
    case 'evening_transition': {
      const duration = elapsedHours(p1, p2);
      const elapsed = elapsedHours(p1, hour);
      const progress = duration > 0 ? elapsed / duration : 0;
      return interpolateWithSharpness(progress, resolved.eveningSharpness, p1Value, p2Value);
    }

    case 'descent_to_valley': {
      const duration = elapsedHours(p2, valleyHour);
      const elapsed = elapsedHours(p2, hour);
      const progress = duration > 0 ? elapsed / duration : 0;
      return cosineInterpolate(progress, p2Value, valleyValue);
    }

    case 'ascent_from_valley': {
      const duration = elapsedHours(valleyHour, p4);
      const elapsed = elapsedHours(valleyHour, hour);
      const progress = duration > 0 ? elapsed / duration : 0;
      return cosineInterpolate(progress, valleyValue, p4Value);
    }

    case 'morning_transition': {
      const duration = elapsedHours(p4, p5);
      const elapsed = elapsedHours(p4, hour);
      const progress = duration > 0 ? elapsed / duration : 0;
      return interpolateWithSharpness(progress, resolved.morningSharpness, p4Value, p5Value);
    }

    case 'ascent_to_peak': {
      const duration = elapsedHours(p5, peakHour);
      const elapsed = elapsedHours(p5, hour);
      const progress = duration > 0 ? elapsed / duration : 0;
      return cosineInterpolate(progress, p5Value, peakValue);
    }

    case 'descent_from_peak': {
      const duration = elapsedHours(peakHour, p1);
      const elapsed = elapsedHours(peakHour, hour);
      const progress = duration > 0 ? elapsed / duration : 0;
      return cosineInterpolate(progress, peakValue, p1Value);
    }
  }
}
