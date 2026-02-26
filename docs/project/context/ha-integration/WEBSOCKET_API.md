# Home Assistant WebSocket API Reference

> **Purpose**: Context for integrating the React panel with Home Assistant
> **Source**: Official HA documentation + practical patterns

---

## Connection Setup

### Panel Context

When running as a custom panel, HA provides a global `window.hassConnection` or injects the connection via panel registration.

```typescript
// In a custom panel, HA provides these
interface HAPanel {
  hass: HomeAssistant;      // Main HA object with connection
  narrow: boolean;          // Is sidebar collapsed?
  route: Route;             // Current route info
  panel: PanelInfo;         // Panel configuration
}

// The hass object contains the WebSocket connection
interface HomeAssistant {
  connection: Connection;   // WebSocket connection
  states: HassEntities;     // All entity states
  services: HassServices;   // Available services
  config: HassConfig;       // HA configuration
  // ... more
}
```

### React Hook for HA Connection

```typescript
// hooks/useHomeAssistant.ts
import { useContext, createContext } from 'react';

interface HomeAssistantContext {
  hass: HomeAssistant | null;
  connection: Connection | null;
}

const HAContext = createContext<HomeAssistantContext>({
  hass: null,
  connection: null
});

export function useHomeAssistant() {
  return useContext(HAContext);
}

// Provider wraps the entire panel
export function HomeAssistantProvider({ 
  children, 
  hass 
}: { 
  children: React.ReactNode; 
  hass: HomeAssistant 
}) {
  return (
    <HAContext.Provider value={{ hass, connection: hass.connection }}>
      {children}
    </HAContext.Provider>
  );
}
```

---

## Reading State

### Get All Adaptive Lighting Entities

```typescript
function getAdaptiveLightingEntities(hass: HomeAssistant) {
  return Object.entries(hass.states)
    .filter(([entityId]) => entityId.startsWith('switch.adaptive_lighting_'))
    .map(([entityId, state]) => ({
      entityId,
      state: state.state,
      attributes: state.attributes
    }));
}
```

### Subscribe to State Changes

```typescript
import { subscribeEntities } from 'home-assistant-js-websocket';

function subscribeToAdaptiveLighting(
  connection: Connection,
  callback: (entities: HassEntities) => void
) {
  return subscribeEntities(connection, (entities) => {
    // Filter to only adaptive lighting entities
    const alEntities = Object.fromEntries(
      Object.entries(entities).filter(([id]) => 
        id.startsWith('switch.adaptive_lighting_')
      )
    );
    callback(alEntities);
  });
}

// Usage in React
useEffect(() => {
  if (!connection) return;
  
  const unsubscribe = subscribeToAdaptiveLighting(connection, (entities) => {
    setAdaptiveLightingState(entities);
  });
  
  return () => unsubscribe();
}, [connection]);
```

### Adaptive Lighting Switch Attributes

The main `switch.adaptive_lighting_*` entity exposes these attributes:

```typescript
interface AdaptiveLightingAttributes {
  // Current calculated values
  brightness_pct: number;
  color_temp_kelvin: number;
  color_temp_mired: number;
  sun_position: number;        // -1 to 1
  
  // Configuration (if include_config_in_attributes is true)
  min_brightness: number;
  max_brightness: number;
  min_color_temp: number;
  max_color_temp: number;
  brightness_mode: string;
  brightness_mode_time_dark: number;
  brightness_mode_time_light: number;
  // ... all other config options
  
  // Status
  manual_control: string[];    // List of manually controlled lights
  lights: string[];            // List of controlled lights
}
```

---

## Writing State (Service Calls)

### Call Service Helper

```typescript
import { callService } from 'home-assistant-js-websocket';

async function callHAService(
  hass: HomeAssistant,
  domain: string,
  service: string,
  data?: object,
  target?: { entity_id: string | string[] }
) {
  return callService(hass.connection, domain, service, data, target);
}
```

### Change Adaptive Lighting Settings

