import {
    DataPipelineSnapshot,
    DataPipelineHistoryEntry,
    DataNormalizationSummary,
    NormalizedDataRecord,
} from '../types';
import { DataHubApiError } from './dataSourcesApi';

const BASE = '/api/v1/data-sources';

export type DataPipelineView = {
    snapshot: DataPipelineSnapshot;
    history: DataPipelineHistoryEntry[];
    normalizationSummary: DataNormalizationSummary;
    normalizedData: NormalizedDataRecord[];
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

export async function fetchDataPipelineView(): Promise<DataPipelineView> {
    const res = await fetch(`${BASE}/pipeline`, {
        method: 'GET',
        headers: authHeaders(),
    });
    if (!res.ok) {
        throw await parseErrorResponse(res);
    }
    return res.json() as Promise<DataPipelineView>;
}

/** @deprecated Use fetchDataPipelineView — kept for callers expecting snapshot only */
export async function fetchDataPipelineSnapshot(): Promise<DataPipelineSnapshot> {
    const view = await fetchDataPipelineView();
    return view.snapshot;
}
