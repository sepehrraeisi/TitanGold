import {
    DataPipelineSnapshot,
    DataPipelineHistoryEntry,
    DataNormalizationSummary,
    NormalizedDataRecord,
    DataPipelineSourceSnapshot,
} from '../types';
import { DataHubApiError } from './dataSourcesApi';

const BASE = '/api/v1/data-sources';

export type DataPipelineView = {
    snapshot: DataPipelineSnapshot;
    history: DataPipelineHistoryEntry[];
    normalizationSummary: DataNormalizationSummary;
    normalizedData: NormalizedDataRecord[];
};

export type DataPipelineBacklogEnrichment = {
    transferThroughput: NonNullable<DataPipelineSnapshot['transferThroughput']>;
    globalTelegramBacklog: NonNullable<DataPipelineSnapshot['globalTelegramBacklog']>;
    ingestMetrics: NonNullable<DataPipelineSnapshot['telegramIngestMetrics']>;
    backlogBySourceId: Record<string, NonNullable<DataPipelineSourceSnapshot['collectorBacklog']>>;
    meta?: {
        partial?: boolean;
        warnings?: string[];
        fetchedAt?: string;
        error?: string;
    };
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

/** Fast primary snapshot — backlog enrichment loaded separately (DH-PIPELINE-P2). */
export async function fetchDataPipelineView(options?: { includeBacklog?: boolean }): Promise<DataPipelineView> {
    const params = new URLSearchParams();
    if (options?.includeBacklog) {
        params.set('includeBacklog', 'true');
    } else {
        params.set('includeBacklog', 'false');
    }
    const res = await fetch(`${BASE}/pipeline?${params.toString()}`, {
        method: 'GET',
        headers: authHeaders(),
    });
    if (!res.ok) {
        throw await parseErrorResponse(res);
    }
    return res.json() as Promise<DataPipelineView>;
}

/** Heavy Telegram backlog intelligence — lazy-loaded after main pipeline board. */
export async function fetchDataPipelineBacklog(): Promise<DataPipelineBacklogEnrichment> {
    const res = await fetch(`${BASE}/pipeline/backlog`, {
        method: 'GET',
        headers: authHeaders(),
    });
    if (!res.ok) {
        throw await parseErrorResponse(res);
    }
    return res.json() as Promise<DataPipelineBacklogEnrichment>;
}

/** @deprecated Use fetchDataPipelineView — kept for callers expecting snapshot only */
export async function fetchDataPipelineSnapshot(): Promise<DataPipelineSnapshot> {
    const view = await fetchDataPipelineView();
    return view.snapshot;
}
