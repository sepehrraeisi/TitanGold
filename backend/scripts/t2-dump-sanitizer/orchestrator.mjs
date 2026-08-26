/**
 * T2 dump sanitizer orchestrator — state machine with journal + central mutation guard.
 * Removes unauthorized persisted dump state; preserves collector DB-B exactly.
 * Never calls pm2 save. Rollback authority = CURRENT pre-sanitization backup (not CLEAN_PRE).
 */

import crypto from 'crypto';
import path from 'path';
import {
  AUTHORIZED_EFFECTS,
  AUTHORIZED_TRANSACTION,
  COLLECTOR_DB_KEYS,
  REQUIRED_DUMP_MODE,
  ROLLBACK_ELIGIBLE_STATES,
  State,
  TERMINAL_STATES,
  TOOL_VERSION,
} from './constants.mjs';
import {
  createFailClosedBoundary,
  ForbiddenLiveExecutionError,
  GlobalPm2SaveForbiddenError,
} from '../t2-retry-orchestrator/commandBoundary.mjs';
import { SecretSafeEvidence } from './evidence.mjs';
import {
  createExclusiveJournal,
  createMemoryJournalFs,
  JournalError,
  loadJournal,
} from './journal.mjs';
import {
  assertEntriesEnvShapes,
  captureCollectorDbLiveValues,
  compareCollectorDbLiveToPersist,
  diffFingerprints,
  semanticFingerprint,
} from '../t2-retry-orchestrator/semantics.mjs';
import { assertUnauthorizedLiveEnvNotPersisted } from '../t2-retry-orchestrator/projection.mjs';
import { buildSanitizedTarget } from './target.mjs';
import { createSideEffectLedger, planRollbackActions } from './sideEffectLedger.mjs';

const MUTATING_OPS = Object.freeze([
  'ensureDir',
  'writeBackup',
  'chmod',
  'writeSanitizedActiveDump',
  'writeProjectedActiveDump',
  'restoreDump',
  'pm2Save',
]);

const FORWARD_MUTATING_OPS = Object.freeze([
  'ensureDir',
  'writeBackup',
  'chmod',
  'writeSanitizedActiveDump',
  'writeProjectedActiveDump',
]);

function deepJsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export class DumpSanitizerError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'DumpSanitizerError';
    this.code = code;
  }
}

export function createDumpSanitizer(opts = {}) {
  return new DumpSanitizer(opts);
}

export class DumpSanitizer {
  constructor(opts = {}) {
    this.commands = opts.commands || createFailClosedBoundary();
    this.authorization = opts.authorization || null;
    this.runId = opts.runId || null;
    this.backupRoot = opts.backupRoot || null;
    this.journalRoot = opts.journalRoot || opts.backupRoot || null;
    this.journalFs = opts.journalFs || createMemoryJournalFs();
    this.journal = opts.journal || null;
    this.productionModeAcknowledged = opts.productionModeAcknowledged === true;
    this.expectedToolVersion =
      opts.expectedToolVersion !== undefined && opts.expectedToolVersion !== null
        ? opts.expectedToolVersion
        : TOOL_VERSION;

    this.state = this.journal?.state || State.AUTHORIZED_UNCONSUMED;
    this.authConsumed = this.journal?.authConsumed === true;
    this.mutationClosed = this.journal?.mutationClosed === true;
    this.evidence = new SecretSafeEvidence();

    this.sideEffects = createSideEffectLedger();
    if (this.journal?.record?.sideEffects) {
      const s = this.journal.record.sideEffects;
      if ('SANITIZED_DUMP_WRITE_ATTEMPTED' in s || 'BACKUP_WRITTEN' in s) {
        Object.assign(this.sideEffects, s);
      }
    }

    this.preDumpSha = null;
    this.preDumpMode = null;
    this.preDumpUid = null;
    this.preDumpGid = null;
    this.preDumpParsed = null;
    this.postDumpSha = null;
    this.preDumpFp = null;
    this.preLiveFp = null;
    this.liveCollectorDb = null;
    this.cleanPreDump = Array.isArray(opts.cleanPreDump) ? opts.cleanPreDump : null;
    this.expectedCleanPreSha = opts.expectedCleanPreSha || null;
    this.actualCleanPreSha = opts.actualCleanPreSha || null;
    this.expectedActiveDumpSha = opts.expectedActiveDumpSha || null;
    this.expectedSanitized = null;
    this.collectorDumpIndex = null;
    this.backupPath = null;
    this.backupBytes = null;
    this.runDir = this.journal?.runDir || null;
    this.lastRollbackPlan = null;
    this.skipHealth = opts.skipHealth === true;
  }

  _log(...parts) {
    this.evidence.log(...parts);
  }

  _isTerminal() {
    return TERMINAL_STATES.includes(this.state) || this.mutationClosed === true;
  }

