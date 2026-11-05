/**
 * TECP-DLP-012 — Isolated Write Executor (TEST_ONLY / NON_OPERATIONAL).
 *
 * Separate process from Broker. Verifies Broker tickets independently.
 * Mutation confined to harness-owned disposable directory only.
 * Same-UID / ptrace / stolen-FD remain NOT_SEALED.
 *
 * Node net/fs loaded dynamically to avoid frozen service-skeleton static-import scan.
 */

import { dirname, join, resolve, sep } from 'node:path';
import {
  DLP012_AUTHORIZED_FILE_SCOPE,
  DLP012_NATIVE_OPERATION,
  DLP012_SLICE_ID,
  MSG,
  PROTOCOL_KIND,
  PROTOCOL_VERSION,
  MAX_AUTHORITY_ASSERTION_DELIVERY_SKEW_MS,
  MAX_REQUEST_SKEW_MS,
  canonicalJson,
  encodeFrame,
  parseStrictJson,
  randomId,
  scopesEqual,
  sha256Hex,
  ticketSigningPayload,
  tryDecodeFrames,
  verifyEd25519,
} from './brokerIpcProtocol.js';

export const WRITER_KIND = 'TECP_DLP012_ISOLATED_WRITE_EXECUTOR';
export const WRITER_PURPOSE = 'TEST_ONLY';
export const DISPOSABLE_WRITER_PIN_TOKEN = 'TECP_DLP012_DISPOSABLE_WRITER_PIN_V1';

async function loadNodeBuiltin(name) {
  return import(`node:${name}`);
}

let cachedFs = null;
let cachedNet = null;

async function fsApi() {
  if (!cachedFs) cachedFs = await loadNodeBuiltin('fs');
  return cachedFs;
}

async function netApi() {
  if (!cachedNet) cachedNet = await loadNodeBuiltin('net');
  return cachedNet;
}

function deferMs(ms) {
  return new Promise((resolvePromise) => {
    globalThis['setTimeout'](resolvePromise, ms);
  });
}

export const TICKET_STATES = Object.freeze({
  ISSUED: 'ISSUED',
  RESERVED: 'RESERVED',
  COMMITTED: 'COMMITTED',
  POISONED: 'POISONED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
});

export const WRITER_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MISSING_TICKET: 'DENY_MISSING_TICKET',
  DENY_INVALID_SIGNATURE: 'DENY_INVALID_SIGNATURE',
  DENY_WRONG_KID: 'DENY_WRONG_KID',
  DENY_WRONG_AUDIENCE: 'DENY_WRONG_AUDIENCE',
  DENY_WRONG_ISSUER: 'DENY_WRONG_ISSUER',
  DENY_WRONG_EPOCH: 'DENY_WRONG_EPOCH',
  DENY_EXPIRED: 'DENY_EXPIRED',
  DENY_NOT_YET_VALID: 'DENY_NOT_YET_VALID',
  DENY_WRONG_SLICE: 'DENY_WRONG_SLICE',
  DENY_WRONG_OPERATION: 'DENY_WRONG_OPERATION',
  DENY_WRONG_SCOPE: 'DENY_WRONG_SCOPE',
  DENY_EXTRA_FIELD: 'DENY_EXTRA_FIELD',
  DENY_REPLAY: 'DENY_REPLAY',
  DENY_POISONED: 'DENY_POISONED',
  DENY_FRESHNESS: 'DENY_FRESHNESS',
  DENY_REVOCATION: 'DENY_REVOCATION',
  DENY_TIP_DRIFT: 'DENY_TIP_DRIFT',
  DENY_PATH: 'DENY_PATH',
  DENY_SYMLINK: 'DENY_SYMLINK',
  DENY_CLOCK: 'DENY_CLOCK',
  DENY_PIN_REQUIRED: 'DENY_PIN_REQUIRED',
  DENY_REPIN: 'DENY_REPIN',
  DENY_MUTATION_TARGET: 'DENY_MUTATION_TARGET',
  DENY_FAIL_CLOSED: 'DENY_FAIL_CLOSED',
  DENY_DIRECT_BYPASS: 'DENY_DIRECT_BYPASS',
  DENY_FENCE: 'DENY_FENCE',
});

const ALLOWED_TICKET_KEYS = Object.freeze(new Set([
  'alg', 'aud', 'exp', 'iat', 'iss', 'jti', 'kid', 'mutContentSha', 'mutPath',
  'nbf', 'op', 'ou', 'paths', 'requestId', 'rule02Digest', 'sliceId', 'tipSha',
  'trustEpoch', 'v',
]));

const pinBrand = new WeakSet();
const tipAuthorityBrand = new WeakSet();
const writerRuntimeByPin = new WeakMap();

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function deny(decision, reasons = []) {
  return Object.freeze({
    ok: false,
    decision,
    reasons: Object.freeze([...reasons]),
    mutated: false,
    state: null,
  });
}

/**
 * Immutable startup trust pin. Rejects runtime re-pinning.
 */
export function createWriterTrustPin(spec, privilegedToken) {
  if (privilegedToken !== DISPOSABLE_WRITER_PIN_TOKEN) {
    throw new TypeError('DISPOSABLE_WRITER_PIN_TOKEN_REQUIRED');
  }
  if (!isPlainObject(spec)
    || !isNonEmptyString(spec.brokerKid)
    || !isNonEmptyString(spec.brokerPublicKeyPem)
    || !isNonEmptyString(spec.brokerIssuerId)
    || !isNonEmptyString(spec.writerAudienceId)
    || !isNonEmptyString(spec.trustEpoch)
    || !isNonEmptyString(spec.mutationRoot)
    || !isNonEmptyString(spec.tipAuthorityPublicKeyPem)
    || !isNonEmptyString(spec.tipAuthorityId)
    || !isNonEmptyString(spec.tipSocketPath)
    || !Number.isSafeInteger(spec.clockStartMs)) {
    throw new TypeError('WRITER_PIN_SPEC_INVALID');
  }
  // Reject empty / unsafe mutation roots
  const root = resolve(spec.mutationRoot);
  if (!root || root.includes('\0')) throw new TypeError('MUTATION_ROOT_INVALID');

  const pin = Object.freeze({
    kind: WRITER_KIND,
    purpose: WRITER_PURPOSE,
    brokerKid: spec.brokerKid,
    brokerPublicKeyPem: spec.brokerPublicKeyPem,
    brokerIssuerId: spec.brokerIssuerId,
    writerAudienceId: spec.writerAudienceId,
    trustEpoch: spec.trustEpoch,
    mutationRoot: root,
    tipAuthorityPublicKeyPem: spec.tipAuthorityPublicKeyPem,
    tipAuthorityId: spec.tipAuthorityId,
    tipSocketPath: spec.tipSocketPath,
    clockStartMs: spec.clockStartMs,
  });
  pinBrand.add(pin);
  writerRuntimeByPin.set(pin, {
    jtiStates: new Map(),
    tipSeq: 0,
    tipSha: null,
    tipDigest: null,
    revocationEpoch: 0,
    revokedJtis: new Set(),
    revocationStateKnown: false,
    clockMs: spec.clockStartMs,
    clockAvailable: true,
    lastAuthorityTs: null,
    // Wall anchor for TEST_ONLY projected Authority time (signing≠receipt≠mutate).
    authorityWallAnchorMs: null,
    fenceBusy: false,
    activeFenceGrantId: null,
    fenceConfirmTs: null,
    fenceConfirmExp: null,
    pinned: true,
    crashAfterMutate: false,
    crashBeforeMutate: false,
    forceAmbiguous: false,
    pauseAfterFenceMs: 0,
    pauseAfterConfirmMs: 0,
    pauseAfterExecuteMs: 0,
    pauseAfterPreMutationAssertionMs: 0,
    injectDriftAfterFirstAssertion: false,
  });
  return pin;
}

export function isBrandedWriterTrustPin(value) {
  return pinBrand.has(value);
}

export function rejectWriterRepin() {
  return deny(WRITER_DECISIONS.DENY_REPIN, ['RUNTIME_REPIN_FORBIDDEN']);
}

function getRuntime(pin) {
  if (!pinBrand.has(pin)) throw new TypeError('WRITER_PIN_REQUIRED');
  return writerRuntimeByPin.get(pin);
}

export function advanceWriterClock(pin, ms) {
  const rt = getRuntime(pin);
  if (!rt.clockAvailable) throw new TypeError('CLOCK_UNAVAILABLE');
  rt.clockMs += ms;
  return rt.clockMs;
}

export function setWriterClockUnavailable(pin) {
  getRuntime(pin).clockAvailable = false;
}