```typescript
// This is the key service for updating settings
async function updateAdaptiveLightingSettings(
  hass: HomeAssistant,
  switchEntityId: string,
  settings: Partial<AdaptiveLightingSettings>
) {
  return callHAService(
    hass,
    'adaptive_lighting',
    'change_switch_settings',
    {
      entity_id: switchEntityId,
      ...settings
    }
  );
}

// Example usage
await updateAdaptiveLightingSettings(hass, 'switch.adaptive_lighting_bedroom', {
  min_brightness: 15,
  brightness_mode: 'tanh',
  brightness_mode_time_dark: 1800,
  brightness_mode_time_light: 3600
});
```

### Available Services

```typescript
// adaptive_lighting.apply
// Force apply current settings to lights
await callHAService(hass, 'adaptive_lighting', 'apply', {
  entity_id: 'switch.adaptive_lighting_bedroom',
  lights: ['light.bedroom_main'],
  transition: 2,
  adapt_brightness: true,
  adapt_color: true,
  turn_on_lights: false
});

// adaptive_lighting.set_manual_control
// Mark/unmark lights as manually controlled
await callHAService(hass, 'adaptive_lighting', 'set_manual_control', {
  entity_id: 'switch.adaptive_lighting_bedroom',
  lights: ['light.bedroom_main'],
  manual_control: false  // false = return to adaptive control
});

// adaptive_lighting.change_switch_settings
// Change any configuration option
await callHAService(hass, 'adaptive_lighting', 'change_switch_settings', {
  entity_id: 'switch.adaptive_lighting_bedroom',
  use_defaults: 'current',  // 'current', 'configuration', or 'factory'
  min_brightness: 20,
  max_brightness: 90
  // ... any other setting
});
```

---

## Config Entries (For Custom Data Storage)

For storing our enhanced profile configuration, we'll use HA's config entry system.

### Reading Config Entry Data

```typescript
// WebSocket message to get config entry
const message = {
  type: 'config_entries/get',
  domain: 'adaptive_lighting'  // or our custom domain
};

const response = await hass.connection.sendMessagePromise(message);
// response contains the config entry data
```

### Custom WebSocket Commands (We'll Add)

Our fork will expose additional WebSocket commands:

```typescript
// Get profile configuration
const profiles = await hass.connection.sendMessagePromise({
  type: 'adaptive_lighting/get_profiles'
});

// Update profile configuration
await hass.connection.sendMessagePromise({
  type: 'adaptive_lighting/update_profile',
  profile_id: 'hw-strips',
  overrides: {
    brightness: { min_value: 20 }
  }
});

// Set active layers
await hass.connection.sendMessagePromise({
  type: 'adaptive_lighting/set_active_layers',
  hardware_layer: 'hw-strips',
  schedule_layer: 'sched-late-night'
});
```

---

## Sun Integration

### Getting Sunrise/Sunset Times

```typescript
// The sun.sun entity provides this
const sunState = hass.states['sun.sun'];

interface SunAttributes {
  next_dawn: string;      // ISO datetime
  next_dusk: string;
  next_midnight: string;
  next_noon: string;
  next_rising: string;    // Next sunrise
  next_setting: string;   // Next sunset
  elevation: number;      // Current sun elevation
  azimuth: number;
  rising: boolean;        // Is sun currently rising?
}

// Parse to get hours
function getSunTimes(hass: HomeAssistant) {
  const sun = hass.states['sun.sun'];
  const sunrise = new Date(sun.attributes.next_rising);
  const sunset = new Date(sun.attributes.next_setting);
  
  return {
    sunriseHour: sunrise.getHours() + sunrise.getMinutes() / 60,
    sunsetHour: sunset.getHours() + sunset.getMinutes() / 60
  };
}
```

### Calculating Sun Times for Any Date

For the year preview slider, we need to calculate sunrise/sunset for arbitrary dates:

