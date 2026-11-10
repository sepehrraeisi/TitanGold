/**
 * CP2-I offline fake-client / contract tests.
 * VERIFIED_DB_FREE_AND_SAFE: no pg import, no initdb, no network, no SQL execution.
 */

import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

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
  CAPABILITY_DECISIONS,
  createInMemoryReplayRegistry,
  createTestOnlyCapabilityIssuer,
  generateEphemeralCapabilityIssuerKeyPairForTests,
  issueCapabilityForTests,
  verifyCapability,
} from '../../tecp-ops/src/operationalCapabilityIssuer.js';
import {
  WRITE_LEASE_TXN_OWNER_GUC,
  WRITE_LEASE_TXN_OWNER_TOKEN,
} from '../../tecp-persistence/src/writeLeaseRepository.js';

import {
  CP2_I_ACTIONS,
  CP2_I_DECISIONS,
  CP2_I_PATHS,
  createOperationalCompositionGate,
  isBrandedCp2IAuthorizedInvocation,
  isPrivilegedOperationalCompositionGate,
} from '../src/operationalTaskLeaseAuditRepository.js';
import {
  HARNESS_DECISIONS,
  assertHarnessSourceHasNoEagerPgImport,
  createNonProdClient,
  evaluateNonProdHarnessSafety,
  startNonProdCluster,
} from '../src/nonProdDbHarness.js';

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE_SHA = '3d25a75946f20ef693259b6fc04c1533b2f3930e';
const NOW = 1_700_000_100_000;
const WORKER_ID = 'worker-cp2i-001';
const ISSUER = 'test-attestation-issuer-cp2i';
const SECRET = 'test-attestation-hmac-secret-cp2i-not-real';
const TASK_ID = 'task-cp2i-1';
/** CP1 issuer enforces CP1_PATHS; CP2-I reuses that frozen scope for capability binding. */
const SCOPE = Object.freeze([
  CP1_PATHS[0],
  CP1_PATHS[1],
  CP1_PATHS[2],
]);

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

function fullTrustHarness() {
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
  keyRegistry.registerPublicKey('owner-kid-cp2i', ownerKeys.publicKeyPem);
  keyRegistry.registerPublicKey('cap-kid-cp2i', capKeys.publicKeyPem);
  const revocationRegistry = createInMemoryRevocationRegistry();
  const replayRegistry = createInMemoryReplayRegistry();
  const ownerIssuer = createTestOnlyOwnerApprovalIssuer({
    kid: 'owner-kid-cp2i',
    iss: 'test-owner-issuer-cp2i',
    privateKeyPem: ownerKeys.privateKeyPem,
    keyRegistry,
  });
  const capIssuer = createTestOnlyCapabilityIssuer({
    kid: 'cap-kid-cp2i',
    iss: 'test-cap-issuer-cp2i',
    aud: 'tecp-ops-cp2i',
    privateKeyPem: capKeys.privateKeyPem,
    keyRegistry,
    replayRegistry,
    clock,
  });
  return {
    clock,
    attestationVerifier,
    keyRegistry,
    revocationRegistry,
    replayRegistry,
    ownerIssuer,
    capIssuer,
  };
}

function mintChain(h, opts = {}) {
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
    authorizedFileScope: [...(opts.scope || SCOPE)],
    operationClass: CP1_OPERATION_CLASS.CP1_OFFLINE_SECURITY_CONTRACT,
    nbf: NOW,
    exp: opts.approvalExp ?? NOW + 240_000,
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
    action: opts.action || CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
    resourcePaths: [...(opts.resourcePaths || SCOPE)],
    nbf: NOW,
    exp: opts.capabilityExp ?? NOW + 60_000,
    taskId: opts.taskId || TASK_ID,
    jti: opts.jti,
  });
  assert.equal(cap.ok, true);
  return { id, approvalIssued, approvalVerified, cap };
}

