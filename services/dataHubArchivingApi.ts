import { DataHubApiError } from './dataSourcesApi';

const BASE = '/api/v1/data-hub/archiving';

export type ArchiveHealth = {
    status: string;
    status_code?: 'healthy' | 'warning_stale_archive' | 'warning_pending' | 'no_archives' | 'error';
    status_label_key?: string;
    active_records: number;
    archived_records: number;
    oldest_active_date?: string | null;
    last_archive_date?: string | null;
    last_archive_success?: boolean;
    days_since_last_archive?: number | null;
    records_pending_archive?: number;
};

export type ArchivePartition = {
    partition_name?: string;
    label: string;
    year?: number | null;
    start_date: string;
    end_date: string;
    row_count: number;
    size: string;
};

export type ArchivedRecord = {
    id: string;
    agent_id: string | null;
    user_id: string | null;
    decision_type: string | null;
    confidence: number | null;
    was_successful: boolean | null;
    execution_time_ms: number | null;
    created_at: string;
    archived_at: string | null;
};

export type ArchivingOperation = {
    id: string;
    operation_type: string;
    operation_label?: string;
    dry_run: boolean;
    request_payload: Record<string, unknown>;
    result_payload: Record<string, unknown>;
    status: string;
    error_summary?: Record<string, unknown> | null;
    triggered_by?: string | null;
    started_at: string;
    completed_at?: string | null;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
            (typeof body.error === 'string' && body.error) || res.statusText || 'Request failed';
        throw new DataHubApiError(res.status, message, body);
    }
    return res.json() as Promise<T>;
}

export function fetchArchiveHealth() {
    return request<ArchiveHealth>('/health');
}

export function fetchArchiveStats(limit = 20) {
    return request<{
        health: ArchiveHealth;
        partitions: ArchivePartition[];
        sql_stats: unknown[];
        recent_operations: ArchivingOperation[];
    }>(`/stats?limit=${limit}`);
}

export function fetchArchivedRecords(params: { limit?: number; offset?: number; agent_id?: string }) {
    const q = new URLSearchParams();
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.offset != null) q.set('offset', String(params.offset));
    if (params.agent_id) q.set('agent_id', params.agent_id);
    return request<{ records: ArchivedRecord[]; total: number; limit: number; offset: number }>(
        `/records?${q.toString()}`,
    );
}

export function previewArchive(daysOld = 90) {
    return request<{
        dry_run: boolean;
        days_old: number;
        pending_count: number;
        oldest_date: string | null;
        newest_date: string | null;
        cutoff_date: string;
    }>('/archive/preview', { method: 'POST', body: JSON.stringify({ days_old: daysOld }) });
}

export function executeArchive(payload: { days_old?: number; confirm_archive?: true; dry_run?: boolean }) {
    return request<{
        dry_run: boolean;
        days_old: number;
        records_archived?: number;
        pending_count?: number;
        execution_time_ms?: number;
    }>('/archive', { method: 'POST', body: JSON.stringify(payload) });
}

export function previewRestore(startDate: string, endDate: string) {
    return request<{ dry_run: boolean; pending_count: number; start_date: string; end_date: string }>(
        '/restore/preview',
        { method: 'POST', body: JSON.stringify({ start_date: startDate, end_date: endDate }) },
    );
}

export function executeRestore(payload: {
    start_date: string;
    end_date: string;
    confirm_restore?: true;
    dry_run?: boolean;
}) {
    return request<{ dry_run: boolean; records_restored?: number; pending_count?: number }>('/restore', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function previewPurge(startDate?: string, endDate?: string) {
    return request<{
        dry_run: boolean;
        would_purge_count: number;
        purge_apply_available: boolean;
        message: string;
    }>('/purge/preview', {
        method: 'POST',
        body: JSON.stringify({ start_date: startDate, end_date: endDate }),
    });
}
