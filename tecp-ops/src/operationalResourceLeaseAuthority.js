/**
 * TECP-OPS-PILOT-001 S2 — additive Operational ResourceLeaseAuthority.
 *
 * Does NOT mutate frozen S1 resourceLeaseAuthority.js.
 * S1 TEST_ONLY credentials are rejected as operational authority.
 * Successful verification is NOT operational dispatch authority.
 * Operational signing/custody path remains NOT_OPERATIONALLY_ACTIVATED.
 */

import {
  createPrivateKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
} from 'node:crypto';

import {
  b64urlDecode,
  b64urlEncode,
  canonicalJson,
  parseJsonObjectRejectDuplicates,
} from './config.js';
import {
  TRUST_ROOT_AUDIENCE,
  isBrandedOwnerInstalledTrustRoot,
  rejectCallerSuppliedTrustRegistry,
} from './ownerInstalledTrustRoot.js';
import {
  S1_KIND,
} from './resourceLeaseAuthority.js';

export const S2_ALG = 'Ed25519';
export const S2_KIND = 'TECP_OPS_OPERATIONAL_RESOURCE_LEASE_AUTHORITY_V1';
export const S2_PROOF_CLASS = 'OFFLINE_NON_OPERATIONAL_OPERATIONAL_RLA';
export const S2_MAX_TTL_MS = 5 * 60 * 1000;
export const S2_GOVERNANCE_REVISION =
  'OPS_PILOT_001_S2_EXACT_17_PATH_GOVERNANCE_20261110';

export const S2_STAGES = Object.freeze({
  BOOTSTRAP: 'BOOTSTRAP',
  LEASE_BOUND: 'LEASE_BOUND',
});

export const ORLA_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MALFORMED: 'DENY_MALFORMED',
  DENY_DUPLICATE_FIELDS: 'DENY_DUPLICATE_FIELDS',
  DENY_MISSING_SIGNATURE: 'DENY_MISSING_SIGNATURE',
  DENY_INVALID_SIGNATURE: 'DENY_INVALID_SIGNATURE',
  DENY_WRONG_KEY: 'DENY_WRONG_KEY',
  DENY_UNKNOWN_KID: 'DENY_UNKNOWN_KID',
  DENY_UNSUPPORTED_ALGORITHM: 'DENY_UNSUPPORTED_ALGORITHM',
  DENY_WRONG_ISSUER: 'DENY_WRONG_ISSUER',
  DENY_WRONG_AUDIENCE: 'DENY_WRONG_AUDIENCE',
  DENY_EXPIRED: 'DENY_EXPIRED',
  DENY_NOT_YET_VALID: 'DENY_NOT_YET_VALID',
  DENY_EXCESSIVE_TTL: 'DENY_EXCESSIVE_TTL',
  DENY_MISSING_CLAIM: 'DENY_MISSING_CLAIM',
  DENY_UNKNOWN_CLAIM: 'DENY_UNKNOWN_CLAIM',
  DENY_UNSUPPORTED_STAGE: 'DENY_UNSUPPORTED_STAGE',
  DENY_STAGE_SUBSTITUTION: 'DENY_STAGE_SUBSTITUTION',
  DENY_WRONG_PRINCIPAL: 'DENY_WRONG_PRINCIPAL',
  DENY_WRONG_TASK: 'DENY_WRONG_TASK',
  DENY_WRONG_ACTION: 'DENY_WRONG_ACTION',
  DENY_WRONG_RESOURCE_TYPE: 'DENY_WRONG_RESOURCE_TYPE',
  DENY_WRONG_RESOURCE_KEY: 'DENY_WRONG_RESOURCE_KEY',
  DENY_CROSS_RESOURCE_REUSE: 'DENY_CROSS_RESOURCE_REUSE',
  DENY_CROSS_TASK_REUSE: 'DENY_CROSS_TASK_REUSE',
  DENY_CROSS_WORKER_REUSE: 'DENY_CROSS_WORKER_REUSE',
  DENY_WRONG_GOVERNANCE_REVISION: 'DENY_WRONG_GOVERNANCE_REVISION',
  DENY_MISSING_LEASE_KEY: 'DENY_MISSING_LEASE_KEY',
  DENY_MISMATCHED_LEASE_KEY: 'DENY_MISMATCHED_LEASE_KEY',
  DENY_MISSING_FENCING_EPOCH: 'DENY_MISSING_FENCING_EPOCH',
  DENY_INVALID_FENCING_EPOCH: 'DENY_INVALID_FENCING_EPOCH',
  DENY_MISMATCHED_FENCING_EPOCH: 'DENY_MISMATCHED_FENCING_EPOCH',
  DENY_UNTRUSTED_LEASE_CONTEXT: 'DENY_UNTRUSTED_LEASE_CONTEXT',
  DENY_S1_OFFLINE_LEASE_FIXTURE: 'DENY_S1_OFFLINE_LEASE_FIXTURE',
  DENY_BOOTSTRAP_LEASE_FIELDS: 'DENY_BOOTSTRAP_LEASE_FIELDS',
  DENY_CP1_RESOURCEPATHS_AS_DLP_IDENTITY: 'DENY_CP1_RESOURCEPATHS_AS_DLP_IDENTITY',
  DENY_S1_TEST_ONLY_CREDENTIAL: 'DENY_S1_TEST_ONLY_CREDENTIAL',
  DENY_MISSING_TRUST_ROOT: 'DENY_MISSING_TRUST_ROOT',
  DENY_UNTRUSTED_ISSUER: 'DENY_UNTRUSTED_ISSUER',
  DENY_REVOKED: 'DENY_REVOKED',
  DENY_MISSING_REVOCATION: 'DENY_MISSING_REVOCATION',
  DENY_REVOCATION_UNAVAILABLE: 'DENY_REVOCATION_UNAVAILABLE',
  DENY_REPLAY: 'DENY_REPLAY',
  DENY_MISSING_REPLAY: 'DENY_MISSING_REPLAY',
  DENY_REPLAY_UNAVAILABLE: 'DENY_REPLAY_UNAVAILABLE',
  DENY_MISSING_CLOCK: 'DENY_MISSING_CLOCK',
  DENY_WORKER_SUPPLIED_TRUST_ANCHOR: 'DENY_WORKER_SUPPLIED_TRUST_ANCHOR',
  DENY_NONCANONICAL: 'DENY_NONCANONICAL',
  DENY_OPERATIONAL_SIGNER_INACTIVE: 'DENY_OPERATIONAL_SIGNER_INACTIVE',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
  DENY_OPERATIONAL_DISPATCH: 'DENY_OPERATIONAL_DISPATCH',
});

