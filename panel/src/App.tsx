import { useCallback, useReducer } from 'react';
import { getMockData } from './data/dataProvider';
import { useCurveData } from './hooks/useCurveData';
import { curveSetReducer } from './hooks/useCurveSetReducer';
import { CurveEditor } from './components/CurveEditor/CurveEditor';
import type { CurveSetAction } from './types/curves';
import './App.css';

const { curveSet: initialCurveSet, sunTimes, currentHour } = getMockData();

export default function App() {
  const [curveSet, dispatch] = useReducer(curveSetReducer, initialCurveSet);
  const curveData = useCurveData(curveSet, sunTimes, currentHour);

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
        sunTimes={sunTimes}
        onPointDrag={handlePointDrag}
        onPointDragEnd={handlePointDragEnd}
        onToggleLinked={handleToggleLinked}
      />
    </div>
  );
}
