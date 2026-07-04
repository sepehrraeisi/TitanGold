import React, { useMemo } from 'react';
import SkeletonLoader from '../../../../common/SkeletonLoader';
import {
    useDataHubHealthLogCountsQuery,
    useDataHubHealthMonitoringQuery,
} from '../../../../../hooks/useDataHubState';
import {
    useCollectorChannelsQuery,
    useCollectorHealthQuery,
} from '../../../../../hooks/useTelegramCollector';
import {
    BTN_PRIMARY,
    DATAHUB_SHELL,
    DataHubAlert,
    MetricCard,
} from './dataHubUi';
import {
    formatAvgLatency,
    formatCacheHitRateDisplay,
    formatCountDisplay,
    formatHealthMetricValue,
    formatSystemStatus,
    parseFiniteCount,
    systemStatusTextClass,
    type PipelineHealthSystemStatus,
} from './pipelineHealthFormat';

interface HealthPanelProps {
    t: (key: string) => string;
    formatTimeAgo: (timestamp?: string) => string;
}

function statusLabel(t: (key: string) => string, status: PipelineHealthSystemStatus): string {
    const key = `pipeline_health_status_${status}`;
    const translated = t(key);
    return translated !== key ? translated : status;
}

function databaseLabel(t: (key: string) => string, raw?: string): string {
    const s = String(raw ?? '').toLowerCase();
    if (s === 'connected') {
        const key = 'datahub_health_db_connected';
        const tr = t(key);
        return tr !== key ? tr : s;
    }
    if (s === 'disconnected') {
        const key = 'datahub_health_db_disconnected';
        const tr = t(key);
        return tr !== key ? tr : s;
    }
    const key = 'datahub_health_db_unknown';
    const tr = t(key);
    return tr !== key ? tr : 'Unknown';
}

function unavailableLabel(t: (key: string) => string): string {
    const key = 'datahub_health_metric_unavailable';
    const tr = t(key);
    return tr !== key ? tr : 'Unavailable';
}

