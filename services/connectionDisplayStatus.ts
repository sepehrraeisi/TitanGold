/**
 * CONNECTIONS PRODUCT — display status ownership (pure, testable).
 * Configured / authenticated status comes ONLY from canonical backend Connection metadata.
 */

export type ConnectionDisplayStatus =
  | 'not_configured'
  | 'configured_not_verified'
  | 'authenticated_capabilities_partial'
  | 'secret_reentry_required'
  | 'not_available_yet';

export interface ConnectionStatusInput {
  provider?: string | null;
  exchange?: string | null;
  configured?: boolean;
  secretReentryRequired?: boolean;
  privateAuthVerified?: boolean | null;
  /** Canonical overall status code from capability summary / DTO */
  overallStatusCode?: string | null;
  status?: string | null;
  credentialStatus?: string | null;
  /** Documented non-sources — must never flip configured */
  legacyBrowserKeyPresent?: boolean;
  envCredentialsPresent?: boolean;
  publicMarketReachable?: boolean;
}

export function isConfigurableProvider(provider: string | null | undefined): boolean {
  return String(provider || '').toUpperCase() === 'MEXC';
}

function looksAuthenticated(input: ConnectionStatusInput): boolean {
  if (input.privateAuthVerified === true) return true;
  const code = String(input.overallStatusCode || '').toLowerCase();
  if (code.includes('authenticated')) return true;
  const status = String(input.status || '').toLowerCase();
  if (status === 'authenticated' || status.includes('authenticated')) return true;
  const cred = String(input.credentialStatus || '').toLowerCase();
  if (cred === 'authenticated' || cred.includes('authenticated')) return true;
  return false;
}

/**
 * Derive user-facing status from backend DTO only.
 * ENV / public market / legacy browser keys MUST NOT create configured status.
 */
export function deriveConnectionDisplayStatus(input: ConnectionStatusInput): ConnectionDisplayStatus {
  const provider = input.provider || input.exchange || '';
  if (!isConfigurableProvider(provider)) {
    return 'not_available_yet';
  }
  void input.legacyBrowserKeyPresent;
  void input.envCredentialsPresent;
  void input.publicMarketReachable;

  if (input.secretReentryRequired) return 'secret_reentry_required';

  const configured = input.configured === true;
  if (configured && looksAuthenticated(input)) {
    return 'authenticated_capabilities_partial';
  }
  if (configured) return 'configured_not_verified';
  return 'not_configured';
}

export function connectionStatusMessageKey(status: ConnectionDisplayStatus): string {
  switch (status) {
    case 'authenticated_capabilities_partial':
      return 'mexc_state_authenticated_capabilities_partial';
    case 'configured_not_verified':
      return 'connections_configured_not_verified';
    case 'secret_reentry_required':
      return 'connections_secret_reentry_required';
    case 'not_available_yet':
      return 'connections_not_available_yet';
    case 'not_configured':
    default:
      return 'connections_not_configured';
  }
}

export function mexcPrimaryActionLabelKey(status: ConnectionDisplayStatus): string {
  if (
    status === 'configured_not_verified'
    || status === 'authenticated_capabilities_partial'
    || status === 'secret_reentry_required'
  ) {
    return 'connections_manage_mexc';
  }
  return 'connections_configure_mexc';
}
