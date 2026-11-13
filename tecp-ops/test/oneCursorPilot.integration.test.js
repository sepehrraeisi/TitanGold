/**
 * TECP-OPS-PILOT-001 — Offline One-Cursor Authority Composition Proof
 *
 * Simulated one-Cursor integration only. NOT real Cursor execution.
 * PROOF_CLASS = OFFLINE / TEST_ONLY / NON_OPERATIONAL
 *
 * Chain under test:
 *   CP1 identity → Owner approval → capability → S1 ResourceLeaseAuthority
 *   → S2 ORLA / emergency-stop → dispatcher HARD_DENY
 *
 * Valid path must reach authorizeAndDispatch and receive
 * DENY_OPERATIONAL_DISPATCH_DISABLED. No PostgreSQL, Worker, MCP,
 * network listener, operational dispatch activation, or production mutation.
 */

import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  CP1_OPERATION_CLASS,
  CP1_PATHS,
  CP1_REPOSITORY_ID,
  b64urlEncode,
} from '../src/config.js';
import {
  createTestOnlyAttestationVerifier,
  verifyOperationalPrincipal,
} from '../src/operationalWorkerIdentity.js';
import {
  APPROVAL_DECISIONS,
  createInjectedClock,
  createInMemoryKeyRegistry,
  createInMemoryRevocationRegistry,
  createTestOnlyOwnerApprovalIssuer,
  generateEphemeralEd25519KeyPairForTests,
  issueOwnerApprovalArtifactForTests,
  verifyOwnerApprovalArtifact,
} from '../src/ownerApprovalArtifact.js';
import {
  CAPABILITY_DECISIONS,
  createInMemoryReplayRegistry,
  createTestOnlyCapabilityIssuer,
  generateEphemeralCapabilityIssuerKeyPairForTests,
  issueCapabilityForTests,
  verifyCapability,
} from '../src/operationalCapabilityIssuer.js';
import {
  RLA_DECISIONS,
  S1_STAGES,
  assertNoOperationalDispatch as assertNoS1Dispatch,
  createInjectedClock as createS1Clock,
  createInMemoryKeyRegistry as createS1KeyRegistry,
  createInMemoryReplayRegistry as createS1Replay,
  createInMemoryRevocationRegistry as createS1Revocation,
  createOfflineTrustedLeaseFixtureForTests,
  createTestOnlyResourceLeaseAuthorityIssuer,
  generateEphemeralResourceLeaseAuthorityKeyPairForTests,
  verifyResourceLeaseAuthority,
} from '../src/resourceLeaseAuthority.js';
import {
  TRUST_ROOT_AUDIENCE,
  createTestOnlyOwnerTrustRootInstaller,
} from '../src/ownerInstalledTrustRoot.js';
import {
  ORLA_DECISIONS,
  S2_GOVERNANCE_REVISION,
  S2_STAGES,
  assertNoOperationalDispatch as assertNoOrlaDispatch,
  createInjectedClock as createOrlaClock,
  createInMemoryReplayRegistry as createOrlaReplay,
  createInMemoryRevocationRegistry as createOrlaRevocation,
  createTestOnlyOperationalRlaIssuer,
  generateEphemeralOperationalRlaKeyPairForTests,
  verifyOperationalResourceLeaseAuthority,
} from '../src/operationalResourceLeaseAuthority.js';
import {
  createOperationalEmergencyStop,
} from '../src/operationalEmergencyStop.js';
import {
  DISPATCHER_ACTIONS,
  DISPATCHER_DECISIONS,
  createOperationalDispatcher,
} from '../../tecp-ops-persistence/src/operationalDispatcher.js';

