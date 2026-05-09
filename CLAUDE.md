# CLAUDE.md — Adaptive Lighting Enhanced

## Project Overview

A **Home Assistant custom integration** (Python) paired with a **React custom panel** for visual curve editing of brightness and color temperature schedules. The panel lets users drag control points to shape 24-hour lighting curves that adapt to sunrise/sunset.

**Upstream fork**: [basnijholt/adaptive-lighting](https://github.com/basnijholt/adaptive-lighting)

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the default mattpocock/skills triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a multi-context domain-doc layout, with `react-dashboard` as a known context. See `docs/agents/domain.md`.

## Repository Structure

```
adaptive-lighting/
├── custom_components/adaptive_lighting/   # Python HA integration (upstream fork)
│   ├── switch.py                          # Main AdaptiveSwitch entity
│   ├── color_and_brightness.py            # SunEvents + SunLightSettings (frozen dataclasses)
│   ├── const.py                           # Constants and defaults
│   └── ...                                # config_flow, services, helpers
├── panel/                                 # React custom panel (NEW on react-dashboard)
│   ├── src/
│   │   ├── types/curves.ts                # All TypeScript interfaces
│   │   ├── components/
│   │   │   ├── CurveEditor/               # Top-level editor (CurveEditor, SingleCurvePanel, LinkedToggle)
│   │   │   ├── ChartCanvas/               # SVG chart internals (11 components)
│   │   │   ├── XAxisLabels.tsx
│   │   │   └── YAxisLabels.tsx
│   │   ├── hooks/                         # useCurveSetReducer, useCurveData, useDrag
│   │   ├── utils/                         # curvemath, pathgen, colormap, colorInterpolation, etc.
│   │   ├── data/                          # defaults, mockSunTimes, dataProvider
│   │   └── App.tsx                        # Root: useReducer + mock data
│   ├── package.json                       # React 19, Vite 6, D3 7, suncalc
│   └── tsconfig.json
├── docs/project/                          # Planning docs (written pre-implementation, partially stale)
├── tests/                                 # Python tests
└── pyproject.toml                         # Python project config
```

## Branch Status

- **`main`**: Upstream adaptive-lighting fork (Python only)
- **`react-dashboard`** (active): All panel work — standalone with mock data, no HA WebSocket integration yet

## Development Commands

### Panel (React)
```bash
cd panel/
pnpm install          # Install dependencies
pnpm dev              # Vite dev server (hot reload)
pnpm build            # TypeScript check + production build (tsc -b && vite build)
```

### Python Integration
```bash
pytest tests/          # Run Python tests
ruff check .           # Lint
ruff format .          # Format
```

## Architecture Decisions (Panel)

### 6-Segment Curve Model
The curve has 6 control points: **P1** (transition_start) → **P2** (hold_start) → **Valley** → **P4** (hold_end) → **P5** (transition_end) → **Peak**, dividing the 24h cycle into 6 phases. Each timing point carries its own `yValue` (brightness % or Kelvin), replacing the old flat min/max model.

### Interpolation
- **Biased tanh** (`interpolateWithSharpness`): Used for evening (P1→P2) and morning (P4→P5) transitions. Sharpness parameter shifts the sigmoid center, controlling where the midpoint value lands.
- **Cosine** (`cosineInterpolate`): Used for the 4 peak/valley segments (P2→Valley, Valley→P4, P5→Peak, Peak→P1) for smooth zero-derivative joins.

### Per-Point Y-Values + Constraint Cascade
Each `TimingPoint` has a `yValue`. A hierarchy is enforced: `peak >= p1,p5 >= p2,p4 >= valley`. When any point's value changes, the reducer pushes neighbors up/down to maintain this ordering.

### Two Stacked Panels
Instead of dual Y-axes on one chart, there are two `SingleCurvePanel` instances (brightness on top, color temp below), each with its own Y-axis and gradient background.

### State Management
`useReducer` with `curveSetReducer` in `App.tsx`. Actions are dispatched during drag via `onPointDrag`/`onPointDragEnd`. No React Context — props are passed down. No WebSocket yet (mock data only).

### D3 Usage
D3 is used **only for scales** (`scaleLinear`) and the `line` generator in `CurvePath`. All DOM rendering is React/SVG. No D3 selections, axes, or DOM manipulation.

### Color Mode
`ColorModeConfig` defines a daytime color-temp window (start/end hours, defaulting to sunrise/sunset). Outside this window, colors interpolate via HSV toward a `sleepRgbColor`. The `ColorModeBar` renders below the color temp panel with draggable boundary handles.

## Key File Paths

| File | Purpose |
|------|---------|
| `panel/src/types/curves.ts` | All interfaces: TimingPoint, ExtremePoint, CurveDefinition, ColorModeConfig, CurveSet, ResolvedCurve, CurvePhase, CurveSetAction |
| `panel/src/utils/curvemath.ts` | Core math: resolveTime, resolveCurve, getPhase, interpolateWithSharpness, cosineInterpolate, calculateValueAtHour |
| `panel/src/hooks/useCurveSetReducer.ts` | Reducer with Y-constraint cascade, linked mirroring, color mode boundary updates |
| `panel/src/data/defaults.ts` | DEFAULT_CURVE_SET with all default values |
| `panel/src/components/CurveEditor/CurveEditor.tsx` | Top-level: composes LinkedToggle + 2× SingleCurvePanel + ColorModeBar |
| `panel/src/components/CurveEditor/SingleCurvePanel.tsx` | One chart panel: ChartCanvas + all marker/label sub-components |
| `panel/src/utils/pathgen.ts` | Generates CurveSample[] arrays for rendering |
| `panel/src/utils/colormap.ts` | Kelvin-to-RGB, brightness-to-color mappings |
| `panel/src/utils/colorInterpolation.ts` | HSV lerp for night-mode color blending |

## Conventions

- **Commits**: feat/fix/refactor prefix, imperative mood
- **React 19** with functional components and hooks only
- **Vite 6** for bundling
- **TypeScript strict mode**
- **No CSS frameworks** — plain CSS with CSS custom properties
- **Chart constants**: WIDTH=540, HEIGHT=310, MARGINS={top:16, right:20, bottom:36, left:50}

## What's Not Yet Implemented

- **Python backend changes** (Phase 1): Enhanced timing model, profile system
- **Profile system UI** (Phase 3): Layer tabs, profile manager
- **Year slider** (Phase 4): Seasonal date preview
- **HA WebSocket integration**: Panel currently uses mock data from `dataProvider.ts`
- **Automations**: Schedule switching logic
