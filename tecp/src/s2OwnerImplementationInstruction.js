/**
 * TECP-OPS S2 Owner Implementation Instruction (OFFLINE_IMPLEMENTATION).
 *
 * Bootstrap / verify-only contract for offline repository implementation authorization.
 * Distinct KIND/DOMAIN/PURPOSE from DLP011 and from S2 live Tier-3 capabilities.
 * Real Owner key custody / enrollment is NOT performed by this module.
 * Public constructors cannot brand trust material.
 */

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
  createHash,
  timingSafeEqual,
} from 'node:crypto';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join as pathJoin } from 'node:path';

import { canonicalJson } from './workerCapabilityToken.js';

export const S2_OWNER_INSTRUCTION_KIND = 'TECP_OPS_S2_OWNER_IMPLEMENTATION_INSTRUCTION_V1';
export const S2_OWNER_INSTRUCTION_DOMAIN = 'TECP-OPS-S2-OWNER-IMPLEMENTATION-INSTRUCTION-V1';
export const S2_OWNER_INSTRUCTION_ALG = 'Ed25519';
export const S2_OWNER_INSTRUCTION_PURPOSE = 'OFFLINE_IMPLEMENTATION';
export const S2_OWNER_INSTRUCTION_REPOSITORY_ID = 'sepehrraeisi/TitanGold';
export const S2_OWNER_INSTRUCTION_MAX_TTL_MS = 5 * 60 * 1000;
export const S2_OWNER_INSTRUCTION_MAX_CHARS = 32 * 1024;
export const S2_IMPL_TRUST_REGISTRY_RELATIVE_DIR = '.tecp-ops-pilot/s2-impl-owner-trust';
export const S2_IMPL_TRUST_PUBKEY_FILENAME = 'owner-impl-ed25519.pub';
export const S2_IMPL_TRUST_KID_FILENAME = 'owner-impl-kid.txt';
export const S2_IMPL_TRUST_JTI_DIRNAME = 'jti-consumed';
export const S2_IMPL_TRUST_REVOKED_FILENAME = 'jti-revoked.txt';
export const S2_IMPL_OWNER_INSTALLED_TRUST_PROOF_CLASS = 'S2_IMPL_OWNER_INSTALLED_FIXED_TRUST_VERIFIER_DEPS_V1';
export const S2_IMPL_TEST_ONLY_TRUST_PROOF_CLASS = 'S2_IMPL_TEST_ONLY_TRUST_VERIFIER_DEPS_V1';

export const S2_OWNER_INSTRUCTION_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MISSING_DEPS: 'DENY_MISSING_DEPS',
  DENY_MALFORMED: 'DENY_MALFORMED',
  DENY_OVERSIZED: 'DENY_OVERSIZED',
  DENY_UNSUPPORTED_ALGORITHM: 'DENY_UNSUPPORTED_ALGORITHM',
  DENY_UNKNOWN_ISSUER_OR_KID: 'DENY_UNKNOWN_ISSUER_OR_KID',
  DENY_DISABLED_ISSUER_KEY: 'DENY_DISABLED_ISSUER_KEY',
  DENY_INVALID_SIGNATURE: 'DENY_INVALID_SIGNATURE',
  DENY_NONCANONICAL_ENCODING: 'DENY_NONCANONICAL_ENCODING',
  DENY_WRONG_REPOSITORY: 'DENY_WRONG_REPOSITORY',
  DENY_WRONG_SLICE: 'DENY_WRONG_SLICE',
  DENY_WRONG_SHA: 'DENY_WRONG_SHA',
  DENY_WRONG_DIGEST: 'DENY_WRONG_DIGEST',
  DENY_WRONG_SCOPE: 'DENY_WRONG_SCOPE',
  DENY_WRONG_OPERATION: 'DENY_WRONG_OPERATION',
  DENY_WRONG_GOVERNANCE_REVISION: 'DENY_WRONG_GOVERNANCE_REVISION',
  DENY_WRONG_PURPOSE: 'DENY_WRONG_PURPOSE',
  DENY_WRONG_KIND_OR_DOMAIN: 'DENY_WRONG_KIND_OR_DOMAIN',
  DENY_NOT_YET_VALID: 'DENY_NOT_YET_VALID',
  DENY_EXPIRED: 'DENY_EXPIRED',
  DENY_EXCESSIVE_TTL: 'DENY_EXCESSIVE_TTL',
  DENY_REVOKED_JTI: 'DENY_REVOKED_JTI',
  DENY_REPLAYED_JTI: 'DENY_REPLAYED_JTI',
  DENY_REVOCATION_UNAVAILABLE: 'DENY_REVOCATION_UNAVAILABLE',
  DENY_CLOCK_UNAVAILABLE: 'DENY_CLOCK_UNAVAILABLE',
  DENY_CALLER_SUPPLIED_TRUST: 'DENY_CALLER_SUPPLIED_TRUST',
  DENY_OWNER_TRUST_MISSING: 'DENY_OWNER_TRUST_MISSING',
  DENY_PRIVATE_KEY_IN_TRUST: 'DENY_PRIVATE_KEY_IN_TRUST',
  DENY_UNKNOWN_SIGNED_FIELD: 'DENY_UNKNOWN_SIGNED_FIELD',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
});

