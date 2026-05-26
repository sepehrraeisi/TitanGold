import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DATA_HUB_KEYS } from './useDataHubState';
import {
    fetchArchiveHealth,
    fetchArchiveStats,
    fetchArchivedRecords,
    previewArchive,
    executeArchive,
    previewRestore,
    executeRestore,
    previewPurge,
} from '../services/dataHubArchivingApi';

export const ARCHIVING_KEYS = {
    all: [...DATA_HUB_KEYS.all, 'archiving'] as const,
    health: () => [...ARCHIVING_KEYS.all, 'health'] as const,
    stats: () => [...ARCHIVING_KEYS.all, 'stats'] as const,
    records: (offset: number) => [...ARCHIVING_KEYS.all, 'records', offset] as const,
};

export function useArchiveHealthQuery() {
    return useQuery({
        queryKey: ARCHIVING_KEYS.health(),
        queryFn: fetchArchiveHealth,
        staleTime: 30 * 1000,
    });
}

export function useArchiveStatsQuery() {
    return useQuery({
        queryKey: ARCHIVING_KEYS.stats(),
        queryFn: () => fetchArchiveStats(20),
        staleTime: 30 * 1000,
    });
}

export function useArchivedRecordsQuery(offset = 0, limit = 50) {
    return useQuery({
        queryKey: ARCHIVING_KEYS.records(offset),
        queryFn: () => fetchArchivedRecords({ limit, offset }),
        staleTime: 20 * 1000,
    });
}

export function usePreviewArchiveMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (daysOld: number) => previewArchive(daysOld),
        onSettled: () => qc.invalidateQueries({ queryKey: ARCHIVING_KEYS.all }),
    });
}

export function useExecuteArchiveMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: executeArchive,
        onSettled: () => qc.invalidateQueries({ queryKey: ARCHIVING_KEYS.all }),
    });
}

export function usePreviewRestoreMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ start_date, end_date }: { start_date: string; end_date: string }) =>
            previewRestore(start_date, end_date),
        onSettled: () => qc.invalidateQueries({ queryKey: ARCHIVING_KEYS.all }),
    });
}

export function useExecuteRestoreMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: executeRestore,
        onSettled: () => qc.invalidateQueries({ queryKey: ARCHIVING_KEYS.all }),
    });
}

export function usePreviewPurgeMutation() {
    return useMutation({
        mutationFn: ({ start_date, end_date }: { start_date?: string; end_date?: string }) =>
            previewPurge(start_date, end_date),
    });
}
