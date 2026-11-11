/**
 * TECP-OPS-PILOT-001 S2 Gate C+D — disposable ops-pilot DB harness.
 *
 * Implements lifecycle contracts for future Tier-3 disposable PostgreSQL 14.24.
 * Default: fail-closed. Caller-supplied booleans / env flips are NOT activation.
 * Privileged WeakSet-branded Tier-3 handle required before any lifecycle action.
 *
 * Real Owner Tier-3 custody remains: TIER3_ACTIVATION_AUTHORITY_UNPROVEN.
 * This module MUST NOT be invoked under remediation (no initdb/pg_ctl execution).
 */

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';

export const OPS_PILOT_HARNESS_MODE = 'DISPOSABLE_OPS_PILOT_LIFECYCLE_IMPLEMENTED_DEFAULT_DENY';
export const OPS_PILOT_HARNESS_CHECKPOINT = 'S2_GATE_CD_REMEDIATION';
export const OPS_PILOT_REQUIRED_PG_VERSION = '14.24';
export const OPS_PILOT_REQUIRED_PG_VERSION_PREFIX = 'postgres (PostgreSQL) 14.24';
export const OPS_PILOT_PG_BIN_DIR = '/usr/lib/postgresql/14/bin';
export const OPS_PILOT_HARNESS_ROOT_PREFIX = 'tecp-ops-pilot-s2-';
export const OPS_PILOT_HARNESS_MARKER_NAME = '.tecp-ops-pilot-harness';
export const OPS_PILOT_HARNESS_MARKER_MAGIC = 'TECP-OPS-PILOT-S2-DISPOSABLE-HARNESS';
export const OPS_PILOT_DB_EXECUTION_AUTHORIZED = false;
export const OPS_PILOT_TIER3_AUTHORIZED = false;
export const TIER3_ACTIVATION_AUTHORITY = 'TIER3_ACTIVATION_AUTHORITY_UNPROVEN';

export const OPS_PILOT_HARNESS_DECISIONS = Object.freeze({
  ALLOW_SOURCE_CONTRACT: 'ALLOW_SOURCE_CONTRACT',
  ALLOW_LIFECYCLE: 'ALLOW_LIFECYCLE',
  DENY_PRODUCTION_ENV: 'DENY_PRODUCTION_ENV',
  DENY_REMOTE_ENDPOINT: 'DENY_REMOTE_ENDPOINT',
  DENY_ENV_DATABASE_URL: 'DENY_ENV_DATABASE_URL',
  DENY_TCP_HOST: 'DENY_TCP_HOST',
  DENY_UNSAFE_FALLBACK: 'DENY_UNSAFE_FALLBACK',
  DENY_DB_EXECUTION_NOT_AUTHORIZED: 'DENY_DB_EXECUTION_NOT_AUTHORIZED',
  DENY_TIER3_NOT_AUTHORIZED: 'DENY_TIER3_NOT_AUTHORIZED',
  DENY_MISSING_EXPLICIT_NONPROD_FLAG: 'DENY_MISSING_EXPLICIT_NONPROD_FLAG',
  DENY_INVALID_CONFIG: 'DENY_INVALID_CONFIG',
  DENY_PG_VERSION_MISMATCH: 'DENY_PG_VERSION_MISMATCH',
  DENY_NON_DISPOSABLE_ROOT: 'DENY_NON_DISPOSABLE_ROOT',
  DENY_LIFECYCLE_WITHOUT_OWNERSHIP: 'DENY_LIFECYCLE_WITHOUT_OWNERSHIP',
  DENY_MISSING_TIER3_HANDLE: 'DENY_MISSING_TIER3_HANDLE',
  DENY_CALLER_BOOLEAN_ACTIVATION: 'DENY_CALLER_BOOLEAN_ACTIVATION',
  DENY_SYMLINK_OR_PREEXISTING: 'DENY_SYMLINK_OR_PREEXISTING',
  DENY_PATH_ESCAPE: 'DENY_PATH_ESCAPE',
  DENY_DEFAULT_FAIL_CLOSED: 'DENY_DEFAULT_FAIL_CLOSED',
});

