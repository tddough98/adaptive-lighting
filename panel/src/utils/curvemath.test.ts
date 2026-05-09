import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CURVE_SET } from '../data/defaults';
import type { SunTimes } from '../types/curves';
import { calculateValueAtHour, resolveCurve } from './curvemath';

interface EvaluationFixture {
  version: number;
  scenarios: Array<{
    id: string;
    sunTimes: SunTimes;
    samples: Array<{
      hour: number;
      brightness: number;
      colorTemp: number;
    }>;
  }>;
}

const fixtureUrl = new URL('../../fixtures/lighting-plan-evaluation.json', import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, 'utf8')) as EvaluationFixture;
const defaultScenario = fixture.scenarios.find((scenario) => scenario.id === 'default-lighting-plan');

if (!defaultScenario) {
  throw new Error('Missing default-lighting-plan fixture scenario');
}

describe('curvemath parity fixtures', () => {
  it('matches default Brightness Curve fixture values', () => {
    const resolved = resolveCurve(DEFAULT_CURVE_SET.brightness, defaultScenario.sunTimes);

    for (const sample of defaultScenario.samples) {
      expect(calculateValueAtHour(sample.hour, resolved)).toBeCloseTo(sample.brightness, 2);
    }
  });

  it('matches default Color Temperature Curve fixture values', () => {
    const resolved = resolveCurve(DEFAULT_CURVE_SET.colorTemp, defaultScenario.sunTimes);

    for (const sample of defaultScenario.samples) {
      expect(calculateValueAtHour(sample.hour, resolved)).toBeCloseTo(sample.colorTemp, 2);
    }
  });
});
