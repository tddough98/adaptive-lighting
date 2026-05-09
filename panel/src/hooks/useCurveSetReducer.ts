import { applyLightingPlanDraftAction } from '../domain/lightingPlanDraft';
import type { CurveSet, CurveSetAction } from '../types/curves';

export function curveSetReducer(
  state: CurveSet,
  action: CurveSetAction,
): CurveSet {
  return applyLightingPlanDraftAction(state, action);
}
