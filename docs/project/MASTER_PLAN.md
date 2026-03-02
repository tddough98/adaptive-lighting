# Adaptive Lighting Enhanced: Master Plan

> **Project Codename**: `circadian-control`
> **Owner**: Kaleb (PhD student, computational biology background)
> **Status**: Phase 2 complete on `react-dashboard` branch; Phases 1, 3, 4 pending

---

## Vision

A production-grade Home Assistant custom panel + enhanced adaptive-lighting fork that provides:
1. **Visual curve editor** for brightness/color temperature schedules
2. **Composable profile system** for different hardware and schedule layers
3. **Hybrid timing model** mixing relative (sunset/sunrise) and absolute (clock) times
4. **Real-time bidirectional sync** with Home Assistant

---

## Repository Structure

```
adaptive-lighting/
├── CLAUDE.md                             # Project orientation for Claude Code
├── custom_components/adaptive_lighting/  # Python HA integration (upstream fork)
├── panel/                                # React custom panel (react-dashboard branch)
│   └── src/
│       ├── types/curves.ts               # All interfaces
│       ├── components/                   # 18 React components
│       ├── hooks/                        # 3 hooks (reducer, curve data, drag)
│       ├── utils/                        # 7 utility modules
│       ├── data/                         # Defaults + mock data
│       └── App.tsx                       # Root with useReducer
├── docs/project/                         # Planning docs (this directory)
├── tests/                                # Python tests
└── pyproject.toml
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HOME ASSISTANT                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐  ⏳ WebSocket  ┌────────────────────────────┐    │
│  │                      │  (not yet      │                            │    │
│  │  Adaptive Lighting   │   connected)   │    Custom React Panel      │    │
│  │  (Python Component)  │                │    (circadian-control)     │    │
│  │                      │                │                            │    │
│  │  ⏳ Enhanced Timing  │                │  ✅ CurveEditor            │    │
│  │    (not yet built)   │                │    • 2 stacked panels      │    │
│  │                      │                │    • 6-segment curve model │    │
│  │  ⏳ Profile System   │                │    • 5 draggable types     │    │
│  │    (not yet built)   │                │    • ColorModeBar          │    │
│  │                      │                │    • Linked/unlinked mode  │    │
│  └──────────────────────┘                │                            │    │
│                                          │  ⏳ ProfileManager         │    │
│                                          │    (not yet built)         │    │
│                                          │                            │    │
│                                          │  ⏳ YearSlider             │    │
│                                          │    (not yet built)         │    │
│                                          └────────────────────────────┘    │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      ⏳ Automations (not yet built)                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Work Breakdown

### Phase 1: Foundation — Python Backend ⏳ NOT STARTED
| Task | Deliverable | Status |
|------|-------------|--------|
| 1.1 | Fork adaptive-lighting, set up dev environment | ⏳ |
| 1.2 | Implement `EnhancedTimingModel` Python class | ⏳ |
| 1.3 | Add new config schema + services | ⏳ |
| 1.4 | Unit tests for timing calculations | ⏳ |

### Phase 2: Panel — Curve Editor ✅ COMPLETE
| Task | Deliverable | Status |
|------|-------------|--------|
| 2.1 | React panel boilerplate with Vite + mock data | ✅ |
| 2.2 | 6-segment curve model with per-point yValues | ✅ |
| 2.3 | Two stacked SingleCurvePanels with gradient backgrounds | ✅ |
| 2.4 | Draggable TimePointMarkers (2D: time + yValue) | ✅ |
| 2.5 | Draggable SharpnessPointMarkers (vertical) | ✅ |
| 2.6 | Draggable ExtremePointMarkers for peak/valley (2D) | ✅ |
| 2.7 | Y-value constraint cascade in reducer | ✅ |
| 2.8 | LinkedToggle with timing mirroring | ✅ |
| 2.9 | ColorModeBar with HSV interpolation for night colors | ✅ |
| 2.10 | Draggable Y-axis ticks for color temp range | ✅ |
| 2.11 | CurveGradientBackground, YAxisColorbar | ✅ |
| 2.12 | SunEventMarkers, SingleCurveTimeIndicator | ✅ |

### Phase 3: Profile System ⏳ NOT STARTED
| Task | Deliverable | Status |
|------|-------------|--------|
| 3.1 | Profile data model + storage | ⏳ |
| 3.2 | Layer composition logic | ⏳ |
| 3.3 | Profile UI (tabs, layer editor) | ⏳ |
| 3.4 | Change highlighting between profiles | ⏳ |

### Phase 4: Polish & Integration ⏳ PARTIAL
| Task | Deliverable | Status |
|------|-------------|--------|
| 4.1 | Year slider with sunrise/sunset preview | ⏳ |
| 4.2 | Link/unlink brightness + color temp curves | ✅ |
| 4.3 | Example automations | ⏳ |
| 4.4 | Documentation + README | ⏳ |
| 4.5 | HA WebSocket integration | ⏳ |
| 4.6 | Manual testing in real HA instance | ⏳ |

---

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Curve model | 6-segment with peak/valley | Allows independent daytime peak and nighttime valley, more expressive than 4-phase |
| Value model | Per-point yValues + ExtremePoint | Each timing point carries its own Y-value; peak/valley are separate draggable points |
| Chart layout | Two stacked SingleCurvePanels | Avoids confusing dual Y-axis; each curve gets its own space and gradient |
| Interpolation (transitions) | Biased tanh with sharpness | Sharpness shifts the sigmoid center, controlling early/late transition bias |
| Interpolation (peak/valley) | Cosine | Smooth zero-derivative joins at extreme points |
| Color mode | ColorModeConfig + HSV interpolation | Daytime uses blackbody colors; nighttime blends toward sleepRgbColor via HSV |
| Y-axis labels | Custom SVG pills with drag-to-rescale | Color temp ticks are draggable to adjust range; uses blackbody-colored backgrounds |
| State management | useReducer with constraint cascade | Single reducer handles all mutations; Y-value hierarchy enforced automatically |
| D3 usage | Scales and line generator only | All DOM rendering is React/SVG; D3 is a math library here, not a DOM library |
| Timing model | Hybrid relative + absolute | Allows seasonal adaptation while keeping fixed sleep schedule |
| Profile architecture | Composable layers | Avoids combinatorial explosion of hardware x schedule profiles |
| Storage | HA config entries | Native, survives restarts, shows in Integrations UI |
| Panel framework | React 19 + Vite 6 | More capable than Lit for complex interactive UI |
| Brightness/color link | Coupled by default, optional unlink | Most users want them synced, power users can separate |

---

## Data Model Summary

Source of truth: `panel/src/types/curves.ts`

### TimingPoint
```typescript
interface TimingPoint {
  id: string;
  type: 'transition_start' | 'hold_start' | 'hold_end' | 'transition_end';
  value: number;          // Minutes offset (if relative) or absolute hour 0–24
  isRelative: boolean;
  anchor?: 'sunset' | 'sunrise';
  yValue: number;         // Curve value at this point (brightness % or Kelvin)
}
```

### ExtremePoint
```typescript
interface ExtremePoint {
  hour: number;   // Absolute hour 0–24
  value: number;  // Curve value at this point
}
```

### CurveDefinition
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
  peak: ExtremePoint;            // Daytime max between P5→P1
  valley: ExtremePoint;          // Nighttime min between P2→P4
}
```