export const POSTMASTER_STATUS = Object.freeze({
  RUNNING: 'RUNNING',
  STOPPED: 'STOPPED',
  UNCERTAIN: 'UNCERTAIN',
});

const PRODUCTION_MARKERS = Object.freeze(['production', 'prod', 'live']);
const privilegedTier3Latch = new WeakSet();
const ownedClusterLatch = new WeakSet();

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deny(decision, reasons = [], extra = {}) {
  return Object.freeze({
    ok: false,
    allowed: false,
    decision,
    reasons: Object.freeze([...reasons]),
    dbExecutionAuthorized: false,
    tier3Authorized: false,
    postgresActions: 0,
    tier3ActivationAuthority: TIER3_ACTIVATION_AUTHORITY,
    ...extra,
  });
}

function allowSource(extra = {}) {
  return Object.freeze({
    ok: true,
    allowed: true,
    decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_SOURCE_CONTRACT,
    reasons: Object.freeze(['DISPOSABLE_SOURCE_CONTRACT_ONLY']),
    dbExecutionAuthorized: false,
    tier3Authorized: false,
    postgresActions: 0,
    tier3ActivationAuthority: TIER3_ACTIVATION_AUTHORITY,
    ...extra,
  });
}

function envSnapshot(env = process.env) {
  return {
    NODE_ENV: env.NODE_ENV,
    DATABASE_URL: env.DATABASE_URL,
    PGHOST: env.PGHOST,
    PGPORT: env.PGPORT,
    PGDATABASE: env.PGDATABASE,
    PGUSER: env.PGUSER,
    PGPASSWORD: env.PGPASSWORD,
    PGSERVICE: env.PGSERVICE,
    PGSERVICEFILE: env.PGSERVICEFILE,
    TITANGOLD_TECP_OPS_NONPROD: env.TITANGOLD_TECP_OPS_NONPROD,
    TITANGOLD_TECP_OPS_CP2_DB: env.TITANGOLD_TECP_OPS_CP2_DB,
    TITANGOLD_TECP_OPS_S2_TIER3: env.TITANGOLD_TECP_OPS_S2_TIER3,
  };
}

/**
 * Pure offline safety evaluation. Never opens sockets or loads `pg`.
 */
