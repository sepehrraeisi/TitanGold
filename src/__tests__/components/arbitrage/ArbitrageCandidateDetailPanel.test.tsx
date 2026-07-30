import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArbitrageCandidateDetailPanel from '../../../../components/ai/arbitrage/ArbitrageCandidateDetailDialog.tsx';
import type { ArbitrageCoreCandidate } from '../../../../services/api.ts';
import en from '../../../../deploy/blue/locales/en.json';

const tEn = (key: string) => (en as Record<string, string>)[key] || key;

const sampleCandidate: ArbitrageCoreCandidate = {
  candidateId: 'c1',
  runId: 'run-abc',
  lifecycleState: 'rejected',
  symbol: 'ETHUSDT',
  baseAsset: 'ETH',
  quoteAsset: 'USDT',
  bid: 100,
  ask: 100.5,
  sourceTimestamp: '2026-07-29T10:00:00.000Z',
  observedAt: '2026-07-29T10:00:00.000Z',
  ageMs: 1000,
  grossSpreadBps: 40,
  assumedFeesBps: 10,
  estimatedSlippageBps: 5,
  netSpreadBps: 25,
  estimatedNotional: 50000,
  estimatedProfit: null,
  estimatedProfitUnavailableReason: 'NON_POSITIVE_NET',
  liquidityState: 'ok',
  freshnessState: 'fresh',
  riskScore: 15,
  rejectionReasons: ['NON_POSITIVE_NET'],
  mode: 'single_venue_spread_monitoring',
  source: 'mexc_public',
};

describe('ArbitrageCandidateDetailPanel data truthfulness', () => {
  it('maps each metric from its DTO field and keeps rejection separate from profit', () => {
    render(
      <ArbitrageCandidateDetailPanel
        candidate={sampleCandidate}
        open
        onClose={() => {}}
        t={tEn}
      />,
    );

    const body = screen.getByTestId('arb-candidate-detail-body');
    expect(body.textContent).toContain('40.00 bps');
    expect(body.textContent).toContain('25.00 bps');
    expect(body.textContent).toContain('Estimated profit unavailable');
    expect(body.textContent).not.toContain('single_venue_spread_monitoring');
    expect(body.textContent).not.toContain('mexc_public');
    expect(body.textContent).toContain('Single-venue spot spread monitoring');
    expect(body.textContent).toContain('MEXC public market data');
    expect(body.textContent).toContain('run-abc');
    expect(body.textContent).toContain('Estimated net spread was not positive');
  });

  it('shows valid zero profit as USDT without dollar sign', () => {
    render(
      <ArbitrageCandidateDetailPanel
        candidate={{ ...sampleCandidate, estimatedProfit: 0 }}
        open
        onClose={() => {}}
        t={tEn}
      />,
    );
    expect(screen.getByTestId('arb-candidate-detail-body').textContent).toContain('0.00 USDT');
    expect(screen.getByTestId('arb-candidate-detail-body').textContent).not.toContain('$');
  });
});
