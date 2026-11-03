/**
 * TECP-DLP-010 — disposable harness for Option C local writer sidecar proof.
 *
 * NON_OPERATIONAL. Reuses frozen createDisposablePgHarness + DLP-009 SCRAM
 * cutover patterns without modifying those frozen files. Owns SCRAM secrets
 * privately; writer password is injected into the sidecar child only and is
 * never returned on the caller-facing handle.
 */

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import {
  APPROVED_GOVERNANCE_REVISION as DLP006_REV,
} from '../../tecp/src/authorizedInvocation.js';
import {
  BOOTSTRAP_ALLOWED_ACTIONS,
  CAPABILITY_ACTIONS,
  CAPABILITY_STAGES,
  generateEphemeralEd25519KeyPair,
  issueCapability,
  createInjectedClock,
  createInMemoryIssuerKeyRegistry,
  createInMemoryRevocationRegistry,
} from '../../tecp/src/workerCapabilityToken.js';
import {
  ATTESTATION_KINDS,
  createTestOnlyAttestationVerifier,
  verifyWorkerPrincipal,
} from '../../tecp/src/workerIdentity.js';
import { OPERATION_PHASES } from '../src/authenticatedTaskClaimLeaseAuditAdapter.js';
import {
  spawnLocalWriterSidecar,
  SIDECAR_KIND,
  IPC_OWNERSHIP_MARKER,
  IPC_OWNERSHIP_MAGIC,
} from '../src/localWriterSidecar.js';
import { createDisposablePgHarness } from './disposablePgHarness.js';
import {
  assertFullLocalScramHba,
  DLP009_HBA,
  DLP009_LOGIN_ROLES,
  DLP009_RESTRICTED_ROLE,
  DLP009_WRITER_ROLE,
} from './disposableFullLocalScramCutover.js';

const { Client } = pg;
const HERE = dirname(fileURLToPath(import.meta.url));
const PROOF_DATABASE = 'dlp_proof';
const AUDIENCE = 'tecp-dlp010-proof';
const RESOURCE_TYPE = 'task_worktree';
const HARNESS_MARKER = IPC_OWNERSHIP_MARKER;

const SCHEMA_FILES = Object.freeze([
  'disposableTaskClaimLeaseSchema.sql',
  'disposableAuditEvidenceSchema.sql',
  'disposableTaskClaimLeaseAuditSchema.sql',
  'disposableAuthenticatedCompositionSchema.sql',
  'disposableSealedWriteSchema.sql',
]);

function blocked(reason) {
  return new Error(`BLOCKED: DLP010_${reason}`);
}

function assertEnvironment() {
  for (const name of Object.keys(process.env)) {
    if (name === 'DATABASE_URL'
      || /^(PGHOST|PGPORT|PGDATABASE|PGUSER|PGPASSWORD|POSTGRES_)/i.test(name)) {
      throw blocked('AMBIENT_DATABASE_CONFIGURATION');
    }
  }
}

function newCredential() {
  return randomBytes(32).toString('hex');
}

function assertRoleName(role) {
  if (!DLP009_LOGIN_ROLES.includes(role)) throw blocked('UNKNOWN_LOGIN_ROLE');
}

async function closeClient(client) {
  if (client) {
    try { await client.end(); } catch { /* teardown continues */ }
  }
}

function loginConfig(harness, role, password) {
  const config = {
    host: harness.socketDir,
    port: harness.socketPort,
    user: role,
    database: PROOF_DATABASE,
    connectionTimeoutMillis: 2000,
    application_name: 'dlp010_sidecar_test',
  };
  if (password !== undefined) config.password = password;
  return config;
}

function assertInitialTrustHba(hba) {
  const lines = hba.split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.replace(/\s+/g, ' ').toLowerCase());
  if (lines.length !== 3 || lines[0] !== 'local all all trust'
    || lines[1] !== 'host all all 0.0.0.0/0 reject'
    || lines[2] !== 'host all all ::/0 reject') {
    throw blocked('UNEXPECTED_FROZEN_BOOTSTRAP_HBA');
  }
}

function assertParsedHbaRules(rules) {
  if (!Array.isArray(rules) || rules.length !== 3 || rules.some((r) => r.error !== null)) {
    throw blocked('HBA_PARSE_ERROR_OR_UNEXPECTED_RULE');
  }
}

