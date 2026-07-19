/**
 * CONNECTIONS-WP1A-R1 — display status ownership (pure, testable).
 * Configured status comes ONLY from canonical backend Connection metadata.
 */

export type ConnectionDisplayStatus =
  | 'not_configured'
  | 'configured_not_verified'
  | 'secret_reentry_required'
  | 'coming_soon';

export interface ConnectionStatusInput {
  provider?: string | null;
  exchange?: string | null;
  configured?: boolean;
  secretReentryRequired?: boolean;
  /** Documented non-sources — must never flip configured */
  legacyBrowserKeyPresent?: boolean;
  envCredentialsPresent?: boolean;
  publicMarketReachable?: boolean;
}

export function isConfigurableProvider(provider: string | null | undefined): boolean {
  return String(provider || '').toUpperCase() === 'MEXC';
}

/**
 * Derive user-facing status from backend DTO only.
 * ENV / public market / legacy browser keys MUST NOT create configured status.
 */
export function deriveConnectionDisplayStatus(input: ConnectionStatusInput): ConnectionDisplayStatus {
  const provider = input.provider || input.exchange || '';
  if (!isConfigurableProvider(provider)) {
    return 'coming_soon';
  }
  void input.legacyBrowserKeyPresent;
  void input.envCredentialsPresent;
  void input.publicMarketReachable;

  if (input.secretReentryRequired) return 'secret_reentry_required';
  if (input.configured === true) return 'configured_not_verified';
  return 'not_configured';
}

export function connectionStatusMessageKey(status: ConnectionDisplayStatus): string {
  switch (status) {
    case 'configured_not_verified':
      return 'connections_configured_not_verified';
    case 'secret_reentry_required':
      return 'connections_secret_reentry_required';
    case 'coming_soon':
      return 'connections_coming_soon';
    case 'not_configured':
    default:
      return 'connections_not_configured';
  }
}

export function mexcPrimaryActionLabelKey(status: ConnectionDisplayStatus): string {
  if (status === 'configured_not_verified' || status === 'secret_reentry_required') {
    return 'connections_manage_mexc';
  }
  return 'connections_configure_mexc';
}