function createGate(h, persistence = {}) {
  const chainHolder = { current: null };
  const gate = createOperationalCompositionGate({
    baselineSha: BASELINE_SHA,
    repositoryId: CP1_REPOSITORY_ID,
    persistence,
    buildCapabilityVerifyDeps() {
      const chain = chainHolder.current;
      assert.ok(chain, 'test must set chainHolder.current before authorize');
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
  });
  assert.equal(isPrivilegedOperationalCompositionGate(gate), true);
  return { gate, chainHolder };
}

/**
 * Fake client supporting DLP-001 owned-txn idle probe (savepoint 25P01 when idle)
 * and BEGIN/COMMIT/ROLLBACK / set_config ownership mark. No PostgreSQL process.
 */
function createFakeOwnedTxnClient() {
  let inTxn = false;
  let owner = null;
  const log = [];
  const client = {
    queryLog: log,
    async query(sql, params) {
      const text = String(sql);
      log.push({ sql: text, params });
      if (text.startsWith('SAVEPOINT tecp_dlp_write_lease_idle_probe')) {
        if (!inTxn) {
          const err = new Error('no transaction');
          err.code = '25P01';
          throw err;
        }
        return { rows: [], rowCount: 0 };
      }
      if (text.startsWith('RELEASE SAVEPOINT tecp_dlp_write_lease_idle_probe')) {
        return { rows: [], rowCount: 0 };
      }
      if (text === 'BEGIN') {
        inTxn = true;
        owner = null;
        return { rows: [], rowCount: 0 };
      }
      if (text === 'COMMIT') {
        inTxn = false;
        owner = null;
        return { rows: [], rowCount: 0 };
      }
      if (text === 'ROLLBACK') {
        inTxn = false;
        owner = null;
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('set_config')) {
        owner = params?.[1] || WRITE_LEASE_TXN_OWNER_TOKEN;
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('current_setting')) {
        return { rows: [{ owner }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    get inTransaction() {
      return inTxn;
    },
    get ownerMark() {
      return owner;
    },
  };
  return client;
}

describe('CP2-I operationalTaskLeaseAuditRepository offline contracts', () => {
  it('CP2I-P01 exact principal/task/resource/capability binding ALLOW (authz only)', () => {
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h);
    chainHolder.current = chain;
    const authz = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
    });
    assert.equal(authz.ok, true);
    assert.equal(isBrandedCp2IAuthorizedInvocation(authz), true);
    assert.equal(authz.actorId, WORKER_ID);
    assert.equal(authz.taskId, TASK_ID);
    assert.deepEqual([...authz.resourcePaths], [...SCOPE]);
  });

  it('CP2I-N01 wrong principal DENY', () => {
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h);
    chainHolder.current = chain;
    const authz = gate.authorizeOperationalMutation({
      actorId: 'other-worker',
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
    });
    assert.equal(authz.ok, false);
    assert.equal(authz.decision, CP2_I_DECISIONS.DENY_WRONG_PRINCIPAL);
  });

  it('CP2I-N02 wrong task DENY', () => {
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h);
    chainHolder.current = chain;
    const authz = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: 'task-OTHER',
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
    });
    assert.equal(authz.ok, false);
    assert.equal(authz.decision, CP2_I_DECISIONS.DENY_WRONG_TASK);
  });

  it('CP2I-N03 wrong resource DENY', () => {
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h);
    chainHolder.current = chain;
    const authz = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [CP1_PATHS[0]],
      capabilityToken: chain.cap.token,
    });
    assert.equal(authz.ok, false);
    assert.equal(authz.decision, CP2_I_DECISIONS.DENY_WRONG_RESOURCE);
  });

  it('CP2I-N04 missing Owner approval DENY', () => {
    const h = fullTrustHarness();
    const chain = mintChain(h);
    const gate = createOperationalCompositionGate({
      baselineSha: BASELINE_SHA,
      buildCapabilityVerifyDeps() {
        return {
          keyRegistry: h.keyRegistry,
          clock: h.clock,
          revocationRegistry: h.revocationRegistry,
          replayRegistry: h.replayRegistry,
          approvalToken: null,
          principal: chain.id.principal,
        };
      },
    });
    const authz = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
    });
    assert.equal(authz.ok, false);
    assert.equal(authz.decision, CP2_I_DECISIONS.DENY_MISSING_OWNER_APPROVAL);
  });

  it('CP2I-N05 expired capability DENY', () => {
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h, { capabilityExp: NOW + 1_000 });
    chainHolder.current = chain;
    h.clock.advanceMs(5_000);
    const authz = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
    });
    assert.equal(authz.ok, false);
    assert.equal(authz.decision, CP2_I_DECISIONS.DENY_CAPABILITY);
    assert.ok(authz.reasons.includes(CAPABILITY_DECISIONS.DENY_EXPIRED));
  });

  it('CP2I-N06 revoked capability DENY', () => {
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h, { jti: 'cap-jti-revoke-1' });
    chainHolder.current = chain;
    h.revocationRegistry.revoke('cap-jti-revoke-1');
    const authz = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
    });
    assert.equal(authz.ok, false);
    assert.equal(authz.decision, CP2_I_DECISIONS.DENY_CAPABILITY);
    assert.ok(authz.reasons.includes(CAPABILITY_DECISIONS.DENY_REVOKED));
  });

  it('CP2I-N07 caller-controlled verifier/trust anchor DENY', () => {
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h);
    chainHolder.current = chain;
    const a = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      trustAnchor: { publicKey: 'attacker' },
    });
    assert.equal(a.ok, false);
    assert.equal(a.decision, CP2_I_DECISIONS.DENY_CALLER_TRUST_ANCHOR);

    const b = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      keyRegistry: h.keyRegistry,
    });
    assert.equal(b.ok, false);
    assert.equal(b.decision, CP2_I_DECISIONS.DENY_CALLER_VERIFIER);

    const c = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      bindTaskClaimLeaseWithAudit: async () => ({ ok: true }),
    });
    assert.equal(c.ok, false);
    assert.equal(c.decision, CP2_I_DECISIONS.DENY_CALLER_PERSISTENCE_PORT);
  });

  it('CP2I-N08 replay cannot silently re-grant authority', () => {
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h);
    chainHolder.current = chain;
    const first = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
    });
    assert.equal(first.ok, true);
    const second = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
    });
    assert.equal(second.ok, false);
    assert.equal(second.decision, CP2_I_DECISIONS.DENY_CAPABILITY);
    assert.ok(
      second.reasons.includes(CAPABILITY_DECISIONS.DENY_REPLAY)
      || second.reasons.includes(CAPABILITY_DECISIONS.DENY_DUPLICATE_JTI),
    );
  });

  it('CP2I-N09 executeAuthorizedOwnedWork is non-dispatch (work callback never runs)', async () => {
    let workCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h);
    chainHolder.current = chain;
    const authz = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
    });
    assert.equal(authz.ok, true);
    const client = createFakeOwnedTxnClient();
    const result = await gate.executeAuthorizedOwnedWork(client, authz, async () => {
      workCalls += 1;
      return { ok: false, decision: 'SOFT_DENY_SIMULATED' };
    });
    assert.equal(workCalls, 0);
    assert.equal(result.ok, false);
    assert.equal(result.decision, CP2_I_DECISIONS.DENY_OPERATIONAL_WORK_CALLBACK);
    assert.equal(result.operationalDispatch, false);
    assert.equal(result.mutationAttempted, false);
    assert.equal(client.queryLog.length, 0);
  });

  it('CP2I-N10 auth DENY never attempts mutation', async () => {
    let bindCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      bindTaskClaimLeaseWithAudit: async () => {
        bindCalls += 1;
        return { ok: true, decision: 'SHOULD_NOT_RUN' };
      },
    });
    const chain = mintChain(h);
    chainHolder.current = chain;
    const client = createFakeOwnedTxnClient();
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(client, {
      actorId: 'wrong-actor',
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      persistenceInput: { compositionGovernanceRevision: 'x' },
    });
    assert.equal(out.ok, false);
    assert.equal(out.mutationAttempted, false);
    assert.equal(bindCalls, 0);
    assert.equal(client.queryLog.length, 0);
  });

  it('CP2I-N11 constructor-injected persistence is DENY without mutation dispatch', async () => {
    let bindCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      bindTaskClaimLeaseWithAudit: async () => {
        bindCalls += 1;
        return { ok: false, decision: 'DENY_BIND' };
      },
    });
    const chain = mintChain(h);
    chainHolder.current = chain;
    const client = createFakeOwnedTxnClient();
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(client, {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE',
      resourceKey: 'resource-cp2i-1',
      leaseKey: 'lease-cp2i-1',
      persistenceInput: validBindPersistenceInput(),
    });
    assert.equal(out.ok, false);
    assert.equal(out.decision, CP2_I_DECISIONS.DENY_CONSTRUCTOR_PERSISTENCE_INJECTION);
    assert.equal(out.mutationAttempted, false);
    assert.equal(out.operationalDispatch, false);
    assert.equal(bindCalls, 0);
    assert.equal(client.queryLog.length, 0);
  });

  it('CP2I-N12 missing privileged trust deps fail closed', () => {
    assert.throws(
      () => createOperationalCompositionGate({ baselineSha: BASELINE_SHA }),
      /BUILD_CAPABILITY_VERIFY_DEPS_REQUIRED/,
    );
  });

  it('CP2I-N13 scope escape / path traversal DENY', () => {
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h);
    chainHolder.current = chain;
    const authz = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: ['tecp-ops-persistence/../tecp/src/index.js'],
      capabilityToken: chain.cap.token,
    });
    assert.equal(authz.ok, false);
    assert.equal(authz.decision, CP2_I_DECISIONS.DENY_SCOPE_ESCAPE);
  });

  it('CP2I-N14 copied authz object is not branded authority', () => {
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h);
    chainHolder.current = chain;
    const authz = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
    });
    const copied = { ...authz };
    assert.equal(isBrandedCp2IAuthorizedInvocation(copied), false);
  });

  it('CP2I-S01 source is non-dispatch: DLP decision constants only, no lease SQL fork', () => {
    const src = readFileSync(
      join(here, '../src/operationalTaskLeaseAuditRepository.js'),
      'utf8',
    );
    assert.match(src, /taskClaimLeaseAuditRepository\.js/);
    assert.match(src, /OFFLINE_CONTRACT_NON_DISPATCH/);
    assert.equal(/import\s*\{[^}]*\bbindTaskClaimLeaseWithAudit\b/.test(src), false);
    assert.equal(src.includes('writeLeaseRepository.js'), false);
    assert.equal(/from\s+['\"][^'\"]*writeLeaseRepository/.test(src), false);
    assert.equal(src.includes('fencing_epoch + 1'), false);
    assert.equal(src.includes('INSERT INTO dlp_write_lease'), false);
    assert.equal(src.includes('from \'pg\''), false);
    assert.equal(src.includes('from "pg"'), false);
    assert.equal(src.includes('initdb'), false);
    assert.equal(src.includes('pg_ctl'), false);
  });

  it('CP2I-S02 non-prod harness refuses unsafe env and never eagerly imports pg', async () => {
    const harnessSrc = readFileSync(join(here, '../src/nonProdDbHarness.js'), 'utf8');
    assert.equal(assertHarnessSourceHasNoEagerPgImport(harnessSrc).ok, true);

    const prod = evaluateNonProdHarnessSafety(
      { explicitNonProd: true },
      { NODE_ENV: 'production' },
    );
    assert.equal(prod.ok, false);
    assert.equal(prod.decision, HARNESS_DECISIONS.DENY_PRODUCTION_ENV);

    const envUrl = evaluateNonProdHarnessSafety(
      { explicitNonProd: true },
      { NODE_ENV: 'test', DATABASE_URL: 'postgres://x' },
    );
    assert.equal(envUrl.ok, false);
    assert.equal(envUrl.decision, HARNESS_DECISIONS.DENY_ENV_DATABASE_URL);

    const remote = evaluateNonProdHarnessSafety(
      { explicitNonProd: true, host: 'db.amazonaws.com' },
      { NODE_ENV: 'test' },
    );
    assert.equal(remote.ok, false);

    const okContract = evaluateNonProdHarnessSafety(
      { explicitNonProd: true },
      { NODE_ENV: 'test' },
    );
    assert.equal(okContract.ok, true);
    assert.equal(okContract.dbExecutionAuthorized, false);

    const client = await createNonProdClient({ explicitNonProd: true }, { NODE_ENV: 'test' });
    assert.equal(client.ok, false);
    assert.equal(client.decision, HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED);

    const started = await startNonProdCluster({ explicitNonProd: true }, { NODE_ENV: 'test' });
    assert.equal(started.ok, false);
    assert.equal(started.decision, HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED);
  });

  it('CP2I-S03 SQL fixture is source-only and records CP2-DB requirement', () => {
    const sql = readFileSync(join(here, 'disposableOpsPilotSchema.sql'), 'utf8');
    assert.match(sql, /SOURCE ONLY/);
    assert.match(sql, /CP2_DB/);
    assert.match(sql, /tecp_ops_pilot_composition_proof/);
    assert.equal(/\binitdb\b/.test(sql), false);
    assert.equal(/\bpg_ctl\b/.test(sql), false);
  });

  it('CP2I-S04 Rule02 YES / validator ALLOW are not execution authority', () => {
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h);
    chainHolder.current = chain;
    const authz = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      rule02Yes: true,
      validatorAllow: true,
    });
    assert.equal(authz.ok, false);
    assert.equal(authz.decision, CP2_I_DECISIONS.DENY_DEFAULT_FAIL_CLOSED);
  });

  it('CP2I-S05 verifyCapability still rejects worker-supplied trust on token wrapper', () => {
    const h = fullTrustHarness();
    const chain = mintChain(h);
    const verified = verifyCapability({
      token: chain.cap.token,
      trustAnchor: 'evil',
    }, {}, {
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
    });
    assert.equal(verified.ok, false);
    assert.equal(verified.decision, CAPABILITY_DECISIONS.DENY_WORKER_SUPPLIED_TRUST_ANCHOR);
  });

  it('CP2I-S06 ownership GUC constant reused from frozen DLP-001 (no algorithm fork)', () => {
    assert.equal(typeof WRITE_LEASE_TXN_OWNER_GUC, 'string');
    assert.equal(typeof WRITE_LEASE_TXN_OWNER_TOKEN, 'string');
    assert.equal(CP2_I_PATHS.length, 7);
  });
});

