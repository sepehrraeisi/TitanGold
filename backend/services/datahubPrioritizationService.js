import { query, transaction } from '../database/db.js';

const DEFAULT_FACTOR_WEIGHTS = {
    reliability: 20,
    success_rate: 10,
    freshness: 20,
    error_health: 15,
    category_importance: 15,
    source_type: 10,
    usage: 10,
};

// NOTE: v3.0 tier mapping is deterministic and fixed (auditable).
// Ranges (inclusive) by final score:
// 0–24   => low
// 25–49  => medium
// 50–74  => high
// 75–100 => critical
const DEFAULT_THRESHOLDS = {
    low: 40,
    high: 60,
    critical: 80,
};

function clamp01(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
}

function clampScore(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, n));
}

function normalizeFactorWeights(raw) {
    const weights = {};
    for (const [k, v] of Object.entries(raw || {})) {
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
            weights[k] = v;
        }
    }
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (sum === 0) return { ...DEFAULT_FACTOR_WEIGHTS };
    return weights;
}

function assertWeightsSum100(weights) {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.round(sum) !== 100) {
        const err = new Error('Factor weights must sum to 100');
        err.status = 400;
        err.code = 'INVALID_WEIGHTS';
        err.details = { sum };
        throw err;
    }
}

function normalizeThresholds(raw) {
    const t = { ...DEFAULT_THRESHOLDS };
    if (raw && typeof raw === 'object') {
        if (typeof raw.low === 'number') t.low = clampScore(raw.low);
        if (typeof raw.high === 'number') t.high = clampScore(raw.high);
        if (typeof raw.critical === 'number') t.critical = clampScore(raw.critical);
    }
    // enforce ordering low < high < critical
    t.low = Math.min(t.low, t.high - 1);
    t.high = Math.min(Math.max(t.high, t.low + 1), t.critical - 1);
    t.critical = Math.max(t.critical, t.high + 1);
    return t;
}

function tierFromScoreDeterministic(score) {
    const s = clampScore(score);
    if (s <= 24) return 'low';
    if (s <= 49) return 'medium';
    if (s <= 74) return 'high';
    return 'critical';
}

function sourceTypeFactor(type) {
    // explicit + auditable; v3.0 only affects prioritization score, not source behavior
    const t = String(type || '').toLowerCase();
    if (t === 'api') return 1.0;
    if (t === 'rss') return 0.9;
    if (t === 'web' || t === 'website') return 0.85;
    if (t === 'telegram') return 0.8;
    return 0.85;
}

async function ensureSettingsRow() {
    // Ensure singleton exists
    await query(
        `INSERT INTO datahub_prioritization_settings (singleton_key, is_enabled, factor_weights, tier_thresholds)
         VALUES (1, FALSE, '{}'::jsonb, '{}'::jsonb)
         ON CONFLICT (singleton_key) DO NOTHING`,
    );
}

