/**
 * TECP-OPS-PILOT-001 CP1 — offline TEST_ONLY capability issue/verify with replay registry.
 * Positive results are OFFLINE_TEST_ONLY_CAPABILITY / NOT_EXECUTION_AUTHORITY.
 */

import {
  createPrivateKey,
  generateKeyPairSync,
  sign,
  verify,
  randomBytes,
} from 'node:crypto';

import {
  CP1_ALG,
  CP1_MAX_TTL_MS,
  CP1_MODE,
  CP1_OPERATION_CLASS,
  CP1_PURPOSE,
  CP1_REPOSITORY_ID,
  b64urlDecode,
  b64urlEncode,
  canonicalJson,
  parseJsonObjectRejectDuplicates,
  validateExactCp1Scope,
} from './config.js';
import {
  IDENTITY_DECISIONS,
  TRUST_LEVELS,
  isBrandedVerifiedOperationalPrincipal,
  recheckBrandedPrincipalValidity,
} from './operationalWorkerIdentity.js';
import {
  isBrandedOwnerApprovalArtifact,
  verifyOwnerApprovalArtifact,
} from './ownerApprovalArtifact.js';

export const CAPABILITY_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MALFORMED: 'DENY_MALFORMED',
  DENY_DUPLICATE_FIELDS: 'DENY_DUPLICATE_FIELDS',
  DENY_INVALID_SIGNATURE: 'DENY_INVALID_SIGNATURE',
  DENY_UNKNOWN_KID: 'DENY_UNKNOWN_KID',
  DENY_UNSUPPORTED_ALGORITHM: 'DENY_UNSUPPORTED_ALGORITHM',
  DENY_WRONG_REPOSITORY: 'DENY_WRONG_REPOSITORY',
  DENY_WRONG_SHA: 'DENY_WRONG_SHA',
  DENY_WRONG_WORKER: 'DENY_WRONG_WORKER',
  DENY_WRONG_TASK: 'DENY_WRONG_TASK',
  DENY_WRONG_OPERATION: 'DENY_WRONG_OPERATION',
  DENY_WRONG_RESOURCE: 'DENY_WRONG_RESOURCE',
  DENY_SCOPE_EXPANSION: 'DENY_SCOPE_EXPANSION',
  DENY_EXPIRED: 'DENY_EXPIRED',
  DENY_NBF_VIOLATION: 'DENY_NBF_VIOLATION',
  DENY_REVOKED: 'DENY_REVOKED',
  DENY_REPLAY: 'DENY_REPLAY',
  DENY_DUPLICATE_JTI: 'DENY_DUPLICATE_JTI',
  DENY_MISSING_OWNER_APPROVAL: 'DENY_MISSING_OWNER_APPROVAL',
  DENY_INVALID_OWNER_APPROVAL: 'DENY_INVALID_OWNER_APPROVAL',
  DENY_MISSING_IDENTITY: 'DENY_MISSING_IDENTITY',
  DENY_UNBRANDED_IDENTITY: 'DENY_UNBRANDED_IDENTITY',
  DENY_MISSING_VERIFIER: 'DENY_MISSING_VERIFIER',
  DENY_MISSING_CLOCK: 'DENY_MISSING_CLOCK',
  DENY_MISSING_REVOCATION: 'DENY_MISSING_REVOCATION',
  DENY_MISSING_REPLAY_REGISTRY: 'DENY_MISSING_REPLAY_REGISTRY',
  DENY_MISSING_KEY_REGISTRY: 'DENY_MISSING_KEY_REGISTRY',
  DENY_WORKER_SUPPLIED_TRUST_ANCHOR: 'DENY_WORKER_SUPPLIED_TRUST_ANCHOR',
  DENY_CROSS_SLICE_DLP_REUSE: 'DENY_CROSS_SLICE_DLP_REUSE',
  DENY_COPIED_OBJECT_AUTHORITY: 'DENY_COPIED_OBJECT_AUTHORITY',
  DENY_RULE02_YES_INSUFFICIENT: 'DENY_RULE02_YES_INSUFFICIENT',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
  DENY_RUNTIME_MODE: 'DENY_RUNTIME_MODE',
  DENY_NONCANONICAL: 'DENY_NONCANONICAL',
  DENY_MCP_OR_DB_OR_WORKER_PERMISSION: 'DENY_MCP_OR_DB_OR_WORKER_PERMISSION',
  DENY_EXCESSIVE_TTL: 'DENY_EXCESSIVE_TTL',
  DENY_AMBIGUOUS_CONSUME: 'DENY_AMBIGUOUS_CONSUME',
});

