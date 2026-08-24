/**
 * Durable T2 retry orchestrator — state machine only.
 * All PM2/system I/O goes through an injected command boundary.
 * This module never imports child_process or talks to live PM2 by default.
 */

import crypto from 'crypto';
import path from 'path';
import {
  AUTHORIZED_EFFECTS,
  AUTHORIZED_TRANSACTION,
  COLLECTOR_DB_KEYS,
  ENGINE_NAME,
  State,
  TERMINAL_STATES,
  TOOL_VERSION,
} from './constants.mjs';
import { createFailClosedBoundary } from './commandBoundary.mjs';
import { SecretSafeEvidence } from './evidence.mjs';
import {
  assertCollectorPersistencePreconditions,
  diffFingerprints,
  selectEngineRetainExtra,
  semanticFingerprint,
} from './semantics.mjs';

export class T2OrchestratorError extends Error {
  /**
   * @param {string} code
   * @param {string} [message]
   */
  constructor(code, message) {
    super(message || code);
    this.name = 'T2OrchestratorError';
    this.code = code;
  }
}

/**
 * @param {object} opts
 * @param {import('./commandBoundary.mjs').T2CommandBoundary} [opts.commands]
 * @param {object} [opts.authorization]
 * @param {string} [opts.runId]
 * @param {string} [opts.backupRoot]
 * @param {boolean} [opts.productionModeAcknowledged]
 * @param {string} [opts.expectedToolVersion]
 */
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
    this.productionModeAcknowledged = opts.productionModeAcknowledged === true;
    this.expectedToolVersion = opts.expectedToolVersion || TOOL_VERSION;

    this.state = State.AUTHORIZED_UNCONSUMED;
    this.authConsumed = false;
    this.mutationClosed = false;
    this.executedOnce = false;
    this.evidence = new SecretSafeEvidence();

    this.preDumpSha = null;
    this.postDumpSha = null;
    this.preDumpFp = null;
    this.liveFp = null;
    this.selection = null;
    this.backupPath = null;
    this.backupBytes = null;
    this.recordedExtraIdentity = null;
  }

  _log(...parts) {
    this.evidence.log(...parts);
  }

  _isTerminal() {
    return TERMINAL_STATES.includes(this.state);
  }

  /**
   * Central mutation guard — every mutating action must call this.
   * @param {string} op
   */
  requireMutationOpen(op) {
    if (this.mutationClosed || this._isTerminal()) {
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
  }

  _requireState(allowed) {
    if (!allowed.includes(this.state)) {
      throw new T2OrchestratorError(
        'STATE_BLOCKED',
        `STATE_BLOCKED current=${this.state} allowed=${allowed.join(',')}`,
      );
    }
  }

  _fail(code, message) {
    this.state = State.FAILED;
    this.mutationClosed = true;
    this._log('FAILED', code);
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
   * Consume authorization immediately before first production mutation.
   */
  consumeAuthorization() {
    this._requireState([State.AUTHORIZED_UNCONSUMED, State.PRECHECK_PASS]);
    if (this.authConsumed) {
      throw new T2OrchestratorError('AUTH_ALREADY_CONSUMED');
    }
    this.validateAuthorizationArtifact();
    this.authConsumed = true;
    if (this.authorization && typeof this.authorization === 'object') {
      this.authorization.consumed = true;
    }
    this._log('AUTHORIZATION_CONSUMED=YES', `runId=${this.runId}`);
  }

  async precheck() {
    if (this.executedOnce || this._isTerminal()) {
      throw new T2OrchestratorError('REPLAY_BLOCKED');
    }
    this._requireState([State.AUTHORIZED_UNCONSUMED]);
    this.state = State.PRECHECK_RUNNING;

    // Auth artifact must exist before precheck completes; consumption waits until first mutation.
    if (!this.authorization) {
      return this._fail('AUTH_ARTIFACT_MISSING');
    }
    if (!this.runId) {
      return this._fail('RUN_ID_MISSING');
    }
    if (this.expectedToolVersion !== TOOL_VERSION) {
      return this._fail('TOOL_VERSION_MISMATCH');
    }

    const live = await this.commands.listLiveProcesses();
    const dumpPack = await this.commands.readDump();
    this.liveFp = semanticFingerprint(live);
    this.preDumpFp = semanticFingerprint(dumpPack.parsed);
    this.preDumpSha = dumpPack.sha256;

    const selection = selectEngineRetainExtra(this.liveFp);
    if (!selection.ok) {
      return this._fail(selection.error);
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
      return this._fail('DUMP_ENGINE_ONLINE_EXPECTED_2');
    }

    const precond = assertCollectorPersistencePreconditions(this.liveFp, this.preDumpFp);
    if (!precond.ok) {
      return this._fail(precond.error);
    }

    this.state = State.PRECHECK_PASS;
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
      this.consumeAuthorization();
    }
    this.requireMutationOpen('backup');

    if (!this.backupRoot) {
      throw new T2OrchestratorError('BACKUP_ROOT_MISSING');
    }
    const runDir = path.join(this.backupRoot, `TITANGOLD_PM2_ENGINE_RECON_${this.runId}`);
    await this.commands.ensureDir(runDir, 0o700);
    this.backupPath = path.join(runDir, 'dump.pm2.pre');

    const dumpPack = await this.commands.readDump();
    if (dumpPack.sha256 !== this.preDumpSha) {
      return this._fail('BACKUP_SHA_DRIFT');
    }
    const written = await this.commands.writeBackup(dumpPack.bytes, this.backupPath);
    await this.commands.chmod(this.backupPath, 0o600);
    if (written.sha256 !== this.preDumpSha) {
      return this._fail('BACKUP_WRITE_SHA_MISMATCH');
    }
    this.backupBytes = dumpPack.bytes;
    this.state = State.BACKUP_VERIFIED;
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
    this.requireMutationOpen('stop_extra');
    this._requireState([State.BACKUP_VERIFIED]);
    this.state = State.MUTATION_RUNNING;

    try {
      await this._revalidateExtraIdentity();
    } catch (err) {
      await this.rollback('STALE_EXTRA_PROCESS');
      throw err;
    }

    const extraId = this.selection.extra.pm_id;
    const result = await this.commands.stopProcessByPmId(extraId);
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

    this.state = State.ENGINE_SINGLETON_VERIFIED;
    this._log('ENGINE_SINGLETON_VERIFIED', `online=1 retained_pm_id=${retained.pm_id}`);
    return true;
  }

  async save() {
    this.requireMutationOpen('save');
    this._requireState([State.ENGINE_SINGLETON_VERIFIED]);
    this.state = State.SAVE_RUNNING;

    const result = await this.commands.pm2Save();
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

    // Changed dump SHA after successful parseable save is EXPECTED — never classify as S2 alone.
    this.postDumpSha = dumpPack.sha256;
    if (this.postDumpSha !== this.preDumpSha) {
      this._log('POST_SAVE_SHA_CHANGED=EXPECTED');
    } else {
      this._log('POST_SAVE_SHA_UNCHANGED=UNEXPECTED_BUT_NOT_ALONE_FATAL');
    }

    this.state = State.SAVE_SUCCESS;
    this._log('SAVE_SUCCESS', `post_sha_prefix=${this.postDumpSha.slice(0, 12)}`);
    return { postDumpSha: this.postDumpSha };
  }

  async postsaveVerify() {
    this._requireState([State.SAVE_SUCCESS]);
    // verification is not a mutation, but must not run after terminal rollback paths
    if (this.mutationClosed && this.state !== State.SAVE_SUCCESS) {
      throw new T2OrchestratorError('MUTATION_CLOSED');
    }

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

    // secret-safe collector report — presence bits only (no values, no KEY=value secrets)
    const col = (postFp.collectors || [])[0] || {};
    const presenceBits = COLLECTOR_DB_KEYS.map((k) => (col.db_keys_present?.[k] ? '1' : '0')).join('');
    this._log(
      'COLLECTOR_DB_PERSIST_PRESENT',
      `keys_order=${COLLECTOR_DB_KEYS.join(',')}`,
      `presence_bits=${presenceBits}`,
      `DB_USER_EXPECTED=${col.db_user_matches_expected ? 'YES' : 'NO'}`,
    );

    this.state = State.POSTSAVE_VERIFIED;
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

  complete() {
    this._requireState([State.POSTSAVE_VERIFIED]);
    this.state = State.COMPLETED;
    this.mutationClosed = true;
    this.executedOnce = true;
    this._log('COMPLETED', 'mutation_capability=CLOSED');
    return State.COMPLETED;
  }

  /**
   * Rollback to PRE-equivalent dump + restart extra engine if needed.
   * Production behavior — only invoked from failure paths or tests with fake boundary.
   */
  async rollback(reason) {
    this._log('ROLLBACK_BEGIN', reason);
    // Rollback mutations are permitted only while not yet permanently closed as COMPLETED.
    // Once COMPLETED, rollback is forbidden.
    if (this.state === State.COMPLETED) {
      throw new T2OrchestratorError('MUTATION_CLOSED');
    }
    // Allow rollback while failing mid-transaction even if mutationClosed was set by _fail race
    const priorClosed = this.mutationClosed;
    this.mutationClosed = false;

    try {
      if (this.backupBytes) {
        await this.commands.restoreDump(this.backupBytes);
      } else if (this.backupPath) {
        // boundary may re-read from path via restoreDump expecting bytes; tests supply bytes
        throw new T2OrchestratorError('BACKUP_BYTES_MISSING');
      }
      if (this.selection?.extra?.pm_id != null) {
        await this.commands.startProcessByPmId(this.selection.extra.pm_id);
      }
      this.state = State.ROLLED_BACK;
      this.mutationClosed = true;
      this._log('ROLLED_BACK', reason);
    } catch (err) {
      this.state = State.FAIL_FORWARD_COMPLETE;
      this.mutationClosed = true;
      this._log('FAIL_FORWARD_COMPLETE', err.code || err.message);
      throw err;
    } finally {
      if (this.state === State.ROLLED_BACK || this.state === State.FAIL_FORWARD_COMPLETE) {
        this.mutationClosed = true;
      } else if (priorClosed) {
        this.mutationClosed = true;
      }
    }
  }

  /**
   * Full happy-path transaction (still requires injected boundary + auth).
   */
  async runTransaction() {
    if (this.executedOnce || this._isTerminal()) {
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