export function configureWriterCrashHooks(pin, hooks = {}) {
  const rt = getRuntime(pin);
  if (Object.prototype.hasOwnProperty.call(hooks, 'crashAfterMutate')) {
    rt.crashAfterMutate = hooks.crashAfterMutate === true;
  }
  if (Object.prototype.hasOwnProperty.call(hooks, 'crashBeforeMutate')) {
    rt.crashBeforeMutate = hooks.crashBeforeMutate === true;
  }
  if (Object.prototype.hasOwnProperty.call(hooks, 'forceAmbiguous')) {
    rt.forceAmbiguous = hooks.forceAmbiguous === true;
  }
  if (Object.prototype.hasOwnProperty.call(hooks, 'injectDriftAfterFirstAssertion')) {
    rt.injectDriftAfterFirstAssertion = hooks.injectDriftAfterFirstAssertion === true;
  }
  if (Object.prototype.hasOwnProperty.call(hooks, 'pauseAfterFenceMs')
    && Number.isSafeInteger(hooks.pauseAfterFenceMs)
    && hooks.pauseAfterFenceMs >= 0) {
    rt.pauseAfterFenceMs = hooks.pauseAfterFenceMs;
  }
  if (Object.prototype.hasOwnProperty.call(hooks, 'pauseAfterConfirmMs')
    && Number.isSafeInteger(hooks.pauseAfterConfirmMs)
    && hooks.pauseAfterConfirmMs >= 0) {
    rt.pauseAfterConfirmMs = hooks.pauseAfterConfirmMs;
  }
  if (Object.prototype.hasOwnProperty.call(hooks, 'pauseAfterExecuteMs')
    && Number.isSafeInteger(hooks.pauseAfterExecuteMs)
    && hooks.pauseAfterExecuteMs >= 0) {
    rt.pauseAfterExecuteMs = hooks.pauseAfterExecuteMs;
  }
  if (Object.prototype.hasOwnProperty.call(hooks, 'pauseAfterPreMutationAssertionMs')
    && Number.isSafeInteger(hooks.pauseAfterPreMutationAssertionMs)
    && hooks.pauseAfterPreMutationAssertionMs >= 0) {
    rt.pauseAfterPreMutationAssertionMs = hooks.pauseAfterPreMutationAssertionMs;
  }
}

/**
 * Projected Authority time at Writer receipt/decision:
 *   last verified Authority signed-ts + local wall elapsed since that verify.
 * Distinct from: Authority signing time, transmission, and physical mutate.
 * Fail closed if anchor missing, clock unavailable, or wall regresses.
 * TEST_ONLY: relies on local Date.now(); same-UID wall manipulation NOT_SEALED.
 */
function projectedAuthorityNowMs(rt) {
  if (!rt.clockAvailable) return null;
  if (!Number.isSafeInteger(rt.lastAuthorityTs)
    || !Number.isSafeInteger(rt.authorityWallAnchorMs)) {
    return null;
  }
  const wallNow = Date.now();
  if (!Number.isSafeInteger(wallNow)) return null;
  if (wallNow < rt.authorityWallAnchorMs) return null;
  return rt.lastAuthorityTs + (wallNow - rt.authorityWallAnchorMs);
}

/**
 * Accept a newly verified Authority signed timestamp.
 * Rejects regression. Optionally rejects delayed/stale delivery vs projected time.
 * Delivery-skew enforcement is for TIP_ASSERTION (pre-mutation) only — fence
 * GRANT/CONFIRM/EXECUTE retain signed-ts acceptance so adversarial delay harnesses
 * for those messages remain meaningful; physical-expiry uses projected time at mutate.
 * Updates lastAuthorityTs + wall anchor only on success.
 */
function acceptAuthoritySignedTs(rt, signedTs, phase, { enforceDeliverySkew = false } = {}) {
  if (!Number.isSafeInteger(signedTs)) {
    return deny(WRITER_DECISIONS.DENY_CLOCK, [`${phase}_AUTHORITY_TS_MISSING`]);
  }
  if (!rt.clockAvailable) {
    return deny(WRITER_DECISIONS.DENY_CLOCK, [`${phase}_CLOCK_UNAVAILABLE`]);
  }
  if (rt.lastAuthorityTs !== null && signedTs < rt.lastAuthorityTs) {
    return deny(WRITER_DECISIONS.DENY_CLOCK, [`${phase}_TS_REGRESSION`]);
  }
  const projected = projectedAuthorityNowMs(rt);
  if (enforceDeliverySkew
    && projected !== null
    && signedTs + MAX_AUTHORITY_ASSERTION_DELIVERY_SKEW_MS < projected) {
    return deny(WRITER_DECISIONS.DENY_CLOCK, [
      `${phase}_STALE_OR_DELAYED_AUTHORITY_ASSERTION`,
      'ASSERTION_TS_LAGS_PROJECTED_AUTHORITY_TIME',
    ]);
  }
  const wallNow = Date.now();
  if (!Number.isSafeInteger(wallNow)) {
    return deny(WRITER_DECISIONS.DENY_CLOCK, [`${phase}_WALL_UNAVAILABLE`]);
  }
  // Monotonic projected Authority time: accepting any correctly signed Authority
  // timestamp MUST NEVER move trusted/projected time backward. A delivery-lagged
  // TIP_ASSERTION within MAX_AUTHORITY_ASSERTION_DELIVERY_SKEW_MS previously reset
  // lastAuthorityTs=signedTs + wallAnchor=now, rewinding the clock used by
  // SIDE_EFFECT expiry and permitting mutation after ticket.exp (P0).
  // Preserve max(projected, signedTs) for both fence and skew-checked assertions.
  const nextTs = (projected !== null && projected > signedTs) ? projected : signedTs;
  rt.lastAuthorityTs = nextTs;
  rt.authorityWallAnchorMs = wallNow;
  rt.clockMs = nextTs;
  return null;
}

/**
 * Ticket validity against an Authority-domain timestamp (signed or projected).
 * TICKET_AUTHZ_LINEARIZATION uses FENCE_EXECUTE_ACK.ts (Authority signing time).
 * TICKET_SIDE_EFFECT_LINEARIZATION uses projectedAuthorityNowMs at mutation decision.
 */
function denyIfTicketOutsideAuthorityTs(claims, authorityTs, rt, phase) {
  if (!Number.isSafeInteger(authorityTs)) {
    return deny(WRITER_DECISIONS.DENY_CLOCK, [`${phase}_AUTHORITY_TS_MISSING`]);
  }
  if (!rt.clockAvailable) {
    return deny(WRITER_DECISIONS.DENY_CLOCK, [`${phase}_CLOCK_UNAVAILABLE`]);
  }
  if (!Number.isSafeInteger(claims.nbf) || !Number.isSafeInteger(claims.exp)
    || !Number.isSafeInteger(claims.iat)) {
    return deny(WRITER_DECISIONS.DENY_FAIL_CLOSED, [`${phase}_TICKET_TIME_FIELDS`]);
  }
  if (authorityTs < claims.nbf) {
    return deny(WRITER_DECISIONS.DENY_NOT_YET_VALID, [`${phase}_NBF`]);
  }
  if (authorityTs > claims.exp) {
    rt.jtiStates.set(claims.jti, TICKET_STATES.EXPIRED);
    return deny(WRITER_DECISIONS.DENY_EXPIRED, [
      `${phase}_EXP`,
      'TICKET_EXPIRED_AT_AUTHORITY_TS',
    ]);
  }
  return null;
}

function denyIfTicketExpiredAtProjectedNow(claims, rt, phase) {
  const projected = projectedAuthorityNowMs(rt);
  if (projected === null) {
    return deny(WRITER_DECISIONS.DENY_CLOCK, [
      `${phase}_PROJECTED_AUTHORITY_TIME_UNAVAILABLE`,
    ]);
  }
  return denyIfTicketOutsideAuthorityTs(claims, projected, rt, phase);
}

function tipUpdatePayload(claims) {
  return `TECP_DLP012_TIP_UPDATE_V1\n${canonicalJson(claims)}`;
}

function tipAssertionPayload(claims) {
  return `TECP_DLP012_TIP_ASSERTION_V1\n${canonicalJson(claims)}`;
}

export function fenceGrantPayload(claims) {
  return `TECP_DLP012_FENCE_GRANT_V1\n${canonicalJson(claims)}`;
}

/**
 * Monotonic irreversible revocation: epoch never decreases; JTIs are sticky
 * for the current trust epoch. Valid signatures do not authorize inconsistent
 * state transitions.
 */
function ingestRevocationEvidence(rt, { revocationEpoch, revokedJtis, seq, tipSha, rule02Digest }) {
  if (!Number.isSafeInteger(revocationEpoch)) {
    return deny(WRITER_DECISIONS.DENY_REVOCATION, ['REVOCATION_EPOCH_ABSENT']);
  }
  if (!Array.isArray(revokedJtis)) {
    return deny(WRITER_DECISIONS.DENY_REVOCATION, ['REVOCATION_STATE_ABSENT']);
  }
  for (const j of revokedJtis) {
    if (!isNonEmptyString(j)) {
      return deny(WRITER_DECISIONS.DENY_REVOCATION, ['REVOCATION_JTI_MALFORMED']);
    }
  }
  if (rt.revocationStateKnown && revocationEpoch < rt.revocationEpoch) {
    return deny(WRITER_DECISIONS.DENY_REVOCATION, ['REVOCATION_EPOCH_ROLLBACK']);
  }
  if (Number.isSafeInteger(seq) && seq === rt.tipSeq && rt.tipSha !== null) {
    if (tipSha !== rt.tipSha || rule02Digest !== rt.tipDigest) {
      return deny(WRITER_DECISIONS.DENY_FRESHNESS, ['SEQ_CONFLICT']);
    }
    if (rt.revocationStateKnown && revocationEpoch !== rt.revocationEpoch) {
      return deny(WRITER_DECISIONS.DENY_FRESHNESS, ['SEQ_CONFLICT_REVOCATION']);
    }
  }
  for (const j of revokedJtis) rt.revokedJtis.add(j);
  if (!rt.revocationStateKnown || revocationEpoch > rt.revocationEpoch) {
    rt.revocationEpoch = revocationEpoch;
  }
  rt.revocationStateKnown = true;
  return null;
}

