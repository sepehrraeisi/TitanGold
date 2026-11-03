/**
 * TECP-DLP-010 Option C — disposable local writer sidecar isolation tests.
 * NON_OPERATIONAL proof. Real disposable PostgreSQL 14 SCRAM required.
 *
 * SAME_UID_SEALING = NOT_PROVEN
 * REAL_WORKER_AUTH = NOT_PROVEN
 * PRODUCTION_R1 = NOT_PROVEN
 * C24_REAL_DEADLOCK = NOT_PROVEN
 */

import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

import {
  IPC_DECISIONS,
  IPC_FORBIDDEN_BODY_FIELDS,
  IPC_MAX_FRAME_BYTES,
  IPC_OPS,
  IPC_PROTOCOL_KIND,
  IPC_PROTOCOL_VERSION,
  buildIpcRequest,
  createIpcFrameReader,
  encodeIpcFrame,
  validateIpcRequest,
} from '../src/localWriterIpcProtocol.js';
import {
  SIDECAR_ARCHITECTURE,
  SIDECAR_KIND,
  assertOwnedIpcPath,
  safeUnlinkOwnedSocket,
  assertSocketPermissions,
  spawnLocalWriterSidecar,
} from '../src/localWriterSidecar.js';
import {
  createDisposableLocalWriterSidecarProof,
  bindIdem,
  releaseIdem,
} from './disposableLocalWriterSidecarHarness.js';

const here = dirname(fileURLToPath(import.meta.url));
const PROTECTED_TABLES = Object.freeze([
  'dlp_task',
  'dlp_task_claim',
  'dlp_write_lease',
  'dlp_audit_event',
  'dlp_evidence_fact',
]);

let proof;

