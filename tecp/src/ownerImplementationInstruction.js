/**
 * TECP-DLP-011 — Owner Implementation Instruction (TEST_ONLY / NON_OPERATIONAL).
 *
 * Cryptographic issue/verify primitives for Owner implementation instructions.
 * Branding factories are module-private and reachable only through the sealed
 * disposable trust-root injector in effectiveImplementationAuthorizationGate.js.
 *
 * Process-local brands are NOT cryptographic OS/Owner identity.
 * Real Owner key custody is NOT implemented.
 */

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
  timingSafeEqual,
  createHash,
} from 'node:crypto';

import { canonicalJson } from './workerCapabilityToken.js';

export const OWNER_INSTRUCTION_KIND = 'TECP_DLP011_OWNER_IMPLEMENTATION_INSTRUCTION';
export const OWNER_INSTRUCTION_DOMAIN = 'TECP-DLP-011-OWNER-IMPLEMENTATION-INSTRUCTION-V1';
export const OWNER_INSTRUCTION_ALG = 'Ed25519';
export const OWNER_INSTRUCTION_PURPOSE = 'TEST_ONLY';

export const OWNER_INSTRUCTION_DECISIONS = Object.freeze({
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
  DENY_WRONG_WORKER: 'DENY_WRONG_WORKER',
  DENY_WRONG_TASK: 'DENY_WRONG_TASK',
  DENY_NOT_YET_VALID: 'DENY_NOT_YET_VALID',
  DENY_EXPIRED: 'DENY_EXPIRED',
  DENY_EXCESSIVE_TTL: 'DENY_EXCESSIVE_TTL',
  DENY_REVOKED_JTI: 'DENY_REVOKED_JTI',
  DENY_REPLAYED_JTI: 'DENY_REPLAYED_JTI',
  DENY_REVOCATION_UNAVAILABLE: 'DENY_REVOCATION_UNAVAILABLE',
  DENY_KEY_REGISTRY_UNAVAILABLE: 'DENY_KEY_REGISTRY_UNAVAILABLE',
  DENY_CLOCK_UNAVAILABLE: 'DENY_CLOCK_UNAVAILABLE',
  DENY_UNBRANDED_VERIFIER: 'DENY_UNBRANDED_VERIFIER',
  DENY_CALLER_SUPPLIED_VERIFICATION_MATERIAL: 'DENY_CALLER_SUPPLIED_VERIFICATION_MATERIAL',
});

export const MAX_OWNER_INSTRUCTION_TTL_MS = 5 * 60 * 1000;
export const MAX_OWNER_INSTRUCTION_CHARS = 32 * 1024;

const CLAIM_KEY_ORDER = Object.freeze([
  'alg',
  'authorizedFileScope',
  'canonicalSha',
  'domain',
  'exp',
  'governanceRevision',
  'iat',
  'iss',
  'jti',
  'kid',
  'kind',
  'operationClass',
  'purpose',
  'repositoryId',
  'rule02DigestSha256',
  'sliceId',
  'taskId',
  'workerId',
]);

const verifierBrand = new WeakSet();
const keyRegistryBrand = new WeakSet();
const revocationBrand = new WeakSet();
const clockBrand = new WeakSet();
const verifiedInstructionBrand = new WeakSet();

/** Sealed construction latch — only the gate trust-root injector may open it. */
let privilegedConstructionDepth = 0;

function assertPrivilegedConstruction() {
  if (privilegedConstructionDepth <= 0) {
    throw new TypeError('PRIVILEGED_OWNER_INSTRUCTION_CONSTRUCTION_REQUIRED');
  }
}

/**
 * Run `fn` with privileged branding factories enabled.
 * Invoked only by the disposable trust-root injector (same-process privilege).
 */
export function withPrivilegedOwnerInstructionConstruction(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('CONSTRUCTION_CALLBACK_REQUIRED');
  }
  privilegedConstructionDepth += 1;
  try {
    return fn();
  } finally {
    privilegedConstructionDepth -= 1;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function deny(decision, reasons = [decision]) {
  return Object.freeze({
    ok: false,
    decision,
    reasons: Object.freeze([...reasons]),
    instruction: null,
    operational: false,
    purpose: OWNER_INSTRUCTION_PURPOSE,
  });
}

function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64url');
}

