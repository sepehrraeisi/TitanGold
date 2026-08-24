/**
 * @jest-environment node
 *
 * Durable T2 retry orchestrator — synthetic/fake-only matrix (T1–T16).
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
  dumpToBytes,
  sha256Buffer,
  T2OrchestratorError,
  ForbiddenLiveExecutionError,
} from '../../scripts/t2-retry-orchestrator/index.mjs';

const SECRET_PASSWORD = 'super-secret-db-password-NEVER-IN-EVIDENCE';
const SECRET_TOKEN = '123456789:AAHsecretTelegramTokenValueXXXX';

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
      created_at: 1000,
      restart_time: 5,
      env: { NODE_ENV: 'development' },
    },
    {
      name: 'titan-engine-worker',
      pm_id: 9,
      pid: 101,
      status: 'online',
      pm_cwd: '/app/backend',
      pm_exec_path: '/app/backend/workers/engineWorkerLeader.js',
      exec_mode: 'fork_mode',
      created_at: 1001,
      restart_time: 5,
      env: { NODE_ENV: 'development' },
    },
    ...[1, 2, 3, 4].map((id) => ({
      name: 'titan-backend',
      pm_id: id,
      status: 'online',
      env: { NODE_ENV: 'development' },
    })),
    {
      name: 'telegram-processor',
      pm_id: 11,
      status: 'online',
      env: { NODE_ENV: 'development' },
    },
    {
      name: 'telegram-collector',
      pm_id: 16,
      status: 'online',
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
    staleExtraOnStop: false,
    ...overrides,
  };
}

function createFakeBoundary(world) {
  let dumpEntries = deepClone(world.dump);
  let liveEntries = deepClone(world.live);
  let dumpCorrupt = false;
  const backups = new Map();

  return {
    world: () => ({ liveEntries, dumpEntries }),
    async listLiveProcesses() {
      return deepClone(liveEntries);
    },
    async readDump() {
      if (dumpCorrupt) {
        throw new Error('DUMP_UNPARSEABLE');
      }
      const bytes = dumpToBytes(dumpEntries);
      const parsed = JSON.parse(bytes.toString('utf8'));
      return { bytes, parsed, sha256: sha256Buffer(bytes) };
    },
    async writeBackup(bytes, destPath) {
      backups.set(destPath, Buffer.from(bytes));
      return { sha256: sha256Buffer(bytes), bytes: bytes.length, mode: 0o600 };
    },
    async restoreDump(backupBytes) {
      dumpCorrupt = false;
      dumpEntries = JSON.parse(Buffer.from(backupBytes).toString('utf8'));
    },
    async stopProcessByPmId(pmId) {
      const proc = liveEntries.find((e) => e.pm_id === pmId && e.name === 'titan-engine-worker');
      if (proc) proc.status = 'stopped';
      return { exitCode: 0 };
    },
    async startProcessByPmId(pmId) {
      const proc = liveEntries.find((e) => e.pm_id === pmId && e.name === 'titan-engine-worker');
      if (proc) proc.status = 'online';
      return { exitCode: 0 };
    },
    async pm2Save() {
      if (world.saveExit !== 0) {
        return { exitCode: world.saveExit, stderr: 'save failed' };
      }
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
      return { exitCode: 0 };
    },
    async healthCheck(port) {
      return { statusCode: 200, port };
    },
    async collectorFunctionalCheck() {
      return { accounts: 200, channels: 200, health: 200 };
    },
    async ensureDir() {},
    async chmod() {},
    async pathExists() {
      return true;
    },
  };
}

function buildOrch(worldOverrides = {}, orchOverrides = {}) {
  const world = makeLiveAndDump(worldOverrides);
  const commands = createFakeBoundary(world);
  const runId = orchOverrides.runId || 'T2R-TEST-001';
  const orch = createOrchestrator({
    commands,
    authorization: orchOverrides.authorization || makeAuth(runId),
    runId,
    backupRoot: orchOverrides.backupRoot || '/tmp/t2-orch-test-backups',
    productionModeAcknowledged: orchOverrides.productionModeAcknowledged !== false,
    expectedToolVersion: orchOverrides.expectedToolVersion || TOOL_VERSION,
  });
  return { orch, commands, world };
}

describe('T2 retry orchestrator (durable)', () => {
  it('T1 happy path', async () => {
    const { orch, commands } = buildOrch();
    const result = await orch.runTransaction();
    expect(result).toBe(State.COMPLETED);
    expect(orch.mutationClosed).toBe(true);
    const { liveEntries, dumpEntries } = commands.world();
    expect(liveEntries.filter((e) => e.name === 'titan-engine-worker' && e.status === 'online')).toHaveLength(1);
    expect(dumpEntries.filter((e) => e.name === 'titan-engine-worker' && e.status === 'stopped')).toHaveLength(1);
    const col = dumpEntries.find((e) => e.name === 'telegram-collector');
    expect(col.env.DB_USER).toBe(EXPECTED_COLLECTOR_DB_USER);
    expect(col.env.DB_PASSWORD).toBe(SECRET_PASSWORD);
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
    expect(orch.evidence.lines.some((l) => l.includes('POST_SAVE_SHA_CHANGED=EXPECTED'))).toBe(true);
    await orch.postsaveVerify();
    await orch.healthValidate();
    expect(orch.complete()).toBe(State.COMPLETED);
  });

  it('T3 save command failure => rollback', async () => {
    const { orch, commands } = buildOrch({ saveExit: 1 });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await expect(orch.save()).rejects.toMatchObject({ code: 'SAVE_EXIT_NONZERO' });
    expect(orch.state).toBe(State.ROLLED_BACK);
    const online = commands
      .world()
      .liveEntries.filter((e) => e.name === 'titan-engine-worker' && e.status === 'online');
    expect(online).toHaveLength(2);
  });

  it('T4 semantic post-save mismatch => rollback', async () => {
    const { orch } = buildOrch({ forceBackendDriftOnSave: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
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
    const after = await commands.readDump();
    expect(after.sha256).toBe(preSha);
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

  it('T9 stale pm_id / process generation blocked', async () => {
    const { orch, commands } = buildOrch();
    await orch.precheck();
    await orch.backup();
    // mutate live identity of extra before stop
    const live = commands.world().liveEntries;
    const extra = live.find((e) => e.pm_id === orch.selection.extra.pm_id);
    extra.restart_time = 999;
    await expect(orch.stopExtra()).rejects.toMatchObject({ code: 'STALE_EXTRA_PROCESS' });
    expect(orch.state).toBe(State.ROLLED_BACK);
  });

  it('T10 unexpected dump difference blocked', async () => {
    const { orch } = buildOrch({ forceProcessorDriftOnSave: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
  });

  it('T11 evidence secret-safe', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    const blob = orch.evidence.toString();
    expect(blob.includes(SECRET_PASSWORD)).toBe(false);
    expect(blob.includes(SECRET_TOKEN)).toBe(false);
    expect(blob).not.toMatch(/DB_PASSWORD=/);
    expect(blob).not.toMatch(/postgres:\/\//i);
  });

  it('T12 collector DB-B persistence accepted as allowlisted effect', async () => {
    const { orch } = buildOrch();
    await orch.runTransaction();
    expect(orch.evidence.lines.some((l) => l.includes('COLLECTOR_DB_KEYS_APPEAR'))).toBe(true);
    expect(orch.evidence.lines.some((l) => /presence_bits=11111/.test(l))).toBe(true);
    expect(orch.evidence.lines.some((l) => l.includes('DB_USER_EXPECTED=YES'))).toBe(true);
    expect(orch.evidence.lines.some((l) => l.includes(SECRET_PASSWORD))).toBe(false);
  });

  it('T13 changed dump SHA alone never causes S2 classification', async () => {
    const { orch } = buildOrch();
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    expect(orch.state).toBe(State.SAVE_SUCCESS);
    expect(orch.state).not.toBe(State.FAILED);
    expect(orch.evidence.lines.some((l) => /\bS2\b/.test(l))).toBe(false);
  });

  it('T14 NODE_ENV drift causes failure', async () => {
    const { orch } = buildOrch({ forceNodeEnvDriftOnSave: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
    expect(orch.state).toBe(State.ROLLED_BACK);
  });

  it('T15 backend/processor/monitor topology drift causes failure', async () => {
    for (const key of ['forceBackendDriftOnSave', 'forceProcessorDriftOnSave', 'forceMonitorDriftOnSave']) {
      const { orch } = buildOrch({ [key]: true });
      await orch.precheck();
      await orch.backup();
      await orch.stopExtra();
      await orch.save();
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
    expect(blob.includes('5433')).toBe(false);
    expect(blob).not.toMatch(/DB_PASSWORD=\S+/);
    expect(blob).not.toMatch(/DB_HOST=\S+/);
    // structural key names in keys_order allowlist are OK; values are not
    expect(blob).toMatch(/presence_bits=11111/);
  });

  it('fail-closed boundary rejects live ops by default', async () => {
    const boundary = createFailClosedBoundary();
    await expect(boundary.pm2Save()).rejects.toBeInstanceOf(ForbiddenLiveExecutionError);
  });

  it('authorization required / tool version mismatch fail closed', async () => {
    const { orch } = buildOrch({}, { expectedToolVersion: '0.0.0' });
    await expect(orch.precheck()).rejects.toMatchObject({ code: 'TOOL_VERSION_MISMATCH' });
  });

  it('deterministic retain lowest pm_id', async () => {
    const { orch } = buildOrch();
    const sel = await orch.precheck();
    expect(sel.retainedPmId).toBe(5);
    expect(sel.extraPmId).toBe(9);
  });
});
