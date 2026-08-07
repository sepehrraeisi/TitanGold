/**
 * Artemis WP-A — Legacy decision containment helpers.
 * Marks advisory MoE/fallback outputs as NOT execution-eligible.
 */

export const LEGACY_ADVISORY_CLASSIFICATION = 'LEGACY_ADVISORY_ONLY';
export const NOT_EXECUTION_ELIGIBLE = 'NOT_EXECUTION_ELIGIBLE';
export const LEGACY_ADVISORY_STAGE = 'LEGACY_ADVISORY';

/**
 * @param {object} payload - Existing Artemis decision JSON (action/approved/reason/confidence/…)
 * @param {{ sideEffectsSuppressed?: boolean }} [opts]
 * @returns {object}
 */
export function containLegacyArtemisDecision(payload = {}, opts = {}) {
  const sideEffectsSuppressed = opts.sideEffectsSuppressed !== false;
  return {
    ...payload,
    classification: LEGACY_ADVISORY_CLASSIFICATION,
    executionEligible: false,
    executionEligibility: NOT_EXECUTION_ELIGIBLE,
    approvedForExecution: false,
    maturityStage: LEGACY_ADVISORY_STAGE,
    advisoryOnly: true,
    sideEffectsSuppressed,
    /**
     * Legacy `approved` remains for compatibility as an advisory signal only.
     * Callers MUST use executionEligible / approvedForExecution for execution gates.
     */
    legacyApprovedFieldSemantics: 'advisory_signal_only_not_execution_authorization',
  };
}

export default {
  containLegacyArtemisDecision,
  LEGACY_ADVISORY_CLASSIFICATION,
  NOT_EXECUTION_ELIGIBLE,
  LEGACY_ADVISORY_STAGE,
};
