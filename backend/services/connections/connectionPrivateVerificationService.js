/**
 * CONNECTIONS-WP2A — private verification orchestration
 * Separates provider verification from persistence (persist defaults false).
 */

import { logger } from '../logger.js';
import {
  ConnectionServiceError,
  CANONICAL_PROVIDER,
  getConnectionForUser,
  loadEncryptedMexcRowForVerification,
  withDecryptedMexcCredentials,
  writeConnectionAudit,
} from '../exchangeConnectionService.js';
import { CONNECTION_ERROR } from '../connectionErrors.js';
import { verifyMexcPrivateAccountRead, redactForLogs } from './providers/mexcPrivateAuthAdapter.js';
import {
  MEXC_AUTH_ERROR,
  MEXC_AUTH_ERROR_POLICY,
  buildSanitizedErrorResult,
} from './mexcErrorCatalog.js';

export function isPrivateVerifyLiveEnabled(env = process.env) {
  return env.CONNECTIONS_PRIVATE_VERIFY_LIVE === 'true';
}

function parseMetadata(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function proposeTransition(adapterResult) {
  if (adapterResult.authenticated) {
    return {
      proposedStatus: 'authenticated',
      credentialStatus: 'authenticated',
      privateAuthVerified: true,
      tradingPermission: adapterResult.tradingPermission,
      accountReadPermission: adapterResult.accountReadPermission,
      revokeCredentials: false,
    };
  }

  const code = adapterResult.normalizedErrorCode;
  if (code === MEXC_AUTH_ERROR.MEXC_PERMISSION_INSUFFICIENT) {
    return {
      proposedStatus: 'permission_limited',
      credentialStatus: 'permission_limited',
      privateAuthVerified: false,
      tradingPermission: adapterResult.tradingPermission,
      accountReadPermission: 'denied',
      revokeCredentials: false,
    };
  }

  if (
    code === MEXC_AUTH_ERROR.MEXC_PROVIDER_UNAVAILABLE ||
    code === MEXC_AUTH_ERROR.MEXC_TIMEOUT ||
    code === MEXC_AUTH_ERROR.MEXC_NETWORK_ERROR ||
    code === MEXC_AUTH_ERROR.MEXC_RATE_LIMITED
  ) {
    return {
      proposedStatus: 'verification_inconclusive',
      credentialStatus: 'configured_unverified',
      privateAuthVerified: false,
      tradingPermission: 'unknown',
      accountReadPermission: 'unknown',
      revokeCredentials: false,
    };
  }

  return {
    proposedStatus: 'failed',
    credentialStatus: 'configured_unverified',
    privateAuthVerified: false,
    tradingPermission: 'unknown',
    accountReadPermission: 'unknown',
    revokeCredentials: false,
    lastErrorCategory: code,
  };
}

function toSafeClientPayload(adapterResult, proposedTransition, { persisted = false } = {}) {
  return {
    success: Boolean(adapterResult.authenticated),
    authenticated: Boolean(adapterResult.authenticated),
    accountReadPermission: adapterResult.accountReadPermission,
    tradingPermission: adapterResult.tradingPermission,
    providerStatus: adapterResult.providerStatus,
    retryable: Boolean(adapterResult.retryable),
    code: adapterResult.normalizedErrorCode,
    message: adapterResult.sanitizedMessage,
    correctiveAction: adapterResult.correctiveAction || null,
    providerCode: adapterResult.providerCode || null,
    testedAt: adapterResult.testedAt,
    latencyMs: adapterResult.latencyMs,
    proposedTransition,
    persisted,
    isConnected: false,
    privateAuthVerified: false,
  };
}

/**
 * Run private verification without mutating Staging by default.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} [opts.provider]
 * @param {boolean} [opts.persist=false]
 * @param {boolean} [opts.allowProviderCall] - defaults to CONNECTIONS_PRIVATE_VERIFY_LIVE
 * @param {Function} [opts.transport]
 * @param {() => number} [opts.now]
 * @param {Function} [opts.persistFn] - fake repository for tests only
 * @param {string} [opts.correlationId]
 * @param {string|null} [opts.ipAddress]
 * @param {string|null} [opts.userAgent]
 * @param {boolean} [opts.adminOverrideAudited=false]
 */
export async function verifyOwnedMexcConnection({
  userId,
  provider = CANONICAL_PROVIDER,
  persist = false,
  allowProviderCall = isPrivateVerifyLiveEnabled(),
  transport,
  now,
  persistFn = null,
  correlationId = null,
  ipAddress = null,
  userAgent = null,
  adminOverrideAudited = false,
} = {}) {
  if (String(provider || '').toUpperCase() !== CANONICAL_PROVIDER) {
    const err = buildSanitizedErrorResult(MEXC_AUTH_ERROR.CONNECTION_PROVIDER_UNSUPPORTED);
    return {
      httpStatus: err.httpStatus,
      body: toSafeClientPayload(err, proposeTransition(err), { persisted: false }),
    };
  }

  if (!allowProviderCall) {
    const err = buildSanitizedErrorResult(MEXC_AUTH_ERROR.CONNECTION_PRIVATE_VERIFY_NOT_LIVE);
    await writeConnectionAudit({
      userId,
      action: 'connection.private_verify_blocked_not_live',
      entityId: null,
      newValue: {
        provider: CANONICAL_PROVIDER,
        reason: MEXC_AUTH_ERROR.CONNECTION_PRIVATE_VERIFY_NOT_LIVE,
        adminOverrideAudited: Boolean(adminOverrideAudited),
      },
      ipAddress,
      userAgent,
    });
    return {
      httpStatus: err.httpStatus,
      body: toSafeClientPayload(err, proposeTransition(err), { persisted: false }),
    };
  }

  const safe = await getConnectionForUser(userId, CANONICAL_PROVIDER);
  if (!safe.configured) {
    const code = safe.secretReentryRequired
      ? MEXC_AUTH_ERROR.CONNECTION_SECRET_REENTRY_REQUIRED
      : MEXC_AUTH_ERROR.CONNECTION_NOT_CONFIGURED;
    const err = buildSanitizedErrorResult(code);
    return {
      httpStatus: err.httpStatus,
      body: toSafeClientPayload(err, proposeTransition(err), { persisted: false }),
    };
  }

  const row = await loadEncryptedMexcRowForVerification(userId);
  if (!row) {
    const err = buildSanitizedErrorResult(MEXC_AUTH_ERROR.CONNECTION_NOT_CONFIGURED);
    return {
      httpStatus: err.httpStatus,
      body: toSafeClientPayload(err, proposeTransition(err), { persisted: false }),
    };
  }

  const meta = parseMetadata(row.metadata);
  if (meta.disabled === true || meta.connectionDisabled === true) {
    const err = buildSanitizedErrorResult(MEXC_AUTH_ERROR.CONNECTION_DISABLED);
    return {
      httpStatus: err.httpStatus,
      body: toSafeClientPayload(err, proposeTransition(err), { persisted: false }),
    };
  }

  let adapterResult;
  try {
    adapterResult = await withDecryptedMexcCredentials(row, async (creds) =>
      verifyMexcPrivateAccountRead({
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret,
        transport,
        now,
        correlationId,
      }),
    );
  } catch (error) {
    if (error instanceof ConnectionServiceError) {
      const mapped =
        error.code === CONNECTION_ERROR.CONNECTION_SECRET_REENTRY_REQUIRED
          ? MEXC_AUTH_ERROR.CONNECTION_SECRET_REENTRY_REQUIRED
          : error.code === 'CONNECTION_DECRYPTION_FAILED'
            ? MEXC_AUTH_ERROR.CONNECTION_DECRYPTION_FAILED
            : MEXC_AUTH_ERROR.CONNECTION_INTERNAL_ERROR;
      adapterResult = buildSanitizedErrorResult(mapped);
    } else {
      logger.error('Private verification internal failure', {
        message: redactForLogs(error?.message || 'unknown'),
      });
      adapterResult = buildSanitizedErrorResult(MEXC_AUTH_ERROR.CONNECTION_INTERNAL_ERROR);
    }
  }

  const proposedTransition = proposeTransition(adapterResult);
  let persisted = false;

  await writeConnectionAudit({
    userId,
    action: 'connection.private_verify_attempt',
    entityId: row.id,
    newValue: {
      provider: CANONICAL_PROVIDER,
      authenticated: Boolean(adapterResult.authenticated),
      normalizedErrorCode: adapterResult.normalizedErrorCode,
      auditCategory: adapterResult.auditCategory,
      retryable: Boolean(adapterResult.retryable),
      proposedStatus: proposedTransition.proposedStatus,
      persistRequested: Boolean(persist),
      // never include secrets, signature, raw body
    },
    ipAddress,
    userAgent,
  });

  if (persist) {
    if (typeof persistFn !== 'function') {
      // WP2A: refuse real persistence unless an explicit test fake is provided.
      logger.warn('Private verify persist requested but persistence is disabled for WP2A');
    } else {
      try {
        await persistFn({
          userId,
          connectionId: row.id,
          adapterResult,
          proposedTransition,
        });
        persisted = true;
      } catch (err) {
        logger.error('Private verify persistence failed; rolling back logical persist', {
          message: redactForLogs(err?.message || 'unknown'),
        });
        persisted = false;
        // Transaction rollback is the fake repository's responsibility in tests.
      }
    }
  }

  const policy = adapterResult.normalizedErrorCode
    ? MEXC_AUTH_ERROR_POLICY[adapterResult.normalizedErrorCode]
    : null;

  return {
    httpStatus: adapterResult.authenticated ? 200 : (policy?.httpStatus || adapterResult.httpStatus || 400),
    body: toSafeClientPayload(adapterResult, proposedTransition, { persisted }),
  };
}