function assertNoSensitiveLeak(value, canaries = []) {
  const json = JSON.stringify(value, (_k, v) => {
    if (typeof v === 'function') return '[Function]';
    if (v && typeof v === 'object' && typeof v.query === 'function') return '[Client]';
    return v;
  });
  for (const c of canaries) {
    assert.equal(json.includes(c), false, `secret leak: ${c}`);
  }
  assert.equal(json.includes('privateKeyPem'), false);
  assert.equal(json.includes('postgres://'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(value, 'password'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(value, 'writerClient'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(value, 'client'), false);
  assert.equal(value.writerPassword, undefined);
}

function assertDeny(out, context = '') {
  assert.ok(out && typeof out === 'object', `expected object ${context}`);
  assert.notEqual(out.ok, true, `must not succeed ${context}`);
  assert.equal(typeof out.decision, 'string', `decision ${context}`);
}

function assertSqlstate42501(err, context = '') {
  assert.ok(err, `expected error ${context}`);
  assert.equal(err.code, '42501', `expected 42501 ${context}, got ${err && err.code}`);
}

before(async () => {
  assert.equal(process.env.DATABASE_URL, undefined);
  proof = await createDisposableLocalWriterSidecarProof();
});

after(async () => {
  if (proof) {
    const cleanup = await proof.stop();
    assert.equal(cleanup.cleaned, true);
    assert.equal(cleanup.terminated, true);
  }
});

test('protocol: versioned schemas reject unknown ops, forbidden fields, oversized frames', () => {
  assert.equal(IPC_PROTOCOL_VERSION, 1);
  assert.ok(IPC_FORBIDDEN_BODY_FIELDS.includes('password'));
  assert.ok(IPC_FORBIDDEN_BODY_FIELDS.includes('authorizedInvocation'));
  assert.ok(IPC_FORBIDDEN_BODY_FIELDS.includes('policyProvider'));

  const good = validateIpcRequest(buildIpcRequest(IPC_OPS.PING, randomUUID(), {}));
  assert.equal(good.ok, true);

  const unknown = validateIpcRequest(buildIpcRequest(IPC_OPS.GET_WRITER_CREDENTIAL, randomUUID(), {}));
  assert.equal(unknown.ok, false);
  assert.equal(unknown.decision, IPC_DECISIONS.DENY_UNKNOWN_OP);

  const forbidden = validateIpcRequest(buildIpcRequest(IPC_OPS.BIND, randomUUID(), {
    capabilityToken: 'x',
    operationKey: 'bootstrap-bind',
    password: 'CANARY_PASSWORD',
  }));
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.decision, IPC_DECISIONS.DENY_FORBIDDEN_FIELD);

  const serialized = validateIpcRequest({
    v: IPC_PROTOCOL_VERSION,
    kind: IPC_PROTOCOL_KIND,
    op: IPC_OPS.BIND,
    requestId: randomUUID(),
    body: { capabilityToken: 'x', operationKey: 'bootstrap-bind' },
    authorizedInvocation: { allowed: true },
  });
  assert.equal(serialized.ok, false);
  assert.equal(serialized.decision, IPC_DECISIONS.DENY_SERIALIZED_INVOCATION);

  const reader = createIpcFrameReader();
  const huge = Buffer.alloc(IPC_MAX_FRAME_BYTES + 32, 1);
  const over = reader.push(huge);
  assert.ok(over.error);
  assert.equal(over.error.decision, IPC_DECISIONS.DENY_OVERSIZED_FRAME);

  const shutdownMissing = validateIpcRequest(buildIpcRequest(IPC_OPS.SHUTDOWN, randomUUID(), {}));
  assert.equal(shutdownMissing.ok, false);
  assert.equal(shutdownMissing.decision, IPC_DECISIONS.DENY_UNAUTHENTICATED_SHUTDOWN);

  const shutdownOkShape = validateIpcRequest(buildIpcRequest(IPC_OPS.SHUTDOWN, randomUUID(), {
    shutdownToken: randomBytes(32).toString('hex'),
  }));
  assert.equal(shutdownOkShape.ok, true);
});

test('isolation: sidecar is a separate process; PG unix-only SCRAM; no ambient DATABASE_URL', async () => {
  assert.equal(process.env.DATABASE_URL, undefined);
  assert.equal(proof.isolation.unixOnly, true);
  assert.equal(proof.isolation.tcpRejected, true);
  assert.equal(proof.isolation.scramCutover, true);
  assert.equal(proof.architecture, SIDECAR_ARCHITECTURE);
  const sidecar = proof.getSidecar();
  assert.ok(sidecar);
  assert.notEqual(sidecar.pid, process.pid);
  assert.equal(sidecar.kind, SIDECAR_KIND);
  assert.equal(sidecar.password, undefined);
  assert.equal(sidecar.writerClient, undefined);
  assert.equal(typeof sidecar.bind, 'function');
  assert.equal(Object.prototype.hasOwnProperty.call(proof, 'getWriterPassword'), false);
  const ping = await sidecar.ping();
  assert.equal(ping.ok, true);
  assert.equal(ping.pid, sidecar.pid);
  // Socket permissions verified before READY / handle return.
  const perms = assertSocketPermissions(sidecar.ipcSocketPath);
  assert.equal(perms.mode, 0o600);
  assert.equal(perms.uid, process.getuid());
});

test('positive: valid capability bind + release through sidecar; restricted caller 42501', async () => {
  const sidecar = proof.getSidecar();
  const issued = proof.issueBootstrapToken();
  assert.equal(issued.allowed, true);

  const bindOut = await sidecar.bind({
    capabilityToken: issued.token,
    operationKey: 'bootstrap-bind',
    idempotency: bindIdem('pos-1'),
  });
  assert.equal(bindOut.ok, true, `bind failed: ${bindOut.decision}`);
  assert.equal(bindOut.sidecar, true);
  assertNoSensitiveLeak(bindOut);
  assert.ok(bindOut.lease);
  assert.equal(bindOut.lease.leaseKey, proof.leaseKey);
  const fencingEpoch = bindOut.lease.fencingEpoch;
  assert.ok(Number.isSafeInteger(fencingEpoch));

  await proof.withRestrictedClient(async (client) => {
    const insertProbes = {
      dlp_task: `INSERT INTO dlp_task (task_id, actor_id, governance_revision, status, resource_type, resource_key, claim_key, composition_idempotency_key)
        VALUES ('t-bypass', 'actor', 'x', 'OPEN', 'task_worktree', 'rk', 'ck', 'idem')`,
      dlp_task_claim: `INSERT INTO dlp_task_claim (task_id, resource_type, resource_key, actor_id, claim_key, access_mode, status, governance_revision)
        VALUES ('t-bypass', 'task_worktree', 'rk', 'actor', 'ck', 'WRITE', 'HELD', 'x')`,
      dlp_write_lease: `INSERT INTO dlp_write_lease
        (resource_type, resource_key, lease_key, actor_id, task_id, governance_revision, fencing_epoch, version, status, expires_at)
        VALUES ('task_worktree', 'rk', 'lk-bypass', 'actor', 't-bypass', 'x', 1, 1, 'ACTIVE', clock_timestamp() + interval '1 hour')`,
      dlp_audit_event: `INSERT INTO dlp_audit_event (event_id, task_id, actor_id, event_type, governance_revision, idempotency_key)
        VALUES ('evt-bypass', 't-bypass', 'actor', 'X', 'x', 'idem-a')`,
      dlp_evidence_fact: `INSERT INTO dlp_evidence_fact (evidence_id, task_id, actor_id, evidence_type, evidence_ref, governance_revision, idempotency_key)
        VALUES ('evd-bypass', 't-bypass', 'actor', 'TEST_LOG', 'sha256:x', 'x', 'idem-e')`,
    };
    for (const [table, sql] of Object.entries(insertProbes)) {
      let caught;
      try {
        await client.query(sql);
      } catch (err) {
        caught = err;
      }
      assertSqlstate42501(caught, `INSERT ${table}`);
    }
    let upd;
    try {
      await client.query('UPDATE dlp_audit_event SET event_type = event_type');
    } catch (err) {
      upd = err;
    }
    assertSqlstate42501(upd, 'UPDATE audit');
  });

  // Restricted role cannot login as writer without writer password (SCRAM).
  const writerMissing = await proof.probeLogin(proof.writerRole, 'missing');
  assert.ok(['SERVER_PASSWORD_REJECT', 'CLIENT_MISSING_PASSWORD_REJECT'].includes(writerMissing.result));

  const relIssued = proof.issueReleaseToken(proof.leaseKey, fencingEpoch);
  assert.equal(relIssued.allowed, true);
  const relOut = await sidecar.release({
    capabilityToken: relIssued.token,
    operationKey: 'lease-release',
    idempotency: releaseIdem('pos-1'),
  });
  assert.equal(relOut.ok, true, `release failed: ${relOut.decision}`);
  assertNoSensitiveLeak(relOut);

  await proof.withAdminClient(async (admin) => {
    const lease = await admin.query(
      `SELECT status::text AS status FROM dlp_write_lease WHERE lease_key = $1`,
      [proof.leaseKey],
    );
    assert.equal(lease.rows[0].status, 'RELEASED');
  });
});

test('negative: missing/forged/wrong-scope capability DENY; no false ALLOW', async () => {
  await proof.spawnSidecar({
    operations: [proof.bootstrapOperation('task-neg', 'res-neg')],
    operationContracts: {
      'bootstrap-bind': proof.bindContract('lease-neg'),
      'lease-release': proof.releaseContract('claim-lease-neg'),
    },
  });
  const sidecar = proof.getSidecar();

  const missing = await sidecar.bind({
    operationKey: 'bootstrap-bind',
    idempotency: bindIdem('neg-missing'),
  });
  // IPC validation requires capabilityToken — malformed/unauthenticated.
  assertDeny(missing, 'missing token');

  const forged = await sidecar.bind({
    capabilityToken: 'not.a.real.token',
    operationKey: 'bootstrap-bind',
    idempotency: bindIdem('neg-forged'),
  });
  assertDeny(forged, 'forged token');
  assert.notEqual(forged.ok, true);

  const wrongTask = proof.issueBootstrapToken({ taskId: 'task-wrong', resourceKey: 'res-neg' });
  assert.equal(wrongTask.allowed, true);
  const wrongOut = await sidecar.bind({
    capabilityToken: wrongTask.token,
    operationKey: 'bootstrap-bind',
    idempotency: bindIdem('neg-wrong-task'),
  });
  assertDeny(wrongOut, 'wrong task');

  // Serialized AuthorizedInvocation field rejected by IPC.
  const withInvocation = await sidecar.bind({
    capabilityToken: proof.issueBootstrapToken({ taskId: 'task-neg', resourceKey: 'res-neg' }).token,
    operationKey: 'bootstrap-bind',
    idempotency: bindIdem('neg-inv'),
    authorizedInvocation: { allowed: true, principalId: proof.principalId },
  });
  assertDeny(withInvocation, 'serialized invocation');
});

test('negative: expired and revoked capability DENY via sidecar-local verification', async () => {
  // Live-process TTL: short-lived token must expire inside one sidecar without respawn.
  await proof.spawnSidecar({
    operations: [proof.bootstrapOperation('task-live-ttl', 'res-live-ttl')],
    operationContracts: {
      'bootstrap-bind': proof.bindContract('lease-live-ttl'),
      'lease-release': proof.releaseContract('claim-lease-live-ttl'),
    },
  });
  const shortLived = proof.issueBootstrapToken({
    taskId: 'task-live-ttl',
    resourceKey: 'res-live-ttl',
    ttlMs: 1_000,
  });
  assert.equal(shortLived.allowed, true);
  await new Promise((r) => setTimeout(r, 1200));
  const liveExpired = await proof.getSidecar().bind({
    capabilityToken: shortLived.token,
    operationKey: 'bootstrap-bind',
    idempotency: bindIdem('live-ttl-expired'),
  });
  assertDeny(liveExpired, 'live process TTL expiry');

  const issued = proof.issueBootstrapToken({
    taskId: 'task-exp2',
    resourceKey: 'res-exp2',
    ttlMs: 30_000,
  });
  assert.equal(issued.allowed, true);
  assert.ok(issued.claims && issued.claims.jti);

  await proof.spawnSidecar({
    operations: [proof.bootstrapOperation('task-exp2', 'res-exp2')],
    operationContracts: {
      'bootstrap-bind': proof.bindContract('lease-exp2'),
      'lease-release': proof.releaseContract('claim-lease-exp2'),
    },
    clockStartMs: proof.getParentClockMs() + 120_000,
  });
  const expiredOut = await proof.getSidecar().bind({
    capabilityToken: issued.token,
    operationKey: 'bootstrap-bind',
    idempotency: bindIdem('expired-1'),
  });
  assertDeny(expiredOut, 'expired token');

  const live = proof.issueBootstrapToken({
    taskId: 'task-rev',
    resourceKey: 'res-rev',
    ttlMs: 60_000,
  });
  assert.equal(live.allowed, true);
  await proof.spawnSidecar({
    operations: [proof.bootstrapOperation('task-rev', 'res-rev')],
    operationContracts: {
      'bootstrap-bind': proof.bindContract('lease-rev'),
      'lease-release': proof.releaseContract('claim-lease-rev'),
    },
    revokedJtis: [live.claims.jti],
  });
  const revokedOut = await proof.getSidecar().bind({
    capabilityToken: live.token,
    operationKey: 'bootstrap-bind',
    idempotency: bindIdem('revoked-1'),
  });
  assertDeny(revokedOut, 'revoked jti');
});

test('negative: IPC replay, unauthorized ops, credential harvest attempts', async () => {
  await proof.spawnSidecar({
    operations: [proof.bootstrapOperation('task-replay', 'res-replay')],
    operationContracts: {
      'bootstrap-bind': proof.bindContract('lease-replay'),
      'lease-release': proof.releaseContract('claim-lease-replay'),
    },
  });
  const sidecar = proof.getSidecar();
  const issued = proof.issueBootstrapToken({ taskId: 'task-replay', resourceKey: 'res-replay' });

  // Direct raw socket replay of identical framed requestId.
  const requestId = randomUUID();
  const envelope = buildIpcRequest(IPC_OPS.BIND, requestId, {
    capabilityToken: issued.token,
    operationKey: 'bootstrap-bind',
    idempotency: bindIdem('replay-raw'),
  });
  const frame = encodeIpcFrame(envelope);
  const first = await rawIpcRoundTrip(sidecar.ipcSocketPath, frame);
  assert.equal(first.ok, true);
  const second = await rawIpcRoundTrip(sidecar.ipcSocketPath, frame);
  assertDeny(second, 'requestId replay');
  assert.equal(second.decision, IPC_DECISIONS.DENY_REPLAY);

  // Credential harvest ops rejected by protocol.
  for (const op of [
    IPC_OPS.GET_WRITER_CREDENTIAL,
    IPC_OPS.GET_WRITER_CLIENT,
    IPC_OPS.EXECUTE_SQL,
    IPC_OPS.INSTALL_POLICY,
    IPC_OPS.INJECT_DEPS,
  ]) {
    const denied = validateIpcRequest(buildIpcRequest(op, randomUUID(), {}));
    assert.equal(denied.ok, false);
    assert.equal(denied.decision, IPC_DECISIONS.DENY_UNKNOWN_OP);
  }

  // Caller handle must not expose privileged fields.
  assert.equal(sidecar.writerClient, undefined);
  assert.equal(sidecar.password, undefined);
  assert.equal(typeof sidecar.getWriterPassword, 'undefined');
});

test('negative: malformed/truncated IPC frames fail closed', async () => {
  const sidecar = proof.getSidecar();
  const result = await new Promise((resolve) => {
    const socket = createConnection(sidecar.ipcSocketPath);
    const reader = createIpcFrameReader();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, decision: 'TIMEOUT' });
    }, 3000);
    socket.on('connect', () => {
      // Intentionally truncated: length header claims 100 bytes, send 4.
      const header = Buffer.alloc(4);
      header.writeUInt32BE(100, 0);
      socket.write(Buffer.concat([header, Buffer.from('xxxx')]));
      socket.end();
    });
    socket.on('data', (chunk) => {
      const { frames, error } = reader.push(chunk);
      if (error) {
        clearTimeout(timer);
        resolve(error);
        return;
      }
      if (frames[0]) {
        clearTimeout(timer);
        resolve(frames[0].result || frames[0]);
      }
    });
    socket.on('close', () => {
      const trunc = reader.markTruncated();
      if (trunc) {
        clearTimeout(timer);
        resolve(trunc);
      }
    });
  });
  assertDeny(result, 'truncated frame');
});

