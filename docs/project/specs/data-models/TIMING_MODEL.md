# Timing Model Specification

> **Version**: 2.0
> **Status**: Implemented (`panel/src/`)

---

## Overview

The enhanced timing model uses a **6-segment curve** with per-point Y-values, peak/valley extreme points, and two interpolation methods (biased tanh for transitions, cosine for peak/valley segments). Each curve (brightness, color temperature) follows the same structure but with independent values.

Source of truth: `panel/src/types/curves.ts`, `panel/src/utils/curvemath.ts`

---

## Visual Representation

```
Value (brightness % or color temp K)

 peak ┤━━━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      │                      ╱   ╲
  p5  │                    ●       ●  p1
      │                  ╱    cos    ╲
      │                ╱   descent     ╲   biased tanh
      │   biased     ╱    from peak      ╲  (evening)
      │   tanh     ╱                       ╲
  p4  │  (morn)  ●                           ●  p2
      │          ╲        cos descent          ╱
      │            ╲      to valley          ╱
      │              ╲                     ╱
      │                ╲    cos ascent   ╱
valley┤━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      │
      └──────────────────────────────────────────────────── Time (0–24h)
           P5      Peak      P1      P2    Valley    P4
          ~7:00    13:00    ~17:30   23:00   2:00    5:30

      6 phases (clockwise from P1):
        P1→P2:       evening_transition  (biased tanh)
        P2→Valley:   descent_to_valley   (cosine)
        Valley→P4:   ascent_from_valley  (cosine)
        P4→P5:       morning_transition  (biased tanh)
        P5→Peak:     ascent_to_peak      (cosine)
        Peak→P1:     descent_from_peak   (cosine)
```

---

## Data Structures

### TimingPoint

A control point on the time axis with its own Y-value.

```typescript
// panel/src/types/curves.ts

type TimingPointType =
  | 'transition_start'   // P1: evening transition begins
  | 'hold_start'         // P2: nighttime hold begins
  | 'hold_end'           // P4: nighttime hold ends
  | 'transition_end';    // P5: morning transition ends

type SunAnchor = 'sunset' | 'sunrise';

interface TimingPoint {
  id: string;
  type: TimingPointType;
  value: number;          // Minutes offset (if relative) or absolute hour 0–24
  isRelative: boolean;
  anchor?: SunAnchor;
  yValue: number;         // Curve value at this point (brightness % or Kelvin)
}
```

**Value interpretation:**

| isRelative | anchor | value meaning |
|------------|--------|---------------|
| `true` | `'sunset'` | Minutes offset from sunset (negative = before) |
| `true` | `'sunrise'` | Minutes offset from sunrise (negative = before) |
| `false` | — | Absolute hour (0–24, e.g. 23.5 = 11:30 PM) |

### ExtremePoint

Peak (daytime max) and valley (nighttime min) between the timing points.

```typescript
interface ExtremePoint {
  hour: number;   // Absolute hour 0–24
  value: number;  // Curve value at this point
}
```

### CurveDefinition

Complete definition of one curve (brightness OR color temp).

```typescript
interface CurveDefinition {
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
```

### ColorModeConfig

Controls how color temperature behaves outside daytime hours.

```typescript
interface ColorModeConfig {
  colorTempStartHour: number | null; // null = follow sunriseHour
  colorTempEndHour: number | null;   // null = follow sunsetHour
  sleepRgbColor: [number, number, number];
}
```

During the daytime window (`colorTempStartHour` to `colorTempEndHour`), the curve maps Kelvin values to blackbody RGB. Outside that window, values interpolate via HSV toward `sleepRgbColor`.

### CurveSet

A complete set of curves (brightness + color temp + color mode).

```typescript
interface CurveSet {
  brightness: CurveDefinition;
  colorTemp: CurveDefinition;
  linked: boolean;
  colorMode: ColorModeConfig;
}
```