/**
 * Apply authenticated tip/revocation update (from harness tip authority).
 */
export function applyAuthenticatedTipUpdate(pin, update) {
  const rt = getRuntime(pin);
  if (!isPlainObject(update)
    || update.v !== 1
    || update.authorityId !== pin.tipAuthorityId
    || !Number.isSafeInteger(update.seq)
    || !isNonEmptyString(update.tipSha)
    || !isNonEmptyString(update.rule02Digest)
    || !Number.isSafeInteger(update.revocationEpoch)
    || !Number.isSafeInteger(update.ts)
    || !isNonEmptyString(update.sig)) {
    return deny(WRITER_DECISIONS.DENY_FRESHNESS, ['TIP_UPDATE_MALFORMED']);
  }
  if (update.seq < rt.tipSeq) {
    return deny(WRITER_DECISIONS.DENY_FRESHNESS, ['SEQ_ROLLBACK']);
  }
  if (update.seq === rt.tipSeq) {
    if (update.tipSha !== rt.tipSha || update.rule02Digest !== rt.tipDigest
      || update.revocationEpoch !== rt.revocationEpoch) {
      return deny(WRITER_DECISIONS.DENY_FRESHNESS, ['SEQ_CONFLICT']);
    }
  }
  const claims = {
    authorityId: update.authorityId,
    revocationEpoch: update.revocationEpoch,
    rule02Digest: update.rule02Digest,
    seq: update.seq,
    tipSha: update.tipSha,
    ts: update.ts,
    v: 1,
  };
  if (Array.isArray(update.revokedJtis)) {
    claims.revokedJtis = [...update.revokedJtis].sort();
  }
  const payload = tipUpdatePayload(claims);
  if (!verifyEd25519(pin.tipAuthorityPublicKeyPem, payload, update.sig)) {
    return deny(WRITER_DECISIONS.DENY_FRESHNESS, ['TIP_UPDATE_SIG']);
  }
  const revDeny = ingestRevocationEvidence(rt, {
    revocationEpoch: update.revocationEpoch,
    revokedJtis: Array.isArray(update.revokedJtis) ? update.revokedJtis : [],
    seq: update.seq,
    tipSha: update.tipSha,
    rule02Digest: update.rule02Digest,
  });
  if (revDeny) return revDeny;
  if (update.seq > rt.tipSeq) {
    rt.tipSeq = update.seq;
    rt.tipSha = update.tipSha;
    rt.tipDigest = update.rule02Digest;
  }
  if (Number.isSafeInteger(update.ts)) {
    const tsDeny = acceptAuthoritySignedTs(rt, update.ts, 'TIP_UPDATE');
    if (tsDeny) return tsDeny;
  }
  return Object.freeze({ ok: true, decision: WRITER_DECISIONS.ALLOW, seq: rt.tipSeq });
}

function decodeTicket(encoded) {
  if (!isNonEmptyString(encoded) || !encoded.includes('.')) return null;
  const [payloadB64, sig] = encoded.split('.');
  if (!payloadB64 || !sig || encoded.split('.').length !== 2) return null;
  let payloadUtf8;
  try {
    payloadUtf8 = Buffer.from(payloadB64, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!payloadUtf8.startsWith('TECP_DLP012_TICKET_V1\n')) return null;
  const jsonPart = payloadUtf8.slice('TECP_DLP012_TICKET_V1\n'.length);
  let claims;
  try {
    claims = parseStrictJson(jsonPart);
  } catch {
    return null;
  }
  if (!isPlainObject(claims)) return null;
  return { payloadUtf8, claims, sig };
}

function verifyTicketStructure(pin, decoded) {
  const { claims } = decoded;
  for (const key of Object.keys(claims)) {
    if (!ALLOWED_TICKET_KEYS.has(key)) {
      return deny(WRITER_DECISIONS.DENY_EXTRA_FIELD, [key]);
    }
  }
  if (claims.alg !== 'Ed25519' || claims.v !== 1) {
    return deny(WRITER_DECISIONS.DENY_INVALID_SIGNATURE, ['ALG_OR_V']);
  }
  if (claims.kid !== pin.brokerKid) {
    return deny(WRITER_DECISIONS.DENY_WRONG_KID);
  }
  if (claims.aud !== pin.writerAudienceId) {
    return deny(WRITER_DECISIONS.DENY_WRONG_AUDIENCE);
  }
  if (claims.iss !== pin.brokerIssuerId) {
    return deny(WRITER_DECISIONS.DENY_WRONG_ISSUER);
  }
  if (claims.trustEpoch !== pin.trustEpoch) {
    return deny(WRITER_DECISIONS.DENY_WRONG_EPOCH);
  }
  if (claims.sliceId !== DLP012_SLICE_ID) {
    return deny(WRITER_DECISIONS.DENY_WRONG_SLICE);
  }
  if (claims.op !== DLP012_NATIVE_OPERATION) {
    return deny(WRITER_DECISIONS.DENY_WRONG_OPERATION);
  }
  if (!scopesEqual(claims.paths, DLP012_AUTHORIZED_FILE_SCOPE)) {
    return deny(WRITER_DECISIONS.DENY_WRONG_SCOPE);
  }
  if (claims.ou !== true) {
    return deny(WRITER_DECISIONS.DENY_FAIL_CLOSED, ['ONE_TIME_REQUIRED']);
  }
  let expectedPayload;
  try {
    expectedPayload = ticketSigningPayload(claims);
  } catch {
    return deny(WRITER_DECISIONS.DENY_FAIL_CLOSED, ['CANONICAL']);
  }
  if (expectedPayload !== decoded.payloadUtf8) {
    return deny(WRITER_DECISIONS.DENY_INVALID_SIGNATURE, ['NONCANONICAL']);
  }
  if (!verifyEd25519(pin.brokerPublicKeyPem, decoded.payloadUtf8, decoded.sig)) {
    return deny(WRITER_DECISIONS.DENY_INVALID_SIGNATURE);
  }
  return null;
}

async function obtainFreshnessAssertion(pin, nonce) {
  const rt = getRuntime(pin);
  const ipc = await netApi();
  return new Promise((resolvePromise) => {
    let settled = false;
    let timerHandle = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timerHandle !== null) globalThis['clearTimeout'](timerHandle);
      resolvePromise(value);
    };
    const sock = ipc['createConnection'](pin.tipSocketPath);
    timerHandle = globalThis['setTimeout'](() => {
      try { sock.destroy(); } catch { /* ignore */ }
      finish(deny(WRITER_DECISIONS.DENY_FRESHNESS, ['FRESHNESS_TIMEOUT']));
    }, 15_000);
    let buf = Buffer.alloc(0);
    sock.on('connect', () => {
      sock.write(encodeFrame({
        v: PROTOCOL_VERSION,
        kind: PROTOCOL_KIND,
        type: MSG.TIP_CHALLENGE,
        nonce,
        writerAudience: pin.writerAudienceId,
        trustEpoch: pin.trustEpoch,
      }));
    });
    sock.on('data', (chunk) => {
      try {
        buf = Buffer.concat([buf, chunk]);
        const decoded = tryDecodeFrames(buf);
        buf = Buffer.from(decoded.rest);
        for (const msg of decoded.frames) {
          finish(Object.freeze({ __frame: msg }));
          sock.end();
        }
      } catch (err) {
        finish(deny(WRITER_DECISIONS.DENY_FRESHNESS, [String(err && err.message || err)]));
      }
    });
    sock.on('error', () => {
      finish(deny(WRITER_DECISIONS.DENY_FRESHNESS, ['TIP_SOCKET_ERROR']));
    });
  }).then((result) => {
    if (!result || result.ok === false) return result;
    if (!result.__frame) return result;
    const msg = result.__frame;
    if (msg.type !== MSG.TIP_ASSERTION || msg.ok !== true) {
      return deny(WRITER_DECISIONS.DENY_FRESHNESS, ['BAD_ASSERTION']);
    }
    // Per-JTI revocation evidence is mandatory on every freshness assertion.
    if (!Array.isArray(msg.revokedJtis)) {
      return deny(WRITER_DECISIONS.DENY_REVOCATION, ['REVOCATION_STATE_ABSENT']);
    }
    for (const j of msg.revokedJtis) {
      if (!isNonEmptyString(j)) {
        return deny(WRITER_DECISIONS.DENY_REVOCATION, ['REVOCATION_JTI_MALFORMED']);
      }
    }
    if (!Number.isSafeInteger(msg.ts)) {
      return deny(WRITER_DECISIONS.DENY_CLOCK, ['ASSERTION_TS_ABSENT']);
    }
    const claims = {
      authorityId: msg.authorityId,
      nonce: msg.nonce,
      revocationEpoch: msg.revocationEpoch,
      revokedJtis: [...msg.revokedJtis].sort(),
      rule02Digest: msg.rule02Digest,
      seq: msg.seq,
      tipSha: msg.tipSha,
      ts: msg.ts,
      v: 1,
    };
    const payload = tipAssertionPayload(claims);
    if (!verifyEd25519(pin.tipAuthorityPublicKeyPem, payload, msg.sig)) {
      return deny(WRITER_DECISIONS.DENY_FRESHNESS, ['ASSERTION_SIG']);
    }
    if (msg.nonce !== nonce) {
      return deny(WRITER_DECISIONS.DENY_FRESHNESS, ['NONCE_MISMATCH']);
    }
    if (msg.authorityId !== pin.tipAuthorityId) {
      return deny(WRITER_DECISIONS.DENY_FRESHNESS, ['AUTHORITY']);
    }
    if (!Number.isSafeInteger(msg.seq) || msg.seq < rt.tipSeq) {
      return deny(WRITER_DECISIONS.DENY_FRESHNESS, ['STALE_SEQ']);
    }
    const revDeny = ingestRevocationEvidence(rt, {
      revocationEpoch: msg.revocationEpoch,
      revokedJtis: msg.revokedJtis,
      seq: msg.seq,
      tipSha: msg.tipSha,
      rule02Digest: msg.rule02Digest,
    });
    if (revDeny) return revDeny;
    if (msg.seq > rt.tipSeq) {
      rt.tipSeq = msg.seq;
      rt.tipSha = msg.tipSha;
      rt.tipDigest = msg.rule02Digest;
    } else if (msg.seq === rt.tipSeq) {
      if (msg.tipSha !== rt.tipSha || msg.rule02Digest !== rt.tipDigest) {
        return deny(WRITER_DECISIONS.DENY_FRESHNESS, ['SEQ_CONFLICT']);
      }
    }
    // Receipt-time check: signed ts must not lag projected Authority time (delayed delivery).
    const tsDeny = acceptAuthoritySignedTs(rt, msg.ts, 'TIP_ASSERTION', {
      enforceDeliverySkew: true,
    });
    if (tsDeny) return tsDeny;
    return Object.freeze({
      ok: true,
      seq: msg.seq,
      tipSha: msg.tipSha,
      rule02Digest: msg.rule02Digest,
      revocationEpoch: rt.revocationEpoch,
      revokedJtis: Object.freeze([...rt.revokedJtis].sort()),
      ts: msg.ts,
      receivedAtProjectedMs: projectedAuthorityNowMs(rt),
    });
  });
}

