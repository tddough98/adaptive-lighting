# Adaptive Lighting Codebase Overview

> **Repository**: https://github.com/basnijholt/adaptive-lighting
> **Version Analyzed**: v1.30.1
> **Purpose**: Understanding what exists before we modify it

---

## Directory Structure

```
adaptive-lighting/
├── custom_components/
│   └── adaptive_lighting/
│       ├── __init__.py              # Integration setup
│       ├── manifest.json            # HACS/HA metadata (version 1.30.1)
│       ├── const.py                 # Constants and defaults
│       ├── switch.py                # Main switch entity (AdaptiveSwitch)
│       ├── config_flow.py           # UI configuration
│       ├── color_and_brightness.py  # Core calculation logic (SunEvents + SunLightSettings)
│       ├── adaptation_utils.py      # Light adaptation helpers
│       ├── hass_utils.py            # HA utility functions
│       ├── helpers.py               # General helpers (clamp, color_difference, etc.)
│       ├── services.yaml            # Service definitions
│       ├── strings.json             # English strings
│       └── translations/            # i18n
│           └── en.json
├── webapp/                          # Existing simulator (Shiny, NOT Streamlit)
│   ├── app.py                       # Shiny app using matplotlib
│   └── ...
├── tests/                           # pytest tests
└── scripts/                         # Dev utilities
```

**Note**: There is NO `sun.py` file. All sun position logic lives in `color_and_brightness.py`.

---

## Key Files to Understand

### 1. `const.py` - Constants and Defaults

**Current relevant constants:**
```python
CONF_BRIGHTNESS_MODE, DEFAULT_BRIGHTNESS_MODE = "brightness_mode", "default"
CONF_BRIGHTNESS_MODE_TIME_DARK, DEFAULT_BRIGHTNESS_MODE_TIME_DARK = (
    "brightness_mode_time_dark",
    900,
)
CONF_BRIGHTNESS_MODE_TIME_LIGHT, DEFAULT_BRIGHTNESS_MODE_TIME_LIGHT = (
    "brightness_mode_time_light",
    3600,
)
```

The brightness mode is documented as supporting `"default"`, `"linear"`, and `"tanh"`.

**What we'll add:**
```python
# New timing model constants
CONF_TRANSITION_START_OFFSET = "transition_start_offset"
CONF_HOLD_START_TIME = "hold_start_time"
CONF_HOLD_END_TIME = "hold_end_time"
CONF_TRANSITION_END_OFFSET = "transition_end_offset"
CONF_EVENING_SHARPNESS = "evening_sharpness"
CONF_MORNING_SHARPNESS = "morning_sharpness"

# Profile system constants
CONF_PROFILES = "profiles"
CONF_ACTIVE_HARDWARE_LAYER = "active_hardware_layer"
CONF_ACTIVE_SCHEDULE_LAYER = "active_schedule_layer"
```

### 2. `color_and_brightness.py` - Core Calculations

This file contains two frozen dataclasses that form the calculation engine:

#### `SunEvents` (frozen dataclass)

Tracks sun position and computes sunrise/sunset/noon/midnight times.

```python
@dataclass(frozen=True)
class SunEvents:
    """Track the state of the sun and associated light settings."""

    name: str
    astral_location: astral.location.Location
    sunrise_time: datetime.time | None
    min_sunrise_time: datetime.time | None
    max_sunrise_time: datetime.time | None
    sunset_time: datetime.time | None
    min_sunset_time: datetime.time | None
    max_sunset_time: datetime.time | None
    sunrise_offset: datetime.timedelta = datetime.timedelta()
    sunset_offset: datetime.timedelta = datetime.timedelta()
    timezone: datetime.tzinfo = UTC

    def sunrise(self, dt: datetime.date) -> datetime.datetime: ...
    def sunset(self, dt: datetime.date) -> datetime.datetime: ...
    def noon_and_midnight(self, dt, sunset=None, sunrise=None) -> tuple: ...
    def sun_events(self, dt: datetime.datetime) -> list[tuple[SunEvent, float]]: ...
    def prev_and_next_events(self, dt) -> list[tuple[SunEvent, float]]: ...
    def sun_position(self, dt: datetime.datetime) -> float:
        """Calculate the position of the sun, between [-1, 1]."""
        ...
    def closest_event(self, dt) -> tuple[Literal[SunEvent.SUNRISE, SunEvent.SUNSET], float]: ...
```

