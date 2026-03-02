# Curve Editor UI Specification

> **Version**: 2.0
> **Status**: Implemented (`panel/src/components/`)
> **Rendering**: React SVG with D3 for scales only (`scaleLinear`, `line` generator)

---

## Overview

The curve editor displays brightness and color temperature curves over a 24-hour period using **two stacked chart panels**, each with its own Y-axis, gradient background, and draggable control points. A color mode bar sits below the color temperature panel.

Source of truth: `panel/src/components/CurveEditor/`, `panel/src/components/ChartCanvas/`

---

## Visual Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  [🔗 Linked]                                                      │
│                                                                    │
│  ┌─ Brightness ──────────────────────────────────────────────┐   │
│  │ YAxisColorbar │                                    │ 100% │   │
│  │ (gradient)    │  ━━━━Peak━━━●━━━━━━━━━━━━━━━━━━━━ │      │   │
│  │               │           ╱   ╲                    │  75% │   │
│  │               │   ●P5   ╱       ╲  P1●            │      │   │
│  │               │       ╱    cos      ╲  tanh       │  50% │   │
│  │               │     ╱                  ╲          │      │   │
│  │               │   ●P4                    ●P2      │  25% │   │
│  │               │     ╲                  ╱          │      │   │
│  │               │       ╲  Valley  ●  ╱             │   1% │   │
│  │               │────────────────────────────────────│      │   │
│  │               │ 12  15  18  21  0  3  6  9  12    │      │   │
│  └───────────────┴────────────────────────────────────┴──────┘   │
│                                                                    │
│  ┌─ Color Temperature ───────────────────────────────────────┐   │
│  │ YAxisColorbar │                                    │5500K │   │
│  │ (blackbody    │  ━━━━Peak━━━●━━━━━━━━━━━━━━━━━━━━ │      │   │
│  │  gradient)    │           ╱   ╲                    │      │   │
│  │               │  ─ ─ ─ ╱ ─ ─ ─ ╲ ─ ─ ─ ─ ─ ─ ─ │      │   │
│  │               │      ╱              ╲             │      │   │
│  │               │    ╱                   ╲          │      │   │
│  │               │  ●                       ●        │      │   │
│  │               │    ╲     Valley  ●     ╱          │2000K │   │
│  │               │────────────────────────────────────│      │   │
│  │               │ 12  15  18  21  0  3  6  9  12    │      │   │
│  └───────────────┴────────────────────────────────────┴──────┘   │
│  ┌─ ColorModeBar ────────────────────────────────────────────┐   │
│  │  ▓▓▓▓▓▓▓│color_temp mode│▓▓▓▓▓▓▓▓▓▓▓│ sleep RGB │▓▓▓▓▓▓ │   │
│  │         ↑start          ↑end                               │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

Key differences from v1.0:
- **Two separate panels** instead of one dual-axis chart
- **Per-point Y-values** — each timing point sits at its own Y height
- **Peak and Valley markers** — draggable extreme points
- **Gradient backgrounds** — fill under curve colored by value
- **Y-axis colorbar** — vertical gradient strip showing the value-to-color mapping
- **ColorModeBar** — shows daytime/nighttime color mode regions
- **Y-axis tick drag** — color temp Y-axis ticks are draggable to adjust range

---

## Component Hierarchy

```
CurveEditor
├── LinkedToggle
├── SingleCurvePanel (brightness)
│   └── ChartCanvas (SVG container with margins)
│       ├── CurveGradientBackground
│       ├── GridLines
│       ├── SunEventMarkers
│       ├── CurvePath
│       ├── SingleCurveTimeIndicator
│       ├── TimePointMarkers (P1, P2, P4, P5)
│       ├── SharpnessPointMarkers (evening, morning)
│       ├── ExtremePointMarkers (peak, valley)
│       ├── XAxisLabels
│       ├── YAxisColorbar
│       └── YAxisLabels
├── SingleCurvePanel (colorTemp)
│   └── ChartCanvas
│       └── (same sub-components, with tickDrag on YAxisLabels)
└── ColorModeBar
```

