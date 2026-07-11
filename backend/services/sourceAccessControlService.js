/**
 * DH-ACCESSCONTROL-P2 — central source access evaluation and audit logging.
 */
import { query } from '../database/db.js';
import { logger } from './logger.js';
import { tryInsertDataHubAccessLog } from './dataHubAccessLogWriter.js';

/** Runtime identities not stored in ai_agents but enforced on agent/runtime paths. */
export const RUNTIME_AGENT_KEYS = {
    PUBLISHER: 'publisher',
};

export const RUNTIME_AGENT_REGISTRY = [
    { agent_key: RUNTIME_AGENT_KEYS.PUBLISHER, name: 'Telegram Publisher (runtime)' },
];

const ALLOW_SAMPLE_RATE = 0.02;

function normalizeAgentList(list) {
    return Array.isArray(list) ? list.filter(Boolean) : [];
}

function evaluateAclPolicy(acl, { agentKey, dataType }) {
    if (!acl) {
        return { allowed: true, reason: 'no_acl', policy: 'default_allow', aclPresent: false };
    }

    const allowedAgents = normalizeAgentList(acl.allowed_agents);
    const blockedAgents = normalizeAgentList(acl.blocked_agents);
    const allowedTypes = normalizeAgentList(acl.allowed_data_types);
    const blockedTypes = normalizeAgentList(acl.blocked_data_types);

    if (agentKey && blockedAgents.includes(agentKey)) {
        return {
            allowed: false,
            reason: 'agent_blocked',
            policy: 'blocked',
            aclPresent: true,
        };
    }

    if (agentKey && allowedAgents.length > 0 && !allowedAgents.includes(agentKey)) {
        return {
            allowed: false,
            reason: 'agent_not_in_allow_list',
            policy: 'allowed_list',
            aclPresent: true,
        };
    }

    if (dataType && blockedTypes.includes(dataType)) {
        return {
            allowed: false,
            reason: 'data_type_blocked',
            policy: 'blocked',
            aclPresent: true,
        };
    }

    if (dataType && allowedTypes.length > 0 && !allowedTypes.includes(dataType)) {
        return {
            allowed: false,
            reason: 'data_type_not_in_allow_list',
            policy: 'allowed_list',
            aclPresent: true,
        };
    }

    return { allowed: true, reason: 'allowed', policy: 'default_allow', aclPresent: true };
}

/**
 * @param {object} params
 * @param {string} params.sourceId
 * @param {string} [params.agentKey]
 * @param {string|null} [params.userId]
 * @param {string} [params.action]
 * @param {string} [params.dataType]
 * @param {{ failOpen?: boolean, audit?: boolean }} [options]
 */
export async function evaluateSourceAccess(
    { sourceId, agentKey, userId = null, action = 'read', dataType = null },
    options = {},
) {
    const { failOpen = false, audit = true } = options;

    if (!sourceId) {
        return {
            allowed: false,
            reason: 'missing_source_id',
            policy: 'invalid',
            aclPresent: false,
        };
    }

    try {
        const result = await query(
            `SELECT allowed_agents, blocked_agents, allowed_data_types, blocked_data_types
             FROM source_access_controls
             WHERE source_id = $1`,
            [sourceId],
        );

        const acl = result.rows[0] || null;
        const decision = evaluateAclPolicy(acl, { agentKey, dataType });

        if (audit && agentKey) {
            if (!decision.allowed) {
                await logSourceAccessDenied({
                    sourceId,
                    agentKey,
                    userId,
                    action,
                    dataType,
                    reason: decision.reason,
                });
            } else if (Math.random() < ALLOW_SAMPLE_RATE) {
                await logSourceAccessAllowed({
                    sourceId,
                    agentKey,
                    userId,
                    action,
                    dataType,
                    reason: decision.reason,
                });
            }
        }

        return decision;
    } catch (error) {
        logger.error('evaluateSourceAccess DB error', {
            sourceId,
            agentKey,
            action,
            error: error.message,
        });

        if (failOpen) {
            return {
                allowed: true,
                reason: 'db_error_fail_open',
                policy: 'db_error',
                aclPresent: false,
            };
        }

        if (audit && agentKey) {
            await logSourceAccessDenied({
                sourceId,
                agentKey,
                userId,
                action,
                dataType,
                reason: 'db_error_fail_closed',
            });
        }

        return {
            allowed: false,
            reason: 'db_error_fail_closed',
            policy: 'db_error',
            aclPresent: false,
        };
    }
}

