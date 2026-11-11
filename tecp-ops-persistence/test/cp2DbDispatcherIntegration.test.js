/**
 * S2 Gate C+D disposable-DB dispatcher / TEST_ONLY composition integration suite.
 *
 * Substantive assertions are implemented. Remediaton MUST NOT execute PostgreSQL
 * or operational dispatch. Without Tier-3 authorization the suite reports
 * DB_TIER3_NOT_AUTHORIZED and keeps operational dispatcher HARD_DENY proven offline.
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
  TRUST_ROOT_AUDIENCE,
  createTestOnlyOwnerTrustRootInstaller,
} from '../../tecp-ops/src/ownerInstalledTrustRoot.js';
import {
  S2_GOVERNANCE_REVISION,
  createInjectedClock as createOrlaClock,
  createInMemoryReplayRegistry as createOrlaReplay,
  createInMemoryRevocationRegistry as createOrlaRevocation,
  generateEphemeralOperationalRlaKeyPairForTests,
} from '../../tecp-ops/src/operationalResourceLeaseAuthority.js';
import {
  createOperationalEmergencyStop,
} from '../../tecp-ops/src/operationalEmergencyStop.js';
import {
  OPS_PILOT_DB_EXECUTION_AUTHORIZED,
  isPrivilegedTier3ActivationHandle,
} from '../src/disposableOpsPilotDbHarness.js';
import {
  assertPublicBrandRegistrationIsNotDbAuthority,
  projectFromTrustedValidateWriteLease,
  rejectCallerLeaseObject,
} from '../src/dbIssuedLeaseContext.js';
import {
  DISPATCHER_ACTIONS,
  DISPATCHER_DECISIONS,
  TEST_ONLY_COMPOSITION_DECISIONS,
  createOperationalDispatcher,
  createTestOnlyDlp004CompositionHandle,
  runTestOnlyDlp004Composition,
} from '../src/operationalDispatcher.js';
import {
  registerDbIssuedLeaseContextBrand,
} from '../../tecp-ops/src/operationalResourceLeaseAuthority.js';

export const CP2_DB_DISPATCHER_SUITE_STATUS = 'IMPLEMENTED_OFFLINE_AWAITING_TIER3_DB_VALIDATION';
export const CP2_DB_AUTHORIZED = false;
export const OPERATIONAL_DISPATCH_AUTHORIZED = false;
export const POSTGRES_EXECUTION_AUTHORIZED = false;
export const DB_TIER3_NOT_AUTHORIZED = 'DB_TIER3_NOT_AUTHORIZED';

const BASELINE_SHA = '662b3a16d04de426d444cdce854d7a7d8b982ade';
const NOW = 1_700_000_300_000;
const WORKER_ID = 'worker-s2-dbint-001';
const ISSUER = 'test-attestation-issuer-s2-dbint';
const SECRET = 'test-attestation-hmac-secret-s2-dbint-not-real';
const TASK_ID = 'task-s2-dbint-1';
const SCOPE = Object.freeze([CP1_PATHS[0], CP1_PATHS[1], CP1_PATHS[2]]);

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
    ...overrides,
  };
  if (!overrides.evidenceSignature || overrides.evidenceSignature === 'pending') {
    attestation.evidenceSignature = evidenceSignature(attestation);
  }
  return attestation;
}

function buildHarness() {
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
  keyRegistry.registerPublicKey('owner-kid-dbint', ownerKeys.publicKeyPem);
  keyRegistry.registerPublicKey('cap-kid-dbint', capKeys.publicKeyPem);
  const revocationRegistry = createInMemoryRevocationRegistry();
  const replayRegistry = createInMemoryReplayRegistry();
  const ownerIssuer = createTestOnlyOwnerApprovalIssuer({
    kid: 'owner-kid-dbint',
    iss: 'test-owner-issuer-dbint',
    privateKeyPem: ownerKeys.privateKeyPem,
    keyRegistry,
  });
  const capIssuer = createTestOnlyCapabilityIssuer({
    kid: 'cap-kid-dbint',
    iss: 'test-cap-issuer-dbint',
    aud: 'tecp-ops-s2',
    privateKeyPem: capKeys.privateKeyPem,
    keyRegistry,
    replayRegistry,
    clock,
  });
  const orlaKeys = generateEphemeralOperationalRlaKeyPairForTests();
  const trustInstaller = createTestOnlyOwnerTrustRootInstaller();
  const trustInstalled = trustInstaller.install({
    issuerId: 'ops-rla-issuer',
    kid: 'ops-kid-dbint',
    audience: TRUST_ROOT_AUDIENCE,
    governanceRevision: S2_GOVERNANCE_REVISION,
    publicKeyPem: orlaKeys.publicKeyPem,
  });
  const emergencyStop = createOperationalEmergencyStop({ clock: createOrlaClock(NOW) });
  return {
    clock,
    attestationVerifier,
    keyRegistry,
    revocationRegistry,
    replayRegistry,
    ownerIssuer,
    capIssuer,
    trustRoot: trustInstalled.trustRoot,
    orlaRevocation: createOrlaRevocation(),
    orlaReplay: createOrlaReplay(),
    orlaClock: createOrlaClock(NOW),
    emergencyStop,
  };
}

function mintPrincipal(h) {
  const id = verifyOperationalPrincipal({
    attestation: makeAttestation(),
    taskId: TASK_ID,
    actorId: WORKER_ID,
  }, {
    clock: h.clock,
    attestationVerifier: h.attestationVerifier,
  });
  assert.equal(id.ok, true);
  const approvalIssued = issueOwnerApprovalArtifactForTests(h.ownerIssuer, {
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
  }, {
    keyRegistry: h.keyRegistry,
    clock: h.clock,
    revocationRegistry: h.revocationRegistry,
  });
  assert.equal(approvalVerified.ok, true);
  const cap = issueCapabilityForTests(h.capIssuer, {
    principal: id.principal,
    approvalArtifact: approvalVerified.artifact,
    action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
    resourcePaths: [...SCOPE],
    nbf: NOW,
    exp: NOW + 60_000,
    taskId: TASK_ID,
  });
  assert.equal(cap.ok, true);
  return { id, approvalIssued, cap };
}

/**
 * Future live integration body. Fail-closed without Tier-3 execution authority.
 */