const BOOTSTRAP_CLAIM_KEYS = Object.freeze([
  'action',
  'alg',
  'aud',
  'expiresAt',
  'governanceRevision',
  'iss',
  'issuedAt',
  'jti',
  'kid',
  'kind',
  'principalId',
  'resourceKey',
  'resourceType',
  'stage',
  'taskId',
]);

const LEASE_BOUND_CLAIM_KEYS = Object.freeze([
  ...BOOTSTRAP_CLAIM_KEYS,
  'fencingEpoch',
  'leaseKey',
]);

const privilegedTestIssuerLatch = new WeakSet();
const brandedOperationalArtifact = new WeakSet();
const brandedDbLeaseContextAcceptors = [];

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
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    claims: null,
    artifact: null,
    classification: S2_PROOF_CLASS,
    operationalDispatchAuthorized: false,
    signatureValid: false,
    issuerAuthorized: false,
  });
}

function allow(claims, artifact, reasons, extras = {}) {
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: ORLA_DECISIONS.ALLOW,
    reasons: Object.freeze([...reasons]),
    claims: Object.freeze({ ...claims }),
    token: artifact?.token ?? null,
    artifact,
    classification: S2_PROOF_CLASS,
    operationalDispatchAuthorized: false,
    signatureValid: extras.signatureValid === true,
    issuerAuthorized: extras.issuerAuthorized === true,
  });
}

function claimKeysForStage(stage) {
  if (stage === S2_STAGES.BOOTSTRAP) return BOOTSTRAP_CLAIM_KEYS;
  if (stage === S2_STAGES.LEASE_BOUND) return LEASE_BOUND_CLAIM_KEYS;
  return null;
}

function rejectCp1ResourcePathsConfusion(input) {
  if (!isPlainObject(input)) return null;
  if (Object.prototype.hasOwnProperty.call(input, 'resourcePaths')) {
    return 'CP1_RESOURCEPATHS_PRESENT';
  }
  if (Array.isArray(input.resourceType) || Array.isArray(input.resourceKey)) {
    return 'CP1_RESOURCEPATHS_SHAPE';
  }
  return null;
}