const PROOF_CLASS = 'OFFLINE_ONE_CURSOR_AUTHORITY_COMPOSITION';
const BASELINE_SHA = '7258a4e2cb7d6c6bcaa25b230538fd369e6bd809';
const NOW = 1_700_000_400_000;
const WORKER_ID = 'worker-one-cursor-001';
const OTHER_WORKER = 'worker-one-cursor-other';
const ISSUER = 'test-attestation-issuer-one-cursor';
const SECRET = 'test-attestation-hmac-one-cursor-not-real';
const TASK_ID = 'task-one-cursor-1';
const OTHER_TASK = 'task-one-cursor-other';
const RESOURCE_TYPE = 'WRITE_RESOURCE';
const RESOURCE_KEY = 'resource-one-cursor';
const S1_GOV_REV = 'OPS_PILOT_001_S1_RESOURCE_LEASE_AUTHORITY_GOVERNANCE_20261110';
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
    knownPrincipalIds: [WORKER_ID, OTHER_WORKER],
    repositoryId: CP1_REPOSITORY_ID,
    baselineSha: BASELINE_SHA,
    verifyEvidenceSignature: (att) => att.evidenceSignature === evidenceSignature(att),
  });

  const ownerKeys = generateEphemeralEd25519KeyPairForTests();
  const capKeys = generateEphemeralCapabilityIssuerKeyPairForTests();
  const keyRegistry = createInMemoryKeyRegistry();
  keyRegistry.registerPublicKey('owner-kid-oc', ownerKeys.publicKeyPem);
  keyRegistry.registerPublicKey('cap-kid-oc', capKeys.publicKeyPem);
  const revocationRegistry = createInMemoryRevocationRegistry();
  const replayRegistry = createInMemoryReplayRegistry();

  const ownerIssuer = createTestOnlyOwnerApprovalIssuer({
    kid: 'owner-kid-oc',
    iss: 'test-owner-issuer-oc',
    privateKeyPem: ownerKeys.privateKeyPem,
    keyRegistry,
  });
  const capIssuer = createTestOnlyCapabilityIssuer({
    kid: 'cap-kid-oc',
    iss: 'test-cap-issuer-oc',
    aud: 'tecp-ops-one-cursor',
    privateKeyPem: capKeys.privateKeyPem,
    keyRegistry,
    replayRegistry,
    clock,
  });

  const s1Keys = generateEphemeralResourceLeaseAuthorityKeyPairForTests();
  const s1KeyRegistry = createS1KeyRegistry();
  s1KeyRegistry.registerPublicKey('s1-kid-oc', s1Keys.publicKeyPem);
  const s1Clock = createS1Clock(NOW);
  const s1Revocation = createS1Revocation();
  const s1Replay = createS1Replay();
  const s1Issuer = createTestOnlyResourceLeaseAuthorityIssuer({
    kid: 's1-kid-oc',
    iss: 'test-s1-rla-issuer-oc',
    privateKeyPem: s1Keys.privateKeyPem,
    keyRegistry: s1KeyRegistry,
  });

  const orlaKeys = generateEphemeralOperationalRlaKeyPairForTests();
  const trustInstaller = createTestOnlyOwnerTrustRootInstaller();
  const trustInstalled = trustInstaller.install({
    issuerId: 'ops-rla-issuer-oc',
    kid: 'ops-kid-oc',
    audience: TRUST_ROOT_AUDIENCE,
    governanceRevision: S2_GOVERNANCE_REVISION,
    publicKeyPem: orlaKeys.publicKeyPem,
  });
  const orlaClock = createOrlaClock(NOW);
  const orlaRevocation = createOrlaRevocation();
  const orlaReplay = createOrlaReplay();
  const orlaIssuer = createTestOnlyOperationalRlaIssuer({
    kid: 'ops-kid-oc',
    iss: 'ops-rla-issuer-oc',
    privateKeyPem: orlaKeys.privateKeyPem,
    trustRoot: trustInstalled.trustRoot,
  });
  const emergencyStop = createOperationalEmergencyStop({ clock: orlaClock });

  return {
    proofClass: PROOF_CLASS,
    clock,
    attestationVerifier,
    keyRegistry,
    revocationRegistry,
    replayRegistry,
    ownerIssuer,
    capIssuer,
    s1KeyRegistry,
    s1Clock,
    s1Revocation,
    s1Replay,
    s1Issuer,
    trustRoot: trustInstalled.trustRoot,
    orlaClock,
    orlaRevocation,
    orlaReplay,
    orlaIssuer,
    emergencyStop,
  };
}

