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
  },
  holdStart: {
    id: 'b-hs',
    type: 'hold_start' as const,
    value: 23.0,          // 11:00 PM
    isRelative: false,
  },
  holdEnd: {
    id: 'b-he',
    type: 'hold_end' as const,
    value: 5.5,           // 5:30 AM
    isRelative: false,
  },
  transitionEnd: {
    id: 'b-te',
    type: 'transition_end' as const,
    value: 30,            // 30 minutes after sunrise
    isRelative: true,
    anchor: 'sunrise' as const,
  },
  eveningSharpness: 0.5,
  morningSharpness: 0.5,
};

export const DEFAULT_CURVE_SET: CurveSet = {
  brightness: {
    ...SHARED_TIMING,
    minValue: 1,          // 1%
    maxValue: 100,        // 100%
  },
  colorTemp: {
    ...SHARED_TIMING,
    transitionStart: { ...SHARED_TIMING.transitionStart, id: 'ct-ts' },
    holdStart: { ...SHARED_TIMING.holdStart, id: 'ct-hs' },
    holdEnd: { ...SHARED_TIMING.holdEnd, id: 'ct-he' },
    transitionEnd: { ...SHARED_TIMING.transitionEnd, id: 'ct-te' },
    minValue: 2000,       // Warm (Kelvin)
    maxValue: 5500,       // Cool (Kelvin)
  },
  linked: true,
};
