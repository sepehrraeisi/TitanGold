import { SourceAccessControl } from '../types';
import { DataHubApiError } from './dataSourcesApi';

const BASE = '/api/v1/data-hub/access-control';

export type AccessControlRuleRecord = {
    source_id: string;
    source_name?: string | null;
    source_category?: string | null;
    source_type?: string | null;
    id: string | null;
    allowed_agents: string[];
    blocked_agents: string[];
    allowed_data_types: string[];
    blocked_data_types: string[];
    require_auth: boolean;
    max_requests_per_minute: number;
    max_requests_per_day: number;
    created_at: string | null;
    updated_at: string | null;
    updated_by: string | null;
    has_custom_rule: boolean;
};

export type AccessControlListResult = {
    rules: AccessControlRuleRecord[];
};

export type SourceAccessControlUi = SourceAccessControl & {
    sourceName?: string;
    sourceCategory?: string;
    sourceType?: string;
    hasCustomRule?: boolean;
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

async function aclRequest<T>(path: string, init?: RequestInit): Promise<T> {
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
        throw new DataHubApiError(res.status, message, body.details ?? body);
    }
    return res.json() as Promise<T>;
}

export function mapAccessControlToUi(row: AccessControlRuleRecord): SourceAccessControlUi {
    return {
        sourceId: row.source_id,
        sourceName: row.source_name ?? undefined,
        sourceCategory: row.source_category ?? undefined,
        sourceType: row.source_type ?? undefined,
        allowedAgents: row.allowed_agents || [],
        blockedAgents: row.blocked_agents || [],
        allowedDataTypes: row.allowed_data_types || [],
        blockedDataTypes: row.blocked_data_types || [],
        requireAuth: row.require_auth ?? false,
        maxRequestsPerMinute: row.max_requests_per_minute || undefined,
        maxRequestsPerDay: row.max_requests_per_day || undefined,
        rateLimitWindow: 60,
        hasCustomRule: row.has_custom_rule,
    };
}

export async function fetchAccessControlList(): Promise<SourceAccessControlUi[]> {
    const { rules } = await aclRequest<AccessControlListResult>('/', { method: 'GET' });
    return rules.map(mapAccessControlToUi);
}

export async function fetchAccessControlForSource(sourceId: string): Promise<SourceAccessControlUi> {
    const row = await aclRequest<AccessControlRuleRecord>(`/${sourceId}`, { method: 'GET' });
    return mapAccessControlToUi({
        ...row,
        source_id: sourceId,
        has_custom_rule: Boolean(row.id && row.id !== '00000000-0000-0000-0000-000000000000'),
    });
}

export type UpsertAccessControlPayload = {
    allowed_agents?: string[];
    blocked_agents?: string[];
    allowed_data_types?: string[];
    blocked_data_types?: string[];
    require_auth?: boolean;
    max_requests_per_minute?: number;
    max_requests_per_day?: number;
};

export async function upsertAccessControl(
    sourceId: string,
    payload: UpsertAccessControlPayload,
): Promise<SourceAccessControlUi> {
    const row = await aclRequest<AccessControlRuleRecord>(`/${sourceId}`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return mapAccessControlToUi({ ...row, source_id: sourceId, has_custom_rule: true });
}

export async function resetAccessControl(sourceId: string): Promise<void> {
    await aclRequest<{ message: string }>(`/${sourceId}`, { method: 'DELETE' });
}
