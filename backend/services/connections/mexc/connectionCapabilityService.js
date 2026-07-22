/**
 * MEXC connection capability summary — single read model for UI + consumers.
 */

import { query } from '../../../database/db.js';
import {
  CANONICAL_PROVIDER,
  getConnectionForUser,
} from '../../exchangeConnectionService.js';
import { AUTH_STATE, PROVIDER_AVAILABILITY } from './capabilityIds.js';
import { buildCapabilityMatrix } from './capabilityMatrix.js';
import { evaluateAllConsumers } from './consumerRegistry.js';
import { getCheckpointProposal } from './verificationOrchestrator.js';
import { MEXC_INVENTORY_META, getUnverifiedProviderSupportRows } from './capabilityInventory.js';
import { buildWalletDataContractProjection } from './walletAccessEvidence.js';

async function loadWalletDataContract(connectionId) {
  if (!connectionId) return null;
  try {
    const { rows } = await query(
      `SELECT metadata FROM exchange_connections WHERE id = $1 LIMIT 1`,
      [connectionId],
    );
    const rawMeta = rows[0]?.metadata;
    const meta = typeof rawMeta === 'string'
      ? JSON.parse(rawMeta || '{}')
      : (rawMeta && typeof rawMeta === 'object' ? rawMeta : {});
    const raw = meta.mexcWalletDataContract;
    if (!raw || typeof raw !== 'object') return null;
    return buildWalletDataContractProjection(raw);
  } catch {
    return null;
  }
}

async function loadConnectionProjectionMeta(connectionId) {
  if (!connectionId) {
    return { walletDataContract: null, providerPermissionEvidence: null, walletCurrencyProjection: null, lastProbeEvidence: null };
  }
  try {
    const { rows } = await query(
      `SELECT metadata FROM exchange_connections WHERE id = $1 LIMIT 1`,
      [connectionId],
    );
    const rawMeta = rows[0]?.metadata;
    const meta = typeof rawMeta === 'string'
      ? JSON.parse(rawMeta || '{}')
      : (rawMeta && typeof rawMeta === 'object' ? rawMeta : {});
    return {
      walletDataContract: meta.mexcWalletDataContract
        ? buildWalletDataContractProjection(meta.mexcWalletDataContract)
        : null,
      providerPermissionEvidence: meta.mexcProviderPermissionEvidence || null,
      walletCurrencyProjection: meta.mexcWalletCurrencyProjection || null,
      lastProbeEvidence: meta.mexcWalletLastProbeEvidence || null,
    };
  } catch {
    return { walletDataContract: null, providerPermissionEvidence: null, walletCurrencyProjection: null, lastProbeEvidence: null };
  }
}
async function loadStoredCapabilityStates(connectionId, ownerId) {
  if (!connectionId) return {};
  try {
    const { rows } = await query(
      `SELECT capability_id, provider_support, key_grant, verification_state, operational_state,
              last_verified_at, last_failure_code, sanitized_reason, source_of_evidence
       FROM mexc_connection_capability_state
       WHERE connection_id = $1 AND owner_id = $2`,
      [connectionId, ownerId],
    );
    const out = {};
    for (const row of rows) {
      out[row.capability_id] = {
        providerSupport: row.provider_support || undefined,
        keyGrant: row.key_grant || undefined,
        verificationState: row.verification_state || undefined,
        operationalState: row.operational_state || undefined,
        lastVerifiedAt: row.last_verified_at || null,
        lastFailureCode: row.last_failure_code || null,
        sanitizedReason: row.sanitized_reason || null,
        sourceOfEvidence: row.source_of_evidence || null,
      };
    }
    return out;
  } catch (err) {
    // Table may not exist yet in some test envs
    if (String(err.message || '').includes('does not exist')) return {};
    throw err;
  }
}

function deriveAuthState(connection) {
  if (!connection?.configured) {
    if (connection?.secretReentryRequired) return AUTH_STATE.SECRET_REENTRY_REQUIRED;
    return AUTH_STATE.NOT_CONFIGURED;
  }
  if (connection.privateAuthVerified) return AUTH_STATE.AUTHENTICATED;
  if (connection.credentialStatus === 'failed') return AUTH_STATE.FAILED;
  if (connection.credentialStatus === 'revoked') return AUTH_STATE.REVOKED;
  return AUTH_STATE.CONFIGURED_UNVERIFIED;
}

