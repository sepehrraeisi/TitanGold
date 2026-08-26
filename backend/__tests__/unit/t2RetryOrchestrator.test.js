/**
 * @jest-environment node
 *
 * Durable T2 retry orchestrator — synthetic/fake-only matrix (TOOL_VERSION 1.6.0).
 * Never contacts live PM2, DB, Redis, Telegram, or production services.
 */

import { describe, expect, it } from '@jest/globals';
import {
  AUTHORIZED_TRANSACTION,
  AUTHORIZED_EFFECTS,
  COLLECTOR_DB_KEYS,
  EXPECTED_COLLECTOR_DB_USER,
  State,
  TOOL_VERSION,
  createOrchestrator,
  createFailClosedBoundary,
  createMemoryJournalFs,
  createExclusiveJournal,
  loadJournal,
  createLiveBoundary,
  dumpToBytes,
  sha256Buffer,
  T2OrchestratorError,
  ForbiddenLiveExecutionError,
  GlobalPm2SaveForbiddenError,
  JournalError,
  MUTATING_OPS,
  evaluateLiveExecutionGates,
  extractProcessEnvResult,
  assertEntriesEnvShapes,
  compareCollectorDbLiveToPersist,
  planRollbackActions,
  createSideEffectLedger,
  semanticFingerprint,
  selectEngineRetainExtra,
  REQUIRED_PROJECTED_DUMP_MODE,
  LEGACY_AUTHORIZED_TRANSACTION_1_4_0,
  LEGACY_AUTHORIZED_TRANSACTION_1_5_0,
  assertSanitizedPreBaselineProof,
  assertCollectorPersistencePreconditions,
  classifyCollectorDbPrestate,
  buildExpectedProjectedDump,
  assertUnauthorizedLiveEnvNotPersisted,
  resolveDumpEngineIdentities,
  resolveDumpCollectorIdentity,
  structuralDiffPaths,
} from '../../scripts/t2-retry-orchestrator/index.mjs';

const SECRET_PASSWORD = 'super-secret-db-password-NEVER-IN-EVIDENCE';
const SECRET_TOKEN = '123456789:AAHsecretTelegramTokenValueXXXX';
const SECRET_BACKEND = 'backend-secret-value-should-stay-invisible';
const PRE_JWT = 'pre-dump-jwt-secret-VALUE';
const LIVE_JWT = 'live-different-jwt-secret-VALUE';

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function makeAuth(runId = 'T2R-TEST-001') {
  return {
    runId,
    authorizedTransaction: AUTHORIZED_TRANSACTION,
    authorizedEffects: [...AUTHORIZED_EFFECTS],
    oneShotToken: 'opaque-one-shot-not-a-credential',
    consumed: false,
  };
}

/** Simulate sanitized PRE dump: no pm_id; collector KEEPS exact live DB_* (ALREADY_PRESENT_EXACT). */
function prepareDumpFromLive(live) {
  const dump = deepClone(live);
  for (const e of dump) {
    delete e.pm_id;
  }
  return dump;
}

/** Clean PRE baseline: no pm_id and no collector DB_* (construction authority for sanitizer/T2 gate). */
function prepareCleanPreFromLive(live) {
  const dump = deepClone(live);
  for (const e of dump) {
    delete e.pm_id;
    if (e.name === 'telegram-collector') {
      for (const k of COLLECTOR_DB_KEYS) delete e.env[k];
    }
  }
  return dump;
}

function makeLiveAndDump(overrides = {}) {
  const live = [
    {
      name: 'titan-engine-worker',
      pm_id: 5,
      pid: 100,
      status: 'online',
      pm_cwd: '/app/backend',
      pm_exec_path: '/app/backend/workers/engineWorkerLeader.js',
      exec_mode: 'fork_mode',
      exec_interpreter: 'node',
      namespace: 'default',
      node_args: [],
      autorestart: true,
      watch: false,
      created_at: 1000,
      restart_time: 5,
      env: { NODE_ENV: 'development', PATH: '/usr/bin' },
    },
    {
      name: 'titan-engine-worker',
      pm_id: 9,
      pid: 101,
      status: 'online',
      pm_cwd: '/app/backend',
      pm_exec_path: '/app/backend/workers/engineWorkerLeader.js',
      exec_mode: 'fork_mode',
      exec_interpreter: 'node',
      namespace: 'default',
      node_args: [],
      autorestart: true,
      watch: false,
      created_at: 1001,
      restart_time: 5,
      env: { NODE_ENV: 'development', PATH: '/noncanonical/extra/bin:/usr/bin' },
    },
    ...[1, 2, 3, 4].map((id) => ({
      name: 'titan-backend',
      pm_id: id,
      status: 'online',
      pm_cwd: '/app/backend',
      pm_exec_path: '/app/backend/server.js',
      exec_mode: 'cluster_mode',
      created_at: 2000 + id,
      env: { NODE_ENV: 'development', BACKEND_SECRET: SECRET_BACKEND, PATH: '/usr/bin' },
    })),
    {
      name: 'telegram-processor',
      pm_id: 11,
      status: 'online',
      pm_cwd: '/app/telegram-collector',
      pm_exec_path: '/app/telegram-collector/processor.js',
      args: ['--mode=normal'],
      created_at: 3000,
      env: { NODE_ENV: 'development', PATH: '/usr/bin' },
    },
    {
      name: 'telegram-collector',
      pm_id: 16,
      status: 'online',
      pm_cwd: '/app/telegram-collector',
      pm_exec_path: '/app/telegram-collector/index.js',
      created_at: 4000,
      env: {
        NODE_ENV: 'production',
        DB_HOST: '127.0.0.1',
        DB_PORT: '5433',
        DB_NAME: 'titangold_db',
        DB_USER: EXPECTED_COLLECTOR_DB_USER,
        DB_PASSWORD: SECRET_PASSWORD,
        JWT_SECRET: PRE_JWT,
      },
    },
    {
      name: 'telegram-collector-monitor',
      pm_id: 8,
      status: 'online',
      created_at: 5000,
      env: { NODE_ENV: 'development' },
    },
    {
      name: 'telegram-collector-monitor',
      pm_id: 14,
      status: 'online',
      created_at: 5001,
      env: { NODE_ENV: 'development' },
    },
  ];

  if (typeof overrides.mutateLive === 'function') {
    overrides.mutateLive(live);
  }

  const dump =
    overrides.dumpOverride != null
      ? overrides.dumpOverride
      : prepareDumpFromLive(live);

  return {
    live,
    dump,
    forceProjectedWriteFailBeforeRename: false,
    forceProjectedWriteFailAfterRename: false,
    forceProjectedRenameNoChange: false,
    forceProjectedTempModeFail: false,
    forceReadbackMismatch: false,
    forceReadDumpUnreadableAfterWrite: false,
    forceUnknownActiveOtherAfterWrite: false,
    forceOwnerMismatch: false,
    forceGroupMismatch: false,
    forceOwnershipUnsafe: false,
    forcePostwriteOwnerMismatch: false,
    forcePostwriteGroupMismatch: false,
    forceBackendDriftOnSave: false,
    forceNodeEnvDriftOnSave: false,
    forceProcessorDriftOnSave: false,
    forceMonitorDriftOnSave: false,
    forceRetainedEnvDriftOnSave: false,
    forceCollectorLiveEnvDriftOnSave: false,
    forceBackendEnvAdd: false,
    forceBackendEnvRemove: false,
    forceBackendEnvValueChange: false,
    forceCollectorUnrelatedEnvAdd: false,
    forceProviderEnvAppear: false,
    forceTelegramTokenAppear: false,
    forceCollectorDbPasswordMismatch: false,
    forceCollectorDbHostMismatch: false,
    forceCollectorDbNameMismatch: false,
    forceBackendScriptDrift: false,
    forceBackendCwdDrift: false,
    forceProcessorArgsDrift: false,
    forceOtherConfigDrift: false,
    forceRestoreShaMismatch: false,
    forceRestoreModeMismatch: false,
    forceHardenCommandFail: false,
    forceHardenWrongMode: false,
    forceHardenSkipModeChange: false,
    forceRetainedPathChangeOnSave: false,
    dumpMode: 0o664,
    dumpUid: 1000,
    dumpGid: 1000,
    restoreUidOverride: null,
    restoreGidOverride: null,
    startExitCode: 0,
    restoreShaOverride: null,
    ...overrides,
  };
}

function applyPostWriteTampers(world, dumpEntries) {
  if (world.forceBackendDriftOnSave) {
    const backends = dumpEntries
      .map((e, i) => ({ e, i }))
      .filter((x) => x.e.name === 'titan-backend');
    if (backends.length) dumpEntries.splice(backends[backends.length - 1].i, 1);
  }
  if (world.forceNodeEnvDriftOnSave) {
    for (const e of dumpEntries) {
      if (e.name === 'titan-engine-worker' && e.status === 'online') {
        e.env = { ...(e.env || {}), NODE_ENV: 'production' };
      }
    }
  }
  if (world.forceProcessorDriftOnSave) {
    for (let i = dumpEntries.length - 1; i >= 0; i--) {
      if (dumpEntries[i].name === 'telegram-processor') dumpEntries.splice(i, 1);
    }
  }
  if (world.forceMonitorDriftOnSave) {
    for (let i = dumpEntries.length - 1; i >= 0; i--) {
      if (dumpEntries[i].name === 'telegram-collector-monitor') dumpEntries.splice(i, 1);
    }
  }
  if (world.forceBackendEnvAdd) {
    const b = dumpEntries.find((e) => e.name === 'titan-backend');
    if (b) b.env = { ...b.env, UNRELATED_NEW_KEY: 'x' };
  }
  if (world.forceBackendEnvRemove) {
    const b = dumpEntries.find((e) => e.name === 'titan-backend');
    if (b) delete b.env.BACKEND_SECRET;
  }
  if (world.forceBackendEnvValueChange) {
    const b = dumpEntries.find((e) => e.name === 'titan-backend');
    if (b) b.env.BACKEND_SECRET = 'changed-secret-value';
  }
  if (world.forceCollectorUnrelatedEnvAdd) {
    const c = dumpEntries.find((e) => e.name === 'telegram-collector');
    if (c) c.env = { ...c.env, COLLECTOR_EXTRA: 'nope' };
  }
  if (world.forceProviderEnvAppear) {
    const b = dumpEntries.find((e) => e.name === 'titan-backend');
    if (b) b.env = { ...b.env, MEXC_API_KEY: 'provider-secret' };
  }
  if (world.forceTelegramTokenAppear) {
    const c = dumpEntries.find((e) => e.name === 'telegram-collector');
    if (c) c.env = { ...c.env, TELEGRAM_BOT_TOKEN: SECRET_TOKEN };
  }
  if (world.forceCollectorDbPasswordMismatch) {
    const c = dumpEntries.find((e) => e.name === 'telegram-collector');
    if (c) c.env.DB_PASSWORD = 'wrong-password-not-live';
  }
  if (world.forceCollectorDbHostMismatch) {
    const c = dumpEntries.find((e) => e.name === 'telegram-collector');
    if (c) c.env.DB_HOST = '10.0.0.1';
  }
  if (world.forceCollectorDbNameMismatch) {
    const c = dumpEntries.find((e) => e.name === 'telegram-collector');
    if (c) c.env.DB_NAME = 'other_db';
  }
  if (world.forceBackendScriptDrift) {
    const b = dumpEntries.find((e) => e.name === 'titan-backend');
    if (b) b.pm_exec_path = '/app/backend/server-DRIFTED.js';
  }
  if (world.forceBackendCwdDrift) {
    const b = dumpEntries.find((e) => e.name === 'titan-backend');
    if (b) b.pm_cwd = '/app/backend-DRIFTED';
  }
  if (world.forceProcessorArgsDrift) {
    const p = dumpEntries.find((e) => e.name === 'telegram-processor');
    if (p) p.args = ['--mode=drifted'];
  }
  if (world.forceOtherConfigDrift) {
    dumpEntries.push({
      name: 'titan-error-watch',
      status: 'online',
      pm_exec_path: '/x.js',
      created_at: 9999,
      env: { NODE_ENV: 'development' },
    });
  }
  if (world.forceRetainedPathChangeOnSave) {
    for (const e of dumpEntries) {
      if (e.name === 'titan-engine-worker' && e.status === 'online') {
        e.env = { ...(e.env || {}), PATH: '/mutated/path/should-fail' };
      }
    }
  }
  if (world.forceReadbackMismatch) {
    dumpEntries.push({
      name: 'tamper-readback',
      status: 'stopped',
      created_at: 8888,
      env: {},
    });
  }
}

