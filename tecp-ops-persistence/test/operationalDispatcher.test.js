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
  S2_STAGES,
  createInjectedClock as createOrlaClock,
  createInMemoryReplayRegistry as createOrlaReplay,
  createInMemoryRevocationRegistry as createOrlaRevocation,
  createTestOnlyOperationalRlaIssuer,
  generateEphemeralOperationalRlaKeyPairForTests,
} from '../../tecp-ops/src/operationalResourceLeaseAuthority.js';
import {
  createOperationalEmergencyStop,
} from '../../tecp-ops/src/operationalEmergencyStop.js';
import {
  projectDbValidatedLeaseContext,
} from '../src/dbIssuedLeaseContext.js';
import {
  DISPATCHER_ACTIONS,
  DISPATCHER_DECISIONS,
  createOperationalDispatcher,
  isPrivilegedOperationalDispatcher,
} from '../src/operationalDispatcher.js';

const BASELINE_SHA = '662b3a16d04de426d444cdce854d7a7d8b982ade';
const NOW = 1_700_000_200_000;
const WORKER_ID = 'worker-s2-disp-001';
const ISSUER = 'test-attestation-issuer-s2';
const SECRET = 'test-attestation-hmac-secret-s2-not-real';
const TASK_ID = 'task-s2-disp-1';
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
  keyRegistry.registerPublicKey('owner-kid-s2', ownerKeys.publicKeyPem);
  keyRegistry.registerPublicKey('cap-kid-s2', capKeys.publicKeyPem);
  const revocationRegistry = createInMemoryRevocationRegistry();
  const replayRegistry = createInMemoryReplayRegistry();
  const ownerIssuer = createTestOnlyOwnerApprovalIssuer({
    kid: 'owner-kid-s2',
    iss: 'test-owner-issuer-s2',
    privateKeyPem: ownerKeys.privateKeyPem,
    keyRegistry,
  });
  const capIssuer = createTestOnlyCapabilityIssuer({
    kid: 'cap-kid-s2',
    iss: 'test-cap-issuer-s2',
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
    kid: 'ops-kid-1',
    audience: TRUST_ROOT_AUDIENCE,
    governanceRevision: S2_GOVERNANCE_REVISION,
    publicKeyPem: orlaKeys.publicKeyPem,
  });
  const orlaClock = createOrlaClock(NOW);
  const orlaRevocation = createOrlaRevocation();
  const orlaReplay = createOrlaReplay();
  const orlaIssuer = createTestOnlyOperationalRlaIssuer({
    kid: 'ops-kid-1',
    iss: 'ops-rla-issuer',
    privateKeyPem: orlaKeys.privateKeyPem,
    trustRoot: trustInstalled.trustRoot,
  });
  const emergencyStop = createOperationalEmergencyStop({ clock: orlaClock });

  return {
    clock,
    attestationVerifier,
    keyRegistry,
    revocationRegistry,
    replayRegistry,
    ownerIssuer,
    capIssuer,
    trustRoot: trustInstalled.trustRoot,
    orlaClock,
    orlaRevocation,
    orlaReplay,
    orlaIssuer,
    emergencyStop,
  };
}

function mintCp1(h, opts = {}) {
  const id = verifyOperationalPrincipal({
    attestation: makeAttestation({ taskId: opts.taskId || TASK_ID }),
    taskId: opts.taskId || TASK_ID,
    actorId: opts.actorId || WORKER_ID,
  }, {
    clock: h.clock,
    attestationVerifier: h.attestationVerifier,
  });
  assert.equal(id.ok, true);
  const approvalIssued = issueOwnerApprovalArtifactForTests(h.ownerIssuer, {
    actorId: opts.actorId || WORKER_ID,
    taskId: opts.taskId || TASK_ID,
    baselineSha: BASELINE_SHA,
    authorizedFileScope: [...SCOPE],
    operationClass: CP1_OPERATION_CLASS.CP1_OFFLINE_SECURITY_CONTRACT,
    nbf: NOW,
    exp: NOW + 240_000,
  });
  assert.equal(approvalIssued.ok, true);
  const approvalVerified = verifyOwnerApprovalArtifact(approvalIssued.token, {
    actorId: opts.actorId || WORKER_ID,
    taskId: opts.taskId || TASK_ID,
  }, {
    keyRegistry: h.keyRegistry,
    clock: h.clock,
    revocationRegistry: h.revocationRegistry,
  });
  assert.equal(approvalVerified.ok, true);
  const cap = issueCapabilityForTests(h.capIssuer, {
    principal: id.principal,
    approvalArtifact: approvalVerified.artifact,
    action: opts.action || DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
    resourcePaths: [...SCOPE],
    nbf: NOW,
    exp: NOW + 60_000,
    taskId: opts.taskId || TASK_ID,
  });
  assert.equal(cap.ok, true);
  return { id, approvalIssued, approvalVerified, cap };
}

