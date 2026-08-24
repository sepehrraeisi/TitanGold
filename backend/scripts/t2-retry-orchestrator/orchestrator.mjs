/**
 * Durable T2 retry orchestrator — state machine with journal + central mutation guard.
 * Side-effect-aware rollback; PRE_EQUIVALENT required for ROLLED_BACK.
 */

import crypto from 'crypto';
import path from 'path';
import {
  AUTHORIZED_EFFECTS,
  AUTHORIZED_TRANSACTION,
  COLLECTOR_DB_KEYS,
  ROLLBACK_ELIGIBLE_STATES,
  State,
  TERMINAL_STATES,
  TOOL_VERSION,
} from './constants.mjs';
import { MUTATING_OPS, createFailClosedBoundary } from './commandBoundary.mjs';
import { SecretSafeEvidence } from './evidence.mjs';
import {
  createExclusiveJournal,
  createMemoryJournalFs,
  JournalError,
  loadJournal,
} from './journal.mjs';
import {
  assertCollectorPersistencePreconditions,
  assertEntriesEnvShapes,
  assertPreEquivalent,
  captureCollectorDbLiveValues,
  compareCollectorDbLiveToPersist,
  diffFingerprints,
  selectEngineRetainExtra,
  semanticFingerprint,
} from './semantics.mjs';
import { createSideEffectLedger, planRollbackActions } from './sideEffectLedger.mjs';

export class T2OrchestratorError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'T2OrchestratorError';
    this.code = code;
  }
}

export function createOrchestrator(opts = {}) {
  return new T2Orchestrator(opts);
}

export class T2Orchestrator {
  /**
   * @param {object} opts
   */
  constructor(opts = {}) {
    this.commands = opts.commands || createFailClosedBoundary();
    this.authorization = opts.authorization || null;
    this.runId = opts.runId || null;
    this.backupRoot = opts.backupRoot || null;
    this.journalRoot = opts.journalRoot || opts.backupRoot || null;
    this.journalFs = opts.journalFs || createMemoryJournalFs();
    this.journal = opts.journal || null;
    this.productionModeAcknowledged = opts.productionModeAcknowledged === true;
    // Must be explicitly supplied for live/exec paths — no silent default in CLI.
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
      Object.assign(this.sideEffects, this.journal.record.sideEffects);
    }

