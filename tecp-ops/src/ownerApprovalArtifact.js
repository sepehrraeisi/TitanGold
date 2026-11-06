/**
 * TECP-OPS-PILOT-001 CP1 — offline Owner approval artifacts (Ed25519).
 * TEST_ONLY ephemeral keys. No real Owner key custody. No Worker-facing issuance authority.
 */

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  randomBytes,
} from 'node:crypto';

import {
  CP1_ALG,
  CP1_CHECKPOINT,
  CP1_MAX_TTL_MS,
  CP1_MODE,
  CP1_OPERATION_CLASS,
  CP1_PURPOSE,
  CP1_REPOSITORY_ID,
  CP1_SLICE_ID,
  b64urlDecode,
  b64urlEncode,
  canonicalJson,
  parseJsonObjectRejectDuplicates,
  validateExactCp1Scope,
} from './config.js';

export const APPROVAL_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MALFORMED: 'DENY_MALFORMED',
  DENY_DUPLICATE_FIELDS: 'DENY_DUPLICATE_FIELDS',
  DENY_INVALID_SIGNATURE: 'DENY_INVALID_SIGNATURE',
  DENY_UNKNOWN_KID: 'DENY_UNKNOWN_KID',
  DENY_UNSUPPORTED_ALGORITHM: 'DENY_UNSUPPORTED_ALGORITHM',
  DENY_WRONG_REPOSITORY: 'DENY_WRONG_REPOSITORY',
  DENY_WRONG_SHA: 'DENY_WRONG_SHA',
  DENY_WRONG_SLICE: 'DENY_WRONG_SLICE',
  DENY_WRONG_CHECKPOINT: 'DENY_WRONG_CHECKPOINT',
  DENY_WRONG_ACTOR: 'DENY_WRONG_ACTOR',
  DENY_WRONG_TASK: 'DENY_WRONG_TASK',
  DENY_WRONG_OPERATION: 'DENY_WRONG_OPERATION',
  DENY_SCOPE_EXPANSION: 'DENY_SCOPE_EXPANSION',
  DENY_EXPIRED: 'DENY_EXPIRED',
  DENY_NBF_VIOLATION: 'DENY_NBF_VIOLATION',
  DENY_REVOKED: 'DENY_REVOKED',
  DENY_MISSING_VERIFIER: 'DENY_MISSING_VERIFIER',
  DENY_MISSING_CLOCK: 'DENY_MISSING_CLOCK',
  DENY_MISSING_REVOCATION: 'DENY_MISSING_REVOCATION',
  DENY_MISSING_KEY_REGISTRY: 'DENY_MISSING_KEY_REGISTRY',
  DENY_WORKER_SUPPLIED_TRUST_ANCHOR: 'DENY_WORKER_SUPPLIED_TRUST_ANCHOR',
  DENY_CROSS_SLICE_DLP_REUSE: 'DENY_CROSS_SLICE_DLP_REUSE',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
  DENY_RUNTIME_MODE: 'DENY_RUNTIME_MODE',
  DENY_NONCANONICAL: 'DENY_NONCANONICAL',
  DENY_EXCESSIVE_TTL: 'DENY_EXCESSIVE_TTL',
});

const CLAIM_KEY_ORDER = Object.freeze([
  'actorId',
  'alg',
  'authorizedFileScope',
  'baselineSha',
  'checkpoint',
  'domain',
  'exp',
  'iss',
  'jti',
  'kid',
  'kind',
  'nbf',
  'operationClass',
  'purpose',
  'repositoryId',
  'sliceId',
  'taskId',
]);

const privilegedIssuerLatch = new WeakSet();
const brandedApprovalArtifact = new WeakSet();

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
    artifact: null,
    claims: null,
  });
}

export function createInjectedClock(nowMs) {
  if (!isSafeInteger(nowMs)) throw new TypeError('CLOCK_NOW_REQUIRED');
  let current = nowMs;
  return Object.freeze({
    nowMs() {
      return current;
    },
    advanceMs(delta) {
      if (!isSafeInteger(delta)) throw new TypeError('DELTA_REQUIRED');
      current += delta;
      return current;
    },
    setNowMs(value) {
      if (!isSafeInteger(value)) throw new TypeError('NOW_REQUIRED');
      current = value;
      return current;
    },
  });
}