function validateClaimsShape(claims) {
  if (!isPlainObject(claims)) return 'CLAIMS_OBJECT_REQUIRED';
  if (!isNonEmptyString(claims.stage)) return 'MISSING_CLAIM:stage';
  const keys = claimKeysForStage(claims.stage);
  if (!keys) return 'UNSUPPORTED_STAGE';
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(claims, key)) {
      return `MISSING_CLAIM:${key}`;
    }
  }
  for (const key of Object.keys(claims)) {
    if (!keys.includes(key)) return `UNKNOWN_CLAIM:${key}`;
  }
  if (claims.kind === S1_KIND) return 'S1_TEST_ONLY_KIND';
  if (claims.kind !== S2_KIND) return 'INVALID_KIND';
  if (claims.alg !== S2_ALG) return 'UNSUPPORTED_ALGORITHM';
  if (!isNonEmptyString(claims.iss)) return 'INVALID_ISS';
  if (!isNonEmptyString(claims.aud)) return 'INVALID_AUD';
  if (!isNonEmptyString(claims.kid)) return 'INVALID_KID';
  if (!isNonEmptyString(claims.principalId)) return 'INVALID_PRINCIPAL';
  if (!isNonEmptyString(claims.taskId)) return 'INVALID_TASK';
  if (!isNonEmptyString(claims.action)) return 'INVALID_ACTION';
  if (!isNonEmptyString(claims.resourceType)) return 'INVALID_RESOURCE_TYPE';
  if (!isNonEmptyString(claims.resourceKey)) return 'INVALID_RESOURCE_KEY';
  if (!isNonEmptyString(claims.governanceRevision)) return 'INVALID_GOVERNANCE_REVISION';
  if (!isNonEmptyString(claims.jti)) return 'INVALID_JTI';
  if (!isSafeInteger(claims.issuedAt) || claims.issuedAt < 0) return 'INVALID_ISSUED_AT';
  if (!isSafeInteger(claims.expiresAt) || claims.expiresAt <= claims.issuedAt) {
    return 'INVALID_EXPIRES_AT';
  }
  if (claims.expiresAt - claims.issuedAt > S2_MAX_TTL_MS) return 'EXCESSIVE_TTL';
  if (claims.stage === S2_STAGES.BOOTSTRAP) {
    if (
      Object.prototype.hasOwnProperty.call(claims, 'leaseKey')
      || Object.prototype.hasOwnProperty.call(claims, 'fencingEpoch')
    ) {
      return 'BOOTSTRAP_MUST_NOT_CARRY_LEASE_FIELDS';
    }
  }
  if (claims.stage === S2_STAGES.LEASE_BOUND) {
    if (!isNonEmptyString(claims.leaseKey)) return 'INVALID_LEASE_KEY';
    if (!isSafeInteger(claims.fencingEpoch) || claims.fencingEpoch < 0) {
      return 'INVALID_FENCING_EPOCH';
    }
  }
  return null;
}

function buildClaims(input) {
  const pathConfusion = rejectCp1ResourcePathsConfusion(input);
  if (pathConfusion) return { error: pathConfusion };
  if (!isPlainObject(input)) return { error: 'INPUT_OBJECT_REQUIRED' };
  if (!isNonEmptyString(input.stage)) return { error: 'MISSING_CLAIM:stage' };
  if (
    input.stage === S2_STAGES.BOOTSTRAP
    && (
      Object.prototype.hasOwnProperty.call(input, 'leaseKey')
      || Object.prototype.hasOwnProperty.call(input, 'fencingEpoch')
    )
  ) {
    return { error: 'BOOTSTRAP_MUST_NOT_CARRY_LEASE_FIELDS' };
  }
  const claims = {
    action: input.action,
    alg: S2_ALG,
    aud: input.aud || TRUST_ROOT_AUDIENCE,
    expiresAt: input.expiresAt,
    governanceRevision: input.governanceRevision,
    iss: input.iss,
    issuedAt: input.issuedAt,
    jti: input.jti || b64urlEncode(randomBytes(16)),
    kid: input.kid,
    kind: S2_KIND,
    principalId: input.principalId,
    resourceKey: input.resourceKey,
    resourceType: input.resourceType,
    stage: input.stage,
    taskId: input.taskId,
  };
  if (input.stage === S2_STAGES.LEASE_BOUND) {
    claims.fencingEpoch = input.fencingEpoch;
    claims.leaseKey = input.leaseKey;
  }
  const err = validateClaimsShape(claims);
  if (err) return { error: err };
  return { claims };
}

function rejectTrustAnchorSmuggling(bag, label) {
  if (!isPlainObject(bag)) return null;
  for (const key of [
    'trustAnchor',
    'publicKey',
    'publicKeyPem',
    'privateKey',
    'privateKeyPem',
    'verifier',
    'verifyKey',
    'signingKey',
    'keyRegistry',
  ]) {
    if (Object.prototype.hasOwnProperty.call(bag, key)) {
      return `${label}:${key}`;
    }
  }
  return null;
}

