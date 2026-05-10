import { useMemo } from 'react';
import {
  evaluateLightingPlan,
  type LightingPlanEvaluation,
} from '../domain/lightingPlanEvaluation';
import type { CurveSet, SunTimes } from '../types/curves';

export function useCurveData(
  curveSet: CurveSet,
  sunTimes: SunTimes,
  currentHour: number,
): LightingPlanEvaluation {
  return useMemo(
    // Clipping depends on the full plan; per-curve memos cannot capture linked-timing coupling.
    () => evaluateLightingPlan(curveSet, sunTimes, currentHour),
    [curveSet, sunTimes, currentHour],
  );
}