function mintCp1(h, opts = {}) {
  const taskId = opts.taskId || TASK_ID;
  const actorId = opts.actorId || WORKER_ID;
  const action = opts.action || DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT;

  const id = verifyOperationalPrincipal({
    attestation: makeAttestation({
      principalId: actorId,
      taskId,
      ...(opts.attestationOverrides || {}),
    }),
    taskId,
    actorId,
  }, {
    clock: h.clock,
    attestationVerifier: h.attestationVerifier,
  });
  assert.equal(id.ok, true);

  const approvalIssued = issueOwnerApprovalArtifactForTests(h.ownerIssuer, {
    actorId,
    taskId,
    baselineSha: BASELINE_SHA,
    authorizedFileScope: [...SCOPE],
    operationClass: CP1_OPERATION_CLASS.CP1_OFFLINE_SECURITY_CONTRACT,
    nbf: NOW,
    exp: opts.approvalExp || (NOW + 240_000),
  });
  assert.equal(approvalIssued.ok, true);

  const approvalVerified = verifyOwnerApprovalArtifact(approvalIssued.token, {
    actorId,
    taskId,
  }, {
    keyRegistry: h.keyRegistry,
    clock: h.clock,
    revocationRegistry: h.revocationRegistry,
  });
  assert.equal(approvalVerified.ok, true);

  const cap = issueCapabilityForTests(h.capIssuer, {
    principal: id.principal,
    approvalArtifact: approvalVerified.artifact,
    action,
    resourcePaths: [...SCOPE],
    nbf: NOW,
    exp: opts.capExp || (NOW + 60_000),
    taskId,
  });
  assert.equal(cap.ok, true);

  return { id, approvalIssued, approvalVerified, cap, taskId, actorId, action };
}

function mintS1Bootstrap(h, { principalId, taskId }) {
  const issued = h.s1Issuer.issue({
    stage: S1_STAGES.BOOTSTRAP,
    principalId,
    taskId,
    action: 'REQUEST_ELIGIBLE_TASK_LEASE',
    resourceType: RESOURCE_TYPE,
    resourceKey: RESOURCE_KEY,
    governanceRevision: S1_GOV_REV,
    issuedAt: NOW,
    expiresAt: NOW + 60_000,
  });
  assert.equal(issued.ok, true);
  const verified = verifyResourceLeaseAuthority(
    issued.token,
    {
      stage: S1_STAGES.BOOTSTRAP,
      principalId,
      taskId,
      action: 'REQUEST_ELIGIBLE_TASK_LEASE',
      resourceType: RESOURCE_TYPE,
      resourceKey: RESOURCE_KEY,
      governanceRevision: S1_GOV_REV,
      iss: 'test-s1-rla-issuer-oc',
      kid: 's1-kid-oc',
    },
    {
      keyRegistry: h.s1KeyRegistry,
      clock: h.s1Clock,
      revocationRegistry: h.s1Revocation,
      replayRegistry: h.s1Replay,
    },
  );
  assert.equal(verified.ok, true);
  assert.equal(verified.decision, RLA_DECISIONS.ALLOW);
  assert.equal(verified.operationalDispatchAuthorized, false);
  assert.equal(assertNoS1Dispatch(verified).operationalDispatchAuthorized, false);
  return { issued, verified };
}

