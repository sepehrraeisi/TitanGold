import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PipelineNormalizationSummary from '../../components/ai/AIManager/tabs/DataHub/PipelineNormalizationSummary';
import PipelineCapacityPanel from '../../components/ai/AIManager/tabs/DataHub/PipelineCapacityPanel';
import {
    formatNormMetricValue,
    isNormalizationSummaryLoaded,
} from '../../components/ai/AIManager/tabs/DataHub/pipelineNormalizationFormat';
import type { PipelineCapacityResponse, PipelineNormalizationSummaryResponse } from '../../types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

const LOCALE_FILES = [
    join(ROOT, 'deploy/blue/locales/en.json'),
    join(ROOT, 'deploy/blue/locales/fa.json'),
    join(ROOT, 'deploy/green/locales/en.json'),
    join(ROOT, 'deploy/green/locales/fa.json'),
];

const REQUIRED_KEYS = [
    'pipeline_normalization_title',
    'pipeline_normalization_unavailable',
    'pipeline_normalization_processed_24h',
    'pipeline_capacity_title',
    'pipeline_capacity_config_only_banner',
    'pipeline_capacity_configuration_only',
    'pipeline_backlog_trend_title',
    'pipeline_capacity_scheduler_running',
];

function loadJson(path: string): Record<string, string> {
    return JSON.parse(readFileSync(path, 'utf8'));
}

const enLocale = loadJson(LOCALE_FILES[0]);

function makeT(locale: Record<string, string>) {
    return (key: string) => locale[key] ?? key;
}

const loadedSummary: PipelineNormalizationSummaryResponse = {
    windowHours: 24,
    totalProcessed: 152184,
    passed: 151906,
    warnings: 12,
    rejected: 278,
    passRate: 0.998,
    lastProcessedAt: new Date().toISOString(),
    meta: {
        loaded: true,
        cachedAt: new Date().toISOString(),
        queryMs: 120,
        partial: false,
        unavailableReason: null,
    },
};

const capacityView: PipelineCapacityResponse = {
    mode: 'config_only',
    modeLabel: 'configuration_only',
    schedulerStatus: 'running',
    transfer: {
        batchSize: 700,
        intervalMs: 300000,
        intervalMinutes: 5,
        runtimeAdjustable: false,
        source: 'constant',
    },
    normalization: {
        batchSize: 150,
        intervalMs: 60000,
        intervalMinutes: 1,
        runtimeAdjustable: 'partial',
        source: 'default',
    },
    lastNormalizationRun: null,
    lastNormalizationStats: null,
    meta: {
        loaded: true,
        readOnly: true,
        writeControlsAvailable: false,
        notes: ['runtime_mode_presets_planned'],
    },
};

describe('Pipeline normalization and capacity panels', () => {
    for (const path of LOCALE_FILES) {
        it(`${path.split('/').slice(-2).join('/')} defines required i18n keys`, () => {
            const locale = loadJson(path);
            for (const key of REQUIRED_KEYS) {
                expect(locale[key], `missing ${key}`).toBeDefined();
                expect(locale[key]).not.toBe(key);
            }
        });
    }

    it('formatNormMetricValue does not render unavailable as zero', () => {
        const t = makeT(enLocale);
        const display = formatNormMetricValue(null, false, t);
        expect(display.text).toBe(enLocale.pipeline_normalization_unavailable);
        expect(display.text).not.toBe('0');
    });

    it('Normalization Summary does not render fake zeros before load', () => {
        const t = makeT(enLocale);
        render(
            React.createElement(PipelineNormalizationSummary, {
                t,
                summary: undefined,
                isLoading: false,
                formatTimeAgo: () => '2d ago',
            }),
        );
        expect(screen.getByText(enLocale.pipeline_normalization_not_loaded)).toBeTruthy();
        expect(screen.queryByText('0')).toBeNull();
    });

    it('loaded normalization summary renders real numbers', () => {
        const t = makeT(enLocale);
        expect(isNormalizationSummaryLoaded(loadedSummary)).toBe(true);
        render(
            React.createElement(PipelineNormalizationSummary, {
                t,
                summary: loadedSummary,
                isLoading: false,
                formatTimeAgo: () => '2d ago',
            }),
        );
        expect(screen.getByText('152,184')).toBeTruthy();
        expect(screen.getByText('99.8%')).toBeTruthy();
    });

    it('loaded normalization summary emphasizes pass rate', () => {
        const t = makeT(enLocale);
        const { container } = render(
            React.createElement(PipelineNormalizationSummary, {
                t,
                summary: loadedSummary,
                isLoading: false,
                formatTimeAgo: () => '2d ago',
            }),
        );
        expect(container.querySelector('.text-lg.font-bold')).toBeTruthy();
    });

    it('partial warnings show tooltip attribute on value', () => {
        const t = makeT(enLocale);
        const { container } = render(
            React.createElement(PipelineNormalizationSummary, {
                t,
                summary: {
                    ...loadedSummary,
                    warnings: null,
                    meta: { ...loadedSummary.meta, partial: true },
                },
                isLoading: false,
                formatTimeAgo: () => '2d ago',
            }),
        );
        const tooltipEl = container.querySelector('[title*="Warning aggregation"]');
        expect(tooltipEl).toBeTruthy();
    });

    it('unavailable normalization summary shows Temporarily unavailable', () => {
        const t = makeT(enLocale);
        render(
            React.createElement(PipelineNormalizationSummary, {
                t,
                summary: {
                    windowHours: 24,
                    totalProcessed: null,
                    passed: null,
                    warnings: null,
                    rejected: null,
                    passRate: null,
                    lastProcessedAt: null,
                    meta: {
                        loaded: false,
                        cachedAt: null,
                        queryMs: null,
                        partial: true,
                        unavailableReason: 'query_timeout',
                    },
                },
                isLoading: false,
                formatTimeAgo: () => '2d ago',
            }),
        );
        expect(screen.getAllByText(enLocale.pipeline_normalization_unavailable).length).toBeGreaterThan(0);
        expect(screen.queryByText('0')).toBeNull();
    });

    it('Pipeline Capacity panel shows config-only banner and no fake buttons', () => {
        const t = makeT(enLocale);
        const { container } = render(
            React.createElement(PipelineCapacityPanel, {
                t,
                capacity: capacityView,
                isLoading: false,
                snapshot: undefined,
            }),
        );
        expect(screen.getByText(enLocale.pipeline_capacity_config_only_banner)).toBeTruthy();
        expect(screen.getByText(enLocale.pipeline_capacity_configuration_only)).toBeTruthy();
        expect(screen.queryByText(/Balanced/i)).toBeNull();
        expect(container.querySelector('button[type="submit"]')).toBeNull();
        expect(screen.queryByText('High Throughput')).toBeNull();
        expect(screen.queryByText('Recovery Mode')).toBeNull();
    });

    it('PipelinePanel wires lazy normalization and capacity components', () => {
        const src = readFileSync(
            join(ROOT, 'components/ai/AIManager/tabs/DataHub/PipelinePanel.tsx'),
            'utf8',
        );
        expect(src).toContain('PipelineNormalizationSummary');
        expect(src).toContain('PipelineCapacityPanel');
        expect(src).not.toContain("value={normalizationSummary.totalProcessed}");
    });

    it('dataPipelineApi exposes lazy normalization and capacity fetchers', () => {
        const src = readFileSync(join(ROOT, 'services/dataPipelineApi.ts'), 'utf8');
        expect(src).toContain('fetchPipelineNormalizationSummary');
        expect(src).toContain('fetchPipelineCapacity');
        expect(src).not.toContain('includeNormalizationSummary');
    });
});