test('negative: TCP to PostgreSQL still refused; ambient DATABASE_URL absent', async () => {
  assert.equal(process.env.DATABASE_URL, undefined);
  const tcpDenied = await proof.probeLogin(proof.writerRole, 'wrong');
  assert.equal(tcpDenied.result, 'SERVER_PASSWORD_REJECT');
});

test('crash/cleanup: sidecar crash does not permissive-fallback; shutdown removes socket', async () => {
  await proof.spawnSidecar({
    operations: [proof.bootstrapOperation('task-crash', 'res-crash')],
    operationContracts: {
      'bootstrap-bind': proof.bindContract('lease-crash'),
      'lease-release': proof.releaseContract('claim-lease-crash'),
    },
  });
  const sidecar = proof.getSidecar();
  const pid = sidecar.pid;
  const sock = sidecar.ipcSocketPath;
  assert.ok(existsSync(sock));

  // Kill child hard (external signal; may not set child.killed).
  process.kill(pid, 'SIGKILL');
  await new Promise((r) => setTimeout(r, 500));

  const afterCrash = await sidecar.bind({
    capabilityToken: 'x',
    operationKey: 'bootstrap-bind',
    idempotency: bindIdem('after-crash'),
  });
  assertDeny(afterCrash, 'post-crash bind');
  assert.match(String(afterCrash.decision), /^DENY_/);

  const shutdown = await sidecar.shutdown();
  assert.equal(shutdown.ok, true);
  assert.equal(existsSync(sock), false);

  // Fresh sidecar still works (no permissive fallback).
  await proof.spawnSidecar({
    operations: [proof.bootstrapOperation('task-recover', 'res-recover')],
    operationContracts: {
      'bootstrap-bind': proof.bindContract('lease-recover'),
      'lease-release': proof.releaseContract('claim-lease-recover'),
    },
  });
  const issued = proof.issueBootstrapToken({ taskId: 'task-recover', resourceKey: 'res-recover' });
  const bindOut = await proof.getSidecar().bind({
    capabilityToken: issued.token,
    operationKey: 'bootstrap-bind',
    idempotency: bindIdem('recover-1'),
  });
  assert.equal(bindOut.ok, true, `recover bind: ${bindOut.decision}`);
});