  async _persistSideEffects() {
    if (this.journal) {
      this.journal.record.sideEffects = {
        BACKUP_WRITTEN: !!this.sideEffects.BACKUP_WRITTEN,
        SANITIZED_DUMP_WRITE_ATTEMPTED: !!this.sideEffects.SANITIZED_DUMP_WRITE_ATTEMPTED,
        SANITIZED_DUMP_WRITE_APPLIED: !!this.sideEffects.SANITIZED_DUMP_WRITE_APPLIED,
        DUMP_RESTORE_REQUIRED:
          typeof this.sideEffects.DUMP_RESTORE_REQUIRED === 'boolean'
            ? this.sideEffects.DUMP_RESTORE_REQUIRED
            : null,
        DUMP_RESTORE_DECISION:
          typeof this.sideEffects.DUMP_RESTORE_DECISION === 'string'
            ? this.sideEffects.DUMP_RESTORE_DECISION
            : 'UNDECIDED',
      };
      await this.journal.persist();
    }
  }

  requireMutationOpen(op) {
    if (this.mutationClosed || TERMINAL_STATES.includes(this.state)) {
      throw new DumpSanitizerError(
        'MUTATION_CLOSED',
        `MUTATION_CLOSED op=${op} state=${this.state}`,
      );
    }
    if (!this.authConsumed) {
      throw new DumpSanitizerError('AUTH_NOT_CONSUMED', `AUTH_NOT_CONSUMED op=${op}`);
    }
    if (!this.productionModeAcknowledged) {
      throw new DumpSanitizerError('PRODUCTION_ACK_REQUIRED', `PRODUCTION_ACK_REQUIRED op=${op}`);
    }
    if (this.state === State.ROLLBACK_RUNNING) {
      if (op !== 'restoreDump') {
        throw new DumpSanitizerError('ROLLBACK_OP_NOT_ALLOWED', `ROLLBACK_OP_NOT_ALLOWED op=${op}`);
      }
      return;
    }
    if (op === 'pm2Save') {
      throw new DumpSanitizerError('GLOBAL_PM2_SAVE_FORBIDDEN', 'GLOBAL_PM2_SAVE_FORBIDDEN');
    }
    if (op === 'restoreDump') {
      throw new DumpSanitizerError(
        'RESTORE_REQUIRES_ROLLBACK_STATE',
        `op=${op} state=${this.state}`,
      );
    }
    if (!FORWARD_MUTATING_OPS.includes(op)) {
      throw new DumpSanitizerError(
        'FORWARD_OP_NOT_ALLOWED',
        `FORWARD_OP_NOT_ALLOWED op=${op} state=${this.state}`,
      );
    }
  }

  async guardedCall(op, fn) {
    if (!MUTATING_OPS.includes(op)) {
      throw new DumpSanitizerError('UNKNOWN_MUTATING_OP', op);
    }
    this.requireMutationOpen(op);
    return fn();
  }

  _requireState(allowed) {
    if (!allowed.includes(this.state)) {
      throw new DumpSanitizerError(
        'STATE_BLOCKED',
        `STATE_BLOCKED current=${this.state} allowed=${allowed.join(',')}`,
      );
    }
  }

  async _setState(to, event) {
    this.state = to;
    if (TERMINAL_STATES.includes(to)) {
      this.mutationClosed = true;
    }
    if (this.journal) {
      await this.journal.transition(to, event);
      this.mutationClosed = this.journal.mutationClosed;
    }
    this._log('STATE', to, event || '');
  }

  async _failClosed(code, message) {
    await this._setState(State.FAILED, code);
    throw new DumpSanitizerError(code, message || code);
  }

  validateAuthorizationArtifact() {
    const auth = this.authorization;
    if (!auth || typeof auth !== 'object') {
      throw new DumpSanitizerError('AUTH_ARTIFACT_MISSING');
    }
    if (!this.runId || auth.runId !== this.runId) {
      throw new DumpSanitizerError('AUTH_RUN_ID_MISMATCH');
    }
    if (auth.consumed === true) {
      throw new DumpSanitizerError('AUTH_ALREADY_CONSUMED');
    }
    if (auth.authorizedTransaction !== AUTHORIZED_TRANSACTION) {
      throw new DumpSanitizerError('AUTH_TRANSACTION_MISMATCH');
    }
    const effects = auth.authorizedEffects;
    if (!Array.isArray(effects) || effects.length !== AUTHORIZED_EFFECTS.length) {
      throw new DumpSanitizerError('AUTH_EFFECTS_MISMATCH');
    }
    const sortedExpected = [...AUTHORIZED_EFFECTS].sort();
    const sortedActual = [...effects].sort();
    for (let i = 0; i < sortedExpected.length; i++) {
      if (sortedExpected[i] !== sortedActual[i]) {
        throw new DumpSanitizerError('AUTH_EFFECTS_MISMATCH');
      }
    }
    if (this.expectedToolVersion !== TOOL_VERSION) {
      throw new DumpSanitizerError('TOOL_VERSION_MISMATCH');
    }
    return true;
  }

