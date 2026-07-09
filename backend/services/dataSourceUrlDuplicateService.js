import { query } from '../database/db.js';
import {
    duplicateUrlKey,
    isUrlBearingSourceType,
    normalizeTelegramChannelIdentity,
    normalizeUrlForDuplicateCheck,
} from '../utils/urlDuplicateNormalization.js';
import { getOrLoadCached, invalidatePipelineSnapshotCache } from './pipelineSnapshotCache.js';

export function parseSourceConfig(config) {
    if (!config) return {};
    if (typeof config === 'string') {
        try {
            return JSON.parse(config);
        } catch {
            return {};
        }
    }
    return config;
}

function sourceIgnoresDuplicate(config) {
    const parsed = parseSourceConfig(config);
    return parsed.ignore_duplicate_url === true;
}

function mapDuplicateSourceRow(row, crawlerBySourceId) {
    const config = parseSourceConfig(row.config);
    const crawler = crawlerBySourceId.get(row.id);
    return {
        id: row.id,
        name: row.name,
        type: row.type,
        url: row.url,
        normalizedUrl: row.normalized_url,
        isActive: row.is_active === true,
        ignoreDuplicateUrl: sourceIgnoresDuplicate(row.config),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        lastFetchAt: row.last_fetch_at ? new Date(row.last_fetch_at).toISOString() : null,
        refreshInterval: row.refresh_interval != null ? Number(row.refresh_interval) : null,
        fetchCount: Number(row.fetch_count || 0),
        errorCount: Number(row.error_count || 0),
        collectedCount: Number(row.collected_count || 0),
        lastCollectedAt: row.last_collected_at
            ? new Date(row.last_collected_at).toISOString()
            : null,
        crawlerLinked: Boolean(crawler),
        crawlerId: crawler?.id ?? null,
        crawlerName: crawler?.name ?? null,
        flagReason: 'Same normalized URL',
    };
}

/**
 * Severity: high | medium | low | info (all sources ignored)
 */
export function computeDuplicateGroupSeverity(sources, { groupIgnored = false } = {}) {
    if (groupIgnored) return 'info';
    const activeCount = sources.filter(s => s.isActive).length;
    if (activeCount > 1) return 'high';
    if (activeCount === 1 && sources.length > 1) return 'medium';
    if (sources.length > 1) return 'low';
    return null;
}

function isGroupFullyIgnored(sources) {
    return sources.length > 0 && sources.every(s => s.ignoreDuplicateUrl);
}

async function loadCrawlersBySourceId() {
    const result = await query(
        `SELECT id, source_id, name FROM datahub_crawlers
         WHERE deleted_at IS NULL`,
    );
    return new Map(result.rows.map(r => [r.source_id, r]));
}

async function loadUrlBearingSourcesWithStats() {
    const result = await query(
        `SELECT ds.id, ds.name, ds.type, ds.url, ds.config, ds.is_active, ds.created_at,
                ds.last_fetch_at, ds.refresh_interval, ds.fetch_count, ds.error_count,
                COUNT(cd.id)::int AS collected_count,
                MAX(cd.collected_at) AS last_collected_at
         FROM data_sources ds
         LEFT JOIN collected_data cd ON cd.source_id = ds.id
         WHERE ds.type IN ('rss', 'web', 'api')
           AND ds.url IS NOT NULL
           AND trim(ds.url) <> ''
         GROUP BY ds.id
         ORDER BY ds.type ASC, ds.name ASC`,
    );

    return result.rows.map(row => {
        const normalized_url = normalizeUrlForDuplicateCheck(row.url);
        return {
            ...row,
            normalized_url,
            is_active: row.is_active === true,
        };
    });
}

async function loadUrlBearingSourcesForDuplicateKeys() {
    const result = await query(
        `SELECT id, name, type, url, config, is_active, created_at,
                last_fetch_at, refresh_interval, fetch_count, error_count
         FROM data_sources
         WHERE type IN ('rss', 'web', 'api')
           AND url IS NOT NULL
           AND trim(url) <> ''
         ORDER BY type ASC, name ASC`,
    );

    return result.rows.map(row => {
        const normalized_url = normalizeUrlForDuplicateCheck(row.url);
        return {
            ...row,
            normalized_url,
            is_active: row.is_active === true,
            collected_count: 0,
            last_collected_at: null,
        };
    });
}

