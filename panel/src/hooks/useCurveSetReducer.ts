import type {
  ColorModeConfig,
  CurveDefinition,
  CurveSet,
  CurveSetAction,
  ExtremePoint,
  SunAnchor,
  SunTimes,
  TimingPoint,
  TimingPointType,
} from '../types/curves';
import { resolveTime, resolveExtremeTime } from '../utils/curvemath';

/** Map TimingPointType to CurveDefinition field key. */
const POINT_FIELD: Record<TimingPointType, keyof CurveDefinition> = {
  transition_start: 'transitionStart',
  hold_start: 'holdStart',
  hold_end: 'holdEnd',
  transition_end: 'transitionEnd',
};

// ── Y-value constraint cascade ──────────────────────────────────────────────

type PointKey = 'peak' | 'p1' | 'p2' | 'p4' | 'p5' | 'valley';

/** For each point, which points must have a value >= this point's value. */
const ABOVE: Record<PointKey, PointKey[]> = {
  valley: ['p2', 'p4'],
  p2: ['p1'],
  p4: ['p5'],
  p1: ['peak'],
  p5: ['peak'],
  peak: [],
};

/** For each point, which points must have a value <= this point's value. */
const BELOW: Record<PointKey, PointKey[]> = {
  peak: ['p1', 'p5'],
  p1: ['p2'],
  p5: ['p4'],
  p2: ['valley'],
  p4: ['valley'],
  valley: [],
};

const TIMING_POINT_TO_KEY: Record<TimingPointType, PointKey> = {
  transition_start: 'p1',
  hold_start: 'p2',
  hold_end: 'p4',
  transition_end: 'p5',
};

function extractYValues(curve: CurveDefinition): Record<PointKey, number> {
  return {
    peak: curve.peak.value,
    p1: curve.transitionStart.yValue,
    p2: curve.holdStart.yValue,
    p4: curve.holdEnd.yValue,
    p5: curve.transitionEnd.yValue,
    valley: curve.valley.value,
  };
}

function applyYValues(curve: CurveDefinition, yVals: Record<PointKey, number>): CurveDefinition {
  return {
    ...curve,
    peak: { ...curve.peak, value: yVals.peak },
    transitionStart: { ...curve.transitionStart, yValue: yVals.p1 },
    holdStart: { ...curve.holdStart, yValue: yVals.p2 },
    holdEnd: { ...curve.holdEnd, yValue: yVals.p4 },
    transitionEnd: { ...curve.transitionEnd, yValue: yVals.p5 },
    valley: { ...curve.valley, value: yVals.valley },
  };
}

/** Push neighbors up/down so the hierarchy (upper >= lower) is maintained. */
function enforceYConstraintCascade(curve: CurveDefinition, sourceKey: PointKey): CurveDefinition {
  const yVals = extractYValues(curve);

  function pushUp(key: PointKey): void {
    for (const above of ABOVE[key]) {
      if (yVals[above] < yVals[key]) {
        yVals[above] = yVals[key];
        pushUp(above);
      }
    }
  }

  function pushDown(key: PointKey): void {
    for (const below of BELOW[key]) {
      if (yVals[below] > yVals[key]) {
        yVals[below] = yVals[key];
        pushDown(below);
      }
    }
  }

  pushUp(sourceKey);
  pushDown(sourceKey);

  return applyYValues(curve, yVals);
}

function updateTimingValue(
  curve: CurveDefinition,
  pointType: TimingPointType,
  newValue: number,
  newYValue: number,
): CurveDefinition {
  const field = POINT_FIELD[pointType];
  const point = curve[field];
  if (typeof point !== 'object' || !('value' in point)) return curve;
  return {
    ...curve,
    [field]: { ...point, value: newValue, yValue: newYValue },
  };
}

