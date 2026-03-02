import type { CurveName, CurveSet, ResolvedCurve, SunTimes, TimingPointType } from '../types/curves';
import { resolveCurve } from './curvemath';

export interface TimePointConstraints {
  minHour: number;
  maxHour: number;
  snapMinutes: number;
}

const MIN_GAP_MINUTES = 15;
const MIN_GAP_HOURS = MIN_GAP_MINUTES / 60;

/**
 * Get the allowed hour range for a given timing point.
 * P1: sunset−180min … P2−15min
 * P2: P1+15min … 23:59
 * P4: 00:00 … P5−15min
 * P5: P4+15min … sunrise+180min
 */
export function getTimePointConstraints(
  pointType: TimingPointType,
  curveSet: CurveSet,
  sunTimes: SunTimes,
  curveName: CurveName = 'brightness',
): TimePointConstraints {
  const resolved = resolveCurve(curveSet[curveName], sunTimes);

  switch (pointType) {
    case 'transition_start': // P1
      return {
        minHour: sunTimes.sunsetHour - 3, // sunset − 180min
        maxHour: resolved.p2 - MIN_GAP_HOURS,
        snapMinutes: 5,
      };
    case 'hold_start': // P2
      return {
        minHour: resolved.p1 + MIN_GAP_HOURS,
        maxHour: 24 - 1 / 60, // 23:59
        snapMinutes: 5,
      };
    case 'hold_end': // P4
      return {
        minHour: 0,
        maxHour: resolved.p5 - MIN_GAP_HOURS,
        snapMinutes: 5,
      };
    case 'transition_end': // P5
      return {
        minHour: resolved.p4 + MIN_GAP_HOURS,
        maxHour: sunTimes.sunriseHour + 3, // sunrise + 180min
        snapMinutes: 5,
      };
  }
}

/** Snap a decimal hour to the nearest N-minute increment. */
export function snapToMinutes(hour: number, snapMinutes: number): number {
  const totalMinutes = hour * 60;
  const snapped = Math.round(totalMinutes / snapMinutes) * snapMinutes;
  return snapped / 60;
}

/**
 * Convert an absolute hour back to the stored timing value.
 * For relative points (P1, P5): returns minutes offset from sun anchor.
 * For absolute points (P2, P4): returns the absolute hour.
 */
export function absoluteHourToTimingValue(
  hour: number,
  pointType: TimingPointType,
  sunTimes: SunTimes,
): number {
  switch (pointType) {
    case 'transition_start': {
      // Relative to sunset, value is in minutes
      return (hour - sunTimes.sunsetHour) * 60;
    }
    case 'transition_end': {
      // Relative to sunrise, value is in minutes
      return (hour - sunTimes.sunriseHour) * 60;
    }
    case 'hold_start':
    case 'hold_end':
      // Absolute hour
      return hour;
  }
}

/** Clamp a Y-value to [minValue, maxValue] and snap to integer. */
export function constrainYValue(raw: number, minValue: number, maxValue: number): number {
  return Math.max(minValue, Math.min(maxValue, Math.round(raw)));
}

/** Get hour constraints for the Peak point (daytime: P5 → P1). */
export function getPeakConstraints(resolved: ResolvedCurve): { minHour: number; maxHour: number } {
  const minHour = resolved.p5 + MIN_GAP_HOURS;
  const maxHour = resolved.p1 - MIN_GAP_HOURS;
  return { minHour, maxHour };
}

/** Get hour constraints for the Valley point (nighttime: P2 → P4). */
export function getValleyConstraints(resolved: ResolvedCurve): { minHour: number; maxHour: number } {
  const minHour = resolved.p2 + MIN_GAP_HOURS;
  const maxHour = resolved.p4 - MIN_GAP_HOURS;
  return { minHour, maxHour };
}

