import { DataCategory } from '../types';
import { DataHubApiError } from './dataSourcesApi';

const BASE = '/api/v1/data-categories';

type BackendCategoryRow = Record<string, unknown>;

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

async function categoriesRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

export function mapBackendRowToDataCategory(
    row: BackendCategoryRow,
    sourceCount = 0,
): DataCategory {
    return {
        id: String(row.id),
        name: String(row.name || ''),
        description: row.description != null ? String(row.description) : undefined,
        color: row.color != null ? String(row.color) : undefined,
        icon: row.icon != null ? String(row.icon) : undefined,
        tags: [],
        sourceCount,
        dataTypes: [],
        createdAt: String(row.created_at || new Date().toISOString()),
    };
}

function mapUiCategoryToApiPayload(
    category: Partial<DataCategory> & { name: string },
): Record<string, unknown> {
    return {
        name: category.name,
        description: category.description ?? '',
        color: category.color ?? '#9333ea',
        icon: category.icon ?? 'Tag',
    };
}

export function enrichCategoriesWithSourceCounts(
    categories: DataCategory[],
    sources: { category?: string }[],
): DataCategory[] {
    const counts: Record<string, number> = {};
    for (const source of sources) {
        const key = source.category || 'uncategorized';
        counts[key] = (counts[key] || 0) + 1;
    }
    return categories.map(cat => ({
        ...cat,
        sourceCount: counts[cat.name] ?? 0,
    }));
}

export async function fetchDataCategories(): Promise<DataCategory[]> {
    const rows = await categoriesRequest<BackendCategoryRow[]>('/', { method: 'GET' });
    return (rows || []).map(row => mapBackendRowToDataCategory(row, 0));
}

export async function fetchDataCategory(id: string): Promise<DataCategory> {
    const row = await categoriesRequest<BackendCategoryRow>(`/${id}`, { method: 'GET' });
    return mapBackendRowToDataCategory(row, 0);
}

export async function createDataCategory(
    category: Omit<DataCategory, 'id' | 'createdAt' | 'sourceCount'>,
): Promise<DataCategory> {
    const row = await categoriesRequest<BackendCategoryRow>('/', {
        method: 'POST',
        body: JSON.stringify(mapUiCategoryToApiPayload(category)),
    });
    return mapBackendRowToDataCategory(row, 0);
}

export async function updateDataCategory(
    id: string,
    updates: Partial<DataCategory>,
): Promise<DataCategory> {
    if (!updates.name) {
        const existing = await fetchDataCategory(id);
        updates = { ...existing, ...updates };
    }
    const row = await categoriesRequest<BackendCategoryRow>(`/${id}`, {
        method: 'PUT',
        body: JSON.stringify(mapUiCategoryToApiPayload({ name: updates.name!, ...updates })),
    });
    return mapBackendRowToDataCategory(row, 0);
}

export async function deleteDataCategory(id: string): Promise<void> {
    await categoriesRequest<void>(`/${id}`, { method: 'DELETE' });
}
