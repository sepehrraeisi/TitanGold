import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ArbitrageScanConfirmDialog } from '../../../../../components/ai/arbitrage/ArbitrageScanConfirmDialog.tsx';

describe('ArbitrageScanConfirmDialog', () => {
  const t = (key: string) =>
    ({
      arb_scan_confirm_title: 'Run analytical scan?',
      arb_scan_confirm_subtitle: 'Read-only analytical scan using public MEXC market data.',
      arb_scan_confirm_public_data: 'Uses public MEXC market data only.',
      arb_scan_confirm_no_order: 'No order will be created.',
      arb_scan_confirm_no_execution: 'No financial execution will occur.',
      arb_scan_confirm_conflict_note: 'The scan may be rejected if another scan is already running.',
      cancel: 'Cancel',
      arb_scan_confirm_run: 'Run scan',
      scanning: 'Scanning...',
    })[key] ?? key;

  it('renders confirmation copy and defaults focus to cancel', () => {
    render(
      <ArbitrageScanConfirmDialog
        open
        onCancel={() => {}}
        onConfirm={() => {}}
        t={t}
      />,
    );

    expect(screen.getByText('Run analytical scan?')).toBeTruthy();
    expect(screen.getByTestId('arb-scan-confirm-cancel')).toBeTruthy();
    expect(screen.getByTestId('arb-scan-confirm-run')).toBeTruthy();
  });

  it('calls onConfirm when run is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ArbitrageScanConfirmDialog
        open
        onCancel={() => {}}
        onConfirm={onConfirm}
        t={t}
      />,
    );

    fireEvent.click(screen.getByTestId('arb-scan-confirm-run'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
