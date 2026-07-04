import type { PipelineNormalizationSummaryResponse } from '../../../../../types';

export type NormalizationMetricDisplayState = 'loaded' | 'zero' | 'unavailable';

export type NormalizationMetricDisplay = {
    text: string;
    state: NormalizationMetricDisplayState;
};

export function formatNormCount(value: number): string {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatNormMetricValue(
    value: number | null,
    loaded: boolean,
    t: (key: string) => string,
): NormalizationMetricDisplay {
    if (!loaded || value == null) {
        return { text: t('pipeline_normalization_unavailable'), state: 'unavailable' };
    }
    if (value === 0) {
        return { text: formatNormCount(value), state: 'zero' };
    }
    return { text: formatNormCount(value), state: 'loaded' };
}

export function formatNormPassRate(
    rate: number | null,
    loaded: boolean,
    t: (key: string) => string,
): NormalizationMetricDisplay {
    if (!loaded || rate == null) {
        return { text: t('pipeline_normalization_unavailable'), state: 'unavailable' };
    }
    return { text: `${(rate * 100).toFixed(1)}%`, state: rate === 0 ? 'zero' : 'loaded' };
}

export function isNormalizationSummaryLoaded(
    summary: PipelineNormalizationSummaryResponse | undefined,
): boolean {
    return summary?.meta?.loaded === true;
}
