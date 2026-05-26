import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DATA_HUB_KEYS } from './useDataHubState';
import {
    fetchPrioritizationSettings,
    updatePrioritizationSettings,
    fetchPrioritizationSources,
    fetchPrioritizationRuns,
    previewPrioritization,
    applyPrioritization,
    setPrioritizationOverride,
} from '../services/dataHubPrioritizationApi';

export const PRIORITIZATION_KEYS = {
    all: [...DATA_HUB_KEYS.all, 'prioritization'] as const,
    settings: () => [...PRIORITIZATION_KEYS.all, 'settings'] as const,
    sources: () => [...PRIORITIZATION_KEYS.all, 'sources'] as const,
    runs: () => [...PRIORITIZATION_KEYS.all, 'runs'] as const,
};

export function usePrioritizationSettingsQuery() {
    return useQuery({
        queryKey: PRIORITIZATION_KEYS.settings(),
        queryFn: fetchPrioritizationSettings,
        staleTime: 20 * 1000,
    });
}

export function usePrioritizationSourcesQuery() {
    return useQuery({
        queryKey: PRIORITIZATION_KEYS.sources(),
        queryFn: fetchPrioritizationSources,
        staleTime: 15 * 1000,
    });
}

export function usePrioritizationRunsQuery() {
    return useQuery({
        queryKey: PRIORITIZATION_KEYS.runs(),
        queryFn: () => fetchPrioritizationRuns({ limit: 20, offset: 0 }),
        staleTime: 30 * 1000,
    });
}

export function useUpdatePrioritizationSettingsMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: updatePrioritizationSettings,
        onSettled: () => qc.invalidateQueries({ queryKey: PRIORITIZATION_KEYS.all }),
    });
}

export function usePreviewPrioritizationMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: previewPrioritization,
        onSettled: () => qc.invalidateQueries({ queryKey: PRIORITIZATION_KEYS.all }),
    });
}

export function useApplyPrioritizationMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: applyPrioritization,
        onSettled: () => {
            qc.invalidateQueries({ queryKey: PRIORITIZATION_KEYS.all });
            qc.invalidateQueries({ queryKey: [...DATA_HUB_KEYS.all, 'sources'] });
        },
    });
}

export function useSetPrioritizationOverrideMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            sourceId,
            override_score,
            override_note,
        }: {
            sourceId: string;
            override_score: number | null;
            override_note?: string | null;
        }) => setPrioritizationOverride(sourceId, { override_score, override_note }),
        onSettled: () => qc.invalidateQueries({ queryKey: PRIORITIZATION_KEYS.all }),
    });
}

