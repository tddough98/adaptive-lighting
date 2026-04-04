import { createContext, useContext } from 'react';
import type { HomeAssistant } from '../types/homeassistant';

export const HAContext = createContext<HomeAssistant | null>(null);

export function useHA(): HomeAssistant | null {
  return useContext(HAContext);
}
