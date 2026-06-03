import { DataSource } from '../types';

const BASE = '/api/v1/data-sources';

export class DataHubApiError extends Error {
    status: number;
    details?: unknown;

    constructor(status: number, message: string, details?: unknown) {
        super(message);
        this.name = 'DataHubApiError';
        this.status = status;
        this.details = details;
    }
}

export type DataSourcesPagination = {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
};

export type DataSourcesListResult = {
    data: DataSource[];
    pagination: DataSourcesPagination;
    offline?: boolean;
};

type BackendDataSourceRow = Record<string, unknown>;

function getAuthToken(): string | null {
    return localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
}

function authHeaders(): HeadersInit {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

async function parseErrorResponse(res: Response): Promise<DataHubApiError> {
    let body: Record<string, unknown> = {};
    try {
        body = await res.json();
    } catch {
        /* ignore */
    }
    const message =
        (typeof body.error === 'string' && body.error) ||
        (typeof body.message === 'string' && body.message) ||
        res.statusText ||
        'Request failed';
    return new DataHubApiError(res.status, message, body.details ?? body.errors ?? body);
}

async function dataSourcesRequest<T>(
    path: string,
    init?: RequestInit,
): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) {
        throw await parseErrorResponse(res);
    }
    if (res.status === 204) {
        return undefined as T;
    }
    return res.json() as Promise<T>;
}

const UI_TO_API_TYPE: Record<DataSource['type'], string> = {
    api: 'api',
    rss: 'rss',
    telegram: 'telegram',
    web: 'web',
    webhook: 'web',
    website: 'web',
    aggregator: 'api',
    third_party: 'api',
};

const API_TO_UI_TYPE: Record<string, DataSource['type']> = {
    api: 'api',
    rss: 'rss',
    telegram: 'telegram',
    web: 'web',
    websocket: 'api',
    onchain: 'api',
};

function minutesToUpdateInterval(minutes?: number | null): DataSource['updateInterval'] {
    if (minutes == null) return '5min';
    if (minutes <= 1) return '1min';
    if (minutes <= 5) return '5min';
    if (minutes <= 15) return '15min';
    if (minutes <= 30) return '30min';
    if (minutes <= 60) return '1hour';
    return 'daily';
}

function mapUiTypeToApi(type: DataSource['type']): string {
    return UI_TO_API_TYPE[type] || 'api';
}

function mapApiTypeToUi(type: string): DataSource['type'] {
    return API_TO_UI_TYPE[type] || 'api';
}

function mapStatus(row: BackendDataSourceRow): DataSource['status'] {
    if (row.is_active === false) return 'inactive';
    const lastStatus = String(row.last_status || '').toLowerCase();
    if (lastStatus === 'error' || lastStatus === 'failed') return 'error';
    if (lastStatus === 'testing') return 'testing';
    return 'active';
}

function normalizePriority(priority: unknown): DataSource['priority'] {
    if (typeof priority === 'string' && ['low', 'medium', 'high', 'critical'].includes(priority)) {
        return priority as DataSource['priority'];
    }
    if (typeof priority === 'number') {
        const map: DataSource['priority'][] = ['low', 'medium', 'high', 'critical'];
        return map[Math.min(Math.max(priority - 1, 0), 3)] || 'low';
    }
    return 'medium';
}

export function mapBackendRowToDataSource(row: BackendDataSourceRow): DataSource {
    const config =
        typeof row.config === 'string'
            ? (() => {
                  try {
                      return JSON.parse(row.config);
                  } catch {
                      return {};
                  }
              })()
            : (row.config as DataSource['config']) || {};

    const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];

    return {
        id: String(row.id),
        name: String(row.name || ''),
        type: mapApiTypeToUi(String(row.type || 'api')),
        url: row.url != null ? String(row.url) : undefined,
        category: String(row.category || row.category_id || 'uncategorized'),
        tags,
        status: mapStatus(row),
        priority: normalizePriority(row.priority),
        updateInterval: minutesToUpdateInterval(
            typeof row.refresh_interval === 'number' ? row.refresh_interval : null,
        ),
        lastUpdate: row.last_fetch_at ? String(row.last_fetch_at) : undefined,
        lastSuccess:
            row.last_status === 'success' && row.last_fetch_at
                ? String(row.last_fetch_at)
                : undefined,
        lastError: row.last_status === 'error' ? String(row.last_error || row.last_status) : undefined,
        errorCount: Number(row.error_count ?? 0),
        successRate: Number(row.success_rate ?? 0),
        reliabilityScore: Number(row.reliability_score ?? 0),
        responseTime: row.response_time != null ? Number(row.response_time) : undefined,
        config,
        createdAt: String(row.created_at || new Date().toISOString()),
        updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
    };
}

