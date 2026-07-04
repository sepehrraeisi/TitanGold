import React, { useMemo } from 'react';
import SkeletonLoader from '../../../../common/SkeletonLoader';
import type { PipelineNormalizationSummaryResponse } from '../../../../../types';
import {
    DATAHUB_INNER_LIST,
    DataHubAlert,
    MetricCard,
} from './dataHubUi';
import { safeT } from './dataHubI18n';
import {
    formatNormMetricValue,
    formatNormPassRate,
    isNormalizationSummaryLoaded,
} from './pipelineNormalizationFormat';

interface PipelineNormalizationSummaryProps {
    t: (key: string) => string;
    summary: PipelineNormalizationSummaryResponse | undefined;
    isLoading: boolean;
    error?: string | null;
    onRetry?: () => void;
    formatTimeAgo: (date: string | Date | undefined) => string;
}

const PipelineNormalizationSummary: React.FC<PipelineNormalizationSummaryProps> = ({
    t,
    summary,
    isLoading,
    error = null,
    onRetry,
    formatTimeAgo,
}) => {
    const loaded = isNormalizationSummaryLoaded(summary);
    const showError = Boolean(error) && !loaded && !isLoading;
    const showUnloaded = !isLoading && !loaded && !showError && !summary;
    const showUnavailable = !isLoading && summary && !loaded && !showError;
    const warningsPartial =
        loaded && summary?.meta?.partial === true && summary?.warnings == null;

    const processed = formatNormMetricValue(summary?.totalProcessed ?? null, loaded, t);
    const passed = formatNormMetricValue(summary?.passed ?? null, loaded, t);
    const warnings = formatNormMetricValue(summary?.warnings ?? null, loaded, t);
    const rejected = formatNormMetricValue(summary?.rejected ?? null, loaded, t);
    const passRate = formatNormPassRate(summary?.passRate ?? null, loaded, t);

    const warningsTooltip = warningsPartial
        ? safeT(t, 'pipeline_normalization_warnings_partial_tooltip')
        : undefined;

    const lastNormalized = useMemo(() => {
        if (!loaded || !summary?.lastProcessedAt) {
            return { text: safeT(t, 'pipeline_normalization_unavailable'), state: 'unavailable' as const };
        }
        return {
            text: formatTimeAgo(summary.lastProcessedAt),
            state: 'loaded' as const,
        };
    }, [loaded, summary?.lastProcessedAt, formatTimeAgo, t]);

    return (
        <div className={DATAHUB_INNER_LIST}>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                    <h4 className="text-[11px] font-semibold text-foreground">
                        {safeT(t, 'pipeline_normalization_title')}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        {safeT(t, 'pipeline_normalization_subtitle')}
                    </p>
                </div>
                {isLoading && (
                    <span className="text-[10px] text-muted-foreground">
                        {safeT(t, 'pipeline_normalization_loading')}
                    </span>
                )}
                {!isLoading && onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="text-[10px] text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline"
                    >
                        {safeT(t, 'pipeline_normalization_retry')}
                    </button>
                )}
            </div>

            {showError && (
                <DataHubAlert
                    variant="error"
                    message={safeT(t, 'pipeline_normalization_load_error')}
                    onRetry={onRetry}
                    retryLabel={safeT(t, 'retry')}
                />
            )}

            {showUnloaded && (
                <p className="text-[11px] text-muted-foreground">
                    {safeT(t, 'pipeline_normalization_not_loaded')}
                </p>
            )}

            {showUnavailable && (
                <DataHubAlert
                    variant="warning"
                    message={safeT(t, 'pipeline_normalization_unavailable_hint')}
                />
            )}

            {isLoading && !loaded && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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

            {(loaded || (summary && !isLoading && !showError)) && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <MetricCard
                        label={safeT(t, 'pipeline_normalization_processed_24h')}
                        color="blue"
                        value={processed.text}
                        valueState={processed.state}
                        hint={safeT(t, 'pipeline_normalization_processed_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'pipeline_normalization_passed_24h')}
                        color="emerald"
                        value={passed.text}
                        valueState={passed.state}
                        hint={safeT(t, 'pipeline_normalization_passed_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'pipeline_normalization_warnings_24h')}
                        color="amber"
                        value={warnings.text}
                        valueState={warnings.state}
                        hint={safeT(t, 'pipeline_normalization_warnings_hint')}
                        valueTooltip={warningsTooltip}
                    />
                    <MetricCard
                        label={safeT(t, 'pipeline_normalization_rejected_24h')}
                        color="red"
                        value={rejected.text}
                        valueState={rejected.state}
                        hint={safeT(t, 'pipeline_normalization_rejected_hint')}
                    />
                    <MetricCard
                        label={safeT(t, 'pipeline_normalization_pass_rate')}
                        color="emerald"
                        value={passRate.text}
                        valueState={passRate.state}
                        hint={safeT(t, 'pipeline_normalization_pass_rate_hint')}
                        emphasis="primary"
                    />
                    <MetricCard
                        label={safeT(t, 'pipeline_normalization_last_event')}
                        color="blue"
                        value={lastNormalized.text}
                        valueState={lastNormalized.state}
                        hint={safeT(t, 'pipeline_normalization_last_event_hint')}
                    />
                </div>
            )}
        </div>
    );
};

export default PipelineNormalizationSummary;
