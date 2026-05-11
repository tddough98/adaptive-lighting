import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CURVE_SET } from '../data/defaults';
import type { HassEntity, HomeAssistant } from '../types/homeassistant';
import {
  evaluateDraftStaleness,
  listAdaptiveLightingInstances,
  requiresEnhancedModeOptIn,
  saveLightingPlan,
  saveStatusAfterRejectedServiceCall,
  saveStatusAfterSuccessfulServiceCall,
  saveStatusBeforeServiceCall,
  selectAdaptiveLightingInstance,
} from './adaptiveLightingInstanceAdapter';
import { curveSetToServiceData, entityToSavedLightingPlan } from './dataConversion';

function entity(
  entityId: string,
  brightnessMode: string,
  extraConfig: Record<string, unknown> = {},
  includeEnhancedCurves = true,
): HassEntity {
  const enhancedCurveConfig = includeEnhancedCurves
    ? {
        enhanced_brightness_curve: curveSetToServiceData(DEFAULT_CURVE_SET).enhanced_brightness_curve,
        enhanced_color_temp_curve: curveSetToServiceData(DEFAULT_CURVE_SET).enhanced_color_temp_curve,
      }
    : {};

  return {
    entity_id: entityId,
    state: 'on',
    last_changed: '2026-01-01T00:00:00+00:00',
    last_updated: `2026-01-01T00:00:0${entityId.endsWith('one') ? 1 : 2}+00:00`,
    attributes: {
      friendly_name: entityId,
      sunrise_hour: 6,
      sunset_hour: 18,
      configuration: {
        brightness_mode: brightnessMode,
        ...enhancedCurveConfig,
        ...extraConfig,
      },
    },
  };
}

