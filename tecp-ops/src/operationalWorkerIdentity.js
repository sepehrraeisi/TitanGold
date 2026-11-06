/**
 * TECP-OPS-PILOT-001 CP1 — test-attested Worker identity verification.
 * NON_OPERATIONAL. Never claims OS_AUTHENTICATED or REAL_WORKER_AUTHENTICATED.
 */

import {
  CP1_MODE,
  CP1_REPOSITORY_ID,
  CP1_PURPOSE,
} from './config.js';

export const ATTESTATION_KINDS = Object.freeze({
  TEST_ONLY: 'TEST_ONLY',
  OS_PRINCIPAL: 'OS_PRINCIPAL', // reserved; rejected
});

export const TRUST_LEVELS = Object.freeze({
  TEST_ATTESTED: 'TEST_ATTESTED',
  OS_AUTHENTICATED: 'OS_AUTHENTICATED', // never produced
});

export const IDENTITY_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MISSING_ATTESTATION: 'DENY_MISSING_ATTESTATION',
  DENY_MALFORMED: 'DENY_MALFORMED',
  DENY_FORGED_IDENTITY: 'DENY_FORGED_IDENTITY',
  DENY_UNKNOWN_WORKER: 'DENY_UNKNOWN_WORKER',
  DENY_WRONG_REPOSITORY: 'DENY_WRONG_REPOSITORY',
  DENY_WRONG_SHA: 'DENY_WRONG_SHA',
  DENY_WRONG_TASK: 'DENY_WRONG_TASK',
  DENY_WRONG_ACTOR: 'DENY_WRONG_ACTOR',
  DENY_EXPIRED: 'DENY_EXPIRED',
  DENY_NBF_VIOLATION: 'DENY_NBF_VIOLATION',
  DENY_MISSING_VERIFIER: 'DENY_MISSING_VERIFIER',
  DENY_MISSING_CLOCK: 'DENY_MISSING_CLOCK',
  DENY_WORKER_SUPPLIED_TRUST_ANCHOR: 'DENY_WORKER_SUPPLIED_TRUST_ANCHOR',
  DENY_UNTRUSTED_KIND: 'DENY_UNTRUSTED_KIND',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
  DENY_RUNTIME_MODE: 'DENY_RUNTIME_MODE',
  DENY_SELF_ASSERTED_PRIVILEGE: 'DENY_SELF_ASSERTED_PRIVILEGE',
});

const verifiedPrincipalBrand = new WeakSet();
const privilegedVerifierLatch = new WeakSet();

const REQUIRED_FIELDS = Object.freeze([
  'attestationKind',
  'principalId',
  'principalGeneration',
  'bootstrapIssuer',
  'repositoryId',
  'baselineSha',
  'attestationId',
  'attestedAt',
  'nbf',
  'exp',
  'evidenceSignature',
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
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    principal: null,
  });
}

function freezeAndBrandPrincipal(principal) {
  const frozen = Object.freeze({
    principalId: principal.principalId,
    trustLevel: TRUST_LEVELS.TEST_ATTESTED,
    attestationKind: ATTESTATION_KINDS.TEST_ONLY,
    bootstrapIssuer: principal.bootstrapIssuer,
    principalGeneration: principal.principalGeneration,
    repositoryId: principal.repositoryId,
    baselineSha: principal.baselineSha,
    taskId: principal.taskId ?? null,
    attestationId: principal.attestationId,
    attestedAt: principal.attestedAt,
    nbf: principal.nbf,
    exp: principal.exp,
    purpose: CP1_PURPOSE,
    osPrincipalAuthenticated: false,
    realWorkerAuthenticated: false,
    classification: 'TEST_ATTESTED / NON_OPERATIONAL',
  });
  verifiedPrincipalBrand.add(frozen);
  return frozen;
}

export function isBrandedVerifiedOperationalPrincipal(principal) {
  return principal !== null
    && typeof principal === 'object'
    && verifiedPrincipalBrand.has(principal);
}

/**
 * Re-validate a previously branded principal against a trusted injected clock.
 * Brand alone is not standing authority after expiry / before nbf.
 * Returns null on success, or an IDENTITY_DECISIONS deny code string.
 */
