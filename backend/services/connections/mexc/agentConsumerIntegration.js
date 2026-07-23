/**
 * Agent consumer eligibility against canonical MEXC capability matrix.
 * Agents must not read credentials or create parallel MEXC clients.
 * Generic "Other Agents: Eligible" is removed — unregistered agents are NOT ELIGIBLE.
 */

import {
  MEXC_CONSUMERS,
  evaluateConsumerEligibility,
  resolveAgentConsumerEligibility,
  UNREGISTERED_AGENT_STATUS,
} from './consumerRegistry.js';

/** Explicitly registered Agent consumer contracts only */
const AGENT_CONSUMER_IDS = Object.freeze([
  'arbitrage',
  'market_data_agents',
  'risk_agents',
]);

export function listAgentMexcConsumers() {
  return MEXC_CONSUMERS.filter((c) => AGENT_CONSUMER_IDS.includes(c.id));
}

export function evaluateAgentMexcEligibility(matrix, agentConsumerId) {
  const resolved = resolveAgentConsumerEligibility(matrix, agentConsumerId);
  return {
    ...resolved,
    mayReadCredentials: false,
    mayCreateParallelClient: false,
    bypassRuntimeForbidden: true,
    emergencyStopRespected: true,
  };
}

export function buildAgentIntegrationStatus(matrix) {
  return listAgentMexcConsumers().map((c) => evaluateAgentMexcEligibility(matrix, c.id));
}

export function evaluateUnregisteredAgent(matrix, agentId) {
  return evaluateAgentMexcEligibility(matrix, agentId || 'unknown_agent');
}

export { UNREGISTERED_AGENT_STATUS };
