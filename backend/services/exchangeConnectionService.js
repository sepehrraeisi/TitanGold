/**
 * Canonical Exchange Connection service (CONNECTIONS-WP1A).
 * Owns validation, encryption, masking, ownership scoping, status, audit, DTOs.
 * Only MEXC write/persist is supported in WP1A. Other providers fail closed.
 */

import { query } from '../database/db.js';
import { encryptSecret, decryptSecret, isEncrypted, maskSecret } from '../utils/crypto.js';
import { logger } from './logger.js';
import { CONNECTION_ERROR, CREDENTIAL_STATUS } from './connectionErrors.js';

export const ENCRYPTION_VERSION = 1;
export const CANONICAL_PROVIDER = 'MEXC';
export const LISTED_PROVIDERS = Object.freeze(['MEXC', 'Binance', 'Bybit', 'KuCoin', 'Gate.io']);

export class ConnectionServiceError extends Error {
  constructor(code, message, httpStatus = 400, extra = {}) {
    super(message);
    this.name = 'ConnectionServiceError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.extra = extra;
  }
}

function normalizeProvider(provider) {
  return String(provider || '').trim();
}

function isMexc(provider) {
  return normalizeProvider(provider).toUpperCase() === CANONICAL_PROVIDER;
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

function keyHintFromPlaintext(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 4) return null;
  return maskSecret(apiKey);
}

function detectStorageMode(apiKey, apiSecret) {
  const keyEnc = isEncrypted(apiKey);
  const secretEnc = isEncrypted(apiSecret);
  if (keyEnc && secretEnc) return 'encrypted';
  if (!apiKey && !apiSecret) return 'empty';
  return 'plaintext_legacy';
}