/** Copy timing from source curve to target curve (preserving target's own ids, yValues, min/maxValue, and peak/valley values). */
function mirrorTiming(source: CurveDefinition, target: CurveDefinition): CurveDefinition {
  return {
    ...target,
    transitionStart: { ...source.transitionStart, id: target.transitionStart.id, yValue: target.transitionStart.yValue },
    holdStart: { ...source.holdStart, id: target.holdStart.id, yValue: target.holdStart.yValue },
    holdEnd: { ...source.holdEnd, id: target.holdEnd.id, yValue: target.holdEnd.yValue },
    transitionEnd: { ...source.transitionEnd, id: target.transitionEnd.id, yValue: target.transitionEnd.yValue },
    peak: { ...target.peak, hour: source.peak.hour, isRelative: source.peak.isRelative, anchor: source.peak.anchor, offsetMinutes: source.peak.offsetMinutes },
    valley: { ...target.valley, hour: source.valley.hour, isRelative: source.valley.isRelative, anchor: source.valley.anchor, offsetMinutes: source.valley.offsetMinutes },
  };
}

/** Resolve null boundaries to sun times (with offset). Returns the color_temp active range. */
export function resolveColorModeBoundaries(
  config: ColorModeConfig,
  sunTimes: SunTimes,
): { startHour: number; endHour: number } {
  return {
    startHour: config.colorTempStartHour !== null
      ? config.colorTempStartHour
      : sunTimes.sunriseHour + config.startOffsetMinutes / 60,
    endHour: config.colorTempEndHour !== null
      ? config.colorTempEndHour
      : sunTimes.sunsetHour + config.endOffsetMinutes / 60,
  };
}

/** Pick the nearest sun anchor for a given hour. */
function pickAnchor(hour: number, sunTimes: SunTimes): SunAnchor {
  // If hour is between sunrise and sunset → sunrise, else → sunset
  if (hour >= sunTimes.sunriseHour && hour <= sunTimes.sunsetHour) {
    return 'sunrise';
  }
  return 'sunset';
}

/** Toggle a TimingPoint between absolute and relative mode. */
function toggleTimingPointLock(
  point: TimingPoint,
  sunTimes: SunTimes,
): TimingPoint {
  if (point.isRelative) {
    // Relative → Absolute: resolve to absolute hour
    const absoluteHour = resolveTime(point, sunTimes);
    return { ...point, isRelative: false, value: absoluteHour, anchor: undefined };
  }
  // Absolute → Relative: compute offset from nearest anchor
  const anchor = pickAnchor(point.value, sunTimes);
  const base = anchor === 'sunset' ? sunTimes.sunsetHour : sunTimes.sunriseHour;
  const offsetMinutes = (point.value - base) * 60;
  return { ...point, isRelative: true, anchor, value: offsetMinutes };
}

/** Toggle an ExtremePoint between absolute and relative mode. */
function toggleExtremePointLock(
  point: ExtremePoint,
  sunTimes: SunTimes,
): ExtremePoint {
  if (point.isRelative) {
    // Relative → Absolute: resolve to absolute hour
    const absoluteHour = resolveExtremeTime(point, sunTimes);
    return { ...point, isRelative: false, hour: absoluteHour, anchor: undefined, offsetMinutes: undefined };
  }
  // Absolute → Relative: compute offset from nearest anchor
  const anchor = pickAnchor(point.hour, sunTimes);
  const base = anchor === 'sunset' ? sunTimes.sunsetHour : sunTimes.sunriseHour;
  const offsetMinutes = (point.hour - base) * 60;
  return { ...point, isRelative: true, anchor, offsetMinutes };
}

