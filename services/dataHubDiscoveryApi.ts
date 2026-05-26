import { DataHubApiError } from './dataSourcesApi';

const BASE = '/api/v1/data-hub/discovery';

export type DiscoverySuggestionStatus = 'pending' | 'approved' | 'rejected' | 'duplicate';
export type DiscoverySource = 'crawler' | 'telegram' | 'known_sources' | 'rule';

export type DiscoverySuggestion = {
    id: string;
    status: DiscoverySuggestionStatus;
    suggested_name: string;
    suggested_type: string;
    suggested_url: string;
    host_key: string;
    path_key: string;
    title_key?: string | null;
    category: string;
    priority_score: number;
    discovery_source: DiscoverySource;
    rule_id?: string | null;
    duplicate_of_source_id?: string | null;
    duplicate_of_suggestion_id?: string | null;
    duplicate_reason?: string | null;
    duplicate_confidence?: number | null;
    approved_by?: string | null;
    rejected_by?: string | null;
    reviewed_at?: string | null;
    review_note?: string | null;
    created_source_id?: string | null;
    created_at: string;
};

export type DiscoveryRule = {
    id: string;
    name: string;
    pattern: string;
    source_kind: string;
    category: string;
    priority: string;
    is_enabled: boolean;
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

async function discoveryRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

export async function fetchDiscoverySettings() {
    return discoveryRequest<{ enabled: boolean; last_scan_at: string | null }>('/settings');
}

export async function updateDiscoverySettings(enabled: boolean) {
    return discoveryRequest<{ enabled: boolean; last_scan_at: string | null }>('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
    });
}

export async function fetchDiscoveryStats() {
    return discoveryRequest<{
        pending: number;
        approved: number;
        rejected: number;
        duplicate: number;
        settings: { enabled: boolean; last_scan_at: string | null };
    }>('/stats');
}

export async function fetchDiscoverySuggestions(params?: {
    status?: DiscoverySuggestionStatus;
    limit?: number;
}) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    const data = await discoveryRequest<{ suggestions: DiscoverySuggestion[] }>(
        `/suggestions${q ? `?${q}` : ''}`,
    );
    return data.suggestions;
}

export async function fetchDiscoveryRules() {
    const data = await discoveryRequest<{ rules: DiscoveryRule[] }>('/rules');
    return data.rules;
}

export async function createDiscoveryRule(payload: Partial<DiscoveryRule>) {
    const data = await discoveryRequest<{ rule: DiscoveryRule }>('/rules', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return data.rule;
}

export async function deleteDiscoveryRule(id: string) {
    return discoveryRequest(`/rules/${id}`, { method: 'DELETE' });
}

export async function runDiscoveryScan() {
    return discoveryRequest<{
        scan_id: string;
        added: number;
        duplicates: number;
        blocked: number;
        skipped: number;
    }>('/scan', { method: 'POST', body: '{}' });
}

export async function approveDiscoverySuggestion(
    id: string,
    payload?: { review_note?: string; name?: string; category?: string },
) {
    return discoveryRequest<{ suggestion: DiscoverySuggestion; source_id: string }>(
        `/suggestions/${id}/approve`,
        { method: 'POST', body: JSON.stringify(payload || {}) },
    );
}

export async function rejectDiscoverySuggestion(id: string, review_note?: string) {
    const data = await discoveryRequest<{ suggestion: DiscoverySuggestion }>(
        `/suggestions/${id}/reject`,
        { method: 'POST', body: JSON.stringify({ review_note: review_note || null }) },
    );
    return data.suggestion;
}

export async function fetchDiscoveryHistory(limit = 10) {
    const data = await discoveryRequest<{ scans: unknown[] }>(`/history?limit=${limit}`);
    return data.scans;
}
