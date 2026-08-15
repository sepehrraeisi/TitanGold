/**
 * Artemis B10 — TitanGold-owned strict deterministic JSON canonicalization.
 * Format id: titangold-json-c14n-1 (NOT claimed as RFC 8785/JCS).
 * Pure helpers. No DB / network / provider I/O.
 */

import { createHash } from 'node:crypto';
import { MAX_DECISION_UTF8_BYTES } from '../contracts/artemisDecisionContract.js';

export { MAX_DECISION_UTF8_BYTES };

export const CANONICALIZATION_VERSION = 'titangold-json-c14n-1';

export class CanonicalizationError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'CanonicalizationError';
    this.code = code;
    Object.assign(this, extra);
  }
}

function fail(code, message, extra = {}) {
  throw new CanonicalizationError(code, message, extra);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function assertNoSymbolKeys(value, path) {
  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length) {
    fail('UNSUPPORTED_SYMBOL_KEY', `symbol-keyed properties are rejected at ${path}`);
  }
}

function assertNoAccessors(value, path) {
  for (const key of Object.getOwnPropertyNames(value)) {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (!desc) continue;
    if (typeof desc.get === 'function' || typeof desc.set === 'function') {
      fail('UNSUPPORTED_ACCESSOR', `accessor properties are rejected at ${path}.${key}`);
    }
  }
}

function assertNoSilentNonEnumerable(value, path) {
  for (const key of Object.getOwnPropertyNames(value)) {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (!desc) continue;
    if (desc.enumerable === false && Object.prototype.hasOwnProperty.call(desc, 'value')) {
      fail(
        'UNSUPPORTED_NON_ENUMERABLE',
        `non-enumerable own data properties are rejected at ${path}.${key}`,
      );
    }
  }
}

function assertArrayOwnProperties(value, path) {
  assertNoSymbolKeys(value, path);
  assertNoAccessors(value, path);
  const names = Object.getOwnPropertyNames(value);
  for (const key of names) {
    if (key === 'length') continue;
    if (/^(0|[1-9][0-9]*)$/.test(key)) {
      const index = Number(key);
      if (index >= 0 && index < value.length) continue;
    }
    fail('UNSUPPORTED_ARRAY_PROPERTY', `unsupported array own property rejected at ${path}.${key}`);
  }
}

function normalizeNumber(value, path) {
  if (typeof value !== 'number') {
    fail('UNSUPPORTED_TYPE', `expected number at ${path}`);
  }
  if (Number.isNaN(value)) fail('UNSUPPORTED_NAN', `NaN rejected at ${path}`);
  if (!Number.isFinite(value)) fail('UNSUPPORTED_INFINITY', `Infinity rejected at ${path}`);
  return Object.is(value, -0) ? 0 : value;
}

/**
 * Strict recursive normalize into JSON-safe null-prototype bags / arrays.
 * Active-stack cycle detection: shared non-cyclic refs allowed.
 * @param {unknown} value
 * @param {string} [path]
 * @param {WeakSet<object>} [active]
 * @returns {unknown}
 */
