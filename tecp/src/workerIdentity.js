/**
 * TECP-DLP-005 disposable trusted Worker identity proof (offline).
 *
 * Option D stage-1 bootstrap: verified Worker principals MUST originate from an
 * injected trusted attestation verifier. Caller-supplied actorId / workerId /
 * governanceRevision / PostgreSQL role / txn GUC / unsigned process metadata are
 * NOT identity.
 *
 * NON_OPERATIONAL proof only. Never claims real OS / Cursor / Worker authentication.
 * TEST_ONLY attestation is explicitly marked and must not be treated as OS_AUTHENTICATED.
 */

export const WORKER_IDENTITY_DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY_MISSING_ATTESTATION: 'DENY_MISSING_ATTESTATION',
  DENY_MALFORMED_ATTESTATION: 'DENY_MALFORMED_ATTESTATION',
  DENY_ATTESTATION_REJECTED: 'DENY_ATTESTATION_REJECTED',
  DENY_ATTESTATION_UNAVAILABLE: 'DENY_ATTESTATION_UNAVAILABLE',
  DENY_INCONSISTENT_ATTESTATION: 'DENY_INCONSISTENT_ATTESTATION',
  DENY_UNTRUSTED_ATTESTATION_KIND: 'DENY_UNTRUSTED_ATTESTATION_KIND',
  DENY_MISSING_VERIFIER: 'DENY_MISSING_VERIFIER',
  DENY_CLAIMED_ONLY_PRINCIPAL: 'DENY_CLAIMED_ONLY_PRINCIPAL',
  DENY_UNBRANDED_PRINCIPAL: 'DENY_UNBRANDED_PRINCIPAL',
});

/**
 * Proof-local provenance brand for principals produced ONLY by verifyWorkerPrincipal.
 * Module-private WeakSet: object identity only. Copies, clones, JSON round-trips and
 * caller-forged plain objects are NOT branded. This is NOT cryptographic OS identity.
 */
const verifiedPrincipalBrand = new WeakSet();

export const ATTESTATION_KINDS = Object.freeze({
  TEST_ONLY: 'TEST_ONLY',
  // Reserved for future separately authorized OS binding. Not accepted by this proof.
  OS_PRINCIPAL: 'OS_PRINCIPAL',
});

export const TRUST_LEVELS = Object.freeze({
  TEST_ATTESTED: 'TEST_ATTESTED',
  // Never produced by this disposable proof.
  OS_AUTHENTICATED: 'OS_AUTHENTICATED',
});

const REQUIRED_ATTESTATION_FIELDS = Object.freeze([
  'attestationKind',
  'bootstrapIssuer',
  'principalId',
  'principalGeneration',
  'attestedAt',
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
    principal: null,
  });
}

function freezeAndBrandPrincipal(principal) {
  const frozen = Object.freeze({
    principalId: principal.principalId,
    trustLevel: principal.trustLevel,
    attestationKind: principal.attestationKind,
    bootstrapIssuer: principal.bootstrapIssuer,
    principalGeneration: principal.principalGeneration,
    attestedAt: principal.attestedAt,
    // Explicit non-claim: disposable proof never asserts real OS authentication.
    osPrincipalAuthenticated: false,
    realWorkerAuthenticated: false,
  });
  verifiedPrincipalBrand.add(frozen);
  return frozen;
}

/**
 * Returns true only for the exact object reference branded by verifyWorkerPrincipal.
 * Public property markers alone are never sufficient.
 */
export function isBrandedVerifiedPrincipal(principal) {
  return principal !== null
    && typeof principal === 'object'
    && verifiedPrincipalBrand.has(principal);
}

/**
 * Verify a Worker principal via an injected attestation verifier.
 *
 * @param {object} request
 * @param {{ verifyAttestation: Function }} deps
 * @returns {{allowed: boolean, decision: string, reasons: string[], principal: object|null}}
 */
