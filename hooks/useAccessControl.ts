import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchAccessControlList,
    upsertAccessControl,
    resetAccessControl,
    UpsertAccessControlPayload,
} from '../services/accessControlApi';
import { DATA_HUB_KEYS } from './useDataHubState';

export const ACCESS_CONTROL_KEYS = {
    all: [...DATA_HUB_KEYS.all, 'accessControl'] as const,
    list: () => [...ACCESS_CONTROL_KEYS.all, 'list'] as const,
};

export function useAccessControlListQuery(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ACCESS_CONTROL_KEYS.list(),
        queryFn: fetchAccessControlList,
        staleTime: 30 * 1000,
        enabled: options?.enabled ?? true,
    });
}

export function useUpsertAccessControlMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            sourceId,
            payload,
        }: {
            sourceId: string;
            payload: UpsertAccessControlPayload;
        }) => upsertAccessControl(sourceId, payload),
        onSettled: () => qc.invalidateQueries({ queryKey: ACCESS_CONTROL_KEYS.list() }),
    });
}

export function useResetAccessControlMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (sourceId: string) => resetAccessControl(sourceId),
        onSettled: () => qc.invalidateQueries({ queryKey: ACCESS_CONTROL_KEYS.list() }),
    });
}
