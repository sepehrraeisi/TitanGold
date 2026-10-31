import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ATTESTATION_KINDS,
  TRUST_LEVELS,
  WORKER_IDENTITY_DECISIONS,
  createTestOnlyAttestationVerifier,
  isBrandedVerifiedPrincipal,
  verifyWorkerPrincipal,
} from '../src/workerIdentity.js';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '../src/workerIdentity.js');

function baseAttestation(overrides = {}) {
  return {
    attestationKind: ATTESTATION_KINDS.TEST_ONLY,
    bootstrapIssuer: 'test-bootstrap-issuer',
    principalId: 'worker-principal-a',
    principalGeneration: 1,
    attestedAt: 1_700_000_000_000,
    evidence: Object.freeze({ nonce: 'test-nonce' }),
    ...overrides,
  };
}

function registeredVerifier(attestation = baseAttestation()) {
  const verifier = createTestOnlyAttestationVerifier();
  verifier.registerAccepted(attestation);
  return verifier;
}

test('valid test-attested Worker principal ALLOW', () => {
  const attestation = baseAttestation();
  const result = verifyWorkerPrincipal(
    { attestation },
    { verifyAttestation: registeredVerifier(attestation).verifyAttestation },
  );
  assert.equal(result.allowed, true);
  assert.equal(result.decision, WORKER_IDENTITY_DECISIONS.ALLOW);
  assert.equal(result.principal.principalId, 'worker-principal-a');
  assert.equal(result.principal.trustLevel, TRUST_LEVELS.TEST_ATTESTED);
  assert.equal(result.principal.attestationKind, ATTESTATION_KINDS.TEST_ONLY);
  assert.equal(result.principal.osPrincipalAuthenticated, false);
  assert.equal(result.principal.realWorkerAuthenticated, false);
  assert.equal(Object.isFrozen(result.principal), true);
  assert.equal(isBrandedVerifiedPrincipal(result.principal), true);
});

test('forged, copied, cloned and prototype-substituted principals are not branded', () => {
  const attestation = baseAttestation();
  const verified = verifyWorkerPrincipal(
    { attestation },
    { verifyAttestation: registeredVerifier(attestation).verifyAttestation },
  );
  assert.equal(verified.allowed, true);

  const forged = {
    principalId: verified.principal.principalId,
    trustLevel: TRUST_LEVELS.TEST_ATTESTED,
    attestationKind: ATTESTATION_KINDS.TEST_ONLY,
    bootstrapIssuer: verified.principal.bootstrapIssuer,
    principalGeneration: verified.principal.principalGeneration,
    attestedAt: verified.principal.attestedAt,
    osPrincipalAuthenticated: false,
    realWorkerAuthenticated: false,
  };
  assert.equal(isBrandedVerifiedPrincipal(forged), false);

  const spread = { ...verified.principal };
  assert.equal(isBrandedVerifiedPrincipal(spread), false);

  const cloned = structuredClone(verified.principal);
  assert.equal(isBrandedVerifiedPrincipal(cloned), false);

  const protoSub = Object.create(verified.principal);
  assert.equal(isBrandedVerifiedPrincipal(protoSub), false);

  const jsonRoundTrip = JSON.parse(JSON.stringify(verified.principal));
  assert.equal(isBrandedVerifiedPrincipal(jsonRoundTrip), false);
});

test('forged or claimed-only principal DENY', () => {
  const claimed = verifyWorkerPrincipal(
    { actorId: 'worker-principal-a', claimedWorkerId: 'worker-principal-a' },
    { verifyAttestation: () => ({ available: true, accepted: true }) },
  );
  assert.equal(claimed.decision, WORKER_IDENTITY_DECISIONS.DENY_CLAIMED_ONLY_PRINCIPAL);

  const attestation = baseAttestation({ principalId: 'forged-worker' });
  const verifier = registeredVerifier(baseAttestation());
  const forged = verifyWorkerPrincipal(
    { attestation },
    { verifyAttestation: verifier.verifyAttestation },
  );
  assert.equal(forged.decision, WORKER_IDENTITY_DECISIONS.DENY_ATTESTATION_REJECTED);
});

test('missing or rejected attestation DENY', () => {
  const verifier = registeredVerifier();
  assert.equal(
    verifyWorkerPrincipal({}, { verifyAttestation: verifier.verifyAttestation }).decision,
    WORKER_IDENTITY_DECISIONS.DENY_MISSING_ATTESTATION,
  );
  assert.equal(
    verifyWorkerPrincipal(
      { attestation: baseAttestation({ principalId: 'unknown' }) },
      { verifyAttestation: verifier.verifyAttestation },
    ).decision,
    WORKER_IDENTITY_DECISIONS.DENY_ATTESTATION_REJECTED,
  );
});