async function writeAudit({ userId, action, entityId, newValue = {}, ipAddress = null, userAgent = null }) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value, ip_address, user_agent, created_at)
       VALUES ($1, $2, 'exchange_connection', $3, $4::jsonb, $5, $6, NOW())`,
      [
        userId || null,
        action,
        entityId || null,
        JSON.stringify(newValue),
        ipAddress,
        userAgent,
      ],
    );
  } catch (err) {
    logger.warn('Connection audit write failed:', err.message);
  }
}

/**
 * Safe metadata DTO — never includes secrets or ciphertext.
 */
export function toSafeConnectionDto(row, { providerFallback = null } = {}) {
  const provider = row?.exchange || providerFallback || null;
  if (!row) {
    return {
      id: null,
      provider,
      name: provider,
      environment: 'mainnet',
      configured: false,
      enabled: false,
      isConnected: false,
      status: CREDENTIAL_STATUS.NOT_CONFIGURED,
      credentialStatus: CREDENTIAL_STATUS.NOT_CONFIGURED,
      maskedKeyIdentifier: null,
      permissions: [],
      lastTestedAt: null,
      lastSuccessAt: null,
      lastErrorCategory: null,
      isTestnet: false,
      createdAt: null,
      updatedAt: null,
      encryptionVersion: null,
      secretReentryRequired: false,
      privateAuthVerified: false,
    };
  }

  const meta = parseMetadata(row.metadata);
  const storageMode = detectStorageMode(row.api_key, row.api_secret);
  const secretReentryRequired = storageMode === 'plaintext_legacy'
    || meta.credentialStatus === CREDENTIAL_STATUS.SECRET_REENTRY_REQUIRED;

  let credentialStatus = meta.credentialStatus || CREDENTIAL_STATUS.NOT_CONFIGURED;
  if (secretReentryRequired) {
    credentialStatus = CREDENTIAL_STATUS.SECRET_REENTRY_REQUIRED;
  } else if (storageMode === 'encrypted') {
    credentialStatus = meta.credentialStatus || CREDENTIAL_STATUS.CONFIGURED_UNVERIFIED;
  } else {
    credentialStatus = CREDENTIAL_STATUS.NOT_CONFIGURED;
  }

  const configured = storageMode === 'encrypted' && !secretReentryRequired;
  // WP1A: never treat a row as privately authenticated / Connected.
  const isConnected = false;
  const enabled = configured && row.is_active === true && !secretReentryRequired
    ? false // force not-active for private ops until WP2
    : false;

  return {
    id: row.id,
    provider: row.exchange,
    name: row.exchange,
    environment: row.is_testnet ? 'testnet' : 'mainnet',
    configured,
    enabled,
    isConnected,
    status: credentialStatus,
    credentialStatus,
    maskedKeyIdentifier: secretReentryRequired ? null : (meta.keyHint || null),
    permissions: Array.isArray(row.permissions) ? [] : [], // strip legacy inferred permissions until WP2
    lastTestedAt: meta.lastTestedAt || null,
    lastSuccessAt: meta.lastSuccessAt || null,
    lastErrorCategory: meta.lastErrorCategory || null,
    isTestnet: Boolean(row.is_testnet),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    encryptionVersion: configured ? (meta.encryptionVersion || ENCRYPTION_VERSION) : null,
    secretReentryRequired,
    privateAuthVerified: false,
    // Compatibility aliases used by existing UI (truthful)
    isActive: false,
    lastSyncAt: row.last_sync_at || null,
  };
}

export function assertSupportedWriteProvider(provider) {
  if (!isMexc(provider)) {
    throw new ConnectionServiceError(
      CONNECTION_ERROR.CONNECTION_PROVIDER_UNSUPPORTED,
      `${normalizeProvider(provider) || 'Provider'} is not supported for credential persistence in this release`,
      400,
      { provider: normalizeProvider(provider), supported: [CANONICAL_PROVIDER] },
    );
  }
}

function validateCredentialFields(apiKey, apiSecret) {
  const key = String(apiKey || '').trim();
  const secret = String(apiSecret || '').trim();
  if (!key || !secret) {
    throw new ConnectionServiceError(
      CONNECTION_ERROR.CONNECTION_VALIDATION_FAILED,
      'API key and secret are required',
      400,
    );
  }
  if (key.length < 8 || secret.length < 8) {
    throw new ConnectionServiceError(
      CONNECTION_ERROR.CONNECTION_VALIDATION_FAILED,
      'API key and secret failed basic validation',
      400,
    );
  }
  return { apiKey: key, apiSecret: secret };
}

export async function listConnectionsForUser(userId) {
  const result = await query(
    `SELECT id, user_id, exchange, api_key, api_secret, is_active, is_testnet,
            last_sync_at, created_at, updated_at, metadata, permissions, account_info
     FROM exchange_connections
     WHERE user_id = $1
     ORDER BY exchange`,
    [userId],
  );

  const byProvider = new Map(result.rows.map((r) => [r.exchange, r]));
  return LISTED_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    if (!row) return toSafeConnectionDto(null, { providerFallback: provider });
    return toSafeConnectionDto(row);
  });
}

export async function getConnectionForUser(userId, provider) {
  const name = normalizeProvider(provider);
  if (!LISTED_PROVIDERS.includes(name)) {
    throw new ConnectionServiceError(
      CONNECTION_ERROR.CONNECTION_PROVIDER_UNSUPPORTED,
      'Unsupported exchange',
      400,
      { supported: LISTED_PROVIDERS },
    );
  }

  const result = await query(
    `SELECT id, user_id, exchange, api_key, api_secret, is_active, is_testnet,
            last_sync_at, created_at, updated_at, metadata, permissions, account_info
     FROM exchange_connections
     WHERE user_id = $1 AND exchange = $2
     LIMIT 1`,
    [userId, name],
  );

  if (result.rows.length === 0) {
    return toSafeConnectionDto(null, { providerFallback: name });
  }
  return toSafeConnectionDto(result.rows[0]);
}

/**
 * CONNECTIONS-WP2A — load encrypted MEXC material for in-process verification only.
 * Caller must clear returned plaintext after use. Never expose via HTTP.
 */
export async function loadEncryptedMexcRowForVerification(userId) {
  const result = await query(
    `SELECT id, user_id, exchange, api_key, api_secret, is_active, is_testnet, metadata
     FROM exchange_connections
     WHERE user_id = $1 AND exchange = $2
     LIMIT 1`,
    [userId, CANONICAL_PROVIDER],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

/**
 * Decrypt MEXC credentials inside a scoped callback; plaintext is cleared afterward.
 * @template T
 * @param {object} row
 * @param {(creds: { apiKey: string, apiSecret: string }) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withDecryptedMexcCredentials(row, fn) {
  if (!row || !isEncrypted(row.api_key) || !isEncrypted(row.api_secret)) {
    throw new ConnectionServiceError(
      CONNECTION_ERROR.CONNECTION_SECRET_REENTRY_REQUIRED,
      'Stored credentials require secure re-entry before verification',
      409,
    );
  }

  let apiKey;
  let apiSecret;
  try {
    apiKey = decryptSecret(row.api_key);
    apiSecret = decryptSecret(row.api_secret);
  } catch {
    throw new ConnectionServiceError(
      'CONNECTION_DECRYPTION_FAILED',
      'Stored credentials could not be unlocked securely',
      500,
    );
  }

  const creds = { apiKey, apiSecret };
  try {
    return await fn(creds);
  } finally {
    // Best-effort release of plaintext references
    try {
      creds.apiKey = '';
      creds.apiSecret = '';
      apiKey = '';
      apiSecret = '';
    } catch {
      // ignore
    }
  }
}

/**
 * Upsert encrypted MEXC credentials. Does NOT mark privately authenticated.
 */
export async function upsertEncryptedConnection({
  userId,
  provider,
  apiKey,
  apiSecret,
  isTestnet = false,
  ipAddress = null,
  userAgent = null,
}) {
  assertSupportedWriteProvider(provider);
  const { apiKey: key, apiSecret: secret } = validateCredentialFields(apiKey, apiSecret);

  const encryptedKey = encryptSecret(key);
  const encryptedSecret = encryptSecret(secret);
  const meta = {
    encryptionVersion: ENCRYPTION_VERSION,
    credentialStatus: CREDENTIAL_STATUS.CONFIGURED_UNVERIFIED,
    keyHint: keyHintFromPlaintext(key),
    lastErrorCategory: null,
    privateAuthVerified: false,
  };

  const result = await query(
    `INSERT INTO exchange_connections (
       user_id, exchange, api_key, api_secret, is_active, is_testnet,
       last_sync_at, metadata, permissions, account_info, updated_at
     ) VALUES ($1, $2, $3, $4, FALSE, $5, NULL, $6::jsonb, '[]'::jsonb, '{}'::jsonb, NOW())
     ON CONFLICT (user_id, exchange)
     DO UPDATE SET
       api_key = EXCLUDED.api_key,
       api_secret = EXCLUDED.api_secret,
       is_active = FALSE,
       is_testnet = EXCLUDED.is_testnet,
       last_sync_at = NULL,
       metadata = EXCLUDED.metadata,
       permissions = '[]'::jsonb,
       account_info = '{}'::jsonb,
       updated_at = NOW()
     RETURNING id, user_id, exchange, api_key, api_secret, is_active, is_testnet,
               last_sync_at, created_at, updated_at, metadata, permissions, account_info`,
    [userId, CANONICAL_PROVIDER, encryptedKey, encryptedSecret, Boolean(isTestnet), JSON.stringify(meta)],
  );

  const row = result.rows[0];
  await writeAudit({
    userId,
    action: 'connection.credential_upserted',
    entityId: row.id,
    newValue: {
      provider: CANONICAL_PROVIDER,
      credentialStatus: CREDENTIAL_STATUS.CONFIGURED_UNVERIFIED,
      encryptionVersion: ENCRYPTION_VERSION,
      isTestnet: Boolean(isTestnet),
    },
    ipAddress,
    userAgent,
  });

  return toSafeConnectionDto(row);
}

export async function deleteConnection({
  userId,
  provider,
  ipAddress = null,
  userAgent = null,
}) {
  assertSupportedWriteProvider(provider);
  const result = await query(
    `DELETE FROM exchange_connections
     WHERE user_id = $1 AND exchange = $2
     RETURNING id`,
    [userId, CANONICAL_PROVIDER],
  );

  if (result.rows.length === 0) {
    throw new ConnectionServiceError(
      CONNECTION_ERROR.CONNECTION_NOT_CONFIGURED,
      'MEXC connection not configured',
      404,
    );
  }

  await writeAudit({
    userId,
    action: 'connection.deleted',
    entityId: result.rows[0].id,
    newValue: { provider: CANONICAL_PROVIDER },
    ipAddress,
    userAgent,
  });

  return { success: true, provider: CANONICAL_PROVIDER };
}

/**
 * WP1A Test Connection: does NOT call private provider APIs.
 * Returns truthful untested / authentication_pending.
 */
export async function recordUntestedConnectionProbe({
  userId,
  provider,
  ipAddress = null,
  userAgent = null,
}) {
  if (!isMexc(provider)) {
    throw new ConnectionServiceError(
      CONNECTION_ERROR.CONNECTION_PROVIDER_UNSUPPORTED,
      `${normalizeProvider(provider)} credential testing is not available in this release`,
      400,
      { provider: normalizeProvider(provider) },
    );
  }

  const current = await getConnectionForUser(userId, CANONICAL_PROVIDER);
  if (!current.configured) {
    if (current.secretReentryRequired) {
      throw new ConnectionServiceError(
        CONNECTION_ERROR.CONNECTION_SECRET_REENTRY_REQUIRED,
        'Stored credentials require secure re-entry before testing',
        409,
      );
    }
    throw new ConnectionServiceError(
      CONNECTION_ERROR.CONNECTION_NOT_CONFIGURED,
      'MEXC connection not configured',
      404,
    );
  }

  // Persist lastTestedAt metadata without claiming private success
  await query(
    `UPDATE exchange_connections
     SET metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
         is_active = FALSE,
         updated_at = NOW()
     WHERE user_id = $1 AND exchange = $2`,
    [
      userId,
      CANONICAL_PROVIDER,
      JSON.stringify({
        lastTestedAt: new Date().toISOString(),
        credentialStatus: CREDENTIAL_STATUS.AUTHENTICATION_PENDING,
        lastErrorCategory: null,
        privateAuthVerified: false,
      }),
    ],
  );

  await writeAudit({
    userId,
    action: 'connection.test_deferred',
    entityId: current.id,
    newValue: {
      provider: CANONICAL_PROVIDER,
      credentialStatus: CREDENTIAL_STATUS.AUTHENTICATION_PENDING,
      privateAuthVerified: false,
    },
    ipAddress,
    userAgent,
  });

  return {
    success: false,
    code: CONNECTION_ERROR.CONNECTION_UNTESTED,
    message: 'Private credential verification is not available yet. Connection remains configured but untested.',
    credentialStatus: CREDENTIAL_STATUS.AUTHENTICATION_PENDING,
    isConnected: false,
    privateAuthVerified: false,
    connection: await getConnectionForUser(userId, CANONICAL_PROVIDER),
  };
}

export async function auditLocalInsecureCopyRemoved({ userId, keysRemoved = [], ipAddress = null, userAgent = null }) {
  await writeAudit({
    userId,
    action: 'connection.local_insecure_copy_removed',
    entityId: null,
    newValue: {
      keysRemovedCount: Array.isArray(keysRemoved) ? keysRemoved.length : 0,
      // never include key names that could leak structure beyond known allowlist labels
      keysRemoved: (keysRemoved || []).filter((k) =>
        ['titan_mexc_settings', 'connectionSettings'].includes(k)),
    },
    ipAddress,
    userAgent,
  });
}

export { writeAudit as writeConnectionAudit };
