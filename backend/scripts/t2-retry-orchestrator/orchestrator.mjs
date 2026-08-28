/**
 * Durable T2 retry orchestrator — state machine with journal + central mutation guard.
 * TOOL_VERSION 1.6.2 — LIVE/DUMP split comparators + exact-byte rollback short-circuit (no global pm2 save).
 * Side-effect-aware rollback; PRE_EQUIVALENT required for ROLLED_BACK.
 */

import crypto from 'crypto';
import path from 'path';
import {
  AUTHORIZED_EFFECTS,
  AUTHORIZED_TRANSACTION,
  COLLECTOR_DB_KEYS,
  REQUIRED_PROJECTED_DUMP_MODE,
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
  assertFleetPm2SemanticModelComplete,
} from './pm2SemanticModel.mjs';
import {
  assertExactDumpPhysicalPreEquivalent,
  assertExpectedLivePostState,
  assertCollectorPersistencePreconditions,
  assertEntriesEnvShapes,
  assertLiveFleetPmIdIntegrity,
  assertPreEquivalent,
  captureCollectorDbLiveValues,
  compareCollectorDbLiveToPersist,
  selectEngineRetainExtra,
  semanticFingerprint,
} from './semantics.mjs';
import {
  assertUnauthorizedLiveEnvNotPersisted,
  buildExpectedProjectedDump,
  resolveDumpCollectorIdentity,
  resolveDumpEngineIdentities,
} from './projection.mjs';
import { assertSanitizedPreBaselineProof } from './sanitizedBaseline.mjs';
import {
  APPLY_STATE,
  createSideEffectLedger,
  planRollbackActions,
  setRollbackApplyState,
} from './sideEffectLedger.mjs';
import {
  toRollbackHealthError,
  validateRequiredHealth,
} from './requiredHealth.mjs';

const FORWARD_MUTATING_OPS = Object.freeze([
  'ensureDir',
  'writeBackup',
  'chmod',
  'stopProcessByPmId',
  'writeProjectedActiveDump',
]);

function deepCloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

function deepJsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

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
    this.preDumpMode = null;
    this.preDumpUid = null;
    this.preDumpGid = null;
    this.preDumpParsed = null;
    this.postDumpMode = null;
    this.postDumpSha = null;
    this.preDumpFp = null;
    this.preLiveFp = null;
    this.liveFp = null;
    this.selection = null;
    this.dumpEngineMap = null;
    this.dumpCollectorMap = null;
    this.expectedProjected = null;
    this.backupPath = null;
    this.backupBytes = null;
    this.recordedExtraIdentity = null;
    this.recordedRetainedIdentity = null;
    this.liveCollectorDb = null;
    this.cleanPreDump = Array.isArray(opts.cleanPreDump) ? opts.cleanPreDump : null;
    this.expectedCleanPreSha = opts.expectedCleanPreSha || null;
    this.actualCleanPreSha = opts.actualCleanPreSha || null;
    this.expectedActiveDumpSha = opts.expectedActiveDumpSha || null;
    this.runDir = this.journal?.runDir || null;
    this.lastRollbackPlan = null;
    this.dumpOwnershipSafe = false;
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
    if (op === 'pm2Save') {
      throw new T2OrchestratorError('GLOBAL_PM2_SAVE_FORBIDDEN', 'GLOBAL_PM2_SAVE_FORBIDDEN');
    }
    if (op === 'hardenActiveDumpMode') {
      throw new T2OrchestratorError('HARDEN_FORBIDDEN_IN_V15', 'HARDEN_FORBIDDEN_IN_V15');
    }
    if (op === 'restoreDump' || op === 'startProcessByPmId') {
      throw new T2OrchestratorError(
        'RESTORE_OR_START_REQUIRES_ROLLBACK_STATE',
        `op=${op} state=${this.state}`,
      );
    }
    if (!FORWARD_MUTATING_OPS.includes(op)) {
      throw new T2OrchestratorError(
        'FORWARD_OP_NOT_ALLOWED',
        `FORWARD_OP_NOT_ALLOWED op=${op} state=${this.state}`,
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
      `PROJECTED_DUMP_WRITE_ATTEMPTED=${this.sideEffects.PROJECTED_DUMP_WRITE_ATTEMPTED ? 'YES' : 'NO'}`,
      `PROJECTED_DUMP_WRITE_APPLIED=${this.sideEffects.PROJECTED_DUMP_WRITE_APPLIED ? 'YES' : 'NO'}`,
      `SAVE_ATTEMPTED=${this.sideEffects.SAVE_ATTEMPTED ? 'YES' : 'NO'}`,
      `DUMP_SAVE_APPLIED=${this.sideEffects.DUMP_SAVE_APPLIED ? 'YES' : 'NO'}`,
      `DUMP_MODE_HARDEN_ATTEMPTED=${this.sideEffects.DUMP_MODE_HARDEN_ATTEMPTED ? 'YES' : 'NO'}`,
      `DUMP_MODE_HARDEN_APPLIED=${this.sideEffects.DUMP_MODE_HARDEN_APPLIED ? 'YES' : 'NO'}`,
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
    const uniqueEffects = new Set(effects);
    if (
      effects.length !== AUTHORIZED_EFFECTS.length ||
      uniqueEffects.size !== AUTHORIZED_EFFECTS.length ||
      AUTHORIZED_EFFECTS.some((required) => !uniqueEffects.has(required))
    ) {
      throw new T2OrchestratorError('AUTH_EFFECTS_NOT_EXACT');
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

    const pmIdIntegrity = assertLiveFleetPmIdIntegrity(live);
    this._log(`LIVE_FLEET_PM_ID_PRESENT=${pmIdIntegrity.LIVE_FLEET_PM_ID_PRESENT}`);
    this._log(`LIVE_FLEET_PM_ID_NUMERIC=${pmIdIntegrity.LIVE_FLEET_PM_ID_NUMERIC}`);
    this._log(`LIVE_FLEET_PM_ID_GLOBAL_UNIQUE=${pmIdIntegrity.LIVE_FLEET_PM_ID_GLOBAL_UNIQUE}`);
    this._log('PM_ID_USED_FOR_LIVE_PRE_POST_IDENTITY=YES');
    if (!pmIdIntegrity.ok) {
      return this._failClosed('LIVE_FLEET_PM_ID_INTEGRITY_FAIL');
    }

    const fleetClass = assertFleetPm2SemanticModelComplete(live, dumpPack.parsed);
    if (!fleetClass.ok) {
      if (fleetClass.unclassifiedByScope) {
        for (const entry of fleetClass.unclassifiedByScope) {
          this._log('FLEET_UNCLASSIFIED', entry.scope, `fields=${entry.fields.join(',')}`);
        }
      }
      return this._failClosed('FLEET_PM2_FIELD_CLASSIFICATION_INCOMPLETE');
    }
    this._log('LIVE_FLEET_PM2_FIELD_CLASSIFICATION_COMPLETE=PASS');
    this._log('DUMP_FLEET_PM2_FIELD_CLASSIFICATION_COMPLETE=PASS');
    this._log(`DUMP_APP_ENV_PROVENANCE_SCOPE=${fleetClass.DUMP_APP_ENV_PROVENANCE_SCOPE}`);
    this._log(`FLEET_GLOBAL_ENV_PROVENANCE=${fleetClass.FLEET_GLOBAL_ENV_PROVENANCE}`);

    this.liveFp = semanticFingerprint(live, { source: 'LIVE' });
    this.preLiveFp = this.liveFp;
    this.preDumpFp = semanticFingerprint(dumpPack.parsed, { source: 'DUMP' });

    this.preDumpSha = dumpPack.sha256;
    if (typeof dumpPack.mode !== 'number' || !Number.isFinite(dumpPack.mode)) {
      return this._failClosed('PRE_DUMP_MODE_MISSING');
    }
    this.preDumpMode = dumpPack.mode & 0o777;
    this._log('PRE_DUMP_MODE', `mode=${this.preDumpMode}`);

    this.preDumpUid = typeof dumpPack.uid === 'number' ? dumpPack.uid : null;
    this.preDumpGid = typeof dumpPack.gid === 'number' ? dumpPack.gid : null;
    this.preDumpParsed = deepCloneJson(dumpPack.parsed);
    if (this.preDumpUid != null) {
      this._log('PRE_DUMP_OWNER=PRESENT');
    }
    if (this.preDumpGid != null) {
      this._log('PRE_DUMP_GROUP=PRESENT');
    }

    if (!this.expectedActiveDumpSha) {
      return this._failClosed('EXPECTED_ACTIVE_DUMP_SHA_REQUIRED');
    }
    if (this.preDumpSha !== this.expectedActiveDumpSha) {
      return this._failClosed('ACTIVE_DUMP_SHA_MISMATCH');
    }

    if (typeof this.commands.inspectActiveDumpWriteSafety === 'function') {
      const ownership = await this.commands.inspectActiveDumpWriteSafety();
      this.dumpOwnershipSafe =
        ownership?.safe === true &&
        ownership?.ownerSafe === true &&
        ownership?.groupSafe === true;
      if (typeof ownership?.dumpUid === 'number') this.preDumpUid = ownership.dumpUid;
      if (typeof ownership?.dumpGid === 'number') this.preDumpGid = ownership.dumpGid;
      if (!this.dumpOwnershipSafe) {
        return this._failClosed('DUMP_OWNERSHIP_PRESERVATION_UNSAFE');
      }
      this._log('DUMP_OWNER_GROUP_PRECHECK=PASS');
    }

    const selection = selectEngineRetainExtra(this.liveFp);
    if (!selection.ok) {
      return this._failClosed(selection.error);
    }
    this.selection = selection;
    if (selection.evidence && typeof selection.evidence === 'object') {
      for (const [k, v] of Object.entries(selection.evidence)) {
        this._log(`${k}=${v}`);
      }
    }
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

    // Resolve dump identities BEFORE auth consume (still in precheck)
    const engineMap = resolveDumpEngineIdentities(dumpPack.parsed, selection);
    if (!engineMap.ok) {
      return this._failClosed(engineMap.error || 'DUMP_ENGINE_IDENTITY_UNRESOLVED');
    }
    this.dumpEngineMap = engineMap;
    this._log(`DUMP_ENGINE_MAPPING_MODE=${engineMap.mappingMode || 'UNKNOWN'}`);
    this._log(`PERSISTED_SLOT_IDENTITY_CLAIM=${engineMap.PERSISTED_SLOT_IDENTITY_CLAIM || 'UNKNOWN'}`);
    if (engineMap.DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE) {
      this._log(
        `DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE=${engineMap.DUMP_ENGINE_RESURRECT_SEMANTIC_EQUIVALENCE}`,
      );
    }
    this._log('PM_ID_USED_AS_PERSISTED_IDENTITY=NO');

    const collectorMap = resolveDumpCollectorIdentity(dumpPack.parsed);
    if (!collectorMap.ok) {
      return this._failClosed(collectorMap.error || 'DUMP_COLLECTOR_IDENTITY_UNRESOLVED');
    }
    this.dumpCollectorMap = collectorMap;

    const precond = assertCollectorPersistencePreconditions(this.liveFp, this.preDumpFp);
    if (!precond.ok) {
      return this._failClosed(precond.error);
    }
    if (precond.matches) {
      for (const [k, v] of Object.entries(precond.matches)) {
        this._log(`${k}=${v}`);
      }
    }
    this._log(`COLLECTOR_DB_PRESTATE=${precond.state || 'ALREADY_PRESENT_EXACT'}`);

    this.liveCollectorDb = captureCollectorDbLiveValues(this.liveFp);
    if (!this.liveCollectorDb) {
      return this._failClosed('LIVE_COLLECTOR_DB_CAPTURE_FAILED');
    }

    // Sanitized PRE baseline gate — fail before auth consume
    if (!this.cleanPreDump || !this.expectedCleanPreSha || !this.actualCleanPreSha) {
      return this._failClosed('CLEAN_PRE_BASELINE_REQUIRED');
    }
    const sanitized = assertSanitizedPreBaselineProof({
      cleanPreDump: this.cleanPreDump,
      activePreDump: dumpPack.parsed,
      expectedCleanPreSha: this.expectedCleanPreSha,
      actualCleanPreSha: this.actualCleanPreSha,
      expectedActiveDumpSha: this.expectedActiveDumpSha,
      actualActiveDumpSha: this.preDumpSha,
    });
    if (!sanitized.ok) {
      return this._failClosed(sanitized.error || 'SANITIZED_PRE_BASELINE_PROOF_FAIL');
    }
    for (const [k, v] of Object.entries(sanitized)) {
      if (k === 'ok') continue;
      this._log(`${k}=${v}`);
    }

    // Successful sanitization contract requires PRE mode 0600 (content alone is insufficient).
    if (this.preDumpMode !== REQUIRED_PROJECTED_DUMP_MODE) {
      return this._failClosed('SANITIZED_PRE_MODE_NOT_0600');
    }
    this._log('SANITIZED_PRE_MODE_0600=PASS');

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
      'collector_dump_db=ALREADY_PRESENT_EXACT',
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
    const fp = semanticFingerprint(live, { source: 'LIVE' });
    const reselect = selectEngineRetainExtra(fp);
    if (!reselect.ok) {
      throw new T2OrchestratorError(reselect.error || 'STALE_EXTRA_PROCESS');
    }
    if (
      reselect.retained.pm_id !== this.selection.retained.pm_id ||
      reselect.extra.pm_id !== this.selection.extra.pm_id
    ) {
      throw new T2OrchestratorError('STALE_EXTRA_PROCESS');
    }
    if (
      this.selection.liveEnginePairMode === 'SYMMETRIC_RUNTIME_EQUIVALENT' &&
      reselect.liveEnginePairMode !== 'SYMMETRIC_RUNTIME_EQUIVALENT'
    ) {
      throw new T2OrchestratorError('STALE_EXTRA_PROCESS');
    }
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
    const fp = semanticFingerprint(live, { source: 'LIVE' });
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

  /**
   * Build expected projected dump from PRE dump + authorized live DB_* only.
   * No pm2 save. No live God-env merge.
   */
  async buildProjection() {
    this._requireState([State.ENGINE_SINGLETON_VERIFIED]);
    await this._setState(State.PROJECTION_BUILDING, 'projection_build_begin');

    const live = await this.commands.listLiveProcesses();
    const liveFp = semanticFingerprint(live, { source: 'LIVE' });
    const freshDb = captureCollectorDbLiveValues(liveFp);
    if (!freshDb) {
      await this.rollback('LIVE_COLLECTOR_DB_REVALIDATE_FAIL');
      throw new T2OrchestratorError('LIVE_COLLECTOR_DB_REVALIDATE_FAIL');
    }
    if (!this.liveCollectorDb) {
      await this.rollback('LIVE_COLLECTOR_DB_CAPTURE_FAILED');
      throw new T2OrchestratorError('LIVE_COLLECTOR_DB_CAPTURE_FAILED');
    }

    let drift = false;
    for (const key of COLLECTOR_DB_KEYS) {
      const stable = freshDb[key] === this.liveCollectorDb[key];
      this._log(`${key}_STABLE=${stable ? 'YES' : 'NO'}`);
      if (!stable) drift = true;
    }
    if (drift) {
      await this.rollback('COLLECTOR_DB_LIVE_DRIFT');
      throw new T2OrchestratorError('COLLECTOR_DB_LIVE_DRIFT');
    }

    const result = buildExpectedProjectedDump({
      preDump: this.preDumpParsed,
      selection: this.selection,
      collectorDbSnapshot: this.liveCollectorDb,
    });
    if (!result.ok) {
      await this.rollback(result.error || 'PROJECTION_BUILD_FAILED');
      throw new T2OrchestratorError(result.error || 'PROJECTION_BUILD_FAILED');
    }

    const liveCol = (liveFp.collectors || [])[0];
    const liveCollectorEnvKeys = Array.isArray(liveCol?.env_keys) ? liveCol.env_keys : [];
    const unauthorized = assertUnauthorizedLiveEnvNotPersisted({
      preDump: this.preDumpParsed,
      projected: result.projected,
      collectorDumpIndex: result.collectorMap.dumpIndex,
      liveCollectorEnvKeys,
    });
    if (!unauthorized.ok) {
      await this.rollback(unauthorized.error || 'UNAUTHORIZED_LIVE_ENV_PERSISTED');
      throw new T2OrchestratorError(unauthorized.error || 'UNAUTHORIZED_LIVE_ENV_PERSISTED');
    }

    this.expectedProjected = result;
    if (result.manifest && typeof result.manifest === 'object') {
      for (const [k, v] of Object.entries(result.manifest)) {
        this._log(`${k}=${v}`);
      }
    }

    await this._setState(State.PROJECTION_READY, 'projection_ready');
    this._log('PROJECTION_READY');
    return result;
  }

  /**
   * Atomically write projected dump bytes to active dump path (mode 0600).
   * Never calls pm2 save or hardenActiveDumpMode.
   */
  async writeProjectedDump() {
    this._requireState([State.PROJECTION_READY]);
    await this._setState(State.PROJECTION_WRITE_RUNNING, 'projection_write_begin');

    if (!this.expectedProjected?.bytes) {
      await this.rollback('PROJECTION_BYTES_MISSING');
      throw new T2OrchestratorError('PROJECTION_BYTES_MISSING');
    }

    const expectedSha256 = sha256Buffer(this.expectedProjected.bytes);

    this.sideEffects.PROJECTED_DUMP_WRITE_ATTEMPTED = true;
    await this._persistSideEffects();
    this._log('PROJECTED_DUMP_WRITE_ATTEMPTED=YES');

    try {
      await this.guardedCall('writeProjectedActiveDump', () =>
        this.commands.writeProjectedActiveDump(this.expectedProjected.bytes, {
          expectedUid: this.preDumpUid != null ? this.preDumpUid : undefined,
          expectedGid: this.preDumpGid != null ? this.preDumpGid : undefined,
          expectedSha256,
        }),
      );
    } catch (err) {
      if (err instanceof T2OrchestratorError && TERMINAL_STATES.includes(this.state)) {
        throw err;
      }
      const resolution = await this.resolveUnknownProjectedWriteState();
      await this.rollback('PROJECTED_DUMP_STATE_UNKNOWN', {
        dumpStateUnknown: true,
        dumpRestoreRequired: resolution.restoreRequired,
        dumpRestoreDecision: resolution.decision,
      });
      throw new T2OrchestratorError(resolution.errorCode || 'PROJECTED_DUMP_STATE_UNKNOWN');
    }

    let dumpPack;
    try {
      dumpPack = await this.commands.readDump();
    } catch {
      const resolution = await this.resolveUnknownProjectedWriteState();
      await this.rollback('PROJECTED_DUMP_STATE_UNKNOWN', {
        dumpStateUnknown: true,
        dumpRestoreRequired: resolution.restoreRequired,
        dumpRestoreDecision: resolution.decision,
      });
      throw new T2OrchestratorError(resolution.errorCode || 'PROJECTED_DUMP_STATE_UNKNOWN');
    }

    const mode = typeof dumpPack.mode === 'number' ? dumpPack.mode & 0o777 : null;
    const shaOk = dumpPack.sha256 === expectedSha256;
    const modeOk = mode === REQUIRED_PROJECTED_DUMP_MODE;
    const contentOk = deepJsonEqual(dumpPack.parsed, this.expectedProjected.projected);

    if (!shaOk || !modeOk || !contentOk) {
      const resolution = await this.resolveUnknownProjectedWriteState();
      await this.rollback('PROJECTED_DUMP_POSTWRITE_MISMATCH', {
        dumpStateUnknown: true,
        dumpRestoreRequired: resolution.restoreRequired,
        dumpRestoreDecision: resolution.decision,
      });
      throw new T2OrchestratorError('PROJECTED_DUMP_POSTWRITE_MISMATCH');
    }

    this.sideEffects.PROJECTED_DUMP_WRITE_APPLIED = true;
    await this._persistSideEffects();
    this.postDumpSha = dumpPack.sha256;
    this.postDumpMode = mode;
    this._log('PROJECTED_DUMP_WRITE_APPLIED=YES', 'mode=0600');

    await this._setState(State.PROJECTION_WRITTEN, 'projection_written');
    this._log('PROJECTION_WRITTEN', `post_sha_prefix=${this.postDumpSha.slice(0, 12)}`);
    return { postDumpSha: this.postDumpSha, mode };
  }

  async postwriteVerify() {
    this._requireState([State.PROJECTION_WRITTEN]);

    const liveNow = await this.commands.listLiveProcesses();
    const liveFpNow = semanticFingerprint(liveNow, { source: 'LIVE' });
    const dumpPack = await this.commands.readDump();
    const postMode = typeof dumpPack.mode === 'number' ? dumpPack.mode & 0o777 : null;
    if (postMode !== REQUIRED_PROJECTED_DUMP_MODE) {
      await this.rollback('POSTWRITE_DUMP_MODE_NOT_0600');
      throw new T2OrchestratorError('POSTWRITE_DUMP_MODE_NOT_0600');
    }
    if (!this.expectedProjected?.projected) {
      await this.rollback('PROJECTION_EXPECTED_MISSING');
      throw new T2OrchestratorError('PROJECTION_EXPECTED_MISSING');
    }
    if (!deepJsonEqual(dumpPack.parsed, this.expectedProjected.projected)) {
      await this.rollback('POSTWRITE_DUMP_CONTENT_MISMATCH');
      throw new T2OrchestratorError('POSTWRITE_DUMP_CONTENT_MISMATCH');
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
      throw new T2OrchestratorError('POSTWRITE_OWNER_MISMATCH');
    }
    if (!groupPreserved) {
      await this.rollback('POSTWRITE_GROUP_MISMATCH');
      throw new T2OrchestratorError('POSTWRITE_GROUP_MISMATCH');
    }

    const liveDbNow = captureCollectorDbLiveValues(liveFpNow);
    if (!liveDbNow) {
      await this.rollback('LIVE_COLLECTOR_DB_REVALIDATE_FAIL');
      throw new T2OrchestratorError('LIVE_COLLECTOR_DB_REVALIDATE_FAIL');
    }

    const postFp = semanticFingerprint(dumpPack.parsed, { source: 'DUMP' });
    const postCol = (postFp.collectors || [])[0];
    const liveProc = { env_keys: [...COLLECTOR_DB_KEYS] };
    Object.defineProperty(liveProc, '_envValues', {
      value: liveDbNow,
      enumerable: false,
      writable: false,
      configurable: false,
    });
    const match = compareCollectorDbLiveToPersist(liveProc, postCol);
    for (const [k, v] of Object.entries(match.matches)) {
      this._log(`${k}=${v}`);
    }
    if (!match.ok) {
      await this.rollback(match.error || 'COLLECTOR_DB_LIVE_PERSIST_MISMATCH');
      throw new T2OrchestratorError(match.error || 'COLLECTOR_DB_LIVE_PERSIST_MISMATCH');
    }

    const liveCol = (liveFpNow.collectors || [])[0];
    const liveCollectorEnvKeys = Array.isArray(liveCol?.env_keys) ? liveCol.env_keys : [];
    const collectorDumpIndex =
      this.expectedProjected.collectorMap?.dumpIndex ?? this.dumpCollectorMap?.dumpIndex;
    const unauthorized = assertUnauthorizedLiveEnvNotPersisted({
      preDump: this.preDumpParsed,
      projected: dumpPack.parsed,
      collectorDumpIndex,
      liveCollectorEnvKeys,
    });
    if (!unauthorized.ok) {
      await this.rollback(unauthorized.error || 'UNAUTHORIZED_LIVE_ENV_PERSISTED');
      throw new T2OrchestratorError(unauthorized.error || 'UNAUTHORIZED_LIVE_ENV_PERSISTED');
    }
    this._log(`JWT_SECRET_LIVE_DRIFT_NOT_PERSISTED=${unauthorized.JWT_SECRET_LIVE_DRIFT_NOT_PERSISTED}`);
    this._log(`LIVE_ONLY_CURSOR_ENV_NOT_PERSISTED=${unauthorized.LIVE_ONLY_CURSOR_ENV_NOT_PERSISTED}`);
    this._log(
      `LIVE_ONLY_PM2_METADATA_NOT_PERSISTED=${unauthorized.LIVE_ONLY_PM2_METADATA_NOT_PERSISTED}`,
    );
    this._log(`UNAUTHORIZED_LIVE_ENV_NOT_PERSISTED=${unauthorized.UNAUTHORIZED_LIVE_ENV_NOT_PERSISTED}`);

    const mapMode =
      this.dumpEngineMap?.mappingMode ||
      this.expectedProjected?.engineMap?.mappingMode ||
      'UNKNOWN';
    this._log(`DUMP_ENGINE_MAPPING_MODE=${mapMode}`);
    this._log(
      `PERSISTED_SLOT_IDENTITY_CLAIM=${
        this.dumpEngineMap?.PERSISTED_SLOT_IDENTITY_CLAIM ||
        this.expectedProjected?.engineMap?.PERSISTED_SLOT_IDENTITY_CLAIM ||
        'UNKNOWN'
      }`,
    );
    if (mapMode === 'SYMMETRIC_EQUIVALENT_SLOTS') {
      const engIdx = [
        this.dumpEngineMap.retainedDumpIndex,
        this.dumpEngineMap.extraDumpIndex,
      ];
      const statuses = engIdx.map((i) => String(dumpPack.parsed[i]?.status)).sort();
      if (statuses[0] !== 'online' || statuses[1] !== 'stopped') {
        await this.rollback('SYMMETRIC_DUMP_STATUS_PAIR_FAIL');
        throw new T2OrchestratorError('SYMMETRIC_DUMP_STATUS_PAIR_FAIL');
      }
      this._log('PERSISTED_SLOT_IDENTITY_CLAIM=NONE');
      this._log('PM_ID_USED_AS_PERSISTED_IDENTITY=NO');
      this._log('SYMMETRIC_DUMP_ONE_ONLINE_ONE_STOPPED=PASS');
    }

    const liveProof = assertExpectedLivePostState(
      this.preLiveFp,
      liveFpNow,
      this.selection,
      this.liveCollectorDb,
    );
    if (!liveProof.ok) {
      await this.rollback(liveProof.error || 'LIVE_POST_STATE_UNEXPECTED_DRIFT');
      throw new T2OrchestratorError(liveProof.error || 'LIVE_POST_STATE_UNEXPECTED_DRIFT');
    }
    for (const [k, v] of Object.entries(liveProof.details || {})) {
      this._log(`${k}=${v}`);
    }
    this._log('UNRELATED_LIVE_DUMP_DRIFT_PRESERVED_NOT_PERSISTED=YES');

    await this._setState(State.POSTWRITE_VERIFIED, 'postwrite_verified');
    this._log('POSTWRITE_VERIFIED');
    return { dbMatches: match.matches };
  }

  /**
   * Fetch live health surfaces and validate via canonical five-surface helper.
   * @returns {Promise<ReturnType<typeof validateRequiredHealth> & { error?: string }>}
   */
  async _fetchValidateRequiredHealth() {
    try {
      const h5002 = await this.commands.healthCheck(5002);
      const h5003 = await this.commands.healthCheck(5003);
      const func = await this.commands.collectorFunctionalCheck();
      return validateRequiredHealth({
        status5002: h5002?.statusCode,
        status5003: h5003?.statusCode,
        collectorHealth: func?.health,
        accounts: func?.accounts,
        channels: func?.channels,
      });
    } catch {
      return {
        ok: false,
        error: 'HEALTH_READ_FAIL',
        surfaces: {
          HEALTH_5002: 'FAIL',
          HEALTH_5003: 'FAIL',
          COLLECTOR_HEALTH: 'FAIL',
          ACCOUNTS: 'FAIL',
          CHANNELS: 'FAIL',
        },
        CURRENT_FULL_REQUIRED_HEALTH: 'FAIL',
        CURRENT_HEALTH_5002: null,
        CURRENT_HEALTH_5003: null,
        CURRENT_COLLECTOR_HEALTH: null,
        CURRENT_ACCOUNTS: null,
        CURRENT_CHANNELS: null,
      };
    }
  }

  async healthValidate() {
    this._requireState([State.POSTWRITE_VERIFIED]);
    const health = await this._fetchValidateRequiredHealth();
    if (!health.ok) {
      const code =
        health.error === 'HEALTH_READ_FAIL'
          ? 'HEALTH_FAIL'
          : health.error === 'HEALTH_5002_FAIL' || health.error === 'HEALTH_5003_FAIL'
            ? 'HEALTH_FAIL'
            : 'COLLECTOR_FUNCTIONAL_FAIL';
      await this.rollback(code);
      throw new T2OrchestratorError(code);
    }
    this._log(
      'HEALTH_PASS',
      '5002=200',
      '5003=200',
      'collector_health=200',
      'accounts=200',
      'channels=200',
      'CURRENT_FULL_REQUIRED_HEALTH=PASS',
    );
    return true;
  }

  async complete() {
    this._requireState([State.POSTWRITE_VERIFIED]);
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
      dumpRestoreRequired: opts.dumpRestoreRequired,
      dumpRestoreDecision: opts.dumpRestoreDecision,
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
        const restoreOpts = { mode: this.preDumpMode };
        if (this.preDumpUid != null) restoreOpts.uid = this.preDumpUid;
        if (this.preDumpGid != null) restoreOpts.gid = this.preDumpGid;
        this.sideEffects.DUMP_RESTORE_ATTEMPTED = true;
        setRollbackApplyState(this.sideEffects, 'DUMP_RESTORE', APPLY_STATE.UNKNOWN);
        await this._persistSideEffects();

        let restoreCommandError = null;
        let restoreResult = null;
        try {
          restoreResult = await this.guardedCall('restoreDump', () =>
            this.commands.restoreDump(this.backupBytes, restoreOpts),
          );
        } catch (err) {
          restoreCommandError = err;
        }

        // ALWAYS fresh-read dump after restore attempt (even on throw).
        let freshDumpPack = null;
        let freshDumpReadable = false;
        try {
          freshDumpPack = await this.commands.readDump();
          freshDumpReadable = true;
        } catch {
          freshDumpReadable = false;
        }

        if (freshDumpReadable && freshDumpPack) {
          const physical = assertExactDumpPhysicalPreEquivalent({
            expectedBytes: this.backupBytes,
            actualBytes: freshDumpPack.bytes,
            expectedSha: this.preDumpSha,
            actualSha: freshDumpPack.sha256,
            expectedMode: this.preDumpMode,
            actualMode:
              typeof freshDumpPack.mode === 'number' ? freshDumpPack.mode & 0o777 : null,
            expectedUid: this.preDumpUid,
            actualUid: typeof freshDumpPack.uid === 'number' ? freshDumpPack.uid : null,
            expectedGid: this.preDumpGid,
            actualGid: typeof freshDumpPack.gid === 'number' ? freshDumpPack.gid : null,
            dumpParsedOk: true,
          });
          if (physical.ok) {
            setRollbackApplyState(this.sideEffects, 'DUMP_RESTORE', APPLY_STATE.APPLIED);
          } else {
            setRollbackApplyState(this.sideEffects, 'DUMP_RESTORE', APPLY_STATE.NOT_APPLIED);
          }
        } else {
          setRollbackApplyState(this.sideEffects, 'DUMP_RESTORE', APPLY_STATE.UNKNOWN);
        }
        await this._persistSideEffects();

        // Command failed AND fresh-read did not prove applied → surface command error.
        // Otherwise continue to provePreEquivalent (physical FAIL → FAIL_FORWARD with dump codes).
        if (
          this.sideEffects.DUMP_RESTORE_APPLIED !== true &&
          restoreCommandError &&
          !freshDumpReadable
        ) {
          throw restoreCommandError;
        }
        // If restore returned ok:false and not applied and unreadable — fail closed.
        if (
          this.sideEffects.DUMP_RESTORE_APPLIED !== true &&
          restoreResult &&
          restoreResult.ok === false &&
          !freshDumpReadable
        ) {
          throw new T2OrchestratorError('RESTORE_DUMP_FAILED');
        }
      }

      if (plan.startExtra) {
        if (this.selection?.extra?.pm_id == null) {
          throw new T2OrchestratorError('EXTRA_PM_ID_MISSING');
        }
        const extraPmId = this.selection.extra.pm_id;
        this.sideEffects.EXTRA_START_ATTEMPTED = true;
        setRollbackApplyState(this.sideEffects, 'EXTRA_START', APPLY_STATE.UNKNOWN);
        await this._persistSideEffects();

        let startCommandError = null;
        let startResult = null;
        try {
          startResult = await this.guardedCall('startProcessByPmId', () =>
            this.commands.startProcessByPmId(extraPmId),
          );
        } catch (err) {
          startCommandError = err;
        }

        // ALWAYS fresh listLiveProcesses after start attempt (even on throw). Exit code alone is NOT proof.
        let freshLive = null;
        let liveListOk = false;
        try {
          freshLive = await this.commands.listLiveProcesses();
          liveListOk = true;
        } catch {
          liveListOk = false;
        }

        if (liveListOk && Array.isArray(freshLive)) {
          const extra = freshLive.find(
            (e) =>
              (e.pm_id === extraPmId || e.pm2_env?.pm_id === extraPmId) &&
              (e.name === 'titan-engine-worker' || e.pm2_env?.name === 'titan-engine-worker'),
          );
          const online = extra && (extra.status === 'online' || extra.pm2_env?.status === 'online');
          if (online) {
            setRollbackApplyState(this.sideEffects, 'EXTRA_START', APPLY_STATE.APPLIED);
          } else {
            setRollbackApplyState(this.sideEffects, 'EXTRA_START', APPLY_STATE.NOT_APPLIED);
          }
        } else {
          setRollbackApplyState(this.sideEffects, 'EXTRA_START', APPLY_STATE.UNKNOWN);
        }
        await this._persistSideEffects();

        // No second start attempt.
        // exitCode alone is NOT application proof; fresh online is.
        // If not APPLIED: nonzero/throw → fail with START_ROLLBACK_NONZERO;
        // exit 0 but still stopped → continue to provePreEquivalent (ENGINE_COUNT).
        if (this.sideEffects.EXTRA_START_APPLIED !== true) {
          if (startCommandError) throw startCommandError;
          if (!liveListOk) {
            throw new T2OrchestratorError('EXTRA_START_NOT_APPLIED');
          }
          if (!startResult || startResult.exitCode !== 0) {
            throw new T2OrchestratorError('START_ROLLBACK_NONZERO');
          }
        }
        // If command threw/nonzero but fresh-read proved APPLIED — continue.
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

    // 1) Physical-first: NO postDumpFp / dump semanticFingerprint on exact-byte success path.
    const physical = assertExactDumpPhysicalPreEquivalent({
      expectedBytes: this.backupBytes,
      actualBytes: dumpPack.bytes,
      expectedSha: this.preDumpSha,
      actualSha: dumpPack.sha256,
      expectedMode: this.preDumpMode,
      actualMode: typeof dumpPack.mode === 'number' ? dumpPack.mode & 0o777 : null,
      expectedUid: this.preDumpUid,
      actualUid: typeof dumpPack.uid === 'number' ? dumpPack.uid : null,
      expectedGid: this.preDumpGid,
      actualGid: typeof dumpPack.gid === 'number' ? dumpPack.gid : null,
      dumpParsedOk: true,
    });
    if (!physical.ok) {
      return physical;
    }

    // 2) Fresh LIVE read
    const live = await this.commands.listLiveProcesses();

    // 3) LIVE fleet pm_id integrity (presence / numeric / global unique)
    const pmIdIntegrity = assertLiveFleetPmIdIntegrity(live);
    if (!pmIdIntegrity.ok) {
      this._log(
        'ROLLBACK_LIVE_PM_ID_REVALIDATION=FAIL',
        `PRESENT=${pmIdIntegrity.LIVE_FLEET_PM_ID_PRESENT}`,
        `NUMERIC=${pmIdIntegrity.LIVE_FLEET_PM_ID_NUMERIC}`,
        `UNIQUE=${pmIdIntegrity.LIVE_FLEET_PM_ID_GLOBAL_UNIQUE}`,
      );
      return {
        ok: false,
        error: 'ROLLBACK_LIVE_PM_ID_INTEGRITY_FAIL',
        details: {
          LIVE_FLEET_PM_ID_PRESENT: pmIdIntegrity.LIVE_FLEET_PM_ID_PRESENT,
          LIVE_FLEET_PM_ID_NUMERIC: pmIdIntegrity.LIVE_FLEET_PM_ID_NUMERIC,
          LIVE_FLEET_PM_ID_GLOBAL_UNIQUE: pmIdIntegrity.LIVE_FLEET_PM_ID_GLOBAL_UNIQUE,
        },
      };
    }
    this._log('ROLLBACK_LIVE_PM_ID_REVALIDATION=PASS');

    // 4) Full LIVE semantic PRE-equivalence (dump semantic still short-circuited by exact bytes)
    const postLiveFp = semanticFingerprint(live, { source: 'LIVE' });
    const liveProof = assertPreEquivalent(
      this.preDumpFp,
      this.preLiveFp,
      null,
      postLiveFp,
      {
        retainedPmId: this.selection?.retained?.pm_id,
        extraPmId: this.selection?.extra?.pm_id,
        expectedDumpSha: this.preDumpSha,
        actualDumpSha: dumpPack.sha256,
        expectedDumpMode: this.preDumpMode,
        actualDumpMode: typeof dumpPack.mode === 'number' ? dumpPack.mode & 0o777 : null,
        expectedDumpUid: this.preDumpUid,
        actualDumpUid: typeof dumpPack.uid === 'number' ? dumpPack.uid : null,
        expectedDumpGid: this.preDumpGid,
        actualDumpGid: typeof dumpPack.gid === 'number' ? dumpPack.gid : null,
        expectedDumpBytes: this.backupBytes,
        actualDumpBytes: dumpPack.bytes,
        dumpParsedOk: true,
      },
    );
    if (!liveProof.ok) {
      return liveProof;
    }

    // 5) Complete five-surface health validation (same helper as forward healthValidate)
    const health = await this._fetchValidateRequiredHealth();
    if (!health.ok) {
      const rollbackError = toRollbackHealthError(health.error);
      this._log('ROLLBACK_FULL_REQUIRED_HEALTH=FAIL', rollbackError);
      return {
        ok: false,
        error: rollbackError,
        details: {
          ...(liveProof.details || {}),
          CURRENT_FULL_REQUIRED_HEALTH: 'FAIL',
          surfaces: health.surfaces,
        },
      };
    }
    this._log(
      'ROLLBACK_FULL_REQUIRED_HEALTH=PASS',
      'ROLLBACK_HEALTH_5002_REQUIRED=PASS',
      'ROLLBACK_HEALTH_5003_REQUIRED=PASS',
      'ROLLBACK_COLLECTOR_HEALTH_REQUIRED=PASS',
      'ROLLBACK_ACCOUNTS_REQUIRED=PASS',
      'ROLLBACK_CHANNELS_REQUIRED=PASS',
    );

    // 6) PRE_EQUIVALENT only when dump physical + LIVE semantic + full health all PASS
    return {
      ...liveProof,
      ok: true,
      details: {
        ...(liveProof.details || {}),
        CURRENT_FULL_REQUIRED_HEALTH: 'PASS',
        ROLLBACK_LIVE_PM_ID_REVALIDATION: 'PASS',
        ROLLBACK_HEALTH_5002_REQUIRED: 'PASS',
        ROLLBACK_HEALTH_5003_REQUIRED: 'PASS',
        ROLLBACK_COLLECTOR_HEALTH_REQUIRED: 'PASS',
        ROLLBACK_ACCOUNTS_REQUIRED: 'PASS',
        ROLLBACK_CHANNELS_REQUIRED: 'PASS',
      },
    };
  }

  async resolveUnknownProjectedWriteState() {
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
        errorCode: 'PROJECTED_DUMP_STATE_UNKNOWN',
      };
    }

    const mode = typeof dumpPack.mode === 'number' ? dumpPack.mode & 0o777 : null;
    const isExactPre =
      dumpPack.sha256 === this.preDumpSha &&
      deepJsonEqual(dumpPack.parsed, this.preDumpParsed) &&
      mode === this.preDumpMode &&
      (this.preDumpUid == null || dumpPack.uid === this.preDumpUid) &&
      (this.preDumpGid == null || dumpPack.gid === this.preDumpGid);
    const projectedSha = this.expectedProjected?.bytes ? sha256Buffer(this.expectedProjected.bytes) : null;
    const isExactProjected =
      projectedSha != null &&
      dumpPack.sha256 === projectedSha &&
      mode === REQUIRED_PROJECTED_DUMP_MODE &&
      !!this.expectedProjected?.projected &&
      deepJsonEqual(dumpPack.parsed, this.expectedProjected.projected);

    let decision = 'ACTIVE_DUMP_IS_OTHER';
    let restoreRequired = true;
    if (isExactPre) {
      decision = 'ACTIVE_DUMP_IS_EXACT_PRE';
      restoreRequired = false;
    } else if (isExactProjected) {
      decision = 'ACTIVE_DUMP_IS_EXACT_PROJECTED';
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
      errorCode: 'PROJECTED_DUMP_STATE_UNKNOWN',
    };
  }

  async runTransaction() {
    if (this._isTerminal()) {
      throw new T2OrchestratorError('REPLAY_BLOCKED');
    }
    await this.precheck();
    await this.backup();
    await this.stopExtra();
    await this.buildProjection();
    await this.writeProjectedDump();
    await this.postwriteVerify();
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
