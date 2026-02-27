import type { CurveSample, ResolvedCurve } from '../types/curves';
import { calculateValueAtHour } from './curvemath';

const NUM_SAMPLES = 201;

/** Generate evenly spaced curve samples across 0–24 hours. */
export function generateCurveSamples(resolved: ResolvedCurve): CurveSample[] {
  const samples: CurveSample[] = [];
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const hour = (i / (NUM_SAMPLES - 1)) * 24;
    samples.push({
      hour,
      value: calculateValueAtHour(hour, resolved),
    });
  }
  return samples;
}