/**
 * Runtime never allows real side effects in this program slice.
 */
export function getRuntimeSideEffectFlags() {
  return {
    runtimeAllowsSideEffects: false,
    demoMode: true,
    emergencyStopAssumedSafeDefault: true,
    liveImpossible: true,
    realSideEffectsAllowed: false,
  };
}

export async function buildMexcConnectionSummary(userId) {
  const connection = await getConnectionForUser(userId, CANONICAL_PROVIDER);
  const storedStates = await loadStoredCapabilityStates(connection?.id, userId);
  const projectionMeta = await loadConnectionProjectionMeta(connection?.id);
  const walletDataContract = projectionMeta.walletDataContract;
  const runtime = getRuntimeSideEffectFlags();

  // Canonical auth: capability-store PRIVATE_AUTH verified (never invent from legacy flags alone).
  const privateAuthFromStore = storedStates.PRIVATE_AUTH?.verificationState === 'verified';
  const privateAuthVerified = Boolean(privateAuthFromStore || connection.privateAuthVerified);

  // Enrich WALLET_CURRENCY_READ with attempt / permission projection from metadata.
  if (storedStates.WALLET_CURRENCY_READ) {
    const w = storedStates.WALLET_CURRENCY_READ;
    const wp = projectionMeta.walletCurrencyProjection || {};
    const probe = projectionMeta.lastProbeEvidence || {};
    w.lastAttemptAt = wp.lastAttemptAt || probe.testedAt || probe.lastAttemptAt || w.lastAttemptAt || null;
    w.lastAttemptResult = wp.lastAttemptResult || (w.verificationState === 'verification_error' ? 'verification_error' : null);
    w.lastAttemptFailureCode = wp.lastAttemptFailureCode || probe.errorCode || w.lastFailureCode || null;
    w.keyGrantEvidence = wp.keyGrantEvidence || probe.keyGrantEvidence || null;
    w.keyGrantEvidenceType = wp.keyGrantEvidenceType || null;
    w.directEndpointVerified = wp.directEndpointVerified === true;
    if (walletDataContract) {
      w.dataContractState = walletDataContract.dataContractState;
      w.dataContractWarningCode = walletDataContract.dataContractWarningCode;
      w.sanitizedDataContractReason = walletDataContract.sanitizedDataContractReason;
      w.consumerReadiness = walletDataContract.consumerReadiness;
      w.lastDataContractCheckedAt = walletDataContract.lastDataContractCheckedAt;
    }
  }

  const matrix = buildCapabilityMatrix({
    storedStates,
    credentialsConfigured: Boolean(connection.configured),
    privateAuthVerified,
    runtimeAllowsSideEffects: runtime.runtimeAllowsSideEffects,
    userDisabled: connection.enabled === false && connection.configured === false
      ? false
      : false,
    walletDataContract,
    providerPermissionEvidence: projectionMeta.providerPermissionEvidence,
  });

  const consumers = evaluateAllConsumers(matrix);
  const authState = deriveAuthState({ ...connection, privateAuthVerified });

  const lastVerified = matrix.capabilities
    .map((c) => c.lastVerifiedAt)
    .filter(Boolean)
    .sort()
    .reverse()[0] || connection.lastSuccessAt || null;

  const lastFailure = matrix.capabilities
    .filter((c) => c.lastFailureCode)
    .map((c) => ({
      capabilityId: c.capabilityId,
      code: c.lastFailureCode,
      sanitizedReason: c.sanitizedReason,
    }))[0] || (connection.lastErrorCategory
    ? { capabilityId: null, code: connection.lastErrorCategory, sanitizedReason: null }
    : null);

  const publicSpot = matrix.capabilities.find((c) => c.capabilityId === 'MARKET_DATA_SPOT_PUBLIC');
  const publicFutures = matrix.capabilities.find((c) => c.capabilityId === 'MARKET_DATA_FUTURES_PUBLIC');

  return {
    provider: CANONICAL_PROVIDER,
    connection: {
      connectionId: connection.id,
      ownerId: userId,
      displayName: 'MEXC',
      configured: Boolean(connection.configured),
      enabled: Boolean(connection.enabled),
      credentialStatus: privateAuthVerified ? 'authenticated' : connection.credentialStatus,
      authState,
      providerAvailability: PROVIDER_AVAILABILITY.AVAILABLE,
      maskedKeyIdentifier: connection.maskedKeyIdentifier,
      secretReentryRequired: Boolean(connection.secretReentryRequired),
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
      credentialAgeHint: connection.updatedAt || connection.createdAt || null,
      lastRotationAt: connection.updatedAt || null,
      lastVerifiedAt: lastVerified,
      lastSuccessAt: connection.lastSuccessAt || lastVerified,
      lastSanitizedFailure: lastFailure,
      privateAuthVerified,
    },
    publicMarket: {
      spot: {
        available: publicSpot?.providerSupport === 'supported',
        operationalState: publicSpot?.operationalState,
        verificationState: publicSpot?.verificationState,
      },
      futures: {
        available: publicFutures?.providerSupport === 'supported',
        operationalState: publicFutures?.operationalState,
        verificationState: publicFutures?.verificationState,
        note: null,
      },
    },
    privateAuthentication: {
      state: authState,
      verified: privateAuthVerified,
      isConnected: false,
    },
    capabilityMatrix: matrix,
    consumers,
    // Deterministic Used-by: all canonical registered consumers (same registry as consumer contracts).
    // UI may collapse long lists; do not silently mix eligible-only without an explicit label.
    usedByModules: consumers.map((c) => c.displayName),
    usedByConsumers: consumers.map((c) => ({
      consumerId: c.consumerId,
      displayName: c.displayName,
      eligible: c.eligible,
      consumerReadiness: c.consumerReadiness,
    })),
    inventoryMeta: MEXC_INVENTORY_META,
    providerSupportNotVerified: getUnverifiedProviderSupportRows().map((r) => r.name),
    providerPermissionEvidence: projectionMeta.providerPermissionEvidence,
    runtime,
    verification: {
      testConnectionAvailable: false,
      reason: 'Real read-only verification awaits controlled authorization checkpoint',
      checkpoint: getCheckpointProposal(connection),
    },
    overallTruthfulState: deriveOverallState({
      authState,
      configured: connection.configured,
      privateAuthVerified,
      publicSpotAvailable: publicSpot?.providerSupport === 'supported',
    }),
  };
}

