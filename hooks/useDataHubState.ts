import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api.ts';
import { DataHubState, DataSource, DataCategory, AIAgent } from '../types.ts';

export const DATA_HUB_KEYS = {
    all: ['dataHub'] as const,
    state: () => [...DATA_HUB_KEYS.all, 'state'] as const,
    agents: () => [...DATA_HUB_KEYS.all, 'agents'] as const,
};

export const useDataHubQuery = () => {
    return useQuery({
        queryKey: DATA_HUB_KEYS.state(),
        queryFn: api.fetchDataHubState,
        staleTime: 5 * 60 * 1000, // 5 minutes
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
                symbol: a.id, // Fallback since AIAgent doesn't have symbol
                type: 'token' as const,
                category: 'trading' as const,
                status: a.status === 'active' ? ('active' as const) : ('inactive' as const),
                lastUpdate: a.lastUpdate || new Date().toISOString(),
                metrics: {
                    accuracy: a.accuracy || 0.85,
                    latency: 120,
                    throughput: 50,
                    errorRate: 0.02
                }
            }));
        },
        staleTime: 10 * 60 * 1000, // 10 minutes
    });
};

// Mutations for Data Sources
export const useCreateSourceMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createDataSource,
        onMutate: async (newSource) => {
            await queryClient.cancelQueries({ queryKey: DATA_HUB_KEYS.state() });
            const previousState = queryClient.getQueryData<DataHubState>(DATA_HUB_KEYS.state());
            if (previousState) {
                queryClient.setQueryData<DataHubState>(DATA_HUB_KEYS.state(), {
                    ...previousState,
                    sources: [...previousState.sources, { ...newSource, id: 'temp-' + Date.now() } as DataSource]
                });
            }
            return { previousState };
        },
        onError: (err, newSource, context) => {
            if (context?.previousState) {
                queryClient.setQueryData(DATA_HUB_KEYS.state(), context.previousState);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.state() });
        },
    });
};

export const useUpdateSourceMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<DataSource> }) => api.updateDataSource(id, updates),
        onMutate: async ({ id, updates }) => {
            await queryClient.cancelQueries({ queryKey: DATA_HUB_KEYS.state() });
            const previousState = queryClient.getQueryData<DataHubState>(DATA_HUB_KEYS.state());
            if (previousState) {
                queryClient.setQueryData<DataHubState>(DATA_HUB_KEYS.state(), {
                    ...previousState,
                    sources: previousState.sources.map(s => s.id === id ? { ...s, ...updates } : s)
                });
            }
            return { previousState };
        },
        onError: (err, variables, context) => {
            if (context?.previousState) {
                queryClient.setQueryData(DATA_HUB_KEYS.state(), context.previousState);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.state() });
        },
    });
};

export const useDeleteSourceMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.deleteDataSource,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: DATA_HUB_KEYS.state() });
            const previousState = queryClient.getQueryData<DataHubState>(DATA_HUB_KEYS.state());
            if (previousState) {
                queryClient.setQueryData<DataHubState>(DATA_HUB_KEYS.state(), {
                    ...previousState,
                    sources: previousState.sources.filter(s => s.id !== id)
                });
            }
            return { previousState };
        },
        onError: (err, id, context) => {
            if (context?.previousState) {
                queryClient.setQueryData(DATA_HUB_KEYS.state(), context.previousState);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.state() });
        },
    });
};

// Mutations for Data Categories
export const useCreateCategoryMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createDataCategory,
        onMutate: async (newCategory) => {
            await queryClient.cancelQueries({ queryKey: DATA_HUB_KEYS.state() });
            const previousState = queryClient.getQueryData<DataHubState>(DATA_HUB_KEYS.state());
            if (previousState) {
                queryClient.setQueryData<DataHubState>(DATA_HUB_KEYS.state(), {
                    ...previousState,
                    categories: [...previousState.categories, { ...newCategory, id: 'temp-' + Date.now() } as DataCategory]
                });
            }
            return { previousState };
        },
        onError: (err, newCategory, context) => {
            if (context?.previousState) {
                queryClient.setQueryData(DATA_HUB_KEYS.state(), context.previousState);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.state() });
        },
    });
};

export const useUpdateCategoryMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<DataCategory> }) => api.updateDataCategory(id, updates),
        onMutate: async ({ id, updates }) => {
            await queryClient.cancelQueries({ queryKey: DATA_HUB_KEYS.state() });
            const previousState = queryClient.getQueryData<DataHubState>(DATA_HUB_KEYS.state());
            if (previousState) {
                queryClient.setQueryData<DataHubState>(DATA_HUB_KEYS.state(), {
                    ...previousState,
                    categories: previousState.categories.map(c => c.id === id ? { ...c, ...updates } : c)
                });
            }
            return { previousState };
        },
        onError: (err, variables, context) => {
            if (context?.previousState) {
                queryClient.setQueryData(DATA_HUB_KEYS.state(), context.previousState);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.state() });
        },
    });
};

export const useDeleteCategoryMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.deleteDataCategory,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: DATA_HUB_KEYS.state() });
            const previousState = queryClient.getQueryData<DataHubState>(DATA_HUB_KEYS.state());
            if (previousState) {
                queryClient.setQueryData<DataHubState>(DATA_HUB_KEYS.state(), {
                    ...previousState,
                    categories: previousState.categories.filter(c => c.id !== id)
                });
            }
            return { previousState };
        },
        onError: (err, id, context) => {
            if (context?.previousState) {
                queryClient.setQueryData(DATA_HUB_KEYS.state(), context.previousState);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: DATA_HUB_KEYS.state() });
        },
    });
};
