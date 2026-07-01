import type {
    DataPipelineSnapshot,
    PipelineGlobalTelegramBacklog,
    PipelineTelegramIngestMetrics,
    PipelineTransferThroughput,
    TelegramTransferHealthStatus,
    TransferHealthMetricKey,
} from '../../../../../types';

export type TelegramTransferHealthInput = {
    ingestMetrics?: PipelineTelegramIngestMetrics | null;
    transferThroughput?: PipelineTransferThroughput | null;
    globalTelegramBacklog?: PipelineGlobalTelegramBacklog | null;
    unavailableMetrics?: TransferHealthMetricKey[];
    now?: Date;
};

export type MetricDisplayState = 'loaded' | 'zero' | 'unavailable';

export type MetricDisplay = {
    text: string;
    state: MetricDisplayState;
};

export type TelegramTransferHealthDerived = {
    incoming24h: number | null;
    transferredToCollectedData24h: number | null;
    processed24h: number | null;
    backlogTotal: number | null;
    oldestUnprocessedAgeHours: number | null;
    processingRatePerHour: number | null;
    drainRatio: number | null;
    catchUpHours: number | null;
    status: TelegramTransferHealthStatus;
    unavailableMetrics: TransferHealthMetricKey[];
};

const MS_PER_HOUR = 60 * 60 * 1000;
const WARNING_CATCH_UP_HOURS = 7 * 24;
const CRITICAL_CATCH_UP_HOURS = 30 * 24;
const WARNING_OLDEST_HOURS = 7 * 24;
const CRITICAL_OLDEST_HOURS = 30 * 24;

export function isMetricUnavailable(
    key: TransferHealthMetricKey,
    unavailableMetrics: TransferHealthMetricKey[] = [],
): boolean {
    return unavailableMetrics.includes(key);
}

export function hasTelegramTransferCoreMetrics(
    snapshot: DataPipelineSnapshot | undefined,
    unavailableMetrics: TransferHealthMetricKey[] = [],
): boolean {
    if (!snapshot) return false;
    const allUnavailable = new Set(unavailableMetrics);
    const hasIncoming =
        snapshot.telegramIngestMetrics?.incoming24h != null && !allUnavailable.has('incoming24h');
    const hasTransferred =
        snapshot.telegramIngestMetrics?.transferredToCollectedData24h != null &&
        !allUnavailable.has('transferred24h');
    const hasProcessed =
        snapshot.transferThroughput?.processed24h != null && !allUnavailable.has('processed24h');
    const hasBacklog =
        snapshot.globalTelegramBacklog?.unprocessedTotal != null &&
        !allUnavailable.has('backlogTotal');
    return hasIncoming || hasTransferred || hasProcessed || hasBacklog;
}

function readCount(
    value: number | null | undefined,
    key: TransferHealthMetricKey,
    unavailableMetrics: TransferHealthMetricKey[],
): number | null {
    if (isMetricUnavailable(key, unavailableMetrics)) return null;
    if (value == null) return null;
    return value;
}

export function computeTelegramTransferHealth(
    input: TelegramTransferHealthInput,
): TelegramTransferHealthDerived {
    const now = input.now ?? new Date();
    const unavailableMetrics = [...(input.unavailableMetrics ?? [])];

    const incoming24h = readCount(
        input.ingestMetrics?.incoming24h,
        'incoming24h',
        unavailableMetrics,
    );
    const transferredToCollectedData24h = readCount(
        input.ingestMetrics?.transferredToCollectedData24h,
        'transferred24h',
        unavailableMetrics,
    );
    const processed24h = readCount(
        input.transferThroughput?.processed24h,
        'processed24h',
        unavailableMetrics,
    );
    const processingRatePerHour = isMetricUnavailable('processingRate', unavailableMetrics)
        ? null
        : (input.transferThroughput?.messagesPerHour ?? null);
    const backlogTotal = readCount(
        input.globalTelegramBacklog?.unprocessedTotal,
        'backlogTotal',
        unavailableMetrics,
    );

    const oldestUnprocessedAgeHours =
        isMetricUnavailable('oldestUnprocessedAge', unavailableMetrics) ||
        !input.globalTelegramBacklog?.oldestUnprocessed
            ? null
            : Math.max(
                  0,
                  (now.getTime() -
                      new Date(input.globalTelegramBacklog.oldestUnprocessed).getTime()) /
                      MS_PER_HOUR,
              );

    const drainUnavailable =
        isMetricUnavailable('drainRatio', unavailableMetrics) ||
        incoming24h == null ||
        processed24h == null ||
        incoming24h <= 0;
    const drainRatio = drainUnavailable
        ? null
        : Number((processed24h / incoming24h).toFixed(2));

    const catchUpUnavailable =
        isMetricUnavailable('catchUp', unavailableMetrics) ||
        backlogTotal == null ||
        processingRatePerHour == null ||
        processingRatePerHour <= 0;
    const catchUpHours = catchUpUnavailable
        ? null
        : backlogTotal <= 0
          ? 0
          : Number((backlogTotal / processingRatePerHour).toFixed(1));

    let status: TelegramTransferHealthStatus = 'healthy';

    if (
        (incoming24h != null && incoming24h > 0 && processed24h === 0) ||
        (drainRatio != null && drainRatio < 0.5) ||
        (oldestUnprocessedAgeHours != null &&
            oldestUnprocessedAgeHours >= CRITICAL_OLDEST_HOURS) ||
        (catchUpHours != null && catchUpHours >= CRITICAL_CATCH_UP_HOURS)
    ) {
        status = 'critical';
    } else if (
        (drainRatio != null && drainRatio < 1) ||
        (oldestUnprocessedAgeHours != null && oldestUnprocessedAgeHours >= WARNING_OLDEST_HOURS) ||
        (catchUpHours != null && catchUpHours >= WARNING_CATCH_UP_HOURS) ||
        (backlogTotal != null && backlogTotal > 0) ||
        unavailableMetrics.length > 0
    ) {
        status = 'warning';
    }

    return {
        incoming24h,
        transferredToCollectedData24h,
        processed24h,
        backlogTotal,
        oldestUnprocessedAgeHours,
        processingRatePerHour,
        drainRatio,
        catchUpHours,
        status,
        unavailableMetrics,
    };
}