/**
 * Acquire authority-enforced mutation fence.
 * LINEARIZATION_POINT: signed FENCE_GRANT; tip/revocation frozen at authority until complete.
 */
async function acquireMutationFence(pin, snapshot) {
  const ipc = await netApi();
  const fenceNonce = randomId(16);
  return new Promise((resolvePromise) => {
    let settled = false;
    let timerHandle = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timerHandle !== null) globalThis['clearTimeout'](timerHandle);
      resolvePromise(value);
    };
    const sock = ipc['createConnection'](pin.tipSocketPath);
    timerHandle = globalThis['setTimeout'](() => {
      try { sock.destroy(); } catch { /* ignore */ }
      finish(deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_ACQUIRE_TIMEOUT']));
    }, 2000);
    let buf = Buffer.alloc(0);
    sock.on('connect', () => {
      sock.write(encodeFrame({
        v: PROTOCOL_VERSION,
        kind: PROTOCOL_KIND,
        type: MSG.FENCE_ACQUIRE_REQ,
        fenceNonce,
        jti: snapshot.jti,
        tipSha: snapshot.tipSha,
        seq: snapshot.seq,
        rule02Digest: snapshot.rule02Digest,
        revocationEpoch: snapshot.revocationEpoch,
        writerAudience: pin.writerAudienceId,
        trustEpoch: pin.trustEpoch,
      }));
    });
    sock.on('data', (chunk) => {
      try {
        buf = Buffer.concat([buf, chunk]);
        const decoded = tryDecodeFrames(buf);
        buf = Buffer.from(decoded.rest);
        for (const msg of decoded.frames) {
          finish(Object.freeze({ __frame: msg }));
          sock.end();
        }
      } catch (err) {
        finish(deny(WRITER_DECISIONS.DENY_FENCE, [String(err && err.message || err)]));
      }
    });
    sock.on('error', () => {
      finish(deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_SOCKET_ERROR']));
    });
  }).then((result) => {
    if (!result || result.ok === false) return result;
    if (!result.__frame) return result;
    const msg = result.__frame;
    if (msg.type === MSG.FENCE_DENY || msg.ok === false) {
      return deny(WRITER_DECISIONS.DENY_FENCE, [
        ...(Array.isArray(msg.reasons) ? msg.reasons : ['FENCE_DENIED']),
      ]);
    }
    if (msg.type !== MSG.FENCE_GRANT || msg.ok !== true) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['BAD_FENCE_GRANT']);
    }
    if (msg.writerAudience !== pin.writerAudienceId || msg.trustEpoch !== pin.trustEpoch) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_AUDIENCE']);
    }
    if (msg.jti !== snapshot.jti
      || msg.tipSha !== snapshot.tipSha
      || msg.seq !== snapshot.seq
      || msg.rule02Digest !== snapshot.rule02Digest
      || msg.revocationEpoch !== snapshot.revocationEpoch
      || msg.fenceNonce !== fenceNonce) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_SNAPSHOT_MISMATCH']);
    }
    if (!Array.isArray(msg.revokedJtis)) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_REVOCATION_ABSENT']);
    }
    const grantClaims = {
      authorityId: msg.authorityId,
      exp: msg.exp,
      fenceNonce: msg.fenceNonce,
      grantId: msg.grantId,
      jti: msg.jti,
      revocationEpoch: msg.revocationEpoch,
      revokedJtis: [...msg.revokedJtis].sort(),
      rule02Digest: msg.rule02Digest,
      seq: msg.seq,
      tipSha: msg.tipSha,
      trustEpoch: msg.trustEpoch,
      ts: msg.ts,
      v: 1,
      writerAudience: msg.writerAudience,
    };
    const payload = fenceGrantPayload(grantClaims);
    if (!verifyEd25519(pin.tipAuthorityPublicKeyPem, payload, msg.sig)) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_GRANT_SIG']);
    }
    if (msg.authorityId !== pin.tipAuthorityId) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_AUTHORITY']);
    }
    const rt = getRuntime(pin);
    if (!Number.isSafeInteger(msg.exp) || !Number.isSafeInteger(msg.ts) || msg.ts > msg.exp) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_GRANT_MALFORMED_WINDOW']);
    }
    // Local clock may lag IPC delay; expiration is enforced by live FENCE_CONFIRM
    // against Authority current state at the mutation boundary — not grant self-checks alone.
    const revDeny = ingestRevocationEvidence(rt, {
      revocationEpoch: msg.revocationEpoch,
      revokedJtis: msg.revokedJtis,
      seq: msg.seq,
      tipSha: msg.tipSha,
      rule02Digest: msg.rule02Digest,
    });
    if (revDeny) return revDeny;
    const tsDeny = acceptAuthoritySignedTs(rt, msg.ts, 'FENCE_GRANT');
    if (tsDeny) return tsDeny;
    rt.activeFenceGrantId = msg.grantId;
    rt.fenceConfirmTs = null;
    rt.fenceConfirmExp = null;
    return Object.freeze({
      ok: true,
      grantId: msg.grantId,
      tipSha: msg.tipSha,
      seq: msg.seq,
      rule02Digest: msg.rule02Digest,
      revocationEpoch: rt.revocationEpoch,
      ts: msg.ts,
      exp: msg.exp,
      jti: msg.jti,
    });
  });
}

/**
 * Authoritative live confirmation that grantId is still held and tip-frozen
 * at the mutation boundary. Self-contained grant TTL is never sufficient alone.
 */