  async consumeAuthorization() {
    if (this.authConsumed) {
      throw new DumpSanitizerError('AUTH_ALREADY_CONSUMED');
    }
    this.validateAuthorizationArtifact();
    if (!this.journal) {
      throw new DumpSanitizerError('JOURNAL_REQUIRED');
    }
    await this.journal.markAuthorizationConsumed();
    this.authConsumed = true;
    if (this.authorization && typeof this.authorization === 'object') {
      this.authorization.consumed = true;
    }
    this._log('AUTHORIZATION_CONSUMED', `run_id=${this.runId}`);
  }

  async initJournalExclusive() {
    if (!this.runId || !this.journalRoot) {
      throw new DumpSanitizerError('JOURNAL_ROOT_OR_RUN_ID_MISSING');
    }
    try {
      this.journal = await createExclusiveJournal({
        runId: this.runId,
        journalRoot: this.journalRoot,
        fs: this.journalFs,
        toolVersion: TOOL_VERSION,
      });
    } catch (err) {
      const code = err.code || err.message;
      if (code === 'RUN_DIR_EXISTS' || String(err.message || '').includes('RUN_DIR_EXISTS')) {
        throw new DumpSanitizerError('DUPLICATE_RUN_BLOCKED', 'DUPLICATE_RUN_BLOCKED');
      }
      throw err;
    }
    this.runDir = this.journal.runDir;
    this.journal.assertFreshStartAllowed();
  }

  async precheck() {
    if (this._isTerminal()) {
      throw new DumpSanitizerError('REPLAY_BLOCKED');
    }
    if (this.journal) {
      this.journal.assertFreshStartAllowed();
    } else {
      await this.initJournalExclusive();
    }
    await this._setState(State.PRECHECK_RUNNING, 'precheck_begin');

    try {
      this.validateAuthorizationArtifact();
    } catch (err) {
      return this._failClosed(err.code || 'AUTH_INVALID', err.message);
    }

    if (!this.cleanPreDump || !this.expectedCleanPreSha || !this.actualCleanPreSha) {
      return this._failClosed('CLEAN_PRE_BASELINE_REQUIRED');
    }
    if (this.expectedCleanPreSha !== this.actualCleanPreSha) {
      return this._failClosed('CLEAN_PRE_SHA_MISMATCH');
    }

    let dumpPack;
    try {
      dumpPack = await this.commands.readDump();
    } catch {
      return this._failClosed('PM2_DUMP_READ_FAILED');
    }

    this.preDumpSha = dumpPack.sha256;
    this.preDumpMode = typeof dumpPack.mode === 'number' ? dumpPack.mode & 0o777 : null;
    this.preDumpUid = dumpPack.uid;
    this.preDumpGid = dumpPack.gid;
    this.preDumpParsed = dumpPack.parsed;
    this.preDumpFp = semanticFingerprint(dumpPack.parsed);

    if (this.expectedActiveDumpSha && this.preDumpSha !== this.expectedActiveDumpSha) {
      return this._failClosed('ACTIVE_DUMP_SHA_MISMATCH');
    }

    const shapeCheck = assertEntriesEnvShapes(dumpPack.parsed);
    if (!shapeCheck.ok) {
      return this._failClosed(shapeCheck.error || 'ENV_SHAPE_UNRECOGNIZED');
    }

    let live;
    try {
      live = await this.commands.listLiveProcesses();
    } catch {
      return this._failClosed('PM2_JLIST_FAILED');
    }
    this.preLiveFp = semanticFingerprint(live);

    const fp = this.preLiveFp;
    if ((fp.engine_online_count || 0) !== 2) {
      return this._failClosed('TOPOLOGY_ENGINE_ONLINE_EXPECTED_2');
    }
    if ((fp.backend_count || 0) !== 4) {
      return this._failClosed('TOPOLOGY_BACKEND_EXPECTED_4');
    }
    if ((fp.processor_count || 0) !== 1) {
      return this._failClosed('TOPOLOGY_PROCESSOR_EXPECTED_1');
    }
    if ((fp.collector_count || 0) !== 1) {
      return this._failClosed('TOPOLOGY_COLLECTOR_EXPECTED_1');
    }
    if ((fp.monitor_count || 0) !== 2) {
      return this._failClosed('TOPOLOGY_MONITOR_EXPECTED_2');
    }

    this.liveCollectorDb = captureCollectorDbLiveValues(fp);
    if (!this.liveCollectorDb) {
      return this._failClosed('LIVE_COLLECTOR_DB_CAPTURE_FAILED');
    }

    const liveCol = (fp.collectors || [])[0];
    const dumpCol = (this.preDumpFp.collectors || [])[0];
    if (!liveCol || !dumpCol) {
      return this._failClosed('COLLECTOR_FINGERPRINT_MISSING');
    }
    const dbMatch = compareCollectorDbLiveToPersist(liveCol, dumpCol);
    for (const [k, v] of Object.entries(dbMatch.matches || {})) {
      this._log(`${k}=${v}`);
    }
    if (!dbMatch.ok) {
      return this._failClosed(dbMatch.error || 'COLLECTOR_DB_DUMP_LIVE_MISMATCH');
    }

    await this._setState(State.SANITIZE_BUILDING, 'sanitize_build_begin');
    const target = buildSanitizedTarget({
      cleanPreDump: this.cleanPreDump,
      currentDump: dumpPack.parsed,
      liveCollectorDb: this.liveCollectorDb,
    });
    if (!target.ok) {
      return this._failClosed(target.error || 'SANITIZE_TARGET_BUILD_FAILED');
    }
    if (target.manifest) {
      for (const [k, v] of Object.entries(target.manifest)) {
        this._log(`${k}=${v}`);
      }
    }
    this.expectedSanitized = target;
    this.collectorDumpIndex = target.collectorDumpIndex;

    if (!this.skipHealth) {
      try {
        const h5002 = await this.commands.healthCheck(5002);
        const h5003 = await this.commands.healthCheck(5003);
        if (h5002.statusCode !== 200 || h5003.statusCode !== 200) {
          return this._failClosed('PRECHECK_HEALTH_FAIL');
        }
        this._log('PRECHECK_HEALTH', '5002=200', '5003=200');
      } catch {
        return this._failClosed('PRECHECK_HEALTH_FAIL');
      }
    }

    await this._setState(State.SANITIZE_READY, 'sanitize_ready');
    await this._setState(State.PRECHECK_PASS, 'precheck_pass');
    this._log(
      'PRECHECK_PASS',
      `pre_dump_sha_prefix=${this.preDumpSha.slice(0, 12)}`,
      'collector_dump_live_db=YES',
    );
    return { preDumpSha: this.preDumpSha };
  }