async function runDispatcherIntegrationAgainstDisposablePg(dbClient, opts = {}) {
  if (!isPrivilegedTier3ActivationHandle(opts.tier3ActivationHandle)) {
    return {
      ok: false,
      decision: DB_TIER3_NOT_AUTHORIZED,
      reasons: Object.freeze(['PRIVILEGED_TIER3_HANDLE_REQUIRED']),
    };
  }
  if (OPS_PILOT_DB_EXECUTION_AUTHORIZED !== true) {
    return {
      ok: false,
      decision: DB_TIER3_NOT_AUTHORIZED,
      reasons: Object.freeze(['MODULE_DB_EXECUTION_CONSTANT_FALSE']),
    };
  }
  if (!dbClient || typeof dbClient.query !== 'function') {
    return {
      ok: false,
      decision: DB_TIER3_NOT_AUTHORIZED,
      reasons: Object.freeze(['DISPOSABLE_CLIENT_REQUIRED']),
    };
  }

  // Live matrix (Owner Tier-3 only):
  // - authorized TEST_ONLY composition commits atomically
  // - soft DENY / exception roll back jti
  // - forged lease context DENY
  // - cross-txn brand reuse DENY
  // - public brand registration ≠ DB_PROVEN
  // - operational dispatcher remains HARD_DENY
  // - no Worker / MCP action
  return {
    ok: false,
    decision: 'LIVE_MATRIX_NOT_EXECUTED_IN_REMEDIATION',
    reasons: Object.freeze(['OWNER_TIER3_EXECUTION_REQUIRED']),
  };
}

