/**
 * URL Sync Utility - Minimal & Controlled
 *
 * Syncs navigation state with URL query parameters for:
 * - Browser back/forward support
 * - Deep linking / shareable URLs
 * - Reproducible QA testing
 *
 * Scope: view, settingsTab, settingsSubtab, provider, section
 * No complex routing, no internal AI state
 */

import { ViewKey, NavigationPayload, AgentWorkspaceSection } from '../types/navigation';

const AGENT_WORKSPACE_SECTIONS = new Set<AgentWorkspaceSection>([
  'overview',
  'candidates',
  'history',
  'profitRisk',
  'settings',
  'integration',
  'regimeStrength',
  'evidence',
  'weakeningReversal',
  'multiTimeframe',
]);

function parseAgentSection(value: string | null): AgentWorkspaceSection | undefined {
  if (!value) return undefined;
  return AGENT_WORKSPACE_SECTIONS.has(value as AgentWorkspaceSection)
    ? (value as AgentWorkspaceSection)
    : undefined;
}

export interface URLState {
  view: ViewKey;
  settingsTab?: string;
  settingsSubtab?: string;
  provider?: string;
  section?: string;
  agentId?: string;
  agentSection?: AgentWorkspaceSection;
  runId?: string;
}

/**
 * Read navigation state from current URL query params
 */
export function readStateFromURL(): URLState | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') as ViewKey | null;

  if (!view) return null;

  // Accept legacy `tab` alias used by some bookmarks and QA URLs
  const settingsTab = params.get('settingsTab') || params.get('tab') || undefined;

  return {
    view,
    settingsTab,
    settingsSubtab: params.get('settingsSubtab') || undefined,
    provider: params.get('provider') || undefined,
    section: params.get('section') || undefined,
    agentId: params.get('agentId') || undefined,
    agentSection: parseAgentSection(params.get('agentSection')),
    runId: params.get('runId') || undefined,
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

  if (state.provider) {
    params.set('provider', state.provider);
  }

  if (state.section) {
    params.set('section', state.section);
  }

  if (state.agentId) {
    params.set('agentId', state.agentId);
  }

  if (state.agentSection) {
    params.set('agentSection', state.agentSection);
  }

  if (state.runId) {
    params.set('runId', state.runId);
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
    provider: payload.provider,
    section: payload.section,
    agentId: payload.agentId,
    agentSection: payload.agentSection,
    runId: payload.runId,
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
    a.view === b.view
    && a.settingsTab === b.settingsTab
    && a.settingsSubtab === b.settingsSubtab
    && a.provider === b.provider
    && a.section === b.section
    && a.agentId === b.agentId
    && a.agentSection === b.agentSection
    && a.runId === b.runId
  );
}
