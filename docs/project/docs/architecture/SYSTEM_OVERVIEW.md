# System Architecture Overview

> **Version**: 2.0
> **Last Updated**: 2026-03-02

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER'S BROWSER                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     REACT CUSTOM PANEL                               │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ CurveEditor                                   ✅ Implemented │    │   │
│  │  │  • Two stacked SingleCurvePanels (brightness + colorTemp)  │    │   │
│  │  │  • 5 types of draggable control points                     │    │   │
│  │  │  • ColorModeBar with HSV interpolation                     │    │   │
│  │  │  • LinkedToggle for curve coupling                         │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ ProfileManager                            ⏳ Not yet built   │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ YearSlider                                ⏳ Not yet built   │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                       ⏳ WebSocket API (not yet connected)                  │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HOME ASSISTANT CORE                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │           ADAPTIVE LIGHTING COMPONENT (upstream fork, unmodified)    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

The panel currently runs **standalone with mock data**. No WebSocket connection to HA exists yet.

---

## Current Data Flow (Mock Data)

```
App.tsx
  │
  ├── DEFAULT_CURVE_SET (from data/defaults.ts)
  │   └── Initial state for useReducer
  │
  ├── useReducer(curveSetReducer, initialState)
  │   └── Returns [curveSet, dispatch]
  │
  ├── useCurveData(curveSet, sunTimes)
  │   ├── resolveCurve(brightness, sunTimes) → resolvedBrightness
  │   ├── resolveCurve(colorTemp, sunTimes) → resolvedColorTemp
  │   ├── generateSamples(resolvedBrightness) → brightnessSamples
  │   ├── generateSamples(resolvedColorTemp) → colorTempSamples
  │   └── currentHour (from system clock)
  │
  └── <CurveEditor
        data={curveData}
        curveSet={curveSet}
        sunTimes={sunTimes}
        onPointDrag={dispatch}
        onPointDragEnd={dispatch}
        onToggleLinked={() => dispatch({ type: 'TOGGLE_LINKED' })}
      />
```

### Drag Interaction Flow

```
User drags a point (e.g., TimePointMarker for P2)
    │
    ▼
Pointer event → svgCoords.ts converts to chart coordinates
    │
    ▼
Component creates CurveSetAction:
  { type: 'UPDATE_TIME_POINT', curveName: 'brightness',
    pointType: 'hold_start', newValue: 22.5, newYValue: 5 }
    │
    ▼
onPointDrag(action) → dispatch(action) → curveSetReducer
    │
    ├── Updates the target TimingPoint
    ├── Enforces Y-value constraint cascade
    │     peak >= p1,p5 >= p2,p4 >= valley
    └── If linked, mirrors timing to colorTemp
    │
    ▼
New curveSet state → useCurveData recomputes samples
    │
    ▼
React re-renders all affected components
```

### Aspirational: WebSocket Flow

*Not yet implemented. When connected to HA:*

```
Panel loads → WebSocket subscribe to entity states
User drags → local dispatch (instant feedback)
              + debounced service call to HA
HA processes → entity state update
Panel receives state change via subscription
Reconcile local state with server state
```

---

## Component Responsibilities

### Frontend — Components (18 files)

| Component | File | Responsibility |
|-----------|------|---------------|
| `App` | `App.tsx` | Root: useReducer, mock sun times, renders CurveEditor |
| `CurveEditor` | `CurveEditor/CurveEditor.tsx` | Composes LinkedToggle + 2 SingleCurvePanels + ColorModeBar |
| `SingleCurvePanel` | `CurveEditor/SingleCurvePanel.tsx` | One chart: SVG container with all sub-components |
| `LinkedToggle` | `CurveEditor/LinkedToggle.tsx` | Toggle button for linked/unlinked mode |
| `ChartCanvas` | `ChartCanvas/ChartCanvas.tsx` | SVG wrapper with margin transform |
| `CurveGradientBackground` | `ChartCanvas/CurveGradientBackground.tsx` | Value-colored vertical strips under the curve |
| `GridLines` | `ChartCanvas/GridLines.tsx` | Horizontal + vertical grid lines |
| `SunEventMarkers` | `ChartCanvas/SunEventMarkers.tsx` | Sunrise/sunset vertical indicator lines |
| `CurvePath` | `ChartCanvas/CurvePath.tsx` | SVG path from samples using D3 line generator |
| `SingleCurveTimeIndicator` | `ChartCanvas/SingleCurveTimeIndicator.tsx` | "NOW" vertical line + dot on curve |
| `TimePointMarkers` | `ChartCanvas/TimePointMarkers.tsx` | Draggable P1/P2/P4/P5 (2D) |
| `SharpnessPointMarkers` | `ChartCanvas/SharpnessPointMarkers.tsx` | Draggable sharpness controls (vertical) |
| `ExtremePointMarkers` | `ChartCanvas/ExtremePointMarkers.tsx` | Draggable peak/valley points (2D) |
| `YAxisColorbar` | `ChartCanvas/YAxisColorbar.tsx` | Vertical color gradient strip on Y-axis |
| `ColorModeBar` | `ChartCanvas/ColorModeBar.tsx` | Horizontal bar showing color mode regions |
| `XAxisLabels` | `XAxisLabels.tsx` | Hour labels along bottom |
| `YAxisLabels` | `YAxisLabels.tsx` | Value labels + draggable ticks (color temp) |