const CLAIM_KEY_ORDER = Object.freeze([
  'alg', 'authorizedFileScope', 'canonicalSha', 'domain', 'exp', 'governanceRevision',
  'iat', 'iss', 'jti', 'kid', 'kind', 'nbf', 'operationClass', 'purpose', 'repositoryId',
  'rule02DigestSha256', 'sliceId',
]);

const keyRegistryBrand = new WeakSet();
const revocationBrand = new WeakSet();
const clockBrand = new WeakSet();
const verifierBrand = new WeakSet();
const verifiedInstructionBrand = new WeakSet();
const ownerInstalledTrustBrand = new WeakSet();
const testOnlyTrustBrand = new WeakSet();
let privilegedDepth = 0;

function assertPrivileged() {
  if (privilegedDepth <= 0) throw new TypeError('PRIVILEGED_S2_INSTRUCTION_CONSTRUCTION_REQUIRED');
}
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
}
function isNonEmptyString(v) { return typeof v === 'string' && v.length > 0; }
function deny(decision, reasons = [decision]) {
  return Object.freeze({
    ok: false, decision, reasons: Object.freeze([...reasons]),
    instruction: null, operational: false, purpose: S2_OWNER_INSTRUCTION_PURPOSE,
  });
}
export function sha256Hex(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}
export function safeEqualHex(a, b) {
  if (!isNonEmptyString(a) || !isNonEmptyString(b) || a.length !== b.length || a.length % 2 !== 0) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch { return false; }
}
function b64urlEncode(buf) { return Buffer.from(buf).toString('base64url'); }
function b64urlDecode(text) {
  if (!isNonEmptyString(text) || text.includes('=') || text.includes('+') || text.includes('/')) return null;
  try { return Buffer.from(text, 'base64url'); } catch { return null; }
}
function stableScope(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return null;
  const out = [];
  for (const p of paths) {
    if (!isNonEmptyString(p) || p.includes('\0') || p.includes('\\') || p.split('/').includes('..') || p.startsWith('/')) return null;
    out.push(p);
  }
  return Object.freeze([...new Set(out)].sort());
}
function scopesEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}
function orderedClaims(claims) {
  const out = {};
  for (const key of CLAIM_KEY_ORDER) {
    if (Object.prototype.hasOwnProperty.call(claims, key) && claims[key] !== undefined) out[key] = claims[key];
  }
  return out;
}
function signingPayload(claims) {
  return `${S2_OWNER_INSTRUCTION_DOMAIN}\n${canonicalJson(orderedClaims(claims))}`;
}

export function withPrivilegedS2InstructionConstruction(fn) {
  if (typeof fn !== 'function') throw new TypeError('CONSTRUCTION_CALLBACK_REQUIRED');
  privilegedDepth += 1;
  try { return fn(); } finally { privilegedDepth -= 1; }
}

export function generateEphemeralS2InstructionKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return Object.freeze({
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    algorithm: S2_OWNER_INSTRUCTION_ALG,
  });
}