Key: `sun_position()` lives on `SunEvents`, NOT on `SunLightSettings`.

#### `SunLightSettings` (frozen dataclass)

Computes brightness and color temperature based on sun position and configuration.

```python
@dataclass(frozen=True)
class SunLightSettings:
    """Track the state of the sun and associated light settings."""

    name: str
    astral_location: astral.location.Location
    adapt_until_sleep: bool
    max_brightness: int
    max_color_temp: int
    min_brightness: int
    min_color_temp: int
    sleep_brightness: int
    sleep_rgb_or_color_temp: Literal["color_temp", "rgb_color"]
    sleep_color_temp: int
    sleep_rgb_color: tuple[int, int, int]
    sunrise_time: datetime.time | None
    min_sunrise_time: datetime.time | None
    max_sunrise_time: datetime.time | None
    sunset_time: datetime.time | None
    min_sunset_time: datetime.time | None
    max_sunset_time: datetime.time | None
    brightness_mode_time_dark: datetime.timedelta
    brightness_mode_time_light: datetime.timedelta
    brightness_mode: Literal["default", "linear", "tanh"] = "default"
    sunrise_offset: datetime.timedelta = datetime.timedelta()
    sunset_offset: datetime.timedelta = datetime.timedelta()
    timezone: datetime.tzinfo = UTC

    @cached_property
    def sun(self) -> SunEvents:
        """Return the SunEvents object."""
        ...

    def brightness_pct(self, dt: datetime.datetime, is_sleep: bool) -> float | None:
        """Calculate the brightness in %."""
        ...

    def color_temp_kelvin(self, sun_position: float) -> int:
        """Calculate the color temperature in Kelvin."""
        ...

    def brightness_and_color(self, dt, is_sleep) -> dict[str, Any]:
        """Calculate the brightness and color."""
        ...

    def get_settings(self, is_sleep, transition) -> dict: ...
```

**Important**: Both classes are `@dataclass(frozen=True)`, so they're immutable. The `SunLightSettings` creates a `SunEvents` instance via `@cached_property`. Any "enhanced" version must work within this frozen dataclass pattern — either by creating a new frozen dataclass that wraps/extends `SunLightSettings`, or by using `dataclasses.replace()` to produce modified copies.

The file also contains standalone helper functions:
- `scaled_tanh()` — S-curve interpolation used by the `tanh` brightness mode
- `find_a_b()` — Computes coefficients for the scaled tanh function
- `lerp()` — Linear interpolation
- `lerp_color_hsv()` — HSV-space color interpolation
- `clamp()` — Value clamping

### 3. `switch.py` - Main Integration

```python
class AdaptiveSwitch(SwitchEntity, RestoreEntity):
    """Switch to enable/disable Adaptive Lighting."""
    ...
```

**Note**: The class is `AdaptiveSwitch`, not `AdaptiveLightingSwitch`.

Key patterns:
- Creates a `SunLightSettings` instance from config entry data
- Runs `_update_attrs_and_maybe_adapt_lights` periodically
- Exposes computed values as entity attributes
- Handles manual control detection, take-over control, etc.

**What we'll modify:**
- Support an `EnhancedSunLightSettings` alongside the existing `SunLightSettings`
- Add profile layer merging before calculation
- Expose new attributes (timing points, sharpness, profiles)

### 4. `config_flow.py` - UI Configuration

```python
class AdaptiveLightingConfigFlow(config_entries.ConfigFlow):
    """Handle config flow."""
    ...

class AdaptiveLightingOptionsFlow(config_entries.OptionsFlow):
    """Handle options flow."""
    ...
```

**What we'll add:**
- New options for enhanced timing model
- Profile management steps (optional, most editing in panel)

### 5. `services.yaml` - Service Definitions

**Current services:**
- `apply` — Apply adaptive lighting settings
- `set_manual_control` — Mark lights as manually controlled
- `change_switch_settings` — Change settings temporarily

**What we'll add:**
```yaml
set_active_layers:
  name: Set Active Profile Layers
  description: Activate hardware and schedule layers
  fields:
    entity_id: ...
    hardware_layer: ...
    schedule_layer: ...

update_layer:
  name: Update Layer
  description: Update a profile layer's overrides
  fields:
    entity_id: ...
    layer_id: ...
    overrides: ...
```

---

## Data Flow