### Frontend — Hooks (3 files)

| Hook | File | Responsibility |
|------|------|---------------|
| `useCurveSetReducer` | `hooks/useCurveSetReducer.ts` | Reducer with constraint cascade + linked mirroring |
| `useCurveData` | `hooks/useCurveData.ts` | Resolves curves + generates samples + tracks current hour |
| `useDrag` | `hooks/useDrag.ts` | Reusable pointer-event drag logic |

### Frontend — Utilities (7 files)

| Utility | File | Responsibility |
|---------|------|---------------|
| `curvemath` | `utils/curvemath.ts` | resolveTime, resolveCurve, getPhase, interpolation functions, calculateValueAtHour |
| `pathgen` | `utils/pathgen.ts` | Generates CurveSample[] arrays from ResolvedCurve |
| `colormap` | `utils/colormap.ts` | kelvinToRgb, brightnessToColor, kelvinToRgbTuple |
| `colorInterpolation` | `utils/colorInterpolation.ts` | HSV conversion, lerpColorHsv for night-mode blending |
| `svgCoords` | `utils/svgCoords.ts` | Pointer event → SVG coordinate conversion |
| `constraints` | `utils/constraints.ts` | Drag constraint helpers |
| `timeformat` | `utils/timeformat.ts` | Hour formatting utilities |

### Frontend — Data (3 files)

| File | Responsibility |
|------|---------------|
| `data/defaults.ts` | DEFAULT_CURVE_SET, MONTVALE_COORDS |
| `data/mockSunTimes.ts` | Mock sunrise/sunset for standalone dev |
| `data/dataProvider.ts` | Data provider abstraction |

### Frontend — Types (1 file)

| File | Responsibility |
|------|---------------|
| `types/curves.ts` | All TypeScript interfaces (TimingPoint, CurveDefinition, CurveSet, CurveSetAction, etc.) |

### Backend (Python — Upstream Fork, Unmodified)

| Module | Responsibility |
|--------|---------------|
| `__init__.py` | Integration setup |
| `switch.py` | Main entity (`AdaptiveSwitch`), orchestrates everything |
| `color_and_brightness.py` | Core calculations (`SunEvents`, `SunLightSettings` — frozen dataclasses) |
| `adaptation_utils.py` | Light adaptation helpers |
| `hass_utils.py` | HA utility functions |
| `helpers.py` | General helpers (clamp, color_difference, etc.) |
| `const.py` | All constants and defaults |
| `config_flow.py` | Config flow for HA UI setup |
| `services.yaml` | Service definitions |

*Planned but not yet created: `enhanced_timing.py`, `profiles.py`*

---

## State Management

### Current Pattern (Panel)

```typescript
// App.tsx — single useReducer, no Context
const [curveSet, dispatch] = useReducer(curveSetReducer, DEFAULT_CURVE_SET);
```

All state lives in `App.tsx` and is passed down as props. There is no React Context, no global store, and no WebSocket connection.

The reducer (`curveSetReducer`) handles 7 action types and enforces:
- Y-value constraint cascade (peak >= p1,p5 >= p2,p4 >= valley)
- Linked mirroring (brightness timing → colorTemp timing, preserving yValues)
- Color temp range clamping (all yValues stay within min/maxValue)

### Aspirational: HA-Connected State

*Not yet implemented.*

Would add:
- WebSocket subscription to entity states
- Optimistic local updates during drag
- Debounced service calls on drag end
- State reconciliation between local and server

---

## Security Considerations

1. **Authentication**: Panel will require HA login (handled by HA)
2. **Authorization**: Uses HA's permission system
3. **Input Validation**: All service inputs will be validated
4. **No External Calls**: Panel only talks to local HA instance

---

## Performance

| Metric | Target | Current Status |
|--------|--------|----------------|
| Curve render | < 16ms (60fps) | Achieved via memoized D3 scales + React reconciliation |
| Drag responsiveness | < 50ms latency | Achieved via pointer events + immediate dispatch |
| Panel initial load | < 500ms | Achieved (standalone, no network) |
| Service call + UI update | < 500ms | N/A (no WebSocket yet) |
