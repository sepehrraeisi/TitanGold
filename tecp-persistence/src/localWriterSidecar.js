/**
 * TECP-DLP-010 — Option C dedicated local authenticated writer sidecar
 * (TEST_ONLY / NON_OPERATIONAL disposable proof).
 *
 * Privileged PostgreSQL writer Client + SCRAM credential live ONLY in the
 * child process. Callers receive a narrow Unix-domain IPC handle that never
 * exposes password, writer Client, policy providers, or branded trust roots.
 *
 * Independent authorization is rebuilt inside the sidecar for every bind/release
 * via frozen DLP-008 createSealedAuthenticatedWriteGateway (import only).
 *
 * Explicit NON-CLAIMS:
 * - SAME_UID / ptrace / stolen credentials = NOT_SEALED
 * - Real Worker / OS principal auth = NOT_PROVEN
 * - Production R1 / C24 real deadlock = NOT_PROVEN
 */

import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import {
  unlinkSync,
  chmodSync,
  createReadStream,
  lstatSync,
  realpathSync,
  readFileSync,
  fstatSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, sep, isAbsolute, basename } from 'node:path';
import pg from 'pg';

import {
  APPROVED_GOVERNANCE_REVISION as DLP006_REV,
  createTrustedAuthorizationPolicy,
  createTrustedAuthorizationPolicyProvider,
} from '../../tecp/src/authorizedInvocation.js';
import {
  CAPABILITY_ACTIONS,
  CAPABILITY_STAGES,
  createInjectedClock,
  createInMemoryIssuerKeyRegistry,
  createInMemoryRevocationRegistry,
} from '../../tecp/src/workerCapabilityToken.js';
import {
  ATTESTATION_KINDS,
  createTestOnlyAttestationVerifier,
  verifyWorkerPrincipal,
} from '../../tecp/src/workerIdentity.js';
import {
  createSealedAuthenticatedWriteGateway,
  attestWriterSession,
  APPROVED_GOVERNANCE_REVISION as DLP008_REV,
  SEALED_GATEWAY_KIND,
} from './sealedAuthenticatedWriteGateway.js';
import {
  IPC_PROTOCOL_VERSION,
  IPC_PROTOCOL_KIND,
  IPC_OPS,
  IPC_DECISIONS,
  encodeIpcFrame,
  createIpcFrameReader,
  validateIpcRequest,
  buildIpcRequest,
  buildIpcResponse,
  createRequestReplayGuard,
  sanitizeIpcResult,
} from './localWriterIpcProtocol.js';

const { Client } = pg;

export const SIDECAR_KIND = 'TECP_DLP010_LOCAL_WRITER_SIDECAR';
export const SIDECAR_ARCHITECTURE = 'OPTION_C_LOCAL_WRITER_SIDECAR';
export const APPROVED_GOVERNANCE_REVISION = 'DLP010_AUTHORIZATION_20261103';

export const SIDECAR_DECISIONS = Object.freeze({
  READY: 'READY',
  DENY_BOOTSTRAP: 'DENY_BOOTSTRAP',
  DENY_STARTUP: 'DENY_STARTUP',
  DENY_NOT_READY: 'DENY_NOT_READY',
  DENY_SHUTDOWN: 'DENY_SHUTDOWN',
  DENY_CRASH: 'DENY_CRASH',
  ...IPC_DECISIONS,
});

export const IPC_OWNERSHIP_MARKER = '.tecp-dlp010-sidecar-harness';
export const IPC_OWNERSHIP_MAGIC = 'TECP-DLP-010-DISPOSABLE';
const SOCKET_MODE = 0o600;
const WORKER_FLAG = '--tecp-dlp010-sidecar-worker';
const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function denyResult(decision, reasons = [decision]) {
  return Object.freeze({
    ok: false,
    decision,
    reasons: Object.freeze([...reasons]),
    sidecar: true,
    kind: SIDECAR_KIND,
    architecture: SIDECAR_ARCHITECTURE,
    governanceRevision: APPROVED_GOVERNANCE_REVISION,
    operational: false,
    sameUidSealed: false,
    realWorkerAuthenticated: false,
    productionSealed: false,
  });
}

function assertNoAmbientDatabaseEnv() {
  for (const name of Object.keys(process.env)) {
    if (name === 'DATABASE_URL'
      || /^(PGHOST|PGPORT|PGDATABASE|PGUSER|PGPASSWORD|POSTGRES_)/i.test(name)) {
      throw new Error('BLOCKED: DLP010_AMBIENT_DATABASE_CONFIGURATION');
    }
  }
}

function redactError() {
  return denyResult(SIDECAR_DECISIONS.DENY_OPERATION, ['FAIL_CLOSED_SANITIZED']);
}

function ownershipError(code) {
  const err = new Error(`BLOCKED: DLP010_${code}`);
  err.code = code;
  return err;
}

/**
 * Prove that candidatePath is a non-escaping absolute path under an owned
 * harness root that contains the disposable ownership marker.
 * Uses lstat/realpath and refuses symlinked roots or path escapes.
 */
