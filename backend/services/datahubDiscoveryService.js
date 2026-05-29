import { query } from '../database/db.js';
import { logger } from './logger.js';
import { evaluateFilterRules } from './datahubFilterRulesService.js';
import { assertSafeDiscoveryUrl, normalizeDiscoveryUrl, normalizeTitleKey } from '../utils/discoverySafety.js';
import { checkDuplicateLayers, shouldSkipAsDuplicate } from '../utils/discoveryDedupe.js';
import { computeDiscoveryScore } from '../utils/discoveryScoring.js';

function mapRuleRow(row) {
    return {
        id: row.id,
        name: row.name,
        pattern: row.pattern,
        source_kind: row.source_kind,
        category: row.category,
        priority: row.priority,
        is_enabled: row.is_enabled,
        metadata:
            typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
        created_at: new Date(row.created_at).toISOString(),
        updated_at: new Date(row.updated_at).toISOString(),
    };
}

function mapSuggestionRow(row) {
    return {
        id: row.id,
        status: row.status,
        suggested_name: row.suggested_name,
        suggested_type: row.suggested_type,
        suggested_url: row.suggested_url,
        host_key: row.host_key,
        path_key: row.path_key,
        title_key: row.title_key,
        category: row.category,
        priority_score: Number(row.priority_score),
        discovery_source: row.discovery_source,
        rule_id: row.rule_id,
        scan_id: row.scan_id,
        evidence:
            typeof row.evidence === 'string' ? JSON.parse(row.evidence) : row.evidence || {},
        duplicate_of_source_id: row.duplicate_of_source_id,
        duplicate_of_suggestion_id: row.duplicate_of_suggestion_id,
        duplicate_reason: row.duplicate_reason,
        duplicate_confidence: row.duplicate_confidence != null ? Number(row.duplicate_confidence) : null,
        approved_by: row.approved_by,
        rejected_by: row.rejected_by,
        reviewed_at: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
        review_note: row.review_note,
        created_source_id: row.created_source_id,
        created_at: new Date(row.created_at).toISOString(),
        updated_at: new Date(row.updated_at).toISOString(),
    };
}

function mapScanRow(row) {
    return {
        id: row.id,
        status: row.status,
        added_count: Number(row.added_count),
        duplicate_count: Number(row.duplicate_count),
        blocked_count: Number(row.blocked_count),
        skipped_count: Number(row.skipped_count),
        error_message: row.error_message,
        metadata:
            typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
        started_at: new Date(row.started_at).toISOString(),
        finished_at: row.finished_at ? new Date(row.finished_at).toISOString() : null,
    };
}

function clampScore(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, n));
}

/** Derive success rate from fetch/error history — 0 when no fetches recorded. */
function deriveSuccessRate(row) {
    const fetchCount = Number(row.fetch_count || 0);
    const errorCount = Number(row.error_count || 0);
    const lastStatus = String(row.last_status || '').toLowerCase();
    if (fetchCount <= 0) return 0;

    const successes = Math.max(0, fetchCount - Math.min(errorCount, fetchCount));
    let rate = clampScore((100 * successes) / fetchCount);
    if (lastStatus === 'error' || lastStatus === 'failed' || lastStatus === 'timeout') {
        rate = clampScore(rate * 0.7);
    }
    return rate;
}

/** Derive reliability from success rate + health/status — conservative, no optimistic defaults. */
function deriveReliabilityScore(row, successRate) {
    const fetchCount = Number(row.fetch_count || 0);
    const healthStatus = String(row.health_status || row.status || '').toLowerCase();
    if (fetchCount <= 0 && !healthStatus) return 0;

    let score = successRate;
    if (
        healthStatus === 'degraded' ||
        healthStatus === 'unhealthy' ||
        healthStatus === 'error' ||
        healthStatus === 'failed'
    ) {
        score = clampScore(score * 0.5);
    } else if (fetchCount <= 0) {
        score = 0;
    }
    return clampScore(score);
}

