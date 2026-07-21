/**
 * MEXC Wallet currency/network response contract (streaming).
 *
 * Proven RCA (continuation run f1e9f055…):
 *   endpoint-specific response exceeded the 768 KiB decompressed processing bound.
 * That does NOT prove malformed JSON, missing SPOT_WITHDRAW_READ, invalid credentials,
 * provider unavailability, or the original first-run failure cause.
 *
 * Architecture:
 * - process the response incrementally via stream-json
 * - never construct the full currency/network array
 * - discard each item after structural validation
 * - retain only safe aggregate counters / telemetry
 */

import { Readable } from 'stream';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { parser: createJsonParser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray.js');
const { chain } = require('stream-chain');

/** @deprecated Legacy bound from the second controlled run; retained for telemetry mapping only. */
export const WALLET_CURRENCY_RESPONSE_MAX_BYTES = 768 * 1024;

/** Hard defensive wire/compressed ceiling for GET /api/v3/capital/config/getall only. */
export const WALLET_COMPRESSED_MAX_BYTES = 4 * 1024 * 1024;
/** Hard defensive decompressed JSON ceiling — not an allocation target. */
export const WALLET_DECOMPRESSED_MAX_BYTES = 16 * 1024 * 1024;
export const WALLET_MAX_CURRENCY_ITEMS = 20_000;
export const WALLET_MAX_NETWORK_ITEMS = 100_000;
export const WALLET_MAX_NESTING_DEPTH = 10;
export const WALLET_MAX_STRING_LENGTH = 64 * 1024;
export const WALLET_MAX_UNKNOWN_FIELD_DEPTH = 10;
export const WALLET_PARSER_TIMEOUT_MS = 5_000;

export const WALLET_CURRENCY_ERROR = Object.freeze({
  COMPRESSED_TOO_LARGE: 'MEXC_RESPONSE_COMPRESSED_TOO_LARGE',
  DECOMPRESSED_TOO_LARGE: 'MEXC_RESPONSE_DECOMPRESSED_TOO_LARGE',
  ITEM_LIMIT_EXCEEDED: 'MEXC_RESPONSE_ITEM_LIMIT_EXCEEDED',
  NESTING_LIMIT_EXCEEDED: 'MEXC_RESPONSE_NESTING_LIMIT_EXCEEDED',
  STRING_LIMIT_EXCEEDED: 'MEXC_RESPONSE_STRING_LIMIT_EXCEEDED',
  PARSE_TIMEOUT: 'MEXC_RESPONSE_PARSE_TIMEOUT',
  MALFORMED: 'MEXC_RESPONSE_MALFORMED',
  RESPONSE_TRUNCATED: 'MEXC_RESPONSE_TRUNCATED',
  WRONG_CONTENT_TYPE: 'MEXC_RESPONSE_WRONG_CONTENT_TYPE',
  PROVIDER_ERROR_ENVELOPE: 'MEXC_PROVIDER_ERROR_ENVELOPE',
  // Compatibility aliases used by older tests / prior run codes
  HTML_RESPONSE: 'MEXC_HTML_RESPONSE',
  CONTENT_TYPE_INVALID: 'MEXC_RESPONSE_WRONG_CONTENT_TYPE',
  JSON_INVALID: 'MEXC_RESPONSE_MALFORMED',
  TOP_LEVEL_INVALID: 'MEXC_WALLET_TOP_LEVEL_INVALID',
  ITEM_INVALID: 'MEXC_WALLET_ITEM_INVALID',
  NETWORK_LIST_INVALID: 'MEXC_WALLET_NETWORK_LIST_INVALID',
  NETWORK_ITEM_INVALID: 'MEXC_WALLET_NETWORK_ITEM_INVALID',
  PROVIDER_ERROR: 'MEXC_PROVIDER_ERROR_ENVELOPE',
  /** @deprecated Prefer DECOMPRESSED_TOO_LARGE */
  RESPONSE_TOO_LARGE: 'MEXC_RESPONSE_TOO_LARGE',
});

/** Domain-local Wallet processing failures — do not stop independent probes. */
export const WALLET_DOMAIN_LOCAL_ERROR_CODES = Object.freeze(new Set([
  WALLET_CURRENCY_ERROR.COMPRESSED_TOO_LARGE,
  WALLET_CURRENCY_ERROR.DECOMPRESSED_TOO_LARGE,
  WALLET_CURRENCY_ERROR.ITEM_LIMIT_EXCEEDED,
  WALLET_CURRENCY_ERROR.NESTING_LIMIT_EXCEEDED,
  WALLET_CURRENCY_ERROR.STRING_LIMIT_EXCEEDED,
  WALLET_CURRENCY_ERROR.PARSE_TIMEOUT,
  WALLET_CURRENCY_ERROR.WRONG_CONTENT_TYPE,
  WALLET_CURRENCY_ERROR.PROVIDER_ERROR_ENVELOPE,
  WALLET_CURRENCY_ERROR.TOP_LEVEL_INVALID,
  WALLET_CURRENCY_ERROR.ITEM_INVALID,
  WALLET_CURRENCY_ERROR.NETWORK_LIST_INVALID,
  WALLET_CURRENCY_ERROR.NETWORK_ITEM_INVALID,
  WALLET_CURRENCY_ERROR.HTML_RESPONSE,
  WALLET_CURRENCY_ERROR.RESPONSE_TOO_LARGE,
]));

export class WalletCurrencyConfigContractError extends Error {
  constructor(code, message, safe = {}) {
    super(message);
    this.name = 'WalletCurrencyConfigContractError';
    this.code = code;
    this.safe = safe;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function categorizeWalletBodyBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown';
  if (bytes < 1024 * 1024) return 'under_1MiB';
  if (bytes < 4 * 1024 * 1024) return '1_to_4MiB';
  if (bytes < 8 * 1024 * 1024) return '4_to_8MiB';
  if (bytes < 16 * 1024 * 1024) return '8_to_16MiB';
  return 'over_16MiB';
}

function categorizeItemCount(count) {
  if (!Number.isFinite(count) || count < 0) return 'unknown';
  if (count === 0) return 'zero';
  if (count < 10) return '1_to_9';
  if (count < 100) return '10_to_99';
  if (count < 1000) return '100_to_999';
  if (count < 10000) return '1000_to_9999';
  return '10000_plus';
}

function normalizeHeaderLookup(headers = {}) {
  const entries = Object.entries(headers || {}).map(([k, v]) => [String(k).toLowerCase(), v]);
  return Object.fromEntries(entries);
}

function looksLikeHtmlPrefix(chunkText) {
  const trimmed = String(chunkText || '').trimStart().slice(0, 256).toLowerCase();
  return trimmed.startsWith('<!doctype html')
    || trimmed.startsWith('<html')
    || trimmed.startsWith('<body')
    || trimmed.startsWith('<head');
}

function isOptionalString(value) {
  return value == null || typeof value === 'string';
}

function isOptionalBoolean(value) {
  return value == null || typeof value === 'boolean';
}

function isOptionalNumber(value) {
  return value == null || typeof value === 'number';
}

function assertBoundedString(value, fieldName, safe, { required = false } = {}) {
  if (value == null) {
    if (required) {
      throw new WalletCurrencyConfigContractError(
        WALLET_CURRENCY_ERROR.ITEM_INVALID,
        `Wallet ${fieldName} must be a string`,
        { ...safe, validationFailure: `${fieldName}.required`, abortLimit: 'schema' },
      );
    }
    return;
  }
  if (typeof value !== 'string') {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.ITEM_INVALID,
      `Wallet ${fieldName} must be a string`,
      { ...safe, validationFailure: `${fieldName}.type`, abortLimit: 'schema' },
    );
  }
  if (value.length > WALLET_MAX_STRING_LENGTH) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.STRING_LIMIT_EXCEEDED,
      'Wallet string field exceeded defensive length limit',
      {
        ...safe,
        validationFailure: `${fieldName}.length`,
        abortLimit: 'string_length',
      },
    );
  }
}