function b64urlDecode(text) {
  if (!isNonEmptyString(text) || text.includes('=') || text.includes('+') || text.includes('/')) {
    return null;
  }
  try {
    return Buffer.from(text, 'base64url');
  } catch {
    return null;
  }
}

function stableScope(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return null;
  const out = [];
  for (const p of paths) {
    if (!isNonEmptyString(p) || p.includes('\0') || p.includes('..')) return null;
    out.push(p);
  }
  return Object.freeze([...new Set(out)].sort());
}

function scopesEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function orderedClaims(claims) {
  const out = {};
  for (const key of CLAIM_KEY_ORDER) {
    if (Object.prototype.hasOwnProperty.call(claims, key) && claims[key] !== undefined) {
      out[key] = claims[key];
    }
  }
  return out;
}

function signingPayload(claims) {
  return `${OWNER_INSTRUCTION_DOMAIN}\n${canonicalJson(orderedClaims(claims))}`;
}

export function generateEphemeralOwnerInstructionKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return Object.freeze({
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    algorithm: OWNER_INSTRUCTION_ALG,
  });
}

function createOwnerInstructionKeyRegistryInternal(entries = []) {
  assertPrivilegedConstruction();
  const byKid = new Map();
  for (const entry of entries) {
    if (!isPlainObject(entry) || !isNonEmptyString(entry.kid) || !isNonEmptyString(entry.issuer)
      || !isNonEmptyString(entry.publicKeyPem)) {
      throw new TypeError('INVALID_OWNER_INSTRUCTION_KEY_ENTRY');
    }
    byKid.set(entry.kid, Object.freeze({
      kid: entry.kid,
      issuer: entry.issuer,
      algorithm: entry.algorithm || OWNER_INSTRUCTION_ALG,
      publicKeyPem: entry.publicKeyPem,
      privateKeyPem: entry.privateKeyPem || null,
      status: entry.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
    }));
  }
  const registry = Object.freeze({
    kind: 'TECP_DLP011_OWNER_INSTRUCTION_KEY_REGISTRY',
    lookup(kid) {
      const entry = byKid.get(kid);
      if (!entry) return Object.freeze({ ok: false, reason: 'UNKNOWN_KID' });
      return Object.freeze({ ok: true, entry });
    },
  });
  keyRegistryBrand.add(registry);
  return registry;
}

function createOwnerInstructionRevocationRegistryInternal() {
  assertPrivilegedConstruction();
  const revoked = new Set();
  const consumed = new Set();
  const registry = Object.freeze({
    kind: 'TECP_DLP011_OWNER_INSTRUCTION_REVOCATION_REGISTRY',
    revokeJti(jti) {
      if (!isNonEmptyString(jti)) throw new TypeError('JTI_REQUIRED');
      revoked.add(jti);
    },
    isRevoked(jti) {
      return revoked.has(jti);
    },
    consumeJti(jti) {
      if (!isNonEmptyString(jti)) return false;
      if (consumed.has(jti)) return false;
      consumed.add(jti);
      return true;
    },
    isConsumed(jti) {
      return consumed.has(jti);
    },
  });
  revocationBrand.add(registry);
  return registry;
}

function createOwnerInstructionClockInternal(startMs = 1_700_000_000_000) {
  assertPrivilegedConstruction();
  let now = startMs;
  const clock = Object.freeze({
    kind: 'TECP_DLP011_OWNER_INSTRUCTION_CLOCK',
    now() { return now; },
    set(ms) {
      if (!Number.isSafeInteger(ms)) throw new TypeError('INVALID_CLOCK');
      now = ms;
    },
    advance(ms) {
      if (!Number.isSafeInteger(ms) || ms < 0) throw new TypeError('INVALID_ADVANCE');
      now += ms;
    },
  });
  clockBrand.add(clock);
  return clock;
}

