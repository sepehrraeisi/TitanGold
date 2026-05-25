import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchCrawlers,
    createCrawler,
    updateCrawler,
    deleteCrawler,
    runCrawler,
    fetchCrawlerRuns,
    CreateCrawlerPayload,
} from '../services/dataHubCrawlersApi';
import { DATA_HUB_KEYS } from './useDataHubState';

export const CRAWLER_KEYS = {
    all: [...DATA_HUB_KEYS.all, 'crawlers'] as const,
    list: () => [...CRAWLER_KEYS.all, 'list'] as const,
    runs: (id: string) => [...CRAWLER_KEYS.all, 'runs', id] as const,
};

export function useDataHubCrawlersQuery(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: CRAWLER_KEYS.list(),
        queryFn: fetchCrawlers,
        staleTime: 30 * 1000,
        enabled: options?.enabled ?? true,
    });
}

export function useCrawlerRunsQuery(crawlerId: string | null) {
    return useQuery({
        queryKey: CRAWLER_KEYS.runs(crawlerId || ''),
        queryFn: () => fetchCrawlerRuns(crawlerId!),
        enabled: Boolean(crawlerId),
        staleTime: 15 * 1000,
    });
}

export function useCreateCrawlerMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateCrawlerPayload) => createCrawler(payload),
        onSettled: () => qc.invalidateQueries({ queryKey: CRAWLER_KEYS.all }),
    });
}

export function useUpdateCrawlerMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCrawlerPayload> }) =>
            updateCrawler(id, payload),
        onSettled: () => qc.invalidateQueries({ queryKey: CRAWLER_KEYS.all }),
    });
}

export function useDeleteCrawlerMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteCrawler(id),
        onSettled: () => qc.invalidateQueries({ queryKey: CRAWLER_KEYS.all }),
    });
}

export function useRunCrawlerMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, dry_run }: { id: string; dry_run?: boolean }) =>
            runCrawler(id, { dry_run }),
        onSettled: (_d, _e, vars) => {
            qc.invalidateQueries({ queryKey: CRAWLER_KEYS.all });
            if (vars?.id) qc.invalidateQueries({ queryKey: CRAWLER_KEYS.runs(vars.id) });
        },
    });
}
