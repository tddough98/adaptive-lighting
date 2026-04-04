/** Minimal Home Assistant types for the adaptive lighting panel. */

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  callService: (
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: { entity_id: string | string[] },
  ) => Promise<void>;
  config: {
    latitude: number;
    longitude: number;
    time_zone: string;
  };
}
