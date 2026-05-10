import { scaleLinear } from 'd3';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CURVE_SET } from '../data/defaults';
import type { ChartMargins, ResolvedCurve, SunTimes } from '../types/curves';
import {
  colorModeBoundaryDragAction,
  extremePointDragAction,
  hourFromSvgX,
  isRepeatPointerDown,
  pointerDownRecord,
  timingPointDragAction,
} from './timeBearingControl';

const sunTimes: SunTimes = {
  sunriseHour: 6,
  sunsetHour: 18,
};

const margins: ChartMargins = {
  top: 10,
  right: 0,
  bottom: 0,
  left: 20,
};

const xScale = scaleLinear().domain([0, 24]).range([0, 240]);
const yScale = scaleLinear().domain([0, 100]).range([100, 0]);

const resolved: ResolvedCurve = {
  p1: 17.5,
  p2: 23,
  p4: 5.5,
  p5: 6.5,
  p1Value: 100,
  p2Value: 1,
  p4Value: 1,
  p5Value: 100,
  peakHour: 13,
  peakValue: 100,
  valleyHour: 2,
  valleyValue: 1,
  minValue: 1,
  maxValue: 100,
};

describe('timeBearingControl', () => {
  it('normalizes pointer positions to chart hours', () => {
    expect(hourFromSvgX(260, xScale, margins.left)).toBe(0);
    expect(hourFromSvgX(15, xScale, margins.left)).toBe(23.5);
  });

  it('detects repeat pointer down events within the double-click threshold', () => {
    const first = pointerDownRecord('p1', { clientX: 100, clientY: 100 }, 1000);

    expect(isRepeatPointerDown(first, 'p1', { clientX: 102, clientY: 101 }, 1200)).toBe(true);
    expect(isRepeatPointerDown(first, 'p1', { clientX: 120, clientY: 100 }, 1200)).toBe(false);
    expect(isRepeatPointerDown(first, 'p2', { clientX: 102, clientY: 101 }, 1200)).toBe(false);
  });

  it('builds timing point drag actions from SVG coordinates', () => {
    const action = timingPointDragAction({
      svgX: 30,
      svgY: 30,
      margins,
      xScale,
      yScale,
      curveSet: DEFAULT_CURVE_SET,
      curveDefinition: DEFAULT_CURVE_SET.brightness,
      resolved,
      sunTimes,
      curveName: 'brightness',
      pointType: 'transition_start',
    });

    expect(action).toEqual({
      type: 'UPDATE_TIME_POINT',
      curveName: 'brightness',
      pointType: 'transition_start',
      newValue: -180,
      newYValue: 80,
      sunTimes,
    });
  });

  it('builds extreme point drag actions from SVG coordinates', () => {
    const action = extremePointDragAction({
      svgX: 150,
      svgY: 60,
      margins,
      xScale,
      yScale,
      resolved,
      curveName: 'brightness',
      sunTimes,
      pointId: 'peak',
    });

    expect(action).toEqual({
      type: 'UPDATE_PEAK',
      curveName: 'brightness',
      newHour: 13,
      newValue: 50,
      sunTimes,
    });
  });

  it('builds Color Mode boundary drag actions from SVG coordinates', () => {
    expect(colorModeBoundaryDragAction({
      svgX: 80,
      marginsLeft: margins.left,
      xScale,
      boundary: 'start',
      colorTempStartHour: 6,
      colorTempEndHour: 7,
      sunTimes,
    })).toEqual({
      type: 'UPDATE_COLOR_MODE_BOUNDARY',
      boundary: 'start',
      newHour: 6,
      sunTimes,
    });

    expect(colorModeBoundaryDragAction({
      svgX: 82,
      marginsLeft: margins.left,
      xScale,
      boundary: 'end',
      colorTempStartHour: 6,
      colorTempEndHour: 7,
      sunTimes,
    })).toEqual({
      type: 'UPDATE_COLOR_MODE_BOUNDARY',
      boundary: 'end',
      newHour: 6.5,
      sunTimes,
    });
  });
});
