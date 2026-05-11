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
  const [enhancedOptInAccepted, setEnhancedOptInAccepted] = useState(false);

  // Initialize from HA if connected, otherwise mock data
  const initialCurveSet = al.curveSet ?? mockData.curveSet;
  const [curveSet, dispatch] = useReducer(curveSetReducer, initialCurveSet);
  const [appliedSavedPlanVersion, setAppliedSavedPlanVersion] = useState<string | null>(al.savedPlanVersion);

  // When HA entity data arrives/changes, reset local state to match
  useEffect(() => {
    if (al.curveSet) {
      dispatch({ type: 'RESET', curveSet: al.curveSet });
      setAppliedSavedPlanVersion(al.savedPlanVersion);
      setEnhancedOptInAccepted(al.selectedInstance?.isEnhancedMode ?? false);
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
    if (al.requiresEnhancedModeOptIn && !enhancedOptInAccepted) {
      return;
    }
    await al.saveCurves(curveSet);
  }, [al, curveSet, enhancedOptInAccepted]);

  const saveButtonLabel = (() => {
    switch (al.saveStatus.type) {
      case 'saving':
        return 'Saving...';
      case 'confirmed':
        return 'Saved';
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
      if (al.draftIsDirty) {
        const shouldDiscard = window.confirm('Discard the current Lighting Plan Draft and switch instances?');
        if (!shouldDiscard) return;
      }
      al.selectInstance(event.target.value);
    },
    [al],
  );

  const handleReloadSavedPlan = useCallback(() => {
    if (!al.curveSet) return;
    dispatch({ type: 'RESET', curveSet: al.curveSet });
    setAppliedSavedPlanVersion(al.savedPlanVersion);
    al.markDraftClean();
  }, [al]);

  const saveStatusText = (() => {
    switch (al.saveStatus.type) {
      case 'idle':
        return al.requiresEnhancedModeOptIn
          ? 'Enhanced Mode opt-in required before saving.'
          : null;
      case 'saving':
        return 'Saving Lighting Plan...';
      case 'confirmed':
        return 'Lighting Plan saved.';
      case 'rejected':
      case 'stale':
        return al.saveStatus.message;
    }
  })();

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
                title={al.saveStatus.type === 'rejected' || al.saveStatus.type === 'stale'
                  ? al.saveStatus.message
                  : undefined}
              >
                {saveButtonLabel}
              </button>
            </div>
          )}
        </header>
        {al.connected && (
          <div className="save-status-row" role="status">
            {al.requiresEnhancedModeOptIn && !enhancedOptInAccepted ? (
              <label className="enhanced-opt-in">
                <input
                  type="checkbox"
                  checked={enhancedOptInAccepted}
                  onChange={(event) => setEnhancedOptInAccepted(event.target.checked)}
                />
                <span>I understand saving will switch this instance to Enhanced Mode.</span>
              </label>
            ) : (
              <span className={`save-status save-status-${al.saveStatus.type}`}>
                {saveStatusText ?? ''}
              </span>
            )}
            {al.saveStatus.type === 'stale' && (
              <button className="status-action-button" onClick={handleReloadSavedPlan}>
                Reload Saved Plan
              </button>
            )}
          </div>
        )}
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
