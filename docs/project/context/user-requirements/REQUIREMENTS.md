# User Requirements Document

> **Source**: Conversation with Kaleb, February 2025
> **Last Updated**: 2025-02-03

---

## 1. Project Goals

### Primary Goal
Create an enhanced adaptive-lighting fork with a visual dashboard for Home Assistant that allows precise control over lighting curves throughout the day.

### Secondary Goals
- Eliminate the need to manually calculate timing offsets
- Support different hardware profiles (bulbs vs strips)
- Enable automated schedule switching based on bed presence
- Preview how settings will behave throughout the year

---

## 2. Deployment Requirements

| Requirement | Detail |
|-------------|--------|
| Installation method | Fork of adaptive-lighting installed as HACS custom component |
| UI delivery | Custom HA panel (not Lovelace card) using React |
| Data persistence | HA config entries |
| Communication | HA WebSocket API for bidirectional sync |

---

## 3. Timing Model Requirements

### 3.1 Hybrid Timing

The user wants a **hybrid** model combining:
- **Relative times**: Anchored to sunset/sunrise (adapts seasonally)
- **Absolute times**: Fixed clock times (consistent year-round)

**Specific mapping:**
| Point | Type | Example |
|-------|------|---------|
| Transition start (evening) | Relative to sunset | `sunset - 30min` |
| Hold start | Absolute | `23:00` |
| Hold end | Absolute | `05:30` |
| Transition end (morning) | Relative to sunrise | `sunrise + 30min` |

### 3.2 Curve Shape

- **NOT bezier curves** - too complex
- **Single midpoint sharpness control** - like Google Slides "curved connector"
- Drag midpoint up/down to control how sharp the transition is
- Smooth interpolation at edges

### 3.3 All Points Draggable

The user explicitly requested:
> "the times should be draggable points as well"

This means 5 horizontal draggable points + 2 vertical draggable sharpness controls (when curves linked).

---

## 4. Brightness & Color Temperature

### 4.1 Coupling

- **Default**: Brightness and color temp curves are **linked** (same shape, different Y values)
- **Optional**: User can **unlink** to edit independently
- When linked: 6 total drag points (5 time + 1 sharpness)
- When unlinked: 10 total drag points (5 time + 1 sharpness) × 2

### 4.2 Value Ranges

| Property | Min | Max | Unit |
|----------|-----|-----|------|
| Brightness | 1 | 100 | % |
| Color Temperature | 1000 | 10000 | Kelvin |

**Note**: Min brightness varies by hardware (see Profiles section).

---

## 5. Profile System Requirements

### 5.1 Composable Layers

The user explicitly requested avoiding "combinatorial explosion":
> "I wonder if we could make profiles modular in some sense"

**Layer types:**
1. **Base layer**: Default settings for everything
2. **Hardware layer**: Overrides for specific light types (bulbs, strips)
3. **Schedule layer**: Overrides for time-of-day modes (late-night, early-morning)

### 5.2 Merge Behavior

- Later layers override earlier layers
- Unset values inherit from previous layer
- UI shows the **effective merged result**

### 5.3 Hardware Profiles

| Profile | Use Case | Key Overrides |
|---------|----------|---------------|
| `bulbs` | Standard smart bulbs | Default min brightness |
| `strips` | LED strip lights (different manufacturers) | Higher min brightness |

### 5.4 Schedule Profiles

| Profile | Trigger | Key Overrides |
|---------|---------|---------------|
| `late-night` | Default after sunset | Extended hold period, lower brightness |
| `early-morning` | 6 hours after bed time | Gradual wake-up ramp |

### 5.5 Profile UI

- Tabs for switching between profiles
- When switching: **briefly highlight what settings changed**
- Show both individual layer values and effective merged result

---

## 6. Automation Integration

### 6.1 Late-Night Mode

- **Active**: By default after sunset
- **Purpose**: Keep lights dim until user goes to bed
- **Behavior**: Extended hold at minimum brightness/color temp

### 6.2 Early-Morning Mode

- **Trigger**: 6 hours after (bed_presence AND all_lights_off)
- **Purpose**: Gradual wake-up lighting
- **Behavior**: Normal transition curve before sunrise

### 6.3 Bed Time Definition

> "Going to bed is defined as bed presence + turning off all the lights"

**Implementation**:
- Binary sensor: bed presence (Apollo Automation sensor)
- Condition: All lights in bedroom are off
- Delay: 6 hours after trigger before switching to early-morning mode

**Rationale for 6-hour delay**:
> "in case I wake up in the middle of the night, the lights won't blind me"

---

## 7. Year Preview Requirements

### 7.1 Seasonal Slider

- **Continuous** slider (any day of year, not just solstices)
- Shows how sunrise/sunset times shift
- Updates the curve visualization in real-time
- Default position: today's date

### 7.2 Purpose

Allows user to verify their settings work well in:
- Winter (early sunset ~4:30 PM, late sunrise ~7:00 AM)
- Summer (late sunset ~8:30 PM, early sunrise ~5:30 AM)
- Transition seasons

---

## 8. Real-Time Sync Requirements

### 8.1 Read State

- Panel reads current adaptive-lighting configuration on load
- Panel subscribes to state changes
- External changes (automations, manual) reflect in UI immediately

### 8.2 Write State

- Dragging points calls `adaptive_lighting.change_switch_settings`
- Changes apply to actual lights in real-time
- No "save" button needed - all changes are live

---

## 9. User Context

### 9.1 Technical Background

- PhD student in computational biology
- Experienced with Python, PyTorch, statistical modeling
- Uses Home Assistant with ESPHome
- Comfortable with YAML, automations, custom components

### 9.2 Location

- Montvale, New Jersey, USA
- Latitude: 40.9176
- Longitude: -74.0425

### 9.3 Hardware

- Apollo Automation smart home sensors (bed presence)
- Mix of smart bulbs and LED strips
- Different manufacturers = different min brightness requirements

---

## 10. Non-Requirements (Explicitly Out of Scope)

| Item | Reason |
|------|--------|
| Bezier curve editor | Too complex, user rejected |
| Lovelace card | User wants full panel for complex UI |
| MQTT integration | Not needed, WebSocket sufficient |
| Multiple zones in single view | Profiles handle this differently |
| Full color/RGB support | Focus on brightness + color temp only |

---

## 11. Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Curve type | Midpoint sharpness, not bezier |
| Storage | HA config entries |
| Deployment | Custom panel with React |
| Profile merge order | Later layers override |
| Brightness/color link | Coupled default, optional unlink |
| Year slider granularity | Continuous |