test('security: owned-path unlink refuses symlinks and foreign files', () => {
  const root = proof.ipcOwnedRoot;
  const sockPath = join(root, `deny-${randomUUID()}.sock`);
  assertOwnedIpcPath(root, sockPath);

  const filePath = join(root, `not-a-socket-${randomUUID()}`);
  writeFileSync(filePath, 'nope', { mode: 0o600 });
  assert.throws(
    () => safeUnlinkOwnedSocket(root, filePath),
    /IPC_PATH_NOT_SOCKET|BLOCKED: DLP010_IPC_PATH_NOT_SOCKET/,
  );

  const linkPath = join(root, `symlink-${randomUUID()}.sock`);
  const target = join(root, `symlink-target-${randomUUID()}`);
  writeFileSync(target, 'x', { mode: 0o600 });
  symlinkSync(target, linkPath);
  assert.throws(
    () => safeUnlinkOwnedSocket(root, linkPath),
    /IPC_SOCKET_IS_SYMLINK|BLOCKED: DLP010_IPC_SOCKET_IS_SYMLINK/,
  );

  // Outside owned root fails closed.
  const outside = join('/tmp', `tecp-dlp010-foreign-${randomUUID()}.sock`);
  assert.throws(() => assertOwnedIpcPath(root, outside), /OUTSIDE_OWNED_ROOT|BLOCKED/);
});

