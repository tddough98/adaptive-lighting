import type {
  CurveDefinition,
  CurveName,
  CurveSet,
  CurveSetAction,
  ExtremePoint,
  SunAnchor,
  SunTimes,
  TimingPoint,
  TimingPointType,
} from '../types/curves';
import { resolveCurve, resolveExtremeTime, resolveTime } from '../utils/curvemath';
import {
  absoluteHourToTimingValue,
  clampHourInArc,
  constrainYValue,
  getPeakConstraints,
  getTimePointConstraints,
  getValleyConstraints,
  snapToMinutes,
} from '../utils/constraints';

/** Map TimingPointType to CurveDefinition field key. */
const POINT_FIELD: Record<TimingPointType, keyof CurveDefinition> = {
  transition_start: 'transitionStart',
  hold_start: 'holdStart',
  hold_end: 'holdEnd',
  transition_end: 'transitionEnd',
};

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

function otherCurveName(curveName: CurveName): CurveName {
  return curveName === 'brightness' ? 'colorTemp' : 'brightness';
}

function normalizeHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

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

function constrainTimingPointValue(
  curveSet: CurveSet,
  curveName: CurveName,
  pointType: TimingPointType,
  requestedValue: number,
  sunTimes: SunTimes,
): number {
  const curve = curveSet[curveName];
  const field = POINT_FIELD[pointType];
  const point = curve[field] as TimingPoint;
  const requestedHour = resolveTime({ ...point, value: requestedValue }, sunTimes);
  const constraints = getTimePointConstraints(pointType, curveSet, sunTimes, curveName);
  const clampedHour = clampHourInArc(requestedHour, constraints.minHour, constraints.maxHour);
  const snappedHour = normalizeHour(snapToMinutes(clampedHour, constraints.snapMinutes));
  return absoluteHourToTimingValue(snappedHour, point.isRelative, point.anchor, sunTimes);
}

function constrainExtremeHour(
  curve: CurveDefinition,
  pointType: 'peak' | 'valley',
  requestedHour: number,
  sunTimes: SunTimes,
): number {
  const resolved = resolveCurve(curve, sunTimes);
  const constraints = pointType === 'peak'
    ? getPeakConstraints(resolved)
    : getValleyConstraints(resolved);
  return normalizeHour(snapToMinutes(
    clampHourInArc(requestedHour, constraints.minHour, constraints.maxHour),
    5,
  ));
}

function updateExtremePoint(
  point: ExtremePoint,
  newHour: number,
  newValue: number,
  sunTimes: SunTimes,
): ExtremePoint {
  if (point.isRelative && point.anchor) {
    const base = point.anchor === 'sunset' ? sunTimes.sunsetHour : sunTimes.sunriseHour;
    return { ...point, hour: newHour, value: newValue, offsetMinutes: (newHour - base) * 60 };
  }
  return { ...point, hour: newHour, value: newValue };
}

/** Copy timing from source curve to target curve while preserving target value/range identity. */
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

function applyLinkedTiming(
  state: CurveSet,
  next: CurveSet,
  sourceCurveName: CurveName,
): CurveSet {
  if (!state.linked) return next;
  // Linked plans should already have equal timing; copying all six points reasserts that invariant after each edit.
  const targetCurveName = otherCurveName(sourceCurveName);
  return {
    ...next,
    [targetCurveName]: mirrorTiming(next[sourceCurveName], state[targetCurveName]),
  };
}

/** Pick the nearest sun anchor for a given hour. */
function pickAnchor(hour: number, sunTimes: SunTimes): SunAnchor {
  const dSunrise = Math.abs(hour - sunTimes.sunriseHour);
  const dSunset = Math.abs(hour - sunTimes.sunsetHour);
  return dSunrise <= dSunset ? 'sunrise' : 'sunset';
}

function toggleTimingPointLock(
  point: TimingPoint,
  sunTimes: SunTimes,
): TimingPoint {
  if (point.isRelative) {
    const absoluteHour = resolveTime(point, sunTimes);
    return { ...point, isRelative: false, value: absoluteHour, anchor: undefined };
  }

  const anchor = pickAnchor(point.value, sunTimes);
  const base = anchor === 'sunset' ? sunTimes.sunsetHour : sunTimes.sunriseHour;
  const offsetMinutes = (point.value - base) * 60;
  return { ...point, isRelative: true, anchor, value: offsetMinutes };
}

function toggleExtremePointLock(
  point: ExtremePoint,
  sunTimes: SunTimes,
): ExtremePoint {
  if (point.isRelative) {
    const absoluteHour = resolveExtremeTime(point, sunTimes);
    return { ...point, isRelative: false, hour: absoluteHour, anchor: undefined, offsetMinutes: undefined };
  }

  const anchor = pickAnchor(point.hour, sunTimes);
  const base = anchor === 'sunset' ? sunTimes.sunsetHour : sunTimes.sunriseHour;
  const offsetMinutes = (point.hour - base) * 60;
  return { ...point, isRelative: true, anchor, offsetMinutes };
}