export function createInMemoryKeyRegistry() {
  const keys = new Map();
  return Object.freeze({
    registerPublicKey(kid, publicKeyPem, meta = {}) {
      if (!isNonEmptyString(kid)) throw new TypeError('KID_REQUIRED');
      if (!isNonEmptyString(publicKeyPem)) throw new TypeError('PUBLIC_KEY_REQUIRED');
      const keyObject = createPublicKey(publicKeyPem);
      keys.set(kid, Object.freeze({
        kid,
        publicKey: keyObject,
        publicKeyPem,
        enabled: meta.enabled !== false,
        alg: meta.alg || CP1_ALG,
        domain: meta.domain || 'TECP_OPS_OWNER_APPROVAL',
      }));
    },
    get(kid) {
      if (!isNonEmptyString(kid)) return null;
      return keys.get(kid) || null;
    },
    disable(kid) {
      const entry = keys.get(kid);
      if (!entry) return false;
      keys.set(kid, Object.freeze({ ...entry, enabled: false }));
      return true;
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
    // Process-local only; volatility is intentional for CP1.
    volatility: 'PROCESS_LOCAL_NOT_DURABLE',
  });
}

export function generateEphemeralEd25519KeyPairForTests() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return Object.freeze({
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
}

function validateClaims(claims) {
  if (!isPlainObject(claims)) return 'CLAIMS_OBJECT_REQUIRED';
  for (const key of CLAIM_KEY_ORDER) {
    if (!Object.prototype.hasOwnProperty.call(claims, key)) return `MISSING_CLAIM:${key}`;
  }
  for (const key of Object.keys(claims)) {
    if (!CLAIM_KEY_ORDER.includes(key)) return `UNKNOWN_CLAIM:${key}`;
  }
  if (claims.kind !== 'TECP_OPS_OWNER_APPROVAL_V1') return 'INVALID_KIND';
  if (claims.domain !== 'TECP_OPS_OWNER_APPROVAL') return 'INVALID_DOMAIN';
  if (claims.alg !== CP1_ALG) return 'UNSUPPORTED_ALGORITHM';
  if (!isNonEmptyString(claims.kid)) return 'INVALID_KID';
  if (!isNonEmptyString(claims.iss)) return 'INVALID_ISS';
  if (claims.repositoryId !== CP1_REPOSITORY_ID) return 'WRONG_REPOSITORY';
  if (!isNonEmptyString(claims.baselineSha) || !/^[0-9a-f]{40}$/i.test(claims.baselineSha)) {
    return 'WRONG_SHA';
  }
  if (claims.sliceId !== CP1_SLICE_ID) return 'WRONG_SLICE';
  if (claims.checkpoint !== CP1_CHECKPOINT) return 'WRONG_CHECKPOINT';
  if (claims.operationClass !== CP1_OPERATION_CLASS.CP1_OFFLINE_SECURITY_CONTRACT) {
    return 'WRONG_OPERATION';
  }
  if (!isNonEmptyString(claims.actorId)) return 'INVALID_ACTOR';
  if (!isNonEmptyString(claims.taskId)) return 'INVALID_TASK';
  if (!isNonEmptyString(claims.jti)) return 'INVALID_JTI';
  if (!isSafeInteger(claims.nbf) || claims.nbf < 0) return 'INVALID_NBF';
  if (!isSafeInteger(claims.exp) || claims.exp <= claims.nbf) return 'INVALID_EXP';
  if (claims.exp - claims.nbf > CP1_MAX_TTL_MS) return 'EXCESSIVE_TTL';
  if (claims.purpose !== CP1_PURPOSE) return 'INVALID_PURPOSE';
  const scopeCheck = validateExactCp1Scope(claims.authorizedFileScope);
  if (!scopeCheck.ok) return scopeCheck.decision;
  return null;
}

function buildClaims(input) {
  const scopeCheck = validateExactCp1Scope(input.authorizedFileScope);
  if (!scopeCheck.ok) return { error: scopeCheck.decision };
  const claims = {
    actorId: input.actorId,
    alg: CP1_ALG,
    authorizedFileScope: [...input.authorizedFileScope],
    baselineSha: input.baselineSha,
    checkpoint: CP1_CHECKPOINT,
    domain: 'TECP_OPS_OWNER_APPROVAL',
    exp: input.exp,
    iss: input.iss,
    jti: input.jti || b64urlEncode(randomBytes(16)),
    kid: input.kid,
    kind: 'TECP_OPS_OWNER_APPROVAL_V1',
    nbf: input.nbf,
    operationClass: CP1_OPERATION_CLASS.CP1_OFFLINE_SECURITY_CONTRACT,
    purpose: CP1_PURPOSE,
    repositoryId: CP1_REPOSITORY_ID,
    sliceId: CP1_SLICE_ID,
    taskId: input.taskId,
  };
  const err = validateClaims(claims);
  if (err) return { error: err };
  return { claims };
}

/**
 * Privileged TEST_ONLY issuer latch. Not a Worker-facing API.
 */
export function createTestOnlyOwnerApprovalIssuer(options = {}) {
  if (!isPlainObject(options)) throw new TypeError('ISSUER_OPTIONS_REQUIRED');
  const { kid, iss, privateKeyPem, keyRegistry } = options;
  if (!isNonEmptyString(kid) || !isNonEmptyString(iss) || !isNonEmptyString(privateKeyPem)) {
    throw new TypeError('KID_ISS_PRIVATE_KEY_REQUIRED');
  }
  if (keyRegistry == null || typeof keyRegistry.get !== 'function') {
    throw new TypeError('KEY_REGISTRY_REQUIRED');
  }
  const privateKey = createPrivateKey(privateKeyPem);
  const issuer = Object.freeze({
    kind: 'TEST_ONLY_OWNER_APPROVAL_ISSUER',
    kid,
    iss,
    issue(input) {
      const built = buildClaims({ ...input, kid, iss });
      if (built.error) {
        return deny(APPROVAL_DECISIONS.DENY_MALFORMED, [built.error]);
      }
      const payload = canonicalJson(built.claims);
      const signature = b64urlEncode(sign(null, Buffer.from(payload, 'utf8'), privateKey));
      const token = `${b64urlEncode(Buffer.from(payload, 'utf8'))}.${signature}`;
      return Object.freeze({
        ok: true,
        allowed: true,
        decision: APPROVAL_DECISIONS.ALLOW,
        reasons: Object.freeze(['TEST_ONLY_APPROVAL_ISSUED']),
        token,
        claims: Object.freeze({
          ...built.claims,
          authorizedFileScope: Object.freeze([...built.claims.authorizedFileScope]),
        }),
      });
    },
  });
  privilegedIssuerLatch.add(issuer);
  return issuer;
}

export function isPrivilegedTestOnlyOwnerApprovalIssuer(issuer) {
  return issuer !== null && typeof issuer === 'object' && privilegedIssuerLatch.has(issuer);
}

export function isBrandedOwnerApprovalArtifact(artifact) {
  return artifact !== null && typeof artifact === 'object' && brandedApprovalArtifact.has(artifact);
}

/**
 * Verify an Owner approval token against trusted deps. Rejects payload-carried trust anchors.
 */
export function verifyOwnerApprovalArtifact(token, expectation = {}, deps = {}) {
  if (token == null) {
    return deny(APPROVAL_DECISIONS.DENY_DEFAULT_FAIL_CLOSED, ['TOKEN_REQUIRED']);
  }
  if (isPlainObject(token)
    && (token.trustAnchor || token.publicKey || token.verifier || token.verifyKey)) {
    return deny(APPROVAL_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR, [
      'TRUST_ANCHOR_IN_PAYLOAD_FORBIDDEN',
    ]);
  }
  if (expectation && isPlainObject(expectation)
    && (expectation.trustAnchor || expectation.publicKey || expectation.verifier)) {
    return deny(APPROVAL_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR, [
      'TRUST_ANCHOR_IN_EXPECTATION_FORBIDDEN',
    ]);
  }
  if (expectation?.mode != null && expectation.mode !== CP1_MODE.TEST_ONLY) {
    return deny(APPROVAL_DECISIONS.DENY_RUNTIME_MODE, [`FORBIDDEN_MODE:${expectation.mode}`]);
  }

  // Reject DLP cross-slice token shapes by domain/kind markers.
  if (typeof token === 'string'
    && (token.includes('TECP_WORKER_CAPABILITY_V1')
      || token.includes('DLP011')
      || token.includes('DLP012')
      || token.includes('GATE_SLICE'))) {
    return deny(APPROVAL_DECISIONS.DENY_CROSS_SLICE_DLP_REUSE, ['DLP_TOKEN_SHAPE']);
  }
  if (isPlainObject(token)
    && (token.kind === 'DLP011_OWNER_INSTRUCTION'
      || token.sliceId?.includes?.('DLP-011')
      || token.sliceId?.includes?.('DLP-012')
      || token.tokenType === 'TECP_WORKER_CAPABILITY_V1')) {
    return deny(APPROVAL_DECISIONS.DENY_CROSS_SLICE_DLP_REUSE, ['DLP_ARTIFACT_REUSE']);
  }

  if (!isNonEmptyString(token) || !token.includes('.')) {
    return deny(APPROVAL_DECISIONS.DENY_MALFORMED, ['TOKEN_FORMAT']);
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return deny(APPROVAL_DECISIONS.DENY_MALFORMED, ['TOKEN_PARTS']);
  }
  const [payloadB64, sigB64] = parts;
  const payloadBuf = b64urlDecode(payloadB64);
  const sigBuf = b64urlDecode(sigB64);
  if (!payloadBuf || !sigBuf) {
    return deny(APPROVAL_DECISIONS.DENY_MALFORMED, ['B64URL_DECODE']);
  }
  const payloadText = payloadBuf.toString('utf8');
  const parsed = parseJsonObjectRejectDuplicates(payloadText);
  if (!parsed.ok) {
    if (String(parsed.reason).startsWith('DUPLICATE_KEY')) {
      return deny(APPROVAL_DECISIONS.DENY_DUPLICATE_FIELDS, [parsed.reason]);
    }
    return deny(APPROVAL_DECISIONS.DENY_MALFORMED, [parsed.reason]);
  }
  const claims = parsed.value;
  let canonical;
  try {
    canonical = canonicalJson(claims);
  } catch (err) {
    return deny(APPROVAL_DECISIONS.DENY_NONCANONICAL, [String(err.message || err)]);
  }
  if (canonical !== payloadText) {
    return deny(APPROVAL_DECISIONS.DENY_NONCANONICAL, ['PAYLOAD_NOT_CANONICAL']);
  }

  const shapeErr = validateClaims(claims);
  if (shapeErr) {
    if (shapeErr === 'UNSUPPORTED_ALGORITHM') {
      return deny(APPROVAL_DECISIONS.DENY_UNSUPPORTED_ALGORITHM, [shapeErr]);
    }
    if (shapeErr === 'WRONG_REPOSITORY') {
      return deny(APPROVAL_DECISIONS.DENY_WRONG_REPOSITORY, [shapeErr]);
    }
    if (shapeErr === 'WRONG_SHA') {
      return deny(APPROVAL_DECISIONS.DENY_WRONG_SHA, [shapeErr]);
    }
    if (shapeErr === 'WRONG_SLICE') {
      return deny(APPROVAL_DECISIONS.DENY_WRONG_SLICE, [shapeErr]);
    }
    if (shapeErr === 'WRONG_CHECKPOINT') {
      return deny(APPROVAL_DECISIONS.DENY_WRONG_CHECKPOINT, [shapeErr]);
    }
    if (shapeErr === 'WRONG_OPERATION' || shapeErr === 'DENY_SCOPE_EXPANSION'
      || shapeErr === 'DENY_PATH_TRAVERSAL' || shapeErr === 'DENY_WILDCARD_SCOPE'
      || shapeErr === 'DENY_WRONG_RESOURCE') {
      return deny(
        shapeErr.startsWith('DENY_') ? shapeErr : APPROVAL_DECISIONS.DENY_WRONG_OPERATION,
        [shapeErr],
      );
    }
    if (shapeErr === 'EXCESSIVE_TTL') {
      return deny(APPROVAL_DECISIONS.DENY_EXCESSIVE_TTL, [shapeErr]);
    }
    return deny(APPROVAL_DECISIONS.DENY_MALFORMED, [shapeErr]);
  }

  const { keyRegistry, clock, revocationRegistry } = deps;
  if (keyRegistry == null || typeof keyRegistry.get !== 'function') {
    return deny(APPROVAL_DECISIONS.DENY_MISSING_KEY_REGISTRY, ['KEY_REGISTRY_REQUIRED']);
  }
  if (clock == null || typeof clock.nowMs !== 'function') {
    return deny(APPROVAL_DECISIONS.DENY_MISSING_CLOCK, ['CLOCK_REQUIRED']);
  }
  if (revocationRegistry == null || typeof revocationRegistry.isRevoked !== 'function') {
    return deny(APPROVAL_DECISIONS.DENY_MISSING_REVOCATION, ['REVOCATION_REQUIRED']);
  }

  const keyEntry = keyRegistry.get(claims.kid);
  if (!keyEntry || keyEntry.enabled !== true) {
    return deny(APPROVAL_DECISIONS.DENY_UNKNOWN_KID, ['UNKNOWN_OR_DISABLED_KID']);
  }
  if (keyEntry.alg !== CP1_ALG) {
    return deny(APPROVAL_DECISIONS.DENY_UNSUPPORTED_ALGORITHM, ['KEY_ALG_MISMATCH']);
  }

  let sigOk = false;
  try {
    sigOk = verify(null, Buffer.from(canonical, 'utf8'), keyEntry.publicKey, sigBuf);
  } catch {
    return deny(APPROVAL_DECISIONS.DENY_INVALID_SIGNATURE, ['VERIFY_THREW']);
  }
  if (!sigOk) {
    return deny(APPROVAL_DECISIONS.DENY_INVALID_SIGNATURE, ['SIGNATURE_MISMATCH']);
  }

  let nowMs;
  try {
    nowMs = clock.nowMs();
  } catch {
    return deny(APPROVAL_DECISIONS.DENY_MISSING_CLOCK, ['CLOCK_THREW']);
  }
  if (!isSafeInteger(nowMs)) {
    return deny(APPROVAL_DECISIONS.DENY_MISSING_CLOCK, ['CLOCK_INVALID']);
  }
  if (nowMs < claims.nbf) {
    return deny(APPROVAL_DECISIONS.DENY_NBF_VIOLATION, ['NBF']);
  }
  if (nowMs >= claims.exp) {
    return deny(APPROVAL_DECISIONS.DENY_EXPIRED, ['EXPIRED']);
  }

  let revoked;
  try {
    revoked = revocationRegistry.isRevoked(claims.jti);
  } catch (err) {
    return deny(APPROVAL_DECISIONS.DENY_MISSING_REVOCATION, [
      err?.code || 'REVOCATION_UNAVAILABLE',
    ]);
  }
  if (revoked === true) {
    return deny(APPROVAL_DECISIONS.DENY_REVOKED, ['REVOKED_JTI']);
  }

  // Expectation bindings
  if (expectation.repositoryId != null && expectation.repositoryId !== claims.repositoryId) {
    return deny(APPROVAL_DECISIONS.DENY_WRONG_REPOSITORY, ['EXPECTATION_REPOSITORY']);
  }
  if (expectation.baselineSha != null && expectation.baselineSha !== claims.baselineSha) {
    return deny(APPROVAL_DECISIONS.DENY_WRONG_SHA, ['EXPECTATION_SHA']);
  }
  if (expectation.actorId != null && expectation.actorId !== claims.actorId) {
    return deny(APPROVAL_DECISIONS.DENY_WRONG_ACTOR, ['EXPECTATION_ACTOR']);
  }
  if (expectation.taskId != null && expectation.taskId !== claims.taskId) {
    return deny(APPROVAL_DECISIONS.DENY_WRONG_TASK, ['EXPECTATION_TASK']);
  }
  if (expectation.operationClass != null
    && expectation.operationClass !== claims.operationClass) {
    return deny(APPROVAL_DECISIONS.DENY_WRONG_OPERATION, ['EXPECTATION_OPERATION']);
  }
  if (Array.isArray(expectation.authorizedFileScope)) {
    const a = [...claims.authorizedFileScope].sort().join('\0');
    const b = [...expectation.authorizedFileScope].sort().join('\0');
    if (a !== b) {
      return deny(APPROVAL_DECISIONS.DENY_SCOPE_EXPANSION, ['EXPECTATION_SCOPE_MISMATCH']);
    }
  }

  const artifact = Object.freeze({
    kind: claims.kind,
    jti: claims.jti,
    actorId: claims.actorId,
    taskId: claims.taskId,
    repositoryId: claims.repositoryId,
    baselineSha: claims.baselineSha,
    sliceId: claims.sliceId,
    checkpoint: claims.checkpoint,
    operationClass: claims.operationClass,
    authorizedFileScope: Object.freeze([...claims.authorizedFileScope]),
    nbf: claims.nbf,
    exp: claims.exp,
    purpose: claims.purpose,
    classification: 'OFFLINE_TEST_ONLY_OWNER_APPROVAL / NOT_EXECUTION_AUTHORITY',
  });
  brandedApprovalArtifact.add(artifact);

  return Object.freeze({
    ok: true,
    allowed: true,
    decision: APPROVAL_DECISIONS.ALLOW,
    reasons: Object.freeze(['OWNER_APPROVAL_VERIFIED_TEST_ONLY']),
    artifact,
    claims: Object.freeze({
      ...claims,
      authorizedFileScope: Object.freeze([...claims.authorizedFileScope]),
    }),
  });
}

/** Convenience: issue via privileged issuer only. */
export function issueOwnerApprovalArtifactForTests(issuer, input) {
  if (!isPrivilegedTestOnlyOwnerApprovalIssuer(issuer)) {
    return deny(APPROVAL_DECISIONS.DENY_MISSING_VERIFIER, ['PRIVILEGED_ISSUER_REQUIRED']);
  }
  return issuer.issue(input);
}
