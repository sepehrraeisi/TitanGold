/**
 * Agent consumer eligibility against canonical MEXC capability matrix.
 * Agents must not read credentials or create parallel MEXC clients.
 */

import { MEXC_CONSUMERS, evaluateConsumerEligibility } from './consumerRegistry.js';

const AGENT_CONSUMER_IDS = new Set([
  'arbitrage',
  'market_data_agents',
  'risk_agents',
  'other_agents',
  'spot_trading',
  'futures_trading',
  'wallet',
  'portfolio',
]);

export function listAgentMexcConsumers() {
  return MEXC_CONSUMERS.filter((c) => AGENT_CONSUMER_IDS.has(c.id));
}

export function evaluateAgentMexcEligibility(matrix, agentConsumerId) {
  const consumer = MEXC_CONSUMERS.find((c) => c.id === agentConsumerId);
  if (!consumer) {
    return {
      consumerId: agentConsumerId,
      eligible: false,
      blockedReason: 'Unknown consumer',
      mayReadCredentials: false,
      mayCreateParallelClient: false,
      bypassRuntimeForbidden: true,
    };
  }
  const base = evaluateConsumerEligibility(consumer, matrix);
  return {
    ...base,
    mayReadCredentials: false,
    mayCreateParallelClient: false,
    bypassRuntimeForbidden: true,
    emergencyStopRespected: true,
  };
}

export function buildAgentIntegrationStatus(matrix) {
  return listAgentMexcConsumers().map((c) => evaluateAgentMexcEligibility(matrix, c.id));
}
