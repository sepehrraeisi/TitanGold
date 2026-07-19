/**
 * CONNECTIONS-WP2A — deterministic MEXC Spot v3 signing helpers
 * Official contract: HMAC-SHA256 over totalParams; signature lowercase hex.
 */

import crypto from 'crypto';

export const MEXC_DEFAULT_RECV_WINDOW = 5000;
export const MEXC_MAX_RECV_WINDOW = 59999;

/**
 * Uppercase percent-encoding for values that need encoding when signing.
 * Official note: encode only support uppercase.
 */
export function encodeMexcParamValue(value) {
  return encodeURIComponent(String(value)).replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase());
}

/**
 * Build canonical query string for signing (without signature).
 * Fixed order: recvWindow, timestamp — then any extra keys sorted.
 */
export function buildMexcCanonicalQuery(params) {
  const entries = [];
  const src = params && typeof params === 'object' ? params : {};

  if (src.recvWindow != null && src.recvWindow !== '') {
    entries.push(['recvWindow', String(src.recvWindow)]);
  }
  if (src.timestamp == null || src.timestamp === '') {
    throw new Error('timestamp is required for MEXC signed requests');
  }
  entries.push(['timestamp', String(src.timestamp)]);

  const extras = Object.keys(src)
    .filter((k) => k !== 'recvWindow' && k !== 'timestamp' && k !== 'signature')
    .sort();
  for (const key of extras) {
    if (src[key] == null) continue;
    entries.push([key, String(src[key])]);
  }

  return entries.map(([k, v]) => `${k}=${encodeMexcParamValue(v)}`).join('&');
}

/**
 * @param {string} secret
 * @param {string} totalParams
 * @returns {string} lowercase hex HMAC-SHA256
 */
export function signMexcTotalParams(secret, totalParams) {
  if (typeof secret !== 'string' || !secret) {
    throw new Error('secret required for signing');
  }
  if (typeof totalParams !== 'string') {
    throw new Error('totalParams must be a string');
  }
  return crypto.createHmac('sha256', secret).update(totalParams, 'utf8').digest('hex');
}

/**
 * Build signed query for GET account verification.
 * Signature is computed over params without signature, then appended.
 */
export function buildSignedAccountQuery({
  secret,
  timestamp,
  recvWindow = MEXC_DEFAULT_RECV_WINDOW,
  extraParams = {},
} = {}) {
  const rw = Number(recvWindow);
  if (!Number.isFinite(rw) || rw < 1 || rw > MEXC_MAX_RECV_WINDOW) {
    throw new Error('recvWindow out of allowed range');
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || !Number.isInteger(ts)) {
    throw new Error('timestamp must be an integer millisecond value');
  }

  const baseParams = {
    ...extraParams,
    recvWindow: Math.trunc(rw),
    timestamp: Math.trunc(ts),
  };
  const totalParams = buildMexcCanonicalQuery(baseParams);
  const signature = signMexcTotalParams(secret, totalParams);
  return {
    totalParams,
    signature,
    signedQuery: `${totalParams}&signature=${signature}`,
  };
}