### ColorModeConfig
```typescript
interface ColorModeConfig {
  colorTempStartHour: number | null; // null = follow sunriseHour
  colorTempEndHour: number | null;   // null = follow sunsetHour
  sleepRgbColor: [number, number, number];
}
```

### CurveSet
```typescript
interface CurveSet {
  brightness: CurveDefinition;
  colorTemp: CurveDefinition;
  linked: boolean;
  colorMode: ColorModeConfig;
}
```

### ProfileLayer *(aspirational — not yet implemented)*
```typescript
interface ProfileLayer {
  id: string;
  name: string;
  type: 'base' | 'hardware' | 'schedule';
  overrides: Partial<CurveDefinition & {
    linkedCurves: boolean;
    colorTempCurve?: CurveDefinition;
  }>;
}
```

---

## Getting Started (for Claude Code)

1. **Read `CLAUDE.md`** at the repo root for quick orientation
2. **Read the context files** (in order):
   - `context/user-requirements/REQUIREMENTS.md` — Full requirements
   - `context/existing-codebase/ADAPTIVE_LIGHTING_OVERVIEW.md` — Actual codebase analysis
   - `specs/data-models/TIMING_MODEL.md` — Core data structures (v2.0, matches implementation)
3. **Panel development**: `cd panel/ && pnpm install && pnpm dev`
4. **Reference the specs** — Each component has a detailed spec matching the implementation

---

## Notes for Future Sessions

- Kaleb's location: Montvale, NJ (41.0468, -74.0431) — used for default lat/long in mock data
- Kaleb has Apollo Automation sensors for bed presence detection
- Kaleb uses ESPHome with Home Assistant
- Primary light types: bulbs vs LED strips (different min brightness needs)
- Late night = after sunset, before bed
- Early morning = 6 hours after (bed_presence + all_lights_off)
