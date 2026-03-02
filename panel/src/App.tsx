import { useCallback, useReducer } from 'react';
import { getMockData } from './data/dataProvider';
import { useCurveData } from './hooks/useCurveData';
import { useYearSimulation } from './hooks/useYearSimulation';
import { curveSetReducer } from './hooks/useCurveSetReducer';
import { CurveEditor } from './components/CurveEditor/CurveEditor';
import { YearSimulator } from './components/YearSimulator/YearSimulator';
import type { CurveSetAction } from './types/curves';
import './App.css';

const { curveSet: initialCurveSet, currentHour } = getMockData();

export default function App() {
  const [curveSet, dispatch] = useReducer(curveSetReducer, initialCurveSet);
  const [simState, simControls] = useYearSimulation();
  const curveData = useCurveData(curveSet, simState.effectiveSunTimes, currentHour);

  const handlePointDrag = useCallback(
    (action: CurveSetAction) => dispatch(action),
    [],
  );

  const handlePointDragEnd = useCallback(
    (action: CurveSetAction) => dispatch(action),
    [],
  );

  const handleToggleLinked = useCallback(
    () => dispatch({ type: 'TOGGLE_LINKED' }),
    [],
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>Adaptive Lighting</h1>
      </header>
      <CurveEditor
        data={curveData}
        curveSet={curveSet}
        sunTimes={simState.effectiveSunTimes}
        onPointDrag={handlePointDrag}
        onPointDragEnd={handlePointDragEnd}
        onToggleLinked={handleToggleLinked}
        readOnly={simState.isPlaying}
      />
      <YearSimulator state={simState} controls={simControls} />
    </div>
  );
}
