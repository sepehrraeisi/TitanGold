/**
 * CONNECTIONS-WP2A — MEXC / connection verification error catalog
 */

export const MEXC_AUTH_ERROR = Object.freeze({
  MEXC_CREDENTIAL_INVALID: 'MEXC_CREDENTIAL_INVALID',
  MEXC_SIGNATURE_INVALID: 'MEXC_SIGNATURE_INVALID',
  MEXC_TIMESTAMP_INVALID: 'MEXC_TIMESTAMP_INVALID',
  MEXC_PERMISSION_INSUFFICIENT: 'MEXC_PERMISSION_INSUFFICIENT',
  MEXC_IP_RESTRICTED: 'MEXC_IP_RESTRICTED',
  MEXC_ACCOUNT_RESTRICTED: 'MEXC_ACCOUNT_RESTRICTED',
  MEXC_RATE_LIMITED: 'MEXC_RATE_LIMITED',
  MEXC_PROVIDER_UNAVAILABLE: 'MEXC_PROVIDER_UNAVAILABLE',
  MEXC_TIMEOUT: 'MEXC_TIMEOUT',
  MEXC_NETWORK_ERROR: 'MEXC_NETWORK_ERROR',
  MEXC_RESPONSE_INVALID: 'MEXC_RESPONSE_INVALID',
  CONNECTION_DECRYPTION_FAILED: 'CONNECTION_DECRYPTION_FAILED',
  CONNECTION_DISABLED: 'CONNECTION_DISABLED',
  CONNECTION_NOT_CONFIGURED: 'CONNECTION_NOT_CONFIGURED',
  CONNECTION_FORBIDDEN: 'CONNECTION_FORBIDDEN',
  CONNECTION_INTERNAL_ERROR: 'CONNECTION_INTERNAL_ERROR',
  CONNECTION_PROVIDER_UNSUPPORTED: 'CONNECTION_PROVIDER_UNSUPPORTED',
  CONNECTION_SECRET_REENTRY_REQUIRED: 'CONNECTION_SECRET_REENTRY_REQUIRED',
  CONNECTION_PRIVATE_VERIFY_NOT_LIVE: 'CONNECTION_PRIVATE_VERIFY_NOT_LIVE',
});

/**
 * @typedef {{
 *   httpStatus: number,
 *   retryable: boolean,
 *   userMeaning: string,
 *   correctiveAction: string,
 *   auditCategory: string,
 *   logSeverity: 'info'|'warn'|'error',
 * }} ErrorPolicy
 */

