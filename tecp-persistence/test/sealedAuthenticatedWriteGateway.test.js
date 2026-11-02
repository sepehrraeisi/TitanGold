/**
 * TECP-DLP-008 D1 disposable hybrid sealed-write tests.
 * NON_OPERATIONAL proof. Local ephemeral PostgreSQL only.
 *
 * R1_RESTRICTED_CALLER_DIRECT_DML_BYPASS = SEALED_IN_DISPOSABLE_PROOF_ONLY (when green)
 * R1_PRIVILEGED_WRITER_BYPASS = RETAINED_TRUST_ROOT / NOT_SEALED
 * R1_PRODUCTION_SEALING = NOT_PROVEN
 * LOCAL_SOCKET_TRUST_ROLE_IMPERSONATION = NOT_SEALED / TEST_ONLY_RESIDUAL
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import pg from 'pg';

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
import {
  APPROVED_GOVERNANCE_REVISION as DLP003_REV,
  appendAuditEventInTransaction,
  appendEvidenceInTransaction,
} from '../src/auditEvidenceRepository.js';
import {
  APPROVED_GOVERNANCE_REVISION as DLP002_REV,
  bindTaskClaimLease,
  releaseTaskClaimLease,
  bindTaskClaimLeaseInTransaction,
} from '../src/taskClaimLeaseRepository.js';
import {
  APPROVED_GOVERNANCE_REVISION as DLP004_REV,
  bindTaskClaimLeaseWithAudit,
  releaseTaskClaimLeaseWithAudit,
} from '../src/taskClaimLeaseAuditRepository.js';
import {
  APPROVED_GOVERNANCE_REVISION as DLP001_REV,
  WRITE_LEASE_DECISIONS,
  acquireWriteLease,
  renewWriteLease,
  releaseWriteLease,
  withOwnedWriteLeaseTransaction,
} from '../src/writeLeaseRepository.js';
import {
  AUTH_COMPOSITION_DECISIONS,
  OPERATION_PHASES,
} from '../src/authenticatedTaskClaimLeaseAuditAdapter.js';
import {
  APPROVED_GOVERNANCE_REVISION as DLP008_REV,
  FORBIDDEN_REQUEST_FIELDS,
  SEALED_GATEWAY_DECISIONS,
  SEALED_GATEWAY_KIND,
  attestWriterSession,
  createSealedAuthenticatedWriteGateway,
} from '../src/sealedAuthenticatedWriteGateway.js';
import { createDisposablePgHarness } from './disposablePgHarness.js';

const { Client } = pg;
const here = dirname(fileURLToPath(import.meta.url));
const taskClaimSchemaSql = readFileSync(join(here, 'disposableTaskClaimLeaseSchema.sql'), 'utf8');
const auditSchemaSql = readFileSync(join(here, 'disposableAuditEvidenceSchema.sql'), 'utf8');
const authzSchemaSql = readFileSync(join(here, 'disposableAuthenticatedCompositionSchema.sql'), 'utf8');
const sealedSchemaSql = readFileSync(join(here, 'disposableSealedWriteSchema.sql'), 'utf8');
const gatewaySrc = readFileSync(join(here, '../src/sealedAuthenticatedWriteGateway.js'), 'utf8');

const AUDIENCE = 'tecp-dlp008-proof';
const RESOURCE_TYPE = 'task_worktree';
const WRITER_ROLE = 'dlp_authz_composition_proof';
const RESTRICTED_ROLE = 'dlp_sealed_restricted_caller';
const PROTECTED_TABLES = Object.freeze([
  'dlp_task',
  'dlp_task_claim',
  'dlp_task_claim_composition_idempotency',
  'dlp_write_lease',
  'dlp_write_acquire_idempotency',
  'dlp_write_resource_fence',
  'dlp_audit_event',
  'dlp_evidence_fact',
]);

let harness;
let isolationEvidence;

async function applyAllSchemas() {
  const client = await harness.createClient();
  try {
    await client.query(taskClaimSchemaSql);
    await client.query(auditSchemaSql);
    await client.query(authzSchemaSql);
    await client.query(sealedSchemaSql);
  } finally {
    await client.end();
  }
}

function createWriterClient() {
  return new Client({
    host: harness.socketDir,
    port: harness.socketPort,
    user: WRITER_ROLE,
    database: 'dlp_proof',
  });
}

function createRestrictedClient() {
  return new Client({
    host: harness.socketDir,
    port: harness.socketPort,
    user: RESTRICTED_ROLE,
    database: 'dlp_proof',
  });
}

async function sessionIdentity(client) {
  const r = await client.query(
    `SELECT session_user::text AS session_user,
            current_user::text AS current_user,
            pg_backend_pid()::int AS backend_pid`,
  );
  return {
    sessionUser: r.rows[0].session_user,
    currentUser: r.rows[0].current_user,
    backendPid: Number(r.rows[0].backend_pid),
  };
}

async function privilegeMatrix(client, roleName) {
  const out = {};
  for (const table of PROTECTED_TABLES) {
    const r = await client.query(
      `SELECT
         has_table_privilege($1, $2, 'SELECT') AS sel,
         has_table_privilege($1, $2, 'INSERT') AS ins,
         has_table_privilege($1, $2, 'UPDATE') AS upd,
         has_table_privilege($1, $2, 'DELETE') AS del,
         has_table_privilege($1, $2, 'TRUNCATE') AS trunc,
         has_table_privilege($1, $2, 'REFERENCES') AS refs,
         has_table_privilege($1, $2, 'TRIGGER') AS trg`,
      [roleName, table],
    );
    out[table] = r.rows[0];
  }
  return out;
}

/** Authoritative DB privilege denial: SQLSTATE 42501 only. */
function assertSqlstate42501(err, context = '') {
  assert.ok(err, `expected error ${context}`);
  assert.equal(
    err.code,
    '42501',
    `expected SQLSTATE 42501 ${context}, got code=${err && err.code} message=${err && err.message}`,
  );
}

async function expectSqlstate42501(fn, context = '') {
  let caught;
  try {
    await fn();
  } catch (err) {
    caught = err;
  }
  assertSqlstate42501(caught, context);
}

function assertApplicationDenyOnly(out, context = '') {
  assert.ok(out && typeof out === 'object', `expected result object ${context}`);
  assert.notEqual(out.ok, true, `must not succeed ${context}`);
  assert.equal(typeof out.decision, 'string', `missing decision ${context}`);
  assert.match(String(out.decision), /^DENY_/, `expected DENY_* decision ${context}, got ${out.decision}`);
}

function assertAuthzDeny(out, expectedDecision, context = '') {
  assert.equal(out.ok, false, `ok must be false ${context}`);
  assert.equal(out.decision, expectedDecision, `decision ${context}`);
}