const CLAIM_KEY_ORDER = Object.freeze([
  'action',
  'alg',
  'aud',
  'baselineSha',
  'exp',
  'iss',
  'jti',
  'kid',
  'nbf',
  'operationClass',
  'ownerApprovalJti',
  'purpose',
  'repositoryId',
  'resourcePaths',
  'sub',
  'taskId',
  'tokenType',
]);

const privilegedCapabilityIssuerLatch = new WeakSet();

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
    classification: null,
  });
}

export function createInMemoryReplayRegistry() {
  const issued = new Set();
  const presented = new Set();
  let available = true;
  let forceAmbiguous = false;
  function ensureAvailable() {
    if (!available) {
      const err = new Error('REPLAY_REGISTRY_UNAVAILABLE');
      err.code = 'REPLAY_REGISTRY_UNAVAILABLE';
      throw err;
    }
  }
  return Object.freeze({
    has(jti) {
      ensureAvailable();
      return issued.has(jti) || presented.has(jti);
    },
    /** Reserve a fresh jti at issue time. Duplicate jti → false. */
    reserveJti(jti) {
      if (forceAmbiguous) {
        const err = new Error('AMBIGUOUS_CONSUME');
        err.code = 'AMBIGUOUS_CONSUME';
        throw err;
      }
      ensureAvailable();
      if (!isNonEmptyString(jti)) {
        const err = new Error('INVALID_JTI');
        err.code = 'INVALID_JTI';
        throw err;
      }
      if (issued.has(jti)) return false;
      issued.add(jti);
      return true;
    },
    /** Alias used by older call sites. */
    consume(jti) {
      return this.reserveJti(jti);
    },
    hasPresented(jti) {
      ensureAvailable();
      return presented.has(jti);
    },
    markPresented(jti) {
      if (forceAmbiguous) {
        const err = new Error('AMBIGUOUS_CONSUME');
        err.code = 'AMBIGUOUS_CONSUME';
        throw err;
      }
      ensureAvailable();
      if (!isNonEmptyString(jti)) {
        const err = new Error('INVALID_JTI');
        err.code = 'INVALID_JTI';
        throw err;
      }
      if (presented.has(jti)) return false;
      presented.add(jti);
      return true;
    },
    markConsumed(jti) {
      presented.add(jti);
      issued.add(jti);
    },
    setAvailable(flag) {
      available = flag === true;
    },
    setForceAmbiguous(flag) {
      forceAmbiguous = flag === true;
    },
    volatility: 'PROCESS_LOCAL_NOT_DURABLE',
  });
}

export function generateEphemeralCapabilityIssuerKeyPairForTests() {
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
  if (claims.tokenType !== 'TECP_OPS_CAPABILITY_V1') return 'INVALID_TOKEN_TYPE';
  if (claims.alg !== CP1_ALG) return 'UNSUPPORTED_ALGORITHM';
  if (!isNonEmptyString(claims.iss)) return 'INVALID_ISS';
  if (!isNonEmptyString(claims.kid)) return 'INVALID_KID';
  if (!isNonEmptyString(claims.aud)) return 'INVALID_AUD';
  if (!isNonEmptyString(claims.sub)) return 'INVALID_SUB';
  if (claims.repositoryId !== CP1_REPOSITORY_ID) return 'WRONG_REPOSITORY';
  if (!isNonEmptyString(claims.baselineSha) || !/^[0-9a-f]{40}$/i.test(claims.baselineSha)) {
    return 'WRONG_SHA';
  }
  if (!isNonEmptyString(claims.taskId)) return 'INVALID_TASK';
  if (claims.operationClass !== CP1_OPERATION_CLASS.CP1_OFFLINE_SECURITY_CONTRACT) {
    return 'WRONG_OPERATION';
  }
  if (!isNonEmptyString(claims.action)) return 'INVALID_ACTION';
  if (!isNonEmptyString(claims.ownerApprovalJti)) return 'MISSING_OWNER_APPROVAL_JTI';
  if (!isNonEmptyString(claims.jti)) return 'INVALID_JTI';
  if (!isSafeInteger(claims.nbf) || claims.nbf < 0) return 'INVALID_NBF';
  if (!isSafeInteger(claims.exp) || claims.exp <= claims.nbf) return 'INVALID_EXP';
  if (claims.exp - claims.nbf > CP1_MAX_TTL_MS) return 'EXCESSIVE_TTL';
  if (claims.purpose !== CP1_PURPOSE) return 'INVALID_PURPOSE';
  const scope = validateExactCp1Scope(claims.resourcePaths);
  if (!scope.ok) return scope.decision;
  return null;
}