export function mapUiSourceToApiPayload(
    source: Partial<DataSource> & { name: string; type: DataSource['type'] },
): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        name: source.name,
        type: mapUiTypeToApi(source.type),
        url: source.url || null,
        category: source.category || null,
        update_interval: source.updateInterval || '5min',
        config: source.config || {},
    };

    if (source.credentials && Object.keys(source.credentials).length > 0) {
        payload.credentials = source.credentials;
    }

    if (source.status === 'inactive') {
        payload.is_active = false;
    } else if (source.status === 'active') {
        payload.is_active = true;
    }

    return payload;
}

export async function fetchDataSources(params?: {
    page?: number;
    limit?: number;
}): Promise<DataSourcesListResult> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const qs = new URLSearchParams({
        page: String(page),
        limit: String(limit),
    });

    try {
        const json = await dataSourcesRequest<{
            data: BackendDataSourceRow[];
            pagination: DataSourcesPagination;
        }>(`?${qs.toString()}`, { method: 'GET' });

        return {
            data: (json.data || []).map(mapBackendRowToDataSource),
            pagination: json.pagination,
        };
    } catch (error) {
        if (
            error instanceof TypeError ||
            (error instanceof DataHubApiError && error.status >= 500)
        ) {
            throw error;
        }
        throw error;
    }
}

export async function createDataSource(
    source: Omit<DataSource, 'id' | 'createdAt' | 'updatedAt' | 'errorCount' | 'successRate' | 'reliabilityScore'>,
): Promise<DataSource> {
    const row = await dataSourcesRequest<BackendDataSourceRow>('/', {
        method: 'POST',
        body: JSON.stringify(mapUiSourceToApiPayload(source)),
    });
    return mapBackendRowToDataSource(row);
}

function mapUiUpdatesToApiPayload(updates: Partial<DataSource>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.type !== undefined) payload.type = mapUiTypeToApi(updates.type);
    if (updates.url !== undefined) payload.url = updates.url || null;
    if (updates.category !== undefined) payload.category = updates.category || null;
    if (updates.updateInterval !== undefined) payload.update_interval = updates.updateInterval;
    if (updates.config !== undefined) payload.config = updates.config;
    if (updates.credentials !== undefined) payload.credentials = updates.credentials;
    if (updates.status === 'inactive') payload.is_active = false;
    if (updates.status === 'active') payload.is_active = true;
    return payload;
}