function assertNoSensitiveLeak(value) {
  const json = JSON.stringify(value, (_k, v) => {
    if (typeof v === 'function') return '[Function]';
    if (v && typeof v === 'object' && typeof v.query === 'function') return '[Client]';
    return v;
  });
  assert.equal(json.includes('CANARY_SECRET'), false);
  assert.equal(json.includes('CANARY_PASSWORD'), false);
  assert.equal(json.includes('privateKeyPem'), false);
  assert.equal(json.includes('postgres://'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(value, 'stack'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(value, 'cause'), false);
  assert.equal(value.writerClient, undefined);
  assert.equal(value.client, undefined);
}

before(async () => {
  assert.equal(process.env.DATABASE_URL, undefined, 'DATABASE_URL must be unset');
  harness = createDisposablePgHarness();
  isolationEvidence = await harness.proveIsolation();
  assert.equal(isolationEvidence.listenAddresses, '');
  assert.equal(isolationEvidence.tcpRejected, true);
  await harness.createProofDatabase();
  await applyAllSchemas();
});

after(async () => {
  if (harness) await harness.stop();
});

function attestedPrincipal(principalId = 'worker-dlp008-a', generation = 1) {
  const attestation = {
    attestationKind: ATTESTATION_KINDS.TEST_ONLY,
    bootstrapIssuer: 'test-bootstrap-issuer-dlp008',
    principalId,
    principalGeneration: generation,
    attestedAt: 1_700_000_000_000,
  };
  const verifier = createTestOnlyAttestationVerifier();
  verifier.registerAccepted(attestation);
  const result = verifyWorkerPrincipal(
    { attestation },
    { verifyAttestation: verifier.verifyAttestation },
  );
  assert.equal(result.allowed, true);
  return result.principal;
}

function capabilityHarness(options = {}) {
  const keys = options.keys || generateEphemeralEd25519KeyPair();
  const issuer = options.issuer || 'tecp-dlp008-issuer';
  const kid = options.kid || 'kid-dlp008';
  const keyRegistry = createInMemoryIssuerKeyRegistry([
    {
      issuer,
      kid,
      algorithm: 'Ed25519',
      publicKeyPem: keys.publicKeyPem,
      privateKeyPem: keys.privateKeyPem,
      status: options.keyStatus || 'ACTIVE',
    },
  ]);
  const revocationRegistry = createInMemoryRevocationRegistry();
  revocationRegistry.setCurrentRevocationGeneration(options.revocationGeneration ?? 0);
  const clock = createInjectedClock(options.nowMs ?? 1_700_000_000_000);
  return {
    keys,
    issuer,
    kid,
    keyRegistry,
    revocationRegistry,
    clock,
    deps: { keyRegistry, revocationRegistry, clock },
  };
}

function bootstrapPolicy(taskId, resourceKey, overrides = {}) {
  return createTrustedAuthorizationPolicy({
    governanceRevision: DLP006_REV,
    audience: AUDIENCE,
    operations: [
      {
        operationKey: 'bootstrap-bind',
        capabilityStage: CAPABILITY_STAGES.BOOTSTRAP_REQUEST,
        action: CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE,
        taskId,
        resourceType: RESOURCE_TYPE,
        resourceId: resourceKey,
      },
      ...(overrides.extraOperations || []),
    ],
  });
}

function releasePolicy(taskId, resourceKey, leaseId, overrides = {}) {
  return createTrustedAuthorizationPolicy({
    governanceRevision: DLP006_REV,
    audience: AUDIENCE,
    operations: [
      {
        operationKey: 'lease-release',
        capabilityStage: CAPABILITY_STAGES.LEASE_BOUND,
        action: CAPABILITY_ACTIONS.RELEASE_TASK,
        taskId,
        resourceType: RESOURCE_TYPE,
        resourceId: resourceKey,
        leaseId,
      },
      ...(overrides.extraOperations || []),
    ],
  });
}

function issueBootstrap(h, principal, taskId, resourceKey, overrides = {}) {
  return issueCapability(
    {
      principal,
      issuer: h.issuer,
      kid: h.kid,
      algorithm: 'Ed25519',
      audience: AUDIENCE,
      taskId,
      resourceType: RESOURCE_TYPE,
      resourceId: resourceKey,
      allowedActions: [...BOOTSTRAP_ALLOWED_ACTIONS],
      capabilityStage: CAPABILITY_STAGES.BOOTSTRAP_REQUEST,
      ttlMs: 60_000,
      ...overrides,
    },
    h.deps,
  );
}

function issueLeaseBound(h, principal, taskId, resourceKey, leaseId, fencingEpoch, overrides = {}) {
  return issueCapability(
    {
      principal,
      issuer: h.issuer,
      kid: h.kid,
      algorithm: 'Ed25519',
      audience: AUDIENCE,
      taskId,
      resourceType: RESOURCE_TYPE,
      resourceId: resourceKey,
      allowedActions: [CAPABILITY_ACTIONS.RELEASE_TASK],
      capabilityStage: CAPABILITY_STAGES.LEASE_BOUND,
      leaseContext: { leaseId, fencingEpoch },
      ttlMs: 60_000,
      ...overrides,
    },
    h.deps,
  );
}

function bindContract(leaseKey, extras = {}) {
  return {
    phase: OPERATION_PHASES.BOOTSTRAP_BIND,
    claimKey: extras.claimKey || `claim-${leaseKey}`,
    leaseKey,
    ttlMs: extras.ttlMs || 30_000,
    auditEventType: 'TASK_BOUND_SEALED',
    includeEvidence: extras.includeEvidence === true,
    evidenceType: extras.evidenceType || 'TEST_LOG',
    evidenceRef: extras.evidenceRef || 'sha256:dlp008',
  };
}

function releaseContract(claimKey, extras = {}) {
  return {
    phase: OPERATION_PHASES.LEASE_BOUND_RELEASE,
    claimKey,
    auditEventType: 'TASK_RELEASED_SEALED',
    includeEvidence: extras.includeEvidence === true,
    evidenceType: extras.evidenceType || 'TEST_LOG',
    evidenceRef: extras.evidenceRef || 'sha256:dlp008-rel',
  };
}

function bindIdem(suffix) {
  return {
    compositionIdempotencyKey: `comp-${suffix}`,
    leaseIdempotencyKey: `lease-idem-${suffix}`,
    auditIdempotencyKey: `audit-${suffix}`,
    auditEventId: `evt-${suffix}`,
    evidenceIdempotencyKey: `evd-idem-${suffix}`,
    evidenceId: `evd-${suffix}`,
  };
}

function releaseIdem(suffix) {
  return {
    auditIdempotencyKey: `audit-rel-${suffix}`,
    auditEventId: `evt-rel-${suffix}`,
    evidenceIdempotencyKey: `evd-rel-idem-${suffix}`,
    evidenceId: `evd-rel-${suffix}`,
  };
}

async function countRows(client, table, whereSql = '', params = []) {
  const r = await client.query(`SELECT count(*)::int AS n FROM ${table} ${whereSql}`, params);
  return r.rows[0].n;
}

async function createGateway(writerClient, options = {}) {
  const identity = options.sessionIdentity || await sessionIdentity(writerClient);
  const principal = options.principal || attestedPrincipal(options.principalId);
  const h = options.capabilityHarness || capabilityHarness(options);
  let policy = options.policy;
  const policyProvider = options.policyProvider
    || createTrustedAuthorizationPolicyProvider(
      typeof options.policyFactory === 'function'
        ? options.policyFactory
        : () => policy,
    );
  if (options.setPolicy) options.setPolicy((next) => { policy = next; });
  const operationContracts = options.operationContracts || {
    'bootstrap-bind': bindContract(options.leaseKey || 'lease-seal-1', options.bindExtras),
    'lease-release': releaseContract(
      options.claimKey || `claim-${options.leaseKey || 'lease-seal-1'}`,
      options.releaseExtras,
    ),
  };
  const gateway = createSealedAuthenticatedWriteGateway({
    writerClient,
    writerSessionAttestation: {
      sessionUser: identity.sessionUser,
      currentUser: identity.currentUser,
      backendPid: identity.backendPid,
    },
    getVerifiedPrincipal: options.getVerifiedPrincipal || (() => principal),
    policyProvider,
    capabilityDeps: options.capabilityDeps || h.deps,
    operationContracts,
  });
  return {
    gateway,
    principal,
    h,
    identity,
    setPolicy: (p) => { policy = p; },
    getPolicy: () => policy,
  };
}

test('isolation: disposable PG unix-socket only; DATABASE_URL unset', () => {
  assert.equal(process.env.DATABASE_URL, undefined);
  assert.equal(isolationEvidence.listenAddresses, '');
  assert.equal(isolationEvidence.tcpRejected, true);
});

test('dual independent PostgreSQL sessions: distinct PIDs and authorities', async () => {
  const writer = createWriterClient();
  const restricted = createRestrictedClient();
  await writer.connect();
  await restricted.connect();
  try {
    const w = await sessionIdentity(writer);
    const r = await sessionIdentity(restricted);
    assert.equal(w.sessionUser, WRITER_ROLE);
    assert.equal(w.currentUser, WRITER_ROLE);
    assert.equal(r.sessionUser, RESTRICTED_ROLE);
    assert.equal(r.currentUser, RESTRICTED_ROLE);
    assert.notEqual(w.backendPid, r.backendPid);

    const wPriv = await privilegeMatrix(writer, WRITER_ROLE);
    const rPriv = await privilegeMatrix(restricted, RESTRICTED_ROLE);
    const publicPriv = await privilegeMatrix(restricted, 'public');
    for (const table of PROTECTED_TABLES) {
      assert.equal(rPriv[table].ins, false, `${table} INSERT`);
      assert.equal(rPriv[table].upd, false, `${table} UPDATE`);
      assert.equal(rPriv[table].del, false, `${table} DELETE`);
      assert.equal(rPriv[table].trunc, false, `${table} TRUNCATE`);
      assert.equal(rPriv[table].refs, false, `${table} REFERENCES`);
      assert.equal(rPriv[table].trg, false, `${table} TRIGGER`);
      assert.equal(rPriv[table].sel, true, `${table} SELECT`);
      assert.equal(publicPriv[table].ins, false, `PUBLIC ${table} INSERT`);
      assert.equal(publicPriv[table].upd, false, `PUBLIC ${table} UPDATE`);
      assert.equal(publicPriv[table].del, false, `PUBLIC ${table} DELETE`);
      assert.equal(publicPriv[table].trunc, false, `PUBLIC ${table} TRUNCATE`);
      assert.equal(publicPriv[table].refs, false, `PUBLIC ${table} REFERENCES`);
      assert.equal(publicPriv[table].trg, false, `PUBLIC ${table} TRIGGER`);
    }
    assert.equal(wPriv.dlp_task.ins, true);
    assert.equal(wPriv.dlp_write_lease.upd, true);
    assert.equal(wPriv.dlp_audit_event.ins, true);
    assert.equal(wPriv.dlp_audit_event.upd, false);

    const mem = await restricted.query(
      `SELECT COUNT(*)::int AS n
         FROM pg_auth_members m
         JOIN pg_roles r ON r.oid = m.roleid
        WHERE m.member = (SELECT oid FROM pg_roles WHERE rolname = $1)
          AND r.rolname IN ($2, 'dlp_composition_proof', 'dlp_audit_owner', 'dlp_audit_proof', 'dlp_proof')`,
      [RESTRICTED_ROLE, WRITER_ROLE],
    );
    assert.equal(mem.rows[0].n, 0);
  } finally {
    await writer.end();
    await restricted.end();
  }
});

test('restricted caller: raw SQL INSERT/UPDATE/DELETE DENY with SQLSTATE 42501 on all protected tables', async () => {
  const client = createRestrictedClient();
  await client.connect();
  try {
    const insertProbes = {
      dlp_task: `INSERT INTO dlp_task (task_id, actor_id, governance_revision, status, resource_type, resource_key, claim_key, composition_idempotency_key)
                 VALUES ('t-raw-all','a','${DLP002_REV}','READY','task_worktree','rk','c','comp-raw')`,
      dlp_task_claim: `INSERT INTO dlp_task_claim (task_id, resource_type, resource_key, actor_id, claim_key, access_mode, status, governance_revision)
                       VALUES ('t-raw-all','task_worktree','rk','a','c','WRITE','HELD','${DLP002_REV}')`,
      dlp_task_claim_composition_idempotency: `INSERT INTO dlp_task_claim_composition_idempotency
        (composition_idempotency_key, task_id, actor_id, resource_type, resource_key, claim_key, lease_key, governance_revision, fencing_epoch, lease_version, decision)
        VALUES ('comp-raw','t-raw-all','a','task_worktree','rk','c','lk', '${DLP002_REV}',1,1,'BOUND')`,
      dlp_write_lease: `INSERT INTO dlp_write_lease
        (resource_type, resource_key, lease_key, actor_id, task_id, governance_revision, fencing_epoch, version, status, expires_at)
        VALUES ('task_worktree','rk-raw','lk-raw','a','t-raw-all','${DLP001_REV}',1,1,'ACTIVE', clock_timestamp() + interval '1 hour')`,
      dlp_write_acquire_idempotency: `INSERT INTO dlp_write_acquire_idempotency
        (idempotency_key, resource_type, resource_key, actor_id, task_id, governance_revision, lease_key, fencing_epoch, version, decision, expires_at)
        VALUES ('acq-raw','task_worktree','rk-raw','a','t-raw-all','${DLP001_REV}','lk-raw',1,1,'ACQUIRED', clock_timestamp() + interval '1 hour')`,
      dlp_write_resource_fence: `INSERT INTO dlp_write_resource_fence (resource_type, resource_key, fencing_epoch)
                                 VALUES ('task_worktree','rk-raw',1)`,
      dlp_audit_event: `INSERT INTO dlp_audit_event (event_id, task_id, actor_id, event_type, governance_revision, idempotency_key)
                        VALUES ('evt-raw','t-raw-all','a','BYPASS','${DLP003_REV}','audit-raw')`,
      dlp_evidence_fact: `INSERT INTO dlp_evidence_fact (evidence_id, task_id, actor_id, evidence_type, evidence_ref, governance_revision, idempotency_key)
                          VALUES ('evd-raw','t-raw-all','a','TEST_LOG','sha256:x','${DLP003_REV}','evd-raw')`,
    };
    const updateProbes = {
      dlp_task: `UPDATE dlp_task SET status = status WHERE false`,
      dlp_task_claim: `UPDATE dlp_task_claim SET status = status WHERE false`,
      dlp_task_claim_composition_idempotency: `UPDATE dlp_task_claim_composition_idempotency SET decision = decision WHERE false`,
      dlp_write_lease: `UPDATE dlp_write_lease SET status = status WHERE false`,
      dlp_write_acquire_idempotency: `UPDATE dlp_write_acquire_idempotency SET decision = decision WHERE false`,
      dlp_write_resource_fence: `UPDATE dlp_write_resource_fence SET fencing_epoch = fencing_epoch WHERE false`,
      dlp_audit_event: `UPDATE dlp_audit_event SET event_type = event_type WHERE false`,
      dlp_evidence_fact: `UPDATE dlp_evidence_fact SET evidence_type = evidence_type WHERE false`,
    };

    assert.deepEqual(Object.keys(insertProbes).sort(), [...PROTECTED_TABLES].sort());
    assert.deepEqual(Object.keys(updateProbes).sort(), [...PROTECTED_TABLES].sort());

    for (const table of PROTECTED_TABLES) {
      await expectSqlstate42501(() => client.query(insertProbes[table]), `INSERT ${table}`);
      await expectSqlstate42501(() => client.query(updateProbes[table]), `UPDATE ${table}`);
      await expectSqlstate42501(() => client.query(`DELETE FROM ${table} WHERE false`), `DELETE ${table}`);
    }

    assert.equal(await countRows(client, 'dlp_task', `WHERE task_id = 't-raw-all'`), 0);
    assert.equal(await countRows(client, 'dlp_audit_event', `WHERE event_id = 'evt-raw'`), 0);
    assert.equal(await countRows(client, 'dlp_evidence_fact', `WHERE evidence_id = 'evd-raw'`), 0);
  } finally {
    await client.end();
  }
});

test('restricted caller: SET ROLE to writer DENY; no writer membership', async () => {
  const client = createRestrictedClient();
  await client.connect();
  try {
    await expectSqlstate42501(
      () => client.query(`SET ROLE ${WRITER_ROLE}`),
      'SET ROLE writer',
    );
    const id = await sessionIdentity(client);
    assert.equal(id.currentUser, RESTRICTED_ROLE);
  } finally {
    await client.end();
  }
});

test('restricted caller: direct DLP-001 acquire/renew/release cannot mutate', async () => {
  const writer = createWriterClient();
  const client = createRestrictedClient();
  await writer.connect();
  await client.connect();
  try {
    const seeded = await acquireWriteLease(writer, {
      actorId: 'actor-seed-001',
      resourceType: RESOURCE_TYPE,
      resourceKey: 'res-dlp001-seed',
      taskId: 'task-dlp001-seed',
      leaseKey: 'lease-dlp001-seed',
      governanceRevision: DLP001_REV,
      idempotencyKey: 'idem-dlp001-seed',
      ttlMs: 30_000,
    });
    assert.equal(seeded.ok, true);

    const input = {
      actorId: 'actor-r1',
      resourceType: RESOURCE_TYPE,
      resourceKey: 'res-dlp001-bypass',
      taskId: 'task-dlp001-bypass',
      leaseKey: 'lease-dlp001-bypass',
      governanceRevision: DLP001_REV,
      idempotencyKey: 'idem-dlp001-bypass',
      ttlMs: 30_000,
    };

    // DATABASE_PRIVILEGE_DENY: acquire reaches INSERT and must fail with 42501.
    await expectSqlstate42501(() => acquireWriteLease(client, input), 'DLP-001 acquire');

    // APPLICATION_DENY_ONLY or 42501 for renew/release against seeded lease as foreign/restricted.
    const renewInput = {
      actorId: 'actor-seed-001',
      resourceType: RESOURCE_TYPE,
      resourceKey: 'res-dlp001-seed',
      leaseKey: 'lease-dlp001-seed',
      governanceRevision: DLP001_REV,
      expectedVersion: seeded.lease?.version ?? 1,
      fencingEpoch: seeded.lease?.fencingEpoch ?? 1,
      idempotencyKey: 'idem-dlp001-renew-r',
      ttlMs: 30_000,
    };
    try {
      const renewOut = await renewWriteLease(client, renewInput);
      assertApplicationDenyOnly(renewOut, 'DLP-001 renew APPLICATION_DENY_ONLY');
    } catch (err) {
      assertSqlstate42501(err, 'DLP-001 renew DATABASE_PRIVILEGE_DENY');
    }

    try {
      const releaseOut = await releaseWriteLease(client, {
        ...renewInput,
        idempotencyKey: 'idem-dlp001-release-r',
      });
      assertApplicationDenyOnly(releaseOut, 'DLP-001 release APPLICATION_DENY_ONLY');
    } catch (err) {
      assertSqlstate42501(err, 'DLP-001 release DATABASE_PRIVILEGE_DENY');
    }

    assert.equal(
      await countRows(client, 'dlp_write_lease', `WHERE resource_key = 'res-dlp001-bypass'`),
      0,
    );
    assert.equal(
      await countRows(writer, 'dlp_write_lease', `WHERE resource_key = 'res-dlp001-seed' AND status = 'ACTIVE'`),
      1,
    );
    void WRITE_LEASE_DECISIONS;
  } finally {
    await client.end();
    await writer.end();
  }
});

test('restricted caller: direct DLP-002 bind/release cannot mutate', async () => {
  const client = createRestrictedClient();
  await client.connect();
  try {
    const input = {
      taskId: 'task-dlp002-bypass',
      actorId: 'actor-r2',
      resourceType: RESOURCE_TYPE,
      resourceKey: 'res-dlp002-bypass',
      claimKey: 'claim-dlp002-bypass',
      leaseKey: 'lease-dlp002-bypass',
      governanceRevision: DLP002_REV,
      compositionIdempotencyKey: 'comp-dlp002-bypass',
      leaseIdempotencyKey: 'lease-idem-dlp002-bypass',
      ttlMs: 30_000,
    };
    try {
      const out = await bindTaskClaimLease(client, input);
      assertApplicationDenyOnly(out, 'DLP-002 bind APPLICATION_DENY_ONLY');
    } catch (error) {
      assertSqlstate42501(error, 'DLP-002 bind DATABASE_PRIVILEGE_DENY');
    }
    assert.equal(await countRows(client, 'dlp_task', `WHERE task_id = 'task-dlp002-bypass'`), 0);

    try {
      const rel = await releaseTaskClaimLease(client, {
        ...input,
        fencingEpoch: 1,
        expectedVersion: 1,
      });
      assertApplicationDenyOnly(rel, 'DLP-002 release APPLICATION_DENY_ONLY');
    } catch (error) {
      assertSqlstate42501(error, 'DLP-002 release DATABASE_PRIVILEGE_DENY');
    }
    assert.equal(await countRows(client, 'dlp_task', `WHERE task_id = 'task-dlp002-bypass'`), 0);
  } finally {
    await client.end();
  }
});

test('restricted caller: direct DLP-003 Audit/Evidence append cannot mutate', async () => {
  const client = createRestrictedClient();
  await client.connect();
  try {
    // Independent DB privilege proof (not txn-ownership DENY alone).
    await expectSqlstate42501(
      () => client.query(
        `INSERT INTO dlp_audit_event (event_id, task_id, actor_id, event_type, governance_revision, idempotency_key)
         VALUES ('evt-dlp003-sql','task-dlp003-bypass','actor-r3','BYPASS','${DLP003_REV}','audit-sql-dlp003')`,
      ),
      'DLP-003 raw audit INSERT',
    );
    await expectSqlstate42501(
      () => client.query(
        `INSERT INTO dlp_evidence_fact (evidence_id, task_id, actor_id, evidence_type, evidence_ref, governance_revision, idempotency_key)
         VALUES ('evd-dlp003-sql','task-dlp003-bypass','actor-r3','TEST_LOG','sha256:bypass','${DLP003_REV}','evd-sql-dlp003')`,
      ),
      'DLP-003 raw evidence INSERT',
    );

    // Repository path: may be APPLICATION_DENY_ONLY (txn ownership) before privilege — classify explicitly.
    try {
      await withOwnedWriteLeaseTransaction(client, async () => {
        await appendAuditEventInTransaction(client, {
          eventId: 'evt-dlp003-bypass',
          taskId: 'task-dlp003-bypass',
          actorId: 'actor-r3',
          eventType: 'BYPASS',
          governanceRevision: DLP003_REV,
          idempotencyKey: 'audit-idem-dlp003-bypass',
        });
      });
      assert.fail('DLP-003 audit path must not succeed');
    } catch (err) {
      const appDeny = err && (
        err.code === WRITE_LEASE_DECISIONS.DENY_NO_TRANSACTION_OWNERSHIP
        || err.code === WRITE_LEASE_DECISIONS.DENY_CLIENT_NOT_IDLE
        || /DENY_NO_TRANSACTION_OWNERSHIP|DENY_CLIENT_NOT_IDLE|permission denied/i.test(String(err.message || ''))
      );
      if (err && err.code === '42501') {
        assertSqlstate42501(err, 'DLP-003 audit DATABASE_PRIVILEGE_DENY');
      } else {
        assert.ok(appDeny, `DLP-003 audit APPLICATION_DENY_ONLY or 42501, got ${err && err.code} ${err && err.message}`);
      }
    }
    assert.equal(await countRows(client, 'dlp_audit_event', `WHERE event_id = 'evt-dlp003-bypass'`), 0);
    assert.equal(await countRows(client, 'dlp_audit_event', `WHERE event_id = 'evt-dlp003-sql'`), 0);
    assert.equal(await countRows(client, 'dlp_evidence_fact', `WHERE evidence_id = 'evd-dlp003-sql'`), 0);
  } finally {
    await client.end();
  }
});

test('restricted caller: direct DLP-004 composition cannot mutate', async () => {
  const client = createRestrictedClient();
  await client.connect();
  try {
    try {
      const out = await bindTaskClaimLeaseWithAudit(client, {
        bind: {
          taskId: 'task-dlp004-bypass',
          actorId: 'actor-r4',
          resourceType: RESOURCE_TYPE,
          resourceKey: 'res-dlp004-bypass',
          claimKey: 'claim-dlp004-bypass',
          leaseKey: 'lease-dlp004-bypass',
          governanceRevision: DLP002_REV,
          compositionIdempotencyKey: 'comp-dlp004-bypass',
          leaseIdempotencyKey: 'lease-idem-dlp004-bypass',
          ttlMs: 30_000,
        },
        audit: {
          eventId: 'evt-dlp004-bypass',
          taskId: 'task-dlp004-bypass',
          actorId: 'actor-r4',
          eventType: 'BYPASS',
          governanceRevision: DLP003_REV,
          idempotencyKey: 'audit-idem-dlp004-bypass',
        },
      });
      assertApplicationDenyOnly(out, 'DLP-004 bind APPLICATION_DENY_ONLY');
    } catch (error) {
      assertSqlstate42501(error, 'DLP-004 bind DATABASE_PRIVILEGE_DENY');
    }
    assert.equal(await countRows(client, 'dlp_task', `WHERE task_id = 'task-dlp004-bypass'`), 0);
    assert.equal(await countRows(client, 'dlp_audit_event', `WHERE event_id = 'evt-dlp004-bypass'`), 0);
    void DLP004_REV;
  } finally {
    await client.end();
  }
});

test('authorized gateway BOOTSTRAP bind + LEASE_BOUND release succeed on writer session', async () => {
  const writer = createWriterClient();
  const restricted = createRestrictedClient();
  await writer.connect();
  await restricted.connect();
  try {
    const wId = await sessionIdentity(writer);
    const rId = await sessionIdentity(restricted);
    assert.notEqual(wId.backendPid, rId.backendPid);

    const taskId = 'task-seal-ok';
    const resourceKey = 'res-seal-ok';
    const leaseKey = 'lease-seal-ok';
    let currentPolicy = bootstrapPolicy(taskId, resourceKey);
    const { gateway, principal, h, setPolicy } = await createGateway(writer, {
      sessionIdentity: wId,
      policyFactory: () => currentPolicy,
      leaseKey,
      bindExtras: { includeEvidence: true },
      operationContracts: {
        'bootstrap-bind': bindContract(leaseKey, { includeEvidence: true }),
        'lease-release': releaseContract(`claim-${leaseKey}`, { includeEvidence: true }),
      },
    });
    setPolicy((p) => { currentPolicy = p; });

    const issued = issueBootstrap(h, principal, taskId, resourceKey);
    assert.equal(issued.allowed, true);
    const bindOut = await gateway.executeSealedBind({
      capabilityToken: issued.token,
      operationKey: 'bootstrap-bind',
      idempotency: bindIdem('seal-ok'),
    });
    assert.equal(bindOut.ok, true);
    assert.equal(bindOut.sealed, true);
    assert.equal(bindOut.kind, SEALED_GATEWAY_KIND);
    assert.equal(bindOut.governanceRevision, DLP008_REV);
    assert.equal(Object.prototype.hasOwnProperty.call(bindOut, 'writerClient'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(gateway, 'writerClient'), false);
    assert.equal(typeof gateway.executeSealedBind, 'function');
    assert.equal(gateway.writerClient, undefined);

    assert.equal(await countRows(writer, 'dlp_task', 'WHERE task_id = $1', [taskId]), 1);
    assert.equal(await countRows(writer, 'dlp_write_lease', `WHERE lease_key = $1 AND status = 'ACTIVE'`, [leaseKey]), 1);
    assert.equal(await countRows(writer, 'dlp_audit_event', 'WHERE event_id = $1', ['evt-seal-ok']), 1);

    const lease = await writer.query(
      `SELECT fencing_epoch::int AS fencing_epoch FROM dlp_write_lease WHERE lease_key = $1`,
      [leaseKey],
    );
    const fencingEpoch = lease.rows[0].fencing_epoch;
    currentPolicy = releasePolicy(taskId, resourceKey, leaseKey);
    const issuedRel = issueLeaseBound(h, principal, taskId, resourceKey, leaseKey, fencingEpoch);
    assert.equal(issuedRel.allowed, true);
    const relOut = await gateway.executeSealedRelease({
      capabilityToken: issuedRel.token,
      operationKey: 'lease-release',
      idempotency: releaseIdem('seal-ok'),
    });
    assert.equal(relOut.ok, true);
    assert.equal(await countRows(writer, 'dlp_write_lease', `WHERE lease_key = $1 AND status = 'RELEASED'`, [leaseKey]), 1);
    assert.equal(await countRows(writer, 'dlp_audit_event', 'WHERE event_id = $1', ['evt-rel-seal-ok']), 1);
  } finally {
    await writer.end();
    await restricted.end();
  }
});

test('gateway dependency injection / forbidden fields DENY; no privileged leak', async () => {
  const writer = createWriterClient();
  await writer.connect();
  try {
    const { gateway, h, principal } = await createGateway(writer, {
      leaseKey: 'lease-inject',
      policy: bootstrapPolicy('task-inject', 'res-inject'),
      operationContracts: { 'bootstrap-bind': bindContract('lease-inject') },
    });
    const issued = issueBootstrap(h, principal, 'task-inject', 'res-inject');
    for (const field of ['client', 'writerClient', 'sql', 'policyProvider', 'capabilityDeps', 'getVerifiedPrincipal']) {
      const out = await gateway.executeSealedBind({
        capabilityToken: issued.token,
        operationKey: 'bootstrap-bind',
        idempotency: bindIdem(`inj-${field}`),
        [field]: writer,
      });
      assert.equal(out.ok, false, field);
      assert.ok(
        out.decision === SEALED_GATEWAY_DECISIONS.DENY_UNTRUSTED_REQUEST_FIELD
        || (out.reasons || []).some((r) => String(r).includes('FORBIDDEN')),
      );
      assert.equal(JSON.stringify(out).includes('privateKeyPem'), false);
    }
    assert.ok(FORBIDDEN_REQUEST_FIELDS.includes('writerClient'));
    assert.ok(FORBIDDEN_REQUEST_FIELDS.includes('sql'));
  } finally {
    await writer.end();
  }
});

test('foreign actor / forged principal / expired / revoked / wrong scope DENY', async () => {
  const writer = createWriterClient();
  await writer.connect();
  try {
    const taskId = 'task-deny-matrix';
    const resourceKey = 'res-deny-matrix';
    const leaseKey = 'lease-deny-matrix';
    const principal = attestedPrincipal('worker-ok');
    const foreign = attestedPrincipal('worker-foreign');
    const h = capabilityHarness();

    async function assertNoDurable(suffix) {
      assert.equal(await countRows(writer, 'dlp_task', `WHERE task_id LIKE $1`, [`%${suffix}%`]), 0);
      assert.equal(await countRows(writer, 'dlp_audit_event', `WHERE event_id LIKE $1`, [`%${suffix}%`]), 0);
      assert.equal(await countRows(writer, 'dlp_evidence_fact', `WHERE evidence_id LIKE $1`, [`%${suffix}%`]), 0);
    }

    // Foreign actor token against gateway principal
    {
      const { gateway } = await createGateway(writer, {
        principal,
        capabilityHarness: h,
        policy: bootstrapPolicy(taskId, resourceKey),
        leaseKey,
        operationContracts: { 'bootstrap-bind': bindContract(leaseKey) },
      });
      const issued = issueBootstrap(h, foreign, taskId, resourceKey);
      const out = await gateway.executeSealedBind({
        capabilityToken: issued.token,
        operationKey: 'bootstrap-bind',
        idempotency: bindIdem('foreign'),
      });
      assertAuthzDeny(out, AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION, 'foreign');
      assertNoSensitiveLeak(out);
      assert.equal(await countRows(writer, 'dlp_task', `WHERE task_id = $1`, [taskId]), 0);
    }

    // Expired capability
    {
      const { gateway } = await createGateway(writer, {
        principal,
        capabilityHarness: h,
        policy: bootstrapPolicy(taskId, `${resourceKey}-exp`),
        leaseKey: `${leaseKey}-exp`,
        operationContracts: { 'bootstrap-bind': bindContract(`${leaseKey}-exp`) },
      });
      const issued = issueBootstrap(h, principal, taskId, `${resourceKey}-exp`, { ttlMs: 1 });
      h.clock.advance(10_000);
      const out = await gateway.executeSealedBind({
        capabilityToken: issued.token,
        operationKey: 'bootstrap-bind',
        idempotency: bindIdem('expired'),
      });
      assertAuthzDeny(out, AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION, 'expired');
      assert.equal(await countRows(writer, 'dlp_task', `WHERE task_id = $1`, [taskId]), 0);
      h.clock.set(1_700_000_000_000);
    }

    // Revoked capability
    {
      const h2 = capabilityHarness({ revocationGeneration: 0 });
      const { gateway } = await createGateway(writer, {
        principal,
        capabilityHarness: h2,
        policy: bootstrapPolicy(taskId, `${resourceKey}-rev`),
        leaseKey: `${leaseKey}-rev`,
        operationContracts: { 'bootstrap-bind': bindContract(`${leaseKey}-rev`) },
      });
      const issued = issueBootstrap(h2, principal, taskId, `${resourceKey}-rev`);
      h2.revocationRegistry.revokeJti(issued.claims.jti);
      const out = await gateway.executeSealedBind({
        capabilityToken: issued.token,
        operationKey: 'bootstrap-bind',
        idempotency: bindIdem('revoked'),
      });
      assertAuthzDeny(out, AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION, 'revoked');
      assert.equal(await countRows(writer, 'dlp_task', `WHERE task_id = $1`, [taskId]), 0);
    }

    // Wrong resource scope
    {
      const { gateway } = await createGateway(writer, {
        principal,
        capabilityHarness: h,
        policy: bootstrapPolicy(taskId, 'res-expected'),
        leaseKey: `${leaseKey}-scope`,
        operationContracts: { 'bootstrap-bind': bindContract(`${leaseKey}-scope`) },
      });
      const issued = issueBootstrap(h, principal, taskId, 'res-other');
      const out = await gateway.executeSealedBind({
        capabilityToken: issued.token,
        operationKey: 'bootstrap-bind',
        idempotency: bindIdem('scope'),
      });
      assertAuthzDeny(out, AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION, 'wrong-scope');
      assert.equal(await countRows(writer, 'dlp_task', `WHERE task_id = $1`, [taskId]), 0);
    }

    // Unverified / forged principal
    {
      const { gateway } = await createGateway(writer, {
        getVerifiedPrincipal: () => ({ principalId: 'not-attested', attestationKind: 'FORGED' }),
        capabilityHarness: h,
        policy: bootstrapPolicy(taskId, `${resourceKey}-forge`),
        leaseKey: `${leaseKey}-forge`,
        operationContracts: { 'bootstrap-bind': bindContract(`${leaseKey}-forge`) },
      });
      const issued = issueBootstrap(h, principal, taskId, `${resourceKey}-forge`);
      const out = await gateway.executeSealedBind({
        capabilityToken: issued.token,
        operationKey: 'bootstrap-bind',
        idempotency: bindIdem('forge'),
      });
      assert.equal(out.ok, false, 'forged');
      assert.ok(
        [
          AUTH_COMPOSITION_DECISIONS.DENY_INVALID_PRINCIPAL,
          AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION,
        ].includes(out.decision),
        `forged decision=${out.decision}`,
      );
      assertNoSensitiveLeak(out);
      assert.equal(await countRows(writer, 'dlp_task', `WHERE task_id = $1`, [taskId]), 0);
    }
    await assertNoDurable('deny-matrix');
  } finally {
    await writer.end();
  }
});

test('stale fencing DENY on release; idempotent replay bounded; conflict safe', async () => {
  const writer = createWriterClient();
  await writer.connect();
  try {
    const taskId = 'task-fence';
    const resourceKey = 'res-fence';
    const leaseKey = 'lease-fence';
    let currentPolicy = bootstrapPolicy(taskId, resourceKey);
    const { gateway, principal, h, setPolicy } = await createGateway(writer, {
      policyFactory: () => currentPolicy,
      leaseKey,
      operationContracts: {
        'bootstrap-bind': bindContract(leaseKey),
        'lease-release': releaseContract(`claim-${leaseKey}`),
      },
    });
    setPolicy((p) => { currentPolicy = p; });
    const issued = issueBootstrap(h, principal, taskId, resourceKey);
    const bind1 = await gateway.executeSealedBind({
      capabilityToken: issued.token,
      operationKey: 'bootstrap-bind',
      idempotency: bindIdem('fence'),
    });
    assert.equal(bind1.ok, true);
    const bindReplay = await gateway.executeSealedBind({
      capabilityToken: issued.token,
      operationKey: 'bootstrap-bind',
      idempotency: bindIdem('fence'),
    });
    assert.equal(bindReplay.ok, true);
    assert.equal(await countRows(writer, 'dlp_write_lease', `WHERE lease_key = $1`, [leaseKey]), 1);

    const conflict = await gateway.executeSealedBind({
      capabilityToken: issued.token,
      operationKey: 'bootstrap-bind',
      idempotency: {
        ...bindIdem('fence-conflict'),
        compositionIdempotencyKey: 'comp-fence',
      },
    });
    assert.equal(conflict.ok, false);
    assert.ok(
      [
        AUTH_COMPOSITION_DECISIONS.DENY_IDEMPOTENCY_CONFLICT,
        AUTH_COMPOSITION_DECISIONS.DENY_BIND,
        AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION,
      ].includes(conflict.decision),
      `conflict decision=${conflict.decision}`,
    );

    const lease = await writer.query(
      `SELECT fencing_epoch::int AS fencing_epoch FROM dlp_write_lease WHERE lease_key = $1`,
      [leaseKey],
    );
    currentPolicy = releasePolicy(taskId, resourceKey, leaseKey);
    const stale = issueLeaseBound(h, principal, taskId, resourceKey, leaseKey, lease.rows[0].fencing_epoch + 5);
    const staleOut = await gateway.executeSealedRelease({
      capabilityToken: stale.token,
      operationKey: 'lease-release',
      idempotency: releaseIdem('stale'),
    });
    assert.equal(staleOut.ok, false);
    assert.ok(
      [
        AUTH_COMPOSITION_DECISIONS.DENY_AUTHORIZATION,
        AUTH_COMPOSITION_DECISIONS.DENY_STALE_FENCING_EPOCH,
        AUTH_COMPOSITION_DECISIONS.DENY_LEASE_VALIDATION,
      ].includes(staleOut.decision),
      `stale decision=${staleOut.decision}`,
    );
    assert.equal(await countRows(writer, 'dlp_write_lease', `WHERE lease_key = $1 AND status = 'ACTIVE'`, [leaseKey]), 1);
  } finally {
    await writer.end();
  }
});

test('two-client and 10+ contention: exactly one owner via sealed gateway', async () => {
  const clients = [];
  const many = [];
  try {
    for (let i = 0; i < 2; i += 1) {
      const c = createWriterClient();
      await c.connect();
      clients.push(c);
    }
    const taskId = 'task-race2';
    const resourceKey = 'res-race2';
    const leaseKey = 'lease-race2';
    const results = await Promise.all(clients.map(async (client, idx) => {
      const principal = attestedPrincipal(`worker-race2-${idx}`);
      const h = capabilityHarness();
      const { gateway } = await createGateway(client, {
        principal,
        capabilityHarness: h,
        policy: bootstrapPolicy(taskId, resourceKey),
        leaseKey,
        operationContracts: { 'bootstrap-bind': bindContract(leaseKey) },
      });
      const issued = issueBootstrap(h, principal, taskId, resourceKey);
      return gateway.executeSealedBind({
        capabilityToken: issued.token,
        operationKey: 'bootstrap-bind',
        idempotency: bindIdem(`race2-${idx}`),
      });
    }));
    const wins = results.filter((r) => r.ok === true);
    assert.equal(wins.length, 1);
    const reader = clients[0];
    assert.equal(await countRows(reader, 'dlp_write_lease', `WHERE resource_key = $1 AND status = 'ACTIVE'`, [resourceKey]), 1);

    for (let i = 0; i < 10; i += 1) {
      const c = createWriterClient();
      await c.connect();
      many.push(c);
    }
    const taskId10 = 'task-race10';
    const resourceKey10 = 'res-race10';
    const leaseKey10 = 'lease-race10';
    const manyResults = await Promise.all(many.map(async (client, idx) => {
      const principal = attestedPrincipal(`worker-race10-${idx}`);
      const h = capabilityHarness();
      const { gateway } = await createGateway(client, {
        principal,
        capabilityHarness: h,
        policy: bootstrapPolicy(taskId10, resourceKey10),
        leaseKey: leaseKey10,
        operationContracts: { 'bootstrap-bind': bindContract(leaseKey10) },
      });
      const issued = issueBootstrap(h, principal, taskId10, resourceKey10);
      return gateway.executeSealedBind({
        capabilityToken: issued.token,
        operationKey: 'bootstrap-bind',
        idempotency: bindIdem(`race10-${idx}`),
      });
    }));
    assert.equal(manyResults.filter((r) => r.ok === true).length, 1);
    assert.equal(await countRows(many[0], 'dlp_write_lease', `WHERE resource_key = $1 AND status = 'ACTIVE'`, [resourceKey10]), 1);
  } finally {
    for (const c of many) {
      try { await c.end(); } catch { /* ignore */ }
    }
    for (const c of clients) {
      try { await c.end(); } catch { /* ignore */ }
    }
  }
});

/**
 * SIMULATED_40P01_FAIL_CLOSED — monkeypatched SQLSTATE 40P01.
 * REAL_POSTGRES_DEADLOCK = NOT_PROVEN
 * DEADLOCK_COVERAGE = PARTIAL / ACCEPTANCE_PENDING_OWNER
 */
test('SIMULATED_40P01_FAIL_CLOSED without false rollbackConfirmed', async () => {
  const writer = createWriterClient();
  await writer.connect();
  const originalQuery = writer.query.bind(writer);
  try {
    const taskId = 'task-deadlock';
    const resourceKey = 'res-deadlock';
    const leaseKey = 'lease-deadlock';
    const principal = attestedPrincipal('worker-deadlock');
    const h = capabilityHarness();
    const { gateway } = await createGateway(writer, {
      principal,
      capabilityHarness: h,
      policy: bootstrapPolicy(taskId, resourceKey),
      leaseKey,
      operationContracts: { 'bootstrap-bind': bindContract(leaseKey) },
    });

    let armed = true;
    writer.query = async (text, params) => {
      if (armed && typeof text === 'string' && /INSERT INTO dlp_write_lease/i.test(text)) {
        armed = false;
        const err = new Error('deadlock detected');
        err.code = '40P01';
        throw err;
      }
      return originalQuery(text, params);
    };

    const issued = issueBootstrap(h, principal, taskId, resourceKey);
    const out = await gateway.executeSealedBind({
      capabilityToken: issued.token,
      operationKey: 'bootstrap-bind',
      idempotency: bindIdem('deadlock'),
    });
    assert.equal(out.ok, false);
    assert.equal(out.rollbackConfirmed, false);
    assert.notEqual(out.rolledBack, true);
    assert.ok(
      [
        AUTH_COMPOSITION_DECISIONS.DENY_DEADLOCK,
        SEALED_GATEWAY_DECISIONS.DENY_UNEXPECTED_EXECUTION,
      ].includes(out.decision),
      `simulated 40P01 decision=${out.decision}`,
    );
    assertNoSensitiveLeak(out);
    assert.equal(await countRows(writer, 'dlp_task', 'WHERE task_id = $1', [taskId]), 0);
    assert.equal(await countRows(writer, 'dlp_audit_event', 'WHERE event_id = $1', ['evt-deadlock']), 0);
  } finally {
    writer.query = originalQuery;
    await writer.end();
  }
});

test('unexpected inner exception sanitizes to DENY_UNEXPECTED_EXECUTION without secret leak', async () => {
  const writer = createWriterClient();
  await writer.connect();
  const originalQuery = writer.query.bind(writer);
  try {
    const taskId = 'task-canary';
    const resourceKey = 'res-canary';
    const leaseKey = 'lease-canary';
    const principal = attestedPrincipal('worker-canary');
    const h = capabilityHarness();
    const { gateway } = await createGateway(writer, {
      principal,
      capabilityHarness: h,
      policy: bootstrapPolicy(taskId, resourceKey),
      leaseKey,
      operationContracts: { 'bootstrap-bind': bindContract(leaseKey) },
    });

    let armed = true;
    writer.query = async (text, params) => {
      if (armed && typeof text === 'string' && /INSERT INTO dlp_task/i.test(text)) {
        armed = false;
        const cause = new Error('nested');
        cause.privateKeyPem = 'CANARY_SECRET_PEM';
        cause.sql = 'SELECT CANARY_SECRET FROM dual';
        const err = new Error('CANARY_SECRET boom');
        err.password = 'CANARY_PASSWORD';
        err.connectionString = 'postgres://writer:CANARY_PASSWORD@socket/dlp_proof';
        err.client = writer;
        err.cause = cause;
        err.stack = 'Error: CANARY_SECRET\n    at canary';
        throw err;
      }
      return originalQuery(text, params);
    };

    const issued = issueBootstrap(h, principal, taskId, resourceKey);
    const out = await gateway.executeSealedBind({
      capabilityToken: issued.token,
      operationKey: 'bootstrap-bind',
      idempotency: bindIdem('canary'),
    });
    assert.equal(out.ok, false);
    assert.equal(
      out.decision,
      SEALED_GATEWAY_DECISIONS.DENY_UNEXPECTED_EXECUTION,
      `expected unexpected-execution DENY, got ${out.decision}`,
    );
    assert.equal(out.rollbackConfirmed, false);
    assert.equal(out.rollbackStatus, 'UNKNOWN');
    assertNoSensitiveLeak(out);
    assert.equal(JSON.stringify(out).includes('CANARY_SECRET'), false);
    assert.equal(JSON.stringify(out).includes('CANARY_PASSWORD'), false);
    assert.equal(JSON.stringify(out).includes('CANARY_SECRET_PEM'), false);
    assert.equal(await countRows(writer, 'dlp_task', 'WHERE task_id = $1', [taskId]), 0);
  } finally {
    writer.query = originalQuery;
    await writer.end();
  }
});

test('mid-transaction audit idempotency conflict rolls back sealed bind atomically', async () => {
  const writer = createWriterClient();
  await writer.connect();
  try {
    const taskId = 'task-rb-seal';
    const resourceKey = 'res-rb-seal';
    const leaseKey = 'lease-rb-seal';
    const principal = attestedPrincipal('worker-rb-seal');
    const h = capabilityHarness();
    const { gateway } = await createGateway(writer, {
      principal,
      capabilityHarness: h,
      policy: bootstrapPolicy(taskId, resourceKey),
      leaseKey,
      operationContracts: {
        'bootstrap-bind': bindContract(leaseKey, { includeEvidence: true }),
      },
    });
    const first = await gateway.executeSealedBind({
      capabilityToken: issueBootstrap(h, principal, taskId, resourceKey).token,
      operationKey: 'bootstrap-bind',
      idempotency: bindIdem('rb-seal-1'),
    });
    assert.equal(first.ok, true);

    const taskId2 = 'task-rb-seal-2';
    const resourceKey2 = 'res-rb-seal-2';
    const leaseKey2 = 'lease-rb-seal-2';
    const { gateway: gateway2 } = await createGateway(writer, {
      principal,
      capabilityHarness: h,
      policy: bootstrapPolicy(taskId2, resourceKey2),
      leaseKey: leaseKey2,
      operationContracts: {
        'bootstrap-bind': bindContract(leaseKey2, { includeEvidence: true }),
      },
    });
    const conflictIdem = {
      ...bindIdem('rb-seal-2'),
      auditIdempotencyKey: bindIdem('rb-seal-1').auditIdempotencyKey,
      auditEventId: 'evt-rb-seal-conflict',
    };
    const denied = await gateway2.executeSealedBind({
      capabilityToken: issueBootstrap(h, principal, taskId2, resourceKey2).token,
      operationKey: 'bootstrap-bind',
      idempotency: conflictIdem,
    });
    assert.equal(denied.ok, false);
    assert.ok(
      [
        AUTH_COMPOSITION_DECISIONS.DENY_AUDIT,
        AUTH_COMPOSITION_DECISIONS.DENY_IDEMPOTENCY_CONFLICT,
        AUTH_COMPOSITION_DECISIONS.DENY_BIND,
      ].includes(denied.decision),
      `atomic deny decision=${denied.decision}`,
    );
    assert.equal(await countRows(writer, 'dlp_task', 'WHERE task_id = $1', [taskId2]), 0);
    assert.equal(await countRows(writer, 'dlp_audit_event', 'WHERE event_id = $1', ['evt-rb-seal-conflict']), 0);
    assert.equal(await countRows(writer, 'dlp_task', 'WHERE task_id = $1', [taskId]), 1);
  } finally {
    await writer.end();
  }
});

test('threat-model honesty: exports remain; writer remains privileged; socket trust residual', async () => {
  assert.match(gatewaySrc, /LOCAL_SOCKET_TRUST/);
  assert.match(gatewaySrc, /NOT_SEALED/);
  assert.match(gatewaySrc, /Public DLP-001\.\.004/);
  assert.equal(typeof acquireWriteLease, 'function');
  assert.equal(typeof bindTaskClaimLease, 'function');
  assert.equal(typeof bindTaskClaimLeaseWithAudit, 'function');
  assert.equal(typeof bindTaskClaimLeaseInTransaction, 'function');
  assert.equal(typeof releaseTaskClaimLeaseWithAudit, 'function');

  const writer = createWriterClient();
  await writer.connect();
  try {
    // Caller holding actual writer session remains privileged (R1 writer residual).
    const priv = await privilegeMatrix(writer, WRITER_ROLE);
    assert.equal(priv.dlp_task.ins, true);
    // Document residual: local trust auth means role name selection is not password-sealed.
    assert.match(gatewaySrc, /localSocketTrustSealed: false/);
  } finally {
    await writer.end();
  }
});

test('factory rejects missing writer session attestation; attestWriterSession fail-closed', async () => {
  const writer = createWriterClient();
  await writer.connect();
  try {
    assert.throws(
      () => createSealedAuthenticatedWriteGateway({
        writerClient: writer,
        getVerifiedPrincipal: () => attestedPrincipal(),
        policyProvider: createTrustedAuthorizationPolicyProvider(bootstrapPolicy('t', 'r')),
        capabilityDeps: capabilityHarness().deps,
        operationContracts: { 'bootstrap-bind': bindContract('l') },
      }),
      /MISSING_WRITER_SESSION_ATTESTATION/,
    );
    await assert.rejects(
      () => attestWriterSession(writer, {
        sessionUser: WRITER_ROLE,
        currentUser: WRITER_ROLE,
        backendPid: 999999999,
      }),
      /WRITER_SESSION_ATTESTATION_FAILED/,
    );
  } finally {
    await writer.end();
  }
});

test('exact three authorized new files exist; frozen sibling sources unchanged by presence', () => {
  const files = [
    join(here, '../src/sealedAuthenticatedWriteGateway.js'),
    join(here, 'disposableSealedWriteSchema.sql'),
    join(here, 'sealedAuthenticatedWriteGateway.test.js'),
  ];
  for (const f of files) {
    const body = readFileSync(f);
    assert.ok(body.length > 0);
    createHash('sha256').update(body).digest('hex');
  }
  assert.doesNotMatch(gatewaySrc, /SECURITY DEFINER/i);
  assert.match(gatewaySrc, /OPTION_D \/ D1_DUAL_SESSION/);
});
