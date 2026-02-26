# Curve Editor UI Specification

> **Version**: 1.0
> **Status**: Final
> **Rendering**: D3.js (for SVG curve rendering and drag interactions)

---

## Overview

The curve editor is the centerpiece of the panel UI. It displays brightness and color temperature curves over a 24-hour period with draggable control points. Curves are rendered using D3.js for SVG path generation, scales, and drag behavior.

---

## Visual Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌─ Y-Axis (Brightness) ─┐                    ┌─ Y-Axis (Color Temp) ─┐     │
│ │ 100% ─────────────────│────────────────────│───────────────── 6500K │     │
│ │                       │                    │                        │     │
│ │  75% ─────────────────│─╲                ╱─│───────────────── 5000K │     │
│ │                       │  ╲              ╱  │                        │     │
│ │  50% ─────────────────│───●────────────●───│───────────────── 3500K │     │
│ │                       │    ╲          ╱    │                        │     │
│ │  25% ─────────────────│─────╲________╱─────│───────────────── 2500K │     │
│ │                       │                    │                        │     │
│ │   1% ─────────────────│────────────────────│───────────────── 2000K │     │
│ └───────────────────────┴────────────────────┴────────────────────────┘     │
│                                                                             │
│   ┌──●──────────────●────────────────●──────────────●──────────────●──┐    │
│   │  P1             P2              MID             P4              P5 │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│   │                                                                    │    │
│   12:00          sunset          00:00          sunrise           12:00    │
│   ├──────────────┼───────────────┼───────────────┼──────────────────┤     │
│                  ▲               ▲               ▲                          │
│              ~17:30          ~23:00          ~06:00                         │
│            (seasonal)       (fixed)         (fixed)                        │
│                                                                             │
│   ━━ Brightness    ─ ─ Color Temp    ● Draggable Point    NOW ▼            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Structure

```typescript
// Main component hierarchy
<CurveEditor>
  <ChartCanvas>
    <GridLines />
    <SunEventMarkers />       // Sunrise/sunset vertical lines
    <CurvePath type="brightness" />
    <CurvePath type="colorTemp" />
    <CurrentTimeIndicator />  // "NOW" marker
    <DraggableTimePoints />   // P1, P2, P4, P5 (horizontal drag)
    <DraggableSharpnessPoints /> // Midpoint controls (vertical drag)
  </ChartCanvas>
  <XAxisLabels />             // Time labels
  <YAxisLabels side="left" /> // Brightness %
  <YAxisLabels side="right" />// Color temp K
  <Legend />
</CurveEditor>
```

---

## Draggable Points

### Time Points (Horizontal Drag)

| Point | ID | Initial Position | Drag Constraints |
|-------|-----|------------------|------------------|
| P1 | `point-transition-start` | sunset - 30min | Min: sunset - 180min, Max: P2 - 15min |
| P2 | `point-hold-start` | 23:00 | Min: P1 + 15min, Max: 23:59 |
| P4 | `point-hold-end` | 05:30 | Min: 00:00, Max: P5 - 15min |
| P5 | `point-transition-end` | sunrise + 30min | Min: P4 + 15min, Max: sunrise + 180min |

**Visual Style:**
```css
.time-point {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #4ade80;
  cursor: ew-resize;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.time-point:hover {
  transform: scale(1.2);
  border-color: #22c55e;
}

.time-point.dragging {
  border-color: #16a34a;
  box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.3);
}

.time-point.relative {
  border-style: dashed;  /* Visual indicator that it moves with sun */
}
```

### Sharpness Points (Vertical Drag)

| Point | ID | Position | Drag Constraints |
|-------|-----|----------|------------------|
| Evening | `sharpness-evening` | Midpoint of P1↔P2 segment | Y: 0% to 100% of transition height |
| Morning | `sharpness-morning` | Midpoint of P4↔P5 segment | Y: 0% to 100% of transition height |

**Visual Style:**
```css
.sharpness-point {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #f97316;
  border: 2px solid #fff;
  cursor: ns-resize;
}

.sharpness-point:hover {
  transform: scale(1.3);
}
```

**Y-Position Mapping:**
- Top of curve area (at max value line) = sharpness 0.0 (linear, gentle)
- Bottom of curve area (at min value line) = sharpness 1.0 (sharp)

---

## Interaction States

### Idle State
- All points visible at normal size
- Curves drawn with appropriate colors
- Current time indicator visible

### Hover State
- Hovered point scales up 20%
- Tooltip shows current value
- Connected curve segment highlights

### Dragging State
- Dragged point has glow effect
- Curve updates in real-time as point moves
- Tooltip shows live value
- Other points remain interactive (can start new drag)

### Linked Mode
- Single sharpness point (instead of two)
- Time points shared between curves
- Color temp curve mirrors brightness curve shape

### Unlinked Mode
- Two separate sharpness points (one per curve)
- Curves can have different shapes
- Time points still shared (only sharpness differs)

---

## Event Handling

