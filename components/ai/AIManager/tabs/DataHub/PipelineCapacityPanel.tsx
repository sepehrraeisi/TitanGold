import React, { useMemo } from 'react';
import type {
    DataPipelineSnapshot,
    PipelineCapacityResponse,
    TransferHealthMetricKey,
} from '../../../../../types';
import SkeletonLoader from '../../../../common/SkeletonLoader';
import { DATAHUB_INNER_LIST, DataHubAlert, MetricCard, StatusPill } from './dataHubUi';
import { safeT } from './dataHubI18n';
import {
    computeTelegramTransferHealth,
    formatCatchUpHours,
    formatMetricValue,
    formatRatePerHour,
    isMetricUnavailable,
} from './telegramTransferHealthFormat';
import {
    backlogSeverityLabel,
    backlogSeverityVariant,
    classifyBacklogSeverity,
    schedulerStatusLabel,
} from './pipelineOperationalMetrics';

interface PipelineCapacityPanelProps {
    t: (key: string) => string;
    capacity: PipelineCapacityResponse | undefined;
    isLoading: boolean;
    error?: string | null;
    snapshot: DataPipelineSnapshot | undefined;
    unavailableMetrics?: TransferHealthMetricKey[];
}

function formatIntervalMinutes(minutes: number | null, t: (key: string) => string): string {
    if (minutes == null) return safeT(t, 'pipeline_capacity_unavailable');
    return safeT(t, 'pipeline_capacity_interval_minutes').replace('{{minutes}}', String(minutes));
}

const PipelineCapacityPanel: React.FC<PipelineCapacityPanelProps> = ({
    t,
    capacity,
    isLoading,
    error = null,
    snapshot,
    unavailableMetrics = [],
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

    const rateDisplay = formatRatePerHour(
        derived.processingRatePerHour,
        isMetricUnavailable('processingRate', unavailableMetrics) ||
            derived.processingRatePerHour == null,
        t,
    );
    const backlogUnavailable =
        isMetricUnavailable('backlogTotal', unavailableMetrics) || derived.backlogTotal == null;
    const backlogDisplay = formatMetricValue(derived.backlogTotal, backlogUnavailable, t);
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

    const capacityStatus =
        derived.backlogTotal != null && derived.backlogTotal > 0 &&
        (derived.catchUpHours == null || derived.catchUpHours > 7 * 24)
            ? 'warning'
            : 'normal';

    const statusVariant = capacityStatus === 'warning' ? 'warning' : 'success';
    const statusLabel =
        capacityStatus === 'warning'
            ? safeT(t, 'pipeline_capacity_status_warning')
            : safeT(t, 'pipeline_capacity_status_normal');

    const schedulerLabel = capacity
        ? schedulerStatusLabel(t, capacity.schedulerStatus)
        : safeT(t, 'pipeline_capacity_unavailable');

    return (
        <div className={DATAHUB_INNER_LIST}>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                    <h4 className="text-[11px] font-semibold text-foreground">
                        {safeT(t, 'pipeline_capacity_title')}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        {safeT(t, 'pipeline_capacity_subtitle')}
                    </p>
                </div>
                {!isLoading && capacity && (
                    <StatusPill
                        label={statusLabel}
                        variant={statusVariant}
                        title={safeT(t, 'pipeline_capacity_status_hint')}
                    />
                )}
                {isLoading && (
                    <span className="text-[10px] text-muted-foreground">
                        {safeT(t, 'pipeline_capacity_loading')}
                    </span>
                )}
            </div>

            <DataHubAlert variant="warning" message={safeT(t, 'pipeline_capacity_config_only_banner')} />

            {error && !capacity && !isLoading && (
                <DataHubAlert variant="error" message={safeT(t, 'pipeline_capacity_load_error')} />
            )}

            {isLoading && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="rounded-xl border border-white/5 p-3">
                            <SkeletonLoader width="70%" height="0.75rem" />
                            <div className="mt-2">
                                <SkeletonLoader width="50%" height="1rem" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {capacity && !isLoading && (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 mt-3">
                    <MetricCard
                        label={safeT(t, 'pipeline_capacity_configuration')}
                        color="blue"
                        value={safeT(t, 'pipeline_capacity_configuration_only')}
                        hint={safeT(t, 'pipeline_capacity_configuration_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'pipeline_capacity_scheduler_status')}
                        color="blue"
                        value={schedulerLabel}
                        hint={safeT(t, 'pipeline_capacity_scheduler_status_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'pipeline_capacity_transfer_batch')}
                        color="purple"
                        value={String(capacity.transfer.batchSize)}
                        hint={safeT(t, 'pipeline_capacity_transfer_batch_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'pipeline_capacity_transfer_interval')}
                        color="purple"
                        value={formatIntervalMinutes(capacity.transfer.intervalMinutes, t)}
                        hint={safeT(t, 'pipeline_capacity_transfer_interval_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'pipeline_capacity_normalization_batch')}
                        color="emerald"
                        value={String(capacity.normalization.batchSize)}
                        hint={safeT(t, 'pipeline_capacity_normalization_batch_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'pipeline_capacity_normalization_interval')}
                        color="emerald"
                        value={formatIntervalMinutes(capacity.normalization.intervalMinutes, t)}
                        hint={safeT(t, 'pipeline_capacity_normalization_interval_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'pipeline_capacity_processing_rate')}
                        color="emerald"
                        value={rateDisplay.text}
                        valueState={rateDisplay.state}
                        hint={safeT(t, 'pipeline_capacity_processing_rate_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'pipeline_capacity_backlog')}
                        color={
                            backlogDisplay.state === 'loaded' &&
                            derived.backlogTotal != null &&
                            derived.backlogTotal > 0
                                ? 'amber'
                                : 'emerald'
                        }
                        value={backlogDisplay.text}
                        valueState={backlogDisplay.state}
                        hint={safeT(t, 'pipeline_capacity_backlog_hint')}
                        badge={backlogBadge}
                    />
                    <MetricCard
                        label={safeT(t, 'pipeline_capacity_catch_up')}
                        color="blue"
                        value={catchUpDisplay.text}
                        valueState={catchUpDisplay.state}
                        hint={safeT(t, 'pipeline_capacity_catch_up_hint')}
                    />
                </div>
            )}
        </div>
    );
};

export default PipelineCapacityPanel;
