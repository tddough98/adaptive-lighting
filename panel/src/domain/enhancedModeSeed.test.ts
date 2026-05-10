import { describe, expect, it } from 'vitest';
import { DEFAULT_CURVE_SET } from '../data/defaults';
import { createEnhancedModeSeed } from './enhancedModeSeed';

describe('createEnhancedModeSeed', () => {
  it('preserves existing brightness and color temperature ranges', () => {
    const seed = createEnhancedModeSeed({
      min_brightness: 12,
      max_brightness: 88,
      min_color_temp: 2400,
      max_color_temp: 5000,
    });

    expect(seed.brightness.minValue).toBe(12);
    expect(seed.brightness.maxValue).toBe(88);
    expect(seed.brightness.valley.value).toBe(12);
    expect(seed.brightness.peak.value).toBe(88);
    expect(seed.colorTemp.minValue).toBe(2400);
    expect(seed.colorTemp.maxValue).toBe(5000);
    expect(seed.colorTemp.holdStart.yValue).toBe(2400);
    expect(seed.colorTemp.transitionEnd.yValue).toBe(5000);
  });

  it('maps legacy sun transition windows into linked sun-relative timing', () => {
    const seed = createEnhancedModeSeed({
      brightness_mode_time_dark: 1800,
      brightness_mode_time_light: 7200,
    });

    // Seeded plans default to linked timing unless HA has first-class linked intent.
    expect(seed.linked).toBe(true);
    expect(seed.brightness.transitionStart).toMatchObject({
      value: -120,
      isRelative: true,
      anchor: 'sunset',
    });
    expect(seed.brightness.holdStart).toMatchObject({
      value: 30,
      isRelative: true,
      anchor: 'sunset',
    });
    expect(seed.brightness.holdEnd).toMatchObject({
      value: -30,
      isRelative: true,
      anchor: 'sunrise',
    });
    expect(seed.brightness.transitionEnd).toMatchObject({
      value: 120,
      isRelative: true,
      anchor: 'sunrise',
    });
    expect(seed.colorTemp.transitionStart.value).toBe(seed.brightness.transitionStart.value);
    expect(seed.colorTemp.holdStart.value).toBe(seed.brightness.holdStart.value);
  });

  it('preserves sleep RGB in the draft while leaving full persistence to Slice 9', () => {
    const seed = createEnhancedModeSeed({
      sleep_rgb_color: [8, 16, 32],
    });

    expect(seed.colorMode.sleepRgbColor).toEqual([8, 16, 32]);
  });

  it('falls back to upstream HA defaults when settings are absent', () => {
    const seed = createEnhancedModeSeed({});

    expect(seed.brightness.minValue).toBe(DEFAULT_CURVE_SET.brightness.minValue);
    expect(seed.colorTemp.maxValue).toBe(DEFAULT_CURVE_SET.colorTemp.maxValue);
    expect(seed.brightness.transitionStart.value).toBe(-60);
    expect(seed.brightness.holdStart.value).toBe(15);
    expect(seed.colorMode.sleepRgbColor).toEqual(DEFAULT_CURVE_SET.colorMode.sleepRgbColor);
  });
});
