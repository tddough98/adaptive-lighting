import SunCalc from 'suncalc';
import type { SunTimes } from '../types/curves';
import { MONTVALE_COORDS } from './defaults';

function dateToDecimalHour(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

export function getMockSunTimes(date: Date = new Date()): SunTimes {
  const times = SunCalc.getTimes(date, MONTVALE_COORDS.lat, MONTVALE_COORDS.lng);

  const sunriseHour = dateToDecimalHour(times.sunrise);
  const sunsetHour = dateToDecimalHour(times.sunset);

  return { sunriseHour, sunsetHour };
}
