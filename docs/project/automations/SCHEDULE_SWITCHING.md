# Automation Examples

> **Purpose**: Ready-to-use automations for profile switching
> **Requires**: Apollo Automation bed presence sensor, adaptive-lighting enhanced fork

---

## Overview

These automations implement the late-night / early-morning switching logic:

1. **Default state**: Late-night mode active (after sunset)
2. **Bed trigger**: When user goes to bed (presence + lights off)
3. **6-hour delay**: After 6 hours, switch to early-morning mode
4. **Reset**: After sunrise, reset to late-night mode for next cycle

---

## Required Entities

```yaml
# Assumed entities (adjust to your setup)
binary_sensor.bed_presence          # Apollo Automation bed sensor
light.bedroom_main                  # Bedroom lights
light.bedroom_lamp                  # Any additional bedroom lights
switch.adaptive_lighting_bedroom    # Adaptive lighting switch
input_datetime.bedtime_timestamp    # Helper to track when user went to bed
input_boolean.early_morning_mode    # Helper to track mode state
```

---

## Helper Entities

Add these to `configuration.yaml`:

```yaml
input_datetime:
  bedtime_timestamp:
    name: Bedtime Timestamp
    has_date: true
    has_time: true

input_boolean:
  early_morning_mode:
    name: Early Morning Mode Active
    icon: mdi:weather-sunset-up
```

---

## Automation 1: Detect Bedtime

Triggers when user gets in bed AND all bedroom lights are off.

```yaml
alias: "Adaptive Lighting: Detect Bedtime"
description: "Records when user goes to bed for early morning mode calculation"
mode: single
trigger:
  - platform: state
    entity_id: binary_sensor.bed_presence
    to: "on"
    for:
      seconds: 30  # Debounce - must be in bed for 30s
condition:
  # All bedroom lights must be off
  - condition: state
    entity_id: light.bedroom_main
    state: "off"
  - condition: state
    entity_id: light.bedroom_lamp
    state: "off"
  # Must be after sunset (late night)
  - condition: sun
    after: sunset
  # Not already in early morning mode
  - condition: state
    entity_id: input_boolean.early_morning_mode
    state: "off"
action:
  # Record the bedtime
  - service: input_datetime.set_datetime
    target:
      entity_id: input_datetime.bedtime_timestamp
    data:
      datetime: "{{ now().isoformat() }}"
  # Log for debugging
  - service: logbook.log
    data:
      name: Adaptive Lighting
      message: "Bedtime detected at {{ now().strftime('%H:%M') }}"
```

---

## Automation 2: Switch to Early Morning Mode

Triggers 6 hours after bedtime.

```yaml
alias: "Adaptive Lighting: Switch to Early Morning Mode"
description: "Switches to early morning mode 6 hours after bedtime"
mode: single
trigger:
  - platform: template
    value_template: >
      {% set bedtime = states('input_datetime.bedtime_timestamp') %}
      {% if bedtime not in ['unknown', 'unavailable', ''] %}
        {% set bedtime_dt = strptime(bedtime, '%Y-%m-%d %H:%M:%S') %}
        {% set six_hours_later = bedtime_dt + timedelta(hours=6) %}
        {{ now() >= six_hours_later }}
      {% else %}
        false
      {% endif %}
condition:
  # Still in bed
  - condition: state
    entity_id: binary_sensor.bed_presence
    state: "on"
  # Not already in early morning mode
  - condition: state
    entity_id: input_boolean.early_morning_mode
    state: "off"
  # Before sunrise (still night)
  - condition: sun
    before: sunrise
action:
  # Set early morning mode flag
  - service: input_boolean.turn_on
    target:
      entity_id: input_boolean.early_morning_mode
  # Switch adaptive lighting to early morning profile
  - service: adaptive_lighting.set_active_layers
    data:
      entity_id: switch.adaptive_lighting_bedroom
      schedule_layer: sched-early-morning
  # Log
  - service: logbook.log
    data:
      name: Adaptive Lighting
      message: "Switched to early morning mode (6h after bedtime)"
```

---

## Automation 3: Reset After Sunrise

Resets to late-night mode after sunrise for next day's cycle.

