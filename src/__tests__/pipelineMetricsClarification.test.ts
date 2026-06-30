import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PipelinePanel from '../../components/ai/AIManager/tabs/DataHub/PipelinePanel';
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
    'pipeline_metric_requests_hint',
    'pipeline_telegram_comparison_hint',
    'pipeline_category_screening_not_loaded',
];

function loadJson(path: string): Record<string, string> {
    return JSON.parse(readFileSync(path, 'utf8'));
}

const mockSnapshot: DataPipelineSnapshot = {
    lastRefreshed: new Date().toISOString(),
    totalRequests24h: 3806,
    passed24h: 3287,
    failed24h: 519,
    pending24h: 0,
    totalRecords: 149454,
    normalizedPercent: 99.8,
    sources: [
        {
            sourceId: 'src-1',
            name: 'Test RSS',
            category: 'news',
            lastDataType: 'rss',
            lastStatus: 'success',
            lastResponseTime: 120,
        },
    ],
    categories: [],
};

const enLocale = loadJson(LOCALE_FILES.blueEn);

function makeT(locale: Record<string, string>) {
    return (key: string) => locale[key] ?? key;
}

describe('Pipeline metrics UI clarification', () => {
    const locales = Object.fromEntries(
        Object.entries(LOCALE_FILES).map(([name, path]) => [name, loadJson(path)]),
    ) as Record<keyof typeof LOCALE_FILES, Record<string, string>>;

    for (const [localeName, locale] of Object.entries(locales)) {
        it(`${localeName} defines clarification keys without raw i18n keys`, () => {
            for (const key of REQUIRED_KEYS) {
                expect(locale[key], `${localeName} missing ${key}`).toBeDefined();
                expect(locale[key], `${localeName} raw key ${key}`).not.toBe(key);
                expect(locale[key].length, `${localeName} empty ${key}`).toBeGreaterThan(0);
            }
        });
    }

    it('shows Requests (24h) helper text and Telegram comparison note', () => {
        const t = makeT(enLocale);
        render(
            React.createElement(PipelinePanel, {
                t,
                pipelineSnapshot: mockSnapshot,
                pipelineHistory: [],
                normalizationSummary: undefined,
                normalizedData: [],
                handleRefreshPipelineSnapshot: () => {},
                isLoadingPipeline: false,
                setPipelineError: () => {},
                formatTimeAgo: () => 'just now',
                selectedSnapshotId: 'latest',
                setSelectedSnapshotId: () => {},
            }),
        );

        expect(screen.getByText(enLocale.pipeline_metric_requests_hint)).toBeTruthy();
        expect(screen.getByText(enLocale.pipeline_telegram_comparison_hint)).toBeTruthy();
    });

    it('category screening empty state explains fast pipeline view and offers load action', () => {
        const t = makeT(enLocale);
        render(
            React.createElement(PipelinePanel, {
                t,
                pipelineSnapshot: mockSnapshot,
                pipelineHistory: [],
                normalizationSummary: undefined,
                normalizedData: [],
                handleRefreshPipelineSnapshot: () => {},
                isLoadingPipeline: false,
                setPipelineError: () => {},
                formatTimeAgo: () => 'just now',
                selectedSnapshotId: 'latest',
                setSelectedSnapshotId: () => {},
                onLoadCategoryScreening: () => {},
            }),
        );

        expect(screen.getByText(enLocale.pipeline_category_screening_not_loaded)).toBeTruthy();
        expect(screen.getByRole('button', { name: enLocale.pipeline_category_screening_load })).toBeTruthy();
        expect(screen.queryByText('No category samples yet.')).toBeNull();
        expect(screen.queryByText('pipeline_category_screening_not_loaded')).toBeNull();
    });

    it('PipelinePanel.tsx references clarification i18n keys', () => {
        const src = readFileSync(
            join(ROOT, 'components/ai/AIManager/tabs/DataHub/PipelinePanel.tsx'),
            'utf8',
        );
        for (const key of REQUIRED_KEYS) {
            expect(src).toContain(key);
        }
        expect(src).not.toContain('No category samples yet');
    });
});