function createUnavailableOwnerInstructionClockInternal() {
  assertPrivilegedConstruction();
  const clock = Object.freeze({
    kind: 'TECP_DLP011_OWNER_INSTRUCTION_CLOCK',
    now() { throw new Error('CLOCK_UNAVAILABLE'); },
    set() { throw new Error('CLOCK_UNAVAILABLE'); },
    advance() { throw new Error('CLOCK_UNAVAILABLE'); },
  });
  clockBrand.add(clock);
  return clock;
}

function createOwnerImplementationInstructionVerifierInternal(deps) {
  assertPrivilegedConstruction();
  if (!isPlainObject(deps)
    || !keyRegistryBrand.has(deps.keyRegistry)
    || !revocationBrand.has(deps.revocationRegistry)
    || !clockBrand.has(deps.clock)) {
    throw new TypeError('TRUSTED_OWNER_INSTRUCTION_VERIFIER_DEPS_REQUIRED');
  }
  const consumeOnAllow = deps.consumeOnAllow === true;
  const verifier = Object.freeze({
    kind: 'TECP_DLP011_OWNER_INSTRUCTION_VERIFIER',
    testOnly: true,
    consumeOnAllow,
    verify(encodedInstruction, expectation) {
      return verifyOwnerImplementationInstruction(encodedInstruction, expectation, {
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

/**
 * Privileged construction kit — only usable while withPrivilegedOwnerInstructionConstruction is open.
 */
export function getPrivilegedOwnerInstructionConstructors() {
  assertPrivilegedConstruction();
  return Object.freeze({
    createOwnerInstructionKeyRegistry: createOwnerInstructionKeyRegistryInternal,
    createOwnerInstructionRevocationRegistry: createOwnerInstructionRevocationRegistryInternal,
    createOwnerInstructionClock: createOwnerInstructionClockInternal,
    createUnavailableOwnerInstructionClock: createUnavailableOwnerInstructionClockInternal,
    createOwnerImplementationInstructionVerifier: createOwnerImplementationInstructionVerifierInternal,
  });
}

/** Public stubs — untrusted importers cannot brand trust material. */
export function createOwnerInstructionKeyRegistry() {
  throw new TypeError('PUBLIC_OWNER_INSTRUCTION_KEY_REGISTRY_CONSTRUCTION_FORBIDDEN');
}

export function createOwnerInstructionRevocationRegistry() {
  throw new TypeError('PUBLIC_OWNER_INSTRUCTION_REVOCATION_REGISTRY_CONSTRUCTION_FORBIDDEN');
}

export function createOwnerInstructionClock() {
  throw new TypeError('PUBLIC_OWNER_INSTRUCTION_CLOCK_CONSTRUCTION_FORBIDDEN');
}

export function createUnavailableOwnerInstructionClock() {
  throw new TypeError('PUBLIC_OWNER_INSTRUCTION_CLOCK_CONSTRUCTION_FORBIDDEN');
}

export function createOwnerImplementationInstructionVerifier() {
  throw new TypeError('PUBLIC_OWNER_INSTRUCTION_VERIFIER_CONSTRUCTION_FORBIDDEN');
}

export function isBrandedOwnerInstructionKeyRegistry(value) {
  return keyRegistryBrand.has(value);
}

export function isBrandedOwnerInstructionRevocationRegistry(value) {
  return revocationBrand.has(value);
}

export function isBrandedOwnerInstructionClock(value) {
  return clockBrand.has(value);
}

export function isBrandedOwnerImplementationInstructionVerifier(value) {
  return verifierBrand.has(value);
}

export function isBrandedVerifiedOwnerInstruction(value) {
  return verifiedInstructionBrand.has(value);
}

export function issueOwnerImplementationInstruction(request, deps) {
  if (!isPlainObject(request) || !isPlainObject(deps)) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['REQUEST_OR_DEPS_REQUIRED']);
  }
  if (!keyRegistryBrand.has(deps.keyRegistry) || !clockBrand.has(deps.clock)) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MISSING_DEPS, ['TRUSTED_DEPS_REQUIRED']);
  }
  const scope = stableScope(request.authorizedFileScope);
  if (!scope
    || !isNonEmptyString(request.repositoryId)
    || !isNonEmptyString(request.canonicalSha)
    || !isNonEmptyString(request.rule02DigestSha256)
    || !isNonEmptyString(request.sliceId)
    || !isNonEmptyString(request.operationClass)
    || !isNonEmptyString(request.governanceRevision)
    || !isNonEmptyString(request.issuer)
    || !isNonEmptyString(request.kid)) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['REQUIRED_CLAIMS_MISSING']);
  }
  if (request.purpose !== OWNER_INSTRUCTION_PURPOSE) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_PURPOSE, ['PURPOSE_MUST_BE_TEST_ONLY']);
  }
  const lookup = deps.keyRegistry.lookup(request.kid);
  if (!lookup.ok) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_UNKNOWN_ISSUER_OR_KID, ['UNKNOWN_KID']);
  }
  if (lookup.entry.issuer !== request.issuer) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_UNKNOWN_ISSUER_OR_KID, ['ISSUER_MISMATCH']);
  }
  if (lookup.entry.status !== 'ACTIVE') {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_DISABLED_ISSUER_KEY, ['KEY_DISABLED']);
  }
  if (lookup.entry.algorithm !== OWNER_INSTRUCTION_ALG || !lookup.entry.privateKeyPem) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_UNSUPPORTED_ALGORITHM, ['SIGNING_KEY_UNAVAILABLE']);
  }

  let now;
  try {
    now = deps.clock.now();
  } catch {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_CLOCK_UNAVAILABLE);
  }
  if (!Number.isSafeInteger(now)) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_CLOCK_UNAVAILABLE);
  }

  const ttlMs = Number.isSafeInteger(request.ttlMs) ? request.ttlMs : MAX_OWNER_INSTRUCTION_TTL_MS;
  if (ttlMs <= 0 || ttlMs > MAX_OWNER_INSTRUCTION_TTL_MS) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_EXCESSIVE_TTL);
  }

  const claims = {
    alg: OWNER_INSTRUCTION_ALG,
    authorizedFileScope: scope,
    canonicalSha: request.canonicalSha,
    domain: OWNER_INSTRUCTION_DOMAIN,
    exp: now + ttlMs,
    governanceRevision: request.governanceRevision,
    iat: now,
    iss: request.issuer,
    jti: request.jti || randomBytes(16).toString('hex'),
    kid: request.kid,
    kind: OWNER_INSTRUCTION_KIND,
    operationClass: request.operationClass,
    purpose: OWNER_INSTRUCTION_PURPOSE,
    repositoryId: request.repositoryId,
    rule02DigestSha256: request.rule02DigestSha256,
    sliceId: request.sliceId,
  };
  if (isNonEmptyString(request.workerId)) claims.workerId = request.workerId;
  if (isNonEmptyString(request.taskId)) claims.taskId = request.taskId;

  let payload;
  try {
    payload = signingPayload(claims);
  } catch {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['CANONICALIZATION_FAILED']);
  }
  if (payload.length > MAX_OWNER_INSTRUCTION_CHARS) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_OVERSIZED);
  }

  const keyObject = createPrivateKey(lookup.entry.privateKeyPem);
  const signature = sign(null, Buffer.from(payload, 'utf8'), keyObject);
  const encoded = `${b64urlEncode(Buffer.from(payload, 'utf8'))}.${b64urlEncode(signature)}`;
  if (encoded.length > MAX_OWNER_INSTRUCTION_CHARS) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_OVERSIZED);
  }

  return Object.freeze({
    ok: true,
    decision: OWNER_INSTRUCTION_DECISIONS.ALLOW,
    reasons: Object.freeze([]),
    instruction: Object.freeze({
      kind: OWNER_INSTRUCTION_KIND,
      encoded,
      claims: Object.freeze({ ...claims, authorizedFileScope: scope }),
    }),
    operational: false,
    purpose: OWNER_INSTRUCTION_PURPOSE,
  });
}