export function assertOwnedIpcPath(ownedRoot, candidatePath) {
  if (!isNonEmptyString(ownedRoot) || !isAbsolute(ownedRoot)) {
    throw ownershipError('IPC_OWNED_ROOT_INVALID');
  }
  if (!isNonEmptyString(candidatePath) || !isAbsolute(candidatePath)) {
    throw ownershipError('IPC_SOCKET_PATH_INVALID');
  }
  let rootStat;
  try {
    rootStat = lstatSync(ownedRoot);
  } catch {
    throw ownershipError('IPC_OWNED_ROOT_MISSING');
  }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw ownershipError('IPC_OWNED_ROOT_NOT_DIRECTORY');
  }
  let rootReal;
  try {
    rootReal = realpathSync(ownedRoot);
  } catch {
    throw ownershipError('IPC_OWNED_ROOT_REALPATH_FAILED');
  }
  const markerPath = join(rootReal, IPC_OWNERSHIP_MARKER);
  let markerStat;
  try {
    markerStat = lstatSync(markerPath);
  } catch {
    throw ownershipError('IPC_OWNERSHIP_MARKER_MISSING');
  }
  if (!markerStat.isFile() || markerStat.isSymbolicLink()) {
    throw ownershipError('IPC_OWNERSHIP_MARKER_INVALID');
  }
  const magic = readFileSync(markerPath, 'utf8');
  if (!magic.startsWith(IPC_OWNERSHIP_MAGIC)) {
    throw ownershipError('IPC_OWNERSHIP_MARKER_MAGIC_MISMATCH');
  }
  const base = basename(candidatePath);
  if (!base || base === '.' || base === '..' || base.includes('\0') || base.includes(sep)) {
    throw ownershipError('IPC_SOCKET_BASENAME_INVALID');
  }
  let parentReal;
  try {
    parentReal = realpathSync(dirname(candidatePath));
  } catch {
    throw ownershipError('IPC_SOCKET_PARENT_MISSING');
  }
  if (parentReal !== rootReal) {
    throw ownershipError('IPC_SOCKET_OUTSIDE_OWNED_ROOT');
  }
  return Object.freeze({
    ownedRootReal: rootReal,
    socketPath: join(rootReal, base),
    markerPath,
  });
}

/**
 * Remove a path only when it is a non-symlink Unix socket under the verified
 * owned root and owned by the current uid. Unexpected types/symlinks fail closed.
 */
export function safeUnlinkOwnedSocket(ownedRoot, candidatePath) {
  const owned = assertOwnedIpcPath(ownedRoot, candidatePath);
  let st;
  try {
    st = lstatSync(owned.socketPath);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return Object.freeze({ removed: false, reason: 'ABSENT' });
    }
    throw ownershipError('IPC_SOCKET_LSTAT_FAILED');
  }
  if (st.isSymbolicLink()) {
    throw ownershipError('IPC_SOCKET_IS_SYMLINK');
  }
  if (!st.isSocket()) {
    throw ownershipError('IPC_PATH_NOT_SOCKET');
  }
  if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
    throw ownershipError('IPC_SOCKET_UID_MISMATCH');
  }
  // Re-lstat immediately before unlink; require stable inode identity.
  const st2 = lstatSync(owned.socketPath);
  if (st2.isSymbolicLink() || !st2.isSocket()
    || (typeof process.getuid === 'function' && st2.uid !== process.getuid())
    || st2.ino !== st.ino || st2.dev !== st.dev) {
    throw ownershipError('IPC_SOCKET_RACE_OR_TYPE_CHANGE');
  }
  unlinkSync(owned.socketPath);
  return Object.freeze({ removed: true, reason: 'OWNED_SOCKET_REMOVED' });
}

/**
 * Verify socket mode/owner after listen. Fail closed if not exclusive to uid.
 */
export function assertSocketPermissions(socketPath, expectedUid = process.getuid?.()) {
  let st;
  try {
    st = lstatSync(socketPath);
  } catch {
    throw ownershipError('IPC_SOCKET_MISSING_AFTER_LISTEN');
  }
  if (st.isSymbolicLink()) {
    throw ownershipError('IPC_SOCKET_BECAME_SYMLINK');
  }
  if (!st.isSocket()) {
    throw ownershipError('IPC_PATH_NOT_SOCKET_AFTER_LISTEN');
  }
  if (expectedUid != null && st.uid !== expectedUid) {
    throw ownershipError('IPC_SOCKET_UID_MISMATCH_AFTER_LISTEN');
  }
  const mode = st.mode & 0o777;
  if (mode !== SOCKET_MODE) {
    throw ownershipError('IPC_SOCKET_MODE_NOT_0600');
  }
  return Object.freeze({ mode, uid: st.uid });
}

