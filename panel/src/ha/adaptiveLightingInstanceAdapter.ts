import type { ColorModeConfig, CurveSet, SunTimes } from '../types/curves';
import type { HassEntity, HomeAssistant } from '../types/homeassistant';
import {
  curveSetToServiceData,
  entityToSavedLightingPlan,
  type MissingLightingPlanIntentField,
  type SavedLightingPlan,
} from './dataConversion';

export type AdaptiveLightingSelectionSource = 'auto-enhanced' | 'auto-first';

export interface AdaptiveLightingInstance {
  entityId: string;
  name: string;
  isEnhancedMode: boolean;
  savedPlan: SavedLightingPlan;
}

export interface SelectedAdaptiveLightingInstance {
  instance: AdaptiveLightingInstance;
  source: AdaptiveLightingSelectionSource;
}

export type SaveLightingPlanStatus =
  | { type: 'idle' }
  | { type: 'saving' }
  | { type: 'confirmed' }
  | { type: 'rejected'; message: string }
  | { type: 'normalized'; message: string }
  | { type: 'stale'; message: string };

export interface LightingPlanSaveRequest {
  entityId: string;
  curveSet: CurveSet;
}

export interface DraftTrackingState {
  dirty: boolean;
  draftSourceVersion: string | null;
  currentSourceVersion: string | null;
}

export function saveStatusBeforeServiceCall(): SaveLightingPlanStatus {
  return { type: 'saving' };
}

function isAdaptiveLightingSwitch(entityId: string): boolean {
  return entityId.startsWith('switch.adaptive_lighting_');
}

function instanceName(entity: HassEntity): string {
  return (entity.attributes.friendly_name as string | undefined) ?? entity.entity_id;
}

function entityToInstance(entity: HassEntity): AdaptiveLightingInstance {
  const savedPlan = entityToSavedLightingPlan(entity);
  return {
    entityId: entity.entity_id,
    name: instanceName(entity),
    isEnhancedMode: savedPlan.isEnhancedMode,
    savedPlan,
  };
}

export function listAdaptiveLightingInstances(
  states: Record<string, HassEntity>,
): AdaptiveLightingInstance[] {
  return Object.entries(states)
    .filter(([entityId]) => isAdaptiveLightingSwitch(entityId))
    .map(([, entity]) => entityToInstance(entity));
}

export function selectAdaptiveLightingInstance(
  states: Record<string, HassEntity>,
): SelectedAdaptiveLightingInstance | null {
  const instances = listAdaptiveLightingInstances(states);
  const enhanced = instances.find((instance) => instance.isEnhancedMode);
  if (enhanced) {
    return { instance: enhanced, source: 'auto-enhanced' };
  }
  const first = instances[0];
  return first ? { instance: first, source: 'auto-first' } : null;
}

export async function saveLightingPlan(
  hass: HomeAssistant,
  request: LightingPlanSaveRequest,
): Promise<void> {
  await hass.callService(
    'adaptive_lighting',
    'change_switch_settings',
    curveSetToServiceData(request.curveSet),
    { entity_id: request.entityId },
  );
}

function sameColorMode(left: ColorModeConfig, right: ColorModeConfig): boolean {
  return (
    left.colorTempStartHour === right.colorTempStartHour &&
    left.colorTempEndHour === right.colorTempEndHour &&
    left.startOffsetMinutes === right.startOffsetMinutes &&
    left.endOffsetMinutes === right.endOffsetMinutes &&
    left.sleepRgbColor.length === right.sleepRgbColor.length &&
    left.sleepRgbColor.every((value, index) => value === right.sleepRgbColor[index])
  );
}

export function getUntransmittedDraftIntentFields(
  draft: CurveSet,
  savedPlan: SavedLightingPlan,
): MissingLightingPlanIntentField[] {
  const fields: MissingLightingPlanIntentField[] = [];
  if (draft.linked !== savedPlan.curveSet.linked) {
    fields.push('linked');
  }
  if (!sameColorMode(draft.colorMode, savedPlan.curveSet.colorMode)) {
    fields.push('colorMode');
  }
  return fields;
}

export function untransmittedIntentMessage(fields: MissingLightingPlanIntentField[]): string | null {
  if (fields.length === 0) return null;
  return `${fields.join(', ')} intent changed in the draft but is not persisted by the current Home Assistant wire format.`;
}

export function saveStatusAfterSuccessfulServiceCall(
  draft: CurveSet,
  savedPlan: SavedLightingPlan,
): SaveLightingPlanStatus {
  const message = untransmittedIntentMessage(getUntransmittedDraftIntentFields(draft, savedPlan));
  return message ? { type: 'normalized', message } : { type: 'confirmed' };
}

export function saveStatusAfterRejectedServiceCall(error: unknown): SaveLightingPlanStatus {
  return {
    type: 'rejected',
    message: error instanceof Error ? error.message : 'Save Lighting Plan failed',
  };
}

export function evaluateDraftStaleness(state: DraftTrackingState): SaveLightingPlanStatus | null {
  if (!state.dirty || !state.draftSourceVersion || !state.currentSourceVersion) {
    return null;
  }
  if (state.draftSourceVersion === state.currentSourceVersion) {
    return null;
  }
  return {
    type: 'stale',
    message: 'Home Assistant changed this Saved Lighting Plan after this draft started.',
  };
}

export type { SavedLightingPlan, SunTimes };
