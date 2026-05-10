import type { ScaleLinear } from 'd3';
import type {
  ChartMargins,
  CurveDefinition,
  CurveName,
  CurveSet,
  CurveSetAction,
  ResolvedCurve,
  SunTimes,
  TimingPointType,
} from '../types/curves';
import {
  absoluteHourToTimingValue,
  clampHourInArc,
  constrainYValue,
  getPeakConstraints,
  getTimePointConstraints,
  getValleyConstraints,
  snapToMinutes,
} from '../utils/constraints';

export const DOUBLE_CLICK_MS = 300;
export const DOUBLE_CLICK_RADIUS = 5;
export const CLIP_VISIBLE_THRESHOLD_PX = 0.5;

export interface PointerDownRecord {
  pointId: string;
  time: number;
  x: number;
  y: number;
}

export interface PointerLike {
  clientX: number;
  clientY: number;
}

export const TIMING_POINT_FIELDS: Record<TimingPointType, keyof CurveDefinition> = {
  transition_start: 'transitionStart',
  hold_start: 'holdStart',
  hold_end: 'holdEnd',
  transition_end: 'transitionEnd',
};

export function normalizeHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

export function hourFromSvgX(
  svgX: number,
  xScale: ScaleLinear<number, number>,
  marginsLeft: number,
): number {
  return normalizeHour(xScale.invert(svgX - marginsLeft));
}

export function valueFromSvgY(
  svgY: number,
  yScale: ScaleLinear<number, number>,
  marginsTop: number,
): number {
  return yScale.invert(svgY - marginsTop);
}

export function snapHour(hour: number, snapMinutes: number): number {
  return normalizeHour(snapToMinutes(hour, snapMinutes));
}

export function pointerDownRecord(
  pointId: string,
  pointer: PointerLike,
  time = Date.now(),
): PointerDownRecord {
  return { pointId, time, x: pointer.clientX, y: pointer.clientY };
}

export function isRepeatPointerDown(
  previous: PointerDownRecord | null,
  pointId: string,
  pointer: PointerLike,
  time = Date.now(),
): boolean {
  return Boolean(
    previous &&
    previous.pointId === pointId &&
    time - previous.time < DOUBLE_CLICK_MS &&
    Math.hypot(pointer.clientX - previous.x, pointer.clientY - previous.y) < DOUBLE_CLICK_RADIUS,
  );
}

interface TimingPointDragActionOptions {
  svgX: number;
  svgY: number;
  margins: ChartMargins;
  xScale: ScaleLinear<number, number>;
  yScale: ScaleLinear<number, number>;
  curveSet: CurveSet;
  curveDefinition: CurveDefinition;
  resolved: ResolvedCurve;
  sunTimes: SunTimes;
  curveName: CurveName;
  pointType: TimingPointType;
}

export function timingPointDragAction({
  svgX,
  svgY,
  margins,
  xScale,
  yScale,
  curveSet,
  curveDefinition,
  resolved,
  sunTimes,
  curveName,
  pointType,
}: TimingPointDragActionOptions): CurveSetAction {
  const rawHour = hourFromSvgX(svgX, xScale, margins.left);
  const constraints = getTimePointConstraints(pointType, curveSet, sunTimes, curveName);
  const clamped = clampHourInArc(rawHour, constraints.minHour, constraints.maxHour);
  const snapped = snapHour(clamped, constraints.snapMinutes);
  const field = TIMING_POINT_FIELDS[pointType];
  const point = curveDefinition[field];
  const tp = point as { isRelative: boolean; anchor?: 'sunset' | 'sunrise' };
  const newValue = absoluteHourToTimingValue(snapped, tp.isRelative, tp.anchor, sunTimes);
  const rawY = valueFromSvgY(svgY, yScale, margins.top);
  const newYValue = constrainYValue(rawY, resolved.minValue, resolved.maxValue);

  return {
    type: 'UPDATE_TIME_POINT',
    curveName,
    pointType,
    newValue,
    newYValue,
    sunTimes,
  };
}

interface ExtremePointDragActionOptions {
  svgX: number;
  svgY: number;
  margins: ChartMargins;
  xScale: ScaleLinear<number, number>;
  yScale: ScaleLinear<number, number>;
  resolved: ResolvedCurve;
  curveName: CurveName;
  sunTimes: SunTimes;
  pointId: 'peak' | 'valley';
}

export function extremePointDragAction({
  svgX,
  svgY,
  margins,
  xScale,
  yScale,
  resolved,
  curveName,
  sunTimes,
  pointId,
}: ExtremePointDragActionOptions): CurveSetAction {
  const rawHour = hourFromSvgX(svgX, xScale, margins.left);
  const { minHour, maxHour } = pointId === 'peak'
    ? getPeakConstraints(resolved)
    : getValleyConstraints(resolved);
  const newHour = snapHour(clampHourInArc(rawHour, minHour, maxHour), 5);
  const rawY = valueFromSvgY(svgY, yScale, margins.top);
  const newValue = constrainYValue(rawY, resolved.minValue, resolved.maxValue);

  return pointId === 'peak'
    ? { type: 'UPDATE_PEAK', curveName, newHour, newValue, sunTimes }
    : { type: 'UPDATE_VALLEY', curveName, newHour, newValue, sunTimes };
}

interface ColorModeBoundaryDragActionOptions {
  svgX: number;
  marginsLeft: number;
  xScale: ScaleLinear<number, number>;
  boundary: 'start' | 'end';
  colorTempStartHour: number;
  colorTempEndHour: number;
  sunTimes: SunTimes;
}

export function colorModeBoundaryDragAction({
  svgX,
  marginsLeft,
  xScale,
  boundary,
  colorTempStartHour,
  colorTempEndHour,
  sunTimes,
}: ColorModeBoundaryDragActionOptions): CurveSetAction {
  const rawHour = xScale.invert(svgX - marginsLeft);
  const snapped = snapToMinutes(Math.max(0, Math.min(24, rawHour)), 1);

  if (boundary === 'start') {
    const clamped = Math.min(snapped, colorTempEndHour - 0.5);
    return {
      type: 'UPDATE_COLOR_MODE_BOUNDARY',
      boundary,
      newHour: Math.max(0, clamped),
      sunTimes,
    };
  }

  const clamped = Math.max(snapped, colorTempStartHour + 0.5);
  return {
    type: 'UPDATE_COLOR_MODE_BOUNDARY',
    boundary,
    newHour: Math.min(24, clamped),
    sunTimes,
  };
}