/**
 * SQL fragment: true when agent may access source_id column (mirrors evaluateSourceAccess agent rules).
 * @param {string} sourceIdColumn - e.g. `cd.source_id`
 * @param {number} agentKeyParamIndex - 1-based $N index for agent key param
 */
export function sourceAccessAllowedSql(sourceIdColumn, agentKeyParamIndex) {
    const p = `$${agentKeyParamIndex}`;
    return `(
        NOT EXISTS (
            SELECT 1 FROM source_access_controls sac
            WHERE sac.source_id = ${sourceIdColumn}
        )
        OR EXISTS (
            SELECT 1 FROM source_access_controls sac
            WHERE sac.source_id = ${sourceIdColumn}
              AND NOT (${p} = ANY(COALESCE(sac.blocked_agents, ARRAY[]::text[])))
              AND (
                  COALESCE(cardinality(sac.allowed_agents), 0) = 0
                  OR ${p} = ANY(sac.allowed_agents)
              )
        )
    )`;
}

export async function resolveAgentKey(agentIdOrKey) {
    if (!agentIdOrKey) return null;
    const value = String(agentIdOrKey).trim();
    if (!value) return null;

    const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(value)) {
        return value;
    }

    try {
        const result = await query(
            'SELECT agent_key FROM ai_agents WHERE id = $1 LIMIT 1',
            [value],
        );
        return result.rows[0]?.agent_key || value;
    } catch (error) {
        logger.warn('resolveAgentKey lookup failed', { agentIdOrKey: value, error: error.message });
        return value;
    }
}

export async function listRegistryAgents() {
    const result = await query(
        `SELECT agent_key, name FROM ai_agents WHERE agent_key IS NOT NULL ORDER BY agent_key`,
    );
    const dbAgents = result.rows.map(row => ({
        agent_key: row.agent_key,
        name: row.name,
        runtime: false,
    }));
    return [
        ...dbAgents,
        ...RUNTIME_AGENT_REGISTRY.map(row => ({ ...row, runtime: true })),
    ];
}

export async function validateAgentKeys(agentKeys) {
    const keys = normalizeAgentList(agentKeys);
    if (keys.length === 0) return { valid: true, invalid: [] };

    const registry = await listRegistryAgents();
    const validSet = new Set(registry.map(a => a.agent_key));
    const invalid = keys.filter(k => !validSet.has(k));
    return { valid: invalid.length === 0, invalid };
}

export async function logSourceAccessConfigUpdated({
    sourceId,
    userId,
    allowedAgents,
    blockedAgents,
    action = 'upsert',
}) {
    await tryInsertDataHubAccessLog({
        sourceId,
        action: 'source_access_config_updated',
        status: 'success',
        message: `Source access config ${action}`,
        metadata: {
            user_id: userId,
            allowed_agents: allowedAgents,
            blocked_agents: blockedAgents,
            config_action: action,
        },
    });
}

export async function logSourceAccessDenied({
    sourceId,
    agentKey,
    userId = null,
    action = 'read',
    dataType = null,
    reason = 'denied',
}) {
    await tryInsertDataHubAccessLog({
        sourceId,
        action: 'source_access_denied',
        status: 'failure',
        message: `Access denied for agent ${agentKey}`,
        metadata: {
            agent_key: agentKey,
            user_id: userId,
            access_action: action,
            data_type: dataType,
            reason,
        },
    });
}

export async function logSourceAccessAllowed({
    sourceId,
    agentKey,
    userId = null,
    action = 'read',
    dataType = null,
    reason = 'allowed',
}) {
    await tryInsertDataHubAccessLog({
        sourceId,
        action: 'source_access_allowed',
        status: 'success',
        message: `Access allowed for agent ${agentKey}`,
        metadata: {
            agent_key: agentKey,
            user_id: userId,
            access_action: action,
            data_type: dataType,
            reason,
            sampled: true,
        },
    });
}

