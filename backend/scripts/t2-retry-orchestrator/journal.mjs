/**
 * Durable one-shot transaction journal for T2 orchestrator.
 * No secret values. Parent dir 0700, journal file 0600.
 * Atomic exclusive run-directory creation — duplicate RUN_ID fails closed.
 * Durable writes: temp → fsync file → rename → fsync directory.
 */

import path from 'path';
import { State, TERMINAL_STATES, TOOL_VERSION } from './constants.mjs';

export class JournalError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'JournalError';
    this.code = code;
  }
}

/**
 * @typedef {{
 *   mkdirExclusive: (dir: string, mode: number) => Promise<void>,
 *   writeFileExclusive: (file: string, data: string, mode: number) => Promise<void>,
 *   writeFileAtomic: (file: string, data: string, mode: number) => Promise<void>,
 *   readFile: (file: string) => Promise<string>,
 *   exists: (file: string) => Promise<boolean>,
 *   chmod: (file: string, mode: number) => Promise<void>,
 *   fsync?: (target: string) => Promise<void>,
 * }} JournalFs
 */

/**
 * In-memory journal FS for unit tests (fsync mockable).
 */
export function createMemoryJournalFs() {
  /** @type {Map<string, { type: 'dir'|'file', mode: number, data?: string }>} */
  const store = new Map();
  /** @type {string[]} */
  const fsyncCalls = [];

  return {
    store,
    fsyncCalls,
    async mkdirExclusive(dir, mode) {
      if (store.has(dir)) {
        throw new JournalError('RUN_DIR_EXISTS', `RUN_DIR_EXISTS path=${dir}`);
      }
      store.set(dir, { type: 'dir', mode });
    },
    async writeFileExclusive(file, data, mode) {
      if (store.has(file)) {
        throw new JournalError('JOURNAL_EXISTS', `JOURNAL_EXISTS path=${file}`);
      }
      store.set(file, { type: 'file', mode, data });
    },
    async writeFileAtomic(file, data, mode) {
      const dir = path.dirname(file);
      const tmp = `${file}.tmp`;
      store.set(tmp, { type: 'file', mode, data });
      await this.fsync(tmp);
      store.set(file, { type: 'file', mode, data });
      store.delete(tmp);
      await this.fsync(dir);
    },
    async readFile(file) {
      const e = store.get(file);
      if (!e || e.type !== 'file') throw new JournalError('JOURNAL_MISSING');
      return e.data || '';
    },
    async exists(file) {
      return store.has(file);
    },
    async chmod(file, mode) {
      const e = store.get(file);
      if (!e) throw new JournalError('JOURNAL_MISSING');
      e.mode = mode;
    },
    async fsync(target) {
      fsyncCalls.push(String(target));
    },
  };
}

/**
 * @param {object} opts
 * @param {string} opts.runId
 * @param {string} opts.journalRoot
 * @param {JournalFs} opts.fs
 * @param {string} [opts.toolVersion]
 */
export async function createExclusiveJournal(opts) {
  const { runId, journalRoot, fs, toolVersion = TOOL_VERSION } = opts;
  if (!runId || !journalRoot || !fs) {
    throw new JournalError('JOURNAL_ARGS_INVALID');
  }
  const runDir = path.join(journalRoot, `TITANGOLD_T2_RUN_${runId}`);
  const journalPath = path.join(runDir, 'journal.json');

  await fs.mkdirExclusive(runDir, 0o700);

  const record = {
    runId,
    toolVersion,
    state: State.AUTHORIZED_UNCONSUMED,
    authConsumed: false,
    mutationClosed: false,
    transitions: [],
    retainedPmId: null,
    extraPmId: null,
    preDumpShaPrefix: null,
    sideEffects: {
      BACKUP_WRITTEN: false,
      STOP_ATTEMPTED: false,
      ENGINE_STOP_APPLIED: false,
      PROJECTED_DUMP_WRITE_ATTEMPTED: false,
      PROJECTED_DUMP_WRITE_APPLIED: false,
      DUMP_RESTORE_REQUIRED: null,
      DUMP_RESTORE_DECISION: 'UNDECIDED',
      DUMP_RESTORE_ATTEMPTED: false,
      DUMP_RESTORE_APPLIED: false,
      DUMP_RESTORE_APPLY_STATE: 'NOT_ATTEMPTED',
      EXTRA_START_ATTEMPTED: false,
      EXTRA_START_APPLIED: false,
      EXTRA_START_APPLY_STATE: 'NOT_ATTEMPTED',
      SAVE_ATTEMPTED: false,
      DUMP_SAVE_APPLIED: false,
      DUMP_MODE_HARDEN_ATTEMPTED: false,
      DUMP_MODE_HARDEN_APPLIED: false,
    },
    createdAt: new Date().toISOString(),
  };

  await fs.writeFileExclusive(journalPath, JSON.stringify(record, null, 2), 0o600);
  if (typeof fs.fsync === 'function') {
    await fs.fsync(journalPath);
    await fs.fsync(runDir);
  }

  return new TransactionJournal({ runDir, journalPath, fs, record });
}

/**
 * Load existing journal — never auto-continues a consumed/in-progress/terminal run.
 * @param {object} opts
 */
export async function loadJournal(opts) {
  const { runId, journalRoot, fs } = opts;
  const runDir = path.join(journalRoot, `TITANGOLD_T2_RUN_${runId}`);
  const journalPath = path.join(runDir, 'journal.json');
  if (!(await fs.exists(journalPath))) {
    throw new JournalError('JOURNAL_MISSING');
  }
  const raw = await fs.readFile(journalPath);
  const record = JSON.parse(raw);
  return new TransactionJournal({ runDir, journalPath, fs, record });
}

