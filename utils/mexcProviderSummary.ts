/**
 * Canonical MEXC provider summary projection — one owner for collapsed card + Manage overview.
 */

import {
  deriveConnectionDisplayStatus,
  connectionStatusMessageKey,
  type ConnectionDisplayStatus,
} from '../services/connectionDisplayStatus.ts';
import type { MexcCapabilitySummary, SafeConnectionDto } from '../services/connectionsApi.ts';
import {
  productStatusFromCapability,
  type CapabilityLike,
  type ConsumerLike,
} from './mexcReasonPriority.ts';

export const PRIVATE_READ_CAPABILITY_IDS = [
  'PRIVATE_AUTH',
  'SPOT_ACCOUNT_READ',
  'SPOT_ORDER_READ',
  'SPOT_TRADE_HISTORY_READ',
  'DEPOSIT_HISTORY_READ',
  'WITHDRAWAL_HISTORY_READ',
  'TRANSFER_READ',
  'FUTURES_ACCOUNT_READ',
  'FUTURES_POSITION_READ',
] as const;

export type PublicMarketStatus = 'available' | 'unavailable' | 'unknown';
export type PrivateAuthStatus = 'verified' | 'pending' | 'failed' | 'not_configured';
export type WalletReadiness = 'ready' | 'limited' | 'blocked' | 'unknown';

export interface ProviderSummaryProjection {
  provider: string;
  configured: boolean;
  overallStatus: ConnectionDisplayStatus;
  overallStatusLabelKey: string;
  publicMarketStatus: PublicMarketStatus;
  privateAuthenticationStatus: PrivateAuthStatus;
  verifiedPrivateReadCount: number;
  capabilityCounts: {
    available: number;
    pending: number;
    blocked: number;
    unavailable: number;
    total: number;
  };
  consumerSummary: {
    usableCount: number;
    limitedCount: number;
    blockedCount: number;
    total: number;
  };
  lastSuccessfulVerificationAt: string | null;
  lastAttemptAt: string | null;
  latestSafeWarningKey: string | null;
  latestSafeWarningCode: string | null;
  credentialAgeHint: string | null;
  lastRotationAt: string | null;
  maskedKeyIdentifier: string | null;
  walletReadiness: WalletReadiness;
  usableConsumerIds: string[];
}

function resolvePublicMarket(summary?: MexcCapabilitySummary | null): PublicMarketStatus {
  const spot = summary?.publicMarket?.spot?.available;
  if (spot === true) return 'available';
  if (spot === false) return 'unavailable';
  return 'unknown';
}

function resolvePrivateAuth(
  connection: SafeConnectionDto | null | undefined,
  summary?: MexcCapabilitySummary | null,
): PrivateAuthStatus {
  if (summary?.privateAuthentication?.verified === true || connection?.privateAuthVerified === true) {
    return 'verified';
  }
  const state = String(summary?.privateAuthentication?.state || summary?.connection?.authState || '').toLowerCase();
  if (state.includes('fail')) return 'failed';
  if (connection?.configured || summary?.connection?.configured) return 'pending';
  return 'not_configured';
}

function countCapabilities(caps: CapabilityLike[]): ProviderSummaryProjection['capabilityCounts'] {
  const counts = { available: 0, pending: 0, blocked: 0, unavailable: 0, total: caps.length };
  for (const cap of caps) {
    const status = productStatusFromCapability(cap);
    counts[status] += 1;
  }
  return counts;
}

function resolveWalletReadiness(consumers: ConsumerLike[]): WalletReadiness {
  const wallet = consumers.find((c) => c.consumerId === 'wallet');
  if (!wallet) return 'unknown';
  if (wallet.consumerReadiness === 'limited' || wallet.limitedByDataContract) return 'limited';
  if (wallet.eligible) return 'ready';
  return 'blocked';
}

function latestAttemptAt(summary?: MexcCapabilitySummary | null): string | null {
  const failureAt = summary?.connection?.lastSanitizedFailure ? null : null;
  void failureAt;
  const caps = summary?.capabilityMatrix?.capabilities || [];
  let latest: string | null = null;
  let latestMs = 0;
  for (const cap of caps as Array<{ lastAttemptAt?: string | null; lastVerifiedAt?: string | null }>) {
    for (const iso of [cap.lastAttemptAt, cap.lastVerifiedAt]) {
      if (!iso) continue;
      const ms = Date.parse(iso);
      if (Number.isFinite(ms) && ms >= latestMs) {
        latestMs = ms;
        latest = iso;
      }
    }
  }
  if (summary?.connection?.lastVerifiedAt) {
    const ms = Date.parse(summary.connection.lastVerifiedAt);
    if (Number.isFinite(ms) && ms >= latestMs) {
      latest = summary.connection.lastVerifiedAt;
    }
  }
  return latest;
}

