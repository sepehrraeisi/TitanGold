/**
 * Explicit side-effect ledger for dump sanitizer rollback decisions.
 */

export function createSideEffectLedger() {
  return {
    BACKUP_WRITTEN: false,
    SANITIZED_DUMP_WRITE_ATTEMPTED: false,
    SANITIZED_DUMP_WRITE_APPLIED: false,
    DUMP_RESTORE_REQUIRED: null,
    DUMP_RESTORE_DECISION: 'UNDECIDED',
  };
}

/**
 * @param {ReturnType<typeof createSideEffectLedger>} ledger
 * @param {{ dumpStateUnknown?: boolean, dumpRestoreRequired?: boolean|null, dumpRestoreDecision?: string }} [opts]
 */
export function planRollbackActions(ledger, opts = {}) {
  const dumpStateUnknown = opts.dumpStateUnknown === true;
  const explicitRestoreRequired =
    typeof opts.dumpRestoreRequired === 'boolean' ? opts.dumpRestoreRequired : null;

  const restoreDump =
    ledger.SANITIZED_DUMP_WRITE_APPLIED === true ||
    (ledger.SANITIZED_DUMP_WRITE_ATTEMPTED === true &&
      dumpStateUnknown &&
      explicitRestoreRequired === true);

  return {
    restoreDump,
    anyPm2Mutation: restoreDump,
    reason: {
      restore: restoreDump
        ? ledger.SANITIZED_DUMP_WRITE_APPLIED
          ? 'SANITIZED_DUMP_WRITE_APPLIED'
          : opts.dumpRestoreDecision || 'SANITIZED_DUMP_WRITE_ATTEMPTED_STATE_UNKNOWN'
        : dumpStateUnknown && explicitRestoreRequired === false
          ? opts.dumpRestoreDecision || 'ACTIVE_DUMP_IS_EXACT_PRE'
          : 'NO_PROVEN_DUMP_MUTATION',
    },
  };
}