/**
 * CP2I-HQA-01: authorization-to-persistence binding.
 * Valid capability for Task/Actor A must never dispatch persistence for Task/Actor B.
 */
function validBindPersistenceInput(overrides = {}) {
  const bind = {
    taskId: TASK_ID,
    actorId: WORKER_ID,
    resourceType: 'OPS_PILOT_RESOURCE',
    resourceKey: 'resource-cp2i-1',
    leaseKey: 'lease-cp2i-1',
    fencingEpoch: 0,
    governanceRevision: 'DLP002_AUTHORIZATION_20261031',
    idempotencyKey: 'bind-idem-1',
    ...(overrides.bind || {}),
  };
  const audit = {
    eventId: 'evt-1',
    eventType: 'TASK_BOUND',
    taskId: TASK_ID,
    actorId: WORKER_ID,
    governanceRevision: 'DLP003_AUTHORIZATION_20261031',
    idempotencyKey: 'audit-idem-1',
    ...(overrides.audit || {}),
  };
  const evidence = overrides.evidence === null
    ? undefined
    : {
      evidenceId: 'ev-1',
      taskId: TASK_ID,
      actorId: WORKER_ID,
      governanceRevision: 'DLP003_AUTHORIZATION_20261031',
      evidenceType: 'PROOF',
      evidenceRef: 'ref-1',
      idempotencyKey: 'ev-idem-1',
      ...(overrides.evidence || {}),
    };
  return {
    compositionGovernanceRevision: 'DLP004_AUTHORIZATION_20261031',
    bind,
    audit,
    ...(evidence ? { evidence } : {}),
    ...overrides.top,
  };
}

