import { PublisherHistoryItem } from '../types';
import { DataHubApiError } from './dataSourcesApi';

const BASE = '/api/v1/data-hub/telegram-publishers';

export type TelegramPublisherRecord = {
    id: string;
    name: string;
    channel_id: string;
    channel_username?: string | null;
    channel_title?: string | null;
    has_bot_token: boolean;
    is_active: boolean;
    language: string;
    template: string;
    schedule_config: Record<string, unknown>;
    sent_count: number;
    last_sent_at?: string | null;
    created_at: string;
    updated_at: string;
};

export type PublisherMetrics = {
    totalChannels: number;
    delivered24h: number;
    failed24h: number;
    successRate: number;
};

export type TelegramPublishersListResult = {
    publishers: TelegramPublisherRecord[];
    metrics: PublisherMetrics;
};

export type PublisherHistoryRecord = {
    id: string;
    publisher_id: string;
    publisher_name?: string | null;
    source_id?: string | null;
    source_name?: string | null;
    data_type?: string | null;
    content_type?: string | null;
    content_summary?: string | null;
    status: string;
    telegram_message_id?: string | null;
    error_message?: string | null;
    error_code?: string | null;
    delivery_mode?: string | null;
    created_by?: string | null;
    created_by_email?: string | null;
    metadata?: Record<string, unknown>;
    created_at: string;
};

export type PublisherMappingRecord = {
    id: string;
    source_id: string;
    source_name: string;
    source_type: string;
    publisher_id: string;
    publisher_name: string;
    publisher_channel_id: string;
    publisher_channel_username?: string | null;
    is_enabled: boolean;
    template_id?: string | null;
    last_activity_at?: string | null;
    last_status?: string | null;
    created_at: string;
    updated_at: string;
};

export type PublishActionResult = {
    success: boolean;
    dry_run: boolean;
    status: string;
    telegram_message_id?: string | null;
    error?: string | null;
    history_id: string;
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

async function publishersRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

function errorDetailsText(details: unknown): string | null {
    if (!details || typeof details !== 'object') return null;
    const record = details as Record<string, unknown>;
    const parts = [record.code, record.reason, record.error]
        .filter((v): v is string => typeof v === 'string' && v.length > 0);
    return parts.length ? parts.join(' · ') : null;
}

export function mapHistoryToUiItem(
    row: PublisherHistoryRecord,
): PublisherHistoryItem {
    const ok = row.status === 'sent' || row.status === 'test' || row.status === 'dry_run';
    const sourceLabel = row.source_name ? ` · ${row.source_name}` : '';
    const errorLabel = row.error_code ? `[${row.error_code}] ` : '';
    return {
        id: row.id,
        queueId: '',
        recordId: '',
        topicId: '',
        publisherId: row.publisher_id,
        agentId: 'system',
        status: ok && row.status !== 'failed' && row.status !== 'blocked' ? 'sent' : 'failed',
        sentAt: row.created_at,
        payloadPreview:
            `${errorLabel}${row.content_summary || row.error_message || row.status}${sourceLabel}`,
    };
}

export async function fetchTelegramPublishers(): Promise<TelegramPublishersListResult> {
    return publishersRequest<TelegramPublishersListResult>('/', { method: 'GET' });
}

export async function fetchPublisherMappings(): Promise<{ mappings: PublisherMappingRecord[] }> {
    return publishersRequest<{ mappings: PublisherMappingRecord[] }>('/mappings', { method: 'GET' });
}

export type CreatePublisherMappingPayload = {
    source_id: string;
    publisher_id: string;
    is_enabled?: boolean;
    template_id?: string | null;
};

export async function createPublisherMapping(
    payload: CreatePublisherMappingPayload,
): Promise<PublisherMappingRecord> {
    return publishersRequest<PublisherMappingRecord>('/mappings', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function updatePublisherMapping(
    id: string,
    payload: Partial<CreatePublisherMappingPayload>,
): Promise<PublisherMappingRecord> {
    return publishersRequest<PublisherMappingRecord>(`/mappings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

export async function disablePublisherMapping(id: string): Promise<PublisherMappingRecord> {
    return publishersRequest<PublisherMappingRecord>(`/mappings/${id}`, { method: 'DELETE' });
}

export async function fetchPublisherHistory(
    publisherId: string,
    params?: { limit?: number; offset?: number },
): Promise<{ data: PublisherHistoryRecord[]; pagination: { total: number; hasMore: boolean } }> {
    const search = new URLSearchParams();
    search.set('limit', String(params?.limit ?? 50));
    search.set('offset', String(params?.offset ?? 0));
    return publishersRequest(`/${publisherId}/history?${search.toString()}`, { method: 'GET' });
}

export type CreateTelegramPublisherPayload = {
    name: string;
    channel_id: string;
    channel_username?: string;
    channel_title?: string;
    bot_token?: string;
    is_active?: boolean;
    language?: string;
    template?: string;
    schedule_config?: Record<string, unknown>;
};

export async function createTelegramPublisher(
    payload: CreateTelegramPublisherPayload,
): Promise<TelegramPublisherRecord> {
    return publishersRequest<TelegramPublisherRecord>('/', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function updateTelegramPublisher(
    id: string,
    payload: Partial<CreateTelegramPublisherPayload>,
): Promise<TelegramPublisherRecord> {
    return publishersRequest<TelegramPublisherRecord>(`/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

export async function disableTelegramPublisher(id: string): Promise<void> {
    await publishersRequest<{ message: string }>(`/${id}`, { method: 'DELETE' });
}

export async function testTelegramPublisher(
    id: string,
    message?: string,
): Promise<PublishActionResult> {
    return publishersRequest<PublishActionResult>(`/${id}/test`, {
        method: 'POST',
        body: JSON.stringify({ message }),
    });
}

export async function publishToTelegramPublisher(
    id: string,
    payload: {
        message: string;
        content_type?: string;
        confirm_publish: boolean;
        source_id: string;
        data_type?: string;
        title?: string;
        content?: string;
        allow_temporary_publish?: boolean;
    },
): Promise<PublishActionResult> {
    return publishersRequest<PublishActionResult>(`/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function formatPublisherApiError(error: unknown): string {
    if (error instanceof DataHubApiError) {
        const details = errorDetailsText(error.details);
        return details ? `${error.message} (${details})` : error.message;
    }
    return error instanceof Error ? error.message : 'Request failed';
}