function mapPrincipalValidityDeny(code) {
  if (code === IDENTITY_DECISIONS.DENY_EXPIRED) {
    return deny(CAPABILITY_DECISIONS.DENY_EXPIRED, ['PRINCIPAL_EXPIRED']);
  }
  if (code === IDENTITY_DECISIONS.DENY_NBF_VIOLATION) {
    return deny(CAPABILITY_DECISIONS.DENY_NBF_VIOLATION, ['PRINCIPAL_NBF']);
  }
  if (code === IDENTITY_DECISIONS.DENY_MISSING_CLOCK) {
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_CLOCK, ['PRINCIPAL_CLOCK']);
  }
  if (code === IDENTITY_DECISIONS.DENY_FORGED_IDENTITY) {
    return deny(CAPABILITY_DECISIONS.DENY_UNBRANDED_IDENTITY, ['PRINCIPAL_NOT_BRANDED']);
  }
  return deny(CAPABILITY_DECISIONS.DENY_MALFORMED, [code || 'PRINCIPAL_INVALID']);
}

function interpretRevocationResult(revoked) {
  if (revoked === false) return { ok: true };
  if (revoked === true) {
    return { ok: false, decision: CAPABILITY_DECISIONS.DENY_REVOKED, reasons: ['REVOKED_JTI'] };
  }
  const kind = revoked === null
    ? 'NULL'
    : (revoked != null && typeof revoked.then === 'function' ? 'PROMISE' : typeof revoked);
  return {
    ok: false,
    decision: CAPABILITY_DECISIONS.DENY_MISSING_REVOCATION,
    reasons: ['REVOCATION_RESULT_NOT_EXPLICIT_FALSE', kind],
  };
}

function interpretPresentationResult(firstPresentation) {
  if (firstPresentation === true) return { ok: true };
  if (firstPresentation === false) {
    return {
      ok: false,
      decision: CAPABILITY_DECISIONS.DENY_REPLAY,
      reasons: ['PRESENTATION_REPLAY'],
    };
  }
  const kind = firstPresentation === null
    ? 'NULL'
    : (firstPresentation != null && typeof firstPresentation.then === 'function'
      ? 'PROMISE'
      : typeof firstPresentation);
  return {
    ok: false,
    decision: CAPABILITY_DECISIONS.DENY_AMBIGUOUS_CONSUME,
    reasons: ['PRESENTATION_RESULT_NOT_EXPLICIT_TRUE', kind],
  };
}