function measureNestingDepth(value, depth = 0) {
  if (depth > WALLET_MAX_NESTING_DEPTH) return depth;
  if (value == null || typeof value !== 'object') return depth;
  let max = depth;
  if (Array.isArray(value)) {
    for (const item of value) {
      max = Math.max(max, measureNestingDepth(item, depth + 1));
      if (max > WALLET_MAX_NESTING_DEPTH) return max;
    }
    return max;
  }
  for (const child of Object.values(value)) {
    max = Math.max(max, measureNestingDepth(child, depth + 1));
    if (max > WALLET_MAX_NESTING_DEPTH) return max;
  }
  return max;
}

function validateUnknownFieldDepth(value, depth, safe) {
  if (depth > WALLET_MAX_UNKNOWN_FIELD_DEPTH) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.NESTING_LIMIT_EXCEEDED,
      'Wallet unknown-field nesting exceeded defensive limit',
      { ...safe, validationFailure: 'unknown_field.depth', abortLimit: 'unknown_field_depth' },
    );
  }
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) validateUnknownFieldDepth(item, depth + 1, safe);
    return;
  }
  for (const child of Object.values(value)) {
    validateUnknownFieldDepth(child, depth + 1, safe);
  }
}

function validateNetworkItem(networkItem, itemIndex, networkIndex, safe) {
  if (!isPlainObject(networkItem)) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.NETWORK_ITEM_INVALID,
      'Wallet network entry must be an object',
      {
        ...safe,
        schemaPath: `[${itemIndex}].networkList[${networkIndex}]`,
        validationFailure: 'networkList.item_not_object',
        abortLimit: 'schema',
      },
    );
  }

  assertBoundedString(networkItem.name, 'network.name', safe);
  assertBoundedString(networkItem.Name, 'network.Name', safe);
  assertBoundedString(networkItem.network, 'network.network', safe);
  assertBoundedString(networkItem.netWork, 'network.netWork', safe);
  assertBoundedString(networkItem.contract, 'network.contract', safe);
  assertBoundedString(networkItem.depositTips, 'network.depositTips', safe);
  assertBoundedString(networkItem.withdrawTips, 'network.withdrawTips', safe);

  if (!isOptionalBoolean(networkItem.depositEnable) || !isOptionalBoolean(networkItem.withdrawEnable)) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.NETWORK_ITEM_INVALID,
      'Wallet network enable flags invalid',
      {
        ...safe,
        schemaPath: `[${itemIndex}].networkList[${networkIndex}].depositEnable|withdrawEnable`,
        validationFailure: 'networkList.enable_flags',
        abortLimit: 'schema',
      },
    );
  }
  if (
    !isOptionalNumber(networkItem.minConfirm)
    || !isOptionalNumber(networkItem.withdrawFee)
    || !isOptionalNumber(networkItem.withdrawMin)
    || !isOptionalNumber(networkItem.withdrawMax)
  ) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.NETWORK_ITEM_INVALID,
      'Wallet numeric limits invalid',
      {
        ...safe,
        schemaPath: `[${itemIndex}].networkList[${networkIndex}].limits`,
        validationFailure: 'networkList.numeric_variant',
        abortLimit: 'schema',
      },
    );
  }

  const known = new Set([
    'name', 'Name', 'network', 'netWork', 'depositEnable', 'withdrawEnable',
    'minConfirm', 'withdrawFee', 'withdrawMin', 'withdrawMax',
    'contract', 'depositTips', 'withdrawTips',
  ]);
  for (const [key, value] of Object.entries(networkItem)) {
    if (known.has(key)) continue;
    validateUnknownFieldDepth(value, 1, safe);
  }
}