### File Locations

| Component | File |
|-----------|------|
| `CurveEditor` | `components/CurveEditor/CurveEditor.tsx` |
| `SingleCurvePanel` | `components/CurveEditor/SingleCurvePanel.tsx` |
| `LinkedToggle` | `components/CurveEditor/LinkedToggle.tsx` |
| `ChartCanvas` | `components/ChartCanvas/ChartCanvas.tsx` |
| `CurveGradientBackground` | `components/ChartCanvas/CurveGradientBackground.tsx` |
| `GridLines` | `components/ChartCanvas/GridLines.tsx` |
| `SunEventMarkers` | `components/ChartCanvas/SunEventMarkers.tsx` |
| `CurvePath` | `components/ChartCanvas/CurvePath.tsx` |
| `SingleCurveTimeIndicator` | `components/ChartCanvas/SingleCurveTimeIndicator.tsx` |
| `TimePointMarkers` | `components/ChartCanvas/TimePointMarkers.tsx` |
| `SharpnessPointMarkers` | `components/ChartCanvas/SharpnessPointMarkers.tsx` |
| `ExtremePointMarkers` | `components/ChartCanvas/ExtremePointMarkers.tsx` |
| `YAxisColorbar` | `components/ChartCanvas/YAxisColorbar.tsx` |
| `ColorModeBar` | `components/ChartCanvas/ColorModeBar.tsx` |
| `XAxisLabels` | `components/XAxisLabels.tsx` |
| `YAxisLabels` | `components/YAxisLabels.tsx` |

---

## Chart Dimensions

```typescript
// SingleCurvePanel.tsx
const WIDTH = 540;
const HEIGHT = 310;
const MARGINS: ChartMargins = { top: 16, right: 20, bottom: 36, left: 50 };
// Inner drawing area: 470 × 258
```

Both panels use the same dimensions. The X-axis spans 0–24 hours mapped to `innerWidth` (470px). Y-axis domains differ: brightness uses [0, 100], color temp uses [minK, maxK] (default [2000, 5500]).

---

## Draggable Elements

There are 5 types of draggable elements, each dispatching `CurveSetAction` events:

### 1. TimePointMarkers (2D Drag)

P1, P2, P4, P5 — draggable in both X (time) and Y (yValue).

| Point | Default Position | Drag Behavior |
|-------|------------------|---------------|
| P1 (transition_start) | sunset - 30min, yValue=max | X: hours, Y: curve value |
| P2 (hold_start) | 23:00, yValue=min | X: hours, Y: curve value |
| P4 (hold_end) | 05:30, yValue=min | X: hours, Y: curve value |
| P5 (transition_end) | sunrise + 30min, yValue=max | X: hours, Y: curve value |

Dispatches: `{ type: 'UPDATE_TIME_POINT', curveName, pointType, newValue, newYValue }`

### 2. SharpnessPointMarkers (Vertical Only)

Positioned at the X-midpoint of their transition segment, Y-position maps to sharpness 0–1.

| Point | Segment | Dispatch |
|-------|---------|----------|
| Evening sharpness | P1↔P2 midpoint | `{ type: 'UPDATE_SHARPNESS', curveName, which: 'evening', newSharpness }` |
| Morning sharpness | P4↔P5 midpoint | `{ type: 'UPDATE_SHARPNESS', curveName, which: 'morning', newSharpness }` |

### 3. ExtremePointMarkers (2D Drag)

Peak and valley points — draggable in X (hour) and Y (value).

| Point | Default | Dispatch |
|-------|---------|----------|
| Peak | hour: 13.0, value: max | `{ type: 'UPDATE_PEAK', curveName, newHour, newValue }` |
| Valley | hour: 2.0, value: min | `{ type: 'UPDATE_VALLEY', curveName, newHour, newValue }` |

### 4. Y-Axis Tick Drag (Color Temp Only)

The top and bottom Y-axis ticks on the color temp panel are draggable vertically to adjust the color temperature range (minValue/maxValue). Constrained to 1500–6500K with minimum 200K gap. Grid lines freeze at drag-start positions for visual stability.

