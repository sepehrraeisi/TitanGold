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

export type NavigationPayload = {
  view: ViewKey;
  settingsTab?: string;
  settingsSubtab?: string;
};

export type NavigationTarget = ViewKey | NavigationPayload;

export type OnNavigateHandler = (target: NavigationTarget) => void;