function resolveSafeWarning(summary?: MexcCapabilitySummary | null): {
  key: string | null;
  code: string | null;
} {
  const failure = summary?.connection?.lastSanitizedFailure;
  if (!failure?.code) return { key: null, code: null };
  const code = String(failure.code);
  const capId = String(failure.capabilityId || '');
  if (
    capId === 'WALLET_CURRENCY_READ'
    || /MEXC_(RESPONSE|WALLET)_/i.test(code)
  ) {
    return { key: 'mexc_currency_verification_attempt_incomplete', code };
  }
  return { key: 'mexc_verification_attempt_incomplete_generic', code };
}

export function buildMexcProviderSummary({
  connection,
  summary,
}: {
  connection?: SafeConnectionDto | null;
  summary?: MexcCapabilitySummary | null;
}): ProviderSummaryProjection {
  const provider = String(connection?.provider || connection?.exchange || summary?.provider || 'MEXC');
  const configured = Boolean(connection?.configured ?? summary?.connection?.configured);
  const privateAuthVerified =
    connection?.privateAuthVerified === true
    || summary?.privateAuthentication?.verified === true;
  const overallStatusCode =
    summary?.overallTruthfulState?.code
    || (privateAuthVerified ? 'authenticated_capabilities_partial' : null);

  const overallStatus = deriveConnectionDisplayStatus({
    provider,
    configured,
    secretReentryRequired: connection?.secretReentryRequired,
    privateAuthVerified,
    overallStatusCode,
    status: connection?.status,
    credentialStatus: connection?.credentialStatus,
  });

  const caps = (summary?.capabilityMatrix?.capabilities || []) as CapabilityLike[];
  const capabilityById = new Map(caps.map((c) => [String(c.capabilityId || ''), c]));
  let verifiedPrivateReadCount = 0;
  for (const id of PRIVATE_READ_CAPABILITY_IDS) {
    const cap = capabilityById.get(id);
    if (!cap) continue;
    if (productStatusFromCapability(cap) === 'available') {
      verifiedPrivateReadCount += 1;
    } else if (
      id === 'PRIVATE_AUTH'
      && (privateAuthVerified || summary?.privateAuthentication?.verified)
    ) {
      verifiedPrivateReadCount += 1;
    }
  }

  const consumers = (summary?.consumers || []) as ConsumerLike[];
  let usableCount = 0;
  let limitedCount = 0;
  let blockedCount = 0;
  const usableConsumerIds: string[] = [];
  for (const c of consumers) {
    const id = String(c.consumerId || '');
    if (c.consumerReadiness === 'limited' || c.limitedByDataContract) {
      limitedCount += 1;
    } else if (c.eligible) {
      usableCount += 1;
      if (id) usableConsumerIds.push(id);
    } else {
      blockedCount += 1;
    }
  }

  const warning = resolveSafeWarning(summary);

  return {
    provider,
    configured,
    overallStatus,
    overallStatusLabelKey: connectionStatusMessageKey(overallStatus),
    publicMarketStatus: resolvePublicMarket(summary),
    privateAuthenticationStatus: resolvePrivateAuth(connection, summary),
    verifiedPrivateReadCount,
    capabilityCounts: countCapabilities(caps),
    consumerSummary: {
      usableCount,
      limitedCount,
      blockedCount,
      total: consumers.length,
    },
    lastSuccessfulVerificationAt: summary?.connection?.lastVerifiedAt || null,
    lastAttemptAt: latestAttemptAt(summary),
    latestSafeWarningKey: warning.key,
    latestSafeWarningCode: warning.code,
    credentialAgeHint: summary?.connection?.credentialAgeHint || null,
    lastRotationAt: summary?.connection?.lastRotationAt || null,
    maskedKeyIdentifier:
      connection?.maskedKeyIdentifier
      || summary?.connection?.maskedKeyIdentifier
      || null,
    walletReadiness: resolveWalletReadiness(consumers),
    usableConsumerIds,
  };
}

/**
 * Guard: collapsed card and Manage overview must share one overallStatus owner.
 */
export function assertSameOverallStatus(
  a: Pick<ProviderSummaryProjection, 'overallStatus'>,
  b: Pick<ProviderSummaryProjection, 'overallStatus'>,
): boolean {
  return a.overallStatus === b.overallStatus;
}
