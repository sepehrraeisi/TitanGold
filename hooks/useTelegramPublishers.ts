import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchTelegramPublishers,
    fetchPublisherHistory,
    createTelegramPublisher,
    updateTelegramPublisher,
    disableTelegramPublisher,
    testTelegramPublisher,
    publishToTelegramPublisher,
    CreateTelegramPublisherPayload,
} from '../services/telegramPublishersApi';
import { DATA_HUB_KEYS } from './useDataHubState';

export const TELEGRAM_PUBLISHER_KEYS = {
    all: [...DATA_HUB_KEYS.all, 'telegramPublishers'] as const,
    list: () => [...TELEGRAM_PUBLISHER_KEYS.all, 'list'] as const,
    history: (id: string) => [...TELEGRAM_PUBLISHER_KEYS.all, 'history', id] as const,
};

export function useTelegramPublishersQuery(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: TELEGRAM_PUBLISHER_KEYS.list(),
        queryFn: fetchTelegramPublishers,
        staleTime: 30 * 1000,
        enabled: options?.enabled ?? true,
    });
}

export function usePublisherHistoryQuery(
    publisherId: string | null,
    options?: { enabled?: boolean },
) {
    return useQuery({
        queryKey: TELEGRAM_PUBLISHER_KEYS.history(publisherId || 'none'),
        queryFn: () => fetchPublisherHistory(publisherId!, { limit: 50 }),
        enabled: Boolean(publisherId) && (options?.enabled ?? true),
        staleTime: 15 * 1000,
    });
}

export function useCreateTelegramPublisherMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateTelegramPublisherPayload) => createTelegramPublisher(payload),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: TELEGRAM_PUBLISHER_KEYS.list() });
        },
    });
}

export function useUpdateTelegramPublisherMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            payload,
        }: {
            id: string;
            payload: Partial<CreateTelegramPublisherPayload>;
        }) => updateTelegramPublisher(id, payload),
        onSettled: (_d, _e, vars) => {
            queryClient.invalidateQueries({ queryKey: TELEGRAM_PUBLISHER_KEYS.list() });
            if (vars?.id) {
                queryClient.invalidateQueries({ queryKey: TELEGRAM_PUBLISHER_KEYS.history(vars.id) });
            }
        },
    });
}

export function useDisableTelegramPublisherMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => disableTelegramPublisher(id),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: TELEGRAM_PUBLISHER_KEYS.list() });
        },
    });
}

export function useTestTelegramPublisherMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, message }: { id: string; message?: string }) =>
            testTelegramPublisher(id, message),
        onSettled: (_d, _e, vars) => {
            queryClient.invalidateQueries({ queryKey: TELEGRAM_PUBLISHER_KEYS.list() });
            if (vars?.id) {
                queryClient.invalidateQueries({ queryKey: TELEGRAM_PUBLISHER_KEYS.history(vars.id) });
            }
        },
    });
}

export function usePublishTelegramPublisherMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            message,
            confirm_publish,
            content_type,
            title,
            content,
        }: {
            id: string;
            message: string;
            confirm_publish: boolean;
            content_type?: string;
            title?: string;
            content?: string;
        }) =>
            publishToTelegramPublisher(id, {
                message,
                confirm_publish,
                content_type,
                title,
                content,
            }),
        onSettled: (_d, _e, vars) => {
            queryClient.invalidateQueries({ queryKey: TELEGRAM_PUBLISHER_KEYS.list() });
            if (vars?.id) {
                queryClient.invalidateQueries({ queryKey: TELEGRAM_PUBLISHER_KEYS.history(vars.id) });
            }
        },
    });
}
