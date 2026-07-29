import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AgentProductDialog } from '../../../../../components/ai/product/AgentProductDialog.tsx';
import { ArbitrageScanConfirmDialog } from '../../../../../components/ai/arbitrage/ArbitrageScanConfirmDialog.tsx';

const t = (key: string) =>
  ({
    arb_scan_confirm_title: 'Run analytical scan?',
    arb_scan_confirm_subtitle: 'Read-only scan body',
    cancel: 'Cancel',
    arb_scan_confirm_run: 'Run scan',
    scanning: 'Scanning...',
    arb_scan_confirm_public_data: 'Public data only',
    arb_scan_confirm_no_order: 'No order',
    arb_scan_confirm_no_execution: 'No execution',
    arb_scan_confirm_conflict_note: 'Conflict note',
  })[key] ?? key;

vi.mock('../../../../../context/LanguageContext.tsx', () => ({
  useLanguage: () => ({ t, language: 'en' }),
}));

const agent = {
  id: 'agent-1',
  name: 'Arbitrage Agent',
  status: 'active',
  agent_key: 'arbitrage',
} as any;

describe('ArbitrageScanConfirmDialog', () => {
  it('renders visible confirmation inside agent dialog shell', () => {
    render(
      <AgentProductDialog
        agent={agent}
        onClose={() => {}}
        confirmationOpen
        confirmation={
          <ArbitrageScanConfirmDialog
            open
            onCancel={() => {}}
            onConfirm={() => {}}
            t={t}
          />
        }
      >
        <button type="button" data-testid="arb-run-analytical-scan">
          Run analytical scan
        </button>
      </AgentProductDialog>,
    );

    expect(screen.getByTestId('agent-product-confirmation-panel')).toBeTruthy();
    expect(screen.getByTestId('arb-scan-confirm-cancel')).toBeTruthy();
    expect(screen.getByTestId('arb-scan-confirm-run')).toBeTruthy();
    expect(screen.getByText('Run analytical scan?')).toBeTruthy();
  });

  it('calls onCancel and onConfirm from actions', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <AgentProductDialog
        agent={agent}
        onClose={() => {}}
        confirmationOpen
        confirmation={
          <ArbitrageScanConfirmDialog
            open
            onCancel={onCancel}
            onConfirm={onConfirm}
            t={t}
          />
        }
      >
        <div>Body</div>
      </AgentProductDialog>,
    );

    fireEvent.click(screen.getByTestId('arb-scan-confirm-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('arb-scan-confirm-run'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('defaults focus to Cancel', async () => {
    render(
      <AgentProductDialog
        agent={agent}
        onClose={() => {}}
        confirmationOpen
        confirmation={
          <ArbitrageScanConfirmDialog open onCancel={() => {}} onConfirm={() => {}} t={t} />
        }
      >
        <div>Body</div>
      </AgentProductDialog>,
    );

    await waitFor(() =>
      expect(document.activeElement?.getAttribute('data-testid')).toBe('arb-scan-confirm-cancel'),
    );
  });
});
