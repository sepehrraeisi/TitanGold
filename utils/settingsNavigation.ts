import type { NavigationPayload } from '../types/navigation.ts';

/** Settings tab: exchange connections */
export const SETTINGS_TAB_CONNECTIONS = 'connections';

/** Settings tab: wallet management */
export const SETTINGS_TAB_WALLET = 'wallet';

/** Deep-link subtab: open MEXC manage panel */
export const MEXC_MANAGE_SUBTAB = 'mexc-manage';

/** Canonical provider slug for URL / navigation */
export const MEXC_PROVIDER_SLUG = 'mexc';

export const MEXC_MANAGE_SECTIONS = [
  'overview',
  'credentials',
  'capabilities',
  'consumers',
  'history',
  'danger',
] as const;

export type MexcManageSection = (typeof MEXC_MANAGE_SECTIONS)[number];

export function isMexcManageSection(value: string | null | undefined): value is MexcManageSection {
  return MEXC_MANAGE_SECTIONS.includes(String(value || '') as MexcManageSection);
}

export function normalizeMexcManageSection(value?: string | null): MexcManageSection {
  return isMexcManageSection(value) ? value : 'overview';
}

/** Canonical Settings → Connections → MEXC Manage destination */
export function buildMexcManageNavigation(section: MexcManageSection | string = 'overview'): NavigationPayload {
  const normalized = normalizeMexcManageSection(section);
  return {
    view: 'settings',
    settingsTab: SETTINGS_TAB_CONNECTIONS,
    settingsSubtab: MEXC_MANAGE_SUBTAB,
    provider: MEXC_PROVIDER_SLUG,
    section: normalized,
  };
}

export function isMexcManageDeepLink(
  settingsSubtab?: string | null,
  provider?: string | null,
): boolean {
  if (settingsSubtab === MEXC_MANAGE_SUBTAB) return true;
  return String(provider || '').toLowerCase() === MEXC_PROVIDER_SLUG;
}
