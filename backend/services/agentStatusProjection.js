/**
 * Canonical Agent status projection — single DTO owner for UI, API, and scheduler views.
 * Do not collapse registered/enabled/scheduled/running into one "Active" badge.
 */

import { hasAgent } from './agents/registry.js';
import { getAgentCapability, isLiveCapableAgent } from './agentCapabilityRegistry.js';
import { resolveAgentConsumerEligibility, UNREGISTERED_AGENT_STATUS } from './connections/mexc/consumerRegistry.js';
import { listAgentMexcConsumers } from './connections/mexc/agentConsumerIntegration.js';

const REGISTERED_MEXC_AGENT_CONSUMERS = new Set(listAgentMexcConsumers().map((c) => c.id));

/** @typedef {'success' | 'failed' | 'skipped' | 'never' | 'unknown'} LastRunStatus */

/**
 * @param {object} params
 * @param {object} params.agent — ai_agents row (parsed config/metadata)
 * @param {string[]} [params.allowlist] — normalized scheduler allowlist keys
 * @param {boolean} [params.schedulerRunning]
 * @param {boolean} [params.killSwitchActive]
 * @param {string} [params.effectiveMode]
 * @param {object|null} [params.mexcMatrix] — optional cached capability matrix (no provider fetch)
 */
export function buildAgentStatusProjection({
  agent,
  allowlist = [],
  schedulerRunning = false,
  killSwitchActive = true,
  effectiveMode = 'demo',
  mexcMatrix = null,
}) {
  const agentKey = String(agent?.agent_key || '').toLowerCase();
  const registered = Boolean(agentKey && hasAgent(agentKey));
  const config = agent?.config && typeof agent.config === 'object' ? agent.config : {};
  const metadata = agent?.metadata && typeof agent.metadata === 'object' ? agent.metadata : {};
  const configured = registered && Object.keys(config).length > 0;
  const enabled = Boolean(agent?.is_enabled) && String(agent?.status || '').toLowerCase() !== 'archived';
  const normalizedAllowlist = allowlist.map((k) => String(k).toLowerCase());
  const allowlisted = registered && normalizedAllowlist.includes(agentKey);
  const scheduled = allowlisted && enabled && schedulerRunning;
  const statusLower = String(agent?.status || '').toLowerCase();
  const running = statusLower === 'running' || statusLower === 'training';
  const healthy = registered && statusLower !== 'error' && statusLower !== 'failed';

  let consumerEligible = false;
  let consumerRegistered = false;
  if (registered && agentKey) {
    consumerRegistered = REGISTERED_MEXC_AGENT_CONSUMERS.has(agentKey);
    if (consumerRegistered && mexcMatrix) {
      const consumer = resolveAgentConsumerEligibility(mexcMatrix, agentKey);
      consumerEligible = consumer?.eligible === true;
    } else if (consumerRegistered && agentKey === 'arbitrage') {
      consumerEligible = true;
    } else if (consumerRegistered) {
      consumerEligible = false;
    } else if (mexcMatrix && resolveAgentConsumerEligibility(mexcMatrix, agentKey)?.code === UNREGISTERED_AGENT_STATUS.code) {
      consumerRegistered = false;
      consumerEligible = false;
    }
  }

  const cap = registered ? getAgentCapability(agentKey) : null;
  const liveCapable = registered && isLiveCapableAgent(agentKey);
  const executionEligible =
    enabled
    && !killSwitchActive
    && effectiveMode === 'live'
    && liveCapable
    && cap?.liveCapable === true;

  const lastResult = metadata.last_result || metadata.lastResult || null;
  let lastRunStatus = /** @type {LastRunStatus} */ ('never');
  if (lastResult?.error || lastResult?.status === 'failed') lastRunStatus = 'failed';
  else if (lastResult?.status === 'skipped') lastRunStatus = 'skipped';
  else if (lastResult?.status === 'completed' || lastResult?.completedAt) lastRunStatus = 'success';
  else if (agent?.last_active_at) lastRunStatus = 'unknown';

  let dataReady = false;
  if (agentKey === 'arbitrage') {
    dataReady = Boolean(lastResult?.candidateStats || metadata.last_scan_at || agent?.last_active_at);
  } else {
    dataReady = Boolean(agent?.last_active_at || (metadata && Object.keys(metadata).length > 0));
  }

  return {
    agentKey,
    registered,
    configured,
    enabled,
    allowlisted,
    scheduled,
    running,
    healthy,
    dataReady,
    consumerRegistered,
    consumerEligible,
    executionEligible: false,
    executionEligibleWhenLive: executionEligible,
    liveCapable,
    sideEffectClass: cap?.sideEffectClass || 'unknown',
    lastRunStatus,
    schedulerOwner: 'titan-engine-worker',
  };
}

/**
 * Batch projection for agent list responses.
 * @param {object[]} agents
 * @param {object} context
 */
export function buildAgentStatusProjections(agents, context = {}) {
  return agents.map((agent) => ({
    ...agent,
    statusProjection: buildAgentStatusProjection({ agent, ...context }),
  }));
}

export { hasAgent as isRegisteredAgentKey };