export function evaluateOpsPilotHarnessSafety(config = {}, env = process.env) {
  if (!isPlainObject(config)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG, ['CONFIG_OBJECT_REQUIRED']);
  }

  const snap = envSnapshot(env);
  const nodeEnv = String(snap.NODE_ENV || '').toLowerCase();
  if (PRODUCTION_MARKERS.includes(nodeEnv) || config.forceProduction === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PRODUCTION_ENV, [
      `NODE_ENV=${snap.NODE_ENV || ''}`,
    ]);
  }

  if (snap.DATABASE_URL != null && String(snap.DATABASE_URL).length > 0) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ENV_DATABASE_URL, ['DATABASE_URL_FORBIDDEN']);
  }
  if (config.databaseUrl != null || config.connectionString != null) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ENV_DATABASE_URL, [
      'CONFIG_DATABASE_URL_FORBIDDEN',
    ]);
  }
  for (const key of [
    'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSERVICE', 'PGSERVICEFILE',
  ]) {
    if (snap[key] != null && String(snap[key]).length > 0) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_ENV_DATABASE_URL, [
        `EXTERNAL_${key}_FORBIDDEN`,
      ]);
    }
  }

  if (config.host != null || config.hostname != null) {
    const host = String(config.host || config.hostname || '');
    if (host && host !== '/tmp' && !host.startsWith('/')) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_TCP_HOST, [`HOST=${host}`]);
    }
    if (/amazonaws\.com|azure|googleapis|neon\.tech|supabase|remote/i.test(host)) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_REMOTE_ENDPOINT, [`HOST=${host}`]);
    }
  }

  if (config.tcp === true || config.listenAddresses === '*' || config.port != null) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_TCP_HOST, ['TCP_LISTENER_FORBIDDEN']);
  }
  if (config.remote === true || config.allowRemote === true || config.fallbackToRemote === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_UNSAFE_FALLBACK, ['REMOTE_FALLBACK_FORBIDDEN']);
  }
  if (config.allowEnvDatabaseUrl === true || config.useProcessEnvCredentials === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_UNSAFE_FALLBACK, [
      'ENV_CREDENTIAL_FALLBACK_FORBIDDEN',
    ]);
  }

  if (config.explicitNonProd !== true && snap.TITANGOLD_TECP_OPS_NONPROD !== '1') {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_MISSING_EXPLICIT_NONPROD_FLAG, [
      'EXPLICIT_NONPROD_REQUIRED',
    ]);
  }

  if (
    config.dataDir != null
    && typeof config.dataDir === 'string'
    && !config.dataDir.includes('disposable')
    && !String(config.dataDir).includes(OPS_PILOT_HARNESS_ROOT_PREFIX)
    && config.requireDisposableMarkedRoot !== false
  ) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_NON_DISPOSABLE_ROOT, [
      'DISPOSABLE_MARKED_TEMPORARY_ROOT_REQUIRED',
    ]);
  }

  if (
    config.reportedPgVersion != null
    && String(config.reportedPgVersion) !== OPS_PILOT_REQUIRED_PG_VERSION
  ) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PG_VERSION_MISMATCH, [
      `REQUIRED=${OPS_PILOT_REQUIRED_PG_VERSION}`,
      `REPORTED=${config.reportedPgVersion}`,
    ]);
  }

  // Caller boolean / env flip alone is NEVER enough.
  if (
    config.tier3Authorized === true
    || config.authorizeTier3 === true
    || config.authorizeDbExecution === true
    || snap.TITANGOLD_TECP_OPS_CP2_DB === '1'
    || snap.TITANGOLD_TECP_OPS_S2_TIER3 === '1'
  ) {
    if (!isPrivilegedTier3ActivationHandle(config.tier3ActivationHandle)) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_BOOLEAN_ACTIVATION, [
        'CALLER_BOOLEAN_OR_ENV_NOT_TIER3_AUTHORITY',
        'PRIVILEGED_TIER3_HANDLE_REQUIRED',
        TIER3_ACTIVATION_AUTHORITY,
      ]);
    }
  }

  return allowSource({
    mode: OPS_PILOT_HARNESS_MODE,
    checkpoint: OPS_PILOT_HARNESS_CHECKPOINT,
    requiredPgVersion: OPS_PILOT_REQUIRED_PG_VERSION,
    socketOnly: true,
    tcpDisabled: true,
    envDatabaseUrlForbidden: true,
  });
}

/**
 * Privileged offline TEST_ONLY Tier-3 activation handle factory.
 * Process-local WeakSet brand. Does NOT prove Owner custody.
 */
export function createPrivilegedTier3ActivationHandleForTests(input = {}) {
  if (!isPlainObject(input)) {
    throw new TypeError('TIER3_HANDLE_OPTIONS_REQUIRED');
  }
  if (input.operationalOwnerCustodyClaim === true) {
    throw new Error('OPERATIONAL_OWNER_CUSTODY_CLAIM_FORBIDDEN');
  }
  if (input.proofClass !== 'TEST_ONLY_TIER3_ACTIVATION_HANDLE') {
    throw new TypeError('TEST_ONLY_PROOF_CLASS_REQUIRED');
  }
  if (input.explicitNonProd !== true) {
    throw new TypeError('EXPLICIT_NONPROD_REQUIRED');
  }
  const handle = Object.freeze({
    kind: 'PRIVILEGED_TIER3_ACTIVATION_HANDLE',
    proofClass: 'TEST_ONLY_TIER3_ACTIVATION_HANDLE',
    operationalOwnerCustodyProven: false,
    tier3ActivationAuthority: TIER3_ACTIVATION_AUTHORITY,
    checkpoint: OPS_PILOT_HARNESS_CHECKPOINT,
  });
  privilegedTier3Latch.add(handle);
  return handle;
}

export function isPrivilegedTier3ActivationHandle(value) {
  return value !== null && typeof value === 'object' && privilegedTier3Latch.has(value);
}

