import SunCalc from 'suncalc';
import type { SunTimes } from '../types/curves';

export interface YearSunData {
  sunTimesByDay: SunTimes[];
  year: number;
  daysInYear: number;
}

function dateToDecimalHour(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

function getDaysInYear(year: number): number {
  return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
}

export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24)) - 1; // 0-indexed: Jan 1 = 0
}

export function dayOfYearToDate(dayIndex: number, year: number): Date {
  const date = new Date(year, 0, 1);
  date.setDate(date.getDate() + dayIndex);
  return date;
}

export function precomputeYearSunData(
  lat: number,
  lng: number,
  year: number,
): YearSunData {
  const daysInYear = getDaysInYear(year);
  const sunTimesByDay: SunTimes[] = new Array(daysInYear);

  for (let d = 0; d < daysInYear; d++) {
    const date = new Date(year, 0, 1 + d);
    const times = SunCalc.getTimes(date, lat, lng);
    sunTimesByDay[d] = {
      sunriseHour: dateToDecimalHour(times.sunrise),
      sunsetHour: dateToDecimalHour(times.sunset),
    };
  }

  return { sunTimesByDay, year, daysInYear };
}
