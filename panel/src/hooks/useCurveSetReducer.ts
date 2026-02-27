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
): CurveDefinition {
  const field = POINT_FIELD[pointType];
  const point = curve[field];
  if (typeof point !== 'object' || !('value' in point)) return curve;
  return {
    ...curve,
    [field]: { ...point, value: newValue },
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

/** Copy brightness timing points to colorTemp (preserving colorTemp's own ids and min/maxValue). */
function mirrorTimingToColorTemp(state: CurveSet): CurveDefinition {
  const b = state.brightness;
  const ct = state.colorTemp;
  return {
    ...ct,
    transitionStart: { ...b.transitionStart, id: ct.transitionStart.id },
    holdStart: { ...b.holdStart, id: ct.holdStart.id },
    holdEnd: { ...b.holdEnd, id: ct.holdEnd.id },
    transitionEnd: { ...b.transitionEnd, id: ct.transitionEnd.id },
    eveningSharpness: b.eveningSharpness,
    morningSharpness: b.morningSharpness,
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
      );
      const next = { ...state, [action.curveName]: updated };

      if (state.linked && action.curveName === 'brightness') {
        const ct = updateTimingValue(
          state.colorTemp,
          action.pointType,
          action.newValue,
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