export function createTestOnlyCapabilityIssuer(options = {}) {
  if (!isPlainObject(options)) throw new TypeError('ISSUER_OPTIONS_REQUIRED');
  const {
    kid, iss, aud, privateKeyPem, keyRegistry, replayRegistry, clock,
  } = options;
  if (!isNonEmptyString(kid) || !isNonEmptyString(iss) || !isNonEmptyString(aud)) {
    throw new TypeError('KID_ISS_AUD_REQUIRED');
  }
  if (!isNonEmptyString(privateKeyPem)) throw new TypeError('PRIVATE_KEY_REQUIRED');
  if (keyRegistry == null || typeof keyRegistry.get !== 'function') {
    throw new TypeError('KEY_REGISTRY_REQUIRED');
  }
  if (replayRegistry == null || typeof replayRegistry.reserveJti !== 'function') {
    throw new TypeError('REPLAY_REGISTRY_REQUIRED');
  }
  if (clock == null || typeof clock.nowMs !== 'function') {
    throw new TypeError('CLOCK_REQUIRED');
  }
  const privateKey = createPrivateKey(privateKeyPem);
  const issuer = Object.freeze({
    kind: 'TEST_ONLY_CAPABILITY_ISSUER',
    kid,
    iss,
    aud,
    issue({
      principal,
      approvalArtifact,
      action,
      resourcePaths,
      nbf,
      exp,
      jti,
      taskId: taskIdInput,
    }) {
      if (!isBrandedVerifiedOperationalPrincipal(principal)) {
        return deny(CAPABILITY_DECISIONS.DENY_UNBRANDED_IDENTITY, ['PRINCIPAL_NOT_BRANDED']);
      }
      if (principal.trustLevel !== TRUST_LEVELS.TEST_ATTESTED) {
        return deny(CAPABILITY_DECISIONS.DENY_UNBRANDED_IDENTITY, ['TRUST_LEVEL']);
      }
      const freshness = recheckBrandedPrincipalValidity(principal, clock);
      if (freshness != null) {
        return mapPrincipalValidityDeny(freshness);
      }
      if (!isBrandedOwnerApprovalArtifact(approvalArtifact)) {
        return deny(CAPABILITY_DECISIONS.DENY_MISSING_OWNER_APPROVAL, [
          'APPROVAL_NOT_BRANDED',
        ]);
      }
      if (approvalArtifact.actorId !== principal.principalId) {
        return deny(CAPABILITY_DECISIONS.DENY_WRONG_WORKER, ['APPROVAL_ACTOR_MISMATCH']);
      }
      const taskId = taskIdInput || approvalArtifact.taskId;
      if (!isNonEmptyString(taskId) || approvalArtifact.taskId !== taskId) {
        return deny(CAPABILITY_DECISIONS.DENY_WRONG_TASK, ['APPROVAL_TASK_MISMATCH']);
      }
      // Task-scoped identity: principal.taskId must exactly match approval/capability task.
      if (!isNonEmptyString(principal.taskId) || principal.taskId !== taskId) {
        return deny(CAPABILITY_DECISIONS.DENY_WRONG_TASK, ['PRINCIPAL_TASK_MISMATCH']);
      }
      if (approvalArtifact.repositoryId !== principal.repositoryId
        || approvalArtifact.baselineSha !== principal.baselineSha) {
        return deny(CAPABILITY_DECISIONS.DENY_WRONG_SHA, ['APPROVAL_BINDING_MISMATCH']);
      }
      const scope = validateExactCp1Scope(resourcePaths);
      if (!scope.ok) {
        return deny(
          scope.decision.startsWith('DENY_') ? scope.decision : CAPABILITY_DECISIONS.DENY_SCOPE_EXPANSION,
          scope.reasons,
        );
      }
      const allowed = new Set(approvalArtifact.authorizedFileScope);
      for (const p of resourcePaths) {
        if (!allowed.has(p)) {
          return deny(CAPABILITY_DECISIONS.DENY_SCOPE_EXPANSION, [`NOT_IN_APPROVAL_SCOPE:${p}`]);
        }
      }
      const claims = {
        action,
        alg: CP1_ALG,
        aud,
        baselineSha: principal.baselineSha,
        exp,
        iss,
        jti: jti || b64urlEncode(randomBytes(16)),
        kid,
        nbf,
        operationClass: CP1_OPERATION_CLASS.CP1_OFFLINE_SECURITY_CONTRACT,
        ownerApprovalJti: approvalArtifact.jti,
        purpose: CP1_PURPOSE,
        repositoryId: CP1_REPOSITORY_ID,
        resourcePaths: [...resourcePaths],
        sub: principal.principalId,
        taskId,
        tokenType: 'TECP_OPS_CAPABILITY_V1',
      };
      const err = validateClaims(claims);
      if (err) {
        return deny(CAPABILITY_DECISIONS.DENY_MALFORMED, [err]);
      }
      let reserved;
      try {
        reserved = replayRegistry.reserveJti(claims.jti);
      } catch (e) {
        if (e?.code === 'AMBIGUOUS_CONSUME') {
          return deny(CAPABILITY_DECISIONS.DENY_AMBIGUOUS_CONSUME, ['ISSUE_RESERVE_AMBIGUOUS']);
        }
        return deny(CAPABILITY_DECISIONS.DENY_MISSING_REPLAY_REGISTRY, [
          e?.code || 'REPLAY_UNAVAILABLE',
        ]);
      }
      if (reserved !== true) {
        if (reserved === false) {
          return deny(CAPABILITY_DECISIONS.DENY_DUPLICATE_JTI, ['JTI_ALREADY_USED']);
        }
        return deny(CAPABILITY_DECISIONS.DENY_AMBIGUOUS_CONSUME, [
          'ISSUE_RESERVE_RESULT_NOT_EXPLICIT_TRUE',
        ]);
      }
      const payload = canonicalJson(claims);
      const signature = b64urlEncode(sign(null, Buffer.from(payload, 'utf8'), privateKey));
      const token = `${b64urlEncode(Buffer.from(payload, 'utf8'))}.${signature}`;
      return Object.freeze({
        ok: true,
        allowed: true,
        decision: CAPABILITY_DECISIONS.ALLOW,
        reasons: Object.freeze(['TEST_ONLY_CAPABILITY_ISSUED']),
        token,
        claims: Object.freeze({
          ...claims,
          resourcePaths: Object.freeze([...claims.resourcePaths]),
        }),
        classification: 'OFFLINE_TEST_ONLY_CAPABILITY / NOT_EXECUTION_AUTHORITY',
      });
    },
  });
  privilegedCapabilityIssuerLatch.add(issuer);
  return issuer;
}

