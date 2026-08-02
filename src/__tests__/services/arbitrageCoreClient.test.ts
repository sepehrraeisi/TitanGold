import { describe, expect, it } from 'vitest';
import {
    parseArbitrageCandidatesEnvelope,
    parseArbitrageOverviewEnvelope,
    parseArbitrageRunsEnvelope,
} from '../../../services/arbitrageCoreClient.ts';

describe('arbitrageCoreClient contract parsing', () => {
    it('unwraps overview envelope with nested overview object', () => {
        const parsed = parseArbitrageOverviewEnvelope({
            ok: true,
            overview: {
                generatedAt: '2026-07-24T10:01:00.000Z',
                totalScanRuns: 1753,
                historicalSummary: {
                    totalScanRuns: 1753,
                    successfulRuns: 1740,
                    failedRuns: 13,
                    scheduledRuns: 1700,
                    manualRuns: 53,
                    latestSuccessfulRunAt: '2026-07-24T10:00:05.000Z',
                    latestFailedRunAt: null,
                },
                latestRun: {
                    latestRunId: 'abc',
                    latestRunStatus: 'completed',
                    trigger: 'scheduled',
                    funnel: { rejected: 3, analyticalCandidates: 1, qualified: 0 },
                    rejectionSummary: { NON_POSITIVE_NET: 3 },
                },
                interpretation: {
                    primaryMessage: 'Three observations were rejected.',
                    safeReasonCodes: ['NON_POSITIVE_NET'],
                    rejectionSummary: { NON_POSITIVE_NET: 3 },
                },
                settings: { monitoringState: 'active', monitoredSymbols: ['BTCUSDT'] },
                product: { displayName: 'MEXC Spot Spread Monitor', agentKey: 'arbitrage' },
            },
        });
        expect(parsed.totalScanRuns).toBe(1753);
        expect(parsed.latestRun?.runId).toBe('abc');
        expect(parsed.historicalSummary?.totalScanRuns).toBe(1753);
        expect(parsed.settings.monitoringState).toBe('active');
        expect(parsed.generatedAt).toBe('2026-07-24T10:01:00.000Z');
    });

    it('unwraps runs envelope with summary and available filters', () => {
        const parsed = parseArbitrageRunsEnvelope(
            {
                ok: true,
                runs: [{ runId: 'r1', status: 'completed', rejectedCount: 2 }],
                summary: {
                    totalScanRuns: 10,
                    successfulRuns: 8,
                    failedRuns: 2,
                    manualRuns: 1,
                    scheduledRuns: 9,
                    latestSuccessfulRunAt: '2026-07-24T10:00:00.000Z',
                },
                availableFilters: { triggers: ['manual'], statuses: ['completed'] },
                generatedAt: '2026-07-24T10:01:00.000Z',
                pagination: { page: 1, pageSize: 20, total: 10, totalPages: 1 },
            },
            1,
            20,
        );
        expect(parsed.summary?.totalScanRuns).toBe(10);
        expect(parsed.availableFilters?.triggers).toEqual(['manual']);
        expect(parsed.generatedAt).toBe('2026-07-24T10:01:00.000Z');
        expect(parsed.items[0].rejectedCount).toBe(2);
    });

    it('unwraps runs envelope and defaults missing pagination fields', () => {
        const parsed = parseArbitrageRunsEnvelope(
            {
                ok: true,
                runs: [{ runId: 'r1', status: 'completed' }],
                pagination: { page: 1, pageSize: 10, total: 1753, totalPages: 176 },
            },
            1,
            10,
        );
        expect(parsed.items).toHaveLength(1);
        expect(parsed.pagination.total).toBe(1753);
        expect(parsed.pagination.hasNext).toBe(true);
        expect(parsed.pagination.hasPrevious).toBe(false);
    });

    it('renders history safely when optional arrays are missing', () => {
        const parsed = parseArbitrageRunsEnvelope({ ok: true, runs: [{ runId: 'legacy' }] }, 1, 10);
        expect(Array.isArray(parsed.items)).toBe(true);
        expect(parsed.items[0].symbolsRequested ?? []).toEqual([]);
    });

    it('groups flat candidate items by lifecycle', () => {
        const parsed = parseArbitrageCandidatesEnvelope({
            ok: true,
            candidates: [
                { candidateId: 'c1', symbol: 'BTCUSDT', lifecycleState: 'candidate' },
                { candidateId: 'r1', symbol: 'ETHUSDT', lifecycleState: 'rejected', rejectionReasons: ['STALE_QUOTE'] },
            ],
        });
        expect(parsed.spreadCandidates).toHaveLength(1);
        expect(parsed.rejectedCandidates).toHaveLength(1);
    });
});