async function loadSourceFingerprints() {
    const result = await query(
        `SELECT id, name, type, url, category,
                LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(url,''), '^https?://(www\\.)?', ''), '/.*$', '')) AS host_key,
                COALESCE(NULLIF(LOWER(REGEXP_REPLACE(url, '^https?://[^/]+', '')), ''), '/') AS path_key,
                fetch_count, error_count, last_status, health_status, status,
                last_fetch_at
         FROM data_sources WHERE is_active = true AND url IS NOT NULL`,
    );
    return result.rows.map(r => {
        const success_rate = deriveSuccessRate(r);
        return {
            id: r.id,
            name: r.name,
            type: r.type,
            url: r.url,
            category: r.category,
            host_key: (r.host_key || '').replace(/^www\./, ''),
            path_key: r.path_key || '/',
            success_rate,
            reliability_score: deriveReliabilityScore(r, success_rate),
            last_fetch_at: r.last_fetch_at,
        };
    });
}

async function loadActiveSuggestions() {
    const result = await query(
        `SELECT id, status, suggested_name, suggested_type, suggested_url, host_key, path_key, title_key
         FROM datahub_discovery_suggestions
         WHERE deleted_at IS NULL AND status IN ('pending', 'approved')`,
    );
    return result.rows;
}

function kindToSuggestedType(kind) {
    if (kind === 'website') return 'web';
    if (kind === 'telegram') return 'telegram';
    return kind;
}

async function gatherCandidates() {
    const candidates = [];
    const seen = new Set();

    const pushCandidate = c => {
        const key = `${c.hostKey}|${c.pathKey}|${c.suggestedType}`;
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push(c);
    };

    const collected = await query(
        `SELECT cd.id, cd.collected_at, cd.metadata, cd.normalized_data, ds.type AS source_type
         FROM collected_data cd
         JOIN data_sources ds ON ds.id = cd.source_id
         WHERE cd.collected_at > NOW() - INTERVAL '7 days'
         ORDER BY cd.collected_at DESC
         LIMIT 500`,
    );

    for (const row of collected.rows) {
        const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {};
        const norm =
            typeof row.normalized_data === 'string'
                ? JSON.parse(row.normalized_data)
                : row.normalized_data || {};
        const rawUrl = meta.url || norm.metadata?.url || meta.source_url;
        if (!rawUrl) continue;
        try {
            const { hostKey, pathKey, canonical } = normalizeDiscoveryUrl(rawUrl);
            const title = norm.content?.slice?.(0, 80) || norm.metadata?.title || meta.title;
            pushCandidate({
                suggestedName: title || hostKey,
                suggestedUrl: canonical,
                hostKey,
                pathKey,
                titleKey: normalizeTitleKey(title || hostKey),
                suggestedType: row.source_type === 'rss' ? 'rss' : 'web',
                discoverySource: 'crawler',
                category: 'uncategorized',
                evidence: { collected_data_id: row.id },
                freshnessHours: (Date.now() - new Date(row.collected_at)) / 3600000,
                crawlFrequency: 1,
            });
        } catch {
            /* SSRF skip */
        }
    }

    const channels = await query(
        `SELECT tc.id, tc.username, tc.title, tc.category, ds.id AS linked_source_id
         FROM telegram_channels tc
         LEFT JOIN data_sources ds ON ds.type = 'telegram' AND ds.url ILIKE '%' || tc.username || '%'
         LIMIT 200`,
    );

    for (const ch of channels.rows) {
        if (ch.linked_source_id) continue;
        const url = ch.username ? `https://t.me/${ch.username}` : null;
        if (!url) continue;
        try {
            const { hostKey, pathKey, canonical } = normalizeDiscoveryUrl(url);
            pushCandidate({
                suggestedName: ch.title || ch.username,
                suggestedUrl: canonical,
                hostKey,
                pathKey,
                titleKey: normalizeTitleKey(ch.title || ch.username),
                suggestedType: 'telegram',
                discoverySource: 'telegram',
                category: ch.category || 'telegram',
                evidence: { telegram_channel_id: ch.id },
                telegramMentions: 1,
            });
        } catch {
            /* skip */
        }
    }

    const rules = await query(
        `SELECT * FROM datahub_discovery_rules WHERE is_enabled = true AND deleted_at IS NULL`,
    );

    for (const rule of rules.rows) {
        try {
            if (rule.pattern.startsWith('http')) {
                const { hostKey, pathKey, canonical } = normalizeDiscoveryUrl(rule.pattern);
                pushCandidate({
                    suggestedName: rule.name,
                    suggestedUrl: canonical,
                    hostKey,
                    pathKey,
                    titleKey: normalizeTitleKey(rule.name),
                    suggestedType: kindToSuggestedType(rule.source_kind),
                    discoverySource: 'rule',
                    category: rule.category,
                    ruleId: rule.id,
                    rulePriority: rule.priority,
                    evidence: { rule_pattern: rule.pattern },
                });
            }
        } catch {
            /* skip invalid rule URL */
        }
    }

    return { candidates, rules: rules.rows };
}

