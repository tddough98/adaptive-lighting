import { describe, expect, it } from 'vitest';
import { DEFAULT_CURVE_SET } from '../data/defaults';
import type { CurveSet } from '../types/curves';
import { evaluateColorModeWindow, evaluateColorPreferenceAtHour, evaluateLightingPlan } from './lightingPlanEvaluation';

function cloneCurveSet(curveSet: CurveSet = DEFAULT_CURVE_SET): CurveSet {
  return structuredClone(curveSet);
}

describe('evaluateLightingPlan', () => {
  it('does not clip the default valid Lighting Plan', () => {
    const evaluation = evaluateLightingPlan(DEFAULT_CURVE_SET, {
      sunriseHour: 6.5,
      sunsetHour: 18.75,
    }, 12);

    expect(evaluation.clipping).toEqual({
      brightness: false,
      colorTemp: false,
      colorModeWindow: false,
    });
    expect(evaluation.resolvedBrightness).toEqual(evaluation.intendedBrightness);
    expect(evaluation.resolvedColorTemp).toEqual(evaluation.intendedColorTemp);
  });

  it('clips sun-relative evening timing in evaluated state without mutating draft intent', () => {
    const plan = cloneCurveSet();
    const evaluation = evaluateLightingPlan(plan, {
      sunriseHour: 6,
      sunsetHour: 23.75,
    }, 12);

    expect(evaluation.intendedBrightness.p1).toBe(23.25);
    expect(evaluation.resolvedBrightness.p1).toBe(22.75);
    expect(evaluation.resolvedColorTemp.p1).toBe(22.75);
    expect(evaluation.clipping.brightness).toBe(true);
    expect(evaluation.clipping.colorTemp).toBe(true);
    expect(plan.brightness.transitionStart.value).toBe(-30);
  });

  it('allows unlinked curves to clip independently', () => {
    const plan = cloneCurveSet();
    plan.linked = false;
    plan.colorTemp.transitionStart = {
      ...plan.colorTemp.transitionStart,
      value: -120,
    };

    const evaluation = evaluateLightingPlan(plan, {
      sunriseHour: 6,
      sunsetHour: 23.75,
    }, 12);

    expect(evaluation.resolvedBrightness.p1).toBe(22.75);
    expect(evaluation.resolvedColorTemp.p1).toBe(21.75);
    expect(evaluation.clipping.brightness).toBe(true);
    expect(evaluation.clipping.colorTemp).toBe(false);
  });

  it('reasserts linked evaluated timing when linked draft intent has drifted', () => {
    const plan = cloneCurveSet();
    plan.linked = true;
    plan.colorTemp.transitionStart = {
      ...plan.colorTemp.transitionStart,
      value: -120,
    };

    const evaluation = evaluateLightingPlan(plan, {
      sunriseHour: 6,
      sunsetHour: 23.75,
    }, 12);

    expect(evaluation.intendedBrightness.p1).toBe(23.25);
    expect(evaluation.intendedColorTemp.p1).toBe(21.75);
    expect(evaluation.resolvedBrightness.p1).toBe(22.75);
    expect(evaluation.resolvedColorTemp.p1).toBe(22.75);
  });

  it('clips invalid Color Mode Window evaluation without changing intent', () => {
    const plan = cloneCurveSet();
    plan.colorMode = {
      ...plan.colorMode,
      colorTempStartHour: 20,
      colorTempEndHour: 20.25,
    };

    const evaluation = evaluateLightingPlan(plan, {
      sunriseHour: 6,
      sunsetHour: 18,
    }, 12);

    expect(evaluation.intendedColorModeWindow).toEqual({
      startHour: 20,
      endHour: 20.25,
    });
    expect(evaluation.colorModeWindow).toEqual({
      startHour: 19.75,
      endHour: 20.25,
    });
    expect(evaluation.clipping.colorModeWindow).toBe(true);
  });

  it('evaluates the current color preference from the clipped Color Mode Window', () => {
    const plan = cloneCurveSet();
    plan.colorMode = {
      ...plan.colorMode,
      colorTempStartHour: 8,
      colorTempEndHour: 18,
    };

    expect(evaluateLightingPlan(plan, {
      sunriseHour: 6,
      sunsetHour: 18,
    }, 12).currentColorPreference).toBe('colorTemp');
    expect(evaluateLightingPlan(plan, {
      sunriseHour: 6,
      sunsetHour: 18,
    }, 22).currentColorPreference).toBe('rgb');
  });
});

describe('evaluateColorModeWindow', () => {
  it('resolves relative boundaries against current sun times', () => {
    expect(evaluateColorModeWindow(DEFAULT_CURVE_SET.colorMode, {
      sunriseHour: 6.25,
      sunsetHour: 19,
    })).toEqual({
      startHour: 6.25,
      endHour: 19,
    });
  });

  it('wraps out-of-range relative boundaries modulo 24 to match runtime', () => {
    const config = {
      ...DEFAULT_CURVE_SET.colorMode,
      colorTempStartHour: null,
      startOffsetMinutes: -480,
    };

    expect(evaluateColorModeWindow(config, {
      sunriseHour: 6.5,
      sunsetHour: 18.75,
    }).startHour).toBe(22.5);
  });
});

describe('evaluateColorPreferenceAtHour', () => {
  it('uses color temperature inside a wrapping window and RGB outside it', () => {
    const window = { startHour: 22.5, endHour: 18.75 };

    expect(evaluateColorPreferenceAtHour(23, window)).toBe('colorTemp');
    expect(evaluateColorPreferenceAtHour(12, window)).toBe('colorTemp');
    expect(evaluateColorPreferenceAtHour(20, window)).toBe('rgb');
  });
});
