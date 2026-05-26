import { DataHubApiError } from './dataSourcesApi';

const BASE = '/api/v1/data-hub/filter-rules';

export type FilterRuleType = 'blacklist' | 'whitelist';
export type FilterRuleScope = 'domain' | 'source' | 'keyword';
export type FilterMatchType = 'exact' | 'contains' | 'regex';
export type FilterApplyTarget = 'ingestion' | 'publishing' | 'both';
export type FilterAction = 'block' | 'allow';

export type DataHubFilterRule = {
    id: string;
    rule_type: FilterRuleType;
    scope: FilterRuleScope;
    pattern: string;
    match_type: FilterMatchType;
    apply_target: FilterApplyTarget;
    action: FilterAction;
    is_active: boolean;
    priority: number;
    metadata: Record<string, unknown>;
    reason?: string | null;
    created_by?: string | null;
    deleted_at?: string | null;
    last_matched_at?: string | null;
    created_at: string;
    updated_at: string;
};

export type CreateFilterRulePayload = {
    rule_type: FilterRuleType;
    scope: FilterRuleScope;
    pattern: string;
    match_type?: FilterMatchType;
    apply_target?: FilterApplyTarget;
    is_active?: boolean;
    priority?: number;
    metadata?: Record<string, unknown>;
    reason?: string | null;
};

export type UpdateFilterRulePayload = Partial<CreateFilterRulePayload>;

export type EvaluateFilterPayload = {
    source_id?: string;
    url?: string;
    text?: string;
    apply_target?: FilterApplyTarget;
};

export type EvaluateFilterResult = {
    allowed: boolean;
    decision: string;
    reason: string;
    apply_target: FilterApplyTarget;
    matched_rules: DataHubFilterRule[];
};

export type ListFilterRulesParams = {
    rule_type?: FilterRuleType;
    scope?: FilterRuleScope;
    apply_target?: FilterApplyTarget;
    active_only?: boolean;
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

async function filterRulesRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

export async function fetchFilterRules(
    params: ListFilterRulesParams = {},
): Promise<DataHubFilterRule[]> {
    const qs = new URLSearchParams();
    if (params.rule_type) qs.set('rule_type', params.rule_type);
    if (params.scope) qs.set('scope', params.scope);
    if (params.apply_target) qs.set('apply_target', params.apply_target);
    if (params.active_only) qs.set('active_only', 'true');
    const q = qs.toString();
    const data = await filterRulesRequest<{ rules: DataHubFilterRule[] }>(
        q ? `?${q}` : '',
    );
    return data.rules;
}

export async function createFilterRule(
    payload: CreateFilterRulePayload,
): Promise<DataHubFilterRule> {
    const data = await filterRulesRequest<{ rule: DataHubFilterRule }>('', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return data.rule;
}

export async function updateFilterRule(
    id: string,
    payload: UpdateFilterRulePayload,
): Promise<DataHubFilterRule> {
    const data = await filterRulesRequest<{ rule: DataHubFilterRule }>(`/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    return data.rule;
}

export async function deleteFilterRule(id: string): Promise<DataHubFilterRule> {
    const data = await filterRulesRequest<{ rule: DataHubFilterRule }>(`/${id}`, {
        method: 'DELETE',
    });
    return data.rule;
}

export async function evaluateFilterRules(
    payload: EvaluateFilterPayload,
): Promise<EvaluateFilterResult> {
    return filterRulesRequest<EvaluateFilterResult>('/evaluate', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}
