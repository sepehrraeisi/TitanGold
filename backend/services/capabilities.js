/**
 * Central capability model — maps DB roles to fine-grained permissions.
 * Roles are defined in schema/Zod: user | admin | trader | vip
 *
 * vip: no extra mutation privilege unless explicitly listed.
 * trader: trading/execution where existing route architecture intended it.
 * admin: configuration and system control.
 */

export const CAP = Object.freeze({
  AI_AGENT_READ: 'AI_AGENT_READ',
  AI_AGENT_EXECUTE_SAFE: 'AI_AGENT_EXECUTE_SAFE',
  AI_AGENT_EXECUTE_LIVE_CAPABLE: 'AI_AGENT_EXECUTE_LIVE_CAPABLE',
  AI_AGENT_CONFIGURE: 'AI_AGENT_CONFIGURE',
  AI_AGENT_ENABLE_DISABLE: 'AI_AGENT_ENABLE_DISABLE',
  TOPIC_ROUTING_READ: 'TOPIC_ROUTING_READ',
  TOPIC_ROUTING_WRITE: 'TOPIC_ROUTING_WRITE',
  ARTEMIS_DECISION_EXECUTE: 'ARTEMIS_DECISION_EXECUTE',
  ARTEMIS_STATE_WRITE: 'ARTEMIS_STATE_WRITE',
  SCHEDULER_CONTROL: 'SCHEDULER_CONTROL',
  TRADING_ENGINE_CONTROL: 'TRADING_ENGINE_CONTROL',
  AUTOPILOT_CONTROL: 'AUTOPILOT_CONTROL',
  LIVE_TRADING: 'LIVE_TRADING',
  RUNTIME_MODE_WRITE: 'RUNTIME_MODE_WRITE',
  KILL_SWITCH_CONTROL: 'KILL_SWITCH_CONTROL',
});

/** @type {Record<string, Set<string>>} */
const ROLE_CAPABILITIES = {
  user: new Set([
    CAP.AI_AGENT_READ,
    CAP.TOPIC_ROUTING_READ,
  ]),
  vip: new Set([
    CAP.AI_AGENT_READ,
    CAP.TOPIC_ROUTING_READ,
  ]),
  trader: new Set([
    CAP.AI_AGENT_READ,
    CAP.AI_AGENT_EXECUTE_SAFE,
    CAP.AI_AGENT_EXECUTE_LIVE_CAPABLE,
    CAP.TOPIC_ROUTING_READ,
    CAP.ARTEMIS_DECISION_EXECUTE,
    CAP.SCHEDULER_CONTROL,
    CAP.TRADING_ENGINE_CONTROL,
    CAP.LIVE_TRADING,
    CAP.KILL_SWITCH_CONTROL,
  ]),
  admin: new Set([
    CAP.AI_AGENT_READ,
    CAP.AI_AGENT_EXECUTE_SAFE,
    CAP.AI_AGENT_EXECUTE_LIVE_CAPABLE,
    CAP.AI_AGENT_CONFIGURE,
    CAP.AI_AGENT_ENABLE_DISABLE,
    CAP.TOPIC_ROUTING_READ,
    CAP.TOPIC_ROUTING_WRITE,
    CAP.ARTEMIS_DECISION_EXECUTE,
    CAP.ARTEMIS_STATE_WRITE,
    CAP.SCHEDULER_CONTROL,
    CAP.TRADING_ENGINE_CONTROL,
    CAP.AUTOPILOT_CONTROL,
    CAP.LIVE_TRADING,
    CAP.RUNTIME_MODE_WRITE,
    CAP.KILL_SWITCH_CONTROL,
  ]),
};

export function normalizeRole(role) {
  return String(role || '').toLowerCase().trim();
}

export function roleHasCapability(role, capability) {
  const normalized = normalizeRole(role);
  const caps = ROLE_CAPABILITIES[normalized];
  if (!caps) return false;
  return caps.has(capability);
}

export function getCapabilitiesForRole(role) {
  const normalized = normalizeRole(role);
  return ROLE_CAPABILITIES[normalized] ? [...ROLE_CAPABILITIES[normalized]] : [];
}

export function isPrivilegedRole(role) {
  const r = normalizeRole(role);
  return r === 'admin' || r === 'trader';
}
