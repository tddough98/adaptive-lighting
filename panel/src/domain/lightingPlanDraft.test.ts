import { describe, expect, it } from 'vitest';
import { DEFAULT_CURVE_SET } from '../data/defaults';
import type { CurveSet, SunTimes } from '../types/curves';
import { resolveCurve } from '../utils/curvemath';
import { applyLightingPlanDraftAction } from './lightingPlanDraft';

const SUN_TIMES: SunTimes = {
  sunriseHour: 6,
  sunsetHour: 18,
};

function cloneCurveSet(curveSet: CurveSet = DEFAULT_CURVE_SET): CurveSet {
  return structuredClone(curveSet);
}

describe('applyLightingPlanDraftAction', () => {
  it('clips invalid timing edits through the draft module', () => {
    const next = applyLightingPlanDraftAction(cloneCurveSet(), {
      type: 'UPDATE_TIME_POINT',
      curveName: 'brightness',
      pointType: 'transition_start',
      newValue: 360,
      newYValue: 80,
      sunTimes: SUN_TIMES,
    });

    const resolved = resolveCurve(next.brightness, SUN_TIMES);
    expect(resolved.p1).toBe(15);
    expect(next.brightness.transitionStart.value).toBe(-180);
  });

  it('keeps linked timing shared while preserving the other curve values', () => {
    const next = applyLightingPlanDraftAction(cloneCurveSet(), {
      type: 'UPDATE_TIME_POINT',
      curveName: 'brightness',
      pointType: 'transition_start',
      newValue: -120,
      newYValue: 70,
      sunTimes: SUN_TIMES,
    });

    expect(next.brightness.transitionStart.value).toBe(next.colorTemp.transitionStart.value);
    expect(next.colorTemp.transitionStart.yValue).toBe(5500);
    expect(next.colorTemp.peak.value).toBe(5500);
  });

  it('leaves the other curve timing unchanged when linked timing is off', () => {
    const plan = cloneCurveSet();
    plan.linked = false;

    const next = applyLightingPlanDraftAction(plan, {
      type: 'UPDATE_TIME_POINT',
      curveName: 'brightness',
      pointType: 'transition_start',
      newValue: -120,
      newYValue: 70,
      sunTimes: SUN_TIMES,
    });

    expect(next.brightness.transitionStart.value).toBe(-120);
    expect(next.colorTemp.transitionStart.value).toBe(DEFAULT_CURVE_SET.colorTemp.transitionStart.value);
  });

  it('mirrors brightness timing to color temperature when linked timing is enabled', () => {
    const plan = cloneCurveSet();
    plan.linked = false;
    plan.brightness.transitionStart = { ...plan.brightness.transitionStart, value: -90 };
    plan.brightness.peak = { ...plan.brightness.peak, hour: 14 };

    const next = applyLightingPlanDraftAction(plan, {
      type: 'TOGGLE_LINKED',
    });

    expect(next.linked).toBe(true);
    expect(next.colorTemp.transitionStart.value).toBe(-90);
    expect(next.colorTemp.transitionStart.yValue).toBe(5500);
    expect(next.colorTemp.peak.hour).toBe(14);
    expect(next.colorTemp.peak.value).toBe(5500);
  });

  it('enforces the value hierarchy after point edits', () => {
    const next = applyLightingPlanDraftAction(cloneCurveSet(), {
      type: 'UPDATE_VALLEY',
      curveName: 'brightness',
      newHour: 2,
      newValue: 60,
      sunTimes: SUN_TIMES,
    });

    expect(next.brightness.valley.value).toBe(60);
    expect(next.brightness.holdStart.yValue).toBe(60);
    expect(next.brightness.holdEnd.yValue).toBe(60);
    expect(next.brightness.transitionStart.yValue).toBe(100);
    expect(next.brightness.transitionEnd.yValue).toBe(100);
    expect(next.brightness.peak.value).toBe(100);
  });

  it('clamps edited values to the curve range before applying hierarchy', () => {
    const next = applyLightingPlanDraftAction(cloneCurveSet(), {
      type: 'UPDATE_TIME_POINT',
      curveName: 'brightness',
      pointType: 'hold_start',
      newValue: 23,
      newYValue: 120,
      sunTimes: SUN_TIMES,
    });

    expect(next.brightness.holdStart.yValue).toBe(100);
    expect(next.brightness.transitionStart.yValue).toBe(100);
    expect(next.brightness.peak.value).toBe(100);
  });

  it('remaps color temperature values when the value range changes', () => {
    const next = applyLightingPlanDraftAction(cloneCurveSet(), {
      type: 'UPDATE_COLOR_TEMP_RANGE',
      newMin: 2200,
      newMax: 5000,
    });

    expect(next.colorTemp.minValue).toBe(2200);
    expect(next.colorTemp.maxValue).toBe(5000);
    expect(next.colorTemp.peak.value).toBe(5000);
    expect(next.colorTemp.transitionStart.yValue).toBe(5000);
    expect(next.colorTemp.valley.value).toBe(2200);
    expect(next.colorTemp.holdStart.yValue).toBe(2200);
  });

  it('updates sun-relative color mode boundary offsets', () => {
    const next = applyLightingPlanDraftAction(cloneCurveSet(), {
      type: 'UPDATE_COLOR_MODE_BOUNDARY',
      boundary: 'start',
      newHour: 7.5,
      sunTimes: SUN_TIMES,
    });

    expect(next.colorMode.colorTempStartHour).toBeNull();
    expect(next.colorMode.startOffsetMinutes).toBe(90);
  });
});