function buildDuplicateIndexes(sources, crawlerBySourceId) {
    const groupsByKey = new Map();

    for (const row of sources) {
        if (!row.normalized_url) continue;
        const key = duplicateUrlKey(row.type, row.normalized_url);
        if (!groupsByKey.has(key)) groupsByKey.set(key, []);
        groupsByKey.get(key).push(row);
    }

    const duplicateGroups = [];
    const enrichmentBySourceId = new Map();

    for (const [key, rows] of groupsByKey.entries()) {
        if (rows.length < 2) continue;

        const mappedSources = rows.map(r => mapDuplicateSourceRow(r, crawlerBySourceId));
        const groupIgnored = isGroupFullyIgnored(mappedSources);
        const activeCount = mappedSources.filter(s => s.isActive).length;
        const inactiveCount = mappedSources.length - activeCount;
        const totalCollectedCount = mappedSources.reduce((sum, s) => sum + s.collectedCount, 0);
        const lastCollectedAt = mappedSources
            .map(s => s.lastCollectedAt)
            .filter(Boolean)
            .sort()
            .pop() || null;
        const severity = computeDuplicateGroupSeverity(mappedSources, { groupIgnored });

        duplicateGroups.push({
            type: rows[0].type,
            normalizedUrl: rows[0].normalized_url,
            duplicateUrlKey: key,
            sources: mappedSources,
            sourceCount: mappedSources.length,
            activeCount,
            inactiveCount,
            totalCollectedCount,
            lastCollectedAt,
            severity,
            ignored: groupIgnored,
            flagReason: 'Same normalized URL',
        });

        for (const source of mappedSources) {
            const siblings = mappedSources.filter(s => s.id !== source.id);
            enrichmentBySourceId.set(source.id, {
                normalized_url: source.normalizedUrl,
                duplicate_url_key: key,
                duplicate_url_count: mappedSources.length,
                duplicate_active_count: activeCount,
                duplicate_url_severity: severity,
                duplicate_url_ignored: groupIgnored,
                duplicate_url_siblings: siblings.map(s => ({
                    id: s.id,
                    name: s.name,
                    type: s.type,
                    url: s.url,
                    normalizedUrl: s.normalizedUrl,
                    isActive: s.isActive,
                    createdAt: s.createdAt,
                    lastFetchAt: s.lastFetchAt,
                    collectedCount: s.collectedCount,
                    lastCollectedAt: s.lastCollectedAt,
                })),
            });
        }
    }

    duplicateGroups.sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2, info: 3 };
        return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
    });

    return { duplicateGroups, enrichmentBySourceId };
}

export function summarizeDuplicateGroups(groups) {
    const visible = groups.filter(g => !g.ignored);
    let activeDuplicateSources = 0;
    let inactiveDuplicateSources = 0;
    for (const g of visible) {
        activeDuplicateSources += g.activeCount;
        inactiveDuplicateSources += g.inactiveCount;
    }
    return {
        duplicateGroups: visible.length,
        activeDuplicateSources,
        inactiveDuplicateSources,
        highRiskGroups: visible.filter(g => g.severity === 'high').length,
        totalGroupsIncludingIgnored: groups.length,
        ignoredGroups: groups.filter(g => g.ignored).length,
    };
}

async function buildDuplicateUrlDashboardUncached() {
    const [sources, crawlerBySourceId] = await Promise.all([
        loadUrlBearingSourcesWithStats(),
        loadCrawlersBySourceId(),
    ]);
    const { duplicateGroups } = buildDuplicateIndexes(sources, crawlerBySourceId);
    return {
        summary: summarizeDuplicateGroups(duplicateGroups),
        groups: duplicateGroups,
    };
}

export async function getDuplicateUrlDashboard() {
    if (process.env.NODE_ENV === 'test') {
        return buildDuplicateUrlDashboardUncached();
    }
    return getOrLoadCached('pipeline:duplicate-analysis:dashboard', buildDuplicateUrlDashboardUncached, 600_000);
}

/** Health tab lazy data-quality — long TTL, separate from sources list refresh. */
export async function getDuplicateUrlSummaryForHealthMonitoring() {
    if (process.env.NODE_ENV === 'test') {
        const dashboard = await buildDuplicateUrlDashboardUncached();
        return {
            duplicateUrlGroups: dashboard.summary.duplicateGroups,
            highRiskDuplicateGroups: dashboard.summary.highRiskGroups,
            ignoredDuplicateGroups: dashboard.summary.ignoredGroups,
        };
    }
    return getOrLoadCached(
        'datahub:health:data-quality:v1',
        async () => {
            const dashboard = await buildDuplicateUrlDashboardUncached();
            return {
                duplicateUrlGroups: dashboard.summary.duplicateGroups,
                highRiskDuplicateGroups: dashboard.summary.highRiskGroups,
                ignoredDuplicateGroups: dashboard.summary.ignoredGroups,
            };
        },
        600_000,
    );
}

