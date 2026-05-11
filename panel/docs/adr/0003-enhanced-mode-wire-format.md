# ADR 0003: Enhanced Mode Wire Format

## Status

Accepted

## Context

The React Dashboard edits a complete Lighting Plan, but the Home Assistant service payload originally persisted only the brightness and color-temperature curve shapes. That made `linked` timing, Color Mode Window intent, sleep RGB color, and sun-relative Peak/Valley anchors local-only panel state. Saving a plan could silently normalize that intent on reload.

## Decision

`adaptive_lighting.change_switch_settings` persists the complete enhanced-mode plan intent:

- `brightness_mode: "enhanced"`
- `enhanced_brightness_curve`
- `enhanced_color_temp_curve`
- `enhanced_linked_timing`
- `enhanced_color_mode`

Enhanced curve dictionaries include the existing transition and hold fields plus first-class Peak/Valley anchor metadata:

- `peak_hour`, `peak_value`, `peak_is_relative`, `peak_anchor`, `peak_offset_minutes`
- `valley_hour`, `valley_value`, `valley_is_relative`, `valley_anchor`, `valley_offset_minutes`

`enhanced_color_mode` stores:

- `color_temp_start_hour`
- `color_temp_end_hour`
- `start_offset_minutes`
- `end_offset_minutes`
- `sleep_rgb_color`

`null` Color Mode Window boundary hours mean sun-relative intent: start resolves from sunrise plus `start_offset_minutes`, and end resolves from sunset plus `end_offset_minutes`.

Resolved Color Mode Window hours wrap modulo 24. For example, sunrise `06:30` with `start_offset_minutes: -480` resolves to `22:30`, not `00:00`. This matches sun-relative Lighting Curve Control Point resolution and keeps dashboard preview and runtime evaluation in parity.

## Consequences

Existing enhanced configs without the new fields remain valid. Missing Peak/Valley anchor fields default to fixed clock times. Missing linked timing and color mode fields default to the dashboard's seeded intent and are persisted on the next save.

At runtime, enhanced mode evaluates the color-temperature curve throughout the day, but only sends color temperature inside the resolved Color Mode Window. Outside the window it sends `enhanced_color_mode.sleep_rgb_color` and marks the color result as RGB-forced.