function requireTier3Handle(config = {}) {
  if (config.tier3Authorized === true && !isPrivilegedTier3ActivationHandle(config.tier3ActivationHandle)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_BOOLEAN_ACTIVATION, [
      'CALLER_BOOLEAN_INSUFFICIENT',
    ]);
  }
  if (!isPrivilegedTier3ActivationHandle(config.tier3ActivationHandle)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_MISSING_TIER3_HANDLE, [
      'PRIVILEGED_TIER3_HANDLE_REQUIRED',
      TIER3_ACTIVATION_AUTHORITY,
    ]);
  }
  return null;
}

function recheckBeforeLifecycle(opName, config = {}, env = process.env) {
  const safety = evaluateOpsPilotHarnessSafety(
    { ...config, explicitNonProd: config.explicitNonProd === true ? true : config.explicitNonProd },
    env,
  );
  // Safety may ALLOW source contract; still require branded handle for lifecycle.
  const handleDeny = requireTier3Handle(config);
  if (handleDeny) return handleDeny;
  if (
    safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_PRODUCTION_ENV
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_ENV_DATABASE_URL
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_TCP_HOST
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_REMOTE_ENDPOINT
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_UNSAFE_FALLBACK
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_MISSING_EXPLICIT_NONPROD_FLAG
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_PG_VERSION_MISMATCH
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_NON_DISPOSABLE_ROOT
    || safety.decision === OPS_PILOT_HARNESS_DECISIONS.DENY_CALLER_BOOLEAN_ACTIVATION
  ) {
    return safety;
  }
  if (OPS_PILOT_DB_EXECUTION_AUTHORIZED === true || OPS_PILOT_TIER3_AUTHORIZED === true) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_TIER3_NOT_AUTHORIZED, [
      'MODULE_CONSTANTS_MUST_REMAIN_FALSE',
      opName,
    ]);
  }
  return null;
}

/**
 * Build argv for lifecycle tools without shell interpolation.
 * Used by offline tests and future Tier-3 execution.
 */
export function buildInitdbArgs({ dataDir, pwfile, user = 'tecp_ops_pilot_proof' }) {
  if (typeof dataDir !== 'string' || !dataDir.includes('disposable') && !dataDir.includes(OPS_PILOT_HARNESS_ROOT_PREFIX)) {
    throw new Error('DISPOSABLE_DATA_DIR_REQUIRED');
  }
  return Object.freeze([
    '-D', dataDir,
    '-U', user,
    '--auth-local=trust',
    '--auth-host=scram-sha-256',
    '--pwfile', pwfile,
    '--encoding=UTF8',
    '--locale=C',
  ]);
}

export function buildPgCtlStartArgs({ dataDir, logFile, socketDir, socketPort }) {
  if (typeof socketDir !== 'string' || !socketDir.startsWith('/')) {
    throw new Error('ABSOLUTE_SOCKET_DIR_REQUIRED');
  }
  if (!Number.isSafeInteger(socketPort) || socketPort < 1) {
    throw new Error('SOCKET_PORT_REQUIRED');
  }
  return Object.freeze([
    '-D', dataDir,
    '-l', logFile,
    '-o', `-c listen_addresses= -c unix_socket_directories=${socketDir} -c port=${socketPort}`,
    '-w',
    'start',
  ]);
}

export function buildPgCtlStopArgs(dataDir) {
  return Object.freeze(['-D', dataDir, '-m', 'fast', '-w', 'stop']);
}

export function assertVerifiedPgBinDir(binDir = OPS_PILOT_PG_BIN_DIR) {
  const resolved = resolve(binDir);
  if (resolved !== OPS_PILOT_PG_BIN_DIR) {
    throw new Error(`BLOCKED: unexpected pg bin dir ${resolved}`);
  }
  for (const name of ['initdb', 'pg_ctl', 'postgres', 'psql', 'pg_isready']) {
    const p = join(resolved, name);
    if (!existsSync(p)) throw new Error(`BLOCKED: missing ${p}`);
  }
  return resolved;
}

export function planPostgresVersionProbe(binDir = OPS_PILOT_PG_BIN_DIR) {
  const dir = assertVerifiedPgBinDir(binDir);
  return Object.freeze({
    bin: join(dir, 'postgres'),
    args: Object.freeze(['--version']),
    expectedPrefix: OPS_PILOT_REQUIRED_PG_VERSION_PREFIX,
  });
}