  async backup() {
    this._requireState([State.PRECHECK_PASS]);
    if (!this.authConsumed) {
      await this.consumeAuthorization();
    }
    if (!this.journal?.authConsumed && this.journal) {
      throw new DumpSanitizerError('AUTH_CONSUME_NOT_PERSISTED');
    }

    if (!this.backupRoot) {
      throw new DumpSanitizerError('BACKUP_ROOT_MISSING');
    }
    const runDir =
      this.runDir || path.join(this.backupRoot, `TITANGOLD_T2_DUMP_SANITIZE_${this.runId}`);
    this.runDir = runDir;
    this.backupPath = path.join(runDir, 'dump.pm2.pre');

    await this.guardedCall('ensureDir', () => this.commands.ensureDir(runDir, 0o700));

    const dumpPack = await this.commands.readDump();
    if (dumpPack.sha256 !== this.preDumpSha) {
      return this._failClosed('BACKUP_SHA_DRIFT');
    }

    const written = await this.guardedCall('writeBackup', () =>
      this.commands.writeBackup(dumpPack.bytes, this.backupPath),
    );
    await this.guardedCall('chmod', () => this.commands.chmod(this.backupPath, 0o600));
    if (written.sha256 !== this.preDumpSha) {
      return this._failClosed('BACKUP_WRITE_SHA_MISMATCH');
    }
    this.backupBytes = dumpPack.bytes;
    this.sideEffects.BACKUP_WRITTEN = true;
    await this._persistSideEffects();
    await this._setState(State.BACKUP_VERIFIED, 'backup_verified');
    this._log(
      'BACKUP_VERIFIED',
      `sha_prefix=${this.preDumpSha.slice(0, 12)}`,
      'mode=0600',
      'dir_mode=0700',
      'BACKUP_WRITTEN=YES',
      'ROLLBACK_AUTHORITY=CURRENT_PRE_SANITIZATION',
    );
    return { backupPath: this.backupPath, sha256: this.preDumpSha };
  }

