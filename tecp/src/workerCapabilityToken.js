/**
 * TECP-DLP-005 disposable short-lived Worker capability tokens (offline).
 *
 * Option D: signed task-scoped capabilities using built-in Node.js crypto (Ed25519).
 * NON_OPERATIONAL proof. No real Lease acquisition, no production issuer, no secret logging.
 *
 * Replay note: repeated presentation of a still-valid capability is permitted for
 * legitimate retries within the same authorized scope. Exactly-once / operation-level
 * idempotency requires a SEPARATE enforcement contract and is NOT claimed here.
 */

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
} from 'node:crypto';

import {
  TRUST_LEVELS,
  ATTESTATION_KINDS,
  isBrandedVerifiedPrincipal,
} from './workerIdentity.js';

export const CAPABILITY_STAGES = Object.freeze({
  BOOTSTRAP_REQUEST: 'BOOTSTRAP_REQUEST',
  LEASE_BOUND: 'LEASE_BOUND',
});

export const CAPABILITY_ACTIONS = Object.freeze({
  REQUEST_ELIGIBLE_TASK_LEASE: 'REQUEST_ELIGIBLE_TASK_LEASE',
  MUTATE_TASK: 'MUTATE_TASK',
  SUBMIT_EVIDENCE: 'SUBMIT_EVIDENCE',
  RELEASE_TASK: 'RELEASE_TASK',
  EXECUTE_LEASE_SCOPED_WORK: 'EXECUTE_LEASE_SCOPED_WORK',
});

export const BOOTSTRAP_ALLOWED_ACTIONS = Object.freeze([
  CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE,
]);

export const LEASE_BOUND_FORBIDDEN_WITHOUT_FENCING = Object.freeze([
  CAPABILITY_ACTIONS.MUTATE_TASK,
  CAPABILITY_ACTIONS.SUBMIT_EVIDENCE,
  CAPABILITY_ACTIONS.RELEASE_TASK,
  CAPABILITY_ACTIONS.EXECUTE_LEASE_SCOPED_WORK,
]);

export const CAPABILITY_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MISSING_DEPS: 'DENY_MISSING_DEPS',
  DENY_INVALID_PRINCIPAL: 'DENY_INVALID_PRINCIPAL',
  DENY_UNSUPPORTED_ALGORITHM: 'DENY_UNSUPPORTED_ALGORITHM',
  DENY_UNKNOWN_ISSUER_OR_KID: 'DENY_UNKNOWN_ISSUER_OR_KID',
  DENY_DISABLED_ISSUER_KEY: 'DENY_DISABLED_ISSUER_KEY',
  DENY_INVALID_SIGNATURE: 'DENY_INVALID_SIGNATURE',
  DENY_MALFORMED_TOKEN: 'DENY_MALFORMED_TOKEN',
  DENY_NONCANONICAL_ENCODING: 'DENY_NONCANONICAL_ENCODING',
  DENY_MISSING_OR_MALFORMED_CLAIMS: 'DENY_MISSING_OR_MALFORMED_CLAIMS',
  DENY_WRONG_AUDIENCE: 'DENY_WRONG_AUDIENCE',
  DENY_WRONG_TASK: 'DENY_WRONG_TASK',
  DENY_WRONG_RESOURCE: 'DENY_WRONG_RESOURCE',
  DENY_WRONG_ACTION: 'DENY_WRONG_ACTION',
  DENY_WRONG_PRINCIPAL: 'DENY_WRONG_PRINCIPAL',
  DENY_NOT_YET_VALID: 'DENY_NOT_YET_VALID',
  DENY_EXPIRED: 'DENY_EXPIRED',
  DENY_EXCESSIVE_TTL: 'DENY_EXCESSIVE_TTL',
  DENY_REVOKED_JTI: 'DENY_REVOKED_JTI',
  DENY_STALE_PRINCIPAL_GENERATION: 'DENY_STALE_PRINCIPAL_GENERATION',
  DENY_REVOCATION_UNAVAILABLE: 'DENY_REVOCATION_UNAVAILABLE',
  DENY_KEY_REGISTRY_UNAVAILABLE: 'DENY_KEY_REGISTRY_UNAVAILABLE',
  DENY_CLOCK_UNAVAILABLE: 'DENY_CLOCK_UNAVAILABLE',
  DENY_STAGE_VIOLATION: 'DENY_STAGE_VIOLATION',
  DENY_MISSING_LEASE_FENCING: 'DENY_MISSING_LEASE_FENCING',
  DENY_WRONG_FENCING_EPOCH: 'DENY_WRONG_FENCING_EPOCH',
  DENY_WRONG_LEASE: 'DENY_WRONG_LEASE',
  DENY_BOOTSTRAP_MUTATION: 'DENY_BOOTSTRAP_MUTATION',
  DENY_INCOMPLETE_EXPECTATION: 'DENY_INCOMPLETE_EXPECTATION',
});

