/**
 * Explicit side-effect ledger for T2 rollback decisions.
 * Never infer inverse mutations solely from transaction state.
 */

export function createSideEffectLedger() {
  return {
    BACKUP_WRITTEN: false,
    STOP_ATTEMPTED: false,
    ENGINE_STOP_APPLIED: false,
    SAVE_ATTEMPTED: false,
    DUMP_SAVE_APPLIED: false,
  };
}

/**
 * Decide which inverse mutations are permitted based on proven side effects.
 * @param {ReturnType<typeof createSideEffectLedger>} ledger
 * @param {{ dumpStateUnknown?: boolean }} [opts]
 */
export function planRollbackActions(ledger, opts = {}) {
  const dumpStateUnknown = opts.dumpStateUnknown === true;
  const restoreDump =
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
        ? ledger.DUMP_SAVE_APPLIED
          ? 'DUMP_SAVE_APPLIED'
          : 'SAVE_ATTEMPTED_DUMP_STATE_UNKNOWN'
        : 'NO_PROVEN_DUMP_MUTATION',
      start: startExtra ? 'ENGINE_STOP_APPLIED' : 'NO_PROVEN_ENGINE_STOP',
    },
  };
}
