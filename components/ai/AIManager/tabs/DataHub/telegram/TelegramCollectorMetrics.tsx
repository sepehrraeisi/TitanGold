import React from 'react';
import { MetricCard } from '../dataHubUi';
import {
    computeCollectorHealthLevel,
    computeSyncRate,
    collectorHealthLabel,
    collectorHealthMetricColor,
    type CollectorMetricsInput,
} from './telegramCollectorLabels';

type Props = {
    t: (key: string) => string;
    metrics: CollectorMetricsInput;
};

const TelegramCollectorMetrics: React.FC<Props> = ({ t, metrics }) => {
    const level = computeCollectorHealthLevel(metrics);
    const color = collectorHealthMetricColor(level);
    const syncRate = computeSyncRate(metrics.totalChannels, metrics.syncedChannels);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
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
                color="purple"
                value={metrics.avgLatencyMs ? `${Math.round(metrics.avgLatencyMs)} ms` : '—'}
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
