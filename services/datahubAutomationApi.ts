import { AgentTopicFormValues, AgentTopicRoute, AutomationScheduleConfig, PublisherQueueItem } from '../types';
import { DataHubApiError } from './dataSourcesApi';

const BASE = '/api/v1/data-hub/automation';

export type AutomationExecutionRecord = {
    id: string;
    queueId?: string | null;
    recordId?: string;
    topicId?: string;
    publisherId?: string;
    agentId?: string;
    status: 'sent' | 'failed';
    dryRun?: boolean;
    sentAt: string;
    latencyMs?: number;
    payloadPreview?: string;
    errorMessage?: string;
    topicName?: string;
    publisherName?: string;
};

export type AutomationOverview = {
    topics: AgentTopicRoute[];
    schedule: AutomationScheduleConfig;
    queue: PublisherQueueItem[];
    executions: AutomationExecutionRecord[];
    summary: {
        totalTopics: number;
        enabledTopics: number;
        queueSize: number;
        avgPassRate: number;
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

async function automationRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

export async function fetchAutomationOverview(): Promise<AutomationOverview> {
    return automationRequest<AutomationOverview>('/overview', { method: 'GET' });
}

export async function fetchAutomationTopics(): Promise<{ topics: AgentTopicRoute[] }> {
    return automationRequest('/topics', { method: 'GET' });
}

export async function createAutomationTopicApi(
    values: AgentTopicFormValues & { agentName?: string },
): Promise<AgentTopicRoute> {
    const { topic } = await automationRequest<{ topic: AgentTopicRoute }>('/topics', {
        method: 'POST',
        body: JSON.stringify({
            title: values.title,
            name: values.title,
            agentId: values.agentId,
            agentName: values.agentName,
            description: values.description,
            categoryIds: values.categoryIds,
            dataTypes: values.dataTypes,
            tags: values.tags,
            priority: values.priority,
            minPassRate: values.minPassRate,
            minQualityScore: values.minQualityScore,
            includeStatuses: values.includeStatuses,
            publisherTargets: values.publisherTargets,
            enabled: values.enabled,
        }),
    });
    return topic;
}

export async function updateAutomationTopicApi(
    id: string,
    values: Partial<AgentTopicFormValues>,
): Promise<AgentTopicRoute> {
    const { topic } = await automationRequest<{ topic: AgentTopicRoute }>(`/topics/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
            title: values.title,
            name: values.title,
            agentId: values.agentId,
            description: values.description,
            categoryIds: values.categoryIds,
            dataTypes: values.dataTypes,
            tags: values.tags,
            priority: values.priority,
            minPassRate: values.minPassRate,
            minQualityScore: values.minQualityScore,
            includeStatuses: values.includeStatuses,
            publisherTargets: values.publisherTargets,
            enabled: values.enabled,
        }),
    });
    return topic;
}

export async function deleteAutomationTopicApi(id: string): Promise<void> {
    await automationRequest(`/topics/${id}`, { method: 'DELETE' });
}

export async function fetchAutomationSchedule(): Promise<{ schedule: AutomationScheduleConfig }> {
    return automationRequest('/schedule', { method: 'GET' });
}

export async function updateAutomationScheduleApi(
    schedule: Partial<AutomationScheduleConfig>,
): Promise<{ schedule: AutomationScheduleConfig }> {
    return automationRequest('/schedule', {
        method: 'PUT',
        body: JSON.stringify({
            enabled: schedule.enabled,
            intervalMinutes: schedule.intervalMinutes,
            maxItemsPerRun: schedule.maxItemsPerRun,
        }),
    });
}

export async function refreshAutomationQueueApi(): Promise<{
    added: number;
    queue: PublisherQueueItem[];
}> {
    return automationRequest('/queue/refresh', { method: 'POST' });
}

export async function dispatchAutomationQueueApi(options?: {
    limit?: number;
    dry_run?: boolean;
}): Promise<{
    processed: number;
    queue: PublisherQueueItem[];
    executions: AutomationExecutionRecord[];
}> {
    return automationRequest('/queue/dispatch', {
        method: 'POST',
        body: JSON.stringify({
            limit: options?.limit ?? 5,
            dry_run: options?.dry_run ?? false,
        }),
    });
}

export async function dispatchQueueItemApi(
    id: string,
    dry_run = false,
): Promise<unknown> {
    return automationRequest(`/queue/${id}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({ dry_run }),
    });
}

export async function failQueueItemApi(id: string, error_message?: string): Promise<void> {
    await automationRequest(`/queue/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ error_message }),
    });
}

export async function retryAutomationExecutionApi(id: string): Promise<unknown> {
    return automationRequest(`/executions/${id}/retry`, { method: 'POST' });
}

export async function runAutomationTestApi(options?: {
    topic_id?: string;
    dry_run?: boolean;
}): Promise<unknown> {
    return automationRequest('/test-run', {
        method: 'POST',
        body: JSON.stringify({
            topic_id: options?.topic_id,
            dry_run: options?.dry_run ?? true,
        }),
    });
}

export async function fetchAutomationExecutions(params?: {
    limit?: number;
    offset?: number;
}): Promise<{ executions: AutomationExecutionRecord[] }> {
    const search = new URLSearchParams();
    search.set('limit', String(params?.limit ?? 50));
    search.set('offset', String(params?.offset ?? 0));
    return automationRequest(`/executions?${search.toString()}`, { method: 'GET' });
}
