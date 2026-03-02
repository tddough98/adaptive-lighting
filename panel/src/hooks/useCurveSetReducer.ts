import type {
  ColorModeConfig,
  CurveDefinition,
  CurveSet,
  CurveSetAction,
  SunTimes,
  TimingPointType,
} from '../types/curves';

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

function updateSharpness(
  curve: CurveDefinition,
  which: 'evening' | 'morning',
  newSharpness: number,
): CurveDefinition {
  if (which === 'evening') {
    return { ...curve, eveningSharpness: newSharpness };
  }
  return { ...curve, morningSharpness: newSharpness };
}

/** Copy brightness timing points to colorTemp (preserving colorTemp's own ids, yValues, min/maxValue, and peak/valley values). */
function mirrorTimingToColorTemp(state: CurveSet): CurveDefinition {
  const b = state.brightness;
  const ct = state.colorTemp;
  return {
    ...ct,
    transitionStart: { ...b.transitionStart, id: ct.transitionStart.id, yValue: ct.transitionStart.yValue },
    holdStart: { ...b.holdStart, id: ct.holdStart.id, yValue: ct.holdStart.yValue },
    holdEnd: { ...b.holdEnd, id: ct.holdEnd.id, yValue: ct.holdEnd.yValue },
    transitionEnd: { ...b.transitionEnd, id: ct.transitionEnd.id, yValue: ct.transitionEnd.yValue },
    eveningSharpness: b.eveningSharpness,
    morningSharpness: b.morningSharpness,
    peak: { ...ct.peak, hour: b.peak.hour },
    valley: { ...ct.valley, hour: b.valley.hour },
  };
}

/** Resolve null boundaries to sun times. Returns the color_temp active range. */
export function resolveColorModeBoundaries(
  config: ColorModeConfig,
  sunTimes: SunTimes,
): { startHour: number; endHour: number } {
  return {
    startHour: config.colorTempStartHour ?? sunTimes.sunriseHour,
    endHour: config.colorTempEndHour ?? sunTimes.sunsetHour,
  };
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

      if (state.linked && action.curveName === 'brightness') {
        // Mirror timing but preserve colorTemp's own yValue
        const ctPoint = state.colorTemp[POINT_FIELD[action.pointType]];
        const ctYValue = typeof ctPoint === 'object' && 'yValue' in ctPoint ? ctPoint.yValue : 0;
        const ct = updateTimingValue(
          state.colorTemp,
          action.pointType,
          action.newValue,
          ctYValue,
        );
        next.colorTemp = ct;
      }
      return next;
    }

    case 'UPDATE_SHARPNESS': {
      const updated = updateSharpness(
        state[action.curveName],
        action.which,
        action.newSharpness,
      );
      const next = { ...state, [action.curveName]: updated };

      if (state.linked && action.curveName === 'brightness') {
        const ct = updateSharpness(
          state.colorTemp,
          action.which,
          action.newSharpness,
        );
        next.colorTemp = ct;
      }
      return next;
    }

    case 'UPDATE_PEAK': {
      const curve = state[action.curveName];
      const updated = enforceYConstraintCascade(
        { ...curve, peak: { hour: action.newHour, value: action.newValue } },
        'peak',
      );
      const next = { ...state, [action.curveName]: updated };

      if (state.linked && action.curveName === 'brightness') {
        // Mirror hour only, preserve colorTemp's own peak value
        next.colorTemp = {
          ...state.colorTemp,
          peak: { ...state.colorTemp.peak, hour: action.newHour },
        };
      }
      return next;
    }

    case 'UPDATE_VALLEY': {
      const curve = state[action.curveName];
      const updated = enforceYConstraintCascade(
        { ...curve, valley: { hour: action.newHour, value: action.newValue } },
        'valley',
      );
      const next = { ...state, [action.curveName]: updated };

      if (state.linked && action.curveName === 'brightness') {
        // Mirror hour only, preserve colorTemp's own valley value
        next.colorTemp = {
          ...state.colorTemp,
          valley: { ...state.colorTemp.valley, hour: action.newHour },
        };
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
          colorTemp: mirrorTimingToColorTemp(state),
        };
      }
      return { ...state, linked };
    }

    case 'UPDATE_COLOR_MODE_BOUNDARY': {
      const key = action.boundary === 'start' ? 'colorTempStartHour' : 'colorTempEndHour';
      return {
        ...state,
        colorMode: { ...state.colorMode, [key]: action.newHour },
      };
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