```
┌──────────────────┐
│   Config Entry   │  ← Persistent storage
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  AdaptiveSwitch  │  ← Main coordinator
│  (switch.py)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐      ┌──────────────────┐
│ SunLightSettings │─────►│    SunEvents     │
│ (color_and_      │      │  (color_and_     │
│  brightness.py)  │      │   brightness.py) │
└────────┬─────────┘      └──────────────────┘
         │
         ▼
┌──────────────────┐
│   Light Calls    │  ← Output to lights
│ (light.turn_on)  │
└──────────────────┘
```

---

## Existing Brightness Modes

### Default Mode
```python
def _brightness_pct_default(self, dt):
    """Brightness follows sun position. Max when sun is above horizon,
    ramps down proportionally when below."""
    sun_position = self.sun.sun_position(dt)
    if sun_position > 0:
        return self.max_brightness
    delta_brightness = self.max_brightness - self.min_brightness
    return (delta_brightness * (1 + sun_position)) + self.min_brightness
```

### Linear Mode
```python
def _brightness_pct_linear(self, dt):
    """Linear ramp around sunrise/sunset using brightness_mode_time_dark
    and brightness_mode_time_light durations."""
    event, ts_event = self.sun.closest_event(dt)
    # Uses lerp() to interpolate between min/max brightness
    # over the configured time windows around sunrise/sunset
```

### Tanh Mode
```python
def _brightness_pct_tanh(self, dt):
    """Smooth S-curve ramp around sunrise/sunset using scaled_tanh()."""
    event, ts_event = self.sun.closest_event(dt)
    # Uses scaled_tanh() for smooth S-curve transitions
    # between min/max brightness around sunrise/sunset
```

**Our "enhanced" mode** will be similar to tanh but with:
- Separate control for evening vs morning sharpness
- Fixed absolute times for hold period (not relative to sun)
- Full draggable control of all parameters via the React panel

---

## Panel Integration Points

The existing codebase has no custom panel. We'll add:

```
custom_components/adaptive_lighting/
├── ...existing files...
├── panel/                    # New directory (to be created)
│   ├── __init__.py
│   └── frontend/             # Built React app
│       ├── main.js
│       └── main.js.map
```

**Registration in `__init__.py`:**
```python
async def async_setup_entry(hass, entry):
    """Set up from config entry."""
    # ... existing setup ...

    # Register custom panel
    hass.http.register_static_path(
        "/adaptive_lighting_panel",
        hass.config.path("custom_components/adaptive_lighting/panel/frontend"),
        cache_headers=False
    )

    hass.components.frontend.async_register_built_in_panel(
        component_name="custom",
        sidebar_title="Adaptive Lighting",
        sidebar_icon="mdi:lightbulb-auto",
        frontend_url_path="adaptive-lighting",
        config={
            "_panel_custom": {
                "name": "adaptive-lighting-panel",
                "js_url": "/adaptive_lighting_panel/main.js",
                "embed_iframe": False,
                "trust_external": False
            }
        }
    )
```

---

## Approach for EnhancedSunLightSettings

Since `SunLightSettings` is a frozen dataclass, we cannot subclass it with `__init__` overrides. Instead, the recommended approach is:

```python
@dataclass(frozen=True)
class EnhancedSunLightSettings(SunLightSettings):
    """Extended settings with enhanced timing model."""

    transition_start_offset: int = 0
    hold_start_time: datetime.time | None = None
    hold_end_time: datetime.time | None = None
    transition_end_offset: int = 0
    evening_sharpness: float = 0.5
    morning_sharpness: float = 0.5

    def get_resolved_times(self, date: datetime.date | None = None) -> dict:
        """Resolve all timing points to absolute datetimes."""
        dt = datetime.datetime.now(UTC) if date is None else ...
        sunset = self.sun.sunset(dt)
        sunrise = self.sun.sunrise(dt)
        return {
            'transition_start': sunset + timedelta(minutes=self.transition_start_offset),
            'hold_start': self.hold_start_time,
            'hold_end': self.hold_end_time,
            'transition_end': sunrise + timedelta(minutes=self.transition_end_offset),
        }

    def _brightness_pct_enhanced(self, dt: datetime.datetime) -> float:
        """Calculate brightness using enhanced timing model."""
        # Implementation per TIMING_MODEL.md spec
        ...
```

This works because frozen dataclasses support inheritance — the child is also frozen, and all fields from both parent and child are immutable.
