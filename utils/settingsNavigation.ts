import type { NavigationPayload } from '../types/navigation.ts';

/** Settings tab: exchange connections */
export const SETTINGS_TAB_CONNECTIONS = 'connections';

/** Settings tab: wallet management */
export const SETTINGS_TAB_WALLET = 'wallet';

/** Deep-link subtab: open MEXC manage panel */
export const MEXC_MANAGE_SUBTAB = 'mexc-manage';

/** Canonical Settings → Connections → MEXC Manage destination */
export function buildMexcManageNavigation(): NavigationPayload {
  return {
    view: 'settings',
    settingsTab: SETTINGS_TAB_CONNECTIONS,
    settingsSubtab: MEXC_MANAGE_SUBTAB,
  };
}

export function isMexcManageDeepLink(settingsSubtab?: string | null): boolean {
  return settingsSubtab === MEXC_MANAGE_SUBTAB;
}