export function strictNormalize(value, path = '$', active = new WeakSet()) {
  if (value === null) return null;

  const t = typeof value;
  if (t === 'undefined') fail('UNSUPPORTED_UNDEFINED', `undefined rejected at ${path}`);
  if (t === 'boolean') return value;
  if (t === 'string') return value;
  if (t === 'number') return normalizeNumber(value, path);
  if (t === 'bigint') fail('UNSUPPORTED_BIGINT', `BigInt rejected at ${path}`);
  if (t === 'function') fail('UNSUPPORTED_FUNCTION', `function rejected at ${path}`);
  if (t === 'symbol') fail('UNSUPPORTED_SYMBOL', `symbol rejected at ${path}`);

  if (t !== 'object') {
    fail('UNSUPPORTED_TYPE', `unsupported typeof ${t} at ${path}`);
  }

  if (value instanceof Date) fail('UNSUPPORTED_DATE', `Date rejected at ${path}`);
  if (Buffer.isBuffer(value)) fail('UNSUPPORTED_BUFFER', `Buffer rejected at ${path}`);
  if (ArrayBuffer.isView(value)) {
    fail('UNSUPPORTED_TYPED_ARRAY', `TypedArray/ArrayBuffer view rejected at ${path}`);
  }
  if (value instanceof Map) fail('UNSUPPORTED_MAP', `Map rejected at ${path}`);
  if (value instanceof Set) fail('UNSUPPORTED_SET', `Set rejected at ${path}`);
  if (value instanceof RegExp) fail('UNSUPPORTED_REGEXP', `RegExp rejected at ${path}`);

  if (active.has(value)) {
    fail('CIRCULAR_REFERENCE', `circular reference rejected at ${path}`);
  }
  active.add(value);

  try {
    if (Array.isArray(value)) {
      assertArrayOwnProperties(value, path);
      const out = [];
      for (let i = 0; i < value.length; i += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, i)) {
          fail('UNSUPPORTED_SPARSE_ARRAY', `sparse array / hole rejected at ${path}[${i}]`);
        }
        out.push(strictNormalize(value[i], `${path}[${i}]`, active));
      }
      return out;
    }

    if (!isPlainObject(value)) {
      fail('UNSUPPORTED_OBJECT', `non-plain object rejected at ${path}`);
    }

    assertNoSymbolKeys(value, path);
    assertNoAccessors(value, path);
    assertNoSilentNonEnumerable(value, path);

    const out = Object.create(null);
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      out[key] = strictNormalize(value[key], `${path}.${key}`, active);
    }
    return out;
  } finally {
    active.delete(value);
  }
}

/**
 * Deterministic JSON text emission from normalized values.
 * Object keys are emitted in lexicographic Object.keys().sort() order via
 * JSON.stringify(key) + ":" + serialized value — avoids prototype/re-enumeration hazards.
 * @param {unknown} value already-normalized
 * @returns {string}
 */
export function serializeCanonical(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') return JSON.stringify(value);
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeCanonical(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const parts = keys.map((key) => `${JSON.stringify(key)}:${serializeCanonical(value[key])}`);
    return `{${parts.join(',')}}`;
  }
  fail('UNSUPPORTED_TYPE', `cannot serialize typeof ${t}`);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalizeToJsonString(value) {
  return serializeCanonical(strictNormalize(value));
}

/**
 * @param {object} decision
 */
export function buildCanonicalDecisionPayload(decision) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    fail('INVALID_DECISION', 'decision must be a plain object');
  }
  if (!isPlainObject(decision)) {
    fail('UNSUPPORTED_OBJECT', 'decision must be a plain object');
  }

  const normalized = strictNormalize(decision);
  const canonicalUtf8 = serializeCanonical(normalized);
  // JSON.parse preserves "__proto__" as an own data property (no Object.prototype pollution).
  const canonicalObject = JSON.parse(canonicalUtf8);
  const payloadBytes = Buffer.byteLength(canonicalUtf8, 'utf8');
  const payloadSha256 = createHash('sha256').update(canonicalUtf8, 'utf8').digest('hex');

  return {
    canonicalizationVersion: CANONICALIZATION_VERSION,
    canonicalObject,
    canonicalUtf8,
    payloadBytes,
    payloadSha256,
  };
}

export function isWithinDecisionByteLimit(payloadBytes) {
  return Number.isInteger(payloadBytes) && payloadBytes > 0 && payloadBytes <= MAX_DECISION_UTF8_BYTES;
}

export function isSupportedCanonicalizationVersion(version) {
  return version === CANONICALIZATION_VERSION;
}

export default {
  CANONICALIZATION_VERSION,
  CanonicalizationError,
  strictNormalize,
  serializeCanonical,
  canonicalizeToJsonString,
  buildCanonicalDecisionPayload,
  isWithinDecisionByteLimit,
  isSupportedCanonicalizationVersion,
  MAX_DECISION_UTF8_BYTES,
};