export function assertPathInsideRoot(root, candidate) {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(resolvedRoot + sep)) {
    throw new Error('BLOCKED: path escapes disposable root');
  }
  return resolvedCandidate;
}

export function assertNoSymlink(path) {
  if (!existsSync(path)) return;
  const st = lstatSync(path);
  if (st.isSymbolicLink()) {
    throw new Error('BLOCKED: symlink refused in disposable harness paths');
  }
}

export function writeHarnessMarker(root, dataDir) {
  const marker = {
    magic: OPS_PILOT_HARNESS_MARKER_MAGIC,
    root: resolve(root),
    dataDir: resolve(dataDir),
    createdAt: new Date().toISOString(),
  };
  writeFileSync(join(root, OPS_PILOT_HARNESS_MARKER_NAME), JSON.stringify(marker), {
    mode: 0o600,
  });
  return marker;
}

export function assertVerifiedHarnessPaths(root, dataDir) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new Error('BLOCKED: harness root missing');
  }
  if (typeof dataDir !== 'string' || dataDir.length === 0) {
    throw new Error('BLOCKED: harness dataDir missing');
  }
  const resolvedRoot = resolve(root);
  const resolvedData = resolve(dataDir);
  assertPathInsideRoot(resolvedRoot, resolvedData);
  assertNoSymlink(resolvedRoot);
  assertNoSymlink(resolvedData);
  const markerPath = join(resolvedRoot, OPS_PILOT_HARNESS_MARKER_NAME);
  if (!existsSync(markerPath)) {
    throw new Error('BLOCKED: harness marker missing; refusing cleanup');
  }
  const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  if (marker.magic !== OPS_PILOT_HARNESS_MARKER_MAGIC) {
    throw new Error('BLOCKED: harness marker magic mismatch');
  }
  if (resolve(marker.root) !== resolvedRoot || resolve(marker.dataDir) !== resolvedData) {
    throw new Error('BLOCKED: harness marker path substitution detected');
  }
  if (!basename(resolvedRoot).startsWith(OPS_PILOT_HARNESS_ROOT_PREFIX)
    && !resolvedRoot.includes(OPS_PILOT_HARNESS_ROOT_PREFIX)) {
    throw new Error('BLOCKED: disposable root prefix mismatch');
  }
  return { resolvedRoot, resolvedData };
}

export function inspectPostmasterStatus(dataDir, { pgCtlStatusFn } = {}) {
  if (!dataDir || typeof dataDir !== 'string') {
    return { status: POSTMASTER_STATUS.UNCERTAIN, reason: 'missing_dataDir' };
  }
  if (!existsSync(dataDir)) {
    return { status: POSTMASTER_STATUS.STOPPED, reason: 'dataDir_absent' };
  }
  const statusFn = pgCtlStatusFn || ((dir) => spawnSync(
    join(OPS_PILOT_PG_BIN_DIR, 'pg_ctl'),
    ['-D', dir, 'status'],
    { encoding: 'utf8' },
  ));
  let statusResult;
  try {
    statusResult = statusFn(dataDir);
  } catch (error) {
    return {
      status: POSTMASTER_STATUS.UNCERTAIN,
      reason: `pg_ctl_status_threw:${error.message || error}`,
    };
  }
  if (statusResult?.error) {
    return {
      status: POSTMASTER_STATUS.UNCERTAIN,
      reason: `pg_ctl_status_error:${statusResult.error.message || 'unknown'}`,
    };
  }
  if (statusResult?.status === 0) {
    return { status: POSTMASTER_STATUS.RUNNING, reason: 'pg_ctl_status_running' };
  }
  if (statusResult?.status === 3) {
    return { status: POSTMASTER_STATUS.STOPPED, reason: 'pg_ctl_status_not_running' };
  }
  return {
    status: POSTMASTER_STATUS.UNCERTAIN,
    reason: `pg_ctl_status_unexpected:${statusResult?.status}`,
  };
}