function createKeyRegistryInternal(entries = []) {
  assertPrivileged();
  const byKid = new Map();
  for (const entry of entries) {
    if (!isPlainObject(entry) || !isNonEmptyString(entry.kid) || !isNonEmptyString(entry.issuer) || !isNonEmptyString(entry.publicKeyPem)) {
      throw new TypeError('INVALID_S2_INSTRUCTION_KEY_ENTRY');
    }
    if (/BEGIN .*PRIVATE KEY/i.test(entry.publicKeyPem)) throw new TypeError('PRIVATE_KEY_IN_PUBLIC_SLOT');
    byKid.set(entry.kid, Object.freeze({
      kid: entry.kid, issuer: entry.issuer,
      algorithm: entry.algorithm || S2_OWNER_INSTRUCTION_ALG,
      publicKeyPem: entry.publicKeyPem,
      privateKeyPem: entry.privateKeyPem || null,
      status: entry.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
    }));
  }
  const registry = Object.freeze({
    kind: 'TECP_OPS_S2_OWNER_INSTRUCTION_KEY_REGISTRY',
    lookup(kid) {
      const entry = byKid.get(kid);
      if (!entry) return Object.freeze({ ok: false, reason: 'UNKNOWN_KID' });
      return Object.freeze({ ok: true, entry });
    },
  });
  keyRegistryBrand.add(registry);
  return registry;
}

function createRevocationRegistryInternal() {
  assertPrivileged();
  const revoked = new Set();
  const consumed = new Set();
  const registry = Object.freeze({
    kind: 'TECP_OPS_S2_OWNER_INSTRUCTION_REVOCATION_REGISTRY',
    durable: false,
    atomicConsume: true,
    processLocalOnly: true,
    revokeJti(jti) { if (!isNonEmptyString(jti)) throw new TypeError('JTI_REQUIRED'); revoked.add(jti); },
    isRevoked(jti) { return revoked.has(jti); },
    /** Synchronous check-and-set; atomic for sync callers on one Node event-loop. */
    consumeJti(jti) {
      if (!isNonEmptyString(jti)) return false;
      if (revoked.has(jti) || consumed.has(jti)) return false;
      consumed.add(jti);
      return true;
    },
    isConsumed(jti) { return consumed.has(jti); },
  });
  revocationBrand.add(registry);
  return registry;
}

function createClockInternal(startMs = 1_700_000_000_000) {
  assertPrivileged();
  let now = startMs;
  const clock = Object.freeze({
    kind: 'TECP_OPS_S2_OWNER_INSTRUCTION_CLOCK',
    now() { return now; },
    set(ms) { if (!Number.isSafeInteger(ms)) throw new TypeError('INVALID_CLOCK'); now = ms; },
    advance(ms) { if (!Number.isSafeInteger(ms) || ms < 0) throw new TypeError('INVALID_ADVANCE'); now += ms; },
  });
  clockBrand.add(clock);
  return clock;
}

function createUnavailableClockInternal() {
  assertPrivileged();
  const clock = Object.freeze({
    kind: 'TECP_OPS_S2_OWNER_INSTRUCTION_CLOCK',
    now() { throw new Error('CLOCK_UNAVAILABLE'); },
    set() { throw new Error('CLOCK_UNAVAILABLE'); },
    advance() { throw new Error('CLOCK_UNAVAILABLE'); },
  });
  clockBrand.add(clock);
  return clock;
}

function createVerifierInternal(deps) {
  assertPrivileged();
  if (!isPlainObject(deps) || !keyRegistryBrand.has(deps.keyRegistry)
    || !revocationBrand.has(deps.revocationRegistry) || !clockBrand.has(deps.clock)) {
    throw new TypeError('TRUSTED_S2_INSTRUCTION_VERIFIER_DEPS_REQUIRED');
  }
  const consumeOnAllow = deps.consumeOnAllow === true;
  const verifier = Object.freeze({
    kind: 'TECP_OPS_S2_OWNER_INSTRUCTION_VERIFIER',
    consumeOnAllow,
    verify(encoded, expectation) {
      return verifyS2OwnerImplementationInstruction(encoded, expectation, {
        keyRegistry: deps.keyRegistry,
        revocationRegistry: deps.revocationRegistry,
        clock: deps.clock,
        consumeOnAllow,
      });
    },
  });
  verifierBrand.add(verifier);
  return verifier;
}

