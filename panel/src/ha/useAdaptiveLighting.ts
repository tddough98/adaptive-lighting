import { useMemo, useCallback, useEffect, useState } from 'react';
import type { HomeAssistant } from '../types/homeassistant';
import type { CurveSet, SunTimes } from '../types/curves';
import {
  evaluateDraftStaleness,
  listAdaptiveLightingInstances,
  saveLightingPlan,
  saveStatusAfterRejectedServiceCall,
  saveStatusAfterSuccessfulServiceCall,
  saveStatusBeforeServiceCall,
  selectAdaptiveLightingInstance,
  type AdaptiveLightingInstance,
  type AdaptiveLightingSelectionSource,
  type SaveLightingPlanStatus,
} from './adaptiveLightingInstanceAdapter';

export interface AdaptiveLightingData {
  connected: boolean;
  entityId: string | null;
  instances: AdaptiveLightingInstance[];
  selectionSource: AdaptiveLightingSelectionSource | null;
  curveSet: CurveSet | null;
  sunTimes: SunTimes | null;
  savedPlanVersion: string | null;
  draftIsDirty: boolean;
  saveStatus: SaveLightingPlanStatus;
  saveCurves: (curveSet: CurveSet) => Promise<SaveLightingPlanStatus>;
  markDraftChanged: () => void;
}

export function useAdaptiveLighting(hass: HomeAssistant | null): AdaptiveLightingData {
  const [saveStatus, setSaveStatus] = useState<SaveLightingPlanStatus>({ type: 'idle' });
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftSourceVersion, setDraftSourceVersion] = useState<string | null>(null);
  const [trackedEntityId, setTrackedEntityId] = useState<string | null>(null);

  const instances = useMemo(() => {
    if (!hass) return [];
    return listAdaptiveLightingInstances(hass.states);
  }, [hass?.states]);

  const selection = useMemo(() => {
    if (!hass) return null;
    return selectAdaptiveLightingInstance(hass.states);
  }, [hass?.states]);

  const selected = selection?.instance ?? null;
  const selectedSourceVersion = selected?.savedPlan.sourceVersion ?? null;

  useEffect(() => {
    const selectedEntityId = selected?.entityId ?? null;
    if (trackedEntityId === selectedEntityId) return;
    setTrackedEntityId(selectedEntityId);
    setDraftDirty(false);
    setDraftSourceVersion(selectedSourceVersion);
    setSaveStatus({ type: 'idle' });
  }, [selected?.entityId, selectedSourceVersion, trackedEntityId]);

  const markDraftChanged = useCallback(() => {
    if (!selected) return;
    setDraftDirty(true);
    setDraftSourceVersion((current) => draftDirty && current ? current : selected.savedPlan.sourceVersion);
  }, [draftDirty, selected]);

  const staleStatus = evaluateDraftStaleness({
    dirty: draftDirty,
    draftSourceVersion,
    currentSourceVersion: selectedSourceVersion,
  });

  const saveCurves = useCallback(
    async (curveSet: CurveSet) => {
      if (!hass || !selected) {
        const rejected = saveStatusAfterRejectedServiceCall(
          new Error('No Selected Adaptive Lighting Instance is available'),
        );
        setSaveStatus(rejected);
        return rejected;
      }
      setSaveStatus(saveStatusBeforeServiceCall());
      try {
        await saveLightingPlan(hass, {
          entityId: selected.entityId,
          curveSet,
        });
        const confirmed = saveStatusAfterSuccessfulServiceCall(curveSet, selected.savedPlan);
        setSaveStatus(confirmed);
        setDraftDirty(false);
        setDraftSourceVersion(selected.savedPlan.sourceVersion);
        return confirmed;
      } catch (error) {
        const rejected = saveStatusAfterRejectedServiceCall(error);
        setSaveStatus(rejected);
        return rejected;
      }
    },
    [hass, selected],
  );

  return {
    connected: hass !== null,
    entityId: selected?.entityId ?? null,
    instances,
    selectionSource: selection?.source ?? null,
    curveSet: selected?.savedPlan.curveSet ?? null,
    sunTimes: selected?.savedPlan.sunTimes ?? null,
    savedPlanVersion: selectedSourceVersion,
    draftIsDirty: draftDirty,
    saveStatus: staleStatus ?? saveStatus,
    saveCurves,
    markDraftChanged,
  };
}
