# Adaptive Lighting Enhanced - Knowledge Base Index

> **Start here**: `MASTER_PLAN.md`
> **For Claude Code**: Read files in the order listed in "Recommended Reading Order"

---

## Directory Structure

```
adaptive-lighting-project/
├── MASTER_PLAN.md                    ★ START HERE
├── INDEX.md                          ← You are here
│
├── docs/
│   ├── architecture/
│   │   └── SYSTEM_OVERVIEW.md        ★ Architecture diagrams & data flow
│   └── guides/
│       └── WORKFLOW.md               ★ Tools, Claude Code tips, dev workflow
│
├── specs/
│   ├── data-models/
│   │   ├── TIMING_MODEL.md           ★★★ Core data structures
│   │   └── PROFILE_SCHEMA.md         ★★ Profile layer system
│   └── ui-components/
│       ├── CURVE_EDITOR.md           ★★ Main interactive chart
│       └── YEAR_SLIDER.md            ★ Seasonal preview slider
│
├── context/
│   ├── ha-integration/
│   │   └── WEBSOCKET_API.md          ★★ How to talk to Home Assistant
│   ├── existing-codebase/
│   │   └── ADAPTIVE_LIGHTING_OVERVIEW.md  ★★ Actual codebase analysis
│   └── user-requirements/
│       └── REQUIREMENTS.md           ★★★ Full requirements from conversation
│
└── automations/
    └── SCHEDULE_SWITCHING.md         ★ Late-night/early-morning automations
```

**Legend**: ★★★ = Critical, ★★ = Important, ★ = Useful

---

## Recommended Reading Order

### For Understanding the Project

1. `MASTER_PLAN.md` - Overview, architecture diagram, work breakdown
2. `context/user-requirements/REQUIREMENTS.md` - Full requirements
3. `docs/architecture/SYSTEM_OVERVIEW.md` - How everything connects

### For Building the React Panel

1. `specs/ui-components/CURVE_EDITOR.md` - Main interactive component
2. `specs/ui-components/YEAR_SLIDER.md` - Seasonal preview
3. `context/ha-integration/WEBSOCKET_API.md` - HA integration patterns
4. `docs/guides/WORKFLOW.md` - Dev environment setup

### For Building the Python Component

1. `specs/data-models/TIMING_MODEL.md` - Data structures & algorithms
2. `specs/data-models/PROFILE_SCHEMA.md` - Layer merge logic
3. `context/existing-codebase/ADAPTIVE_LIGHTING_OVERVIEW.md` - Actual codebase structure
4. `context/ha-integration/WEBSOCKET_API.md` - WebSocket commands to add

### For Testing & Deployment

1. `docs/guides/WORKFLOW.md` - Test commands, debugging tips
2. `automations/SCHEDULE_SWITCHING.md` - Test automations

---

## Quick Reference

### Key Data Structures

| Structure | Location | Purpose |
|-----------|----------|---------|
| `TimingPoint` | `specs/data-models/TIMING_MODEL.md` | A single point on the time axis |
| `CurveDefinition` | `specs/data-models/TIMING_MODEL.md` | Complete curve (timing + values) |
| `ProfileLayer` | `specs/data-models/PROFILE_SCHEMA.md` | One layer with overrides |
| `ProfileConfig` | `specs/data-models/PROFILE_SCHEMA.md` | All layers + active selections |

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `resolve_time()` | `TIMING_MODEL.md` | Convert relative → absolute time |
| `interpolate_with_sharpness()` | `TIMING_MODEL.md` | S-curve interpolation |
| `mergeProfiles()` | `PROFILE_SCHEMA.md` | Merge layers to effective config |
| `getSunTimesForDate()` | `YEAR_SLIDER.md` | Calculate sunrise/sunset |

### Key Codebase Classes (actual)

| Class | File | Purpose |
|-------|------|---------|
| `SunEvents` | `color_and_brightness.py` | Sun position calculations (frozen dataclass) |
| `SunLightSettings` | `color_and_brightness.py` | Brightness/color temp calculations (frozen dataclass) |
| `AdaptiveSwitch` | `switch.py` | Main switch entity |

### Key Services

| Service | Purpose |
|---------|---------|
| `adaptive_lighting.change_switch_settings` | Update any setting |
| `adaptive_lighting.set_active_layers` | Switch profiles (NEW) |
| `adaptive_lighting.update_layer` | Edit a layer's overrides (NEW) |

---

## Document Status

| Document | Status | Notes |
|----------|--------|-------|
| MASTER_PLAN.md | ✅ Complete | |
| INDEX.md | ✅ Complete | |
| REQUIREMENTS.md | ✅ Complete | |
| TIMING_MODEL.md | ✅ Complete | Core spec |
| PROFILE_SCHEMA.md | ✅ Complete | |
| CURVE_EDITOR.md | ✅ Complete | |
| YEAR_SLIDER.md | ✅ Complete | |
| WEBSOCKET_API.md | ✅ Complete | |
| ADAPTIVE_LIGHTING_OVERVIEW.md | ✅ Complete | Rewritten with accurate codebase info |
| SYSTEM_OVERVIEW.md | ✅ Complete | |
| WORKFLOW.md | ✅ Complete | |
| SCHEDULE_SWITCHING.md | ✅ Complete | |

---

## External Resources

- [Adaptive Lighting GitHub](https://github.com/basnijholt/adaptive-lighting)
- [Home Assistant WebSocket API](https://developers.home-assistant.io/docs/api/websocket/)
- [Home Assistant Custom Panels](https://developers.home-assistant.io/docs/frontend/custom-ui/creating-custom-panels/)
- [D3.js](https://d3js.org/) — Chart library for curve editor
- [SunCalc Library](https://github.com/mourner/suncalc)
