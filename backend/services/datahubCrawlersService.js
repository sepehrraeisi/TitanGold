import { query } from '../database/db.js';
import { logger } from './logger.js';
import { webCrawlerService } from './webCrawler.js';
import { fetchRssFeed } from './rssFetcher.js';
import { enforceIngestionPolicy, evaluateFilterPolicy, isFilterRuleBlockedError } from './filterRulesGateway.js';
import { resolveCategoryForWrite } from '../utils/categoryTaxonomy.js';
import { normalizeWebSelectors } from './webCrawlerSourceConfig.js';
import { buildDuplicateEnrichmentBySourceId } from './dataSourceUrlDuplicateService.js';

const MAX_CONCURRENT_RUNS = 3;
const INTERVAL_MINUTES = {
    realtime: 1,
    '1min': 1,
    '5min': 5,
    '15min': 15,
    '30min': 30,
    '1hour': 60,
    daily: 1440,
};

function renderJsAllowed() {
    return String(process.env.CRAWLER_RENDER_JS_ENABLED || '').toLowerCase() === 'true';
}

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

/** Who owns scheduled RSS ingestion for an active source (Phase 1 default: dataFetcher). */
export function resolveRssIngestionOwner({ sourceType, sourceIsActive, sourceConfig }) {
    if (sourceType !== 'rss') return 'crawler';
    const mode = sourceConfig?.crawler_mode;
    if (mode === 'crawler') return 'crawler';
    if (sourceIsActive) return 'data_fetcher';
    return 'data_fetcher';
}

export function isDuplicateRiskCrawler(crawler) {
    return (
        crawler.target_type === 'rss' &&
        crawler.source_is_active === true &&
        crawler.ingestion_owner === 'data_fetcher'
    );
}

function enrichCrawlerRow(row) {
    const sourceConfig = parseSourceConfig(row.source_config);
    const sourceIsActive = row.source_is_active !== false && row.source_is_active !== null;
    const sourceType = row.source_type || null;
    const ingestionOwner = resolveRssIngestionOwner({
        sourceType,
        sourceIsActive,
        sourceConfig,
    });
    const duplicateRisk = row.target_type === 'rss' && sourceIsActive && ingestionOwner === 'data_fetcher';
    const runMode =
        sourceType === 'rss' || row.target_type === 'rss'
            ? 'data_sources_scheduler'
            : 'web_crawler';
    const metadata =
        typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {};

    return {
        source_is_active: sourceIsActive,
        source_type: sourceType,
        ingestion_owner: ingestionOwner,
        duplicate_risk: duplicateRisk,
        real_run_blocked: duplicateRisk || !sourceIsActive,
        run_mode: runMode,
        synced_from_source: metadata.synced_from_source === true,
    };
}

function mapCrawlerRow(row, duplicateEnrichmentById = null) {
    const enrichment = enrichCrawlerRow(row);
    const duplicateMeta = duplicateEnrichmentById?.get(row.source_id) || null;
    return {
        id: row.id,
        source_id: row.source_id,
        name: row.name,
        target_type: row.target_type,
        start_url: row.start_url,
        max_depth: Number(row.max_depth),
        max_pages_per_run: Number(row.max_pages_per_run),
        schedule_interval: row.schedule_interval,
        respect_robots: row.respect_robots,
        render_js: row.render_js,
        selectors:
            typeof row.selectors === 'string' ? JSON.parse(row.selectors) : row.selectors || {},
        timeout_ms: Number(row.timeout_ms),
        is_enabled: row.is_enabled,
        last_run_at: row.last_run_at ? new Date(row.last_run_at).toISOString() : null,
        last_success_at: row.last_success_at ? new Date(row.last_success_at).toISOString() : null,
        last_error: row.last_error || null,
        error_count: Number(row.error_count || 0),
        next_run_at: row.next_run_at ? new Date(row.next_run_at).toISOString() : null,
        metadata:
            typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
        source_name: row.source_name || null,
        duplicate_url_severity: duplicateMeta?.duplicate_url_severity ?? null,
        duplicate_url_count: duplicateMeta?.duplicate_url_count ?? 0,
        duplicate_url_siblings: duplicateMeta?.duplicate_url_siblings ?? [],
        ...enrichment,
        created_at: new Date(row.created_at).toISOString(),
        updated_at: new Date(row.updated_at).toISOString(),
    };
}