const HealthPanel: React.FC<HealthPanelProps> = ({ t, formatTimeAgo }) => {
    const monitoringQuery = useDataHubHealthMonitoringQuery();
    const logCountsQuery = useDataHubHealthLogCountsQuery();
    const collectorHealthQuery = useCollectorHealthQuery();
    const collectorChannelsQuery = useCollectorChannelsQuery({}, true);

    const isLoading =
        monitoringQuery.isLoading ||
        logCountsQuery.isLoading ||
        collectorHealthQuery.isLoading ||
        collectorChannelsQuery.isLoading;
    const hasError =
        monitoringQuery.isError ||
        logCountsQuery.isError ||
        collectorHealthQuery.isError;

    const monitoring = monitoringQuery.data;
    const unavailable = unavailableLabel(t);

    const systemStatus = useMemo(
        () => formatSystemStatus(monitoring?.status),
        [monitoring?.status],
    );

    const activeSources = monitoring?.sources?.active ?? 0;
    const totalSources = monitoring?.sources?.total ?? 0;

    const recentErrors = useMemo(() => {
        const err = logCountsQuery.data?.statusCounts?.error;
        return parseFiniteCount(err) ?? null;
    }, [logCountsQuery.data]);

    const pipelineActivity = monitoring?.pipelineActivity1h;
    const pipelineIngested1h = useMemo(
        () => formatHealthMetricValue(pipelineActivity?.ingested, unavailable),
        [pipelineActivity?.ingested, unavailable],
    );
    const pipelineNormalized1h = useMemo(
        () => formatHealthMetricValue(pipelineActivity?.normalized, unavailable),
        [pipelineActivity?.normalized, unavailable],
    );
    const telegramCreated1h = useMemo(
        () => formatHealthMetricValue(pipelineActivity?.telegramIntake, unavailable),
        [pipelineActivity?.telegramIntake, unavailable],
    );
    const accessLogEvents1h = useMemo(
        () => formatHealthMetricValue(pipelineActivity?.accessLogEvents, unavailable),
        [pipelineActivity?.accessLogEvents, unavailable],
    );

    const lastCheckLabel = useMemo(() => {
        const ts = monitoring?.lastCheckAt;
        if (!ts) return unavailable;
        const ago = formatTimeAgo(ts);
        return ago || unavailable;
    }, [monitoring?.lastCheckAt, formatTimeAgo, unavailable]);

    const avgResponse = useMemo(
        () => formatAvgLatency(monitoring?.performance?.avgResponseMs ?? null),
        [monitoring?.performance?.avgResponseMs],
    );

    const cacheHit = useMemo(
        () =>
            formatCacheHitRateDisplay(
                monitoring?.performance?.cacheHitRate,
                monitoring?.performance?.cacheHitRateTracked ?? false,
                {
                    notTracked: t('datahub_health_cache_not_tracked'),
                    unavailable,
                },
            ),
        [monitoring?.performance, t, unavailable],
    );

    const duplicateGroups = useMemo(
        () =>
            formatHealthMetricValue(monitoring?.dataQuality?.duplicateUrlGroups, unavailable),
        [monitoring?.dataQuality?.duplicateUrlGroups, unavailable],
    );

    const sourcesByType = monitoring?.sources?.byType;

    const telegramHealth = useMemo(() => {
        const liveHealth = collectorHealthQuery.data;
        const channels = collectorChannelsQuery.data ?? [];
        const activeChannels = channels.filter(ch => ch.isActive).length;
        const errorChannels = channels.filter(ch => ch.lastError).length;

        const backendCollector = monitoring?.telegramCollector;
        const statusRaw =
            (typeof liveHealth?.status === 'string' ? liveHealth.status : null) ??
            backendCollector?.status ??
            'unknown';
        let status = formatSystemStatus(statusRaw);

        if (errorChannels > 0 && status === 'healthy') {
            status = 'degraded';
        }

        const avgLatencyMs =
            typeof liveHealth?.averageLatencyMs === 'number'
                ? liveHealth.averageLatencyMs
                : backendCollector?.avgLatencyMs ?? null;

        const loggedErrors =
            typeof liveHealth?.loggedErrors === 'number'
                ? liveHealth.loggedErrors
                : typeof liveHealth?.errorCount === 'number'
                  ? liveHealth.errorCount
                  : backendCollector?.loggedErrors ?? errorChannels;

        const totalChannels =
            channels.length > 0
                ? channels.length
                : backendCollector?.totalChannels ?? null;
        const activeCount =
            channels.length > 0
                ? activeChannels
                : backendCollector?.activeChannels ?? null;

        const hasFloodRisk = channels.some(
            ch =>
                ch.lastError &&
                (ch.lastError.includes('FLOOD') || ch.lastError.includes('Flood')),
        );

        return {
            status,
            activeChannels: activeCount,
            totalChannels,
            errorChannels: loggedErrors,
            hasFloodRisk,
            avgLatency: formatAvgLatency(avgLatencyMs),
            loaded: Boolean(liveHealth) || backendCollector?.loaded === true || channels.length > 0,
        };
    }, [collectorHealthQuery.data, collectorChannelsQuery.data, monitoring?.telegramCollector]);

    const refetchAll = () => {
        void monitoringQuery.refetch();
        void logCountsQuery.refetch();
        void collectorHealthQuery.refetch();
        void collectorChannelsQuery.refetch();
    };

    const statusI18n = statusLabel(t, systemStatus);
    const showPipelinePartial = pipelineActivity?.meta?.partial === true;

    return (
        <div className={DATAHUB_SHELL}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <div>
                    <h3 className="text-sm md:text-base font-semibold text-foreground">
                        {t('health_monitoring')}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">
                        {t('datahub_health_desc')}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 max-w-xl">
                        {t('datahub_health_pipeline_activity_hint')}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={refetchAll}
                    disabled={isLoading}
                    className={BTN_PRIMARY}
                >
                    {isLoading ? t('checking') : t('datahub_health_refresh')}
                </button>
            </div>

            {hasError && !isLoading && (
                <div className="mb-4">
                    <DataHubAlert
                        variant="error"
                        message={t('datahub_health_load_error')}
                        onRetry={refetchAll}
                        retryLabel={t('retry')}
                    />
                </div>
            )}

            {showPipelinePartial && !isLoading && (
                <div className="mb-4">
                    <DataHubAlert
                        variant="warning"
                        message={t('datahub_health_pipeline_activity_partial')}
                    />
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
                <MetricCard
                    label={t('health_status')}
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
                            <SkeletonLoader width="72px" height="1.25rem" />
                        ) : (
                            <span className={systemStatusTextClass(systemStatus)}>{statusI18n}</span>
                        )
                    }
                />
                <MetricCard
                    label={t('active_sources')}
                    color="emerald"
                    value={
                        isLoading ? (
                            <SkeletonLoader width="32px" height="1.25rem" />
                        ) : (
                            formatCountDisplay(activeSources)
                        )
                    }
                />
                <MetricCard
                    label={t('total_sources')}
                    color="blue"
                    value={
                        isLoading ? (
                            <SkeletonLoader width="32px" height="1.25rem" />
                        ) : (
                            formatCountDisplay(totalSources)
                        )
                    }
                />
                <MetricCard
                    label={t('datahub_health_recent_errors')}
                    color="red"
                    value={
                        isLoading ? (
                            <SkeletonLoader width="32px" height="1.25rem" />
                        ) : recentErrors != null ? (
                            formatCountDisplay(recentErrors)
                        ) : (
                            unavailable
                        )
                    }
                    hint={t('datahub_health_recent_errors_all_time_hint')}
                />
                <MetricCard
                    label={t('datahub_health_last_check')}
                    color="purple"
                    value={
                        isLoading ? (
                            <SkeletonLoader width="64px" height="1.25rem" />
                        ) : (
                            lastCheckLabel
                        )
                    }
                />
                <MetricCard
                    label={t('avg_response_time')}
                    color="blue"
                    value={
                        isLoading ? (
                            <SkeletonLoader width="40px" height="1.25rem" />
                        ) : avgResponse.available ? (
                            avgResponse.display
                        ) : (
                            unavailable
                        )
                    }
                    hint={t('datahub_health_avg_response_window_hint')}
                />
                <MetricCard
                    label={t('cache_hit_rate')}
                    color="purple"
                    value={
                        isLoading ? (
                            <SkeletonLoader width="40px" height="1.25rem" />
                        ) : (
                            <span title={t('datahub_health_cache_hit_not_tracked_hint')}>
                                {cacheHit.display}
                            </span>
                        )
                    }
                    hint={
                        cacheHit.tracked
                            ? t('datahub_health_cache_hit_window_hint')
                            : t('datahub_health_cache_hit_not_tracked_hint')
                    }
                />
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4 mb-5">
                <p className="text-[11px] text-muted-foreground mb-3">{t('datahub_health_data_quality')}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <MetricCard
                        label={t('datahub_health_duplicate_url_groups')}
                        color={
                            duplicateGroups.available &&
                            parseFiniteCount(monitoring?.dataQuality?.duplicateUrlGroups)! > 0
                                ? 'amber'
                                : 'emerald'
                        }
                        value={
                            isLoading ? (
                                <SkeletonLoader width="32px" height="1.25rem" />
                            ) : (
                                duplicateGroups.display
                            )
                        }
                    />
                </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4 mb-5">
                <p className="text-[11px] text-muted-foreground mb-3">
                    {t('datahub_health_pipeline_activity_section')}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard
                        label={t('datahub_health_pipeline_ingested_1h')}
                        color="amber"
                        value={
                            isLoading ? (
                                <SkeletonLoader width="48px" height="1.25rem" />
                            ) : (
                                pipelineIngested1h.display
                            )
                        }
                    />
                    <MetricCard
                        label={t('datahub_health_pipeline_normalized_1h')}
                        color="emerald"
                        value={
                            isLoading ? (
                                <SkeletonLoader width="48px" height="1.25rem" />
                            ) : (
                                pipelineNormalized1h.display
                            )
                        }
                    />
                    <MetricCard
                        label={t('datahub_health_telegram_intake_1h')}
                        color="blue"
                        value={
                            isLoading ? (
                                <SkeletonLoader width="48px" height="1.25rem" />
                            ) : (
                                telegramCreated1h.display
                            )
                        }
                    />
                    <MetricCard
                        label={t('datahub_health_access_log_events_1h')}
                        color="purple"
                        value={
                            isLoading ? (
                                <SkeletonLoader width="32px" height="1.25rem" />
                            ) : (
                                accessLogEvents1h.display
                            )
                        }
                    />
                </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4 mb-5">
                <p className="text-[11px] text-muted-foreground mb-3">{t('datahub_health_sources_by_type')}</p>
                {isLoading ? (
                    <SkeletonLoader width="100%" height="2rem" />
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        <MetricCard
                            label={t('telegram')}
                            color="blue"
                            value={formatCountDisplay(sourcesByType?.telegram)}
                        />
                        <MetricCard
                            label={t('rss')}
                            color="amber"
                            value={formatCountDisplay(sourcesByType?.rss)}
                        />
                        <MetricCard
                            label={t('api')}
                            color="purple"
                            value={formatCountDisplay(sourcesByType?.api)}
                        />
                    </div>
                )}
                {!isLoading && monitoring?.database && (
                    <p className="text-[10px] text-muted-foreground mt-3">
                        {t('datahub_health_database')}: {databaseLabel(t, monitoring.database)}
                    </p>
                )}
            </div>

            <div className="rounded-xl border border-white/5 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground">
                            {t('telegram_collector_health')}
                        </h4>
                        <span
                            className={`w-2 h-2 rounded-full ${
                                telegramHealth.status === 'healthy'
                                    ? 'bg-emerald-400 animate-pulse'
                                    : telegramHealth.status === 'degraded'
                                      ? 'bg-amber-400 animate-pulse'
                                      : 'bg-red-500'
                            }`}
                        />
                    </div>
                    {telegramHealth.hasFloodRisk && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40">
                            {t('telegram_flood_risk')}
                        </span>
                    )}
                </div>
                {!telegramHealth.loaded && !isLoading && (
                    <p className="text-[10px] text-muted-foreground mb-3">
                        {t('datahub_health_collector_unavailable')}
                    </p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard
                        label={t('collector_status')}
                        color={
                            telegramHealth.status === 'healthy'
                                ? 'emerald'
                                : telegramHealth.status === 'degraded'
                                  ? 'amber'
                                  : 'red'
                        }
                        value={statusLabel(t, telegramHealth.status)}
                    />
                    <MetricCard
                        label={t('active_channels')}
                        color="blue"
                        value={
                            telegramHealth.totalChannels != null &&
                            telegramHealth.activeChannels != null
                                ? `${formatCountDisplay(telegramHealth.activeChannels)} / ${formatCountDisplay(telegramHealth.totalChannels)}`
                                : unavailable
                        }
                    />
                    <MetricCard
                        label={t('avg_latency')}
                        color="purple"
                        value={
                            <span
                                title={
                                    telegramHealth.avgLatency.available
                                        ? undefined
                                        : t('pipeline_latency_not_available')
                                }
                            >
                                {telegramHealth.avgLatency.display === 'N/A'
                                    ? unavailable
                                    : telegramHealth.avgLatency.display}
                            </span>
                        }
                    />
                    <MetricCard
                        label={t('datahub_health_recent_errors')}
                        color="red"
                        value={
                            telegramHealth.errorChannels != null
                                ? formatCountDisplay(telegramHealth.errorChannels)
                                : unavailable
                        }
                    />
                </div>
            </div>
        </div>
    );
};

export default HealthPanel;
