/**
 * Canonical Agent status projection — frontend mirror of backend DTO.
 * Do not collapse registered/enabled/scheduled into one Active badge.
 */

export type AgentLastRunStatus = 'success' | 'failed' | 'skipped' | 'never' | 'unknown';

export interface AgentStatusProjection {
  agentKey: string;
  registered: boolean;
  configured: boolean;
  enabled: boolean;
  allowlisted: boolean;
  scheduled: boolean;
  running: boolean;
  healthy: boolean;
  dataReady: boolean;
  consumerRegistered: boolean;
  consumerEligible: boolean;
  executionEligible: boolean;
  executionEligibleWhenLive: boolean;
  liveCapable: boolean;
  sideEffectClass: string;
  lastRunStatus: AgentLastRunStatus;
  schedulerOwner: string;
}

export type AgentWithProjection = {
  agent_key?: string;
  status?: string;
  statusProjection?: AgentStatusProjection;
};

export function getAgentStatusProjection(agent: AgentWithProjection | null | undefined): AgentStatusProjection | null {
  return agent?.statusProjection ?? null;
}

/** Primary operational pill — prefers canonical projection over raw status. */
export function resolveOperationalPresentation(agent: AgentWithProjection | null | undefined): {
  state: 'ready' | 'running' | 'paused' | 'error' | 'unavailable';
  labelKey: string;
} {
  const p = getAgentStatusProjection(agent);
  if (p) {
    if (!p.registered) return { state: 'unavailable', labelKey: 'agent_state_unavailable' };
    if (p.running) return { state: 'running', labelKey: 'agent_state_running' };
    if (!p.enabled) return { state: 'paused', labelKey: 'agent_state_paused' };
    if (!p.healthy) return { state: 'error', labelKey: 'agent_state_error' };
    if (p.scheduled) return { state: 'ready', labelKey: 'agent_state_scheduled' };
    if (p.allowlisted && !p.scheduled) return { state: 'ready', labelKey: 'agent_state_allowlisted' };
    return { state: 'ready', labelKey: 'active' };
  }
  return { state: 'unavailable', labelKey: 'agent_state_unavailable' };
}

export function formatSchedulerOwnership(projection?: AgentStatusProjection | null): string {
  return projection?.schedulerOwner || 'titan-engine-worker';
}

export type OpportunityLifecycle = 'detected' | 'validated' | 'rejected' | 'expired' | 'simulated' | 'blocked';

export function lifecycleLabelKey(lifecycle?: string | null): string {
  const key = String(lifecycle || 'blocked').toLowerCase();
  if (['detected', 'validated', 'rejected', 'expired', 'simulated', 'blocked'].includes(key)) {
    return `arbitrage_lifecycle_${key}`;
  }
  return 'arbitrage_lifecycle_blocked';
}