export function stopClusterAndProveTerminated(dataDir, { stopFn, inspectFn } = {}) {
  const stopper = stopFn || ((dir) => spawnSync(
    join(OPS_PILOT_PG_BIN_DIR, 'pg_ctl'),
    [...buildPgCtlStopArgs(dir)],
    { encoding: 'utf8' },
  ));
  const inspect = inspectFn || inspectPostmasterStatus;
  let stopError = null;
  try {
    const result = stopper(dataDir);
    if (result?.error) stopError = result.error;
    else if (result && result.status !== 0) {
      stopError = new Error(result.stderr || result.stdout || `pg_ctl stop status=${result.status}`);
    }
  } catch (error) {
    stopError = error;
  }
  const after = inspect(dataDir);
  if (after.status !== POSTMASTER_STATUS.STOPPED) {
    return {
      terminated: false,
      blocked: true,
      status: after.status,
      reason: after.reason,
      stopError: stopError ? String(stopError.message || stopError) : after.reason,
    };
  }
  return {
    terminated: true,
    blocked: false,
    status: after.status,
    reason: after.reason,
    stopError: stopError ? String(stopError.message || stopError) : null,
  };
}

export function removeHarnessRootIfSafe(root, dataDir, { inspectFn } = {}) {
  const verified = assertVerifiedHarnessPaths(root, dataDir);
  const inspection = (inspectFn || inspectPostmasterStatus)(verified.resolvedData);
  if (inspection.status !== POSTMASTER_STATUS.STOPPED) {
    throw new Error(
      `BLOCKED: refusing delete; postmaster status=${inspection.status} (${inspection.reason})`,
    );
  }
  rmSync(verified.resolvedRoot, { recursive: true, force: true });
  return {
    deleted: true,
    root: verified.resolvedRoot,
    dataDir: verified.resolvedData,
  };
}

/**
 * Create an owned disposable cluster controller.
 * Does not start PostgreSQL until start() is called with a live Tier-3 handle.
 * Offline remediation must not call start().
 */
