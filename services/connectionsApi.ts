/**
 * CONNECTIONS-WP1A frontend API helpers — canonical auth, secret-safe DTOs.
 */

import { authenticatedFetch, getAuthToken } from './api-auth.ts';

export const LEGACY_MEXC_STORAGE_KEY = 'titan_mexc_settings';
export const LEGACY_INDEXEDDB_STORE = 'connectionSettings';

export type ConnectionErrorCode =
  | 'APP_SESSION_EXPIRED'
  | 'APP_FORBIDDEN'
  | 'CONNECTION_VALIDATION_FAILED'
  | 'CONNECTION_NOT_CONFIGURED'
  | 'CONNECTION_UNTESTED'
  | 'CONNECTION_PROVIDER_UNSUPPORTED'
  | 'CONNECTION_SECRET_REENTRY_REQUIRED'
  | 'CONNECTION_INTERNAL_ERROR'
  | 'NETWORK_UNAVAILABLE';

export interface SafeConnectionDto {
  id?: string | null;
  provider?: string;
  exchange?: string;
  name?: string;
  configured?: boolean;
  enabled?: boolean;
  isConnected?: boolean;
  status?: string;
  credentialStatus?: string;
  maskedKeyIdentifier?: string | null;
  apiKey?: string;
  apiSecret?: string;
  isTestnet?: boolean;
  lastSyncAt?: string | null;
  secretReentryRequired?: boolean;
  privateAuthVerified?: boolean;
  permissions?: string[];
  accountInfo?: Record<string, unknown>;
}

export function mapConnectionApiError(status: number, body: any): { code: ConnectionErrorCode; messageKey: string } {
  const code = String(body?.code || '');
  if (status === 401 || code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN' || code === 'UNAUTHENTICATED' || code === 'APP_SESSION_EXPIRED') {
    return { code: 'APP_SESSION_EXPIRED', messageKey: 'connections_session_expired' };
  }
  if (status === 403 || code === 'CAPABILITY_DENIED' || code === 'APP_FORBIDDEN') {
    return { code: 'APP_FORBIDDEN', messageKey: 'connections_forbidden' };
  }
  if (code === 'CONNECTION_VALIDATION_FAILED') {
    return { code: 'CONNECTION_VALIDATION_FAILED', messageKey: 'connections_validation_failed' };
  }
  if (code === 'CONNECTION_NOT_CONFIGURED') {
    return { code: 'CONNECTION_NOT_CONFIGURED', messageKey: 'connections_not_configured' };
  }
  if (code === 'CONNECTION_UNTESTED') {
    return { code: 'CONNECTION_UNTESTED', messageKey: 'connections_untested' };
  }
  if (code === 'CONNECTION_PROVIDER_UNSUPPORTED') {
    return { code: 'CONNECTION_PROVIDER_UNSUPPORTED', messageKey: 'connections_provider_unsupported' };
  }
  if (code === 'CONNECTION_SECRET_REENTRY_REQUIRED') {
    return { code: 'CONNECTION_SECRET_REENTRY_REQUIRED', messageKey: 'connections_secret_reentry_required' };
  }
  if (status >= 500) {
    return { code: 'CONNECTION_INTERNAL_ERROR', messageKey: 'connections_internal_error' };
  }
  return { code: 'CONNECTION_INTERNAL_ERROR', messageKey: 'connections_internal_error' };
}

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function fetchExchangeConnections(): Promise<SafeConnectionDto[]> {
  const response = await authenticatedFetch('/v1/connections/exchanges', { method: 'GET' });
  const body = await parseJson(response);
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('titan_auth_expired'));
  }
  if (!response.ok) {
    const mapped = mapConnectionApiError(response.status, body);
    throw Object.assign(new Error(mapped.messageKey), { code: mapped.code });
  }
  return body.connections || [];
}

export async function saveMexcConnection(input: {
  apiKey: string;
  apiSecret: string;
  isTestnet?: boolean;
}): Promise<{ connection: SafeConnectionDto; code?: string; message?: string }> {
  const response = await authenticatedFetch('/v1/connections/exchanges/MEXC', {
    method: 'POST',
    body: JSON.stringify({
      apiKey: input.apiKey,
      apiSecret: input.apiSecret,
      isTestnet: Boolean(input.isTestnet),
    }),
  });
  const body = await parseJson(response);
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('titan_auth_expired'));
  }
  if (!response.ok) {
    const mapped = mapConnectionApiError(response.status, body);
    throw Object.assign(new Error(mapped.messageKey), { code: mapped.code, details: body });
  }
  return {
    connection: body.connection || body,
    code: body.code,
    message: body.message,
  };
}

export async function testMexcConnectionCanonical(): Promise<{
  success: boolean;
  code?: string;
  messageKey: string;
  connection?: SafeConnectionDto;
}> {
  const response = await authenticatedFetch('/v1/connections/exchanges/MEXC/test', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const body = await parseJson(response);
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('titan_auth_expired'));
  }
  // WP1A intentionally returns success:false with CONNECTION_UNTESTED
  if (response.ok && body.code === 'CONNECTION_UNTESTED') {
    return {
      success: false,
      code: body.code,
      messageKey: 'connections_untested',
      connection: body.connection,
    };
  }
  if (!response.ok) {
    const mapped = mapConnectionApiError(response.status, body);
    throw Object.assign(new Error(mapped.messageKey), { code: mapped.code, details: body });
  }
  return {
    success: Boolean(body.success),
    code: body.code,
    messageKey: body.success ? 'connections_test_ok' : 'connections_untested',
    connection: body.connection,
  };
}