    this.preDumpSha = null;
    this.postDumpSha = null;
    this.preDumpFp = null;
    this.preLiveFp = null;
    this.liveFp = null;
    this.selection = null;
    this.backupPath = null;
    this.backupBytes = null;
    this.recordedExtraIdentity = null;
    this.recordedRetainedIdentity = null;
    this.liveCollectorDb = null;
    this.runDir = this.journal?.runDir || null;
    this.lastRollbackPlan = null;
  }

  _log(...parts) {
    this.evidence.log(...parts);
  }

  _isTerminal() {
    return TERMINAL_STATES.includes(this.state) || this.mutationClosed === true;
  }

  async _persistSideEffects() {
    if (this.journal) {
      await this.journal.persistSideEffects(this.sideEffects);
    }
  }

  requireMutationOpen(op) {
    if (this.mutationClosed || TERMINAL_STATES.includes(this.state)) {
      throw new T2OrchestratorError(
        'MUTATION_CLOSED',
        `MUTATION_CLOSED op=${op} state=${this.state}`,
      );
    }
    if (!this.authConsumed) {
      throw new T2OrchestratorError('AUTH_NOT_CONSUMED', `AUTH_NOT_CONSUMED op=${op}`);
    }
    if (!this.productionModeAcknowledged) {
      throw new T2OrchestratorError(
        'PRODUCTION_ACK_REQUIRED',
        `PRODUCTION_ACK_REQUIRED op=${op}`,
      );
    }
    if (this.state === State.ROLLBACK_RUNNING) {
      if (!['restoreDump', 'startProcessByPmId'].includes(op)) {
        throw new T2OrchestratorError(
          'ROLLBACK_OP_NOT_ALLOWED',
          `ROLLBACK_OP_NOT_ALLOWED op=${op}`,
        );
      }
      return;
    }
    if (op === 'restoreDump' || op === 'startProcessByPmId') {
      throw new T2OrchestratorError(
        'RESTORE_OR_START_REQUIRES_ROLLBACK_STATE',
        `op=${op} state=${this.state}`,
      );
    }
  }

  async guardedCall(op, fn) {
    if (!MUTATING_OPS.includes(op)) {
      throw new T2OrchestratorError('UNKNOWN_MUTATING_OP', op);
    }
    this.requireMutationOpen(op);
    return fn();
  }

  _requireState(allowed) {
    if (!allowed.includes(this.state)) {
      throw new T2OrchestratorError(
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
    throw new T2OrchestratorError(code, message || code);
  }

  /**
   * Fail closed with ZERO PM2 rollback mutations (e.g. stale before stop).
   */
  async _failClosedNoPm2Rollback(code, message) {
    this._log(
      'NO_PM2_ROLLBACK_MUTATION',
      `BACKUP_WRITTEN=${this.sideEffects.BACKUP_WRITTEN ? 'YES' : 'NO'}`,
      `STOP_ATTEMPTED=${this.sideEffects.STOP_ATTEMPTED ? 'YES' : 'NO'}`,
      `ENGINE_STOP_APPLIED=${this.sideEffects.ENGINE_STOP_APPLIED ? 'YES' : 'NO'}`,
      `SAVE_ATTEMPTED=${this.sideEffects.SAVE_ATTEMPTED ? 'YES' : 'NO'}`,
      `DUMP_SAVE_APPLIED=${this.sideEffects.DUMP_SAVE_APPLIED ? 'YES' : 'NO'}`,
    );
    await this._persistSideEffects();
    await this._failClosed(code, message);
  }

  validateAuthorizationArtifact() {
    const auth = this.authorization;
    if (!auth || typeof auth !== 'object') {
      throw new T2OrchestratorError('AUTH_ARTIFACT_MISSING');
    }
    if (!this.runId || auth.runId !== this.runId) {
      throw new T2OrchestratorError('AUTH_RUN_ID_MISMATCH');
    }
    if (auth.authorizedTransaction !== AUTHORIZED_TRANSACTION) {
      throw new T2OrchestratorError('AUTH_TRANSACTION_MISMATCH');
    }
    const effects = Array.isArray(auth.authorizedEffects) ? auth.authorizedEffects : [];
    for (const required of AUTHORIZED_EFFECTS) {
      if (!effects.includes(required)) {
        throw new T2OrchestratorError('AUTH_EFFECTS_INCOMPLETE');
      }
    }
    if (!auth.oneShotToken || typeof auth.oneShotToken !== 'string') {
      throw new T2OrchestratorError('AUTH_TOKEN_MISSING');
    }
    if (auth.consumed === true) {
      throw new T2OrchestratorError('AUTH_ALREADY_MARKED_CONSUMED');
    }
    if (this.expectedToolVersion !== TOOL_VERSION) {
      throw new T2OrchestratorError('TOOL_VERSION_MISMATCH');
    }
    if (!this.productionModeAcknowledged) {
      throw new T2OrchestratorError('PRODUCTION_ACK_REQUIRED');
    }
    return true;
  }

  async consumeAuthorization() {
    this._requireState([State.AUTHORIZED_UNCONSUMED, State.PRECHECK_PASS]);
    if (this.authConsumed) {
      throw new T2OrchestratorError('AUTH_ALREADY_CONSUMED');
    }
    this.validateAuthorizationArtifact();
    if (!this.journal) {
      throw new T2OrchestratorError('JOURNAL_REQUIRED');
    }
    await this.journal.markAuthorizationConsumed();
    this.authConsumed = true;
    if (this.authorization && typeof this.authorization === 'object') {
      this.authorization.consumed = true;
    }
    this._log('AUTHORIZATION_CONSUMED=YES', `runId=${this.runId}`);
  }

  async initJournalExclusive() {
    if (!this.runId || !this.journalRoot) {
      throw new T2OrchestratorError('JOURNAL_ROOT_OR_RUN_ID_MISSING');
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
        throw new T2OrchestratorError('DUPLICATE_RUN_BLOCKED', 'DUPLICATE_RUN_BLOCKED');
      }
      throw err;
    }
    this.runDir = this.journal.runDir;
    this.journal.assertFreshStartAllowed();
  }

  static async fromExistingJournal(opts) {
    const journal = await loadJournal({
      runId: opts.runId,
      journalRoot: opts.journalRoot,
      fs: opts.journalFs,
    });
    journal.assertFreshStartAllowed();
    return new T2Orchestrator({ ...opts, journal });
  }

  async precheck() {
    if (this._isTerminal()) {
      throw new T2OrchestratorError('REPLAY_BLOCKED');
    }
    if (this.journal) {
      this.journal.assertFreshStartAllowed();
    } else {
      await this.initJournalExclusive();
    }

    this._requireState([State.AUTHORIZED_UNCONSUMED]);
    await this._setState(State.PRECHECK_RUNNING, 'precheck_begin');

    if (!this.authorization) {
      return this._failClosed('AUTH_ARTIFACT_MISSING');
    }
    if (!this.runId) {
      return this._failClosed('RUN_ID_MISSING');
    }
    if (this.expectedToolVersion !== TOOL_VERSION) {
      return this._failClosed('TOOL_VERSION_MISMATCH');
    }

    const live = await this.commands.listLiveProcesses();
    const dumpPack = await this.commands.readDump();

    const liveShape = assertEntriesEnvShapes(live);
    if (!liveShape.ok) {
      return this._failClosed(liveShape.error || 'ENV_SHAPE_UNRECOGNIZED');
    }
    const dumpShape = assertEntriesEnvShapes(dumpPack.parsed);
    if (!dumpShape.ok) {
      return this._failClosed(dumpShape.error || 'ENV_SHAPE_UNRECOGNIZED');
    }
    this._log(
      'ENV_SHAPE_OK',
      `live=${liveShape.shapes.join('+')}`,
      `dump=${dumpShape.shapes.join('+')}`,
    );

    this.liveFp = semanticFingerprint(live);
    this.preLiveFp = this.liveFp;
    this.preDumpFp = semanticFingerprint(dumpPack.parsed);
    this.preDumpSha = dumpPack.sha256;

    const selection = selectEngineRetainExtra(this.liveFp);
    if (!selection.ok) {
      return this._failClosed(selection.error);
    }
    this.selection = selection;
    this.recordedExtraIdentity = {
      pm_id: selection.extra.pm_id,
      script: selection.extra.script,
      cwd: selection.extra.cwd,
      exec_mode: selection.extra.exec_mode,
      NODE_ENV: selection.extra.NODE_ENV,
      created_at: selection.extra.created_at,
      restart_time: selection.extra.restart_time,
    };
    this.recordedRetainedIdentity = {
      pm_id: selection.retained.pm_id,
      script: selection.retained.script,
      cwd: selection.retained.cwd,
      exec_mode: selection.retained.exec_mode,
      NODE_ENV: selection.retained.NODE_ENV,
    };

    const dumpOnline = (this.preDumpFp.engines || []).filter((e) => e.status === 'online');
    if (dumpOnline.length !== 2) {
      return this._failClosed('DUMP_ENGINE_ONLINE_EXPECTED_2');
    }

    const precond = assertCollectorPersistencePreconditions(this.liveFp, this.preDumpFp);
    if (!precond.ok) {
      return this._failClosed(precond.error);
    }

    this.liveCollectorDb = captureCollectorDbLiveValues(this.liveFp);
    if (!this.liveCollectorDb) {
      return this._failClosed('LIVE_COLLECTOR_DB_CAPTURE_FAILED');
    }

    await this.journal.setSelection({
      retainedPmId: selection.retained.pm_id,
      extraPmId: selection.extra.pm_id,
      preDumpShaPrefix: this.preDumpSha,
    });

    await this._setState(State.PRECHECK_PASS, 'precheck_pass');
    this._log(
      'PRECHECK_PASS',
      `retained_pm_id=${selection.retained.pm_id}`,
      `extra_pm_id=${selection.extra.pm_id}`,
      'collector_live_db_b=YES',
      'collector_dump_db=NO',
      `pre_dump_sha_prefix=${this.preDumpSha.slice(0, 12)}`,
    );
    return {
      retainedPmId: selection.retained.pm_id,
      extraPmId: selection.extra.pm_id,
    };
  }

  async backup() {
    this._requireState([State.PRECHECK_PASS]);
    if (!this.authConsumed) {
      await this.consumeAuthorization();
    }
    if (!this.journal?.authConsumed) {
      throw new T2OrchestratorError('AUTH_CONSUME_NOT_PERSISTED');
    }

    if (!this.backupRoot) {
      throw new T2OrchestratorError('BACKUP_ROOT_MISSING');
    }
    const runDir =
      this.runDir || path.join(this.backupRoot, `TITANGOLD_PM2_ENGINE_RECON_${this.runId}`);
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
    );
    return { backupPath: this.backupPath, sha256: this.preDumpSha };
  }

  async _revalidateExtraIdentity() {
    const live = await this.commands.listLiveProcesses();
    const fp = semanticFingerprint(live);
    const extra = (fp.engines || []).find((e) => e.pm_id === this.recordedExtraIdentity.pm_id);
    if (!extra || extra.status !== 'online') {
      throw new T2OrchestratorError('STALE_EXTRA_PROCESS');
    }
    const rec = this.recordedExtraIdentity;
    if (
      extra.script !== rec.script ||
      extra.cwd !== rec.cwd ||
      extra.exec_mode !== rec.exec_mode ||
      extra.NODE_ENV !== rec.NODE_ENV ||
      extra.created_at !== rec.created_at ||
      extra.restart_time !== rec.restart_time
    ) {
      throw new T2OrchestratorError('STALE_EXTRA_PROCESS');
    }
  }

  async stopExtra() {
    this._requireState([State.BACKUP_VERIFIED]);
    await this._setState(State.MUTATION_RUNNING, 'stop_extra_begin');

    try {
      await this._revalidateExtraIdentity();
    } catch (err) {
      // Stale BEFORE stop → zero PM2 rollback mutation
      await this._failClosedNoPm2Rollback(err.code || 'STALE_EXTRA_PROCESS');
      throw err;
    }

    const extraId = this.selection.extra.pm_id;
    this.sideEffects.STOP_ATTEMPTED = true;
    await this._persistSideEffects();

    const result = await this.guardedCall('stopProcessByPmId', () =>
      this.commands.stopProcessByPmId(extraId),
    );

    // Fresh-read live state — never trust exit code alone for ENGINE_STOP_APPLIED
    const live = await this.commands.listLiveProcesses();
    const fp = semanticFingerprint(live);
    const extra = (fp.engines || []).find((e) => e.pm_id === extraId);
    const stopProven = extra && extra.status === 'stopped';
    if (stopProven) {
      this.sideEffects.ENGINE_STOP_APPLIED = true;
      await this._persistSideEffects();
      this._log('ENGINE_STOP_APPLIED=YES', `extra_pm_id=${extraId}`);
    } else {
      this._log('ENGINE_STOP_APPLIED=NO');
    }

    if (result.exitCode !== 0 && !stopProven) {
      await this.rollback('STOP_EXTRA_FAILED');
      throw new T2OrchestratorError('STOP_EXTRA_FAILED');
    }
    if (!stopProven) {
      await this.rollback('ENGINE_STOP_NOT_PROVEN');
      throw new T2OrchestratorError('ENGINE_STOP_NOT_PROVEN');
    }

    if (fp.engine_online_count !== 1) {
      await this.rollback('ENGINE_SINGLETON_VALIDATION_FAIL');
      throw new T2OrchestratorError('ENGINE_SINGLETON_VALIDATION_FAIL');
    }
    const retained = (fp.engines || []).find((e) => e.pm_id === this.selection.retained.pm_id);
    if (!retained || retained.status !== 'online') {
      await this.rollback('RETAINED_NOT_ONLINE');
      throw new T2OrchestratorError('RETAINED_NOT_ONLINE');
    }

    await this._setState(State.ENGINE_SINGLETON_VERIFIED, 'singleton_verified');
    this._log('ENGINE_SINGLETON_VERIFIED', `online=1 retained_pm_id=${retained.pm_id}`);
    return true;
  }

  async save() {
    this._requireState([State.ENGINE_SINGLETON_VERIFIED]);
    await this._setState(State.SAVE_RUNNING, 'save_begin');

    this.sideEffects.SAVE_ATTEMPTED = true;
    await this._persistSideEffects();

    const result = await this.guardedCall('pm2Save', () => this.commands.pm2Save());

    let dumpPack = null;
    let dumpStateUnknown = false;
    try {
      dumpPack = await this.commands.readDump();
    } catch {
      dumpStateUnknown = true;
    }

    if (dumpPack && dumpPack.sha256 !== this.preDumpSha) {
      this.sideEffects.DUMP_SAVE_APPLIED = true;
      await this._persistSideEffects();
      this._log('DUMP_SAVE_APPLIED=YES', `post_sha_prefix=${dumpPack.sha256.slice(0, 12)}`);
    } else if (dumpPack) {
      this._log('DUMP_SAVE_APPLIED=NO', 'sha_unchanged');
    } else {
      this._log('DUMP_SAVE_APPLIED=UNKNOWN');
    }

    if (result.exitCode !== 0) {
      await this.rollback('SAVE_EXIT_NONZERO', { dumpStateUnknown });
      throw new T2OrchestratorError('SAVE_EXIT_NONZERO');
    }

    if (dumpStateUnknown || !dumpPack) {
      await this.rollback('DUMP_UNPARSEABLE', { dumpStateUnknown: true });
      throw new T2OrchestratorError('DUMP_UNPARSEABLE');
    }

    this.postDumpSha = dumpPack.sha256;
    if (this.postDumpSha !== this.preDumpSha) {
      this._log('POST_SAVE_SHA_CHANGED=EXPECTED');
    } else {
      this._log('POST_SAVE_SHA_UNCHANGED=UNEXPECTED_BUT_NOT_ALONE_FATAL');
    }

    await this._setState(State.SAVE_SUCCESS, 'save_success');
    this._log('SAVE_SUCCESS', `post_sha_prefix=${this.postDumpSha.slice(0, 12)}`);
    return { postDumpSha: this.postDumpSha };
  }

  async postsaveVerify() {
    this._requireState([State.SAVE_SUCCESS]);

    // Revalidate live collector DB values before persist equality check
    const liveNow = await this.commands.listLiveProcesses();
    const liveFpNow = semanticFingerprint(liveNow);
    const liveDbNow = captureCollectorDbLiveValues(liveFpNow);
    if (!liveDbNow) {
      await this.rollback('LIVE_COLLECTOR_DB_REVALIDATE_FAIL');
      throw new T2OrchestratorError('LIVE_COLLECTOR_DB_REVALIDATE_FAIL');
    }
    this.liveCollectorDb = liveDbNow;

    const dumpPack = await this.commands.readDump();
    const postFp = semanticFingerprint(dumpPack.parsed);
    const { classified } = diffFingerprints(this.preDumpFp, postFp, {
      extraPmId: this.selection.extra.pm_id,
    });

    const kinds = new Set(classified.map((c) => c.kind));
    if (this.postDumpSha !== this.preDumpSha) {
      kinds.add('DUMP_SHA_CHANGED');
    }

    const unexpected = classified.filter(
      (c) =>
        c.kind !== 'ENGINE_EXTRA_STATUS_ONLINE_TO_STOPPED' &&
        c.kind !== 'COLLECTOR_DB_KEYS_APPEAR',
    );
    if (unexpected.length > 0) {
      await this.rollback('SEMANTIC_ALLOWLIST_FAIL');
      throw new T2OrchestratorError(
        'SEMANTIC_ALLOWLIST_FAIL',
        `unexpected=${unexpected.map((u) => u.kind).join(',')}`,
      );
    }
    if (!kinds.has('ENGINE_EXTRA_STATUS_ONLINE_TO_STOPPED')) {
      await this.rollback('MISSING_ENGINE_DIFF');
      throw new T2OrchestratorError('MISSING_ENGINE_DIFF');
    }
    if (!kinds.has('COLLECTOR_DB_KEYS_APPEAR')) {
      await this.rollback('MISSING_COLLECTOR_DB_PERSIST');
      throw new T2OrchestratorError('MISSING_COLLECTOR_DB_PERSIST');
    }

    const postCol = (postFp.collectors || [])[0];
    const liveProc = { env_keys: [...COLLECTOR_DB_KEYS] };
    Object.defineProperty(liveProc, '_envValues', {
      value: this.liveCollectorDb,
      enumerable: false,
      writable: false,
      configurable: false,
    });
    const match = compareCollectorDbLiveToPersist(liveProc, postCol);
    for (const [k, v] of Object.entries(match.matches)) {
      this._log(`${k}=${v}`);
    }
    if (!match.ok) {
      await this.rollback('SEMANTIC_ALLOWLIST_FAIL');
      throw new T2OrchestratorError('SEMANTIC_ALLOWLIST_FAIL', match.error);
    }

    const col = postCol || {};
    const presenceBits = COLLECTOR_DB_KEYS.map((k) => (col.db_keys_present?.[k] ? '1' : '0')).join(
      '',
    );
    this._log(
      'COLLECTOR_DB_PERSIST_PRESENT',
      `keys_order=${COLLECTOR_DB_KEYS.join(',')}`,
      `presence_bits=${presenceBits}`,
      `DB_USER_EXPECTED=${col.db_user_matches_expected ? 'YES' : 'NO'}`,
    );

    await this._setState(State.POSTSAVE_VERIFIED, 'postsave_verified');
    this._log('POSTSAVE_VERIFIED', `allowlist=${[...kinds].sort().join(',')}`);
    return { kinds: [...kinds], dbMatches: match.matches };
  }

  async healthValidate() {
    this._requireState([State.POSTSAVE_VERIFIED]);
    const h5002 = await this.commands.healthCheck(5002);
    const h5003 = await this.commands.healthCheck(5003);
    const func = await this.commands.collectorFunctionalCheck();
    if (h5002.statusCode !== 200 || h5003.statusCode !== 200) {
      await this.rollback('HEALTH_FAIL');
      throw new T2OrchestratorError('HEALTH_FAIL');
    }
    if (func.accounts !== 200 || func.channels !== 200 || func.health !== 200) {
      await this.rollback('COLLECTOR_FUNCTIONAL_FAIL');
      throw new T2OrchestratorError('COLLECTOR_FUNCTIONAL_FAIL');
    }
    this._log('HEALTH_PASS', '5002=200', '5003=200', 'accounts=200', 'channels=200');
    return true;
  }

  async complete() {
    this._requireState([State.POSTSAVE_VERIFIED]);
    await this._setState(State.COMPLETED, 'completed');
    this._log('COMPLETED', 'mutation_capability=CLOSED');
    return State.COMPLETED;
  }

  /**
   * Side-effect-aware rollback.
   * nonterminal → ROLLBACK_RUNNING → conditional guarded mutations → PRE_EQUIVALENT → ROLLED_BACK
   * or FAIL_FORWARD_COMPLETE if postconditions fail.
   */
  async rollback(reason, opts = {}) {
    if (TERMINAL_STATES.includes(this.state) || this.mutationClosed) {
      throw new T2OrchestratorError(
        'MUTATION_CLOSED',
        `MUTATION_CLOSED rollback state=${this.state}`,
      );
    }
    if (!this.authConsumed) {
      throw new T2OrchestratorError('AUTH_NOT_CONSUMED', 'rollback requires consumed auth');
    }
    if (!this.productionModeAcknowledged) {
      throw new T2OrchestratorError('PRODUCTION_ACK_REQUIRED');
    }
    if (!ROLLBACK_ELIGIBLE_STATES.includes(this.state) && this.state !== State.ROLLBACK_RUNNING) {
      throw new T2OrchestratorError(
        'ROLLBACK_STATE_INVALID',
        `ROLLBACK_STATE_INVALID state=${this.state}`,
      );
    }

    this._log('ROLLBACK_BEGIN', reason);
    if (this.state !== State.ROLLBACK_RUNNING) {
      await this._setState(State.ROLLBACK_RUNNING, `rollback:${reason}`);
    }

    const plan = planRollbackActions(this.sideEffects, {
      dumpStateUnknown: opts.dumpStateUnknown === true,
    });
    this.lastRollbackPlan = plan;
    this._log(
      'ROLLBACK_PLAN',
      `restoreDump=${plan.restoreDump ? 'YES' : 'NO'}`,
      `startExtra=${plan.startExtra ? 'YES' : 'NO'}`,
      `restore_reason=${plan.reason.restore}`,
      `start_reason=${plan.reason.start}`,
    );

    try {
      if (plan.restoreDump) {
        if (!this.backupBytes) {
          throw new T2OrchestratorError('BACKUP_BYTES_MISSING');
        }
        const restoreResult = await this.guardedCall('restoreDump', () =>
          this.commands.restoreDump(this.backupBytes),
        );
        if (restoreResult && restoreResult.ok === false) {
          throw new T2OrchestratorError('RESTORE_DUMP_FAILED');
        }
      }

      if (plan.startExtra) {
        if (this.selection?.extra?.pm_id == null) {
          throw new T2OrchestratorError('EXTRA_PM_ID_MISSING');
        }
        const startResult = await this.guardedCall('startProcessByPmId', () =>
          this.commands.startProcessByPmId(this.selection.extra.pm_id),
        );
        if (!startResult || startResult.exitCode !== 0) {
          throw new T2OrchestratorError('START_ROLLBACK_NONZERO');
        }
      }

      // If no PM2 inverse mutations were needed, still require PRE_EQUIVALENT proof.
      const proof = await this._provePreEquivalent();
      if (!proof.ok) {
        await this._setState(State.FAIL_FORWARD_COMPLETE, proof.error);
        this._log('FAIL_FORWARD_COMPLETE', proof.error);
        throw new T2OrchestratorError(proof.error);
      }

      await this._setState(State.ROLLED_BACK, reason);
      this._log('ROLLED_BACK', reason, 'PRE_EQUIVALENT=YES');
    } catch (err) {
      if (TERMINAL_STATES.includes(this.state)) {
        throw err;
      }
      try {
        await this._setState(State.FAIL_FORWARD_COMPLETE, err.code || err.message);
      } catch {
        this.state = State.FAIL_FORWARD_COMPLETE;
        this.mutationClosed = true;
      }
      this._log('FAIL_FORWARD_COMPLETE', err.code || err.message);
      throw err;
    }
  }

  async _provePreEquivalent() {
    let dumpPack;
    try {
      dumpPack = await this.commands.readDump();
    } catch {
      return { ok: false, error: 'ROLLBACK_DUMP_UNREADABLE' };
    }
    const live = await this.commands.listLiveProcesses();
    const postDumpFp = semanticFingerprint(dumpPack.parsed);
    const postLiveFp = semanticFingerprint(live);

    // Collector live functional health during rollback proof
    try {
      const h5003 = await this.commands.healthCheck(5003);
      const func = await this.commands.collectorFunctionalCheck();
      if (h5003.statusCode !== 200 || func.accounts !== 200 || func.channels !== 200) {
        return { ok: false, error: 'ROLLBACK_COLLECTOR_HEALTH_FAIL' };
      }
    } catch {
      return { ok: false, error: 'ROLLBACK_COLLECTOR_HEALTH_FAIL' };
    }

    return assertPreEquivalent(
      this.preDumpFp,
      this.preLiveFp,
      postDumpFp,
      postLiveFp,
      {
        retainedPmId: this.selection?.retained?.pm_id,
        extraPmId: this.selection?.extra?.pm_id,
        expectedDumpSha: this.preDumpSha,
        actualDumpSha: dumpPack.sha256,
      },
    );
  }

  async runTransaction() {
    if (this._isTerminal()) {
      throw new T2OrchestratorError('REPLAY_BLOCKED');
    }
    await this.precheck();
    await this.backup();
    await this.stopExtra();
    await this.save();
    await this.postsaveVerify();
    await this.healthValidate();
    return this.complete();
  }
}

export function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function dumpToBytes(entries) {
  return Buffer.from(JSON.stringify(entries), 'utf8');
}

export { JournalError, createMemoryJournalFs, createExclusiveJournal, loadJournal };
