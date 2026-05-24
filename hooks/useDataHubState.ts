import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api.ts';
import { DataHubState, DataSource, DataCategory, AIAgent } from '../types.ts';

export const DATA_HUB_KEYS = {
    all: ['dataHub'] as const,
    state: () => [...DATA_HUB_KEYS.all, 'state'] as const,
    agents: () => [...DATA_HUB_KEYS.all, 'agents'] as const,
    sources: (page?: number, limit?: number) =>
        [...DATA_HUB_KEYS.all, 'sources', { page: page ?? 1, limit: limit ?? 20 }] as const,
    categories: () => [...DATA_HUB_KEYS.all, 'categories'] as const,
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
                    latency: 120,
                    throughput: 50,
                    errorRate: 0.02,
                },
            }));
        },
        staleTime: 10 * 60 * 1000,
    });
};

export const useCreateSourceMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createDataSource,
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
        mutationFn: ({ id, updates }: { id: string; updates: Partial<DataSource> }) =>
            api.updateDataSource(id, updates),
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
