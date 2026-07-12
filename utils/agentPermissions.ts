/**
 * Frontend capability checks — mirrors backend/services/capabilities.js
 */
import { isAdminRole, isTraderRole, normalizeRole } from './auth';

export const CAP = {
  AI_AGENT_READ: 'AI_AGENT_READ',
  AI_AGENT_EXECUTE_SAFE: 'AI_AGENT_EXECUTE_SAFE',
  AI_AGENT_EXECUTE_LIVE_CAPABLE: 'AI_AGENT_EXECUTE_LIVE_CAPABLE',
  AI_AGENT_CONFIGURE: 'AI_AGENT_CONFIGURE',
  AI_AGENT_ENABLE_DISABLE: 'AI_AGENT_ENABLE_DISABLE',
  TOPIC_ROUTING_READ: 'TOPIC_ROUTING_READ',
  TOPIC_ROUTING_WRITE: 'TOPIC_ROUTING_WRITE',
  ARTEMIS_DECISION_EXECUTE: 'ARTEMIS_DECISION_EXECUTE',
  ARTEMIS_STATE_WRITE: 'ARTEMIS_STATE_WRITE',
  KILL_SWITCH_CONTROL: 'KILL_SWITCH_CONTROL',
} as const;

export type Capability = (typeof CAP)[keyof typeof CAP];

const ROLE_CAPS: Record<string, Capability[]> = {
  user: [CAP.AI_AGENT_READ, CAP.TOPIC_ROUTING_READ],
  vip: [CAP.AI_AGENT_READ, CAP.TOPIC_ROUTING_READ],
  trader: [
    CAP.AI_AGENT_READ,
    CAP.AI_AGENT_EXECUTE_SAFE,
    CAP.AI_AGENT_EXECUTE_LIVE_CAPABLE,
    CAP.TOPIC_ROUTING_READ,
    CAP.ARTEMIS_DECISION_EXECUTE,
    CAP.KILL_SWITCH_CONTROL,
  ],
  admin: [
    CAP.AI_AGENT_READ,
    CAP.AI_AGENT_EXECUTE_SAFE,
    CAP.AI_AGENT_EXECUTE_LIVE_CAPABLE,
    CAP.AI_AGENT_CONFIGURE,
    CAP.AI_AGENT_ENABLE_DISABLE,
    CAP.TOPIC_ROUTING_READ,
    CAP.TOPIC_ROUTING_WRITE,
    CAP.ARTEMIS_DECISION_EXECUTE,
    CAP.ARTEMIS_STATE_WRITE,
    CAP.KILL_SWITCH_CONTROL,
  ],
};

export function roleHasCapability(role: string | null | undefined, capability: Capability): boolean {
  const caps = ROLE_CAPS[normalizeRole(role)] || [];
  return caps.includes(capability);
}

export function canExecuteAgents(role?: string | null): boolean {
  return roleHasCapability(role, CAP.AI_AGENT_EXECUTE_SAFE);
}

export function canConfigureAgents(role?: string | null): boolean {
  return roleHasCapability(role, CAP.AI_AGENT_CONFIGURE);
}

export function canWriteTopicRouting(role?: string | null): boolean {
  return roleHasCapability(role, CAP.TOPIC_ROUTING_WRITE);
}

export { isAdminRole, isTraderRole };