Dispatches: `{ type: 'UPDATE_COLOR_TEMP_RANGE', newMin, newMax }`

### 5. ColorModeBar Boundary Handles

Start and end hour handles on the bar below the color temp panel.

Dispatches: `{ type: 'UPDATE_COLOR_MODE_BOUNDARY', boundary: 'start' | 'end', newHour }`

---

## Event Handling

All drag interactions flow through a reducer-action system:

```typescript
// CurveSetAction union type (panel/src/types/curves.ts)
type CurveSetAction =
  | { type: 'UPDATE_TIME_POINT'; curveName: CurveName; pointType: TimingPointType; newValue: number; newYValue: number }
  | { type: 'UPDATE_SHARPNESS'; curveName: CurveName; which: 'evening' | 'morning'; newSharpness: number }
  | { type: 'UPDATE_PEAK'; curveName: CurveName; newHour: number; newValue: number }
  | { type: 'UPDATE_VALLEY'; curveName: CurveName; newHour: number; newValue: number }
  | { type: 'TOGGLE_LINKED' }
  | { type: 'UPDATE_COLOR_MODE_BOUNDARY'; boundary: 'start' | 'end'; newHour: number }
  | { type: 'UPDATE_COLOR_TEMP_RANGE'; newMin: number; newMax: number }
```

Components receive two callbacks:
- `onPointDrag(action)` — called continuously during drag (live preview)
- `onPointDragEnd(action)` — called once when drag finishes (for persistence, when implemented)

The reducer (`curveSetReducer` in `useCurveSetReducer.ts`) handles:
1. Updating the target field
2. Enforcing Y-value constraint cascade
3. Mirroring to colorTemp when linked (timing + sharpness only, not yValues)

---

## Curve Rendering

### Path Generation

`panel/src/utils/pathgen.ts` samples the curve at regular intervals to produce `CurveSample[]`:

```typescript
interface CurveSample {
  hour: number;
  value: number;
}
```

### CurvePath

Uses D3's `line()` generator with `xScale` and `yScale` to convert samples to an SVG `<path>` element. Brightness uses a solid stroke; color temp uses a dashed stroke (`dashArray="6 3"`).

### CurveGradientBackground

Renders vertical strips under the curve, each colored by the value-to-color mapping function. For brightness, this maps value → grayscale. For color temp, this maps value + hour → blackbody RGB (daytime) or HSV-lerped sleep color (nighttime).

### YAxisColorbar

A narrow vertical gradient strip to the left of the chart area showing the Y-axis color mapping (brightness grayscale or blackbody spectrum).

---

## ColorModeBar

Renders below the color temp panel. Shows a horizontal bar divided into:
- **Daytime region** (colorTempStartHour to colorTempEndHour): colored by the color temp curve samples using blackbody colors
- **Nighttime region**: colored using the HSV-interpolated sleep RGB mode

Two draggable boundary handles allow adjusting the start/end hours.

---

## Linked vs Unlinked Mode

Controlled by `LinkedToggle` at the top of the editor.

**Linked** (`curveSet.linked === true`):
- Dragging brightness time points mirrors X-position to colorTemp
- Sharpness changes mirror to colorTemp
- Peak/valley hour changes mirror to colorTemp
- Each curve keeps independent yValues, peak/valley values, and min/maxValues

**Unlinked** (`curveSet.linked === false`):
- Each panel's points are fully independent
- No mirroring of any kind

---

## Aspirational Features (Not Yet Implemented)

- **Keyboard accessibility**: Arrow key adjustment of draggable points
- **Responsive behavior**: Layout adaptation for different viewport sizes
- **Touch optimization**: Larger touch targets on mobile
- **HA WebSocket sync**: Real-time bidirectional communication with the backend

---

## Performance

- Drag events use pointer events with `svgCoords.ts` for coordinate conversion
- D3 scales are memoized with `useMemo`
- Color mapping functions use `useCallback` to prevent child re-renders
- Curve sampling happens in the `useCurveData` hook, recomputed only when inputs change