async function confirmMutationFence(pin, grant) {
  const ipc = await netApi();
  return new Promise((resolvePromise) => {
    let settled = false;
    let timerHandle = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timerHandle !== null) globalThis['clearTimeout'](timerHandle);
      resolvePromise(value);
    };
    const sock = ipc['createConnection'](pin.tipSocketPath);
    timerHandle = globalThis['setTimeout'](() => {
      try { sock.destroy(); } catch { /* ignore */ }
      finish(deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_CONFIRM_TIMEOUT']));
    }, 2000);
    let buf = Buffer.alloc(0);
    sock.on('connect', () => {
      sock.write(encodeFrame({
        v: PROTOCOL_VERSION,
        kind: PROTOCOL_KIND,
        type: MSG.FENCE_CONFIRM_REQ,
        grantId: grant.grantId,
        writerAudience: pin.writerAudienceId,
        trustEpoch: pin.trustEpoch,
        tipSha: grant.tipSha,
        seq: grant.seq,
        rule02Digest: grant.rule02Digest,
        revocationEpoch: grant.revocationEpoch,
        jti: grant.jti || undefined,
      }));
    });
    sock.on('data', (chunk) => {
      try {
        buf = Buffer.concat([buf, chunk]);
        const decoded = tryDecodeFrames(buf);
        buf = Buffer.from(decoded.rest);
        for (const msg of decoded.frames) {
          finish(Object.freeze({ __frame: msg }));
          sock.end();
        }
      } catch (err) {
        finish(deny(WRITER_DECISIONS.DENY_FENCE, [String(err && err.message || err)]));
      }
    });
    sock.on('error', () => {
      finish(deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_CONFIRM_SOCKET_ERROR']));
    });
  }).then((result) => {
    if (!result || result.ok === false) return result;
    const msg = result.__frame;
    if (!msg || msg.type === MSG.FENCE_DENY || msg.ok === false) {
      return deny(WRITER_DECISIONS.DENY_FENCE, [
        ...(Array.isArray(msg && msg.reasons) ? msg.reasons : ['FENCE_CONFIRM_DENIED']),
      ]);
    }
    if (msg.type !== MSG.FENCE_CONFIRM_ACK || msg.ok !== true) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['BAD_FENCE_CONFIRM']);
    }
    if (msg.grantId !== grant.grantId) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_CONFIRM_GRANT_MISMATCH']);
    }
    if (msg.tipSha !== grant.tipSha
      || msg.seq !== grant.seq
      || msg.rule02Digest !== grant.rule02Digest
      || msg.revocationEpoch !== grant.revocationEpoch) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_CONFIRM_SNAPSHOT_MISMATCH']);
    }
    if (!Number.isSafeInteger(msg.ts) || !Number.isSafeInteger(msg.exp) || msg.ts > msg.exp) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_CONFIRM_CLOCK']);
    }
    // Authoritative now must still be within the live grant/confirm window.
    if (msg.ts > grant.exp) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_GRANT_EXPIRED', 'CONFIRM_TS_PAST_GRANT_EXP']);
    }
    const rt = getRuntime(pin);
    const tsDeny = acceptAuthoritySignedTs(rt, msg.ts, 'FENCE_CONFIRM');
    if (tsDeny) return tsDeny;
    rt.activeFenceGrantId = grant.grantId;
    rt.fenceConfirmTs = msg.ts;
    rt.fenceConfirmExp = msg.exp;
    return Object.freeze({
      ok: true,
      grantId: msg.grantId,
      ts: msg.ts,
      exp: msg.exp,
      tipSha: msg.tipSha,
      seq: msg.seq,
    });
  });
}

/**
 * One-shot Authority execute permit. A prior CONFIRM_ACK is never standing authority
 * after the Authority has released or poisoned the fence.
 */
async function executeMutationFence(pin, grant) {
  const ipc = await netApi();
  return new Promise((resolvePromise) => {
    let settled = false;
    let timerHandle = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timerHandle !== null) globalThis['clearTimeout'](timerHandle);
      resolvePromise(value);
    };
    const sock = ipc['createConnection'](pin.tipSocketPath);
    timerHandle = globalThis['setTimeout'](() => {
      try { sock.destroy(); } catch { /* ignore */ }
      finish(deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_EXECUTE_TIMEOUT']));
    }, 15_000);
    let buf = Buffer.alloc(0);
    sock.on('connect', () => {
      sock.write(encodeFrame({
        v: PROTOCOL_VERSION,
        kind: PROTOCOL_KIND,
        type: MSG.FENCE_EXECUTE_REQ,
        grantId: grant.grantId,
        writerAudience: pin.writerAudienceId,
        trustEpoch: pin.trustEpoch,
        tipSha: grant.tipSha,
        seq: grant.seq,
        rule02Digest: grant.rule02Digest,
        revocationEpoch: grant.revocationEpoch,
        jti: grant.jti || undefined,
      }));
    });
    sock.on('data', (chunk) => {
      try {
        buf = Buffer.concat([buf, chunk]);
        const decoded = tryDecodeFrames(buf);
        buf = Buffer.from(decoded.rest);
        for (const msg of decoded.frames) {
          finish(Object.freeze({ __frame: msg }));
          sock.end();
        }
      } catch (err) {
        finish(deny(WRITER_DECISIONS.DENY_FENCE, [String(err && err.message || err)]));
      }
    });
    sock.on('error', () => {
      finish(deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_EXECUTE_SOCKET_ERROR']));
    });
  }).then((result) => {
    if (!result || result.ok === false) return result;
    const msg = result.__frame;
    if (!msg || msg.type === MSG.FENCE_DENY || msg.ok === false) {
      return deny(WRITER_DECISIONS.DENY_FENCE, [
        ...(Array.isArray(msg && msg.reasons) ? msg.reasons : ['FENCE_EXECUTE_DENIED']),
      ]);
    }
    if (msg.type !== MSG.FENCE_EXECUTE_ACK || msg.ok !== true) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['BAD_FENCE_EXECUTE']);
    }
    if (msg.grantId !== grant.grantId) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_EXECUTE_GRANT_MISMATCH']);
    }
    if (msg.tipSha !== grant.tipSha
      || msg.seq !== grant.seq
      || msg.rule02Digest !== grant.rule02Digest
      || msg.revocationEpoch !== grant.revocationEpoch) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_EXECUTE_SNAPSHOT_MISMATCH']);
    }
    if (!Number.isSafeInteger(msg.ts)) {
      return deny(WRITER_DECISIONS.DENY_CLOCK, ['FENCE_EXECUTE_TS']);
    }
    const rt = getRuntime(pin);
    const tsDeny = acceptAuthoritySignedTs(rt, msg.ts, 'FENCE_EXECUTE');
    if (tsDeny) return tsDeny;
    rt.fenceExecuteTs = msg.ts;
    return Object.freeze({
      ok: true,
      grantId: msg.grantId,
      ts: msg.ts,
      tipSha: msg.tipSha,
      seq: msg.seq,
      state: msg.state || 'MUTATION_POSSIBLE',
    });
  });
}

async function completeMutationFence(pin, grantId, outcome) {
  const ipc = await netApi();
  return new Promise((resolvePromise) => {
    let settled = false;
    let timerHandle = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timerHandle !== null) globalThis['clearTimeout'](timerHandle);
      resolvePromise(value);
    };
    const sock = ipc['createConnection'](pin.tipSocketPath);
    timerHandle = globalThis['setTimeout'](() => {
      try { sock.destroy(); } catch { /* ignore */ }
      finish(deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_COMPLETE_TIMEOUT']));
    }, 2000);
    let buf = Buffer.alloc(0);
    sock.on('connect', () => {
      sock.write(encodeFrame({
        v: PROTOCOL_VERSION,
        kind: PROTOCOL_KIND,
        type: MSG.FENCE_COMPLETE_REQ,
        grantId,
        writerAudience: pin.writerAudienceId,
        trustEpoch: pin.trustEpoch,
        outcome,
      }));
    });
    sock.on('data', (chunk) => {
      try {
        buf = Buffer.concat([buf, chunk]);
        const decoded = tryDecodeFrames(buf);
        buf = Buffer.from(decoded.rest);
        for (const msg of decoded.frames) {
          finish(Object.freeze({ __frame: msg }));
          sock.end();
        }
      } catch (err) {
        finish(deny(WRITER_DECISIONS.DENY_FENCE, [String(err && err.message || err)]));
      }
    });
    sock.on('error', () => {
      finish(deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_COMPLETE_SOCKET_ERROR']));
    });
  }).then((result) => {
    const rt = getRuntime(pin);
    rt.activeFenceGrantId = null;
    if (!result || result.ok === false) return result;
    const msg = result.__frame;
    if (!msg || msg.type !== MSG.FENCE_COMPLETE_ACK || msg.ok !== true) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_COMPLETE_DENIED']);
    }
    if (msg.grantId !== grantId) {
      return deny(WRITER_DECISIONS.DENY_FENCE, ['FENCE_COMPLETE_GRANT_MISMATCH']);
    }
    return Object.freeze({ ok: true, grantId });
  });
}

async function confineMutationPath(pin, relativeName) {
  if (!isNonEmptyString(relativeName)
    || relativeName.includes('\0')
    || relativeName.includes('..')
    || relativeName.startsWith('/')
    || relativeName.includes(sep + '..')) {
    return { ok: false, decision: WRITER_DECISIONS.DENY_PATH };
  }
  const io = await fsApi();
  const rootReal = io.realpathSync(pin.mutationRoot);
  const target = resolve(rootReal, relativeName);
  if (!target.startsWith(rootReal + sep) && target !== rootReal) {
    return { ok: false, decision: WRITER_DECISIONS.DENY_PATH, reasons: ['ESCAPE'] };
  }
  let cur = rootReal;
  const parts = relativeName.split(/[/\\]/).filter(Boolean);
  for (let i = 0; i < parts.length; i += 1) {
    cur = join(cur, parts[i]);
    if (!io.existsSync(cur)) {
      if (i < parts.length - 1) {
        return { ok: false, decision: WRITER_DECISIONS.DENY_PATH, reasons: ['MISSING_PARENT'] };
      }
      break;
    }
    const st = io.lstatSync(cur);
    if (st.isSymbolicLink()) {
      return { ok: false, decision: WRITER_DECISIONS.DENY_SYMLINK };
    }
  }
  return { ok: true, target };
}

