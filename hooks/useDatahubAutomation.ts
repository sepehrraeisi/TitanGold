import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchAutomationOverview,
    createAutomationTopicApi,
    updateAutomationTopicApi,
    deleteAutomationTopicApi,
    updateAutomationScheduleApi,
    refreshAutomationQueueApi,
    dispatchAutomationQueueApi,
    dispatchQueueItemApi,
    failQueueItemApi,
    retryAutomationExecutionApi,
    runAutomationTestApi,
} from '../services/datahubAutomationApi';
import { AgentTopicFormValues, AutomationScheduleConfig } from '../types';
import { DATA_HUB_KEYS } from './useDataHubState';

export const AUTOMATION_KEYS = {
    all: [...DATA_HUB_KEYS.all, 'automation'] as const,
    overview: () => [...AUTOMATION_KEYS.all, 'overview'] as const,
};

export function useAutomationOverviewQuery(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: AUTOMATION_KEYS.overview(),
        queryFn: fetchAutomationOverview,
        staleTime: 20 * 1000,
        enabled: options?.enabled ?? true,
    });
}

export function useCreateAutomationTopicMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (values: AgentTopicFormValues & { agentName?: string }) =>
            createAutomationTopicApi(values),
        onSettled: () => qc.invalidateQueries({ queryKey: AUTOMATION_KEYS.overview() }),
    });
}

export function useUpdateAutomationTopicMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, values }: { id: string; values: Partial<AgentTopicFormValues> }) =>
            updateAutomationTopicApi(id, values),
        onSettled: () => qc.invalidateQueries({ queryKey: AUTOMATION_KEYS.overview() }),
    });
}

export function useDeleteAutomationTopicMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteAutomationTopicApi(id),
        onSettled: () => qc.invalidateQueries({ queryKey: AUTOMATION_KEYS.overview() }),
    });
}

export function useUpdateAutomationScheduleMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (schedule: Partial<AutomationScheduleConfig>) =>
            updateAutomationScheduleApi(schedule),
        onSettled: () => qc.invalidateQueries({ queryKey: AUTOMATION_KEYS.overview() }),
    });
}

export function useRefreshAutomationQueueMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => refreshAutomationQueueApi(),
        onSettled: () => qc.invalidateQueries({ queryKey: AUTOMATION_KEYS.overview() }),
    });
}

export function useDispatchAutomationQueueMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (options?: { limit?: number; dry_run?: boolean }) =>
            dispatchAutomationQueueApi(options),
        onSettled: () => qc.invalidateQueries({ queryKey: AUTOMATION_KEYS.overview() }),
    });
}

export function useDispatchQueueItemMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, dry_run }: { id: string; dry_run?: boolean }) =>
            dispatchQueueItemApi(id, dry_run),
        onSettled: () => qc.invalidateQueries({ queryKey: AUTOMATION_KEYS.overview() }),
    });
}

export function useFailQueueItemMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => failQueueItemApi(id),
        onSettled: () => qc.invalidateQueries({ queryKey: AUTOMATION_KEYS.overview() }),
    });
}

export function useRetryAutomationExecutionMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => retryAutomationExecutionApi(id),
        onSettled: () => qc.invalidateQueries({ queryKey: AUTOMATION_KEYS.overview() }),
    });
}

export function useAutomationTestRunMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (options?: { topic_id?: string; dry_run?: boolean }) =>
            runAutomationTestApi(options),
        onSettled: () => qc.invalidateQueries({ queryKey: AUTOMATION_KEYS.overview() }),
    });
}