function createFakeBoundary(world) {
  let dumpEntries = deepClone(world.dump);
  let liveEntries = deepClone(world.live);
  let dumpCorrupt = false;
  let dumpMode = typeof world.dumpMode === 'number' ? world.dumpMode & 0o777 : 0o664;
  let dumpUid = typeof world.dumpUid === 'number' ? world.dumpUid : 1000;
  let dumpGid = typeof world.dumpGid === 'number' ? world.dumpGid : 1000;
  const mutationLog = [];

  return {
    mutationLog,
    world: () => ({ liveEntries, dumpEntries, dumpMode, dumpUid, dumpGid }),
    async listLiveProcesses() {
      return deepClone(liveEntries);
    },
    async readDump() {
      if (dumpCorrupt) throw new Error('DUMP_UNPARSEABLE');
      let bytes = dumpToBytes(dumpEntries);
      if (world.restoreShaOverride && dumpEntries === world._shaOverrideTarget) {
        bytes = Buffer.from(world.restoreShaOverride);
      }
      return {
        bytes,
        parsed: JSON.parse(bytes.toString('utf8')),
        sha256: sha256Buffer(bytes),
        mode: dumpMode,
        uid: dumpUid,
        gid: dumpGid,
      };
    },
    async inspectActiveDumpWriteSafety() {
      return {
        dumpUid,
        dumpGid,
        dumpMode,
        ownerSafe: !world.forceOwnershipUnsafe,
        groupSafe: !world.forceOwnershipUnsafe,
        safe: !world.forceOwnershipUnsafe,
      };
    },
    async writeBackup(bytes) {
      mutationLog.push('writeBackup');
      return { sha256: sha256Buffer(bytes), bytes: bytes.length, mode: 0o600 };
    },
    async restoreDump(backupBytes, opts = {}) {
      mutationLog.push(['restoreDump', opts?.mode]);
      dumpCorrupt = false;
      dumpEntries = JSON.parse(Buffer.from(backupBytes).toString('utf8'));
      if (typeof opts.mode !== 'number') {
        return { ok: false };
      }
      dumpMode = opts.mode & 0o777;
      if (world.forceRestoreModeMismatch) {
        dumpMode = (dumpMode ^ 0o020) & 0o777;
      }
      dumpUid =
        typeof world.restoreUidOverride === 'number'
          ? world.restoreUidOverride
          : typeof opts.uid === 'number'
            ? opts.uid
            : dumpUid;
      dumpGid =
        typeof world.restoreGidOverride === 'number'
          ? world.restoreGidOverride
          : typeof opts.gid === 'number'
            ? opts.gid
            : dumpGid;
      if (world.forceRestoreShaMismatch) {
        dumpEntries = deepClone(dumpEntries);
        dumpEntries.push({ name: 'tamper', status: 'stopped', created_at: 999, env: {} });
      }
      return { ok: true, mode: dumpMode, uid: dumpUid, gid: dumpGid };
    },
    async stopProcessByPmId(pmId) {
      mutationLog.push(['stop', pmId]);
      const proc = liveEntries.find((e) => e.pm_id === pmId && e.name === 'titan-engine-worker');
      if (proc) proc.status = 'stopped';
      return { exitCode: 0 };
    },
    async startProcessByPmId(pmId) {
      mutationLog.push(['start', pmId]);
      if (world.startExitCode !== 0) {
        return { exitCode: world.startExitCode };
      }
      const proc = liveEntries.find((e) => e.pm_id === pmId && e.name === 'titan-engine-worker');
      if (proc) proc.status = 'online';
      return { exitCode: 0 };
    },
    async pm2Save() {
      mutationLog.push('pm2Save');
      throw Object.assign(new Error('GLOBAL_PM2_SAVE_FORBIDDEN'), {
        code: 'GLOBAL_PM2_SAVE_FORBIDDEN',
      });
    },
    async writeProjectedActiveDump(bytes, opts = {}) {
      mutationLog.push(['writeProjectedActiveDump', opts]);
      if (world.forceProjectedWriteFailBeforeRename) {
        throw new Error('WRITE_FAIL_BEFORE_RENAME');
      }
      if (world.forceProjectedTempModeFail) {
        throw Object.assign(new Error('PROJECTED_TEMP_MODE_NOT_0600'), {
          code: 'PROJECTED_TEMP_MODE_NOT_0600',
        });
      }
      if (world.forceOwnerMismatch) {
        throw new Error('DUMP_OWNER_MISMATCH');
      }
      if (world.forceGroupMismatch) {
        throw new Error('DUMP_GROUP_MISMATCH');
      }
      if (world.forceOwnershipUnsafe) {
        throw Object.assign(new Error('DUMP_OWNERSHIP_PRESERVATION_UNSAFE'), {
          code: 'DUMP_OWNERSHIP_PRESERVATION_UNSAFE',
        });
      }

      const applyBytes = () => {
        dumpEntries = JSON.parse(Buffer.from(bytes).toString('utf8'));
        dumpMode = REQUIRED_PROJECTED_DUMP_MODE;
        if (typeof opts.expectedUid === 'number') dumpUid = opts.expectedUid;
        if (typeof opts.expectedGid === 'number') dumpGid = opts.expectedGid;
      };

      if (world.forceProjectedWriteFailAfterRename) {
        applyBytes();
        throw new Error('WRITE_FAIL_AFTER_RENAME');
      }
      if (world.forceProjectedRenameNoChange) {
        // Simulate failure path where rename did not alter active dump.
        throw new Error('RENAME_FAILED_PRE_UNCHANGED');
      }
      applyBytes();
      if (world.forceRetainedEnvDriftOnSave) {
        const retained = liveEntries.find((e) => e.name === 'titan-engine-worker' && e.pm_id === 5);
        if (retained) retained.env = { ...retained.env, RETAINED_DRIFT: 'x' };
      }
      if (world.forceRetainedPathChangeOnSave) {
        const retained = liveEntries.find((e) => e.name === 'titan-engine-worker' && e.pm_id === 5);
        if (retained) retained.env = { ...retained.env, PATH: '/mutated/path/should-fail' };
      }
      if (world.forceBackendEnvValueChange) {
        const b = liveEntries.find((e) => e.name === 'titan-backend');
        if (b) b.env = { ...b.env, BACKEND_SECRET: 'changed-secret-value' };
      }
      if (world.forceBackendScriptDrift) {
        const b = liveEntries.find((e) => e.name === 'titan-backend');
        if (b) b.pm_exec_path = '/app/backend/server-DRIFTED.js';
      }
      if (world.forceProcessorArgsDrift) {
        const p = liveEntries.find((e) => e.name === 'telegram-processor');
        if (p) p.args = ['--mode=drifted'];
      }
      if (world.forceMonitorDriftOnSave) {
        const m = liveEntries.find((e) => e.name === 'telegram-collector-monitor');
        if (m) m.status = 'stopped';
      }
      if (world.forceCollectorLiveEnvDriftOnSave) {
        const c = liveEntries.find((e) => e.name === 'telegram-collector');
        if (c) c.env = { ...c.env, JWT_SECRET: 'collector-live-drifted' };
      }
      if (world.forceOtherConfigDrift) {
        liveEntries.push({
          name: 'titan-error-watch',
          pm_id: 77,
          status: 'online',
          pm_exec_path: '/watch.js',
          env: { NODE_ENV: 'development' },
        });
      }
      if (world.forcePostwriteOwnerMismatch) dumpUid += 1;
      if (world.forcePostwriteGroupMismatch) dumpGid += 1;
      if (world.forceUnknownActiveOtherAfterWrite) {
        dumpEntries = deepClone(dumpEntries);
        dumpEntries.push({ name: 'other', status: 'stopped', created_at: 7777, env: {} });
      }
      if (world.forceReadDumpUnreadableAfterWrite) {
        dumpCorrupt = true;
      }

      const sha = sha256Buffer(bytes);
      if (opts.expectedSha256 && sha !== opts.expectedSha256) {
        throw Object.assign(new Error('PROJECTED_DUMP_READBACK_MISMATCH'), {
          code: 'PROJECTED_DUMP_READBACK_MISMATCH',
        });
      }

      // Tampers apply AFTER write so subsequent readDump differs from expected projection.
      applyPostWriteTampers(world, dumpEntries);

      return {
        mode: REQUIRED_PROJECTED_DUMP_MODE,
        sha256: sha,
        ownerPreserved: true,
        groupPreserved: true,
      };
    },
    async hardenActiveDumpMode(mode = 0o600) {
      // Legacy stub — v1.5 forward path must not require this.
      mutationLog.push(['hardenActiveDumpMode', mode & 0o777]);
      if (world.forceHardenCommandFail) {
        throw new Error('HARDEN_CMD_FAIL');
      }
      if (world.forceHardenSkipModeChange) {
        return { mode: dumpMode, ok: false };
      }
      if (world.forceHardenWrongMode) {
        dumpMode = 0o640;
        return { mode: dumpMode, ok: false };
      }
      dumpMode = mode & 0o777;
      return { mode: dumpMode, ok: dumpMode === (mode & 0o777) };
    },
    async healthCheck(port) {
      return { statusCode: 200, port };
    },
    async collectorFunctionalCheck() {
      return { accounts: 200, channels: 200, health: 200 };
    },
    async ensureDir() {
      mutationLog.push('ensureDir');
    },
    async chmod() {
      mutationLog.push('chmod');
    },
    async pathExists() {
      return true;
    },
  };
}

let runSeq = 0;
function nextRunId(prefix = 'T2R') {
  runSeq += 1;
  return `${prefix}-${runSeq}-${Date.now()}`;
}

function pm2SaveCount(commands) {
  return commands.mutationLog.filter((m) => m === 'pm2Save').length;
}

function projectedWriteCount(commands) {
  return commands.mutationLog.filter((m) => Array.isArray(m) && m[0] === 'writeProjectedActiveDump')
    .length;
}

function cleanPreOptsForWorld(world) {
  const cleanPreDump = prepareCleanPreFromLive(world.live);
  const actualCleanPreSha = sha256Buffer(Buffer.from(JSON.stringify(cleanPreDump), 'utf8'));
  const expectedActiveDumpSha = sha256Buffer(Buffer.from(JSON.stringify(world.dump), 'utf8'));
  return {
    cleanPreDump,
    expectedCleanPreSha: actualCleanPreSha,
    actualCleanPreSha,
    expectedActiveDumpSha,
  };
}