export function createDisposableOpsPilotClusterController(config = {}, env = process.env) {
  const gate = recheckBeforeLifecycle('CREATE_CONTROLLER', {
    ...config,
    explicitNonProd: true,
  }, env);
  if (gate) {
    return gate;
  }

  let binDir;
  try {
    binDir = assertVerifiedPgBinDir(config.pgBinDir || OPS_PILOT_PG_BIN_DIR);
  } catch (error) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_INVALID_CONFIG, [
      error.message || 'PG_BIN_DIR_UNVERIFIED',
    ]);
  }
  let root = null;
  let dataDir = null;
  let socketDir = null;
  let logFile = null;
  let socketPort = null;
  let started = false;
  let startupAttempted = false;
  let cleaned = false;
  const runners = {
    spawnSyncFn: typeof config.spawnSyncFn === 'function' ? config.spawnSyncFn : spawnSync,
    inspectFn: config.inspectFn,
    stopFn: config.stopFn,
    startClusterFn: config.startClusterFn,
  };

  const controller = {
    kind: 'DISPOSABLE_OPS_PILOT_CLUSTER_CONTROLLER',
    proofClass: OPS_PILOT_HARNESS_MODE,
    tier3ActivationAuthority: TIER3_ACTIVATION_AUTHORITY,
    getPaths() {
      return Object.freeze({ root, dataDir, socketDir, logFile, socketPort, binDir });
    },
    async prepare() {
      const again = recheckBeforeLifecycle('PREPARE', {
        ...config,
        explicitNonProd: true,
        tier3ActivationHandle: config.tier3ActivationHandle,
      }, env);
      if (again) return again;
      if (root != null) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_SYMLINK_OR_PREEXISTING, [
          'CLUSTER_ALREADY_PREPARED',
        ]);
      }
      root = mkdtempSync(join(tmpdir(), OPS_PILOT_HARNESS_ROOT_PREFIX));
      dataDir = join(root, 'data');
      socketDir = join(root, 'socket');
      logFile = join(root, 'pg.log');
      socketPort = 56000 + (randomBytes(2).readUInt16BE(0) % 4000);
      mkdirSync(dataDir);
      mkdirSync(socketDir);
      writeHarnessMarker(root, dataDir);
      return Object.freeze({
        ok: true,
        allowed: true,
        decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
        reasons: Object.freeze(['CLUSTER_ROOT_PREPARED_NOT_STARTED']),
        paths: this.getPaths(),
        postgresActions: 0,
        dbExecutionAuthorized: false,
        tier3Authorized: false,
        tier3ActivationAuthority: TIER3_ACTIVATION_AUTHORITY,
      });
    },
    async start() {
      const again = recheckBeforeLifecycle('START', {
        ...config,
        explicitNonProd: true,
        tier3ActivationHandle: config.tier3ActivationHandle,
      }, env);
      if (again) return again;
      // Intentionally still fail-closed for live execution until Owner Tier-3
      // execution gate separately authorizes postgresActions > 0.
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
        'START_IMPLEMENTED_BUT_EXECUTION_GATE_CLOSED',
        'OWNER_TIER3_DISPOSABLE_DB_TEST_AUTHORIZATION_REQUIRED',
        'NO_INITDB_NO_PG_CTL_IN_REMEDIATION',
      ], {
        plannedArgs: root == null ? null : Object.freeze({
          initdb: buildInitdbArgs({
            dataDir,
            pwfile: join(root, 'pwfile'),
          }),
          start: buildPgCtlStartArgs({
            dataDir,
            logFile,
            socketDir,
            socketPort,
          }),
        }),
      });
    },
    async stop() {
      const again = recheckBeforeLifecycle('STOP', {
        ...config,
        explicitNonProd: true,
        tier3ActivationHandle: config.tier3ActivationHandle,
      }, env);
      if (again) return again;
      if (!startupAttempted && !started) {
        return Object.freeze({
          ok: true,
          allowed: true,
          decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
          reasons: Object.freeze(['STOP_NOOP_NEVER_STARTED']),
          postgresActions: 0,
          dbExecutionAuthorized: false,
          tier3Authorized: false,
        });
      }
      const proof = stopClusterAndProveTerminated(dataDir, {
        stopFn: runners.stopFn,
        inspectFn: runners.inspectFn,
      });
      if (!proof.terminated) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP, [
          'STOP_DID_NOT_PROVE_TERMINATION',
          proof.reason || 'not_terminated',
        ]);
      }
      started = false;
      return Object.freeze({
        ok: true,
        allowed: true,
        decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
        reasons: Object.freeze(['STOP_TERMINATION_PROVEN']),
        postgresActions: 0,
        dbExecutionAuthorized: false,
        tier3Authorized: false,
      });
    },
    async cleanup() {
      const again = recheckBeforeLifecycle('CLEANUP', {
        ...config,
        explicitNonProd: true,
        tier3ActivationHandle: config.tier3ActivationHandle,
      }, env);
      if (again) return again;
      if (cleaned) {
        return Object.freeze({
          ok: true,
          allowed: true,
          decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
          reasons: Object.freeze(['ALREADY_CLEANED']),
          postgresActions: 0,
        });
      }
      if (root == null) {
        cleaned = true;
        return Object.freeze({
          ok: true,
          allowed: true,
          decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
          reasons: Object.freeze(['CLEANUP_NOOP_NO_ROOT']),
          postgresActions: 0,
          cleanupEvidence: Object.freeze({
            stopBeforeDelete: 'NOT_APPLICABLE',
            residualDataDir: 'NONE_CREATED',
          }),
        });
      }
      if (started || startupAttempted) {
        const proof = stopClusterAndProveTerminated(dataDir, {
          stopFn: runners.stopFn,
          inspectFn: runners.inspectFn,
        });
        if (!proof.terminated) {
          return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP, [
            'REFUSING_DELETE_WITHOUT_STOP_PROOF',
            proof.reason || 'not_terminated',
          ]);
        }
      }
      try {
        const removed = removeHarnessRootIfSafe(root, dataDir, { inspectFn: runners.inspectFn });
        cleaned = true;
        root = null;
        dataDir = null;
        return Object.freeze({
          ok: true,
          allowed: true,
          decision: OPS_PILOT_HARNESS_DECISIONS.ALLOW_LIFECYCLE,
          reasons: Object.freeze(['CLEANUP_SAFE_DELETE']),
          postgresActions: 0,
          cleanupEvidence: Object.freeze({
            stopBeforeDelete: 'REQUIRED_AND_PROVEN_OR_NEVER_STARTED',
            deletedRoot: removed.root,
          }),
        });
      } catch (error) {
        return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PATH_ESCAPE, [
          error.message || 'CLEANUP_FAILED',
        ]);
      }
    },
  };
  ownedClusterLatch.add(controller);
  return controller;
}