const REQUIRED_EXPECTATION_STRING_FIELDS = Object.freeze([
  'audience',
  'taskId',
  'resourceType',
  'resourceId',
  'principalId',
  'action',
  'capabilityStage',
]);

export const SUPPORTED_ALGORITHMS = Object.freeze(['Ed25519']);

/** Maximum allowed credential lifetime in milliseconds (5 minutes). */
export const MAX_CAPABILITY_TTL_MS = 5 * 60 * 1000;

const CLAIM_KEY_ORDER = Object.freeze([
  'alg',
  'allowedActions',
  'aud',
  'capabilityStage',
  'exp',
  'fencingEpoch',
  'iat',
  'iss',
  'jti',
  'kid',
  'leaseId',
  'nbf',
  'principalGeneration',
  'principalId',
  'resourceId',
  'resourceType',
  'revocationGeneration',
  'taskId',
  'tokenType',
  'trustLevel',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isSafeInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function deny(decision, reasons) {
  return Object.freeze({
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    claims: null,
    token: null,
  });
}

function allow(claims, token) {
  return Object.freeze({
    allowed: true,
    decision: CAPABILITY_DECISIONS.ALLOW,
    reasons: Object.freeze(['CAPABILITY_VERIFIED']),
    claims: Object.freeze({ ...claims, allowedActions: Object.freeze([...claims.allowedActions]) }),
    token: token === undefined ? null : token,
  });
}

/**
 * Deterministic canonical JSON: sorted object keys, no whitespace, arrays preserved in order.
 * Rejects objects with prototype pollution keys and non-finite numbers.
 */
export function canonicalJson(value) {
  return canonicalize(value);
}

function canonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new TypeError('NONCANONICAL_NUMBER');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(',')}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new TypeError('FORBIDDEN_KEY');
      }
    }
    const parts = keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`);
    return `{${parts.join(',')}}`;
  }
  throw new TypeError('UNSUPPORTED_JSON_TYPE');
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

function assertVerifiedPrincipal(principal) {
  // R3: public field resemblance is insufficient. Only WeakSet-branded principals
  // produced by verifyWorkerPrincipal are accepted. Copies/forgeries DENY.
  if (!isBrandedVerifiedPrincipal(principal)) {
    return 'UNBRANDED_OR_FORGED_PRINCIPAL';
  }
  if (!isPlainObject(principal)) return 'PRINCIPAL_REQUIRED';
  if (!isNonEmptyString(principal.principalId)) return 'INVALID_PRINCIPAL_ID';
  if (principal.trustLevel !== TRUST_LEVELS.TEST_ATTESTED) return 'UNTRUSTED_TRUST_LEVEL';
  if (principal.attestationKind !== ATTESTATION_KINDS.TEST_ONLY) return 'UNTRUSTED_ATTESTATION_KIND';
  if (!isNonEmptyString(principal.bootstrapIssuer)) return 'INVALID_BOOTSTRAP_ISSUER';
  if (!isSafeInteger(principal.principalGeneration) || principal.principalGeneration < 0) {
    return 'INVALID_PRINCIPAL_GENERATION';
  }
  if (principal.osPrincipalAuthenticated === true) return 'OS_AUTH_CLAIM_FORBIDDEN';
  if (principal.realWorkerAuthenticated === true) return 'REAL_WORKER_AUTH_CLAIM_FORBIDDEN';
  return null;
}

function normalizeActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) return null;
  const out = [];
  const seen = new Set();
  for (const action of actions) {
    if (!isNonEmptyString(action)) return null;
    if (seen.has(action)) return null;
    seen.add(action);
    out.push(action);
  }
  out.sort();
  return out;
}

function validateClaimShape(claims) {
  if (!isPlainObject(claims)) return 'CLAIMS_OBJECT_REQUIRED';
  const keys = Object.keys(claims).sort();
  if (keys.join('\0') !== CLAIM_KEY_ORDER.join('\0')) {
    // Extra, missing, or differently ordered keys are rejected at encode time via canonical build.
  }

  for (const key of CLAIM_KEY_ORDER) {
    if (!Object.prototype.hasOwnProperty.call(claims, key)) {
      return `MISSING_CLAIM:${key}`;
    }
  }
  for (const key of Object.keys(claims)) {
    if (!CLAIM_KEY_ORDER.includes(key)) return `UNKNOWN_CLAIM:${key}`;
  }

  if (claims.tokenType !== 'TECP_WORKER_CAPABILITY_V1') return 'INVALID_TOKEN_TYPE';
  if (claims.alg !== 'Ed25519') return 'UNSUPPORTED_ALGORITHM';
  if (!isNonEmptyString(claims.iss)) return 'INVALID_ISSUER';
  if (!isNonEmptyString(claims.kid)) return 'INVALID_KID';
  if (!isNonEmptyString(claims.aud)) return 'INVALID_AUDIENCE';
  if (!isNonEmptyString(claims.taskId)) return 'INVALID_TASK_ID';
  if (!isNonEmptyString(claims.resourceType)) return 'INVALID_RESOURCE_TYPE';
  if (!isNonEmptyString(claims.resourceId)) return 'INVALID_RESOURCE_ID';
  if (!isNonEmptyString(claims.jti)) return 'INVALID_JTI';
  if (!isNonEmptyString(claims.principalId)) return 'INVALID_PRINCIPAL_ID';
  if (claims.trustLevel !== TRUST_LEVELS.TEST_ATTESTED) return 'INVALID_TRUST_LEVEL';
  if (!isSafeInteger(claims.principalGeneration) || claims.principalGeneration < 0) {
    return 'INVALID_PRINCIPAL_GENERATION';
  }
  if (!isSafeInteger(claims.revocationGeneration) || claims.revocationGeneration < 0) {
    return 'INVALID_REVOCATION_GENERATION';
  }
  if (!isSafeInteger(claims.iat) || claims.iat < 0) return 'INVALID_IAT';
  if (!isSafeInteger(claims.nbf) || claims.nbf < 0) return 'INVALID_NBF';
  if (!isSafeInteger(claims.exp) || claims.exp < 0) return 'INVALID_EXP';
  if (claims.nbf < claims.iat) return 'NBF_BEFORE_IAT';
  if (claims.exp <= claims.nbf) return 'EXP_NOT_AFTER_NBF';
  if (claims.exp - claims.iat > MAX_CAPABILITY_TTL_MS) return 'EXCESSIVE_TTL';

  const actions = normalizeActions(claims.allowedActions);
  if (!actions) return 'INVALID_ALLOWED_ACTIONS';
  if (actions.join('\0') !== [...claims.allowedActions].sort().join('\0')) {
    return 'ACTIONS_NOT_CANONICAL';
  }

  if (claims.capabilityStage === CAPABILITY_STAGES.BOOTSTRAP_REQUEST) {
    if (claims.leaseId !== null) return 'BOOTSTRAP_MUST_NOT_SET_LEASE';
    if (claims.fencingEpoch !== null) return 'BOOTSTRAP_MUST_NOT_SET_FENCING';
    for (const action of actions) {
      if (!BOOTSTRAP_ALLOWED_ACTIONS.includes(action)) return 'BOOTSTRAP_ACTION_FORBIDDEN';
    }
  } else if (claims.capabilityStage === CAPABILITY_STAGES.LEASE_BOUND) {
    if (!isNonEmptyString(claims.leaseId)) return 'LEASE_ID_REQUIRED';
    if (!isSafeInteger(claims.fencingEpoch) || claims.fencingEpoch < 0) return 'FENCING_EPOCH_REQUIRED';
    if (actions.length === 0) return 'LEASE_BOUND_ACTIONS_REQUIRED';
  } else {
    return 'INVALID_CAPABILITY_STAGE';
  }

  return null;
}

function buildClaims(input) {
  const actions = normalizeActions(input.allowedActions);
  if (!actions) return { error: 'INVALID_ALLOWED_ACTIONS' };

  const claims = {
    alg: 'Ed25519',
    allowedActions: actions,
    aud: input.audience,
    capabilityStage: input.capabilityStage,
    exp: input.exp,
    fencingEpoch: input.capabilityStage === CAPABILITY_STAGES.LEASE_BOUND
      ? input.fencingEpoch
      : null,
    iat: input.iat,
    iss: input.issuer,
    jti: input.jti,
    kid: input.kid,
    leaseId: input.capabilityStage === CAPABILITY_STAGES.LEASE_BOUND
      ? input.leaseId
      : null,
    nbf: input.nbf,
    principalGeneration: input.principal.principalGeneration,
    principalId: input.principal.principalId,
    resourceId: input.resourceId,
    resourceType: input.resourceType,
    revocationGeneration: input.revocationGeneration,
    taskId: input.taskId,
    tokenType: 'TECP_WORKER_CAPABILITY_V1',
    trustLevel: input.principal.trustLevel,
  };

  const shapeError = validateClaimShape(claims);
  if (shapeError) return { error: shapeError };
  return { claims };
}

/**
 * Generate ephemeral Ed25519 key material for offline tests only.
 * Never log or return private key material from capability APIs' error paths.
 */
export function generateEphemeralEd25519KeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return Object.freeze({
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
}
/**
 * Injected offline issuer/key registry.
 */
export function createInMemoryIssuerKeyRegistry(entries = []) {
  const byIssuerKid = new Map();
  let unavailable = false;

  function key(issuer, kid) {
    return `${issuer}\0${kid}`;
  }

  for (const entry of entries) {
    byIssuerKid.set(key(entry.issuer, entry.kid), Object.freeze({
      issuer: entry.issuer,
      kid: entry.kid,
      algorithm: entry.algorithm || 'Ed25519',
      publicKeyPem: entry.publicKeyPem,
      privateKeyPem: entry.privateKeyPem || null,
      status: entry.status || 'ACTIVE',
    }));
  }

  return Object.freeze({
    setUnavailable(flag) {
      unavailable = flag === true;
    },
    put(entry) {
      byIssuerKid.set(key(entry.issuer, entry.kid), Object.freeze({
        issuer: entry.issuer,
        kid: entry.kid,
        algorithm: entry.algorithm || 'Ed25519',
        publicKeyPem: entry.publicKeyPem,
        privateKeyPem: entry.privateKeyPem || null,
        status: entry.status || 'ACTIVE',
      }));
    },
    lookup(issuer, kid) {
      if (unavailable) return Object.freeze({ available: false, entry: null });
      const entry = byIssuerKid.get(key(issuer, kid));
      if (!entry) return Object.freeze({ available: true, entry: null });
      return Object.freeze({ available: true, entry });
    },
  });
}

/**
 * Injected offline revocation registry (jti + principal generation epoch).
 */
export function createInMemoryRevocationRegistry() {
  const revokedJtis = new Set();
  const principalMinGeneration = new Map();
  let currentRevocationGeneration = 0;
  let unavailable = false;

  return Object.freeze({
    setUnavailable(flag) {
      unavailable = flag === true;
    },
    setCurrentRevocationGeneration(value) {
      if (!isSafeInteger(value) || value < 0) throw new TypeError('invalid generation');
      currentRevocationGeneration = value;
    },
    getCurrentRevocationGeneration() {
      if (unavailable) return Object.freeze({ available: false, generation: null });
      return Object.freeze({ available: true, generation: currentRevocationGeneration });
    },
    revokeJti(jti) {
      if (!isNonEmptyString(jti)) throw new TypeError('jti required');
      revokedJtis.add(jti);
    },
    invalidatePrincipalBelowGeneration(principalId, minGeneration) {
      if (!isNonEmptyString(principalId) || !isSafeInteger(minGeneration) || minGeneration < 0) {
        throw new TypeError('invalid principal invalidation');
      }
      const prev = principalMinGeneration.get(principalId) ?? 0;
      principalMinGeneration.set(principalId, Math.max(prev, minGeneration));
    },
    isJtiRevoked(jti) {
      if (unavailable) return Object.freeze({ available: false, revoked: null });
      return Object.freeze({ available: true, revoked: revokedJtis.has(jti) });
    },
    isPrincipalGenerationCurrent(principalId, generation) {
      if (unavailable) return Object.freeze({ available: false, current: null });
      const min = principalMinGeneration.get(principalId) ?? 0;
      return Object.freeze({ available: true, current: generation >= min });
    },
  });
}

export function createInjectedClock(startMs = 1_700_000_000_000) {
  let now = startMs;
  let unavailable = false;
  return Object.freeze({
    setUnavailable(flag) {
      unavailable = flag === true;
    },
    now() {
      if (unavailable) return Object.freeze({ available: false, nowMs: null });
      return Object.freeze({ available: true, nowMs: now });
    },
    advance(ms) {
      if (!isSafeInteger(ms) || ms < 0) throw new TypeError('invalid advance');
      now += ms;
    },
    set(ms) {
      if (!isSafeInteger(ms) || ms < 0) throw new TypeError('invalid set');
      now = ms;
    },
  });
}

function safeErrorMessage(code) {
  // Never include key material or raw credentials.
  return code;
}

/**
 * Issue a short-lived signed capability. Private keys never appear in returned errors.
 */
export function issueCapability(request, deps) {
  if (!isPlainObject(deps)
    || !deps.keyRegistry
    || !deps.revocationRegistry
    || !deps.clock
    || typeof deps.keyRegistry.lookup !== 'function'
    || typeof deps.revocationRegistry.getCurrentRevocationGeneration !== 'function'
    || typeof deps.clock.now !== 'function') {
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_DEPS, ['DEPS_REQUIRED']);
  }

  if (!isPlainObject(request)) {
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_OR_MALFORMED_CLAIMS, ['REQUEST_REQUIRED']);
  }

  const principalError = assertVerifiedPrincipal(request.principal);
  if (principalError) {
    return deny(CAPABILITY_DECISIONS.DENY_INVALID_PRINCIPAL, [principalError]);
  }

  if (!SUPPORTED_ALGORITHMS.includes(request.algorithm || 'Ed25519')) {
    return deny(CAPABILITY_DECISIONS.DENY_UNSUPPORTED_ALGORITHM, [
      `UNSUPPORTED_ALGORITHM:${request.algorithm}`,
    ]);
  }

  const clock = deps.clock.now();
  if (!clock || clock.available !== true || !isSafeInteger(clock.nowMs)) {
    return deny(CAPABILITY_DECISIONS.DENY_CLOCK_UNAVAILABLE, ['CLOCK_UNAVAILABLE']);
  }

  const revGen = deps.revocationRegistry.getCurrentRevocationGeneration();
  if (!revGen || revGen.available !== true || !isSafeInteger(revGen.generation)) {
    return deny(CAPABILITY_DECISIONS.DENY_REVOCATION_UNAVAILABLE, ['REVOCATION_GENERATION_UNAVAILABLE']);
  }

  const issuer = request.issuer;
  const kid = request.kid;
  if (!isNonEmptyString(issuer) || !isNonEmptyString(kid)) {
    return deny(CAPABILITY_DECISIONS.DENY_UNKNOWN_ISSUER_OR_KID, ['ISSUER_AND_KID_REQUIRED']);
  }

  const lookup = deps.keyRegistry.lookup(issuer, kid);
  if (!lookup || lookup.available !== true) {
    return deny(CAPABILITY_DECISIONS.DENY_KEY_REGISTRY_UNAVAILABLE, ['KEY_REGISTRY_UNAVAILABLE']);
  }
  if (!lookup.entry) {
    return deny(CAPABILITY_DECISIONS.DENY_UNKNOWN_ISSUER_OR_KID, ['UNKNOWN_ISSUER_OR_KID']);
  }
  if (lookup.entry.status !== 'ACTIVE') {
    return deny(CAPABILITY_DECISIONS.DENY_DISABLED_ISSUER_KEY, [`KEY_STATUS:${lookup.entry.status}`]);
  }
  if (lookup.entry.algorithm !== 'Ed25519') {
    return deny(CAPABILITY_DECISIONS.DENY_UNSUPPORTED_ALGORITHM, [
      `REGISTRY_ALGORITHM:${lookup.entry.algorithm}`,
    ]);
  }
  if (!isNonEmptyString(lookup.entry.privateKeyPem)) {
    return deny(CAPABILITY_DECISIONS.DENY_DISABLED_ISSUER_KEY, ['SIGNING_KEY_UNAVAILABLE']);
  }

  const iat = clock.nowMs;
  const nbf = isSafeInteger(request.nbf) ? request.nbf : iat;
  const ttl = isSafeInteger(request.ttlMs) ? request.ttlMs : 60_000;
  if (ttl <= 0 || ttl > MAX_CAPABILITY_TTL_MS) {
    return deny(CAPABILITY_DECISIONS.DENY_EXCESSIVE_TTL, ['TTL_OUT_OF_BOUNDS']);
  }
  const exp = iat + ttl;

  const stage = request.capabilityStage;
  if (stage === CAPABILITY_STAGES.LEASE_BOUND) {
    const leaseCtx = request.leaseContext;
    if (!isPlainObject(leaseCtx)
      || !isNonEmptyString(leaseCtx.leaseId)
      || !isSafeInteger(leaseCtx.fencingEpoch)
      || leaseCtx.fencingEpoch < 0) {
      return deny(CAPABILITY_DECISIONS.DENY_MISSING_LEASE_FENCING, [
        'LEASE_FENCING_CONTEXT_REQUIRED',
      ]);
    }
  }

  const jti = isNonEmptyString(request.jti) ? request.jti : b64urlEncode(randomBytes(16));

  const built = buildClaims({
    principal: request.principal,
    issuer,
    kid,
    audience: request.audience,
    taskId: request.taskId,
    resourceType: request.resourceType,
    resourceId: request.resourceId,
    allowedActions: request.allowedActions,
    capabilityStage: stage,
    leaseId: request.leaseContext?.leaseId,
    fencingEpoch: request.leaseContext?.fencingEpoch,
    iat,
    nbf,
    exp,
    jti,
    revocationGeneration: revGen.generation,
  });
  if (built.error) {
    if (built.error === 'BOOTSTRAP_ACTION_FORBIDDEN') {
      return deny(CAPABILITY_DECISIONS.DENY_BOOTSTRAP_MUTATION, [built.error]);
    }
    if (built.error === 'EXCESSIVE_TTL') {
      return deny(CAPABILITY_DECISIONS.DENY_EXCESSIVE_TTL, [built.error]);
    }
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_OR_MALFORMED_CLAIMS, [built.error]);
  }

  let payload;
  try {
    payload = canonicalJson(built.claims);
  } catch {
    return deny(CAPABILITY_DECISIONS.DENY_NONCANONICAL_ENCODING, ['CANONICALIZATION_FAILED']);
  }

  let signature;
  try {
    const keyObject = createPrivateKey(lookup.entry.privateKeyPem);
    signature = sign(null, Buffer.from(payload, 'utf8'), keyObject);
  } catch {
    return deny(CAPABILITY_DECISIONS.DENY_DISABLED_ISSUER_KEY, [
      safeErrorMessage('SIGNING_FAILED'),
    ]);
  }

  const token = `${b64urlEncode(Buffer.from(payload, 'utf8'))}.${b64urlEncode(signature)}`;
  return allow(built.claims, token);
}

/**
 * Verify a signed capability against injected trust/revocation/clock dependencies.
 */
export function verifyCapability(token, expectation, deps) {
  if (!isPlainObject(deps)
    || !deps.keyRegistry
    || !deps.revocationRegistry
    || !deps.clock) {
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_DEPS, ['DEPS_REQUIRED']);
  }
  if (!isNonEmptyString(token) || !token.includes('.')) {
    return deny(CAPABILITY_DECISIONS.DENY_MALFORMED_TOKEN, ['TOKEN_FORMAT']);
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return deny(CAPABILITY_DECISIONS.DENY_MALFORMED_TOKEN, ['TOKEN_PARTS']);
  }

  const payloadBuf = b64urlDecode(parts[0]);
  const sigBuf = b64urlDecode(parts[1]);
  if (!payloadBuf || !sigBuf) {
    return deny(CAPABILITY_DECISIONS.DENY_MALFORMED_TOKEN, ['TOKEN_B64']);
  }

  let parsed;
  try {
    parsed = JSON.parse(payloadBuf.toString('utf8'));
  } catch {
    return deny(CAPABILITY_DECISIONS.DENY_MALFORMED_TOKEN, ['PAYLOAD_JSON']);
  }

  let expectedCanonical;
  try {
    expectedCanonical = canonicalJson(parsed);
  } catch {
    return deny(CAPABILITY_DECISIONS.DENY_NONCANONICAL_ENCODING, ['PAYLOAD_CANONICALIZATION_FAILED']);
  }

  if (expectedCanonical !== payloadBuf.toString('utf8')) {
    return deny(CAPABILITY_DECISIONS.DENY_NONCANONICAL_ENCODING, ['PAYLOAD_NOT_CANONICAL']);
  }

  const shapeError = validateClaimShape(parsed);
  if (shapeError) {
    if (shapeError === 'UNSUPPORTED_ALGORITHM' || shapeError.startsWith('UNSUPPORTED')) {
      return deny(CAPABILITY_DECISIONS.DENY_UNSUPPORTED_ALGORITHM, [shapeError]);
    }
    if (shapeError === 'EXCESSIVE_TTL') {
      return deny(CAPABILITY_DECISIONS.DENY_EXCESSIVE_TTL, [shapeError]);
    }
    if (shapeError === 'BOOTSTRAP_ACTION_FORBIDDEN') {
      return deny(CAPABILITY_DECISIONS.DENY_BOOTSTRAP_MUTATION, [shapeError]);
    }
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_OR_MALFORMED_CLAIMS, [shapeError]);
  }

  // Normalize actions for comparison
  parsed = {
    ...parsed,
    allowedActions: normalizeActions(parsed.allowedActions),
  };

  const lookup = deps.keyRegistry.lookup(parsed.iss, parsed.kid);
  if (!lookup || lookup.available !== true) {
    return deny(CAPABILITY_DECISIONS.DENY_KEY_REGISTRY_UNAVAILABLE, ['KEY_REGISTRY_UNAVAILABLE']);
  }
  if (!lookup.entry) {
    return deny(CAPABILITY_DECISIONS.DENY_UNKNOWN_ISSUER_OR_KID, ['UNKNOWN_ISSUER_OR_KID']);
  }
  if (lookup.entry.status !== 'ACTIVE') {
    return deny(CAPABILITY_DECISIONS.DENY_DISABLED_ISSUER_KEY, [`KEY_STATUS:${lookup.entry.status}`]);
  }
  if (lookup.entry.algorithm !== parsed.alg || parsed.alg !== 'Ed25519') {
    return deny(CAPABILITY_DECISIONS.DENY_UNSUPPORTED_ALGORITHM, ['ALGORITHM_MISMATCH']);
  }

  let signatureOk = false;
  try {
    const publicKey = createPublicKey(lookup.entry.publicKeyPem);
    signatureOk = verify(null, Buffer.from(expectedCanonical, 'utf8'), publicKey, sigBuf);
  } catch {
    return deny(CAPABILITY_DECISIONS.DENY_INVALID_SIGNATURE, [safeErrorMessage('VERIFY_FAILED')]);
  }
  if (!signatureOk) {
    return deny(CAPABILITY_DECISIONS.DENY_INVALID_SIGNATURE, ['SIGNATURE_MISMATCH']);
  }

  const clock = deps.clock.now();
  if (!clock || clock.available !== true || !isSafeInteger(clock.nowMs)) {
    return deny(CAPABILITY_DECISIONS.DENY_CLOCK_UNAVAILABLE, ['CLOCK_UNAVAILABLE']);
  }
  const now = clock.nowMs;
  if (now < parsed.nbf) {
    return deny(CAPABILITY_DECISIONS.DENY_NOT_YET_VALID, ['NOT_YET_VALID']);
  }
  if (now >= parsed.exp) {
    return deny(CAPABILITY_DECISIONS.DENY_EXPIRED, ['EXPIRED']);
  }

  const revGen = deps.revocationRegistry.getCurrentRevocationGeneration();
  if (!revGen || revGen.available !== true) {
    return deny(CAPABILITY_DECISIONS.DENY_REVOCATION_UNAVAILABLE, ['REVOCATION_GENERATION_UNAVAILABLE']);
  }
  if (parsed.revocationGeneration < revGen.generation) {
    return deny(CAPABILITY_DECISIONS.DENY_REVOKED_JTI, ['STALE_REVOCATION_GENERATION']);
  }

  const jtiStatus = deps.revocationRegistry.isJtiRevoked(parsed.jti);
  if (!jtiStatus || jtiStatus.available !== true) {
    return deny(CAPABILITY_DECISIONS.DENY_REVOCATION_UNAVAILABLE, ['JTI_REVOCATION_UNAVAILABLE']);
  }
  if (jtiStatus.revoked === true) {
    return deny(CAPABILITY_DECISIONS.DENY_REVOKED_JTI, ['JTI_REVOKED']);
  }

  const genStatus = deps.revocationRegistry.isPrincipalGenerationCurrent(
    parsed.principalId,
    parsed.principalGeneration,
  );
  if (!genStatus || genStatus.available !== true) {
    return deny(CAPABILITY_DECISIONS.DENY_REVOCATION_UNAVAILABLE, [
      'PRINCIPAL_GENERATION_CHECK_UNAVAILABLE',
    ]);
  }
  if (genStatus.current !== true) {
    return deny(CAPABILITY_DECISIONS.DENY_STALE_PRINCIPAL_GENERATION, [
      'STALE_PRINCIPAL_GENERATION',
    ]);
  }

  // Fail closed: omitted/empty expectation fields are NEVER authorization wildcards.
  const expectationGate = requireCompleteExpectation(expectation, parsed);
  if (expectationGate) {
    return expectationGate;
  }

  if (expectation.audience !== parsed.aud) {
    return deny(CAPABILITY_DECISIONS.DENY_WRONG_AUDIENCE, ['AUDIENCE_MISMATCH']);
  }
  if (expectation.taskId !== parsed.taskId) {
    return deny(CAPABILITY_DECISIONS.DENY_WRONG_TASK, ['TASK_MISMATCH']);
  }
  if (expectation.resourceType !== parsed.resourceType) {
    return deny(CAPABILITY_DECISIONS.DENY_WRONG_RESOURCE, ['RESOURCE_TYPE_MISMATCH']);
  }
  if (expectation.resourceId !== parsed.resourceId) {
    return deny(CAPABILITY_DECISIONS.DENY_WRONG_RESOURCE, ['RESOURCE_ID_MISMATCH']);
  }
  if (expectation.principalId !== parsed.principalId) {
    return deny(CAPABILITY_DECISIONS.DENY_WRONG_PRINCIPAL, ['PRINCIPAL_MISMATCH']);
  }
  if (expectation.capabilityStage !== parsed.capabilityStage) {
    return deny(CAPABILITY_DECISIONS.DENY_STAGE_VIOLATION, ['STAGE_MISMATCH']);
  }
  if (!parsed.allowedActions.includes(expectation.action)) {
    return deny(CAPABILITY_DECISIONS.DENY_WRONG_ACTION, ['ACTION_NOT_PERMITTED']);
  }

  if (parsed.capabilityStage === CAPABILITY_STAGES.BOOTSTRAP_REQUEST) {
    if (!BOOTSTRAP_ALLOWED_ACTIONS.includes(expectation.action)
      || LEASE_BOUND_FORBIDDEN_WITHOUT_FENCING.includes(expectation.action)) {
      return deny(CAPABILITY_DECISIONS.DENY_BOOTSTRAP_MUTATION, [
        'BOOTSTRAP_CANNOT_AUTHORIZE_MUTATION_OR_EVIDENCE',
      ]);
    }
  }

  if (parsed.capabilityStage === CAPABILITY_STAGES.LEASE_BOUND) {
    if (expectation.leaseContext.leaseId !== parsed.leaseId) {
      return deny(CAPABILITY_DECISIONS.DENY_WRONG_LEASE, ['LEASE_MISMATCH']);
    }
    if (expectation.leaseContext.fencingEpoch !== parsed.fencingEpoch) {
      return deny(CAPABILITY_DECISIONS.DENY_WRONG_FENCING_EPOCH, ['FENCING_EPOCH_MISMATCH']);
    }
  }

  return allow(parsed, null);
}

/**
 * Require a complete verification expectation. Missing/empty/null/wrong-type fields DENY.
 * Never treat omitted context as a wildcard.
 */
function requireCompleteExpectation(expectation, parsedClaims) {
  if (!isPlainObject(expectation)) {
    return deny(CAPABILITY_DECISIONS.DENY_INCOMPLETE_EXPECTATION, ['EXPECTATION_REQUIRED']);
  }

  for (const field of REQUIRED_EXPECTATION_STRING_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(expectation, field)) {
      return deny(CAPABILITY_DECISIONS.DENY_INCOMPLETE_EXPECTATION, [`MISSING_EXPECTATION:${field}`]);
    }
    const value = expectation[field];
    if (value === null || value === undefined) {
      return deny(CAPABILITY_DECISIONS.DENY_INCOMPLETE_EXPECTATION, [`NULL_EXPECTATION:${field}`]);
    }
    if (typeof value !== 'string') {
      return deny(CAPABILITY_DECISIONS.DENY_INCOMPLETE_EXPECTATION, [`INVALID_TYPE_EXPECTATION:${field}`]);
    }
    if (value.length === 0) {
      return deny(CAPABILITY_DECISIONS.DENY_INCOMPLETE_EXPECTATION, [`EMPTY_EXPECTATION:${field}`]);
    }
  }

  if (
    expectation.capabilityStage !== CAPABILITY_STAGES.BOOTSTRAP_REQUEST
    && expectation.capabilityStage !== CAPABILITY_STAGES.LEASE_BOUND
  ) {
    return deny(CAPABILITY_DECISIONS.DENY_INCOMPLETE_EXPECTATION, ['INVALID_EXPECTATION_STAGE']);
  }

  // Stage on expectation must be explicit; if token stage is LEASE_BOUND, fencing is mandatory
  // even when expectation.stage string is present but leaseContext omitted.
  if (expectation.capabilityStage === CAPABILITY_STAGES.LEASE_BOUND
    || parsedClaims.capabilityStage === CAPABILITY_STAGES.LEASE_BOUND) {
    if (!isPlainObject(expectation.leaseContext)) {
      return deny(CAPABILITY_DECISIONS.DENY_MISSING_LEASE_FENCING, [
        'EXPECTED_LEASE_FENCING_REQUIRED',
      ]);
    }
    if (!isNonEmptyString(expectation.leaseContext.leaseId)) {
      return deny(CAPABILITY_DECISIONS.DENY_MISSING_LEASE_FENCING, [
        'EXPECTED_LEASE_ID_REQUIRED',
      ]);
    }
    if (!isSafeInteger(expectation.leaseContext.fencingEpoch)
      || expectation.leaseContext.fencingEpoch < 0) {
      return deny(CAPABILITY_DECISIONS.DENY_MISSING_LEASE_FENCING, [
        'EXPECTED_FENCING_EPOCH_REQUIRED',
      ]);
    }
  }

  return null;
}

/**
 * Documented retry helper: same still-valid token may be re-presented for the same
 * expectation. This does NOT provide exactly-once execution.
 */
export function verifyCapabilityRetry(token, expectation, deps) {
  return verifyCapability(token, expectation, deps);
}