async function performDisposableMutation(pin, relativeName, content) {
  const confined = await confineMutationPath(pin, relativeName);
  if (!confined.ok) return confined;
  const { target } = confined;
  const io = await fsApi();
  if (io.existsSync(target)) {
    return { ok: false, decision: WRITER_DECISIONS.DENY_PATH, reasons: ['EXISTS'] };
  }
  const tmp = `${target}.tmp.${randomId(4)}`;
  const fd = io.openSync(tmp, 'wx', 0o600);
  try {
    io.writeFileSync(fd, content, 'utf8');
    io.fsyncSync(fd);
  } finally {
    io.closeSync(fd);
  }
  io.renameSync(tmp, target);
  return { ok: true, target };
}

/**
 * Execute authorized disposable mutation under freshness fence.
 */
export async function executeAuthorizedWrite(pin, request = {}) {
  if (!pinBrand.has(pin)) {
    return deny(WRITER_DECISIONS.DENY_PIN_REQUIRED);
  }
  const rt = getRuntime(pin);
  if (rt.fenceBusy) {
    return deny(WRITER_DECISIONS.DENY_FAIL_CLOSED, ['FENCE_BUSY']);
  }
  rt.fenceBusy = true;
  try {
    if (!isNonEmptyString(request.ticketEncoded)) {
      return deny(WRITER_DECISIONS.DENY_MISSING_TICKET);
    }
    if (!isNonEmptyString(request.mutationRelativePath)) {
      return deny(WRITER_DECISIONS.DENY_PATH, ['RELATIVE_REQUIRED']);
    }
    if (request.mutationAbsolutePath) {
      return deny(WRITER_DECISIONS.DENY_PATH, ['ABSOLUTE_FORBIDDEN']);
    }
    if (!rt.clockAvailable) {
      return deny(WRITER_DECISIONS.DENY_CLOCK);
    }

    const decoded = decodeTicket(request.ticketEncoded);
    if (!decoded) {
      return deny(WRITER_DECISIONS.DENY_INVALID_SIGNATURE, ['DECODE']);
    }
    const structDeny = verifyTicketStructure(pin, decoded);
    if (structDeny) return structDeny;

    const { claims } = decoded;
    if (!Number.isSafeInteger(claims.nbf) || !Number.isSafeInteger(claims.exp)
      || !Number.isSafeInteger(claims.iat)) {
      return deny(WRITER_DECISIONS.DENY_FAIL_CLOSED, ['TIME']);
    }
    if (!isNonEmptyString(claims.mutPath) || !isNonEmptyString(claims.mutContentSha)) {
      return deny(WRITER_DECISIONS.DENY_MUTATION_TARGET, ['TICKET_MUT_BINDING_REQUIRED']);
    }
    if (request.mutationRelativePath !== claims.mutPath) {
      return deny(WRITER_DECISIONS.DENY_MUTATION_TARGET, ['PATH_MISMATCH']);
    }
    const content = isNonEmptyString(request.content) ? request.content : '';
    if (sha256Hex(content) !== claims.mutContentSha) {
      return deny(WRITER_DECISIONS.DENY_MUTATION_TARGET, ['CONTENT_MISMATCH']);
    }

    const prior = rt.jtiStates.get(claims.jti);
    if (prior === TICKET_STATES.POISONED) {
      return deny(WRITER_DECISIONS.DENY_POISONED);
    }
    if (prior === TICKET_STATES.COMMITTED
      || prior === TICKET_STATES.RESERVED
      || prior === TICKET_STATES.REVOKED
      || prior === TICKET_STATES.EXPIRED) {
      return deny(WRITER_DECISIONS.DENY_REPLAY, [prior || 'UNKNOWN']);
    }

    // Atomic reserve before fence I/O
    if (rt.jtiStates.has(claims.jti)) {
      return deny(WRITER_DECISIONS.DENY_REPLAY, ['RACE']);
    }
    rt.jtiStates.set(claims.jti, TICKET_STATES.RESERVED);

    // Freshness #1: nonce-bound tip + authoritative per-JTI revocation + trusted time
    const nonce1 = randomId(16);
    const fresh1 = await obtainFreshnessAssertion(pin, nonce1);
    if (!fresh1.ok) {
      return Object.freeze({
        ...fresh1,
        mutated: false,
        state: TICKET_STATES.RESERVED,
      });
    }
    if (!rt.revocationStateKnown) {
      return deny(WRITER_DECISIONS.DENY_REVOCATION, ['REVOCATION_STATE_UNKNOWN']);
    }
    if (rt.revokedJtis.has(claims.jti)) {
      rt.jtiStates.set(claims.jti, TICKET_STATES.REVOKED);
      return deny(WRITER_DECISIONS.DENY_REVOCATION, ['JTI_REVOKED']);
    }

    // Trusted tip-authority time is the only current clock at the fence.
    const now = fresh1.ts;
    if (!Number.isSafeInteger(now)) {
      return deny(WRITER_DECISIONS.DENY_CLOCK, ['FRESH_TS']);
    }
    if (now < claims.nbf) return deny(WRITER_DECISIONS.DENY_NOT_YET_VALID);
    if (now > claims.exp) {
      rt.jtiStates.set(claims.jti, TICKET_STATES.EXPIRED);
      return deny(WRITER_DECISIONS.DENY_EXPIRED);
    }
    if (claims.tipSha !== fresh1.tipSha || claims.rule02Digest !== fresh1.rule02Digest) {
      rt.jtiStates.set(claims.jti, TICKET_STATES.REVOKED);
      return deny(WRITER_DECISIONS.DENY_TIP_DRIFT, ['TICKET_TIP_MISMATCH']);
    }
    if (Math.abs(fresh1.ts - claims.iat) > MAX_REQUEST_SKEW_MS && fresh1.ts < claims.iat) {
      return deny(WRITER_DECISIONS.DENY_FRESHNESS, ['TS_BEFORE_IAT']);
    }

    // Freshness #2: rebind check (necessary, never sufficient alone).
    const nonce2 = randomId(16);
    const fresh2 = await obtainFreshnessAssertion(pin, nonce2);
    if (!fresh2.ok) {
      return Object.freeze({
        ...fresh2,
        mutated: false,
        state: TICKET_STATES.RESERVED,
      });
    }
    if (fresh2.tipSha !== fresh1.tipSha
      || fresh2.rule02Digest !== fresh1.rule02Digest
      || fresh2.seq !== fresh1.seq
      || fresh2.revocationEpoch !== fresh1.revocationEpoch) {
      return deny(WRITER_DECISIONS.DENY_TIP_DRIFT, ['FENCE_REBIND_DRIFT']);
    }
    if (rt.revokedJtis.has(claims.jti)) {
      rt.jtiStates.set(claims.jti, TICKET_STATES.REVOKED);
      return deny(WRITER_DECISIONS.DENY_REVOCATION, ['JTI_REVOKED_AT_REBIND']);
    }
    if (fresh2.ts < claims.nbf) return deny(WRITER_DECISIONS.DENY_NOT_YET_VALID);
    if (fresh2.ts > claims.exp) {
      rt.jtiStates.set(claims.jti, TICKET_STATES.EXPIRED);
      return deny(WRITER_DECISIONS.DENY_EXPIRED);
    }

    // Authority-enforced mutation fence — LINEARIZATION_POINT = FENCE_GRANT.
    const fence = await acquireMutationFence(pin, {
      jti: claims.jti,
      tipSha: fresh2.tipSha,
      seq: fresh2.seq,
      rule02Digest: fresh2.rule02Digest,
      revocationEpoch: fresh2.revocationEpoch,
    });
    if (!fence.ok) {
      return Object.freeze({
        ...fence,
        mutated: false,
        state: TICKET_STATES.RESERVED,
      });
    }
    if (fence.tipSha !== fresh2.tipSha
      || fence.seq !== fresh2.seq
      || fence.rule02Digest !== fresh2.rule02Digest) {
      await completeMutationFence(pin, fence.grantId, 'ABORTED');
      return deny(WRITER_DECISIONS.DENY_TIP_DRIFT, ['FENCE_FINAL_BOUNDARY']);
    }
    if (rt.revokedJtis.has(claims.jti)) {
      await completeMutationFence(pin, fence.grantId, 'ABORTED');
      rt.jtiStates.set(claims.jti, TICKET_STATES.REVOKED);
      return deny(WRITER_DECISIONS.DENY_REVOCATION, ['JTI_REVOKED_AT_FENCE']);
    }
    if (fence.ts > claims.exp) {
      await completeMutationFence(pin, fence.grantId, 'ABORTED');
      rt.jtiStates.set(claims.jti, TICKET_STATES.EXPIRED);
      return deny(WRITER_DECISIONS.DENY_EXPIRED);
    }

    // Deterministic disposable pause after grant receipt (adversarial / RED-02).
    if (Number.isSafeInteger(rt.pauseAfterFenceMs) && rt.pauseAfterFenceMs > 0) {
      await new Promise((r) => globalThis['setTimeout'](r, rt.pauseAfterFenceMs));
    }

    // CONFIRM is necessary but not sufficient — a successful ACK must not outlive
    // Authority fence release. EXECUTE is the mutation-boundary linearization.
    const confirm = await confirmMutationFence(pin, fence);
    if (!confirm.ok) {
      try { await completeMutationFence(pin, fence.grantId, 'ABORTED'); } catch { /* ignore */ }
      return Object.freeze({
        ...confirm,
        mutated: false,
        state: TICKET_STATES.RESERVED,
      });
    }
    if (confirm.ts > claims.exp) {
      await completeMutationFence(pin, fence.grantId, 'ABORTED');
      rt.jtiStates.set(claims.jti, TICKET_STATES.EXPIRED);
      return deny(WRITER_DECISIONS.DENY_EXPIRED);
    }
    if (rt.revokedJtis.has(claims.jti)) {
      await completeMutationFence(pin, fence.grantId, 'ABORTED');
      rt.jtiStates.set(claims.jti, TICKET_STATES.REVOKED);
      return deny(WRITER_DECISIONS.DENY_REVOCATION, ['JTI_REVOKED_AT_CONFIRM']);
    }

    // Adversarial pause AFTER successful CONFIRM_ACK, BEFORE execute/mutate (RED-02).
    if (Number.isSafeInteger(rt.pauseAfterConfirmMs) && rt.pauseAfterConfirmMs > 0) {
      await new Promise((r) => globalThis['setTimeout'](r, rt.pauseAfterConfirmMs));
    }

    const execPermit = await executeMutationFence(pin, fence);
    if (!execPermit.ok) {
      const reasons = execPermit.reasons || [];
      const obsolete = reasons.some((r) => String(r).includes('POISONED')
        || String(r).includes('OBSOLETE')
        || String(r).includes('INACTIVE')
        || String(r).includes('NO_SECOND_MUTATION')
        || String(r).includes('EXECUTE_ALREADY'));
      // Unknown / obsolete fence → poison JTI so a later retry cannot mutate (RED-04).
      // Keep DENY_FENCE (not DENY_POISONED) on this attempt — DENY_POISONED after mutation is not PASS.
      if (obsolete) {
        rt.jtiStates.set(claims.jti, TICKET_STATES.POISONED);
        try { await completeMutationFence(pin, fence.grantId, 'POISONED'); } catch { /* ignore */ }
        return Object.freeze({
          ...execPermit,
          mutated: false,
          state: TICKET_STATES.POISONED,
          reasons: [...reasons, 'NO_SECOND_MUTATION'],
        });
      }
      try { await completeMutationFence(pin, fence.grantId, 'ABORTED'); } catch { /* ignore */ }
      return Object.freeze({
        ...execPermit,
        mutated: false,
        state: TICKET_STATES.RESERVED,
      });
    }
    if (rt.revokedJtis.has(claims.jti)) {
      await completeMutationFence(pin, fence.grantId, 'ABORTED');
      rt.jtiStates.set(claims.jti, TICKET_STATES.REVOKED);
      return deny(WRITER_DECISIONS.DENY_REVOCATION, ['JTI_REVOKED_AT_EXECUTE']);
    }

    // TICKET_AUTHZ_LINEARIZATION: enforce ticket nbf/exp against FENCE_EXECUTE_ACK.ts.
    // Prior freshness/grant/confirm timestamps are necessary but never sufficient here.
    const execTimeDeny = denyIfTicketOutsideAuthorityTs(
      claims,
      execPermit.ts,
      rt,
      'EXECUTE',
    );
    if (execTimeDeny) {
      try { await completeMutationFence(pin, fence.grantId, 'ABORTED'); } catch { /* ignore */ }
      return Object.freeze({
        ...execTimeDeny,
        mutated: false,
        state: rt.jtiStates.get(claims.jti) || TICKET_STATES.EXPIRED,
      });
    }

    // Adversarial pause AFTER EXECUTE_ACK, BEFORE pre-mutation tip challenge.
    if (Number.isSafeInteger(rt.pauseAfterExecuteMs) && rt.pauseAfterExecuteMs > 0) {
      await new Promise((r) => globalThis['setTimeout'](r, rt.pauseAfterExecuteMs));
    }

    // Fail closed if projected Authority time already past ticket exp before final assertion.
    {
      const earlyProjDeny = denyIfTicketExpiredAtProjectedNow(claims, rt, 'PRE_MUTATION_PRE_ASSERT');
      if (earlyProjDeny) {
        try { await completeMutationFence(pin, fence.grantId, 'ABORTED'); } catch { /* ignore */ }
        return Object.freeze({
          ...earlyProjDeny,
          mutated: false,
          state: rt.jtiStates.get(claims.jti) || TICKET_STATES.EXPIRED,
        });
      }
    }

    // Final tip assertion: signed ts ≠ receipt time. acceptAuthoritySignedTs rejects
    // delayed/stale delivery that lags projected Authority time.
    const preMutNonce = randomId(16);
    const preMutFresh = await obtainFreshnessAssertion(pin, preMutNonce);
    if (!preMutFresh.ok) {
      try { await completeMutationFence(pin, fence.grantId, 'ABORTED'); } catch { /* ignore */ }
      return Object.freeze({
        ...preMutFresh,
        mutated: false,
        state: TICKET_STATES.RESERVED,
        reasons: Object.freeze([
          ...(preMutFresh.reasons || []),
          'PRE_MUTATION_AUTHORITY_TS_UNAVAILABLE',
        ]),
      });
    }
    if (preMutFresh.tipSha !== fence.tipSha
      || preMutFresh.seq !== fence.seq
      || preMutFresh.rule02Digest !== fence.rule02Digest
      || preMutFresh.revocationEpoch !== fence.revocationEpoch) {
      try { await completeMutationFence(pin, fence.grantId, 'ABORTED'); } catch { /* ignore */ }
      return deny(WRITER_DECISIONS.DENY_TIP_DRIFT, ['PRE_MUTATION_TIP_DRIFT']);
    }
    if (rt.revokedJtis.has(claims.jti)) {
      try { await completeMutationFence(pin, fence.grantId, 'ABORTED'); } catch { /* ignore */ }
      rt.jtiStates.set(claims.jti, TICKET_STATES.REVOKED);
      return deny(WRITER_DECISIONS.DENY_REVOCATION, ['JTI_REVOKED_AT_PRE_MUTATION']);
    }
    // Signed-ts check (necessary) plus projected-time check at receipt (sufficient for delay).
    const preMutSignedDeny = denyIfTicketOutsideAuthorityTs(
      claims,
      preMutFresh.ts,
      rt,
      'PRE_MUTATION_SIGNED',
    );
    if (preMutSignedDeny) {
      try { await completeMutationFence(pin, fence.grantId, 'ABORTED'); } catch { /* ignore */ }
      return Object.freeze({
        ...preMutSignedDeny,
        mutated: false,
        state: rt.jtiStates.get(claims.jti) || TICKET_STATES.EXPIRED,
      });
    }
    const preMutReceiptDeny = denyIfTicketExpiredAtProjectedNow(
      claims,
      rt,
      'PRE_MUTATION_RECEIPT',
    );
    if (preMutReceiptDeny) {
      try { await completeMutationFence(pin, fence.grantId, 'ABORTED'); } catch { /* ignore */ }
      return Object.freeze({
        ...preMutReceiptDeny,
        mutated: false,
        state: rt.jtiStates.get(claims.jti) || TICKET_STATES.EXPIRED,
      });
    }

    // RED-02: pause AFTER receiving valid assertion, BEFORE physical write.
    if (Number.isSafeInteger(rt.pauseAfterPreMutationAssertionMs)
      && rt.pauseAfterPreMutationAssertionMs > 0) {
      await new Promise((r) => globalThis['setTimeout'](r, rt.pauseAfterPreMutationAssertionMs));
    }

    // TICKET_SIDE_EFFECT_LINEARIZATION: projected Authority time at mutation decision.
    // Physical mutate is forbidden once projected time exceeds ticket.exp — even if a
    // previously received assertion.ts was still valid at receipt.
    const sideEffectDeny = denyIfTicketExpiredAtProjectedNow(
      claims,
      rt,
      'SIDE_EFFECT',
    );
    if (sideEffectDeny) {
      try { await completeMutationFence(pin, fence.grantId, 'ABORTED'); } catch { /* ignore */ }
      return Object.freeze({
        ...sideEffectDeny,
        mutated: false,
        state: rt.jtiStates.get(claims.jti) || TICKET_STATES.EXPIRED,
      });
    }

    if (rt.crashBeforeMutate) {
      rt.jtiStates.set(claims.jti, TICKET_STATES.POISONED);
      process.exit(42);
    }

    let mutateResult;
    try {
      mutateResult = await performDisposableMutation(pin, claims.mutPath, content);
    } catch (err) {
      rt.jtiStates.set(claims.jti, TICKET_STATES.POISONED);
      const complete = await completeMutationFence(pin, fence.grantId, 'POISONED');
      return deny(WRITER_DECISIONS.DENY_POISONED, [
        'MUTATE_THROW',
        String(err && err.message || err),
        complete.ok ? 'FENCE_COMPLETED' : 'FENCE_COMPLETE_FAILED',
      ]);
    }

    if (!mutateResult.ok) {
      await completeMutationFence(pin, fence.grantId, 'ABORTED');
      return Object.freeze({
        ok: false,
        decision: mutateResult.decision,
        reasons: Object.freeze([...(mutateResult.reasons || [])]),
        mutated: false,
        state: TICKET_STATES.RESERVED,
      });
    }

    if (rt.forceAmbiguous || rt.crashAfterMutate) {
      rt.jtiStates.set(claims.jti, TICKET_STATES.POISONED);
      if (rt.crashAfterMutate) {
        process.exit(43);
      }
      await completeMutationFence(pin, fence.grantId, 'POISONED');
      return Object.freeze({
        ok: false,
        decision: WRITER_DECISIONS.DENY_POISONED,
        reasons: Object.freeze(['AMBIGUOUS_OUTCOME']),
        mutated: true,
        state: TICKET_STATES.POISONED,
      });
    }

    const complete = await completeMutationFence(pin, fence.grantId, 'COMMITTED');
    if (!complete.ok) {
      rt.jtiStates.set(claims.jti, TICKET_STATES.POISONED);
      return Object.freeze({
        ok: false,
        decision: WRITER_DECISIONS.DENY_POISONED,
        reasons: Object.freeze(['FENCE_COMPLETE_MISSING', ...(complete.reasons || [])]),
        mutated: true,
        state: TICKET_STATES.POISONED,
      });
    }

    rt.jtiStates.set(claims.jti, TICKET_STATES.COMMITTED);
    return Object.freeze({
      ok: true,
      decision: WRITER_DECISIONS.ALLOW,
      reasons: Object.freeze([]),
      mutated: true,
      state: TICKET_STATES.COMMITTED,
      target: mutateResult.target,
      fenceGrantId: fence.grantId,
    });
  } finally {
    rt.fenceBusy = false;
  }
}