function mapRunRow(row) {
    const started = row.started_at ? new Date(row.started_at).getTime() : null;
    const finished = row.finished_at ? new Date(row.finished_at).getTime() : null;
    const durationMs =
        started != null && finished != null && finished >= started
            ? Math.round(finished - started)
            : null;

    return {
        id: row.id,
        crawler_id: row.crawler_id,
        status: row.status,
        trigger_type: row.trigger_type,
        dry_run: row.dry_run,
        pages_fetched: Number(row.pages_fetched),
        items_ingested: Number(row.items_ingested),
        items_blocked: Number(row.items_blocked),
        started_at: row.started_at ? new Date(row.started_at).toISOString() : null,
        finished_at: row.finished_at ? new Date(row.finished_at).toISOString() : null,
        duration_ms: durationMs,
        error_message: row.error_message || null,
        metadata:
            typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
        created_at: new Date(row.created_at).toISOString(),
    };
}

const CRAWLER_SOURCE_JOIN = `
    JOIN data_sources ds ON ds.id = c.source_id
`;

const CRAWLER_SOURCE_SELECT = `
    c.*,
    ds.name AS source_name,
    ds.is_active AS source_is_active,
    ds.type AS source_type,
    ds.config AS source_config
`;

async function loadLinkedSource(sourceId) {
    const result = await query(
        `SELECT id, type, is_active, config FROM data_sources WHERE id = $1`,
        [sourceId],
    );
    return result.rows[0] || null;
}

function mapRefreshToScheduleInterval(mins) {
    const m = Number(mins) || 5;
    if (m <= 1) return '1min';
    if (m <= 5) return '5min';
    if (m <= 15) return '15min';
    if (m <= 30) return '30min';
    if (m <= 60) return '1hour';
    return 'daily';
}

/**
 * Idempotent sync: ensure one datahub_crawlers row per rss/web data_source (DH-WEBCRAWLER-P4).
 * Does not update or delete existing crawler rows.
 */