  async writeSanitized() {
    this._requireState([State.BACKUP_VERIFIED, State.SANITIZE_READY]);
    await this._setState(State.SANITIZE_WRITE_RUNNING, 'sanitize_write_begin');

    if (!this.expectedSanitized?.bytes) {
      await this.rollback('SANITIZE_BYTES_MISSING');
      throw new DumpSanitizerError('SANITIZE_BYTES_MISSING');
    }

    const expectedSha256 = sha256Buffer(this.expectedSanitized.bytes);
    const writeFn =
      this.commands.writeSanitizedActiveDump || this.commands.writeProjectedActiveDump;
    if (typeof writeFn !== 'function') {
      await this.rollback('WRITE_BOUNDARY_MISSING');
      throw new DumpSanitizerError('WRITE_BOUNDARY_MISSING');
    }

    this.sideEffects.SANITIZED_DUMP_WRITE_ATTEMPTED = true;
    await this._persistSideEffects();
    this._log('SANITIZED_DUMP_WRITE_ATTEMPTED=YES');

    try {
      await this.guardedCall('writeSanitizedActiveDump', () =>
        writeFn(this.expectedSanitized.bytes, {
          expectedUid: this.preDumpUid != null ? this.preDumpUid : undefined,
          expectedGid: this.preDumpGid != null ? this.preDumpGid : undefined,
          expectedSha256,
        }),
      );
    } catch (err) {
      if (err instanceof DumpSanitizerError && TERMINAL_STATES.includes(this.state)) {
        throw err;
      }
      const resolution = await this.resolveUnknownWriteState();
      await this.rollback('SANITIZED_DUMP_STATE_UNKNOWN', {
        dumpStateUnknown: true,
        dumpRestoreRequired: resolution.restoreRequired,
        dumpRestoreDecision: resolution.decision,
      });
      throw new DumpSanitizerError(resolution.errorCode || 'SANITIZED_DUMP_STATE_UNKNOWN');
    }

    let dumpPack;
    try {
      dumpPack = await this.commands.readDump();
    } catch {
      const resolution = await this.resolveUnknownWriteState();
      await this.rollback('SANITIZED_DUMP_STATE_UNKNOWN', {
        dumpStateUnknown: true,
        dumpRestoreRequired: resolution.restoreRequired,
        dumpRestoreDecision: resolution.decision,
      });
      throw new DumpSanitizerError('SANITIZED_DUMP_STATE_UNKNOWN');
    }

    const mode = typeof dumpPack.mode === 'number' ? dumpPack.mode & 0o777 : null;
    const shaOk = dumpPack.sha256 === expectedSha256;
    const modeOk = mode === REQUIRED_DUMP_MODE;
    const contentOk = deepJsonEqual(dumpPack.parsed, this.expectedSanitized.sanitized);

    if (!shaOk || !modeOk || !contentOk) {
      const resolution = await this.resolveUnknownWriteState();
      await this.rollback('SANITIZED_DUMP_POSTWRITE_MISMATCH', {
        dumpStateUnknown: true,
        dumpRestoreRequired: resolution.restoreRequired,
        dumpRestoreDecision: resolution.decision,
      });
      throw new DumpSanitizerError('SANITIZED_DUMP_POSTWRITE_MISMATCH');
    }

    this.sideEffects.SANITIZED_DUMP_WRITE_APPLIED = true;
    await this._persistSideEffects();
    this.postDumpSha = dumpPack.sha256;
    this._log('SANITIZED_DUMP_WRITE_APPLIED=YES', 'mode=0600');

    await this._setState(State.SANITIZE_WRITTEN, 'sanitize_written');
    this._log('SANITIZE_WRITTEN', `post_sha_prefix=${this.postDumpSha.slice(0, 12)}`);
    return { postDumpSha: this.postDumpSha, mode };
  }

