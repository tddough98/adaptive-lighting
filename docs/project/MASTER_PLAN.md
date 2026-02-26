# Adaptive Lighting Enhanced: Master Plan

> **Project Codename**: `circadian-control`
> **Owner**: Kaleb (PhD student, computational biology background)
> **Status**: Planning → Implementation

---

## 🎯 Vision

A production-grade Home Assistant custom panel + enhanced adaptive-lighting fork that provides:
1. **Visual curve editor** for brightness/color temperature schedules
2. **Composable profile system** for different hardware and schedule layers
3. **Hybrid timing model** mixing relative (sunset/sunrise) and absolute (clock) times
4. **Real-time bidirectional sync** with Home Assistant

---

## 📁 Repository Structure

```
adaptive-lighting-project/          # Planning docs (will move to docs/project/)
├── MASTER_PLAN.md                    # This file
├── INDEX.md                          # Document index and reading order
├── docs/
│   ├── architecture/
│   │   └── SYSTEM_OVERVIEW.md        # High-level architecture & data flow
│   └── guides/
│       └── WORKFLOW.md               # Tools, Claude Code tips, dev workflow
├── specs/
│   ├── data-models/
│   │   ├── TIMING_MODEL.md           # Curve point schema (core spec)
│   │   └── PROFILE_SCHEMA.md         # Profile/layer definitions
│   └── ui-components/
│       ├── CURVE_EDITOR.md           # The main interactive chart
│       └── YEAR_SLIDER.md            # Seasonal preview
├── context/
│   ├── ha-integration/
│   │   └── WEBSOCKET_API.md          # HA WebSocket reference
│   ├── existing-codebase/
│   │   └── ADAPTIVE_LIGHTING_OVERVIEW.md  # How current AL works
│   └── user-requirements/
│       └── REQUIREMENTS.md           # Full requirements from conversation
└── automations/
    └── SCHEDULE_SWITCHING.md         # Late-night/early-morning automations

# To be created during implementation:
# panel/          — React custom panel source (Vite + D3.js)
# component/      — Python AL fork modifications
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HOME ASSISTANT                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐     WebSocket      ┌────────────────────────┐    │
│  │                      │◄──────────────────►│                        │    │
│  │  Adaptive Lighting   │                    │   Custom React Panel   │    │
│  │  (Python Component)  │    Services/       │   (circadian-control)  │    │
│  │                      │    State Updates   │                        │    │
│  │  ┌────────────────┐  │                    │  ┌──────────────────┐  │    │
│  │  │ Enhanced       │  │                    │  │ Curve Editor     │  │    │
│  │  │ Timing Model   │  │                    │  │ (draggable pts)  │  │    │
│  │  └────────────────┘  │                    │  └──────────────────┘  │    │
│  │  ┌────────────────┐  │                    │  ┌──────────────────┐  │    │
│  │  │ Profile        │  │                    │  │ Profile Manager  │  │    │
│  │  │ Layer System   │  │                    │  │ (tabs + layers)  │  │    │
│  │  └────────────────┘  │                    │  └──────────────────┘  │    │
│  │  ┌────────────────┐  │                    │  ┌──────────────────┐  │    │
│  │  │ Sun Position   │  │                    │  │ Year Slider      │  │    │
│  │  │ Calculator     │  │                    │  │ (seasonal view)  │  │    │
│  │  └────────────────┘  │                    │  └──────────────────┘  │    │
│  └──────────────────────┘                    └────────────────────────┘    │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Automations                                   │  │
│  │  • Late-night mode (default after sunset)                            │  │
│  │  • Early-morning mode (6h after bed presence + lights off)           │  │
│  │  • Profile switching based on conditions                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Work Breakdown

### Phase 1: Foundation (Claude Code)
| Task | Deliverable | Est. Time |
|------|-------------|-----------|
| 1.1 | Fork adaptive-lighting, set up dev environment | 30 min |
| 1.2 | Implement `EnhancedTimingModel` Python class | 2 hr |
| 1.3 | Add new config schema + services | 1 hr |
| 1.4 | Unit tests for timing calculations | 1 hr |

### Phase 2: Panel Scaffold (Claude Code)
| Task | Deliverable | Est. Time |
|------|-------------|-----------|
| 2.1 | React panel boilerplate with HA WebSocket | 1 hr |
| 2.2 | Basic curve visualization (read-only) | 1 hr |
| 2.3 | Draggable time points | 2 hr |
| 2.4 | Draggable sharpness midpoints | 1 hr |

### Phase 3: Profile System (Claude Code)
| Task | Deliverable | Est. Time |
|------|-------------|-----------|
| 3.1 | Profile data model + storage | 1 hr |
| 3.2 | Layer composition logic | 1 hr |
| 3.3 | Profile UI (tabs, layer editor) | 2 hr |
| 3.4 | Change highlighting between profiles | 1 hr |

### Phase 4: Polish & Integration (Claude Code + Manual)
| Task | Deliverable | Est. Time |
|------|-------------|-----------|
| 4.1 | Year slider with sunrise/sunset preview | 1 hr |
| 4.2 | Link/unlink brightness + color temp curves | 1 hr |
| 4.3 | Example automations | 30 min |
| 4.4 | Documentation + README | 1 hr |
| 4.5 | Manual testing in real HA instance | 2 hr |

**Total estimated: ~18 hours of Claude Code work**

---

## 🛠️ Tools & Skills

### Use Claude Code For:
- All Python development (timing model, services, tests)
- All React/TypeScript development (panel)
- File manipulation, refactoring, debugging
- Running tests and iterating

### Use Claude Project For:
- This knowledge base (persistent context)
- Design discussions and decisions
- Code review and architecture feedback
- Documentation writing

### Recommended Integrations:

| Tool | Purpose | Priority |
|------|---------|----------|
| **ESLint + Prettier** | React code quality | High |
| **pytest** | Python testing | High |
| **Home Assistant devcontainer** | Local HA for testing | High |
| **Storybook** | UI component isolation | Medium |
| **GitHub Actions** | CI/CD for the fork | Medium |

---

## 🔑 Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Curve shape control | Single midpoint sharpness | Simpler than full bezier, matches Google Slides mental model |
| Timing model | Hybrid relative + absolute | Allows seasonal adaptation while keeping fixed sleep schedule |
| Profile architecture | Composable layers | Avoids combinatorial explosion of hardware × schedule profiles |
| Storage | HA config entries | Native, survives restarts, shows in Integrations UI |
| Panel framework | React | More capable than Lit for complex interactive UI |
| Brightness/color link | Coupled by default, optional unlink | Most users want them synced, power users can separate |

---

## 📊 Data Model Summary

### Timing Point
```typescript
interface TimingPoint {
  id: string;
  type: 'transition_start' | 'hold_start' | 'hold_end' | 'transition_end';
  value: number;              // Hours (0-24) or minutes offset
  isRelative: boolean;        // true = relative to sun, false = absolute
  anchor?: 'sunset' | 'sunrise';  // Only if isRelative
}
```

### Curve Definition
```typescript
interface CurveDefinition {
  points: TimingPoint[];      // 4 time points
  sharpness: number;          // 0.0 (linear) to 1.0 (sharp)
  minValue: number;           // Min brightness % or color temp K
  maxValue: number;           // Max brightness % or color temp K
}
```

### Profile Layer
```typescript
interface ProfileLayer {
  id: string;
  name: string;
  type: 'base' | 'hardware' | 'schedule';
  overrides: Partial<CurveDefinition & {
    linkedCurves: boolean;
    colorTempCurve?: CurveDefinition;  // Only if unlinked
  }>;
}
```

---

## 🚀 Getting Started (for Claude Code)

1. **Read the context files first** (in order):
   - `context/user-requirements/REQUIREMENTS.md` — Full requirements
   - `context/existing-codebase/ADAPTIVE_LIGHTING_OVERVIEW.md` — Actual codebase analysis
   - `specs/data-models/TIMING_MODEL.md` — Core data structures

2. **Start with the React panel** (standalone with mock data via Vite dev server), then Python backend

3. **Test early** - Use the Python test file to validate calculations before UI work

4. **Reference the specs** - Each component has a detailed spec, follow it

---

## 📝 Notes for Future Sessions

- Kaleb's location: Montvale, NJ (40.9176, -74.0425) - use for default lat/long
- Kaleb has Apollo Automation sensors for bed presence detection
- Kaleb uses ESPHome with Home Assistant
- Primary light types: bulbs vs LED strips (different min brightness needs)
- Late night = after sunset, before bed
- Early morning = 6 hours after (bed_presence + all_lights_off)
