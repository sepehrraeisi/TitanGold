import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api.ts';
import {
    fetchDataHubSourcesHealth,
    fetchDataHubSourcesState,
    fetchDataHubSourcesStats,
    fetchDuplicateUrlDashboard,
    setDuplicateUrlIgnore,
} from '../services/dataSourcesApi.ts';
import { fetchDataAccessLogs } from '../services/dataAccessLogsApi.ts';
import { DataHubState, DataSource, DataCategory, AIAgent } from '../types.ts';

export const DATA_HUB_KEYS = {
    all: ['dataHub'] as const,
    state: () => [...DATA_HUB_KEYS.all, 'state'] as const,
    agents: () => [...DATA_HUB_KEYS.all, 'agents'] as const,
    sources: (page?: number, limit?: number) =>
        [...DATA_HUB_KEYS.all, 'sources', { page: page ?? 1, limit: limit ?? 20 }] as const,
    categories: () => [...DATA_HUB_KEYS.all, 'categories'] as const,
    pipeline: () => [...DATA_HUB_KEYS.all, 'pipeline'] as const,
    pipelineBacklog: () => [...DATA_HUB_KEYS.all, 'pipelineBacklog'] as const,
    sourcesHealth: () => [...DATA_HUB_KEYS.all, 'sourcesHealth'] as const,
    sourcesStats: () => [...DATA_HUB_KEYS.all, 'sourcesStats'] as const,
    sourcesState: () => [...DATA_HUB_KEYS.all, 'sourcesState'] as const,
    healthLogCounts: () => [...DATA_HUB_KEYS.all, 'healthLogCounts'] as const,
    accessLogs: (params?: { limit?: number; offset?: number }) =>
        [...DATA_HUB_KEYS.all, 'accessLogs', params ?? { limit: 100, offset: 0 }] as const,
    duplicateUrls: () => [...DATA_HUB_KEYS.all, 'duplicateUrls'] as const,
};

export const useDataHubQuery = () => {
    return useQuery({
        queryKey: DATA_HUB_KEYS.state(),
        queryFn: api.fetchDataHubState,
        staleTime: 5 * 60 * 1000,
    });
};

export const useDataSourcesQuery = (params?: { page?: number; limit?: number }) => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    return useQuery({
        queryKey: DATA_HUB_KEYS.sources(page, limit),
        queryFn: () => api.fetchDataSources({ page, limit }),
        staleTime: 30 * 1000,
    });
};

export const useDataCategoriesQuery = () => {
    return useQuery({
        queryKey: DATA_HUB_KEYS.categories(),
        queryFn: api.fetchDataCategories,
        staleTime: 30 * 1000,
    });
};

export const usePipelineQuery = (options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: DATA_HUB_KEYS.pipeline(),
        queryFn: () => api.fetchDataPipelineView({ includeBacklog: false }),
        staleTime: 30 * 1000,
        enabled: options?.enabled ?? true,
    });
};

export const usePipelineBacklogQuery = (options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: DATA_HUB_KEYS.pipelineBacklog(),
        queryFn: api.fetchDataPipelineBacklog,
        staleTime: 60 * 1000,
        enabled: options?.enabled ?? true,
    });
};

export const useDataHubSourcesHealthQuery = (options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: DATA_HUB_KEYS.sourcesHealth(),
        queryFn: fetchDataHubSourcesHealth,
        staleTime: 30 * 1000,
        enabled: options?.enabled ?? true,
    });
};

export const useDataHubSourcesStatsQuery = (options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: DATA_HUB_KEYS.sourcesStats(),
        queryFn: fetchDataHubSourcesStats,
        staleTime: 30 * 1000,
        enabled: options?.enabled ?? true,
    });
};

export const useDataHubSourcesStateQuery = (options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: DATA_HUB_KEYS.sourcesState(),
        queryFn: fetchDataHubSourcesState,
        staleTime: 30 * 1000,
        enabled: options?.enabled ?? true,
    });
};

/** Lightweight fetch for error counts shown on Health tab */
export const useDataHubHealthLogCountsQuery = (options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: DATA_HUB_KEYS.healthLogCounts(),
        queryFn: () => fetchDataAccessLogs({ limit: 1, offset: 0 }),
        staleTime: 30 * 1000,
        enabled: options?.enabled ?? true,
    });
};

export const useAccessLogsQuery = (options?: { enabled?: boolean; limit?: number; offset?: number }) => {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    return useQuery({
        queryKey: DATA_HUB_KEYS.accessLogs({ limit, offset }),
        queryFn: () => api.fetchDataAccessLogs({ limit, offset }),
        staleTime: 30 * 1000,
        enabled: options?.enabled ?? true,
    });
};

export const useAgentsQuery = () => {
    return useQuery({
        queryKey: DATA_HUB_KEYS.agents(),
        queryFn: async () => {
            const agents = await api.fetchAIAgents();
            return agents.map(a => ({
                id: a.id,
                name: a.name,
                symbol: a.id,
                type: 'token' as const,
                category: 'trading' as const,
                status: a.status === 'active' ? ('active' as const) : ('inactive' as const),
                lastUpdate: a.lastUpdate || new Date().toISOString(),
                metrics: {
                    accuracy: a.accuracy || 0.85,
                    // Leak guard: avoid presenting synthetic telemetry as real backend metrics.
                    latency: null,
                    throughput: null,
                    errorRate: null,
                },
            }));
        },
        staleTime: 10 * 60 * 1000,
    });
};

export const useDuplicateUrlDashboardQuery = (options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: DATA_HUB_KEYS.duplicateUrls(),
        queryFn: fetchDuplicateUrlDashboard,
        staleTime: 30 * 1000,
        enabled: options?.enabled ?? true,
    });
};

export const useSetDuplicateUrlIgnoreMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ sourceId, ignore }: { sourceId: string; ignore: boolean }) =>
            setDuplicateUrlIgnore(sourceId, ignore),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.duplicateUrls() });
            queryClient.invalidateQueries({ queryKey: [...DATA_HUB_KEYS.all, 'sources'] });
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.sourcesHealth() });
        },
    });
};

export const useCreateSourceMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            source,
            allowDuplicateUrl,
        }: {
            source: Parameters<typeof api.createDataSource>[0];
            allowDuplicateUrl?: boolean;
        }) => api.createDataSource(source, { allowDuplicateUrl }),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: [...DATA_HUB_KEYS.all, 'sources'] });
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.categories() });
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.state() });
        },
    });
};

export const useUpdateSourceMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            updates,
            allowDuplicateUrl,
        }: {
            id: string;
            updates: Partial<DataSource>;
            allowDuplicateUrl?: boolean;
        }) => api.updateDataSource(id, updates, { allowDuplicateUrl }),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: [...DATA_HUB_KEYS.all, 'sources'] });
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.categories() });
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.state() });
        },
    });
};

export const useDeleteSourceMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, hard }: { id: string; hard?: boolean }) =>
            api.deleteDataSource(id, { hard }),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: [...DATA_HUB_KEYS.all, 'sources'] });
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.categories() });
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.state() });
        },
    });
};

export const useRestoreSourceMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.restoreDataSource,
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: [...DATA_HUB_KEYS.all, 'sources'] });
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.categories() });
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.state() });
        },
    });
};

export const useCreateCategoryMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createDataCategory,
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.categories() });
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.state() });
        },
    });
};

export const useUpdateCategoryMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<DataCategory> }) =>
            api.updateDataCategory(id, updates),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.categories() });
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.state() });
        },
    });
};

export const useDeleteCategoryMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.deleteDataCategory,
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.categories() });
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.state() });
        },
    });
};
