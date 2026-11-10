/**
 * CP2-I offline modeled concurrency / negative fencing contracts.
 *
 * NOT a real PostgreSQL concurrency or monotonic fencing proof.
 * Database-backed fencing remains: NOT_RUN / CP2_DB_AUTHORIZATION_REQUIRED.
 */

import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  CP1_OPERATION_CLASS,
  CP1_PATHS,
  CP1_REPOSITORY_ID,
} from '../../tecp-ops/src/config.js';
import {
  createTestOnlyAttestationVerifier,
  verifyOperationalPrincipal,
} from '../../tecp-ops/src/operationalWorkerIdentity.js';
import {
  createInjectedClock,
  createInMemoryKeyRegistry,
  createInMemoryRevocationRegistry,
  createTestOnlyOwnerApprovalIssuer,
  generateEphemeralEd25519KeyPairForTests,
  issueOwnerApprovalArtifactForTests,
  verifyOwnerApprovalArtifact,
} from '../../tecp-ops/src/ownerApprovalArtifact.js';
import {
  createInMemoryReplayRegistry,
  createTestOnlyCapabilityIssuer,
  generateEphemeralCapabilityIssuerKeyPairForTests,
  issueCapabilityForTests,
} from '../../tecp-ops/src/operationalCapabilityIssuer.js';

import {
  CP2_I_ACTIONS,
  CP2_I_DECISIONS,
  CP2_I_PATHS,
  createOperationalCompositionGate,
} from '../src/operationalTaskLeaseAuditRepository.js';

const BASELINE_SHA = '3d25a75946f20ef693259b6fc04c1533b2f3930e';
const NOW = 1_700_000_200_000;
const WORKER_ID = 'worker-cp2i-fc';
const ISSUER = 'test-attestation-issuer-cp2i-fc';
const SECRET = 'test-attestation-hmac-secret-cp2i-fc';
const TASK_ID = 'task-cp2i-fc';
const SCOPE = Object.freeze([CP1_PATHS[0], CP1_PATHS[1], CP1_PATHS[2]]);

const DB_REQUIRED = 'NOT_RUN / CP2_DB_AUTHORIZATION_REQUIRED';

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

function makeAttestation() {
  const attestation = {
    attestationKind: 'TEST_ONLY',
    principalId: WORKER_ID,
    principalGeneration: 1,
    bootstrapIssuer: ISSUER,
    repositoryId: CP1_REPOSITORY_ID,
    baselineSha: BASELINE_SHA,
    attestationId: `att-${randomBytes(8).toString('hex')}`,
    attestedAt: NOW,
    nbf: NOW,
    exp: NOW + 120_000,
    taskId: TASK_ID,
    evidenceSignature: 'pending',
  };
  attestation.evidenceSignature = evidenceSignature(attestation);
  return attestation;
}

function mintAuthorizedToken() {
  const clock = createInjectedClock(NOW);
  const attestationVerifier = createTestOnlyAttestationVerifier({
    trustedIssuer: ISSUER,
    knownPrincipalIds: [WORKER_ID],
    repositoryId: CP1_REPOSITORY_ID,
    baselineSha: BASELINE_SHA,
    verifyEvidenceSignature: (att) => att.evidenceSignature === evidenceSignature(att),
  });
  const ownerKeys = generateEphemeralEd25519KeyPairForTests();
  const capKeys = generateEphemeralCapabilityIssuerKeyPairForTests();
  const keyRegistry = createInMemoryKeyRegistry();
  keyRegistry.registerPublicKey('owner-kid-fc', ownerKeys.publicKeyPem);
  keyRegistry.registerPublicKey('cap-kid-fc', capKeys.publicKeyPem);
  const revocationRegistry = createInMemoryRevocationRegistry();
  const replayRegistry = createInMemoryReplayRegistry();
  const ownerIssuer = createTestOnlyOwnerApprovalIssuer({
    kid: 'owner-kid-fc',
    iss: 'test-owner-issuer-fc',
    privateKeyPem: ownerKeys.privateKeyPem,
    keyRegistry,
  });
  const capIssuer = createTestOnlyCapabilityIssuer({
    kid: 'cap-kid-fc',
    iss: 'test-cap-issuer-fc',
    aud: 'tecp-ops-cp2i-fc',
    privateKeyPem: capKeys.privateKeyPem,
    keyRegistry,
    replayRegistry,
    clock,
  });
  const id = verifyOperationalPrincipal({
    attestation: makeAttestation(),
    taskId: TASK_ID,
    actorId: WORKER_ID,
  }, { clock, attestationVerifier });
  assert.equal(id.ok, true);
  const approvalIssued = issueOwnerApprovalArtifactForTests(ownerIssuer, {
    actorId: WORKER_ID,
    taskId: TASK_ID,
    baselineSha: BASELINE_SHA,
    authorizedFileScope: [...SCOPE],
    operationClass: CP1_OPERATION_CLASS.CP1_OFFLINE_SECURITY_CONTRACT,
    nbf: NOW,
    exp: NOW + 240_000,
  });
  assert.equal(approvalIssued.ok, true);
  const approvalVerified = verifyOwnerApprovalArtifact(approvalIssued.token, {
    actorId: WORKER_ID,
    taskId: TASK_ID,
  }, { keyRegistry, clock, revocationRegistry });
  assert.equal(approvalVerified.ok, true);
  const cap = issueCapabilityForTests(capIssuer, {
    principal: id.principal,
    approvalArtifact: approvalVerified.artifact,
    action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
    resourcePaths: [...SCOPE],
    nbf: NOW,
    exp: NOW + 60_000,
    taskId: TASK_ID,
  });
  assert.equal(cap.ok, true);
  return {
    clock,
    keyRegistry,
    revocationRegistry,
    replayRegistry,
    id,
    approvalIssued,
    cap,
  };
}

