import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchFilterRules,
    createFilterRule,
    updateFilterRule,
    deleteFilterRule,
    evaluateFilterRules,
    CreateFilterRulePayload,
    UpdateFilterRulePayload,
    EvaluateFilterPayload,
    ListFilterRulesParams,
} from '../services/dataHubFilterRulesApi';
import { DATA_HUB_KEYS } from './useDataHubState';

export const FILTER_RULES_KEYS = {
    all: [...DATA_HUB_KEYS.all, 'filterRules'] as const,
    list: (params?: ListFilterRulesParams) =>
        [...FILTER_RULES_KEYS.all, 'list', params ?? {}] as const,
};

export function useDataHubFilterRulesQuery(
    params?: ListFilterRulesParams,
    options?: { enabled?: boolean },
) {
    return useQuery({
        queryKey: FILTER_RULES_KEYS.list(params),
        queryFn: () => fetchFilterRules(params),
        staleTime: 30 * 1000,
        enabled: options?.enabled ?? true,
    });
}

export function useCreateFilterRuleMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateFilterRulePayload) => createFilterRule(payload),
        onSettled: () => qc.invalidateQueries({ queryKey: FILTER_RULES_KEYS.all }),
    });
}

export function useUpdateFilterRuleMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateFilterRulePayload }) =>
            updateFilterRule(id, payload),
        onSettled: () => qc.invalidateQueries({ queryKey: FILTER_RULES_KEYS.all }),
    });
}

export function useDeleteFilterRuleMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteFilterRule(id),
        onSettled: () => qc.invalidateQueries({ queryKey: FILTER_RULES_KEYS.all }),
    });
}

export function useEvaluateFilterRulesMutation() {
    return useMutation({
        mutationFn: (payload: EvaluateFilterPayload) => evaluateFilterRules(payload),
    });
}