```yaml
alias: "Adaptive Lighting: Reset to Late Night Mode"
description: "Resets to late night mode after sunrise"
mode: single
trigger:
  - platform: sun
    event: sunrise
    offset: "+01:00:00"  # 1 hour after sunrise
condition:
  # Only if early morning mode was active
  - condition: state
    entity_id: input_boolean.early_morning_mode
    state: "on"
action:
  # Reset flag
  - service: input_boolean.turn_off
    target:
      entity_id: input_boolean.early_morning_mode
  # Clear bedtime timestamp
  - service: input_datetime.set_datetime
    target:
      entity_id: input_datetime.bedtime_timestamp
    data:
      datetime: "1970-01-01 00:00:00"
  # Switch back to late night mode
  - service: adaptive_lighting.set_active_layers
    data:
      entity_id: switch.adaptive_lighting_bedroom
      schedule_layer: sched-late-night
  # Log
  - service: logbook.log
    data:
      name: Adaptive Lighting
      message: "Reset to late night mode for next cycle"
```

---

## Automation 4: Handle Getting Out of Bed at Night

If user gets out of bed before the 6-hour mark (bathroom, etc.), keep late-night mode.

```yaml
alias: "Adaptive Lighting: Handle Mid-Night Wakeup"
description: "Keeps late night mode if user briefly gets up at night"
mode: single
trigger:
  - platform: state
    entity_id: binary_sensor.bed_presence
    from: "on"
    to: "off"
condition:
  # Must be at night
  - condition: sun
    after: sunset
    before: sunrise
  # Not in early morning mode
  - condition: state
    entity_id: input_boolean.early_morning_mode
    state: "off"
action:
  # Clear the bedtime timestamp so 6-hour timer resets
  - service: input_datetime.set_datetime
    target:
      entity_id: input_datetime.bedtime_timestamp
    data:
      datetime: "1970-01-01 00:00:00"
  # Log
  - service: logbook.log
    data:
      name: Adaptive Lighting
      message: "Mid-night wakeup detected, bedtime timer reset"
```

---

## Automation 5: Hardware Profile Based on Light Entity

Switch hardware profile based on which lights are being controlled.

```yaml
alias: "Adaptive Lighting: Set Hardware Profile for Strips"
description: "Uses strip profile for LED strip lights"
mode: single
trigger:
  - platform: state
    entity_id: light.led_strip_living_room
    to: "on"
action:
  - service: adaptive_lighting.set_active_layers
    data:
      entity_id: switch.adaptive_lighting_living_room
      hardware_layer: hw-strips
```

---

## Complete Blueprint (Advanced)

For users who want a single configurable automation:

```yaml
blueprint:
  name: Adaptive Lighting Schedule Switcher
  description: >
    Automatically switches between late-night and early-morning modes
    based on bed presence and timing.
  domain: automation
  input:
    bed_sensor:
      name: Bed Presence Sensor
      selector:
        entity:
          domain: binary_sensor
    adaptive_lighting_switch:
      name: Adaptive Lighting Switch
      selector:
        entity:
          integration: adaptive_lighting
    bedroom_lights:
      name: Bedroom Lights
      selector:
        entity:
          domain: light
          multiple: true
    hours_until_morning_mode:
      name: Hours After Bedtime for Morning Mode
      default: 6
      selector:
        number:
          min: 1
          max: 12
          unit_of_measurement: hours
    late_night_layer:
      name: Late Night Schedule Layer ID
      default: sched-late-night
      selector:
        text:
    early_morning_layer:
      name: Early Morning Schedule Layer ID
      default: sched-early-morning
      selector:
        text:

# ... (blueprint implementation would continue)
```

---

## Testing the Automations

### Manual Test Flow

1. **Set up helpers**: Create the input_datetime and input_boolean
2. **Set time artificially**: Use Developer Tools to set bedtime to 6 hours ago
3. **Trigger bed presence**: Manually toggle bed sensor or use Developer Tools
4. **Check logs**: Look in Logbook for "Adaptive Lighting" entries
5. **Verify service calls**: Check switch attributes updated

### Debug Template

Add this to Developer Tools > Template to debug timing:

```jinja2
{% set bedtime = states('input_datetime.bedtime_timestamp') %}
{% if bedtime not in ['unknown', 'unavailable', ''] %}
  {% set bedtime_dt = strptime(bedtime, '%Y-%m-%d %H:%M:%S') %}
  {% set six_hours_later = bedtime_dt + timedelta(hours=6) %}
  
  Bedtime: {{ bedtime_dt }}
  6 hours later: {{ six_hours_later }}
  Current time: {{ now() }}
  Should switch: {{ now() >= six_hours_later }}
  Time remaining: {{ (six_hours_later - now()).total_seconds() / 3600 | round(2) }} hours
{% else %}
  Bedtime not set
{% endif %}
```

---

## Integration with Panel

The panel will display:
- Current active schedule layer (late-night vs early-morning)
- Time until mode switch (if bedtime recorded)
- Manual override buttons to switch modes

The automations work independently of the panel - they call the same services the panel uses.
