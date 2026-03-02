import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SunTimes } from '../types/curves';
import { MONTVALE_COORDS } from '../data/defaults';
import { dayOfYear, dayOfYearToDate, precomputeYearSunData } from '../data/yearSunData';

export interface YearSimulationState {
  isPlaying: boolean;
  currentDay: number;
  speed: number;
  effectiveSunTimes: SunTimes;
  currentDate: Date;
  daysInYear: number;
  daylightHoursByDay: number[];
}

export interface YearSimulationControls {
  stop: () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (speed: number) => void;
  seekToDay: (day: number) => void;
}

export function useYearSimulation(): [YearSimulationState, YearSimulationControls] {
  const currentYear = new Date().getFullYear();

  const yearData = useMemo(
    () => precomputeYearSunData(MONTVALE_COORDS.lat, MONTVALE_COORDS.lng, currentYear),
    [currentYear],
  );

  const daylightHoursByDay = useMemo(
    () => yearData.sunTimesByDay.map(st => st.sunsetHour - st.sunriseHour),
    [yearData],
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDay, setCurrentDay] = useState(() => dayOfYear(new Date()));
  const [speed, setSpeedState] = useState(1);

  // Refs for rAF loop to avoid stale closures
  const speedRef = useRef(speed);
  const dayRef = useRef(currentDay);
  const lastTimestampRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { dayRef.current = currentDay; }, [currentDay]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const tick = useCallback((timestamp: number) => {
    if (!isPlayingRef.current) return;

    if (lastTimestampRef.current !== null) {
      const deltaMs = timestamp - lastTimestampRef.current;
      // At speed 1.0: complete a full year in ~12 seconds
      const daysPerSecond = (yearData.daysInYear / 12) * speedRef.current;
      accumulatorRef.current += (deltaMs / 1000) * daysPerSecond;

      if (accumulatorRef.current >= 1) {
        const wholeDays = Math.floor(accumulatorRef.current);
        accumulatorRef.current -= wholeDays;
        const newDay = (dayRef.current + wholeDays) % yearData.daysInYear;
        setCurrentDay(newDay);
      }
    }

    lastTimestampRef.current = timestamp;
    rafIdRef.current = requestAnimationFrame(tick);
  }, [yearData.daysInYear]);

  const startRaf = useCallback(() => {
    lastTimestampRef.current = null;
    accumulatorRef.current = 0;
    rafIdRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopRaf = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    lastTimestampRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => stopRaf, [stopRaf]);

  const stop = useCallback(() => {
    stopRaf();
    setIsPlaying(false);
    setCurrentDay(dayOfYear(new Date()));
  }, [stopRaf]);

  const play = useCallback(() => {
    setIsPlaying(true);
    startRaf();
  }, [startRaf]);

  const pause = useCallback(() => {
    stopRaf();
    setIsPlaying(false);
  }, [stopRaf]);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  const setSpeed = useCallback((newSpeed: number) => {
    setSpeedState(newSpeed);
  }, []);

  const seekToDay = useCallback((day: number) => {
    const clamped = Math.max(0, Math.min(yearData.daysInYear - 1, Math.round(day)));
    setCurrentDay(clamped);
    // Reset accumulator to avoid jumps after seek
    accumulatorRef.current = 0;
    lastTimestampRef.current = null;
  }, [yearData.daysInYear]);

  const effectiveSunTimes = yearData.sunTimesByDay[currentDay];
  const currentDate = dayOfYearToDate(currentDay, yearData.year);

  const state: YearSimulationState = {
    isPlaying,
    currentDay,
    speed,
    effectiveSunTimes,
    currentDate,
    daysInYear: yearData.daysInYear,
    daylightHoursByDay,
  };

  const controls: YearSimulationControls = {
    stop,
    play,
    pause,
    toggle,
    setSpeed,
    seekToDay,
  };

  return [state, controls];
}
