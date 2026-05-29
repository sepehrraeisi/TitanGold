import React, { useMemo } from 'react';
import SkeletonLoader from '../../../../common/SkeletonLoader';
import {
    useDataHubSourcesHealthQuery,
    useDataHubSourcesStatsQuery,
} from '../../../../../hooks/useDataHubState';
import { DataHubAlert, MetricCard } from './dataHubUi';
import {
    formatActiveSourcesLabel,
    formatAvgLatency,
    formatSystemStatus,
    parseFiniteCount,
    systemStatusTextClass,
    type PipelineHealthSystemStatus,
} from './pipelineHealthFormat';

interface PipelineHealthOverviewProps {
    t: (key: string) => string;
}

function statusLabel(t: (key: string) => string, status: PipelineHealthSystemStatus): string {
    const key = `pipeline_health_status_${status}`;
    const translated = t(key);
    return translated !== key ? translated : status;
}

const PipelineHealthOverview: React.FC<PipelineHealthOverviewProps> = ({ t }) => {
    const healthQuery = useDataHubSourcesHealthQuery();
    const statsQuery = useDataHubSourcesStatsQuery();

    const isLoading = healthQuery.isLoading || statsQuery.isLoading;
    const hasError = healthQuery.isError || statsQuery.isError;

    const systemStatus = useMemo(() => {
        if (healthQuery.data?.status) {
            return formatSystemStatus(healthQuery.data.status);
        }
        return formatSystemStatus(undefined);
    }, [healthQuery.data?.status]);

    const activeSourcesLabel = useMemo(() => {
        const active =
            parseFiniteCount(statsQuery.data?.active_sources) ??
            parseFiniteCount(healthQuery.data?.activeSources);
        const total = parseFiniteCount(statsQuery.data?.total_sources);
        return formatActiveSourcesLabel(active, total);
    }, [statsQuery.data, healthQuery.data?.activeSources]);

    const latency = useMemo(() => formatAvgLatency(null), []);

    const statusI18n = statusLabel(t, systemStatus);

    const refetchAll = () => {
        void healthQuery.refetch();
        void statsQuery.refetch();
    };

    return (
        <div className="mt-8 border-t border-border pt-6">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
                {t('pipeline_health_overview')}
            </h3>

            {hasError && !isLoading && (
                <DataHubAlert
                    variant="error"
                    message={t('pipeline_health_load_error')}
                    onRetry={refetchAll}
                    retryLabel={t('retry')}
                />
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                    label={t('system_status')}
                    color={
                        systemStatus === 'healthy'
                            ? 'emerald'
                            : systemStatus === 'degraded'
                              ? 'amber'
                              : systemStatus === 'unhealthy'
                                ? 'red'
                                : 'blue'
                    }
                    value={
                        isLoading ? (
                            <SkeletonLoader width="80px" height="1.25rem" />
                        ) : (
                            <span className={systemStatusTextClass(systemStatus)}>{statusI18n}</span>
                        )
                    }
                />
                <MetricCard
                    label={t('active_sources')}
                    color="purple"
                    value={
                        isLoading ? (
                            <SkeletonLoader width="64px" height="1.25rem" />
                        ) : (
                            activeSourcesLabel
                        )
                    }
                />
                <MetricCard
                    label={t('avg_latency')}
                    color="blue"
                    value={
                        isLoading ? (
                            <SkeletonLoader width="48px" height="1.25rem" />
                        ) : (
                            <span
                                className="inline-flex items-center gap-1"
                                title={
                                    latency.available
                                        ? undefined
                                        : t('pipeline_latency_not_available')
                                }
                            >
                                {latency.display}
                            </span>
                        )
                    }
                />
            </div>
        </div>
    );
};

export default PipelineHealthOverview;
