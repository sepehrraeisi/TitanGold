import { DataHubApiError } from './dataSourcesApi';
import type { DataSource } from '../types';
import { createDataSource, mapUiSourceToApiPayload } from './dataSourcesApi';

const BASE = '/api/v1/data-hub/crawlers';

export type CrawlerTargetType = 'website' | 'rss';
export type CrawlerScheduleInterval =
    | 'realtime'
    | '1min'
    | '5min'
    | '15min'
    | '30min'
    | '1hour'
    | 'daily';

export type CrawlerIngestionOwner = 'data_fetcher' | 'crawler';

export type DataHubCrawler = {
    id: string;
    source_id: string;
    name: string;
    target_type: CrawlerTargetType;
    start_url: string;
    max_depth: number;
    max_pages_per_run: number;
    schedule_interval: CrawlerScheduleInterval;
    respect_robots: boolean;
    render_js: boolean;
    selectors: Record<string, string>;
    timeout_ms: number;
    is_enabled: boolean;
    last_run_at?: string | null;
    last_success_at?: string | null;
    last_error?: string | null;
    error_count: number;
    next_run_at?: string | null;
    metadata: Record<string, unknown>;
    source_name?: string | null;
    source_is_active?: boolean;
    source_type?: string | null;
    ingestion_owner?: CrawlerIngestionOwner;
    duplicate_risk?: boolean;
    real_run_blocked?: boolean;
    run_mode?: 'data_sources_scheduler' | 'web_crawler';
    synced_from_source?: boolean;
    duplicate_url_severity?: 'high' | 'medium' | 'low' | null;
    duplicate_url_count?: number;
    duplicate_url_siblings?: Array<{
        id: string;
        name: string;
        isActive: boolean;
        collectedCount?: number;
    }>;
    created_at: string;
    updated_at: string;
};

export type CrawlerRun = {
    id: string;
    crawler_id: string;
    status: string;
    trigger_type: string;
    dry_run: boolean;
    pages_fetched: number;
    items_ingested: number;
    items_blocked: number;
    started_at?: string | null;
    finished_at?: string | null;
    error_message?: string | null;
    duration_ms?: number | null;
    metadata: Record<string, unknown>;
    created_at: string;
};

export type CrawlerRecentOutput = {
    id: string;
    title: string;
    collected_at: string;
    status: string;
    origin: 'crawler';
};

export type CreateCrawlerPayload = {
    name: string;
    source_id?: string;
    source?: {
        name: string;
        type?: 'web' | 'rss';
        url: string;
        category?: string | null;
        update_interval?: CrawlerScheduleInterval;
    };
    target_type: CrawlerTargetType;
    start_url: string;
    max_depth?: number;
    max_pages_per_run?: number;
    schedule_interval?: CrawlerScheduleInterval;
    respect_robots?: boolean;
    render_js?: boolean;
    selectors?: Record<string, string>;
    timeout_ms?: number;
    is_enabled?: boolean;
};

function getAuthToken(): string | null {
    return localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
}

function authHeaders(): HeadersInit {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

async function crawlersRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) {
        let body: Record<string, unknown> = {};
        try {
            body = await res.json();
        } catch {
            /* ignore */
        }
        const message =
            (typeof body.error === 'string' && body.error) ||
            res.statusText ||
            'Request failed';
        throw new DataHubApiError(res.status, message, body);
    }
    return res.json() as Promise<T>;
}

export async function fetchCrawlers(): Promise<{
    crawlers: DataHubCrawler[];
    summary: {
        total: number;
        enabled: number;
        failed24h: number;
        avg_latency_ms?: number | null;
        duplicate_risk_count?: number;
    };
    sync?: {
        rss_web_sources: number;
        created: number;
        skipped: number;
        total_crawlers: number;
    };
}> {
    return crawlersRequest('');
}

export async function createCrawler(payload: CreateCrawlerPayload): Promise<DataHubCrawler> {
    const data = await crawlersRequest<{ crawler: DataHubCrawler }>('', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return data.crawler;
}

export async function updateCrawler(
    id: string,
    payload: Partial<CreateCrawlerPayload>,
): Promise<DataHubCrawler> {
    const data = await crawlersRequest<{ crawler: DataHubCrawler }>(`/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    return data.crawler;
}

export async function deleteCrawler(id: string): Promise<DataHubCrawler> {
    const data = await crawlersRequest<{ crawler: DataHubCrawler }>(`/${id}`, {
        method: 'DELETE',
    });
    return data.crawler;
}

export async function runCrawler(
    id: string,
    options?: { dry_run?: boolean; force_override?: boolean },
): Promise<{ run: CrawlerRun; stats: { pages_fetched: number; items_ingested: number; items_blocked: number } }> {
    return crawlersRequest(`/${id}/run`, {
        method: 'POST',
        body: JSON.stringify(options || {}),
    });
}

export async function fetchCrawlerRecentOutputs(id: string): Promise<CrawlerRecentOutput[]> {
    const data = await crawlersRequest<{ outputs: CrawlerRecentOutput[] }>(`/${id}/recent-outputs`);
    return data.outputs;
}

export async function fetchCrawlerRuns(
    id: string,
    params?: { limit?: number; offset?: number },
): Promise<CrawlerRun[]> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const q = qs.toString();
    const data = await crawlersRequest<{ runs: CrawlerRun[] }>(
        `/${id}/runs${q ? `?${q}` : ''}`,
    );
    return data.runs;
}

/** Create crawler with new data source from UI modal */
export async function createCrawlerWithNewSource(
    crawler: Omit<CreateCrawlerPayload, 'source_id' | 'source'> & {
        newSource: { name: string; url: string; category?: string };
    },
): Promise<DataHubCrawler> {
    const sourcePayload = mapUiSourceToApiPayload({
        name: crawler.newSource.name,
        type: crawler.target_type === 'rss' ? 'rss' : 'web',
        url: crawler.newSource.url,
        category: crawler.newSource.category || 'uncategorized',
        updateInterval: crawler.schedule_interval || '5min',
    } as Partial<DataSource> & { name: string; type: DataSource['type'] });
    const created = await createDataSource(sourcePayload as Parameters<typeof createDataSource>[0]);
    const { newSource: _, ...rest } = crawler;
    return createCrawler({ ...rest, source_id: created.id });
}