export function generateEphemeralOperationalRlaKeyPairForTests() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return Object.freeze({
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
}

export function createInjectedClock(nowMs) {
  if (!isSafeInteger(nowMs) || nowMs < 0) throw new TypeError('CLOCK_NOW_REQUIRED');
  let current = nowMs;
  return Object.freeze({
    nowMs() {
      return current;
    },
    setNowMs(value) {
      if (!isSafeInteger(value) || value < 0) throw new TypeError('INVALID_CLOCK');
      current = value;
    },
  });
}

export function createInMemoryRevocationRegistry() {
  const revoked = new Set();
  let available = true;
  return Object.freeze({
    revoke(jti) {
      if (!isNonEmptyString(jti)) throw new TypeError('JTI_REQUIRED');
      revoked.add(jti);
    },
    isRevoked(jti) {
      if (!available) {
        const err = new Error('REVOCATION_UNAVAILABLE');
        err.code = 'REVOCATION_UNAVAILABLE';
        throw err;
      }
      if (!isNonEmptyString(jti)) return true;
      return revoked.has(jti);
    },
    setAvailable(flag) {
      available = flag === true;
    },
    volatility: 'PROCESS_LOCAL_NOT_DURABLE',
  });
}

export function createInMemoryReplayRegistry() {
  const presented = new Set();
  let available = true;
  return Object.freeze({
    hasPresented(jti) {
      if (!available) {
        const err = new Error('REPLAY_REGISTRY_UNAVAILABLE');
        err.code = 'REPLAY_REGISTRY_UNAVAILABLE';
        throw err;
      }
      return presented.has(jti);
    },
    markPresented(jti) {
      if (!available) {
        const err = new Error('REPLAY_REGISTRY_UNAVAILABLE');
        err.code = 'REPLAY_REGISTRY_UNAVAILABLE';
        throw err;
      }
      if (!isNonEmptyString(jti)) {
        const err = new Error('INVALID_JTI');
        err.code = 'INVALID_JTI';
        throw err;
      }
      if (presented.has(jti)) return false;
      presented.add(jti);
      return true;
    },
    setAvailable(flag) {
      available = flag === true;
    },
    volatility: 'PROCESS_LOCAL_NOT_DURABLE',
  });
}

/**
 * Register a DB-issued lease context brand acceptor without importing persistence
 * at module load. Persistence modules call this once when projecting branded
 * contexts. Callers cannot forge acceptance by supplying plain objects.
 */
export function registerDbIssuedLeaseContextBrand(brandPredicate) {
  if (typeof brandPredicate !== 'function') {
    throw new TypeError('BRAND_PREDICATE_REQUIRED');
  }
  brandedDbLeaseContextAcceptors.push(brandPredicate);
  return Object.freeze({ registered: true });
}

function isAcceptedDbIssuedLeaseContext(value) {
  if (value == null || typeof value !== 'object') return false;
  if (value.kind === 'OFFLINE_TRUSTED_LEASE_FIXTURE'
    || value.proofClass === 'OFFLINE_FIXTURE_NOT_DB_AUTHORITY') {
    return false;
  }
  for (const predicate of brandedDbLeaseContextAcceptors) {
    try {
      if (predicate(value) === true) return true;
    } catch {
      // fail closed for broken predicates
    }
  }
  return false;
}

/**
 * Offline TEST_ONLY issuer for Operational RLA positive contracts.
 * NOT an operational custody path.
 */
export function createTestOnlyOperationalRlaIssuer(options = {}) {
  if (!isPlainObject(options)) throw new TypeError('ISSUER_OPTIONS_REQUIRED');
  const { kid, iss, privateKeyPem, trustRoot } = options;
  if (!isNonEmptyString(kid) || !isNonEmptyString(iss) || !isNonEmptyString(privateKeyPem)) {
    throw new TypeError('KID_ISS_PRIVATE_KEY_REQUIRED');
  }
  if (!isBrandedOwnerInstalledTrustRoot(trustRoot)) {
    throw new TypeError('BRANDED_TRUST_ROOT_REQUIRED');
  }
  const privateKey = createPrivateKey(privateKeyPem);
  const issuer = Object.freeze({
    kind: 'TEST_ONLY_OPERATIONAL_RLA_ISSUER',
    proofClass: S2_PROOF_CLASS,
    operationalSignerActivated: false,
    kid,
    iss,
    issue(input) {
      const built = buildClaims({ ...input, kid, iss, aud: input.aud || TRUST_ROOT_AUDIENCE });
      if (built.error) {
        if (built.error === 'S1_TEST_ONLY_KIND') {
          return deny(ORLA_DECISIONS.DENY_S1_TEST_ONLY_CREDENTIAL, [built.error]);
        }
        if (built.error === 'CP1_RESOURCEPATHS_PRESENT' || built.error === 'CP1_RESOURCEPATHS_SHAPE') {
          return deny(ORLA_DECISIONS.DENY_CP1_RESOURCEPATHS_AS_DLP_IDENTITY, [built.error]);
        }
        if (built.error === 'UNSUPPORTED_STAGE') {
          return deny(ORLA_DECISIONS.DENY_UNSUPPORTED_STAGE, [built.error]);
        }
        if (String(built.error).startsWith('MISSING_CLAIM:')) {
          return deny(ORLA_DECISIONS.DENY_MISSING_CLAIM, [built.error]);
        }
        if (String(built.error).startsWith('UNKNOWN_CLAIM:')) {
          return deny(ORLA_DECISIONS.DENY_UNKNOWN_CLAIM, [built.error]);
        }
        if (built.error === 'BOOTSTRAP_MUST_NOT_CARRY_LEASE_FIELDS') {
          return deny(ORLA_DECISIONS.DENY_BOOTSTRAP_LEASE_FIELDS, [built.error]);
        }
        return deny(ORLA_DECISIONS.DENY_MALFORMED, [built.error]);
      }
      const payload = canonicalJson(built.claims);
      const signature = b64urlEncode(sign(null, Buffer.from(payload, 'utf8'), privateKey));
      const token = `${b64urlEncode(Buffer.from(payload, 'utf8'))}.${signature}`;
      const artifact = Object.freeze({
        kind: S2_KIND,
        token,
        claims: Object.freeze({ ...built.claims }),
        classification: S2_PROOF_CLASS,
        operationalDispatchAuthorized: false,
      });
      brandedOperationalArtifact.add(artifact);
      return allow(
        built.claims,
        artifact,
        ['TEST_ONLY_OPERATIONAL_RLA_ISSUED', 'NOT_OPERATIONAL_CUSTODY'],
        { signatureValid: true, issuerAuthorized: true },
      );
    },
  });
  privilegedTestIssuerLatch.add(issuer);
  return issuer;
}

export function isPrivilegedTestOnlyOperationalRlaIssuer(issuer) {
  return issuer !== null && typeof issuer === 'object' && privilegedTestIssuerLatch.has(issuer);
}

export function isBrandedOperationalRlaArtifact(artifact) {
  return artifact !== null && typeof artifact === 'object' && brandedOperationalArtifact.has(artifact);
}

/**
 * Operational custody signer — intentionally inactive in Gate B.
 */
export function createOperationalRlaSigner() {
  return Object.freeze({
    kind: 'OPERATIONAL_RLA_SIGNER',
    status: 'NOT_OPERATIONALLY_ACTIVATED',
    issue() {
      return deny(ORLA_DECISIONS.DENY_OPERATIONAL_SIGNER_INACTIVE, [
        'NOT_OPERATIONALLY_ACTIVATED',
        'GATE_B_FORBIDS_OPERATIONAL_SIGNING',
      ]);
    },
  });
}

/**
 * Verify an Operational ResourceLeaseAuthority token.
 * Separates cryptographic signature validity from trusted issuer authorization.
 */
export function verifyOperationalResourceLeaseAuthority(tokenOrArtifact, expectation = {}, deps = {}) {
  const token = isPlainObject(tokenOrArtifact) && isNonEmptyString(tokenOrArtifact.token)
    ? tokenOrArtifact.token
    : tokenOrArtifact;

  const smuggledToken = rejectTrustAnchorSmuggling(
    isPlainObject(tokenOrArtifact) ? tokenOrArtifact : null,
    'TOKEN_BAG',
  );
  if (smuggledToken) {
    return deny(ORLA_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR, [smuggledToken]);
  }
  const smuggledExpectation = rejectTrustAnchorSmuggling(expectation, 'EXPECTATION');
  if (smuggledExpectation) {
    return deny(ORLA_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR, [smuggledExpectation]);
  }
  const smuggledDeps = rejectTrustAnchorSmuggling(deps, 'DEPS');
  if (smuggledDeps) {
    return deny(ORLA_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR, [smuggledDeps]);
  }

  const callerRegistry = rejectCallerSuppliedTrustRegistry(deps);
  if (!callerRegistry.ok) {
    return deny(ORLA_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR, callerRegistry.reasons);
  }

  if (expectation && Object.prototype.hasOwnProperty.call(expectation, 'resourcePaths')) {
    return deny(ORLA_DECISIONS.DENY_CP1_RESOURCEPATHS_AS_DLP_IDENTITY, [
      'EXPECTATION_RESOURCEPATHS_FORBIDDEN',
    ]);
  }

  if (token == null) {
    return deny(ORLA_DECISIONS.DENY_MISSING_SIGNATURE, ['TOKEN_REQUIRED']);
  }
  if (!isNonEmptyString(token) || !token.includes('.')) {
    return deny(ORLA_DECISIONS.DENY_MALFORMED, ['TOKEN_FORMAT']);
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return deny(ORLA_DECISIONS.DENY_MALFORMED, ['TOKEN_PARTS']);
  }
  const [payloadB64, sigB64] = parts;
  if (!isNonEmptyString(sigB64)) {
    return deny(ORLA_DECISIONS.DENY_MISSING_SIGNATURE, ['SIGNATURE_REQUIRED']);
  }
  const payloadBuf = b64urlDecode(payloadB64);
  const sigBuf = b64urlDecode(sigB64);
  if (!payloadBuf || !sigBuf) {
    return deny(ORLA_DECISIONS.DENY_MALFORMED, ['B64URL_DECODE']);
  }

  const payloadText = payloadBuf.toString('utf8');
  const parsed = parseJsonObjectRejectDuplicates(payloadText);
  if (!parsed.ok) {
    if (String(parsed.reason).startsWith('DUPLICATE_KEY')) {
      return deny(ORLA_DECISIONS.DENY_DUPLICATE_FIELDS, [parsed.reason]);
    }
    return deny(ORLA_DECISIONS.DENY_MALFORMED, [parsed.reason]);
  }

  let canonical;
  try {
    canonical = canonicalJson(parsed.value);
  } catch {
    return deny(ORLA_DECISIONS.DENY_NONCANONICAL, ['CANONICALIZE_FAILED']);
  }
  if (canonical !== payloadText) {
    return deny(ORLA_DECISIONS.DENY_NONCANONICAL, ['PAYLOAD_NOT_CANONICAL']);
  }

  if (parsed.value?.kind === S1_KIND) {
    return deny(ORLA_DECISIONS.DENY_S1_TEST_ONLY_CREDENTIAL, [
      'S1_TEST_ONLY_NOT_OPERATIONAL_AUTHORITY',
    ]);
  }

  const shapeErr = validateClaimsShape(parsed.value);
  if (shapeErr) {
    if (shapeErr === 'S1_TEST_ONLY_KIND') {
      return deny(ORLA_DECISIONS.DENY_S1_TEST_ONLY_CREDENTIAL, [shapeErr]);
    }
    if (shapeErr === 'UNSUPPORTED_STAGE') {
      return deny(ORLA_DECISIONS.DENY_UNSUPPORTED_STAGE, [shapeErr]);
    }
    if (String(shapeErr).startsWith('MISSING_CLAIM:')) {
      return deny(ORLA_DECISIONS.DENY_MISSING_CLAIM, [shapeErr]);
    }
    if (String(shapeErr).startsWith('UNKNOWN_CLAIM:')) {
      return deny(ORLA_DECISIONS.DENY_UNKNOWN_CLAIM, [shapeErr]);
    }
    if (shapeErr === 'UNSUPPORTED_ALGORITHM') {
      return deny(ORLA_DECISIONS.DENY_UNSUPPORTED_ALGORITHM, [shapeErr]);
    }
    if (shapeErr === 'BOOTSTRAP_MUST_NOT_CARRY_LEASE_FIELDS') {
      return deny(ORLA_DECISIONS.DENY_BOOTSTRAP_LEASE_FIELDS, [shapeErr]);
    }
    if (shapeErr === 'EXCESSIVE_TTL') {
      return deny(ORLA_DECISIONS.DENY_EXCESSIVE_TTL, [shapeErr]);
    }
    return deny(ORLA_DECISIONS.DENY_MALFORMED, [shapeErr]);
  }

  const claims = parsed.value;
  if (!isPlainObject(expectation) || !isNonEmptyString(expectation.stage)) {
    return deny(ORLA_DECISIONS.DENY_DEFAULT_FAIL_CLOSED, ['EXPECTATION_STAGE_REQUIRED']);
  }
  if (expectation.stage !== claims.stage) {
    return deny(ORLA_DECISIONS.DENY_STAGE_SUBSTITUTION, [
      `STAGE_MISMATCH:${claims.stage}->${expectation.stage}`,
    ]);
  }

  if (!isBrandedOwnerInstalledTrustRoot(deps.trustRoot)) {
    return deny(ORLA_DECISIONS.DENY_MISSING_TRUST_ROOT, ['BRANDED_TRUST_ROOT_REQUIRED']);
  }
  if (deps.clock == null || typeof deps.clock.nowMs !== 'function') {
    return deny(ORLA_DECISIONS.DENY_MISSING_CLOCK, ['CLOCK_REQUIRED']);
  }
  if (deps.revocationRegistry == null || typeof deps.revocationRegistry.isRevoked !== 'function') {
    return deny(ORLA_DECISIONS.DENY_MISSING_REVOCATION, ['REVOCATION_REQUIRED']);
  }
  if (
    deps.replayRegistry == null
    || typeof deps.replayRegistry.hasPresented !== 'function'
    || typeof deps.replayRegistry.markPresented !== 'function'
  ) {
    return deny(ORLA_DECISIONS.DENY_MISSING_REPLAY, ['REPLAY_REGISTRY_REQUIRED']);
  }

  const lookup = deps.trustRoot.lookup({
    kid: claims.kid,
    issuerId: claims.iss,
    audience: claims.aud,
    governanceRevision: claims.governanceRevision,
  });
  if (!lookup.ok) {
    if (lookup.decision === 'DENY_UNKNOWN_KID' || lookup.decision === 'DENY_REVOKED_KID') {
      return deny(
        lookup.decision === 'DENY_REVOKED_KID'
          ? ORLA_DECISIONS.DENY_WRONG_KEY
          : ORLA_DECISIONS.DENY_UNKNOWN_KID,
        lookup.reasons,
      );
    }
    if (lookup.decision === 'DENY_WRONG_ISSUER') {
      return deny(ORLA_DECISIONS.DENY_UNTRUSTED_ISSUER, lookup.reasons);
    }
    if (lookup.decision === 'DENY_WRONG_AUDIENCE') {
      return deny(ORLA_DECISIONS.DENY_WRONG_AUDIENCE, lookup.reasons);
    }
    if (lookup.decision === 'DENY_WRONG_GOVERNANCE_REVISION') {
      return deny(ORLA_DECISIONS.DENY_WRONG_GOVERNANCE_REVISION, lookup.reasons);
    }
    return deny(ORLA_DECISIONS.DENY_UNTRUSTED_ISSUER, lookup.reasons);
  }

  const publicKey = lookup.entry.publicKey;
  let signatureValid = false;
  try {
    signatureValid = verify(null, Buffer.from(canonical, 'utf8'), publicKey, sigBuf);
  } catch {
    return deny(ORLA_DECISIONS.DENY_INVALID_SIGNATURE, ['VERIFY_THREW']);
  }
  if (!signatureValid) {
    return deny(ORLA_DECISIONS.DENY_INVALID_SIGNATURE, ['SIGNATURE_MISMATCH']);
  }

  // Signature valid, but issuer authorization is a distinct gate (already passed via trust root).
  const issuerAuthorized = true;

  if (isNonEmptyString(expectation.iss) && expectation.iss !== claims.iss) {
    return deny(ORLA_DECISIONS.DENY_WRONG_ISSUER, ['ISS_MISMATCH']);
  }
  if (isNonEmptyString(expectation.kid) && expectation.kid !== claims.kid) {
    return deny(ORLA_DECISIONS.DENY_WRONG_KEY, ['KID_MISMATCH']);
  }
  if (isNonEmptyString(expectation.aud) && expectation.aud !== claims.aud) {
    return deny(ORLA_DECISIONS.DENY_WRONG_AUDIENCE, ['AUD_MISMATCH']);
  }
  if (!isNonEmptyString(expectation.principalId) || expectation.principalId !== claims.principalId) {
    return deny(ORLA_DECISIONS.DENY_WRONG_PRINCIPAL, ['PRINCIPAL_MISMATCH']);
  }
  if (!isNonEmptyString(expectation.taskId) || expectation.taskId !== claims.taskId) {
    return deny(ORLA_DECISIONS.DENY_WRONG_TASK, ['TASK_MISMATCH']);
  }
  if (!isNonEmptyString(expectation.action) || expectation.action !== claims.action) {
    return deny(ORLA_DECISIONS.DENY_WRONG_ACTION, ['ACTION_MISMATCH']);
  }
  if (
    !isNonEmptyString(expectation.resourceType)
    || expectation.resourceType !== claims.resourceType
  ) {
    return deny(ORLA_DECISIONS.DENY_WRONG_RESOURCE_TYPE, ['RESOURCE_TYPE_MISMATCH']);
  }
  if (
    !isNonEmptyString(expectation.resourceKey)
    || expectation.resourceKey !== claims.resourceKey
  ) {
    return deny(ORLA_DECISIONS.DENY_WRONG_RESOURCE_KEY, ['RESOURCE_KEY_MISMATCH']);
  }
  if (
    !isNonEmptyString(expectation.governanceRevision)
    || expectation.governanceRevision !== claims.governanceRevision
  ) {
    return deny(ORLA_DECISIONS.DENY_WRONG_GOVERNANCE_REVISION, ['GOVERNANCE_REVISION_MISMATCH']);
  }

  if (
    isPlainObject(expectation.forbidResource)
    && expectation.forbidResource.resourceType === claims.resourceType
    && expectation.forbidResource.resourceKey === claims.resourceKey
  ) {
    return deny(ORLA_DECISIONS.DENY_CROSS_RESOURCE_REUSE, ['FORBIDDEN_RESOURCE_REUSE']);
  }
  if (
    isNonEmptyString(expectation.forbidTaskId)
    && expectation.forbidTaskId === claims.taskId
  ) {
    return deny(ORLA_DECISIONS.DENY_CROSS_TASK_REUSE, ['FORBIDDEN_TASK_REUSE']);
  }
  if (
    isNonEmptyString(expectation.forbidPrincipalId)
    && expectation.forbidPrincipalId === claims.principalId
  ) {
    return deny(ORLA_DECISIONS.DENY_CROSS_WORKER_REUSE, ['FORBIDDEN_WORKER_REUSE']);
  }

  let now;
  try {
    now = deps.clock.nowMs();
  } catch {
    return deny(ORLA_DECISIONS.DENY_MISSING_CLOCK, ['CLOCK_UNAVAILABLE']);
  }
  if (!isSafeInteger(now) || now < 0) {
    return deny(ORLA_DECISIONS.DENY_MISSING_CLOCK, ['CLOCK_INVALID']);
  }
  if (now < claims.issuedAt) {
    return deny(ORLA_DECISIONS.DENY_NOT_YET_VALID, ['ISSUED_IN_FUTURE']);
  }
  if (now >= claims.expiresAt) {
    return deny(ORLA_DECISIONS.DENY_EXPIRED, ['EXPIRED']);
  }

  try {
    if (deps.revocationRegistry.isRevoked(claims.jti) === true) {
      return deny(ORLA_DECISIONS.DENY_REVOKED, ['JTI_REVOKED']);
    }
  } catch (err) {
    return deny(ORLA_DECISIONS.DENY_REVOCATION_UNAVAILABLE, [
      err?.code || 'REVOCATION_UNAVAILABLE',
    ]);
  }

  try {
    if (deps.replayRegistry.hasPresented(claims.jti) === true) {
      return deny(ORLA_DECISIONS.DENY_REPLAY, ['JTI_ALREADY_PRESENTED']);
    }
  } catch (err) {
    return deny(ORLA_DECISIONS.DENY_REPLAY_UNAVAILABLE, [
      err?.code || 'REPLAY_REGISTRY_UNAVAILABLE',
    ]);
  }

  if (claims.stage === S2_STAGES.LEASE_BOUND) {
    const trusted = expectation.dbIssuedLeaseContext || expectation.trustedLeaseContext;
    if (
      trusted
      && (
        trusted.kind === 'OFFLINE_TRUSTED_LEASE_FIXTURE'
        || trusted.proofClass === 'OFFLINE_FIXTURE_NOT_DB_AUTHORITY'
      )
    ) {
      return deny(ORLA_DECISIONS.DENY_S1_OFFLINE_LEASE_FIXTURE, [
        'S1_OFFLINE_FIXTURE_NOT_DB_AUTHORITY',
      ]);
    }
    if (!isAcceptedDbIssuedLeaseContext(trusted)) {
      return deny(ORLA_DECISIONS.DENY_UNTRUSTED_LEASE_CONTEXT, [
        'DB_ISSUED_BRANDED_LEASE_CONTEXT_REQUIRED',
      ]);
    }
    if (trusted.leaseKey !== claims.leaseKey) {
      return deny(ORLA_DECISIONS.DENY_MISMATCHED_LEASE_KEY, ['LEASE_KEY_MISMATCH']);
    }
    if (trusted.fencingEpoch !== claims.fencingEpoch) {
      return deny(ORLA_DECISIONS.DENY_MISMATCHED_FENCING_EPOCH, ['FENCING_EPOCH_MISMATCH']);
    }
  }

  // Consume jti only after all authorization gates pass.
  try {
    const reserved = deps.replayRegistry.markPresented(claims.jti);
    if (reserved !== true) {
      return deny(ORLA_DECISIONS.DENY_REPLAY, ['JTI_CONSUME_FAILED']);
    }
  } catch (err) {
    return deny(ORLA_DECISIONS.DENY_REPLAY_UNAVAILABLE, [
      err?.code || 'REPLAY_REGISTRY_UNAVAILABLE',
    ]);
  }

  const artifact = Object.freeze({
    kind: S2_KIND,
    token,
    claims: Object.freeze({ ...claims }),
    classification: S2_PROOF_CLASS,
    operationalDispatchAuthorized: false,
  });
  brandedOperationalArtifact.add(artifact);

  return allow(
    claims,
    artifact,
    [
      'OPERATIONAL_RLA_VERIFIED',
      'NOT_OPERATIONAL_DISPATCH',
      'NOT_WORKER_OR_MCP_AUTHORITY',
    ],
    { signatureValid: true, issuerAuthorized },
  );
}

export function assertNoOperationalDispatch(verifyResult) {
  if (!isPlainObject(verifyResult) || verifyResult.operationalDispatchAuthorized === true) {
    return deny(ORLA_DECISIONS.DENY_OPERATIONAL_DISPATCH, ['DISPATCH_FORBIDDEN']);
  }
  return Object.freeze({
    ok: true,
    allowed: false,
    decision: 'NO_OPERATIONAL_DISPATCH',
    reasons: Object.freeze(['VERIFY_IS_NOT_DISPATCH']),
    operationalDispatchAuthorized: false,
  });
}
