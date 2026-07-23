import type { NavigationPayload, OnNavigateHandler } from '../types/navigation.ts';

/** Settings tab: exchange connections */
export const SETTINGS_TAB_CONNECTIONS = 'connections';

/** Settings tab: wallet management */
export const SETTINGS_TAB_WALLET = 'wallet';

/** Deep-link subtab: open MEXC manage panel */
export const MEXC_MANAGE_SUBTAB = 'mexc-manage';

/** Canonical provider slug for URL / navigation */
export const MEXC_PROVIDER_SLUG = 'mexc';

/**
 * Canonical Manage section values (URL source of truth).
 * Legacy aliases `history` / `danger` normalize to these.
 */
export const MEXC_MANAGE_SECTIONS = [
  'overview',
  'credentials',
  'capabilities',
  'consumers',
  'verification-history',
  'danger-zone',
] as const;

export type MexcManageSection = (typeof MEXC_MANAGE_SECTIONS)[number];

const SECTION_ALIASES: Record<string, MexcManageSection> = {
  history: 'verification-history',
  'verification_history': 'verification-history',
  danger: 'danger-zone',
  'danger_zone': 'danger-zone',
};

export function isMexcManageSection(value: string | null | undefined): value is MexcManageSection {
  return MEXC_MANAGE_SECTIONS.includes(String(value || '') as MexcManageSection);
}

export function normalizeMexcManageSection(value?: string | null): MexcManageSection {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'overview';
  if (SECTION_ALIASES[raw]) return SECTION_ALIASES[raw];
  return isMexcManageSection(raw) ? raw : 'overview';
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

export type NavigateConnectionSectionOptions = {
  /** Reserved for callers that write URL themselves; currently onNavigate owns history. */
  replace?: boolean;
};

/**
 * Single canonical writer for provider Manage section navigation.
 * All section tabs, View consumers, Wallet deep links, and fallbacks must use this.
 */
export function navigateToConnectionSection(
  onNavigate: OnNavigateHandler | undefined,
  provider: string,
  section: string,
  _options?: NavigateConnectionSectionOptions,
): NavigationPayload {
  const slug = String(provider || MEXC_PROVIDER_SLUG).toLowerCase();
  const payload = buildMexcManageNavigation(section);
  if (slug !== MEXC_PROVIDER_SLUG) {
    // Only MEXC Manage sections are implemented; still emit canonical MEXC shape.
    payload.provider = MEXC_PROVIDER_SLUG;
  }
  if (onNavigate) {
    onNavigate(payload);
  }
  return payload;
}

export function isMexcManageDeepLink(
  settingsSubtab?: string | null,
  provider?: string | null,
): boolean {
  if (settingsSubtab === MEXC_MANAGE_SUBTAB) return true;
  return String(provider || '').toLowerCase() === MEXC_PROVIDER_SLUG;
}

/** Read active Manage section from URL (preferred) with optional fallback. */
export function readConnectionSectionFromUrl(fallback?: string | null): MexcManageSection {
  if (typeof window === 'undefined') {
    return normalizeMexcManageSection(fallback);
  }
  const params = new URLSearchParams(window.location.search);
  return normalizeMexcManageSection(params.get('section') || fallback);
}
