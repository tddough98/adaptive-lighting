import SunCalc from 'suncalc';
import type { CurveSample } from '../types/curves';

export const SUN_ELEVATION_DOMAIN: [number, number] = [-90, 90];
export const SUN_ELEVATION_TICKS = [-90, -45, 0, 45, 90];

export function getSunElevationSamples(
  date: Date,
  lat: number,
  lng: number,
  numSamples = 288,
): CurveSample[] {
  const samples: CurveSample[] = [];
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  for (let i = 0; i < numSamples; i++) {
    const hour = (i / numSamples) * 24;
    const hours = Math.floor(hour);
    const minutes = Math.round((hour - hours) * 60);
    const sampleDate = new Date(year, month, day, hours, minutes);
    const { altitude } = SunCalc.getPosition(sampleDate, lat, lng);
    samples.push({ hour, value: altitude * (180 / Math.PI) });
  }

  return samples;
}
