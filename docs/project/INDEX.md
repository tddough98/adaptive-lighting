# Adaptive Lighting Enhanced - Knowledge Base Index

> **Start here**: `CLAUDE.md` (repo root) or `MASTER_PLAN.md`
> **For Claude Code**: Read files in the order listed in "Recommended Reading Order"

---

## Directory Structure

```
docs/project/
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
│   │   ├── TIMING_MODEL.md           ★★★ Core data structures (v2.0 — matches implementation)
│   │   └── PROFILE_SCHEMA.md         ★★ Profile layer system (aspirational)
│   └── ui-components/
│       ├── CURVE_EDITOR.md           ★★ Main interactive chart (v2.0 — matches implementation)
│       └── YEAR_SLIDER.md            ★ Seasonal preview slider (aspirational)
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

1. `CLAUDE.md` (repo root) — Quick orientation, key file paths, architecture decisions
2. `MASTER_PLAN.md` — Overview, architecture diagram, work breakdown with status
3. `context/user-requirements/REQUIREMENTS.md` — Full requirements
4. `docs/architecture/SYSTEM_OVERVIEW.md` — How everything connects

### For Building the React Panel

1. `specs/data-models/TIMING_MODEL.md` — 6-segment curve model, interpolation algorithms
2. `specs/ui-components/CURVE_EDITOR.md` — Component hierarchy, drag interactions
3. `context/ha-integration/WEBSOCKET_API.md` — HA integration patterns (for future WebSocket work)
4. `docs/guides/WORKFLOW.md` — Dev environment setup

### For Building the Python Component

1. `specs/data-models/TIMING_MODEL.md` — Data structures & algorithms
2. `specs/data-models/PROFILE_SCHEMA.md` — Layer merge logic
3. `context/existing-codebase/ADAPTIVE_LIGHTING_OVERVIEW.md` — Actual codebase structure
4. `context/ha-integration/WEBSOCKET_API.md` — WebSocket commands to add

---

## Quick Reference

### Key Data Structures

| Structure | Source File | Purpose |
|-----------|------------|---------|
| `TimingPoint` | `panel/src/types/curves.ts` | Control point with time + yValue |
| `ExtremePoint` | `panel/src/types/curves.ts` | Peak/valley point (hour + value) |
| `CurveDefinition` | `panel/src/types/curves.ts` | Complete curve (4 timing points + peak + valley + sharpness) |
| `ColorModeConfig` | `panel/src/types/curves.ts` | Daytime/nighttime color mode boundaries + sleep RGB |
| `CurveSet` | `panel/src/types/curves.ts` | Brightness + colorTemp + linked flag + colorMode |
| `ResolvedCurve` | `panel/src/types/curves.ts` | All timing points resolved to absolute hours |
| `CurvePhase` | `panel/src/types/curves.ts` | The 6 phases of the curve cycle |
| `CurveSetAction` | `panel/src/types/curves.ts` | Union of all reducer action types |
| `ProfileLayer` | `specs/data-models/PROFILE_SCHEMA.md` | Layer with overrides (aspirational) |

### Key Functions

| Function | Source File | Purpose |
|----------|------------|---------|
| `resolveTime()` | `panel/src/utils/curvemath.ts` | Convert relative TimingPoint → absolute hour |
| `resolveCurve()` | `panel/src/utils/curvemath.ts` | Resolve all points → ResolvedCurve |
| `getPhase()` | `panel/src/utils/curvemath.ts` | Determine which of 6 phases an hour falls in |
| `interpolateWithSharpness()` | `panel/src/utils/curvemath.ts` | Biased tanh S-curve for transitions |
| `cosineInterpolate()` | `panel/src/utils/curvemath.ts` | Smooth interpolation for peak/valley segments |
| `calculateValueAtHour()` | `panel/src/utils/curvemath.ts` | Full 6-phase value calculation |
| `curveSetReducer()` | `panel/src/hooks/useCurveSetReducer.ts` | State reducer with constraint cascade + linked mirroring |
| `enforceYConstraintCascade()` | `panel/src/hooks/useCurveSetReducer.ts` | Push Y-values up/down to maintain hierarchy |
| `generateSamples()` | `panel/src/utils/pathgen.ts` | Sample curve at regular intervals for rendering |
| `kelvinToRgb()` | `panel/src/utils/colormap.ts` | Kelvin temperature → RGB string |
| `lerpColorHsv()` | `panel/src/utils/colorInterpolation.ts` | HSV-space color interpolation for night mode |

### Key Codebase Classes (Python — Upstream)

| Class | File | Purpose |
|-------|------|---------|
| `SunEvents` | `color_and_brightness.py` | Sun position calculations (frozen dataclass) |
| `SunLightSettings` | `color_and_brightness.py` | Brightness/color temp calculations (frozen dataclass) |
| `AdaptiveSwitch` | `switch.py` | Main switch entity |

---

## Document Status

| Document | Status | Notes |
|----------|--------|-------|
| MASTER_PLAN.md | ✅ Updated | Phase status markers, actual data model |
| INDEX.md | ✅ Updated | Actual types and source files |
| REQUIREMENTS.md | ✅ Original | Requirements from conversation |
| TIMING_MODEL.md | ✅ v2.0 | **Implemented** — matches `panel/src/` |
| PROFILE_SCHEMA.md | 📋 Original | **Aspirational** — not yet implemented |
| CURVE_EDITOR.md | ✅ v2.0 | **Implemented** — matches `panel/src/` |
| YEAR_SLIDER.md | 📋 Original | **Aspirational** — not yet implemented |
| WEBSOCKET_API.md | 📋 Original | **Aspirational** — not yet connected |
| ADAPTIVE_LIGHTING_OVERVIEW.md | ✅ Original | Accurate upstream codebase analysis |
| SYSTEM_OVERVIEW.md | ✅ v2.0 | Updated with actual components and data flow |
| WORKFLOW.md | ✅ Original | Dev environment setup |
| SCHEDULE_SWITCHING.md | 📋 Original | **Aspirational** — not yet implemented |

---

## External Resources

- [Adaptive Lighting GitHub](https://github.com/basnijholt/adaptive-lighting)
- [Home Assistant WebSocket API](https://developers.home-assistant.io/docs/api/websocket/)
- [Home Assistant Custom Panels](https://developers.home-assistant.io/docs/frontend/custom-ui/creating-custom-panels/)
- [D3.js](https://d3js.org/) — Used for scales (`scaleLinear`) and `line` generator only; not for DOM manipulation
- [SunCalc Library](https://github.com/mourner/suncalc)