function createDispatcher(h, chainHolder) {
  return createOperationalDispatcher({
    emergencyStop: h.emergencyStop,
    trustRoot: h.trustRoot,
    buildCapabilityVerifyDeps() {
      const chain = chainHolder?.current;
      return {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
        replayRegistry: h.replayRegistry,
        approvalToken: chain?.approvalIssued?.token,
        approvalDeps: {
          keyRegistry: h.keyRegistry,
          clock: h.clock,
          revocationRegistry: h.revocationRegistry,
        },
        principal: chain?.id?.principal,
      };
    },
    buildOwnerApprovalVerifyDeps() {
      return {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      };
    },
    orlaVerifyDeps: {
      trustRoot: h.trustRoot,
      clock: h.orlaClock,
      revocationRegistry: h.orlaRevocation,
      replayRegistry: h.orlaReplay,
    },
  });
}

describe('S2 operationalDispatcher fail-closed Gate B', () => {
  it('1) unknown action DENY', () => {
    const h = buildHarness();
    const d = createDispatcher(h, { current: null });
    assert.equal(isPrivilegedOperationalDispatcher(d), true);
    const result = d.authorizeAndDispatch({ action: 'DROP_TABLE' });
    assert.equal(result.decision, DISPATCHER_DECISIONS.DENY_UNKNOWN_ACTION);
    assert.equal(result.mutationExecuted, false);
  });

  it('2) SQL / callback / trust / persistence injection DENY', () => {
    const h = buildHarness();
    const d = createDispatcher(h, { current: null });
    assert.equal(
      d.authorizeAndDispatch({
        action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
        sql: 'SELECT 1',
      }).decision,
      DISPATCHER_DECISIONS.DENY_CALLER_SQL,
    );
    assert.equal(
      d.authorizeAndDispatch({
        action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
        callback: () => {},
      }).decision,
      DISPATCHER_DECISIONS.DENY_CALLER_CALLBACK,
    );
    assert.equal(
      d.authorizeAndDispatch({
        action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
        trustRoot: { forged: true },
      }).decision,
      DISPATCHER_DECISIONS.DENY_CALLER_TRUST_ROOT,
    );
    assert.equal(
      d.authorizeAndDispatch({
        action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
        bindTaskClaimLeaseWithAudit: async () => {},
      }).decision,
      DISPATCHER_DECISIONS.DENY_CALLER_PERSISTENCE_HANDLE,
    );
  });

  it('3) emergency-stop sticky denial', () => {
    const h = buildHarness();
    h.emergencyStop.activate({ reason: 'STOP' });
    const d = createDispatcher(h, { current: null });
    const result = d.authorizeAndDispatch({
      action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      principal: { forged: true },
    });
    assert.equal(result.decision, DISPATCHER_DECISIONS.DENY_EMERGENCY_STOP);
  });

  it('4) RELEASE without branded DB lease context DENY', () => {
    const h = buildHarness();
    const chainHolder = { current: null };
    const d = createDispatcher(h, chainHolder);
    const chain = mintCp1(h, {
      action: DISPATCHER_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT,
    });
    chainHolder.current = chain;
    const orla = h.orlaIssuer.issue({
      stage: S2_STAGES.LEASE_BOUND,
      principalId: WORKER_ID,
      taskId: TASK_ID,
      action: DISPATCHER_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourceType: 'WRITE_RESOURCE',
      resourceKey: 'resource-s2',
      governanceRevision: S2_GOVERNANCE_REVISION,
      issuedAt: NOW,
      expiresAt: NOW + 60_000,
      leaseKey: 'lease-1',
      fencingEpoch: 2,
    });
    assert.equal(orla.ok, true);
    const result = d.authorizeAndDispatch({
      action: DISPATCHER_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT,
      principal: chain.id.principal,
      capabilityToken: chain.cap.token,
      capabilityExpectation: {
        action: DISPATCHER_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT,
        taskId: TASK_ID,
        resourcePaths: [...SCOPE],
        principalId: WORKER_ID,
      },
      orlaToken: orla.token,
      orlaExpectation: {
        principalId: WORKER_ID,
        taskId: TASK_ID,
        action: DISPATCHER_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT,
        resourceType: 'WRITE_RESOURCE',
        resourceKey: 'resource-s2',
        governanceRevision: S2_GOVERNANCE_REVISION,
        iss: 'ops-rla-issuer',
        kid: 'ops-kid-1',
        aud: TRUST_ROOT_AUDIENCE,
      },
      dbIssuedLeaseContext: { leaseKey: 'lease-1', fencingEpoch: 2 },
    });
    assert.equal(result.decision, DISPATCHER_DECISIONS.DENY_UNBRANDED_LEASE_CONTEXT);
    assert.equal(result.dlpInvoked, false);
  });

  it('5) offline checks can pass but mutation remains DENY (no DLP invoke)', () => {
    const h = buildHarness();
    const chainHolder = { current: null };
    const d = createDispatcher(h, chainHolder);
    const chain = mintCp1(h, {
      action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
    });
    chainHolder.current = chain;
    const orla = h.orlaIssuer.issue({
      stage: S2_STAGES.BOOTSTRAP,
      principalId: WORKER_ID,
      taskId: TASK_ID,
      action: 'REQUEST_ELIGIBLE_TASK_LEASE',
      resourceType: 'WRITE_RESOURCE',
      resourceKey: 'resource-s2',
      governanceRevision: S2_GOVERNANCE_REVISION,
      issuedAt: NOW,
      expiresAt: NOW + 60_000,
    });
    assert.equal(orla.ok, true);
    const result = d.authorizeAndDispatch({
      action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      principal: chain.id.principal,
      capabilityToken: chain.cap.token,
      capabilityExpectation: {
        action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
        taskId: TASK_ID,
        resourcePaths: [...SCOPE],
        principalId: WORKER_ID,
      },
      orlaToken: orla.token,
      orlaExpectation: {
        principalId: WORKER_ID,
        taskId: TASK_ID,
        action: 'REQUEST_ELIGIBLE_TASK_LEASE',
        resourceType: 'WRITE_RESOURCE',
        resourceKey: 'resource-s2',
        governanceRevision: S2_GOVERNANCE_REVISION,
        iss: 'ops-rla-issuer',
        kid: 'ops-kid-1',
        aud: TRUST_ROOT_AUDIENCE,
      },
      ownedTxnHandle: { id: 'fake-txn-not-authorized' },
    });
    assert.equal(result.ok, false);
    assert.equal(result.decision, DISPATCHER_DECISIONS.DENY_OPERATIONAL_DISPATCH_DISABLED);
    assert.equal(result.mutationExecuted, false);
    assert.equal(result.dlpInvoked, false);
    assert.equal(result.offlineContractObservations?.capabilityOk, true);
    assert.equal(result.offlineContractObservations?.orlaOk, true);
  });

  it('6) S1 WeakSet / test-signer privilege flags denied', () => {
    const h = buildHarness();
    const d = createDispatcher(h, { current: null });
    assert.equal(
      d.authorizeAndDispatch({
        action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
        useS1OfflineFixture: true,
      }).decision,
      DISPATCHER_DECISIONS.DENY_S1_WEAKSET_OR_TEST_SIGNER,
    );
  });

  it('7) branded DB lease projection available for RELEASE path precheck', () => {
    const projected = projectDbValidatedLeaseContext({
      ok: true,
      valid: true,
      leaseKey: 'lease-1',
      fencingEpoch: 4,
      offlineInterfaceOnly: true,
    }, { id: 'txn' });
    assert.equal(projected.ok, true);
  });
});