function validateWalletItem(item, itemIndex, safe, counters) {
  if (!isPlainObject(item)) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.ITEM_INVALID,
      'Wallet item must be an object',
      {
        ...safe,
        schemaPath: `[${itemIndex}]`,
        validationFailure: 'wallet_item.not_object',
        abortLimit: 'schema',
      },
    );
  }

  if (measureNestingDepth(item) > WALLET_MAX_NESTING_DEPTH) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.NESTING_LIMIT_EXCEEDED,
      'Wallet item nesting exceeded defensive limit',
      { ...safe, validationFailure: 'wallet_item.nesting', abortLimit: 'nesting_depth' },
    );
  }

  // coin may be missing; when present must be a non-empty bounded string
  if (item.coin != null) {
    assertBoundedString(item.coin, 'coin', safe, { required: true });
    if (!String(item.coin).trim()) {
      throw new WalletCurrencyConfigContractError(
        WALLET_CURRENCY_ERROR.ITEM_INVALID,
        'Wallet coin must be a non-empty string',
        {
          ...safe,
          schemaPath: `[${itemIndex}].coin`,
          validationFailure: 'wallet_item.coin',
          abortLimit: 'schema',
        },
      );
    }
  }
  assertBoundedString(item.name, 'name', safe);
  assertBoundedString(item.Name, 'Name', safe);

  if (item.networkList != null && !Array.isArray(item.networkList)) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.NETWORK_LIST_INVALID,
      'Wallet networkList must be an array',
      {
        ...safe,
        schemaPath: `[${itemIndex}].networkList`,
        validationFailure: 'networkList.not_array',
        abortLimit: 'schema',
      },
    );
  }

  const networks = item.networkList || [];
  counters.networkItems += networks.length;
  if (counters.networkItems > WALLET_MAX_NETWORK_ITEMS) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.ITEM_LIMIT_EXCEEDED,
      'Wallet network item count exceeded defensive limit',
      {
        ...safe,
        validationFailure: 'networkList.count',
        abortLimit: 'network_items',
        networkItemCountCategory: categorizeItemCount(counters.networkItems),
      },
    );
  }

  for (const [networkIndex, networkItem] of networks.entries()) {
    validateNetworkItem(networkItem, itemIndex, networkIndex, safe);
  }

  const known = new Set(['coin', 'name', 'Name', 'networkList']);
  for (const [key, value] of Object.entries(item)) {
    if (known.has(key)) continue;
    validateUnknownFieldDepth(value, 1, safe);
  }
}

