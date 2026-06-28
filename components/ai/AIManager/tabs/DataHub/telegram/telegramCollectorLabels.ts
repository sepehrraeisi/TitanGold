import type { DiagnoseCollectorCheck } from '../../../../../../services/telegramCollectorErrors.ts';

export type CollectorHealthLevel = 'healthy' | 'degraded' | 'critical' | 'unknown';

export type CollectorMetricsInput = {
    routeBroken: boolean;
    totalChannels: number;
    syncedChannels: number;
    channelsWithErrors: number;
    criticalErrorChannels: number;
    avgLatencyMs?: number | null;
};

export function computeCollectorHealthLevel(input: CollectorMetricsInput): CollectorHealthLevel {
    const { routeBroken, totalChannels, syncedChannels, channelsWithErrors, criticalErrorChannels } = input;
    if (routeBroken) return 'degraded';
    if (totalChannels === 0) return 'healthy';
    const syncRate = (syncedChannels / totalChannels) * 100;
    if (criticalErrorChannels > 0 || syncRate < 30) return 'critical';
    if (channelsWithErrors > 0 || syncRate < 70) return 'degraded';
    return 'healthy';
}

export function collectorHealthMetricColor(level: CollectorHealthLevel): 'emerald' | 'amber' | 'red' | 'blue' {
    switch (level) {
        case 'healthy':
            return 'emerald';
        case 'degraded':
            return 'amber';
        case 'critical':
            return 'red';
        default:
            return 'blue';
    }
}

export function collectorHealthLabel(level: CollectorHealthLevel, t: (k: string) => string): string {
    switch (level) {
        case 'healthy':
            return t('collector_status_healthy') || 'Healthy';
        case 'degraded':
            return t('collector_status_degraded') || 'Degraded';
        case 'critical':
            return t('collector_status_critical') || 'Critical';
        default:
            return t('collector_status_unknown') || 'Unknown';
    }
}

export function accountStatusVariant(
    status: string,
): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
    switch (status) {
        case 'active':
            return 'success';
        case 'flooded':
            return 'warning';
        case 'error':
            return 'error';
        case 'pending_login':
            return 'info';
        default:
            return 'neutral';
    }
}

export function accountStatusLabel(status: string, t: (k: string) => string): string {
    const key = `telegram_account_status_${status}`;
    return t(key) || status;
}

export function diagnoseCheckLabel(key: string, t: (k: string) => string): string {
    const map: Record<string, string> = {
        health: 'collector_health',
        session: 'collector_session',
        accounts: 'collector_accounts',
        channels: 'collector_channels',
    };
    return t(map[key] || key) || key;
}

export function formatDiagnoseSummary(checks: DiagnoseCollectorCheck[], t: (k: string) => string): string {
    return checks
        .map(check => {
            const label = diagnoseCheckLabel(check.key, t);
            const latency = check.latencyMs != null ? `${check.latencyMs}ms` : '—';
            const kind = check.responseKind || 'unknown';
            if (check.ok) return `${label}: OK (${check.status ?? 200}, ${latency}, ${kind})`;
            const err = check.errorKey ? t(check.errorKey) || check.errorKey : check.safeError || t('collector_diag_check_failed');
            return `${label}: ${err} (${check.status ?? 'n/a'}, ${kind}, ${latency})`;
        })
        .join(' | ');
}

export function computeSyncRate(total: number, synced: number): number {
    if (total <= 0) return 100;
    return (synced / total) * 100;
}
