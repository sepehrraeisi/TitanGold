/**
 * Multi-host safe HTTPS transport for MEXC public + futures hosts.
 * Extends WP2A allowlist model without replacing mexcSafeTransport.js.
 */

import { URL } from 'url';

export const MEXC_E2E_ALLOWED_HOSTS = Object.freeze(['api.mexc.com', 'contract.mexc.com']);
export const MEXC_E2E_DEFAULT_TIMEOUT_MS = 8_000;
export const MEXC_E2E_MAX_RESPONSE_BYTES = 256 * 1024;

function categorizeBodyBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown';
  if (bytes < 1024) return 'under_1KiB';
  if (bytes < 16 * 1024) return '1KiB_to_16KiB';
  if (bytes < 64 * 1024) return '16KiB_to_64KiB';
  if (bytes < 256 * 1024) return '64KiB_to_256KiB';
  if (bytes < 1024 * 1024) return '256KiB_to_1MiB';
  return '1MiB_plus';
}

export class MexcE2ETransportError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'MexcE2ETransportError';
    this.code = code;
    this.extra = extra;
  }
}

function assertSafeUrl(urlString, { allowHosts = MEXC_E2E_ALLOWED_HOSTS } = {}) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new MexcE2ETransportError('MEXC_NETWORK_ERROR', 'Invalid provider URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new MexcE2ETransportError('MEXC_NETWORK_ERROR', 'HTTPS required');
  }
  if (!allowHosts.includes(parsed.hostname)) {
    throw new MexcE2ETransportError('MEXC_NETWORK_ERROR', 'Hostname not allowlisted');
  }
  if (parsed.username || parsed.password) {
    throw new MexcE2ETransportError('MEXC_NETWORK_ERROR', 'Credentials in URL are forbidden');
  }
  return parsed;
}

export function buildE2EHttpsUrl(host, pathname, query = '') {
  const hostname = String(host || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!MEXC_E2E_ALLOWED_HOSTS.includes(hostname)) {
    throw new MexcE2ETransportError('MEXC_NETWORK_ERROR', 'Hostname not allowlisted');
  }
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) {
    throw new MexcE2ETransportError('MEXC_NETWORK_ERROR', 'Invalid pathname');
  }
  if (pathname.includes('://') || pathname.includes('..')) {
    throw new MexcE2ETransportError('MEXC_NETWORK_ERROR', 'User-controlled URL rejected');
  }
  return `https://${hostname}${pathname}${query ? `?${query}` : ''}`;
}

export async function mexcE2ESafeFetch({
  url,
  method = 'GET',
  headers = {},
  timeoutMs = MEXC_E2E_DEFAULT_TIMEOUT_MS,
  signal = null,
  fetchImpl = globalThis.fetch,
  maxBytes = MEXC_E2E_MAX_RESPONSE_BYTES,
} = {}) {
  assertSafeUrl(url);
  if (typeof fetchImpl !== 'function') {
    throw new MexcE2ETransportError('MEXC_NETWORK_ERROR', 'fetch implementation unavailable');
  }

  // Program safety: never allow POST/DELETE/PUT through this transport for live calls
  const upper = String(method || 'GET').toUpperCase();
  if (upper !== 'GET') {
    throw new MexcE2ETransportError('MEXC_RUNTIME_BLOCKED', 'Only GET is allowed on E2E live transport');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  const started = Date.now();
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers,
      redirect: 'error',
      signal: controller.signal,
    });

    const reader = response.body?.getReader?.();
    let bodyText = '';
    const responseHeaders = Object.fromEntries(response.headers?.entries?.() || []);
    const contentLengthRaw = responseHeaders['content-length'] || responseHeaders['Content-Length'] || null;
    const contentLength = Number.parseInt(String(contentLengthRaw || ''), 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      if (reader) {
        try { reader.cancel(); } catch { /* ignore */ }
      }
      throw new MexcE2ETransportError('MEXC_RESPONSE_TOO_LARGE', 'Provider response exceeds bounded limit', {
        contentLength,
        contentLengthPresent: true,
        bodyByteCategory: categorizeBodyBytes(contentLength),
        limitBytes: maxBytes,
      });
    }

    let total = 0;
    if (reader) {
      const chunks = [];
      while (true) {
        let chunk;
        try {
          chunk = await reader.read();
        } catch {
          throw new MexcE2ETransportError('MEXC_RESPONSE_TRUNCATED', 'Provider response stream truncated', {
            bodyBytes: total,
            bodyByteCategory: categorizeBodyBytes(total),
            limitBytes: maxBytes,
            truncated: true,
          });
        }
        const { done, value } = chunk;
        if (done) break;
        total += value.byteLength || value.length || 0;
        if (total > maxBytes) {
          try { reader.cancel(); } catch { /* ignore */ }
          throw new MexcE2ETransportError('MEXC_RESPONSE_TOO_LARGE', 'Provider response exceeds bounded limit', {
            bodyBytes: total,
            bodyByteCategory: categorizeBodyBytes(total),
            limitBytes: maxBytes,
          });
        }
        chunks.push(Buffer.from(value));
      }
      bodyText = Buffer.concat(chunks).toString('utf8');
    } else {
      bodyText = await response.text();
      total = Buffer.byteLength(bodyText, 'utf8');
      if (total > maxBytes) {
        throw new MexcE2ETransportError('MEXC_RESPONSE_TOO_LARGE', 'Provider response exceeds bounded limit', {
          bodyBytes: total,
          bodyByteCategory: categorizeBodyBytes(total),
          limitBytes: maxBytes,
        });
      }
    }

    return {
      status: response.status,
      headers: responseHeaders,
      bodyText,
      bodyBytes: total || Buffer.byteLength(bodyText, 'utf8'),
      contentType: responseHeaders['content-type'] || responseHeaders['Content-Type'] || null,
      contentLength: Number.isFinite(contentLength) ? contentLength : null,
      contentLengthPresent: Boolean(contentLengthRaw),
      bodyByteCategory: categorizeBodyBytes(total || Buffer.byteLength(bodyText, 'utf8')),
      truncated: false,
      latencyMs: Date.now() - started,
      ok: response.status >= 200 && response.status < 300,
    };
  } catch (err) {
    if (err instanceof MexcE2ETransportError) throw err;
    if (err?.name === 'AbortError') {
      throw new MexcE2ETransportError('MEXC_TIMEOUT', 'Provider request timed out');
    }
    if (/redirect/i.test(String(err?.message || ''))) {
      throw new MexcE2ETransportError('MEXC_REDIRECT_BLOCKED', 'Provider redirect rejected');
    }
    throw new MexcE2ETransportError('MEXC_NETWORK_ERROR', 'Provider network error');
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}