export async function getDiscoverySettings() {
    const result = await query(`SELECT * FROM datahub_discovery_settings WHERE id = 1`);
    const row = result.rows[0] || { enabled: false, last_scan_at: null };
    return {
        enabled: row.enabled,
        last_scan_at: row.last_scan_at ? new Date(row.last_scan_at).toISOString() : null,
    };
}

export async function updateDiscoverySettings({ enabled }) {
    await query(
        `UPDATE datahub_discovery_settings SET enabled = $1, updated_at = NOW() WHERE id = 1`,
        [enabled],
    );
    return getDiscoverySettings();
}

export async function listDiscoveryRules() {
    const result = await query(
        `SELECT * FROM datahub_discovery_rules WHERE deleted_at IS NULL ORDER BY name ASC`,
    );
    return result.rows.map(mapRuleRow);
}

export async function createDiscoveryRule(body) {
    const result = await query(
        `INSERT INTO datahub_discovery_rules (name, pattern, source_kind, category, priority, is_enabled, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
            body.name.trim(),
            body.pattern.trim(),
            body.source_kind,
            body.category,
            body.priority,
            body.is_enabled !== false,
            JSON.stringify(body.metadata || {}),
        ],
    );
    return mapRuleRow(result.rows[0]);
}

export async function updateDiscoveryRule(id, body) {
    const fields = [];
    const params = [];
    let n = 1;
    const set = (col, val) => {
        fields.push(`${col} = $${n++}`);
        params.push(val);
    };
    if (body.name !== undefined) set('name', body.name.trim());
    if (body.pattern !== undefined) set('pattern', body.pattern.trim());
    if (body.source_kind !== undefined) set('source_kind', body.source_kind);
    if (body.category !== undefined) set('category', body.category);
    if (body.priority !== undefined) set('priority', body.priority);
    if (body.is_enabled !== undefined) set('is_enabled', body.is_enabled);
    if (body.metadata !== undefined) set('metadata', JSON.stringify(body.metadata));
    if (!fields.length) return listDiscoveryRules().then(r => r.find(x => x.id === id));
    params.push(id);
    const result = await query(
        `UPDATE datahub_discovery_rules SET ${fields.join(', ')} WHERE id = $${n} AND deleted_at IS NULL RETURNING *`,
        params,
    );
    if (!result.rows.length) {
        const err = new Error('Rule not found');
        err.status = 404;
        throw err;
    }
    return mapRuleRow(result.rows[0]);
}

export async function softDeleteDiscoveryRule(id) {
    const result = await query(
        `UPDATE datahub_discovery_rules SET deleted_at = NOW(), is_enabled = false WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
        [id],
    );
    if (!result.rows.length) {
        const err = new Error('Rule not found');
        err.status = 404;
        throw err;
    }
    return mapRuleRow(result.rows[0]);
}

export async function listSuggestions(filters = {}) {
    const clauses = ['deleted_at IS NULL'];
    const params = [];
    let n = 1;
    if (filters.status) {
        clauses.push(`status = $${n++}`);
        params.push(filters.status);
    }
    if (filters.discovery_source) {
        clauses.push(`discovery_source = $${n++}`);
        params.push(filters.discovery_source);
    }
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const result = await query(
        `SELECT * FROM datahub_discovery_suggestions
         WHERE ${clauses.join(' AND ')}
         ORDER BY priority_score DESC, created_at DESC
         LIMIT $${n++} OFFSET $${n++}`,
        [...params, limit, offset],
    );
    return result.rows.map(mapSuggestionRow);
}

