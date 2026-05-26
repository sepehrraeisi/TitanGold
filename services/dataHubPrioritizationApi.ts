import { DataHubApiError } from './dataSourcesApi';

const BASE = '/api/v1/data-hub/prioritization';

export type PriorityTier = 'low' | 'medium' | 'high' | 'critical';

export type PrioritizationSettings = {
    is_enabled: boolean;
    factor_weights: Record<string, number>;
    tier_thresholds: Record<string, number>;
    updated_at?: string | null;
};

export type PrioritizationSource = {
    source_id: string;
    source_name: string;
    source_type: string;
    category?: string | null;
    calculated_score: number;
    final_score: number;
    suggested_tier: PriorityTier;
    score_breakdown: Record<string, unknown>;
    override_score?: number | null;
    override_note?: string | null;
    overridden_by?: string | null;
    overridden_at?: string | null;
    last_preview_at?: string | null;
    last_applied_at?: string | null;
};

export type PrioritizationRun = {
    id: string;
    run_type: 'preview' | 'apply';
    source_count: number;
    summary: Record<string, number>;
    created_by?: string | null;
    created_at: string;
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
            (typeof body.error === 'string' && body.error) ||
            res.statusText ||
            'Request failed';
        throw new DataHubApiError(res.status, message, body);
    }
    return res.json() as Promise<T>;
}

export function fetchPrioritizationSettings() {
    return request<PrioritizationSettings>('/settings');
}

export function updatePrioritizationSettings(payload: {
    is_enabled: boolean;
    factor_weights: Record<string, number>;
    tier_thresholds?: Record<string, number>;
}) {
    return request<PrioritizationSettings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

export function fetchPrioritizationSources() {
    return request<{ sources: PrioritizationSource[] }>('/sources').then(r => r.sources);
}

export function fetchPrioritizationRuns(params?: { limit?: number; offset?: number }) {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const q = qs.toString();
    return request<{ runs: PrioritizationRun[] }>(`/runs${q ? `?${q}` : ''}`).then(r => r.runs);
}

export function previewPrioritization() {
    return request<{ run: { id: string; created_at: string }; summary: Record<string, number>; sources: PrioritizationSource[] }>(
        '/preview',
        { method: 'POST', body: '{}' },
    );
}

export function applyPrioritization(payload?: { source_ids?: string[] }) {
    return request<{ run: { id: string; created_at: string }; summary: Record<string, number>; applied: number }>(
        '/apply',
        {
            method: 'POST',
            body: JSON.stringify({ confirm_apply: true, source_ids: payload?.source_ids }),
        },
    );
}

export function setPrioritizationOverride(
    sourceId: string,
    payload: { override_score: number | null; override_note?: string | null },
) {
    return request<{ source_id: string; override_score: number | null; override_note?: string | null }>(
        `/sources/${sourceId}/override`,
        {
            method: 'PUT',
            body: JSON.stringify(payload),
        },
    );
}

