/**
 * Multi-host safe HTTPS transport for MEXC public + futures hosts.
 * Extends WP2A allowlist model without replacing mexcSafeTransport.js.
 *
 * Transport client: globalThis.fetch (Node undici-backed Fetch API).
 * Fetch automatically decompresses gzip/br/deflate responses.
 * Bytes read from response.body are therefore decoded/decompressed body bytes,
 * not raw encoded wire bytes. Content-Length (when present with Content-Encoding)
 * describes encoded transport length and must not be treated as decoded size.
 */

import { URL } from 'url';

export const MEXC_E2E_TRANSPORT_CLIENT = Object.freeze({
  kind: 'global_fetch',
  implementation: 'globalThis.fetch',
  /** Undici Fetch auto-decompresses; body stream yields decoded bytes. */
  autoDecompresses: true,
  exposesRawEncodedBytes: false,
});

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

function categorizeEncodedContentLength(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown';
  if (bytes < 1024 * 1024) return 'under_1MiB';
  if (bytes < 4 * 1024 * 1024) return '1_to_4MiB';
  if (bytes < 8 * 1024 * 1024) return '4_to_8MiB';
  if (bytes < 16 * 1024 * 1024) return '8_to_16MiB';
  return '16MiB_plus';
}

function sanitizeContentType(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const base = raw.split(';')[0].trim().toLowerCase();
  if (!base) return null;
  if (base.length > 128) return `${base.slice(0, 128)}…`;
  return base;
}

/**
 * Safe response metadata captured as soon as the Response object exists.
 * Survives body-stream destruction. Never includes signed URLs or credential headers.
 */
export function buildSafeHttpResponseMeta(response, responseHeaders = {}) {
  const headers = responseHeaders && typeof responseHeaders === 'object'
    ? responseHeaders
    : Object.fromEntries(response?.headers?.entries?.() || []);
  const status = Number(response?.status);
  const contentTypeRaw = headers['content-type'] || headers['Content-Type'] || null;
  const sanitizedContentType = sanitizeContentType(contentTypeRaw);
  const contentEncoding = String(
    headers['content-encoding'] || headers['Content-Encoding'] || '',
  ).toLowerCase() || null;
  const contentLengthRaw = headers['content-length'] || headers['Content-Length'] || null;
  const contentLength = Number.parseInt(String(contentLengthRaw || ''), 10);
  const contentLengthPresent = Boolean(contentLengthRaw);
  const httpOk = Number.isFinite(status) && status >= 200 && status < 300;
  const contentTypeAccepted = Boolean(
    sanitizedContentType
    && /application\/json|\+json|text\/json/i.test(sanitizedContentType),
  );

  return {
    receivedHeaders: true,
    status: Number.isFinite(status) ? status : null,
    statusCategory: !Number.isFinite(status)
      ? 'unknown'
      : status >= 200 && status < 300
        ? '2xx'
        : status >= 300 && status < 400
          ? '3xx'
          : status >= 400 && status < 500
            ? '4xx'
            : status >= 500
              ? '5xx'
              : 'other',
    httpOk,
    ok: httpOk,
    sanitizedContentType,
    contentTypeAccepted,
    contentEncoding,
    contentLengthPresent,
    encodedContentLength: Number.isFinite(contentLength) ? contentLength : null,
    encodedContentLengthCategory: Number.isFinite(contentLength)
      ? categorizeEncodedContentLength(contentLength)
      : null,
    // Fetch/Undici does not expose raw encoded wire bytes here.
    encodedBytesObserved: null,
    redirectRejected: false,
    tlsIntegrityPassed: true,
    transportClient: MEXC_E2E_TRANSPORT_CLIENT.kind,
  };
}

