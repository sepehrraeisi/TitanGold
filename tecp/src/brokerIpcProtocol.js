/**
 * TECP-DLP-012 — IPC framing, canonical encoding, and Ed25519 helpers.
 * TEST_ONLY / NON_OPERATIONAL. No import-time side effects. No privileged trust roots.
 */

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export const PROTOCOL_VERSION = 1;
export const PROTOCOL_KIND = 'TECP_DLP012_BROKER_IPC_V1';
export const TICKET_VERSION = 1;
export const TICKET_ALG = 'Ed25519';
export const MAX_FRAME_BYTES = 64 * 1024;
export const MAX_JSON_DEPTH = 8;
export const MAX_REQUEST_SKEW_MS = 60_000;
/**
 * TEST_ONLY bound: a verified Authority assertion whose signed ts lags the Writer's
 * projected Authority clock by more than this is treated as delayed/stale delivery.
 * Distinguishes Authority signing time from Writer receipt time.
 * Wall-clock assist is disposable-only; same-UID wall manipulation remains NOT_SEALED.
 */
export const MAX_AUTHORITY_ASSERTION_DELIVERY_SKEW_MS = 100;

export const MSG = Object.freeze({
  MINT_TICKET_REQ: 'MINT_TICKET_REQ',
  MINT_TICKET_RES: 'MINT_TICKET_RES',
  WRITE_REQ: 'WRITE_REQ',
  WRITE_RES: 'WRITE_RES',
  TIP_CHALLENGE: 'TIP_CHALLENGE',
  TIP_ASSERTION: 'TIP_ASSERTION',
  TIP_UPDATE: 'TIP_UPDATE',
  // Authority-enforced mutation fence (disposable tip authority).
  // LINEARIZATION_POINT = FENCE_GRANT issuance; tip/revocation frozen until COMPLETE/ABORT/timeout.
  FENCE_ACQUIRE_REQ: 'FENCE_ACQUIRE_REQ',
  FENCE_GRANT: 'FENCE_GRANT',
  // Live grant confirmation (necessary, never sufficient alone for mutation).
  FENCE_CONFIRM_REQ: 'FENCE_CONFIRM_REQ',
  FENCE_CONFIRM_ACK: 'FENCE_CONFIRM_ACK',
  // One-shot execute permit at the mutation-authorization boundary.
  // TICKET_AUTHZ_LINEARIZATION = FENCE_EXECUTE_ACK.ts (Authority signing time).
  // TICKET_SIDE_EFFECT_LINEARIZATION = Writer projected Authority time at mutation
  // decision (last verified Authority ts + local wall elapsed since that verify).
  // Moments are distinct: Authority signing ≠ transmission ≠ receipt ≠ decision ≠ mutate.
  // A delayed TIP_ASSERTION whose signed ts is still ≤ exp but arrives after projected
  // time > exp MUST DENY (stale delivery is not current time evidence).
  FENCE_EXECUTE_REQ: 'FENCE_EXECUTE_REQ',
  FENCE_EXECUTE_ACK: 'FENCE_EXECUTE_ACK',
  FENCE_COMPLETE_REQ: 'FENCE_COMPLETE_REQ',
  FENCE_COMPLETE_ACK: 'FENCE_COMPLETE_ACK',
  FENCE_DENY: 'FENCE_DENY',
  ERROR: 'ERROR',
});

/** Disposable Authority fence lifecycle states (TEST_ONLY). */
export const FENCE_STATES = Object.freeze({
  GRANT_ISSUED: 'GRANT_ISSUED',
  CONFIRMED: 'CONFIRMED',
  MUTATION_POSSIBLE: 'MUTATION_POSSIBLE',
  COMPLETED: 'COMPLETED',
  ABORTED: 'ABORTED',
  UNKNOWN_POISONED: 'UNKNOWN_POISONED',
  WRITER_TERMINATED: 'WRITER_TERMINATED',
});

export const DLP012_SLICE_ID =
  'TECP-DLP-012-DISPOSABLE-ISOLATED-AUTHORIZATION-WRITER-BROKER-PROOF';
export const DLP012_NATIVE_OPERATION =
  'CREATE_AUTHORIZED_FIVE_PATH_DISPOSABLE_ISOLATED_BROKER_PROOF';
export const DLP012_REPOSITORY_ID = 'sepehrraeisi/TitanGold';
export const DLP012_AUTHORIZED_FILE_SCOPE = Object.freeze([
  'tecp/src/isolatedAuthorizationBroker.js',
  'tecp/src/brokerIpcProtocol.js',
  'tecp/src/isolatedWriteExecutor.js',
  'tecp/test/isolatedAuthorizationBroker.test.js',
  'tecp/test/disposableIsolatedBrokerHarness.js',
]);