function buildOrch(worldOverrides = {}, orchOverrides = {}) {
  const world = makeLiveAndDump(worldOverrides);
  const commands = createFakeBoundary(world);
  if (worldOverrides.forceStartFailOnRollback) {
    const origStart = commands.startProcessByPmId.bind(commands);
    commands.startProcessByPmId = async (pmId) => {
      if (
        projectedWriteCount(commands) > 0 ||
        world.forceProjectedWriteFailBeforeRename ||
        world.forceProjectedWriteFailAfterRename
      ) {
        return { exitCode: 1 };
      }
      return origStart(pmId);
    };
  }
  if (worldOverrides.forceEngineCountNotRestoredOnRollback) {
    const origStart = commands.startProcessByPmId.bind(commands);
    commands.startProcessByPmId = async (pmId) => {
      const r = await origStart(pmId);
      const proc = commands.world().liveEntries.find((e) => e.pm_id === pmId);
      if (proc) proc.status = 'stopped';
      return r;
    };
  }
  if (worldOverrides.forceUnrelatedRollbackDrift) {
    const origStart = commands.startProcessByPmId.bind(commands);
    commands.startProcessByPmId = async (pmId) => {
      const r = await origStart(pmId);
      const retained = commands
        .world()
        .liveEntries.find(
          (e) => e.name === 'titan-engine-worker' && e.status === 'online' && e.pm_id !== pmId,
        );
      if (retained) {
        retained.env = { ...(retained.env || {}), NODE_ENV: 'production' };
      }
      return r;
    };
  }
  if (worldOverrides.forceLiveBackendEnvDriftOnRollback) {
    const origStart = commands.startProcessByPmId.bind(commands);
    commands.startProcessByPmId = async (pmId) => {
      const r = await origStart(pmId);
      const b = commands.world().liveEntries.find((e) => e.name === 'titan-backend' && e.pm_id === 1);
      if (b) b.env = { ...b.env, BACKEND_SECRET: 'drifted-after-rollback' };
      return r;
    };
  }
  if (worldOverrides.forceLiveProcessorConfigDriftOnRollback) {
    const origStart = commands.startProcessByPmId.bind(commands);
    commands.startProcessByPmId = async (pmId) => {
      const r = await origStart(pmId);
      const p = commands.world().liveEntries.find((e) => e.name === 'telegram-processor');
      if (p) p.args = ['--mode=rollback-drift'];
      return r;
    };
  }
  if (worldOverrides.forceLiveMonitorDriftOnRollback) {
    const origStart = commands.startProcessByPmId.bind(commands);
    commands.startProcessByPmId = async (pmId) => {
      const r = await origStart(pmId);
      const m = commands
        .world()
        .liveEntries.find((e) => e.name === 'telegram-collector-monitor' && e.pm_id === 8);
      if (m) m.status = 'stopped';
      return r;
    };
  }
  if (worldOverrides.forceLiveOtherProcessDriftOnRollback) {
    const origStart = commands.startProcessByPmId.bind(commands);
    commands.startProcessByPmId = async (pmId) => {
      const r = await origStart(pmId);
      commands.world().liveEntries.push({
        name: 'titan-error-watch',
        pm_id: 77,
        status: 'online',
        pm_exec_path: '/watch.js',
        env: { NODE_ENV: 'development' },
      });
      return r;
    };
  }
  const runId = orchOverrides.runId || nextRunId();
  const journalFs = orchOverrides.journalFs || createMemoryJournalFs();
  const journalRoot = orchOverrides.journalRoot || '/tmp/t2-orch-journals';
  const cleanPreDump = orchOverrides.cleanPreDump || prepareCleanPreFromLive(world.live);
  const cleanPreBytes = Buffer.from(JSON.stringify(cleanPreDump), 'utf8');
  const actualCleanPreSha = sha256Buffer(cleanPreBytes);
  const activeDumpSha = sha256Buffer(Buffer.from(JSON.stringify(world.dump), 'utf8'));
  const orch = createOrchestrator({
    commands,
    authorization: orchOverrides.authorization || makeAuth(runId),
    runId,
    backupRoot: orchOverrides.backupRoot || journalRoot,
    journalRoot,
    journalFs,
    productionModeAcknowledged: orchOverrides.productionModeAcknowledged !== false,
    expectedToolVersion: orchOverrides.expectedToolVersion || TOOL_VERSION,
    cleanPreDump,
    expectedCleanPreSha: orchOverrides.expectedCleanPreSha ?? actualCleanPreSha,
    actualCleanPreSha: orchOverrides.actualCleanPreSha ?? actualCleanPreSha,
    expectedActiveDumpSha: orchOverrides.expectedActiveDumpSha ?? activeDumpSha,
  });
  return { orch, commands, world, journalFs, journalRoot, runId, cleanPreDump, actualCleanPreSha };
}

/** Drive through stop + projection write; tamper flags fail inside writeProjectedDump. */
async function runToWrite(orch) {
  await orch.precheck();
  await orch.backup();
  await orch.stopExtra();
  await orch.buildProjection();
  return orch.writeProjectedDump();
}

