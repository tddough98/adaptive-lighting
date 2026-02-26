# System Architecture Overview

> **Version**: 1.0
> **Last Updated**: 2025-02-03

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER'S BROWSER                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     REACT CUSTOM PANEL                               │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ CurveEditor                                                  │    │   │
│  │  │  • SVG chart with draggable points                          │    │   │
│  │  │  • Real-time curve rendering                                │    │   │
│  │  │  • Current time indicator                                   │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ ProfileManager                                               │    │   │
│  │  │  • Layer tabs (Base, Hardware, Schedule)                    │    │   │
│  │  │  • Change highlighting                                      │    │   │
│  │  │  • Effective result preview                                 │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ YearSlider                                                   │    │   │
│  │  │  • Date selection for seasonal preview                      │    │   │
│  │  │  • Sunrise/sunset info display                              │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                            WebSocket API                                    │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HOME ASSISTANT CORE                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                 ADAPTIVE LIGHTING COMPONENT                          │   │
│  │                                                                      │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │   │
│  │  │  Switch Entity   │  │  ProfileManager  │  │ EnhancedTiming   │   │   │
│  │  │  (switch.py)     │  │  (profiles.py)   │  │ (enhanced_       │   │   │
│  │  │                  │  │                  │  │  timing.py)      │   │   │
│  │  │ • Main control   │  │ • Layer storage  │  │ • Calculation    │   │   │
│  │  │ • State attrs    │  │ • Merge logic    │  │ • Interpolation  │   │   │
│  │  │ • Light calls    │  │ • Active layers  │  │ • Sun integration│   │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘   │   │
│  │           │                     │                     │              │   │
│  │           └─────────────────────┴─────────────────────┘              │   │
│  │                                 │                                    │   │
│  │                         Config Entry                                 │   │
│  │                    (persistent storage)                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                              Service Calls                                  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          LIGHT ENTITIES                              │   │
│  │  light.bedroom_main    light.bedroom_lamp    light.living_room      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Initial Load

```
Panel loads
    │
    ▼
Request current state via WebSocket
    │
    ├──► Entity states (switch.adaptive_lighting_*)
    │    └──► Current brightness, color_temp, config
    │
    └──► Profile config via custom command
         └──► Layers, active selections, overrides
    │
    ▼
Render curve editor with current values
```

### 2. User Drags a Point

```
User drags time point P2 (hold_start)
    │
    ▼
Throttled drag handler (60fps max)
    │
    ▼
Local state update (instant visual feedback)
    │
    ▼
Debounced service call (300ms after drag ends)
    │
    ├──► adaptive_lighting.change_switch_settings
    │    └──► hold_start_time: "23:30:00"
    │
    └──► adaptive_lighting/update_profile (if editing layer)
         └──► Updates profile config in HA storage
    │
    ▼
HA processes change
    │
    ▼
Entity state updates
    │
    ▼
Panel receives state change via subscription
    │
    ▼
Confirm local state matches server state
```

### 3. External Change (Automation)

```
Automation fires (e.g., bed presence detected)
    │
    ▼
Calls adaptive_lighting.set_active_layers
    │
    ├──► schedule_layer: "sched-early-morning"
    │
    ▼
ProfileManager recalculates effective settings
    │
    ▼
EnhancedTiming receives new config
    │
    ▼
Entity attributes update
    │
    ▼
Panel receives state change via subscription
    │
    ▼
CurveEditor re-renders with new curve
    │
    ▼
ProfileManager highlights changes
```

---

## Component Responsibilities

### Frontend (React Panel)

| Component | Responsibility |
|-----------|---------------|
| `App.tsx` | Root component, HA connection provider |
| `CurveEditor.tsx` | Interactive SVG chart |
| `DraggablePoint.tsx` | Individual draggable point logic |
| `ProfileManager.tsx` | Layer tabs and management |
| `YearSlider.tsx` | Seasonal date selector |
| `useAdaptiveLighting.ts` | HA state subscription hook |
| `useDrag.ts` | Reusable drag interaction hook |
| `sunCalc.ts` | Sunrise/sunset calculations |

### Backend (Python Component)

| Module | Responsibility |
|--------|---------------|
| `__init__.py` | Integration setup, WebSocket registration |
| `switch.py` | Main entity (`AdaptiveSwitch`), orchestrates everything |
| `color_and_brightness.py` | Core calculations (`SunEvents`, `SunLightSettings` — both frozen dataclasses). To be extended with enhanced mode. |
| `adaptation_utils.py` | Light adaptation helpers |
| `hass_utils.py` | HA utility functions |
| `helpers.py` | General helpers (clamp, color_difference, etc.) |
| `const.py` | All constants and defaults |
| `services.yaml` | Service definitions (to be extended) |
| `enhanced_timing.py` | New timing model calculations (to be created) |
| `profiles.py` | Profile layer storage and merging (to be created) |

---

## State Management

### Frontend State