const TICKET_FIELD_ORDER = Object.freeze([
  'alg',
  'aud',
  'exp',
  'iat',
  'iss',
  'jti',
  'kid',
  'mutContentSha',
  'mutPath',
  'nbf',
  'op',
  'ou',
  'paths',
  'requestId',
  'rule02Digest',
  'sliceId',
  'tipSha',
  'trustEpoch',
  'v',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

export function sha256Hex(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

export function generateEd25519KeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return Object.freeze({
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    algorithm: TICKET_ALG,
  });
}

export function randomId(bytes = 16) {
  return randomBytes(bytes).toString('hex');
}

export function stableScope(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return null;
  const out = [];
  for (const p of paths) {
    if (!isNonEmptyString(p)) return null;
    out.push(p);
  }
  out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (let i = 1; i < out.length; i += 1) {
    if (out[i] === out[i - 1]) return null;
  }
  return Object.freeze(out);
}

export function scopesEqual(a, b) {
  const sa = stableScope(a);
  const sb = stableScope(b);
  if (!sa || !sb || sa.length !== sb.length) return false;
  for (let i = 0; i < sa.length; i += 1) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

/**
 * Deterministic canonical JSON profile (sorted object keys, no insignificant
 * whitespace, finite numbers only, no __proto__). Not full RFC 8785; tested.
 */
export function canonicalJson(value) {
  return canonicalize(value, 0);
}

function canonicalize(value, depth) {
  if (depth > MAX_JSON_DEPTH) throw new TypeError('JSON_DEPTH_EXCEEDED');
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0) || !Number.isSafeInteger(value)) {
      throw new TypeError('NONCANONICAL_NUMBER');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry, depth + 1)).join(',')}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new TypeError('FORBIDDEN_KEY');
      }
    }
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], depth + 1)}`).join(',')}}`;
  }
  throw new TypeError('UNSUPPORTED_JSON_TYPE');
}

/**
 * Parse JSON with duplicate-key rejection before materializing authority objects.
 * Uses a constrained recursive descent over the UTF-8 string (not JSON.parse alone).
 */
export function parseStrictJson(text) {
  if (typeof text !== 'string') throw new TypeError('JSON_TEXT_REQUIRED');
  if (text.length > MAX_FRAME_BYTES) throw new TypeError('JSON_TOO_LARGE');
  // Validate UTF-8 round-trip (reject lone surrogates via Buffer)
  const buf = Buffer.from(text, 'utf8');
  if (buf.toString('utf8') !== text) throw new TypeError('INVALID_UTF8');
  let i = 0;
  function skipWs() {
    while (i < text.length && (text[i] === ' ' || text[i] === '\n' || text[i] === '\r' || text[i] === '\t')) i += 1;
  }
  function parseValue(depth) {
    if (depth > MAX_JSON_DEPTH) throw new TypeError('JSON_DEPTH_EXCEEDED');
    skipWs();
    if (i >= text.length) throw new TypeError('UNEXPECTED_EOF');
    const c = text[i];
    if (c === '{') return parseObject(depth);
    if (c === '[') return parseArray(depth);
    if (c === '"') return parseString();
    if (c === 't') return parseLiteral('true', true);
    if (c === 'f') return parseLiteral('false', false);
    if (c === 'n') return parseLiteral('null', null);
    if (c === '-' || (c >= '0' && c <= '9')) return parseNumber();
    throw new TypeError('UNEXPECTED_TOKEN');
  }
  function parseLiteral(lit, value) {
    if (text.slice(i, i + lit.length) !== lit) throw new TypeError('BAD_LITERAL');
    i += lit.length;
    return value;
  }
  function parseNumber() {
    const start = i;
    if (text[i] === '-') i += 1;
    if (text[i] === '0') {
      i += 1;
    } else {
      if (!(text[i] >= '1' && text[i] <= '9')) throw new TypeError('BAD_NUMBER');
      while (text[i] >= '0' && text[i] <= '9') i += 1;
    }
    if (text[i] === '.' || text[i] === 'e' || text[i] === 'E') {
      throw new TypeError('NONCANONICAL_NUMBER');
    }
    const raw = text.slice(start, i);
    const n = Number(raw);
    if (!Number.isSafeInteger(n)) throw new TypeError('NONCANONICAL_NUMBER');
    return n;
  }
  function parseString() {
    if (text[i] !== '"') throw new TypeError('BAD_STRING');
    i += 1;
    let out = '';
    while (i < text.length) {
      const c = text[i];
      if (c === '"') {
        i += 1;
        return out;
      }
      if (c === '\\') {
        i += 1;
        const e = text[i];
        const map = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
        if (e === 'u') {
          const hex = text.slice(i + 1, i + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new TypeError('BAD_UNICODE');
          out += String.fromCharCode(parseInt(hex, 16));
          i += 5;
          continue;
        }
        if (!(e in map)) throw new TypeError('BAD_ESCAPE');
        out += map[e];
        i += 1;
        continue;
      }
      if (c.charCodeAt(0) < 0x20) throw new TypeError('CONTROL_IN_STRING');
      out += c;
      i += 1;
    }
    throw new TypeError('UNTERMINATED_STRING');
  }
  function parseArray(depth) {
    i += 1;
    skipWs();
    const arr = [];
    if (text[i] === ']') {
      i += 1;
      return arr;
    }
    for (;;) {
      arr.push(parseValue(depth + 1));
      skipWs();
      if (text[i] === ',') {
        i += 1;
        continue;
      }
      if (text[i] === ']') {
        i += 1;
        return arr;
      }
      throw new TypeError('BAD_ARRAY');
    }
  }
  function parseObject(depth) {
    i += 1;
    skipWs();
    const obj = Object.create(null);
    const seen = new Set();
    if (text[i] === '}') {
      i += 1;
      return obj;
    }
    for (;;) {
      skipWs();
      const key = parseString();
      if (seen.has(key)) throw new TypeError('DUPLICATE_JSON_KEY');
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new TypeError('FORBIDDEN_KEY');
      }
      seen.add(key);
      skipWs();
      if (text[i] !== ':') throw new TypeError('EXPECTED_COLON');
      i += 1;
      obj[key] = parseValue(depth + 1);
      skipWs();
      if (text[i] === ',') {
        i += 1;
        continue;
      }
      if (text[i] === '}') {
        i += 1;
        return obj;
      }
      throw new TypeError('BAD_OBJECT');
    }
  }
  const value = parseValue(0);
  skipWs();
  if (i !== text.length) throw new TypeError('TRAILING_GARBAGE');
  return value;
}