function classifyAuthFailure(error, mode) {
  if (error && error.code === '28P01') return 'SERVER_PASSWORD_REJECT';
  if (mode === 'missing' && error && typeof error.message === 'string'
    && /SASL:.*client password must be a string/i.test(error.message)) {
    return 'CLIENT_MISSING_PASSWORD_REJECT';
  }
  throw blocked('AUTHENTICATION_NEGATIVE_PROBE_INCONCLUSIVE');
}

export function bindContract(leaseKey, extras = {}) {
  return {
    phase: OPERATION_PHASES.BOOTSTRAP_BIND,
    claimKey: extras.claimKey || `claim-${leaseKey}`,
    leaseKey,
    ttlMs: extras.ttlMs || 30_000,
    auditEventType: 'TASK_BOUND_SIDECAR',
    includeEvidence: extras.includeEvidence === true,
    evidenceType: extras.evidenceType || 'TEST_LOG',
    evidenceRef: extras.evidenceRef || 'sha256:dlp010',
  };
}

export function releaseContract(claimKey, extras = {}) {
  return {
    phase: OPERATION_PHASES.LEASE_BOUND_RELEASE,
    claimKey,
    auditEventType: 'TASK_RELEASED_SIDECAR',
    includeEvidence: extras.includeEvidence === true,
    evidenceType: extras.evidenceType || 'TEST_LOG',
    evidenceRef: extras.evidenceRef || 'sha256:dlp010-rel',
  };
}

export function bindIdem(suffix) {
  return {
    compositionIdempotencyKey: `comp-${suffix}`,
    leaseIdempotencyKey: `lease-idem-${suffix}`,
    auditIdempotencyKey: `audit-${suffix}`,
    auditEventId: `evt-${suffix}`,
    evidenceIdempotencyKey: `evd-idem-${suffix}`,
    evidenceId: `evd-${suffix}`,
  };
}

export function releaseIdem(suffix) {
  return {
    auditIdempotencyKey: `audit-rel-${suffix}`,
    auditEventId: `evt-rel-${suffix}`,
    evidenceIdempotencyKey: `evd-rel-idem-${suffix}`,
    evidenceId: `evd-rel-${suffix}`,
  };
}

export function bootstrapOperation(taskId, resourceKey, operationKey = 'bootstrap-bind') {
  return Object.freeze({
    operationKey,
    capabilityStage: CAPABILITY_STAGES.BOOTSTRAP_REQUEST,
    action: CAPABILITY_ACTIONS.REQUEST_ELIGIBLE_TASK_LEASE,
    taskId,
    resourceType: RESOURCE_TYPE,
    resourceId: resourceKey,
  });
}

/**
 * Create disposable PG14 SCRAM cluster + Option C writer sidecar.
 * Writer password never appears on the returned public surface.
 */