export async function syncCrawlersFromDataSources() {
    const [sourcesResult, existingResult] = await Promise.all([
        query(
            `SELECT id, name, type, url, is_active, config, refresh_interval
             FROM data_sources
             WHERE type IN ('rss', 'web')
             ORDER BY name ASC`,
        ),
        query(
            `SELECT source_id, COUNT(*)::int AS crawler_count
             FROM datahub_crawlers
             WHERE deleted_at IS NULL
             GROUP BY source_id`,
        ),
    ]);

    const existingBySource = new Map(
        existingResult.rows.map(row => [row.source_id, Number(row.crawler_count)]),
    );

    let created = 0;
    let skipped = 0;

    for (const source of sourcesResult.rows) {
        if ((existingBySource.get(source.id) || 0) > 0) {
            skipped += 1;
            continue;
        }

        const config = parseSourceConfig(source.config);
        const isRss = source.type === 'rss';
        const targetType = isRss ? 'rss' : 'website';
        const scheduleInterval = mapRefreshToScheduleInterval(source.refresh_interval);
        const nextRun = computeNextRunAt(scheduleInterval);

        let maxDepth = 0;
        let maxPages = 50;
        let respectRobots = true;
        let renderJs = false;
        let selectors = {};

        if (!isRss) {
            const depthRaw = config.depth ?? config.maxDepth ?? 0;
            maxDepth = Math.min(Math.max(0, Number(depthRaw) || 0), 5);
            maxPages = Math.min(Math.max(1, Number(config.maxPages) || 50), 500);
            respectRobots = config.respectRobots !== false && config.respect_robots !== false;
            renderJs = config.renderJS === true || config.render_js === true;
            selectors = normalizeWebSelectors(config);
        } else {
            maxPages = Math.min(
                Math.max(1, Number(config.max_items ?? config.maxItems) || 50),
                500,
            );
        }

        await query(
            `INSERT INTO datahub_crawlers (
                source_id, name, target_type, start_url, max_depth, max_pages_per_run,
                schedule_interval, respect_robots, render_js, selectors, timeout_ms,
                is_enabled, next_run_at, metadata
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [
                source.id,
                source.name,
                targetType,
                source.url,
                maxDepth,
                maxPages,
                scheduleInterval,
                respectRobots,
                renderJs,
                JSON.stringify(selectors),
                600000,
                true,
                nextRun,
                JSON.stringify({
                    synced_from_source: true,
                    sync_version: 1,
                    source_type: source.type,
                }),
            ],
        );
        created += 1;
        existingBySource.set(source.id, 1);
    }

    const totalAfter = await query(
        `SELECT COUNT(*)::int AS c FROM datahub_crawlers WHERE deleted_at IS NULL`,
    );

    const stats = {
        rss_web_sources: sourcesResult.rows.length,
        created,
        skipped,
        total_crawlers: totalAfter.rows[0]?.c ?? 0,
    };

    if (created > 0) {
        logger.info('Synced datahub_crawlers from data_sources', stats);
    }

    return stats;
}

export async function assertCrawlerRunAllowed({ crawler, dryRun, forceOverride }) {
    const source = await loadLinkedSource(crawler.source_id);
    if (!source) {
        const err = new Error('Linked data source not found');
        err.status = 404;
        err.code = 'SOURCE_NOT_FOUND';
        throw err;
    }

    const sourceIsActive = source.is_active === true;
    const sourceConfig = parseSourceConfig(source.config);
    const ingestionOwner = resolveRssIngestionOwner({
        sourceType: source.type,
        sourceIsActive,
        sourceConfig,
    });

    if (!sourceIsActive && !dryRun && !forceOverride) {
        const err = new Error(
            'Linked data source is disabled. Enable the source or use force override to run.',
        );
        err.status = 403;
        err.code = 'SOURCE_INACTIVE';
        throw err;
    }

    if (
        crawler.target_type === 'rss' &&
        !dryRun &&
        !forceOverride &&
        sourceIsActive &&
        ingestionOwner === 'data_fetcher'
    ) {
        const err = new Error(
            'RSS ingestion is handled by the Data Sources scheduler. Use dry run to test, set source config crawler_mode to "crawler", or pass force_override.',
        );
        err.status = 409;
        err.code = 'RSS_DATAFETCHER_OWNS';
        throw err;
    }

    return { source, ingestionOwner };
}

function computeNextRunAt(interval) {
    const mins = INTERVAL_MINUTES[interval] || 5;
    return new Date(Date.now() + mins * 60 * 1000);
}

async function assertRenderJsAllowed(renderJs) {
    if (!renderJs) return;
    if (!renderJsAllowed()) {
        const err = new Error(
            'JS rendering is disabled in this environment. Set CRAWLER_RENDER_JS_ENABLED=true to enable Playwright rendering.',
        );
        err.status = 400;
        err.code = 'RENDER_JS_DISABLED';
        throw err;
    }
}

export async function preCrawlFilterCheck({ source_id, url, text }) {
    const result = await evaluateFilterPolicy({
        sourceId: source_id,
        url,
        text,
        apply_target: 'ingestion',
    });
    if (!result.allowed) {
        const err = new Error('Crawl blocked by filter rule before start');
        err.status = 403;
        err.code = 'FILTER_BLOCKED_PRE_CRAWL';
        err.details = result;
        throw err;
    }
    return result;
}

async function resolveSourceId(body, userId) {
    if (body.source_id) {
        const check = await query(
            `SELECT id FROM data_sources WHERE id = $1 AND is_active = true`,
            [body.source_id],
        );
        if (!check.rows.length) {
            const err = new Error('Data source not found');
            err.status = 404;
            throw err;
        }
        return body.source_id;
    }

    if (body.source) {
        const dsType = body.source.type || (body.target_type === 'rss' ? 'rss' : 'web');
        const mins = INTERVAL_MINUTES[body.source.update_interval || body.schedule_interval] || 5;
        const category = await resolveCategoryForWrite(body.source.category, query, { log: logger });
        const ins = await query(
            `INSERT INTO data_sources (name, type, url, category, refresh_interval, is_active, config)
             VALUES ($1, $2, $3, $4, $5, true, $6)
             RETURNING id`,
            [
                body.source.name.trim(),
                dsType,
                body.source.url,
                category,
                mins,
                JSON.stringify({ created_from: 'datahub_crawler' }),
            ],
        );
        return ins.rows[0].id;
    }

    const err = new Error('source_id or source is required');
    err.status = 400;
    throw err;
}

export async function listCrawlers() {
    const sync = await syncCrawlersFromDataSources();

    const [crawlerResult, metricsResult, duplicateEnrichmentById] = await Promise.all([
        query(
            `SELECT ${CRAWLER_SOURCE_SELECT}
             FROM datahub_crawlers c
             ${CRAWLER_SOURCE_JOIN}
             WHERE c.deleted_at IS NULL
             ORDER BY c.name ASC`,
        ),
        query(
            `SELECT
                COUNT(*) FILTER (
                    WHERE r.status = 'failed'
                    AND r.started_at >= NOW() - INTERVAL '24 hours'
                )::int AS failed_24h,
                AVG(
                    EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000
                ) FILTER (
                    WHERE r.status = 'success'
                    AND r.finished_at IS NOT NULL
                    AND r.started_at IS NOT NULL
                    AND r.started_at >= NOW() - INTERVAL '24 hours'
                ) AS avg_latency_ms
             FROM datahub_crawler_runs r
             JOIN datahub_crawlers c ON c.id = r.crawler_id AND c.deleted_at IS NULL`,
        ),
        buildDuplicateEnrichmentBySourceId(),
    ]);
    const crawlers = crawlerResult.rows.map(row => mapCrawlerRow(row, duplicateEnrichmentById));
    const metrics = metricsResult.rows[0] || {};
    const avgLatencyMs =
        metrics.avg_latency_ms != null && Number.isFinite(Number(metrics.avg_latency_ms))
            ? Math.round(Number(metrics.avg_latency_ms))
            : null;

    const summary = {
        total: crawlers.length,
        enabled: crawlers.filter(c => c.is_enabled).length,
        failed24h: parseInt(metrics.failed_24h, 10) || 0,
        avg_latency_ms: avgLatencyMs,
        duplicate_risk_count: crawlers.filter(c => c.duplicate_risk).length,
    };
    return { crawlers, summary, sync };
}

export async function getCrawler(id) {
    const result = await query(
        `SELECT ${CRAWLER_SOURCE_SELECT}
         FROM datahub_crawlers c
         ${CRAWLER_SOURCE_JOIN}
         WHERE c.id = $1 AND c.deleted_at IS NULL`,
        [id],
    );
    if (!result.rows.length) {
        const err = new Error('Crawler not found');
        err.status = 404;
        throw err;
    }
    return mapCrawlerRow(result.rows[0]);
}

export async function createCrawler(body, userId) {
    await assertRenderJsAllowed(body.render_js);
    const sourceId = await resolveSourceId(body, userId);
    const nextRun = computeNextRunAt(body.schedule_interval || '5min');

    const result = await query(
        `INSERT INTO datahub_crawlers (
            source_id, name, target_type, start_url, max_depth, max_pages_per_run,
            schedule_interval, respect_robots, render_js, selectors, timeout_ms,
            is_enabled, next_run_at, metadata, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING *`,
        [
            sourceId,
            body.name.trim(),
            body.target_type,
            body.start_url.trim(),
            body.target_type === 'rss' ? 0 : (body.max_depth ?? 0),
            body.max_pages_per_run ?? 50,
            body.schedule_interval || '5min',
            body.respect_robots !== false,
            body.render_js === true,
            JSON.stringify(body.selectors || {}),
            body.timeout_ms ?? 600000,
            body.is_enabled !== false,
            nextRun,
            JSON.stringify(body.metadata || {}),
            userId || null,
        ],
    );

    const row = result.rows[0];
    const src = await query(
        `SELECT name, is_active, type, config FROM data_sources WHERE id = $1`,
        [sourceId],
    );
    return mapCrawlerRow({
        ...row,
        source_name: src.rows[0]?.name || body.source?.name || null,
        source_is_active: src.rows[0]?.is_active,
        source_type: src.rows[0]?.type,
        source_config: src.rows[0]?.config,
    });
}

export async function updateCrawler(id, body) {
    const existing = await getCrawler(id);
    if (body.render_js === true || (body.render_js == null && existing.render_js)) {
        await assertRenderJsAllowed(body.render_js ?? existing.render_js);
    }

    const fields = [];
    const params = [];
    let n = 1;
    const set = (col, val) => {
        fields.push(`${col} = $${n++}`);
        params.push(val);
    };

    if (body.name !== undefined) set('name', body.name.trim());
    if (body.source_id !== undefined) set('source_id', body.source_id);
    if (body.target_type !== undefined) set('target_type', body.target_type);
    if (body.start_url !== undefined) set('start_url', body.start_url.trim());
    if (body.max_depth !== undefined) set('max_depth', body.max_depth);
    if (body.max_pages_per_run !== undefined) set('max_pages_per_run', body.max_pages_per_run);
    if (body.schedule_interval !== undefined) {
        set('schedule_interval', body.schedule_interval);
        set('next_run_at', computeNextRunAt(body.schedule_interval));
    }
    if (body.respect_robots !== undefined) set('respect_robots', body.respect_robots);
    if (body.render_js !== undefined) set('render_js', body.render_js);
    if (body.selectors !== undefined) set('selectors', JSON.stringify(body.selectors));
    if (body.timeout_ms !== undefined) set('timeout_ms', body.timeout_ms);
    if (body.is_enabled !== undefined) set('is_enabled', body.is_enabled);
    if (body.metadata !== undefined) set('metadata', JSON.stringify(body.metadata));

    if (fields.length === 0) return existing;

    params.push(id);
    const result = await query(
        `UPDATE datahub_crawlers SET ${fields.join(', ')}
         WHERE id = $${n} AND deleted_at IS NULL
         RETURNING *`,
        params,
    );
    const src = await query(
        `SELECT name, is_active, type, config FROM data_sources WHERE id = $1`,
        [result.rows[0].source_id],
    );
    return mapCrawlerRow({
        ...result.rows[0],
        source_name: src.rows[0]?.name,
        source_is_active: src.rows[0]?.is_active,
        source_type: src.rows[0]?.type,
        source_config: src.rows[0]?.config,
    });
}

export async function softDeleteCrawler(id) {
    const result = await query(
        `UPDATE datahub_crawlers
         SET deleted_at = NOW(), is_enabled = false, updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [id],
    );
    if (!result.rows.length) {
        const err = new Error('Crawler not found');
        err.status = 404;
        throw err;
    }
    return mapCrawlerRow(result.rows[0]);
}

export async function listCrawlerRuns(crawlerId, { limit = 20, offset = 0 } = {}) {
    await getCrawler(crawlerId);
    const result = await query(
        `SELECT * FROM datahub_crawler_runs
         WHERE crawler_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [crawlerId, limit, offset],
    );
    return result.rows.map(mapRunRow);
}

export async function listCrawlerRecentOutputs(crawlerId, { limit = 5 } = {}) {
    const crawler = await getCrawler(crawlerId);
    const result = await query(
        `SELECT
            cd.id,
            COALESCE(
                cd.normalized_data->'metadata'->>'title',
                cd.raw_data->>'title',
                cd.metadata->>'url',
                '—'
            ) AS title,
            cd.collected_at,
            cd.status
         FROM collected_data cd
         WHERE cd.source_id = $1
           AND cd.metadata->>'crawler_ingest' = 'true'
         ORDER BY cd.collected_at DESC
         LIMIT $2`,
        [crawler.source_id, limit],
    );
    return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        collected_at: new Date(row.collected_at).toISOString(),
        status: row.status,
        origin: 'crawler',
    }));
}

async function assertConcurrentRuns() {
    const r = await query(
        `SELECT COUNT(*)::int AS c FROM datahub_crawler_runs WHERE status = 'running'`,
    );
    if (r.rows[0].c >= MAX_CONCURRENT_RUNS) {
        const err = new Error('Too many crawlers running; try again later');
        err.status = 429;
        throw err;
    }
}

async function ingestItem({ source_id, item, dryRun }) {
    const url = item.url || item.link;
    const text = item.content || item.title || item.text || '';
    if (dryRun) {
        try {
            await enforceIngestionPolicy({ sourceId: source_id, url, text, enforcementPath: dryRun ? 'crawler_dry_run' : 'crawler_ingest' });
            return { ingested: false, blocked: false, dryRun: true };
        } catch (e) {
            if (isFilterRuleBlockedError(e)) {
                return { ingested: false, blocked: true, dryRun: true };
            }
            throw e;
        }
    }

    try {
        await enforceIngestionPolicy({ sourceId: source_id, url, text, enforcementPath: dryRun ? 'crawler_dry_run' : 'crawler_ingest' });
    } catch (e) {
        if (isFilterRuleBlockedError(e)) {
            return { ingested: false, blocked: true };
        }
        throw e;
    }

    const sourcePublishedAt = item.published_at
        ? new Date(item.published_at).toISOString()
        : null;
    const normalized = {
        content: text,
        metadata: { url, title: item.title, published_at: item.published_at },
        ...(sourcePublishedAt ? { publishedAt: sourcePublishedAt } : {}),
    };
    const raw = { ...item, fetched_at: new Date().toISOString() };

    await query(
        `INSERT INTO collected_data (source_id, raw_data, normalized_data, status, metadata, collected_at)
         VALUES ($1, $2, $3, 'pending', $4, NOW())`,
        [
            source_id,
            JSON.stringify(raw),
            JSON.stringify(normalized),
            JSON.stringify({
                url,
                crawler_ingest: true,
                ...(sourcePublishedAt ? { source_published_at: sourcePublishedAt } : {}),
            }),
        ],
    );
    return { ingested: true, blocked: false };
}

async function executeWebsiteCrawl(crawler, { dryRun }) {
    const sourceConfig = {
        url: crawler.start_url,
        config: {
            depth: crawler.max_depth,
            maxPages: crawler.max_pages_per_run,
            selectors: crawler.selectors,
            renderJS: crawler.render_js && renderJsAllowed(),
            skipRobots: crawler.respect_robots === false,
        },
    };

    const pages = await webCrawlerService.crawl(sourceConfig);

    let ingested = 0;
    let blocked = 0;
    for (const page of pages) {
        const r = await ingestItem({
            source_id: crawler.source_id,
            item: {
                url: page.url,
                title: page.title,
                content: page.content || JSON.stringify(page),
            },
            dryRun,
        });
        if (r.blocked) blocked += 1;
        else if (r.ingested || (dryRun && r.dryRun)) ingested += 1;
    }

    return { pages_fetched: pages.length, items_ingested: ingested, items_blocked: blocked };
}

async function executeRssCrawl(crawler, { dryRun }) {
    const items = await fetchRssFeed(crawler.start_url, {
        timeoutMs: Math.min(crawler.timeout_ms, 60000),
    });
    const slice = items.slice(0, crawler.max_pages_per_run);
    let ingested = 0;
    let blocked = 0;
    for (const item of slice) {
        const r = await ingestItem({
            source_id: crawler.source_id,
            item,
            dryRun,
        });
        if (r.blocked) blocked += 1;
        else if (r.ingested || (dryRun && r.dryRun)) ingested += 1;
    }
    return {
        pages_fetched: slice.length,
        items_ingested: ingested,
        items_blocked: blocked,
    };
}

export async function runCrawler(
    crawlerId,
    { dryRun = false, triggerType = 'manual', forceOverride = false } = {},
) {
    const crawler = await getCrawler(crawlerId);
    if (!crawler.is_enabled && triggerType === 'schedule') {
        const err = new Error('Crawler is disabled');
        err.status = 400;
        throw err;
    }

    await assertRenderJsAllowed(crawler.render_js);
    await assertConcurrentRuns();

    try {
        new URL(crawler.start_url);
    } catch {
        const err = new Error('Invalid start_url');
        err.status = 400;
        throw err;
    }

    await assertCrawlerRunAllowed({ crawler, dryRun, forceOverride: forceOverride });

    await preCrawlFilterCheck({
        source_id: crawler.source_id,
        url: crawler.start_url,
        text: crawler.name,
    });

    const runIns = await query(
        `INSERT INTO datahub_crawler_runs (crawler_id, status, trigger_type, dry_run, started_at)
         VALUES ($1, 'running', $2, $3, NOW())
         RETURNING *`,
        [crawlerId, triggerType, dryRun],
    );
    const runId = runIns.rows[0].id;

    const runWithTimeout = async () => {
        if (crawler.target_type === 'rss') {
            return executeRssCrawl(crawler, { dryRun });
        }
        return executeWebsiteCrawl(crawler, { dryRun });
    };

    try {
        const stats = await Promise.race([
            runWithTimeout(),
            new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error('Crawler run timeout')),
                    crawler.timeout_ms,
                ),
            ),
        ]);

        await query(
            `UPDATE datahub_crawler_runs
             SET status = 'success', pages_fetched = $2, items_ingested = $3, items_blocked = $4,
                 finished_at = NOW(), metadata = $5
             WHERE id = $1`,
            [
                runId,
                stats.pages_fetched,
                stats.items_ingested,
                stats.items_blocked,
                JSON.stringify({ dry_run: dryRun }),
            ],
        );

        await query(
            `UPDATE datahub_crawlers
             SET last_run_at = NOW(), last_success_at = NOW(), last_error = NULL,
                 error_count = 0, next_run_at = $2, updated_at = NOW()
             WHERE id = $1`,
            [crawlerId, computeNextRunAt(crawler.schedule_interval)],
        );

        await query(
            `UPDATE data_sources SET last_fetch_at = NOW(), last_status = 'success' WHERE id = $1`,
            [crawler.source_id],
        );

        const run = await query(`SELECT * FROM datahub_crawler_runs WHERE id = $1`, [runId]);
        return { run: mapRunRow(run.rows[0]), stats };
    } catch (error) {
        const msg = error.message || 'Crawler run failed';
        await query(
            `UPDATE datahub_crawler_runs
             SET status = 'failed', error_message = $2, finished_at = NOW(),
                 metadata = $3
             WHERE id = $1`,
            [runId, msg, JSON.stringify({ code: error.code, details: error.details })],
        );
        await query(
            `UPDATE datahub_crawlers
             SET last_run_at = NOW(), last_error = $2, error_count = error_count + 1, updated_at = NOW()
             WHERE id = $1`,
            [crawlerId, msg],
        );
        if (error.status) throw error;
        const err = new Error(msg);
        err.status = error.code === 'FILTER_BLOCKED_PRE_CRAWL' ? 403 : 500;
        err.code = error.code;
        err.details = error.details;
        throw err;
    }
}
