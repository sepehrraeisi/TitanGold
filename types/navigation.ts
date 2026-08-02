/**
 * Navigation Types
 *
 * Centralized navigation types for consistent state-based navigation
 * across Dashboard, AICenter, AIManager, and redirect components.
 */

export type ViewKey =
  | 'dashboard'
  | 'favorites'
  | 'trades'
  | 'portfolio'
  | 'analysis'
  | 'news'
  | 'ai'
  | 'gold'
  | 'settings'
  | 'profile'
  | 'wallet';

export type ArbitrageAgentSection =
  | 'overview'
  | 'candidates'
  | 'history'
  | 'profitRisk'
  | 'settings'
  | 'integration';

export type NavigationPayload = {
  view: ViewKey;
  settingsTab?: string;
  settingsSubtab?: string;
  provider?: string;
  section?: string;
  agentId?: string;
  agentSection?: ArbitrageAgentSection;
  runId?: string;
};

export type NavigationTarget = ViewKey | NavigationPayload;

export type OnNavigateHandler = (target: NavigationTarget) => void;