export function recheckBrandedPrincipalValidity(principal, clock) {
  if (!isBrandedVerifiedOperationalPrincipal(principal)) {
    return IDENTITY_DECISIONS.DENY_FORGED_IDENTITY;
  }
  if (clock == null || typeof clock.nowMs !== 'function') {
    return IDENTITY_DECISIONS.DENY_MISSING_CLOCK;
  }
  let nowMs;
  try {
    nowMs = clock.nowMs();
  } catch {
    return IDENTITY_DECISIONS.DENY_MISSING_CLOCK;
  }
  if (!isSafeInteger(nowMs)) {
    return IDENTITY_DECISIONS.DENY_MISSING_CLOCK;
  }
  if (!isSafeInteger(principal.nbf) || !isSafeInteger(principal.exp)) {
    return IDENTITY_DECISIONS.DENY_MALFORMED;
  }
  if (nowMs < principal.nbf) {
    return IDENTITY_DECISIONS.DENY_NBF_VIOLATION;
  }
  if (nowMs >= principal.exp) {
    return IDENTITY_DECISIONS.DENY_EXPIRED;
  }
  return null;
}

/**
 * Privileged TEST_ONLY harness: create an attestation verifier bound to an allowlist.
 * Caller-supplied trust anchors on verify requests are rejected separately.
 */
export function createTestOnlyAttestationVerifier(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('VERIFIER_OPTIONS_REQUIRED');
  }
  const {
    trustedIssuer,
    knownPrincipalIds,
    repositoryId = CP1_REPOSITORY_ID,
    baselineSha,
    verifyEvidenceSignature,
  } = options;
  if (!isNonEmptyString(trustedIssuer)) throw new TypeError('TRUSTED_ISSUER_REQUIRED');
  if (!Array.isArray(knownPrincipalIds) || knownPrincipalIds.length === 0) {
    throw new TypeError('KNOWN_PRINCIPAL_IDS_REQUIRED');
  }
  if (!isNonEmptyString(baselineSha) || !/^[0-9a-f]{40}$/i.test(baselineSha)) {
    throw new TypeError('BASELINE_SHA_REQUIRED');
  }
  if (typeof verifyEvidenceSignature !== 'function') {
    throw new TypeError('VERIFY_EVIDENCE_SIGNATURE_REQUIRED');
  }
  const known = new Set(knownPrincipalIds);
  const verifier = Object.freeze({
    kind: 'TEST_ONLY_ATTESTATION_VERIFIER',
    trustedIssuer,
    repositoryId,
    baselineSha,
    verifyAttestation(attestation, clockNowMs) {
      if (!isPlainObject(attestation)) {
        return { ok: false, reason: 'MALFORMED_ATTESTATION' };
      }
      if (attestation.attestationKind !== ATTESTATION_KINDS.TEST_ONLY) {
        return { ok: false, reason: 'UNTRUSTED_KIND' };
      }
      if (attestation.bootstrapIssuer !== trustedIssuer) {
        return { ok: false, reason: 'ISSUER_MISMATCH' };
      }
      if (attestation.repositoryId !== repositoryId) {
        return { ok: false, reason: 'WRONG_REPOSITORY' };
      }
      if (attestation.baselineSha !== baselineSha) {
        return { ok: false, reason: 'WRONG_SHA' };
      }
      if (!known.has(attestation.principalId)) {
        return { ok: false, reason: 'UNKNOWN_WORKER' };
      }
      if (!verifyEvidenceSignature(attestation)) {
        return { ok: false, reason: 'FORGED_IDENTITY' };
      }
      if (!isSafeInteger(clockNowMs)) {
        return { ok: false, reason: 'CLOCK_UNAVAILABLE' };
      }
      if (clockNowMs < attestation.nbf) {
        return { ok: false, reason: 'NBF_VIOLATION' };
      }
      if (clockNowMs >= attestation.exp) {
        return { ok: false, reason: 'EXPIRED' };
      }
      return { ok: true };
    },
  });
  privilegedVerifierLatch.add(verifier);
  return verifier;
}

export function isPrivilegedTestOnlyAttestationVerifier(verifier) {
  return verifier !== null
    && typeof verifier === 'object'
    && privilegedVerifierLatch.has(verifier);
}

/**
 * Verify a test-attested operational principal. Fail closed by default.
 */
