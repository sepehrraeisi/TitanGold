import { describe, expect, it } from 'vitest';
import en from '../../../deploy/blue/locales/en.json';
import fa from '../../../deploy/blue/locales/fa.json';
import {
  isRawLocalizationKey,
  presentEstimatedProfit,
  presentLifecycle,
  presentMode,
  presentSource,
  presentFreshness,
  presentLiquidity,
  presentPrimaryRejection,
  presentBps,
  presentTimestamp,
  resolveProductLabel,
} from '../../../utils/candidatePresentation.ts';
import type { ArbitrageCoreCandidate } from '../../../services/api.ts';

const tEn = (key: string) => (en as Record<string, string>)[key] || key;
const tFa = (key: string) => (fa as Record<string, string>)[key] || key;

const baseCandidate: ArbitrageCoreCandidate = {
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
  estimatedSlippageBps: 5,
  netSpreadBps: 35,
  estimatedNotional: 100000,
  estimatedProfit: null,
  estimatedProfitUnavailableReason: 'NON_POSITIVE_NET',
  liquidityState: 'ok',
  freshnessState: 'fresh',
  riskScore: 20,
  rejectionReasons: ['NON_POSITIVE_NET'],
  mode: 'single_venue_spread_monitoring',
  source: 'mexc_public',
};

describe('candidatePresentation', () => {
  it('maps known lifecycle/mode/source codes in EN without raw snake_case', () => {
    expect(presentLifecycle('rejected', tEn)).toBe('Rejected');
    expect(presentFreshness('fresh', tEn)).toBe('Fresh data');
    expect(presentLiquidity('ok', tEn)).toBe('Liquidity OK');
    expect(presentMode('single_venue_spread_monitoring', tEn)).toBe(
      'Single-venue spot spread monitoring',
    );
    expect(presentSource('mexc_public', tEn)).toBe('MEXC public market data');
    expect(isRawLocalizationKey(presentLifecycle('rejected', tEn))).toBe(false);
  });

  it('maps known codes in FA with natural Persian labels', () => {
    expect(presentLifecycle('rejected', tFa)).toBe('ردشده');
    expect(presentFreshness('fresh', tFa)).toBe('داده تازه');
    expect(presentMode('single_venue_spread_monitoring', tFa)).toBe(
      'پایش اسپرد اسپات در یک بازار',
    );
    expect(presentSource('mexc_public', tFa)).toBe('داده عمومی بازار MEXC');
  });

  it('fails closed for unknown codes without exposing raw values', () => {
    expect(presentLifecycle('unknown_lifecycle', tEn)).toBe('Unavailable');
    expect(presentMode('unknown_mode', tFa)).toBe('در دسترس نیست');
    expect(presentSource('unknown_source', tEn)).toBe('Unavailable');
    expect(presentLifecycle('unknown_lifecycle', tEn, 'technical')).toBe('unknown_lifecycle');
  });

  it('never uses rejection text as estimated profit', () => {
    const profit = presentEstimatedProfit(baseCandidate, tEn);
    expect(profit).toBe('Estimated profit unavailable');
    expect(profit).not.toContain('net spread');
    expect(profit).not.toBe(presentPrimaryRejection('NON_POSITIVE_NET', tEn));
  });

  it('formats financial metrics from correct DTO fields', () => {
    expect(presentBps(baseCandidate.grossSpreadBps, tEn)).toBe('50.00 bps');
    expect(presentBps(baseCandidate.netSpreadBps, tEn)).toBe('35.00 bps');
    expect(presentBps(baseCandidate.assumedFeesBps, tEn)).toBe('10.00 bps');
    expect(presentBps(baseCandidate.estimatedSlippageBps, tEn)).toBe('5.00 bps');
    expect(presentBps(null, tEn)).toBeNull();
    expect(presentBps(0, tEn)).toBe('0.00 bps');
    expect(presentBps(-12.5, tEn)).toBe('-12.50 bps');
  });

  it('shows USDT only when estimatedProfit is a finite number', () => {
    expect(
      presentEstimatedProfit({ ...baseCandidate, estimatedProfit: 12.34 }, tEn),
    ).toBe('12.34 USDT');
    expect(presentEstimatedProfit({ ...baseCandidate, estimatedProfit: 0 }, tEn)).toBe('0.00 USDT');
  });

  it('uses unavailable label for missing timestamp', () => {
    expect(presentTimestamp(null, tEn)).toBe('Timestamp unavailable');
    expect(resolveProductLabel('arb_group_empty', tEn)).toBe('No items in this group');
  });
});
