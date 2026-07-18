/**
 * Canonical scheduled-agent resolution.
 * Accepts agent_key or UUID only — rejects synthetic scheduler IDs (agent-1..agent-15).
 */

import { query } from '../database/db.js';
import { logger } from './logger.js';
import { getAgentCapability, isLiveCapableAgent } from './agentCapabilityRegistry.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SYNTHETIC_AGENT_RE = /^agent-\d+$/i;

export const RESOLVE_REASON = Object.freeze({
  OK: 'OK',
  EMPTY: 'EMPTY',
  SYNTHETIC_ID: 'SYNTHETIC_ID',
  UNKNOWN: 'UNKNOWN',
  AMBIGUOUS: 'AMBIGUOUS',
  DISABLED: 'DISABLED',
  PAUSED: 'PAUSED',
  MISSING_KEY: 'MISSING_KEY',
});

/**
 * Normalize allowlist from scheduler_config.agents.agents.
 * Empty array means run nobody (fail-closed). Does not expand to "all agents".
 * @param {unknown} raw
 * @returns {{ ok: true, keys: string[] } | { ok: false, reason: string, message: string }}
 */
export function normalizeAgentAllowlist(raw) {
  if (raw == null) {
    return { ok: true, keys: [] };
  }
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      reason: 'MALFORMED',
      message: 'agents.agents must be an array of agent_key or UUID strings',
    };
  }

  const seen = new Set();
  const keys = [];
  for (const entry of raw) {
    if (typeof entry !== 'string' || !entry.trim()) {
      return {
        ok: false,
        reason: 'MALFORMED',
        message: 'allowlist entries must be non-empty strings',
      };
    }
    const value = entry.trim();
    if (SYNTHETIC_AGENT_RE.test(value)) {
      return {
        ok: false,
        reason: RESOLVE_REASON.SYNTHETIC_ID,
        message: `synthetic scheduler id rejected: ${value}`,
      };
    }
    const normalized = UUID_RE.test(value) ? value.toLowerCase() : value.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    keys.push(normalized);
  }
  return { ok: true, keys };
}

/**
 * Resolve one allowlist entry to a canonical ai_agents row.
 * @param {string} agentRef
 */
export async function resolveScheduledAgent(agentRef) {
  const raw = String(agentRef || '').trim();
  if (!raw) {
    return { ok: false, reason: RESOLVE_REASON.EMPTY, message: 'empty agent reference' };
  }
  if (SYNTHETIC_AGENT_RE.test(raw)) {
    return {
      ok: false,
      reason: RESOLVE_REASON.SYNTHETIC_ID,
      message: `synthetic scheduler id rejected: ${raw}`,
    };
  }

  let result;
  if (UUID_RE.test(raw)) {
    result = await query(
      `SELECT id, agent_key, name, status, is_enabled
       FROM ai_agents WHERE id = $1 LIMIT 2`,
      [raw],
    );
  } else {
    result = await query(
      `SELECT id, agent_key, name, status, is_enabled
       FROM ai_agents WHERE lower(agent_key) = lower($1)`,
      [raw],
    );
  }

  if (result.rows.length === 0) {
    return { ok: false, reason: RESOLVE_REASON.UNKNOWN, message: `agent not found: ${raw}` };
  }
  if (result.rows.length > 1) {
    return {
      ok: false,
      reason: RESOLVE_REASON.AMBIGUOUS,
      message: `ambiguous agent_key: ${raw}`,
    };
  }

  const agent = result.rows[0];
  if (!agent.agent_key) {
    return { ok: false, reason: RESOLVE_REASON.MISSING_KEY, message: 'agent missing agent_key' };
  }
  if (agent.is_enabled === false) {
    return {
      ok: false,
      reason: RESOLVE_REASON.DISABLED,
      message: `agent disabled: ${agent.agent_key}`,
      agentKey: agent.agent_key,
      agentId: agent.id,
    };
  }
  const status = String(agent.status || '').toLowerCase();
  if (status === 'paused' || status === 'inactive' || status === 'stopped') {
    return {
      ok: false,
      reason: RESOLVE_REASON.PAUSED,
      message: `agent paused/inactive: ${agent.agent_key}`,
      agentKey: agent.agent_key,
      agentId: agent.id,
    };
  }

  const capability = getAgentCapability(agent.agent_key);
  return {
    ok: true,
    reason: RESOLVE_REASON.OK,
    agentId: agent.id,
    agentKey: agent.agent_key,
    name: agent.name,
    status: agent.status,
    isEnabled: agent.is_enabled === true,
    liveCapable: isLiveCapableAgent(agent.agent_key),
    sideEffectClass: capability.sideEffectClass,
  };
}

/**
 * Whether an agent may keep running on the analytical scheduler under Emergency Stop.
 */
export function isSafeAnalyticalUnderEmergencyStop(agentKey) {
  return isLiveCapableAgent(agentKey) !== true;
}

export function logResolutionOutcome(outcome, context = {}) {
  const payload = {
    reason: outcome.reason,
    agentKey: outcome.agentKey || null,
    agentId: outcome.agentId || null,
    ...context,
  };
  if (outcome.ok) {
    logger.info('scheduled_agent_resolved', payload);
  } else {
    logger.warn('scheduled_agent_resolution_skipped', {
      ...payload,
      message: outcome.message,
    });
  }
}