function validReleasePersistenceInput(overrides = {}) {
  const base = validBindPersistenceInput(overrides);
  const { bind, ...rest } = base;
  return {
    ...rest,
    release: {
      taskId: bind.taskId,
      actorId: bind.actorId,
      resourceType: bind.resourceType,
      resourceKey: bind.resourceKey,
      leaseKey: bind.leaseKey,
      fencingEpoch: 1,
      governanceRevision: bind.governanceRevision,
      idempotencyKey: 'release-idem-1',
      ...(overrides.release || {}),
    },
  };
}

describe('CP2I-HQA-01 authorization-to-persistence binding', () => {
  it('HQA01-P01 exact-match bind yields offline contract without dispatch', async () => {
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h);
    chainHolder.current = chain;
    const client = createFakeOwnedTxnClient();
    const persistenceInput = validBindPersistenceInput();
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(client, {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE',
      resourceKey: 'resource-cp2i-1',
      leaseKey: 'lease-cp2i-1',
      persistenceInput,
    });
    assert.equal(out.ok, true);
    assert.equal(out.decision, CP2_I_DECISIONS.OFFLINE_CONTRACT_ONLY);
    assert.equal(out.operationalDispatch, false);
    assert.equal(out.mutationAttempted, false);
    assert.equal(client.queryLog.length, 0);
    assert.equal(out.lifecycle, undefined);
  });

  it('HQA01-N01 capability Task A cannot bind persistence Task B', async () => {
    let bindCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      bindTaskClaimLeaseWithAudit: async () => {
        bindCalls += 1;
        return { ok: true, decision: 'BOUND_WITH_AUDIT' };
      },
    });
    const chain = mintChain(h);
    chainHolder.current = chain;
    const client = createFakeOwnedTxnClient();
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(client, {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE',
      resourceKey: 'resource-cp2i-1',
      leaseKey: 'lease-cp2i-1',
      persistenceInput: validBindPersistenceInput({ bind: { taskId: 'task-OTHER' } }),
    });
    assert.equal(out.ok, false);
    assert.match(String(out.decision), /TASK|BINDING|PERSISTENCE|MISMATCH|DENY/);
    assert.equal(out.mutationAttempted, false);
    assert.equal(bindCalls, 0);
    assert.equal(client.queryLog.length, 0);
  });

  it('HQA01-N02 authorized Actor A cannot bind as Actor B', async () => {
    let bindCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      bindTaskClaimLeaseWithAudit: async () => {
        bindCalls += 1;
        return { ok: true, decision: 'BOUND_WITH_AUDIT' };
      },
    });
    const chain = mintChain(h);
    chainHolder.current = chain;
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(createFakeOwnedTxnClient(), {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE',
      resourceKey: 'resource-cp2i-1',
      leaseKey: 'lease-cp2i-1',
      persistenceInput: validBindPersistenceInput({ bind: { actorId: 'actor-OTHER' } }),
    });
    assert.equal(out.ok, false);
    assert.match(String(out.decision), /ACTOR|PRINCIPAL|BINDING|PERSISTENCE|MISMATCH|DENY/);
    assert.equal(out.mutationAttempted, false);
    assert.equal(bindCalls, 0);
  });

  it('HQA01-N03 authorized BIND rejects persistenceInput shaped as RELEASE', async () => {
    let bindCalls = 0;
    let releaseCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      bindTaskClaimLeaseWithAudit: async () => {
        bindCalls += 1;
        return { ok: true, decision: 'BOUND_WITH_AUDIT' };
      },
      releaseTaskClaimLeaseWithAudit: async () => {
        releaseCalls += 1;
        return { ok: true, decision: 'RELEASED_WITH_AUDIT' };
      },
    });
    const chain = mintChain(h);
    chainHolder.current = chain;
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(createFakeOwnedTxnClient(), {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE',
      resourceKey: 'resource-cp2i-1',
      leaseKey: 'lease-cp2i-1',
      persistenceInput: validReleasePersistenceInput(),
    });
    assert.equal(out.ok, false);
    assert.match(String(out.decision), /ACTION|BINDING|PERSISTENCE|MISMATCH|DENY/);
    assert.equal(out.mutationAttempted, false);
    assert.equal(bindCalls, 0);
    assert.equal(releaseCalls, 0);
  });

  it('HQA01-N04 audit task mismatch DENY without mutation', async () => {
    let bindCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      bindTaskClaimLeaseWithAudit: async () => {
        bindCalls += 1;
        return { ok: true, decision: 'BOUND_WITH_AUDIT' };
      },
    });
    const chain = mintChain(h);
    chainHolder.current = chain;
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(createFakeOwnedTxnClient(), {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE',
      resourceKey: 'resource-cp2i-1',
      leaseKey: 'lease-cp2i-1',
      persistenceInput: validBindPersistenceInput({ audit: { taskId: 'task-AUDIT-OTHER' } }),
    });
    assert.equal(out.ok, false);
    assert.match(String(out.decision), /AUDIT|TASK|BINDING|PERSISTENCE|MISMATCH|DENY/);
    assert.equal(out.mutationAttempted, false);
    assert.equal(bindCalls, 0);
  });

  it('HQA01-N05 audit actor mismatch DENY without mutation', async () => {
    let bindCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      bindTaskClaimLeaseWithAudit: async () => {
        bindCalls += 1;
        return { ok: true, decision: 'BOUND_WITH_AUDIT' };
      },
    });
    const chain = mintChain(h);
    chainHolder.current = chain;
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(createFakeOwnedTxnClient(), {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE',
      resourceKey: 'resource-cp2i-1',
      leaseKey: 'lease-cp2i-1',
      persistenceInput: validBindPersistenceInput({ audit: { actorId: 'actor-AUDIT-OTHER' } }),
    });
    assert.equal(out.ok, false);
    assert.equal(out.mutationAttempted, false);
    assert.equal(bindCalls, 0);
  });

  it('HQA01-N06 evidence task/actor mismatch DENY without mutation', async () => {
    let bindCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      bindTaskClaimLeaseWithAudit: async () => {
        bindCalls += 1;
        return { ok: true, decision: 'BOUND_WITH_AUDIT' };
      },
    });
    const chain = mintChain(h);
    chainHolder.current = chain;
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(createFakeOwnedTxnClient(), {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE',
      resourceKey: 'resource-cp2i-1',
      leaseKey: 'lease-cp2i-1',
      persistenceInput: validBindPersistenceInput({
        evidence: { taskId: 'task-EV-OTHER', actorId: WORKER_ID },
      }),
    });
    assert.equal(out.ok, false);
    assert.equal(out.mutationAttempted, false);
    assert.equal(bindCalls, 0);
  });

  it('HQA01-N07 missing claim/lease binding evidence DENY without mutation', async () => {
    let bindCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      bindTaskClaimLeaseWithAudit: async () => {
        bindCalls += 1;
        return { ok: true, decision: 'BOUND_WITH_AUDIT' };
      },
    });
    const chain = mintChain(h);
    chainHolder.current = chain;
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(createFakeOwnedTxnClient(), {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      // intentionally omit resourceType/resourceKey/leaseKey on request
      persistenceInput: validBindPersistenceInput(),
    });
    assert.equal(out.ok, false);
    assert.match(String(out.decision), /CLAIM|LEASE|BINDING|MISSING|DENY/);
    assert.equal(out.mutationAttempted, false);
    assert.equal(bindCalls, 0);
  });

  it('HQA01-N08 claim/lease identity mismatch DENY without mutation', async () => {
    let bindCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      bindTaskClaimLeaseWithAudit: async () => {
        bindCalls += 1;
        return { ok: true, decision: 'BOUND_WITH_AUDIT' };
      },
    });
    const chain = mintChain(h);
    chainHolder.current = chain;
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(createFakeOwnedTxnClient(), {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE',
      resourceKey: 'resource-cp2i-1',
      leaseKey: 'lease-cp2i-1',
      persistenceInput: validBindPersistenceInput({
        bind: { leaseKey: 'lease-OTHER', resourceKey: 'resource-OTHER' },
      }),
    });
    assert.equal(out.ok, false);
    assert.equal(out.mutationAttempted, false);
    assert.equal(bindCalls, 0);
  });

  it('HQA01-N09 release path: Task mismatch DENY without mutation', async () => {
    let releaseCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      releaseTaskClaimLeaseWithAudit: async () => {
        releaseCalls += 1;
        return { ok: true, decision: 'RELEASED_WITH_AUDIT' };
      },
    });
    const chain = mintChain(h, {
      action: CP2_I_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT,
    });
    chainHolder.current = chain;
    const out = await gate.releaseOperationalTaskClaimLeaseWithAudit(createFakeOwnedTxnClient(), {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE',
      resourceKey: 'resource-cp2i-1',
      leaseKey: 'lease-cp2i-1',
      persistenceInput: validReleasePersistenceInput({
        release: { taskId: 'task-OTHER' },
      }),
    });
    assert.equal(out.ok, false);
    assert.equal(out.mutationAttempted, false);
    assert.equal(releaseCalls, 0);
  });

  it('HQA01-N10 release path: authorized RELEASE rejects bind-shaped persistenceInput', async () => {
    let bindCalls = 0;
    let releaseCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      bindTaskClaimLeaseWithAudit: async () => {
        bindCalls += 1;
        return { ok: true, decision: 'BOUND_WITH_AUDIT' };
      },
      releaseTaskClaimLeaseWithAudit: async () => {
        releaseCalls += 1;
        return { ok: true, decision: 'RELEASED_WITH_AUDIT' };
      },
    });
    const chain = mintChain(h, {
      action: CP2_I_ACTIONS.RELEASE_TASK_CLAIM_LEASE_WITH_AUDIT,
    });
    chainHolder.current = chain;
    const out = await gate.releaseOperationalTaskClaimLeaseWithAudit(createFakeOwnedTxnClient(), {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE',
      resourceKey: 'resource-cp2i-1',
      leaseKey: 'lease-cp2i-1',
      persistenceInput: validBindPersistenceInput(),
    });
    assert.equal(out.ok, false);
    assert.equal(out.mutationAttempted, false);
    assert.equal(bindCalls, 0);
    assert.equal(releaseCalls, 0);
  });
});

