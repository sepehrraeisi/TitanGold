import { describe, expect, it } from 'vitest';
import {
    classifyBacklogSeverity,
    classifyResponseTimeSeverity,
    computeCatchUpHoursLive,
    formatBacklogTrendDisplay,
    responseTimeSeverityLabel,
} from '../../components/ai/AIManager/tabs/DataHub/pipelineOperationalMetrics';
import {
    computeTelegramTransferHealth,
    formatCatchUpHours,
} from '../../components/ai/AIManager/tabs/DataHub/telegramTransferHealthFormat';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const enLocale = JSON.parse(
    readFileSync(join(__dirname, '../../deploy/blue/locales/en.json'), 'utf8'),
);

function makeT(locale: Record<string, string>) {
    return (key: string) => locale[key] ?? key;
}

describe('pipelineOperationalMetrics', () => {
    const t = makeT(enLocale);

    it('classifies backlog severity thresholds', () => {
        expect(classifyBacklogSeverity(50_000)).toBe('normal');
        expect(classifyBacklogSeverity(100_000)).toBe('warning');
        expect(classifyBacklogSeverity(500_000)).toBe('warning');
        expect(classifyBacklogSeverity(500_001)).toBe('critical');
        expect(classifyBacklogSeverity(null)).toBeNull();
    });

    it('classifies response time severity', () => {
        expect(classifyResponseTimeSeverity(200)).toBe('healthy');
        expect(classifyResponseTimeSeverity(500)).toBe('warning');
        expect(classifyResponseTimeSeverity(2000)).toBe('warning');
        expect(classifyResponseTimeSeverity(2001)).toBe('critical');
    });

    it('catch-up is always derived live from backlog and rate', () => {
        expect(computeCatchUpHoursLive(720_000, 6000)).toBe(120);
        const derived = computeTelegramTransferHealth({
            globalTelegramBacklog: { unprocessedTotal: 720_000 },
            transferThroughput: {
                processed24h: 144_000,
                messagesPerHour: 6000,
                messagesPerDay: 144_000,
                observedWindowHours: 24,
            },
        });
        expect(derived.catchUpHours).toBe(computeCatchUpHoursLive(720_000, 6000));
        const display = formatCatchUpHours(derived.catchUpHours, false, t);
        expect(display.state).toBe('loaded');
    });

    it('catch-up updates when backlog or rate changes', () => {
        const base = computeCatchUpHoursLive(100_000, 5000);
        expect(base).toBe(20);
        expect(computeCatchUpHoursLive(200_000, 5000)).toBe(40);
        expect(computeCatchUpHoursLive(100_000, 10_000)).toBe(10);
    });

    it('formats backlog trend up/down/stable/unavailable', () => {
        expect(formatBacklogTrendDisplay(t, null).text).toBe(enLocale.pipeline_backlog_trend_unavailable);
        expect(
            formatBacklogTrendDisplay(t, {
                loaded: true,
                direction: 'up',
                percentChange: 12,
                display: 'up_12',
                previousBacklog: 600_000,
                source: 'flow_balance_estimate',
                unavailableReason: null,
            }).text,
        ).toBe('▲ +12%');
        expect(
            formatBacklogTrendDisplay(t, {
                loaded: true,
                direction: 'down',
                percentChange: 8,
                display: 'down_8',
                previousBacklog: 800_000,
                source: 'redis_history',
                unavailableReason: null,
            }).text,
        ).toBe('▼ -8%');
        expect(
            formatBacklogTrendDisplay(t, {
                loaded: true,
                direction: 'stable',
                percentChange: 0,
                display: 'stable',
                previousBacklog: 700_000,
                source: 'flow_balance_estimate',
                unavailableReason: null,
            }).text,
        ).toBe(enLocale.pipeline_backlog_trend_stable);
    });

    it('response severity labels are translated', () => {
        expect(responseTimeSeverityLabel(t, 'healthy')).toBe('Healthy');
        expect(responseTimeSeverityLabel(t, 'critical')).toBe('Critical');
    });
});

describe('refresh normalization isolation', () => {
    it('useDataHub retry uses fetchQuery with normalization key only', () => {
        const src = readFileSync(
            join(__dirname, '../../components/ai/AIManager/tabs/DataHub/hooks/useDataHub.ts'),
            'utf8',
        );
        expect(src).toContain('DATA_HUB_KEYS.pipelineNormalizationSummary()');
        expect(src).toContain('fetchPipelineNormalizationSummary');
        expect(src).not.toMatch(/handleRetryPipelineNormalization[\s\S]{0,120}refetchPipeline\(/);
        expect(src).not.toMatch(/handleRetryPipelineNormalization[\s\S]{0,120}refetchPipelineBacklog\(/);
    });
});
