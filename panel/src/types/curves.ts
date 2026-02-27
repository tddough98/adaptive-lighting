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
  yValue: number;         // Curve value at this point (e.g. brightness % or Kelvin)
}

export interface ExtremePoint {
  hour: number;   // Absolute hour 0–24
  value: number;  // Curve value at this point
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
  peak: ExtremePoint;            // Daytime maximum between P5→P1
  valley: ExtremePoint;          // Nighttime minimum between P2→P4
}

export interface ColorModeConfig {
  colorTempStartHour: number | null; // null = follow sunriseHour
  colorTempEndHour: number | null;   // null = follow sunsetHour
  sleepRgbColor: [number, number, number];
}

export interface CurveSet {
  brightness: CurveDefinition;
  colorTemp: CurveDefinition;
  linked: boolean;
  colorMode: ColorModeConfig;
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
  p1Value: number;
  p2Value: number;
  p4Value: number;
  p5Value: number;
  peakHour: number;
  peakValue: number;
  valleyHour: number;
  valleyValue: number;
  eveningSharpness: number;
  morningSharpness: number;
  minValue: number;
  maxValue: number;
}

export type CurvePhase =
  | 'evening_transition'    // P1→P2
  | 'descent_to_valley'     // P2→Valley
  | 'ascent_from_valley'    // Valley→P4
  | 'morning_transition'    // P4→P5
  | 'ascent_to_peak'        // P5→Peak
  | 'descent_from_peak';    // Peak→P1

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

export type CurveName = 'brightness' | 'colorTemp';

export type CurveSetAction =
  | {
      type: 'UPDATE_TIME_POINT';
      curveName: CurveName;
      pointType: TimingPointType;
      newValue: number;
      newYValue: number;
    }
  | {
      type: 'UPDATE_SHARPNESS';
      curveName: CurveName;
      which: 'evening' | 'morning';
      newSharpness: number;
    }
  | {
      type: 'UPDATE_PEAK';
      curveName: CurveName;
      newHour: number;
      newValue: number;
    }
  | {
      type: 'UPDATE_VALLEY';
      curveName: CurveName;
      newHour: number;
      newValue: number;
    }
  | { type: 'TOGGLE_LINKED' }
  | { type: 'UPDATE_COLOR_MODE_BOUNDARY'; boundary: 'start' | 'end'; newHour: number };