export async function deleteMexcConnection(): Promise<void> {
  const response = await authenticatedFetch('/v1/connections/exchanges/MEXC', { method: 'DELETE' });
  const body = await parseJson(response);
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('titan_auth_expired'));
  }
  if (!response.ok) {
    const mapped = mapConnectionApiError(response.status, body);
    throw Object.assign(new Error(mapped.messageKey), { code: mapped.code });
  }
}

/** Detect legacy insecure keys without reading values. */
export function detectLegacyInsecureCredentialKeys(): string[] {
  const found: string[] = [];
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(LEGACY_MEXC_STORAGE_KEY) !== null) {
      found.push(LEGACY_MEXC_STORAGE_KEY);
    }
  } catch {
    // ignore storage access errors
  }
  return found;
}

/**
 * Remove only known TitanGold legacy Connection credential keys.
 * Does not inspect or log values. Does not clear unrelated storage.
 */
export async function removeLegacyInsecureCredentialKeys(): Promise<string[]> {
  const removed: string[] = [];
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(LEGACY_MEXC_STORAGE_KEY) !== null) {
      localStorage.removeItem(LEGACY_MEXC_STORAGE_KEY);
      removed.push(LEGACY_MEXC_STORAGE_KEY);
    }
  } catch {
    // ignore
  }

  try {
    // Best-effort IndexedDB cleanup for known Dexie store without reading secret values
    const { database } = await import('./database.ts');
    if (database?.delete) {
      await database.delete(LEGACY_INDEXEDDB_STORE, 'default');
      removed.push(LEGACY_INDEXEDDB_STORE);
    } else if ((database as any)?.connectionSettings) {
      delete (database as any).connectionSettings;
      removed.push(LEGACY_INDEXEDDB_STORE);
    }
  } catch {
    // ignore missing store
  }

  if (removed.length && getAuthToken()) {
    try {
      await authenticatedFetch('/v1/connections/security/local-copy-removed', {
        method: 'POST',
        body: JSON.stringify({ keysRemoved: removed }),
      });
    } catch {
      // telemetry optional
    }
  }

  return removed;
}

export interface MexcCapabilityRow {
  capabilityId: string;
  group: string;
  providerSupport: string;
  keyGrant: string;
  verificationState: string;
  operationalState: string;
  blockedReason?: string | null;
  lastVerifiedAt?: string | null;
  lastFailureCode?: string | null;
  sanitizedReason?: string | null;
  dataContractState?: string | null;
  dataContractWarningCode?: string | null;
  sanitizedDataContractReason?: string | null;
  lastDataContractCheckedAt?: string | null;
  consumerReadiness?: string | null;
}

export interface MexcConsumerRow {
  consumerId: string;
  displayName: string;
  owningModule?: string;
  requiredCapabilities: string[];
  optionalCapabilities?: string[];
  eligible: boolean;
  blockedReason?: string | null;
  publicPrivate?: string;
  rwClass?: string;
  sideEffectClass?: string;
  fallbackBehavior?: string;
  consumerReadiness?: string | null;
  limitedByDataContract?: boolean;
}

export interface MexcCapabilitySummary {
  provider: string;
  connection: {
    connectionId?: string | null;
    authState?: string;
    configured?: boolean;
    maskedKeyIdentifier?: string | null;
    lastVerifiedAt?: string | null;
    lastSanitizedFailure?: {
      capabilityId?: string | null;
      code?: string;
      sanitizedReason?: string | null;
    } | null;
    credentialAgeHint?: string | null;
    lastRotationAt?: string | null;
  };
  publicMarket?: {
    spot?: { available?: boolean };
    futures?: { available?: boolean };
  };
  privateAuthentication?: {
    state?: string;
    verified?: boolean;
    isConnected?: boolean;
  };
  capabilityMatrix?: {
    capabilities: MexcCapabilityRow[];
  };
  consumers?: MexcConsumerRow[];
  usedByModules?: string[];
  usedByConsumers?: Array<{
    consumerId: string;
    displayName: string;
    eligible?: boolean;
    consumerReadiness?: string | null;
  }>;
  overallTruthfulState?: {
    code: string;
    label: string;
    detail?: string | null;
  };
  runtime?: {
    realSideEffectsAllowed?: boolean;
    liveImpossible?: boolean;
  };
  verification?: {
    testConnectionAvailable?: boolean;
    reason?: string;
  };
}

export async function fetchMexcCapabilitySummary(): Promise<MexcCapabilitySummary> {
  const response = await authenticatedFetch('/v1/connections/mexc/capabilities', { method: 'GET' });
  const body = await parseJson(response);
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('titan_auth_expired'));
  }
  if (!response.ok) {
    const mapped = mapConnectionApiError(response.status, body);
    throw Object.assign(new Error(mapped.messageKey), { code: mapped.code });
  }
  return body as MexcCapabilitySummary;
}

export async function fetchMexcConsumers(): Promise<{ consumers: MexcConsumerRow[] }> {
  const response = await authenticatedFetch('/v1/connections/mexc/consumers', { method: 'GET' });
  const body = await parseJson(response);
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('titan_auth_expired'));
  }
  if (!response.ok) {
    const mapped = mapConnectionApiError(response.status, body);
    throw Object.assign(new Error(mapped.messageKey), { code: mapped.code });
  }
  return body;
}