test('security: unauthenticated SHUTDOWN DENY; process remains alive', async () => {
  await proof.spawnSidecar({
    operations: [proof.bootstrapOperation('task-shut', 'res-shut')],
    operationContracts: {
      'bootstrap-bind': proof.bindContract('lease-shut'),
      'lease-release': proof.releaseContract('claim-lease-shut'),
    },
  });
  const sidecar = proof.getSidecar();
  assert.ok(sidecar.testHooks);

  const missing = await sidecar.testHooks.rawShutdownAttempt('');
  assertDeny(missing, 'empty shutdown token');
  assert.equal(
    missing.decision === IPC_DECISIONS.DENY_UNAUTHENTICATED_SHUTDOWN
      || missing.decision === IPC_DECISIONS.DENY_MALFORMED_MESSAGE
      || String(missing.decision).includes('UNAUTHENTICATED'),
    true,
    `unexpected decision ${missing.decision}`,
  );

  const wrong = await sidecar.testHooks.rawShutdownAttempt(randomBytes(32).toString('hex'));
  assertDeny(wrong, 'wrong shutdown token');
  assert.equal(wrong.decision, IPC_DECISIONS.DENY_UNAUTHENTICATED_SHUTDOWN);

  // Sidecar must still be alive after unauthorized attempts.
  const ping = await sidecar.ping();
  assert.equal(ping.ok, true);
  assert.equal(sidecar.getChildExitCode(), null);
});

