import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DATA_HUB_KEYS } from './useDataHubState';
import {
    buildCollectorUrl,
    fetchCollectorJson,
    diagnoseTelegramCollector,
    type DiagnoseCollectorCheck,
} from '../services/api';

export const COLLECTOR_KEYS = {
    all: [...DATA_HUB_KEYS.all, 'telegram-collector'] as const,
    accounts: () => [...COLLECTOR_KEYS.all, 'accounts'] as const,
    channels: (filters?: { accountId?: string; status?: string }) =>
        [...COLLECTOR_KEYS.all, 'channels', filters ?? {}] as const,
    health: () => [...COLLECTOR_KEYS.all, 'health'] as const,
    polling: () => [...COLLECTOR_KEYS.all, 'polling'] as const,
    diagnose: () => [...COLLECTOR_KEYS.all, 'diagnose'] as const,
};

export type CollectorAccount = {
    id: string;
    phone: string;
    phone_masked?: string;
    label?: string | null;
    status: string;
    last_login_at?: string | null;
    last_used_at?: string | null;
    last_flood_until?: string | null;
    is_primary: boolean;
    has_session?: boolean;
};

export type CollectorChannelRow = {
    id: string;
    channelId: string;
    username?: string | null;
    title?: string | null;
    isActive: boolean;
    accountId?: string | null;
    lastSyncedAt?: string | null;
    priority?: 'high' | 'normal' | 'low';
    errorCount?: number;
    lastError?: string | null;
};

export function useCollectorAccountsQuery(enabled = true) {
    return useQuery({
        queryKey: COLLECTOR_KEYS.accounts(),
        queryFn: async () => {
            const data = await fetchCollectorJson<{ accounts?: CollectorAccount[] }>(
                buildCollectorUrl('/api/telegram-collector/accounts'),
            );
            return Array.isArray(data.accounts) ? data.accounts : [];
        },
        staleTime: 20_000,
        enabled,
    });
}

export function useCollectorChannelsQuery(
    filters: { accountId?: string; status?: string } = {},
    enabled = true,
) {
    return useQuery({
        queryKey: COLLECTOR_KEYS.channels(filters),
        queryFn: async () => {
            const url = new URL(
                buildCollectorUrl('/api/telegram-collector/collector-channels'),
                typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
            );
            if (filters.accountId && filters.accountId !== 'all') {
                url.searchParams.set('account_id', filters.accountId);
            }
            if (filters.status && filters.status !== 'all') {
                url.searchParams.set('status', filters.status);
            }
            const data = await fetchCollectorJson<{ channels?: CollectorChannelRow[] }>(url.toString());
            return Array.isArray(data.channels) ? data.channels : [];
        },
        staleTime: 20_000,
        enabled,
    });
}

export function useCollectorHealthQuery(enabled = true) {
    return useQuery({
        queryKey: COLLECTOR_KEYS.health(),
        queryFn: () =>
            fetchCollectorJson<Record<string, unknown>>(buildCollectorUrl('/api/telegram-collector/health')),
        staleTime: 15_000,
        enabled,
    });
}

export function useCollectorPollingQuery(enabled = true) {
    return useQuery({
        queryKey: COLLECTOR_KEYS.polling(),
        queryFn: () =>
            fetchCollectorJson<Record<string, unknown>>(
                buildCollectorUrl('/api/telegram-collector/polling/status'),
            ),
        staleTime: 15_000,
        enabled,
    });
}

export async function runCollectorDiagnose(): Promise<{
    ok: boolean;
    checks: DiagnoseCollectorCheck[];
}> {
    return diagnoseTelegramCollector();
}

export function useInvalidateCollectorQueries() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: COLLECTOR_KEYS.all });
}
