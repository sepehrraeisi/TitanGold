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
    ignoreDiscoverySuggestion,
    fetchDiscoveryHistory,
    fetchDiscoveryScanDetail,
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
    history: () => [...DISCOVERY_KEYS.all, 'history'] as const,
    scanDetail: (id: string) => [...DISCOVERY_KEYS.all, 'scan', id] as const,
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

export function useDiscoveryHistoryQuery(limit = 20) {
    return useQuery({
        queryKey: DISCOVERY_KEYS.history(),
        queryFn: () => fetchDiscoveryHistory(limit),
        staleTime: 20 * 1000,
    });
}

export function useDiscoveryScanDetailQuery(scanId: string | null) {
    return useQuery({
        queryKey: DISCOVERY_KEYS.scanDetail(scanId || 'none'),
        queryFn: () => fetchDiscoveryScanDetail(scanId!),
        enabled: Boolean(scanId),
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
            allow_duplicate_url,
        }: {
            id: string;
            review_note?: string;
            name?: string;
            allow_duplicate_url?: boolean;
        }) => approveDiscoverySuggestion(id, { review_note, name, allow_duplicate_url }),
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

export function useIgnoreSuggestionMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, review_note }: { id: string; review_note?: string }) =>
            ignoreDiscoverySuggestion(id, review_note),
        onSettled: () => qc.invalidateQueries({ queryKey: DISCOVERY_KEYS.all }),
    });
}

export function useCreateDiscoveryRuleMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: createDiscoveryRule,
        onSettled: () => {
            qc.invalidateQueries({ queryKey: DISCOVERY_KEYS.rules() });
            qc.invalidateQueries({ queryKey: DISCOVERY_KEYS.stats() });
        },
    });
}

export function useDeleteDiscoveryRuleMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: deleteDiscoveryRule,
        onSettled: () => {
            qc.invalidateQueries({ queryKey: DISCOVERY_KEYS.rules() });
            qc.invalidateQueries({ queryKey: DISCOVERY_KEYS.stats() });
        },
    });
}