function buildSafeMeta({ status, headers, transportMeta = {} }) {
  const normalizedHeaders = normalizeHeaderLookup(headers);
  const contentType = normalizedHeaders['content-type'] || null;
  const contentEncoding = normalizedHeaders['content-encoding'] || null;
  const contentLengthRaw = normalizedHeaders['content-length'] || null;
  const contentLength = Number.parseInt(String(contentLengthRaw || ''), 10);
  const compressedBytes = transportMeta.compressedBytesRead
    ?? (Number.isFinite(contentLength) ? contentLength : null);
  const decompressedBytes = transportMeta.decompressedBytesProcessed ?? transportMeta.bodyBytes ?? null;
  return {
    httpStatus: status ?? null,
    contentType,
    contentEncoding,
    contentLengthPresent: Boolean(contentLengthRaw),
    contentLengthCategory: Number.isFinite(contentLength)
      ? categorizeWalletBodyBytes(contentLength)
      : 'unknown',
    compressedBytesRead: Number.isFinite(compressedBytes) ? compressedBytes : null,
    compressedByteCategory: Number.isFinite(compressedBytes)
      ? categorizeWalletBodyBytes(compressedBytes)
      : 'unknown',
    decompressedBytesProcessed: Number.isFinite(decompressedBytes) ? decompressedBytes : null,
    decompressedByteCategory: Number.isFinite(decompressedBytes)
      ? categorizeWalletBodyBytes(decompressedBytes)
      : 'unknown',
    // legacy aliases used by older callers/tests
    bodyBytes: Number.isFinite(decompressedBytes) ? decompressedBytes : null,
    bodyByteCategory: Number.isFinite(decompressedBytes)
      ? categorizeWalletBodyBytes(decompressedBytes)
      : 'unknown',
    topLevelType: 'unknown',
    itemCountCategory: null,
    networkItemCountCategory: null,
    parserCompleted: false,
    abortLimit: null,
    transportTruncated: Boolean(transportMeta.truncated),
    limitCategory: transportMeta.limitCategory || null,
    latencyMs: transportMeta.latencyMs ?? null,
  };
}

function assertContentType(safe, headers) {
  const contentType = String(safe.contentType || '').toLowerCase();
  if (contentType && !contentType.includes('application/json') && !contentType.includes('+json') && !contentType.includes('text/json')) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.WRONG_CONTENT_TYPE,
      'Wallet response content type invalid',
      { ...safe, validationFailure: 'content_type.invalid', abortLimit: 'content_type' },
    );
  }
  void headers;
}

function assertCompressedLimit(safe, headers) {
  const normalized = normalizeHeaderLookup(headers);
  const encoding = String(normalized['content-encoding'] || '').toLowerCase();
  const contentLength = Number.parseInt(String(normalized['content-length'] || ''), 10);
  const compressedLike = encoding.includes('gzip')
    || encoding.includes('br')
    || encoding.includes('deflate')
    || encoding.includes('compress');
  if (compressedLike && Number.isFinite(contentLength) && contentLength > WALLET_COMPRESSED_MAX_BYTES) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.COMPRESSED_TOO_LARGE,
      'Wallet compressed response exceeded defensive limit',
      {
        ...safe,
        compressedBytesRead: contentLength,
        compressedByteCategory: categorizeWalletBodyBytes(contentLength),
        validationFailure: 'compressed.too_large',
        abortLimit: 'compressed_bytes',
      },
    );
  }
  // When Content-Length is present without encoding, treat as early decompressed bound signal
  if (!compressedLike && Number.isFinite(contentLength) && contentLength > WALLET_DECOMPRESSED_MAX_BYTES) {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.DECOMPRESSED_TOO_LARGE,
      'Wallet decompressed response exceeded defensive limit',
      {
        ...safe,
        decompressedBytesProcessed: contentLength,
        decompressedByteCategory: categorizeWalletBodyBytes(contentLength),
        validationFailure: 'decompressed.content_length',
        abortLimit: 'decompressed_bytes',
      },
    );
  }
}

