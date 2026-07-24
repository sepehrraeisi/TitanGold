/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  buildFunnelCounts,
  buildScanRunDto,
  mapRawCandidateToDto,
  validateSettingsInput,
  CANDIDATE_LIFECYCLE,
} from '../../services/arbitrageDomain.js';

describe('arbitrageCore domain contracts', () => {
  it('buildFunnelCounts uses explicit stage definitions', () => {
    const funnel = buildFunnelCounts({
      symbolsRequested: ['BTCUSDT', 'ETHUSDT'],
      symbolsEvaluated: ['BTCUSDT', 'ETHUSDT'],
      rawObservations: 2,
      analyticalCandidates: 1,
      rejected: 1,
      qualified: 0,
      expired: 0,
      blocked: 0,
    });

    expect(funnel).toEqual({
      symbolsRequested: 2,
      symbolsEvaluated: 2,
      rawObservations: 2,
      analyticalCandidates: 1,
      rejected: 1,
      qualified: 0,
      expired: 0,
      blocked: 0,
    });
  });

  it('buildScanRunDto embeds canonical funnel counts', () => {
    const scanRun = buildScanRunDto({
      runId: 'run-1',
      agentId: 'agent-1',
      trigger: 'manual',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 1200,
      symbolsRequested: ['BTCUSDT'],
      symbolsEvaluated: ['BTCUSDT'],
      rawOutput: {
        candidates: [{ symbol: 'BTCUSDT' }],
        rejectedCandidates: [{ symbol: 'ETHUSDT', rejectionReason: 'BELOW_MIN_PROFIT' }],
        qualifiedOpportunities: [],
      },
    });

    expect(scanRun.funnel.analyticalCandidates).toBe(1);
    expect(scanRun.funnel.rejected).toBe(1);
    expect(scanRun.spreadCandidates).toBe(1);
    expect(scanRun.rejectedCandidates).toBe(1);
  });

  it('mapRawCandidateToDto maps lifecycle and spread fields', () => {
    const dto = mapRawCandidateToDto(
      {
        id: 'c1',
        symbol: 'BTCUSDT',
        bidPrice: 100,
        askPrice: 100.5,
        spreadPct: 0.5,
        feeBps: 10,
        slippageBps: 10,
        classification: 'rejected_candidate',
        rejectionReason: 'BELOW_MIN_PROFIT',
      },
      { runId: 'run-1' },
    );

    expect(dto.symbol).toBe('BTCUSDT');
    expect(dto.runId).toBe('run-1');
    expect(dto.lifecycleState).toBe(CANDIDATE_LIFECYCLE.REJECTED);
    expect(dto.rejectionReasons).toContain('BELOW_MIN_PROFIT');
    expect(dto.grossSpreadBps).toBe(50);
  });

  it('validateSettingsInput requires monitored symbols', () => {
    const result = validateSettingsInput({});
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('monitored symbol'))).toBe(true);
  });
});