export async function getPrioritizationSettings() {
    await ensureSettingsRow();
    const res = await query(
        `SELECT is_enabled, factor_weights, tier_thresholds, updated_at
         FROM datahub_prioritization_settings
         WHERE singleton_key = 1
         LIMIT 1`,
    );
    const row = res.rows[0] || {};
    const factor_weights = normalizeFactorWeights(row.factor_weights || DEFAULT_FACTOR_WEIGHTS);
    const tier_thresholds = normalizeThresholds(row.tier_thresholds || DEFAULT_THRESHOLDS);
    return {
        is_enabled: Boolean(row.is_enabled),
        factor_weights,
        tier_thresholds,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
}

export async function updatePrioritizationSettings(body, userId) {
    await ensureSettingsRow();
    const factor_weights = normalizeFactorWeights(body.factor_weights);
    assertWeightsSum100(factor_weights);
    const tier_thresholds = normalizeThresholds(body.tier_thresholds);

    const res = await query(
        `UPDATE datahub_prioritization_settings
         SET is_enabled = $1,
             factor_weights = $2,
             tier_thresholds = $3,
             updated_by = $4,
             updated_at = NOW()
         WHERE singleton_key = 1
         RETURNING is_enabled, factor_weights, tier_thresholds, updated_at`,
        [body.is_enabled, factor_weights, tier_thresholds, userId || null],
    );
    const row = res.rows[0];
    return {
        is_enabled: Boolean(row.is_enabled),
        factor_weights: normalizeFactorWeights(row.factor_weights),
        tier_thresholds: normalizeThresholds(row.tier_thresholds),
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
}

async function getUsageCountsLast24h() {
    // Use data_hub_logs if it exists (optional signal).
    const exists = await query(`SELECT to_regclass('public.data_hub_logs') IS NOT NULL AS ok`);
    if (!exists.rows[0]?.ok) return new Map();

    // schema unknown; we assume source_id exists (as used in routes). Guard with try/catch.
    try {
        const res = await query(
            `SELECT source_id, COUNT(*)::int AS cnt
             FROM data_hub_logs
             WHERE created_at >= NOW() - INTERVAL '24 hours'
             GROUP BY source_id`,
        );
        const map = new Map();
        for (const r of res.rows) map.set(String(r.source_id), Number(r.cnt || 0));
        return map;
    } catch {
        return new Map();
    }
}

function computeScoresForSource(row, weights, usageCount) {
    const reliability = clampScore(Number(row.reliability_score || 0));
    const successRate = clampScore(Number(row.success_rate || 0));

    const errorCount = Number(row.error_count || 0);
    const lastStatus = String(row.last_status || '').toLowerCase();
    const healthPenalty = lastStatus === 'error' ? 0.7 : 1.0;
    const errorFactor = 1 / (1 + Math.max(0, errorCount) / 5); // 0..1
    const errorHealthScore = clampScore(100 * clamp01(errorFactor * healthPenalty));

    const refreshIntervalMin = Number(row.refresh_interval || 60);
    const lastFetchAt = row.last_fetch_at ? new Date(row.last_fetch_at).getTime() : null;
    const ageMin = lastFetchAt ? (Date.now() - lastFetchAt) / 60000 : null;
    const freshnessRatio = ageMin == null ? 0 : 1 - ageMin / Math.max(1, refreshIntervalMin);
    const freshnessScore = clampScore(100 * clamp01(freshnessRatio));

    const category = String(row.category || 'uncategorized');
    // v3.0: deterministic placeholder. Later can be admin-configurable map.
    const categoryImportanceScore = category === 'uncategorized' ? 50 : 70;

    const typeMultiplier = sourceTypeFactor(row.type);
    const sourceTypeScore = clampScore(100 * clamp01(typeMultiplier));

    // usage signal normalized against a soft cap
    const usageSoftCap = 200;
    const usageScore = clampScore(100 * clamp01((usageCount || 0) / usageSoftCap));

    const breakdown = {
        reliability,
        success_rate: successRate,
        freshness: freshnessScore,
        error_health: errorHealthScore,
        category_importance: categoryImportanceScore,
        source_type: sourceTypeScore,
        usage: usageScore,
        meta: {
            refresh_interval_min: refreshIntervalMin,
            last_status: lastStatus || null,
            error_count: errorCount,
            usage_24h: usageCount || 0,
        },
    };

    const score =
        (breakdown.reliability * (weights.reliability || 0) +
            breakdown.success_rate * (weights.success_rate || 0) +
            breakdown.freshness * (weights.freshness || 0) +
            breakdown.error_health * (weights.error_health || 0) +
            breakdown.category_importance * (weights.category_importance || 0) +
            breakdown.source_type * (weights.source_type || 0) +
            breakdown.usage * (weights.usage || 0)) /
        100;

    const calculated_score = clampScore(Math.round(score * 10) / 10);
    const suggested_tier = tierFromScoreDeterministic(calculated_score);

    return { calculated_score, suggested_tier, score_breakdown: breakdown };
}

export async function previewPrioritization(userId) {
    const settings = await getPrioritizationSettings();
    if (!settings.is_enabled) {
        const err = new Error('Prioritization is disabled');
        err.status = 400;
        err.code = 'PRIORITIZATION_DISABLED';
        throw err;
    }

    const weights = normalizeFactorWeights(settings.factor_weights);
    assertWeightsSum100(weights);
    const usageMap = await getUsageCountsLast24h();

    const sourcesRes = await query(
        `SELECT id, name, type, category, reliability_score, success_rate, error_count, last_status,
                refresh_interval, last_fetch_at
         FROM data_sources
         WHERE is_active = TRUE`,
    );

    const rows = [];
    const tierHistogram = { low: 0, medium: 0, high: 0, critical: 0 };

    const settingsSnapshot = {
        factor_weights: settings.factor_weights,
        // v3.0 tier mapping is fixed; stored for audit/debug.
        tier_thresholds: settings.tier_thresholds,
        deterministic_mapping: true,
    };

    const startedAt = new Date();
    const runInsertRes = await query(
        `INSERT INTO datahub_prioritization_runs
            (run_type, source_count, summary, created_by, applied_by, settings_snapshot, preview_only, status, started_at)
         VALUES
            ('preview', $1, '{}'::jsonb, $2, NULL, $3, TRUE, 'success', NOW())
         RETURNING id`,
        [sourcesRes.rows.length, userId || null, settingsSnapshot],
    );
    const runId = String(runInsertRes.rows[0].id);

    try {
        for (const s of sourcesRes.rows) {
        const sourceId = String(s.id);
        const usageCount = usageMap.get(sourceId) || 0;
        const computed = computeScoresForSource(s, weights, usageCount);

        // existing override (if any)
        const existing = await query(
            `SELECT override_score, override_note, overridden_by, overridden_at
             FROM datahub_source_priorities
             WHERE source_id = $1`,
            [sourceId],
        );
        const override = existing.rows[0] || null;
        const overrideScore =
            override && override.override_score != null ? Number(override.override_score) : null;
        const finalScore = overrideScore != null ? clampScore(overrideScore) : computed.calculated_score;
        const finalTier = tierFromScoreDeterministic(finalScore);

        tierHistogram[finalTier] = (tierHistogram[finalTier] || 0) + 1;

        await query(
            `INSERT INTO datahub_source_priorities
                (source_id, calculated_score, suggested_tier, score_breakdown, last_preview_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (source_id) DO UPDATE SET
                calculated_score = EXCLUDED.calculated_score,
                suggested_tier = EXCLUDED.suggested_tier,
                score_breakdown = EXCLUDED.score_breakdown,
                last_preview_at = NOW()`,
            [sourceId, computed.calculated_score, finalTier, computed.score_breakdown],
        );

        rows.push({
            source_id: sourceId,
            source_name: String(s.name || ''),
            source_type: String(s.type || ''),
            category: s.category != null ? String(s.category) : null,
            calculated_score: computed.calculated_score,
            final_score: finalScore,
            suggested_tier: finalTier,
            score_breakdown: computed.score_breakdown,
            override_score: overrideScore,
            override_note: override ? override.override_note ?? null : null,
            overridden_by: override ? override.overridden_by ?? null : null,
            overridden_at: override?.overridden_at ? new Date(override.overridden_at).toISOString() : null,
            last_preview_at: new Date().toISOString(),
            last_applied_at: null,
        });
    }

        await query(
            `UPDATE datahub_prioritization_runs
             SET completed_at = NOW(),
                 status = 'success',
                 summary = $1
             WHERE id = $2`,
            [tierHistogram, runId],
        );

        return {
            run: { id: runId, created_at: startedAt.toISOString() },
            summary: tierHistogram,
            sources: rows,
        };
    } catch (e) {
        await query(
            `UPDATE datahub_prioritization_runs
             SET completed_at = NOW(),
                 status = 'failed',
                 error_summary = $1
             WHERE id = $2`,
            [{ message: e?.message || 'Preview failed', code: e?.code || null }, runId],
        );
        throw e;
    }
}

export async function listPrioritizationSources() {
    const res = await query(
        `SELECT sp.source_id, ds.name AS source_name, ds.type AS source_type, ds.category,
                sp.calculated_score, sp.suggested_tier, sp.score_breakdown,
                sp.override_score, sp.override_note, sp.overridden_by, sp.overridden_at,
                sp.last_preview_at, sp.last_applied_at
         FROM datahub_source_priorities sp
         JOIN data_sources ds ON ds.id = sp.source_id
         WHERE ds.is_active = TRUE
         ORDER BY sp.calculated_score DESC, ds.name ASC`,
    );

    return res.rows.map((r) => {
        const overrideScore = r.override_score != null ? Number(r.override_score) : null;
        const calculated = Number(r.calculated_score || 0);
        const finalScore = overrideScore != null ? clampScore(overrideScore) : clampScore(calculated);
        const tier = tierFromScoreDeterministic(finalScore);
        return {
            source_id: String(r.source_id),
            source_name: String(r.source_name || ''),
            source_type: String(r.source_type || ''),
            category: r.category != null ? String(r.category) : null,
            calculated_score: calculated,
            final_score: finalScore,
            suggested_tier: tier,
            score_breakdown: r.score_breakdown || {},
            override_score: overrideScore,
            override_note: r.override_note ?? null,
            overridden_by: r.overridden_by ?? null,
            overridden_at: r.overridden_at ? new Date(r.overridden_at).toISOString() : null,
            last_preview_at: r.last_preview_at ? new Date(r.last_preview_at).toISOString() : null,
            last_applied_at: r.last_applied_at ? new Date(r.last_applied_at).toISOString() : null,
        };
    });
}

export async function applyPrioritization({ userId, confirmApply, sourceIds }) {
    if (confirmApply !== true) {
        const err = new Error('Apply requires explicit confirmation');
        err.status = 400;
        err.code = 'CONFIRM_APPLY_REQUIRED';
        throw err;
    }

    const settings = await getPrioritizationSettings();
    if (!settings.is_enabled) {
        const err = new Error('Prioritization is disabled');
        err.status = 400;
        err.code = 'PRIORITIZATION_DISABLED';
        throw err;
    }

    const ids = Array.isArray(sourceIds) && sourceIds.length > 0 ? sourceIds : null;

    const previewRes = await query(
        `SELECT source_id, calculated_score, suggested_tier, override_score
         FROM datahub_source_priorities
         ${ids ? `WHERE source_id = ANY($1::uuid[])` : ''}`,
        ids ? [ids] : [],
    );

    const settingsSnapshot = {
        factor_weights: settings.factor_weights,
        tier_thresholds: settings.tier_thresholds,
        deterministic_mapping: true,
    };

    const startedAt = new Date();
    const runInsertRes = await query(
        `INSERT INTO datahub_prioritization_runs
            (run_type, source_count, summary, created_by, applied_by, settings_snapshot, preview_only, status, started_at)
         VALUES
            ('apply', $1, '{}'::jsonb, $2, $3, $4, FALSE, 'success', NOW())
         RETURNING id`,
        [previewRes.rows.length, userId || null, userId || null, settingsSnapshot],
    );
    const runId = String(runInsertRes.rows[0].id);

    let applied = 0;
    const tierHistogram = { low: 0, medium: 0, high: 0, critical: 0 };

    try {
        await transaction(async (client) => {
            for (const r of previewRes.rows) {
                const sourceId = String(r.source_id);
                const overrideScore = r.override_score != null ? Number(r.override_score) : null;
                const finalScore = overrideScore != null ? clampScore(overrideScore) : clampScore(Number(r.calculated_score));
                const tier = tierFromScoreDeterministic(finalScore);

                // Apply writes to data_sources (only here) — must be atomic.
                await client.query(
                    `UPDATE data_sources
                     SET priority = $2,
                         priority_score = $3,
                         priority_updated_at = NOW()
                     WHERE id = $1 AND is_active = TRUE`,
                    [sourceId, tier, finalScore],
                );

                await client.query(
                    `UPDATE datahub_source_priorities
                     SET last_applied_at = NOW(),
                         last_applied_by = $2
                     WHERE source_id = $1`,
                    [sourceId, userId || null],
                );

                tierHistogram[tier] = (tierHistogram[tier] || 0) + 1;
                applied += 1;
            }
        });

        await query(
            `UPDATE datahub_prioritization_runs
             SET completed_at = NOW(),
                 status = 'success',
                 summary = $1
             WHERE id = $2`,
            [tierHistogram, runId],
        );

        return {
            run: { id: runId, created_at: startedAt.toISOString() },
            summary: tierHistogram,
            applied,
        };
    } catch (e) {
        await query(
            `UPDATE datahub_prioritization_runs
             SET completed_at = NOW(),
                 status = 'failed',
                 error_summary = $1
             WHERE id = $2`,
            [{ message: e?.message || 'Apply failed', code: e?.code || null }, runId],
        );
        throw e;
    }
}

export async function setSourceOverride(sourceId, { override_score, override_note }, userId) {
    // override_score can be null to clear override (still explicit)
    const res = await query('SELECT id FROM data_sources WHERE id = $1', [sourceId]);
    if (res.rows.length === 0) {
        const err = new Error('Source not found');
        err.status = 404;
        err.code = 'SOURCE_NOT_FOUND';
        throw err;
    }

    await query(
        `INSERT INTO datahub_source_priorities (source_id, calculated_score, suggested_tier, score_breakdown, last_preview_at)
         VALUES ($1, 0, 'medium', '{}'::jsonb, NOW())
         ON CONFLICT (source_id) DO NOTHING`,
        [sourceId],
    );

    await query(
        `UPDATE datahub_source_priorities
         SET override_score = $2,
             override_note = $3,
             overridden_by = $4,
             overridden_at = NOW()
         WHERE source_id = $1`,
        [sourceId, override_score, override_note ?? null, userId || null],
    );

    return { source_id: sourceId, override_score, override_note: override_note ?? null };
}

export async function listPrioritizationRuns({ limit, offset }) {
    const res = await query(
        `SELECT id, run_type, source_count, summary, created_by, created_at
         FROM datahub_prioritization_runs
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
    );
    return res.rows.map((r) => ({
        id: String(r.id),
        run_type: String(r.run_type),
        source_count: Number(r.source_count || 0),
        summary: r.summary || {},
        created_by: r.created_by ?? null,
        created_at: new Date(r.created_at).toISOString(),
    }));
}