export function getPrivilegedS2InstructionConstructors() {
  assertPrivileged();
  return Object.freeze({
    createKeyRegistry: createKeyRegistryInternal,
    createRevocationRegistry: createRevocationRegistryInternal,
    createClock: createClockInternal,
    createUnavailableClock: createUnavailableClockInternal,
    createVerifier: createVerifierInternal,
  });
}

export function createS2InstructionKeyRegistry() { throw new TypeError('PUBLIC_S2_INSTRUCTION_KEY_REGISTRY_CONSTRUCTION_FORBIDDEN'); }
export function createS2InstructionRevocationRegistry() { throw new TypeError('PUBLIC_S2_INSTRUCTION_REVOCATION_REGISTRY_CONSTRUCTION_FORBIDDEN'); }
export function createS2InstructionClock() { throw new TypeError('PUBLIC_S2_INSTRUCTION_CLOCK_CONSTRUCTION_FORBIDDEN'); }
export function createS2InstructionVerifier() { throw new TypeError('PUBLIC_S2_INSTRUCTION_VERIFIER_CONSTRUCTION_FORBIDDEN'); }

export function isBrandedS2InstructionKeyRegistry(v) { return keyRegistryBrand.has(v); }
export function isBrandedS2InstructionRevocationRegistry(v) { return revocationBrand.has(v); }
export function isBrandedS2InstructionClock(v) { return clockBrand.has(v); }
export function isBrandedS2InstructionVerifier(v) { return verifierBrand.has(v); }
export function isBrandedVerifiedS2OwnerInstruction(v) { return verifiedInstructionBrand.has(v); }
export function isOwnerInstalledS2ImplTrustDeps(v) { return ownerInstalledTrustBrand.has(v); }
export function isTestOnlyS2ImplTrustDeps(v) { return testOnlyTrustBrand.has(v); }

export function resolveS2ImplOwnerTrustRegistryPath() {
  const dir = pathJoin(homedir(), S2_IMPL_TRUST_REGISTRY_RELATIVE_DIR);
  return Object.freeze({
    dir,
    pubkeyPath: pathJoin(dir, S2_IMPL_TRUST_PUBKEY_FILENAME),
    kidPath: pathJoin(dir, S2_IMPL_TRUST_KID_FILENAME),
    revokedPath: pathJoin(dir, S2_IMPL_TRUST_REVOKED_FILENAME),
    jtiDir: pathJoin(dir, S2_IMPL_TRUST_JTI_DIRNAME),
  });
}

function assertSafeJtiFileToken(jti) {
  if (!isNonEmptyString(jti) || jti.length > 128 || !/^[A-Za-z0-9_-]+$/.test(jti)) {
    throw new TypeError('UNSAFE_JTI_TOKEN');
  }
  return jti;
}

