/**
 * Pure Smart Prioritization scoring helpers (testable, no DB).
 * DH-SMARTPRIORITY-P2
 */

/** Minimum score boundaries: medium >= low, high >= high, critical >= critical */
export const DEFAULT_TIER_MINIMUMS = {
    low: 25,
    high: 50,
    critical: 75,
};

export const DEFAULT_FACTOR_WEIGHTS = {
    reliability: 20,
    success_rate: 10,
    freshness: 20,
    error_health: 15,
    category_importance: 15,
    source_type: 10,
    usage: 10,
};

const USAGE_SOFT_CAP = 200;

export function clamp01(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
}

export function clampScore(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, n));
}

/**
 * Tier from final score using configurable minimum thresholds.
 * Semantics: score >= critical → critical; >= high → high; >= low → medium; else low.
 * `tier_thresholds.low` is the minimum score for medium tier (legacy key name).
 */
export function tierFromScore(score, thresholds = DEFAULT_TIER_MINIMUMS) {
    const s = clampScore(score);
    const criticalMin = Number(thresholds?.critical ?? DEFAULT_TIER_MINIMUMS.critical);
    const highMin = Number(thresholds?.high ?? DEFAULT_TIER_MINIMUMS.high);
    const mediumMin = Number(thresholds?.low ?? DEFAULT_TIER_MINIMUMS.low);

    if (s >= criticalMin) return 'critical';
    if (s >= highMin) return 'high';
    if (s >= mediumMin) return 'medium';
    return 'low';
}

export function normalizeThresholds(raw) {
    const t = { ...DEFAULT_TIER_MINIMUMS };
    if (raw && typeof raw === 'object') {
        if (typeof raw.low === 'number') t.low = clampScore(raw.low);
        if (typeof raw.high === 'number') t.high = clampScore(raw.high);
        if (typeof raw.critical === 'number') t.critical = clampScore(raw.critical);
    }
    t.low = Math.min(t.low, t.high - 1);
    t.high = Math.min(Math.max(t.high, t.low + 1), t.critical - 1);
    t.critical = Math.max(t.critical, t.high + 1);
    return t;
}

function sourceTypeFactor(type) {
    const t = String(type || '').toLowerCase();
    if (t === 'api') return 1.0;
    if (t === 'rss') return 0.9;
    if (t === 'web' || t === 'website') return 0.85;
    if (t === 'telegram') return 0.8;
    return 0.85;
}