function tokensEqual(a, b) {
  if (!isNonEmptyString(a) || !isNonEmptyString(b)) return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/* -------------------------------------------------------------------------- */
/* Child worker                                                               */
/* -------------------------------------------------------------------------- */

async function runSidecarWorker() {
  assertNoAmbientDatabaseEnv();
  let bootstrap;
  try {
    const raw = await readStdinOnce(2_000_000);
    bootstrap = JSON.parse(raw);
  } catch {
    process.stderr.write('DLP010_SIDECAR_BOOTSTRAP_PARSE_FAILED\n');
    process.exit(2);
  }

  const validated = validateBootstrap(bootstrap);
  if (!validated.ok) {
    process.stderr.write('DLP010_SIDECAR_BOOTSTRAP_INVALID\n');
    process.exit(2);
  }
  const cfg = validated.config;

  // Drop any accidental env credentials after bootstrap parse.
  delete process.env.PGPASSWORD;
  delete process.env.DATABASE_URL;

  let writerClient = null;
  let gateway = null;
  let server = null;
  let shuttingDown = false;
  let currentPolicy = null;
  const replayGuard = createRequestReplayGuard();
  const sockets = new Set();
  // Serialize all privileged writer operations across IPC connections.
  let writerChain = Promise.resolve();
  function withWriterLock(fn) {
    const run = writerChain.then(fn, fn);
    writerChain = run.then(() => undefined, () => undefined);
    return run;
  }

  async function shutdownWorker(exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      for (const sock of sockets) {
        try { sock.destroy(); } catch { /* ignore */ }
      }
      sockets.clear();
      if (server) {
        await new Promise((resolve) => server.close(() => resolve()));
        server = null;
      }
      try {
        if (cfg.ipcOwnedRoot && cfg.ipcSocketPath) {
          safeUnlinkOwnedSocket(cfg.ipcOwnedRoot, cfg.ipcSocketPath);
        }
      } catch { /* best-effort owned unlink */ }
      await safeEndClient(writerClient);
      writerClient = null;
      gateway = null;
    } finally {
      process.exit(exitCode);
    }
  }

  // Keepalive fd3 must be bound BEFORE privileged PG connect / READY.
  try {
    const st = fstatSync(3);
    if (!st.isFIFO() && !st.isSocket()) {
      throw new Error('KEEPALIVE_FD_NOT_PIPE');
    }
    const keepalive = createReadStream(null, { fd: 3, autoClose: true });
    keepalive.on('end', () => { void shutdownWorker(0); });
    keepalive.on('error', () => { void shutdownWorker(0); });
    keepalive.resume();
  } catch {
    process.stderr.write('DLP010_SIDECAR_KEEPALIVE_REQUIRED\n');
    process.exit(4);
  }

  const verifier = createTestOnlyAttestationVerifier();
  for (const attestation of cfg.trust.acceptedAttestations) {
    verifier.registerAccepted(attestation);
  }
  const principalResult = verifyWorkerPrincipal(
    { attestation: cfg.trust.acceptedAttestations[0] },
    { verifyAttestation: verifier.verifyAttestation },
  );
  if (!principalResult.allowed) {
    process.stderr.write('DLP010_SIDECAR_PRINCIPAL_FAILED\n');
    process.exit(2);
  }
  const principal = principalResult.principal;

  const keyRegistry = createInMemoryIssuerKeyRegistry([
    {
      issuer: cfg.trust.issuer,
      kid: cfg.trust.kid,
      algorithm: 'Ed25519',
      publicKeyPem: cfg.trust.publicKeyPem,
      // Verify-only: private key intentionally absent in sidecar.
      status: 'ACTIVE',
    },
  ]);
  const revocationRegistry = createInMemoryRevocationRegistry();
  revocationRegistry.setCurrentRevocationGeneration(cfg.trust.revocationGeneration);
  if (Array.isArray(cfg.trust.revokedJtis)) {
    for (const jti of cfg.trust.revokedJtis) {
      revocationRegistry.revokeJti(jti);
    }
  }
  // Advance the injected clock from wall-time so TTL expiry is enforced inside a
  // live sidecar process (not only across respawns with a new clockStartMs).
  const clock = createInjectedClock(cfg.trust.clockStartMs);
  const clockOriginWallMs = Date.now();
  const clockOriginLogicalMs = cfg.trust.clockStartMs;
  function syncClockFromWall() {
    const delta = Date.now() - clockOriginWallMs;
    if (Number.isSafeInteger(delta) && delta >= 0) {
      clock.set(clockOriginLogicalMs + delta);
    }
  }
  const capabilityDeps = { keyRegistry, revocationRegistry, clock };

  currentPolicy = createTrustedAuthorizationPolicy({
    governanceRevision: DLP006_REV,
    audience: cfg.trust.audience,
    operations: cfg.trust.operations,
  });
  const policyProvider = createTrustedAuthorizationPolicyProvider(() => currentPolicy);

  writerClient = new Client({
    host: cfg.pg.host,
    port: cfg.pg.port,
    user: cfg.pg.user,
    database: cfg.pg.database,
    password: cfg.pg.password,
    connectionTimeoutMillis: 5000,
    application_name: 'tecp_dlp010_writer_sidecar',
  });

  // Zeroize bootstrap password reference after Client construction.
  cfg.pg.password = null;
  bootstrap = null;

  try {
    await writerClient.connect();
    const identity = await writerClient.query(
      `SELECT session_user::text AS session_user,
              current_user::text AS current_user,
              pg_backend_pid()::int AS backend_pid`,
    );
    const sessionAttestation = {
      sessionUser: identity.rows[0].session_user,
      currentUser: identity.rows[0].current_user,
      backendPid: Number(identity.rows[0].backend_pid),
    };
    if (sessionAttestation.sessionUser !== cfg.pg.user) {
      throw new Error('WRITER_ROLE_MISMATCH');
    }
    await attestWriterSession(writerClient, sessionAttestation);

    gateway = createSealedAuthenticatedWriteGateway({
      writerClient,
      writerSessionAttestation: sessionAttestation,
      getVerifiedPrincipal: () => principal,
      policyProvider,
      capabilityDeps,
      operationContracts: Object.freeze({ ...cfg.trust.operationContracts }),
    });
  } catch {
    await safeEndClient(writerClient);
    process.stderr.write('DLP010_SIDECAR_WRITER_CONNECT_FAILED\n');
    process.exit(3);
  }

  function installReleasePolicyFromBind(bindResult) {
    if (!bindResult || bindResult.ok !== true || !bindResult.lease) return;
    const leaseKey = bindResult.lease.leaseKey;
    const taskId = bindResult.lease.taskId || bindResult.authorization?.taskId;
    const resourceType = bindResult.lease.resourceType || bindResult.authorization?.resourceType;
    const resourceId = bindResult.lease.resourceKey || bindResult.authorization?.resourceId;
    if (!isNonEmptyString(leaseKey) || !isNonEmptyString(taskId)
      || !isNonEmptyString(resourceType) || !isNonEmptyString(resourceId)) {
      return;
    }
    const bootstrapOps = cfg.trust.operations.filter(
      (op) => op.capabilityStage === CAPABILITY_STAGES.BOOTSTRAP_REQUEST,
    );
    currentPolicy = createTrustedAuthorizationPolicy({
      governanceRevision: DLP006_REV,
      audience: cfg.trust.audience,
      operations: [
        ...bootstrapOps,
        {
          operationKey: 'lease-release',
          capabilityStage: CAPABILITY_STAGES.LEASE_BOUND,
          action: CAPABILITY_ACTIONS.RELEASE_TASK,
          taskId,
          resourceType,
          resourceId,
          leaseId: leaseKey,
        },
      ],
    });
  }

  async function handleRequest(request) {
    const validatedReq = validateIpcRequest(request);
    if (!validatedReq.ok) {
      return buildIpcResponse(request?.requestId || 'unknown', validatedReq);
    }
    const replay = replayGuard.observe(validatedReq.request.requestId);
    if (!replay.ok) {
      return buildIpcResponse(validatedReq.request.requestId, replay);
    }

    const { op, body, requestId } = validatedReq.request;
    if (op === IPC_OPS.HELLO) {
      return buildIpcResponse(requestId, Object.freeze({
        ok: true,
        decision: SIDECAR_DECISIONS.READY,
        reasons: Object.freeze([]),
        sidecar: true,
        kind: SIDECAR_KIND,
        architecture: SIDECAR_ARCHITECTURE,
        governanceRevision: APPROVED_GOVERNANCE_REVISION,
        sealedGatewayKind: SEALED_GATEWAY_KIND,
        sealedGatewayRevision: DLP008_REV,
        protocolVersion: IPC_PROTOCOL_VERSION,
        pid: process.pid,
        operational: false,
        sameUidSealed: false,
        realWorkerAuthenticated: false,
        productionSealed: false,
      }));
    }
    if (op === IPC_OPS.PING) {
      return buildIpcResponse(requestId, Object.freeze({
        ok: true,
        decision: 'PONG',
        reasons: Object.freeze([]),
        pid: process.pid,
      }));
    }
    if (op === IPC_OPS.SHUTDOWN) {
      if (!tokensEqual(body.shutdownToken, cfg.shutdownToken)) {
        return buildIpcResponse(requestId, denyResult(
          IPC_DECISIONS.DENY_UNAUTHENTICATED_SHUTDOWN,
          ['SHUTDOWN_TOKEN_MISMATCH'],
        ));
      }
      // Respond first; actual exit scheduled after write.
      setImmediate(() => {
        void shutdownWorker();
      });
      return buildIpcResponse(requestId, Object.freeze({
        ok: true,
        decision: 'SHUTTING_DOWN',
        reasons: Object.freeze([]),
      }));
    }
    if (op === IPC_OPS.BIND) {
      return withWriterLock(async () => {
        try {
          syncClockFromWall();
          const out = await gateway.executeSealedBind({
            capabilityToken: body.capabilityToken,
            operationKey: body.operationKey,
            idempotency: body.idempotency,
          });
          installReleasePolicyFromBind(out);
          return buildIpcResponse(requestId, sanitizeIpcResult({
            ...out,
            sidecar: true,
            kind: SIDECAR_KIND,
            architecture: SIDECAR_ARCHITECTURE,
          }));
        } catch {
          return buildIpcResponse(requestId, redactError());
        }
      });
    }
    if (op === IPC_OPS.RELEASE) {
      return withWriterLock(async () => {
        try {
          syncClockFromWall();
          const out = await gateway.executeSealedRelease({
            capabilityToken: body.capabilityToken,
            operationKey: body.operationKey,
            idempotency: body.idempotency,
          });
          return buildIpcResponse(requestId, sanitizeIpcResult({
            ...out,
            sidecar: true,
            kind: SIDECAR_KIND,
            architecture: SIDECAR_ARCHITECTURE,
          }));
        } catch {
          return buildIpcResponse(requestId, redactError());
        }
      });
    }
    return buildIpcResponse(requestId, denyResult(IPC_DECISIONS.DENY_UNKNOWN_OP));
  }

  try {
    const ownedSocket = assertOwnedIpcPath(cfg.ipcOwnedRoot, cfg.ipcSocketPath);
    cfg.ipcSocketPath = ownedSocket.socketPath;
    // Stale owned socket only; symlinks / non-sockets throw and abort startup.
    safeUnlinkOwnedSocket(cfg.ipcOwnedRoot, cfg.ipcSocketPath);
  } catch {
    process.stderr.write('DLP010_SIDECAR_SOCKET_OWNERSHIP_FAILED\n');
    await safeEndClient(writerClient);
    process.exit(5);
  }

  // Create the server without a connection listener first so no peer can be
  // accepted until mode 0600 is proven. Bind under a restrictive umask.
  server = createServer();
  const previousUmask = process.umask(0o177);
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(cfg.ipcSocketPath, () => resolve());
    });
    chmodSync(cfg.ipcSocketPath, SOCKET_MODE);
    assertSocketPermissions(cfg.ipcSocketPath);
  } catch {
    process.umask(previousUmask);
    process.stderr.write('DLP010_SIDECAR_SOCKET_PERMISSION_FAILED\n');
    await shutdownWorker(6);
    return;
  }
  process.umask(previousUmask);

  function attachIpcSocket(socket) {
    sockets.add(socket);
    try {
      socket.setNoDelay?.(true);
    } catch { /* ignore */ }
    const reader = createIpcFrameReader();
    let busy = Promise.resolve();

    socket.on('data', (chunk) => {
      busy = busy.then(async () => {
        const { frames, error } = reader.push(chunk);
        if (error) {
          try {
            socket.write(encodeIpcFrame(buildIpcResponse('invalid', error)));
          } catch { /* ignore */ }
          socket.destroy();
          return;
        }
        for (const frame of frames) {
          const response = await handleRequest(frame);
          try {
            socket.write(encodeIpcFrame(response));
          } catch {
            socket.destroy();
            return;
          }
        }
      }).catch(() => {
        socket.destroy();
      });
    });

    socket.on('close', () => {
      sockets.delete(socket);
      const trunc = reader.markTruncated();
      void trunc;
    });
    socket.on('error', () => {
      sockets.delete(socket);
    });
  }

  // Arm connection handling only after exclusive 0600 mode is proven.
  server.on('connection', attachIpcSocket);

  process.on('SIGTERM', () => { void shutdownWorker(); });
  process.on('SIGINT', () => { void shutdownWorker(); });

  process.stdout.write('DLP010_SIDECAR_READY\n');
}