export async function getDiscoveryStats() {
    const counts = await query(
        `SELECT status, COUNT(*)::int AS c FROM datahub_discovery_suggestions
         WHERE deleted_at IS NULL GROUP BY status`,
    );
    const byStatus = {};
    for (const row of counts.rows) byStatus[row.status] = row.c;
    const settings = await getDiscoverySettings();
    return {
        ...byStatus,
        pending: byStatus.pending || 0,
        approved: byStatus.approved || 0,
        rejected: byStatus.rejected || 0,
        duplicate: byStatus.duplicate || 0,
        settings,
    };
}

export async function listScanHistory(limit = 20) {
    const result = await query(
        `SELECT * FROM datahub_discovery_scans ORDER BY started_at DESC LIMIT $1`,
        [limit],
    );
    return result.rows.map(mapScanRow);
}

export async function runDiscoveryScan(userId) {
    const scanIns = await query(
        `INSERT INTO datahub_discovery_scans (status, triggered_by) VALUES ('running', $1) RETURNING *`,
        [userId || null],
    );
    const scanId = scanIns.rows[0].id;
    const stats = { added: 0, duplicates: 0, blocked: 0, skipped: 0 };

    try {
        const sources = await loadSourceFingerprints();
        const suggestions = await loadActiveSuggestions();
        const { candidates } = await gatherCandidates();

        for (const c of candidates) {
            try {
                assertSafeDiscoveryUrl(c.suggestedUrl);
            } catch (e) {
                stats.skipped += 1;
                if (e.code === 'SSRF_BLOCKED' || e.code === 'INVALID_URL') stats.blocked += 1;
                continue;
            }

            const filter = await evaluateFilterRules({
                url: c.suggestedUrl,
                text: c.suggestedName,
                apply_target: 'ingestion',
            });
            if (!filter.allowed) {
                stats.blocked += 1;
                continue;
            }

            const dup = checkDuplicateLayers(
                {
                    hostKey: c.hostKey,
                    pathKey: c.pathKey,
                    titleKey: c.titleKey,
                    suggestedType: c.suggestedType,
                },
                { sources, suggestions },
            );

            const reputation =
                sources.find(s => s.host_key === c.hostKey)?.reliability_score ?? 0;
            const categoryMatch = sources.some(s => s.category === c.category) ? 80 : 40;
            const score = computeDiscoveryScore({
                rulePriority: c.rulePriority || 'medium',
                discoverySource: c.discoverySource,
                categoryMatch,
                freshnessHours: c.freshnessHours ?? 48,
                uniquenessScore: dup.isDuplicate ? Math.max(0, 100 - dup.confidence) : 100,
                sourceReputation: reputation,
                crawlFrequency: c.crawlFrequency ?? 0,
                telegramMentions: c.telegramMentions ?? 0,
                blacklistPenalty: 0,
            });

            if (shouldSkipAsDuplicate(dup)) {
                try {
                    await query(
                        `INSERT INTO datahub_discovery_suggestions (
                            status, suggested_name, suggested_type, suggested_url,
                            host_key, path_key, title_key, category, priority_score,
                            discovery_source, rule_id, scan_id, evidence,
                            duplicate_of_source_id, duplicate_of_suggestion_id,
                            duplicate_reason, duplicate_confidence
                        ) VALUES (
                            'duplicate', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                            $13, $14, $15, $16
                        )`,
                        [
                            c.suggestedName,
                            c.suggestedType,
                            c.suggestedUrl,
                            c.hostKey,
                            c.pathKey,
                            c.titleKey,
                            c.category,
                            score,
                            c.discoverySource,
                            c.ruleId || null,
                            scanId,
                            JSON.stringify(c.evidence || {}),
                            dup.duplicateOfSourceId || null,
                            dup.duplicateOfSuggestionId || null,
                            dup.reason,
                            dup.confidence,
                        ],
                    );
                } catch (dupErr) {
                    logger.warn('duplicate suggestion insert skipped', dupErr.message);
                }
                stats.duplicates += 1;
                continue;
            }

            try {
                await query(
                    `INSERT INTO datahub_discovery_suggestions (
                        status, suggested_name, suggested_type, suggested_url,
                        host_key, path_key, title_key, category, priority_score,
                        discovery_source, rule_id, scan_id, evidence
                    ) VALUES (
                        'pending', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                    )`,
                    [
                        c.suggestedName,
                        c.suggestedType,
                        c.suggestedUrl,
                        c.hostKey,
                        c.pathKey,
                        c.titleKey,
                        c.category,
                        score,
                        c.discoverySource,
                        c.ruleId || null,
                        scanId,
                        JSON.stringify(c.evidence || {}),
                    ],
                );
                stats.added += 1;
                suggestions.push({
                    host_key: c.hostKey,
                    path_key: c.pathKey,
                    title_key: c.titleKey,
                    suggested_type: c.suggestedType,
                    status: 'pending',
                });
            } catch (e) {
                if (e.code === '23505') stats.duplicates += 1;
                else throw e;
            }
        }

        await query(
            `UPDATE datahub_discovery_scans SET status = 'success', added_count = $2,
             duplicate_count = $3, blocked_count = $4, skipped_count = $5, finished_at = NOW()
             WHERE id = $1`,
            [scanId, stats.added, stats.duplicates, stats.blocked, stats.skipped],
        );
        await query(
            `UPDATE datahub_discovery_settings SET last_scan_at = NOW(), updated_at = NOW() WHERE id = 1`,
        );

        const scan = await query(`SELECT * FROM datahub_discovery_scans WHERE id = $1`, [scanId]);
        return { scan: mapScanRow(scan.rows[0]), ...stats, scan_id: scanId };
    } catch (error) {
        await query(
            `UPDATE datahub_discovery_scans SET status = 'failed', error_message = $2, finished_at = NOW() WHERE id = $1`,
            [scanId, error.message],
        );
        throw error;
    }
}