export function formatCount(value: number): string {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatMetricValue(
    value: number | null,
    unavailable: boolean,
    t: (key: string) => string,
): MetricDisplay {
    if (unavailable || value == null) {
        return { text: t('telegram_transfer_health_unavailable'), state: 'unavailable' };
    }
    if (value === 0) {
        return { text: formatCount(value), state: 'zero' };
    }
    return { text: formatCount(value), state: 'loaded' };
}

export function formatRatePerHour(
    value: number | null,
    unavailable: boolean,
    t: (key: string) => string,
): MetricDisplay {
    if (unavailable || value == null) {
        return { text: t('telegram_transfer_health_unavailable'), state: 'unavailable' };
    }
    return { text: `${formatCount(Math.round(value))}/h`, state: value === 0 ? 'zero' : 'loaded' };
}

export function formatDrainRatio(
    ratio: number | null,
    unavailable: boolean,
    t: (key: string) => string,
): MetricDisplay {
    if (unavailable || ratio == null) {
        return { text: t('telegram_transfer_health_unavailable'), state: 'unavailable' };
    }
    return { text: `${(ratio * 100).toFixed(0)}%`, state: 'loaded' };
}

export function formatCatchUpHours(
    hours: number | null,
    unavailable: boolean,
    t: (key: string) => string,
): MetricDisplay {
    if (unavailable || hours == null) {
        return { text: t('telegram_transfer_health_unavailable'), state: 'unavailable' };
    }
    if (hours <= 0) {
        return { text: t('telegram_transfer_health_caught_up'), state: 'zero' };
    }
    if (hours < 1) {
        return { text: t('telegram_transfer_health_catch_up_under_hour'), state: 'loaded' };
    }
    if (hours < 24) {
        return {
            text: t('telegram_transfer_health_catch_up_hours').replace(
                '{{hours}}',
                String(Math.max(1, Math.round(hours))),
            ),
            state: 'loaded',
        };
    }
    const days = hours / 24;
    if (days < 14) {
        return {
            text: t('telegram_transfer_health_catch_up_days').replace('{{days}}', days.toFixed(1)),
            state: 'loaded',
        };
    }
    return {
        text: t('telegram_transfer_health_catch_up_days').replace('{{days}}', String(Math.round(days))),
        state: 'loaded',
    };
}

export function formatOldestAge(
    hours: number | null,
    unavailable: boolean,
    formatTimeAgo: (date: string | Date | undefined) => string,
    oldestIso: string | undefined,
    t: (key: string) => string,
): MetricDisplay {
    if (unavailable) {
        return { text: t('telegram_transfer_health_unavailable'), state: 'unavailable' };
    }
    if (oldestIso) {
        return { text: formatTimeAgo(oldestIso), state: 'loaded' };
    }
    if (hours == null) {
        return { text: t('telegram_transfer_health_unavailable'), state: 'unavailable' };
    }
    if (hours < 1) return { text: t('telegram_transfer_health_age_under_hour'), state: 'loaded' };
    if (hours < 24) {
        return {
            text: t('telegram_transfer_health_age_hours').replace('{{hours}}', String(Math.round(hours))),
            state: 'loaded',
        };
    }
    return {
        text: t('telegram_transfer_health_age_days').replace('{{days}}', String(Math.round(hours / 24))),
        state: 'loaded',
    };
}

export function transferHealthStatusVariant(
    status: TelegramTransferHealthStatus,
): 'success' | 'warning' | 'error' {
    if (status === 'healthy') return 'success';
    if (status === 'warning') return 'warning';
    return 'error';
}

const PARTIAL_METRIC_I18N: Record<TransferHealthMetricKey, string> = {
    incoming24h: 'telegram_transfer_health_metric_incoming24h',
    transferred24h: 'telegram_transfer_health_metric_transferred24h',
    processed24h: 'telegram_transfer_health_metric_processed24h',
    backlogTotal: 'telegram_transfer_health_metric_backlog',
    oldestUnprocessedAge: 'telegram_transfer_health_metric_oldest_age',
    processingRate: 'telegram_transfer_health_metric_processing_rate',
    drainRatio: 'telegram_transfer_health_metric_drain_ratio',
    catchUp: 'telegram_transfer_health_metric_catch_up',
};

export function buildPartialWarningMessage(
    t: (key: string) => string,
    unavailableMetrics: TransferHealthMetricKey[],
): string | null {
    if (!unavailableMetrics.length) return null;
    const labels = unavailableMetrics.map((key) => {
        const labelKey = PARTIAL_METRIC_I18N[key];
        const translated = t(labelKey);
        return translated !== labelKey ? translated : key;
    });
    return t('telegram_transfer_health_partial_list').replace('{{metrics}}', labels.join(', '));
}

export function metricLabelKey(metric: TransferHealthMetricKey): string {
    return PARTIAL_METRIC_I18N[metric].replace('_metric_', '_');
}
