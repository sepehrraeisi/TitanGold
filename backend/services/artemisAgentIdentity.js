/**
 * Artemis WP-B.1 — single backend Agent identity owner.
 * Reuses constants/artemisAgentCatalog.js alias table. No second alias map.
 * agentId = stable agent_key. DB UUID remains agentRecordId. No migration.
 */

import {
  ARTEMIS_AGENT_CATALOG,
  normalizeAgentKey,
} from '../../constants/artemisAgentCatalog.js';

const CANONICAL_KEYS = Object.freeze(ARTEMIS_AGENT_CATALOG.map((row) => row.key));
const CANONICAL_SET = new Set(CANONICAL_KEYS);
/** Legacy orchestrator / TE ids. Must never resolve to a real Agent. */
const LEGACY_AGENT_N = /^agent-(?:[1-9]|1[0-5])$/;

export function listCanonicalAgentKeys() {
  return [...CANONICAL_KEYS];
}

export function listKnownAliases() {
  return ARTEMIS_AGENT_CATALOG.flatMap((row) => row.aliases.map((alias) => ({ alias, agentId: row.key })));
}

/**
 * @param {unknown} value
 * @returns {{
 *   status: 'ok' | 'legacy_unavailable' | 'unknown' | 'invalid',
 *   agentId: string | null,
 *   raw: string | null,
 *   reason?: string,
 * }}
 */
export function resolveArtemisAgentIdentity(value) {
  if (value == null) {
    return { status: 'invalid', agentId: null, raw: null, reason: 'empty_identity' };
  }
  const raw = String(value).trim().toLowerCase();
  if (!raw) {
    return { status: 'invalid', agentId: null, raw: '', reason: 'empty_identity' };
  }
  if (LEGACY_AGENT_N.test(raw)) {
    return { status: 'legacy_unavailable', agentId: null, raw, reason: 'legacy_agent_n' };
  }

  const normalized = normalizeAgentKey(raw);
  if (CANONICAL_SET.has(normalized)) {
    return { status: 'ok', agentId: normalized, raw };
  }
  return { status: 'unknown', agentId: null, raw, reason: 'unknown_identity' };
}

export function requireCanonicalAgentId(value) {
  const resolved = resolveArtemisAgentIdentity(value);
  if (resolved.status !== 'ok') {
    const error = new Error(`Invalid Artemis agent identity: ${resolved.reason || resolved.status}`);
    error.code = 'INVALID_AGENT_IDENTITY';
    error.details = resolved;
    throw error;
  }
  return resolved.agentId;
}

export default {
  listCanonicalAgentKeys,
  listKnownAliases,
  resolveArtemisAgentIdentity,
  requireCanonicalAgentId,
};