/** Owner-trust durable JTI registry using O_EXCL create for atomic consume. */
function createDurableOwnerJtiRegistry(paths) {
  assertPrivileged();
  if (!existsSync(paths.dir)) throw new TypeError('OWNER_TRUST_DIR_MISSING');
  mkdirSync(paths.jtiDir, { recursive: true });
  const registry = Object.freeze({
    kind: 'TECP_OPS_S2_OWNER_INSTRUCTION_DURABLE_REVOCATION_REGISTRY',
    durable: true,
    atomicConsume: true,
    revokeJti(jti) {
      const token = assertSafeJtiFileToken(jti);
      const existing = existsSync(paths.revokedPath) ? readFileSync(paths.revokedPath, 'utf8') : '';
      const lines = new Set(existing.split(/\r?\n/).filter(Boolean));
      lines.add(token);
      writeFileSync(paths.revokedPath, `${[...lines].sort().join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
    },
    isRevoked(jti) {
      const token = assertSafeJtiFileToken(jti);
      if (!existsSync(paths.revokedPath)) return false;
      const lines = new Set(readFileSync(paths.revokedPath, 'utf8').split(/\r?\n/).filter(Boolean));
      return lines.has(token);
    },
    consumeJti(jti) {
      const token = assertSafeJtiFileToken(jti);
      if (registry.isRevoked(token)) return false;
      const target = pathJoin(paths.jtiDir, token);
      try {
        const fd = openSync(target, 'wx', 0o600);
        try { writeFileSync(fd, `${Date.now()}\n`); } finally { closeSync(fd); }
        return true;
      } catch (err) {
        if (err && (err.code === 'EEXIST' || err.code === 'EPERM')) return false;
        throw err;
      }
    },
    isConsumed(jti) {
      const token = assertSafeJtiFileToken(jti);
      return existsSync(pathJoin(paths.jtiDir, token));
    },
  });
  revocationBrand.add(registry);
  return registry;
}

/** Owner-installed verify-only deps. Never accepts caller path/key overrides. */
export function createOwnerInstalledS2ImplTrustDeps(options = {}) {
  if (options == null || typeof options !== 'object' || Array.isArray(options)) {
    return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_CALLER_SUPPLIED_TRUST, ['OPTIONS_OBJECT_REQUIRED']);
  }
  for (const key of ['home', 'trustHome', 'publicKey', 'pubkeyPem', 'kid', 'keyRegistry', 'pubkeyPath', 'kidPath', 'dir']) {
    if (options[key] != null) {
      return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_CALLER_SUPPLIED_TRUST, [`FORBIDDEN_OPTION=${key}`]);
    }
  }
  const paths = resolveS2ImplOwnerTrustRegistryPath();
  if (!existsSync(paths.pubkeyPath) || !existsSync(paths.kidPath)) {
    return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_OWNER_TRUST_MISSING, ['OWNER_IMPL_TRUST_REGISTRY_MISSING']);
  }
  let pubkeyPem; let kid;
  try {
    pubkeyPem = readFileSync(paths.pubkeyPath, 'utf8');
    kid = readFileSync(paths.kidPath, 'utf8').trim();
  } catch (err) {
    return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_OWNER_TRUST_MISSING, ['OWNER_IMPL_TRUST_UNREADABLE', String(err.message || err)]);
  }
  if (!isNonEmptyString(pubkeyPem) || !isNonEmptyString(kid)) {
    return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_OWNER_TRUST_MISSING, ['OWNER_IMPL_TRUST_EMPTY']);
  }
  if (/BEGIN .*PRIVATE KEY/i.test(pubkeyPem)) {
    return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_PRIVATE_KEY_IN_TRUST, ['PRIVATE_KEY_FORBIDDEN_IN_TRUST_REGISTRY']);
  }
  // Brand via privileged constructors without exposing private keys.
  return withPrivilegedS2InstructionConstruction(() => {
    const ctors = getPrivilegedS2InstructionConstructors();
    const keyRegistry = ctors.createKeyRegistry([{
      kid, issuer: 'titangold-owner-s2-impl-offline', publicKeyPem: pubkeyPem, status: 'ACTIVE',
    }]);
    let revocationRegistry;
    try {
      revocationRegistry = createDurableOwnerJtiRegistry(paths);
    } catch (err) {
      return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_REVOCATION_UNAVAILABLE, [
        'OWNER_DURABLE_JTI_REGISTRY_UNAVAILABLE', String(err && err.message || err),
      ]);
    }
    const clock = ctors.createClock(Date.now());
    const verifier = ctors.createVerifier({ keyRegistry, revocationRegistry, clock, consumeOnAllow: true });
    const deps = Object.freeze({
      proofClass: S2_IMPL_OWNER_INSTALLED_TRUST_PROOF_CLASS,
      keyRegistry, revocationRegistry, clock, verifier,
      installedKid: kid, trustRegistryPaths: paths, consumeOnAllow: true,
      durableReplay: true, atomicReplay: true,
    });
    ownerInstalledTrustBrand.add(deps);
    return deps;
  });
}

/** TEST_ONLY trust bundle for offline unit tests. Privileged latch required. */
export function createTestOnlyS2ImplTrustDeps(config = {}) {
  assertPrivileged();
  const keys = config.keyPair || generateEphemeralS2InstructionKeyPair();
  const kid = config.kid || 's2-impl-test-ed25519-1';
  const issuer = config.issuer || 'titangold-owner-s2-impl-test-only';
  const ctors = getPrivilegedS2InstructionConstructors();
  const keyRegistry = ctors.createKeyRegistry([{
    kid, issuer, publicKeyPem: keys.publicKeyPem, privateKeyPem: keys.privateKeyPem, status: 'ACTIVE',
  }]);
  const revocationRegistry = ctors.createRevocationRegistry();
  const clock = config.unavailableClock ? ctors.createUnavailableClock() : ctors.createClock(config.startMs || 1_700_000_000_000);
  const verifier = ctors.createVerifier({
    keyRegistry, revocationRegistry, clock, consumeOnAllow: config.consumeOnAllow !== false,
  });
  const deps = Object.freeze({
    proofClass: S2_IMPL_TEST_ONLY_TRUST_PROOF_CLASS,
    keyRegistry, revocationRegistry, clock, verifier,
    installedKid: kid, issuer, keyPair: keys, consumeOnAllow: config.consumeOnAllow !== false,
    testOnly: true,
  });
  testOnlyTrustBrand.add(deps);
  return deps;
}

/** Issue is TEST_ONLY / privileged. Runtime production path is verify-only. */
export function issueS2OwnerImplementationInstruction(request, deps) {
  if (!isPlainObject(request) || !isPlainObject(deps)) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['REQUEST_OR_DEPS_REQUIRED']);
  if (!keyRegistryBrand.has(deps.keyRegistry) || !clockBrand.has(deps.clock)) {
    return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MISSING_DEPS, ['TRUSTED_DEPS_REQUIRED']);
  }
  if (request.purpose !== S2_OWNER_INSTRUCTION_PURPOSE) {
    return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_PURPOSE, ['PURPOSE_MUST_BE_OFFLINE_IMPLEMENTATION']);
  }
  const scope = stableScope(request.authorizedFileScope);
  const required = ['repositoryId', 'canonicalSha', 'rule02DigestSha256', 'sliceId', 'operationClass', 'governanceRevision', 'issuer', 'kid'];
  for (const k of required) {
    if (!isNonEmptyString(request[k])) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, [`MISSING_${k}`]);
  }
  if (!scope) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['SCOPE']);
  const lookup = deps.keyRegistry.lookup(request.kid);
  if (!lookup.ok) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_UNKNOWN_ISSUER_OR_KID, ['UNKNOWN_KID']);
  if (lookup.entry.issuer !== request.issuer) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_UNKNOWN_ISSUER_OR_KID, ['ISSUER_MISMATCH']);
  if (lookup.entry.status !== 'ACTIVE') return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_DISABLED_ISSUER_KEY);
  if (lookup.entry.algorithm !== S2_OWNER_INSTRUCTION_ALG || !lookup.entry.privateKeyPem) {
    return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_UNSUPPORTED_ALGORITHM, ['SIGNING_KEY_UNAVAILABLE']);
  }
  let now;
  try { now = deps.clock.now(); } catch { return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_CLOCK_UNAVAILABLE); }
  if (!Number.isSafeInteger(now)) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_CLOCK_UNAVAILABLE);
  const ttlMs = Number.isSafeInteger(request.ttlMs) ? request.ttlMs : S2_OWNER_INSTRUCTION_MAX_TTL_MS;
  if (ttlMs <= 0 || ttlMs > S2_OWNER_INSTRUCTION_MAX_TTL_MS) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_EXCESSIVE_TTL);
  const nbf = Number.isSafeInteger(request.nbf) ? request.nbf : now;
  const claims = {
    alg: S2_OWNER_INSTRUCTION_ALG,
    authorizedFileScope: scope,
    canonicalSha: request.canonicalSha,
    domain: S2_OWNER_INSTRUCTION_DOMAIN,
    exp: now + ttlMs,
    governanceRevision: request.governanceRevision,
    iat: now,
    iss: request.issuer,
    jti: request.jti || randomBytes(16).toString('hex'),
    kid: request.kid,
    kind: S2_OWNER_INSTRUCTION_KIND,
    nbf,
    operationClass: request.operationClass,
    purpose: S2_OWNER_INSTRUCTION_PURPOSE,
    repositoryId: request.repositoryId,
    rule02DigestSha256: request.rule02DigestSha256,
    sliceId: request.sliceId,
  };
  let payload;
  try { payload = signingPayload(claims); } catch { return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['CANONICALIZATION_FAILED']); }
  if (payload.length > S2_OWNER_INSTRUCTION_MAX_CHARS) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_OVERSIZED);
  const signature = sign(null, Buffer.from(payload, 'utf8'), createPrivateKey(lookup.entry.privateKeyPem));
  const encoded = `${b64urlEncode(Buffer.from(payload, 'utf8'))}.${b64urlEncode(signature)}`;
  if (encoded.length > S2_OWNER_INSTRUCTION_MAX_CHARS) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_OVERSIZED);
  return Object.freeze({
    ok: true, decision: S2_OWNER_INSTRUCTION_DECISIONS.ALLOW, reasons: Object.freeze([]),
    instruction: Object.freeze({ kind: S2_OWNER_INSTRUCTION_KIND, encoded, claims: Object.freeze({ ...claims, authorizedFileScope: scope }) }),
    operational: false, purpose: S2_OWNER_INSTRUCTION_PURPOSE, testOnly: true,
  });
}

export function verifyS2OwnerImplementationInstruction(encodedInstruction, expectation, deps) {
  if (!isPlainObject(deps) || !keyRegistryBrand.has(deps.keyRegistry)
    || !revocationBrand.has(deps.revocationRegistry) || !clockBrand.has(deps.clock)) {
    return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MISSING_DEPS, ['TRUSTED_DEPS_REQUIRED']);
  }
  for (const k of ['publicKeyPem', 'privateKeyPem', 'verificationKey', 'keyRegistryOverride']) {
    if (Object.prototype.hasOwnProperty.call(deps, k)) {
      return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_CALLER_SUPPLIED_TRUST, [`FORBIDDEN_DEP_KEY=${k}`]);
    }
  }
  if (!isPlainObject(expectation)) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['EXPECTATION_REQUIRED']);
  if (!isNonEmptyString(encodedInstruction) || encodedInstruction.length > S2_OWNER_INSTRUCTION_MAX_CHARS) {
    return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_OVERSIZED, ['INSTRUCTION_SIZE']);
  }
  const parts = encodedInstruction.split('.');
  if (parts.length !== 2) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['ENCODING_SHAPE']);
  const payloadBuf = b64urlDecode(parts[0]);
  const sigBuf = b64urlDecode(parts[1]);
  if (!payloadBuf || !sigBuf) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['B64URL_DECODE']);
  const payloadText = payloadBuf.toString('utf8');
  const nl = payloadText.indexOf('\n');
  if (nl <= 0) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['DOMAIN_SEPARATOR']);
  const domain = payloadText.slice(0, nl);
  const jsonPart = payloadText.slice(nl + 1);
  if (domain !== S2_OWNER_INSTRUCTION_DOMAIN) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_KIND_OR_DOMAIN, ['WRONG_DOMAIN']);
  let claims;
  try { claims = JSON.parse(jsonPart); } catch { return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['JSON_PARSE']); }
  if (!isPlainObject(claims)) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['CLAIMS_NOT_OBJECT']);
  for (const key of Object.keys(claims)) {
    if (!CLAIM_KEY_ORDER.includes(key)) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_UNKNOWN_SIGNED_FIELD, [`UNKNOWN_FIELD=${key}`]);
  }
  let expectedCanonical;
  try { expectedCanonical = signingPayload(claims); } catch { return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['CANONICALIZATION_FAILED']); }
  if (expectedCanonical !== payloadText) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_NONCANONICAL_ENCODING);
  if (claims.alg !== S2_OWNER_INSTRUCTION_ALG || claims.kind !== S2_OWNER_INSTRUCTION_KIND
    || claims.domain !== S2_OWNER_INSTRUCTION_DOMAIN || claims.purpose !== S2_OWNER_INSTRUCTION_PURPOSE) {
    return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_KIND_OR_DOMAIN, ['CLAIM_META']);
  }
  for (const key of ['iss', 'kid', 'jti', 'repositoryId', 'canonicalSha', 'rule02DigestSha256', 'sliceId', 'operationClass', 'governanceRevision']) {
    if (!isNonEmptyString(claims[key])) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, [`MISSING_${key}`]);
  }
  const scope = stableScope(claims.authorizedFileScope);
  if (!scope) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['SCOPE']);
  if (!Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) || !Number.isSafeInteger(claims.nbf)) {
    return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['TIME_CLAIMS']);
  }
  if (claims.exp - claims.iat > S2_OWNER_INSTRUCTION_MAX_TTL_MS || claims.exp <= claims.iat) {
    return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_EXCESSIVE_TTL);
  }
  if (claims.repositoryId !== expectation.repositoryId) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_REPOSITORY);
  if (claims.sliceId !== expectation.sliceId) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_SLICE);
  if (claims.canonicalSha !== expectation.canonicalSha) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_SHA);
  if (claims.rule02DigestSha256 !== expectation.rule02DigestSha256) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_DIGEST);
  if (claims.operationClass !== expectation.operationClass) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_OPERATION);
  if (claims.governanceRevision !== expectation.governanceRevision) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_GOVERNANCE_REVISION);
  const expectedScope = stableScope(expectation.authorizedFileScope);
  if (!expectedScope || !scopesEqual(scope, expectedScope)) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_SCOPE);
  let now;
  try { now = deps.clock.now(); } catch { return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_CLOCK_UNAVAILABLE); }
  if (!Number.isSafeInteger(now)) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_CLOCK_UNAVAILABLE);
  if (now < claims.nbf || now < claims.iat) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_NOT_YET_VALID);
  if (now >= claims.exp) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_EXPIRED);
  let revoked;
  try { revoked = deps.revocationRegistry.isRevoked(claims.jti); } catch { return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_REVOCATION_UNAVAILABLE); }
  if (revoked) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_REVOKED_JTI);
  try {
    if (deps.revocationRegistry.isConsumed(claims.jti)) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_REPLAYED_JTI);
  } catch { return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_REVOCATION_UNAVAILABLE); }
  const lookup = deps.keyRegistry.lookup(claims.kid);
  if (!lookup.ok) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_UNKNOWN_ISSUER_OR_KID);
  if (lookup.entry.issuer !== claims.iss) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_UNKNOWN_ISSUER_OR_KID, ['ISSUER_MISMATCH']);
  if (lookup.entry.status !== 'ACTIVE') return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_DISABLED_ISSUER_KEY);
  if (lookup.entry.algorithm !== S2_OWNER_INSTRUCTION_ALG) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_UNSUPPORTED_ALGORITHM);
  let signatureOk = false;
  try {
    signatureOk = verify(null, Buffer.from(expectedCanonical, 'utf8'), createPublicKey(lookup.entry.publicKeyPem), sigBuf);
  } catch { return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_INVALID_SIGNATURE); }
  if (!signatureOk) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_INVALID_SIGNATURE);
  if (deps.consumeOnAllow === true) {
    let consumed;
    try { consumed = deps.revocationRegistry.consumeJti(claims.jti); }
    catch { return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_REVOCATION_UNAVAILABLE); }
    if (!consumed) return deny(S2_OWNER_INSTRUCTION_DECISIONS.DENY_REPLAYED_JTI, ['CONSUME_LOST_RACE']);
  }
  const instruction = Object.freeze({
    kind: S2_OWNER_INSTRUCTION_KIND,
    jti: claims.jti,
    claims: Object.freeze({ ...orderedClaims(claims), authorizedFileScope: scope }),
  });
  verifiedInstructionBrand.add(instruction);
  return Object.freeze({
    ok: true, decision: S2_OWNER_INSTRUCTION_DECISIONS.ALLOW, reasons: Object.freeze([]),
    instruction, operational: false, purpose: S2_OWNER_INSTRUCTION_PURPOSE,
  });
}