export async function updateDataSource(
    id: string,
    updates: Partial<DataSource>,
): Promise<DataSource> {
    const payload = mapUiUpdatesToApiPayload(updates);
    if (Object.keys(payload).length === 0) {
        throw new DataHubApiError(400, 'At least one field must be provided for update');
    }
    const row = await dataSourcesRequest<BackendDataSourceRow>(`/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    return mapBackendRowToDataSource(row);
}

/** Data Hub PUT — same as updateDataSource (keeps call sites stable). */
export const updateDataHubSource = updateDataSource;

export async function deleteDataSource(
    id: string,
    options?: { hard?: boolean },
): Promise<void> {
    const qs = options?.hard ? '?hard=true' : '';
    await dataSourcesRequest<void>(`/${id}${qs}`, { method: 'DELETE' });
}

export async function restoreDataSource(id: string): Promise<DataSource> {
    const row = await dataSourcesRequest<BackendDataSourceRow>(`/${id}/restore`, {
        method: 'PATCH',
    });
    return mapBackendRowToDataSource(row);
}

export async function testDataSourceConfiguration(
    source: Partial<DataSource> & { type: DataSource['type'] },
): Promise<{ success: boolean; message: string; sampleData?: unknown; responseTime?: number }> {
    const payload = mapUiSourceToApiPayload({
        name: source.name || 'test',
        type: source.type,
        url: source.url,
        category: source.category,
        updateInterval: source.updateInterval,
        config: source.config,
        credentials: source.credentials,
    });

    const res = await fetch(`${BASE}/test-connection`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        const message =
            (typeof body.error === 'string' && body.error) ||
            (typeof body.message === 'string' && body.message) ||
            'Connection test failed';
        if (res.status === 422) {
            return { success: false, message, responseTime: body.responseTime };
        }
        throw new DataHubApiError(res.status, message, body);
    }
    return body;
}

export async function testDataSourceConnection(
    source: DataSource,
): Promise<{ success: boolean; message: string; responseTime?: number }> {
    const result = await testDataSourceConfiguration(source);
    return {
        success: result.success,
        message: result.message,
        responseTime: result.responseTime,
    };
}

/** GET /api/v1/data-sources/health — system status for Pipeline Health Overview */
export type DataHubSourcesHealth = {
    status: 'healthy' | 'degraded' | 'unhealthy' | string;
    database?: string;
    activeSources?: number;
    recentActivity?: number;
    timestamp?: string;
    error?: string;
};

export async function fetchDataHubSourcesHealth(): Promise<DataHubSourcesHealth> {
    return dataSourcesRequest<DataHubSourcesHealth>('/health');
}

/** GET /api/v1/data-sources/stats — active/total source counts */
export type DataHubSourcesStats = {
    total_sources?: number | string;
    active_sources?: number | string;
    total_logs?: number | string;
    logs_24h?: number | string;
    logs_7d?: number | string;
};

export async function fetchDataHubSourcesStats(): Promise<DataHubSourcesStats> {
    return dataSourcesRequest<DataHubSourcesStats>('/stats');
}

/** GET /api/v1/data-sources/state — aggregate counts + source type breakdown */
export type DataHubSourcesState = {
    status?: string;
    totalSources?: number;
    activeSources?: number;
    sourcesByType?: {
        telegram?: number;
        rss?: number;
        api?: number;
    };
    recentLogs?: number;
    totalLogs?: number;
};

export async function fetchDataHubSourcesState(): Promise<DataHubSourcesState> {
    return dataSourcesRequest<DataHubSourcesState>('/state');
}

/** GET /api/v1/data-sources/collected — paginated collected_data rows */
export type CollectedDataRecord = {
    id: string;
    source_id: string;
    raw_data: unknown;
    normalized_data?: unknown | null;
    collected_at: string;
    processed_at?: string | null;
    status: 'pending' | 'processed' | 'error';
    error_message?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at: string;
    source_name?: string | null;
    source_type?: string | null;
};

export type CollectedDataPagination = {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
};

export type CollectedDataFilters = {
    status?: 'pending' | 'processed' | 'error';
    /** YYYY-MM-DD or ISO-8601 datetime */
    start_date?: string;
    end_date?: string;
    source_id?: string;
    limit?: number;
    offset?: number;
};

function toIsoDateBoundary(date: string, endOfDay: boolean): string {
    if (date.includes('T')) return date;
    return endOfDay ? `${date}T23:59:59.999Z` : `${date}T00:00:00.000Z`;
}

export async function fetchCollectedData(
    filters: CollectedDataFilters = {},
): Promise<{ data: CollectedDataRecord[]; pagination: CollectedDataPagination }> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);
    const qs = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
    });
    if (filters.source_id) qs.set('source_id', filters.source_id);
    if (filters.status) qs.set('status', filters.status);
    if (filters.start_date) qs.set('start_date', toIsoDateBoundary(filters.start_date, false));
    if (filters.end_date) qs.set('end_date', toIsoDateBoundary(filters.end_date, true));

    return dataSourcesRequest<{ data: CollectedDataRecord[]; pagination: CollectedDataPagination }>(
        `/collected?${qs.toString()}`,
        { method: 'GET' },
    );
}