export async function approveSuggestion(id, body, userId) {
    const sug = await query(
        `SELECT * FROM datahub_discovery_suggestions WHERE id = $1 AND deleted_at IS NULL`,
        [id],
    );
    if (!sug.rows.length) {
        const err = new Error('Suggestion not found');
        err.status = 404;
        throw err;
    }
    const row = sug.rows[0];
    if (row.status !== 'pending') {
        const err = new Error(`Cannot approve suggestion with status ${row.status}`);
        err.status = 409;
        throw err;
    }

    assertSafeDiscoveryUrl(row.suggested_url);

    const filter = await evaluateFilterRules({
        url: row.suggested_url,
        text: row.suggested_name,
        apply_target: 'ingestion',
    });
    if (!filter.allowed) {
        const err = new Error('Suggestion blocked by filter rules');
        err.status = 403;
        err.code = 'FILTER_BLOCKED';
        throw err;
    }

    const name = body.name?.trim() || row.suggested_name;
    const category = body.category || row.category;
    const dsType = row.suggested_type;

    const dsResult = await query(
        `INSERT INTO data_sources (name, type, url, category, is_active, config)
         VALUES ($1, $2, $3, $4, true, $5) RETURNING id`,
        [
            name,
            dsType,
            row.suggested_url,
            category,
            JSON.stringify({ created_from: 'discovery_approval', suggestion_id: id }),
        ],
    );
    const sourceId = dsResult.rows[0].id;

    await query(
        `UPDATE datahub_discovery_suggestions
         SET status = 'approved', approved_by = $2, reviewed_at = NOW(),
             review_note = $3, created_source_id = $4, updated_at = NOW()
         WHERE id = $1`,
        [id, userId, body.review_note || null, sourceId],
    );

    const updated = await query(`SELECT * FROM datahub_discovery_suggestions WHERE id = $1`, [id]);
    return { suggestion: mapSuggestionRow(updated.rows[0]), source_id: sourceId };
}

export async function rejectSuggestion(id, body, userId) {
    const result = await query(
        `UPDATE datahub_discovery_suggestions
         SET status = 'rejected', rejected_by = $2, reviewed_at = NOW(),
             review_note = $3, updated_at = NOW()
         WHERE id = $1 AND status = 'pending' AND deleted_at IS NULL
         RETURNING *`,
        [id, userId, body.review_note || null],
    );
    if (!result.rows.length) {
        const err = new Error('Pending suggestion not found');
        err.status = 404;
        throw err;
    }
    return mapSuggestionRow(result.rows[0]);
}
