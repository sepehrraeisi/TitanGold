/**
 * Artemis WP-A — read-only readiness aggregation.
 * Composes existing runtime SSOT + static Foundation readiness.
 * Does not create a second mode/capability/connections owner.
 */

import { getRuntimeExecutionState } from './runtimeExecutionStateService.js';
import { buildRuntimeView } from './runtimeExecutionStateService.js';
import { query } from '../database/db.js';
import { logger } from './logger.js';
import {
  LEGACY_ADVISORY_CLASSIFICATION,
  NOT_EXECUTION_ELIGIBLE,
  LEGACY_ADVISORY_STAGE,
} from './artemisDecisionContainment.js';

const CONTRACT_VERSION = 'artemis-evidence-1.0.0';
const SCHEMA_VERSION = '1.0.0';

/**
 * @param {{ userId?: string }} [opts]
 */
export async function buildArtemisReadiness(opts = {}) {
  const { userId } = opts;

  let runtimeView = null;
  let runtimeTruth = 'UNAVAILABLE';
  try {
    const state = await getRuntimeExecutionState({ preferCache: false });
    let requestedMode = 'demo';
    let providerConnected = false;
    if (userId) {
      try {
        const pref = await query(
          `SELECT preferences->'trading'->>'mode' AS mode FROM user_preferences WHERE user_id = $1 AND is_deleted = FALSE LIMIT 1`,
          [userId],
        );
        requestedMode = pref.rows[0]?.mode === 'live' ? 'live' : 'demo';
      } catch (e) {
        logger.warn('Artemis readiness: requested mode unavailable', e.message);
      }
      try {
        const broker = await query(
          `SELECT COUNT(*)::int AS c FROM exchange_connections WHERE user_id = $1 AND is_active = TRUE AND api_key IS NOT NULL`,
          [userId],
        );
        providerConnected = (broker.rows[0]?.c || 0) > 0;
      } catch (e) {
        logger.warn('Artemis readiness: provider connection unavailable', e.message);
      }
    }
    runtimeView = buildRuntimeView(state, { requestedMode, providerConnected });
    runtimeTruth = 'MEASURED';
  } catch (e) {
    logger.warn('Artemis readiness: runtime SSOT unavailable', e.message);
  }

  const agents = {
    analyticalEvidence: { keys: ['technical', 'trend', 'pattern', 'volume', 'sentiment', 'fundamental', 'market_intelligence'], readiness: 'ROLE_MAPPED' },
    opportunityForecast: { keys: ['price_prediction', 'timing', 'arbitrage'], readiness: 'ROLE_MAPPED' },
    control: { keys: ['risk', 'portfolio', 'optimization'], readiness: 'ROLE_MAPPED' },
    feasibility: { keys: ['liquidity'], readiness: 'BLOCKED', limitationKey: 'artemis_liquidity_stub' },
    execution: { keys: ['order'], readiness: 'NOT_EXECUTION_ELIGIBLE', limitationKey: 'artemis_om_execution_only_future' },
  };

  return {
    maturityStage: LEGACY_ADVISORY_STAGE,
    classification: LEGACY_ADVISORY_CLASSIFICATION,
    executionEligible: false,
    executionEligibility: NOT_EXECUTION_ELIGIBLE,
    contract: {
      schemaVersion: SCHEMA_VERSION,
      contractVersion: CONTRACT_VERSION,
      readiness: 'CONTRACT_FOUNDATION_APPROVED',
      implemented: false,
      truth: 'CONFIGURED',
    },
    evidence: {
      readiness: 'UNAVAILABLE',
      reasonKey: 'artemis_evidence_contract_not_implemented',
      truth: 'UNAVAILABLE',
    },
    orchestration: {
      readiness: 'LEGACY',
      realAgentCoordination: false,
      reasonKey: 'artemis_orchestration_mock_legacy',
      truth: 'LEGACY',
    },
    controlChain: {
      risk: { authority: 'veto', readiness: 'PARTIAL', truth: 'CONFIGURED', limitationKey: 'artemis_risk_uuid_debt' },
      portfolio: { authority: 'sizing', readiness: 'PARTIAL', truth: 'CONFIGURED' },
      optimization: { authority: 'sizing', readiness: 'PARTIAL', truth: 'CONFIGURED' },
      liquidity: { authority: 'feasibility', readiness: 'BLOCKED', truth: 'CONFIGURED', limitationKey: 'artemis_liquidity_stub' },
      runtime: { authority: 'runtime_safety', readiness: runtimeView ? 'AVAILABLE' : 'UNAVAILABLE', truth: runtimeTruth },
      order: { authority: 'execution_only', readiness: 'NOT_EXECUTION_ELIGIBLE', truth: 'CONFIGURED' },
    },
    runtime: runtimeView,
    runtimeTruth,
    agents,
    limitations: [
      'artemis_contract_not_runtime_implemented',
      'artemis_agent_coordination_not_real',
      'artemis_decision_legacy_advisory_only',
      'artemis_liquidity_not_control_eligible',
      'artemis_no_live_automation',
    ],
    dualConfigLimitationKey: 'artemis_dual_decision_engine_config',
    generatedAt: new Date().toISOString(),
  };
}

export default { buildArtemisReadiness };
