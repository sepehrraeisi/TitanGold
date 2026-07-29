/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  buildCandidateAvailableFilters,
  buildCandidateFunnelFromItems,
  CANDIDATE_LIFECYCLE,
  mapRawCandidateToDto,
  normalizeCandidateLifecycle,
} from '../../services/arbitrageDomain.js';

describe('arbitrage candidates contract helpers', () => {
  it('normalizeCandidateLifecycle maps producer detected to candidate', () => {
    expect(normalizeCandidateLifecycle({ lifecycle: 'detected' })).toBe(CANDIDATE_LIFECYCLE.CANDIDATE);
    expect(normalizeCandidateLifecycle({ classification: 'rejected_candidate' })).toBe(
      CANDIDATE_LIFECYCLE.REJECTED,
    );
  });

  it('mapRawCandidateToDto includes source and canonical lifecycle', () => {
    const dto = mapRawCandidateToDto(
      {
        id: 'c1',
        symbol: 'BTCUSDT',
        lifecycle: 'detected',
        source: 'mexc_public',
        spreadPct: 0.4,
      },
      { runId: 'run-1' },
    );
    expect(dto.source).toBe('mexc_public');
    expect(dto.lifecycleState).toBe(CANDIDATE_LIFECYCLE.CANDIDATE);
    expect(dto.candidateId).toBe('c1');
  });

  it('buildCandidateFunnelFromItems counts lifecycle groups', () => {
    const funnel = buildCandidateFunnelFromItems([
      { lifecycleState: 'candidate' },
      { lifecycleState: 'rejected' },
      { lifecycleState: 'rejected' },
      { lifecycleState: 'qualified' },
    ]);
    expect(funnel).toEqual({
      observed: 0,
      analyticalCandidates: 1,
      rejected: 2,
      qualified: 1,
      expired: 0,
      blocked: 0,
    });
  });

  it('buildCandidateAvailableFilters deduplicates filter options', () => {
    const filters = buildCandidateAvailableFilters([
      {
        lifecycleState: 'rejected',
        symbol: 'BTCUSDT',
        rejectionReasons: ['NON_POSITIVE_NET'],
        freshnessState: 'fresh',
      },
      {
        lifecycleState: 'candidate',
        symbol: 'ETHUSDT',
        rejectionReasons: [],
        freshnessState: 'stale',
      },
    ]);
    expect(filters.symbols).toEqual(['BTCUSDT', 'ETHUSDT']);
    expect(filters.lifecycles).toEqual(['candidate', 'rejected']);
    expect(filters.rejectionReasons).toEqual(['NON_POSITIVE_NET']);
    expect(filters.freshnessStates).toEqual(['fresh', 'stale']);
  });
});
