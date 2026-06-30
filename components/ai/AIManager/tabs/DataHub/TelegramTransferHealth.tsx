import React, { useMemo } from 'react';
import SkeletonLoader from '../../../../common/SkeletonLoader';
import type { DataPipelineSnapshot } from '../../../../../types';
import {
    DATAHUB_INNER_LIST,
    DataHubAlert,
    DataHubEmpty,
    MetricCard,
    StatusPill,
} from './dataHubUi';
import {
    computeTelegramTransferHealth,
    formatCatchUpHours,
    formatCount,
    formatDrainRatio,
    formatOldestAge,
    formatRatePerHour,
    transferHealthStatusVariant,
} from './telegramTransferHealthFormat';

interface TelegramTransferHealthProps {
    t: (key: string) => string;
    snapshot: DataPipelineSnapshot | undefined;
    isLoading: boolean;
    isPipelineLoaded: boolean;
    error?: string | null;
    onRetry?: () => void;
    formatTimeAgo: (date: string | Date | undefined) => string;
}

function statusLabel(t: (key: string) => string, status: 'healthy' | 'warning' | 'critical'): string {
    const key = `telegram_transfer_health_status_${status}`;
    const translated = t(key);
    return translated !== key ? translated : status;
}

const TelegramTransferHealth: React.FC<TelegramTransferHealthProps> = ({
    t,
    snapshot,
    isLoading,
    isPipelineLoaded,
    error = null,
    onRetry,
    formatTimeAgo,
}) => {
    const derived = useMemo(
        () =>
            computeTelegramTransferHealth({
                ingestMetrics: snapshot?.telegramIngestMetrics,
                transferThroughput: snapshot?.transferThroughput,
                globalTelegramBacklog: snapshot?.globalTelegramBacklog,
            }),
        [snapshot],
    );

    const hasTransferData = Boolean(
        snapshot?.transferThroughput && snapshot?.globalTelegramBacklog && snapshot?.telegramIngestMetrics,
    );

    const statusVariant = transferHealthStatusVariant(derived.status);

    return (
        <div className={DATAHUB_INNER_LIST}>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                    <h4 className="text-[11px] font-semibold text-foreground">
                        {t('telegram_transfer_health_title')}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        {t('telegram_transfer_health_question')}
                    </p>
                </div>
                {hasTransferData && !isLoading && (
                    <StatusPill
                        label={statusLabel(t, derived.status)}
                        variant={statusVariant}
                        title={t('telegram_transfer_health_status_hint')}
                    />
                )}
                {isLoading && (
                    <span className="text-[10px] text-muted-foreground">
                        {t('telegram_transfer_health_loading')}
                    </span>
                )}
            </div>

            {error && !isLoading && (
                <DataHubAlert
                    variant="error"
                    message={t('telegram_transfer_health_load_error')}
                    onRetry={onRetry}
                    retryLabel={t('retry')}
                />
            )}

            {!isPipelineLoaded && !isLoading && !error && (
                <DataHubEmpty message={t('telegram_transfer_health_not_loaded')} />
            )}

            {isPipelineLoaded && !hasTransferData && isLoading && !error && (
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

            {hasTransferData && (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                    <MetricCard
                        label={t('telegram_transfer_health_incoming_24h')}
                        color="blue"
                        value={formatCount(derived.incoming24h)}
                        hint={t('telegram_transfer_health_incoming_hint')}
                    />
                    <MetricCard
                        label={t('telegram_transfer_health_transferred_24h')}
                        color="purple"
                        value={formatCount(derived.transferredToCollectedData24h)}
                        hint={t('telegram_transfer_health_transferred_hint')}
                    />
                    <MetricCard
                        label={t('telegram_transfer_health_processed_24h')}
                        color="emerald"
                        value={formatCount(derived.processed24h)}
                        hint={t('telegram_transfer_health_processed_hint')}
                    />
                    <MetricCard
                        label={t('telegram_transfer_health_backlog')}
                        color={derived.backlogTotal > 0 ? 'amber' : 'emerald'}
                        value={formatCount(derived.backlogTotal)}
                        hint={t('telegram_transfer_health_backlog_hint')}
                    />
                    <MetricCard
                        label={t('telegram_transfer_health_oldest_age')}
                        color={
                            derived.oldestUnprocessedAgeHours != null &&
                            derived.oldestUnprocessedAgeHours >= 7 * 24
                                ? 'red'
                                : 'blue'
                        }
                        value={formatOldestAge(
                            derived.oldestUnprocessedAgeHours,
                            formatTimeAgo,
                            snapshot?.globalTelegramBacklog?.oldestUnprocessed,
                        )}
                        hint={t('telegram_transfer_health_oldest_hint')}
                    />
                    <MetricCard
                        label={t('telegram_transfer_health_processing_rate')}
                        color="emerald"
                        value={formatRatePerHour(derived.processingRatePerHour)}
                        hint={t('telegram_transfer_health_rate_hint')}
                    />
                    <MetricCard
                        label={t('telegram_transfer_health_drain_ratio')}
                        color={
                            derived.drainRatio == null
                                ? 'blue'
                                : derived.drainRatio >= 1
                                  ? 'emerald'
                                  : derived.drainRatio >= 0.5
                                    ? 'amber'
                                    : 'red'
                        }
                        value={formatDrainRatio(derived.drainRatio)}
                        hint={t('telegram_transfer_health_drain_hint')}
                    />
                    <MetricCard
                        label={t('telegram_transfer_health_catch_up')}
                        color={
                            derived.catchUpHours != null && derived.catchUpHours > 7 * 24
                                ? 'amber'
                                : 'blue'
                        }
                        value={formatCatchUpHours(derived.catchUpHours, t)}
                        hint={t('telegram_transfer_health_catch_up_hint')}
                    />
                </div>
            )}
        </div>
    );
};

export default TelegramTransferHealth;
