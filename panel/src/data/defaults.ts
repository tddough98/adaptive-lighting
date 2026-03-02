import type { CurveSet } from '../types/curves';

export const MONTVALE_COORDS = {
  lat: 41.0468,
  lng: -74.0431,
};

const SHARED_TIMING = {
  transitionStart: {
    id: 'b-ts',
    type: 'transition_start' as const,
    value: -30,           // 30 minutes before sunset
    isRelative: true,
    anchor: 'sunset' as const,
    yValue: 100,          // Brightness: 100%
  },
  holdStart: {
    id: 'b-hs',
    type: 'hold_start' as const,
    value: 23.0,          // 11:00 PM
    isRelative: false,
    yValue: 1,            // Brightness: 1%
  },
  holdEnd: {
    id: 'b-he',
    type: 'hold_end' as const,
    value: 5.5,           // 5:30 AM
    isRelative: false,
    yValue: 1,            // Brightness: 1%
  },
  transitionEnd: {
    id: 'b-te',
    type: 'transition_end' as const,
    value: 30,            // 30 minutes after sunrise
    isRelative: true,
    anchor: 'sunrise' as const,
    yValue: 100,          // Brightness: 100%
  },
};

export const DEFAULT_CURVE_SET: CurveSet = {
  brightness: {
    ...SHARED_TIMING,
    minValue: 1,          // 1%
    maxValue: 100,        // 100%
    peak: { hour: 13.0, value: 100 },
    valley: { hour: 2.0, value: 1 },
  },
  colorTemp: {
    ...SHARED_TIMING,
    transitionStart: { ...SHARED_TIMING.transitionStart, id: 'ct-ts', yValue: 5500 },
    holdStart: { ...SHARED_TIMING.holdStart, id: 'ct-hs', yValue: 2000 },
    holdEnd: { ...SHARED_TIMING.holdEnd, id: 'ct-he', yValue: 2000 },
    transitionEnd: { ...SHARED_TIMING.transitionEnd, id: 'ct-te', yValue: 5500 },
    minValue: 2000,       // Warm (Kelvin)
    maxValue: 5500,       // Cool (Kelvin)
    peak: { hour: 13.0, value: 5500 },
    valley: { hour: 2.0, value: 2000 },
  },
  linked: true,
  colorMode: {
    colorTempStartHour: null,   // null = follow sunriseHour
    colorTempEndHour: null,     // null = follow sunsetHour
    sleepRgbColor: [255, 56, 0],  // Matches Shiny DEFAULT_SLEEP_RGB_COLOR
  },
};
