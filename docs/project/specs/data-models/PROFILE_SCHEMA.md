# Profile Schema Specification

> **Version**: 1.0
> **Status**: Final

---

## Overview

Profiles provide a composable layer system to avoid combinatorial explosion when managing different hardware types and schedule modes. Instead of creating separate configs for "bulbs-late-night", "bulbs-early-morning", "strips-late-night", etc., users define layers that stack.

---

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EFFECTIVE RESULT                         │
│  (What actually gets applied to lights)                    │
├─────────────────────────────────────────────────────────────┤
│  Schedule Layer: "late-night"          [ACTIVE/INACTIVE]   │
│  ─────────────────────────────────                         │
│  • hold_start: 23:30 (override)                            │
│  • hold_end: null (inherit)                                │
├─────────────────────────────────────────────────────────────┤
│  Hardware Layer: "strips"              [ACTIVE/INACTIVE]   │
│  ─────────────────────────────────                         │
│  • brightness.min_value: 15 (override)                     │
│  • color_temp.min_value: null (inherit)                    │
├─────────────────────────────────────────────────────────────┤
│  Base Layer: "default"                 [ALWAYS ACTIVE]     │
│  ─────────────────────────────────                         │
│  • All values defined                                      │
│  • This is the CurveSet from TIMING_MODEL.md               │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### ProfileLayer

```typescript
interface ProfileLayer {
  id: string;                    // Unique identifier (e.g., "layer-strips")
  name: string;                  // Display name (e.g., "LED Strip Lights")
  description?: string;          // Optional description
  type: LayerType;               // Category of this layer
  overrides: ProfileOverrides;   // What this layer changes
  active: boolean;               // Is this layer currently applied?
}

type LayerType = 
  | 'base'      // Foundation layer, always active, all values required
  | 'hardware'  // Hardware-specific adjustments (bulbs, strips)
  | 'schedule'; // Time-of-day modes (late-night, early-morning)
```

### ProfileOverrides

All fields are optional. `null` or `undefined` means "inherit from lower layer".

```typescript
interface ProfileOverrides {
  // Timing overrides (partial CurveDefinition fields)
  transitionStart?: Partial<TimingPoint>;
  holdStart?: Partial<TimingPoint>;
  holdEnd?: Partial<TimingPoint>;
  transitionEnd?: Partial<TimingPoint>;
  
  // Sharpness overrides
  eveningSharpness?: number;
  morningSharpness?: number;
  
  // Value overrides
  brightness?: {
    minValue?: number;
    maxValue?: number;
  };
  colorTemp?: {
    minValue?: number;
    maxValue?: number;
  };
  
  // Coupling override
  linked?: boolean;
}
```

### ProfileConfig

Complete profile configuration stored in HA.

```typescript
interface ProfileConfig {
  version: number;               // Schema version for migrations
  baseLayer: ProfileLayer;       // Required, type='base'
  hardwareLayers: ProfileLayer[]; // Hardware variations
  scheduleLayers: ProfileLayer[]; // Schedule variations
  
  // Current state
  activeHardwareLayer?: string;  // ID of active hardware layer (null = none)
  activeScheduleLayer?: string;  // ID of active schedule layer (null = none)
}
```

---

## Default Configuration

```typescript
const DEFAULT_PROFILE_CONFIG: ProfileConfig = {
  version: 1,
  baseLayer: {
    id: 'base-default',
    name: 'Default',
    description: 'Base settings for all lights',
    type: 'base',
    active: true,
    overrides: {
      transitionStart: {
        value: -30,
        isRelative: true,
        anchor: 'sunset'
      },
      holdStart: {
        value: 23.0,
        isRelative: false
      },
      holdEnd: {
        value: 5.5,
        isRelative: false
      },
      transitionEnd: {
        value: 30,
        isRelative: true,
        anchor: 'sunrise'
      },
      eveningSharpness: 0.5,
      morningSharpness: 0.5,
      brightness: {
        minValue: 1,
        maxValue: 100
      },
      colorTemp: {
        minValue: 2000,
        maxValue: 5500
      },
      linked: true
    }
  },
  hardwareLayers: [
    {
      id: 'hw-bulbs',
      name: 'Smart Bulbs',
      description: 'Standard smart bulbs with full dimming range',
      type: 'hardware',
      active: false,
      overrides: {
        // Bulbs typically handle low brightness well
        brightness: { minValue: 1 }
      }
    },
    {
      id: 'hw-strips',
      name: 'LED Strips',
      description: 'LED strip lights (higher minimum brightness)',
      type: 'hardware',
      active: false,
      overrides: {
        // Strips often flicker or look bad below ~15%
        brightness: { minValue: 15 }
      }
    }
  ],
  scheduleLayers: [
    {
      id: 'sched-late-night',
      name: 'Late Night',
      description: 'Extended dim period for staying up late',
      type: 'schedule',
      active: false,
      overrides: {
        // Push hold period later
        holdStart: { value: 23.5, isRelative: false }, // 11:30 PM
        // Keep lights dim longer in the morning
        holdEnd: { value: 7.0, isRelative: false }     // 7:00 AM
      }
    },
    {
      id: 'sched-early-morning',
      name: 'Early Morning',
      description: 'Gradual wake-up lighting',
      type: 'schedule',
      active: false,
      overrides: {
        // Normal hold end for gradual wake-up
        holdEnd: { value: 5.5, isRelative: false },    // 5:30 AM
        // Gentler morning transition
        morningSharpness: 0.3
      }
    }
  ],
  activeHardwareLayer: null,
  activeScheduleLayer: 'sched-late-night'  // Default to late-night mode
};
```