function validateBootstrap(bootstrap) {
  if (!isPlainObject(bootstrap)
    || bootstrap.kind !== SIDECAR_KIND
    || bootstrap.protocolVersion !== IPC_PROTOCOL_VERSION
    || !isPlainObject(bootstrap.pg)
    || !isPlainObject(bootstrap.trust)
    || !isNonEmptyString(bootstrap.ipcSocketPath)
    || !isNonEmptyString(bootstrap.ipcOwnedRoot)
    || !isNonEmptyString(bootstrap.shutdownToken)
    || bootstrap.shutdownToken.length < 32) {
    return { ok: false };
  }
  const pgCfg = bootstrap.pg;
  if (!isNonEmptyString(pgCfg.host)
    || !Number.isSafeInteger(pgCfg.port)
    || !isNonEmptyString(pgCfg.user)
    || !isNonEmptyString(pgCfg.database)
    || !isNonEmptyString(pgCfg.password)) {
    return { ok: false };
  }
  const trust = bootstrap.trust;
  if (!isNonEmptyString(trust.audience)
    || !isNonEmptyString(trust.issuer)
    || !isNonEmptyString(trust.kid)
    || !isNonEmptyString(trust.publicKeyPem)
    || !Array.isArray(trust.acceptedAttestations)
    || trust.acceptedAttestations.length < 1
    || !Array.isArray(trust.operations)
    || trust.operations.length < 1
    || !isPlainObject(trust.operationContracts)
    || !Number.isSafeInteger(trust.clockStartMs)
    || !Number.isSafeInteger(trust.revocationGeneration)) {
    return { ok: false };
  }
  // Reject private key / password fields in trust blob (credentials only in pg.password).
  if (Object.prototype.hasOwnProperty.call(trust, 'privateKeyPem')
    || Object.prototype.hasOwnProperty.call(trust, 'password')
    || Object.prototype.hasOwnProperty.call(trust, 'writerClient')) {
    return { ok: false };
  }
  // Nested secret keys anywhere under trust are forbidden (fail closed).
  const trustJson = JSON.stringify(trust);
  if (/privateKeyPem|"password"|writerClient|BEGIN [A-Z ]*PRIVATE KEY/i.test(trustJson)) {
    return { ok: false };
  }
  for (const attestation of trust.acceptedAttestations) {
    if (!isPlainObject(attestation)
      || attestation.attestationKind !== ATTESTATION_KINDS.TEST_ONLY) {
      return { ok: false };
    }
  }
  try {
    assertOwnedIpcPath(bootstrap.ipcOwnedRoot, bootstrap.ipcSocketPath);
  } catch {
    return { ok: false };
  }
  return {
    ok: true,
    config: {
      ipcSocketPath: bootstrap.ipcSocketPath,
      ipcOwnedRoot: bootstrap.ipcOwnedRoot,
      shutdownToken: bootstrap.shutdownToken,
      pg: {
        host: pgCfg.host,
        port: pgCfg.port,
        user: pgCfg.user,
        database: pgCfg.database,
        password: pgCfg.password,
      },
      trust: {
        audience: trust.audience,
        issuer: trust.issuer,
        kid: trust.kid,
        publicKeyPem: trust.publicKeyPem,
        acceptedAttestations: trust.acceptedAttestations.map((a) => Object.freeze({ ...a })),
        operations: trust.operations.map((o) => Object.freeze({ ...o })),
        operationContracts: Object.freeze({ ...trust.operationContracts }),
        clockStartMs: trust.clockStartMs,
        revocationGeneration: trust.revocationGeneration,
        revokedJtis: Array.isArray(trust.revokedJtis) ? [...trust.revokedJtis] : [],
      },
    },
  };
}