/**
 * CP2I-HQA-02 Option B: non-dispatch offline contract.
 * Valid authorization must never invoke mutation ports, client.query, or work callbacks.
 */
describe('CP2I-HQA-02 Option B non-dispatch offline contract', () => {
  it('HQA02-RED01 default DLP path must not invoke client.query after valid authz', async () => {
    const h = fullTrustHarness();
    // No persistence override → original default wires frozen DLP-004 ports.
    const { gate, chainHolder } = createGate(h, {});
    const chain = mintChain(h);
    chainHolder.current = chain;
    let queryCalls = 0;
    const client = {
      async query(sql) {
        queryCalls += 1;
        // Minimal idle-probe / txn shape so default DLP can progress far enough to prove dispatch.
        const text = typeof sql === 'string' ? sql : String(sql?.text || sql);
        if (text.startsWith('SAVEPOINT')) {
          const err = new Error('idle');
          err.code = '25P01';
          throw err;
        }
        return { rows: [], rowCount: 0 };
      },
    };
    let threw = false;
    let out;
    try {
      out = await gate.bindOperationalTaskClaimLeaseWithAudit(client, {
        actorId: WORKER_ID,
        taskId: TASK_ID,
        resourcePaths: [...SCOPE],
        capabilityToken: chain.cap.token,
        resourceType: 'OPS_PILOT_RESOURCE',
        resourceKey: 'resource-cp2i-1',
        leaseKey: 'lease-cp2i-1',
        persistenceInput: validBindPersistenceInput(),
      });
    } catch {
      threw = true;
    }
    // Future Option B: zero query dispatch regardless of throw/result.
    assert.equal(queryCalls, 0);
    if (!threw && out) {
      assert.equal(out.mutationAttempted, false);
      assert.equal(out.operationalDispatch, false);
    }
  });

  it('HQA02-RED02 constructor-injected persistence port must not be invoked', async () => {
    let bindCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      bindTaskClaimLeaseWithAudit: async () => {
        bindCalls += 1;
        return { ok: true, decision: 'BOUND_WITH_AUDIT' };
      },
    });
    const chain = mintChain(h);
    chainHolder.current = chain;
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(createFakeOwnedTxnClient(), {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE',
      resourceKey: 'resource-cp2i-1',
      leaseKey: 'lease-cp2i-1',
      persistenceInput: validBindPersistenceInput(),
    });
    assert.equal(bindCalls, 0);
    assert.equal(out.mutationAttempted, false);
    assert.equal(out.operationalDispatch, false);
  });

  it('HQA02-RED03 live-compatible .query client must not be invoked', async () => {
    let queryCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      bindTaskClaimLeaseWithAudit: async (client) => {
        await client.query('SELECT 1');
        return { ok: true, decision: 'BOUND_WITH_AUDIT' };
      },
    });
    const chain = mintChain(h);
    chainHolder.current = chain;
    const client = {
      async query() {
        queryCalls += 1;
        return { rows: [] };
      },
    };
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(client, {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE',
      resourceKey: 'resource-cp2i-1',
      leaseKey: 'lease-cp2i-1',
      persistenceInput: validBindPersistenceInput(),
    });
    assert.equal(queryCalls, 0);
    assert.equal(out.mutationAttempted, false);
    assert.equal(out.operationalDispatch, false);
  });

  it('HQA02-RED04 executeAuthorizedOwnedWork must not invoke caller work callback', async () => {
    let workCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h);
    chainHolder.current = chain;
    const authz = gate.authorizeOperationalMutation({
      actorId: WORKER_ID,
      taskId: TASK_ID,
      action: CP2_I_ACTIONS.BIND_TASK_CLAIM_LEASE_WITH_AUDIT,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
    });
    assert.equal(authz.ok, true);
    const out = await gate.executeAuthorizedOwnedWork(
      createFakeOwnedTxnClient(),
      authz,
      async () => {
        workCalls += 1;
        return { ok: true, decision: 'WORK_RAN' };
      },
    );
    assert.equal(workCalls, 0);
    assert.equal(out.ok, false);
    assert.match(String(out.decision), /OFFLINE|NON_DISPATCH|DENY|WORK|CALLBACK|OPERATIONAL/);
  });

  it('HQA02-RED05 runtime operational enablement toggle absent (static)', async () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/operationalTaskLeaseAuditRepository.js'),
      'utf8',
    );
    // Record absence of request/env upgrade toggles; do not fabricate failure.
    assert.equal(src.includes('authorizeOperationalDispatch'), false);
    assert.equal(src.includes('enableOperationalPersistence'), false);
    assert.equal(src.includes('TITANGOLD_TECP_OPS_CP2_DB'), false);
    assert.equal('NOT_APPLICABLE_ALREADY_ABSENT', 'NOT_APPLICABLE_ALREADY_ABSENT');
  });

  it('HQA02-P01 valid offline contract returns OFFLINE_CONTRACT_ONLY without dispatch', async () => {
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h);
    const chain = mintChain(h);
    chainHolder.current = chain;
    assert.equal(gate.dispatchMode, 'OFFLINE_CONTRACT_NON_DISPATCH');
    const client = createFakeOwnedTxnClient();
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(client, {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE',
      resourceKey: 'resource-cp2i-1',
      leaseKey: 'lease-cp2i-1',
      persistenceInput: validBindPersistenceInput(),
    });
    assert.equal(out.decision, CP2_I_DECISIONS.OFFLINE_CONTRACT_ONLY);
    assert.equal(out.operationalDispatch, false);
    assert.equal(out.mutationAttempted, false);
    assert.equal(client.queryLog.length, 0);
  });

  it('HQA02-N01 self-consistent unauthorized resource tuple cannot trigger mutation', async () => {
    let bindCalls = 0;
    const h = fullTrustHarness();
    const { gate, chainHolder } = createGate(h, {
      bindTaskClaimLeaseWithAudit: async () => {
        bindCalls += 1;
        return { ok: true };
      },
    });
    const chain = mintChain(h);
    chainHolder.current = chain;
    const out = await gate.bindOperationalTaskClaimLeaseWithAudit(createFakeOwnedTxnClient(), {
      actorId: WORKER_ID,
      taskId: TASK_ID,
      resourcePaths: [...SCOPE],
      capabilityToken: chain.cap.token,
      resourceType: 'OPS_PILOT_RESOURCE_OTHER',
      resourceKey: 'resource-OTHER',
      leaseKey: 'lease-OTHER',
      persistenceInput: validBindPersistenceInput({
        bind: {
          resourceType: 'OPS_PILOT_RESOURCE_OTHER',
          resourceKey: 'resource-OTHER',
          leaseKey: 'lease-OTHER',
        },
      }),
    });
    assert.equal(bindCalls, 0);
    assert.equal(out.mutationAttempted, false);
    assert.equal(out.operationalDispatch, false);
    // Constructor injection DENY after HQA-01 consistency passes, or offline-only if no injection.
    assert.ok(
      out.decision === CP2_I_DECISIONS.DENY_CONSTRUCTOR_PERSISTENCE_INJECTION
      || out.decision === CP2_I_DECISIONS.OFFLINE_CONTRACT_ONLY,
    );
  });

  it('HQA02-S01 source no longer imports DLP bind/release executors for dispatch', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/operationalTaskLeaseAuditRepository.js'),
      'utf8',
    );
    assert.equal(/import\s*\{[^}]*\bbindTaskClaimLeaseWithAudit\b/.test(src), false);
    assert.equal(/import\s*\{[^}]*\breleaseTaskClaimLeaseWithAudit\b/.test(src), false);
    assert.equal(src.includes('writeLeaseRepository.js'), false);
    assert.equal(/from\s+['\"][^'\"]*writeLeaseRepository/.test(src), false);
    assert.equal(src.includes('OFFLINE_CONTRACT_NON_DISPATCH'), true);
    assert.equal(src.includes('dispatchMode'), true);
  });
});
