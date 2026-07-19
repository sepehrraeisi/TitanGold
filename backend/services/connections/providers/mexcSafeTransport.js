/**
 * CONNECTIONS-WP2A — hardened MEXC provider transport
 */

import { URL } from 'url';

export const MEXC_ALLOWED_HOSTS = Object.freeze(['api.mexc.com']);
export const MEXC_DEFAULT_TIMEOUT_MS = 8_000;
export const MEXC_MAX_RESPONSE_BYTES = 64 * 1024;

export class MexcTransportError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'MexcTransportError';
    this.code = code;
    this.extra = extra;
  }
}

function assertSafeMexcUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new MexcTransportError('MEXC_NETWORK_ERROR', 'Invalid provider URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new MexcTransportError('MEXC_NETWORK_ERROR', 'HTTPS required');
  }
  if (!MEXC_ALLOWED_HOSTS.includes(parsed.hostname)) {
    throw new MexcTransportError('MEXC_NETWORK_ERROR', 'Hostname not allowlisted');
  }
  if (parsed.username || parsed.password) {
    throw new MexcTransportError('MEXC_NETWORK_ERROR', 'Credentials in URL are forbidden');
  }
  return parsed;
}

/**
 * Default fetch-based transport. Injectable for tests.
 * Zero retries. No redirect following. Bounded timeout and response size.
 *
 * @param {object} opts
 * @param {string} opts.url
 * @param {string} [opts.method]
 * @param {Record<string,string>} [opts.headers]
 * @param {number} [opts.timeoutMs]
 * @param {AbortSignal} [opts.signal]
 * @param {typeof fetch} [opts.fetchImpl]
 */
export async function mexcSafeFetch({
  url,
  method = 'GET',
  headers = {},
  timeoutMs = MEXC_DEFAULT_TIMEOUT_MS,
  signal = null,
  fetchImpl = globalThis.fetch,
} = {}) {
  assertSafeMexcUrl(url);
  if (typeof fetchImpl !== 'function') {
    throw new MexcTransportError('MEXC_NETWORK_ERROR', 'fetch implementation unavailable');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const response = await fetchImpl(url, {
      method,
      headers,
      redirect: 'error',
      signal: controller.signal,
    });

    const reader = response.body?.getReader?.();
    let bodyText = '';
    if (reader) {
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength || value.length || 0;
        if (total > MEXC_MAX_RESPONSE_BYTES) {
          try { reader.cancel(); } catch { /* ignore */ }
          throw new MexcTransportError('MEXC_RESPONSE_INVALID', 'Provider response too large');
        }
        chunks.push(Buffer.from(value));
      }
      bodyText = Buffer.concat(chunks).toString('utf8');
    } else {
      bodyText = await response.text();
      if (Buffer.byteLength(bodyText, 'utf8') > MEXC_MAX_RESPONSE_BYTES) {
        throw new MexcTransportError('MEXC_RESPONSE_INVALID', 'Provider response too large');
      }
    }

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers?.entries?.() || []),
      bodyText,
    };
  } catch (err) {
    if (err instanceof MexcTransportError) throw err;
    if (err?.name === 'AbortError') {
      throw new MexcTransportError('MEXC_TIMEOUT', 'Provider request timed out');
    }
    throw new MexcTransportError('MEXC_NETWORK_ERROR', 'Provider network error');
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/**
 * Build absolute allowlisted URL for path + signed query.
 */
export function buildMexcHttpsUrl(pathname, signedQuery) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) {
    throw new MexcTransportError('MEXC_NETWORK_ERROR', 'Invalid pathname');
  }
  if (pathname.includes('://') || pathname.includes('\\') || pathname.includes('..')) {
    throw new MexcTransportError('MEXC_NETWORK_ERROR', 'User-controlled URL rejected');
  }
  const url = `https://api.mexc.com${pathname}${signedQuery ? `?${signedQuery}` : ''}`;
  assertSafeMexcUrl(url);
  return url;
}