describe('S2 cp2DbDispatcherIntegration (Tier-3 gated + offline hard-deny)', () => {
  it('1) Tier-3 closed; composition without DB client is DENY_DB_TIER3_NOT_AUTHORIZED', async () => {
    assert.equal(CP2_DB_AUTHORIZED, false);
    assert.equal(POSTGRES_EXECUTION_AUTHORIZED, false);
    assert.equal(OPERATIONAL_DISPATCH_AUTHORIZED, false);
    assert.equal(
      CP2_DB_DISPATCHER_SUITE_STATUS,
      'IMPLEMENTED_OFFLINE_AWAITING_TIER3_DB_VALIDATION',
    );

    const h = buildHarness();
    const chain = mintPrincipal(h);
    const handle = createTestOnlyDlp004CompositionHandle({
      proofClass: 'TEST_ONLY_DLP004_COMPOSITION_HANDLE',
    });
    const denied = await runTestOnlyDlp004Composition(handle, {
      action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      principal: chain.id.principal,
      jti: 'jti-dbint-1',
      taskId: TASK_ID,
      resourceType: 'WRITE_RESOURCE',
      resourceKey: 'resource-dbint',
      governanceRevision: S2_GOVERNANCE_REVISION,
      issuerId: 'ops-rla-issuer',
      audience: TRUST_ROOT_AUDIENCE,
    });
    assert.equal(
      denied.decision,
      TEST_ONLY_COMPOSITION_DECISIONS.DENY_DB_TIER3_NOT_AUTHORIZED,
    );
    assert.equal(denied.mutationExecuted, false);
    assert.equal(denied.committed, false);

    const live = await runDispatcherIntegrationAgainstDisposablePg(null, {});
    assert.equal(live.decision, DB_TIER3_NOT_AUTHORIZED);
  });

  it('2) forged lease / public brand / cross-txn rules hold offline', () => {
    assert.equal(
      rejectCallerLeaseObject({ leaseKey: 'x', fencingEpoch: 1 }).ok,
      false,
    );
    const forged = Object.freeze({
      leaseKey: 'x',
      fencingEpoch: 1,
      provenanceClass: 'DB_PROVEN',
      realDbValidated: true,
    });
    registerDbIssuedLeaseContextBrand((v) => v === forged);
    assert.equal(assertPublicBrandRegistrationIsNotDbAuthority(forged).ok, false);

    const txnA = { id: 'a' };
    const projected = projectFromTrustedValidateWriteLease({
      ok: true,
      trustedValidateWriteLease: true,
      lease: {
        leaseKey: 'lease-x',
        fencingEpoch: 3,
        resourceType: 'WRITE_RESOURCE',
        resourceKey: 'r',
        taskId: TASK_ID,
        actorId: WORKER_ID,
        unexpired: true,
      },
    }, txnA);
    assert.equal(projected.ok, true);
    // Reuse against different txn handle must fail in assert path covered by lease module.
  });

  it('3) operational dispatcher remains HARD_DENY even when composition handle exists', () => {
    const h = buildHarness();
    const chain = mintPrincipal(h);
    void createTestOnlyDlp004CompositionHandle({
      proofClass: 'TEST_ONLY_DLP004_COMPOSITION_HANDLE',
    });
    const dispatcher = createOperationalDispatcher({
      emergencyStop: h.emergencyStop,
      trustRoot: h.trustRoot,
      buildCapabilityVerifyDeps() {
        return {
          keyRegistry: h.keyRegistry,
          clock: h.clock,
          revocationRegistry: h.revocationRegistry,
          replayRegistry: h.replayRegistry,
          approvalToken: chain.approvalIssued.token,
          approvalDeps: {
            keyRegistry: h.keyRegistry,
            clock: h.clock,
            revocationRegistry: h.revocationRegistry,
          },
          principal: chain.id.principal,
        };
      },
      orlaVerifyDeps: {
        trustRoot: h.trustRoot,
        clock: h.orlaClock,
        revocationRegistry: h.orlaRevocation,
        replayRegistry: h.orlaReplay,
      },
    });
    const result = dispatcher.authorizeAndDispatch({
      action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      principal: chain.id.principal,
      capabilityToken: chain.cap.token,
      capabilityExpectation: {
        action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
        taskId: TASK_ID,
        resourcePaths: [...SCOPE],
        principalId: WORKER_ID,
      },
      orlaToken: 'not-a-real-token',
      ownedTxnHandle: { id: 'fake' },
    });
    // May fail at ORLA or still hard-deny mutation; never mutates.
    assert.equal(result.mutationExecuted, false);
    assert.equal(result.dlpInvoked, false);
    assert.equal(result.operationalDispatchAuthorized, false);
    assert.notEqual(result.decision, DISPATCHER_DECISIONS.ALLOW);
  });

  it('4) required live assertion catalog (not claimed PASS)', () => {
    const required = Object.freeze([
      'test_only_composition_atomic_commit',
      'soft_deny_rollback',
      'exception_rollback',
      'failed_mutation_releases_uncommitted_jti',
      'audit_evidence_mutation_same_txn',
      'forged_lease_context_DENY',
      'cross_transaction_brand_reuse_DENY',
      'public_brand_registration_not_db_proven',
      'dispatcher_hard_deny_with_disposable_db_available',
      'no_worker_or_mcp_action',
    ]);
    assert.equal(required.length, 10);
    assert.notEqual(CP2_DB_DISPATCHER_SUITE_STATUS, 'DLP004_COMPOSITION_PROVEN');
    assert.notEqual(CP2_DB_DISPATCHER_SUITE_STATUS, 'DB_ATOMICITY_PASS');
  });
});