When `linked === true`:
- Dragging brightness timing points mirrors the X-position to colorTemp (preserving colorTemp's own yValues)
- Sharpness values are mirrored
- Peak/valley hours are mirrored (values stay independent)
- Only yValues, minValue/maxValue, and peak/valley values differ

### ResolvedCurve

All timing points resolved to absolute hours, used by the calculation engine.

```typescript
interface ResolvedCurve {
  p1: number;  p2: number;  p4: number;  p5: number;
  p1Value: number;  p2Value: number;  p4Value: number;  p5Value: number;
  peakHour: number;   peakValue: number;
  valleyHour: number; valleyValue: number;
  eveningSharpness: number;
  morningSharpness: number;
  minValue: number;
  maxValue: number;
}
```

### CurvePhase

The 6 phases of the curve cycle.

```typescript
type CurvePhase =
  | 'evening_transition'    // P1→P2:      biased tanh
  | 'descent_to_valley'     // P2→Valley:  cosine
  | 'ascent_from_valley'    // Valley→P4:  cosine
  | 'morning_transition'    // P4→P5:      biased tanh
  | 'ascent_to_peak'        // P5→Peak:    cosine
  | 'descent_from_peak';    // Peak→P1:    cosine
```

---

## Default Values

From `panel/src/data/defaults.ts`:

```typescript
const DEFAULT_CURVE_SET: CurveSet = {
  brightness: {
    transitionStart: { id: 'b-ts', type: 'transition_start', value: -30,  isRelative: true,  anchor: 'sunset',  yValue: 100 },
    holdStart:       { id: 'b-hs', type: 'hold_start',       value: 23.0, isRelative: false,                    yValue: 1 },
    holdEnd:         { id: 'b-he', type: 'hold_end',          value: 5.5,  isRelative: false,                    yValue: 1 },
    transitionEnd:   { id: 'b-te', type: 'transition_end',    value: 30,   isRelative: true,  anchor: 'sunrise', yValue: 100 },
    eveningSharpness: 0.5,
    morningSharpness: 0.5,
    minValue: 1,
    maxValue: 100,
    peak:   { hour: 13.0, value: 100 },
    valley: { hour: 2.0,  value: 1 },
  },
  colorTemp: {
    // Same timing positions, different yValues
    transitionStart: { ..., yValue: 5500 },  // Cool
    holdStart:       { ..., yValue: 2000 },  // Warm
    holdEnd:         { ..., yValue: 2000 },
    transitionEnd:   { ..., yValue: 5500 },
    minValue: 2000,    // Warm (Kelvin)
    maxValue: 5500,    // Cool (Kelvin)
    peak:   { hour: 13.0, value: 5500 },
    valley: { hour: 2.0,  value: 2000 },
  },
  linked: true,
  colorMode: {
    colorTempStartHour: null,        // follows sunriseHour
    colorTempEndHour: null,          // follows sunsetHour
    sleepRgbColor: [255, 56, 0],     // Deep orange-red
  },
};
```

---

## Calculation Algorithm

Source: `panel/src/utils/curvemath.ts`

### Step 1: Resolve Absolute Times

```typescript
function resolveTime(point: TimingPoint, sunTimes: SunTimes): number {
  if (!point.isRelative) return point.value;
  const base = point.anchor === 'sunset' ? sunTimes.sunsetHour : sunTimes.sunriseHour;
  let hour = base + point.value / 60;
  if (hour < 0) hour += 24;
  if (hour >= 24) hour -= 24;
  return hour;
}
```

### Step 2: Determine Current Phase

Uses `isInArc()` for midnight-wrapping comparisons across all 6 segment boundaries:

```typescript
function getPhase(hour, p1, p2, valleyHour, p4, p5, peakHour): CurvePhase {
  if (isInArc(hour, p1, p2))         return 'evening_transition';
  if (isInArc(hour, p2, valleyHour)) return 'descent_to_valley';
  if (isInArc(hour, valleyHour, p4)) return 'ascent_from_valley';
  if (isInArc(hour, p4, p5))         return 'morning_transition';
  if (isInArc(hour, p5, peakHour))   return 'ascent_to_peak';
  return 'descent_from_peak';
}
```

### Step 3a: Biased Tanh Interpolation (Transitions)

Used for `evening_transition` (P1→P2) and `morning_transition` (P4→P5).

Sharpness controls both the transition shape AND where the curve value sits at the midpoint:
- sharpness=0 → transition happens late (value ≈ startVal at midpoint)
- sharpness=0.5 → symmetric S-curve (value = average at midpoint)
- sharpness=1 → transition happens early (value ≈ endVal at midpoint)

```typescript
function interpolateWithSharpness(progress: number, sharpness: number, startVal: number, endVal: number): number {
  const s = clamp(sharpness, 0.01, 0.99);
  const u = 2 * s - 1;
  const halfArg = Math.atanh(u);
  const k = Math.max(5, 5 + 2 * Math.abs(halfArg));  // Adaptive steepness
  const b = 0.5 - halfArg / k;                         // Shifted center
  const t = (Math.tanh((progress - b) * k) + 1) / 2;
  return startVal + (endVal - startVal) * t;
}
```

### Step 3b: Cosine Interpolation (Peak/Valley Segments)

Used for the 4 segments connecting timing points to peak/valley. Provides smooth zero-derivative joins at the endpoints.

```typescript
function cosineInterpolate(progress: number, startVal: number, endVal: number): number {
  const t = (1 - Math.cos(progress * Math.PI)) / 2;
  return startVal + (endVal - startVal) * t;
}
```

### Step 4: Full Calculation

```typescript
function calculateValueAtHour(hour: number, resolved: ResolvedCurve): number {
  const phase = getPhase(hour, p1, p2, valleyHour, p4, p5, peakHour);

  switch (phase) {
    case 'evening_transition':
      return interpolateWithSharpness(progress, eveningSharpness, p1Value, p2Value);
    case 'descent_to_valley':
      return cosineInterpolate(progress, p2Value, valleyValue);
    case 'ascent_from_valley':
      return cosineInterpolate(progress, valleyValue, p4Value);
    case 'morning_transition':
      return interpolateWithSharpness(progress, morningSharpness, p4Value, p5Value);
    case 'ascent_to_peak':
      return cosineInterpolate(progress, p5Value, peakValue);
    case 'descent_from_peak':
      return cosineInterpolate(progress, peakValue, p1Value);
  }
}
```

Each phase computes `progress` as `elapsedHours(from, to) / totalDuration` with midnight wrap handling.

---

## Y-Value Constraint Cascade

Source: `panel/src/hooks/useCurveSetReducer.ts`

A strict hierarchy ensures curve values stay physically meaningful:

```
  peak  >=  p1, p5  >=  p2, p4  >=  valley
```

When any point's Y-value changes, the reducer:
1. **Pushes up**: If a point increases, all points that must be >= it are raised if needed
2. **Pushes down**: If a point decreases, all points that must be <= it are lowered if needed

This propagates recursively. For example, dragging `valley` upward will push `p2` and `p4` up if they're below the new valley value, which may in turn push `p1`, `p5`, and `peak` up.

```typescript
const ABOVE: Record<PointKey, PointKey[]> = {
  valley: ['p2', 'p4'],
  p2: ['p1'],   p4: ['p5'],
  p1: ['peak'], p5: ['peak'],
  peak: [],
};
const BELOW: Record<PointKey, PointKey[]> = {
  peak: ['p1', 'p5'],
  p1: ['p2'],   p5: ['p4'],
  p2: ['valley'], p4: ['valley'],
  valley: [],
};
```

---

## Dragging Constraints

### Time Points (2D Drag)

Time points support **two-dimensional dragging**: horizontal (time) and vertical (yValue). The X-position maps to hours, the Y-position maps to the curve value at that point. Drag uses pointer events on the SVG with coordinate conversion via `svgCoords.ts`.

### Sharpness Points (Vertical Only)

Positioned at the visual midpoint of their transition segment. Vertical drag maps to sharpness 0.0–1.0.

### Peak/Valley Points (2D Drag)

Draggable in both X (hour) and Y (value). Peak hour is constrained between P5 and P1 (daytime arc). Valley hour is constrained between P2 and P4 (nighttime arc).

### Y-Axis Tick Drag (Color Temp Only)

The color temperature panel's Y-axis ticks are draggable — dragging the top tick adjusts `maxValue`, dragging the bottom tick adjusts `minValue`. Range is constrained to 1500–6500K with a minimum gap of 200K. The grid lines freeze during drag for visual stability.

### ColorModeBar Boundary Handles

The start and end hours of the color-temp daytime window can be dragged horizontally on the ColorModeBar below the color temp panel.

---

## Serialization Format (for HA Config)

*Aspirational — not yet implemented. The panel currently uses mock data.*

```yaml
adaptive_lighting_enhanced:
  curves:
    brightness:
      transition_start:
        value: -30
        is_relative: true
        anchor: sunset
        y_value: 100
      hold_start:
        value: 23.0
        is_relative: false
        y_value: 1
      # ...
      peak: { hour: 13.0, value: 100 }
      valley: { hour: 2.0, value: 1 }
    color_temp:
      # ... same structure, different y_values ...
    linked: true
    color_mode:
      color_temp_start_hour: null
      color_temp_end_hour: null
      sleep_rgb_color: [255, 56, 0]
```

---

## Edge Cases

### Midnight Crossover
The hold period typically crosses midnight (e.g. 23:00 to 05:30). `isInArc()` handles this: if `start > end`, the arc wraps through midnight.

### Extreme Latitudes
Near polar regions, sunrise/sunset can be missing. Fallback: use 20:00 (sunset) / 06:00 (sunrise) as defaults.

### DST Transitions
Relative times auto-adjust since they depend on calculated sunrise/sunset. Absolute times remain fixed (desired behavior — bedtime doesn't change with DST).