/**
 * Streaming parser entrypoint.
 * @param {object} opts
 * @param {number} [opts.status]
 * @param {object} [opts.headers]
 * @param {import('stream').Readable|AsyncIterable|Iterable|Buffer|string} opts.source
 * @param {object} [opts.transportMeta]
 * @param {() => void} [opts.onAbortStream] destroy/cancel underlying HTTP stream
 */
export async function parseWalletCurrencyConfigStream({
  status,
  headers = {},
  source,
  transportMeta = {},
  onAbortStream = null,
} = {}) {
  const { Transform } = await import('stream');
  const safe = buildSafeMeta({ status, headers, transportMeta });
  const abortStream = () => {
    try { onAbortStream?.(); } catch { /* ignore */ }
  };

  if (safe.transportTruncated) {
    abortStream();
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.RESPONSE_TRUNCATED,
      'Wallet response stream truncated',
      { ...safe, validationFailure: 'transport.truncated', abortLimit: 'truncated' },
    );
  }

  assertContentType(safe, headers);
  assertCompressedLimit(safe, headers);

  let readable;
  if (typeof source === 'string' || Buffer.isBuffer(source)) {
    const prefix = Buffer.isBuffer(source)
      ? source.subarray(0, 256).toString('utf8')
      : String(source).slice(0, 256);
    if (looksLikeHtmlPrefix(prefix)) {
      throw new WalletCurrencyConfigContractError(
        WALLET_CURRENCY_ERROR.HTML_RESPONSE,
        'Wallet response was HTML',
        { ...safe, validationFailure: 'content_type.html', abortLimit: 'content_type' },
      );
    }
    readable = Readable.from([Buffer.isBuffer(source) ? source : Buffer.from(String(source), 'utf8')]);
  } else if (source && typeof source.pipe === 'function') {
    readable = source;
  } else if (source && (Symbol.asyncIterator in Object(source) || Symbol.iterator in Object(source))) {
    readable = Readable.from(source);
  } else {
    throw new WalletCurrencyConfigContractError(
      WALLET_CURRENCY_ERROR.MALFORMED,
      'Wallet response source unavailable',
      { ...safe, validationFailure: 'source.missing', abortLimit: 'source' },
    );
  }

  let decompressedBytes = Number(transportMeta.decompressedBytesProcessed || 0);
  let firstByteAt = null;
  let htmlChecked = false;

  const limitTransform = new Transform({
    transform(chunk, _enc, cb) {
      try {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (!htmlChecked) {
          htmlChecked = true;
          if (looksLikeHtmlPrefix(buf.toString('utf8'))) {
            cb(new WalletCurrencyConfigContractError(
              WALLET_CURRENCY_ERROR.HTML_RESPONSE,
              'Wallet response was HTML',
              { ...safe, validationFailure: 'content_type.html', abortLimit: 'content_type' },
            ));
            return;
          }
        }
        if (firstByteAt == null) firstByteAt = Date.now();
        else if (Date.now() - firstByteAt > WALLET_PARSER_TIMEOUT_MS) {
          cb(new WalletCurrencyConfigContractError(
            WALLET_CURRENCY_ERROR.PARSE_TIMEOUT,
            'Wallet parser processing exceeded defensive time limit',
            { ...safe, validationFailure: 'parser.timeout', abortLimit: 'parser_time' },
          ));
          return;
        }
        decompressedBytes += buf.byteLength;
        safe.decompressedBytesProcessed = decompressedBytes;
        safe.decompressedByteCategory = categorizeWalletBodyBytes(decompressedBytes);
        safe.bodyBytes = decompressedBytes;
        safe.bodyByteCategory = safe.decompressedByteCategory;
        if (decompressedBytes > WALLET_DECOMPRESSED_MAX_BYTES) {
          cb(new WalletCurrencyConfigContractError(
            WALLET_CURRENCY_ERROR.DECOMPRESSED_TOO_LARGE,
            'Wallet decompressed response exceeded defensive limit',
            {
              ...safe,
              validationFailure: 'decompressed.too_large',
              abortLimit: 'decompressed_bytes',
            },
          ));
          return;
        }
        cb(null, buf);
      } catch (err) {
        cb(err);
      }
    },
  });

  const pipeline = chain([
    readable,
    limitTransform,
    createJsonParser(),
    streamArray(),
  ]);

  const counters = { currencyItems: 0, networkItems: 0 };
  let topLevelIsArray = false;

  const destroyAll = () => {
    abortStream();
    try { readable.destroy?.(); } catch { /* ignore */ }
    try { limitTransform.destroy?.(); } catch { /* ignore */ }
    try { pipeline.destroy?.(); } catch { /* ignore */ }
  };

  try {
    for await (const data of pipeline) {
      topLevelIsArray = true;
      safe.topLevelType = 'array';
      counters.currencyItems += 1;
      if (counters.currencyItems > WALLET_MAX_CURRENCY_ITEMS) {
        throw new WalletCurrencyConfigContractError(
          WALLET_CURRENCY_ERROR.ITEM_LIMIT_EXCEEDED,
          'Wallet currency item count exceeded defensive limit',
          {
            ...safe,
            itemCountCategory: categorizeItemCount(counters.currencyItems),
            validationFailure: 'currency.count',
            abortLimit: 'currency_items',
          },
        );
      }
      validateWalletItem(data.value, counters.currencyItems - 1, safe, counters);
      data.value = null;
    }
  } catch (err) {
    destroyAll();
    if (err instanceof WalletCurrencyConfigContractError) throw err;
    const message = String(err?.message || '');
    if (!topLevelIsArray && /array|Top-level|object|Unexpected|Parser/i.test(message)) {
      throw new WalletCurrencyConfigContractError(
        WALLET_CURRENCY_ERROR.TOP_LEVEL_INVALID,
        'Wallet response top level must be an array',
        {
          ...safe,
          topLevelType: 'other',
          validationFailure: 'top_level.not_array',
          abortLimit: 'schema',
        },
      );
    }
    if (/Unexpected|Malformed|Invalid|Parser/i.test(message)) {
      throw new WalletCurrencyConfigContractError(
        WALLET_CURRENCY_ERROR.MALFORMED,
        'Wallet response JSON malformed',
        { ...safe, validationFailure: 'json.malformed', abortLimit: 'malformed' },
      );
    }
    throw err;
  } finally {
    try { pipeline.destroy?.(); } catch { /* ignore */ }
  }

  safe.topLevelType = 'array';
  safe.itemCountCategory = categorizeItemCount(counters.currencyItems);
  safe.networkItemCountCategory = categorizeItemCount(counters.networkItems);
  safe.parserCompleted = true;
  safe.decompressedBytesProcessed = decompressedBytes;
  safe.decompressedByteCategory = categorizeWalletBodyBytes(decompressedBytes);
  safe.bodyBytes = decompressedBytes;
  safe.bodyByteCategory = safe.decompressedByteCategory;

  return {
    itemCountCategory: safe.itemCountCategory,
    networkItemCountCategory: safe.networkItemCountCategory,
    providerAvailability: 'available',
    safe,
  };
}