function readStdinOnce(maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('BOOTSTRAP_STDIN_TIMEOUT'));
      }
    }, 10_000);
    process.stdin.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error('BOOTSTRAP_STDIN_TOO_LARGE'));
        }
        return;
      }
      chunks.push(chunk);
    });
    process.stdin.on('end', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(Buffer.concat(chunks).toString('utf8'));
      }
    });
    process.stdin.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

async function safeEndClient(client) {
  if (!client) return;
  try { await client.end(); } catch { /* ignore */ }
}

/* -------------------------------------------------------------------------- */
/* Parent API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Spawn a dedicated local writer sidecar child process.
 *
 * @param {object} options
 * @param {object} options.pg connection params including password (consumed; not retained on handle)
 * @param {object} options.trust verify-only trust material (no private key / no password)
 * @param {string} options.ipcSocketPath absolute path for Unix IPC socket
 * @param {string} [options.modulePath]
 * @param {number} [options.requestTimeoutMs]
 */
export async function spawnLocalWriterSidecar(options) {
  assertNoAmbientDatabaseEnv();
  if (!isPlainObject(options)
    || !isPlainObject(options.pg)
    || !isPlainObject(options.trust)
    || !isNonEmptyString(options.ipcSocketPath)
    || !isNonEmptyString(options.ipcOwnedRoot)) {
    throw new TypeError('spawnLocalWriterSidecar: invalid options');
  }
  if (!isNonEmptyString(options.pg.password)) {
    throw new TypeError('spawnLocalWriterSidecar: writer password required for child only');
  }
  if (Object.prototype.hasOwnProperty.call(options.trust, 'privateKeyPem')) {
    throw new TypeError('spawnLocalWriterSidecar: privateKeyPem must not enter sidecar trust');
  }

  const modulePath = options.modulePath || join(HERE, 'localWriterSidecar.js');
  const requestTimeoutMs = options.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
  const owned = assertOwnedIpcPath(options.ipcOwnedRoot, options.ipcSocketPath);
  const ipcSocketPath = owned.socketPath;
  const ipcOwnedRoot = owned.ownedRootReal;
  const shutdownToken = randomBytes(32).toString('hex');

  // Only remove a verified owned stale socket; never unlink arbitrary/symlink paths.
  safeUnlinkOwnedSocket(ipcOwnedRoot, ipcSocketPath);

  const bootstrap = {
    kind: SIDECAR_KIND,
    protocolVersion: IPC_PROTOCOL_VERSION,
    ipcSocketPath,
    ipcOwnedRoot,
    shutdownToken,
    pg: {
      host: options.pg.host,
      port: options.pg.port,
      user: options.pg.user,
      database: options.pg.database,
      password: options.pg.password,
    },
    trust: {
      audience: options.trust.audience,
      issuer: options.trust.issuer,
      kid: options.trust.kid,
      publicKeyPem: options.trust.publicKeyPem,
      acceptedAttestations: options.trust.acceptedAttestations,
      operations: options.trust.operations,
      operationContracts: options.trust.operationContracts,
      clockStartMs: options.trust.clockStartMs,
      revocationGeneration: options.trust.revocationGeneration ?? 0,
      revokedJtis: options.trust.revokedJtis || [],
    },
  };

  // Scrub caller-visible password reference after copy into bootstrap.
  options.pg.password = null;

  const child = spawn(process.execPath, [modulePath, WORKER_FLAG], {
    // fd0 stdin bootstrap, fd1 ready, fd2 stderr, fd3 parent-alive keepalive
    stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      LANG: process.env.LANG,
      NODE_OPTIONS: '',
    },
    detached: false,
  });

  if (!child.stdio || !child.stdio[3]) {
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
    throw new Error('DLP010_SIDECAR_KEEPALIVE_FD_MISSING');
  }

  let stderrBuf = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderrBuf += chunk;
    if (stderrBuf.length > 4096) stderrBuf = stderrBuf.slice(-4096);
  });

  child.stdin.write(JSON.stringify(bootstrap));
  child.stdin.end();
  // Drop bootstrap password / shutdown token copies from parent bootstrap object.
  bootstrap.pg.password = null;

  try {
    await waitForReady(child, 20_000);
  } catch (err) {
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
    try { safeUnlinkOwnedSocket(ipcOwnedRoot, ipcSocketPath); } catch { /* ignore */ }
    throw err;
  }

  // Prove restrictive socket mode before handing out a caller handle.
  try {
    assertSocketPermissions(ipcSocketPath);
  } catch (err) {
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
    try { safeUnlinkOwnedSocket(ipcOwnedRoot, ipcSocketPath); } catch { /* ignore */ }
    throw err;
  }

  const session = createParentSession({
    ipcSocketPath,
    ipcOwnedRoot,
    child,
    requestTimeoutMs,
    keepaliveFd: child.stdio[3],
    shutdownToken,
  });
  // Clear local token binding after capture into session closure.
  // (session holds the only parent copy used for authenticated SHUTDOWN.)

  // Prove HELLO before returning handle.
  const hello = await session.request(IPC_OPS.HELLO, {});
  if (!hello || hello.ok !== true || hello.decision !== SIDECAR_DECISIONS.READY) {
    await session.shutdown();
    throw new Error('DLP010_SIDECAR_HELLO_FAILED');
  }

  const handle = {
    kind: SIDECAR_KIND,
    architecture: SIDECAR_ARCHITECTURE,
    governanceRevision: APPROVED_GOVERNANCE_REVISION,
    operational: false,
    sameUidSealed: false,
    realWorkerAuthenticated: false,
    productionSealed: false,
    pid: child.pid,
    ipcSocketPath,
    ipcOwnedRoot,
    /** @returns {Promise<object>} */
    bind: (body) => session.request(IPC_OPS.BIND, body),
    /** @returns {Promise<object>} */
    release: (body) => session.request(IPC_OPS.RELEASE, body),
    /** @returns {Promise<object>} */
    ping: () => session.request(IPC_OPS.PING, {}),
    /** @returns {Promise<object>} */
    shutdown: () => session.shutdown(),
    getChildExitCode: () => child.exitCode,
  };
  if (options.enableTestHooks === true) {
    handle.testHooks = Object.freeze({
      /** TEST_ONLY: simulate abrupt parent death by closing keepalive fd3. */
      endKeepalive: () => {
        const fd = child.stdio[3];
        if (fd && typeof fd.end === 'function') fd.end();
        else if (fd && typeof fd.destroy === 'function') fd.destroy();
      },
      /** TEST_ONLY: raw SHUTDOWN without the parent session token helper. */
      rawShutdownAttempt: (token) => session.request(
        IPC_OPS.SHUTDOWN,
        { shutdownToken: token },
        { allowDuringShutdown: true },
      ),
    });
  }
  return Object.freeze(handle);
}

