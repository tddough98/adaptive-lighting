# Timing Model Specification

> **Version**: 1.0
> **Status**: Final

---

## Overview

The enhanced timing model replaces adaptive-lighting's simple `brightness_mode` with a fully configurable curve system that supports:

1. **Hybrid anchor points** (relative to sun events OR absolute clock times)
2. **Adjustable transition sharpness** (not full bezier, simpler control)
3. **Independent or linked brightness/color temp curves**

---

## Visual Representation

```
Value (brightness % or color temp K)
    │
max │━━━━━━━━━━━━━━╲                              ╱━━━━━━━━━━━━━━
    │               ╲                            ╱
    │                ● ← sharpness control      ●
    │                 ╲                        ╱
min │__________________╲______________________╱__________________
    │
    └────────────────────────────────────────────────────────────── Time
         P1            P2        P3        P4            P5
         │             │         │         │             │
    sunset-Xmin    hold_start  [mid]   hold_end    sunrise+Xmin
     (relative)     (fixed)            (fixed)      (relative)

    P1: transition_start (relative to sunset, user drags horizontally)
    P2: hold_start (fixed time, user drags horizontally)
    P3: midpoint (implicit, between P2 and P4)
    P4: hold_end (fixed time, user drags horizontally)
    P5: transition_end (relative to sunrise, user drags horizontally)
    
    ●: sharpness control (user drags vertically)
```

---

## Data Structures

### TimingPoint

Represents a single point on the time axis.

```typescript
interface TimingPoint {
  id: string;                           // Unique identifier
  type: TimingPointType;                // Which point this is
  value: number;                        // Time value (see below)
  isRelative: boolean;                  // Relative to sun event?
  anchor?: 'sunset' | 'sunrise';        // If relative, which event
}

type TimingPointType = 
  | 'transition_start'   // P1: When to start dimming (evening)
  | 'hold_start'         // P2: When minimum begins
  | 'hold_end'           // P3: When minimum ends  
  | 'transition_end';    // P4: When to finish brightening (morning)
```

**Value interpretation:**

| isRelative | anchor | value meaning |
|------------|--------|---------------|
| `true` | `'sunset'` | Minutes offset from sunset (negative = before) |
| `true` | `'sunrise'` | Minutes offset from sunrise (negative = before) |
| `false` | - | Absolute hour (0-24, e.g., 23.5 = 11:30 PM) |

### CurveDefinition

Complete definition of one curve (brightness OR color temp).

```typescript
interface CurveDefinition {
  // Time points (all 4 required)
  transitionStart: TimingPoint;   // P1
  holdStart: TimingPoint;         // P2
  holdEnd: TimingPoint;           // P4
  transitionEnd: TimingPoint;     // P5
  
  // Sharpness controls (0.0 = linear, 1.0 = very sharp)
  eveningSharpness: number;       // For P1 → P2 transition
  morningSharpness: number;       // For P4 → P5 transition
  
  // Value range
  minValue: number;               // Value during hold period
  maxValue: number;               // Value during day
}
```

### CurveSet

A complete set of curves (brightness + color temp).

```typescript
interface CurveSet {
  brightness: CurveDefinition;
  colorTemp: CurveDefinition;
  linked: boolean;                // If true, colorTemp mirrors brightness timing
}
```

When `linked === true`:
- `colorTemp.transitionStart` === `brightness.transitionStart`
- `colorTemp.holdStart` === `brightness.holdStart`
- `colorTemp.holdEnd` === `brightness.holdEnd`
- `colorTemp.transitionEnd` === `brightness.transitionEnd`
- `colorTemp.eveningSharpness` === `brightness.eveningSharpness`
- `colorTemp.morningSharpness` === `brightness.morningSharpness`
- Only `minValue` and `maxValue` differ

---

## Default Values

```typescript
const DEFAULT_CURVE_SET: CurveSet = {
  brightness: {
    transitionStart: {
      id: 'b-ts',
      type: 'transition_start',
      value: -30,              // 30 minutes before sunset
      isRelative: true,
      anchor: 'sunset'
    },
    holdStart: {
      id: 'b-hs',
      type: 'hold_start',
      value: 23.0,             // 11:00 PM
      isRelative: false
    },
    holdEnd: {
      id: 'b-he',
      type: 'hold_end',
      value: 5.5,              // 5:30 AM
      isRelative: false
    },
    transitionEnd: {
      id: 'b-te',
      type: 'transition_end',
      value: 30,               // 30 minutes after sunrise
      isRelative: true,
      anchor: 'sunrise'
    },
    eveningSharpness: 0.5,
    morningSharpness: 0.5,
    minValue: 1,               // 1% brightness
    maxValue: 100              // 100% brightness
  },
  colorTemp: {
    // ... same timing points when linked ...
    minValue: 2000,            // Warm (Kelvin)
    maxValue: 5500             // Cool (Kelvin)
  },
  linked: true
};
```

---

## Calculation Algorithm

### Step 1: Resolve Absolute Times

Given a date and location (lat/long), resolve all timing points to absolute hours.

```python
def resolve_time(point: TimingPoint, sunset_hour: float, sunrise_hour: float) -> float:
    """Convert a TimingPoint to absolute hour (0-24)."""
    if not point.is_relative:
        return point.value
    
    if point.anchor == 'sunset':
        return sunset_hour + (point.value / 60)  # value is in minutes
    else:  # sunrise
        return sunrise_hour + (point.value / 60)
```

### Step 2: Determine Current Phase

Given the current time, determine which phase we're in:

```python
def get_phase(hour: float, p1: float, p2: float, p4: float, p5: float) -> str:
    """Determine current phase based on resolved times."""
    # Handle overnight wrap-around
    if p2 > p4:  # Overnight hold (e.g., 23:00 to 05:30)
        if hour >= p2 or hour <= p4:
            return 'hold'
        elif hour > p4 and hour < p5:
            return 'morning_transition'
        elif hour >= p5 or hour < p1:
            return 'day'
        else:  # hour >= p1 and hour < p2
            return 'evening_transition'
    else:
        # Same-day hold (unusual but supported)
        if p2 <= hour <= p4:
            return 'hold'
        elif p4 < hour < p5:
            return 'morning_transition'
        elif hour >= p5 or hour < p1:
            return 'day'
        else:
            return 'evening_transition'
```

### Step 3: Calculate Value with Sharpness

The sharpness parameter controls the curve shape. We use a modified sigmoid function:

```python
import math

def interpolate_with_sharpness(
    progress: float,      # 0.0 to 1.0 through the transition
    sharpness: float,     # 0.0 (linear) to 1.0 (sharp)
    start_value: float,
    end_value: float
) -> float:
    """
    Interpolate between start and end values with adjustable sharpness.
    
    sharpness = 0.0: Linear interpolation
    sharpness = 0.5: Moderate S-curve (like Google Slides default)
    sharpness = 1.0: Very sharp transition (almost step function)
    """
    if sharpness <= 0:
        # Linear
        t = progress
    else:
        # Use tanh-based S-curve, scaled by sharpness
        # Higher sharpness = steeper curve
        k = 2 + (sharpness * 8)  # k ranges from 2 to 10
        t = (math.tanh((progress - 0.5) * k) + 1) / 2
    
    return start_value + (end_value - start_value) * t
```

### Step 4: Full Calculation

```python
def calculate_value(
    current_hour: float,
    curve: CurveDefinition,
    sunset_hour: float,
    sunrise_hour: float
) -> float:
    """Calculate brightness or color temp for current time."""
    
    # Resolve all times
    p1 = resolve_time(curve.transition_start, sunset_hour, sunrise_hour)
    p2 = resolve_time(curve.hold_start, sunset_hour, sunrise_hour)
    p4 = resolve_time(curve.hold_end, sunset_hour, sunrise_hour)
    p5 = resolve_time(curve.transition_end, sunset_hour, sunrise_hour)
    
    phase = get_phase(current_hour, p1, p2, p4, p5)
    
    if phase == 'day':
        return curve.max_value
    
    elif phase == 'hold':
        return curve.min_value
    
    elif phase == 'evening_transition':
        # Progress through evening transition (p1 to p2)
        duration = (p2 - p1) if p2 > p1 else (p2 + 24 - p1)
        elapsed = (current_hour - p1) if current_hour >= p1 else (current_hour + 24 - p1)
        progress = elapsed / duration
        
        return interpolate_with_sharpness(
            progress,
            curve.evening_sharpness,
            curve.max_value,   # Start bright
            curve.min_value    # End dim
        )
    
    elif phase == 'morning_transition':
        # Progress through morning transition (p4 to p5)
        duration = (p5 - p4) if p5 > p4 else (p5 + 24 - p4)
        elapsed = (current_hour - p4) if current_hour >= p4 else (current_hour + 24 - p4)
        progress = elapsed / duration
        
        return interpolate_with_sharpness(
            progress,
            curve.morning_sharpness,
            curve.min_value,   # Start dim
            curve.max_value    # End bright
        )
```

---

## Serialization Format (for HA Config)

```yaml
# Stored in HA config entry
adaptive_lighting_enhanced:
  curves:
    brightness:
      transition_start:
        value: -30
        is_relative: true
        anchor: sunset
      hold_start:
        value: 23.0
        is_relative: false
      hold_end:
        value: 5.5
        is_relative: false
      transition_end:
        value: 30
        is_relative: true
        anchor: sunrise
      evening_sharpness: 0.5
      morning_sharpness: 0.5
      min_value: 1
      max_value: 100
    color_temp:
      # ... same structure ...
      min_value: 2000
      max_value: 5500
    linked: true
```

---

## UI Dragging Constraints

### Time Points (Horizontal Drag)

| Point | Constraints |
|-------|-------------|
| P1 (transition_start) | Must be before P2; if relative, value in [-180, 0] minutes |
| P2 (hold_start) | Must be after P1, before midnight typically |
| P4 (hold_end) | Must be after midnight typically, before P5 |
| P5 (transition_end) | Must be after P4; if relative, value in [0, 180] minutes |

### Sharpness Points (Vertical Drag)

| Control | Constraints |
|---------|-------------|
| Evening sharpness | 0.0 to 1.0 |
| Morning sharpness | 0.0 to 1.0 |

The vertical position maps to sharpness:
- Top of transition area = 0.0 (linear, gentle)
- Bottom of transition area = 1.0 (sharp, abrupt)

---

## Edge Cases

### 1. Midnight Crossover

The hold period typically crosses midnight (e.g., 23:00 to 05:30). The algorithm handles this by checking if `hold_start > hold_end` and adjusting comparisons accordingly.

### 2. Extreme Latitudes

Near polar regions, sunrise/sunset can be missing or extreme. Fallback behavior:
- If no sunset: Use 20:00 as default
- If no sunrise: Use 06:00 as default

### 3. DST Transitions

Relative times automatically adjust since they depend on calculated sunrise/sunset. Absolute times remain fixed, which is the desired behavior (bedtime doesn't change with DST).