/** @type {Record<string, ErrorPolicy>} */
export const MEXC_AUTH_ERROR_POLICY = Object.freeze({
  [MEXC_AUTH_ERROR.MEXC_CREDENTIAL_INVALID]: {
    httpStatus: 401,
    retryable: false,
    userMeaning: 'The exchange credentials were rejected.',
    correctiveAction: 'Re-enter a valid API key and secret, then try again later.',
    auditCategory: 'provider.credential_invalid',
    logSeverity: 'warn',
  },
  [MEXC_AUTH_ERROR.MEXC_SIGNATURE_INVALID]: {
    httpStatus: 401,
    retryable: false,
    userMeaning: 'The exchange rejected the signed request.',
    correctiveAction: 'Re-enter credentials. Do not share or log the secret.',
    auditCategory: 'provider.signature_invalid',
    logSeverity: 'warn',
  },
  [MEXC_AUTH_ERROR.MEXC_TIMESTAMP_INVALID]: {
    httpStatus: 400,
    retryable: true,
    userMeaning: 'The request time was outside the allowed window.',
    correctiveAction: 'Check server clock synchronization and retry.',
    auditCategory: 'provider.timestamp_invalid',
    logSeverity: 'warn',
  },
  [MEXC_AUTH_ERROR.MEXC_PERMISSION_INSUFFICIENT]: {
    httpStatus: 403,
    retryable: false,
    userMeaning: 'The API key lacks required account-read permission.',
    correctiveAction: 'Enable spot account read permission on the exchange API key.',
    auditCategory: 'provider.permission_insufficient',
    logSeverity: 'warn',
  },
  [MEXC_AUTH_ERROR.MEXC_IP_RESTRICTED]: {
    httpStatus: 403,
    retryable: false,
    userMeaning: 'This server IP is not allowed for the API key.',
    correctiveAction: 'Add the TitanGold egress IP to the exchange API key allowlist.',
    auditCategory: 'provider.ip_restricted',
    logSeverity: 'warn',
  },
  [MEXC_AUTH_ERROR.MEXC_ACCOUNT_RESTRICTED]: {
    httpStatus: 403,
    retryable: false,
    userMeaning: 'The exchange account is restricted.',
    correctiveAction: 'Resolve account restrictions with the exchange, then retry.',
    auditCategory: 'provider.account_restricted',
    logSeverity: 'warn',
  },
  [MEXC_AUTH_ERROR.MEXC_RATE_LIMITED]: {
    httpStatus: 429,
    retryable: true,
    userMeaning: 'The exchange rate limit was reached.',
    correctiveAction: 'Wait and retry later.',
    auditCategory: 'provider.rate_limited',
    logSeverity: 'warn',
  },
  [MEXC_AUTH_ERROR.MEXC_PROVIDER_UNAVAILABLE]: {
    httpStatus: 503,
    retryable: true,
    userMeaning: 'The exchange is temporarily unavailable.',
    correctiveAction: 'Retry later. Credentials are not revoked by this error.',
    auditCategory: 'provider.unavailable',
    logSeverity: 'error',
  },
  [MEXC_AUTH_ERROR.MEXC_TIMEOUT]: {
    httpStatus: 504,
    retryable: true,
    userMeaning: 'The exchange did not respond in time.',
    correctiveAction: 'Retry later.',
    auditCategory: 'provider.timeout',
    logSeverity: 'warn',
  },
  [MEXC_AUTH_ERROR.MEXC_NETWORK_ERROR]: {
    httpStatus: 502,
    retryable: true,
    userMeaning: 'A network error occurred contacting the exchange.',
    correctiveAction: 'Retry later.',
    auditCategory: 'provider.network_error',
    logSeverity: 'warn',
  },
  [MEXC_AUTH_ERROR.MEXC_RESPONSE_INVALID]: {
    httpStatus: 502,
    retryable: false,
    userMeaning: 'The exchange returned an unexpected response.',
    correctiveAction: 'Retry later. Contact support if the issue persists.',
    auditCategory: 'provider.response_invalid',
    logSeverity: 'error',
  },
  [MEXC_AUTH_ERROR.CONNECTION_DECRYPTION_FAILED]: {
    httpStatus: 500,
    retryable: false,
    userMeaning: 'Stored credentials could not be unlocked securely.',
    correctiveAction: 'Re-enter credentials using Manage.',
    auditCategory: 'connection.decryption_failed',
    logSeverity: 'error',
  },
  [MEXC_AUTH_ERROR.CONNECTION_DISABLED]: {
    httpStatus: 409,
    retryable: false,
    userMeaning: 'This connection is disabled.',
    correctiveAction: 'Enable or reconfigure the connection before verifying.',
    auditCategory: 'connection.disabled',
    logSeverity: 'info',
  },
  [MEXC_AUTH_ERROR.CONNECTION_NOT_CONFIGURED]: {
    httpStatus: 404,
    retryable: false,
    userMeaning: 'No exchange connection is configured.',
    correctiveAction: 'Configure credentials first.',
    auditCategory: 'connection.not_configured',
    logSeverity: 'info',
  },
  [MEXC_AUTH_ERROR.CONNECTION_FORBIDDEN]: {
    httpStatus: 403,
    retryable: false,
    userMeaning: 'You are not allowed to verify this connection.',
    correctiveAction: 'Ask an administrator for the required permission.',
    auditCategory: 'connection.forbidden',
    logSeverity: 'warn',
  },
  [MEXC_AUTH_ERROR.CONNECTION_INTERNAL_ERROR]: {
    httpStatus: 500,
    retryable: false,
    userMeaning: 'An internal connection error occurred.',
    correctiveAction: 'Retry later.',
    auditCategory: 'connection.internal_error',
    logSeverity: 'error',
  },
  [MEXC_AUTH_ERROR.CONNECTION_PROVIDER_UNSUPPORTED]: {
    httpStatus: 400,
    retryable: false,
    userMeaning: 'Private verification is not supported for this exchange.',
    correctiveAction: 'Use a supported exchange when available.',
    auditCategory: 'connection.provider_unsupported',
    logSeverity: 'info',
  },
  [MEXC_AUTH_ERROR.CONNECTION_SECRET_REENTRY_REQUIRED]: {
    httpStatus: 409,
    retryable: false,
    userMeaning: 'Stored credentials require secure re-entry.',
    correctiveAction: 'Re-enter API key and secret using Manage.',
    auditCategory: 'connection.secret_reentry_required',
    logSeverity: 'info',
  },
  [MEXC_AUTH_ERROR.CONNECTION_PRIVATE_VERIFY_NOT_LIVE]: {
    httpStatus: 503,
    retryable: false,
    userMeaning: 'Private credential verification is not enabled in this environment yet.',
    correctiveAction: 'Wait for the controlled live verification release.',
    auditCategory: 'connection.private_verify_not_live',
    logSeverity: 'info',
  },
});

