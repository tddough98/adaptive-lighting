/**
 * Custom element wrapper for the Adaptive Lighting panel.
 *
 * HA custom panels receive `hass`, `narrow`, `route`, and `panel` as properties
 * set by the HA frontend. This element bridges those into React.
 */
import { createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from './App';
import type { HomeAssistant } from './types/homeassistant';

class AdaptiveLightingPanel extends HTMLElement {
  private _hass: HomeAssistant | null = null;
  private _root: Root | null = null;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this._render();
  }

  set narrow(_narrow: boolean) {
    // Could pass to React for responsive layout
  }

  set route(_route: unknown) {
    // Not used currently
  }

  set panel(_panel: unknown) {
    // Not used currently
  }

  connectedCallback() {
    // Load the panel CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/adaptive-lighting-panel/main.css';
    document.head.appendChild(link);

    // Create React mount point
    const mountPoint = document.createElement('div');
    mountPoint.id = 'root';
    mountPoint.style.height = '100%';
    this.appendChild(mountPoint);
    this._root = createRoot(mountPoint);
    this._render();
  }

  disconnectedCallback() {
    this._root?.unmount();
    this._root = null;
  }

  private _render() {
    if (this._root) {
      this._root.render(createElement(App, { hass: this._hass }));
    }
  }
}

customElements.define('adaptive-lighting-panel', AdaptiveLightingPanel);
