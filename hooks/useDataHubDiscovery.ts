import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchDiscoverySettings,
    updateDiscoverySettings,
    fetchDiscoveryStats,
    fetchDiscoverySuggestions,
    fetchDiscoveryRules,
    createDiscoveryRule,
    deleteDiscoveryRule,
    runDiscoveryScan,
    approveDiscoverySuggestion,
    rejectDiscoverySuggestion,
    DiscoverySuggestionStatus,
} from '../services/dataHubDiscoveryApi';
import { DATA_HUB_KEYS } from './useDataHubState';

export const DISCOVERY_KEYS = {
    all: [...DATA_HUB_KEYS.all, 'discovery'] as const,
    stats: () => [...DISCOVERY_KEYS.all, 'stats'] as const,
    suggestions: (status?: DiscoverySuggestionStatus) =>
        [...DISCOVERY_KEYS.all, 'suggestions', status ?? 'all'] as const,
    rules: () => [...DISCOVERY_KEYS.all, 'rules'] as const,
    settings: () => [...DISCOVERY_KEYS.all, 'settings'] as const,
};

export function useDiscoveryStatsQuery() {
    return useQuery({
        queryKey: DISCOVERY_KEYS.stats(),
        queryFn: fetchDiscoveryStats,
        staleTime: 20 * 1000,
    });
}

export function useDiscoverySuggestionsQuery(status?: DiscoverySuggestionStatus) {
    return useQuery({
        queryKey: DISCOVERY_KEYS.suggestions(status),
        queryFn: () => fetchDiscoverySuggestions({ status, limit: 100 }),
        staleTime: 15 * 1000,
    });
}

export function useDiscoveryRulesQuery() {
    return useQuery({
        queryKey: DISCOVERY_KEYS.rules(),
        queryFn: fetchDiscoveryRules,
        staleTime: 30 * 1000,
    });
}

export function useUpdateDiscoverySettingsMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (enabled: boolean) => updateDiscoverySettings(enabled),
        onSettled: () => qc.invalidateQueries({ queryKey: DISCOVERY_KEYS.all }),
    });
}

export function useRunDiscoveryScanMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: runDiscoveryScan,
        onSettled: () => qc.invalidateQueries({ queryKey: DISCOVERY_KEYS.all }),
    });
}

export function useApproveSuggestionMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            review_note,
            name,
        }: {
            id: string;
            review_note?: string;
            name?: string;
        }) => approveDiscoverySuggestion(id, { review_note, name }),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: DISCOVERY_KEYS.all });
            qc.invalidateQueries({ queryKey: [...DATA_HUB_KEYS.all, 'sources'] });
        },
    });
}

export function useRejectSuggestionMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, review_note }: { id: string; review_note?: string }) =>
            rejectDiscoverySuggestion(id, review_note),
        onSettled: () => qc.invalidateQueries({ queryKey: DISCOVERY_KEYS.all }),
    });
}

export function useCreateDiscoveryRuleMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: createDiscoveryRule,
        onSettled: () => qc.invalidateQueries({ queryKey: DISCOVERY_KEYS.rules() }),
    });
}

export function useDeleteDiscoveryRuleMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: deleteDiscoveryRule,
        onSettled: () => qc.invalidateQueries({ queryKey: DISCOVERY_KEYS.rules() }),
    });
}
