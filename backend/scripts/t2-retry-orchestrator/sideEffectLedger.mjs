/**
 * Explicit side-effect ledger for T2 rollback decisions.
 * Never infer inverse mutations solely from transaction state.
 * v1.5.0: projected dump write replaces global pm2 save.
 * v1.6.2: APPLY_STATE fields for fresh-read application proof (never downgrade APPLIED).
 */

export const APPLY_STATE = Object.freeze({
  NOT_ATTEMPTED: 'NOT_ATTEMPTED',
  UNKNOWN: 'UNKNOWN',
  APPLIED: 'APPLIED',
  NOT_APPLIED: 'NOT_APPLIED',
});

const ALLOWED_APPLY_STATES = new Set(Object.values(APPLY_STATE));

export function createSideEffectLedger() {
  return {
    BACKUP_WRITTEN: false,
    STOP_ATTEMPTED: false,
    ENGINE_STOP_APPLIED: false,
    PROJECTED_DUMP_WRITE_ATTEMPTED: false,
    PROJECTED_DUMP_WRITE_APPLIED: false,
    DUMP_RESTORE_REQUIRED: null,
    DUMP_RESTORE_DECISION: 'UNDECIDED',
    DUMP_RESTORE_ATTEMPTED: false,
    DUMP_RESTORE_APPLIED: false,
    DUMP_RESTORE_APPLY_STATE: APPLY_STATE.NOT_ATTEMPTED,
    EXTRA_START_ATTEMPTED: false,
    EXTRA_START_APPLIED: false,
    EXTRA_START_APPLY_STATE: APPLY_STATE.NOT_ATTEMPTED,
    // Legacy 1.4.0 bits — must remain FALSE/UNUSED on v1.5 forward path
    SAVE_ATTEMPTED: false,
    DUMP_SAVE_APPLIED: false,
    DUMP_MODE_HARDEN_ATTEMPTED: false,
    DUMP_MODE_HARDEN_APPLIED: false,
  };
}

/**
 * Set DUMP_RESTORE / EXTRA_START apply state. Never downgrade APPLIED.
 * @param {ReturnType<typeof createSideEffectLedger>} ledger
 * @param {'DUMP_RESTORE'|'EXTRA_START'} which
 * @param {'NOT_ATTEMPTED'|'UNKNOWN'|'APPLIED'|'NOT_APPLIED'} nextState
 * @param {{ appliedBoolean?: boolean }} [opts]
 */
export function setRollbackApplyState(ledger, which, nextState, opts = {}) {
  if (!ALLOWED_APPLY_STATES.has(nextState)) {
    throw new Error(`INVALID_APPLY_STATE:${nextState}`);
  }
  const stateKey = which === 'DUMP_RESTORE' ? 'DUMP_RESTORE_APPLY_STATE' : 'EXTRA_START_APPLY_STATE';
  const boolKey = which === 'DUMP_RESTORE' ? 'DUMP_RESTORE_APPLIED' : 'EXTRA_START_APPLIED';
  if (ledger[stateKey] === APPLY_STATE.APPLIED || ledger[boolKey] === true) {
    // Never downgrade APPLIED
    ledger[stateKey] = APPLY_STATE.APPLIED;
    ledger[boolKey] = true;
    return;
  }
  ledger[stateKey] = nextState;
  if (nextState === APPLY_STATE.APPLIED) {
    ledger[boolKey] = true;
  } else if (typeof opts.appliedBoolean === 'boolean') {
    ledger[boolKey] = opts.appliedBoolean;
  } else if (nextState === APPLY_STATE.NOT_APPLIED || nextState === APPLY_STATE.UNKNOWN) {
    ledger[boolKey] = false;
  }
}

/**
 * Decide which inverse mutations are permitted based on proven side effects.
 * @param {ReturnType<typeof createSideEffectLedger>} ledger
 * @param {{ dumpStateUnknown?: boolean }} [opts]
 */
export function planRollbackActions(ledger, opts = {}) {
  const dumpStateUnknown = opts.dumpStateUnknown === true;
  const explicitRestoreRequired =
    typeof opts.dumpRestoreRequired === 'boolean' ? opts.dumpRestoreRequired : null;
  const restoreDump =
    ledger.PROJECTED_DUMP_WRITE_APPLIED === true ||
    (ledger.PROJECTED_DUMP_WRITE_ATTEMPTED === true &&
      dumpStateUnknown &&
      explicitRestoreRequired === true) ||
    ledger.DUMP_SAVE_APPLIED === true ||
    (ledger.SAVE_ATTEMPTED === true && dumpStateUnknown);
  const startExtra = ledger.ENGINE_STOP_APPLIED === true;
  const anyPm2Mutation = restoreDump || startExtra;
  return {
    restoreDump,
    startExtra,
    anyPm2Mutation,
    reason: {
      restore: restoreDump
        ? ledger.PROJECTED_DUMP_WRITE_APPLIED
          ? 'PROJECTED_DUMP_WRITE_APPLIED'
          : ledger.PROJECTED_DUMP_WRITE_ATTEMPTED && dumpStateUnknown && explicitRestoreRequired
            ? opts.dumpRestoreDecision || 'PROJECTED_DUMP_WRITE_ATTEMPTED_STATE_UNKNOWN'
            : ledger.DUMP_SAVE_APPLIED
              ? 'DUMP_SAVE_APPLIED'
              : 'SAVE_ATTEMPTED_DUMP_STATE_UNKNOWN'
        : dumpStateUnknown && explicitRestoreRequired === false
          ? opts.dumpRestoreDecision || 'ACTIVE_DUMP_IS_EXACT_PRE'
          : 'NO_PROVEN_DUMP_MUTATION',
      start: startExtra ? 'ENGINE_STOP_APPLIED' : 'NO_PROVEN_ENGINE_STOP',
      harden:
        ledger.DUMP_MODE_HARDEN_APPLIED === true
          ? 'DUMP_MODE_HARDEN_APPLIED'
          : ledger.DUMP_MODE_HARDEN_ATTEMPTED === true
            ? 'DUMP_MODE_HARDEN_ATTEMPTED'
            : 'NO_DUMP_MODE_HARDEN',
    },
  };
}
