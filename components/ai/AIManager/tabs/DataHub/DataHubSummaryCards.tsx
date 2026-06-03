import React from 'react';
import SkeletonLoader from '../../../../common/SkeletonLoader';
import { useDataHubSummaryMetrics } from '../../../../../hooks/useDataHubSummary';
import { DATAHUB_SHELL, DataHubAlert, MetricCard } from './dataHubUi';
import { systemStatusTextClass } from './pipelineHealthFormat';
import { safeT } from './dataHubI18n';

interface DataHubSummaryCardsProps {
    t: (key: string) => string;
}

function statusLabel(t: (key: string) => string, status: ReturnType<typeof useDataHubSummaryMetrics>['systemStatus']): string {
    return safeT(t, `pipeline_health_status_${status}`);
}

const DataHubSummaryCards: React.FC<DataHubSummaryCardsProps> = ({ t }) => {
    const summary = useDataHubSummaryMetrics();
    const statusI18n = statusLabel(t, summary.systemStatus);

    return (
        <div className={`${DATAHUB_SHELL} space-y-3`}>
            {summary.hasError && !summary.isLoading && (
                <DataHubAlert
                    variant="error"
                    message={t('datahub_summary_load_error')}
                    onRetry={summary.refetch}
                    retryLabel={t('retry')}
                />
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                    label={t('total_sources')}
                    color="blue"
                    value={
                        summary.isLoading ? (
                            <SkeletonLoader width="40px" height="1.5rem" />
                        ) : (
                            summary.totalSources
                        )
                    }
                />
                <MetricCard
                    label={t('active_sources')}
                    color="emerald"
                    value={
                        summary.isLoading ? (
                            <SkeletonLoader width="40px" height="1.5rem" />
                        ) : (
                            summary.activeSources
                        )
                    }
                />
                <MetricCard
                    label={t('cache_hit_rate')}
                    color="purple"
                    value={
                        summary.isLoading ? (
                            <SkeletonLoader width="48px" height="1.5rem" />
                        ) : (
                            <span title={t('datahub_health_cache_hit_na')}>{summary.cacheHitDisplay}</span>
                        )
                    }
                />
                <MetricCard
                    label={t('health_status')}
                    color={
                        summary.systemStatus === 'healthy'
                            ? 'emerald'
                            : summary.systemStatus === 'degraded'
                              ? 'amber'
                              : summary.systemStatus === 'unhealthy'
                                ? 'red'
                                : 'blue'
                    }
                    value={
                        summary.isLoading ? (
                            <SkeletonLoader width="72px" height="1.5rem" />
                        ) : (
                            <span className={systemStatusTextClass(summary.systemStatus)}>{statusI18n}</span>
                        )
                    }
                />
            </div>
            <p className="text-[10px] text-muted-foreground">
                {t('datahub_summary_api_hint')}
            </p>
        </div>
    );
};

export default DataHubSummaryCards;