function updateColorTempRange(state: CurveSet, newMin: number, newMax: number): CurveSet {
  const curve = state.colorTemp;
  const oldMin = curve.minValue;
  const oldMax = curve.maxValue;
  const oldSpan = oldMax - oldMin;
  const remap = (v: number) =>
    oldSpan === 0 ? newMin : newMin + ((v - oldMin) / oldSpan) * (newMax - newMin);

  return {
    ...state,
    colorTemp: {
      ...curve,
      minValue: newMin,
      maxValue: newMax,
      peak: { ...curve.peak, value: remap(curve.peak.value) },
      valley: { ...curve.valley, value: remap(curve.valley.value) },
      transitionStart: { ...curve.transitionStart, yValue: remap(curve.transitionStart.yValue) },
      holdStart: { ...curve.holdStart, yValue: remap(curve.holdStart.yValue) },
      holdEnd: { ...curve.holdEnd, yValue: remap(curve.holdEnd.yValue) },
      transitionEnd: { ...curve.transitionEnd, yValue: remap(curve.transitionEnd.yValue) },
    },
  };
}

export function applyLightingPlanDraftAction(
  state: CurveSet,
  action: CurveSetAction,
): CurveSet {
  switch (action.type) {
    case 'RESET':
      return action.curveSet;

    case 'UPDATE_TIME_POINT': {
      const curve = state[action.curveName];
      const constrainedValue = constrainTimingPointValue(
        state,
        action.curveName,
        action.pointType,
        action.newValue,
        action.sunTimes,
      );
      const constrainedYValue = constrainYValue(action.newYValue, curve.minValue, curve.maxValue);
      const updated = enforceYConstraintCascade(
        updateTimingValue(
          curve,
          action.pointType,
          constrainedValue,
          constrainedYValue,
        ),
        TIMING_POINT_TO_KEY[action.pointType],
      );
      const next = { ...state, [action.curveName]: updated };
      return applyLinkedTiming(state, next, action.curveName);
    }

    case 'UPDATE_PEAK': {
      const curve = state[action.curveName];
      const constrainedHour = constrainExtremeHour(curve, 'peak', action.newHour, action.sunTimes);
      const constrainedValue = constrainYValue(action.newValue, curve.minValue, curve.maxValue);
      const updated = enforceYConstraintCascade(
        { ...curve, peak: updateExtremePoint(curve.peak, constrainedHour, constrainedValue, action.sunTimes) },
        'peak',
      );
      const next = { ...state, [action.curveName]: updated };
      return applyLinkedTiming(state, next, action.curveName);
    }

    case 'UPDATE_VALLEY': {
      const curve = state[action.curveName];
      const constrainedHour = constrainExtremeHour(curve, 'valley', action.newHour, action.sunTimes);
      const constrainedValue = constrainYValue(action.newValue, curve.minValue, curve.maxValue);
      const updated = enforceYConstraintCascade(
        { ...curve, valley: updateExtremePoint(curve.valley, constrainedHour, constrainedValue, action.sunTimes) },
        'valley',
      );
      const next = { ...state, [action.curveName]: updated };
      return applyLinkedTiming(state, next, action.curveName);
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
      return applyLinkedTiming(state, next, curveName);
    }

    case 'TOGGLE_LINKED': {
      const linked = !state.linked;
      if (linked) {
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
          const offset = (action.newHour - action.sunTimes.sunriseHour) * 60;
          return { ...state, colorMode: { ...cm, startOffsetMinutes: offset } };
        }
        return { ...state, colorMode: { ...cm, colorTempStartHour: action.newHour } };
      }

      if (cm.colorTempEndHour === null) {
        const offset = (action.newHour - action.sunTimes.sunsetHour) * 60;
        return { ...state, colorMode: { ...cm, endOffsetMinutes: offset } };
      }
      return { ...state, colorMode: { ...cm, colorTempEndHour: action.newHour } };
    }

    case 'TOGGLE_COLOR_MODE_BOUNDARY_LOCK': {
      const cm = state.colorMode;
      const { boundary, sunTimes: st } = action;
      if (boundary === 'start') {
        if (cm.colorTempStartHour === null) {
          const resolved = st.sunriseHour + cm.startOffsetMinutes / 60;
          return { ...state, colorMode: { ...cm, colorTempStartHour: resolved } };
        }
        const offset = (cm.colorTempStartHour - st.sunriseHour) * 60;
        return { ...state, colorMode: { ...cm, colorTempStartHour: null, startOffsetMinutes: offset } };
      }

      if (cm.colorTempEndHour === null) {
        const resolved = st.sunsetHour + cm.endOffsetMinutes / 60;
        return { ...state, colorMode: { ...cm, colorTempEndHour: resolved } };
      }
      const offset = (cm.colorTempEndHour - st.sunsetHour) * 60;
      return { ...state, colorMode: { ...cm, colorTempEndHour: null, endOffsetMinutes: offset } };
    }

    case 'UPDATE_COLOR_TEMP_RANGE':
      return updateColorTempRange(state, action.newMin, action.newMax);
  }
}