export async function createDisposableLocalWriterSidecarProof(options = {}) {
  assertEnvironment();

  let harness = null;
  let bootstrap = null;
  let sidecar = null;
  let stopped = false;
  let stopping = false;
  let cutoverVerified = false;
  const secrets = new Map();
  const ownedPaths = new Set();
  const ipcRoot = join(tmpdir(), `tecp-dlp010-${process.pid}-${randomBytes(6).toString('hex')}`);
  mkdirSync(ipcRoot, { recursive: true, mode: 0o700 });
  writeFileSync(join(ipcRoot, HARNESS_MARKER), IPC_OWNERSHIP_MAGIC, { flag: 'wx', mode: 0o600 });
  ownedPaths.add(ipcRoot);

  const keys = options.keys || generateEphemeralEd25519KeyPair();
  const issuer = options.issuer || 'tecp-dlp010-issuer';
  const kid = options.kid || 'kid-dlp010';
  const principalId = options.principalId || 'worker-dlp010-a';
  const principalGeneration = options.principalGeneration ?? 1;
  const clockStartMs = options.clockStartMs ?? 1_700_000_000_000;
  const taskId = options.taskId || 'task-dlp010-1';
  const resourceKey = options.resourceKey || 'res-dlp010-1';
  const leaseKey = options.leaseKey || 'lease-dlp010-1';

  const attestation = Object.freeze({
    attestationKind: ATTESTATION_KINDS.TEST_ONLY,
    bootstrapIssuer: 'test-bootstrap-issuer-dlp010',
    principalId,
    principalGeneration,
    attestedAt: clockStartMs,
  });

  // Parent-side issuance material (private key stays in test process, NOT in sidecar).
  const parentKeyRegistry = createInMemoryIssuerKeyRegistry([
    {
      issuer,
      kid,
      algorithm: 'Ed25519',
      publicKeyPem: keys.publicKeyPem,
      privateKeyPem: keys.privateKeyPem,
      status: 'ACTIVE',
    },
  ]);
  const parentRevocation = createInMemoryRevocationRegistry();
  parentRevocation.setCurrentRevocationGeneration(0);
  const parentClock = createInjectedClock(clockStartMs);
  const parentCapabilityDeps = {
    keyRegistry: parentKeyRegistry,
    revocationRegistry: parentRevocation,
    clock: parentClock,
  };

  const verifier = createTestOnlyAttestationVerifier();
  verifier.registerAccepted(attestation);
  const principalResult = verifyWorkerPrincipal(
    { attestation },
    { verifyAttestation: verifier.verifyAttestation },
  );
  assert.equal(principalResult.allowed, true);
  const principal = principalResult.principal;

  async function stop() {
    if (stopped) return Object.freeze({ cleaned: true, alreadyStopped: true });
    if (stopping) throw blocked('CLEANUP_ALREADY_IN_PROGRESS');
    stopping = true;
    try {
      if (sidecar) {
        await sidecar.shutdown();
        sidecar = null;
      }
      await closeClient(bootstrap);
      bootstrap = null;
      const cleanup = harness ? harness.stop() : { cleaned: true, terminated: true };
      if (!cleanup.cleaned || !cleanup.terminated) throw blocked('PG_CLEANUP_NOT_PROVEN');
      for (const path of ownedPaths) {
        if (existsSync(path)) {
          // Only remove paths we created and marked.
          const marker = join(path, HARNESS_MARKER);
          if (existsSync(marker) || path.endsWith('.sock')) {
            rmSync(path, { recursive: true, force: true });
          }
        }
      }
      ownedPaths.clear();
      secrets.clear();
      stopped = true;
      return Object.freeze({ cleaned: true, terminated: true });
    } finally {
      stopping = false;
    }
  }

  async function probeLogin(role, mode) {
    if (stopped) throw blocked('PROOF_ALREADY_STOPPED');
    assertRoleName(role);
    if (!['valid', 'missing', 'wrong'].includes(mode)) throw blocked('INVALID_PROBE');
    const pass = mode === 'valid' ? secrets.get(role)
      : mode === 'wrong' ? newCredential() : undefined;
    const client = new Client(loginConfig(harness, role, pass));
    try {
      await client.connect();
      if (mode !== 'valid') throw blocked('PASSWORDLESS_OR_BAD_SECRET_LOGIN_ALLOWED');
      return Object.freeze({ role, mode, result: 'AUTHENTICATED' });
    } catch (error) {
      if (mode === 'valid') throw blocked('VALID_SCRAM_LOGIN_FAILED');
      if (error && String(error.message).includes('PASSWORDLESS_OR_BAD_SECRET_LOGIN_ALLOWED')) {
        throw error;
      }
      return Object.freeze({ role, mode, result: classifyAuthFailure(error, mode) });
    } finally {
      await closeClient(client);
    }
  }

  async function withRestrictedClient(callback) {
    if (!cutoverVerified || stopped) throw blocked('SCRAM_CUTOVER_NOT_VERIFIED');
    if (typeof callback !== 'function') throw blocked('CALLBACK_REQUIRED');
    const client = new Client(loginConfig(harness, DLP009_RESTRICTED_ROLE, secrets.get(DLP009_RESTRICTED_ROLE)));
    try {
      await client.connect();
      return await callback(client);
    } finally {
      await closeClient(client);
    }
  }

  async function withAdminClient(callback) {
    if (!cutoverVerified || stopped) throw blocked('SCRAM_CUTOVER_NOT_VERIFIED');
    const client = new Client(loginConfig(harness, 'dlp_proof', secrets.get('dlp_proof')));
    try {
      await client.connect();
      return await callback(client);
    } finally {
      await closeClient(client);
    }
  }

  function issueBootstrapToken(overrides = {}) {
    return issueCapability(
      {
        principal,
        issuer,
        kid,
        algorithm: 'Ed25519',
        audience: AUDIENCE,
        taskId: overrides.taskId || taskId,
        resourceType: RESOURCE_TYPE,
        resourceId: overrides.resourceKey || resourceKey,
        allowedActions: [...BOOTSTRAP_ALLOWED_ACTIONS],
        capabilityStage: CAPABILITY_STAGES.BOOTSTRAP_REQUEST,
        ttlMs: overrides.ttlMs ?? 60_000,
        ...overrides.extra,
      },
      parentCapabilityDeps,
    );
  }

  function issueReleaseToken(leaseId, fencingEpoch, overrides = {}) {
    return issueCapability(
      {
        principal,
        issuer,
        kid,
        algorithm: 'Ed25519',
        audience: AUDIENCE,
        taskId: overrides.taskId || taskId,
        resourceType: RESOURCE_TYPE,
        resourceId: overrides.resourceKey || resourceKey,
        allowedActions: [CAPABILITY_ACTIONS.RELEASE_TASK],
        capabilityStage: CAPABILITY_STAGES.LEASE_BOUND,
        leaseContext: { leaseId, fencingEpoch },
        ttlMs: overrides.ttlMs ?? 60_000,
        ...overrides.extra,
      },
      parentCapabilityDeps,
    );
  }

  async function spawnSidecar(trustOverrides = {}) {
    if (sidecar) {
      await sidecar.shutdown();
      sidecar = null;
    }
    const ipcSocketPath = join(ipcRoot, `writer-${randomUUID()}.sock`);
    ownedPaths.add(ipcSocketPath);
    const writerPassword = secrets.get(DLP009_WRITER_ROLE);
    if (!isNonEmptyString(writerPassword)) throw blocked('WRITER_SECRET_MISSING');

    const operations = trustOverrides.operations || [
      bootstrapOperation(taskId, resourceKey),
    ];
    const operationContracts = trustOverrides.operationContracts || {
      'bootstrap-bind': bindContract(leaseKey, { includeEvidence: true }),
      'lease-release': releaseContract(`claim-${leaseKey}`, { includeEvidence: true }),
    };

    sidecar = await spawnLocalWriterSidecar({
      ipcSocketPath,
      ipcOwnedRoot: ipcRoot,
      enableTestHooks: true,
      pg: {
        host: harness.socketDir,
        port: harness.socketPort,
        user: DLP009_WRITER_ROLE,
        database: PROOF_DATABASE,
        password: writerPassword,
      },
      trust: {
        audience: AUDIENCE,
        issuer,
        kid,
        publicKeyPem: keys.publicKeyPem,
        acceptedAttestations: [attestation],
        operations,
        operationContracts,
        clockStartMs: trustOverrides.clockStartMs ?? clockStartMs,
        revocationGeneration: trustOverrides.revocationGeneration ?? 0,
        revokedJtis: trustOverrides.revokedJtis || [],
      },
    });
    return sidecar;
  }

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
  }

  try {
    harness = createDisposablePgHarness();
    const isolation = await harness.proveIsolation();
    assert.equal(isolation.listenAddresses, '');
    assert.equal(isolation.tcpRejected, true);
    await harness.createProofDatabase();

    bootstrap = await harness.createClient();
    await bootstrap.query("SET application_name = 'dlp010_trust_bootstrap'");
    for (const schemaFile of SCHEMA_FILES) {
      await bootstrap.query(readFileSync(join(HERE, schemaFile), 'utf8'));
    }

    await bootstrap.query("SET password_encryption = 'scram-sha-256'");
    const inventory = await bootstrap.query(
      'SELECT rolname::text AS rolname FROM pg_roles WHERE rolcanlogin = true ORDER BY rolname',
    );
    for (const row of inventory.rows) {
      const role = row.rolname;
      const secret = newCredential();
      secrets.set(role, secret);
      const quotedRole = `"${role.replace(/"/g, '""')}"`;
      await bootstrap.query(`ALTER ROLE ${quotedRole} PASSWORD '${secret}'`);
    }

    const hbaPath = join(harness.dataDir, 'pg_hba.conf');
    assertInitialTrustHba(readFileSync(hbaPath, 'utf8'));
    assertFullLocalScramHba(DLP009_HBA);
    const tempHba = join(harness.dataDir, 'pg_hba.conf.dlp010.tmp');
    writeFileSync(tempHba, DLP009_HBA, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    renameSync(tempHba, hbaPath);
    assertFullLocalScramHba(readFileSync(hbaPath, 'utf8'));

    const reload = await bootstrap.query('SELECT pg_reload_conf() AS success');
    if (reload.rows[0]?.success !== true) throw blocked('POSTGRES_RELOAD_FAILED');
    const rules = await bootstrap.query(
      'SELECT type, database, user_name, address, auth_method, error FROM pg_hba_file_rules ORDER BY line_number',
    );
    assertParsedHbaRules(rules.rows);

    await closeClient(bootstrap);
    bootstrap = null;

    let liveRulesVerified = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const wrong = await probeLogin('dlp_proof', 'wrong');
      if (wrong.result === 'SERVER_PASSWORD_REJECT') {
        liveRulesVerified = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!liveRulesVerified) throw blocked('HBA_RELOAD_NOT_EFFECTIVE');

    for (const role of [DLP009_WRITER_ROLE, DLP009_RESTRICTED_ROLE, 'dlp_proof']) {
      const ok = await probeLogin(role, 'valid');
      const wrong = await probeLogin(role, 'wrong');
      const missing = await probeLogin(role, 'missing');
      if (ok.result !== 'AUTHENTICATED' || wrong.result !== 'SERVER_PASSWORD_REJECT'
        || !['SERVER_PASSWORD_REJECT', 'CLIENT_MISSING_PASSWORD_REJECT'].includes(missing.result)) {
        throw blocked('SCRAM_AUTH_MATRIX_FAILED');
      }
    }
    cutoverVerified = true;

    // Ensure TCP still rejected.
    await withAdminClient(async (admin) => {
      const runtime = await admin.query('SHOW listen_addresses');
      if (runtime.rows[0]?.listen_addresses !== '') {
        throw blocked('TCP_LISTEN_ADDRESSES_CHANGED');
      }
    });
    {
      const tcp = new Client({
        host: '127.0.0.1',
        port: harness.socketPort,
        user: 'dlp_proof',
        database: PROOF_DATABASE,
        password: secrets.get('dlp_proof'),
        connectionTimeoutMillis: 1000,
      });
      try {
        await tcp.connect();
        throw blocked('TCP_CONNECTED_AFTER_CUTOVER');
      } catch (error) {
        if (error && String(error.message).includes('TCP_CONNECTED_AFTER_CUTOVER')) throw error;
        if (!error || error.code !== 'ECONNREFUSED') {
          throw blocked('TCP_NEGATIVE_PROBE_INCONCLUSIVE');
        }
      } finally {
        await closeClient(tcp);
      }
    }

    const privateLog = readFileSync(harness.logFile, 'utf8');
    for (const credential of secrets.values()) {
      if (privateLog.includes(credential)) throw blocked('CREDENTIAL_FOUND_IN_PG_LOG');
    }

    await spawnSidecar(options.trustOverrides || {});

    // Public surface — no writer password, no secrets map.
    return Object.freeze({
      mode: 'NON_OPERATIONAL_DISPOSABLE_ONLY',
      architecture: 'OPTION_C_LOCAL_WRITER_SIDECAR',
      kind: SIDECAR_KIND,
      audience: AUDIENCE,
      resourceType: RESOURCE_TYPE,
      writerRole: DLP009_WRITER_ROLE,
      restrictedRole: DLP009_RESTRICTED_ROLE,
      taskId,
      resourceKey,
      leaseKey,
      principalId,
      principal,
      issuer,
      kid,
      publicKeyPem: keys.publicKeyPem,
      // privateKeyPem intentionally available only for parent-side TEST issuance helpers
      // and must never be sent to the sidecar. Tests may use issue* helpers instead.
      dlp006GovernanceRevision: DLP006_REV,
      isolation: Object.freeze({ unixOnly: true, tcpRejected: true, scramCutover: true }),
      ipcOwnedRoot: ipcRoot,
      sidecarPid: () => (sidecar ? sidecar.pid : null),
      getSidecar: () => sidecar,
      spawnSidecar,
      issueBootstrapToken,
      issueReleaseToken,
      revokeJtiOnParentIssuer: (jti) => parentRevocation.revokeJti(jti),
      advanceParentClock: (ms) => parentClock.advance(ms),
      getParentClockMs: () => parentClock.now().nowMs,
      withRestrictedClient,
      withAdminClient,
      probeLogin,
      bindContract,
      releaseContract,
      bindIdem,
      releaseIdem,
      bootstrapOperation,
      stop,
      // Explicit: no getWriterPassword, no getWriterClient, no secrets.
    });
  } catch (error) {
    try {
      await stop();
    } catch {
      throw blocked('SETUP_FAILED_AND_CLEANUP_NOT_PROVEN');
    }
    const message = String(error && error.message || '');
    if (message.startsWith('BLOCKED: DLP010_')) throw error;
    throw blocked('SETUP_OR_SIDECAR_START_FAILED');
  }
}

export const HARNESS_PUBLIC_API = Object.freeze([
  'createDisposableLocalWriterSidecarProof',
  'bindContract',
  'releaseContract',
  'bindIdem',
  'releaseIdem',
  'bootstrapOperation',
  'HARNESS_PUBLIC_API',
]);
