/**
 * ARB-WP1A-R1 — scan contract classification owner tests
 * @jest-environment node
 */
import { describe, test, expect } from '@jest/globals';
import {
  classifyScanContract,
  normalizeScanResult,
  ARBITRAGE_ANALYTICAL_MODE,
  ARBITRAGE_CONTRACT_VERSION_WP1A,
  REJECTION_REASONS,
} from '../../../services/arbitrageScanContract.js';

describe('ARB-WP1A-R1 classifyScanContract / normalizeScanResult', () => {
  test('explicit modern contract version is modern', () => {
    const c = classifyScanContract({
      contractVersion: ARBITRAGE_CONTRACT_VERSION_WP1A,
      legacy: true, // must not win over explicit modern version
    });
    expect(c).toEqual({
      classification: 'modern',
      legacy: false,
      contractVersion: ARBITRAGE_CONTRACT_VERSION_WP1A,
    });
    const n = normalizeScanResult({
      contractVersion: ARBITRAGE_CONTRACT_VERSION_WP1A,
      analyticalMode: ARBITRAGE_ANALYTICAL_MODE,
      candidates: [],
      rejectedCandidates: [],
      qualifiedOpportunities: [],
      legacy: true,
    });
    expect(n.classification).toBe('modern');
    expect(n.legacy).toBe(false);
  });

  test('explicit legacy:false marker is modern even without version', () => {
    const n = normalizeScanResult({
      legacy: false,
      analyticalMode: ARBITRAGE_ANALYTICAL_MODE,
      candidates: [{ id: 'a' }],
      rejectedCandidates: [],
      qualifiedOpportunities: [],
    });
    expect(n.classification).toBe('modern');
    expect(n.legacy).toBe(false);
  });

  test('explicit legacy:true marker remains legacy when no modern version', () => {
    const n = normalizeScanResult({
      legacy: true,
      opportunities: [{ id: 'x', symbol: 'BTCUSDT', netProfitUSDT: -1, profitBps: -1 }],
    });
    expect(n.classification).toBe('legacy');
    expect(n.legacy).toBe(true);
  });

  test('modern shape without markers is modern', () => {
    const n = normalizeScanResult({
      analyticalMode: ARBITRAGE_ANALYTICAL_MODE,
      candidates: [],
      rejectedCandidates: [{ id: 'r', rejectionReason: REJECTION_REASONS.NON_POSITIVE_NET }],
      qualifiedOpportunities: [],
    });
    expect(n.classification).toBe('modern');
    expect(n.legacy).toBe(false);
  });

  test('genuine old opportunities payload is legacy', () => {
    const n = normalizeScanResult({
      timestamp: '2026-07-10T10:00:00.000Z',
      summary: { avgRiskScore: 10, totalOpportunities: 1 },
      opportunities: [
        {
          id: 'x',
          symbol: 'ADAUSDT',
          netProfitUSDT: -13.8,
          profitBps: -13.8,
          riskScore: 0,
          path: ['Buy', 'Sell'],
        },
      ],
    });
    expect(n.classification).toBe('legacy');
    expect(n.legacy).toBe(true);
    expect(n.rejectedCandidates[0].rejectionReason).toBe(REJECTION_REASONS.LEGACY_NEGATIVE_ESTIMATE);
  });

  test('missing optional modern fields still modern when marker present', () => {
    const n = normalizeScanResult({
      legacy: false,
      analyticalMode: ARBITRAGE_ANALYTICAL_MODE,
      // candidates optional absent — still modern by marker + mode
    });
    expect(n.classification).toBe('modern');
    expect(n.legacy).toBe(false);
    expect(n.candidateStats.qualified).toBe(0);
  });

  test('malformed/empty payload is partial not modern or legacy claim', () => {
    const n = normalizeScanResult({});
    expect(n.classification).toBe('partial');
    expect(n.legacy).toBeNull();
    expect(n.status).toBe('unavailable');
  });

  test('null payload is partial', () => {
    const n = normalizeScanResult(null);
    expect(n.classification).toBe('partial');
    expect(n.legacy).toBeNull();
  });

  test('deprecated { legacy: true } option cannot override explicit modern', () => {
    const raw = {
      legacy: false,
      contractVersion: ARBITRAGE_CONTRACT_VERSION_WP1A,
      analyticalMode: ARBITRAGE_ANALYTICAL_MODE,
      candidates: [],
      rejectedCandidates: [],
      qualifiedOpportunities: [],
    };
    const forced = normalizeScanResult(raw, { legacy: true });
    expect(forced.classification).toBe('modern');
    expect(forced.legacy).toBe(false);
  });

  test('explicit Legacy remains Legacy under deprecated force option', () => {
    const n = normalizeScanResult(
      {
        legacy: true,
        opportunities: [{ id: 'y', symbol: 'ETHUSDT', netProfitUSDT: 5, profitBps: 10 }],
      },
      { legacy: true },
    );
    expect(n.classification).toBe('legacy');
    expect(n.legacy).toBe(true);
    expect(n.qualifiedOpportunities).toEqual([]);
  });

  test('_meta.version wp1a classifies modern', () => {
    const c = classifyScanContract({
      _meta: { version: '2.0.0-wp1a' },
      opportunities: [{ id: 'should-not-force-legacy' }],
    });
    expect(c.classification).toBe('modern');
    expect(c.legacy).toBe(false);
  });
});