```typescript
interface CurveEditorEvents {
  // Emitted during drag (for live preview)
  onPointDrag: (point: PointUpdate) => void;
  
  // Emitted when drag ends (for persistence)
  onPointDragEnd: (point: PointUpdate) => void;
  
  // Emitted when linked toggle changes
  onLinkedChange: (linked: boolean) => void;
}

interface PointUpdate {
  pointId: string;
  type: 'time' | 'sharpness';
  value: number;  // Hours for time, 0-1 for sharpness
  isRelative?: boolean;
  anchor?: 'sunset' | 'sunrise';
}
```

### Drag Implementation

```typescript
function handleTimePointDrag(
  pointId: string,
  clientX: number,
  chartBounds: DOMRect,
  constraints: DragConstraints
) {
  // Convert pixel position to hour
  const relativeX = (clientX - chartBounds.left) / chartBounds.width;
  let hour = relativeX * 24;
  
  // Apply constraints
  hour = Math.max(constraints.min, Math.min(constraints.max, hour));
  
  // Snap to 5-minute increments
  hour = Math.round(hour * 12) / 12;
  
  return hour;
}

function handleSharpnessPointDrag(
  pointId: string,
  clientY: number,
  chartBounds: DOMRect,
  curveRange: { top: number; bottom: number }
) {
  // Convert pixel position to sharpness (inverted: top = 0, bottom = 1)
  const relativeY = (clientY - chartBounds.top - curveRange.top) / 
                    (curveRange.bottom - curveRange.top);
  
  // Clamp to valid range
  const sharpness = Math.max(0, Math.min(1, relativeY));
  
  // Snap to 0.05 increments
  return Math.round(sharpness * 20) / 20;
}
```

---

## Curve Rendering

### Path Generation

```typescript
function generateCurvePath(
  curve: ResolvedCurve,
  chartBounds: ChartBounds,
  samples: number = 200
): string {
  const points: [number, number][] = [];
  
  for (let i = 0; i <= samples; i++) {
    const hour = (i / samples) * 24;
    const value = calculateValueAtHour(hour, curve);
    
    const x = (hour / 24) * chartBounds.width;
    const y = chartBounds.height - 
              ((value - curve.minValue) / (curve.maxValue - curve.minValue)) * 
              chartBounds.height;
    
    points.push([x, y]);
  }
  
  // Generate smooth SVG path
  return `M ${points.map(p => p.join(',')).join(' L ')}`;
}
```

### Curve Styles

```css
.curve-brightness {
  stroke: #4ade80;
  stroke-width: 2.5;
  fill: none;
}

.curve-brightness-fill {
  fill: url(#gradient-brightness);
  opacity: 0.2;
}

.curve-colortemp {
  stroke: #f97316;
  stroke-width: 2;
  stroke-dasharray: 8, 4;
  fill: none;
}
```

---

## Special Markers

### Current Time Indicator

```typescript
<line
  x1={currentTimeX}
  y1={0}
  x2={currentTimeX}
  y2={chartHeight}
  stroke="#fff"
  strokeWidth={2}
/>
<text
  x={currentTimeX}
  y={-8}
  textAnchor="middle"
  fill="#fff"
  fontSize={10}
>
  NOW
</text>
<circle
  cx={currentTimeX}
  cy={brightnessValueY}
  r={6}
  fill="#4ade80"
  stroke="#fff"
  strokeWidth={2}
/>
```

### Sun Event Markers

```typescript
// Sunset marker
<line
  x1={sunsetX}
  y1={0}
  x2={sunsetX}
  y2={chartHeight}
  stroke="#ffa500"
  strokeWidth={1}
  strokeDasharray="4, 4"
/>
<text x={sunsetX} y={-8} fill="#ffa500" fontSize={10}>🌅</text>

// Sunrise marker
<line
  x1={sunriseX}
  y1={0}
  x2={sunriseX}
  y2={chartHeight}
  stroke="#fbbf24"
  strokeWidth={1}
  strokeDasharray="4, 4"
/>
<text x={sunriseX} y={-8} fill="#fbbf24" fontSize={10}>🌄</text>
```

---

## Responsive Behavior

| Viewport Width | Behavior |
|----------------|----------|
| < 600px | Stack Y-axes below chart, reduce point size |
| 600-900px | Standard layout |
| > 900px | Increase chart height, larger touch targets |

---

## Accessibility

- All draggable points are focusable (`tabIndex={0}`)
- Arrow keys adjust values (left/right for time, up/down for sharpness)
- Screen reader labels describe current values
- High contrast mode increases line widths and point sizes

```typescript
<circle
  role="slider"
  aria-label={`Hold start time: ${formatTime(holdStart)}`}
  aria-valuemin={minConstraint}
  aria-valuemax={maxConstraint}
  aria-valuenow={holdStart}
  tabIndex={0}
  onKeyDown={handleKeyboardAdjust}
/>
```

---

## Performance Considerations

1. **Throttle drag events** to 60fps max
2. **Use requestAnimationFrame** for curve re-rendering
3. **Memoize path calculations** when only sharpness changes (time points same)
4. **Debounce HA service calls** to 300ms after drag ends