export function verifyWorkerPrincipal(request, deps) {
  if (!isPlainObject(deps) || typeof deps.verifyAttestation !== 'function') {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_MISSING_VERIFIER, ['ATTESTATION_VERIFIER_REQUIRED']);
  }

  if (!isPlainObject(request)) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_MISSING_ATTESTATION, ['ATTESTATION_REQUEST_REQUIRED']);
  }

  // Reject claimed-only identity shortcuts — these are never sufficient alone.
  if (
    Object.prototype.hasOwnProperty.call(request, 'claimedPrincipalId')
    || Object.prototype.hasOwnProperty.call(request, 'claimedWorkerId')
    || Object.prototype.hasOwnProperty.call(request, 'actorId')
  ) {
    if (!Object.prototype.hasOwnProperty.call(request, 'attestation')) {
      return deny(WORKER_IDENTITY_DECISIONS.DENY_CLAIMED_ONLY_PRINCIPAL, [
        'CALLER_CLAIMED_IDENTITY_INSUFFICIENT',
      ]);
    }
  }

  if (!Object.prototype.hasOwnProperty.call(request, 'attestation') || request.attestation == null) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_MISSING_ATTESTATION, ['ATTESTATION_REQUIRED']);
  }

  const attestation = request.attestation;
  if (!isPlainObject(attestation)) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_MALFORMED_ATTESTATION, ['ATTESTATION_MUST_BE_OBJECT']);
  }

  for (const field of REQUIRED_ATTESTATION_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(attestation, field)) {
      return deny(WORKER_IDENTITY_DECISIONS.DENY_MALFORMED_ATTESTATION, [`MISSING_FIELD:${field}`]);
    }
  }

  if (!isNonEmptyString(attestation.attestationKind)) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_MALFORMED_ATTESTATION, ['INVALID_ATTESTATION_KIND']);
  }
  if (attestation.attestationKind === ATTESTATION_KINDS.OS_PRINCIPAL) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_UNTRUSTED_ATTESTATION_KIND, [
      'OS_PRINCIPAL_NOT_AUTHORIZED_IN_DLP005',
    ]);
  }
  if (attestation.attestationKind !== ATTESTATION_KINDS.TEST_ONLY) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_UNTRUSTED_ATTESTATION_KIND, [
      `UNSUPPORTED_ATTESTATION_KIND:${attestation.attestationKind}`,
    ]);
  }

  if (!isNonEmptyString(attestation.bootstrapIssuer)) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_MALFORMED_ATTESTATION, ['INVALID_BOOTSTRAP_ISSUER']);
  }
  if (!isNonEmptyString(attestation.principalId)) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_MALFORMED_ATTESTATION, ['INVALID_PRINCIPAL_ID']);
  }
  if (!isSafeInteger(attestation.principalGeneration) || attestation.principalGeneration < 0) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_MALFORMED_ATTESTATION, ['INVALID_PRINCIPAL_GENERATION']);
  }
  if (!isSafeInteger(attestation.attestedAt) || attestation.attestedAt < 0) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_MALFORMED_ATTESTATION, ['INVALID_ATTESTED_AT']);
  }

  let verifierResult;
  try {
    verifierResult = deps.verifyAttestation(Object.freeze({
      attestationKind: attestation.attestationKind,
      bootstrapIssuer: attestation.bootstrapIssuer,
      principalId: attestation.principalId,
      principalGeneration: attestation.principalGeneration,
      attestedAt: attestation.attestedAt,
      evidence: attestation.evidence === undefined ? null : attestation.evidence,
    }));
  } catch {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_ATTESTATION_UNAVAILABLE, [
      'ATTESTATION_VERIFIER_THREW',
    ]);
  }

  if (verifierResult === undefined || verifierResult === null) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_ATTESTATION_UNAVAILABLE, [
      'ATTESTATION_VERIFIER_UNAVAILABLE',
    ]);
  }

  if (!isPlainObject(verifierResult)) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_ATTESTATION_UNAVAILABLE, [
      'ATTESTATION_VERIFIER_MALFORMED_RESULT',
    ]);
  }

  if (verifierResult.available === false) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_ATTESTATION_UNAVAILABLE, [
      'ATTESTATION_DEPENDENCY_UNAVAILABLE',
    ]);
  }

  if (verifierResult.accepted !== true) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_ATTESTATION_REJECTED, [
      'ATTESTATION_REJECTED_BY_VERIFIER',
    ]);
  }

  if (!isNonEmptyString(verifierResult.principalId)
    || !isNonEmptyString(verifierResult.bootstrapIssuer)
    || !isSafeInteger(verifierResult.principalGeneration)
    || verifierResult.principalGeneration < 0
    || !isSafeInteger(verifierResult.attestedAt)
    || verifierResult.attestedAt < 0) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_MALFORMED_ATTESTATION, [
      'VERIFIER_RESULT_INCOMPLETE',
    ]);
  }

  if (
    verifierResult.principalId !== attestation.principalId
    || verifierResult.bootstrapIssuer !== attestation.bootstrapIssuer
    || verifierResult.principalGeneration !== attestation.principalGeneration
  ) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_INCONSISTENT_ATTESTATION, [
      'VERIFIER_RESULT_MISMATCH',
    ]);
  }

  // Disposable proof: TEST_ONLY always maps to TEST_ATTESTED. Never OS_AUTHENTICATED.
  if (verifierResult.trustLevel === TRUST_LEVELS.OS_AUTHENTICATED) {
    return deny(WORKER_IDENTITY_DECISIONS.DENY_UNTRUSTED_ATTESTATION_KIND, [
      'OS_AUTHENTICATED_CLAIM_FORBIDDEN_IN_DLP005',
    ]);
  }

  const principal = freezeAndBrandPrincipal({
    principalId: verifierResult.principalId,
    trustLevel: TRUST_LEVELS.TEST_ATTESTED,
    attestationKind: ATTESTATION_KINDS.TEST_ONLY,
    bootstrapIssuer: verifierResult.bootstrapIssuer,
    principalGeneration: verifierResult.principalGeneration,
    attestedAt: verifierResult.attestedAt,
  });

  return Object.freeze({
    allowed: true,
    decision: WORKER_IDENTITY_DECISIONS.ALLOW,
    reasons: Object.freeze(['TEST_ATTESTED_PRINCIPAL_VERIFIED']),
    principal,
  });
}

