import { DEFAULT_CURVE_SET } from '../data/defaults';
import type { ColorModeConfig, CurveDefinition, CurveSet } from '../types/curves';

export interface EnhancedModeSeedSettings {
  min_brightness?: unknown;
  max_brightness?: unknown;
  min_color_temp?: unknown;
  max_color_temp?: unknown;
  brightness_mode_time_dark?: unknown;
  brightness_mode_time_light?: unknown;
  sleep_rgb_color?: unknown;
}

function numberSetting(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function rgbSetting(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) return fallback;
  const [r, g, b] = value;
  if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number') return fallback;
  return [r, g, b];
}

function secondsToHours(value: unknown, fallbackSeconds: number): number {
  return numberSetting(value, fallbackSeconds) / 3600;
}

function curveWithRange(
  curve: CurveDefinition,
  minValue: number,
  maxValue: number,
  darkHours: number,
  lightHours: number,
): CurveDefinition {
  return {
    ...curve,
    minValue,
    maxValue,
    transitionStart: {
      ...curve.transitionStart,
      value: -lightHours * 60,
      isRelative: true,
      anchor: 'sunset',
      yValue: maxValue,
    },
    holdStart: {
      ...curve.holdStart,
      value: darkHours * 60,
      isRelative: true,
      anchor: 'sunset',
      yValue: minValue,
    },
    holdEnd: {
      ...curve.holdEnd,
      value: -darkHours * 60,
      isRelative: true,
      anchor: 'sunrise',
      yValue: minValue,
    },
    transitionEnd: {
      ...curve.transitionEnd,
      value: lightHours * 60,
      isRelative: true,
      anchor: 'sunrise',
      yValue: maxValue,
    },
    peak: { ...curve.peak, value: maxValue },
    valley: { ...curve.valley, value: minValue },
  };
}

function colorModeSeed(settings: EnhancedModeSeedSettings): ColorModeConfig {
  return {
    ...DEFAULT_CURVE_SET.colorMode,
    // Sleep RGB is preserved in the draft, but Slice 9 owns complete HA persistence.
    sleepRgbColor: rgbSetting(settings.sleep_rgb_color, DEFAULT_CURVE_SET.colorMode.sleepRgbColor),
  };
}

export function createEnhancedModeSeed(settings: EnhancedModeSeedSettings): CurveSet {
  const minBrightness = numberSetting(settings.min_brightness, DEFAULT_CURVE_SET.brightness.minValue);
  const maxBrightness = numberSetting(settings.max_brightness, DEFAULT_CURVE_SET.brightness.maxValue);
  const minColorTemp = numberSetting(settings.min_color_temp, DEFAULT_CURVE_SET.colorTemp.minValue);
  const maxColorTemp = numberSetting(settings.max_color_temp, DEFAULT_CURVE_SET.colorTemp.maxValue);
  // Fall back to upstream HA DEFAULT_BRIGHTNESS_MODE_TIME_* values, not panel curve defaults, to preserve legacy-mode continuity.
  const darkHours = secondsToHours(settings.brightness_mode_time_dark, 900);
  const lightHours = secondsToHours(settings.brightness_mode_time_light, 3600);

  return {
    brightness: curveWithRange(
      DEFAULT_CURVE_SET.brightness,
      minBrightness,
      maxBrightness,
      darkHours,
      lightHours,
    ),
    colorTemp: curveWithRange(
      DEFAULT_CURVE_SET.colorTemp,
      minColorTemp,
      maxColorTemp,
      darkHours,
      lightHours,
    ),
    linked: DEFAULT_CURVE_SET.linked,
    colorMode: colorModeSeed(settings),
  };
}
