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
                totalScanRuns: 1753,
                latestRun: { runId: 'abc', status: 'completed', funnel: { rejected: 3 } },
                settings: { monitoringState: 'active', monitoredSymbols: ['BTCUSDT'] },
                product: { displayName: 'MEXC Spot Spread Monitor', agentKey: 'arbitrage' },
            },
        });
        expect(parsed.totalScanRuns).toBe(1753);
        expect(parsed.latestRun?.runId).toBe('abc');
        expect(parsed.settings.monitoringState).toBe('active');
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
