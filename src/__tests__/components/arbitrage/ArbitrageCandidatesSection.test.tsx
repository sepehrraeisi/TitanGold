import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArbitrageCandidatesSection } from '../../../../components/ai/arbitrage/ArbitrageCandidatesSection.tsx';
import type { ArbitrageCoreCandidatesResponse } from '../../../../services/api.ts';
import { DEFAULT_CANDIDATE_FILTERS } from '../../../../components/ai/arbitrage/ArbitrageCandidatesSection.tsx';
import en from '../../../../deploy/blue/locales/en.json';

const t = (key: string) => (en as Record<string, string>)[key] || key;

const sampleData: ArbitrageCoreCandidatesResponse = {
    runId: 'run-1',
    items: [
        {
            candidateId: 'c1',
            runId: 'run-1',
            lifecycleState: 'rejected',
            symbol: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
            bid: 100,
            ask: 100.5,
            sourceTimestamp: '2026-07-29T10:00:00.000Z',
            observedAt: '2026-07-29T10:00:00.000Z',
            ageMs: 1000,
            grossSpreadBps: 50,
            assumedFeesBps: 10,
            estimatedSlippageBps: 10,
            netSpreadBps: 30,
            estimatedNotional: 100000,
            estimatedProfit: null,
            liquidityState: 'ok',
            freshnessState: 'fresh',
            riskScore: 20,
            rejectionReasons: ['NON_POSITIVE_NET'],
            mode: 'single_venue_spread_monitoring',
            source: 'mexc_public',
        },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
    hasNext: false,
    hasPrevious: false,
    selectedRun: {
        runId: 'run-1',
        startedAt: '2026-07-29T10:00:00.000Z',
        completedAt: '2026-07-29T10:00:01.000Z',
        status: 'completed',
        trigger: 'manual',
        funnel: {
            observed: 0,
            analyticalCandidates: 0,
            rejected: 1,
            qualified: 0,
            expired: 0,
            blocked: 0,
        },
    },
    funnel: {
        observed: 0,
        analyticalCandidates: 0,
        rejected: 1,
        qualified: 0,
        expired: 0,
        blocked: 0,
    },
    availableFilters: {
        lifecycles: ['rejected'],
        symbols: ['BTCUSDT'],
        rejectionReasons: ['NON_POSITIVE_NET'],
        freshnessStates: ['fresh'],
    },
    generatedAt: '2026-07-29T10:00:02.000Z',
    spreadCandidates: [],
    rejectedCandidates: [],
    qualifiedCandidates: [],
};

describe('ArbitrageCandidatesSection', () => {
    it('renders summary strip and candidate row without raw rejection codes', () => {
        render(
            <ArbitrageCandidatesSection
                data={sampleData}
                recentRuns={[sampleData.selectedRun!]}
                selectedRunId="run-1"
                loading={false}
                error={null}
                filters={DEFAULT_CANDIDATE_FILTERS}
                onFiltersChange={vi.fn()}
                onRunChange={vi.fn()}
                onRefresh={vi.fn()}
                onOpenDetail={vi.fn()}
                t={t}
            />,
        );

        expect(screen.getByTestId('arb-candidates-section')).toBeTruthy();
        expect(screen.getByTestId('arb-candidates-summary')).toBeTruthy();
        expect(screen.getByTestId('arb-candidate-row-c1')).toBeTruthy();
        expect(screen.queryByText('NON_POSITIVE_NET')).toBeNull();
        expect(screen.queryByText('arb_funnel_observed')).toBeNull();
        expect(screen.getByText('Analytical candidates')).toBeTruthy();
        expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);
    });

    it('delegates detail open to workspace owner', () => {
        const onOpenDetail = vi.fn();
        render(
            <ArbitrageCandidatesSection
                data={sampleData}
                recentRuns={[sampleData.selectedRun!]}
                selectedRunId="run-1"
                loading={false}
                error={null}
                filters={DEFAULT_CANDIDATE_FILTERS}
                onFiltersChange={vi.fn()}
                onRunChange={vi.fn()}
                onRefresh={vi.fn()}
                onOpenDetail={onOpenDetail}
                t={t}
            />,
        );

        fireEvent.click(screen.getByTestId('arb-candidate-row-c1'));
        expect(onOpenDetail).toHaveBeenCalledWith(sampleData.items[0]);
        expect(screen.queryByTestId('arb-candidate-detail-panel')).toBeNull();
    });
});
