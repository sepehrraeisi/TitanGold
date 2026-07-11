import React, { useMemo } from 'react';
import SkeletonLoader from '../../../../common/SkeletonLoader';
import type { DataPipelineSnapshot, PipelineBacklogTrend, TransferHealthMetricKey } from '../../../../../types';
import {
    DATAHUB_INNER_LIST,
    DataHubAlert,
    DataHubEmpty,
    MetricCard,
    StatusPill,
} from './dataHubUi';
import { safeT } from './dataHubI18n';
import {
    buildPartialWarningMessage,
    computeTelegramTransferHealth,
    formatCatchUpHours,
    formatDrainRatio,
    formatMetricValue,
    formatOldestAge,
    formatRatePerHour,
    hasTelegramTransferCoreMetrics,
    isMetricUnavailable,
    transferHealthStatusVariant,
} from './telegramTransferHealthFormat';
import {
    backlogSeverityLabel,
    backlogSeverityVariant,
    classifyBacklogSeverity,
    formatBacklogTrendDisplay,
} from './pipelineOperationalMetrics';

interface TelegramTransferHealthProps {
    t: (key: string) => string;
    snapshot: DataPipelineSnapshot | undefined;
    isLoading: boolean;
    isPipelineLoaded: boolean;
    error?: string | null;
    partial?: boolean;
    unavailableMetrics?: TransferHealthMetricKey[];
    backlogTrend?: PipelineBacklogTrend | null;
    onRetry?: () => void;
    formatTimeAgo: (date: string | Date | undefined) => string;
}

function statusLabel(t: (key: string) => string, status: 'healthy' | 'warning' | 'critical'): string {
    return safeT(t, `telegram_transfer_health_status_${status}`);
}