export function isPrivilegedTestOnlyCapabilityIssuer(issuer) {
  return issuer !== null
    && typeof issuer === 'object'
    && privilegedCapabilityIssuerLatch.has(issuer);
}

export function issueCapabilityForTests(issuer, input) {
  if (!isPrivilegedTestOnlyCapabilityIssuer(issuer)) {
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_VERIFIER, ['PRIVILEGED_ISSUER_REQUIRED']);
  }
  return issuer.issue(input);
}

/**
 * Verify + optionally consume a capability. Requires identity + Owner approval chain.
 */
export function verifyCapability(tokenOrRequest, expectation = {}, deps = {}) {
  // Boolean / unsigned / Rule02 YES are never sufficient.
  if (tokenOrRequest === true || tokenOrRequest === 'YES'
    || tokenOrRequest === 'ALLOW'
    || (isPlainObject(tokenOrRequest) && tokenOrRequest.rule02Yes === true)
    || (isPlainObject(tokenOrRequest) && tokenOrRequest.validatorAllow === true)) {
    return deny(CAPABILITY_DECISIONS.DENY_RULE02_YES_INSUFFICIENT, [
      'RULE02_OR_BOOLEAN_NOT_AUTHORITY',
    ]);
  }

  if (tokenOrRequest == null) {
    return deny(CAPABILITY_DECISIONS.DENY_DEFAULT_FAIL_CLOSED, ['REQUEST_REQUIRED']);
  }

  let token = tokenOrRequest;
  let requestMeta = {};
  if (isPlainObject(tokenOrRequest) && tokenOrRequest.token != null) {
    token = tokenOrRequest.token;
    requestMeta = tokenOrRequest;
  }

  if (isPlainObject(requestMeta)
    && (requestMeta.trustAnchor || requestMeta.publicKey || requestMeta.verifier)) {
    return deny(CAPABILITY_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR, [
      'CALLER_TRUST_ANCHOR_FORBIDDEN',
    ]);
  }
  if (requestMeta.mode != null && requestMeta.mode !== CP1_MODE.TEST_ONLY) {
    return deny(CAPABILITY_DECISIONS.DENY_RUNTIME_MODE, [`FORBIDDEN_MODE:${requestMeta.mode}`]);
  }
  if (requestMeta.requestMcpPermission === true
    || requestMeta.requestDatabasePermission === true
    || requestMeta.requestRealWorkerPermission === true
    || requestMeta.launchWorker === true) {
    return deny(CAPABILITY_DECISIONS.DENY_MCP_OR_DB_OR_WORKER_PERMISSION, [
      'OPERATIONAL_PERMISSION_FORBIDDEN_IN_CP1',
    ]);
  }

  // Copied in-process "authority" objects without brand are rejected.
  if (isPlainObject(token) && token.classification && !token.includes?.('.')) {
    return deny(CAPABILITY_DECISIONS.DENY_COPIED_OBJECT_AUTHORITY, ['OBJECT_NOT_TOKEN']);
  }

  if (typeof token === 'string'
    && (token.includes('TECP_WORKER_CAPABILITY_V1')
      || token.includes('DLP011')
      || token.includes('DLP012'))) {
    // Might still be our token if coincidental; check after parse. Pre-filter DLP-shaped prefixes.
  }

  if (!isNonEmptyString(token) || !token.includes('.')) {
    return deny(CAPABILITY_DECISIONS.DENY_MALFORMED, ['TOKEN_FORMAT']);
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return deny(CAPABILITY_DECISIONS.DENY_MALFORMED, ['TOKEN_PARTS']);
  }
  const payloadBuf = b64urlDecode(parts[0]);
  const sigBuf = b64urlDecode(parts[1]);
  if (!payloadBuf || !sigBuf) {
    return deny(CAPABILITY_DECISIONS.DENY_MALFORMED, ['B64URL_DECODE']);
  }
  const payloadText = payloadBuf.toString('utf8');
  const parsed = parseJsonObjectRejectDuplicates(payloadText);
  if (!parsed.ok) {
    if (String(parsed.reason).startsWith('DUPLICATE_KEY')) {
      return deny(CAPABILITY_DECISIONS.DENY_DUPLICATE_FIELDS, [parsed.reason]);
    }
    return deny(CAPABILITY_DECISIONS.DENY_MALFORMED, [parsed.reason]);
  }
  const claims = parsed.value;

  if (claims.tokenType === 'TECP_WORKER_CAPABILITY_V1'
    || claims.domain === 'DLP'
    || (typeof claims.sliceId === 'string'
      && (claims.sliceId.includes('DLP-011') || claims.sliceId.includes('DLP-012')))) {
    return deny(CAPABILITY_DECISIONS.DENY_CROSS_SLICE_DLP_REUSE, ['DLP_CAPABILITY_REUSE']);
  }

  let canonical;
  try {
    canonical = canonicalJson(claims);
  } catch (err) {
    return deny(CAPABILITY_DECISIONS.DENY_NONCANONICAL, [String(err.message || err)]);
  }
  if (canonical !== payloadText) {
    return deny(CAPABILITY_DECISIONS.DENY_NONCANONICAL, ['PAYLOAD_NOT_CANONICAL']);
  }

  const shapeErr = validateClaims(claims);
  if (shapeErr) {
    if (shapeErr === 'UNSUPPORTED_ALGORITHM') {
      return deny(CAPABILITY_DECISIONS.DENY_UNSUPPORTED_ALGORITHM, [shapeErr]);
    }
    if (shapeErr === 'WRONG_REPOSITORY') {
      return deny(CAPABILITY_DECISIONS.DENY_WRONG_REPOSITORY, [shapeErr]);
    }
    if (shapeErr === 'WRONG_SHA') {
      return deny(CAPABILITY_DECISIONS.DENY_WRONG_SHA, [shapeErr]);
    }
    if (shapeErr === 'WRONG_OPERATION') {
      return deny(CAPABILITY_DECISIONS.DENY_WRONG_OPERATION, [shapeErr]);
    }
    if (shapeErr === 'EXCESSIVE_TTL') {
      return deny(CAPABILITY_DECISIONS.DENY_EXCESSIVE_TTL, [shapeErr]);
    }
    if (String(shapeErr).startsWith('DENY_')) {
      return deny(shapeErr, [shapeErr]);
    }
    return deny(CAPABILITY_DECISIONS.DENY_MALFORMED, [shapeErr]);
  }

  const {
    keyRegistry,
    clock,
    revocationRegistry,
    replayRegistry,
    approvalToken,
    approvalDeps,
    principal,
  } = deps;

  if (keyRegistry == null || typeof keyRegistry.get !== 'function') {
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_KEY_REGISTRY, ['KEY_REGISTRY_REQUIRED']);
  }
  if (clock == null || typeof clock.nowMs !== 'function') {
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_CLOCK, ['CLOCK_REQUIRED']);
  }
  if (revocationRegistry == null || typeof revocationRegistry.isRevoked !== 'function') {
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_REVOCATION, ['REVOCATION_REQUIRED']);
  }
  // Single-use verify requires an atomic markPresented contract. has()-only is insufficient.
  if (replayRegistry == null || typeof replayRegistry.markPresented !== 'function') {
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_REPLAY_REGISTRY, [
      'ATOMIC_MARK_PRESENTED_REQUIRED',
    ]);
  }
  if (principal == null) {
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_IDENTITY, ['PRINCIPAL_REQUIRED']);
  }
  if (!isBrandedVerifiedOperationalPrincipal(principal)) {
    return deny(CAPABILITY_DECISIONS.DENY_UNBRANDED_IDENTITY, ['PRINCIPAL_NOT_BRANDED']);
  }
  if (principal.principalId !== claims.sub) {
    return deny(CAPABILITY_DECISIONS.DENY_WRONG_WORKER, ['PRINCIPAL_SUB_MISMATCH']);
  }
  if (principal.repositoryId !== claims.repositoryId || principal.baselineSha !== claims.baselineSha) {
    return deny(CAPABILITY_DECISIONS.DENY_WRONG_SHA, ['PRINCIPAL_BINDING_MISMATCH']);
  }
  if (!isNonEmptyString(principal.taskId) || principal.taskId !== claims.taskId) {
    return deny(CAPABILITY_DECISIONS.DENY_WRONG_TASK, ['PRINCIPAL_TASK_MISMATCH']);
  }
  const principalFreshness = recheckBrandedPrincipalValidity(principal, clock);
  if (principalFreshness != null) {
    return mapPrincipalValidityDeny(principalFreshness);
  }

  if (approvalToken == null) {
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_OWNER_APPROVAL, ['APPROVAL_TOKEN_REQUIRED']);
  }
  const approvalResult = verifyOwnerApprovalArtifact(approvalToken, {
    actorId: claims.sub,
    taskId: claims.taskId,
    repositoryId: claims.repositoryId,
    baselineSha: claims.baselineSha,
    operationClass: claims.operationClass,
  }, approvalDeps || {});
  if (!approvalResult.ok) {
    return deny(CAPABILITY_DECISIONS.DENY_INVALID_OWNER_APPROVAL, [
      approvalResult.decision,
      ...(approvalResult.reasons || []),
    ]);
  }
  if (approvalResult.artifact.jti !== claims.ownerApprovalJti) {
    return deny(CAPABILITY_DECISIONS.DENY_INVALID_OWNER_APPROVAL, ['APPROVAL_JTI_MISMATCH']);
  }
  // Finding D: independently enforce capability resourcePaths ⊆ verified Owner approval scope.
  const verifiedApprovalScope = new Set(approvalResult.artifact.authorizedFileScope);
  for (const path of claims.resourcePaths) {
    if (!verifiedApprovalScope.has(path)) {
      return deny(CAPABILITY_DECISIONS.DENY_SCOPE_EXPANSION, [
        `NOT_IN_VERIFIED_APPROVAL_SCOPE:${path}`,
      ]);
    }
  }

  const keyEntry = keyRegistry.get(claims.kid);
  if (!keyEntry || keyEntry.enabled !== true) {
    return deny(CAPABILITY_DECISIONS.DENY_UNKNOWN_KID, ['UNKNOWN_OR_DISABLED_KID']);
  }
  let sigOk = false;
  try {
    sigOk = verify(null, Buffer.from(canonical, 'utf8'), keyEntry.publicKey, sigBuf);
  } catch {
    return deny(CAPABILITY_DECISIONS.DENY_INVALID_SIGNATURE, ['VERIFY_THREW']);
  }
  if (!sigOk) {
    return deny(CAPABILITY_DECISIONS.DENY_INVALID_SIGNATURE, ['SIGNATURE_MISMATCH']);
  }

  let nowMs;
  try {
    nowMs = clock.nowMs();
  } catch {
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_CLOCK, ['CLOCK_THREW']);
  }
  if (!isSafeInteger(nowMs)) {
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_CLOCK, ['CLOCK_INVALID']);
  }
  if (nowMs < claims.nbf) {
    return deny(CAPABILITY_DECISIONS.DENY_NBF_VIOLATION, ['NBF']);
  }
  if (nowMs >= claims.exp) {
    return deny(CAPABILITY_DECISIONS.DENY_EXPIRED, ['EXPIRED']);
  }

  let revoked;
  try {
    revoked = revocationRegistry.isRevoked(claims.jti);
  } catch (err) {
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_REVOCATION, [
      err?.code || 'REVOCATION_UNAVAILABLE',
    ]);
  }
  const revocationGate = interpretRevocationResult(revoked);
  if (!revocationGate.ok) {
    return deny(revocationGate.decision, revocationGate.reasons);
  }

  // Expectation checks
  if (expectation.taskId != null && expectation.taskId !== claims.taskId) {
    return deny(CAPABILITY_DECISIONS.DENY_WRONG_TASK, ['EXPECTATION_TASK']);
  }
  if (expectation.action != null && expectation.action !== claims.action) {
    return deny(CAPABILITY_DECISIONS.DENY_WRONG_OPERATION, ['EXPECTATION_ACTION']);
  }
  if (expectation.repositoryId != null && expectation.repositoryId !== claims.repositoryId) {
    return deny(CAPABILITY_DECISIONS.DENY_WRONG_REPOSITORY, ['EXPECTATION_REPOSITORY']);
  }
  if (expectation.baselineSha != null && expectation.baselineSha !== claims.baselineSha) {
    return deny(CAPABILITY_DECISIONS.DENY_WRONG_SHA, ['EXPECTATION_SHA']);
  }
  if (Array.isArray(expectation.resourcePaths)) {
    const a = [...claims.resourcePaths].sort().join('\0');
    const b = [...expectation.resourcePaths].sort().join('\0');
    if (a !== b) {
      return deny(CAPABILITY_DECISIONS.DENY_WRONG_RESOURCE, ['EXPECTATION_RESOURCE']);
    }
  }

  // Single-use presentation is mandatory. Optional flags cannot disable it.
  // consumeOnVerify=false is ignored: has()-only registries already rejected above.
  let firstPresentation;
  try {
    firstPresentation = replayRegistry.markPresented(claims.jti);
  } catch (err) {
    if (err?.code === 'AMBIGUOUS_CONSUME') {
      return deny(CAPABILITY_DECISIONS.DENY_AMBIGUOUS_CONSUME, ['VERIFY_PRESENT_AMBIGUOUS']);
    }
    return deny(CAPABILITY_DECISIONS.DENY_MISSING_REPLAY_REGISTRY, [
      err?.code || 'REPLAY_UNAVAILABLE',
    ]);
  }
  const presentationGate = interpretPresentationResult(firstPresentation);
  if (!presentationGate.ok) {
    return deny(presentationGate.decision, presentationGate.reasons);
  }

  return Object.freeze({
    ok: true,
    allowed: true,
    decision: CAPABILITY_DECISIONS.ALLOW,
    reasons: Object.freeze(['CAPABILITY_VERIFIED_TEST_ONLY']),
    claims: Object.freeze({
      ...claims,
      resourcePaths: Object.freeze([...claims.resourcePaths]),
    }),
    classification: 'OFFLINE_TEST_ONLY_CAPABILITY / NOT_EXECUTION_AUTHORITY',
  });
}

/** Alias — base registry already tracks presentation. */
export function createInMemoryReplayRegistryWithPresentation() {
  return createInMemoryReplayRegistry();
}