  async postwriteVerify() {
    this._requireState([State.SANITIZE_WRITTEN]);

    const liveNow = await this.commands.listLiveProcesses();
    const liveFpNow = semanticFingerprint(liveNow);
    const dumpPack = await this.commands.readDump();
    const postMode = typeof dumpPack.mode === 'number' ? dumpPack.mode & 0o777 : null;

    if (postMode !== REQUIRED_DUMP_MODE) {
      await this.rollback('POSTWRITE_DUMP_MODE_NOT_0600');
      throw new DumpSanitizerError('POSTWRITE_DUMP_MODE_NOT_0600');
    }
    if (!this.expectedSanitized?.sanitized) {
      await this.rollback('SANITIZE_EXPECTED_MISSING');
      throw new DumpSanitizerError('SANITIZE_EXPECTED_MISSING');
    }
    if (!deepJsonEqual(dumpPack.parsed, this.expectedSanitized.sanitized)) {
      await this.rollback('POSTWRITE_DUMP_CONTENT_MISMATCH');
      throw new DumpSanitizerError('POSTWRITE_DUMP_CONTENT_MISMATCH');
    }

    const ownerPreserved =
      this.preDumpUid == null ? true : typeof dumpPack.uid === 'number' && dumpPack.uid === this.preDumpUid;
    const groupPreserved =
      this.preDumpGid == null ? true : typeof dumpPack.gid === 'number' && dumpPack.gid === this.preDumpGid;
    this._log(`OWNER_PRESERVED=${ownerPreserved ? 'YES' : 'NO'}`);
    this._log(`GROUP_PRESERVED=${groupPreserved ? 'YES' : 'NO'}`);
    this._log('MODE=0600');
    if (!ownerPreserved) {
      await this.rollback('POSTWRITE_OWNER_MISMATCH');
      throw new DumpSanitizerError('POSTWRITE_OWNER_MISMATCH');
    }
    if (!groupPreserved) {
      await this.rollback('POSTWRITE_GROUP_MISMATCH');
      throw new DumpSanitizerError('POSTWRITE_GROUP_MISMATCH');
    }

    const liveDbNow = captureCollectorDbLiveValues(liveFpNow);
    if (!liveDbNow) {
      await this.rollback('LIVE_COLLECTOR_DB_REVALIDATE_FAIL');
      throw new DumpSanitizerError('LIVE_COLLECTOR_DB_REVALIDATE_FAIL');
    }
    for (const key of COLLECTOR_DB_KEYS) {
      const stable = liveDbNow[key] === this.liveCollectorDb[key];
      this._log(`${key}_STABLE=${stable ? 'YES' : 'NO'}`);
      if (!stable) {
        await this.rollback('COLLECTOR_DB_LIVE_DRIFT');
        throw new DumpSanitizerError('COLLECTOR_DB_LIVE_DRIFT');
      }
    }

    const postCol = (semanticFingerprint(dumpPack.parsed).collectors || [])[0];
    const liveProc = { env_keys: [...COLLECTOR_DB_KEYS] };
    Object.defineProperty(liveProc, '_envValues', {
      value: liveDbNow,
      enumerable: false,
      writable: false,
      configurable: false,
    });
    const match = compareCollectorDbLiveToPersist(liveProc, postCol);
    for (const [k, v] of Object.entries(match.matches || {})) {
      this._log(`${k}=${v}`);
    }
    if (!match.ok) {
      await this.rollback(match.error || 'COLLECTOR_DB_LIVE_PERSIST_MISMATCH');
      throw new DumpSanitizerError(match.error || 'COLLECTOR_DB_LIVE_PERSIST_MISMATCH');
    }

    const liveCol = (liveFpNow.collectors || [])[0];
    const liveCollectorEnvKeys = Array.isArray(liveCol?.env_keys) ? liveCol.env_keys : [];
    const unauthorized = assertUnauthorizedLiveEnvNotPersisted({
      preDump: this.cleanPreDump,
      projected: dumpPack.parsed,
      collectorDumpIndex: this.collectorDumpIndex,
      liveCollectorEnvKeys,
    });
    if (!unauthorized.ok) {
      await this.rollback(unauthorized.error || 'UNAUTHORIZED_LIVE_ENV_PERSISTED');
      throw new DumpSanitizerError(unauthorized.error || 'UNAUTHORIZED_LIVE_ENV_PERSISTED');
    }
    this._log(`JWT_SECRET_LIVE_DRIFT_NOT_PERSISTED=${unauthorized.JWT_SECRET_LIVE_DRIFT_NOT_PERSISTED || 'PASS'}`);
    this._log(`LIVE_ONLY_CURSOR_ENV_NOT_PERSISTED=${unauthorized.LIVE_ONLY_CURSOR_ENV_NOT_PERSISTED || 'PASS'}`);

    const liveProof = assertLiveNoMutation(this.preLiveFp, liveFpNow);
    if (!liveProof.ok) {
      await this.rollback(liveProof.error || 'LIVE_INVARIANT_DRIFT');
      throw new DumpSanitizerError(liveProof.error || 'LIVE_INVARIANT_DRIFT');
    }
    this._log('LIVE_INVARIANT=PRESERVED');

    await this._setState(State.POSTWRITE_VERIFIED, 'postwrite_verified');
    this._log('POSTWRITE_VERIFIED');
    return { dbMatches: match.matches };
  }

  async healthValidate() {
    this._requireState([State.POSTWRITE_VERIFIED]);
    if (this.skipHealth) {
      this._log('HEALTH_SKIPPED=YES');
      return true;
    }
    const h5002 = await this.commands.healthCheck(5002);
    const h5003 = await this.commands.healthCheck(5003);
    const func = await this.commands.collectorFunctionalCheck();
    if (h5002.statusCode !== 200 || h5003.statusCode !== 200) {
      await this.rollback('HEALTH_FAIL');
      throw new DumpSanitizerError('HEALTH_FAIL');
    }
    if (func.accounts !== 200 || func.channels !== 200 || func.health !== 200) {
      await this.rollback('COLLECTOR_FUNCTIONAL_FAIL');
      throw new DumpSanitizerError('COLLECTOR_FUNCTIONAL_FAIL');
    }
    this._log('HEALTH_PASS', '5002=200', '5003=200', 'accounts=200', 'channels=200');
    return true;
  }

  async complete() {
    this._requireState([State.POSTWRITE_VERIFIED]);
    this._log('JWT_SECRET_RESTORED_TO_CLEAN_PRE=PASS');
    this._log('SESSION_ENV_RESTORED_TO_CLEAN_PRE=PASS');
    this._log('IDE_ENV_RESTORED_TO_CLEAN_PRE=PASS');
    this._log('PM2_LIVE_ONLY_METADATA_REMOVED=PASS');
    this._log('COLLECTOR_DB_B_PRESERVED_EXACT=PASS');
    this._log('UNRELATED_LIVE_DUMP_DRIFT_INTENTIONALLY_NOT_RECONCILED=YES');
    await this._setState(State.COMPLETED, 'completed');
    this._log('COMPLETED', 'mutation_capability=CLOSED', 'PM2_SAVE=0');
    return State.COMPLETED;
  }