export function verifyOwnerImplementationInstruction(encodedInstruction, expectation, deps) {
  if (!isPlainObject(deps)
    || !keyRegistryBrand.has(deps.keyRegistry)
    || !revocationBrand.has(deps.revocationRegistry)
    || !clockBrand.has(deps.clock)) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MISSING_DEPS, ['TRUSTED_DEPS_REQUIRED']);
  }
  if (Object.prototype.hasOwnProperty.call(deps, 'publicKeyPem')
    || Object.prototype.hasOwnProperty.call(deps, 'privateKeyPem')
    || Object.prototype.hasOwnProperty.call(deps, 'verificationKey')) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_CALLER_SUPPLIED_VERIFICATION_MATERIAL);
  }
  if (!isPlainObject(expectation)) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['EXPECTATION_REQUIRED']);
  }
  if (!isNonEmptyString(encodedInstruction) || encodedInstruction.length > MAX_OWNER_INSTRUCTION_CHARS) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_OVERSIZED, ['INSTRUCTION_SIZE']);
  }

  const parts = encodedInstruction.split('.');
  if (parts.length !== 2) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['ENCODING_SHAPE']);
  }
  const payloadBuf = b64urlDecode(parts[0]);
  const sigBuf = b64urlDecode(parts[1]);
  if (!payloadBuf || !sigBuf) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['B64URL_DECODE']);
  }
  let payloadText;
  try {
    payloadText = payloadBuf.toString('utf8');
  } catch {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['UTF8']);
  }
  const nl = payloadText.indexOf('\n');
  if (nl <= 0) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['DOMAIN_SEPARATOR']);
  }
  const domain = payloadText.slice(0, nl);
  const jsonPart = payloadText.slice(nl + 1);
  if (domain !== OWNER_INSTRUCTION_DOMAIN) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['WRONG_DOMAIN']);
  }

  let claims;
  try {
    claims = JSON.parse(jsonPart);
  } catch {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['JSON_PARSE']);
  }
  if (!isPlainObject(claims)) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['CLAIMS_NOT_OBJECT']);
  }

  let expectedCanonical;
  try {
    expectedCanonical = signingPayload(claims);
  } catch {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['CANONICALIZATION_FAILED']);
  }
  if (expectedCanonical !== payloadText) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_NONCANONICAL_ENCODING);
  }

  if (claims.alg !== OWNER_INSTRUCTION_ALG
    || claims.kind !== OWNER_INSTRUCTION_KIND
    || claims.domain !== OWNER_INSTRUCTION_DOMAIN
    || claims.purpose !== OWNER_INSTRUCTION_PURPOSE) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_PURPOSE, ['CLAIM_META']);
  }

  const requiredStrings = [
    'iss', 'kid', 'jti', 'repositoryId', 'canonicalSha', 'rule02DigestSha256',
    'sliceId', 'operationClass', 'governanceRevision',
  ];
  for (const key of requiredStrings) {
    if (!isNonEmptyString(claims[key])) {
      return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, [`MISSING_${key}`]);
    }
  }
  const scope = stableScope(claims.authorizedFileScope);
  if (!scope) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['SCOPE']);
  }
  if (!Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp)) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_MALFORMED, ['TIME_CLAIMS']);
  }
  if (claims.exp - claims.iat > MAX_OWNER_INSTRUCTION_TTL_MS || claims.exp <= claims.iat) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_EXCESSIVE_TTL);
  }

  if (claims.repositoryId !== expectation.repositoryId) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_REPOSITORY);
  }
  if (claims.sliceId !== expectation.sliceId) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_SLICE);
  }
  if (claims.canonicalSha !== expectation.canonicalSha) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_SHA);
  }
  if (claims.rule02DigestSha256 !== expectation.rule02DigestSha256) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_DIGEST);
  }
  if (claims.operationClass !== expectation.operationClass) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_OPERATION);
  }
  if (claims.governanceRevision !== expectation.governanceRevision) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_GOVERNANCE_REVISION);
  }
  const expectedScope = stableScope(expectation.authorizedFileScope);
  if (!expectedScope || !scopesEqual(scope, expectedScope)) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_SCOPE);
  }
  if (isNonEmptyString(expectation.workerId)) {
    if (claims.workerId !== expectation.workerId) {
      return deny(OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_WORKER);
    }
  }
  if (isNonEmptyString(expectation.taskId)) {
    if (claims.taskId !== expectation.taskId) {
      return deny(OWNER_INSTRUCTION_DECISIONS.DENY_WRONG_TASK);
    }
  }

  let now;
  try {
    now = deps.clock.now();
  } catch {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_CLOCK_UNAVAILABLE);
  }
  if (!Number.isSafeInteger(now)) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_CLOCK_UNAVAILABLE);
  }
  if (now < claims.iat) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_NOT_YET_VALID);
  }
  if (now >= claims.exp) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_EXPIRED);
  }

  let revoked;
  try {
    revoked = deps.revocationRegistry.isRevoked(claims.jti);
  } catch {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_REVOCATION_UNAVAILABLE);
  }
  if (revoked) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_REVOKED_JTI);
  }
  try {
    if (deps.revocationRegistry.isConsumed(claims.jti)) {
      return deny(OWNER_INSTRUCTION_DECISIONS.DENY_REPLAYED_JTI);
    }
  } catch {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_REVOCATION_UNAVAILABLE);
  }

  const lookup = deps.keyRegistry.lookup(claims.kid);
  if (!lookup.ok) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_UNKNOWN_ISSUER_OR_KID);
  }
  if (lookup.entry.issuer !== claims.iss) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_UNKNOWN_ISSUER_OR_KID, ['ISSUER_MISMATCH']);
  }
  if (lookup.entry.status !== 'ACTIVE') {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_DISABLED_ISSUER_KEY);
  }
  if (lookup.entry.algorithm !== OWNER_INSTRUCTION_ALG) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_UNSUPPORTED_ALGORITHM);
  }

  let signatureOk = false;
  try {
    const publicKey = createPublicKey(lookup.entry.publicKeyPem);
    signatureOk = verify(null, Buffer.from(expectedCanonical, 'utf8'), publicKey, sigBuf);
  } catch {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_INVALID_SIGNATURE);
  }
  if (!signatureOk) {
    return deny(OWNER_INSTRUCTION_DECISIONS.DENY_INVALID_SIGNATURE);
  }

  if (deps.consumeOnAllow === true) {
    let consumed;
    try {
      consumed = deps.revocationRegistry.consumeJti(claims.jti);
    } catch {
      return deny(OWNER_INSTRUCTION_DECISIONS.DENY_REVOCATION_UNAVAILABLE);
    }
    if (!consumed) {
      return deny(OWNER_INSTRUCTION_DECISIONS.DENY_REPLAYED_JTI);
    }
  }

  const instruction = Object.freeze({
    kind: OWNER_INSTRUCTION_KIND,
    jti: claims.jti,
    issuer: claims.iss,
    kid: claims.kid,
    repositoryId: claims.repositoryId,
    canonicalSha: claims.canonicalSha,
    rule02DigestSha256: claims.rule02DigestSha256,
    sliceId: claims.sliceId,
    authorizedFileScope: scope,
    operationClass: claims.operationClass,
    governanceRevision: claims.governanceRevision,
    purpose: claims.purpose,
    iat: claims.iat,
    exp: claims.exp,
    workerId: claims.workerId || null,
    taskId: claims.taskId || null,
    standingAuthority: false,
  });
  verifiedInstructionBrand.add(instruction);

  return Object.freeze({
    ok: true,
    decision: OWNER_INSTRUCTION_DECISIONS.ALLOW,
    reasons: Object.freeze([]),
    instruction,
    operational: false,
    purpose: OWNER_INSTRUCTION_PURPOSE,
  });
}

export function sha256Hex(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

export function safeEqualHex(a, b) {
  if (!isNonEmptyString(a) || !isNonEmptyString(b)) return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
