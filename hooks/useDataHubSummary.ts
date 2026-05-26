import { useMemo } from 'react';
import {
    formatSystemStatus,
    parseFiniteCount,
    type PipelineHealthSystemStatus,
} from '../components/ai/AIManager/tabs/DataHub/pipelineHealthFormat';
import {
    useDataHubSourcesHealthQuery,
    useDataHubSourcesStatsQuery,
} from './useDataHubState';

export type DataHubSummaryMetrics = {
    isLoading: boolean;
    hasError: boolean;
    refetch: () => void;
    systemStatus: PipelineHealthSystemStatus;
    totalSources: number;
    activeSources: number;
    cacheHitDisplay: string;
    cacheHitAvailable: boolean;
};

export function useDataHubSummaryMetrics(): DataHubSummaryMetrics {
    const healthQuery = useDataHubSourcesHealthQuery();
    const statsQuery = useDataHubSourcesStatsQuery();

    const isLoading = healthQuery.isLoading || statsQuery.isLoading;
    const hasError = healthQuery.isError || statsQuery.isError;

    const systemStatus = useMemo(
        () => formatSystemStatus(healthQuery.data?.status),
        [healthQuery.data?.status],
    );

    const totalSources = useMemo(() => {
        return parseFiniteCount(statsQuery.data?.total_sources) ?? 0;
    }, [statsQuery.data?.total_sources]);

    const activeSources = useMemo(() => {
        return (
            parseFiniteCount(statsQuery.data?.active_sources) ??
            parseFiniteCount(healthQuery.data?.activeSources) ??
            0
        );
    }, [statsQuery.data?.active_sources, healthQuery.data?.activeSources]);

    const refetch = () => {
        void healthQuery.refetch();
        void statsQuery.refetch();
    };

    return {
        isLoading,
        hasError,
        refetch,
        systemStatus,
        totalSources,
        activeSources,
        cacheHitDisplay: 'N/A',
        cacheHitAvailable: false,
    };
}
