import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AgentProductDialog } from '../../../../../components/ai/product/AgentProductDialog.tsx';
import { AgentProductDetailLayer } from '../../../../../components/ai/product/AgentProductDetailLayer.tsx';
import {
  AGENT_PRODUCT_LAYER_Z,
  AGENT_PRODUCT_LAYERS,
} from '../../../../../components/ai/product/agentProductTokens.ts';
import ArbitrageCandidateDetailPanel from '../../../../../components/ai/arbitrage/ArbitrageCandidateDetailDialog.tsx';
import type { ArbitrageCoreCandidate } from '../../../../../services/api.ts';
import en from '../../../../../deploy/blue/locales/en.json';

vi.mock('../../../../../context/LanguageContext.tsx', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'en' }),
}));

const tEn = (key: string) => (en as Record<string, string>)[key] || key;

const agent = {
  id: 'agent-1',
  name: 'Arbitrage Agent',
  status: 'active',
  agent_key: 'arbitrage',
} as any;

const sampleCandidate: ArbitrageCoreCandidate = {
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
};

describe('AgentProductDetailLayer layering', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('renders detail above agent dialog content within the dialog shell', () => {
    render(
      <AgentProductDialog
        agent={agent}
        onClose={() => {}}
        detailOpen
        detail={
          <AgentProductDetailLayer
            title="BTCUSDT"
            closeLabel="Close"
            onClose={() => {}}
          >
            <div>Detail body</div>
          </AgentProductDetailLayer>
        }
      >
        <div data-testid="popup-body">Candidates list</div>
      </AgentProductDialog>,
    );

    const dialog = screen.getByTestId('agent-product-dialog');
    const layer = screen.getByTestId('agent-product-detail-layer');
    const panel = screen.getByTestId('agent-product-detail-panel');
    const main = screen.getByTestId('agent-product-main-surface');

    expect(dialog.contains(layer)).toBe(true);
    expect(Number(layer.getAttribute('data-layer-z'))).toBeGreaterThan(
      AGENT_PRODUCT_LAYER_Z.dialogContent,
    );
    expect(Number(panel.getAttribute('data-layer-z'))).toBeGreaterThan(
      Number(layer.getAttribute('data-layer-z')),
    );
    expect(main.getAttribute('aria-hidden')).toBe('true');
    expect(main.className).toContain('pointer-events-none');
  });

  it('uses canonical layer token ordering', () => {
    expect(AGENT_PRODUCT_LAYERS.confirmationRoot).toContain(
      String(AGENT_PRODUCT_LAYER_Z.confirmationBackdrop),
    );
    expect(AGENT_PRODUCT_LAYER_Z.confirmationPanel).toBeGreaterThan(
      AGENT_PRODUCT_LAYER_Z.confirmationBackdrop,
    );
  });

  it('Escape closes only detail and returns focus to candidate row', async () => {
    const onClose = vi.fn();
    const onDetailClose = vi.fn();
    render(
      <AgentProductDialog
        agent={agent}
        onClose={onClose}
        detailOpen
        detail={
          <ArbitrageCandidateDetailPanel
            candidate={sampleCandidate}
            open
            onClose={onDetailClose}
            t={tEn}
          />
        }
      >
        <button type="button" data-testid="arb-candidate-row-c1">
          Open candidate
        </button>
      </AgentProductDialog>,
    );

    await waitFor(() =>
      expect(document.activeElement?.getAttribute('data-testid')).toBe(
        'arb-candidate-detail-close',
      ),
    );

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onDetailClose).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes detail layer after close without orphan backdrop', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <AgentProductDialog
        agent={agent}
        onClose={onClose}
        detailOpen
        detail={
          <AgentProductDetailLayer title="Detail" closeLabel="Close" onClose={() => {}}>
            Body
          </AgentProductDetailLayer>
        }
      >
        <div>Body</div>
      </AgentProductDialog>,
    );

    expect(screen.getByTestId('agent-product-detail-layer')).toBeTruthy();

    rerender(
      <AgentProductDialog agent={agent} onClose={onClose} detailOpen={false}>
        <div>Body</div>
      </AgentProductDialog>,
    );

    expect(screen.queryByTestId('agent-product-detail-layer')).toBeNull();
    expect(screen.getByTestId('agent-product-main-surface').getAttribute('aria-hidden')).toBeNull();
  });
});
