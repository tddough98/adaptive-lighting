import type { CurveDefinition, CurveSet, SunTimes } from '../types/curves';
import type { HassEntity } from '../types/homeassistant';
import { DEFAULT_CURVE_SET } from '../data/defaults';

/** Shape of the enhanced curve config dict stored in HA entity attributes. */
interface CurveConfigDict {
  transition_start_offset: number;
  transition_start_is_relative: boolean;
  transition_start_anchor: string;
  transition_start_value: number;
  hold_start_hour: number;
  hold_start_is_relative: boolean;
  hold_start_anchor: string;
  hold_start_value: number;
  hold_end_hour: number;
  hold_end_is_relative: boolean;
  hold_end_anchor: string;
  hold_end_value: number;
  transition_end_offset: number;
  transition_end_is_relative: boolean;
  transition_end_anchor: string;
  transition_end_value: number;
  peak_hour: number;
  peak_value: number;
  valley_hour: number;
  valley_value: number;
  min_value: number;
  max_value: number;
}

/** Convert an HA curve config dict to a CurveDefinition. */
function dictToCurveDefinition(dict: CurveConfigDict, idPrefix: string): CurveDefinition {
  return {
    transitionStart: {
      id: `${idPrefix}-ts`,
      type: 'transition_start',
      value: dict.transition_start_offset,
      isRelative: dict.transition_start_is_relative,
      anchor: (dict.transition_start_anchor || undefined) as 'sunset' | 'sunrise' | undefined,
      yValue: dict.transition_start_value,
    },
    holdStart: {
      id: `${idPrefix}-hs`,
      type: 'hold_start',
      value: dict.hold_start_hour,
      isRelative: dict.hold_start_is_relative,
      anchor: (dict.hold_start_anchor || undefined) as 'sunset' | 'sunrise' | undefined,
      yValue: dict.hold_start_value,
    },
    holdEnd: {
      id: `${idPrefix}-he`,
      type: 'hold_end',
      value: dict.hold_end_hour,
      isRelative: dict.hold_end_is_relative,
      anchor: (dict.hold_end_anchor || undefined) as 'sunset' | 'sunrise' | undefined,
      yValue: dict.hold_end_value,
    },
    transitionEnd: {
      id: `${idPrefix}-te`,
      type: 'transition_end',
      value: dict.transition_end_offset,
      isRelative: dict.transition_end_is_relative,
      anchor: (dict.transition_end_anchor || undefined) as 'sunset' | 'sunrise' | undefined,
      yValue: dict.transition_end_value,
    },
    minValue: dict.min_value,
    maxValue: dict.max_value,
    peak: { hour: dict.peak_hour, value: dict.peak_value, isRelative: false },
    valley: { hour: dict.valley_hour, value: dict.valley_value, isRelative: false },
  };
}

/** Convert a CurveDefinition to an HA curve config dict. */
function curveDefinitionToDict(curve: CurveDefinition): CurveConfigDict {
  return {
    transition_start_offset: curve.transitionStart.value,
    transition_start_is_relative: curve.transitionStart.isRelative,
    transition_start_anchor: curve.transitionStart.anchor ?? '',
    transition_start_value: curve.transitionStart.yValue,
    hold_start_hour: curve.holdStart.value,
    hold_start_is_relative: curve.holdStart.isRelative,
    hold_start_anchor: curve.holdStart.anchor ?? '',
    hold_start_value: curve.holdStart.yValue,
    hold_end_hour: curve.holdEnd.value,
    hold_end_is_relative: curve.holdEnd.isRelative,
    hold_end_anchor: curve.holdEnd.anchor ?? '',
    hold_end_value: curve.holdEnd.yValue,
    transition_end_offset: curve.transitionEnd.value,
    transition_end_is_relative: curve.transitionEnd.isRelative,
    transition_end_anchor: curve.transitionEnd.anchor ?? '',
    transition_end_value: curve.transitionEnd.yValue,
    peak_hour: curve.peak.hour,
    peak_value: curve.peak.value,
    valley_hour: curve.valley.hour,
    valley_value: curve.valley.value,
    min_value: curve.minValue,
    max_value: curve.maxValue,
  };
}

/** Extract CurveSet + SunTimes from an HA switch entity's attributes. */
export function entityToCurveData(entity: HassEntity): {
  curveSet: CurveSet;
  sunTimes: SunTimes;
} {
  const attrs = entity.attributes;
  const config = (attrs.configuration ?? {}) as Record<string, unknown>;

  const brightnessDict = config.enhanced_brightness_curve as CurveConfigDict | undefined;
  const colorTempDict = config.enhanced_color_temp_curve as CurveConfigDict | undefined;

  const curveSet: CurveSet = {
    brightness: brightnessDict
      ? dictToCurveDefinition(brightnessDict, 'b')
      : DEFAULT_CURVE_SET.brightness,
    colorTemp: colorTempDict
      ? dictToCurveDefinition(colorTempDict, 'ct')
      : DEFAULT_CURVE_SET.colorTemp,
    linked: DEFAULT_CURVE_SET.linked,
    colorMode: DEFAULT_CURVE_SET.colorMode,
  };

  const sunTimes: SunTimes = {
    sunriseHour: (attrs.sunrise_hour as number) ?? 6.5,
    sunsetHour: (attrs.sunset_hour as number) ?? 18.75,
  };

  return { curveSet, sunTimes };
}

/** Build the service call data to update curves in HA. */
export function curveSetToServiceData(curveSet: CurveSet): Record<string, unknown> {
  return {
    brightness_mode: 'enhanced',
    enhanced_brightness_curve: curveDefinitionToDict(curveSet.brightness),
    enhanced_color_temp_curve: curveDefinitionToDict(curveSet.colorTemp),
  };
}