/**
 * Offline model of single-winner claim contention. Explicitly not PostgreSQL.
 */
function modelClaimContention(contenderCount) {
  const results = [];
  let winnerAssigned = false;
  for (let i = 0; i < contenderCount; i += 1) {
    if (!winnerAssigned) {
      winnerAssigned = true;
      results.push({
        ok: true,
        decision: 'BOUND_WITH_AUDIT',
        fencingEpoch: 1,
        contender: i,
        proofClass: 'MODELED_OFFLINE_ONLY',
      });
    } else {
      results.push({
        ok: false,
        decision: 'DENY_CLAIM_CONFLICT',
        fencingEpoch: 1,
        contender: i,
        proofClass: 'MODELED_OFFLINE_ONLY',
      });
    }
  }
  return results;
}

describe('CP2-I fencingConcurrency modeled offline contracts', () => {
  it('CP2I-FC01 records explicit NOT_RUN for real DB fencing claims', () => {
    const evidence = Object.freeze({
      realAtomicTaskLeaseAuditEvidence: DB_REQUIRED,
      concurrentTwoAndTenPlusParticipants: DB_REQUIRED,
      monotonicFencingAgainstPostgres: DB_REQUIRED,
      crashBeforeCommit: DB_REQUIRED,
      crashAfterCommitBeforeAck: DB_REQUIRED,
      unknownTransactionOutcomeRecovery: DB_REQUIRED,
      databaseOutageAndCleanup: DB_REQUIRED,
      durableReplayExactlyOnce: DB_REQUIRED,
      databasePrivilegeAndImmutableAudit: DB_REQUIRED,
    });
    for (const value of Object.values(evidence)) {
      assert.equal(value, DB_REQUIRED);
    }
    assert.equal(CP2_I_PATHS.length, 7);
  });

  it('CP2I-FC02 two sequential authorized attempts: second capability replay DENY', () => {
    const minted = mintAuthorizedToken();
    const gate = createOperationalCompositionGate({
      baselineSha: BASELINE_SHA,
      buildCapabilityVerifyDeps() {
        return {
          keyRegistry: minted.keyRegistry,
          clock: minted.clock,
          revocationRegistry: minted.revocationRegistry,
          replayRegistry: minted.replayRegistry,
          approvalToken: minted.approvalIssued.token,
          approvalDeps: {
            keyRegistry: minted.keyRegistry,
            clock: minted.clock,
            revocationRegistry: minted.revocationRegistry,
          },
          principal: minted.id.principal,
        };
      },
    });

    const first = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: minted.cap.token,
    });
    assert.equal(first.ok, true);

    const second = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: minted.cap.token,
    });
    assert.equal(second.ok, false);
    assert.equal(second.decision, CP2_I_DECISIONS.DENY_CAPABILITY);
  });

  it('CP2I-FC03 modeled two-contender claim conflict yields single winner', () => {
    const results = modelClaimContention(2);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(results.filter((r) => !r.ok).length, 1);
    assert.equal(results[1].decision, 'DENY_CLAIM_CONFLICT');
    assert.equal(results[0].proofClass, 'MODELED_OFFLINE_ONLY');
    assert.equal(DB_REQUIRED.includes('CP2_DB'), true);
  });

  it('CP2I-FC04 modeled ten-plus claim conflicts yield single winner', () => {
    const results = modelClaimContention(12);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(results.filter((r) => !r.ok).length, 11);
    assert.ok(results.every((r) => r.fencingEpoch === 1));
    assert.equal(DB_REQUIRED, 'NOT_RUN / CP2_DB_AUTHORIZATION_REQUIRED');
  });

  it('CP2I-FC05 stale fencing epoch model DENY (offline shape only)', () => {
    const currentEpoch = 7;
    const presentedEpoch = 6;
    const decision = presentedEpoch < currentEpoch
      ? 'DENY_STALE_FENCING_EPOCH'
      : CP2_I_DECISIONS.ALLOW;
    assert.equal(decision, 'DENY_STALE_FENCING_EPOCH');
  });

  it('CP2I-FC06 composition gate refuses missing trust before contention model', () => {
    assert.throws(
      () => createOperationalCompositionGate({
        baselineSha: BASELINE_SHA,
      }),
      /BUILD_CAPABILITY_VERIFY_DEPS_REQUIRED/,
    );
  });
});
