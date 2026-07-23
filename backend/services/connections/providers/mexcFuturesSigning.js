/**
 * MEXC Futures (Contract) signing — separate from Spot v3.
 * Official contract:
 *   signature input = accessKey + reqTime + requestParam
 *   Headers: ApiKey, Request-Time, Signature, optional recv-window
 * Do NOT reuse Spot query-signature (X-MEXC-APIKEY + signature query param).
 */

import crypto from 'crypto';

export const MEXC_FUTURES_HOST = 'https://contract.mexc.com';
export const MEXC_FUTURES_DEFAULT_RECV_WINDOW_MS = 5000;
export const MEXC_FUTURES_MAX_RECV_WINDOW_MS = 60_000;

export function encodeMexcFuturesParamValue(value) {
  return encodeURIComponent(String(value)).replace(/%20/g, '%20').replace(/\+/g, '%20');
}

export function buildMexcFuturesRequestParamString(params = {}) {
  const keys = Object.keys(params || {}).filter((k) => params[k] != null && params[k] !== '').sort();
  if (!keys.length) return '';
  return keys
    .map((k) => `${k}=${encodeMexcFuturesParamValue(params[k])}`)
    .join('&');
}

export function signMexcFuturesRequest({
  accessKey,
  secretKey,
  reqTime,
  requestParam = '',
} = {}) {
  if (!accessKey || !secretKey) {
    throw new Error('Futures accessKey and secretKey are required');
  }
  const time = String(reqTime);
  if (!/^\d+$/.test(time)) {
    throw new Error('Futures reqTime must be a millisecond timestamp');
  }
  const param = requestParam == null ? '' : String(requestParam);
  const input = `${accessKey}${time}${param}`;
  return crypto.createHmac('sha256', secretKey).update(input, 'utf8').digest('hex');
}

export function buildMexcFuturesAuthHeaders({
  accessKey,
  secretKey,
  reqTime = Date.now(),
  requestParam = '',
  recvWindow = MEXC_FUTURES_DEFAULT_RECV_WINDOW_MS,
  contentType = 'application/json',
} = {}) {
  const rw = Number(recvWindow);
  if (!Number.isFinite(rw) || rw < 1 || rw > MEXC_FUTURES_MAX_RECV_WINDOW_MS) {
    throw new Error('Futures recv-window out of allowed range');
  }
  const time = String(Math.trunc(Number(reqTime)));
  const signature = signMexcFuturesRequest({
    accessKey,
    secretKey,
    reqTime: time,
    requestParam,
  });
  const headers = {
    ApiKey: accessKey,
    'Request-Time': time,
    Signature: signature,
    'Content-Type': contentType,
  };
  if (rw !== MEXC_FUTURES_DEFAULT_RECV_WINDOW_MS) {
    headers['recv-window'] = String(Math.trunc(rw));
  }
  return { headers, reqTime: time, signature, requestParam };
}

export const MEXC_FUTURES_ERROR = Object.freeze({
  AUTH_FAILED: 'MEXC_FUTURES_AUTH_FAILED',
  PERMISSION: 'MEXC_FUTURES_PERMISSION',
  TIMESTAMP: 'MEXC_FUTURES_TIMESTAMP',
  RATE_LIMIT: 'MEXC_FUTURES_RATE_LIMIT',
  MAINTENANCE: 'MEXC_FUTURES_MAINTENANCE',
  NETWORK: 'MEXC_FUTURES_NETWORK',
  INVALID_RESPONSE: 'MEXC_FUTURES_INVALID_RESPONSE',
});

export function mapMexcFuturesProviderFailure({ httpStatus, providerCode } = {}) {
  if (httpStatus === 429) return MEXC_FUTURES_ERROR.RATE_LIMIT;
  if (httpStatus === 503) return MEXC_FUTURES_ERROR.MAINTENANCE;
  const code = Number(providerCode);
  if (code === 401 || code === 10001) return MEXC_FUTURES_ERROR.AUTH_FAILED;
  if (code === 10002 || code === 700007) return MEXC_FUTURES_ERROR.PERMISSION;
  if (code === 400 || code === 700003) return MEXC_FUTURES_ERROR.TIMESTAMP;
  return MEXC_FUTURES_ERROR.INVALID_RESPONSE;
}