describe('T2 retry orchestrator (final audit correction)', () => {
  it('T1 happy path', async () => {
    const { orch, commands } = buildOrch();
    const result = await orch.runTransaction();
    expect(result).toBe(State.COMPLETED);
    expect(orch.mutationClosed).toBe(true);
    expect(orch.journal.authConsumed).toBe(true);
    expect(pm2SaveCount(commands)).toBe(0);
    expect(projectedWriteCount(commands)).toBe(1);
    expect(orch.sideEffects.SAVE_ATTEMPTED).toBe(false);
    expect(orch.sideEffects.DUMP_SAVE_APPLIED).toBe(false);
    expect(orch.sideEffects.DUMP_MODE_HARDEN_ATTEMPTED).toBe(false);
    expect(orch.sideEffects.DUMP_MODE_HARDEN_APPLIED).toBe(false);
    expect(orch.sideEffects.PROJECTED_DUMP_WRITE_APPLIED).toBe(true);
    expect(commands.world().dumpMode).toBe(REQUIRED_PROJECTED_DUMP_MODE);
    const { liveEntries, dumpEntries } = commands.world();
    expect(liveEntries.filter((e) => e.name === 'titan-engine-worker' && e.status === 'online')).toHaveLength(1);
    const col = dumpEntries.find((e) => e.name === 'telegram-collector');
    expect(col.env.DB_USER).toBe(EXPECTED_COLLECTOR_DB_USER);
  });

  it('T2 projected write success => PROJECTION_WRITTEN then COMPLETED', async () => {
    const { orch } = buildOrch();
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    const pre = orch.preDumpSha;
    await orch.buildProjection();
    expect(orch.state).toBe(State.PROJECTION_READY);
    await orch.writeProjectedDump();
    expect(orch.state).toBe(State.PROJECTION_WRITTEN);
    expect(orch.postDumpSha).not.toBe(pre);
    await orch.postwriteVerify();
    expect(orch.state).toBe(State.POSTWRITE_VERIFIED);
    await orch.healthValidate();
    expect(await orch.complete()).toBe(State.COMPLETED);
  });

  it('T3 projected write fail before rename => rollback; pm2Save=0', async () => {
    const { orch, commands } = buildOrch({ forceProjectedWriteFailBeforeRename: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.buildProjection();
    await expect(orch.writeProjectedDump()).rejects.toMatchObject({
      code: 'PROJECTED_DUMP_STATE_UNKNOWN',
    });
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(pm2SaveCount(commands)).toBe(0);
    expect(orch.sideEffects.PROJECTED_DUMP_WRITE_ATTEMPTED).toBe(true);
    expect(orch.sideEffects.PROJECTED_DUMP_WRITE_APPLIED).toBe(false);
    expect(orch.sideEffects.ENGINE_STOP_APPLIED).toBe(true);
    expect(orch.lastRollbackPlan.restoreDump).toBe(false);
    expect(orch.lastRollbackPlan.startExtra).toBe(true);
    expect(
      commands.world().liveEntries.filter((e) => e.name === 'titan-engine-worker' && e.status === 'online'),
    ).toHaveLength(2);
    expect(orch.evidence.lines.some((l) => l.includes('PRE_EQUIVALENT=YES'))).toBe(true);
  });

  it('T4 post-write tamper (backend remove) => rollback', async () => {
    const { orch } = buildOrch({ forceBackendDriftOnSave: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
    expect(orch.state).toBe(State.ROLLED_BACK);
  });

  it('T5 rollback succeeds (exact dump restore)', async () => {
    const { orch, commands } = buildOrch({ forceProjectedWriteFailBeforeRename: true });
    await orch.precheck();
    const preSha = orch.preDumpSha;
    await orch.backup();
    await orch.stopExtra();
    await orch.buildProjection();
    await expect(orch.writeProjectedDump()).rejects.toBeInstanceOf(T2OrchestratorError);
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect((await commands.readDump()).sha256).toBe(preSha);
  });

  it('T6 mutation after FAILED blocked', async () => {
    const { orch } = buildOrch();
    orch.state = State.FAILED;
    orch.mutationClosed = true;
    orch.authConsumed = true;
    expect(() => orch.requireMutationOpen('writeProjectedActiveDump')).toThrow(/MUTATION_CLOSED/);
  });

  it('T7 mutation after COMPLETED blocked', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    expect(() => orch.requireMutationOpen('writeProjectedActiveDump')).toThrow(/MUTATION_CLOSED/);
    await expect(orch.rollback('x')).rejects.toMatchObject({ code: 'MUTATION_CLOSED' });
  });

  it('T8 replay/duplicate run blocked', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    await expect(orch.runTransaction()).rejects.toMatchObject({ code: 'REPLAY_BLOCKED' });
  });

  it('T9 stale pm_id BEFORE stop => FAILED with zero PM2 rollback mutation', async () => {
    const { orch, commands } = buildOrch();
    await orch.precheck();
    await orch.backup();
    const extra = commands.world().liveEntries.find((e) => e.pm_id === orch.selection.extra.pm_id);
    extra.restart_time = 999;
    await expect(orch.stopExtra()).rejects.toMatchObject({ code: 'STALE_EXTRA_PROCESS' });
    expect(orch.state).toBe(State.FAILED);
    expect(commands.mutationLog.some((m) => m === 'restoreDump' || (Array.isArray(m) && m[0] === 'restoreDump'))).toBe(
      false,
    );
    expect(commands.mutationLog.some((m) => Array.isArray(m) && m[0] === 'start')).toBe(false);
    expect(commands.mutationLog.some((m) => Array.isArray(m) && m[0] === 'stop')).toBe(false);
    expect(orch.evidence.lines.some((l) => l.includes('NO_PM2_ROLLBACK_MUTATION'))).toBe(true);
  });

  it('T10 unexpected dump difference blocked', async () => {
    const { orch } = buildOrch({ forceProcessorDriftOnSave: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
  });

  it('T11 evidence secret-safe', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    const blob = orch.evidence.toString();
    expect(blob.includes(SECRET_PASSWORD)).toBe(false);
    expect(blob.includes(SECRET_TOKEN)).toBe(false);
    expect(blob.includes(SECRET_BACKEND)).toBe(false);
    expect(blob).not.toMatch(/postgres:\/\//i);
  });

  it('T12 collector DB-B persistence accepted as allowlisted effect', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    expect(orch.evidence.lines.some((l) => l.includes('COLLECTOR_DB_KEYS_ADDED=0'))).toBe(true);
    expect(orch.evidence.lines.some((l) => l.includes('AUTHORIZED_DIFF_PATH_COUNT=1'))).toBe(true);
  });

  it('T13 changed dump SHA alone never causes S2 classification', async () => {
    const { orch } = buildOrch();
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.buildProjection();
    await orch.writeProjectedDump();
    expect(orch.state).toBe(State.PROJECTION_WRITTEN);
    expect(orch.evidence.lines.some((l) => /\bS2\b/.test(l))).toBe(false);
  });

  it('T14 NODE_ENV drift causes failure', async () => {
    const { orch } = buildOrch({ forceNodeEnvDriftOnSave: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
  });

  it('T15 backend/processor/monitor topology drift causes failure', async () => {
    const { orch: backendDrift } = buildOrch({ forceBackendDriftOnSave: true });
    await expect(runToWrite(backendDrift)).rejects.toMatchObject({
      code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH',
    });
    expect(backendDrift.state).toBe(State.ROLLED_BACK);

    for (const key of ['forceProcessorDriftOnSave', 'forceMonitorDriftOnSave']) {
      const { orch } = buildOrch({ [key]: true });
      let err;
      try {
        await runToWrite(orch);
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(T2OrchestratorError);
      expect([
        'PROJECTED_DUMP_POSTWRITE_MISMATCH',
        'ROLLBACK_LIVE_SEMANTIC_DRIFT',
      ]).toContain(err.code);
      expect([
        State.ROLLED_BACK,
        State.FAIL_FORWARD_COMPLETE,
      ]).toContain(orch.state);
    }
  });

  it('T16 collector DB_* values never enter evidence', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    const blob = orch.evidence.toString();
    expect(blob.includes(SECRET_PASSWORD)).toBe(false);
    expect(blob.includes('127.0.0.1')).toBe(false);
    expect(blob).toMatch(/COLLECTOR_DB_KEYS_ADDED=0/);
  });

  it('fail-closed boundary: pm2Save throws GlobalPm2SaveForbiddenError', async () => {
    await expect(createFailClosedBoundary().pm2Save()).rejects.toBeInstanceOf(GlobalPm2SaveForbiddenError);
    await expect(createFailClosedBoundary().writeProjectedActiveDump(Buffer.from('[]'))).rejects.toBeInstanceOf(
      ForbiddenLiveExecutionError,
    );
  });

  it('authorization / tool version mismatch fail closed', async () => {
    const { orch } = buildOrch({}, { expectedToolVersion: '0.0.0' });
    await expect(orch.precheck()).rejects.toMatchObject({ code: 'TOOL_VERSION_MISMATCH' });
  });

  it('deterministic retain lowest pm_id', async () => {
    const { orch } = buildOrch();
    const sel = await orch.precheck();
    expect(sel.retainedPmId).toBe(5);
    expect(sel.extraPmId).toBe(9);
  });

  it('T17 fresh process replay after consumed state = BLOCKED', async () => {
    const journalFs = createMemoryJournalFs();
    const journalRoot = '/tmp/t2-j-replay';
    const runId = nextRunId('REPLAY');
    const { orch } = buildOrch({}, { journalFs, journalRoot, runId });
    await orch.precheck();
    await orch.backup();
    expect(orch.journal.authConsumed).toBe(true);
    const loaded = await loadJournal({ runId, journalRoot, fs: journalFs });
    expect(() => loaded.assertFreshStartAllowed()).toThrow(JournalError);
  });

  it('T18 crash-after-consume simulation = BLOCKED', async () => {
    const journalFs = createMemoryJournalFs();
    const journalRoot = '/tmp/t2-j-crash';
    const runId = nextRunId('CRASH');
    const { orch } = buildOrch({}, { journalFs, journalRoot, runId });
    await orch.precheck();
    await orch.consumeAuthorization();
    const loaded = await loadJournal({ runId, journalRoot, fs: journalFs });
    expect(loaded.authConsumed).toBe(true);
    try {
      loaded.assertFreshStartAllowed();
      throw new Error('should have thrown');
    } catch (e) {
      expect(e.code).toBe('JOURNAL_AUTH_CONSUMED_NO_REPLAY');
    }
  });

  it('T19 duplicate concurrent run creation = BLOCKED', async () => {
    const journalFs = createMemoryJournalFs();
    const journalRoot = '/tmp/t2-j-dup';
    const runId = nextRunId('DUP');
    await createExclusiveJournal({ runId, journalRoot, fs: journalFs, toolVersion: TOOL_VERSION });
    await expect(
      createExclusiveJournal({ runId, journalRoot, fs: journalFs, toolVersion: TOOL_VERSION }),
    ).rejects.toMatchObject({ code: 'RUN_DIR_EXISTS' });
    const { orch } = buildOrch({}, { journalFs, journalRoot, runId });
    await expect(orch.precheck()).rejects.toMatchObject({ code: 'DUPLICATE_RUN_BLOCKED' });
  });

  it('T20 terminal journal replay = BLOCKED', async () => {
    const journalFs = createMemoryJournalFs();
    const journalRoot = '/tmp/t2-j-term';
    const runId = nextRunId('TERM');
    const { orch } = buildOrch({}, { journalFs, journalRoot, runId });
    await orch.runTransaction();
    const loaded = await loadJournal({ runId, journalRoot, fs: journalFs });
    expect(loaded.isTerminal()).toBe(true);
    expect(() => loaded.assertFreshStartAllowed()).toThrow(JournalError);
  });

  it('T21 external rollback cannot bypass auth/ack/state/terminal', async () => {
    const { orch } = buildOrch({}, { productionModeAcknowledged: false });
    orch.authConsumed = true;
    orch.state = State.BACKUP_VERIFIED;
    await expect(orch.rollback('x')).rejects.toMatchObject({ code: 'PRODUCTION_ACK_REQUIRED' });

    const { orch: o2 } = buildOrch();
    o2.state = State.BACKUP_VERIFIED;
    o2.authConsumed = false;
    o2.productionModeAcknowledged = true;
    await expect(o2.rollback('x')).rejects.toMatchObject({ code: 'AUTH_NOT_CONSUMED' });

    const { orch: o3 } = buildOrch();
    await o3.runTransaction();
    await expect(o3.rollback('x')).rejects.toMatchObject({ code: 'MUTATION_CLOSED' });

    const { orch: o4 } = buildOrch();
    o4.authConsumed = true;
    o4.productionModeAcknowledged = true;
    o4.state = State.AUTHORIZED_UNCONSUMED;
    await expect(o4.rollback('x')).rejects.toMatchObject({ code: 'ROLLBACK_STATE_INVALID' });

    const { orch: o5 } = buildOrch();
    await o5.precheck();
    await o5.backup();
    await expect(o5.guardedCall('restoreDump', async () => {})).rejects.toMatchObject({
      code: 'RESTORE_OR_START_REQUIRES_ROLLBACK_STATE',
    });
  });

  it('T22 unit: unauthorized live env must not appear in projection', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    const liveFp = semanticFingerprint(world.live);
    const sel = selectEngineRetainExtra(liveFp);
    const snap = {
      DB_HOST: '127.0.0.1',
      DB_PORT: '5433',
      DB_NAME: 'titangold_db',
      DB_USER: EXPECTED_COLLECTOR_DB_USER,
      DB_PASSWORD: SECRET_PASSWORD,
    };
    const built = buildExpectedProjectedDump({
      preDump: dump,
      selection: sel,
      collectorDbSnapshot: snap,
    });
    expect(built.ok).toBe(true);
    const badProjected = deepClone(built.projected);
    const colIdx = built.collectorMap.dumpIndex;
    badProjected[colIdx].env.UNRELATED_NEW_KEY = 'x';
    const check = assertUnauthorizedLiveEnvNotPersisted({
      preDump: dump,
      projected: badProjected,
      collectorDumpIndex: colIdx,
      liveCollectorEnvKeys: ['UNRELATED_NEW_KEY', ...COLLECTOR_DB_KEYS],
    });
    expect(check.ok).toBe(false);
  });

  it('T23 unit: backend env removal is not an authorized projection path', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    dump[2].env.BACKEND_SECRET = SECRET_BACKEND;
    const liveFp = semanticFingerprint(world.live);
    const sel = selectEngineRetainExtra(liveFp);
    const snap = {
      DB_HOST: '127.0.0.1',
      DB_PORT: '5433',
      DB_NAME: 'titangold_db',
      DB_USER: EXPECTED_COLLECTOR_DB_USER,
      DB_PASSWORD: SECRET_PASSWORD,
    };
    const built = buildExpectedProjectedDump({ preDump: dump, selection: sel, collectorDbSnapshot: snap });
    expect(built.ok).toBe(true);
    const diffs = structuralDiffPaths(dump, built.projected);
    expect(diffs.every((p) => !p.includes('BACKEND_SECRET'))).toBe(true);
    expect(diffs).toHaveLength(1);
  });

  it('T24 unit: projection does not copy live JWT/backend secret values into evidence paths', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    const b = dump.find((e) => e.name === 'titan-backend');
    b.env.BACKEND_SECRET = SECRET_BACKEND;
    const liveFp = semanticFingerprint(world.live);
    const sel = selectEngineRetainExtra(liveFp);
    const snap = {
      DB_HOST: '127.0.0.1',
      DB_PORT: '5433',
      DB_NAME: 'titangold_db',
      DB_USER: EXPECTED_COLLECTOR_DB_USER,
      DB_PASSWORD: SECRET_PASSWORD,
    };
    const built = buildExpectedProjectedDump({ preDump: dump, selection: sel, collectorDbSnapshot: snap });
    expect(built.ok).toBe(true);
    const blob = JSON.stringify(built.manifest);
    expect(blob.includes(SECRET_BACKEND)).toBe(false);
    expect(blob.includes(SECRET_PASSWORD)).toBe(false);
  });

  it('T25 unit: collector unrelated env cannot be authorized by projection builder', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    const liveFp = semanticFingerprint(world.live);
    const sel = selectEngineRetainExtra(liveFp);
    const snap = {
      DB_HOST: '127.0.0.1',
      DB_PORT: '5433',
      DB_NAME: 'titangold_db',
      DB_USER: EXPECTED_COLLECTOR_DB_USER,
      DB_PASSWORD: SECRET_PASSWORD,
    };
    const built = buildExpectedProjectedDump({ preDump: dump, selection: sel, collectorDbSnapshot: snap });
    const col = built.projected[built.collectorMap.dumpIndex];
    expect(col.env.COLLECTOR_EXTRA).toBeUndefined();
    expect(Object.keys(col.env).filter((k) => COLLECTOR_DB_KEYS.includes(k))).toHaveLength(5);
  });

  it('T26 unit: provider env appearance rejected by assertUnauthorizedLiveEnvNotPersisted', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    const liveFp = semanticFingerprint(world.live);
    const sel = selectEngineRetainExtra(liveFp);
    const snap = {
      DB_HOST: '127.0.0.1',
      DB_PORT: '5433',
      DB_NAME: 'titangold_db',
      DB_USER: EXPECTED_COLLECTOR_DB_USER,
      DB_PASSWORD: SECRET_PASSWORD,
    };
    const built = buildExpectedProjectedDump({ preDump: dump, selection: sel, collectorDbSnapshot: snap });
    const bad = deepClone(built.projected);
    bad[built.collectorMap.dumpIndex].env.MEXC_API_KEY = 'provider-secret';
    const check = assertUnauthorizedLiveEnvNotPersisted({
      preDump: dump,
      projected: bad,
      collectorDumpIndex: built.collectorMap.dumpIndex,
      liveCollectorEnvKeys: ['MEXC_API_KEY', ...COLLECTOR_DB_KEYS],
    });
    expect(check.ok).toBe(false);
  });

  it('T27 integration: post-write tamper with telegram token => rollback; secret-safe', async () => {
    const { orch } = buildOrch({ forceTelegramTokenAppear: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(orch.evidence.toString().includes(SECRET_TOKEN)).toBe(false);
  });

  it('T28 unchanged existing secret values do not appear in evidence', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    const blob = orch.evidence.toString();
    expect(blob.includes(SECRET_BACKEND)).toBe(false);
    expect(blob.includes(SECRET_PASSWORD)).toBe(false);
  });

  it('T29 live adapter: pm2Save throws GLOBAL_PM2_SAVE_FORBIDDEN', async () => {
    expect(() => createLiveBoundary({ gatesSatisfied: false })).toThrow(ForbiddenLiveExecutionError);
    let spawned = [];
    const boundary = createLiveBoundary({
      gatesSatisfied: true,
      dumpPath: '/tmp/fake-dump.pm2',
      spawnSyncImpl: (cmd, args) => {
        spawned.push([cmd, ...args]);
        if (cmd === 'pm2' && args[0] === 'jlist') {
          return { status: 0, stdout: '[]', stderr: '' };
        }
        if (cmd === 'pm2' && args[0] === 'save') {
          return { status: 0, stdout: 'secret-should-not-leak', stderr: '' };
        }
        return { status: 0, stdout: '200', stderr: '' };
      },
    });
    await expect(boundary.pm2Save()).rejects.toMatchObject({ code: 'GLOBAL_PM2_SAVE_FORBIDDEN' });
    expect(spawned.some((s) => s[0] === 'pm2' && s[1] === 'save')).toBe(false);
  });

  it('T30 auth consume persisted before backup mutation', async () => {
    const journalFs = createMemoryJournalFs();
    const journalRoot = '/tmp/t2-j-order';
    const runId = nextRunId('ORDER');
    let backupCalled = false;
    const world = makeLiveAndDump();
    const base = createFakeBoundary(world);
    const commands = {
      ...base,
      async writeBackup(...args) {
        const j = await loadJournal({ runId, journalRoot, fs: journalFs });
        expect(j.authConsumed).toBe(true);
        backupCalled = true;
        return base.writeBackup(...args);
      },
    };
    const orch = createOrchestrator({
      commands,
      authorization: makeAuth(runId),
      runId,
      backupRoot: journalRoot,
      journalRoot,
      journalFs,
      productionModeAcknowledged: true,
      ...cleanPreOptsForWorld(world),
    });
    await orch.precheck();
    await orch.backup();
    expect(backupCalled).toBe(true);
  });

  it('T31 all mutating ops are listed for guard coverage', () => {
    for (const op of [
      'ensureDir',
      'writeBackup',
      'chmod',
      'stopProcessByPmId',
      'writeProjectedActiveDump',
      'pm2Save',
      'hardenActiveDumpMode',
      'restoreDump',
      'startProcessByPmId',
    ]) {
      expect(MUTATING_OPS.includes(op)).toBe(true);
    }
  });

  it('T32 start rollback nonzero => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({
      forceProjectedWriteFailBeforeRename: true,
      forceStartFailOnRollback: true,
    });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.buildProjection();
    await expect(orch.writeProjectedDump()).rejects.toMatchObject({ code: 'START_ROLLBACK_NONZERO' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
    expect(orch.mutationClosed).toBe(true);
  });

  it('T33 restored dump SHA mismatch => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({ forceBackendDriftOnSave: true, forceRestoreShaMismatch: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'ROLLBACK_DUMP_SHA_MISMATCH' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T34 engine count not restored => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({
      forceProjectedWriteFailBeforeRename: true,
      forceEngineCountNotRestoredOnRollback: true,
    });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.buildProjection();
    await expect(orch.writeProjectedDump()).rejects.toMatchObject({
      code: 'ROLLBACK_ENGINE_COUNT_NOT_RESTORED',
    });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T35 unrelated rollback drift => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({ forceBackendDriftOnSave: true, forceUnrelatedRollbackDrift: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'ROLLBACK_ENGINE_CONFIG_DRIFT' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T36 successful rollback proves PRE_EQUIVALENT', async () => {
    const { orch } = buildOrch({ forceBackendDriftOnSave: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
    expect(orch.sideEffects.PROJECTED_DUMP_WRITE_ATTEMPTED).toBe(true);
    expect(orch.sideEffects.PROJECTED_DUMP_WRITE_APPLIED).toBe(false);
    expect(orch.sideEffects.DUMP_SAVE_APPLIED).toBe(false);
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(orch.evidence.lines.some((l) => l.includes('PRE_EQUIVALENT=YES'))).toBe(true);
  });

  it('T37 dump DB_PASSWORD tamper after projected write => FAIL', async () => {
    const { orch } = buildOrch({ forceCollectorDbPasswordMismatch: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(orch.evidence.toString().includes('wrong-password')).toBe(false);
  });

  it('T38 dump DB_HOST tamper after projected write => FAIL', async () => {
    const { orch } = buildOrch({ forceCollectorDbHostMismatch: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(orch.evidence.toString().includes('10.0.0.1')).toBe(false);
  });

  it('T39 dump DB_NAME tamper after projected write => FAIL', async () => {
    const { orch } = buildOrch({ forceCollectorDbNameMismatch: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
    expect(orch.state).toBe(State.ROLLED_BACK);
  });

  it('T40 all five DB exact match = PASS; no credential values in evidence', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    for (const k of COLLECTOR_DB_KEYS) {
      expect(orch.evidence.lines.some((l) => l.includes(`${k}_MATCH=YES`))).toBe(true);
    }
    const blob = orch.evidence.toString();
    expect(blob.includes(SECRET_PASSWORD)).toBe(false);
    expect(blob.includes('127.0.0.1')).toBe(false);
    expect(blob.includes('5433')).toBe(false);
  });

  it('T41 backend script drift = FAIL', async () => {
    const { orch } = buildOrch({ forceBackendScriptDrift: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'ROLLBACK_LIVE_SEMANTIC_DRIFT' });
  });

  it('T42 backend cwd drift = FAIL', async () => {
    const { orch } = buildOrch({ forceBackendCwdDrift: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
  });

  it('T43 processor args drift = FAIL', async () => {
    const { orch } = buildOrch({ forceProcessorArgsDrift: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'ROLLBACK_LIVE_SEMANTIC_DRIFT' });
  });

  it('T44 unrelated process config drift = FAIL', async () => {
    const { orch } = buildOrch({ forceOtherConfigDrift: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'ROLLBACK_LIVE_SEMANTIC_DRIFT' });
  });

  it('T45 env shapes: entry.env + entry.pm2_env.env + flat dump supported', () => {
    const a = extractProcessEnvResult({ name: 'x', env: { A: '1' } });
    expect(a.ok).toBe(true);
    expect(a.shape).toBe('entry.env');

    const b = extractProcessEnvResult({
      name: 'x',
      pm2_env: { status: 'online', env: { B: '2' } },
    });
    expect(b.ok).toBe(true);
    expect(b.shape).toBe('entry.pm2_env.env');

    const c = extractProcessEnvResult({
      name: 'x',
      status: 'online',
      pm_exec_path: '/a.js',
      pm_cwd: '/a',
      NODE_ENV: 'development',
      DB_USER: 'u',
    });
    expect(c.ok).toBe(true);
    expect(c.shape).toBe('flat_dump_entry');
    expect(c.env.DB_USER).toBe('u');

    const bad = assertEntriesEnvShapes([{ foo: 1 }]);
    expect(bad.ok).toBe(false);
  });

  it('T46 execute without explicit expected-tool-version => fail closed', () => {
    const g = evaluateLiveExecutionGates([
      '--execute',
      '--run-id',
      'X',
      '--authorization-file',
      '/a.json',
      '--acknowledge-production-mutation',
      'YES',
      '--backup-root',
      '/tmp/b',
      '--confirm-run-transaction',
      '--clean-pre-file',
      '/tmp/clean.json',
      '--expected-clean-pre-sha',
      'a'.repeat(64),
      '--expected-active-dump-sha',
      'b'.repeat(64),
    ]);
    expect(g.ok).toBe(false);
    expect(g.missing).toContain('--expected-tool-version');
  });

  it('T47 wrong tool version => fail closed', () => {
    const g = evaluateLiveExecutionGates([
      '--execute',
      '--run-id',
      'X',
      '--authorization-file',
      '/a.json',
      '--acknowledge-production-mutation',
      'YES',
      '--backup-root',
      '/tmp/b',
      '--expected-tool-version',
      '0.0.0',
      '--confirm-run-transaction',
      '--clean-pre-file',
      '/tmp/clean.json',
      '--expected-clean-pre-sha',
      'a'.repeat(64),
      '--expected-active-dump-sha',
      'b'.repeat(64),
    ]);
    expect(g.ok).toBe(false);
    expect(g.error).toBe('TOOL_VERSION_MISMATCH');
  });

  it('T48 no confirm-run-transaction => cannot initialize live transaction', () => {
    const g = evaluateLiveExecutionGates([
      '--execute',
      '--run-id',
      'X',
      '--authorization-file',
      '/a.json',
      '--acknowledge-production-mutation',
      'YES',
      '--backup-root',
      '/tmp/b',
      '--expected-tool-version',
      TOOL_VERSION,
      '--clean-pre-file',
      '/tmp/clean.json',
      '--expected-clean-pre-sha',
      'a'.repeat(64),
      '--expected-active-dump-sha',
      'b'.repeat(64),
    ]);
    expect(g.ok).toBe(false);
    expect(g.missing).toContain('--confirm-run-transaction');
  });

  it('T49 all explicit gates => adapter may initialize in mocked test only', () => {
    const g = evaluateLiveExecutionGates([
      '--execute',
      '--run-id',
      'X',
      '--authorization-file',
      '/a.json',
      '--acknowledge-production-mutation',
      'YES',
      '--backup-root',
      '/tmp/b',
      '--expected-tool-version',
      TOOL_VERSION,
      '--confirm-run-transaction',
      '--clean-pre-file',
      '/tmp/clean.json',
      '--expected-clean-pre-sha',
      'a'.repeat(64),
      '--expected-active-dump-sha',
      'b'.repeat(64),
    ]);
    expect(g.ok).toBe(true);
    const boundary = createLiveBoundary({
      gatesSatisfied: g.ok,
      spawnSyncImpl: () => ({ status: 0, stdout: '[]', stderr: '' }),
    });
    expect(boundary).toBeTruthy();  });

  it('T50 journal durable write invokes fsync (mocked)', async () => {
    const fs = createMemoryJournalFs();
    const runId = nextRunId('FSYNC');
    const j = await createExclusiveJournal({
      runId,
      journalRoot: '/tmp/t2-fsync',
      fs,
      toolVersion: TOOL_VERSION,
    });
    await j.markAuthorizationConsumed();
    expect(fs.fsyncCalls.length).toBeGreaterThan(0);
    expect(j.authConsumed).toBe(true);
  });

  it('T51 side-effect plan: stale/no-stop => no restore/start', () => {
    const ledger = createSideEffectLedger();
    ledger.BACKUP_WRITTEN = true;
    const plan = planRollbackActions(ledger);
    expect(plan.restoreDump).toBe(false);
    expect(plan.startExtra).toBe(false);
    expect(plan.anyPm2Mutation).toBe(false);
  });

  it('T52 compareCollectorDbLiveToPersist secret-safe', () => {
    const live = { env_keys: [...COLLECTOR_DB_KEYS] };
    Object.defineProperty(live, '_envValues', {
      value: {
        DB_HOST: '127.0.0.1',
        DB_PORT: '5433',
        DB_NAME: 'titangold_db',
        DB_USER: EXPECTED_COLLECTOR_DB_USER,
        DB_PASSWORD: SECRET_PASSWORD,
      },
      enumerable: false,
    });
    const persist = { env_keys: [...COLLECTOR_DB_KEYS] };
    Object.defineProperty(persist, '_envValues', {
      value: {
        DB_HOST: '127.0.0.1',
        DB_PORT: '5433',
        DB_NAME: 'titangold_db',
        DB_USER: EXPECTED_COLLECTOR_DB_USER,
        DB_PASSWORD: SECRET_PASSWORD,
      },
      enumerable: false,
    });
    const ok = compareCollectorDbLiveToPersist(live, persist);
    expect(ok.ok).toBe(true);
    expect(JSON.stringify(ok).includes(SECRET_PASSWORD)).toBe(false);

    const badPersist = { env_keys: [...COLLECTOR_DB_KEYS] };
    Object.defineProperty(badPersist, '_envValues', {
      value: { ...live._envValues, DB_PASSWORD: 'nope' },
      enumerable: false,
    });
    const bad = compareCollectorDbLiveToPersist(live, badPersist);
    expect(bad.ok).toBe(false);
    expect(bad.matches.DB_PASSWORD_MATCH).toBe('NO');
  });

  it('T53 jlist-shaped fingerprint works', () => {
    const entries = [
      {
        name: 'telegram-collector',
        pm_id: 16,
        pm2_env: {
          status: 'online',
          pm_cwd: '/c',
          pm_exec_path: '/c/i.js',
          exec_mode: 'fork_mode',
          env: {
            NODE_ENV: 'production',
            DB_HOST: 'h',
            DB_PORT: '1',
            DB_NAME: 'n',
            DB_USER: EXPECTED_COLLECTOR_DB_USER,
            DB_PASSWORD: 'p',
          },
        },
      },
    ];
    const shape = assertEntriesEnvShapes(entries);
    expect(shape.ok).toBe(true);
    const fp = semanticFingerprint(entries);
    expect(fp.collectors[0].db_user_matches_expected).toBe(true);
  });

  it('T54 PRE dump mode 0600 restored as 0600', async () => {
    const { orch, commands } = buildOrch({ dumpMode: 0o600, forceBackendDriftOnSave: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
    expect(orch.preDumpMode).toBe(0o600);
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(commands.world().dumpMode).toBe(0o600);
    const restoreCalls = commands.mutationLog.filter((m) => Array.isArray(m) && m[0] === 'restoreDump');
    expect(restoreCalls[0][1]).toBe(0o600);
  });

  it('T55 PRE dump mode 0640 restored as 0640', async () => {
    const { orch, commands } = buildOrch({ dumpMode: 0o640, forceBackendDriftOnSave: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
    expect(orch.preDumpMode).toBe(0o640);
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(commands.world().dumpMode).toBe(0o640);
  });

  it('T56 restore never forces 0664 unless PRE was 0664', async () => {
    const { orch, commands } = buildOrch({ dumpMode: 0o600, forceBackendDriftOnSave: true });
    await expect(runToWrite(orch)).rejects.toBeTruthy();
    expect(commands.world().dumpMode).not.toBe(0o664);
    expect(commands.mutationLog.some((m) => Array.isArray(m) && m[0] === 'restoreDump' && m[1] === 0o664)).toBe(
      false,
    );
  });

  it('T57 restore mode mismatch => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({
      dumpMode: 0o600,
      forceBackendDriftOnSave: true,
      forceRestoreModeMismatch: true,
    });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'ROLLBACK_DUMP_MODE_MISMATCH' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T57b rollback UID mismatch => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({
      forceBackendDriftOnSave: true,
      restoreUidOverride: 2000,
    });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'ROLLBACK_DUMP_UID_MISMATCH' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T57c rollback GID mismatch => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({
      forceBackendDriftOnSave: true,
      restoreGidOverride: 3000,
    });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'ROLLBACK_DUMP_GID_MISMATCH' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T58 engine args differ => precheck FAIL before auth consumption', async () => {
    const world = makeLiveAndDump();
    world.live[0].args = ['--a'];
    world.live[1].args = ['--b'];
    world.dump = prepareDumpFromLive(world.live);
    const runId = nextRunId('ENGARGS');
    const journalFs = createMemoryJournalFs();
    const journalRoot = '/tmp/t2-eng-args';
    const orch = createOrchestrator({
      commands: createFakeBoundary(world),
      authorization: makeAuth(runId),
      runId,
      backupRoot: journalRoot,
      journalRoot,
      journalFs,
      productionModeAcknowledged: true,
      ...cleanPreOptsForWorld(world),
    });
    await expect(orch.precheck()).rejects.toMatchObject({ code: 'ENGINE_RUNTIME_IDENTITY_MISMATCH' });
    expect(orch.authConsumed).toBe(false);
    expect(orch.journal.authConsumed).toBe(false);
  });

  it('T59 PATH-only difference with canonical consensus => PASS retain canonical', async () => {
    const world = makeLiveAndDump();
    world.live[0].env = { ...world.live[0].env, PATH: '/noncanonical/extra/bin:/usr/bin' };
    world.live[1].env = { ...world.live[1].env, PATH: '/usr/bin' };
    const fp = semanticFingerprint(world.live);
    const sel = selectEngineRetainExtra(fp);
    expect(sel.ok).toBe(true);
    expect(sel.retained.pm_id).toBe(9);
    expect(sel.extra.pm_id).toBe(5);
    expect(sel.evidence.ENGINE_PATH_EXCEPTION_USED).toBe('YES');
    expect(sel.evidence.CANONICAL_PATH_REFERENCE).toBe('BACKEND_PROCESSOR_CONSENSUS');
    expect(sel.evidence.RETAINED_PATH_MATCH_CANONICAL).toBe('YES');
    expect(sel.evidence.EXTRA_PATH_MATCH_CANONICAL).toBe('NO');
    const blob = JSON.stringify(sel);
    expect(blob.includes('/usr/bin')).toBe(false);
    expect(blob.includes('/noncanonical')).toBe(false);
  });

  it('T60 engine env key differs => FAIL', async () => {
    const world = makeLiveAndDump();
    world.live[1].env = { ...world.live[1].env, EXTRA_ENGINE_KEY: 'x' };
    const fp = semanticFingerprint(world.live);
    const sel = selectEngineRetainExtra(fp);
    expect(sel.ok).toBe(false);
    expect(sel.error).toBe('ENGINE_RUNTIME_IDENTITY_MISMATCH');
  });

  it('T61 identical engines differing only pm_id/pid/timestamps => PASS', async () => {
    const world = makeLiveAndDump();
    world.live[0].pid = 111;
    world.live[1].pid = 222;
    world.live[0].created_at = 1;
    world.live[1].created_at = 999;
    world.live[0].restart_time = 1;
    world.live[1].restart_time = 50;
    const fp = semanticFingerprint(world.live);
    const sel = selectEngineRetainExtra(fp);
    expect(sel.ok).toBe(true);
    expect(sel.retained.pm_id).toBe(5);
    expect(sel.extra.pm_id).toBe(9);
  });

  it('T62 live backend env drift after rollback => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({
      forceBackendDriftOnSave: true,
      forceLiveBackendEnvDriftOnRollback: true,
    });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'ROLLBACK_LIVE_SEMANTIC_DRIFT' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
    expect(orch.evidence.toString().includes('drifted-after-rollback')).toBe(false);
  });

  it('T63 live processor config drift => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({
      forceBackendDriftOnSave: true,
      forceLiveProcessorConfigDriftOnRollback: true,
    });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'ROLLBACK_LIVE_SEMANTIC_DRIFT' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T64 live monitor status/config drift => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({
      forceBackendDriftOnSave: true,
      forceLiveMonitorDriftOnRollback: true,
    });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'ROLLBACK_LIVE_SEMANTIC_DRIFT' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T65 live unrelated-process drift => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({
      forceBackendDriftOnSave: true,
      forceLiveOtherProcessDriftOnRollback: true,
    });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'ROLLBACK_LIVE_SEMANTIC_DRIFT' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T66 exact PRE live semantic equivalence => ROLLED_BACK', async () => {
    const { orch } = buildOrch({ forceBackendDriftOnSave: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(orch.evidence.lines.some((l) => l.includes('PRE_EQUIVALENT=YES'))).toBe(true);
  });

  it('T67 jlist/dump parse failures return fixed codes only', async () => {
    const jlistBoundary = createLiveBoundary({
      gatesSatisfied: true,
      spawnSyncImpl: () => ({ status: 0, stdout: 'NOT_JSON{{{', stderr: 'secret-leak' }),
    });
    await expect(jlistBoundary.listLiveProcesses()).rejects.toMatchObject({ code: 'PM2_JLIST_PARSE_FAILED' });
    try {
      await jlistBoundary.listLiveProcesses();
    } catch (e) {
      expect(String(e.message)).toBe('PM2_JLIST_PARSE_FAILED');
      expect(String(e.message).includes('secret')).toBe(false);
      expect(String(e.message).includes('NOT_JSON')).toBe(false);
    }

    const fs = await import('fs/promises');
    const tmpDump = `/tmp/t2-bad-dump-${Date.now()}.pm2`;
    await fs.writeFile(tmpDump, 'NOT_JSON_DUMP_CONTENT_WITH_SECRET=abc', { mode: 0o600 });
    const dumpBoundary = createLiveBoundary({
      gatesSatisfied: true,
      dumpPath: tmpDump,
      spawnSyncImpl: () => ({ status: 0, stdout: '[]', stderr: '' }),
    });
    await expect(dumpBoundary.readDump()).rejects.toMatchObject({ code: 'PM2_DUMP_PARSE_FAILED' });
    try {
      await dumpBoundary.readDump();
    } catch (e) {
      expect(String(e.message)).toBe('PM2_DUMP_PARSE_FAILED');
      expect(String(e.message).includes('SECRET')).toBe(false);
      expect(String(e.message).includes('NOT_JSON')).toBe(false);
    }
    await fs.unlink(tmpDump).catch(() => {});
  });

  it('T68 PATH differs plus another env value => FAIL', () => {
    const world = makeLiveAndDump();
    world.live[0].env = { ...world.live[0].env, PATH: '/a', FOO: '1' };
    world.live[1].env = { ...world.live[1].env, PATH: '/b', FOO: '2' };
    const sel = selectEngineRetainExtra(semanticFingerprint(world.live));
    expect(sel.ok).toBe(false);
    expect(sel.error).toBe('ENGINE_RUNTIME_IDENTITY_MISMATCH');
  });

  it('T69 PATH key missing on one engine => FAIL', () => {
    const world = makeLiveAndDump();
    delete world.live[1].env.PATH;
    const sel = selectEngineRetainExtra(semanticFingerprint(world.live));
    expect(sel.ok).toBe(false);
    expect(sel.error).toBe('ENGINE_RUNTIME_IDENTITY_MISMATCH');
  });

  it('T70 backend PATH disagreement => ENGINE_CANONICAL_PATH_UNRESOLVED', () => {
    const world = makeLiveAndDump();
    world.live[0].env = { ...world.live[0].env, PATH: '/noncanonical:/usr/bin' };
    world.live[1].env = { ...world.live[1].env, PATH: '/usr/bin' };
    const b2 = world.live.find((e) => e.name === 'titan-backend' && e.pm_id === 2);
    b2.env = { ...b2.env, PATH: '/other/backend/path' };
    const sel = selectEngineRetainExtra(semanticFingerprint(world.live));
    expect(sel.ok).toBe(false);
    expect(sel.error).toBe('ENGINE_CANONICAL_PATH_UNRESOLVED');
  });

  it('T71 backend vs processor PATH disagreement => unresolved', () => {
    const world = makeLiveAndDump();
    world.live[0].env = { ...world.live[0].env, PATH: '/noncanonical:/usr/bin' };
    world.live[1].env = { ...world.live[1].env, PATH: '/usr/bin' };
    const proc = world.live.find((e) => e.name === 'telegram-processor');
    proc.env = { ...proc.env, PATH: '/processor/other' };
    const sel = selectEngineRetainExtra(semanticFingerprint(world.live));
    expect(sel.ok).toBe(false);
    expect(sel.error).toBe('ENGINE_CANONICAL_PATH_UNRESOLVED');
  });

  it('T72 neither engine matches canonical PATH => unresolved', () => {
    const world = makeLiveAndDump();
    world.live[0].env = { ...world.live[0].env, PATH: '/engine/a' };
    world.live[1].env = { ...world.live[1].env, PATH: '/engine/b' };
    const sel = selectEngineRetainExtra(semanticFingerprint(world.live));
    expect(sel.ok).toBe(false);
    expect(sel.error).toBe('ENGINE_CANONICAL_PATH_UNRESOLVED');
  });

  it('T73 no raw PATH in evidence for PATH exception precheck', async () => {
    const world = makeLiveAndDump();
    world.live[0].env = { ...world.live[0].env, PATH: '/noncanonical/extra/bin:/usr/bin' };
    world.live[1].env = { ...world.live[1].env, PATH: '/usr/bin' };
    world.dump = prepareDumpFromLive(world.live);
    const runId = nextRunId('PATHEV');
    const journalFs = createMemoryJournalFs();
    const journalRoot = '/tmp/t2-path-ev';
    const orch = createOrchestrator({
      commands: createFakeBoundary(world),
      authorization: makeAuth(runId),
      runId,
      backupRoot: journalRoot,
      journalRoot,
      journalFs,
      productionModeAcknowledged: true,
      ...cleanPreOptsForWorld(world),
    });
    await orch.precheck();
    expect(orch.selection.retained.pm_id).toBe(9);
    const ev = orch.evidence.toString();
    expect(ev.includes('ENGINE_PATH_EXCEPTION_USED=YES')).toBe(true);
    expect(ev.includes('/usr/bin')).toBe(false);
    expect(ev.includes('/noncanonical')).toBe(false);
    expect(ev.includes(SECRET_PASSWORD)).toBe(false);
  });

  it('T74 PRE→POST retained PATH change still FAIL', async () => {
    const { orch } = buildOrch({ forceRetainedPathChangeOnSave: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'ROLLBACK_ENGINE_CONFIG_DRIFT' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T75 rollback PATH drift still FAIL', async () => {
    const { orch, commands } = buildOrch({ forceBackendDriftOnSave: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.buildProjection();
    const origStart = commands.startProcessByPmId.bind(commands);
    commands.startProcessByPmId = async (pmId) => {
      const r = await origStart(pmId);
      for (const e of commands.world().liveEntries) {
        if (e.name === 'titan-engine-worker') {
          e.env = { ...(e.env || {}), PATH: '/rollback/drift/path' };
        }
      }
      return r;
    };
    await expect(orch.writeProjectedDump()).rejects.toMatchObject({ code: 'ROLLBACK_ENGINE_CONFIG_DRIFT' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
    expect(orch.evidence.toString().includes('/rollback/drift')).toBe(false);
  });

  it('T76 projected write once; no pm2Save; final mode 0600', async () => {
    const { orch, commands } = buildOrch();
    await orch.runTransaction();
    expect(orch.state).toBe(State.COMPLETED);
    expect(pm2SaveCount(commands)).toBe(0);
    expect(projectedWriteCount(commands)).toBe(1);
    expect(commands.world().dumpMode).toBe(REQUIRED_PROJECTED_DUMP_MODE);
    expect(orch.sideEffects.PROJECTED_DUMP_WRITE_ATTEMPTED).toBe(true);
    expect(orch.sideEffects.PROJECTED_DUMP_WRITE_APPLIED).toBe(true);
    expect(orch.sideEffects.DUMP_MODE_HARDEN_ATTEMPTED).toBe(false);
    expect(orch.evidence.toString().includes('MODE=0600')).toBe(true);
  });

  it('T77 projected write fail after rename => rollback; pm2Save=0', async () => {
    const { orch, commands } = buildOrch({ forceProjectedWriteFailAfterRename: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.buildProjection();
    await expect(orch.writeProjectedDump()).rejects.toMatchObject({
      code: 'PROJECTED_DUMP_STATE_UNKNOWN',
    });
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(pm2SaveCount(commands)).toBe(0);
    expect(orch.sideEffects.PROJECTED_DUMP_WRITE_ATTEMPTED).toBe(true);
    expect(orch.sideEffects.PROJECTED_DUMP_WRITE_APPLIED).toBe(false);
  });

  it('T77b rename failure with PRE exact => no restore', async () => {
    const { orch } = buildOrch({ forceProjectedRenameNoChange: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.buildProjection();
    await expect(orch.writeProjectedDump()).rejects.toMatchObject({ code: 'PROJECTED_DUMP_STATE_UNKNOWN' });
    expect(orch.sideEffects.DUMP_RESTORE_DECISION).toBe('ACTIVE_DUMP_IS_EXACT_PRE');
    expect(orch.sideEffects.DUMP_RESTORE_REQUIRED).toBe(false);
    expect(orch.lastRollbackPlan.restoreDump).toBe(false);
  });

  it('T77c unreadable active dump after write => conservative restore', async () => {
    const { orch } = buildOrch({ forceReadDumpUnreadableAfterWrite: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.buildProjection();
    await expect(orch.writeProjectedDump()).rejects.toMatchObject({ code: 'PROJECTED_DUMP_STATE_UNKNOWN' });
    expect(orch.sideEffects.DUMP_RESTORE_DECISION).toBe('ACTIVE_DUMP_UNREADABLE');
    expect(orch.sideEffects.DUMP_RESTORE_REQUIRED).toBe(true);
    expect(orch.lastRollbackPlan.restoreDump).toBe(true);
  });

  it('T77d active dump other content => restore', async () => {
    const { orch } = buildOrch({ forceUnknownActiveOtherAfterWrite: true, forceReadbackMismatch: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
    expect(orch.sideEffects.DUMP_RESTORE_DECISION).toBe('ACTIVE_DUMP_IS_OTHER');
    expect(orch.sideEffects.DUMP_RESTORE_REQUIRED).toBe(true);
    expect(orch.lastRollbackPlan.restoreDump).toBe(true);
  });

  it('T78 forceReadbackMismatch => rollback', async () => {
    const { orch } = buildOrch({ forceReadbackMismatch: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
    expect(orch.state).toBe(State.ROLLED_BACK);
  });

  it('T79 forceOwnerMismatch => rollback', async () => {
    const { orch } = buildOrch({ forceOwnerMismatch: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_STATE_UNKNOWN' });
    expect(orch.state).toBe(State.ROLLED_BACK);
  });

  it('T79b projected group mismatch => rollback', async () => {
    const { orch } = buildOrch({ forceGroupMismatch: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_STATE_UNKNOWN' });
    expect(orch.state).toBe(State.ROLLED_BACK);
  });

  it('T79c ownership unsafe detected before auth consume', async () => {
    const { orch } = buildOrch({ forceOwnershipUnsafe: true });
    await expect(orch.precheck()).rejects.toMatchObject({ code: 'DUMP_OWNERSHIP_PRESERVATION_UNSAFE' });
    expect(orch.authConsumed).toBe(false);
  });

  it('T80 writeProjectedActiveDump after terminal => BLOCKED', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    await expect(
      orch.guardedCall('writeProjectedActiveDump', async () => ({ mode: 0o600, sha256: 'x' })),
    ).rejects.toMatchObject({ code: 'MUTATION_CLOSED' });
  });

  it('T81 postwriteVerify before PROJECTION_WRITTEN => BLOCKED', async () => {
    const { orch } = buildOrch();
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.buildProjection();
    expect(orch.state).toBe(State.PROJECTION_READY);
    await expect(orch.postwriteVerify()).rejects.toMatchObject({ code: 'STATE_BLOCKED' });
  });

  it('T82 rollback restores PRE 0664 after projected write tamper', async () => {
    const { orch, commands } = buildOrch({ dumpMode: 0o664, forceBackendDriftOnSave: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
    expect(orch.preDumpMode).toBe(0o664);
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(commands.world().dumpMode).toBe(0o664);
  });

  it('T83 rollback restores PRE 0600 after projected write tamper', async () => {
    const { orch, commands } = buildOrch({ dumpMode: 0o600, forceBackendDriftOnSave: true });
    await expect(runToWrite(orch)).rejects.toMatchObject({ code: 'PROJECTED_DUMP_POSTWRITE_MISMATCH' });
    expect(orch.preDumpMode).toBe(0o600);
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(commands.world().dumpMode).toBe(0o600);
  });

  it('T84 no pm2Save during projected write/rollback', async () => {
    const { orch, commands } = buildOrch({ forceProjectedWriteFailAfterRename: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.buildProjection();
    await expect(orch.writeProjectedDump()).rejects.toBeTruthy();
    expect(pm2SaveCount(commands)).toBe(0);
  });

  it('T85 ledger projected write attempted/applied persists durably', async () => {
    const { orch, journalFs, journalRoot, runId } = buildOrch();
    await orch.runTransaction();
    const j = await loadJournal({ runId, journalRoot, fs: journalFs });
    expect(j.record.sideEffects.PROJECTED_DUMP_WRITE_ATTEMPTED).toBe(true);
    expect(j.record.sideEffects.PROJECTED_DUMP_WRITE_APPLIED).toBe(true);
    expect(j.record.sideEffects.DUMP_MODE_HARDEN_ATTEMPTED).toBe(false);
    expect(j.record.sideEffects.DUMP_SAVE_APPLIED).toBe(false);
  });

  it('T86 old TOOL_VERSION 1.3.0 artifact => FAIL', async () => {
    const { orch } = buildOrch({}, { expectedToolVersion: '1.3.0' });
    await expect(orch.precheck()).rejects.toMatchObject({ code: 'TOOL_VERSION_MISMATCH' });
    expect(orch.authConsumed).toBe(false);
  });

  it('T87 missing PROJECTED_DUMP_WRITE_0600 authorized effect => FAIL', async () => {
    const runId = nextRunId('NOHARDEN');
    const auth = makeAuth(runId);
    auth.authorizedEffects = ['ENGINE_2_TO_1'];
    const { orch } = buildOrch({}, { runId, authorization: auth });
    await orch.precheck();
    await expect(orch.backup()).rejects.toMatchObject({ code: 'AUTH_EFFECTS_NOT_EXACT' });
  });

  it('T87b extra fourth authorized effect => FAIL', async () => {
    const runId = nextRunId('EXTRAEFFECT');
    const auth = makeAuth(runId);
    auth.authorizedEffects = [...AUTHORIZED_EFFECTS, 'UNAUTHORIZED_EXTRA_EFFECT'];
    const { orch } = buildOrch({}, { runId, authorization: auth });
    await orch.precheck();
    await expect(orch.backup()).rejects.toMatchObject({ code: 'AUTH_EFFECTS_NOT_EXACT' });
  });

  it('T87c duplicate authorized effect => FAIL', async () => {
    const runId = nextRunId('DUPEFFECT');
    const auth = makeAuth(runId);
    auth.authorizedEffects = [
      'ENGINE_2_TO_1',
      'PROJECTED_DUMP_WRITE_0600',
      'PROJECTED_DUMP_WRITE_0600',
    ];
    const { orch } = buildOrch({}, { runId, authorization: auth });
    await orch.precheck();
    await expect(orch.backup()).rejects.toMatchObject({ code: 'AUTH_EFFECTS_NOT_EXACT' });
  });

  it('T88 new 1.6.0 complete mocked artifact => PASS', async () => {
    const { orch } = buildOrch();
    expect(TOOL_VERSION).toBe('1.6.0');
    expect(AUTHORIZED_TRANSACTION).toBe('T2_ENGINE_SINGLETON_DB_ALREADY_PRESENT_PROJECTED_PERSIST');
    expect(AUTHORIZED_EFFECTS).toEqual([
      'ENGINE_2_TO_1',
      'PROJECTED_DUMP_WRITE_0600',
    ]);
    const result = await orch.runTransaction();
    expect(result).toBe(State.COMPLETED);
  });

  it('T89 mutation after COMPLETED cannot writeProjected or pm2Save', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    await expect(orch.guardedCall('pm2Save', async () => ({ exitCode: 0 }))).rejects.toMatchObject({
      code: 'MUTATION_CLOSED',
    });
    await expect(
      orch.guardedCall('writeProjectedActiveDump', async () => ({ mode: 0o600, sha256: 'x' })),
    ).rejects.toMatchObject({ code: 'MUTATION_CLOSED' });
  });

  
  it('T90b legacy 1.5.0 transaction identity => FAIL', async () => {
    const runId = nextRunId('LEGACY15');
    const auth = makeAuth(runId);
    auth.authorizedTransaction = LEGACY_AUTHORIZED_TRANSACTION_1_5_0;
    auth.authorizedEffects = ['ENGINE_2_TO_1', 'COLLECTOR_DB_B_PERSIST', 'PROJECTED_DUMP_WRITE_0600'];
    const { orch } = buildOrch({}, { runId, authorization: auth });
    await orch.precheck();
    await expect(orch.backup()).rejects.toMatchObject({ code: 'AUTH_TRANSACTION_MISMATCH' });
  });

  it('T90 legacy 1.4.0 transaction identity => FAIL', async () => {
    const runId = nextRunId('LEGACY14');
    const auth = makeAuth(runId);
    auth.authorizedTransaction = LEGACY_AUTHORIZED_TRANSACTION_1_4_0;
    const { orch } = buildOrch({}, { runId, authorization: auth });
    await orch.precheck();
    await expect(orch.backup()).rejects.toMatchObject({ code: 'AUTH_TRANSACTION_MISMATCH' });
  });
});

describe('T2 v1.6 projection security', () => {
  function baseSnap() {
    return {
      DB_HOST: '127.0.0.1',
      DB_PORT: '5433',
      DB_NAME: 'titangold_db',
      DB_USER: EXPECTED_COLLECTOR_DB_USER,
      DB_PASSWORD: SECRET_PASSWORD,
    };
  }

  it('live JWT differs from PRE dump → projected keeps PRE JWT', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    const col = dump.find((e) => e.name === 'telegram-collector');
    col.env.JWT_SECRET = PRE_JWT;
    world.live.find((e) => e.name === 'telegram-collector').env.JWT_SECRET = LIVE_JWT;
    const sel = selectEngineRetainExtra(semanticFingerprint(world.live));
    const built = buildExpectedProjectedDump({
      preDump: dump,
      selection: sel,
      collectorDbSnapshot: baseSnap(),
    });
    expect(built.ok).toBe(true);
    expect(built.projected[built.collectorMap.dumpIndex].env.JWT_SECRET).toBe(PRE_JWT);
    const check = assertUnauthorizedLiveEnvNotPersisted({
      preDump: dump,
      projected: built.projected,
      collectorDumpIndex: built.collectorMap.dumpIndex,
      liveCollectorEnvKeys: Object.keys(world.live.find((e) => e.name === 'telegram-collector').env),
    });
    expect(check.ok).toBe(true);
    expect(check.JWT_SECRET_LIVE_DRIFT_NOT_PERSISTED).toBe('PASS');
  });

  it('live Cursor-only env → absent from projected', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    world.live.find((e) => e.name === 'telegram-collector').env.__CURSOR_SANDBOX_ENV_RESTORE = '1';
    world.live.find((e) => e.name === 'telegram-collector').env.CURSOR_CONVERSATION_ID = 'cid';
    const sel = selectEngineRetainExtra(semanticFingerprint(world.live));
    const built = buildExpectedProjectedDump({
      preDump: dump,
      selection: sel,
      collectorDbSnapshot: baseSnap(),
    });
    expect(built.ok).toBe(true);
    const postEnv = built.projected[built.collectorMap.dumpIndex].env;
    expect(postEnv.__CURSOR_SANDBOX_ENV_RESTORE).toBeUndefined();
    expect(postEnv.CURSOR_CONVERSATION_ID).toBeUndefined();
    const check = assertUnauthorizedLiveEnvNotPersisted({
      preDump: dump,
      projected: built.projected,
      collectorDumpIndex: built.collectorMap.dumpIndex,
      liveCollectorEnvKeys: Object.keys(world.live.find((e) => e.name === 'telegram-collector').env),
    });
    expect(check.ok).toBe(true);
  });

  it('live prev_restart_delay → not projected', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    world.live.find((e) => e.name === 'telegram-collector').env.prev_restart_delay = '5000';
    const sel = selectEngineRetainExtra(semanticFingerprint(world.live));
    const built = buildExpectedProjectedDump({
      preDump: dump,
      selection: sel,
      collectorDbSnapshot: baseSnap(),
    });
    expect(built.projected[built.collectorMap.dumpIndex].env.prev_restart_delay).toBeUndefined();
  });

  it('only 1 status change (ALREADY_PRESENT_EXACT)', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    const sel = selectEngineRetainExtra(semanticFingerprint(world.live));
    const built = buildExpectedProjectedDump({
      preDump: dump,
      selection: sel,
      collectorDbSnapshot: baseSnap(),
    });
    expect(built.ok).toBe(true);
    const diffs = structuralDiffPaths(dump, built.projected);
    expect(diffs).toHaveLength(1);
    expect(built.manifest.AUTHORIZED_DIFF_PATH_COUNT).toBe(1);
    expect(built.manifest.COLLECTOR_DB_KEYS_PRESERVED_EXACT).toBe(5);
  });

  it('second change fails', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    const sel = selectEngineRetainExtra(semanticFingerprint(world.live));
    const built = buildExpectedProjectedDump({
      preDump: dump,
      selection: sel,
      collectorDbSnapshot: baseSnap(),
    });
    const mutated = deepClone(built.projected);
    mutated[built.collectorMap.dumpIndex].env.EXTRA_SEVENTH = 'nope';
    const diffs = structuralDiffPaths(dump, mutated);
    expect(diffs.length).toBeGreaterThan(1);
  });

  it('dump without pm_id unique mapping PASS', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    expect(dump.every((e) => e.pm_id === undefined)).toBe(true);
    const sel = selectEngineRetainExtra(semanticFingerprint(world.live));
    const engines = resolveDumpEngineIdentities(dump, sel);
    expect(engines.ok).toBe(true);
    const collector = resolveDumpCollectorIdentity(dump);
    expect(collector.ok).toBe(true);
  });

  it('created_at matches but env differs => FAIL', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    for (const e of dump) {
      if (e.name === 'titan-engine-worker') e.created_at = 1000;
    }
    const engine = dump.find((e) => e.name === 'titan-engine-worker' && e.env.PATH !== '/usr/bin');
    engine.env.EXTRA_DRIFT = 'x';
    const sel = selectEngineRetainExtra(semanticFingerprint(world.live));
    const engines = resolveDumpEngineIdentities(dump, sel);
    expect(engines.ok).toBe(false);
  });

  it('created_at absent still PASS when semantics unique', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    for (const e of dump) {
      if (e.name === 'titan-engine-worker') delete e.created_at;
    }
    const sel = selectEngineRetainExtra(semanticFingerprint(world.live));
    const engines = resolveDumpEngineIdentities(dump, sel);
    expect(engines.ok).toBe(true);
    expect(engines.retainedLivePmId).toBe(5);
  });

  it('ambiguous mapping FAIL', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    // Remove the differentiating PATH so both dump/live engine identities become ambiguous.
    for (const e of dump) {
      if (e.name === 'titan-engine-worker') e.env.PATH = '/usr/bin';
    }
    world.live[0].env.PATH = '/usr/bin';
    world.live[1].env.PATH = '/usr/bin';
    const sel2 = selectEngineRetainExtra(semanticFingerprint(world.live));
    expect(sel2.ok).toBe(true);
    const engines = resolveDumpEngineIdentities(dump, sel2);
    expect(engines.ok).toBe(false);
    expect(engines.error).toBe('DUMP_ENGINE_IDENTITY_UNRESOLVED');
  });

  it('GlobalPm2SaveForbiddenError on boundary.pm2Save', async () => {
    const { commands } = buildOrch();
    await expect(commands.pm2Save()).rejects.toMatchObject({ code: 'GLOBAL_PM2_SAVE_FORBIDDEN' });
    await expect(createFailClosedBoundary().pm2Save()).rejects.toBeInstanceOf(GlobalPm2SaveForbiddenError);
  });

  it('planRollbackActions with PROJECTED_DUMP_WRITE_ATTEMPTED + unknown exact-pre → restoreDump false', () => {
    const ledger = createSideEffectLedger();
    ledger.PROJECTED_DUMP_WRITE_ATTEMPTED = true;
    const plan = planRollbackActions(ledger, {
      dumpStateUnknown: true,
      dumpRestoreRequired: false,
      dumpRestoreDecision: 'ACTIVE_DUMP_IS_EXACT_PRE',
    });
    expect(plan.restoreDump).toBe(false);
    expect(plan.reason.restore).toBe('ACTIVE_DUMP_IS_EXACT_PRE');
  });

  it('happy path pm2Save mutation count 0', async () => {
    const { orch, commands } = buildOrch();
    await orch.runTransaction();
    expect(orch.state).toBe(State.COMPLETED);
    expect(pm2SaveCount(commands)).toBe(0);
  });

  it('rollback path pm2Save count 0', async () => {
    const { orch, commands } = buildOrch({ forceReadbackMismatch: true });
    await expect(runToWrite(orch)).rejects.toBeTruthy();
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(pm2SaveCount(commands)).toBe(0);
  });
});

describe('T2 v1.6 ALREADY_PRESENT_EXACT + sanitized-pre gate', () => {
  it('ALREADY_PRESENT_EXACT five keys => precheck PASS', () => {
    const world = makeLiveAndDump();
    const liveFp = semanticFingerprint(world.live);
    const dumpFp = semanticFingerprint(prepareDumpFromLive(world.live));
    const c = classifyCollectorDbPrestate(liveFp, dumpFp);
    expect(c.ok).toBe(true);
    expect(c.state).toBe('ALREADY_PRESENT_EXACT');
    for (const k of COLLECTOR_DB_KEYS) {
      expect(c.matches[`${k}_PRE_MATCH`]).toBe('YES');
    }
    const pre = assertCollectorPersistencePreconditions(liveFp, dumpFp);
    expect(pre.ok).toBe(true);
  });

  it('ABSENT => fail', () => {
    const world = makeLiveAndDump();
    const dump = prepareCleanPreFromLive(world.live);
    const c = classifyCollectorDbPrestate(
      semanticFingerprint(world.live),
      semanticFingerprint(dump),
    );
    expect(c.state).toBe('ABSENT');
    expect(c.ok).toBe(false);
  });

  it('PARTIAL => fail', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    const coll = dump.find((e) => e.name === 'telegram-collector');
    delete coll.env.DB_PASSWORD;
    const c = classifyCollectorDbPrestate(
      semanticFingerprint(world.live),
      semanticFingerprint(dump),
    );
    expect(c.state).toBe('PARTIAL');
    expect(c.ok).toBe(false);
  });

  it('one DB value mismatch => fail', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    dump.find((e) => e.name === 'telegram-collector').env.DB_HOST = '9.9.9.9';
    const c = classifyCollectorDbPrestate(
      semanticFingerprint(world.live),
      semanticFingerprint(dump),
    );
    expect(c.state).toBe('PRESENT_MISMATCHED');
    expect(c.ok).toBe(false);
    expect(c.matches.DB_HOST_PRE_MATCH).toBe('NO');
  });

  it('DB_USER wrong => fail', async () => {
    const { orch } = buildOrch({
      mutateLive: (live) => {
        live.find((e) => e.name === 'telegram-collector').env.DB_USER = 'wrong_user';
      },
    });
    await expect(orch.runTransaction()).rejects.toMatchObject({
      code: expect.stringMatching(/DB_USER|UNEXPECTED|PRESTATE/),
    });
    expect(orch.authConsumed).toBe(false);
  });

  it('sanitized-pre proof PASS', () => {
    const world = makeLiveAndDump();
    const clean = prepareCleanPreFromLive(world.live);
    const active = prepareDumpFromLive(world.live);
    const cleanSha = sha256Buffer(dumpToBytes(clean));
    const activeSha = sha256Buffer(dumpToBytes(active));
    const proof = assertSanitizedPreBaselineProof({
      cleanPreDump: clean,
      activePreDump: active,
      expectedCleanPreSha: cleanSha,
      actualCleanPreSha: cleanSha,
      expectedActiveDumpSha: activeSha,
      actualActiveDumpSha: activeSha,
    });
    expect(proof.ok).toBe(true);
    expect(proof.SANITIZED_PRE_BASELINE_PROOF).toBe('PASS');
  });

  it('unsanitized JWT drift vs CLEAN_PRE => fail before auth consume', async () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    dump.find((e) => e.name === 'telegram-collector').env.JWT_SECRET = LIVE_JWT;
    const { orch } = buildOrch({ dumpOverride: dump });
    await expect(orch.runTransaction()).rejects.toMatchObject({
      code: expect.stringMatching(/JWT|SANITIZED_PRE|UNAUTHORIZED/),
    });
    expect(orch.authConsumed).toBe(false);
  });

  it('unsanitized session/IDE drift => fail before auth consume', async () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    dump.find((e) => e.name === 'telegram-collector').env.CURSOR_CONVERSATION_ID = 'sess-x';
    const { orch } = buildOrch({ dumpOverride: dump });
    await expect(orch.runTransaction()).rejects.toMatchObject({
      code: expect.stringMatching(/SESSION|SANITIZED_PRE|UNAUTHORIZED|IDE/),
    });
    expect(orch.authConsumed).toBe(false);
  });

  it('projection changes exactly engine status only; DB preserved', () => {
    const world = makeLiveAndDump();
    const dump = prepareDumpFromLive(world.live);
    const sel = selectEngineRetainExtra(semanticFingerprint(world.live));
    const built = buildExpectedProjectedDump({
      preDump: dump,
      selection: sel,
      liveFp: semanticFingerprint(world.live),
    });
    expect(built.ok).toBe(true);
    expect(built.manifest.AUTHORIZED_SEMANTIC_DIFF_COUNT).toBe(1);
    expect(built.manifest.ENGINE_EXTRA_STATUS_CHANGED).toBe('YES');
    expect(built.manifest.COLLECTOR_DB_KEYS_ADDED).toBe(0);
    expect(built.manifest.COLLECTOR_DB_KEYS_PRESERVED_EXACT).toBe(5);
    const preColl = dump.find((e) => e.name === 'telegram-collector');
    const postColl = built.projected.find((e) => e.name === 'telegram-collector');
    for (const k of COLLECTOR_DB_KEYS) {
      expect(postColl.env[k]).toBe(preColl.env[k]);
    }
  });
});
