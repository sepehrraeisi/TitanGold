/**
 * URL Sync Utility - Minimal & Controlled
 * 
 * Syncs navigation state with URL query parameters for:
 * - Browser back/forward support
 * - Deep linking / shareable URLs
 * - Reproducible QA testing
 * 
 * Scope: Only view, settingsTab, settingsSubtab
 * No complex routing, no internal AI state
 */

import { ViewKey, NavigationPayload } from '../types/navigation';

export interface URLState {
  view: ViewKey;
  settingsTab?: string;
  settingsSubtab?: string;
}

/**
 * Read navigation state from current URL query params
 */
export function readStateFromURL(): URLState | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') as ViewKey | null;

  if (!view) return null;

  return {
    view,
    settingsTab: params.get('settingsTab') || undefined,
    settingsSubtab: params.get('settingsSubtab') || undefined,
  };
}

/**
 * Write navigation state to URL query params
 * Uses history.replaceState to avoid adding unnecessary history entries
 */
export function writeStateToURL(state: URLState, replace: boolean = false): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams();
  params.set('view', state.view);

  if (state.settingsTab) {
    params.set('settingsTab', state.settingsTab);
  }

  if (state.settingsSubtab) {
    params.set('settingsSubtab', state.settingsSubtab);
  }

  const newURL = `${window.location.pathname}?${params.toString()}`;

  if (replace) {
    window.history.replaceState(state, '', newURL);
  } else {
    window.history.pushState(state, '', newURL);
  }
}

/**
 * Convert NavigationPayload to URLState
 */
export function payloadToURLState(payload: NavigationPayload): URLState {
  return {
    view: payload.view,
    settingsTab: payload.settingsTab,
    settingsSubtab: payload.settingsSubtab,
  };
}

/**
 * Convert ViewKey to URLState
 */
export function viewKeyToURLState(view: ViewKey): URLState {
  return { view };
}

/**
 * Check if two URL states are equal
 */
export function isURLStateEqual(a: URLState | null, b: URLState | null): boolean {
  if (!a || !b) return a === b;

  return (
    a.view === b.view &&
    a.settingsTab === b.settingsTab &&
    a.settingsSubtab === b.settingsSubtab
  );
}