---

## Layer Merge Algorithm

```typescript
function mergeProfiles(config: ProfileConfig): CurveSet {
  // Start with base layer (must have all values)
  let result = deepClone(config.baseLayer.overrides);
  
  // Apply active hardware layer (if any)
  const hwLayer = config.hardwareLayers.find(
    l => l.id === config.activeHardwareLayer
  );
  if (hwLayer) {
    result = deepMerge(result, hwLayer.overrides);
  }
  
  // Apply active schedule layer (if any)
  const schedLayer = config.scheduleLayers.find(
    l => l.id === config.activeScheduleLayer
  );
  if (schedLayer) {
    result = deepMerge(result, schedLayer.overrides);
  }
  
  return convertToCurveSet(result);
}

function deepMerge(base: any, override: any): any {
  const result = { ...base };
  
  for (const key of Object.keys(override)) {
    if (override[key] === null || override[key] === undefined) {
      continue;  // Inherit from base
    }
    
    if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
      result[key] = deepMerge(base[key] || {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }
  
  return result;
}
```

---

## UI Behavior

### Profile Tab Display

Each profile tab shows:
1. **Name** of the combined configuration
2. **Active layers** badge (e.g., "Base + Strips + Late Night")
3. **Curve visualization** with effective merged values

### Layer Toggle Panel

Collapsible panel showing:
- Base layer (always on, not toggleable)
- Hardware layers (radio buttons - only one active at a time)
- Schedule layers (radio buttons - only one active at a time)

### Change Highlighting

When switching between profile combinations:

```typescript
interface ChangeHighlight {
  field: string;          // e.g., "brightness.minValue"
  oldValue: any;
  newValue: any;
  source: string;         // Layer name that introduced the change
}

function getChangesBetweenProfiles(
  oldConfig: ProfileConfig,
  newConfig: ProfileConfig
): ChangeHighlight[] {
  const oldEffective = mergeProfiles(oldConfig);
  const newEffective = mergeProfiles(newConfig);
  
  return findDifferences(oldEffective, newEffective);
}
```

**UI Animation:**
- Changed fields pulse/glow briefly (500ms)
- Tooltip shows "Changed by: [Layer Name]"

---

## Serialization (HA Config Entry)

```yaml
# Stored in .storage/core.config_entries
adaptive_lighting_profiles:
  version: 1
  base_layer:
    id: base-default
    name: Default
    type: base
    active: true
    overrides:
      transition_start:
        value: -30
        is_relative: true
        anchor: sunset
      hold_start:
        value: 23.0
        is_relative: false
      # ... etc
  hardware_layers:
    - id: hw-bulbs
      name: Smart Bulbs
      type: hardware
      active: false
      overrides:
        brightness:
          min_value: 1
    - id: hw-strips
      name: LED Strips
      type: hardware
      active: false
      overrides:
        brightness:
          min_value: 15
  schedule_layers:
    - id: sched-late-night
      name: Late Night
      type: schedule
      active: false
      overrides:
        hold_start:
          value: 23.5
          is_relative: false
  active_hardware_layer: hw-strips
  active_schedule_layer: sched-late-night
```

---

## Service Calls

### Set Active Layers

```yaml
service: adaptive_lighting.set_active_layers
data:
  hardware_layer: hw-strips      # or null to deactivate
  schedule_layer: sched-late-night  # or null to deactivate
```

### Update Layer Overrides

```yaml
service: adaptive_lighting.update_layer
data:
  layer_id: hw-strips
  overrides:
    brightness:
      min_value: 20
```

### Create New Layer

```yaml
service: adaptive_lighting.create_layer
data:
  name: "My Custom Layer"
  type: schedule
  overrides:
    hold_end:
      value: 6.0
      is_relative: false
```

---

## Example Scenarios

### Scenario 1: Regular Evening with Strips

Active: Base + hw-strips + sched-late-night

Result:
- brightness.minValue: 15 (from hw-strips)
- holdStart: 23:30 (from sched-late-night)
- Everything else from Base

### Scenario 2: After Going to Bed

Automation switches: sched-late-night → sched-early-morning

Active: Base + hw-strips + sched-early-morning

Changes:
- holdEnd: 7:00 → 5:30 (changed by sched-early-morning)
- holdStart: 23:30 → 23:00 (reverted to base)
- morningSharpness: 0.5 → 0.3 (changed by sched-early-morning)

### Scenario 3: Checking Bulb Settings

User clicks "Smart Bulbs" hardware tab

Active: Base + hw-bulbs + [current schedule]

Changes:
- brightness.minValue: 15 → 1 (changed by hw-bulbs)
- UI highlights the brightness minimum slider