```typescript
// Global state (via Context)
interface AppState {
  hass: HomeAssistant;           // HA connection
  entities: HassEntities;         // All entity states
  profiles: ProfileConfig;        // Profile configuration
  selectedDate: Date;             // Year slider selection
}

// Local component state
interface CurveEditorState {
  isDragging: boolean;
  draggedPoint: string | null;
  localCurve: CurveSet;          // Optimistic updates during drag
}
```

### Backend State

```python
# In switch.py (current)
class AdaptiveSwitch(SwitchEntity, RestoreEntity):
    _sun_light_settings: SunLightSettings  # Calculation engine (frozen dataclass)
    # Will be extended with:
    # _profile_manager: ProfileManager
    # _active_hardware_layer: str | None
    # _active_schedule_layer: str | None

# In profiles.py (to be created)
class ProfileManager:
    _base_layer: ProfileLayer
    _hardware_layers: list[ProfileLayer]
    _schedule_layers: list[ProfileLayer]

    def get_effective_config(self) -> CurveSet:
        """Merge all active layers and return effective config."""
```

---

## Storage

### Config Entry (Persistent)

Stored in `.storage/core.config_entries`:

```json
{
  "data": {
    "min_brightness": 1,
    "max_brightness": 100,
    "brightness_mode": "enhanced",
    "profiles": {
      "version": 1,
      "base_layer": { ... },
      "hardware_layers": [ ... ],
      "schedule_layers": [ ... ],
      "active_hardware_layer": "hw-strips",
      "active_schedule_layer": "sched-late-night"
    }
  }
}
```

### Entity Attributes (Runtime)

Exposed on `switch.adaptive_lighting_*`:

```yaml
state: "on"
attributes:
  brightness_pct: 45
  color_temp_kelvin: 2800
  # Enhanced timing
  transition_start_resolved: "17:02"
  hold_start: "23:00"
  hold_end: "05:30"
  transition_end_resolved: "07:32"
  evening_sharpness: 0.5
  morning_sharpness: 0.5
  current_phase: "evening_transition"
  # Profiles
  active_hardware_layer: "hw-strips"
  active_schedule_layer: "sched-late-night"
  effective_min_brightness: 15
```

---

## Error Handling

### Frontend

```typescript
// WebSocket errors
function handleConnectionError(error: Error) {
  if (error.code === ERR_CONNECTION_LOST) {
    setConnectionStatus('reconnecting');
    // HA handles reconnection automatically
  } else {
    setError(error.message);
    toast.error(`Connection error: ${error.message}`);
  }
}

// Service call errors
async function safeCallService(domain: string, service: string, data: object) {
  try {
    await hass.callService(domain, service, data);
  } catch (error) {
    // Revert optimistic update
    revertLocalState();
    toast.error(`Failed to update: ${error.message}`);
  }
}
```

### Backend

```python
# In services
async def async_set_active_layers(call: ServiceCall) -> None:
    """Set active profile layers."""
    try:
        hardware = call.data.get(CONF_HARDWARE_LAYER)
        schedule = call.data.get(CONF_SCHEDULE_LAYER)
        
        # Validate layer IDs exist
        if hardware and hardware not in self._get_hardware_layer_ids():
            raise ValueError(f"Unknown hardware layer: {hardware}")
        
        await self._set_active_layers(hardware, schedule)
        
    except Exception as err:
        _LOGGER.error("Failed to set active layers: %s", err)
        raise HomeAssistantError(f"Failed to set layers: {err}") from err
```

---

## Testing Strategy

### Unit Tests (Python)

```python
# test_enhanced_timing.py
def test_brightness_during_hold_period():
    """Brightness should be at minimum during hold period."""
    
def test_overnight_hold_detection():
    """Should detect hold period that crosses midnight."""
    
def test_sharpness_interpolation():
    """Sharpness=0 should be linear, sharpness=1 should be sharp."""

# test_profiles.py
def test_layer_merge_order():
    """Later layers should override earlier layers."""
    
def test_partial_override():
    """Unset values should inherit from base."""
```

### Integration Tests (Python + HA)

```python
# test_integration.py
async def test_full_flow(hass):
    """Test setting layers via service and checking entity state."""
    
async def test_websocket_commands(hass, hass_ws_client):
    """Test custom WebSocket commands."""
```

### Component Tests (React)

```typescript
// CurveEditor.test.tsx
it('should update curve when point is dragged');
it('should call service after drag ends');
it('should show correct current time marker');

// ProfileManager.test.tsx
it('should highlight changed fields when switching layers');
it('should merge layers correctly');
```

---

## Security Considerations

1. **Authentication**: Panel requires HA login (handled by HA)
2. **Authorization**: Uses HA's permission system
3. **Input Validation**: All service inputs validated
4. **No External Calls**: Panel only talks to local HA instance

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Panel initial load | < 500ms |
| Curve render | < 16ms (60fps) |
| Drag responsiveness | < 50ms latency |
| Service call + UI update | < 500ms |
| Year slider scrubbing | Smooth 30fps |
