import { query } from '../database/db.js';
import { logger } from './logger.js';

const PG_UNIQUE_VIOLATION = '23505';

function mapRow(row) {
    return {
        id: row.id,
        rule_type: row.rule_type,
        scope: row.scope,
        pattern: row.pattern,
        match_type: row.match_type,
        apply_target: row.apply_target,
        action: row.action,
        is_active: row.is_active,
        priority: Number(row.priority),
        metadata:
            typeof row.metadata === 'string'
                ? JSON.parse(row.metadata)
                : row.metadata || {},
        reason: row.reason || null,
        created_by: row.created_by || null,
        deleted_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
        last_matched_at: row.last_matched_at
            ? new Date(row.last_matched_at).toISOString()
            : null,
        created_at: new Date(row.created_at).toISOString(),
        updated_at: new Date(row.updated_at).toISOString(),
    };
}

function validateRegexPattern(pattern) {
    try {
        // eslint-disable-next-line no-new
        new RegExp(pattern);
    } catch (e) {
        const err = new Error(`Invalid regex pattern: ${e.message}`);
        err.status = 400;
        throw err;
    }
}

function ruleMatches(rule, ctx) {
    if (!rule.is_active) return false;

    const { source_id: sourceId, url, text } = ctx;
    const haystackUrl = (url || '').toLowerCase();
    const haystackText = (text || '').toLowerCase();
    const pattern = rule.pattern;
    const patternLower = pattern.toLowerCase();

    switch (rule.scope) {
        case 'source':
            if (!sourceId) return false;
            if (rule.match_type === 'exact') return sourceId === pattern;
            return sourceId.includes(pattern);
        case 'domain': {
            let host = '';
            if (url) {
                try {
                    host = new URL(url).hostname.toLowerCase();
                } catch {
                    host = haystackUrl;
                }
            }
            if (!host && !haystackUrl) return false;
            const target = host || haystackUrl;
            if (rule.match_type === 'exact') return target === patternLower;
            if (rule.match_type === 'contains') {
                return target.includes(patternLower) || patternLower.includes(target);
            }
            try {
                return new RegExp(pattern, 'i').test(target);
            } catch {
                return false;
            }
        }
        case 'keyword': {
            const combined = `${haystackText} ${haystackUrl}`.trim();
            if (!combined) return false;
            if (rule.match_type === 'exact') {
                return combined === patternLower || combined.split(/\s+/).includes(patternLower);
            }
            if (rule.match_type === 'contains') {
                return combined.includes(patternLower);
            }
            try {
                return new RegExp(pattern, 'i').test(combined);
            } catch {
                return false;
            }
        }
        default:
            return false;
    }
}

function applyTargetsFor(target) {
    if (target === 'both') return ['ingestion', 'publishing', 'both'];
    return [target, 'both'];
}

async function loadActiveRules(applyTarget) {
    const targets = applyTargetsFor(applyTarget);
    const result = await query(
        `SELECT * FROM datahub_filter_rules
         WHERE deleted_at IS NULL
           AND is_active = true
           AND apply_target = ANY($1::varchar[])
         ORDER BY priority DESC, created_at ASC`,
        [targets],
    );
    return result.rows;
}

function resolveDecision(matchingRules) {
    if (matchingRules.length === 0) {
        return {
            allowed: true,
            decision: 'allowed',
            reason: 'no_matching_rules',
            matched_rules: [],
        };
    }

    const topPriority = matchingRules[0].priority;
    const top = matchingRules.filter(r => r.priority === topPriority);
    const whitelist = top.find(r => r.rule_type === 'whitelist');
    if (whitelist) {
        return {
            allowed: true,
            decision: 'allowed',
            reason: 'whitelist_match',
            matched_rules: [mapRow(whitelist)],
            winning_rule_id: whitelist.id,
        };
    }
    const blacklist = top.find(r => r.rule_type === 'blacklist');
    if (blacklist) {
        return {
            allowed: false,
            decision: 'blocked',
            reason: 'blacklist_match',
            matched_rules: [mapRow(blacklist)],
            winning_rule_id: blacklist.id,
        };
    }

    return {
        allowed: true,
        decision: 'allowed',
        reason: 'no_matching_rules',
        matched_rules: [],
    };
}

export async function evaluateFilterRules(input) {
    const { source_id, url, text, apply_target = 'ingestion' } = input;
    const rules = await loadActiveRules(apply_target);
    const ctx = { source_id, url, text };
    const matching = rules.filter(r => ruleMatches(r, ctx));
    const decision = resolveDecision(matching);

    if (decision.winning_rule_id) {
        await query(
            `UPDATE datahub_filter_rules SET last_matched_at = NOW() WHERE id = $1`,
            [decision.winning_rule_id],
        ).catch(err => logger.warn('filter rule last_matched update failed', err));
    }

    return {
        allowed: decision.allowed,
        decision: decision.decision,
        reason: decision.reason,
        apply_target,
        matched_rules: decision.matched_rules,
    };
}

export async function enforceIngestionFilter({ source_id, url, text, metadata }) {
    const evalResult = await evaluateFilterRules({
        source_id,
        url: url || metadata?.url || metadata?.source_url,
        text: text || metadata?.title || metadata?.content,
        apply_target: 'ingestion',
    });

    if (!evalResult.allowed) {
        await logFilterBlock({
            source_id,
            rule_id: evalResult.matched_rules[0]?.id,
            reason: evalResult.reason,
            url,
            text,
        });
        const err = new Error('Ingestion blocked by filter rule');
        err.status = 403;
        err.code = 'FILTER_BLOCKED';
        err.details = evalResult;
        throw err;
    }

    return evalResult;
}