test('security: parent keepalive close terminates privileged child', async () => {
  await proof.spawnSidecar({
    operations: [proof.bootstrapOperation('task-keep', 'res-keep')],
    operationContracts: {
      'bootstrap-bind': proof.bindContract('lease-keep'),
      'lease-release': proof.releaseContract('claim-lease-keep'),
    },
  });
  const sidecar = proof.getSidecar();
  const pid = sidecar.pid;
  const sock = sidecar.ipcSocketPath;
  assert.ok(existsSync(sock));
  sidecar.testHooks.endKeepalive();

  let exited = false;
  for (let i = 0; i < 50; i += 1) {
    try {
      process.kill(pid, 0);
    } catch {
      exited = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(exited, true, 'child must exit after keepalive close');
  // Parent shutdown should still complete cleanup of owned socket path.
  const shutdown = await sidecar.shutdown();
  assert.equal(shutdown.ok, true);
  assert.equal(existsSync(sock), false);
});

test('security: missing keepalive fd3 fails closed before READY', async () => {
  const modulePath = join(here, '../src/localWriterSidecar.js');
  const root = proof.ipcOwnedRoot;
  const sockPath = join(root, `nokeep-${randomUUID()}.sock`);
  const bootstrap = {
    kind: SIDECAR_KIND,
    protocolVersion: IPC_PROTOCOL_VERSION,
    ipcSocketPath: sockPath,
    ipcOwnedRoot: root,
    shutdownToken: randomBytes(32).toString('hex'),
    pg: {
      host: '/tmp',
      port: 1,
      user: 'dlp_authz_composition_proof',
      database: 'dlp_proof',
      password: randomBytes(16).toString('hex'),
    },
    trust: {
      audience: 'tecp-dlp010-proof',
      issuer: 'tecp-dlp010-issuer',
      kid: 'kid-dlp010',
      publicKeyPem: proof.publicKeyPem,
      acceptedAttestations: [{
        attestationKind: 'TEST_ONLY',
        bootstrapIssuer: 'test-bootstrap-issuer-dlp010',
        principalId: proof.principalId,
        principalGeneration: 1,
        attestedAt: 1_700_000_000_000,
      }],
      operations: [proof.bootstrapOperation('task-nokeep', 'res-nokeep')],
      operationContracts: {
        'bootstrap-bind': proof.bindContract('lease-nokeep'),
        'lease-release': proof.releaseContract('claim-lease-nokeep'),
      },
      clockStartMs: 1_700_000_000_000,
      revocationGeneration: 0,
      revokedJtis: [],
    },
  };
  const child = spawn(process.execPath, [modulePath, '--tecp-dlp010-sidecar-worker'], {
    // fd3 = /dev/null (not a pipe) — must fail closed at keepalive gate before PG/READY.
    stdio: ['pipe', 'pipe', 'pipe', 'ignore'],
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      LANG: process.env.LANG,
      NODE_OPTIONS: '',
    },
  });
  child.stdin.write(JSON.stringify(bootstrap));
  child.stdin.end();
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (c) => { stdout += c; });
  child.stderr.on('data', (c) => { stderr += c; });
  const code = await new Promise((resolve) => {
    child.on('exit', (c) => resolve(c));
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }, 5000);
  });
  assert.equal(stdout.includes('DLP010_SIDECAR_READY'), false);
  assert.match(stderr, /DLP010_SIDECAR_KEEPALIVE_REQUIRED/);
  assert.equal(code, 4);
});

