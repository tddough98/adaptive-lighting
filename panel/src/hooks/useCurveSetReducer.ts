import type {
  CurveDefinition,
  CurveSet,
  CurveSetAction,
  TimingPointType,
} from '../types/curves';

/** Map TimingPointType to CurveDefinition field key. */
const POINT_FIELD: Record<TimingPointType, keyof CurveDefinition> = {
  transition_start: 'transitionStart',
  hold_start: 'holdStart',
  hold_end: 'holdEnd',
  transition_end: 'transitionEnd',
};

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

export function curveSetReducer(
  state: CurveSet,
  action: CurveSetAction,
): CurveSet {
  switch (action.type) {
    case 'UPDATE_TIME_POINT': {
      const updated = updateTimingValue(
        state[action.curveName],
        action.pointType,
        action.newValue,
        action.newYValue,
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
      const updated: CurveDefinition = {
        ...curve,
        peak: { hour: action.newHour, value: action.newValue },
      };
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
      const updated: CurveDefinition = {
        ...curve,
        valley: { hour: action.newHour, value: action.newValue },
      };
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
  }
}
