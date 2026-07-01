import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import TelegramTransferHealth from '../../components/ai/AIManager/tabs/DataHub/TelegramTransferHealth';
import {
    buildPartialWarningMessage,
    computeTelegramTransferHealth,
    formatDrainRatio,
    formatMetricValue,
    hasTelegramTransferCoreMetrics,
} from '../../components/ai/AIManager/tabs/DataHub/telegramTransferHealthFormat';
import type { DataPipelineSnapshot } from '../../types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

const LOCALE_FILES = {
    blueEn: join(ROOT, 'deploy/blue/locales/en.json'),
    blueFa: join(ROOT, 'deploy/blue/locales/fa.json'),
    greenEn: join(ROOT, 'deploy/green/locales/en.json'),
    greenFa: join(ROOT, 'deploy/green/locales/fa.json'),
} as const;

const REQUIRED_KEYS = [
    'telegram_transfer_health_title',
    'telegram_transfer_health_question',
    'telegram_transfer_health_status_healthy',
    'telegram_transfer_health_status_warning',
    'telegram_transfer_health_status_critical',
    'telegram_transfer_health_incoming_24h',
    'telegram_transfer_health_transferred_24h',
    'telegram_transfer_health_processed_24h',
    'telegram_transfer_health_backlog',
    'telegram_transfer_health_drain_ratio',
    'telegram_transfer_health_load_error',
    'telegram_transfer_health_partial',
    'telegram_transfer_health_partial_list',
    'telegram_transfer_health_loading',
    'telegram_transfer_health_not_loaded',
    'telegram_transfer_health_unavailable',
    'telegram_transfer_health_drain_unavailable_hint',
    'telegram_transfer_health_metric_incoming24h',
    'telegram_transfer_health_metric_transferred24h',
    'telegram_transfer_health_metric_drain_ratio',
    'pipeline_backlog_loading',
];

function loadJson(path: string): Record<string, string> {
    return JSON.parse(readFileSync(path, 'utf8'));
}

const enLocale = loadJson(LOCALE_FILES.blueEn);

function makeT(locale: Record<string, string>) {
    return (key: string) => locale[key] ?? key;
}

const healthySnapshot: DataPipelineSnapshot = {
    lastRefreshed: new Date().toISOString(),
    totalRequests24h: 100,
    passed24h: 90,
    failed24h: 10,
    pending24h: 0,
    totalRecords: 1000,
    normalizedPercent: 99,
    telegramIngestMetrics: { incoming24h: 1000, transferredToCollectedData24h: 980 },
    transferThroughput: {
        processed24h: 1200,
        messagesPerHour: 50,
        messagesPerDay: 1200,
        observedWindowHours: 24,
    },
    globalTelegramBacklog: { unprocessedTotal: 0 },
    sources: [],
    categories: [],
};

