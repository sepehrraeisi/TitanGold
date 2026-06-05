import { query } from '../database/db.js';
import { logger } from './logger.js';
import { webCrawlerService } from './webCrawler.js';
import { fetchRssFeed } from './rssFetcher.js';
import { evaluateFilterRules, enforceIngestionFilter } from './datahubFilterRulesService.js';
import { resolveCategoryForWrite } from '../utils/categoryTaxonomy.js';

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

function mapCrawlerRow(row) {
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
        created_at: new Date(row.created_at).toISOString(),
        updated_at: new Date(row.updated_at).toISOString(),
    };
}

function mapRunRow(row) {
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
        error_message: row.error_message || null,
        metadata:
            typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
        created_at: new Date(row.created_at).toISOString(),
    };
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
    const result = await evaluateFilterRules({
        source_id,
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
    const result = await query(
        `SELECT c.*, ds.name AS source_name
         FROM datahub_crawlers c
         JOIN data_sources ds ON ds.id = c.source_id
         WHERE c.deleted_at IS NULL
         ORDER BY c.name ASC`,
    );
    const crawlers = result.rows.map(mapCrawlerRow);
    const summary = {
        total: crawlers.length,
        enabled: crawlers.filter(c => c.is_enabled).length,
        failed24h: crawlers.filter(c => c.last_error && c.last_run_at).length,
    };
    return { crawlers, summary };
}

export async function getCrawler(id) {
    const result = await query(
        `SELECT c.*, ds.name AS source_name
         FROM datahub_crawlers c
         JOIN data_sources ds ON ds.id = c.source_id
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
    const mapped = mapCrawlerRow({ ...row, source_name: body.source?.name });
    const src = await query(`SELECT name FROM data_sources WHERE id = $1`, [sourceId]);
    mapped.source_name = src.rows[0]?.name || null;
    return mapped;
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
    const src = await query(`SELECT name FROM data_sources WHERE id = $1`, [result.rows[0].source_id]);
    return mapCrawlerRow({ ...result.rows[0], source_name: src.rows[0]?.name });
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
            await enforceIngestionFilter({ source_id, url, text });
            return { ingested: false, blocked: false, dryRun: true };
        } catch (e) {
            if (e.code === 'FILTER_BLOCKED') {
                return { ingested: false, blocked: true, dryRun: true };
            }
            throw e;
        }
    }

    try {
        await enforceIngestionFilter({ source_id, url, text });
    } catch (e) {
        if (e.code === 'FILTER_BLOCKED') {
            return { ingested: false, blocked: true };
        }
        throw e;
    }

    const normalized = {
        content: text,
        metadata: { url, title: item.title, published_at: item.published_at },
    };
    const raw = { ...item, fetched_at: new Date().toISOString() };

    await query(
        `INSERT INTO collected_data (source_id, raw_data, normalized_data, status, metadata, collected_at)
         VALUES ($1, $2, $3, 'pending', $4, NOW())`,
        [
            source_id,
            JSON.stringify(raw),
            JSON.stringify(normalized),
            JSON.stringify({ url, crawler_ingest: true }),
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

export async function runCrawler(crawlerId, { dryRun = false, triggerType = 'manual' } = {}) {
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
