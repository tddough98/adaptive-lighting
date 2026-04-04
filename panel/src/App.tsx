import { useCallback, useEffect, useReducer } from 'react';
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

  // When HA entity data arrives/changes, reset local state to match
  useEffect(() => {
    if (al.curveSet) {
      dispatch({ type: 'RESET', curveSet: al.curveSet });
    }
  }, [al.entityId]); // Only reset when switching entities, not on every attribute update

  const [simState, simControls] = useYearSimulation();

  // Use HA sun times if available, otherwise simulation sun times
  const effectiveSunTimes = al.sunTimes ?? simState.effectiveSunTimes;
  const curveData = useCurveData(curveSet, effectiveSunTimes, mockData.currentHour);

  const handlePointDrag = useCallback(
    (action: CurveSetAction) => dispatch(action),
    [],
  );

  const handlePointDragEnd = useCallback(
    (action: CurveSetAction) => dispatch(action),
    [],
  );

  // Save current curves to HA
  const handleSave = useCallback(() => {
    al.saveCurves(curveSet);
  }, [al, curveSet]);

  const handleToggleLinked = useCallback(
    () => dispatch({ type: 'TOGGLE_LINKED' }),
    [],
  );

  return (
    <HAContext.Provider value={hass}>
      <div className="app">
        <header className="app-header">
          <h1>Adaptive Lighting</h1>
          {al.connected && (
            <button className="save-button" onClick={handleSave}>
              Save to HA
            </button>
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