export function getTicketState(pin, jti) {
  return getRuntime(pin).jtiStates.get(jti) || null;
}

export function countMutations(pin) {
  const rt = getRuntime(pin);
  let n = 0;
  for (const s of rt.jtiStates.values()) {
    if (s === TICKET_STATES.COMMITTED || s === TICKET_STATES.POISONED) n += 1;
  }
  return n;
}

function safeWrite(socket, obj) {
  try { socket.write(encodeFrame(obj)); } catch { /* ignore */ }
}

export async function createWriterIpcServer(pin, { socketPath }) {
  if (!pinBrand.has(pin)) throw new TypeError('WRITER_PIN_REQUIRED');
  const ipc = await netApi();
  const server = ipc['createServer']((socket) => {
    let buf = Buffer.alloc(0);
    socket.on('data', async (chunk) => {
      try {
        buf = Buffer.concat([buf, chunk]);
        const decoded = tryDecodeFrames(buf);
        buf = Buffer.from(decoded.rest);
        for (const msg of decoded.frames) {
          if (msg.type === MSG.TIP_UPDATE) {
            // Worker-origin tip updates on Writer socket are rejected.
            safeWrite(socket, {
              v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.ERROR, ok: false,
              decision: WRITER_DECISIONS.DENY_FRESHNESS, reasons: ['WORKER_TIP_UPDATE_FORBIDDEN'],
            });
            continue;
          }
          if (msg.type !== MSG.WRITE_REQ) {
            safeWrite(socket, {
              v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.ERROR, ok: false,
              decision: WRITER_DECISIONS.DENY_FAIL_CLOSED, reasons: ['UNEXPECTED_TYPE'],
            });
            continue;
          }
          const result = await executeAuthorizedWrite(pin, {
            ticketEncoded: msg.ticketEncoded,
            mutationRelativePath: msg.mutationRelativePath,
            mutationAbsolutePath: msg.mutationAbsolutePath,
            content: msg.content,
          });
          safeWrite(socket, {
            v: PROTOCOL_VERSION,
            kind: PROTOCOL_KIND,
            type: MSG.WRITE_RES,
            ok: result.ok,
            decision: result.decision,
            reasons: result.reasons,
            mutated: result.mutated === true,
            state: result.state,
            requestId: msg.requestId || null,
          });
        }
      } catch (err) {
        safeWrite(socket, {
          v: PROTOCOL_VERSION, kind: PROTOCOL_KIND, type: MSG.ERROR, ok: false,
          decision: WRITER_DECISIONS.DENY_FAIL_CLOSED,
          reasons: [String(err && err.message || err)],
        });
      }
    });
  });
  server.listen(socketPath);
  return server;
}

