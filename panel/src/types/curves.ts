export type TimingPointType =
  | 'transition_start' // P1
  | 'hold_start'       // P2
  | 'hold_end'         // P4
  | 'transition_end';  // P5

export type SunAnchor = 'sunset' | 'sunrise';

export interface TimingPoint {
  id: string;
  type: TimingPointType;
  value: number;          // Minutes offset (if relative) or absolute hour 0–24
  isRelative: boolean;
  anchor?: SunAnchor;
}

export interface CurveDefinition {
  transitionStart: TimingPoint;  // P1
  holdStart: TimingPoint;        // P2
  holdEnd: TimingPoint;          // P4
  transitionEnd: TimingPoint;    // P5
  eveningSharpness: number;      // 0.0–1.0
  morningSharpness: number;      // 0.0–1.0
  minValue: number;
  maxValue: number;
}

export interface CurveSet {
  brightness: CurveDefinition;
  colorTemp: CurveDefinition;
  linked: boolean;
}

export interface SunTimes {
  sunriseHour: number;  // Decimal hour, e.g. 6.5 = 6:30 AM
  sunsetHour: number;   // Decimal hour, e.g. 18.75 = 6:45 PM
}

export interface ResolvedCurve {
  p1: number;  // Absolute hour for transition_start
  p2: number;  // Absolute hour for hold_start
  p4: number;  // Absolute hour for hold_end
  p5: number;  // Absolute hour for transition_end
  eveningSharpness: number;
  morningSharpness: number;
  minValue: number;
  maxValue: number;
}

export type CurvePhase =
  | 'day'
  | 'evening_transition'
  | 'hold'
  | 'morning_transition';

export interface ChartMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CurveSample {
  hour: number;
  value: number;
}