function stripUndefined(value, depth = 0) {
  if (depth > MAX_JSON_DEPTH) throw new TypeError('JSON_DEPTH_EXCEEDED');
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (entry === undefined) throw new TypeError('UNDEFINED_ARRAY_ENTRY');
      return stripUndefined(entry, depth + 1);
    });
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value)) {
      if (value[key] === undefined) continue;
      out[key] = stripUndefined(value[key], depth + 1);
    }
    return out;
  }
  // Reject branded / class instances in IPC frames — only plain JSON trees.
  throw new TypeError('UNSUPPORTED_JSON_TYPE');
}

export function encodeFrame(obj) {
  const cleaned = stripUndefined(obj);
  const body = Buffer.from(canonicalJson(cleaned), 'utf8');
  if (body.length > MAX_FRAME_BYTES) throw new TypeError('FRAME_TOO_LARGE');
  const header = Buffer.alloc(4);
  header.writeUInt32BE(body.length, 0);
  return Buffer.concat([header, body]);
}

export function tryDecodeFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (buffer.length - offset >= 4) {
    const len = buffer.readUInt32BE(offset);
    if (len > MAX_FRAME_BYTES) throw new TypeError('FRAME_TOO_LARGE');
    if (buffer.length - offset - 4 < len) break;
    const body = buffer.subarray(offset + 4, offset + 4 + len).toString('utf8');
    frames.push(parseStrictJson(body));
    offset += 4 + len;
  }
  return { frames, rest: buffer.subarray(offset) };
}

export function orderedTicketClaims(claims) {
  const out = {};
  for (const key of TICKET_FIELD_ORDER) {
    if (Object.prototype.hasOwnProperty.call(claims, key)) out[key] = claims[key];
  }
  return out;
}

export function ticketSigningPayload(claims) {
  return `TECP_DLP012_TICKET_V1\n${canonicalJson(orderedTicketClaims(claims))}`;
}

export function signEd25519(privateKeyPem, payloadUtf8) {
  const key = createPrivateKey(privateKeyPem);
  return sign(null, Buffer.from(payloadUtf8, 'utf8'), key).toString('base64url');
}

export function verifyEd25519(publicKeyPem, payloadUtf8, signatureB64url) {
  if (!isNonEmptyString(signatureB64url)) return false;
  let sig;
  try {
    sig = Buffer.from(signatureB64url, 'base64url');
  } catch {
    return false;
  }
  try {
    const key = createPublicKey(publicKeyPem);
    return verify(null, Buffer.from(payloadUtf8, 'utf8'), key, sig);
  } catch {
    return false;
  }
}

export function safeEqualHex(a, b) {
  if (!isNonEmptyString(a) || !isNonEmptyString(b)) return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function assertAllowlistedMessage(msg, allowedTypes) {
  if (!isPlainObject(msg) || msg.v !== PROTOCOL_VERSION || msg.kind !== PROTOCOL_KIND) {
    throw new TypeError('BAD_PROTOCOL_ENVELOPE');
  }
  if (!allowedTypes.includes(msg.type)) throw new TypeError('UNEXPECTED_MESSAGE_TYPE');
  return msg;
}
