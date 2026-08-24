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
      created_at: 1001,
      restart_time: 5,
      env: { NODE_ENV: 'development', PATH: '/usr/bin' },
    },
    ...[1, 2, 3, 4].map((id) => ({
      name: 'titan-backend',
      pm_id: id,
      status: 'online',
      env: { NODE_ENV: 'development', BACKEND_SECRET: SECRET_BACKEND },
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
    forceBackendEnvAdd: false,
    forceBackendEnvRemove: false,
    forceBackendEnvValueChange: false,
    forceCollectorUnrelatedEnvAdd: false,
    forceProviderEnvAppear: false,
    forceTelegramTokenAppear: false,
    ...overrides,
  };
}

function createFakeBoundary(world) {
  let dumpEntries = deepClone(world.dump);
  let liveEntries = deepClone(world.live);
  let dumpCorrupt = false;

  return {
    world: () => ({ liveEntries, dumpEntries }),
    async listLiveProcesses() {
      return deepClone(liveEntries);
    },
    async readDump() {
      if (dumpCorrupt) throw new Error('DUMP_UNPARSEABLE');
      const bytes = dumpToBytes(dumpEntries);
      return { bytes, parsed: JSON.parse(bytes.toString('utf8')), sha256: sha256Buffer(bytes) };
    },
    async writeBackup(bytes) {
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

let runSeq = 0;
function nextRunId(prefix = 'T2R') {
  runSeq += 1;
  return `${prefix}-${runSeq}-${Date.now()}`;
}

function buildOrch(worldOverrides = {}, orchOverrides = {}) {
  const world = makeLiveAndDump(worldOverrides);
  const commands = createFakeBoundary(world);
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

describe('T2 retry orchestrator (durable audit correction)', () => {
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
    await orch.postsaveVerify();
    await orch.healthValidate();
    expect(await orch.complete()).toBe(State.COMPLETED);
  });

  it('T3 save command failure => rollback', async () => {
    const { orch, commands } = buildOrch({ saveExit: 1 });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await expect(orch.save()).rejects.toMatchObject({ code: 'SAVE_EXIT_NONZERO' });
    expect(orch.state).toBe(State.ROLLED_BACK);
    expect(
      commands.world().liveEntries.filter((e) => e.name === 'titan-engine-worker' && e.status === 'online'),
    ).toHaveLength(2);
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

  it('T9 stale pm_id / process generation blocked', async () => {
    const { orch, commands } = buildOrch();
    await orch.precheck();
    await orch.backup();
    const extra = commands.world().liveEntries.find((e) => e.pm_id === orch.selection.extra.pm_id);
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
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
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
    try {
      loaded.assertFreshStartAllowed();
    } catch (e) {
      expect(e.code).toBe('JOURNAL_AUTH_CONSUMED_NO_REPLAY');
    }
  });

  it('T18 crash-after-consume simulation = BLOCKED', async () => {
    const journalFs = createMemoryJournalFs();
    const journalRoot = '/tmp/t2-j-crash';
    const runId = nextRunId('CRASH');
    const { orch } = buildOrch({}, { journalFs, journalRoot, runId });
    await orch.precheck();
    await orch.consumeAuthorization();
    // simulate crash: new process sees consumed journal, cannot continue
    const loaded = await loadJournal({ runId, journalRoot, fs: journalFs });
    expect(loaded.authConsumed).toBe(true);
    try {
      loaded.assertFreshStartAllowed();
      throw new Error('should have thrown');
    } catch (e) {
      expect(e.code).toBe('JOURNAL_AUTH_CONSUMED_NO_REPLAY');
    }
    const orch2 = createOrchestrator({
      commands: createFakeBoundary(makeLiveAndDump()),
      authorization: makeAuth(runId),
      runId,
      backupRoot: journalRoot,
      journalRoot,
      journalFs,
      journal: loaded,
      productionModeAcknowledged: true,
    });
    await expect(orch2.precheck()).rejects.toBeTruthy();
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
    expect(orch.state).toBe(State.COMPLETED);
    const loaded = await loadJournal({ runId, journalRoot, fs: journalFs });
    expect(loaded.isTerminal()).toBe(true);
    try {
      loaded.assertFreshStartAllowed();
      throw new Error('should have thrown');
    } catch (e) {
      expect(['JOURNAL_TERMINAL_NO_REPLAY', 'JOURNAL_AUTH_CONSUMED_NO_REPLAY']).toContain(e.code);
    }
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

    // restoreDump cannot be called outside ROLLBACK_RUNNING
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
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
  });

  it('T23 backend unrelated env removal = FAIL', async () => {
    const { orch } = buildOrch({ forceBackendEnvRemove: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
  });

  it('T24 backend env value change = FAIL', async () => {
    const { orch } = buildOrch({ forceBackendEnvValueChange: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
    expect(orch.evidence.toString().includes('changed-secret-value')).toBe(false);
  });

  it('T25 collector unrelated env add = FAIL', async () => {
    const { orch } = buildOrch({ forceCollectorUnrelatedEnvAdd: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
  });

  it('T26 provider env appearance = FAIL', async () => {
    const { orch } = buildOrch({ forceProviderEnvAppear: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
    await expect(orch.postsaveVerify()).rejects.toMatchObject({ code: 'SEMANTIC_ALLOWLIST_FAIL' });
  });

  it('T27 Telegram token appearance = FAIL', async () => {
    const { orch } = buildOrch({ forceTelegramTokenAppear: true });
    await orch.precheck();
    await orch.backup();
    await orch.stopExtra();
    await orch.save();
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
        // journal must already show consumed
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
      'restoreDump',
      'startProcessByPmId',
    ]) {
      expect(MUTATING_OPS.includes(op)).toBe(true);
    }
  });
});
