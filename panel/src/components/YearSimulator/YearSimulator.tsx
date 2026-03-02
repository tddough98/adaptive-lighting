import { useCallback, useMemo, useRef } from 'react';
import type { YearSimulationState, YearSimulationControls } from '../../hooks/useYearSimulation';
import './YearSimulator.css';

interface YearSimulatorProps {
  state: YearSimulationState;
  controls: YearSimulationControls;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SPEEDS = [0.5, 1, 2, 4];

// Approximate day-of-year for the start of each month (non-leap)
const MONTH_START_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

// Number of evenly-spaced color stops for the daylight gradient
const GRADIENT_STOPS = 36;

/** Interpolate HSL between short-day (slate blue) and long-day (golden amber). */
function daylightColor(t: number): string {
  // t: 0 = shortest day, 1 = longest day
  // Slate blue hsl(220, 45%, 40%) → Golden amber hsl(42, 90%, 55%)
  const h = 220 + t * (42 - 220); // 220 → 42
  const s = 45 + t * (90 - 45);
  const l = 40 + t * (55 - 40);
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

function buildDaylightGradient(daylightHours: number[], daysInYear: number): string {
  const min = Math.min(...daylightHours);
  const max = Math.max(...daylightHours);
  const range = max - min || 1;

  const stops: string[] = [];
  for (let i = 0; i <= GRADIENT_STOPS; i++) {
    const dayIndex = Math.round((i / GRADIENT_STOPS) * (daysInYear - 1));
    const t = (daylightHours[dayIndex] - min) / range;
    const pct = (i / GRADIENT_STOPS) * 100;
    stops.push(`${daylightColor(t)} ${pct.toFixed(1)}%`);
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2.5v11l9-5.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2" width="3.5" height="12" rx="0.5" />
      <rect x="9.5" y="2" width="3.5" height="12" rx="0.5" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 2v4h4" />
      <path d="M3.5 6A5.5 5.5 0 1 1 2.5 8.5" />
    </svg>
  );
}

export function YearSimulator({ state, controls }: YearSimulatorProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const dayToPercent = (day: number) => (day / (state.daysInYear - 1)) * 100;

  const trackGradient = useMemo(
    () => buildDaylightGradient(state.daylightHoursByDay, state.daysInYear),
    [state.daylightHoursByDay, state.daysInYear],
  );

  const clientXToDay = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(fraction * (state.daysInYear - 1));
  }, [state.daysInYear]);

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    controls.seekToDay(clientXToDay(e.clientX));
  }, [clientXToDay, controls]);

  const handleHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      controls.seekToDay(clientXToDay(ev.clientX));
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [clientXToDay, controls]);

  const percent = dayToPercent(state.currentDay);

  return (
    <div className="year-simulator">
      <div className="year-simulator-bar">
        <div className="year-simulator-controls">
          {/* Transport */}
          <div className="year-sim-transport">
            <button className="year-sim-btn" onClick={controls.toggle} title={state.isPlaying ? 'Pause' : 'Play'}>
              {state.isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button className="year-sim-btn" onClick={controls.stop} title="Reset to today">
              <ResetIcon />
            </button>
          </div>

          {/* Scrubber */}
          <div className="year-sim-scrubber">
            <div
              className="year-sim-track"
              ref={trackRef}
              onClick={handleTrackClick}
              style={{ background: trackGradient }}
            >
              <div className="year-sim-ticks">
                {MONTH_START_DAYS.map((day, i) => {
                  const tickPercent = (day / (state.daysInYear - 1)) * 100;
                  return (
                    <div
                      key={i}
                      className="year-sim-tick"
                      style={{ left: `${tickPercent}%` }}
                    />
                  );
                })}
              </div>
              <div
                className="year-sim-handle"
                style={{ left: `${percent}%` }}
                onMouseDown={handleHandleMouseDown}
              />
            </div>
            <div className="year-sim-month-labels">
              {MONTH_LABELS.map((label, i) => {
                const labelPercent = (MONTH_START_DAYS[i] / (state.daysInYear - 1)) * 100;
                return (
                  <span
                    key={label}
                    className="year-sim-month-label"
                    style={{ left: `${labelPercent}%` }}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Speed */}
          <div className="year-sim-speeds">
            {SPEEDS.map((s) => (
              <button
                key={s}
                className={`year-sim-speed-btn${state.speed === s ? ' active' : ''}`}
                onClick={() => controls.setSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Date */}
          <div className="year-sim-date">
            {formatDate(state.currentDate)}
          </div>
        </div>
      </div>
    </div>
  );
}
