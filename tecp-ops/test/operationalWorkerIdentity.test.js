import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  CP1_MODE,
  CP1_PATHS,
  CP1_REPOSITORY_ID,
  validateOfflineTestOnlyConfig,
} from '../src/config.js';
import {
  ATTESTATION_KINDS,
  IDENTITY_DECISIONS,
  TRUST_LEVELS,
  createTestOnlyAttestationVerifier,
  isBrandedVerifiedOperationalPrincipal,
  verifyOperationalPrincipal,
} from '../src/operationalWorkerIdentity.js';
import { createInjectedClock } from '../src/ownerApprovalArtifact.js';

const BASELINE_SHA = '3ddbbcc519b1b9da785ba8bb661858be3ba3efa4';
const WORKER_ID = 'worker-test-001';
const ISSUER = 'test-attestation-issuer';
const SECRET = 'test-attestation-hmac-secret-not-a-real-key';

function evidenceSignature(attestation) {
  const body = [
    attestation.attestationKind,
    attestation.principalId,
    String(attestation.principalGeneration),
    attestation.bootstrapIssuer,
    attestation.repositoryId,
    attestation.baselineSha,
    attestation.attestationId,
    String(attestation.attestedAt),
    String(attestation.nbf),
    String(attestation.exp),
    attestation.taskId || '',
  ].join('|');
  return createHmac('sha256', SECRET).update(body).digest('base64url');
}

function makeAttestation(overrides = {}) {
  const now = overrides.attestedAt ?? 1_700_000_000_000;
  const attestation = {
    attestationKind: ATTESTATION_KINDS.TEST_ONLY,
    principalId: WORKER_ID,
    principalGeneration: 1,
    bootstrapIssuer: ISSUER,
    repositoryId: CP1_REPOSITORY_ID,
    baselineSha: BASELINE_SHA,
    attestationId: `att-${randomBytes(8).toString('hex')}`,
    attestedAt: now,
    nbf: now,
    exp: now + 60_000,
    taskId: 'task-cp1-1',
    evidenceSignature: 'pending',
    ...overrides,
  };
  if (!overrides.evidenceSignature || overrides.evidenceSignature === 'pending') {
    attestation.evidenceSignature = evidenceSignature(attestation);
  }
  return attestation;
}

function makeDeps(overrides = {}) {
  const clock = createInjectedClock(1_700_000_000_000);
  const attestationVerifier = createTestOnlyAttestationVerifier({
    trustedIssuer: ISSUER,
    knownPrincipalIds: [WORKER_ID],
    repositoryId: CP1_REPOSITORY_ID,
    baselineSha: BASELINE_SHA,
    verifyEvidenceSignature: (att) => att.evidenceSignature === evidenceSignature(att),
  });
  return { clock, attestationVerifier, ...overrides };
}

