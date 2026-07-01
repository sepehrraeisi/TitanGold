import type {
    DataPipelineSnapshot,
    PipelineGlobalTelegramBacklog,
    PipelineTelegramIngestMetrics,
    PipelineTransferThroughput,
    TelegramTransferHealthStatus,
} from '../../../../../types';

export type TelegramTransferHealthInput = {
    ingestMetrics?: PipelineTelegramIngestMetrics;
    transferThroughput?: PipelineTransferThroughput;
    globalTelegramBacklog?: PipelineGlobalTelegramBacklog;
    now?: Date;
};

export type TelegramTransferHealthDerived = {
    incoming24h: number;
    transferredToCollectedData24h: number;
    processed24h: number;
    backlogTotal: number;
    oldestUnprocessedAgeHours: number | null;
    processingRatePerHour: number;
    drainRatio: number | null;
    catchUpHours: number | null;
    status: TelegramTransferHealthStatus;
};

const MS_PER_HOUR = 60 * 60 * 1000;
const WARNING_CATCH_UP_HOURS = 7 * 24;
const CRITICAL_CATCH_UP_HOURS = 30 * 24;
const WARNING_OLDEST_HOURS = 7 * 24;
const CRITICAL_OLDEST_HOURS = 30 * 24;

export function hasTelegramTransferCoreMetrics(
    snapshot: DataPipelineSnapshot | undefined,
): boolean {
    if (!snapshot) return false;
    return Boolean(
        snapshot.transferThroughput ||
            snapshot.globalTelegramBacklog ||
            snapshot.telegramIngestMetrics,
    );
}

export function computeTelegramTransferHealth(
    input: TelegramTransferHealthInput,
): TelegramTransferHealthDerived {
    const now = input.now ?? new Date();
    const incoming24h = input.ingestMetrics?.incoming24h ?? 0;
    const transferredToCollectedData24h = input.ingestMetrics?.transferredToCollectedData24h ?? 0;
    const processed24h = input.transferThroughput?.processed24h ?? 0;
    const processingRatePerHour = input.transferThroughput?.messagesPerHour ?? 0;
    const backlogTotal = input.globalTelegramBacklog?.unprocessedTotal ?? 0;

    const oldestUnprocessedAgeHours = input.globalTelegramBacklog?.oldestUnprocessed
        ? Math.max(
              0,
              (now.getTime() - new Date(input.globalTelegramBacklog.oldestUnprocessed).getTime()) /
                  MS_PER_HOUR,
          )
        : null;

    const drainRatio =
        incoming24h > 0 ? Number((processed24h / incoming24h).toFixed(2)) : null;

    const catchUpHours =
        backlogTotal > 0 && processingRatePerHour > 0
            ? Number((backlogTotal / processingRatePerHour).toFixed(1))
            : backlogTotal > 0
              ? null
              : 0;

    let status: TelegramTransferHealthStatus = 'healthy';

    if (
        (incoming24h > 0 && processed24h === 0) ||
        (drainRatio != null && drainRatio < 0.5) ||
        (oldestUnprocessedAgeHours != null && oldestUnprocessedAgeHours >= CRITICAL_OLDEST_HOURS) ||
        (catchUpHours != null && catchUpHours >= CRITICAL_CATCH_UP_HOURS)
    ) {
        status = 'critical';
    } else if (
        (drainRatio != null && drainRatio < 1) ||
        (oldestUnprocessedAgeHours != null && oldestUnprocessedAgeHours >= WARNING_OLDEST_HOURS) ||
        (catchUpHours != null && catchUpHours >= WARNING_CATCH_UP_HOURS) ||
        backlogTotal > 0
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
    };
}

export function formatCount(value: number): string {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatRatePerHour(value: number): string {
    return `${formatCount(Math.round(value))}/h`;
}

export function formatDrainRatio(ratio: number | null): string {
    if (ratio == null) return '—';
    return `${(ratio * 100).toFixed(0)}%`;
}

export function formatCatchUpHours(hours: number | null, t: (key: string) => string): string {
    if (hours == null) return '—';
    if (hours <= 0) return t('telegram_transfer_health_caught_up');
    if (hours < 1) return t('telegram_transfer_health_catch_up_under_hour');
    if (hours < 24) {
        return t('telegram_transfer_health_catch_up_hours').replace(
            '{{hours}}',
            String(Math.max(1, Math.round(hours))),
        );
    }
    const days = hours / 24;
    if (days < 14) {
        return t('telegram_transfer_health_catch_up_days').replace('{{days}}', days.toFixed(1));
    }
    return t('telegram_transfer_health_catch_up_days').replace('{{days}}', String(Math.round(days)));
}

export function formatOldestAge(
    hours: number | null,
    formatTimeAgo: (date: string | Date | undefined) => string,
    oldestIso?: string,
): string {
    if (oldestIso) return formatTimeAgo(oldestIso);
    if (hours == null) return '—';
    if (hours < 1) return '<1h';
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
}

export function transferHealthStatusVariant(
    status: TelegramTransferHealthStatus,
): 'success' | 'warning' | 'error' {
    if (status === 'healthy') return 'success';
    if (status === 'warning') return 'warning';
    return 'error';
}