const TelegramTransferHealth: React.FC<TelegramTransferHealthProps> = ({
    t,
    snapshot,
    isLoading,
    isPipelineLoaded,
    error = null,
    partial = false,
    unavailableMetrics = [],
    backlogTrend = null,
    onRetry,
    formatTimeAgo,
}) => {
    const derived = useMemo(
        () =>
            computeTelegramTransferHealth({
                ingestMetrics: snapshot?.telegramIngestMetrics,
                transferThroughput: snapshot?.transferThroughput,
                globalTelegramBacklog: snapshot?.globalTelegramBacklog,
                unavailableMetrics,
            }),
        [snapshot, unavailableMetrics],
    );

    const hasCoreMetrics = hasTelegramTransferCoreMetrics(snapshot, unavailableMetrics);
    const showFatalError = Boolean(error) && !hasCoreMetrics && !isLoading;
    const partialWarning = buildPartialWarningMessage(t, derived.unavailableMetrics);
    const showPartialNotice = partial && hasCoreMetrics && !isLoading && Boolean(partialWarning);
    const statusVariant = transferHealthStatusVariant(derived.status);

    const incomingDisplay = formatMetricValue(
        derived.incoming24h,
        isMetricUnavailable('incoming24h', unavailableMetrics) || derived.incoming24h == null,
        t,
    );
    const transferredDisplay = formatMetricValue(
        derived.transferredToCollectedData24h,
        isMetricUnavailable('transferred24h', unavailableMetrics) ||
            derived.transferredToCollectedData24h == null,
        t,
    );
    const processedDisplay = formatMetricValue(
        derived.processed24h,
        isMetricUnavailable('processed24h', unavailableMetrics) || derived.processed24h == null,
        t,
    );
    const backlogDisplay = formatMetricValue(
        derived.backlogTotal,
        isMetricUnavailable('backlogTotal', unavailableMetrics) || derived.backlogTotal == null,
        t,
    );
    const oldestDisplay = formatOldestAge(
        derived.oldestUnprocessedAgeHours,
        isMetricUnavailable('oldestUnprocessedAge', unavailableMetrics),
        formatTimeAgo,
        snapshot?.globalTelegramBacklog?.oldestUnprocessed,
        t,
    );
    const rateDisplay = formatRatePerHour(
        derived.processingRatePerHour,
        isMetricUnavailable('processingRate', unavailableMetrics) ||
            derived.processingRatePerHour == null,
        t,
    );
    const drainUnavailable =
        isMetricUnavailable('drainRatio', unavailableMetrics) || derived.drainRatio == null;
    const drainDisplay = formatDrainRatio(derived.drainRatio, drainUnavailable, t);
    const catchUpDisplay = formatCatchUpHours(
        derived.catchUpHours,
        isMetricUnavailable('catchUp', unavailableMetrics) || derived.catchUpHours == null,
        t,
    );

    const backlogSeverity = classifyBacklogSeverity(derived.backlogTotal);
    const backlogBadge =
        backlogSeverity && backlogDisplay.state === 'loaded' ? (
            <StatusPill
                label={backlogSeverityLabel(t, backlogSeverity) ?? backlogSeverity}
                variant={backlogSeverityVariant(backlogSeverity)}
                title={safeT(t, 'pipeline_backlog_severity_hint')}
            />
        ) : null;

    const trendDisplay = formatBacklogTrendDisplay(t, backlogTrend ?? undefined);

    return (
        <div className={DATAHUB_INNER_LIST}>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                    <h4 className="text-[11px] font-semibold text-foreground">
                        {safeT(t, 'telegram_transfer_health_title')}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        {safeT(t, 'telegram_transfer_health_question')}
                    </p>
                </div>
                {hasCoreMetrics && !isLoading && (
                    <StatusPill
                        label={statusLabel(t, derived.status)}
                        variant={statusVariant}
                        title={safeT(t, 'telegram_transfer_health_status_hint')}
                    />
                )}
                {isLoading && (
                    <span className="text-[10px] text-muted-foreground">
                        {safeT(t, 'telegram_transfer_health_loading')}
                    </span>
                )}
            </div>

            {showFatalError && (
                <DataHubAlert
                    variant="error"
                    message={safeT(t, 'telegram_transfer_health_load_error')}
                    onRetry={onRetry}
                    retryLabel={safeT(t, 'retry')}
                />
            )}

            {showPartialNotice && partialWarning && (
                <DataHubAlert variant="warning" message={partialWarning} />
            )}

            {!isPipelineLoaded && !isLoading && !showFatalError && (
                <DataHubEmpty message={safeT(t, 'telegram_transfer_health_not_loaded')} />
            )}

            {isPipelineLoaded && !hasCoreMetrics && isLoading && !showFatalError && (
                <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="rounded-xl border border-white/5 p-3">
                            <SkeletonLoader width="70%" height="0.75rem" />
                            <div className="mt-2">
                                <SkeletonLoader width="50%" height="1rem" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {hasCoreMetrics && (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                    <MetricCard
                        label={safeT(t, 'telegram_transfer_health_incoming_24h')}
                        color="blue"
                        value={incomingDisplay.text}
                        valueState={incomingDisplay.state}
                        hint={safeT(t, 'telegram_transfer_health_incoming_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'telegram_transfer_health_transferred_24h')}
                        color="purple"
                        value={transferredDisplay.text}
                        valueState={transferredDisplay.state}
                        hint={safeT(t, 'telegram_transfer_health_transferred_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'telegram_transfer_health_processed_24h')}
                        color="emerald"
                        value={processedDisplay.text}
                        valueState={processedDisplay.state}
                        hint={safeT(t, 'telegram_transfer_health_processed_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'telegram_transfer_health_backlog')}
                        color={
                            backlogDisplay.state === 'loaded' && derived.backlogTotal != null && derived.backlogTotal > 0
                                ? 'amber'
                                : 'emerald'
                        }
                        value={backlogDisplay.text}
                        valueState={backlogDisplay.state}
                        hint={safeT(t, 'telegram_transfer_health_backlog_hint')}
                        badge={backlogBadge}
                    />
                    <MetricCard
                        label={safeT(t, 'pipeline_backlog_trend_title')}
                        color={
                            trendDisplay.state === 'loaded' && backlogTrend?.direction === 'up'
                                ? 'amber'
                                : trendDisplay.state === 'loaded' && backlogTrend?.direction === 'down'
                                  ? 'emerald'
                                  : 'blue'
                        }
                        value={trendDisplay.text}
                        valueState={trendDisplay.state}
                        hint={safeT(t, 'pipeline_backlog_trend_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'telegram_transfer_health_oldest_age')}
                        color={
                            oldestDisplay.state === 'loaded' &&
                            derived.oldestUnprocessedAgeHours != null &&
                            derived.oldestUnprocessedAgeHours >= 7 * 24
                                ? 'red'
                                : 'blue'
                        }
                        value={oldestDisplay.text}
                        valueState={oldestDisplay.state}
                        hint={safeT(t, 'telegram_transfer_health_oldest_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'telegram_transfer_health_processing_rate')}
                        color="emerald"
                        value={rateDisplay.text}
                        valueState={rateDisplay.state}
                        hint={safeT(t, 'telegram_transfer_health_rate_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'telegram_transfer_health_drain_ratio')}
                        color={
                            drainDisplay.state === 'unavailable'
                                ? 'blue'
                                : derived.drainRatio != null && derived.drainRatio >= 1
                                  ? 'emerald'
                                  : derived.drainRatio != null && derived.drainRatio >= 0.5
                                    ? 'amber'
                                    : 'red'
                        }
                        value={drainDisplay.text}
                        valueState={drainDisplay.state}
                        hint={
                            drainUnavailable
                                ? safeT(t, 'telegram_transfer_health_drain_unavailable_hint')
                                : safeT(t, 'telegram_transfer_health_drain_hint')
                        }
                    />
                    <MetricCard
                        label={safeT(t, 'telegram_transfer_health_catch_up')}
                        color={
                            catchUpDisplay.state === 'loaded' &&
                            derived.catchUpHours != null &&
                            derived.catchUpHours > 7 * 24
                                ? 'amber'
                                : 'blue'
                        }
                        value={catchUpDisplay.text}
                        valueState={catchUpDisplay.state}
                        hint={safeT(t, 'telegram_transfer_health_catch_up_hint')}
                    />
                </div>
            )}
        </div>
    );
};

export default TelegramTransferHealth;
