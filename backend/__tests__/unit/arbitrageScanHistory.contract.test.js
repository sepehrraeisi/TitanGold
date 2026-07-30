/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  buildHistorySummary,
  buildScanRunDto,
  compareScanRuns,
  validateHistoryQuery,
  SCAN_RUN_STATUS,
} from '../../services/arbitrageDomain.js';

describe('arbitrage scan history contract helpers', () => {
  it('buildScanRunDto exposes canonical ScanRun fields', () => {
    const dto = buildScanRunDto({
      runId: 'run-1',
      agentId: 'agent-1',
      trigger: 'manual',
      startedAt: new Date('2026-07-24T10:00:00.000Z'),
      completedAt: new Date('2026-07-24T10:00:05.000Z'),
      durationMs: 5000,
      status: SCAN_RUN_STATUS.COMPLETED,
      symbolsRequested: ['BTCUSDT'],
      symbolsEvaluated: ['BTCUSDT'],
      rawOutput: {
        candidates: [{ symbol: 'BTCUSDT' }],
        rejectedCandidates: [{ symbol: 'ETHUSDT', rejectionReason: 'NON_POSITIVE_NET' }],
      },
    });

    expect(dto.runId).toBe('run-1');
    expect(dto.trigger).toBe('manual');
    expect(dto.dataContractVersion).toBeTruthy();
    expect(dto.evaluatedSymbols).toBe(1);
    expect(dto.rejectedCount).toBe(1);
    expect(dto.primaryRejectionReasons).toContain('NON_POSITIVE_NET');
    expect(dto.sideEffectsSuppressed).toBe(true);
    expect(dto.executionSupported).toBe(false);
  });

  it('buildHistorySummary preserves historical summary shape', () => {
    const summary = buildHistorySummary({
      totalScanRuns: 12,
      successfulRuns: 10,
      failedRuns: 2,
      manualRuns: 3,
      scheduledRuns: 9,
      latestSuccessfulRunAt: '2026-07-24T10:00:00.000Z',
    });
    expect(summary.totalScanRuns).toBe(12);
    expect(summary.successfulRuns).toBe(10);
    expect(summary.manualRuns).toBe(3);
    expect(summary.latestSuccessfulRunAt).toBe('2026-07-24T10:00:00.000Z');
  });

  it('validateHistoryQuery bounds pagination and allowlists sort', () => {
    const validated = validateHistoryQuery({
      page: 0,
      pageSize: 500,
      trigger: 'manual',
      status: 'completed',
      sort: 'startedAt:desc',
      search: 'abc12345',
    });
    expect(validated.page).toBe(1);
    expect(validated.pageSize).toBeLessThanOrEqual(100);
    expect(validated.trigger).toBe('manual');
    expect(validated.status).toBe('completed');
    expect(validated.sort).toBe('startedAt:desc');
    expect(validated.search).toBe('abc12345');
  });

  it('validateHistoryQuery rejects invalid trigger and status', () => {
    const validated = validateHistoryQuery({
      trigger: 'live',
      status: 'executed',
      sort: 'invalid',
    });
    expect(validated.trigger).toBeNull();
    expect(validated.status).toBeNull();
    expect(validated.sort).toBe('startedAt:desc');
  });

  it('compareScanRuns returns unavailable duration when not measured', () => {
    const current = buildScanRunDto({
      runId: 'r2',
      agentId: 'a1',
      symbolsRequested: ['A', 'B', 'C', 'D', 'E'],
      symbolsEvaluated: ['A', 'B', 'C', 'D', 'E'],
      rawOutput: { candidates: [{}, {}], rejectedCandidates: [{}] },
    });
    const previous = buildScanRunDto({
      runId: 'r1',
      agentId: 'a1',
      symbolsRequested: ['A', 'B', 'C', 'D'],
      symbolsEvaluated: ['A', 'B', 'C', 'D'],
      rawOutput: { candidates: [{}], rejectedCandidates: [{}, {}] },
      durationMs: 1000,
    });

    const comparison = compareScanRuns(current, previous);
    expect(comparison.hasPrevious).toBe(true);
    expect(comparison.deltas.evaluatedSymbols).toBe(1);
    expect(comparison.deltas.durationMs).toBeNull();
  });

  it('compareScanRuns handles missing previous run', () => {
    const comparison = compareScanRuns({ trigger: 'manual' }, null);
    expect(comparison.hasPrevious).toBe(false);
    expect(comparison.deltas).toEqual({});
  });
});