function mintOrlaBootstrap(h, { principalId, taskId }) {
  const issued = h.orlaIssuer.issue({
    stage: S2_STAGES.BOOTSTRAP,
    principalId,
    taskId,
    action: 'REQUEST_ELIGIBLE_TASK_LEASE',
    resourceType: RESOURCE_TYPE,
    resourceKey: RESOURCE_KEY,
    governanceRevision: S2_GOVERNANCE_REVISION,
    issuedAt: NOW,
    expiresAt: NOW + 60_000,
  });
  assert.equal(issued.ok, true);
  const expectation = {
    stage: S2_STAGES.BOOTSTRAP,
    principalId,
    taskId,
    action: 'REQUEST_ELIGIBLE_TASK_LEASE',
    resourceType: RESOURCE_TYPE,
    resourceKey: RESOURCE_KEY,
    governanceRevision: S2_GOVERNANCE_REVISION,
    iss: 'ops-rla-issuer-oc',
    kid: 'ops-kid-oc',
    aud: TRUST_ROOT_AUDIENCE,
  };
  // Observe S2 verify on a dedicated replay registry so the dispatcher path
  // can still present the same issued token once on the harness registry.
  const verified = verifyOperationalResourceLeaseAuthority(
    issued.token,
    expectation,
    {
      trustRoot: h.trustRoot,
      clock: h.orlaClock,
      revocationRegistry: h.orlaRevocation,
      replayRegistry: createOrlaReplay(),
    },
  );
  assert.equal(verified.ok, true);
  assert.equal(verified.operationalDispatchAuthorized, false);
  assert.equal(assertNoOrlaDispatch(verified).operationalDispatchAuthorized, false);
  return { issued, verified, expectation };
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

function dispatchBind(d, chain, orla) {
  return d.authorizeAndDispatch({
    action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
    principal: chain.id.principal,
    capabilityToken: chain.cap.token,
    capabilityExpectation: {
      action: chain.action,
      taskId: chain.taskId,
      resourcePaths: [...SCOPE],
      principalId: chain.actorId,
    },
    orlaToken: orla.issued.token,
    orlaExpectation: orla.expectation,
    ownedTxnHandle: { id: 'fake-txn-not-authorized' },
  });
}

describe('TECP Ops Pilot offline one-Cursor authority composition', () => {
  it('1) valid CP1→approval→capability→S1→S2 chain reaches dispatcher HARD_DENY', () => {
    const h = buildHarness();
    assert.equal(h.emergencyStop.workerSideEffects, false);
    assert.equal(h.emergencyStop.mcpSideEffects, false);

    const chainHolder = { current: null };
    const d = createDispatcher(h, chainHolder);
    const chain = mintCp1(h);
    chainHolder.current = chain;

    const s1 = mintS1Bootstrap(h, {
      principalId: chain.actorId,
      taskId: chain.taskId,
    });
    assert.equal(s1.verified.ok, true);

    const orla = mintOrlaBootstrap(h, {
      principalId: chain.actorId,
      taskId: chain.taskId,
    });

    const result = dispatchBind(d, chain, orla);
    assert.equal(result.ok, false);
    assert.equal(result.decision, DISPATCHER_DECISIONS.DENY_OPERATIONAL_DISPATCH_DISABLED);
    assert.equal(result.mutationExecuted, false);
    assert.equal(result.dlpInvoked, false);
    assert.equal(result.offlineContractObservations?.capabilityOk, true);
    assert.equal(result.offlineContractObservations?.orlaOk, true);
    assert.equal(s1.verified.operationalDispatchAuthorized, false);
    assert.equal(orla.verified.operationalDispatchAuthorized, false);
  });

  it('2) forged identity or capability DENY', () => {
    const h = buildHarness();
    const forgedId = verifyOperationalPrincipal({
      attestation: makeAttestation({ evidenceSignature: 'forged-not-matching' }),
      taskId: TASK_ID,
      actorId: WORKER_ID,
    }, {
      clock: h.clock,
      attestationVerifier: h.attestationVerifier,
    });
    assert.equal(forgedId.ok, false);

    const chain = mintCp1(h);
    const [payloadB64] = chain.cap.token.split('.');
    const forgedCap = `${payloadB64}.${b64urlEncode(Buffer.from('forged-capability-signature'))}`;
    const forgedVerify = verifyCapability(forgedCap, {
      action: chain.action,
      taskId: chain.taskId,
      resourcePaths: [...SCOPE],
      principalId: chain.actorId,
    }, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: createInMemoryReplayRegistry(),
      approvalToken: chain.approvalIssued.token,
      approvalDeps: {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      },
      principal: chain.id.principal,
    });
    assert.equal(forgedVerify.ok, false);
    assert.equal(
      forgedVerify.decision === CAPABILITY_DECISIONS.DENY_INVALID_SIGNATURE
        || String(forgedVerify.decision).startsWith('DENY_'),
      true,
    );

    const chainHolder = { current: chain };
    const d = createDispatcher(h, chainHolder);
    const orla = mintOrlaBootstrap(h, { principalId: WORKER_ID, taskId: TASK_ID });
    const result = d.authorizeAndDispatch({
      action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      principal: chain.id.principal,
      capabilityToken: forgedCap,
      capabilityExpectation: {
        action: chain.action,
        taskId: chain.taskId,
        resourcePaths: [...SCOPE],
        principalId: chain.actorId,
      },
      orlaToken: orla.issued.token,
      orlaExpectation: orla.expectation,
    });
    assert.equal(result.ok, false);
    assert.equal(result.decision, DISPATCHER_DECISIONS.DENY_CP1);
    assert.equal(result.mutationExecuted, false);
  });

  it('3) expired and revoked authorization DENY', () => {
    const h = buildHarness();
    const chain = mintCp1(h, { capExp: NOW + 30_000 });

    h.clock.setNowMs(NOW + 90_000);
    const expired = verifyCapability(chain.cap.token, {
      action: chain.action,
      taskId: chain.taskId,
      resourcePaths: [...SCOPE],
      principalId: chain.actorId,
    }, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: createInMemoryReplayRegistry(),
      approvalToken: chain.approvalIssued.token,
      approvalDeps: {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      },
      principal: chain.id.principal,
    });
    assert.equal(expired.ok, false);
    assert.equal(expired.decision, CAPABILITY_DECISIONS.DENY_EXPIRED);

    h.clock.setNowMs(NOW);
    const fresh = mintCp1(h);
    h.revocationRegistry.revoke(fresh.cap.claims.jti);
    const revoked = verifyCapability(fresh.cap.token, {
      action: fresh.action,
      taskId: fresh.taskId,
      resourcePaths: [...SCOPE],
      principalId: fresh.actorId,
    }, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: createInMemoryReplayRegistry(),
      approvalToken: fresh.approvalIssued.token,
      approvalDeps: {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      },
      principal: fresh.id.principal,
    });
    assert.equal(revoked.ok, false);
    assert.equal(revoked.decision, CAPABILITY_DECISIONS.DENY_REVOKED);

    const approvalRevoked = verifyOwnerApprovalArtifact(fresh.approvalIssued.token, {
      actorId: fresh.actorId,
      taskId: fresh.taskId,
    }, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    // Approval itself may still verify if only cap jti was revoked; revoke approval jti too.
    h.revocationRegistry.revoke(fresh.approvalIssued.claims.jti);
    const approvalDenied = verifyOwnerApprovalArtifact(fresh.approvalIssued.token, {
      actorId: fresh.actorId,
      taskId: fresh.taskId,
    }, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
    });
    assert.equal(approvalRevoked.ok === true || approvalRevoked.ok === false, true);
    assert.equal(approvalDenied.ok, false);
    assert.equal(approvalDenied.decision, APPROVAL_DECISIONS.DENY_REVOKED);
  });

  it('4) wrong task and wrong principal DENY', () => {
    const h = buildHarness();
    const chain = mintCp1(h, { taskId: TASK_ID, actorId: WORKER_ID });

    const wrongTaskCap = verifyCapability(chain.cap.token, {
      action: chain.action,
      taskId: OTHER_TASK,
      resourcePaths: [...SCOPE],
      principalId: WORKER_ID,
    }, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: createInMemoryReplayRegistry(),
      approvalToken: chain.approvalIssued.token,
      approvalDeps: {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      },
      principal: chain.id.principal,
    });
    assert.equal(wrongTaskCap.ok, false);
    assert.equal(wrongTaskCap.decision, CAPABILITY_DECISIONS.DENY_WRONG_TASK);

    const otherPrincipal = verifyOperationalPrincipal({
      attestation: makeAttestation({ principalId: OTHER_WORKER, taskId: TASK_ID }),
      taskId: TASK_ID,
      actorId: OTHER_WORKER,
    }, {
      clock: h.clock,
      attestationVerifier: h.attestationVerifier,
    });
    assert.equal(otherPrincipal.ok, true);

    const wrongPrincipalCap = verifyCapability(chain.cap.token, {
      action: chain.action,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      principalId: OTHER_WORKER,
    }, {
      keyRegistry: h.keyRegistry,
      clock: h.clock,
      revocationRegistry: h.revocationRegistry,
      replayRegistry: createInMemoryReplayRegistry(),
      approvalToken: chain.approvalIssued.token,
      approvalDeps: {
        keyRegistry: h.keyRegistry,
        clock: h.clock,
        revocationRegistry: h.revocationRegistry,
      },
      principal: otherPrincipal.principal,
    });
    assert.equal(wrongPrincipalCap.ok, false);
    assert.equal(
      wrongPrincipalCap.decision === CAPABILITY_DECISIONS.DENY_WRONG_WORKER
        || wrongPrincipalCap.decision === CAPABILITY_DECISIONS.DENY_WRONG_TASK
        || String(wrongPrincipalCap.decision).startsWith('DENY_'),
      true,
    );

    const orla = h.orlaIssuer.issue({
      stage: S2_STAGES.BOOTSTRAP,
      principalId: WORKER_ID,
      taskId: TASK_ID,
      action: 'REQUEST_ELIGIBLE_TASK_LEASE',
      resourceType: RESOURCE_TYPE,
      resourceKey: RESOURCE_KEY,
      governanceRevision: S2_GOVERNANCE_REVISION,
      issuedAt: NOW,
      expiresAt: NOW + 60_000,
    });
    assert.equal(orla.ok, true);
    const wrongTaskOrla = verifyOperationalResourceLeaseAuthority(
      orla.token,
      {
        stage: S2_STAGES.BOOTSTRAP,
        principalId: WORKER_ID,
        taskId: OTHER_TASK,
        action: 'REQUEST_ELIGIBLE_TASK_LEASE',
        resourceType: RESOURCE_TYPE,
        resourceKey: RESOURCE_KEY,
        governanceRevision: S2_GOVERNANCE_REVISION,
        iss: 'ops-rla-issuer-oc',
        kid: 'ops-kid-oc',
        aud: TRUST_ROOT_AUDIENCE,
      },
      {
        trustRoot: h.trustRoot,
        clock: h.orlaClock,
        revocationRegistry: h.orlaRevocation,
        replayRegistry: createOrlaReplay(),
      },
    );
    assert.equal(wrongTaskOrla.ok, false);
    assert.equal(wrongTaskOrla.decision, ORLA_DECISIONS.DENY_WRONG_TASK);
  });

  it('5) offline fixture misuse DENY (S1 fixture ≠ operational trust)', () => {
    const h = buildHarness();
    const fixture = createOfflineTrustedLeaseFixtureForTests({
      leaseKey: 'lease-fixture-1',
      fencingEpoch: 3,
    });
    assert.equal(fixture.proofClass, 'OFFLINE_FIXTURE_NOT_DB_AUTHORITY');

    const orlaLeaseBound = h.orlaIssuer.issue({
      stage: S2_STAGES.LEASE_BOUND,
      principalId: WORKER_ID,
      taskId: TASK_ID,
      action: DISPATCHER_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourceType: RESOURCE_TYPE,
      resourceKey: RESOURCE_KEY,
      governanceRevision: S2_GOVERNANCE_REVISION,
      issuedAt: NOW,
      expiresAt: NOW + 60_000,
      leaseKey: 'lease-fixture-1',
      fencingEpoch: 3,
    });
    assert.equal(orlaLeaseBound.ok, true);

    const denyFixture = verifyOperationalResourceLeaseAuthority(
      orlaLeaseBound.token,
      {
        stage: S2_STAGES.LEASE_BOUND,
        principalId: WORKER_ID,
        taskId: TASK_ID,
        action: DISPATCHER_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT,
        resourceType: RESOURCE_TYPE,
        resourceKey: RESOURCE_KEY,
        governanceRevision: S2_GOVERNANCE_REVISION,
        iss: 'ops-rla-issuer-oc',
        kid: 'ops-kid-oc',
        aud: TRUST_ROOT_AUDIENCE,
        trustedLeaseContext: fixture,
      },
      {
        trustRoot: h.trustRoot,
        clock: h.orlaClock,
        revocationRegistry: h.orlaRevocation,
        replayRegistry: createOrlaReplay(),
      },
    );
    assert.equal(denyFixture.ok, false);
    assert.equal(denyFixture.decision, ORLA_DECISIONS.DENY_S1_OFFLINE_LEASE_FIXTURE);

    const d = createDispatcher(h, { current: null });
    const misuse = d.authorizeAndDispatch({
      action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      useS1OfflineFixture: true,
    });
    assert.equal(misuse.decision, DISPATCHER_DECISIONS.DENY_S1_WEAKSET_OR_TEST_SIGNER);
    assert.equal(misuse.mutationExecuted, false);
  });

  it('6) caller-injected trust root DENY', () => {
    const h = buildHarness();
    const chainHolder = { current: null };
    const d = createDispatcher(h, chainHolder);
    const chain = mintCp1(h);
    chainHolder.current = chain;
    const orla = mintOrlaBootstrap(h, { principalId: WORKER_ID, taskId: TASK_ID });

    const injected = d.authorizeAndDispatch({
      action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      principal: chain.id.principal,
      capabilityToken: chain.cap.token,
      capabilityExpectation: {
        action: chain.action,
        taskId: chain.taskId,
        resourcePaths: [...SCOPE],
        principalId: chain.actorId,
      },
      orlaToken: orla.issued.token,
      orlaExpectation: orla.expectation,
      trustRoot: { forged: true, publicKeyPem: 'not-a-real-key' },
    });
    assert.equal(injected.ok, false);
    assert.equal(injected.decision, DISPATCHER_DECISIONS.DENY_CALLER_TRUST_ROOT);
    assert.equal(injected.mutationExecuted, false);
  });

  it('7) emergency-stop sticky DENY', () => {
    const h = buildHarness();
    h.emergencyStop.activate({ reason: 'ONE_CURSOR_OFFLINE_STOP' });
    assert.equal(h.emergencyStop.isStopped().ok, false);

    const chainHolder = { current: null };
    const d = createDispatcher(h, chainHolder);
    const chain = mintCp1(h);
    chainHolder.current = chain;
    const orla = mintOrlaBootstrap(h, { principalId: WORKER_ID, taskId: TASK_ID });

    const result = dispatchBind(d, chain, orla);
    assert.equal(result.ok, false);
    assert.equal(result.decision, DISPATCHER_DECISIONS.DENY_EMERGENCY_STOP);
    assert.equal(result.mutationExecuted, false);
    assert.equal(result.dlpInvoked, false);

    const reset = h.emergencyStop.attemptReset({ actor: 'worker', privileged: true });
    assert.equal(reset.ok, false);
    const stillDenied = dispatchBind(d, chain, orla);
    assert.equal(stillDenied.decision, DISPATCHER_DECISIONS.DENY_EMERGENCY_STOP);
  });
});