const PROVIDER_CODE_MAP = Object.freeze({
  700001: MEXC_AUTH_ERROR.MEXC_CREDENTIAL_INVALID,
  700002: MEXC_AUTH_ERROR.MEXC_SIGNATURE_INVALID,
  700003: MEXC_AUTH_ERROR.MEXC_TIMESTAMP_INVALID,
  700005: MEXC_AUTH_ERROR.MEXC_TIMESTAMP_INVALID,
  700006: MEXC_AUTH_ERROR.MEXC_IP_RESTRICTED,
  700007: MEXC_AUTH_ERROR.MEXC_PERMISSION_INSUFFICIENT,
  60005: MEXC_AUTH_ERROR.MEXC_ACCOUNT_RESTRICTED,
  730100: MEXC_AUTH_ERROR.MEXC_ACCOUNT_RESTRICTED,
  70011: MEXC_AUTH_ERROR.MEXC_ACCOUNT_RESTRICTED,
});

/**
 * Map HTTP status + optional provider code to canonical category.
 * Never returns raw provider message.
 */
export function mapMexcProviderFailure({ httpStatus, providerCode = null, timeout = false, network = false } = {}) {
  if (timeout) return MEXC_AUTH_ERROR.MEXC_TIMEOUT;
  if (network) return MEXC_AUTH_ERROR.MEXC_NETWORK_ERROR;
  if (httpStatus === 429) return MEXC_AUTH_ERROR.MEXC_RATE_LIMITED;

  const numeric = providerCode == null ? null : Number(providerCode);
  if (numeric != null && !Number.isNaN(numeric) && PROVIDER_CODE_MAP[numeric]) {
    return PROVIDER_CODE_MAP[numeric];
  }

  if (httpStatus === 401 || httpStatus === 403) {
    return MEXC_AUTH_ERROR.MEXC_CREDENTIAL_INVALID;
  }
  if (httpStatus >= 500) return MEXC_AUTH_ERROR.MEXC_PROVIDER_UNAVAILABLE;
  return MEXC_AUTH_ERROR.MEXC_RESPONSE_INVALID;
}

export function sanitizeProviderCode(providerCode) {
  if (providerCode == null || providerCode === '') return null;
  const n = Number(providerCode);
  if (!Number.isFinite(n)) return null;
  // Only allow known non-sensitive numeric codes
  if (PROVIDER_CODE_MAP[n] || n === 429) return String(n);
  // Allow other short numeric codes without messages
  if (Number.isInteger(n) && n >= 0 && n < 1_000_000) return String(n);
  return null;
}

export function buildSanitizedErrorResult(code, { providerCode = null, providerRequestId = null, testedAt = null, latencyMs = null } = {}) {
  const policy = MEXC_AUTH_ERROR_POLICY[code] || MEXC_AUTH_ERROR_POLICY[MEXC_AUTH_ERROR.CONNECTION_INTERNAL_ERROR];
  return {
    authenticated: false,
    accountReadPermission: 'unknown',
    tradingPermission: 'unknown',
    providerStatus: 'failed',
    retryable: policy.retryable,
    normalizedErrorCode: code,
    sanitizedMessage: policy.userMeaning,
    correctiveAction: policy.correctiveAction,
    providerCode: sanitizeProviderCode(providerCode),
    providerRequestId: providerRequestId && String(providerRequestId).length < 128 ? String(providerRequestId) : null,
    testedAt: testedAt || new Date().toISOString(),
    latencyMs: typeof latencyMs === 'number' ? latencyMs : null,
    httpStatus: policy.httpStatus,
    auditCategory: policy.auditCategory,
    logSeverity: policy.logSeverity,
  };
}
