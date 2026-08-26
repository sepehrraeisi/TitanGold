/**
 * @jest-environment node
 *
 * Durable T2 retry orchestrator — synthetic/fake-only matrix.
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
} from '../../scripts/t2-retry-orchestrator/index.mjs';

const SECRET_PASSWORD = 'super-secret-db-password-NEVER-IN-EVIDENCE';
const SECRET_TOKEN = '123456789:AAHsecretTelegramTokenValueXXXX';
const SECRET_BACKEND = 'backend-secret-value-should-stay-invisible';

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
      env: { NODE_ENV: 'development', PATH: '/usr/bin' },
    },
    ...[1, 2, 3, 4].map((id) => ({
      name: 'titan-backend',
      pm_id: id,
      status: 'online',
      pm_cwd: '/app/backend',
      pm_exec_path: '/app/backend/server.js',
      exec_mode: 'cluster_mode',
      env: { NODE_ENV: 'development', BACKEND_SECRET: SECRET_BACKEND, PATH: '/usr/bin' },
    })),
    {
      name: 'telegram-processor',
      pm_id: 11,
      status: 'online',
      pm_cwd: '/app/telegram-collector',
      pm_exec_path: '/app/telegram-collector/processor.js',
      args: ['--mode=normal'],
      env: { NODE_ENV: 'development', PATH: '/usr/bin' },
    },
    {
      name: 'telegram-collector',
      pm_id: 16,
      status: 'online',
      pm_cwd: '/app/telegram-collector',
      pm_exec_path: '/app/telegram-collector/index.js',
      env: {
        NODE_ENV: 'production',
        DB_HOST: '127.0.0.1',
        DB_PORT: '5433',
        DB_NAME: 'titangold_db',
        DB_USER: EXPECTED_COLLECTOR_DB_USER,
        DB_PASSWORD: SECRET_PASSWORD,
      },
    },
    {
      name: 'telegram-collector-monitor',
      pm_id: 8,
      status: 'online',
      env: { NODE_ENV: 'development' },
    },
    {
      name: 'telegram-collector-monitor',
      pm_id: 14,
      status: 'online',
      env: { NODE_ENV: 'development' },
    },
  ];

  const dump = deepClone(live);
  for (const e of dump) {
    if (e.name === 'telegram-collector') {
      for (const k of COLLECTOR_DB_KEYS) delete e.env[k];
    }
  }

  return {
    live,
    dump,
    saveExit: 0,
    corruptDumpAfterSave: false,
    forceBackendDriftOnSave: false,
    forceNodeEnvDriftOnSave: false,
    forceProcessorDriftOnSave: false,
    forceMonitorDriftOnSave: false,
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
    startExitCode: 0,
    restoreShaOverride: null,
    ...overrides,
  };
}

function createFakeBoundary(world) {
  let dumpEntries = deepClone(world.dump);
  let liveEntries = deepClone(world.live);
  let dumpCorrupt = false;
  let dumpMode = typeof world.dumpMode === 'number' ? world.dumpMode & 0o777 : 0o664;
  const mutationLog = [];

  return {
    mutationLog,
    world: () => ({ liveEntries, dumpEntries, dumpMode }),
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
      if (world.forceRestoreShaMismatch) {
        dumpEntries = deepClone(dumpEntries);
        dumpEntries.push({ name: 'tamper', pm_id: 999, status: 'stopped', env: {} });
      }
      return { ok: true, mode: dumpMode };
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
      if (world.saveExit !== 0) return { exitCode: world.saveExit };
      if (world.corruptDumpAfterSave) {
        dumpCorrupt = true;
        return { exitCode: 0 };
      }
      dumpEntries = deepClone(liveEntries);
      if (world.forceBackendDriftOnSave) {
        dumpEntries = dumpEntries.filter((e) => !(e.name === 'titan-backend' && e.pm_id === 4));
      }
      if (world.forceNodeEnvDriftOnSave) {
        for (const e of dumpEntries) {
          if (e.name === 'titan-engine-worker' && e.status === 'online') {
            e.env = { ...(e.env || {}), NODE_ENV: 'production' };
          }
        }
      }
      if (world.forceProcessorDriftOnSave) {
        dumpEntries = dumpEntries.filter((e) => e.name !== 'telegram-processor');
      }
      if (world.forceMonitorDriftOnSave) {
        dumpEntries = dumpEntries.filter((e) => e.name !== 'telegram-collector-monitor');
      }
      if (world.forceBackendEnvAdd) {
        const b = dumpEntries.find((e) => e.name === 'titan-backend' && e.pm_id === 1);
        b.env = { ...b.env, UNRELATED_NEW_KEY: 'x' };
      }
      if (world.forceBackendEnvRemove) {
        const b = dumpEntries.find((e) => e.name === 'titan-backend' && e.pm_id === 1);
        delete b.env.BACKEND_SECRET;
      }
      if (world.forceBackendEnvValueChange) {
        const b = dumpEntries.find((e) => e.name === 'titan-backend' && e.pm_id === 1);
        b.env.BACKEND_SECRET = 'changed-secret-value';
      }
      if (world.forceCollectorUnrelatedEnvAdd) {
        const c = dumpEntries.find((e) => e.name === 'telegram-collector');
        c.env = { ...c.env, COLLECTOR_EXTRA: 'nope' };
      }
      if (world.forceProviderEnvAppear) {
        const b = dumpEntries.find((e) => e.name === 'titan-backend' && e.pm_id === 1);
        b.env = { ...b.env, MEXC_API_KEY: 'provider-secret' };
      }
      if (world.forceTelegramTokenAppear) {
        const c = dumpEntries.find((e) => e.name === 'telegram-collector');
        c.env = { ...c.env, TELEGRAM_BOT_TOKEN: SECRET_TOKEN };
      }
      if (world.forceCollectorDbPasswordMismatch) {
        const c = dumpEntries.find((e) => e.name === 'telegram-collector');
        c.env.DB_PASSWORD = 'wrong-password-not-live';
      }
      if (world.forceCollectorDbHostMismatch) {
        const c = dumpEntries.find((e) => e.name === 'telegram-collector');
        c.env.DB_HOST = '10.0.0.1';
      }
      if (world.forceCollectorDbNameMismatch) {
        const c = dumpEntries.find((e) => e.name === 'telegram-collector');
        c.env.DB_NAME = 'other_db';
      }
      if (world.forceBackendScriptDrift) {
        const b = dumpEntries.find((e) => e.name === 'titan-backend' && e.pm_id === 1);
        b.pm_exec_path = '/app/backend/server-DRIFTED.js';
      }
      if (world.forceBackendCwdDrift) {
        const b = dumpEntries.find((e) => e.name === 'titan-backend' && e.pm_id === 1);
        b.pm_cwd = '/app/backend-DRIFTED';
      }
      if (world.forceProcessorArgsDrift) {
        const p = dumpEntries.find((e) => e.name === 'telegram-processor');
        p.args = ['--mode=drifted'];
      }
      if (world.forceOtherConfigDrift) {
        dumpEntries.push({
          name: 'titan-error-watch',
          pm_id: 99,
          status: 'online',
          pm_exec_path: '/x.js',
          env: { NODE_ENV: 'development' },
        });
      }
      if (world.forceEngineCountNotRestoredOnRollback) {
        world._blockEngineRestore = true;
      }
      if (world.forceRetainedPathChangeOnSave) {
        for (const e of dumpEntries) {
          if (e.name === 'titan-engine-worker' && e.status === 'online') {
            e.env = { ...(e.env || {}), PATH: '/mutated/path/should-fail' };
          }
        }
      }
      // Simulate PM2 save recreating dump with umask → 0664
      dumpMode = 0o664;
      return { exitCode: 0 };
    },
    async hardenActiveDumpMode(mode = 0o600) {
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

function buildOrch(worldOverrides = {}, orchOverrides = {}) {
  const world = makeLiveAndDump(worldOverrides);
  const commands = createFakeBoundary(world);
  // Optional: break start after stop for FAIL_FORWARD tests
  if (worldOverrides.forceStartFailOnRollback) {
    const origStart = commands.startProcessByPmId.bind(commands);
    let startedOnce = false;
    commands.startProcessByPmId = async (pmId) => {
      // Allow normal path until rollback
      if (commands.mutationLog.includes('pm2Save') || world.saveExit !== 0) {
        return { exitCode: 1 };
      }
      startedOnce = true;
      return origStart(pmId);
    };
    void startedOnce;
  }
  if (worldOverrides.forceEngineCountNotRestoredOnRollback) {
    const origStart = commands.startProcessByPmId.bind(commands);
    commands.startProcessByPmId = async (pmId) => {
      const r = await origStart(pmId);
      // Immediately stop again so count stays wrong? Better: don't actually start
      const proc = commands.world().liveEntries.find((e) => e.pm_id === pmId);
      if (proc) proc.status = 'stopped';
      return r;
    };
  }
  if (worldOverrides.forceUnrelatedRollbackDrift) {
    const origStart = commands.startProcessByPmId.bind(commands);
    commands.startProcessByPmId = async (pmId) => {
      const r = await origStart(pmId);
      // Drift live retained engine NODE_ENV after start — dump SHA remains PRE-correct
      const retained = commands
        .world()
        .liveEntries.find((e) => e.name === 'titan-engine-worker' && e.status === 'online' && e.pm_id !== pmId);
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
      const m = commands.world().liveEntries.find((e) => e.name === 'telegram-collector-monitor' && e.pm_id === 8);
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
  const orch = createOrchestrator({
    commands,
    authorization: orchOverrides.authorization || makeAuth(runId),
    runId,
    backupRoot: orchOverrides.backupRoot || journalRoot,
    journalRoot,
    journalFs,
    productionModeAcknowledged: orchOverrides.productionModeAcknowledged !== false,
    expectedToolVersion: orchOverrides.expectedToolVersion || TOOL_VERSION,
  });
  return { orch, commands, world, journalFs, journalRoot, runId };
}

describe('T2 retry orchestrator (final audit correction)', () => {
  it('T1 happy path', async () => {
    const { orch, commands } = buildOrch();
    const result = await orch.runTransaction();
    expect(result).toBe(State.COMPLETED);
    expect(orch.mutationClosed).toBe(true);
    expect(orch.journal.authConsumed).toBe(true);
    const { liveEntries, dumpEntries } = commands.world();
    expect(liveEntries.filter((e) => e.name === 'titan-engine-worker' && e.status === 'online')).toHaveLength(1);
    const col = dumpEntries.find((e) => e.name === 'telegram-collector');
    expect(col.env.DB_USER).toBe(EXPECTED_COLLECTOR_DB_USER);
  });

  it('T2 save exit=0 + changed dump SHA => SUCCESS', async () => {
    const { orch } = buildOrch();
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    const pre = orch.preDumpSha;
    await orch.save();
    expect(orch.state).toBe(State.SAVE_SUCCESS);
    expect(orch.postDumpSha).not.toBe(pre);
    await orch.hardenDump();
    expect(orch.state).toBe(State.DUMP_HARDENED);
    await orch.postsaveVerify();
    await orch.healthValidate();
    expect(await orch.complete()).toBe(State.COMPLETED);
  });

  it('T3 save command failure => rollback PRE_EQUIVALENT', async () => {
    const { orch, commands } = buildOrch({ saveExit: 1 });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await expect(orch.save()).rejects.toMatchObject({ code: 'SAVE_EXIT_NONZERO' });
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(orch.sideEffects.DUMP_SAVE_APPLIED).toBe(false);
    expect(orch.sideEffects.ENGINE_STOP_APPLIED).toBe(true);
    expect(orch.lastRollbackPlan.restoreDump).toBe(false);
    expect(orch.lastRollbackPlan.startExtra).toBe(true);
    expect(
      commands.world().liveEntries.filter((e) => e.name === 'titan-engine-worker' && e.status === 'online'),
    ).toHaveLength(2);
    expect(orch.evidence.lines.some((l) => l.includes('PRE_EQUIVALENT=YES'))).toBe(true);
  });

  it('T4 semantic post-save mismatch => rollback', async () => {
    const { orch } = buildOrch({ forceBackendDriftOnSave: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
    expect(orch.state).toBe(State.ROLLED_BACK);
  });

  it('T5 rollback succeeds (exact dump restore)', async () => {
    const { orch, commands } = buildOrch({ saveExit: 1 });
    await orch.precheck();
    const preSha = orch.preDumpSha;
    await orch.backup();
    await orch.stopExtra();
    await expect(orch.save()).rejects.toBeInstanceOf(T2OrchestratorError);
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect((await commands.readDump()).sha256).toBe(preSha);
  });

  it('T6 mutation after FAILED blocked', async () => {
    const { orch } = buildOrch();
    orch.state = State.FAILED;
    orch.mutationClosed = true;
    orch.authConsumed = true;
    expect(() => orch.requireMutationOpen('save')).toThrow(/MUTATION_CLOSED/);
  });

  it('T7 mutation after COMPLETED blocked', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    expect(() => orch.requireMutationOpen('save')).toThrow(/MUTATION_CLOSED/);
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
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
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
    expect(orch.evidence.lines.some((l) => l.includes('COLLECTOR_DB_KEYS_APPEAR'))).toBe(true);
    expect(orch.evidence.lines.some((l) => /presence_bits=11111/.test(l))).toBe(true);
  });

  it('T13 changed dump SHA alone never causes S2 classification', async () => {
    const { orch } = buildOrch();
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    expect(orch.state).toBe(State.SAVE_SUCCESS);
    expect(orch.evidence.lines.some((l) => /\bS2\b/.test(l))).toBe(false);
  });

  it('T14 NODE_ENV drift causes failure', async () => {
    const { orch } = buildOrch({ forceNodeEnvDriftOnSave: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
  });

  it('T15 backend/processor/monitor topology drift causes failure', async () => {
    for (const key of ['forceBackendDriftOnSave', 'forceProcessorDriftOnSave', 'forceMonitorDriftOnSave']) {
      const { orch } = buildOrch({ [key]: true });
      await orch.precheck();
      await orch.backup();
      await orch.stopExtra();
      await orch.save();
      await orch.hardenDump();
      await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
      expect(orch.state).toBe(State.ROLLED_BACK);
    }
  });

  it('T16 collector DB_* values never enter evidence', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    const blob = orch.evidence.toString();
    expect(blob.includes(SECRET_PASSWORD)).toBe(false);
    expect(blob.includes('127.0.0.1')).toBe(false);
    expect(blob).toMatch(/presence_bits=11111/);
  });

  it('fail-closed boundary rejects live ops by default', async () => {
    await expect(createFailClosedBoundary().pm2Save()).rejects.toBeInstanceOf(ForbiddenLiveExecutionError);
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

  it('T22 backend unrelated env add = FAIL', async () => {
    const { orch } = buildOrch({ forceBackendEnvAdd: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
  });

  it('T23 backend unrelated env removal = FAIL', async () => {
    const { orch } = buildOrch({ forceBackendEnvRemove: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
  });

  it('T24 backend env value change = FAIL', async () => {
    const { orch } = buildOrch({ forceBackendEnvValueChange: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
    expect(orch.evidence.toString().includes('changed-secret-value')).toBe(false);
  });

  it('T25 collector unrelated env add = FAIL', async () => {
    const { orch } = buildOrch({ forceCollectorUnrelatedEnvAdd: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
  });

  it('T26 provider env appearance = FAIL', async () => {
    const { orch } = buildOrch({ forceProviderEnvAppear: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
  });

  it('T27 Telegram token appearance = FAIL', async () => {
    const { orch } = buildOrch({ forceTelegramTokenAppear: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
    expect(orch.evidence.toString().includes(SECRET_TOKEN)).toBe(false);
  });

  it('T28 unchanged existing secret values do not appear in evidence', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    const blob = orch.evidence.toString();
    expect(blob.includes(SECRET_BACKEND)).toBe(false);
    expect(blob.includes(SECRET_PASSWORD)).toBe(false);
  });

  it('T29 live adapter requires gates; mocked spawn never hits real PM2', async () => {
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
    const saveResult = await boundary.pm2Save();
    expect(saveResult.exitCode).toBe(0);
    expect(saveResult.stdout).toBeUndefined();
    expect(spawned.some((s) => s[0] === 'pm2' && s[1] === 'save')).toBe(true);
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
      'pm2Save',
      'hardenActiveDumpMode',
      'restoreDump',
      'startProcessByPmId',
    ]) {
      expect(MUTATING_OPS.includes(op)).toBe(true);
    }
  });

  // ---- Final audit cases ----

  it('T32 start rollback nonzero => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({ saveExit: 1, forceStartFailOnRollback: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await expect(orch.save()).rejects.toMatchObject({ code: 'START_ROLLBACK_NONZERO' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
    expect(orch.mutationClosed).toBe(true);
  });

  it('T33 restored dump SHA mismatch => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({ forceBackendDriftOnSave: true, forceRestoreShaMismatch: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'ROLLBACK_DUMP_SHA_MISMATCH' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T34 engine count not restored => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({ saveExit: 1, forceEngineCountNotRestoredOnRollback: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await expect(orch.save()).rejects.toMatchObject({ code: 'ROLLBACK_ENGINE_COUNT_NOT_RESTORED' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T35 unrelated rollback drift => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({ forceBackendDriftOnSave: true, forceUnrelatedRollbackDrift: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'ROLLBACK_ENGINE_CONFIG_DRIFT' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T36 successful rollback proves PRE_EQUIVALENT', async () => {
    const { orch } = buildOrch({ forceBackendDriftOnSave: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    expect(orch.sideEffects.DUMP_SAVE_APPLIED).toBe(true);
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(orch.evidence.lines.some((l) => l.includes('PRE_EQUIVALENT=YES'))).toBe(true);
  });

  it('T37 persisted DB_PASSWORD differs = FAIL', async () => {
    const { orch } = buildOrch({ forceCollectorDbPasswordMismatch: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
    expect(orch.evidence.lines.some((l) => l.includes('DB_PASSWORD_MATCH=NO'))).toBe(true);
    expect(orch.evidence.toString().includes('wrong-password')).toBe(false);
  });

  it('T38 persisted DB_HOST differs = FAIL', async () => {
    const { orch } = buildOrch({ forceCollectorDbHostMismatch: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
    expect(orch.evidence.lines.some((l) => l.includes('DB_HOST_MATCH=NO'))).toBe(true);
    expect(orch.evidence.toString().includes('10.0.0.1')).toBe(false);
  });

  it('T39 persisted DB_NAME differs = FAIL', async () => {
    const { orch } = buildOrch({ forceCollectorDbNameMismatch: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
    expect(orch.evidence.lines.some((l) => l.includes('DB_NAME_MATCH=NO'))).toBe(true);
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
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
  });

  it('T42 backend cwd drift = FAIL', async () => {
    const { orch } = buildOrch({ forceBackendCwdDrift: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
  });

  it('T43 processor args drift = FAIL', async () => {
    const { orch } = buildOrch({ forceProcessorArgsDrift: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
  });

  it('T44 unrelated process config drift = FAIL', async () => {
    const { orch } = buildOrch({ forceOtherConfigDrift: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
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
    ]);
    expect(g.ok).toBe(true);
    const boundary = createLiveBoundary({
      gatesSatisfied: g.ok,
      spawnSyncImpl: () => ({ status: 0, stdout: '[]', stderr: '' }),
    });
    expect(boundary).toBeTruthy();
  });

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

  // ---- Last merge-blocking corrections ----

  it('T54 PRE dump mode 0600 restored as 0600', async () => {
    const { orch, commands } = buildOrch({ dumpMode: 0o600, forceBackendDriftOnSave: true });
    await orch.precheck();
    expect(orch.preDumpMode).toBe(0o600);
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(commands.world().dumpMode).toBe(0o600);
    const restoreCalls = commands.mutationLog.filter((m) => Array.isArray(m) && m[0] === 'restoreDump');
    expect(restoreCalls[0][1]).toBe(0o600);
  });

  it('T55 PRE dump mode 0640 restored as 0640', async () => {
    const { orch, commands } = buildOrch({ dumpMode: 0o640, forceBackendDriftOnSave: true });
    await orch.precheck();
    expect(orch.preDumpMode).toBe(0o640);
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(commands.world().dumpMode).toBe(0o640);
  });

  it('T56 restore never forces 0664 unless PRE was 0664', async () => {
    const { orch, commands } = buildOrch({ dumpMode: 0o600, forceBackendDriftOnSave: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toBeTruthy();
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
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'ROLLBACK_DUMP_MODE_MISMATCH' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T58 engine args differ => precheck FAIL before auth consumption', async () => {
    const world = makeLiveAndDump();
    world.live[0].args = ['--a'];
    world.live[1].args = ['--b'];
    world.dump = deepClone(world.live);
    for (const e of world.dump) {
      if (e.name === 'telegram-collector') {
        for (const k of COLLECTOR_DB_KEYS) delete e.env[k];
      }
    }
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
    });
    await expect(orch.precheck()).rejects.toMatchObject({ code: 'ENGINE_RUNTIME_IDENTITY_MISMATCH' });
    expect(orch.authConsumed).toBe(false);
    expect(orch.journal.authConsumed).toBe(false);
  });

  it('T59 PATH-only difference with canonical consensus => PASS retain canonical', async () => {
    const world = makeLiveAndDump();
    // lower pm_id noncanonical; higher matches backend/processor canonical /usr/bin
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
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'ROLLBACK_LIVE_SEMANTIC_DRIFT' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
    expect(orch.evidence.toString().includes('drifted-after-rollback')).toBe(false);
  });

  it('T63 live processor config drift => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({
      forceBackendDriftOnSave: true,
      forceLiveProcessorConfigDriftOnRollback: true,
    });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'ROLLBACK_LIVE_SEMANTIC_DRIFT' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T64 live monitor status/config drift => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({
      forceBackendDriftOnSave: true,
      forceLiveMonitorDriftOnRollback: true,
    });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'ROLLBACK_LIVE_SEMANTIC_DRIFT' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T65 live unrelated-process drift => FAIL_FORWARD_COMPLETE', async () => {
    const { orch } = buildOrch({
      forceBackendDriftOnSave: true,
      forceLiveOtherProcessDriftOnRollback: true,
    });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'ROLLBACK_LIVE_SEMANTIC_DRIFT' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('T66 exact PRE live semantic equivalence => ROLLED_BACK', async () => {
    const { orch } = buildOrch({ forceBackendDriftOnSave: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
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

  // ---- 1.4.0 PATH selection + dump harden ----

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
    world.dump = deepClone(world.live);
    for (const e of world.dump) {
      if (e.name === 'telegram-collector') {
        for (const k of COLLECTOR_DB_KEYS) delete e.env[k];
      }
    }
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
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
    expect(orch.state).toBe(State.ROLLED_BACK);
  });

  it('T75 rollback PATH drift still FAIL', async () => {
    const { orch, commands } = buildOrch({ forceBackendDriftOnSave: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    // Inject PATH drift on rollback start for retained engine live state
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
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'ROLLBACK_ENGINE_CONFIG_DRIFT' });
    expect(orch.state).toBe(State.FAIL_FORWARD_COMPLETE);
    expect(orch.evidence.toString().includes('/rollback/drift')).toBe(false);
  });

  it('T76 exactly one pm2 save; harden after SAVE_SUCCESS; final mode 0600', async () => {
    const { orch, commands } = buildOrch();
    await orch.runTransaction();
    expect(orch.state).toBe(State.COMPLETED);
    expect(commands.mutationLog.filter((m) => m === 'pm2Save').length).toBe(1);
    const hardenCalls = commands.mutationLog.filter((m) => Array.isArray(m) && m[0] === 'hardenActiveDumpMode');
    expect(hardenCalls.length).toBe(1);
    expect(hardenCalls[0][1]).toBe(0o600);
    expect(commands.world().dumpMode).toBe(0o600);
    expect(orch.sideEffects.DUMP_MODE_HARDEN_ATTEMPTED).toBe(true);
    expect(orch.sideEffects.DUMP_MODE_HARDEN_APPLIED).toBe(true);
    expect(orch.evidence.toString().includes('DUMP_MODE=0600')).toBe(true);
  });

  it('T77 harden command failure => rollback', async () => {
    const { orch, commands } = buildOrch({ forceHardenCommandFail: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await expect(orch.hardenDump()).rejects.toMatchObject({ code: 'DUMP_HARDEN_COMMAND_FAILED' });
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(commands.mutationLog.filter((m) => m === 'pm2Save').length).toBe(1);
    expect(orch.sideEffects.DUMP_MODE_HARDEN_ATTEMPTED).toBe(true);
    expect(orch.sideEffects.DUMP_MODE_HARDEN_APPLIED).toBe(false);
  });

  it('T78 harden leaves 0664 => rollback', async () => {
    const { orch } = buildOrch({ forceHardenSkipModeChange: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await expect(orch.hardenDump()).rejects.toMatchObject({ code: 'DUMP_HARDEN_MODE_NOT_0600' });
    expect(orch.state).toBe(State.ROLLED_BACK);
  });

  it('T79 harden wrong mode 0640 => rollback', async () => {
    const { orch } = buildOrch({ forceHardenWrongMode: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await expect(orch.hardenDump()).rejects.toMatchObject({ code: 'DUMP_HARDEN_MODE_NOT_0600' });
    expect(orch.state).toBe(State.ROLLED_BACK);
  });

  it('T80 harden after terminal => BLOCKED', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    await expect(orch.hardenDump()).rejects.toMatchObject({ code: 'STATE_BLOCKED' });
  });

  it('T81 postsaveVerify before DUMP_HARDENED => BLOCKED', async () => {
    const { orch } = buildOrch();
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    expect(orch.state).toBe(State.SAVE_SUCCESS);
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'STATE_BLOCKED' });
  });

  it('T82 rollback restores PRE 0664 after harden', async () => {
    const { orch, commands } = buildOrch({ dumpMode: 0o664, forceBackendDriftOnSave: true });
    await orch.precheck();
    expect(orch.preDumpMode).toBe(0o664);
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await orch.hardenDump();
    expect(commands.world().dumpMode).toBe(0o600);
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(commands.world().dumpMode).toBe(0o664);
  });

  it('T83 rollback restores PRE 0600 after harden', async () => {
    const { orch, commands } = buildOrch({ dumpMode: 0o600, forceBackendDriftOnSave: true });
    await orch.precheck();
    expect(orch.preDumpMode).toBe(0o600);
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    expect(commands.world().dumpMode).toBe(0o664);
    await orch.hardenDump();
    expect(commands.world().dumpMode).toBe(0o600);
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(commands.world().dumpMode).toBe(0o600);
  });

  it('T84 no second save during hardening/rollback', async () => {
    const { orch, commands } = buildOrch({ forceHardenWrongMode: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await expect(orch.hardenDump()).rejects.toBeTruthy();
    expect(commands.mutationLog.filter((m) => m === 'pm2Save').length).toBe(1);
  });

  it('T85 ledger harden attempted/applied persists durably', async () => {
    const { orch, journalFs, journalRoot, runId } = buildOrch();
    await orch.runTransaction();
    const j = await loadJournal({ runId, journalRoot, fs: journalFs });
    expect(j.record.sideEffects.DUMP_MODE_HARDEN_ATTEMPTED).toBe(true);
    expect(j.record.sideEffects.DUMP_MODE_HARDEN_APPLIED).toBe(true);
  });

  it('T86 old TOOL_VERSION 1.3.0 artifact => FAIL', async () => {
    const { orch } = buildOrch({}, { expectedToolVersion: '1.3.0' });
    await expect(orch.precheck()).rejects.toMatchObject({ code: 'TOOL_VERSION_MISMATCH' });
    expect(orch.authConsumed).toBe(false);
  });

  it('T87 missing DUMP_MODE_HARDEN_0600 authorized effect => FAIL', async () => {
    const runId = nextRunId('NOHARDEN');
    const auth = makeAuth(runId);
    auth.authorizedEffects = ['ENGINE_2_TO_1', 'COLLECTOR_DB_B_PERSIST'];
    const { orch } = buildOrch({}, { runId, authorization: auth });
    await orch.precheck();
    await expect(orch.backup()).rejects.toMatchObject({ code: 'AUTH_EFFECTS_INCOMPLETE' });
  });

  it('T88 new 1.4.0 complete mocked artifact => PASS', async () => {
    const { orch } = buildOrch();
    expect(TOOL_VERSION).toBe('1.4.0');
    expect(AUTHORIZED_TRANSACTION).toBe('T2_ENGINE_SINGLETON_COLLECTOR_DB_B_PERSIST_DUMP_HARDEN');
    expect(AUTHORIZED_EFFECTS).toEqual([
      'ENGINE_2_TO_1',
      'COLLECTOR_DB_B_PERSIST',
      'DUMP_MODE_HARDEN_0600',
    ]);
    const result = await orch.runTransaction();
    expect(result).toBe(State.COMPLETED);
  });

  it('T89 mutation after COMPLETED cannot harden or save', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    await expect(orch.guardedCall('pm2Save', async () => ({ exitCode: 0 }))).rejects.toMatchObject({
      code: 'MUTATION_CLOSED',
    });
    await expect(
      orch.guardedCall('hardenActiveDumpMode', async () => ({ mode: 0o600, ok: true })),
    ).rejects.toMatchObject({ code: 'MUTATION_CLOSED' });
  });
});