export class TransactionJournal {
  constructor({ runDir, journalPath, fs, record }) {
    this.runDir = runDir;
    this.journalPath = journalPath;
    this.fs = fs;
    this.record = record;
  }

  get state() {
    return this.record.state;
  }

  get authConsumed() {
    return this.record.authConsumed === true;
  }

  get mutationClosed() {
    return this.record.mutationClosed === true;
  }

  isTerminal() {
    return TERMINAL_STATES.includes(this.record.state);
  }

  /**
   * Fail closed if this journal must not be used to start/replay a transaction.
   */
  assertFreshStartAllowed() {
    if (this.authConsumed) {
      throw new JournalError(
        'JOURNAL_AUTH_CONSUMED_NO_REPLAY',
        'Crash-after-consume or prior consumption requires Owner/RCA — replay blocked',
      );
    }
    if (this.isTerminal()) {
      throw new JournalError('JOURNAL_TERMINAL_NO_REPLAY');
    }
    if (this.record.state !== State.AUTHORIZED_UNCONSUMED) {
      throw new JournalError(
        'JOURNAL_IN_PROGRESS_NO_REPLAY',
        `state=${this.record.state}`,
      );
    }
  }

  assertNotTerminal() {
    if (this.isTerminal() || this.mutationClosed) {
      throw new JournalError('JOURNAL_TERMINAL_CLOSED');
    }
  }

  async persist() {
    try {
      await this.fs.writeFileAtomic(
        this.journalPath,
        JSON.stringify(this.record, null, 2),
        0o600,
      );
    } catch (err) {
      const e = new JournalError('JOURNAL_PERSIST_FAILED', err.message || 'JOURNAL_PERSIST_FAILED');
      e.cause = err;
      throw e;
    }
  }

  async transition(toState, event) {
    const from = this.record.state;
    this.record.state = toState;
    if (TERMINAL_STATES.includes(toState)) {
      this.record.mutationClosed = true;
    }
    this.record.transitions.push({
      at: new Date().toISOString(),
      from,
      to: toState,
      event: String(event || ''),
    });
    await this.persist();
  }

  /**
   * Persist authorization consumption BEFORE any production mutation.
   */
  async markAuthorizationConsumed() {
    if (this.record.authConsumed) {
      throw new JournalError('JOURNAL_AUTH_ALREADY_CONSUMED');
    }
    this.record.authConsumed = true;
    this.record.transitions.push({
      at: new Date().toISOString(),
      from: this.record.state,
      to: this.record.state,
      event: 'AUTHORIZATION_CONSUMED',
    });
    await this.persist();
  }

  async setSelection({ retainedPmId, extraPmId, preDumpShaPrefix }) {
    this.record.retainedPmId = retainedPmId;
    this.record.extraPmId = extraPmId;
    this.record.preDumpShaPrefix = preDumpShaPrefix
      ? String(preDumpShaPrefix).slice(0, 12)
      : null;
    await this.persist();
  }

  async persistSideEffects(ledger) {
    const normalizeApplyState = (v) => {
      if (v === 'APPLIED' || v === 'NOT_APPLIED' || v === 'UNKNOWN' || v === 'NOT_ATTEMPTED') {
        return v;
      }
      return 'NOT_ATTEMPTED';
    };
    this.record.sideEffects = {
      BACKUP_WRITTEN: !!ledger.BACKUP_WRITTEN,
      STOP_ATTEMPTED: !!ledger.STOP_ATTEMPTED,
      ENGINE_STOP_APPLIED: !!ledger.ENGINE_STOP_APPLIED,
      PROJECTED_DUMP_WRITE_ATTEMPTED: !!ledger.PROJECTED_DUMP_WRITE_ATTEMPTED,
      PROJECTED_DUMP_WRITE_APPLIED: !!ledger.PROJECTED_DUMP_WRITE_APPLIED,
      DUMP_RESTORE_REQUIRED:
        typeof ledger.DUMP_RESTORE_REQUIRED === 'boolean' ? ledger.DUMP_RESTORE_REQUIRED : null,
      DUMP_RESTORE_DECISION:
        typeof ledger.DUMP_RESTORE_DECISION === 'string'
          ? ledger.DUMP_RESTORE_DECISION
          : 'UNDECIDED',
      DUMP_RESTORE_ATTEMPTED: !!ledger.DUMP_RESTORE_ATTEMPTED,
      DUMP_RESTORE_APPLIED: !!ledger.DUMP_RESTORE_APPLIED,
      DUMP_RESTORE_APPLY_STATE: normalizeApplyState(ledger.DUMP_RESTORE_APPLY_STATE),
      EXTRA_START_ATTEMPTED: !!ledger.EXTRA_START_ATTEMPTED,
      EXTRA_START_APPLIED: !!ledger.EXTRA_START_APPLIED,
      EXTRA_START_APPLY_STATE: normalizeApplyState(ledger.EXTRA_START_APPLY_STATE),
      SAVE_ATTEMPTED: !!ledger.SAVE_ATTEMPTED,
      DUMP_SAVE_APPLIED: !!ledger.DUMP_SAVE_APPLIED,
      DUMP_MODE_HARDEN_ATTEMPTED: !!ledger.DUMP_MODE_HARDEN_ATTEMPTED,
      DUMP_MODE_HARDEN_APPLIED: !!ledger.DUMP_MODE_HARDEN_APPLIED,
    };
    await this.persist();
  }
}