export async function listDuplicateUrlGroups() {
    const dashboard = await getDuplicateUrlDashboard();
    return dashboard.groups;
}

export async function getDuplicateUrlSummaryForHealth() {
    const dashboard = await getDuplicateUrlDashboard();
    return {
        duplicateUrlGroups: dashboard.summary.duplicateGroups,
        highRiskDuplicateGroups: dashboard.summary.highRiskGroups,
        ignoredDuplicateGroups: dashboard.summary.ignoredGroups,
    };
}

async function buildDuplicateEnrichmentBySourceIdUncached() {
    const [sources, crawlerBySourceId] = await Promise.all([
        loadUrlBearingSourcesWithStats(),
        loadCrawlersBySourceId(),
    ]);
    const { enrichmentBySourceId } = buildDuplicateIndexes(sources, crawlerBySourceId);
    return enrichmentBySourceId;
}

export async function buildDuplicateEnrichmentBySourceId() {
    if (process.env.NODE_ENV === 'test') {
        return buildDuplicateEnrichmentBySourceIdUncached();
    }
    return getOrLoadCached(
        'pipeline:duplicate-analysis:enrichment',
        buildDuplicateEnrichmentBySourceIdUncached,
        60_000,
    );
}

async function buildDuplicateEnrichmentBySourceIdLightweightUncached() {
    const sources = await loadUrlBearingSourcesForDuplicateKeys();
    const { enrichmentBySourceId } = buildDuplicateIndexes(sources, new Map());
    return enrichmentBySourceId;
}

export async function buildDuplicateEnrichmentBySourceIdLightweight() {
    if (process.env.NODE_ENV === 'test') {
        return buildDuplicateEnrichmentBySourceIdLightweightUncached();
    }
    return getOrLoadCached(
        'pipeline:duplicate-analysis:enrichment-lightweight',
        buildDuplicateEnrichmentBySourceIdLightweightUncached,
        60_000,
    );
}

export function enrichSourceWithDuplicateFields(source, enrichmentBySourceId) {
    const enrichment = enrichmentBySourceId.get(source.id);
    const normalizedUrl =
        enrichment?.normalized_url ??
        (isUrlBearingSourceType(source.type)
            ? normalizeUrlForDuplicateCheck(source.url)
            : null);

    return {
        ...source,
        normalized_url: normalizedUrl,
        duplicate_url_key: enrichment?.duplicate_url_key ?? null,
        duplicate_url_count: enrichment?.duplicate_url_count ?? 0,
        duplicate_active_count: enrichment?.duplicate_active_count ?? 0,
        duplicate_url_severity: enrichment?.duplicate_url_severity ?? null,
        duplicate_url_ignored: enrichment?.duplicate_url_ignored ?? false,
        duplicate_url_siblings: enrichment?.duplicate_url_siblings ?? [],
    };
}