function deriveOverallState({ authState, configured, privateAuthVerified, publicSpotAvailable }) {
  if (!configured) {
    return {
      code: 'not_configured',
      label: 'Not configured',
      detail: publicSpotAvailable
        ? 'Public market data available without private credentials'
        : 'Provider public availability unknown',
    };
  }
  if (privateAuthVerified) {
    return {
      code: 'authenticated_capabilities_partial',
      label: 'Authenticated · Capabilities partial',
      detail: 'Private authentication succeeded; write capabilities remain disabled until separately authorized',
    };
  }
  if (authState === AUTH_STATE.CONFIGURED_UNVERIFIED) {
    return {
      code: 'configured_unverified',
      label: 'Configured · Not verified',
      detail: 'Credentials stored encrypted; private authentication has not succeeded yet',
    };
  }
  return {
    code: authState,
    label: String(authState).replace(/_/g, ' '),
    detail: null,
  };
}

/**
 * Side-effect gate used by Wallet / Spot / Futures / Agents.
 */
export function assertTier4Blocked(operation) {
  return {
    allowed: false,
    operation,
    code: 'LIVE_UNAVAILABLE',
    reason: 'Tier-4 financial side effects are blocked in this program slice',
    realSideEffectsAllowed: false,
  };
}

export function resolveConsumerEligibilityForUser(summary, consumerId) {
  return summary.consumers.find((c) => c.consumerId === consumerId) || null;
}
