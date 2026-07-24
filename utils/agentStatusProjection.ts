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

export {
  resolveAgentProductStatus,
  resolveOperationalPresentation,
  mapProductStateToFilterBucket,
  type AgentProductStatus,
  type AgentProductPrimaryState,
  type AgentProductTone,
  type ProductStatusContext,
} from './agentProductStatus.ts';
