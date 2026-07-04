import type { PipelineBacklogTrend, PipelineSchedulerStatus } from '../../../../../types';
import { safeT } from './dataHubI18n';

export const BACKLOG_SEVERITY_NORMAL_MAX = 100_000;
export const BACKLOG_SEVERITY_WARNING_MAX = 500_000;

export const RESPONSE_TIME_HEALTHY_MAX_MS = 500;
export const RESPONSE_TIME_WARNING_MAX_MS = 2000;

export type BacklogSeverity = 'normal' | 'warning' | 'critical';
export type ResponseTimeSeverity = 'healthy' | 'warning' | 'critical';

export function classifyBacklogSeverity(backlog: number | null | undefined): BacklogSeverity | null {
    if (backlog == null || !Number.isFinite(backlog)) return null;
    if (backlog < BACKLOG_SEVERITY_NORMAL_MAX) return 'normal';
    if (backlog <= BACKLOG_SEVERITY_WARNING_MAX) return 'warning';
    return 'critical';
}

export function backlogSeverityVariant(
    severity: BacklogSeverity | null,
): 'success' | 'warning' | 'error' | 'neutral' {
    if (severity === 'normal') return 'success';
    if (severity === 'warning') return 'warning';
    if (severity === 'critical') return 'error';
    return 'neutral';
}

export function backlogSeverityLabel(
    t: (key: string) => string,
    severity: BacklogSeverity | null,
): string | null {
    if (!severity) return null;
    return safeT(t, `pipeline_backlog_severity_${severity}`);
}

export function classifyResponseTimeSeverity(
    responseMs: number | null | undefined,
): ResponseTimeSeverity | null {
    if (responseMs == null || !Number.isFinite(responseMs)) return null;
    if (responseMs < RESPONSE_TIME_HEALTHY_MAX_MS) return 'healthy';
    if (responseMs <= RESPONSE_TIME_WARNING_MAX_MS) return 'warning';
    return 'critical';
}

export function responseTimeSeverityClass(severity: ResponseTimeSeverity | null): string {
    if (severity === 'healthy') return 'text-emerald-300';
    if (severity === 'warning') return 'text-amber-300';
    if (severity === 'critical') return 'text-red-300';
    return 'text-muted-foreground';
}

export function responseTimeSeverityLabel(
    t: (key: string) => string,
    severity: ResponseTimeSeverity | null,
): string | null {
    if (!severity) return null;
    return safeT(t, `pipeline_response_severity_${severity}`);
}

export function schedulerStatusLabel(
    t: (key: string) => string,
    status: PipelineSchedulerStatus | null | undefined,
): string {
    if (!status || status === 'unknown') {
        return safeT(t, 'pipeline_capacity_scheduler_unknown');
    }
    return safeT(t, `pipeline_capacity_scheduler_${status}`);
}

export function formatBacklogTrendDisplay(
    t: (key: string) => string,
    trend: PipelineBacklogTrend | null | undefined,
): { text: string; state: 'loaded' | 'unavailable' } {
    if (!trend?.loaded || !trend.direction) {
        return { text: safeT(t, 'pipeline_backlog_trend_unavailable'), state: 'unavailable' };
    }
    if (trend.direction === 'stable') {
        return { text: safeT(t, 'pipeline_backlog_trend_stable'), state: 'loaded' };
    }
    const pct = trend.percentChange != null ? Math.abs(trend.percentChange).toFixed(0) : '0';
    if (trend.direction === 'up') {
        return {
            text: safeT(t, 'pipeline_backlog_trend_up').replace('{{percent}}', pct),
            state: 'loaded',
        };
    }
    return {
        text: safeT(t, 'pipeline_backlog_trend_down').replace('{{percent}}', pct),
        state: 'loaded',
    };
}

/** Verify catch-up is always derived live from backlog ÷ rate (no independent cache). */
export function computeCatchUpHoursLive(
    backlogTotal: number | null,
    processingRatePerHour: number | null,
): number | null {
    if (backlogTotal == null || processingRatePerHour == null || processingRatePerHour <= 0) {
        return null;
    }
    if (backlogTotal <= 0) return 0;
    return Number((backlogTotal / processingRatePerHour).toFixed(1));
}