describe('Telegram Transfer Health', () => {
    const locales = Object.fromEntries(
        Object.entries(LOCALE_FILES).map(([name, path]) => [name, loadJson(path)]),
    ) as Record<keyof typeof LOCALE_FILES, Record<string, string>>;

    for (const [localeName, locale] of Object.entries(locales)) {
        it(`${localeName} defines transfer health i18n keys`, () => {
            for (const key of REQUIRED_KEYS) {
                expect(locale[key], `${localeName} missing ${key}`).toBeDefined();
                expect(locale[key], `${localeName} raw key ${key}`).not.toBe(key);
            }
        });
    }

    it('computeTelegramTransferHealth derives drain ratio and healthy status when caught up', () => {
        const derived = computeTelegramTransferHealth({
            ingestMetrics: healthySnapshot.telegramIngestMetrics,
            transferThroughput: healthySnapshot.transferThroughput,
            globalTelegramBacklog: healthySnapshot.globalTelegramBacklog,
        });
        expect(derived.drainRatio).toBe(1.2);
        expect(derived.status).toBe('healthy');
        expect(formatDrainRatio(derived.drainRatio, false, makeT(enLocale)).text).toBe('120%');
    });

    it('computeTelegramTransferHealth marks critical when drain ratio is low', () => {
        const derived = computeTelegramTransferHealth({
            ingestMetrics: { incoming24h: 1000, transferredToCollectedData24h: 100 },
            transferThroughput: {
                processed24h: 400,
                messagesPerHour: 16,
                messagesPerDay: 400,
                observedWindowHours: 24,
            },
            globalTelegramBacklog: {
                unprocessedTotal: 50000,
                oldestUnprocessed: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
            },
        });
        expect(derived.status).toBe('critical');
    });

    it('formatMetricValue does not render unavailable metrics as zero', () => {
        const t = makeT(enLocale);
        const unavailable = formatMetricValue(null, true, t);
        expect(unavailable.text).toBe(enLocale.telegram_transfer_health_unavailable);
        expect(unavailable.state).toBe('unavailable');
        expect(unavailable.text).not.toBe('0');

        const realZero = formatMetricValue(0, false, t);
        expect(realZero.text).toBe('0');
        expect(realZero.state).toBe('zero');
    });

    it('formatDrainRatio shows unavailable instead of raw dash', () => {
        const t = makeT(enLocale);
        const display = formatDrainRatio(null, true, t);
        expect(display.text).toBe(enLocale.telegram_transfer_health_unavailable);
        expect(display.text).not.toBe('—');
        expect(display.text).not.toBe('-');
    });

    it('buildPartialWarningMessage lists missing metrics by name', () => {
        const t = makeT(enLocale);
        const message = buildPartialWarningMessage(t, ['incoming24h', 'transferred24h', 'drainRatio']);
        expect(message).toContain(enLocale.telegram_transfer_health_metric_incoming24h);
        expect(message).toContain(enLocale.telegram_transfer_health_metric_transferred24h);
        expect(message).toContain(enLocale.telegram_transfer_health_metric_drain_ratio);
        expect(message).toMatch(/Some metrics are unavailable:/);
    });

    it('renders operational dashboard with status pill and metrics', () => {
        const t = makeT(enLocale);
        render(
            React.createElement(TelegramTransferHealth, {
                t,
                snapshot: healthySnapshot,
                isLoading: false,
                isPipelineLoaded: true,
                formatTimeAgo: () => '2d ago',
            }),
        );

        expect(screen.getByText(enLocale.telegram_transfer_health_title)).toBeTruthy();
        expect(screen.getByText(enLocale.telegram_transfer_health_question)).toBeTruthy();
        expect(screen.getByText(enLocale.telegram_transfer_health_status_healthy)).toBeTruthy();
        expect(screen.getByText('1,000')).toBeTruthy();
        expect(screen.getByText('120%')).toBeTruthy();
    });

    it('renders partial metrics with named warning when ingest metrics unavailable', () => {
        const partialSnapshot: DataPipelineSnapshot = {
            ...healthySnapshot,
            telegramIngestMetrics: { incoming24h: null, transferredToCollectedData24h: null },
            globalTelegramBacklog: { unprocessedTotal: 720000 },
        };
        expect(hasTelegramTransferCoreMetrics(partialSnapshot)).toBe(true);
        const t = makeT(enLocale);
        render(
            React.createElement(TelegramTransferHealth, {
                t,
                snapshot: partialSnapshot,
                isLoading: false,
                isPipelineLoaded: true,
                partial: true,
                unavailableMetrics: ['incoming24h', 'transferred24h', 'drainRatio'],
                error: 'Failed to fetch pipeline backlog enrichment',
                formatTimeAgo: () => '2d ago',
            }),
        );
        expect(
            screen.getByText(
                enLocale.telegram_transfer_health_partial_list.replace(
                    '{{metrics}}',
                    [
                        enLocale.telegram_transfer_health_metric_incoming24h,
                        enLocale.telegram_transfer_health_metric_transferred24h,
                        enLocale.telegram_transfer_health_metric_drain_ratio,
                    ].join(', '),
                ),
            ),
        ).toBeTruthy();
        expect(screen.getAllByText(enLocale.telegram_transfer_health_unavailable).length).toBeGreaterThan(0);
        expect(screen.queryByText('0')).toBeNull();
        expect(screen.queryByText(enLocale.telegram_transfer_health_load_error)).toBeNull();
        expect(screen.queryByText('pipeline_backlog_loading')).toBeNull();
    });

    it('shows fatal error only when no core metrics are available', () => {
        const t = makeT(enLocale);
        render(
            React.createElement(TelegramTransferHealth, {
                t,
                snapshot: undefined,
                isLoading: false,
                isPipelineLoaded: true,
                error: 'network',
                formatTimeAgo: () => '2d ago',
            }),
        );
        expect(screen.getByText(enLocale.telegram_transfer_health_load_error)).toBeTruthy();
    });

    it('TelegramTransferHealth component has no raw English metric label literals', () => {
        const src = readFileSync(
            join(ROOT, 'components/ai/AIManager/tabs/DataHub/TelegramTransferHealth.tsx'),
            'utf8',
        );
        expect(src).not.toMatch(/label=\{['"]Incoming messages/);
        expect(src).not.toMatch(/label=\{['"]Processed messages/);
        expect(src).not.toMatch(/label=\{['"]Drain ratio/);
        expect(src).toContain("safeT(t, 'telegram_transfer_health_incoming_24h')");
    });

    it('PipelinePanel uses safeT for pipeline_backlog_loading', () => {
        const src = readFileSync(
            join(ROOT, 'components/ai/AIManager/tabs/DataHub/PipelinePanel.tsx'),
            'utf8',
        );
        expect(src).toContain("safeT(t, 'pipeline_backlog_loading')");
        expect(src).not.toContain("{t('pipeline_backlog_loading')}");
    });

    it('PipelinePanel passes unavailableMetrics to TelegramTransferHealth', () => {
        const src = readFileSync(
            join(ROOT, 'components/ai/AIManager/tabs/DataHub/PipelinePanel.tsx'),
            'utf8',
        );
        expect(src).toContain('unavailableMetrics={pipelineBacklogUnavailableMetrics}');
    });

    it('PipelinePanel uses TelegramTransferHealth instead of category screening', () => {
        const src = readFileSync(
            join(ROOT, 'components/ai/AIManager/tabs/DataHub/PipelinePanel.tsx'),
            'utf8',
        );
        expect(src).toContain('TelegramTransferHealth');
        expect(src).not.toContain('category_screening');
        expect(src).not.toContain('onLoadCategoryScreening');
    });

    it('dataPipelineApi no longer exposes category screening fetch', () => {
        const src = readFileSync(join(ROOT, 'services/dataPipelineApi.ts'), 'utf8');
        expect(src).not.toContain('fetchDataPipelineCategoryScreening');
        expect(src).toContain('ingestMetrics');
    });
});
