import { getMockData } from './data/dataProvider';
import { useCurveData } from './hooks/useCurveData';
import { CurveEditor } from './components/CurveEditor/CurveEditor';
import './App.css';

const { curveSet, sunTimes, currentHour } = getMockData();

export default function App() {
  const curveData = useCurveData(curveSet, sunTimes, currentHour);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Adaptive Lighting</h1>
      </header>
      <CurveEditor data={curveData} curveSet={curveSet} />
    </div>
  );
}
