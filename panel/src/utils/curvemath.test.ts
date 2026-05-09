import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CURVE_SET } from '../data/defaults';
import { evaluateLightingPlan } from '../domain/lightingPlanEvaluation';
import type { SunTimes } from '../types/curves';
import { calculateValueAtHour } from './curvemath';

interface EvaluationFixture {
  version: number;
  scenarios: Array<{
    id: string;
    sunTimes: SunTimes;
    resolvedCurves: {
      brightness: Record<string, number>;
      colorTemp: Record<string, number>;
    };
    colorModeWindow: {
      startHour: number;
      endHour: number;
    };
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
    const evaluation = evaluateLightingPlan(DEFAULT_CURVE_SET, defaultScenario.sunTimes, 12);

    for (const sample of defaultScenario.samples) {
      expect(calculateValueAtHour(sample.hour, evaluation.resolvedBrightness)).toBeCloseTo(sample.brightness, 2);
    }
  });

  it('matches default Color Temperature Curve fixture values', () => {
    const evaluation = evaluateLightingPlan(DEFAULT_CURVE_SET, defaultScenario.sunTimes, 12);

    for (const sample of defaultScenario.samples) {
      expect(calculateValueAtHour(sample.hour, evaluation.resolvedColorTemp)).toBeCloseTo(sample.colorTemp, 2);
    }
  });

  it('matches default resolved curve fixture values', () => {
    const evaluation = evaluateLightingPlan(DEFAULT_CURVE_SET, defaultScenario.sunTimes, 12);

    expect(evaluation.resolvedBrightness).toEqual(defaultScenario.resolvedCurves.brightness);
    expect(evaluation.resolvedColorTemp).toEqual(defaultScenario.resolvedCurves.colorTemp);
    expect(evaluation.colorModeWindow).toEqual(defaultScenario.colorModeWindow);
  });
});