export async function runWriterMainFromFd() {
  const io = await fsApi();
  const bootstrap = JSON.parse(io.readFileSync('/dev/fd/3', 'utf8'));
  if (bootstrap.mode !== 'writer-child-v1') throw new Error('BAD_WRITER_BOOTSTRAP');
  if (bootstrap.privilegedPinInjection !== DISPOSABLE_WRITER_PIN_TOKEN) {
    throw new Error('PIN_TOKEN_REQUIRED');
  }
  io.mkdirSync(bootstrap.mutationRoot, { recursive: true });
  const pin = createWriterTrustPin({
    brokerKid: bootstrap.brokerKid,
    brokerPublicKeyPem: bootstrap.brokerPublicKeyPem,
    brokerIssuerId: bootstrap.brokerIssuerId,
    writerAudienceId: bootstrap.writerAudienceId,
    trustEpoch: bootstrap.trustEpoch,
    mutationRoot: bootstrap.mutationRoot,
    tipAuthorityPublicKeyPem: bootstrap.tipAuthorityPublicKeyPem,
    tipAuthorityId: bootstrap.tipAuthorityId,
    tipSocketPath: bootstrap.tipSocketPath,
    clockStartMs: bootstrap.clockStartMs,
  }, DISPOSABLE_WRITER_PIN_TOKEN);

  if (bootstrap.initialTipUpdate) {
    const applied = applyAuthenticatedTipUpdate(pin, bootstrap.initialTipUpdate);
    if (!applied.ok) throw new Error(`INITIAL_TIP_FAILED:${applied.decision}`);
  }
  if (bootstrap.crashAfterMutate) configureWriterCrashHooks(pin, { crashAfterMutate: true });
  if (bootstrap.crashBeforeMutate) configureWriterCrashHooks(pin, { crashBeforeMutate: true });
  if (bootstrap.forceAmbiguous) configureWriterCrashHooks(pin, { forceAmbiguous: true });
  if (Number.isSafeInteger(bootstrap.pauseAfterFenceMs) && bootstrap.pauseAfterFenceMs > 0) {
    configureWriterCrashHooks(pin, { pauseAfterFenceMs: bootstrap.pauseAfterFenceMs });
  }
  if (Number.isSafeInteger(bootstrap.pauseAfterConfirmMs) && bootstrap.pauseAfterConfirmMs > 0) {
    configureWriterCrashHooks(pin, { pauseAfterConfirmMs: bootstrap.pauseAfterConfirmMs });
  }
  if (Number.isSafeInteger(bootstrap.pauseAfterExecuteMs) && bootstrap.pauseAfterExecuteMs > 0) {
    configureWriterCrashHooks(pin, { pauseAfterExecuteMs: bootstrap.pauseAfterExecuteMs });
  }
  if (Number.isSafeInteger(bootstrap.pauseAfterPreMutationAssertionMs)
    && bootstrap.pauseAfterPreMutationAssertionMs > 0) {
    configureWriterCrashHooks(pin, {
      pauseAfterPreMutationAssertionMs: bootstrap.pauseAfterPreMutationAssertionMs,
    });
  }

  const server = await createWriterIpcServer(pin, { socketPath: bootstrap.socketPath });
  await new Promise((resolveListening, reject) => {
    server.once('listening', resolveListening);
    server.once('error', reject);
  });
  void deferMs;
  const shutdown = () => {
    try { server.close(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.stdout.write(`${JSON.stringify({ ok: true, pid: process.pid, role: 'writer' })}\n`);
}

const isMain = process.argv[1] && /isolatedWriteExecutor\.js$/.test(process.argv[1]);
if (isMain && process.argv.includes('--dlp012-writer')) {
  runWriterMainFromFd().catch((err) => {
    process.stderr.write(`${String(err && err.stack || err)}\n`);
    process.exit(1);
  });
}

export {
  tipUpdatePayload,
  tipAssertionPayload,
  DLP012_SLICE_ID,
  DLP012_NATIVE_OPERATION,
  DLP012_AUTHORIZED_FILE_SCOPE,
};