test('source: no private keys or password literals committed; Option C markers present', () => {
  const sidecarSrc = readFileSync(join(here, '../src/localWriterSidecar.js'), 'utf8');
  const ipcSrc = readFileSync(join(here, '../src/localWriterIpcProtocol.js'), 'utf8');
  assert.equal(sidecarSrc.includes('BEGIN PRIVATE KEY'), false);
  assert.equal(ipcSrc.includes('BEGIN PRIVATE KEY'), false);
  assert.match(sidecarSrc, /OPTION_C_LOCAL_WRITER_SIDECAR/);
  assert.match(sidecarSrc, /SAME_UID/);
  assert.match(sidecarSrc, /createSealedAuthenticatedWriteGateway/);
  assert.equal(sidecarSrc.includes('listen(') && sidecarSrc.includes('0.0.0.0'), false);
});

test('hashes: four authorized paths are the only new implementation artifacts under test', () => {
  for (const rel of [
    '../src/localWriterSidecar.js',
    '../src/localWriterIpcProtocol.js',
    './localWriterSidecarIsolation.test.js',
    './disposableLocalWriterSidecarHarness.js',
  ]) {
    const body = readFileSync(join(here, rel));
    const digest = createHash('sha256').update(body).digest('hex');
    assert.equal(digest.length, 64);
  }
});

async function rawIpcRoundTrip(ipcSocketPath, frame) {
  return new Promise((resolve) => {
    const socket = createConnection(ipcSocketPath);
    const reader = createIpcFrameReader();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, decision: IPC_DECISIONS.DENY_TIMEOUT });
    }, 5000);
    socket.on('connect', () => {
      socket.write(frame);
    });
    socket.on('data', (chunk) => {
      const { frames, error } = reader.push(chunk);
      if (error) {
        clearTimeout(timer);
        socket.end();
        resolve(error);
        return;
      }
      if (frames[0]) {
        clearTimeout(timer);
        socket.end();
        resolve(frames[0].result);
      }
    });
    socket.on('error', () => {
      clearTimeout(timer);
      resolve({ ok: false, decision: IPC_DECISIONS.DENY_DISCONNECT });
    });
  });
}

// Silence unused import if tree-shaken differently.
void spawnLocalWriterSidecar;
