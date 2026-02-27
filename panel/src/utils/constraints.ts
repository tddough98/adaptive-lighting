import type { CurveSet, SunTimes, TimingPointType } from '../types/curves';
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
): TimePointConstraints {
  const resolved = resolveCurve(curveSet.brightness, sunTimes);

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

/** Clamp sharpness to [0, 1] and snap to 0.05 increments. */
export function constrainSharpness(raw: number): number {
  const clamped = Math.max(0, Math.min(1, raw));
  return Math.round(clamped / 0.05) * 0.05;
}