/**
 * Convenience wrapper for fixtures / bodyText.
 * Routes through the streaming parser — never retains a full parsed currency array.
 */
export async function parseWalletCurrencyConfigResponse({
  status,
  headers,
  bodyText,
  transportMeta = {},
} = {}) {
  const text = String(bodyText ?? '');
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) {
    if (Buffer.byteLength(text, 'utf8') <= 256 * 1024) {
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      if (json && isPlainObject(json) && (json.code != null || json.msg != null || json.message != null)) {
        const safe = buildSafeMeta({
          status,
          headers,
          transportMeta: {
            ...transportMeta,
            decompressedBytesProcessed: transportMeta.decompressedBytesProcessed
              ?? transportMeta.bodyBytes
              ?? Buffer.byteLength(text, 'utf8'),
          },
        });
        safe.topLevelType = 'object';
        throw new WalletCurrencyConfigContractError(
          WALLET_CURRENCY_ERROR.PROVIDER_ERROR_ENVELOPE,
          'Wallet response carried provider error envelope',
          {
            ...safe,
            providerCode: json.code ?? null,
            validationFailure: 'provider.error_envelope',
            abortLimit: 'provider_envelope',
          },
        );
      }
    }
  }

  return parseWalletCurrencyConfigStream({
    status,
    headers,
    source: text,
    transportMeta: {
      ...transportMeta,
      decompressedBytesProcessed: 0,
      bodyBytes: transportMeta.bodyBytes ?? Buffer.byteLength(text, 'utf8'),
    },
  });
}
