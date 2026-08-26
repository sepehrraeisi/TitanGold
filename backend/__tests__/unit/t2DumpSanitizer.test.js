/**
 * @jest-environment node
 *
 * T2 dump sanitizer — synthetic/fake-only matrix (TOOL_VERSION 1.0.0).
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
  REQUIRED_DUMP_MODE,
  createDumpSanitizer,
  createFailClosedBoundary,
  createMemoryJournalFs,
  createExclusiveJournal,
  loadJournal,
  DumpSanitizerError,
  ForbiddenLiveExecutionError,
  GlobalPm2SaveForbiddenError,
  JournalError,
  buildSanitizedTarget,
  planRollbackActions,
  createSideEffectLedger,
  sha256Buffer,
  dumpToBytes,
  evaluateLiveExecutionGates,
  evaluateSanitizerExecutionGates,
  SecretSafeEvidence,
  assertSecretSafeLine,
  semanticFingerprint,
  compareCollectorDbLiveToPersist,
} from '../../scripts/t2-dump-sanitizer/index.mjs';

const SECRET_PASSWORD = 'super-secret-db-password-NEVER-IN-EVIDENCE';
const PRE_JWT = 'pre-dump-jwt-secret-VALUE';
const LIVE_JWT = 'live-different-jwt-secret-VALUE';

let runSeq = 0;
function nextRunId() {
  runSeq += 1;
  return `T2DS-TEST-${String(runSeq).padStart(3, '0')}`;
}

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function makeAuth(runId = nextRunId(), overrides = {}) {
  return {
    runId,
    authorizedTransaction: AUTHORIZED_TRANSACTION,
    authorizedEffects: [...AUTHORIZED_EFFECTS],
    oneShotToken: 'opaque-one-shot-not-a-credential',
    consumed: false,
    ...overrides,
  };
}

function prepareCleanPreFromLive(live) {
  const dump = deepClone(live);
  for (const e of dump) {
    delete e.pm_id;
    if (e.name === 'telegram-collector') {
      for (const k of COLLECTOR_DB_KEYS) delete e.env[k];
      e.env.JWT_SECRET = PRE_JWT;
      delete e.env.CURSOR_CONVERSATION_ID;
      delete e.env.SSH_CLIENT;
      delete e.env.PWD;
      delete e.env.prev_restart_delay;
      delete e.env.MEXC_API_KEY;
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
      env: { NODE_ENV: 'development', PATH: '/usr/bin' },
    },
    ...[1, 2, 3, 4].map((id) => ({
      name: 'titan-backend',
      pm_id: id,
      status: 'online',
      pm_cwd: '/app/backend',
      pm_exec_path: '/app/backend/server.js',
      exec_mode: 'cluster_mode',
      env: { NODE_ENV: 'development', PATH: '/usr/bin' },
    })),
    {
      name: 'telegram-processor',
      pm_id: 11,
      status: 'online',
      pm_cwd: '/app/telegram-collector',
      pm_exec_path: '/app/telegram-collector/processor.js',
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
        JWT_SECRET: LIVE_JWT,
        CURSOR_CONVERSATION_ID: 'cursor-session-id',
        SSH_CLIENT: '127.0.0.1 12345 22',
        PWD: '/home/ubuntu',
        prev_restart_delay: '500',
        MEXC_API_KEY: 'provider-secret-should-not-copy',
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

  // Fix typo in DB_HOST
  live.find((e) => e.name === 'telegram-collector').env.DB_HOST = '127.0.0.1';

  const cleanPre = prepareCleanPreFromLive(live);
  const currentDump = deepClone(cleanPre);
  const collector = currentDump.find((e) => e.name === 'telegram-collector');
  const liveCollector = live.find((e) => e.name === 'telegram-collector');
  for (const k of COLLECTOR_DB_KEYS) {
    collector.env[k] = liveCollector.env[k];
  }
  collector.env.JWT_SECRET = LIVE_JWT;
  collector.env.CURSOR_CONVERSATION_ID = 'cursor-session-id';
  collector.env.SSH_CLIENT = '127.0.0.1 12345 22';
  collector.env.PWD = '/home/ubuntu';
  collector.env.prev_restart_delay = '500';
  collector.env.MEXC_API_KEY = 'provider-secret-should-not-copy';

  return {
    live,
    cleanPre,
    currentDump,
    forceWriteFailBeforeRename: false,
    forceWriteFailAfterRename: false,
    forceOwnerMismatch: false,
    forceGroupMismatch: false,
    forceRestoreModeMismatch: false,
    forceRestoreUidMismatch: false,
    forceRestoreGidMismatch: false,
    forceLiveDriftAfterWrite: false,
    dumpMode: 0o664,
    dumpUid: 1000,
    dumpGid: 1000,
    ...overrides,
  };
}

function createFakeBoundary(world) {
  let dumpEntries = deepClone(world.currentDump);
  let liveEntries = deepClone(world.live);
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
      const bytes = dumpToBytes(dumpEntries);
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
      if (world.omitInspectActiveDumpWriteSafety) {
        throw new Error('INSPECT_UNAVAILABLE');
      }
      const uid =
        typeof world.forceInspectUidOverride === 'number'
          ? world.forceInspectUidOverride
          : dumpUid;
      const gid =
        typeof world.forceInspectGidOverride === 'number'
          ? world.forceInspectGidOverride
          : dumpGid;
      const ownerSafe = world.forceOwnerUnsafe !== true;
      const groupSafe = world.forceGroupUnsafe !== true;
      return {
        dumpUid: uid,
        dumpGid: gid,
        dumpMode,
        ownerSafe,
        groupSafe,
        safe: ownerSafe && groupSafe,
      };
    },
    async writeBackup(bytes) {
      mutationLog.push('writeBackup');
      return { sha256: sha256Buffer(bytes), bytes: bytes.length, mode: 0o600 };
    },
    async restoreDump(backupBytes, opts = {}) {
      mutationLog.push(['restoreDump', opts?.mode]);
      dumpEntries = JSON.parse(Buffer.from(backupBytes).toString('utf8'));
      if (typeof opts.mode !== 'number') return { ok: false };
      dumpMode = opts.mode & 0o777;
      if (world.forceRestoreModeMismatch) {
        dumpMode = (dumpMode ^ 0o020) & 0o777;
      }
      dumpUid =
        typeof world.forceRestoreUidOverride === 'number'
          ? world.forceRestoreUidOverride
          : typeof opts.uid === 'number'
            ? opts.uid
            : dumpUid;
      dumpGid =
        typeof world.forceRestoreGidOverride === 'number'
          ? world.forceRestoreGidOverride
          : typeof opts.gid === 'number'
            ? opts.gid
            : dumpGid;
      return { ok: true, mode: dumpMode, uid: dumpUid, gid: dumpGid };
    },
    async stopProcessByPmId(pmId) {
      mutationLog.push(['stop', pmId]);
      return { exitCode: 0 };
    },
    async startProcessByPmId(pmId) {
      mutationLog.push(['start', pmId]);
      return { exitCode: 0 };
    },
    async pm2Save() {
      mutationLog.push('pm2Save');
      throw Object.assign(new Error('GLOBAL_PM2_SAVE_FORBIDDEN'), {
        code: 'GLOBAL_PM2_SAVE_FORBIDDEN',
      });
    },
    async writeSanitizedActiveDump(bytes, opts = {}) {
      mutationLog.push(['writeSanitizedActiveDump', opts]);
      // Prove mode 0600 is established before secret bytes (mirrors createOwnedTempEmpty).
      mutationLog.push('temp_mode_0600_before_secret_bytes');
      if (world.forceWriteFailBeforeRename) {
        throw new Error('WRITE_FAIL_BEFORE_RENAME');
      }
      if (world.forceOwnerMismatch) {
        throw new Error('DUMP_OWNER_MISMATCH');
      }
      if (world.forceGroupMismatch) {
        throw new Error('DUMP_GROUP_MISMATCH');
      }
      mutationLog.push('write_secret_bytes');
      const applyBytes = () => {
        dumpEntries = JSON.parse(Buffer.from(bytes).toString('utf8'));
        dumpMode = REQUIRED_DUMP_MODE;
        if (typeof opts.expectedUid === 'number') dumpUid = opts.expectedUid;
        if (typeof opts.expectedGid === 'number') dumpGid = opts.expectedGid;
        if (world.forceLiveDriftAfterWrite) {
          const eng = liveEntries.find((e) => e.pm_id === 5);
          if (eng) eng.env = { ...eng.env, NODE_ENV: 'production' };
        }
      };
      if (world.forceWriteFailAfterRename) {
        applyBytes();
        mutationLog.push('rename_applied');
        throw new Error('WRITE_FAIL_AFTER_RENAME');
      }
      applyBytes();
      mutationLog.push('rename_applied');
      return {
        mode: dumpMode,
        sha256: sha256Buffer(bytes),
        uid: dumpUid,
        gid: dumpGid,
        ownerPreserved: true,
        groupPreserved: true,
      };
    },
    async healthCheck(port) {
      return { statusCode: 200 };
    },
    async collectorFunctionalCheck() {
      return { health: 200, accounts: 200, channels: 200 };
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

function stopCount(commands) {
  return commands.mutationLog.filter((m) => Array.isArray(m) && m[0] === 'stop').length;
}

function startCount(commands) {
  return commands.mutationLog.filter((m) => Array.isArray(m) && m[0] === 'start').length;
}

function pm2SaveCount(commands) {
  return commands.mutationLog.filter((m) => m === 'pm2Save').length;
}

function writeCount(commands) {
  return commands.mutationLog.filter(
    (m) => Array.isArray(m) && m[0] === 'writeSanitizedActiveDump',
  ).length;
}

function restoreCount(commands) {
  return commands.mutationLog.filter((m) => Array.isArray(m) && m[0] === 'restoreDump').length;
}

function buildSanitizer(worldOverrides = {}, orchOverrides = {}) {
  const world = makeLiveAndDump(worldOverrides);
  const commands = createFakeBoundary(world);
  const runId = orchOverrides.runId || nextRunId();
  const journalFs = orchOverrides.journalFs || createMemoryJournalFs();
  const journalRoot = orchOverrides.journalRoot || `/tmp/t2-dump-sanitizer-journals-${runId}`;
  const cleanPreBytes = dumpToBytes(world.cleanPre);
  const currentBytes = dumpToBytes(world.currentDump);
  const actualCleanPreSha = sha256Buffer(cleanPreBytes);
  const expectedActiveDumpSha = sha256Buffer(currentBytes);

  const sanitizer = createDumpSanitizer({
    commands,
    authorization: orchOverrides.authorization || makeAuth(runId),
    runId,
    backupRoot: journalRoot,
    journalRoot,
    journalFs,
    productionModeAcknowledged: orchOverrides.productionModeAcknowledged !== false,
    expectedToolVersion: orchOverrides.expectedToolVersion || TOOL_VERSION,
    cleanPreDump: world.cleanPre,
    expectedCleanPreSha: orchOverrides.expectedCleanPreSha || actualCleanPreSha,
    actualCleanPreSha: orchOverrides.actualCleanPreSha || actualCleanPreSha,
    expectedActiveDumpSha: orchOverrides.expectedActiveDumpSha || expectedActiveDumpSha,
    skipHealth: orchOverrides.skipHealth !== false,
  });
  return { sanitizer, commands, world, journalFs, journalRoot, runId, actualCleanPreSha, expectedActiveDumpSha };
}

describe('T2 dump sanitizer (v1.0.0)', () => {
  it('S1 happy path — clean PRE + five DB from current => COMPLETED', async () => {
    const { sanitizer, commands, world } = buildSanitizer();
    const result = await sanitizer.runTransaction();
    expect(result).toBe(State.COMPLETED);
    expect(sanitizer.mutationClosed).toBe(true);
    expect(sanitizer.authConsumed).toBe(true);
    expect(pm2SaveCount(commands)).toBe(0);
    expect(stopCount(commands)).toBe(0);
    expect(startCount(commands)).toBe(0);
    expect(writeCount(commands)).toBe(1);
    expect(commands.world().dumpMode).toBe(REQUIRED_DUMP_MODE);
    const col = commands.world().dumpEntries.find((e) => e.name === 'telegram-collector');
    expect(col.env.JWT_SECRET).toBe(PRE_JWT);
    expect(col.env.DB_USER).toBe(EXPECTED_COLLECTOR_DB_USER);
    expect(col.env.DB_PASSWORD).toBe(SECRET_PASSWORD);
    expect(col.env.CURSOR_CONVERSATION_ID).toBeUndefined();
    expect(col.env.MEXC_API_KEY).toBeUndefined();
    expect(col.env.prev_restart_delay).toBeUndefined();
    expect(sanitizer.evidence.containsForbiddenSubstring(SECRET_PASSWORD)).toBe(false);
  });

  it('S2 buildSanitizedTarget — JWT live drift NOT copied', () => {
    const { world } = buildSanitizer();
    const liveDb = {};
    const liveCol = world.live.find((e) => e.name === 'telegram-collector');
    for (const k of COLLECTOR_DB_KEYS) liveDb[k] = liveCol.env[k];
    const target = buildSanitizedTarget({
      cleanPreDump: world.cleanPre,
      currentDump: world.currentDump,
      liveCollectorDb: liveDb,
    });
    expect(target.ok).toBe(true);
    const col = target.sanitized.find((e) => e.name === 'telegram-collector');
    expect(col.env.JWT_SECRET).toBe(PRE_JWT);
    expect(col.env.JWT_SECRET).not.toBe(LIVE_JWT);
  });

  it('S3 session/Cursor/SSH/PWD not copied', () => {
    const { world } = buildSanitizer();
    const liveDb = {};
    const liveCol = world.live.find((e) => e.name === 'telegram-collector');
    for (const k of COLLECTOR_DB_KEYS) liveDb[k] = liveCol.env[k];
    const target = buildSanitizedTarget({
      cleanPreDump: world.cleanPre,
      currentDump: world.currentDump,
      liveCollectorDb: liveDb,
    });
    expect(target.ok).toBe(true);
    const col = target.sanitized.find((e) => e.name === 'telegram-collector');
    expect(col.env.CURSOR_CONVERSATION_ID).toBeUndefined();
    expect(col.env.SSH_CLIENT).toBeUndefined();
    expect(col.env.PWD).toBeUndefined();
  });

  it('S4 prev_restart_delay not copied', () => {
    const { world } = buildSanitizer();
    const liveDb = {};
    const liveCol = world.live.find((e) => e.name === 'telegram-collector');
    for (const k of COLLECTOR_DB_KEYS) liveDb[k] = liveCol.env[k];
    const target = buildSanitizedTarget({
      cleanPreDump: world.cleanPre,
      currentDump: world.currentDump,
      liveCollectorDb: liveDb,
    });
    expect(target.ok).toBe(true);
    const col = target.sanitized.find((e) => e.name === 'telegram-collector');
    expect(col.env.prev_restart_delay).toBeUndefined();
  });

  it('S5 provider env not copied', () => {
    const { world } = buildSanitizer();
    const liveDb = {};
    const liveCol = world.live.find((e) => e.name === 'telegram-collector');
    for (const k of COLLECTOR_DB_KEYS) liveDb[k] = liveCol.env[k];
    const target = buildSanitizedTarget({
      cleanPreDump: world.cleanPre,
      currentDump: world.currentDump,
      liveCollectorDb: liveDb,
    });
    expect(target.ok).toBe(true);
    const col = target.sanitized.find((e) => e.name === 'telegram-collector');
    expect(col.env.MEXC_API_KEY).toBeUndefined();
  });

  it('S6 DB dump/live mismatch fails before auth consume', async () => {
    const world = makeLiveAndDump();
    world.currentDump.find((e) => e.name === 'telegram-collector').env.DB_HOST = '10.0.0.99';
    const commands = createFakeBoundary(world);
    const runId = nextRunId();
    const journalFs = createMemoryJournalFs();
    const journalRoot = `/tmp/t2-ds-journals-${runId}`;
    const cleanSha = sha256Buffer(dumpToBytes(world.cleanPre));
    const activeSha = sha256Buffer(dumpToBytes(world.currentDump));
    const sanitizer = createDumpSanitizer({
      commands,
      authorization: makeAuth(runId),
      runId,
      backupRoot: journalRoot,
      journalRoot,
      journalFs,
      productionModeAcknowledged: true,
      cleanPreDump: world.cleanPre,
      expectedCleanPreSha: cleanSha,
      actualCleanPreSha: cleanSha,
      expectedActiveDumpSha: activeSha,
      skipHealth: true,
    });
    await expect(sanitizer.precheck()).rejects.toMatchObject({
      code: 'COLLECTOR_DB_LIVE_PERSIST_MISMATCH',
    });
    expect(sanitizer.authConsumed).toBe(false);
    const j = await loadJournal({ runId, journalRoot, fs: journalFs });
    expect(j.authConsumed).toBe(false);
  });

  it('S7 clean PRE SHA mismatch fails before auth', async () => {
    const { sanitizer } = buildSanitizer({}, { expectedCleanPreSha: 'deadbeef'.repeat(8) });
    await expect(sanitizer.precheck()).rejects.toMatchObject({ code: 'CLEAN_PRE_SHA_MISMATCH' });
    expect(sanitizer.authConsumed).toBe(false);
  });

  it('S8 active dump SHA mismatch fails before auth', async () => {
    const { sanitizer, expectedActiveDumpSha } = buildSanitizer();
    sanitizer.expectedActiveDumpSha = `${expectedActiveDumpSha.slice(0, -1)}0`;
    await expect(sanitizer.precheck()).rejects.toMatchObject({ code: 'ACTIVE_DUMP_SHA_MISMATCH' });
    expect(sanitizer.authConsumed).toBe(false);
  });

  it('S9 exact-set auth effects only', async () => {
    const runId = nextRunId();
    const { sanitizer } = buildSanitizer(
      {},
      {
        runId,
        authorization: makeAuth(runId, {
          authorizedEffects: ['SANITIZE_UNAUTHORIZED_PERSISTED_STATE'],
        }),
      },
    );
    await expect(sanitizer.precheck()).rejects.toMatchObject({ code: 'AUTH_EFFECTS_MISMATCH' });
  });

  it('S9b exact-set auth — extras fail', async () => {
    const runId = nextRunId();
    const { sanitizer } = buildSanitizer(
      {},
      {
        runId,
        authorization: makeAuth(runId, {
          authorizedEffects: [...AUTHORIZED_EFFECTS, 'EXTRA_FORBIDDEN_EFFECT'],
        }),
      },
    );
    await expect(sanitizer.precheck()).rejects.toMatchObject({ code: 'AUTH_EFFECTS_MISMATCH' });
  });

  it('S9c exact-set auth — duplicates fail', async () => {
    const runId = nextRunId();
    const { sanitizer } = buildSanitizer(
      {},
      {
        runId,
        authorization: makeAuth(runId, {
          authorizedEffects: [
            AUTHORIZED_EFFECTS[0],
            AUTHORIZED_EFFECTS[0],
            AUTHORIZED_EFFECTS[1],
          ],
        }),
      },
    );
    await expect(sanitizer.precheck()).rejects.toMatchObject({ code: 'AUTH_EFFECTS_MISMATCH' });
  });

  it('S10 backup before write — auth consumed before backup', async () => {
    const runId = nextRunId();
    const journalFs = createMemoryJournalFs();
    const journalRoot = `/tmp/t2-ds-backup-order-${runId}`;
    const world = makeLiveAndDump();
    let backupCalled = false;
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
    const cleanSha = sha256Buffer(dumpToBytes(world.cleanPre));
    const activeSha = sha256Buffer(dumpToBytes(world.currentDump));
    const sanitizer = createDumpSanitizer({
      commands,
      authorization: makeAuth(runId),
      runId,
      backupRoot: journalRoot,
      journalRoot,
      journalFs,
      productionModeAcknowledged: true,
      cleanPreDump: world.cleanPre,
      expectedCleanPreSha: cleanSha,
      actualCleanPreSha: cleanSha,
      expectedActiveDumpSha: activeSha,
      skipHealth: true,
    });
    await sanitizer.precheck();
    await sanitizer.backup();
    expect(backupCalled).toBe(true);
    expect(writeCount(commands)).toBe(0);
  });

  it('S11 write uses mode 0600 before secret bytes', async () => {
    const { sanitizer, commands } = buildSanitizer();
    await sanitizer.precheck();
    await sanitizer.backup();
    await sanitizer.writeSanitized();
    expect(commands.world().dumpMode).toBe(0o600);
    const idxMode = commands.mutationLog.indexOf('temp_mode_0600_before_secret_bytes');
    const idxBytes = commands.mutationLog.indexOf('write_secret_bytes');
    expect(idxMode).toBeGreaterThanOrEqual(0);
    expect(idxBytes).toBeGreaterThan(idxMode);
  });

  it('S12 postwrite uid/gid preserved', async () => {
    const { sanitizer, commands } = buildSanitizer({ dumpUid: 1000, dumpGid: 1001 });
    await sanitizer.runTransaction();
    expect(commands.world().dumpUid).toBe(1000);
    expect(commands.world().dumpGid).toBe(1001);
    expect(sanitizer.evidence.toString()).toMatch(/OWNER_PRESERVED=YES/);
    expect(sanitizer.evidence.toString()).toMatch(/GROUP_PRESERVED=YES/);
  });

  it('S13 write-before-rename failure with PRE exact => no restore', async () => {
    const { sanitizer, commands } = buildSanitizer({ forceWriteFailBeforeRename: true });
    await sanitizer.precheck();
    await sanitizer.backup();
    const preSha = sha256Buffer(dumpToBytes(commands.world().dumpEntries));
    await expect(sanitizer.writeSanitized()).rejects.toBeTruthy();
    expect(restoreCount(commands)).toBe(0);
    expect(sha256Buffer(dumpToBytes(commands.world().dumpEntries))).toBe(preSha);
    expect(sanitizer.state).toBe(State.ROLLED_BACK);
  });

  it('S14 after-rename failure => restore CURRENT pre-sanitization', async () => {
    const { sanitizer, commands } = buildSanitizer({ forceWriteFailAfterRename: true });
    await sanitizer.precheck();
    await sanitizer.backup();
    const preSha = sha256Buffer(dumpToBytes(commands.world().dumpEntries));
    await expect(sanitizer.writeSanitized()).rejects.toBeTruthy();
    expect(restoreCount(commands)).toBe(1);
    expect(sha256Buffer(dumpToBytes(commands.world().dumpEntries))).toBe(preSha);
    expect(sanitizer.state).toBe(State.ROLLED_BACK);
  });

  it('S15 rollback mode mismatch => FAIL_FORWARD_COMPLETE', async () => {
    const { sanitizer, commands } = buildSanitizer({
      forceWriteFailAfterRename: true,
      forceRestoreModeMismatch: true,
    });
    await sanitizer.precheck();
    await sanitizer.backup();
    await expect(sanitizer.writeSanitized()).rejects.toBeTruthy();
    expect(sanitizer.state).toBe(State.FAIL_FORWARD_COMPLETE);
    expect(restoreCount(commands)).toBe(1);
  });

  it('S15b rollback uid mismatch => FAIL_FORWARD_COMPLETE', async () => {
    const { sanitizer, commands } = buildSanitizer({
      forceWriteFailAfterRename: true,
      forceRestoreUidOverride: 9999,
    });
    await sanitizer.precheck();
    await sanitizer.backup();
    await expect(sanitizer.writeSanitized()).rejects.toBeTruthy();
    expect(sanitizer.state).toBe(State.FAIL_FORWARD_COMPLETE);
    expect(restoreCount(commands)).toBe(1);
  });

  it('S15c rollback gid mismatch => FAIL_FORWARD_COMPLETE', async () => {
    const { sanitizer, commands } = buildSanitizer({
      forceWriteFailAfterRename: true,
      forceRestoreGidOverride: 9999,
    });
    await sanitizer.precheck();
    await sanitizer.backup();
    await expect(sanitizer.writeSanitized()).rejects.toBeTruthy();
    expect(sanitizer.state).toBe(State.FAIL_FORWARD_COMPLETE);
    expect(restoreCount(commands)).toBe(1);
  });

  it('S16 live invariant drift after write => FAIL_FORWARD_COMPLETE', async () => {
    const { sanitizer } = buildSanitizer({ forceLiveDriftAfterWrite: true });
    await sanitizer.precheck();
    await sanitizer.backup();
    await sanitizer.writeSanitized();
    await expect(sanitizer.postwriteVerify()).rejects.toMatchObject({
      code: 'LIVE_INVARIANT_DRIFT',
    });
    expect(sanitizer.state).toBe(State.FAIL_FORWARD_COMPLETE);
  });

  it('S17 pm2 save forbidden on default boundary', async () => {
    const boundary = createFailClosedBoundary();
    await expect(boundary.pm2Save()).rejects.toBeInstanceOf(GlobalPm2SaveForbiddenError);
  });

  it('S18 fail-closed default boundary denies live ops', async () => {
    const boundary = createFailClosedBoundary();
    await expect(boundary.readDump()).rejects.toBeInstanceOf(ForbiddenLiveExecutionError);
  });

  it('S19 planRollbackActions restore when APPLIED', () => {
    const ledger = createSideEffectLedger();
    ledger.SANITIZED_DUMP_WRITE_APPLIED = true;
    const plan = planRollbackActions(ledger);
    expect(plan.restoreDump).toBe(true);
  });

  it('S20 planRollbackActions no restore when ATTEMPTED but PRE exact', () => {
    const ledger = createSideEffectLedger();
    ledger.SANITIZED_DUMP_WRITE_ATTEMPTED = true;
    const plan = planRollbackActions(ledger, {
      dumpStateUnknown: true,
      dumpRestoreRequired: false,
      dumpRestoreDecision: 'ACTIVE_DUMP_IS_EXACT_PRE',
    });
    expect(plan.restoreDump).toBe(false);
  });

  it('S21 CLI gates incomplete without --execute', () => {
    const gates = evaluateSanitizerExecutionGates(['--run-id', 'X']);
    expect(gates.ok).toBe(false);
    expect(gates.error).toBe('EXECUTION_GATES_INCOMPLETE');
    expect(evaluateLiveExecutionGates).toBe(evaluateSanitizerExecutionGates);
  });

  it('S22 CLI tool version mismatch', () => {
    const gates = evaluateSanitizerExecutionGates([
      '--execute',
      '--run-id',
      'X',
      '--authorization-file',
      '/tmp/auth.json',
      '--acknowledge-production-mutation',
      'YES',
      '--backup-root',
      '/tmp/bk',
      '--journal-root',
      '/tmp/jr',
      '--expected-tool-version',
      '0.9.0',
      '--confirm-run-transaction',
      '--clean-pre-file',
      '/tmp/clean.json',
      '--expected-clean-pre-sha',
      'abc',
      '--expected-active-dump-sha',
      'def',
    ]);
    expect(gates.ok).toBe(false);
    expect(gates.error).toBe('TOOL_VERSION_MISMATCH');
  });

  it('S22b all gates except journal-root => EXECUTION_GATES_INCOMPLETE', () => {
    const gates = evaluateSanitizerExecutionGates([
      '--execute',
      '--run-id',
      'X',
      '--authorization-file',
      '/tmp/auth.json',
      '--acknowledge-production-mutation',
      'YES',
      '--backup-root',
      '/tmp/bk',
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
    expect(gates.ok).toBe(false);
    expect(gates.error).toBe('EXECUTION_GATES_INCOMPLETE');
    expect(gates.missing).toContain('--journal-root');
  });

  it('S22c explicit journal-root => gate PASS', () => {
    const gates = evaluateSanitizerExecutionGates([
      '--execute',
      '--run-id',
      'X',
      '--authorization-file',
      '/tmp/auth.json',
      '--acknowledge-production-mutation',
      'YES',
      '--backup-root',
      '/tmp/bk',
      '--journal-root',
      '/tmp/jr',
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
    expect(gates.ok).toBe(true);
    expect(gates.journalRoot).toBe('/tmp/jr');
  });

  it('S23 journal replay blocked after auth consume', async () => {
    const runId = nextRunId();
    const journalFs = createMemoryJournalFs();
    const journalRoot = `/tmp/t2-ds-replay-${runId}`;
    const journal = await createExclusiveJournal({ runId, journalRoot, fs: journalFs });
    await journal.markAuthorizationConsumed();
    await expect(loadJournal({ runId, journalRoot, fs: journalFs })).resolves.toBeTruthy();
    const j = await loadJournal({ runId, journalRoot, fs: journalFs });
    expect(() => j.assertFreshStartAllowed()).toThrow(JournalError);
  });

  it('S24 secret-safe evidence (no values)', async () => {
    const { sanitizer } = buildSanitizer();
    await sanitizer.runTransaction();
    const evidence = sanitizer.evidence.toString();
    expect(evidence).not.toContain(SECRET_PASSWORD);
    expect(evidence).not.toContain(LIVE_JWT);
    expect(evidence).not.toContain(PRE_JWT);
    expect(evidence).toMatch(/JWT_SECRET_RESTORED_TO_CLEAN_PRE=PASS/);
    expect(evidence).toMatch(/COLLECTOR_DB_B_PRESERVED_EXACT=PASS/);
    expect(evidence).toMatch(/UNRELATED_LIVE_DUMP_DRIFT_INTENTIONALLY_NOT_RECONCILED=YES/);
    expect(evidence).toMatch(/ROLLBACK_AUTHORITY=CURRENT_PRE_SANITIZATION/);
    expect(() => assertSecretSafeLine(evidence.split('\n')[0])).not.toThrow();
    const ev = new SecretSafeEvidence();
    expect(() => ev.log(`DB_PASSWORD=${SECRET_PASSWORD}`)).toThrow(/SECRET_SAFE_EVIDENCE_VIOLATION/);
  });

  it('S25 rollback authority is CURRENT PRE not CLEAN_PRE', async () => {
    const { sanitizer, commands, world } = buildSanitizer({ forceWriteFailAfterRename: true });
    await sanitizer.precheck();
    await sanitizer.backup();
    const currentPreSha = sha256Buffer(dumpToBytes(world.currentDump));
    const cleanPreSha = sha256Buffer(dumpToBytes(world.cleanPre));
    expect(currentPreSha).not.toBe(cleanPreSha);
    await expect(sanitizer.writeSanitized()).rejects.toBeTruthy();
    expect(restoreCount(commands)).toBe(1);
    expect(sha256Buffer(dumpToBytes(commands.world().dumpEntries))).toBe(currentPreSha);
    expect(sha256Buffer(dumpToBytes(commands.world().dumpEntries))).not.toBe(cleanPreSha);
    expect(sanitizer.evidence.toString()).toMatch(/CLEAN_PRE_NOT_RESTORED=YES/);
  });

  it('S26 five DB_* exact current-dump/live match required for target', () => {
    const { world } = buildSanitizer();
    const liveDb = {};
    const liveCol = world.live.find((e) => e.name === 'telegram-collector');
    for (const k of COLLECTOR_DB_KEYS) liveDb[k] = liveCol.env[k];
    liveDb.DB_PORT = '9999';
    const target = buildSanitizedTarget({
      cleanPreDump: world.cleanPre,
      currentDump: world.currentDump,
      liveCollectorDb: liveDb,
    });
    expect(target.ok).toBe(false);
    expect(target.error).toBe('COLLECTOR_DB_DUMP_LIVE_MISMATCH');
  });

  it('S27 safe ownership => PASS with DUMP_OWNER_GROUP_PRECHECK', async () => {
    const { sanitizer } = buildSanitizer();
    await sanitizer.precheck();
    expect(sanitizer.state).toBe(State.PRECHECK_PASS);
    expect(sanitizer.authConsumed).toBe(false);
    expect(sanitizer.evidence.toString()).toMatch(/DUMP_OWNER_GROUP_PRECHECK=PASS/);
  });

  it('S28 unsafe owner => FAIL before auth consume', async () => {
    const { sanitizer } = buildSanitizer({ forceOwnerUnsafe: true });
    await expect(sanitizer.precheck()).rejects.toMatchObject({
      code: 'DUMP_OWNERSHIP_PRESERVATION_UNSAFE',
    });
    expect(sanitizer.authConsumed).toBe(false);
  });

  it('S29 unsafe group => FAIL before auth consume', async () => {
    const { sanitizer } = buildSanitizer({ forceGroupUnsafe: true });
    await expect(sanitizer.precheck()).rejects.toMatchObject({
      code: 'DUMP_OWNERSHIP_PRESERVATION_UNSAFE',
    });
    expect(sanitizer.authConsumed).toBe(false);
  });

  it('S30 inspection unavailable => FAIL before auth consume', async () => {
    const { sanitizer } = buildSanitizer({ omitInspectActiveDumpWriteSafety: true });
    await expect(sanitizer.precheck()).rejects.toMatchObject({
      code: 'DUMP_OWNERSHIP_SAFETY_CHECK_UNAVAILABLE',
    });
    expect(sanitizer.authConsumed).toBe(false);
  });

  it('S31 inspection uid mismatch vs readDump => FAIL', async () => {
    const { sanitizer } = buildSanitizer({ forceInspectUidOverride: 9999 });
    await expect(sanitizer.precheck()).rejects.toMatchObject({
      code: 'DUMP_OWNERSHIP_PRECHECK_METADATA_MISMATCH',
    });
    expect(sanitizer.authConsumed).toBe(false);
  });

  it('S32 inspection gid mismatch vs readDump => FAIL', async () => {
    const { sanitizer } = buildSanitizer({ forceInspectGidOverride: 8888 });
    await expect(sanitizer.precheck()).rejects.toMatchObject({
      code: 'DUMP_OWNERSHIP_PRECHECK_METADATA_MISMATCH',
    });
    expect(sanitizer.authConsumed).toBe(false);
  });

  it('S33 missing expectedActiveDumpSha => FAIL before auth', async () => {
    const { sanitizer } = buildSanitizer({}, { expectedActiveDumpSha: null });
    sanitizer.expectedActiveDumpSha = null;
    await expect(sanitizer.precheck()).rejects.toMatchObject({
      code: 'EXPECTED_ACTIVE_DUMP_SHA_REQUIRED',
    });
    expect(sanitizer.authConsumed).toBe(false);
  });

  it('S34 missing oneShotToken => FAIL before auth', async () => {
    const runId = nextRunId();
    const { sanitizer } = buildSanitizer(
      {},
      { runId, authorization: makeAuth(runId, { oneShotToken: undefined }) },
    );
    // makeAuth spreads overrides after defaults — need delete
    delete sanitizer.authorization.oneShotToken;
    await expect(sanitizer.precheck()).rejects.toMatchObject({ code: 'AUTH_TOKEN_MISSING' });
    expect(sanitizer.authConsumed).toBe(false);
  });

  it('S35 empty oneShotToken => FAIL before auth', async () => {
    const runId = nextRunId();
    const { sanitizer } = buildSanitizer(
      {},
      { runId, authorization: makeAuth(runId, { oneShotToken: '   ' }) },
    );
    await expect(sanitizer.precheck()).rejects.toMatchObject({ code: 'AUTH_TOKEN_MISSING' });
    expect(sanitizer.authConsumed).toBe(false);
  });

  it('S36 valid opaque token => PASS; token absent from evidence', async () => {
    const runId = nextRunId();
    const token = 'opaque-one-shot-not-a-credential-XYZ';
    const { sanitizer } = buildSanitizer(
      {},
      { runId, authorization: makeAuth(runId, { oneShotToken: token }) },
    );
    await sanitizer.runTransaction();
    expect(sanitizer.state).toBe(State.COMPLETED);
    const evidence = sanitizer.evidence.toString();
    expect(evidence).not.toContain(token);
    expect(evidence).not.toMatch(/oneShotToken/i);
  });
});
