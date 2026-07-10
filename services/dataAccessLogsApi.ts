import { DataAccessLog } from '../types';
import { DataHubApiError } from './dataSourcesApi';

const BASE = '/api/v1/data-sources';

export type AccessLogsStatusCounts = {
    success: number;
    cached: number;
    failed: number;
    timeout: number;
    /** @deprecated use failed */
    error?: number;
    /** @deprecated use timeout */
    warning?: number;
};

export type AccessLogsListResult = {
    data: DataAccessLog[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
    statusCounts: AccessLogsStatusCounts;
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

export async function fetchDataAccessLogs(params?: {
    limit?: number;
    offset?: number;
    source_id?: string;
    status?: DataAccessLog['status'];
}): Promise<AccessLogsListResult> {
    const search = new URLSearchParams();
    search.set('limit', String(params?.limit ?? 100));
    search.set('offset', String(params?.offset ?? 0));
    if (params?.source_id) search.set('source_id', params.source_id);
    if (params?.status) search.set('status', params.status);

    const res = await fetch(`${BASE}/access-logs?${search.toString()}`, {
        method: 'GET',
        headers: authHeaders(),
    });
    if (!res.ok) {
        throw await parseErrorResponse(res);
    }
    return res.json() as Promise<AccessLogsListResult>;
}
