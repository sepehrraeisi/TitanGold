/**
 * Durable T2 retry orchestrator — state machine with journal + central mutation guard.
 * All PM2/system I/O goes through an injected command boundary.
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
  diffFingerprints,
  selectEngineRetainExtra,
  semanticFingerprint,
} from './semantics.mjs';

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
   * @param {import('./commandBoundary.mjs').T2CommandBoundary} [opts.commands]
   * @param {object} [opts.authorization]
   * @param {string} [opts.runId]
   * @param {string} [opts.backupRoot]
   * @param {string} [opts.journalRoot]
   * @param {import('./journal.mjs').JournalFs} [opts.journalFs]
   * @param {import('./journal.mjs').TransactionJournal} [opts.journal] existing journal (load path)
   * @param {boolean} [opts.productionModeAcknowledged]
   * @param {string} [opts.expectedToolVersion]
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
    this.expectedToolVersion = opts.expectedToolVersion || TOOL_VERSION;

    this.state = this.journal?.state || State.AUTHORIZED_UNCONSUMED;
    this.authConsumed = this.journal?.authConsumed === true;
    this.mutationClosed = this.journal?.mutationClosed === true;
    this.evidence = new SecretSafeEvidence();

    this.preDumpSha = null;
    this.postDumpSha = null;
    this.preDumpFp = null;
    this.liveFp = null;
    this.selection = null;
    this.backupPath = null;
    this.backupBytes = null;
    this.recordedExtraIdentity = null;
    this.runDir = this.journal?.runDir || null;
  }

  _log(...parts) {
    this.evidence.log(...parts);
  }

  _isTerminal() {
    return TERMINAL_STATES.includes(this.state) || this.mutationClosed === true;
  }

  /**
   * Central mutation guard — EVERY mutating boundary call must go through guardedCall.
   * @param {string} op
   */
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

  /**
   * @param {string} op
   * @param {() => Promise<any>} fn
   */
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
    // Terminal FAILED without further mutation (pre-auth or non-rollbackable).
    await this._setState(State.FAILED, code);
    throw new T2OrchestratorError(code, message || code);
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

  /**
   * Persist authorization consumption BEFORE first production mutation.
   */
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

  /**
   * Attach to existing journal — always fail closed for replay.
   */
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
    this.liveFp = semanticFingerprint(live);
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

    const dumpOnline = (this.preDumpFp.engines || []).filter((e) => e.status === 'online');
    if (dumpOnline.length !== 2) {
      return this._failClosed('DUMP_ENGINE_ONLINE_EXPECTED_2');
    }

    const precond = assertCollectorPersistencePreconditions(this.liveFp, this.preDumpFp);
    if (!precond.ok) {
      return this._failClosed(precond.error);
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
    // Auth must be durably persisted before any backup filesystem mutation.
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
    await this._setState(State.BACKUP_VERIFIED, 'backup_verified');
    this._log(
      'BACKUP_VERIFIED',
      `sha_prefix=${this.preDumpSha.slice(0, 12)}`,
      'mode=0600',
      'dir_mode=0700',
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
      await this.rollback(err.code || 'STALE_EXTRA_PROCESS');
      throw err;
    }

    const extraId = this.selection.extra.pm_id;
    const result = await this.guardedCall('stopProcessByPmId', () =>
      this.commands.stopProcessByPmId(extraId),
    );
    if (result.exitCode !== 0) {
      await this.rollback('STOP_EXTRA_FAILED');
      throw new T2OrchestratorError('STOP_EXTRA_FAILED');
    }

    const live = await this.commands.listLiveProcesses();
    const fp = semanticFingerprint(live);
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

    const result = await this.guardedCall('pm2Save', () => this.commands.pm2Save());
    if (result.exitCode !== 0) {
      await this.rollback('SAVE_EXIT_NONZERO');
      throw new T2OrchestratorError('SAVE_EXIT_NONZERO');
    }

    let dumpPack;
    try {
      dumpPack = await this.commands.readDump();
    } catch (err) {
      await this.rollback('DUMP_UNPARSEABLE');
      throw new T2OrchestratorError('DUMP_UNPARSEABLE', err.message);
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

    const col = (postFp.collectors || [])[0] || {};
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
    return { kinds: [...kinds] };
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
   * Rollback: nonterminal → ROLLBACK_RUNNING → guarded mutations → ROLLED_BACK.
   * Never mutates after FAILED/COMPLETED/ROLLED_BACK/FAIL_FORWARD_COMPLETE.
   */
  async rollback(reason) {
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

    try {
      if (this.backupBytes) {
        await this.guardedCall('restoreDump', () => this.commands.restoreDump(this.backupBytes));
      } else if (this.backupPath) {
        throw new T2OrchestratorError('BACKUP_BYTES_MISSING');
      }
      if (this.selection?.extra?.pm_id != null) {
        await this.guardedCall('startProcessByPmId', () =>
          this.commands.startProcessByPmId(this.selection.extra.pm_id),
        );
      }
      await this._setState(State.ROLLED_BACK, reason);
      this._log('ROLLED_BACK', reason);
    } catch (err) {
      // Still in ROLLBACK_RUNNING / non-terminal until we mark fail-forward
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
