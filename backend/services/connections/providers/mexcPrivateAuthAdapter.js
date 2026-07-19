/**
 * CONNECTIONS-WP2A — MEXC private authentication adapter
 * Owns signing + provider transport only. No DB / encryption / ownership.
 */

import {
  buildSignedAccountQuery,
  MEXC_DEFAULT_RECV_WINDOW,
} from './mexcSigning.js';
import {
  buildMexcHttpsUrl,
  mexcSafeFetch,
  MexcTransportError,
  MEXC_DEFAULT_TIMEOUT_MS,
} from './mexcSafeTransport.js';
import {
  MEXC_AUTH_ERROR,
  mapMexcProviderFailure,
  buildSanitizedErrorResult,
  sanitizeProviderCode,
} from '../mexcErrorCatalog.js';

export const MEXC_ACCOUNT_PATH = '/api/v3/account';

function permissionFromBool(value) {
  if (value === true) return 'verified';
  if (value === false) return 'denied';
  return 'unknown';
}

function parseProviderBody(bodyText) {
  if (!bodyText || !String(bodyText).trim()) return { ok: false, json: null };
  try {
    return { ok: true, json: JSON.parse(bodyText) };
  } catch {
    return { ok: false, json: null };
  }
}

function extractProviderCode(json) {
  if (!json || typeof json !== 'object') return null;
  if (json.code != null) return json.code;
  return null;
}

function isSuccessfulAccountPayload(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return false;
  if (
    json.balances != null ||
    json.accountType != null ||
    json.permissions != null ||
    typeof json.canTrade === 'boolean'
  ) {
    return true;
  }
  return false;
}

/**
 * Verify credentials with a signed read-only account request.
 */
export async function verifyMexcPrivateAccountRead({
  apiKey,
  apiSecret,
  now = () => Date.now(),
  recvWindow = MEXC_DEFAULT_RECV_WINDOW,
  timeoutMs = MEXC_DEFAULT_TIMEOUT_MS,
  signal = null,
  transport = mexcSafeFetch,
  correlationId = null,
} = {}) {
  const started = Date.now();
  const testedAt = new Date(now()).toISOString();

  if (!apiKey || !apiSecret || typeof apiKey !== 'string' || typeof apiSecret !== 'string') {
    return buildSanitizedErrorResult(MEXC_AUTH_ERROR.MEXC_CREDENTIAL_INVALID, {
      testedAt,
      latencyMs: Date.now() - started,
    });
  }

  let signedQuery;
  try {
    ({ signedQuery } = buildSignedAccountQuery({
      secret: apiSecret,
      timestamp: Math.trunc(now()),
      recvWindow,
    }));
  } catch {
    return buildSanitizedErrorResult(MEXC_AUTH_ERROR.MEXC_TIMESTAMP_INVALID, {
      testedAt,
      latencyMs: Date.now() - started,
    });
  }

  const url = buildMexcHttpsUrl(MEXC_ACCOUNT_PATH, signedQuery);
  const headers = {
    'X-MEXC-APIKEY': apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (correlationId) headers['X-Correlation-Id'] = String(correlationId).slice(0, 64);

  let response;
  try {
    response = await transport({
      url,
      method: 'GET',
      headers,
      timeoutMs,
      signal,
    });
  } catch (err) {
    const latencyMs = Date.now() - started;
    if (err instanceof MexcTransportError) {
      const code =
        err.code === 'MEXC_TIMEOUT'
          ? MEXC_AUTH_ERROR.MEXC_TIMEOUT
          : err.code === 'MEXC_RESPONSE_INVALID'
            ? MEXC_AUTH_ERROR.MEXC_RESPONSE_INVALID
            : MEXC_AUTH_ERROR.MEXC_NETWORK_ERROR;
      return buildSanitizedErrorResult(code, { testedAt, latencyMs });
    }
    return buildSanitizedErrorResult(MEXC_AUTH_ERROR.MEXC_NETWORK_ERROR, { testedAt, latencyMs });
  }

  const latencyMs = Date.now() - started;
  const { ok, json } = parseProviderBody(response.bodyText);
  const providerCode = extractProviderCode(json);
  const providerRequestId =
    response.headers?.['x-request-id'] ||
    response.headers?.['X-Request-Id'] ||
    null;

  if (response.status !== 200 || !ok || !isSuccessfulAccountPayload(json)) {
    const code = mapMexcProviderFailure({
      httpStatus: response.status,
      providerCode,
    });
    return buildSanitizedErrorResult(code, {
      providerCode: sanitizeProviderCode(providerCode),
      providerRequestId,
      testedAt,
      latencyMs,
    });
  }

  return {
    authenticated: true,
    accountReadPermission: 'verified',
    tradingPermission: permissionFromBool(json.canTrade),
    providerStatus: 'ok',
    retryable: false,
    normalizedErrorCode: null,
    sanitizedMessage: 'Private account read succeeded.',
    correctiveAction: null,
    providerCode: null,
    providerRequestId:
      providerRequestId && String(providerRequestId).length < 128 ? String(providerRequestId) : null,
    testedAt,
    latencyMs,
    httpStatus: 200,
    auditCategory: 'provider.account_read_ok',
    logSeverity: 'info',
  };
}

/** Redact helper for logs — ensures secrets/signatures never appear. */
export function redactForLogs(value) {
  if (value == null) return value;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text
    .replace(/signature=[0-9a-f]+/gi, 'signature=REDACTED')
    .replace(/"apiSecret"\s*:\s*"[^"]*"/gi, '"apiSecret":"REDACTED"')
    .replace(/"apiKey"\s*:\s*"[^"]*"/gi, '"apiKey":"REDACTED"')
    .replace(/X-MEXC-APIKEY:\s*\S+/gi, 'X-MEXC-APIKEY: REDACTED');
}
