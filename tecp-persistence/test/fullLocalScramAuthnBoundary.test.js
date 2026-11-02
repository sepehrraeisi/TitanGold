/**
 * TECP-DLP-009 full-local SCRAM authentication proof.
 *
 * REAL disposable PostgreSQL 14 only; no production, remote DB, Worker or MCP.
 * Post-cutover fresh local LOGIN authentication only; not same-UID isolation,
 * stolen-secret protection, in-process JS containment or production R1 sealing.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';

import {
  APPROVED_GOVERNANCE_REVISION as DLP006_REV,
  createTrustedAuthorizationPolicy,
  createTrustedAuthorizationPolicyProvider,
} from '../../tecp/src/authorizedInvocation.js';
import {
  BOOTSTRAP_ALLOWED_ACTIONS,
  CAPABILITY_ACTIONS,
  CAPABILITY_STAGES,
  createInjectedClock,
  createInMemoryIssuerKeyRegistry,
  createInMemoryRevocationRegistry,
  generateEphemeralEd25519KeyPair,
  issueCapability,
} from '../../tecp/src/workerCapabilityToken.js';
import {
  ATTESTATION_KINDS,
  createTestOnlyAttestationVerifier,
  verifyWorkerPrincipal,
} from '../../tecp/src/workerIdentity.js';
import { OPERATION_PHASES } from '../src/authenticatedTaskClaimLeaseAuditAdapter.js';
import {
  APPROVED_GOVERNANCE_REVISION as DLP008_REV,
  SEALED_GATEWAY_KIND,
  createSealedAuthenticatedWriteGateway,
} from '../src/sealedAuthenticatedWriteGateway.js';
import {
  DLP009_LOGIN_ROLES,
  DLP009_WRITER_ROLE,
  DLP009_RESTRICTED_ROLE,
  createDisposableFullLocalScramProof,
} from './disposableFullLocalScramCutover.js';

const AUDIENCE = 'tecp-dlp009-disposable-scram';
const RESOURCE_TYPE = 'task_worktree';
const PROTECTED = Object.freeze([
  'dlp_task', 'dlp_task_claim', 'dlp_task_claim_composition_idempotency',
  'dlp_write_lease', 'dlp_write_acquire_idempotency', 'dlp_write_resource_fence',
  'dlp_audit_event', 'dlp_evidence_fact',
]);
let proof;

before(async () => {
  assert.equal(process.env.DATABASE_URL, undefined);
  proof = await createDisposableFullLocalScramProof();
});
after(async () => {
  if (proof) await proof.stop();
});

async function expectPrivilegeDeny(fn) {
  let error;
  try { await fn(); } catch (caught) { error = caught; }
  assert.equal(error?.code, '42501', 'restricted caller must receive real PostgreSQL SQLSTATE 42501');
}

test('post-cutover all six LOGIN roles are SCRAM-authenticated on fresh sessions', async () => {
  assert.deepEqual([...proof.roles].sort(), [...DLP009_LOGIN_ROLES].sort());
  assert.deepEqual(proof.isolation, { unixOnly: true, tcpRejected: true });
  assert.equal(proof.mode, 'NON_OPERATIONAL_DISPOSABLE_ONLY');
  assert.equal(proof.architecture, 'OPTION_B_REVISED_STAGED_SCRAM');
  for (const role of DLP009_LOGIN_ROLES) {
    const valid = await proof.probeLogin(role, 'valid');
    const wrong = await proof.probeLogin(role, 'wrong');
    const missing = await proof.probeLogin(role, 'missing');
    assert.equal(valid.result, 'AUTHENTICATED', role);
    assert.equal(wrong.result, 'SERVER_PASSWORD_REJECT', role);
    assert.ok(
      ['SERVER_PASSWORD_REJECT', 'CLIENT_MISSING_PASSWORD_REJECT'].includes(missing.result),
      'missing password must fail as authn, not as a transport timeout',
    );
  }
  assert.equal(await proof.assertNoLegacySessions(), true);
  assert.equal(await proof.assertTcpStillRejected(), true);
});

test('superuser/admin and alternate writers cannot be accessed without their credentials', async () => {
  for (const role of [
    'dlp_proof',
    DLP009_WRITER_ROLE,
    'dlp_composition_proof',
    'dlp_audit_owner',
    'dlp_audit_proof',
  ]) {
    const negative = await proof.probeLogin(role, 'wrong');
    assert.equal(negative.result, 'SERVER_PASSWORD_REJECT');
  }
  assert.equal(await proof.assertNoLegacySessions(), true);
});

test('restricted caller retains SQLSTATE 42501 for every protected table', async () => {
  const updateColumn = {
    dlp_task: 'status',
    dlp_task_claim: 'status',
    dlp_task_claim_composition_idempotency: 'decision',
    dlp_write_lease: 'status',
    dlp_write_acquire_idempotency: 'decision',
    dlp_write_resource_fence: 'fencing_epoch',
    dlp_audit_event: 'event_type',
    dlp_evidence_fact: 'evidence_type',
  };
  assert.deepEqual(Object.keys(updateColumn).sort(), [...PROTECTED].sort());
  await proof.withAuthenticatedClient(DLP009_RESTRICTED_ROLE, async (restricted) => {
    for (const table of PROTECTED) {
      const col = updateColumn[table];
      await expectPrivilegeDeny(
        () => restricted.query('UPDATE ' + table + ' SET ' + col + '=' + col + ' WHERE false'),
      );
      await expectPrivilegeDeny(
        () => restricted.query('DELETE FROM ' + table + ' WHERE false'),
      );
    }
    await expectPrivilegeDeny(() => restricted.query('SET ROLE ' + DLP009_WRITER_ROLE));
    const role = await restricted.query('SELECT current_user::text AS name');
    assert.equal(role.rows[0]?.name, DLP009_RESTRICTED_ROLE);
  });
  assert.equal(await proof.assertNoLegacySessions(), true);
  assert.equal(await proof.assertTcpStillRejected(), true);
});

test('authenticated writer may perform scoped DML, restricted caller cannot', async () => {
  await proof.withAuthenticatedClient(DLP009_WRITER_ROLE, async (writer) => {
    const grants = await writer.query(
      "SELECT has_table_privilege(current_user,'dlp_task','INSERT') AS writer_can_insert, " +
      "has_table_privilege(current_user,'dlp_audit_event','INSERT') AS writer_can_audit",
    );
    assert.equal(grants.rows[0]?.writer_can_insert, true);
    assert.equal(grants.rows[0]?.writer_can_audit, true);
    assert.equal(await proof.assertNoLegacySessions().then(() => false).catch(() => true), true,
      'a deliberately held privileged client must prevent clean-sessions attestation');
  });
  await proof.withAuthenticatedClient(DLP009_RESTRICTED_ROLE, async (restricted) => {
    const acl = await restricted.query(
      "SELECT has_table_privilege(current_user,'dlp_task','INSERT') AS insert_allowed",
    );
    assert.equal(acl.rows[0]?.insert_allowed, false);
  });
  assert.equal(await proof.assertNoLegacySessions(), true);
});

function principalFixture() {
  const attestation = {
    attestationKind: ATTESTATION_KINDS.TEST_ONLY,
    bootstrapIssuer: 'test-bootstrap-issuer-dlp009',
    principalId: 'worker-dlp009-disposable',
    principalGeneration: 1,
    attestedAt: 1_700_000_000_000,
  };
  const verifier = createTestOnlyAttestationVerifier();
  verifier.registerAccepted(attestation);
  const verified = verifyWorkerPrincipal(
    { attestation },
    { verifyAttestation: verifier.verifyAttestation },
  );
  assert.equal(verified.allowed, true);
  return verified.principal;
}

function capabilityFixture() {
  const keys = generateEphemeralEd25519KeyPair();
  const issuer = 'tecp-dlp009-scram-proof-issuer';
  const kid = 'kid-dlp009';
  const keyRegistry = createInMemoryIssuerKeyRegistry([{
    issuer,
    kid,
    algorithm: 'Ed25519',
    publicKeyPem: keys.publicKeyPem,
    privateKeyPem: keys.privateKeyPem,
    status: 'ACTIVE',
  }]);
  const revocationRegistry = createInMemoryRevocationRegistry();
  revocationRegistry.setCurrentRevocationGeneration(0);
  const clock = createInjectedClock(1_700_000_000_000);
  return { issuer, kid, deps: { keyRegistry, revocationRegistry, clock } };
}

function policyFor(taskId, resourceKey, phase, leaseId) {
  const isRelease = phase === 'release';
  return createTrustedAuthorizationPolicy({
    governanceRevision: DLP006_REV,
    audience: AUDIENCE,
    operations: [{
      operationKey: isRelease ? 'lease-release' : 'bootstrap-bind',
      capabilityStage: isRelease ? CAPABILITY_STAGES.LEASE_BOUND : CAPABILITY_STAGES.BOOTSTRAP_REQUEST,
      action: isRelease ? CAPABILITY_ACTIONS.RELEASE_TASK : CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE,
      taskId,
      resourceType: RESOURCE_TYPE,
      resourceId: resourceKey,
      ...(isRelease ? { leaseId } : {}),
    }],
  });
}

function issueFor(fixture, principal, taskId, resourceKey, phase, leaseId, fencingEpoch) {
  const release = phase === 'release';
  return issueCapability({
    principal,
    issuer: fixture.issuer,
    kid: fixture.kid,
    algorithm: 'Ed25519',
    audience: AUDIENCE,
    taskId,
    resourceType: RESOURCE_TYPE,
    resourceId: resourceKey,
    allowedActions: release ? [CAPABILITY_ACTIONS.RELEASE_TASK] : [...BOOTSTRAP_ALLOWED_ACTIONS],
    capabilityStage: release ? CAPABILITY_STAGES.LEASE_BOUND : CAPABILITY_STAGES.BOOTSTRAP_REQUEST,
    ...(release ? { leaseContext: { leaseId, fencingEpoch } } : {}),
    ttlMs: 60_000,
  }, fixture.deps);
}

test('frozen sealed gateway bind and release operate with SCRAM-authenticated writer session', async () => {
  await proof.withAuthenticatedClient(DLP009_WRITER_ROLE, async (writer) => {
    const taskId = 'task-dlp009-scram';
    const resourceKey = 'resource-dlp009-scram';
    const leaseKey = 'lease-dlp009-scram';
    const claimKey = 'claim-' + leaseKey;
    const identityResult = await writer.query(
      'SELECT session_user::text AS session_user, current_user::text AS current_user, ' +
      'pg_backend_pid()::int AS backend_pid',
    );
    const id = identityResult.rows[0];
    assert.equal(id.session_user, DLP009_WRITER_ROLE);
    const principal = principalFixture();
    const h = capabilityFixture();
    let policy = policyFor(taskId, resourceKey, 'bind');
    const policyProvider = createTrustedAuthorizationPolicyProvider(() => policy);
    const gateway = createSealedAuthenticatedWriteGateway({
      writerClient: writer,
      writerSessionAttestation: {
        sessionUser: id.session_user,
        currentUser: id.current_user,
        backendPid: Number(id.backend_pid),
      },
      getVerifiedPrincipal: () => principal,
      policyProvider,
      capabilityDeps: h.deps,
      operationContracts: {
        'bootstrap-bind': {
          phase: OPERATION_PHASES.BOOTSTRAP_BIND,
          claimKey,
          leaseKey,
          ttlMs: 30_000,
          auditEventType: 'TASK_BOUND_SEALED',
          includeEvidence: false,
        },
        'lease-release': {
          phase: OPERATION_PHASES.LEASE_BOUND_RELEASE,
          claimKey,
          auditEventType: 'TASK_RELEASED_SEALED',
          includeEvidence: false,
        },
      },
    });
    assert.equal(gateway.kind, SEALED_GATEWAY_KIND);
    assert.equal(gateway.governanceRevision, DLP008_REV);
    assert.equal(gateway.operational, false);
    assert.equal(gateway.writerClient, undefined);

    const bindCapability = issueFor(h, principal, taskId, resourceKey, 'bind');
    assert.equal(bindCapability.allowed, true);
    const bindResult = await gateway.executeSealedBind({
      capabilityToken: bindCapability.token,
      operationKey: 'bootstrap-bind',
      idempotency: {
        compositionIdempotencyKey: 'comp-dlp009-bind',
        leaseIdempotencyKey: 'lease-idem-dlp009-bind',
        auditIdempotencyKey: 'audit-dlp009-bind',
        auditEventId: 'evt-dlp009-bind',
        evidenceIdempotencyKey: 'evd-idem-dlp009-bind',
        evidenceId: 'evd-dlp009-bind',
      },
    });
    assert.equal(bindResult.ok, true, 'authenticated gateway bind must succeed');
    assert.equal(bindResult.sealed, true);
    assert.equal(bindResult.writerClient, undefined);
    const lease = await writer.query(
      'SELECT fencing_epoch::int AS epoch FROM dlp_write_lease WHERE lease_key=$1 AND status=$2',
      [leaseKey, 'ACTIVE'],
    );
    assert.equal(lease.rows.length, 1);
    policy = policyFor(taskId, resourceKey, 'release', leaseKey);
    const releaseCapability = issueFor(
      h, principal, taskId, resourceKey, 'release', leaseKey, lease.rows[0].epoch,
    );
    assert.equal(releaseCapability.allowed, true);
    const releaseResult = await gateway.executeSealedRelease({
      capabilityToken: releaseCapability.token,
      operationKey: 'lease-release',
      idempotency: {
        auditIdempotencyKey: 'audit-dlp009-release',
        auditEventId: 'evt-dlp009-release',
        evidenceIdempotencyKey: 'evd-idem-dlp009-release',
        evidenceId: 'evd-dlp009-release',
      },
    });
    assert.equal(releaseResult.ok, true, 'authenticated gateway release must succeed');
    const released = await writer.query(
      "SELECT count(*)::int AS n FROM dlp_write_lease WHERE lease_key=$1 AND status='RELEASED'",
      [leaseKey],
    );
    assert.equal(released.rows[0].n, 1);
  });
  assert.equal(await proof.assertNoLegacySessions(), true);
});

test('malformed, interrupted bootstrap and partial HBA cutover fail closed and clean cluster', async () => {
  for (const failAt of ['AFTER_BOOTSTRAP', 'AFTER_HBA_SWAP', 'AFTER_RELOAD']) {
    let temporaryRoot;
    await assert.rejects(
      () => createDisposableFullLocalScramProof({
        failAt,
        onHarnessCreated: ({ root }) => { temporaryRoot = root; },
      }),
      /BLOCKED: DLP009_/,
    );
    assert.ok(temporaryRoot, 'failpoint must reach disposable harness creation');
    assert.equal(existsSync(temporaryRoot), false, 'disposable cluster must be removed after failure');
  }
  assert.equal(await proof.assertNoLegacySessions(), true);
});

test('no credential, client or raw SQL is exposed by the sealed proof public surface', () => {
  assert.deepEqual(Object.keys(proof).sort(), [
    'architecture', 'assertNoLegacySessions', 'assertTcpStillRejected', 'isolation', 'mode',
    'probeLogin', 'roles', 'stop', 'withAuthenticatedClient',
  ].sort());
  const publicJson = JSON.stringify(proof);
  assert.equal(publicJson.includes('password'), false);
  assert.equal(publicJson.includes('SCRAM-SHA-256$'), false);
  assert.equal(publicJson.includes('privateKeyPem'), false);
  assert.equal(publicJson.includes('postgres://'), false);
});