function waitForReady(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = '';
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
        reject(new Error('DLP010_SIDECAR_READY_TIMEOUT'));
      }
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.includes('DLP010_SIDECAR_READY')) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      }
    });
    child.on('exit', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`DLP010_SIDECAR_EXIT_BEFORE_READY:${code}`));
      }
    });
    child.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

function createParentSession({
  ipcSocketPath,
  ipcOwnedRoot,
  child,
  requestTimeoutMs,
  keepaliveFd = null,
  shutdownToken,
}) {
  let socket = null;
  let reader = createIpcFrameReader();
  let chain = Promise.resolve();
  const pending = new Map();
  let closed = false;
  let shutdownSent = false;
  const parentShutdownToken = shutdownToken;

  function ensureConnected() {
    if (socket && !socket.destroyed) return Promise.resolve({ ok: true });
    return new Promise((resolve) => {
      const s = createConnection(ipcSocketPath);
      const timer = setTimeout(() => {
        s.destroy();
        resolve({
          ok: false,
          result: denyResult(IPC_DECISIONS.DENY_TIMEOUT, ['IPC_CONNECT_TIMEOUT']),
        });
      }, 5000);
      s.once('connect', () => {
        clearTimeout(timer);
        socket = s;
        reader = createIpcFrameReader();
        socket.on('data', (chunk) => {
          const { frames, error } = reader.push(chunk);
          if (error) {
            failAllPending(error);
            socket.destroy();
            return;
          }
          for (const frame of frames) {
            if (!isPlainObject(frame) || !isNonEmptyString(frame.requestId)) continue;
            const wait = pending.get(frame.requestId);
            if (!wait) continue;
            pending.delete(frame.requestId);
            clearTimeout(wait.timer);
            wait.resolve(frame.result);
          }
        });
        socket.on('close', () => {
          failAllPending(denyResult(IPC_DECISIONS.DENY_DISCONNECT));
          socket = null;
        });
        socket.on('error', () => {
          failAllPending(denyResult(IPC_DECISIONS.DENY_DISCONNECT));
        });
        resolve({ ok: true });
      });
      s.once('error', () => {
        clearTimeout(timer);
        resolve({
          ok: false,
          result: denyResult(IPC_DECISIONS.DENY_DISCONNECT, ['IPC_CONNECT_REFUSED']),
        });
      });
    });
  }

  function failAllPending(result) {
    for (const [, wait] of pending) {
      clearTimeout(wait.timer);
      wait.resolve(result);
    }
    pending.clear();
  }

  function request(op, body, options = {}) {
    const run = async () => {
      if (closed && options.allowDuringShutdown !== true) {
        return denyResult(SIDECAR_DECISIONS.DENY_SHUTDOWN);
      }
      if (child.exitCode != null || child.killed) {
        return denyResult(SIDECAR_DECISIONS.DENY_CRASH, ['SIDECAR_PROCESS_EXITED']);
      }
      const connected = await ensureConnected();
      if (!connected.ok) return connected.result;
      const requestId = randomUUID();
      const envelope = buildIpcRequest(op, requestId, body);
      const validated = validateIpcRequest(envelope);
      if (!validated.ok) return validated;

      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          resolve(denyResult(IPC_DECISIONS.DENY_TIMEOUT));
        }, requestTimeoutMs);
        pending.set(requestId, { resolve, timer });
        try {
          socket.write(encodeIpcFrame(envelope));
        } catch {
          clearTimeout(timer);
          pending.delete(requestId);
          resolve(denyResult(IPC_DECISIONS.DENY_DISCONNECT));
        }
      });
    };
    const next = chain.then(run, run);
    chain = next.then(() => undefined, () => undefined);
    return next;
  }

  async function shutdown() {
    if (closed && shutdownSent) {
      return Object.freeze({ ok: true, alreadyStopped: true });
    }
    try {
      if (child.exitCode == null && !shutdownSent) {
        shutdownSent = true;
        try {
          // Authenticated SHUTDOWN — unauthenticated callers cannot supply this token.
          await request(
            IPC_OPS.SHUTDOWN,
            { shutdownToken: parentShutdownToken },
            { allowDuringShutdown: true },
          );
        } catch { /* fall through to keepalive close / kill */ }
        await waitForChildExit(child, 5000);
      }
    } finally {
      closed = true;
      // Closing keepalive notifies the child even if SHUTDOWN IPC failed.
      if (keepaliveFd && typeof keepaliveFd.end === 'function') {
        try { keepaliveFd.end(); } catch { /* ignore */ }
      } else if (keepaliveFd && typeof keepaliveFd.destroy === 'function') {
        try { keepaliveFd.destroy(); } catch { /* ignore */ }
      }
      await waitForChildExit(child, 2000);
      if (child.exitCode == null) {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
        await waitForChildExit(child, 2000);
      }
      if (socket) {
        try { socket.destroy(); } catch { /* ignore */ }
        socket = null;
      }
      try {
        if (ipcOwnedRoot && ipcSocketPath) {
          safeUnlinkOwnedSocket(ipcOwnedRoot, ipcSocketPath);
        }
      } catch { /* ignore after best-effort owned unlink */ }
    }
    return Object.freeze({
      ok: true,
      terminated: child.exitCode != null,
      exitCode: child.exitCode,
    });
  }

  return Object.freeze({ request, shutdown });
}

function waitForChildExit(child, timeoutMs) {
  if (child.exitCode != null) return Promise.resolve(child.exitCode);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(child.exitCode), timeoutMs);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

// Child entrypoint.
if (process.argv.includes(WORKER_FLAG)) {
  runSidecarWorker().catch(() => {
    process.stderr.write('DLP010_SIDECAR_FATAL\n');
    process.exit(1);
  });
}

export const SIDECAR_PUBLIC_API = Object.freeze([
  'SIDECAR_KIND',
  'SIDECAR_ARCHITECTURE',
  'APPROVED_GOVERNANCE_REVISION',
  'SIDECAR_DECISIONS',
  'IPC_OWNERSHIP_MARKER',
  'IPC_OWNERSHIP_MAGIC',
  'assertOwnedIpcPath',
  'safeUnlinkOwnedSocket',
  'assertSocketPermissions',
  'spawnLocalWriterSidecar',
  'SIDECAR_PUBLIC_API',
]);
