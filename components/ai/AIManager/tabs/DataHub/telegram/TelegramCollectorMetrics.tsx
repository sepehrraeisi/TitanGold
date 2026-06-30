import React from 'react';
import { MetricCard, StatusPill } from '../dataHubUi';
import {
    computeCollectorHealthLevel,
    computeSyncRate,
    collectorHealthLabel,
    collectorHealthMetricColor,
    formatCollectorAvgLatency,
    formatCollectorLastProcessed,
    type CollectorMetricsInput,
} from './telegramCollectorLabels';

type Props = {
    t: (key: string) => string;
    metrics: CollectorMetricsInput;
    formatTimeAgo?: (timestamp?: string) => string;
};

const TelegramCollectorMetrics: React.FC<Props> = ({ t, metrics, formatTimeAgo }) => {
    const level = computeCollectorHealthLevel(metrics);
    const color = collectorHealthMetricColor(level);
    const syncRate = computeSyncRate(metrics.totalChannels, metrics.syncedChannels);
    const avgLatency = formatCollectorAvgLatency(metrics.avgLatencyMs, t);
    const lastProcessed = formatCollectorLastProcessed(metrics.lastProcessedAt, t, formatTimeAgo);

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 md:gap-3">
            <MetricCard
                label={t('collector_status')}
                color={color}
                value={collectorHealthLabel(level, t)}
            />
            <MetricCard
                label={t('sync_rate')}
                color="blue"
                value={`${syncRate.toFixed(0)}% (${metrics.syncedChannels}/${metrics.totalChannels})`}
            />
            <MetricCard
                label={t('collector_avg_latency')}
                color={avgLatency.available ? 'purple' : 'blue'}
                value={
                    avgLatency.available ? (
                        avgLatency.display
                    ) : (
                        <StatusPill variant="neutral" label={avgLatency.display} />
                    )
                }
                hint={avgLatency.hint}
            />
            <MetricCard
                label={t('last_processed')}
                color={lastProcessed.available ? 'emerald' : 'blue'}
                value={
                    lastProcessed.available ? (
                        lastProcessed.display
                    ) : (
                        <StatusPill variant="neutral" label={lastProcessed.display} />
                    )
                }
                hint={lastProcessed.hint}
            />
            <MetricCard
                label={t('collector_channels_with_errors')}
                color="red"
                value={
                    metrics.criticalErrorChannels > 0
                        ? `${metrics.channelsWithErrors} (${metrics.criticalErrorChannels} ${t('collector_status_critical')})`
                        : String(metrics.channelsWithErrors)
                }
            />
        </div>
    );
};

export default TelegramCollectorMetrics;