  async resolveUnknownWriteState() {
    let dumpPack;
    try {
      dumpPack = await this.commands.readDump();
    } catch {
      this.sideEffects.DUMP_RESTORE_REQUIRED = true;
      this.sideEffects.DUMP_RESTORE_DECISION = 'ACTIVE_DUMP_UNREADABLE';
      await this._persistSideEffects();
      this._log('DUMP_RESTORE_REQUIRED=YES', 'DUMP_RESTORE_DECISION=ACTIVE_DUMP_UNREADABLE');
      return {
        restoreRequired: true,
        decision: 'ACTIVE_DUMP_UNREADABLE',
        errorCode: 'SANITIZED_DUMP_STATE_UNKNOWN',
      };
    }

    const mode = typeof dumpPack.mode === 'number' ? dumpPack.mode & 0o777 : null;
    const isExactPre =
      dumpPack.sha256 === this.preDumpSha &&
      deepJsonEqual(dumpPack.parsed, this.preDumpParsed) &&
      mode === this.preDumpMode &&
      (this.preDumpUid == null || dumpPack.uid === this.preDumpUid) &&
      (this.preDumpGid == null || dumpPack.gid === this.preDumpGid);
    const sanitizedSha = this.expectedSanitized?.bytes ? sha256Buffer(this.expectedSanitized.bytes) : null;
    const isExactSanitized =
      sanitizedSha != null &&
      dumpPack.sha256 === sanitizedSha &&
      mode === REQUIRED_DUMP_MODE &&
      !!this.expectedSanitized?.sanitized &&
      deepJsonEqual(dumpPack.parsed, this.expectedSanitized.sanitized);

    let decision = 'ACTIVE_DUMP_IS_OTHER';
    let restoreRequired = true;
    if (isExactPre) {
      decision = 'ACTIVE_DUMP_IS_EXACT_PRE';
      restoreRequired = false;
    } else if (isExactSanitized) {
      decision = 'ACTIVE_DUMP_IS_EXACT_SANITIZED';
    }

    this.sideEffects.DUMP_RESTORE_REQUIRED = restoreRequired;
    this.sideEffects.DUMP_RESTORE_DECISION = decision;
    await this._persistSideEffects();
    this._log(
      `DUMP_RESTORE_REQUIRED=${restoreRequired ? 'YES' : 'NO'}`,
      `DUMP_RESTORE_DECISION=${decision}`,
    );
    return {
      restoreRequired,
      decision,
      errorCode: 'SANITIZED_DUMP_STATE_UNKNOWN',
    };
  }

  async _provePreEquivalent() {
    const dumpPack = await this.commands.readDump();
    const live = await this.commands.listLiveProcesses();
    const postDumpFp = semanticFingerprint(dumpPack.parsed);
    const postLiveFp = semanticFingerprint(live);

    if (dumpPack.sha256 !== this.preDumpSha) {
      return { ok: false, error: 'ROLLBACK_DUMP_SHA_MISMATCH' };
    }
    const mode = typeof dumpPack.mode === 'number' ? dumpPack.mode & 0o777 : null;
    if (mode !== this.preDumpMode) {
      return { ok: false, error: 'ROLLBACK_DUMP_MODE_MISMATCH' };
    }
    if (this.preDumpUid != null && dumpPack.uid !== this.preDumpUid) {
      return { ok: false, error: 'ROLLBACK_DUMP_UID_MISMATCH' };
    }
    if (this.preDumpGid != null && dumpPack.gid !== this.preDumpGid) {
      return { ok: false, error: 'ROLLBACK_DUMP_GID_MISMATCH' };
    }

    const dumpDiff = diffFingerprints(this.preDumpFp, postDumpFp, { extraPmId: null });
    if (dumpDiff.classified.length > 0) {
      return {
        ok: false,
        error: 'ROLLBACK_DUMP_SEMANTIC_DRIFT',
        details: { kinds: dumpDiff.classified.map((c) => c.kind) },
      };
    }

    const liveProof = assertLiveNoMutation(this.preLiveFp, postLiveFp);
    if (!liveProof.ok) {
      return liveProof;
    }

    return { ok: true, details: { PRE_EQUIVALENT: 'YES' } };
  }

