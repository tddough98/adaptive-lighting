import type { CurveSet, SunTimes } from '../types/curves';
import { DEFAULT_CURVE_SET } from './defaults';
import { getMockSunTimes } from './mockSunTimes';

export interface PanelData {
  curveSet: CurveSet;
  sunTimes: SunTimes;
  currentHour: number;
}

export function getMockData(): PanelData {
  const now = new Date();
  return {
    curveSet: DEFAULT_CURVE_SET,
    sunTimes: getMockSunTimes(now),
    currentHour: now.getHours() + now.getMinutes() / 60,
  };
}