/** Fetch-path success rate — 0 when no fetches recorded. */
export function deriveFetchSuccessRate(row) {
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

export function deriveFetchReliability(row, successRate) {
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

export function deriveFetchFreshness(row) {
    const refreshIntervalMin = Number(row.refresh_interval || 60);
    const lastFetchAt = row.last_fetch_at ? new Date(row.last_fetch_at).getTime() : null;
    const ageMin = lastFetchAt ? (Date.now() - lastFetchAt) / 60000 : null;
    const freshnessRatio = ageMin == null ? 0 : 1 - ageMin / Math.max(1, refreshIntervalMin);
    return clampScore(100 * clamp01(freshnessRatio));
}

export function deriveFetchErrorHealth(row) {
    const errorCount = Number(row.error_count || 0);
    const fetchCount = Number(row.fetch_count || 0);
    const lastStatus = String(row.last_status || '').toLowerCase();
    const healthStatus = String(row.health_status || row.status || '').toLowerCase();
    const healthPenalty =
        lastStatus === 'error' || lastStatus === 'failed'
            ? 0.7
            : healthStatus === 'degraded' || healthStatus === 'unhealthy' || healthStatus === 'error'
              ? 0.5
              : 1.0;
    const errorFactor = fetchCount > 0 ? 1 / (1 + Math.max(0, errorCount) / 5) : 0;
    return clampScore(100 * clamp01(errorFactor * healthPenalty));
}

/** Telegram freshness from latest collected/processed timestamp. */
export function telegramFreshnessFromLatestAt(latestAt) {
    if (!latestAt) return 0;
    const ageMin = (Date.now() - new Date(latestAt).getTime()) / 60000;
    if (ageMin <= 15) return 100;
    if (ageMin <= 60) return 80;
    if (ageMin <= 360) return 50;
    if (ageMin <= 1440) return 25;
    return 0;
}

/** Telegram success rate from 24h collected_data (pending excluded from denominator). */
export function telegramSuccessRate(processed24h, error24h) {
    const processed = Number(processed24h || 0);
    const errors = Number(error24h || 0);
    const resolved = processed + errors;
    if (resolved <= 0) return 0;
    return clampScore((100 * processed) / resolved);
}

/** Telegram reliability from collector operational status + success rate + activity. */
export function telegramReliability(operationalStatus, successRate, processed24h) {
    const sr = clampScore(successRate);
    const active = Number(processed24h || 0) > 0;

    switch (operationalStatus) {
        case 'error':
            return clampScore(Math.min(sr, 20));
        case 'pending':
            return clampScore(active ? Math.max(sr * 0.6, 35) : 25);
        case 'linked':
            return clampScore(active ? Math.max(sr * 0.5, 30) : 20);
        case 'active':
            if (active && sr >= 80) return clampScore(Math.max(sr, 85));
            if (active) return clampScore(Math.max(sr * 0.85, 60));
            return clampScore(Math.max(sr * 0.5, 40));
        default:
            return sr;
    }
}

/** Telegram error health from 24h collected_data rows (no fetch_count gate). */
export function telegramErrorHealth(processed24h, error24h, total24h) {
    const total = Number(total24h || 0) || Number(processed24h || 0) + Number(error24h || 0);
    if (total <= 0) return 0;
    const errors = Number(error24h || 0);
    const errorFactor = 1 / (1 + errors / 5);
    return clampScore(100 * clamp01(errorFactor));
}

/** Telegram usage signal from processed volume last 24h. */
export function telegramUsageScore(processed24h) {
    return clampScore(100 * clamp01(Number(processed24h || 0) / USAGE_SOFT_CAP));
}

/**
 * @param {object} row - data_sources row
 * @param {Record<string, number>} weights
 * @param {number} usageCount - data_hub_logs 24h count (non-telegram path)
 * @param {object|null} telegramMetrics
 * @param {object} tierThresholds
 */
export function computeScoresForSource(row, weights, usageCount, telegramMetrics, tierThresholds) {
    const isTelegram = String(row.type || '').toLowerCase() === 'telegram';
    const useTelegramPath = isTelegram && telegramMetrics != null;

    let successRate;
    let reliability;
    let freshnessScore;
    let errorHealthScore;
    let usageScore;

    if (useTelegramPath) {
        const tm = telegramMetrics;
        successRate = telegramSuccessRate(tm.processed_24h, tm.error_24h);
        reliability = telegramReliability(tm.operational_status, successRate, tm.processed_24h);
        freshnessScore = telegramFreshnessFromLatestAt(tm.latest_at);
        errorHealthScore = telegramErrorHealth(tm.processed_24h, tm.error_24h, tm.total_24h);
        usageScore = telegramUsageScore(tm.processed_24h);
    } else {
        successRate = deriveFetchSuccessRate(row);
        reliability = deriveFetchReliability(row, successRate);
        freshnessScore = deriveFetchFreshness(row);
        errorHealthScore = deriveFetchErrorHealth(row);
        usageScore = clampScore(100 * clamp01((usageCount || 0) / USAGE_SOFT_CAP));
    }

    const category = String(row.category || 'uncategorized');
    const categoryImportanceScore = category === 'uncategorized' ? 50 : 70;
    const sourceTypeScore = clampScore(100 * clamp01(sourceTypeFactor(row.type)));

    const breakdown = {
        reliability,
        success_rate: successRate,
        freshness: freshnessScore,
        error_health: errorHealthScore,
        category_importance: categoryImportanceScore,
        source_type: sourceTypeScore,
        usage: usageScore,
        meta: {
            scoring_path: useTelegramPath ? 'telegram_collected_data' : 'fetch_scheduler',
            refresh_interval_min: Number(row.refresh_interval || 60),
            last_status: row.last_status ? String(row.last_status).toLowerCase() : null,
            health_status: row.health_status
                ? String(row.health_status).toLowerCase()
                : row.status
                  ? String(row.status).toLowerCase()
                  : null,
            fetch_count: Number(row.fetch_count || 0),
            error_count: Number(row.error_count || 0),
            usage_24h: useTelegramPath ? Number(telegramMetrics.processed_24h || 0) : usageCount || 0,
            ...(useTelegramPath
                ? {
                      telegram_operational_status: telegramMetrics.operational_status,
                      collected_total_24h: telegramMetrics.total_24h,
                      collected_processed_24h: telegramMetrics.processed_24h,
                      collected_error_24h: telegramMetrics.error_24h,
                      collected_pending_24h: telegramMetrics.pending_24h,
                      latest_collected_at: telegramMetrics.latest_at,
                  }
                : {}),
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
    const suggested_tier = tierFromScore(calculated_score, tierThresholds);

    return { calculated_score, suggested_tier, score_breakdown: breakdown };
}
