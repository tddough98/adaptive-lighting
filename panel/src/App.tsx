import { useCallback, useEffect, useReducer, useState } from 'react';
import { getMockData } from './data/dataProvider';
import { useCurveData } from './hooks/useCurveData';
import { useYearSimulation } from './hooks/useYearSimulation';
import { curveSetReducer } from './hooks/useCurveSetReducer';
import { CurveEditor } from './components/CurveEditor/CurveEditor';
import { YearSimulator } from './components/YearSimulator/YearSimulator';
import { HAContext } from './ha/HAContext';
import { useAdaptiveLighting } from './ha/useAdaptiveLighting';
import type { HomeAssistant } from './types/homeassistant';
import type { CurveSetAction } from './types/curves';
import './App.css';

const mockData = getMockData();

interface AppProps {
  hass?: HomeAssistant | null;
}

export default function App({ hass = null }: AppProps) {
  const al = useAdaptiveLighting(hass);

  // Initialize from HA if connected, otherwise mock data
  const initialCurveSet = al.curveSet ?? mockData.curveSet;
  const [curveSet, dispatch] = useReducer(curveSetReducer, initialCurveSet);
  const [appliedSavedPlanVersion, setAppliedSavedPlanVersion] = useState<string | null>(al.savedPlanVersion);

  // When HA entity data arrives/changes, reset local state to match
  useEffect(() => {
    if (al.curveSet) {
      dispatch({ type: 'RESET', curveSet: al.curveSet });
      setAppliedSavedPlanVersion(al.savedPlanVersion);
    }
  }, [al.entityId]); // Only reset when switching entities, not on every attribute update

  useEffect(() => {
    if (!al.curveSet || !al.savedPlanVersion) return;
    if (!al.draftIsDirty && appliedSavedPlanVersion !== al.savedPlanVersion) {
      dispatch({ type: 'RESET', curveSet: al.curveSet });
      setAppliedSavedPlanVersion(al.savedPlanVersion);
    }
  }, [al.curveSet, al.savedPlanVersion, al.draftIsDirty, appliedSavedPlanVersion]);

  const [simState, simControls] = useYearSimulation();

  // Use HA sun times if available, otherwise simulation sun times
  const effectiveSunTimes = al.sunTimes ?? simState.effectiveSunTimes;
  const curveData = useCurveData(curveSet, effectiveSunTimes, mockData.currentHour);

  const handlePointDrag = useCallback(
    (action: CurveSetAction) => {
      al.markDraftChanged();
      dispatch(action);
    },
    [al],
  );

  const handlePointDragEnd = useCallback(
    (action: CurveSetAction) => {
      al.markDraftChanged();
      dispatch(action);
    },
    [al],
  );

  // Save current curves to HA
  const handleSave = useCallback(async () => {
    await al.saveCurves(curveSet);
  }, [al, curveSet]);

  const saveButtonLabel = (() => {
    switch (al.saveStatus.type) {
      case 'saving':
        return 'Saving...';
      case 'confirmed':
        return 'Saved';
      case 'normalized':
        return 'Saved with defaults';
      case 'rejected':
        return 'Save failed';
      case 'stale':
        return 'Saved Plan Changed';
      case 'idle':
        return 'Save to HA';
    }
  })();

  const handleToggleLinked = useCallback(
    () => {
      al.markDraftChanged();
      dispatch({ type: 'TOGGLE_LINKED' });
    },
    [al],
  );

  const handleSelectInstance = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      // TODO(slice-4c): warn before discarding dirty draft on instance switch.
      if (al.draftIsDirty) {
        console.warn('Switching Adaptive Lighting Instance discards the current Lighting Plan Draft.');
      }
      al.selectInstance(event.target.value);
    },
    [al],
  );

  return (
    <HAContext.Provider value={hass}>
      <div className="app">
        <header className="app-header">
          <h1>Adaptive Lighting</h1>
          {al.connected && (
            <div className="app-header-controls">
              {al.instances.length > 1 && al.entityId && (
                <select
                  className="instance-select"
                  value={al.entityId}
                  onChange={handleSelectInstance}
                  aria-label="Adaptive Lighting instance"
                >
                  {al.instances.map((instance) => (
                    <option key={instance.entityId} value={instance.entityId}>
                      {instance.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                className="save-button"
                onClick={handleSave}
                disabled={al.saveStatus.type === 'saving'}
                title={al.saveStatus.type === 'rejected' || al.saveStatus.type === 'normalized' || al.saveStatus.type === 'stale'
                  ? al.saveStatus.message
                  : undefined}
              >
                {saveButtonLabel}
              </button>
            </div>
          )}
        </header>
        <CurveEditor
          data={curveData}
          curveSet={curveSet}
          sunTimes={effectiveSunTimes}
          currentDate={simState.currentDate}
          onPointDrag={handlePointDrag}
          onPointDragEnd={handlePointDragEnd}
          onToggleLinked={handleToggleLinked}
          readOnly={simState.isPlaying}
        />
        {!al.connected && (
          <YearSimulator state={simState} controls={simControls} />
        )}
      </div>
    </HAContext.Provider>
  );
}