export async function setSourceDuplicateUrlIgnore(sourceId, ignore, userId = null) {
    const existing = await query(`SELECT id, config FROM data_sources WHERE id = $1`, [sourceId]);
    if (!existing.rows.length) {
        const err = new Error('Data source not found');
        err.status = 404;
        throw err;
    }

    const config = parseSourceConfig(existing.rows[0].config);
    if (ignore) {
        config.ignore_duplicate_url = true;
        config.ignore_duplicate_url_at = new Date().toISOString();
        if (userId) config.ignore_duplicate_url_by = userId;
    } else {
        delete config.ignore_duplicate_url;
        delete config.ignore_duplicate_url_at;
        delete config.ignore_duplicate_url_by;
    }

    const result = await query(
        `UPDATE data_sources SET config = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [sourceId, JSON.stringify(config)],
    );
    invalidatePipelineSnapshotCache('pipeline:duplicate-analysis:');

    return result.rows[0];
}

export async function findDuplicateUrlSources({
    type,
    url,
    excludeSourceId = null,
    includeInactive = true,
}) {
    if (!isUrlBearingSourceType(type) || !url) {
        return { normalizedUrl: null, duplicates: [] };
    }

    const normalizedUrl = normalizeUrlForDuplicateCheck(url);
    if (!normalizedUrl) {
        return { normalizedUrl: null, duplicates: [] };
    }

    const [sources, crawlerBySourceId] = await Promise.all([
        loadUrlBearingSourcesWithStats(),
        loadCrawlersBySourceId(),
    ]);
    const duplicates = sources
        .filter(row => row.type === type && row.normalized_url === normalizedUrl)
        .filter(row => row.id !== excludeSourceId)
        .filter(row => includeInactive || row.is_active === true)
        .map(r => mapDuplicateSourceRow(r, crawlerBySourceId));

    return { normalizedUrl, duplicates };
}

export async function evaluateDuplicateUrlGuard({
    type,
    url,
    isActive,
    excludeSourceId = null,
    allowDuplicateUrl = false,
}) {
    if (!isUrlBearingSourceType(type) || !url) {
        return { blocked: false, normalizedUrl: null, duplicates: [], warnings: [] };
    }

    const { normalizedUrl, duplicates } = await findDuplicateUrlSources({
        type,
        url,
        excludeSourceId,
        includeInactive: true,
    });

    const activeDuplicates = duplicates.filter(d => d.isActive && !d.ignoreDuplicateUrl);
    const inactiveDuplicates = duplicates.filter(d => !d.isActive);
    const warnings = [];

    if (inactiveDuplicates.length > 0) {
        warnings.push({
            code: 'DUPLICATE_INACTIVE_URL',
            message: 'Another source with this URL exists but is inactive.',
            duplicates: inactiveDuplicates,
        });
    }

    if (isActive && activeDuplicates.length > 0) {
        if (!allowDuplicateUrl) {
            return {
                blocked: true,
                code: 'DUPLICATE_ACTIVE_URL',
                message: 'This source URL already exists.',
                normalizedUrl,
                duplicates: activeDuplicates,
                warnings,
            };
        }

        warnings.push({
            code: 'DUPLICATE_ACTIVE_URL_OVERRIDE',
            message: 'Active duplicate URL allowed by override.',
            duplicates: activeDuplicates,
        });
    }

    return {
        blocked: false,
        normalizedUrl,
        duplicates,
        warnings,
    };
}

async function loadTelegramSources() {
    const result = await query(
        `SELECT id, name, type, url, config, is_active, created_at, last_fetch_at,
                refresh_interval, fetch_count, error_count
         FROM data_sources
         WHERE type = 'telegram' AND url IS NOT NULL AND trim(url) <> ''`,
    );
    return result.rows;
}

function mapTelegramDuplicateRow(row) {
    const config = parseSourceConfig(row.config);
    return {
        id: row.id,
        name: row.name,
        type: row.type,
        url: row.url,
        telegramIdentity: normalizeTelegramChannelIdentity(row.url),
        isActive: row.is_active === true,
        ignoreDuplicateUrl: sourceIgnoresDuplicate(row.config),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        lastFetchAt: row.last_fetch_at ? new Date(row.last_fetch_at).toISOString() : null,
        flagReason: 'Same Telegram channel identity',
    };
}

export async function findDuplicateTelegramSources({
    url,
    excludeSourceId = null,
    includeInactive = true,
}) {
    const telegramIdentity = normalizeTelegramChannelIdentity(url);
    if (!telegramIdentity) {
        return { telegramIdentity: null, duplicates: [] };
    }

    const sources = await loadTelegramSources();
    const duplicates = sources
        .filter(row => normalizeTelegramChannelIdentity(row.url) === telegramIdentity)
        .filter(row => row.id !== excludeSourceId)
        .filter(row => includeInactive || row.is_active === true)
        .map(mapTelegramDuplicateRow);

    return { telegramIdentity, duplicates };
}

export async function evaluateTelegramDuplicateGuard({
    url,
    isActive,
    excludeSourceId = null,
    allowDuplicateUrl = false,
}) {
    const { telegramIdentity, duplicates } = await findDuplicateTelegramSources({
        url,
        excludeSourceId,
        includeInactive: true,
    });

    const activeDuplicates = duplicates.filter(d => d.isActive && !d.ignoreDuplicateUrl);
    const inactiveDuplicates = duplicates.filter(d => !d.isActive);
    const warnings = [];

    if (inactiveDuplicates.length > 0) {
        warnings.push({
            code: 'DUPLICATE_INACTIVE_TELEGRAM',
            message: 'Another Telegram source with this channel exists but is inactive.',
            duplicates: inactiveDuplicates,
        });
    }

    if (isActive && activeDuplicates.length > 0) {
        if (!allowDuplicateUrl) {
            return {
                blocked: true,
                code: 'DUPLICATE_ACTIVE_TELEGRAM',
                message: 'This Telegram channel already exists as a source.',
                telegramIdentity,
                duplicates: activeDuplicates,
                warnings,
            };
        }

        warnings.push({
            code: 'DUPLICATE_ACTIVE_TELEGRAM_OVERRIDE',
            message: 'Active duplicate Telegram channel allowed by override.',
            duplicates: activeDuplicates,
        });
    }

    return {
        blocked: false,
        telegramIdentity,
        duplicates,
        warnings,
    };
}