```typescript
// We'll use the SunCalc library (or implement ourselves)
import SunCalc from 'suncalc';

function getSunTimesForDate(
  date: Date,
  latitude: number,
  longitude: number
) {
  const times = SunCalc.getTimes(date, latitude, longitude);
  
  return {
    sunrise: times.sunrise,
    sunset: times.sunset,
    solarNoon: times.solarNoon
  };
}

// Get sun times for each day of the year
function getYearSunTimes(latitude: number, longitude: number) {
  const year = new Date().getFullYear();
  const result: { date: Date; sunrise: number; sunset: number }[] = [];
  
  for (let day = 0; day < 365; day++) {
    const date = new Date(year, 0, 1 + day);
    const times = getSunTimesForDate(date, latitude, longitude);
    
    result.push({
      date,
      sunrise: times.sunrise.getHours() + times.sunrise.getMinutes() / 60,
      sunset: times.sunset.getHours() + times.sunset.getMinutes() / 60
    });
  }
  
  return result;
}
```

---

## Location Data

```typescript
// Get from HA config
const config = hass.config;

const location = {
  latitude: config.latitude,
  longitude: config.longitude,
  timezone: config.time_zone
};
```

---

## Error Handling

```typescript
import { ERR_CONNECTION_LOST, ERR_INVALID_AUTH } from 'home-assistant-js-websocket';

async function safeCallService(
  hass: HomeAssistant,
  domain: string,
  service: string,
  data?: object
) {
  try {
    return await callHAService(hass, domain, service, data);
  } catch (error) {
    if (error.code === ERR_CONNECTION_LOST) {
      // Handle reconnection
      console.error('Connection lost, attempting reconnect...');
      // HA usually handles this automatically
    } else if (error.code === ERR_INVALID_AUTH) {
      // Auth expired
      console.error('Authentication expired');
    } else {
      // Service error
      console.error(`Service call failed: ${error.message}`);
      throw error;
    }
  }
}
```

---

## React Integration Pattern

### Complete Hook Example

```typescript
// hooks/useAdaptiveLighting.ts
import { useState, useEffect, useCallback } from 'react';
import { useHomeAssistant } from './useHomeAssistant';

interface UseAdaptiveLightingResult {
  // Current state
  switches: AdaptiveLightingSwitch[];
  profiles: ProfileConfig | null;
  loading: boolean;
  error: Error | null;
  
  // Actions
  updateSettings: (entityId: string, settings: object) => Promise<void>;
  setActiveLayers: (hardware?: string, schedule?: string) => Promise<void>;
  refreshProfiles: () => Promise<void>;
}

export function useAdaptiveLighting(): UseAdaptiveLightingResult {
  const { hass, connection } = useHomeAssistant();
  const [switches, setSwitches] = useState<AdaptiveLightingSwitch[]>([]);
  const [profiles, setProfiles] = useState<ProfileConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Subscribe to entity state changes
  useEffect(() => {
    if (!connection) return;
    
    const unsubscribe = subscribeToAdaptiveLighting(connection, (entities) => {
      setSwitches(parseAdaptiveLightingEntities(entities));
      setLoading(false);
    });
    
    return unsubscribe;
  }, [connection]);
  
  // Load profiles
  useEffect(() => {
    if (!connection) return;
    
    loadProfiles();
  }, [connection]);
  
  const loadProfiles = useCallback(async () => {
    try {
      const result = await connection.sendMessagePromise({
        type: 'adaptive_lighting/get_profiles'
      });
      setProfiles(result);
    } catch (e) {
      setError(e);
    }
  }, [connection]);
  
  const updateSettings = useCallback(async (
    entityId: string,
    settings: object
  ) => {
    await callHAService(hass, 'adaptive_lighting', 'change_switch_settings', {
      entity_id: entityId,
      ...settings
    });
  }, [hass]);
  
  const setActiveLayers = useCallback(async (
    hardware?: string,
    schedule?: string
  ) => {
    await connection.sendMessagePromise({
      type: 'adaptive_lighting/set_active_layers',
      hardware_layer: hardware,
      schedule_layer: schedule
    });
    await loadProfiles();
  }, [connection, loadProfiles]);
  
  return {
    switches,
    profiles,
    loading,
    error,
    updateSettings,
    setActiveLayers,
    refreshProfiles: loadProfiles
  };
}
```