export function isOwnedDisposableOpsPilotClusterController(value) {
  return value !== null && typeof value === 'object' && ownedClusterLatch.has(value);
}

export async function detectPostgresVersion(config = {}, env = process.env) {
  const gate = recheckBeforeLifecycle('DETECT_POSTGRES_VERSION', {
    ...config,
    explicitNonProd: config.explicitNonProd ?? true,
  }, env);
  if (gate) return gate;
  const plan = planPostgresVersionProbe(config.pgBinDir || OPS_PILOT_PG_BIN_DIR);
  return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
    'DETECT_PLANNED_BUT_EXECUTION_GATE_CLOSED',
    `BIN=${plan.bin}`,
  ], { plannedProbe: plan });
}

export async function startDisposableOpsPilotCluster(config = {}, env = process.env) {
  const controller = createDisposableOpsPilotClusterController(config, env);
  if (controller && controller.ok === false) return controller;
  return controller.start();
}

export async function stopDisposableOpsPilotCluster(config = {}, env = process.env) {
  const gate = recheckBeforeLifecycle('STOP_CLUSTER', {
    ...config,
    explicitNonProd: config.explicitNonProd ?? true,
  }, env);
  if (gate) return gate;
  if (!isOwnedDisposableOpsPilotClusterController(config.ownedController)) {
    return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP, [
      'OWNED_CONTROLLER_REQUIRED_FOR_STOP',
    ]);
  }
  return config.ownedController.stop();
}

export async function createDisposableOpsPilotClient(config = {}, env = process.env) {
  const gate = recheckBeforeLifecycle('CREATE_CLIENT', {
    ...config,
    explicitNonProd: config.explicitNonProd ?? true,
  }, env);
  if (gate) return gate;
  return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_DB_EXECUTION_NOT_AUTHORIZED, [
    'CREATE_CLIENT_FORBIDDEN_UNTIL_TIER3_EXECUTION_GATE',
    'NO_PG_MODULE_LOAD_IN_REMEDIATION',
  ]);
}

export async function cleanupDisposableOpsPilotCluster(config = {}, env = process.env) {
  const gate = recheckBeforeLifecycle('CLEANUP', {
    ...config,
    explicitNonProd: config.explicitNonProd ?? true,
  }, env);
  if (gate) return gate;
  if (isOwnedDisposableOpsPilotClusterController(config.ownedController)) {
    return config.ownedController.cleanup();
  }
  if (config.root != null && config.dataDir != null) {
    try {
      assertVerifiedHarnessPaths(config.root, config.dataDir);
    } catch (error) {
      return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_PATH_ESCAPE, [error.message || 'PATH_VERIFY']);
    }
  }
  return deny(OPS_PILOT_HARNESS_DECISIONS.DENY_LIFECYCLE_WITHOUT_OWNERSHIP, [
    'CLEANUP_REQUIRES_OWNED_CONTROLLER_OR_VERIFIED_MARKER',
    'STOP_BEFORE_DELETE_MANDATORY',
  ]);
}

export function assertHarnessSourceHasNoEagerPgImport(sourceText) {
  const text = String(sourceText || '');
  const eager = /^\s*import\s+.*\bfrom\s+['"]pg['"]/m.test(text)
    || /^\s*const\s+.*\s*=\s*require\(\s*['"]pg['"]\s*\)/m.test(text);
  return Object.freeze({
    ok: !eager,
    eagerPgImport: eager,
  });
}

// Keep realpathSync referenced for future containment hardening without using it at import.
void realpathSync;
