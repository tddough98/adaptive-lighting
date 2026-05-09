import type {
  CurveDefinition,
  CurvePhase,
  ExtremePoint,
  ResolvedCurve,
  SunTimes,
  TimingPoint,
} from '../types/curves';

// Internal evaluation math. Prefer domain modules for Lighting Plan behavior.

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

/** Convert an ExtremePoint to an absolute decimal hour (0–24). */
export function resolveExtremeTime(point: ExtremePoint, sunTimes: SunTimes): number {
  if (!point.isRelative || point.offsetMinutes == null) {
    return point.hour;
  }
  const base =
    point.anchor === 'sunset' ? sunTimes.sunsetHour : sunTimes.sunriseHour;
  let hour = base + point.offsetMinutes / 60;
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
    peakHour: resolveExtremeTime(curve.peak, sunTimes),
    peakValue: curve.peak.value,
    valleyHour: resolveExtremeTime(curve.valley, sunTimes),
    valleyValue: curve.valley.value,
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

/** Uniform Catmull-Rom spline evaluation at parameter t ∈ [0,1] using 4 control point values. */
export function catmullRom(t: number, p0: number, p1: number, p2: number, p3: number): number {
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
  );
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
    minValue, maxValue,
  } = resolved;

  const phase = getPhase(hour, p1, p2, valleyHour, p4, p5, peakHour);

  // Cyclic Catmull-Rom: each segment uses 4 surrounding point values
  // Points in order: P1, P2, Valley, P4, P5, Peak (wrapping cyclically)
  let raw: number;
  switch (phase) {
    case 'evening_transition': {
      const duration = elapsedHours(p1, p2);
      const t = duration > 0 ? elapsedHours(p1, hour) / duration : 0;
      raw = catmullRom(t, peakValue, p1Value, p2Value, valleyValue);
      break;
    }
    case 'descent_to_valley': {
      const duration = elapsedHours(p2, valleyHour);
      const t = duration > 0 ? elapsedHours(p2, hour) / duration : 0;
      raw = catmullRom(t, p1Value, p2Value, valleyValue, p4Value);
      break;
    }
    case 'ascent_from_valley': {
      const duration = elapsedHours(valleyHour, p4);
      const t = duration > 0 ? elapsedHours(valleyHour, hour) / duration : 0;
      raw = catmullRom(t, p2Value, valleyValue, p4Value, p5Value);
      break;
    }
    case 'morning_transition': {
      const duration = elapsedHours(p4, p5);
      const t = duration > 0 ? elapsedHours(p4, hour) / duration : 0;
      raw = catmullRom(t, valleyValue, p4Value, p5Value, peakValue);
      break;
    }
    case 'ascent_to_peak': {
      const duration = elapsedHours(p5, peakHour);
      const t = duration > 0 ? elapsedHours(p5, hour) / duration : 0;
      raw = catmullRom(t, p4Value, p5Value, peakValue, p1Value);
      break;
    }
    case 'descent_from_peak': {
      const duration = elapsedHours(peakHour, p1);
      const t = duration > 0 ? elapsedHours(peakHour, hour) / duration : 0;
      raw = catmullRom(t, p5Value, peakValue, p1Value, p2Value);
      break;
    }
  }

  // Clamp to prevent Catmull-Rom overshoot beyond valid range
  return Math.max(minValue, Math.min(maxValue, raw));
}