test('attestation verifier failure / unavailable DENY', () => {
  const throwing = verifyWorkerPrincipal(
    { attestation: baseAttestation() },
    {
      verifyAttestation() {
        throw new Error('boom');
      },
    },
  );
  assert.equal(throwing.decision, WORKER_IDENTITY_DECISIONS.DENY_ATTESTATION_UNAVAILABLE);

  const unavailable = createTestOnlyAttestationVerifier({ unavailable: true });
  assert.equal(
    verifyWorkerPrincipal(
      { attestation: baseAttestation() },
      { verifyAttestation: unavailable.verifyAttestation },
    ).decision,
    WORKER_IDENTITY_DECISIONS.DENY_ATTESTATION_UNAVAILABLE,
  );
});

test('malformed attestation DENY', () => {
  const verifier = registeredVerifier();
  assert.equal(
    verifyWorkerPrincipal(
      { attestation: 'not-an-object' },
      { verifyAttestation: verifier.verifyAttestation },
    ).decision,
    WORKER_IDENTITY_DECISIONS.DENY_MALFORMED_ATTESTATION,
  );
  assert.equal(
    verifyWorkerPrincipal(
      { attestation: { attestationKind: ATTESTATION_KINDS.TEST_ONLY } },
      { verifyAttestation: verifier.verifyAttestation },
    ).decision,
    WORKER_IDENTITY_DECISIONS.DENY_MALFORMED_ATTESTATION,
  );
});

test('OS_PRINCIPAL attestation kind DENY — not authorized in DLP-005', () => {
  const result = verifyWorkerPrincipal(
    { attestation: baseAttestation({ attestationKind: ATTESTATION_KINDS.OS_PRINCIPAL }) },
    {
      verifyAttestation() {
        return {
          available: true,
          accepted: true,
          principalId: 'worker-principal-a',
          bootstrapIssuer: 'test-bootstrap-issuer',
          principalGeneration: 1,
          attestedAt: 1_700_000_000_000,
          trustLevel: TRUST_LEVELS.OS_AUTHENTICATED,
        };
      },
    },
  );
  assert.equal(result.decision, WORKER_IDENTITY_DECISIONS.DENY_UNTRUSTED_ATTESTATION_KIND);
});

test('inconsistent verifier result DENY', () => {
  const result = verifyWorkerPrincipal(
    { attestation: baseAttestation() },
    {
      verifyAttestation() {
        return {
          available: true,
          accepted: true,
          principalId: 'different-principal',
          bootstrapIssuer: 'test-bootstrap-issuer',
          principalGeneration: 1,
          attestedAt: 1_700_000_000_000,
          trustLevel: TRUST_LEVELS.TEST_ATTESTED,
        };
      },
    },
  );
  assert.equal(result.decision, WORKER_IDENTITY_DECISIONS.DENY_INCONSISTENT_ATTESTATION);
});

test('missing verifier DENY', () => {
  assert.equal(
    verifyWorkerPrincipal({ attestation: baseAttestation() }, {}).decision,
    WORKER_IDENTITY_DECISIONS.DENY_MISSING_VERIFIER,
  );
});

test('two distinct Workers cannot substitute principals', () => {
  const a = baseAttestation({ principalId: 'worker-a' });
  const b = baseAttestation({ principalId: 'worker-b' });
  const verifier = createTestOnlyAttestationVerifier();
  verifier.registerAccepted(a);
  verifier.registerAccepted(b);

  const principalA = verifyWorkerPrincipal(
    { attestation: a },
    { verifyAttestation: verifier.verifyAttestation },
  );
  const principalB = verifyWorkerPrincipal(
    { attestation: b },
    { verifyAttestation: verifier.verifyAttestation },
  );
  assert.equal(principalA.allowed, true);
  assert.equal(principalB.allowed, true);
  assert.notEqual(principalA.principal.principalId, principalB.principal.principalId);

  // Presenting B's attestation while claiming A's identity still binds to B only via verifier.
  const swap = verifyWorkerPrincipal(
    { attestation: b, claimedPrincipalId: 'worker-a' },
    { verifyAttestation: verifier.verifyAttestation },
  );
  assert.equal(swap.allowed, true);
  assert.equal(swap.principal.principalId, 'worker-b');
});

test('source does not claim real OS authentication and stays offline-local', () => {
  const source = readFileSync(sourcePath, 'utf8');
  assert.equal(source.includes('NON_OPERATIONAL'), true);
  assert.equal(source.includes('OS_AUTHENTICATED'), true);
  assert.equal(source.includes('node:net'), false);
  assert.equal(source.includes('node:http'), false);
  assert.equal(source.includes('pg'), false);
  assert.equal(source.includes('process.env'), false);
});