async function logFilterBlock({ source_id, rule_id, reason, url, text }) {
    try {
        await query(
            `INSERT INTO data_hub_logs (source_id, action, message, metadata, status)
             VALUES ($1, 'filter_blocked', $2, $3, 'failure')`,
            [
                source_id || null,
                'Ingestion blocked by filter rule',
                JSON.stringify({
                    rule_id,
                    reason,
                    url: url ? String(url).slice(0, 500) : undefined,
                    text_preview: text ? String(text).slice(0, 200) : undefined,
                }),
            ],
        );
    } catch (e) {
        logger.warn('Failed to write filter block log', e);
    }
}

export async function listFilterRules(filters = {}) {
    const clauses = ['deleted_at IS NULL'];
    const params = [];
    let n = 1;

    if (filters.rule_type) {
        clauses.push(`rule_type = $${n++}`);
        params.push(filters.rule_type);
    }
    if (filters.scope) {
        clauses.push(`scope = $${n++}`);
        params.push(filters.scope);
    }
    if (filters.apply_target) {
        clauses.push(`apply_target = $${n++}`);
        params.push(filters.apply_target);
    }
    if (filters.active_only) {
        clauses.push('is_active = true');
    }

    const result = await query(
        `SELECT * FROM datahub_filter_rules
         WHERE ${clauses.join(' AND ')}
         ORDER BY priority DESC, created_at DESC`,
        params,
    );
    return result.rows.map(mapRow);
}

export async function getFilterRule(id) {
    const result = await query(
        `SELECT * FROM datahub_filter_rules WHERE id = $1 AND deleted_at IS NULL`,
        [id],
    );
    if (result.rows.length === 0) {
        const err = new Error('Filter rule not found');
        err.status = 404;
        throw err;
    }
    return mapRow(result.rows[0]);
}

export async function createFilterRule(body, userId) {
    if (body.match_type === 'regex') {
        validateRegexPattern(body.pattern);
    }

    const action = body.rule_type === 'blacklist' ? 'block' : 'allow';

    try {
        const result = await query(
            `INSERT INTO datahub_filter_rules (
                rule_type, scope, pattern, match_type, apply_target,
                action, is_active, priority, metadata, reason, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                body.rule_type,
                body.scope,
                body.pattern.trim(),
                body.match_type || 'contains',
                body.apply_target || 'ingestion',
                action,
                body.is_active !== false,
                body.priority ?? 100,
                JSON.stringify(body.metadata || {}),
                body.reason || null,
                userId || null,
            ],
        );

        const rule = mapRow(result.rows[0]);
        if (rule.scope === 'source' && rule.rule_type === 'blacklist') {
            await query(
                `UPDATE data_sources SET is_active = false, updated_at = NOW() WHERE id = $1`,
                [rule.pattern],
            ).catch(e => logger.warn('source deactivate on blacklist failed', e));
        }
        return rule;
    } catch (e) {
        if (e.code === PG_UNIQUE_VIOLATION) {
            const err = new Error(
                'Duplicate filter rule: same rule_type, scope, pattern, and match_type already exists',
            );
            err.status = 409;
            throw err;
        }
        throw e;
    }
}

export async function updateFilterRule(id, body) {
    const existing = await getFilterRule(id);
    const matchType = body.match_type ?? existing.match_type;
    const pattern = body.pattern ?? existing.pattern;

    if (matchType === 'regex') {
        validateRegexPattern(pattern);
    }

    const fields = [];
    const params = [];
    let n = 1;

    const set = (col, val) => {
        fields.push(`${col} = $${n++}`);
        params.push(val);
    };

    if (body.rule_type !== undefined) set('rule_type', body.rule_type);
    if (body.scope !== undefined) set('scope', body.scope);
    if (body.pattern !== undefined) set('pattern', body.pattern.trim());
    if (body.match_type !== undefined) set('match_type', body.match_type);
    if (body.apply_target !== undefined) set('apply_target', body.apply_target);
    if (body.is_active !== undefined) set('is_active', body.is_active);
    if (body.priority !== undefined) set('priority', body.priority);
    if (body.metadata !== undefined) set('metadata', JSON.stringify(body.metadata));
    if (body.reason !== undefined) set('reason', body.reason);

    const ruleType = body.rule_type ?? existing.rule_type;
    set('action', ruleType === 'blacklist' ? 'block' : 'allow');

    if (fields.length === 1) {
        return existing;
    }

    params.push(id);
    try {
        const result = await query(
            `UPDATE datahub_filter_rules SET ${fields.join(', ')}
             WHERE id = $${n} AND deleted_at IS NULL
             RETURNING *`,
            params,
        );
        return mapRow(result.rows[0]);
    } catch (e) {
        if (e.code === PG_UNIQUE_VIOLATION) {
            const err = new Error('Duplicate filter rule');
            err.status = 409;
            throw err;
        }
        throw e;
    }
}

export async function softDeleteFilterRule(id) {
    const result = await query(
        `UPDATE datahub_filter_rules
         SET deleted_at = NOW(), is_active = false, updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [id],
    );
    if (result.rows.length === 0) {
        const err = new Error('Filter rule not found');
        err.status = 404;
        throw err;
    }
    return mapRow(result.rows[0]);
}