describe('Adaptive Lighting Instance adapter', () => {
  it('lists adaptive lighting switch instances only', () => {
    const instances = listAdaptiveLightingInstances({
      'switch.adaptive_lighting_one': entity('switch.adaptive_lighting_one', 'default'),
      'light.kitchen': entity('light.kitchen', 'enhanced'),
    });

    expect(instances.map((instance) => instance.entityId)).toEqual(['switch.adaptive_lighting_one']);
  });

  it('auto-selects an enhanced mode instance before falling back to the first instance', () => {
    const selected = selectAdaptiveLightingInstance({
      'switch.adaptive_lighting_one': entity('switch.adaptive_lighting_one', 'default'),
      'switch.adaptive_lighting_two': entity('switch.adaptive_lighting_two', 'enhanced'),
    });

    expect(selected?.source).toBe('auto-enhanced');
    expect(selected?.instance.entityId).toBe('switch.adaptive_lighting_two');

    const fallback = selectAdaptiveLightingInstance({
      'switch.adaptive_lighting_one': entity('switch.adaptive_lighting_one', 'default'),
    });

    expect(fallback?.source).toBe('auto-first');
    expect(fallback?.instance.entityId).toBe('switch.adaptive_lighting_one');
  });

  it('selects a manually chosen Adaptive Lighting Instance when provided', () => {
    const selected = selectAdaptiveLightingInstance({
      'switch.adaptive_lighting_one': entity('switch.adaptive_lighting_one', 'default'),
      'switch.adaptive_lighting_two': entity('switch.adaptive_lighting_two', 'enhanced'),
    }, 'switch.adaptive_lighting_one');

    expect(selected?.source).toBe('manual');
    expect(selected?.instance.entityId).toBe('switch.adaptive_lighting_one');

    const stale = selectAdaptiveLightingInstance({
      'switch.adaptive_lighting_one': entity('switch.adaptive_lighting_one', 'enhanced'),
    }, 'switch.adaptive_lighting_two');

    expect(stale?.source).toBe('auto-enhanced');
    expect(stale?.instance.entityId).toBe('switch.adaptive_lighting_one');
  });

  it('defaults absent linked timing and color mode intent into the saved plan', () => {
    const savedPlan = entityToSavedLightingPlan(entity('switch.adaptive_lighting_one', 'enhanced'));

    expect(savedPlan.curveSet.linked).toBe(DEFAULT_CURVE_SET.linked);
    expect(savedPlan.curveSet.colorMode).toEqual(DEFAULT_CURVE_SET.colorMode);
  });

  it('requires explicit opt-in before saving a non-enhanced instance as Enhanced Mode', () => {
    const selected = selectAdaptiveLightingInstance({
      'switch.adaptive_lighting_one': entity('switch.adaptive_lighting_one', 'default'),
    });
    const enhanced = selectAdaptiveLightingInstance({
      'switch.adaptive_lighting_one': entity('switch.adaptive_lighting_one', 'enhanced'),
    });

    expect(requiresEnhancedModeOptIn(selected?.instance ?? null)).toBe(true);
    expect(requiresEnhancedModeOptIn(enhanced?.instance ?? null)).toBe(false);
    expect(requiresEnhancedModeOptIn(null)).toBe(false);
  });

  it('seeds non-enhanced instances from existing settings when enhanced curves are absent', () => {
    const savedPlan = entityToSavedLightingPlan(entity('switch.adaptive_lighting_one', 'linear', {
      min_brightness: 10,
      max_brightness: 90,
      min_color_temp: 2300,
      max_color_temp: 5100,
      brightness_mode_time_dark: 1200,
      brightness_mode_time_light: 5400,
      sleep_rgb_color: [12, 34, 56],
    }, false));

    expect(savedPlan.isEnhancedMode).toBe(false);
    expect(savedPlan.curveSet.brightness.minValue).toBe(10);
    expect(savedPlan.curveSet.brightness.maxValue).toBe(90);
    expect(savedPlan.curveSet.colorTemp.minValue).toBe(2300);
    expect(savedPlan.curveSet.colorTemp.maxValue).toBe(5100);
    expect(savedPlan.curveSet.brightness.transitionStart.value).toBe(-90);
    expect(savedPlan.curveSet.brightness.holdStart.value).toBe(20);
    expect(savedPlan.curveSet.colorMode.sleepRgbColor).toEqual([12, 34, 56]);
  });

  it('reads linked timing and color mode intent when HA provides them', () => {
    const savedPlan = entityToSavedLightingPlan(entity('switch.adaptive_lighting_one', 'enhanced', {
      enhanced_linked_timing: false,
      enhanced_color_mode: {
        color_temp_start_hour: 8,
        color_temp_end_hour: null,
        start_offset_minutes: 30,
        end_offset_minutes: -45,
        sleep_rgb_color: [1, 2, 3],
      },
    }));

    expect(savedPlan.curveSet.linked).toBe(false);
    expect(savedPlan.curveSet.colorMode).toEqual({
      colorTempStartHour: 8,
      colorTempEndHour: null,
      startOffsetMinutes: 30,
      endOffsetMinutes: -45,
      sleepRgbColor: [1, 2, 3],
    });
  });

  it('persists complete Lighting Plan intent in the HA save payload', () => {
    expect(curveSetToServiceData(DEFAULT_CURVE_SET)).toEqual({
      brightness_mode: 'enhanced',
      enhanced_brightness_curve: expect.any(Object),
      enhanced_color_temp_curve: expect.any(Object),
      enhanced_linked_timing: true,
      enhanced_color_mode: {
        color_temp_start_hour: DEFAULT_CURVE_SET.colorMode.colorTempStartHour,
        color_temp_end_hour: DEFAULT_CURVE_SET.colorMode.colorTempEndHour,
        start_offset_minutes: DEFAULT_CURVE_SET.colorMode.startOffsetMinutes,
        end_offset_minutes: DEFAULT_CURVE_SET.colorMode.endOffsetMinutes,
        sleep_rgb_color: DEFAULT_CURVE_SET.colorMode.sleepRgbColor,
      },
    });
  });

  it('round-trips peak and valley sun anchors through HA curve dictionaries', () => {
    const draft = structuredClone(DEFAULT_CURVE_SET);
    draft.brightness.peak = {
      hour: 13,
      value: 90,
      isRelative: true,
      anchor: 'sunrise',
      offsetMinutes: 390,
    };
    draft.brightness.valley = {
      hour: 2,
      value: 5,
      isRelative: true,
      anchor: 'sunset',
      offsetMinutes: 480,
    };

    const savedPlan = entityToSavedLightingPlan(entity('switch.adaptive_lighting_one', 'enhanced', {
      enhanced_brightness_curve: curveSetToServiceData(draft).enhanced_brightness_curve,
    }));

    expect(savedPlan.curveSet.brightness.peak).toEqual(draft.brightness.peak);
    expect(savedPlan.curveSet.brightness.valley).toEqual(draft.brightness.valley);
  });

  it('saves a Lighting Plan through the selected Adaptive Lighting Instance service target', async () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    const hass = {
      callService,
    } as unknown as HomeAssistant;

    await saveLightingPlan(hass, {
      entityId: 'switch.adaptive_lighting_one',
      curveSet: DEFAULT_CURVE_SET,
    });

    expect(callService).toHaveBeenCalledWith(
      'adaptive_lighting',
      'change_switch_settings',
      curveSetToServiceData(DEFAULT_CURVE_SET),
      { entity_id: 'switch.adaptive_lighting_one' },
    );
  });

  it('rejects failed Save Lighting Plan service calls', async () => {
    const callService = vi.fn().mockRejectedValue(new Error('service failed'));
    const hass = {
      callService,
    } as unknown as HomeAssistant;

    await expect(saveLightingPlan(hass, {
      entityId: 'switch.adaptive_lighting_one',
      curveSet: DEFAULT_CURVE_SET,
    })).rejects.toThrow('service failed');
  });

  it('reports confirmed save after a successful service call', () => {
    const savedPlan = entityToSavedLightingPlan(entity('switch.adaptive_lighting_one', 'enhanced', {
      enhanced_linked_timing: false,
      enhanced_color_mode: {
        color_temp_start_hour: null,
        color_temp_end_hour: null,
        start_offset_minutes: 0,
        end_offset_minutes: 0,
        sleep_rgb_color: [255, 56, 0],
      },
    }));
    const draft = structuredClone(savedPlan.curveSet);
    draft.linked = true;
    draft.colorMode.startOffsetMinutes = 30;

    expect(saveStatusAfterSuccessfulServiceCall(draft, savedPlan)).toEqual({
      type: 'confirmed',
    });
  });

  it('reports confirmed save when all draft intent included in the current payload is unchanged', () => {
    const savedPlan = entityToSavedLightingPlan(entity('switch.adaptive_lighting_one', 'enhanced'));

    expect(saveStatusBeforeServiceCall()).toEqual({ type: 'saving' });
    expect(saveStatusAfterSuccessfulServiceCall(savedPlan.curveSet, savedPlan)).toEqual({
      type: 'confirmed',
    });
  });

  it('reports rejected save status from service errors', () => {
    expect(saveStatusAfterRejectedServiceCall(new Error('service failed'))).toEqual({
      type: 'rejected',
      message: 'service failed',
    });
  });

  it('detects inbound stale changes for dirty drafts but ignores own-save echo after the draft is clean', () => {
    expect(evaluateDraftStaleness({
      dirty: true,
      draftSourceVersion: 'switch.adaptive_lighting_one:v1',
      currentSourceVersion: 'switch.adaptive_lighting_one:v2',
    })).toEqual({
      type: 'stale',
      message: 'Home Assistant changed this Saved Lighting Plan after this draft started.',
    });

    expect(evaluateDraftStaleness({
      dirty: false,
      draftSourceVersion: 'switch.adaptive_lighting_one:v1',
      currentSourceVersion: 'switch.adaptive_lighting_one:v2',
    })).toBeNull();
  });
});