  async rollback(reason, opts = {}) {
    if (TERMINAL_STATES.includes(this.state) || this.mutationClosed) {
      throw new DumpSanitizerError('MUTATION_CLOSED', `MUTATION_CLOSED rollback state=${this.state}`);
    }
    if (!this.authConsumed) {
      throw new DumpSanitizerError('AUTH_NOT_CONSUMED', 'rollback requires consumed auth');
    }
    if (!this.productionModeAcknowledged) {
      throw new DumpSanitizerError('PRODUCTION_ACK_REQUIRED');
    }
    if (!ROLLBACK_ELIGIBLE_STATES.includes(this.state) && this.state !== State.ROLLBACK_RUNNING) {
      throw new DumpSanitizerError('ROLLBACK_STATE_INVALID', `ROLLBACK_STATE_INVALID state=${this.state}`);
    }

    this._log('ROLLBACK_BEGIN', reason);
    if (this.state !== State.ROLLBACK_RUNNING) {
      await this._setState(State.ROLLBACK_RUNNING, `rollback:${reason}`);
    }

    const plan = planRollbackActions(this.sideEffects, {
      dumpStateUnknown: opts.dumpStateUnknown === true,
      dumpRestoreRequired: opts.dumpRestoreRequired,
      dumpRestoreDecision: opts.dumpRestoreDecision,
    });
    this.lastRollbackPlan = plan;
    this._log(
      'ROLLBACK_PLAN',
      `restoreDump=${plan.restoreDump ? 'YES' : 'NO'}`,
      `restore_reason=${plan.reason.restore}`,
    );

    try {
      if (plan.restoreDump) {
        if (!this.backupBytes) {
          throw new DumpSanitizerError('BACKUP_BYTES_MISSING');
        }
        const restoreOpts = { mode: this.preDumpMode };
        if (this.preDumpUid != null) restoreOpts.uid = this.preDumpUid;
        if (this.preDumpGid != null) restoreOpts.gid = this.preDumpGid;
        const restoreResult = await this.guardedCall('restoreDump', () =>
          this.commands.restoreDump(this.backupBytes, restoreOpts),
        );
        if (restoreResult && restoreResult.ok === false) {
          throw new DumpSanitizerError('RESTORE_DUMP_FAILED');
        }
        if (
          restoreResult &&
          typeof restoreResult.mode === 'number' &&
          (restoreResult.mode & 0o777) !== (this.preDumpMode & 0o777)
        ) {
          throw new DumpSanitizerError('ROLLBACK_DUMP_MODE_MISMATCH');
        }
        if (
          restoreResult &&
          this.preDumpUid != null &&
          typeof restoreResult.uid === 'number' &&
          restoreResult.uid !== this.preDumpUid
        ) {
          throw new DumpSanitizerError('ROLLBACK_DUMP_UID_MISMATCH');
        }
        if (
          restoreResult &&
          this.preDumpGid != null &&
          typeof restoreResult.gid === 'number' &&
          restoreResult.gid !== this.preDumpGid
        ) {
          throw new DumpSanitizerError('ROLLBACK_DUMP_GID_MISMATCH');
        }
      }

      const proof = await this._provePreEquivalent();
      if (!proof.ok) {
        await this._setState(State.FAIL_FORWARD_COMPLETE, proof.error);
        this._log('FAIL_FORWARD_COMPLETE', proof.error);
        throw new DumpSanitizerError(proof.error);
      }

      await this._setState(State.ROLLED_BACK, reason);
      this._log('ROLLED_BACK', reason, 'PRE_EQUIVALENT=YES', 'CLEAN_PRE_NOT_RESTORED=YES');
    } catch (err) {
      if (TERMINAL_STATES.includes(this.state)) {
        throw err;
      }
      try {
        await this._setState(State.FAIL_FORWARD_COMPLETE, err.code || 'ROLLBACK_FAILED');
      } catch {
        /* terminal already */
      }
      this._log('FAIL_FORWARD_COMPLETE', err.code || 'ROLLBACK_FAILED');
      throw err;
    }
  }

  async runTransaction() {
    if (this._isTerminal()) {
      throw new DumpSanitizerError('REPLAY_BLOCKED');
    }
    await this.precheck();
    await this.backup();
    await this.writeSanitized();
    await this.postwriteVerify();
    await this.healthValidate();
    return this.complete();
  }
}

/**
 * Assert live PM2 state unchanged (no stop/start/save).
 * @param {ReturnType<typeof semanticFingerprint>} preLiveFp
 * @param {ReturnType<typeof semanticFingerprint>} postLiveFp
 */
export function assertLiveNoMutation(preLiveFp, postLiveFp) {
  const diff = diffFingerprints(preLiveFp, postLiveFp, { extraPmId: null });
  if (diff.classified.length > 0) {
    return {
      ok: false,
      error: 'LIVE_INVARIANT_DRIFT',
      details: { kinds: diff.classified.map((c) => c.kind) },
    };
  }
  return { ok: true, LIVE_INVARIANT: 'PASS' };
}

export function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function dumpToBytes(entries) {
  return Buffer.from(JSON.stringify(entries), 'utf8');
}

export {
  JournalError,
  createMemoryJournalFs,
  createExclusiveJournal,
  loadJournal,
  ForbiddenLiveExecutionError,
  GlobalPm2SaveForbiddenError,
};
