import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const SCREENING_KEYS = [
    'pipeline_category_screening_load',
    'pipeline_category_screening_loading',
    'pipeline_category_screening_slow_hint',
    'pipeline_category_screening_load_error',
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

function renderPanel(overrides: Partial<React.ComponentProps<typeof PipelinePanel>> = {}) {
    const t = makeT(enLocale);
    const props: React.ComponentProps<typeof PipelinePanel> = {
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
        onLoadCategoryScreening: vi.fn(),
        ...overrides,
    };
    return render(React.createElement(PipelinePanel, props));
}

describe('Pipeline category screening on-demand load', () => {
    const locales = Object.fromEntries(
        Object.entries(LOCALE_FILES).map(([name, path]) => [name, loadJson(path)]),
    ) as Record<keyof typeof LOCALE_FILES, Record<string, string>>;

    for (const [localeName, locale] of Object.entries(locales)) {
        it(`${localeName} defines screening action keys without raw i18n keys`, () => {
            for (const key of SCREENING_KEYS) {
                expect(locale[key], `${localeName} missing ${key}`).toBeDefined();
                expect(locale[key], `${localeName} raw key ${key}`).not.toBe(key);
            }
        });
    }

    it('shows Load detailed screening button with honest empty-state copy', () => {
        renderPanel();
        expect(screen.getByText(enLocale.pipeline_category_screening_not_loaded)).toBeTruthy();
        expect(screen.getByRole('button', { name: enLocale.pipeline_category_screening_load })).toBeTruthy();
        expect(screen.queryByText('pipeline_category_screening_load')).toBeNull();
    });

    it('invokes onLoadCategoryScreening when the button is clicked', () => {
        const onLoadCategoryScreening = vi.fn();
        renderPanel({ onLoadCategoryScreening });
        fireEvent.click(screen.getByRole('button', { name: enLocale.pipeline_category_screening_load }));
        expect(onLoadCategoryScreening).toHaveBeenCalledTimes(1);
    });

    it('shows loading help text while detailed screening is loading', () => {
        renderPanel({ isLoadingCategoryScreening: true });
        expect(screen.getByText(enLocale.pipeline_category_screening_loading)).toBeTruthy();
        expect(screen.getByText(enLocale.pipeline_category_screening_slow_hint)).toBeTruthy();
    });

    it('renders category rows after detailed screening loads', () => {
        renderPanel({
            categoryScreeningLoaded: true,
            categoryScreeningCategories: [
                { categoryId: 'signals', name: 'signals', inflow: 149414, passRate: 99.7 },
                { categoryId: 'news', name: 'news', inflow: 41, passRate: 100 },
            ],
        });
        expect(screen.getByRole('columnheader', { name: enLocale.category_inflow })).toBeTruthy();
        expect(screen.getByText('signals')).toBeTruthy();
        expect(screen.getByText('149414')).toBeTruthy();
    });

    it('shows retry when detailed screening fails', async () => {
        const onLoadCategoryScreening = vi.fn();
        renderPanel({
            categoryScreeningError: 'Gateway timeout',
            onLoadCategoryScreening,
        });
        expect(screen.getByText(enLocale.pipeline_category_screening_load_error)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: enLocale.retry }));
        await waitFor(() => expect(onLoadCategoryScreening).toHaveBeenCalled());
    });

    it('dataPipelineApi exposes category screening fetch with includeCategoryScreening flag', () => {
        const src = readFileSync(join(ROOT, 'services/dataPipelineApi.ts'), 'utf8');
        expect(src).toContain('fetchDataPipelineCategoryScreening');
        expect(src).toContain("includeCategoryScreening: 'true'");
        expect(src).toContain("includeBacklog: 'false'");
    });
});

describe('fetchDataPipelineCategoryScreening API', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        Object.defineProperty(global, 'localStorage', {
            value: { getItem: () => 'token', setItem: () => undefined },
            configurable: true,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('requests pipeline with includeCategoryScreening=true', async () => {
        const fetchMock = vi.mocked(global.fetch);
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                snapshot: {
                    categories: [{ categoryId: 'signals', name: 'signals', inflow: 1, passRate: 100 }],
                },
            }),
        } as Response);

        const { fetchDataPipelineCategoryScreening } = await import('../../services/dataPipelineApi');
        const result = await fetchDataPipelineCategoryScreening();

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('includeCategoryScreening=true'),
            expect.any(Object),
        );
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('includeBacklog=false'),
            expect.any(Object),
        );
        expect(result.categories).toHaveLength(1);
        expect(result.categories[0].name).toBe('signals');
    });
});