export function verifyOperationalPrincipal(request, deps = {}) {
  if (request == null || !isPlainObject(request)) {
    return deny(IDENTITY_DECISIONS.DENY_DEFAULT_FAIL_CLOSED, ['REQUEST_REQUIRED']);
  }

  // Reject caller-embedded trust anchors.
  if (
    Object.prototype.hasOwnProperty.call(request, 'trustAnchor')
    || Object.prototype.hasOwnProperty.call(request, 'publicKey')
    || Object.prototype.hasOwnProperty.call(request, 'verifier')
    || Object.prototype.hasOwnProperty.call(request, 'verifyKey')
  ) {
    return deny(IDENTITY_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR, [
      'CALLER_SUPPLIED_TRUST_ANCHOR_FORBIDDEN',
    ]);
  }

  if (request.mode != null && request.mode !== CP1_MODE.TEST_ONLY) {
    return deny(IDENTITY_DECISIONS.DENY_RUNTIME_MODE, [`FORBIDDEN_MODE:${request.mode}`]);
  }

  if (request.selfAssertedPrivilege === true || request.osAuthenticated === true) {
    return deny(IDENTITY_DECISIONS.DENY_SELF_ASSERTED_PRIVILEGE, ['SELF_ASSERTED_PRIVILEGE']);
  }

  const attestation = request.attestation;
  if (attestation == null) {
    return deny(IDENTITY_DECISIONS.DENY_MISSING_ATTESTATION, ['ATTESTATION_REQUIRED']);
  }
  if (!isPlainObject(attestation)) {
    return deny(IDENTITY_DECISIONS.DENY_MALFORMED, ['ATTESTATION_MUST_BE_OBJECT']);
  }

  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(attestation, field)) {
      return deny(IDENTITY_DECISIONS.DENY_MALFORMED, [`MISSING_FIELD:${field}`]);
    }
  }

  if (attestation.attestationKind === ATTESTATION_KINDS.OS_PRINCIPAL) {
    return deny(IDENTITY_DECISIONS.DENY_UNTRUSTED_KIND, ['OS_PRINCIPAL_NOT_AUTHORIZED_IN_CP1']);
  }
  if (attestation.attestationKind !== ATTESTATION_KINDS.TEST_ONLY) {
    return deny(IDENTITY_DECISIONS.DENY_UNTRUSTED_KIND, ['UNTRUSTED_ATTESTATION_KIND']);
  }

  if (!isNonEmptyString(attestation.principalId)) {
    return deny(IDENTITY_DECISIONS.DENY_MALFORMED, ['INVALID_PRINCIPAL_ID']);
  }
  if (!isSafeInteger(attestation.principalGeneration) || attestation.principalGeneration < 0) {
    return deny(IDENTITY_DECISIONS.DENY_MALFORMED, ['INVALID_PRINCIPAL_GENERATION']);
  }
  if (!isNonEmptyString(attestation.bootstrapIssuer)) {
    return deny(IDENTITY_DECISIONS.DENY_MALFORMED, ['INVALID_BOOTSTRAP_ISSUER']);
  }
  if (attestation.repositoryId !== CP1_REPOSITORY_ID) {
    return deny(IDENTITY_DECISIONS.DENY_WRONG_REPOSITORY, ['REPOSITORY_MISMATCH']);
  }
  if (!isNonEmptyString(attestation.baselineSha) || !/^[0-9a-f]{40}$/i.test(attestation.baselineSha)) {
    return deny(IDENTITY_DECISIONS.DENY_WRONG_SHA, ['INVALID_BASELINE_SHA']);
  }
  if (!isNonEmptyString(attestation.attestationId)) {
    return deny(IDENTITY_DECISIONS.DENY_MALFORMED, ['INVALID_ATTESTATION_ID']);
  }
  if (!isSafeInteger(attestation.attestedAt) || attestation.attestedAt < 0) {
    return deny(IDENTITY_DECISIONS.DENY_MALFORMED, ['INVALID_ATTESTED_AT']);
  }
  if (!isSafeInteger(attestation.nbf) || attestation.nbf < 0) {
    return deny(IDENTITY_DECISIONS.DENY_MALFORMED, ['INVALID_NBF']);
  }
  if (!isSafeInteger(attestation.exp) || attestation.exp <= attestation.nbf) {
    return deny(IDENTITY_DECISIONS.DENY_MALFORMED, ['INVALID_EXP']);
  }
  if (!isNonEmptyString(attestation.evidenceSignature)) {
    return deny(IDENTITY_DECISIONS.DENY_MALFORMED, ['INVALID_EVIDENCE_SIGNATURE']);
  }

  // Optional claimed actor/task must match attestation when present.
  if (request.taskId != null) {
    if (!isNonEmptyString(request.taskId) || attestation.taskId !== request.taskId) {
      return deny(IDENTITY_DECISIONS.DENY_WRONG_TASK, ['TASK_MISMATCH']);
    }
  }
  if (request.actorId != null) {
    if (!isNonEmptyString(request.actorId) || request.actorId !== attestation.principalId) {
      return deny(IDENTITY_DECISIONS.DENY_WRONG_ACTOR, ['ACTOR_MISMATCH']);
    }
  }
  if (request.expectedBaselineSha != null
    && request.expectedBaselineSha !== attestation.baselineSha) {
    return deny(IDENTITY_DECISIONS.DENY_WRONG_SHA, ['EXPECTED_SHA_MISMATCH']);
  }
  if (request.expectedRepositoryId != null
    && request.expectedRepositoryId !== attestation.repositoryId) {
    return deny(IDENTITY_DECISIONS.DENY_WRONG_REPOSITORY, ['EXPECTED_REPOSITORY_MISMATCH']);
  }

  const { attestationVerifier, clock } = deps;
  if (attestationVerifier == null || !isPrivilegedTestOnlyAttestationVerifier(attestationVerifier)) {
    return deny(IDENTITY_DECISIONS.DENY_MISSING_VERIFIER, ['PRIVILEGED_VERIFIER_REQUIRED']);
  }
  if (clock == null || typeof clock.nowMs !== 'function') {
    return deny(IDENTITY_DECISIONS.DENY_MISSING_CLOCK, ['CLOCK_REQUIRED']);
  }

  let nowMs;
  try {
    nowMs = clock.nowMs();
  } catch {
    return deny(IDENTITY_DECISIONS.DENY_MISSING_CLOCK, ['CLOCK_THREW']);
  }
  if (!isSafeInteger(nowMs)) {
    return deny(IDENTITY_DECISIONS.DENY_MISSING_CLOCK, ['CLOCK_INVALID']);
  }

  let verified;
  try {
    verified = attestationVerifier.verifyAttestation(attestation, nowMs);
  } catch {
    return deny(IDENTITY_DECISIONS.DENY_FORGED_IDENTITY, ['VERIFIER_THREW']);
  }
  if (!verified || verified.ok !== true) {
    const reason = verified?.reason || 'ATTESTATION_REJECTED';
    if (reason === 'UNKNOWN_WORKER') {
      return deny(IDENTITY_DECISIONS.DENY_UNKNOWN_WORKER, [reason]);
    }
    if (reason === 'FORGED_IDENTITY') {
      return deny(IDENTITY_DECISIONS.DENY_FORGED_IDENTITY, [reason]);
    }
    if (reason === 'WRONG_REPOSITORY') {
      return deny(IDENTITY_DECISIONS.DENY_WRONG_REPOSITORY, [reason]);
    }
    if (reason === 'WRONG_SHA') {
      return deny(IDENTITY_DECISIONS.DENY_WRONG_SHA, [reason]);
    }
    if (reason === 'EXPIRED') {
      return deny(IDENTITY_DECISIONS.DENY_EXPIRED, [reason]);
    }
    if (reason === 'NBF_VIOLATION') {
      return deny(IDENTITY_DECISIONS.DENY_NBF_VIOLATION, [reason]);
    }
    return deny(IDENTITY_DECISIONS.DENY_FORGED_IDENTITY, [reason]);
  }

  if (nowMs < attestation.nbf) {
    return deny(IDENTITY_DECISIONS.DENY_NBF_VIOLATION, ['NBF_RECHECK']);
  }
  if (nowMs >= attestation.exp) {
    return deny(IDENTITY_DECISIONS.DENY_EXPIRED, ['EXP_RECHECK']);
  }

  const principal = freezeAndBrandPrincipal({
    principalId: attestation.principalId,
    bootstrapIssuer: attestation.bootstrapIssuer,
    principalGeneration: attestation.principalGeneration,
    repositoryId: attestation.repositoryId,
    baselineSha: attestation.baselineSha,
    taskId: attestation.taskId ?? null,
    attestationId: attestation.attestationId,
    attestedAt: attestation.attestedAt,
    nbf: attestation.nbf,
    exp: attestation.exp,
  });

  return Object.freeze({
    ok: true,
    allowed: true,
    decision: IDENTITY_DECISIONS.ALLOW,
    reasons: Object.freeze(['TEST_ATTESTED_IDENTITY_VERIFIED']),
    principal,
  });
}