export class MexcE2ETransportError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'MexcE2ETransportError';
    this.code = code;
    this.extra = extra;
    /** @type {object|null} safe HTTP metadata retained after body failures */
    this.safeResponseMeta = extra.safeResponseMeta || null;
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
  let safeResponseMeta = null;
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers,
      redirect: 'error',
      signal: controller.signal,
    });

    const responseHeaders = Object.fromEntries(response.headers?.entries?.() || []);
    safeResponseMeta = buildSafeHttpResponseMeta(response, responseHeaders);

    const reader = response.body?.getReader?.();
    let bodyText = '';
    const contentLength = safeResponseMeta.encodedContentLength;
    // Content-Length is encoded size when compression is used; for this bounded
    // non-wallet fetch we only use it as an early abort hint when no encoding.
    if (
      !safeResponseMeta.contentEncoding
      && Number.isFinite(contentLength)
      && contentLength > maxBytes
    ) {
      if (reader) {
        try { reader.cancel(); } catch { /* ignore */ }
      }
      throw new MexcE2ETransportError('MEXC_RESPONSE_TOO_LARGE', 'Provider response exceeds bounded limit', {
        safeResponseMeta,
        contentLength,
        contentLengthPresent: true,
        decodedBodyBytesProcessed: null,
        decodedBodySizeCategory: categorizeBodyBytes(contentLength),
        bodyProcessingAbortLimit: 'decoded_body_bytes',
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
            safeResponseMeta,
            decodedBodyBytesProcessed: total,
            decodedBodySizeCategory: categorizeBodyBytes(total),
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
            safeResponseMeta,
            decodedBodyBytesProcessed: total,
            decodedBodySizeCategory: categorizeBodyBytes(total),
            bodyProcessingAbortLimit: 'decoded_body_bytes',
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
          safeResponseMeta,
          decodedBodyBytesProcessed: total,
          decodedBodySizeCategory: categorizeBodyBytes(total),
          bodyProcessingAbortLimit: 'decoded_body_bytes',
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
      decodedBodyBytesProcessed: total || Buffer.byteLength(bodyText, 'utf8'),
      decodedBodySizeCategory: categorizeBodyBytes(total || Buffer.byteLength(bodyText, 'utf8')),
      contentType: safeResponseMeta.sanitizedContentType,
      contentLength: safeResponseMeta.encodedContentLength,
      contentLengthPresent: safeResponseMeta.contentLengthPresent,
      encodedContentLengthCategory: safeResponseMeta.encodedContentLengthCategory,
      bodyByteCategory: categorizeBodyBytes(total || Buffer.byteLength(bodyText, 'utf8')),
      truncated: false,
      latencyMs: Date.now() - started,
      ok: response.status >= 200 && response.status < 300,
      safeResponseMeta,
      transportClient: MEXC_E2E_TRANSPORT_CLIENT.kind,
    };
  } catch (err) {
    if (err instanceof MexcE2ETransportError) {
      if (!err.safeResponseMeta && safeResponseMeta) {
        err.safeResponseMeta = safeResponseMeta;
        err.extra = { ...(err.extra || {}), safeResponseMeta };
      }
      throw err;
    }
    if (err?.name === 'AbortError') {
      throw new MexcE2ETransportError('MEXC_TIMEOUT', 'Provider request timed out', { safeResponseMeta });
    }
    if (/redirect/i.test(String(err?.message || ''))) {
      throw new MexcE2ETransportError('MEXC_REDIRECT_BLOCKED', 'Provider redirect rejected', {
        safeResponseMeta: safeResponseMeta
          ? { ...safeResponseMeta, redirectRejected: true }
          : { redirectRejected: true, receivedHeaders: false },
      });
    }
    throw new MexcE2ETransportError('MEXC_NETWORK_ERROR', 'Provider network error', { safeResponseMeta });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/**
 * Wallet-only streaming fetch: does NOT assemble a full body Buffer/string.
 * Returns a Node Readable of decoded body bytes plus abort handle and headers.
 *
 * Client: globalThis.fetch (Undici). Body chunks are decoded bytes.
 * Compressed/encoded wire bytes are NOT observed — do not label body counters
 * as compressedBytes and do not claim compressed limits from Content-Length alone.
 */
export async function mexcE2ESafeFetchWalletStream({
  url,
  method = 'GET',
  headers = {},
  timeoutMs = MEXC_E2E_DEFAULT_TIMEOUT_MS,
  signal = null,
  fetchImpl = globalThis.fetch,
  /** retained for API compatibility; encoded wire bytes are not observed via Fetch */
  compressedMaxBytes = 4 * 1024 * 1024,
  decodedMaxBytes = 16 * 1024 * 1024,
} = {}) {
  assertSafeUrl(url);
  if (typeof fetchImpl !== 'function') {
    throw new MexcE2ETransportError('MEXC_NETWORK_ERROR', 'fetch implementation unavailable');
  }
  if (String(method || 'GET').toUpperCase() !== 'GET') {
    throw new MexcE2ETransportError('MEXC_RUNTIME_BLOCKED', 'Only GET is allowed on E2E live transport');
  }

  const { Readable } = await import('stream');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  const started = Date.now();
  let safeResponseMeta = null;
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers,
      redirect: 'error',
      signal: controller.signal,
    });
    const responseHeaders = Object.fromEntries(response.headers?.entries?.() || []);
    safeResponseMeta = buildSafeHttpResponseMeta(response, responseHeaders);

    const reader = response.body?.getReader?.();
    let cancelled = false;
    const cancel = async () => {
      cancelled = true;
      try { await reader?.cancel?.(); } catch { /* ignore */ }
      try { controller.abort(); } catch { /* ignore */ }
    };

    async function* byteChunks() {
      let decodedBytes = 0;
      if (!reader) {
        const text = await response.text();
        const buf = Buffer.from(text, 'utf8');
        decodedBytes = buf.byteLength;
        if (decodedBytes > decodedMaxBytes) {
          throw new MexcE2ETransportError('MEXC_RESPONSE_TOO_LARGE', 'Provider decoded response exceeds bound', {
            safeResponseMeta,
            decodedBodyBytesProcessed: decodedBytes,
            decodedBodySizeCategory: categorizeBodyBytes(decodedBytes),
            bodyProcessingAbortLimit: 'decoded_body_bytes',
            // legacy alias — these are decoded bytes, not compressed
            bodyBytes: decodedBytes,
            limitBytes: decodedMaxBytes,
          });
        }
        yield buf;
        return;
      }
      while (!cancelled) {
        let chunk;
        try {
          chunk = await reader.read();
        } catch {
          throw new MexcE2ETransportError('MEXC_RESPONSE_TRUNCATED', 'Provider response stream truncated', {
            safeResponseMeta,
            truncated: true,
            decodedBodyBytesProcessed: decodedBytes,
            decodedBodySizeCategory: categorizeBodyBytes(decodedBytes),
          });
        }
        const { done, value } = chunk;
        if (done) break;
        const buf = Buffer.from(value);
        decodedBytes += buf.byteLength;
        if (decodedBytes > decodedMaxBytes) {
          try { await reader.cancel?.(); } catch { /* ignore */ }
          throw new MexcE2ETransportError('MEXC_RESPONSE_TOO_LARGE', 'Provider decoded response exceeds bound', {
            safeResponseMeta,
            decodedBodyBytesProcessed: decodedBytes,
            decodedBodySizeCategory: categorizeBodyBytes(decodedBytes),
            bodyProcessingAbortLimit: 'decoded_body_bytes',
            bodyBytes: decodedBytes,
            limitBytes: decodedMaxBytes,
          });
        }
        yield buf;
      }
    }

    return {
      status: response.status,
      headers: responseHeaders,
      contentType: safeResponseMeta.sanitizedContentType,
      contentLength: safeResponseMeta.encodedContentLength,
      contentLengthPresent: safeResponseMeta.contentLengthPresent,
      contentEncoding: safeResponseMeta.contentEncoding,
      encodedContentLengthCategory: safeResponseMeta.encodedContentLengthCategory,
      encodedBytesObserved: null,
      safeResponseMeta,
      transportClient: MEXC_E2E_TRANSPORT_CLIENT.kind,
      stream: Readable.from(byteChunks()),
      cancel,
      latencyMs: Date.now() - started,
      ok: response.status >= 200 && response.status < 300,
      bodyText: null,
      // documented: stream yields decoded body bytes under Fetch auto-decompress
      streamByteSemantics: 'decoded_body_bytes',
      compressedMaxBytes,
      decodedMaxBytes,
    };
  } catch (err) {
    if (err instanceof MexcE2ETransportError) {
      if (!err.safeResponseMeta && safeResponseMeta) {
        err.safeResponseMeta = safeResponseMeta;
        err.extra = { ...(err.extra || {}), safeResponseMeta };
      }
      throw err;
    }
    if (err?.name === 'AbortError') {
      throw new MexcE2ETransportError('MEXC_TIMEOUT', 'Provider request timed out', { safeResponseMeta });
    }
    if (/redirect/i.test(String(err?.message || ''))) {
      throw new MexcE2ETransportError('MEXC_REDIRECT_BLOCKED', 'Provider redirect rejected', {
        safeResponseMeta: safeResponseMeta
          ? { ...safeResponseMeta, redirectRejected: true }
          : { redirectRejected: true, receivedHeaders: false },
      });
    }
    throw new MexcE2ETransportError('MEXC_NETWORK_ERROR', 'Provider network error', { safeResponseMeta });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}
