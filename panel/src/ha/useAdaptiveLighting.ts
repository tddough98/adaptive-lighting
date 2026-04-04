import { useMemo, useCallback } from 'react';
import type { HomeAssistant, HassEntity } from '../types/homeassistant';
import type { CurveSet, SunTimes } from '../types/curves';
import { entityToCurveData, curveSetToServiceData } from './dataConversion';

/** Find the first adaptive lighting switch entity. */
function findALSwitch(states: Record<string, HassEntity>): HassEntity | null {
  // Prefer an enhanced-mode switch
  for (const [entityId, entity] of Object.entries(states)) {
    if (entityId.startsWith('switch.adaptive_lighting_')) {
      const config = (entity.attributes.configuration ?? {}) as Record<string, unknown>;
      if (config.brightness_mode === 'enhanced') {
        return entity;
      }
    }
  }
  // Fall back to any adaptive lighting switch
  for (const [entityId, entity] of Object.entries(states)) {
    if (entityId.startsWith('switch.adaptive_lighting_')) {
      return entity;
    }
  }
  return null;
}

export interface AdaptiveLightingData {
  connected: boolean;
  entityId: string | null;
  curveSet: CurveSet | null;
  sunTimes: SunTimes | null;
  saveCurves: (curveSet: CurveSet) => void;
}

export function useAdaptiveLighting(hass: HomeAssistant | null): AdaptiveLightingData {
  const entity = useMemo(() => {
    if (!hass) return null;
    return findALSwitch(hass.states);
  }, [hass?.states]);

  const curveData = useMemo(() => {
    if (!entity) return null;
    return entityToCurveData(entity);
  }, [entity]);

  const saveCurves = useCallback(
    (curveSet: CurveSet) => {
      if (!hass || !entity) return;
      const data = curveSetToServiceData(curveSet);
      hass.callService('adaptive_lighting', 'change_switch_settings', data, {
        entity_id: entity.entity_id,
      });
    },
    [hass, entity],
  );

  return {
    connected: hass !== null,
    entityId: entity?.entity_id ?? null,
    curveSet: curveData?.curveSet ?? null,
    sunTimes: curveData?.sunTimes ?? null,
    saveCurves,
  };
}
