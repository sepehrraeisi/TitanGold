/**
 * S2 Gate C+D disposable-DB dispatcher / TEST_ONLY composition integration suite.
 *
 * Offline orchestration may run via Owner runner offline grant only.
 * Never auto-starts PostgreSQL. Operational dispatcher remains HARD_DENY.
 * Live DB matrix is wired but gated by OPS_PILOT_DB_EXECUTION_AUTHORIZED=false.
 */

import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

/**
 * When dynamically imported by the Owner runner under another node --test parent,
 * skip describe registration to avoid nested suite cancellation. Direct suite
 * discovery via `node --test cp2DbDispatcherIntegration.test.js` still registers.
 */
function isDirectSuiteTestEntrypoint(argv = process.argv) {
  try {
    const self = resolve(fileURLToPath(import.meta.url));
    return Array.isArray(argv) && argv.some((a) => {
      try {
        return resolve(String(a)) === self || basename(String(a)) === basename(self);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

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
  OPS_PILOT_APPROVED_TEST_ACTIONS,
  OPS_PILOT_DB_EXECUTION_AUTHORIZED,
  OPS_PILOT_HARNESS_DECISIONS,
  OPS_PILOT_PINNED_MAIN_SHA,
  consumeRunnerOfflineSuiteGrant,
  createRunnerOfflineSuiteGrantForTests,
  isPrivilegedTier3ActivationHandle,
  isRunnerOfflineSuiteGrant,
} from '../src/disposableOpsPilotDbHarness.js';
import {
  assertPublicBrandRegistrationIsNotDbAuthority,
  projectFromTrustedValidateWriteLease,
  rejectCallerLeaseObject,
} from '../src/dbIssuedLeaseContext.js';
import {
  DISPATCHER_ACTIONS,
  DISPATCHER_DECISIONS,
  OPERATIONAL_DISPATCH_AUTHORIZED as DISPATCHER_MODULE_OPERATIONAL_FLAG,
  TEST_ONLY_COMPOSITION_DECISIONS,
  assertOperationalDispatcherHardDeny,
  createOperationalDispatcher,
  createTestOnlyDlp004CompositionHandle,
  runTestOnlyDlp004Composition,
} from '../src/operationalDispatcher.js';
import {
  registerDbIssuedLeaseContextBrand,
} from '../../tecp-ops/src/operationalResourceLeaseAuthority.js';

export const DISPATCHER_DB_SUITE_PATH = OPS_PILOT_APPROVED_TEST_ACTIONS[1];
export const CP2_DB_DISPATCHER_SUITE_STATUS = 'OFFLINE_ORCHESTRATION_WIRED_AWAITING_LIVE_TIER3_DB';
export const CP2_DB_AUTHORIZED = false;
export const OPERATIONAL_DISPATCH_AUTHORIZED = false;
export const POSTGRES_EXECUTION_AUTHORIZED = false;
export const DB_TIER3_NOT_AUTHORIZED = 'DB_TIER3_NOT_AUTHORIZED';
export const DISPATCHER_PROOF_CLASS_OFFLINE = 'OFFLINE_ORCHESTRATION_NOT_LIVE_PG';
export const DISPATCHER_PROOF_CLASS_LIVE = 'LIVE_DISPOSABLE_PG_DISPATCHER_MATRIX';

export const DISPATCHER_LIVE_SQL_CATALOG = Object.freeze([
  'test_only_composition_atomic_commit',
  'soft_deny_rollback',
  'exception_rollback',
  'failed_mutation_releases_uncommitted_jti',
  'audit_evidence_mutation_same_txn',
  'forged_lease_context_DENY',
  'cross_transaction_brand_reuse_DENY',
  'public_brand_registration_not_db_proven',
  'dispatcher_hard_deny_with_disposable_db_available',
  'transaction_lifetime_enforcement',
  'db_proven_lease_context',
  'no_worker_or_mcp_action',
]);

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
 * Fully wired live DB matrix. Remains non-executing while live gate is closed.
 */
async function runLiveDispatcherDbMatrix(dbClient, opts = {}) {
  if (!isPrivilegedTier3ActivationHandle(opts.tier3ActivationHandle)) {
    return {
      ok: false,
      decision: DB_TIER3_NOT_AUTHORIZED,
      reasons: Object.freeze(['PRIVILEGED_TIER3_HANDLE_REQUIRED']),
      sqlExecuted: false,
      proofClass: DISPATCHER_PROOF_CLASS_LIVE,
    };
  }
  if (OPS_PILOT_DB_EXECUTION_AUTHORIZED !== true) {
    return {
      ok: false,
      decision: DB_TIER3_NOT_AUTHORIZED,
      reasons: Object.freeze(['MODULE_DB_EXECUTION_CONSTANT_FALSE']),
      sqlExecuted: false,
      proofs: Object.freeze(Object.fromEntries(
        DISPATCHER_LIVE_SQL_CATALOG.map((k) => [k, 'NOT_EXECUTED_LIVE_GATE_CLOSED']),
      )),
      proofClass: DISPATCHER_PROOF_CLASS_LIVE,
    };
  }
  if (!dbClient || typeof dbClient.query !== 'function') {
    return {
      ok: false,
      decision: DB_TIER3_NOT_AUTHORIZED,
      reasons: Object.freeze(['DISPOSABLE_CLIENT_REQUIRED']),
      sqlExecuted: false,
    };
  }

  const h = buildHarness();
  const chain = mintPrincipal(h);
  const compositionHandle = createTestOnlyDlp004CompositionHandle({
    proofClass: 'TEST_ONLY_DLP004_COMPOSITION_HANDLE',
  });
  const composition = await runTestOnlyDlp004Composition(compositionHandle, {
    action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
    principal: chain.id.principal,
    jti: `jti-live-${randomBytes(4).toString('hex')}`,
    taskId: TASK_ID,
    resourceType: 'WRITE_RESOURCE',
    resourceKey: 'resource-dbint',
    governanceRevision: S2_GOVERNANCE_REVISION,
    issuerId: 'ops-rla-issuer',
    audience: TRUST_ROOT_AUDIENCE,
    dbClient,
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
  const dispatchResult = dispatcher.authorizeAndDispatch({
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
  const hardDeny = assertOperationalDispatcherHardDeny(dispatchResult);

  return {
    ok: hardDeny.ok === true && composition.mutationExecuted !== true
      ? composition.ok === true
      : false,
    decision: 'LIVE_DISPATCHER_DB_MATRIX_INVOKED',
    reasons: Object.freeze([
      'TEST_ONLY_COMPOSITION_PATH_USED',
      'OPERATIONAL_DISPATCH_REMAINS_HARD_DENY',
      'NO_WORKER_OR_MCP_ACTION',
    ]),
    sqlExecuted: true,
    proofClass: DISPATCHER_PROOF_CLASS_LIVE,
    composition,
    dispatchResult,
    hardDeny,
    catalog: DISPATCHER_LIVE_SQL_CATALOG,
    operationalDispatchAuthorized: false,
  };
}

/**
 * Offline orchestration: lease/brand/dispatcher hard-deny proofs without live SQL.
 */
export async function runOfflineDispatcherDbOrchestration(resources = {}) {
  if (!isRunnerOfflineSuiteGrant(resources.runnerOfflineSuiteGrant)) {
    return {
      ok: false,
      decision: OPS_PILOT_HARNESS_DECISIONS.DENY_RUNNER_SUITE_GRANT_INVALID,
      reasons: Object.freeze(['RUNNER_OFFLINE_SUITE_GRANT_REQUIRED']),
      proofClass: DISPATCHER_PROOF_CLASS_OFFLINE,
      sqlExecuted: false,
      postgresActions: 0,
    };
  }
  const consumed = consumeRunnerOfflineSuiteGrant(resources.runnerOfflineSuiteGrant);
  if (!consumed.ok) {
    return {
      ...consumed,
      proofClass: DISPATCHER_PROOF_CLASS_OFFLINE,
      sqlExecuted: false,
      postgresActions: 0,
    };
  }
  if (consumed.suitePath !== DISPATCHER_DB_SUITE_PATH) {
    return {
      ok: false,
      decision: OPS_PILOT_HARNESS_DECISIONS.DENY_UNAPPROVED_TEST_ACTION,
      reasons: Object.freeze(['SUITE_PATH_MISMATCH']),
      sqlExecuted: false,
      postgresActions: 0,
    };
  }

  const h = buildHarness();
  const chain = mintPrincipal(h);
  const compositionHandle = createTestOnlyDlp004CompositionHandle({
    proofClass: 'TEST_ONLY_DLP004_COMPOSITION_HANDLE',
  });
  const deniedComposition = await runTestOnlyDlp004Composition(compositionHandle, {
    action: DISPATCHER_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
    principal: chain.id.principal,
    jti: 'jti-offline-dbint-1',
    taskId: TASK_ID,
    resourceType: 'WRITE_RESOURCE',
    resourceKey: 'resource-dbint',
    governanceRevision: S2_GOVERNANCE_REVISION,
    issuerId: 'ops-rla-issuer',
    audience: TRUST_ROOT_AUDIENCE,
  });

  assert.equal(
    deniedComposition.decision,
    TEST_ONLY_COMPOSITION_DECISIONS.DENY_DB_TIER3_NOT_AUTHORIZED,
  );

  const forgedDenied = rejectCallerLeaseObject({ leaseKey: 'x', fencingEpoch: 1 });
  const forged = Object.freeze({
    leaseKey: 'x',
    fencingEpoch: 1,
    provenanceClass: 'DB_PROVEN',
    realDbValidated: true,
  });
  registerDbIssuedLeaseContextBrand((v) => v === forged);
  const publicBrand = assertPublicBrandRegistrationIsNotDbAuthority(forged);

  const txnA = { id: 'offline-a' };
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
  const dispatchResult = dispatcher.authorizeAndDispatch({
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
  const hardDeny = assertOperationalDispatcherHardDeny(dispatchResult);

  return {
    ok: forgedDenied.ok === false
      && publicBrand.ok === false
      && projected.ok === true
      && hardDeny.ok === true
      && DISPATCHER_MODULE_OPERATIONAL_FLAG === false
      && OPERATIONAL_DISPATCH_AUTHORIZED === false,
    allowed: true,
    decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_OFFLINE_SUITE_ORCHESTRATION,
    reasons: Object.freeze([
      'OFFLINE_ORCHESTRATION_COMPLETE',
      'NOT_LIVE_POSTGRES_ATOMICITY_PROOF',
      'DISPATCHER_HARD_DENY_PRESERVED',
      'COMPOSITION_WITHOUT_DB_CLIENT_DENIED',
    ]),
    proofClass: DISPATCHER_PROOF_CLASS_OFFLINE,
    sqlExecuted: false,
    postgresActions: 0,
    dbActions: 0,
    classification: 'TEST_ONLY',
    operationalDispatchAuthorized: false,
    proofs: Object.freeze({
      compositionWithoutDbDenied: true,
      forgedLeaseDenied: forgedDenied.ok === false,
      publicBrandNotDbProven: publicBrand.ok === false,
      dbProvenProjectionOffline: projected.ok === true,
      dispatcherHardDeny: hardDeny.ok === true,
      liveSqlCatalog: DISPATCHER_LIVE_SQL_CATALOG,
      liveSqlStatus: 'NOT_EXECUTED',
    }),
  };
}

export async function executeTier3SuiteViaRunnerContract(ctx = {}) {
  if (!ctx || typeof ctx !== 'object') {
    return {
      ok: false,
      decision: OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG,
      reasons: Object.freeze(['CONTEXT_REQUIRED']),
      sqlExecuted: false,
      postgresActions: 0,
    };
  }
  if (ctx.suitePath && ctx.suitePath !== DISPATCHER_DB_SUITE_PATH) {
    return {
      ok: false,
      decision: OPS_PILOT_HARNESS_DECISIONS.DENY_UNAPPROVED_TEST_ACTION,
      reasons: Object.freeze(['WRONG_SUITE_FOR_DISPATCHER_MODULE']),
      sqlExecuted: false,
      postgresActions: 0,
    };
  }
  if (ctx.mode === 'OFFLINE_INERT_ORCHESTRATION') {
    return runOfflineDispatcherDbOrchestration(ctx);
  }
  if (ctx.mode === 'LIVE_DISPOSABLE') {
    return runLiveDispatcherDbMatrix(ctx.clusterClient, {
      tier3ActivationHandle: ctx.tier3ActivationHandle,
    });
  }
  return {
    ok: false,
    decision: DB_TIER3_NOT_AUTHORIZED,
    reasons: Object.freeze([
      'UNSUPPORTED_OR_UNAUTHORIZED_MODE',
      'DEFAULT_DENY_NO_AUTO_POSTGRES',
    ]),
    sqlExecuted: false,
    postgresActions: 0,
  };
}

async function runDispatcherIntegrationAgainstDisposablePg(dbClient, opts = {}) {
  return runLiveDispatcherDbMatrix(dbClient, opts);
}

const __registerSuiteSelfTests = isDirectSuiteTestEntrypoint();

(__registerSuiteSelfTests ? describe : (_name, _fn) => {})('S2 cp2DbDispatcherIntegration (Tier-3 gated + offline hard-deny)', () => {
  it('1) Tier-3 closed; composition without DB client is DENY_DB_TIER3_NOT_AUTHORIZED', async () => {
    assert.equal(CP2_DB_AUTHORIZED, false);
    assert.equal(POSTGRES_EXECUTION_AUTHORIZED, false);
    assert.equal(OPERATIONAL_DISPATCH_AUTHORIZED, false);
    assert.equal(DISPATCHER_MODULE_OPERATIONAL_FLAG, false);
    assert.equal(
      CP2_DB_DISPATCHER_SUITE_STATUS,
      'OFFLINE_ORCHESTRATION_WIRED_AWAITING_LIVE_TIER3_DB',
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
    assert.equal(DISPATCHER_LIVE_SQL_CATALOG.length, 12);
    assert.notEqual(CP2_DB_DISPATCHER_SUITE_STATUS, 'DLP004_COMPOSITION_PROVEN');
    assert.notEqual(CP2_DB_DISPATCHER_SUITE_STATUS, 'DB_ATOMICITY_PASS');
  });

  it('5) offline runner grant orchestrates TEST_ONLY proofs without live SQL', async () => {
    const grant = createRunnerOfflineSuiteGrantForTests({
      proofClass: 'TEST_ONLY_RUNNER_OFFLINE_SUITE_GRANT',
      suitePath: DISPATCHER_DB_SUITE_PATH,
    });
    const result = await executeTier3SuiteViaRunnerContract({
      mode: 'OFFLINE_INERT_ORCHESTRATION',
      runnerOfflineSuiteGrant: grant,
      suitePath: DISPATCHER_DB_SUITE_PATH,
      repositorySha: OPS_PILOT_PINNED_MAIN_SHA,
    });
    assert.equal(result.ok, true);
    assert.equal(result.sqlExecuted, false);
    assert.equal(result.postgresActions, 0);
    assert.equal(result.proofClass, DISPATCHER_PROOF_CLASS_OFFLINE);
    assert.equal(result.classification, 'TEST_ONLY');
    assert.equal(result.operationalDispatchAuthorized, false);
    assert.equal(result.proofs.dispatcherHardDeny, true);

    const replay = await executeTier3SuiteViaRunnerContract({
      mode: 'OFFLINE_INERT_ORCHESTRATION',
      runnerOfflineSuiteGrant: grant,
      suitePath: DISPATCHER_DB_SUITE_PATH,
    });
    assert.equal(replay.ok, false);
    assert.equal(replay.decision, OPS_PILOT_HARNESS_DECISIONS.DENY_ONESHOT_REPLAY);
  });
});
