import React, { useMemo } from 'react';
import { TelegramCollectorState } from '../../../../../types';
import SkeletonLoader from '../../../../common/SkeletonLoader';
import {
    useDataHubHealthLogCountsQuery,
    useDataHubSourcesHealthQuery,
    useDataHubSourcesStateQuery,
    useDataHubSourcesStatsQuery,
} from '../../../../../hooks/useDataHubState';
import {
    BTN_PRIMARY,
    DATAHUB_SHELL,
    DataHubAlert,
    MetricCard,
} from './dataHubUi';
import {
    formatAvgLatency,
    formatCountDisplay,
    formatSystemStatus,
    parseFiniteCount,
    systemStatusTextClass,
    type PipelineHealthSystemStatus,
} from './pipelineHealthFormat';

interface HealthPanelProps {
    t: (key: string) => string;
    formatTimeAgo: (timestamp?: string) => string;
    telegramCollector?: TelegramCollectorState | null;
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

const HealthPanel: React.FC<HealthPanelProps> = ({ t, formatTimeAgo, telegramCollector }) => {
    const healthQuery = useDataHubSourcesHealthQuery();
    const statsQuery = useDataHubSourcesStatsQuery();
    const stateQuery = useDataHubSourcesStateQuery();
    const logCountsQuery = useDataHubHealthLogCountsQuery();

    const isLoading =
        healthQuery.isLoading ||
        statsQuery.isLoading ||
        stateQuery.isLoading ||
        logCountsQuery.isLoading;
    const hasError =
        healthQuery.isError ||
        statsQuery.isError ||
        stateQuery.isError ||
        logCountsQuery.isError;

    const systemStatus = useMemo(
        () => formatSystemStatus(healthQuery.data?.status),
        [healthQuery.data?.status],
    );

    const activeSources = useMemo(() => {
        return (
            parseFiniteCount(statsQuery.data?.active_sources) ??
            parseFiniteCount(stateQuery.data?.activeSources) ??
            parseFiniteCount(healthQuery.data?.activeSources) ??
            0
        );
    }, [statsQuery.data, stateQuery.data, healthQuery.data]);

    const totalSources = useMemo(() => {
        return (
            parseFiniteCount(statsQuery.data?.total_sources) ??
            parseFiniteCount(stateQuery.data?.totalSources) ??
            0
        );
    }, [statsQuery.data, stateQuery.data]);

    const recentErrors = useMemo(() => {
        const err = logCountsQuery.data?.statusCounts?.error;
        return parseFiniteCount(err) ?? 0;
    }, [logCountsQuery.data]);

    const pipelineIngested1h = useMemo(
        () => formatCountDisplay(healthQuery.data?.pipelineIngested1h ?? healthQuery.data?.recentActivity),
        [healthQuery.data?.pipelineIngested1h, healthQuery.data?.recentActivity],
    );
    const pipelineNormalized1h = useMemo(
        () => formatCountDisplay(healthQuery.data?.pipelineNormalized1h),
        [healthQuery.data?.pipelineNormalized1h],
    );
    const telegramCreated1h = useMemo(
        () => formatCountDisplay(healthQuery.data?.telegramCreated1h),
        [healthQuery.data?.telegramCreated1h],
    );
    const accessLogEvents1h = useMemo(
        () => formatCountDisplay(healthQuery.data?.accessLogEvents1h),
        [healthQuery.data?.accessLogEvents1h],
    );

    const lastCheckLabel = useMemo(() => {
        const ts = healthQuery.data?.healthLastCheckedAt ?? healthQuery.data?.timestamp;
        if (!ts) return 'N/A';
        const ago = formatTimeAgo(ts);
        return ago || 'N/A';
    }, [healthQuery.data?.healthLastCheckedAt, healthQuery.data?.timestamp, formatTimeAgo]);

    const avgResponse = useMemo(() => formatAvgLatency(null), []);
    const cacheHit = useMemo(() => ({ display: 'N/A', available: false }), []);

    const sourcesByType = stateQuery.data?.sourcesByType;

    const telegramHealth = useMemo(() => {
        if (!telegramCollector) return null;
        const channels = telegramCollector.channels || [];
        const activeChannels = channels.filter(ch => ch.isActive !== false).length;
        const errorChannels = channels.filter(ch => ch.lastError).length;
        let status: PipelineHealthSystemStatus = 'healthy';
        if (telegramCollector.status === 'offline' || telegramCollector.status === 'error') {
            status = 'unhealthy';
        } else if (errorChannels > 0 || telegramCollector.status === 'degraded') {
            status = 'degraded';
        }
        const hasFloodRisk = channels.some(
            ch =>
                ch.lastError &&
                (ch.lastError.includes('FLOOD') || ch.lastError.includes('Flood')),
        );
        return {
            status,
            activeChannels,
            totalChannels: channels.length,
            errorChannels,
            hasFloodRisk,
            avgLatency: formatAvgLatency(telegramCollector.healthSummary?.avgLatencyMs ?? null),
        };
    }, [telegramCollector]);

    const refetchAll = () => {
        void healthQuery.refetch();
        void statsQuery.refetch();
        void stateQuery.refetch();
        void logCountsQuery.refetch();
    };

    const statusI18n = statusLabel(t, systemStatus);

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
                        ) : (
                            formatCountDisplay(recentErrors)
                        )
                    }
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
                        ) : (
                            <span title={t('datahub_health_avg_response_na')}>
                                {avgResponse.display}
                            </span>
                        )
                    }
                />
                <MetricCard
                    label={t('cache_hit_rate')}
                    color="purple"
                    value={
                        isLoading ? (
                            <SkeletonLoader width="40px" height="1.25rem" />
                        ) : (
                            <span title={t('datahub_health_cache_hit_na')}>{cacheHit.display}</span>
                        )
                    }
                />
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4 mb-5">
                <p className="text-[11px] text-muted-foreground mb-3">{t('datahub_health_data_quality')}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <MetricCard
                        label={t('datahub_health_duplicate_url_groups')}
                        color={
                            (healthQuery.data?.dataQuality?.duplicateUrlGroups ?? 0) > 0
                                ? 'amber'
                                : 'emerald'
                        }
                        value={formatCountDisplay(
                            healthQuery.data?.dataQuality?.duplicateUrlGroups ?? 0,
                        )}
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
                                pipelineIngested1h
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
                                pipelineNormalized1h
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
                                telegramCreated1h
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
                                accessLogEvents1h
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
                {!isLoading && healthQuery.data?.database && (
                    <p className="text-[10px] text-muted-foreground mt-3">
                        {t('datahub_health_database')}: {databaseLabel(t, healthQuery.data.database)}
                    </p>
                )}
            </div>

            {telegramHealth && (
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
                            value={`${formatCountDisplay(telegramHealth.activeChannels)} / ${formatCountDisplay(telegramHealth.totalChannels)}`}
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
                                    {telegramHealth.avgLatency.display}
                                </span>
                            }
                        />
                        <MetricCard
                            label={t('datahub_health_recent_errors')}
                            color="red"
                            value={formatCountDisplay(telegramHealth.errorChannels)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default HealthPanel;