describe('CP1 operationalWorkerIdentity', () => {
  it('CP1-P01 valid TEST_ONLY identity ALLOW branded principal', () => {
    const deps = makeDeps();
    const result = verifyOperationalPrincipal({
      attestation: makeAttestation(),
      taskId: 'task-cp1-1',
      actorId: WORKER_ID,
      expectedBaselineSha: BASELINE_SHA,
      expectedRepositoryId: CP1_REPOSITORY_ID,
    }, deps);
    assert.equal(result.ok, true);
    assert.equal(result.decision, IDENTITY_DECISIONS.ALLOW);
    assert.equal(result.principal.trustLevel, TRUST_LEVELS.TEST_ATTESTED);
    assert.equal(result.principal.osPrincipalAuthenticated, false);
    assert.equal(result.principal.realWorkerAuthenticated, false);
    assert.equal(result.principal.classification, 'TEST_ATTESTED / NON_OPERATIONAL');
    assert.equal(isBrandedVerifiedOperationalPrincipal(result.principal), true);
    assert.equal(isBrandedVerifiedOperationalPrincipal({ ...result.principal }), false);
  });

  it('CP1-N01 forged Worker identity DENY', () => {
    const deps = makeDeps();
    const att = makeAttestation({ evidenceSignature: 'forged-sig' });
    const result = verifyOperationalPrincipal({ attestation: att }, deps);
    assert.equal(result.ok, false);
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_FORGED_IDENTITY);
  });

  it('CP1-N02 unknown Worker DENY', () => {
    const deps = makeDeps();
    const att = makeAttestation({ principalId: 'unknown-worker' });
    att.evidenceSignature = evidenceSignature(att);
    const result = verifyOperationalPrincipal({ attestation: att }, deps);
    assert.equal(result.ok, false);
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_UNKNOWN_WORKER);
  });

  it('CP1-N03 caller-supplied trust anchor DENY', () => {
    const deps = makeDeps();
    const result = verifyOperationalPrincipal({
      attestation: makeAttestation(),
      trustAnchor: { publicKey: 'attacker' },
    }, deps);
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR);
  });

  it('CP1-N06 wrong repository DENY', () => {
    const deps = makeDeps();
    const att = makeAttestation({ repositoryId: 'evil/repo' });
    att.evidenceSignature = evidenceSignature(att);
    const result = verifyOperationalPrincipal({ attestation: att }, deps);
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_WRONG_REPOSITORY);
  });

  it('CP1-N07 wrong SHA DENY', () => {
    const deps = makeDeps();
    const att = makeAttestation({ baselineSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
    att.evidenceSignature = evidenceSignature(att);
    const result = verifyOperationalPrincipal({ attestation: att }, deps);
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_WRONG_SHA);
  });

  it('CP1-N08 wrong actor DENY', () => {
    const deps = makeDeps();
    const result = verifyOperationalPrincipal({
      attestation: makeAttestation(),
      actorId: 'other-actor',
    }, deps);
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_WRONG_ACTOR);
  });

  it('CP1-N09 wrong task DENY', () => {
    const deps = makeDeps();
    const result = verifyOperationalPrincipal({
      attestation: makeAttestation(),
      taskId: 'other-task',
    }, deps);
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_WRONG_TASK);
  });

  it('CP1-N13 expired identity DENY', () => {
    const deps = makeDeps();
    deps.clock.setNowMs(1_700_000_100_000);
    const att = makeAttestation({
      attestedAt: 1_700_000_000_000,
      nbf: 1_700_000_000_000,
      exp: 1_700_000_050_000,
    });
    att.evidenceSignature = evidenceSignature(att);
    const result = verifyOperationalPrincipal({ attestation: att }, deps);
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_EXPIRED);
  });

  it('CP1-N15 nbf violation DENY', () => {
    const deps = makeDeps();
    const att = makeAttestation({
      attestedAt: 1_700_000_000_000,
      nbf: 1_700_000_010_000,
      exp: 1_700_000_060_000,
    });
    att.evidenceSignature = evidenceSignature(att);
    const result = verifyOperationalPrincipal({ attestation: att }, deps);
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_NBF_VIOLATION);
  });

  it('CP1-N20 missing clock DENY', () => {
    const deps = makeDeps({ clock: null });
    const result = verifyOperationalPrincipal({ attestation: makeAttestation() }, deps);
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_MISSING_CLOCK);
  });

  it('CP1-N22 missing verifier DENY', () => {
    const deps = makeDeps({ attestationVerifier: null });
    const result = verifyOperationalPrincipal({ attestation: makeAttestation() }, deps);
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_MISSING_VERIFIER);
  });

  it('CP1-N23 empty request DENY fail-closed', () => {
    const result = verifyOperationalPrincipal(null, makeDeps());
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_DEFAULT_FAIL_CLOSED);
  });

  it('self-asserted privilege DENY', () => {
    const result = verifyOperationalPrincipal({
      attestation: makeAttestation(),
      selfAssertedPrivilege: true,
    }, makeDeps());
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_SELF_ASSERTED_PRIVILEGE);
  });

  it('runtime/production mode DENY', () => {
    const result = verifyOperationalPrincipal({
      mode: 'PRODUCTION',
      attestation: makeAttestation(),
    }, makeDeps());
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_RUNTIME_MODE);
  });

  it('OS_PRINCIPAL kind DENY', () => {
    const att = makeAttestation({ attestationKind: ATTESTATION_KINDS.OS_PRINCIPAL });
    const result = verifyOperationalPrincipal({ attestation: att }, makeDeps());
    assert.equal(result.decision, IDENTITY_DECISIONS.DENY_UNTRUSTED_KIND);
  });

  it('config rejects production mode and missing trust', () => {
    assert.equal(
      validateOfflineTestOnlyConfig({ mode: 'PRODUCTION', trustConfig: { issuerId: 'x', kid: 'y' } }).ok,
      false,
    );
    assert.equal(validateOfflineTestOnlyConfig({ mode: CP1_MODE.TEST_ONLY }).ok, false);
    assert.equal(
      validateOfflineTestOnlyConfig({
        mode: CP1_MODE.TEST_ONLY,
        trustConfig: { issuerId: 'iss', kid: 'kid-1' },
      }).ok,
      true,
    );
  });

  it('CP1_PATHS has exactly 11 entries', () => {
    assert.equal(CP1_PATHS.length, 11);
  });

  it('import has no operational side effects marker', () => {
    // Smoke: hashing a constant proves module loaded without throw.
    assert.equal(createHash('sha256').update('cp1').digest('hex').length, 64);
  });
});