export function curveSetReducer(
  state: CurveSet,
  action: CurveSetAction,
): CurveSet {
  switch (action.type) {
    case 'UPDATE_TIME_POINT': {
      const updated = enforceYConstraintCascade(
        updateTimingValue(
          state[action.curveName],
          action.pointType,
          action.newValue,
          action.newYValue,
        ),
        TIMING_POINT_TO_KEY[action.pointType],
      );
      const next = { ...state, [action.curveName]: updated };

      if (state.linked) {
        const other = action.curveName === 'brightness' ? 'colorTemp' : 'brightness';
        const otherPoint = state[other][POINT_FIELD[action.pointType]];
        const otherYValue = typeof otherPoint === 'object' && 'yValue' in otherPoint ? otherPoint.yValue : 0;
        next[other] = updateTimingValue(
          state[other],
          action.pointType,
          action.newValue,
          otherYValue,
        );
      }
      return next;
    }

    case 'UPDATE_PEAK': {
      const curve = state[action.curveName];
      const existingPeak = curve.peak;
      let newPeak: ExtremePoint;
      if (existingPeak.isRelative && existingPeak.anchor) {
        const base = existingPeak.anchor === 'sunset' ? action.sunTimes.sunsetHour : action.sunTimes.sunriseHour;
        newPeak = { ...existingPeak, hour: action.newHour, value: action.newValue, offsetMinutes: (action.newHour - base) * 60 };
      } else {
        newPeak = { ...existingPeak, hour: action.newHour, value: action.newValue };
      }
      const updated = enforceYConstraintCascade(
        { ...curve, peak: newPeak },
        'peak',
      );
      const next = { ...state, [action.curveName]: updated };

      if (state.linked) {
        const other = action.curveName === 'brightness' ? 'colorTemp' : 'brightness';
        const otherPeak = { ...state[other].peak, hour: action.newHour, isRelative: newPeak.isRelative, anchor: newPeak.anchor, offsetMinutes: newPeak.offsetMinutes };
        next[other] = { ...state[other], peak: otherPeak };
      }
      return next;
    }

    case 'UPDATE_VALLEY': {
      const curve = state[action.curveName];
      const existingValley = curve.valley;
      let newValley: ExtremePoint;
      if (existingValley.isRelative && existingValley.anchor) {
        const base = existingValley.anchor === 'sunset' ? action.sunTimes.sunsetHour : action.sunTimes.sunriseHour;
        newValley = { ...existingValley, hour: action.newHour, value: action.newValue, offsetMinutes: (action.newHour - base) * 60 };
      } else {
        newValley = { ...existingValley, hour: action.newHour, value: action.newValue };
      }
      const updated = enforceYConstraintCascade(
        { ...curve, valley: newValley },
        'valley',
      );
      const next = { ...state, [action.curveName]: updated };

      if (state.linked) {
        const other = action.curveName === 'brightness' ? 'colorTemp' : 'brightness';
        const otherValley = { ...state[other].valley, hour: action.newHour, isRelative: newValley.isRelative, anchor: newValley.anchor, offsetMinutes: newValley.offsetMinutes };
        next[other] = { ...state[other], valley: otherValley };
      }
      return next;
    }

    case 'TOGGLE_TIME_LOCK': {
      const { curveName, pointId, sunTimes } = action;
      const curve = state[curveName];
      let updatedCurve: CurveDefinition;

      if (pointId === 'peak') {
        updatedCurve = { ...curve, peak: toggleExtremePointLock(curve.peak, sunTimes) };
      } else if (pointId === 'valley') {
        updatedCurve = { ...curve, valley: toggleExtremePointLock(curve.valley, sunTimes) };
      } else {
        const field = POINT_FIELD[pointId];
        const point = curve[field] as TimingPoint;
        updatedCurve = { ...curve, [field]: toggleTimingPointLock(point, sunTimes) };
      }

      const next = { ...state, [curveName]: updatedCurve };

      if (state.linked) {
        const other = curveName === 'brightness' ? 'colorTemp' : 'brightness';
        const otherCurve = state[other];
        if (pointId === 'peak') {
          next[other] = { ...otherCurve, peak: { ...otherCurve.peak, isRelative: updatedCurve.peak.isRelative, anchor: updatedCurve.peak.anchor, offsetMinutes: updatedCurve.peak.offsetMinutes } };
        } else if (pointId === 'valley') {
          next[other] = { ...otherCurve, valley: { ...otherCurve.valley, isRelative: updatedCurve.valley.isRelative, anchor: updatedCurve.valley.anchor, offsetMinutes: updatedCurve.valley.offsetMinutes } };
        } else {
          const field = POINT_FIELD[pointId];
          const srcPoint = updatedCurve[field] as TimingPoint;
          const dstPoint = otherCurve[field] as TimingPoint;
          next[other] = { ...otherCurve, [field]: { ...dstPoint, isRelative: srcPoint.isRelative, anchor: srcPoint.anchor, value: srcPoint.value } };
        }
      }
      return next;
    }

    case 'TOGGLE_LINKED': {
      const linked = !state.linked;
      if (linked) {
        // Switching to linked: copy brightness timing → colorTemp
        return {
          ...state,
          linked,
          colorTemp: mirrorTiming(state.brightness, state.colorTemp),
        };
      }
      return { ...state, linked };
    }

    case 'UPDATE_COLOR_MODE_BOUNDARY': {
      const cm = state.colorMode;
      if (action.boundary === 'start') {
        if (cm.colorTempStartHour === null) {
          // Sun-relative: update offset from sunrise
          const offset = (action.newHour - action.sunTimes.sunriseHour) * 60;
          return { ...state, colorMode: { ...cm, startOffsetMinutes: offset } };
        }
        return { ...state, colorMode: { ...cm, colorTempStartHour: action.newHour } };
      } else {
        if (cm.colorTempEndHour === null) {
          // Sun-relative: update offset from sunset
          const offset = (action.newHour - action.sunTimes.sunsetHour) * 60;
          return { ...state, colorMode: { ...cm, endOffsetMinutes: offset } };
        }
        return { ...state, colorMode: { ...cm, colorTempEndHour: action.newHour } };
      }
    }

    case 'TOGGLE_COLOR_MODE_BOUNDARY_LOCK': {
      const cm = state.colorMode;
      const { boundary, sunTimes: st } = action;
      if (boundary === 'start') {
        if (cm.colorTempStartHour === null) {
          // Sun-relative → Absolute: freeze the resolved hour
          const resolved = st.sunriseHour + cm.startOffsetMinutes / 60;
          return { ...state, colorMode: { ...cm, colorTempStartHour: resolved } };
        }
        // Absolute → Sun-relative: compute offset from sunrise
        const offset = (cm.colorTempStartHour - st.sunriseHour) * 60;
        return { ...state, colorMode: { ...cm, colorTempStartHour: null, startOffsetMinutes: offset } };
      } else {
        if (cm.colorTempEndHour === null) {
          // Sun-relative → Absolute: freeze the resolved hour
          const resolved = st.sunsetHour + cm.endOffsetMinutes / 60;
          return { ...state, colorMode: { ...cm, colorTempEndHour: resolved } };
        }
        // Absolute → Sun-relative: compute offset from sunset
        const offset = (cm.colorTempEndHour - st.sunsetHour) * 60;
        return { ...state, colorMode: { ...cm, colorTempEndHour: null, endOffsetMinutes: offset } };
      }
    }

    case 'UPDATE_COLOR_TEMP_RANGE': {
      const curve = state.colorTemp;
      const { newMin, newMax } = action;
      const clampY = (v: number) => Math.max(newMin, Math.min(newMax, v));
      const updated: CurveDefinition = {
        ...curve,
        minValue: newMin,
        maxValue: newMax,
        peak: { ...curve.peak, value: clampY(curve.peak.value) },
        valley: { ...curve.valley, value: clampY(curve.valley.value) },
        transitionStart: { ...curve.transitionStart, yValue: clampY(curve.transitionStart.yValue) },
        holdStart: { ...curve.holdStart, yValue: clampY(curve.holdStart.yValue) },
        holdEnd: { ...curve.holdEnd, yValue: clampY(curve.holdEnd.yValue) },
        transitionEnd: { ...curve.transitionEnd, yValue: clampY(curve.transitionEnd.yValue) },
      };
      return { ...state, colorTemp: updated };
    }
  }
}