/**
 * In-memory TEST_ONLY attestation verifier for offline unit proofs.
 * Distinguishes test-attested principals from real OS authentication (never claimed).
 */
export function createTestOnlyAttestationVerifier(options = {}) {
  const accepted = new Map();
  const unavailable = options.unavailable === true;

  function keyOf(attestation) {
    return `${attestation.bootstrapIssuer}\0${attestation.principalId}\0${attestation.principalGeneration}`;
  }

  return Object.freeze({
    kind: ATTESTATION_KINDS.TEST_ONLY,
    registerAccepted(attestation) {
      if (!isPlainObject(attestation)) {
        throw new TypeError('attestation must be object');
      }
      accepted.set(keyOf(attestation), Object.freeze({ ...attestation }));
    },
    verifyAttestation(attestation) {
      if (unavailable) {
        return Object.freeze({ available: false, accepted: false });
      }
      if (!isPlainObject(attestation)) {
        return Object.freeze({ available: true, accepted: false });
      }
      const recorded = accepted.get(keyOf(attestation));
      if (!recorded) {
        return Object.freeze({ available: true, accepted: false });
      }
      return Object.freeze({
        available: true,
        accepted: true,
        principalId: recorded.principalId,
        bootstrapIssuer: recorded.bootstrapIssuer,
        principalGeneration: recorded.principalGeneration,
        attestedAt: recorded.attestedAt,
        trustLevel: TRUST_LEVELS.TEST_ATTESTED,
        attestationKind: ATTESTATION_KINDS.TEST_ONLY,
      });
    },
  });
}
