import React from 'react';
import { AgentProductConfirmation } from '../product/AgentProductConfirmation.tsx';

export type ArbitrageScanConfirmDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  t: (key: string) => string;
  pending?: boolean;
  returnFocusTestId?: string;
};

export const ArbitrageScanConfirmDialog: React.FC<ArbitrageScanConfirmDialogProps> = ({
  open,
  onCancel,
  onConfirm,
  t,
  pending = false,
  returnFocusTestId = 'arb-run-analytical-scan',
}) => {
  if (!open) return null;

  return (
    <AgentProductConfirmation
      title={t('arb_scan_confirm_title') || 'Run analytical scan?'}
      description={
        t('arb_scan_confirm_subtitle') ||
        'This read-only scan uses public MEXC market data. It will not place orders or perform financial execution.'
      }
      onCancel={onCancel}
      onConfirm={onConfirm}
      cancelLabel={t('cancel') || 'Cancel'}
      confirmLabel={
        pending
          ? t('scanning') || 'Scanning...'
          : t('arb_scan_confirm_run') || 'Run scan'
      }
      pending={pending}
      returnFocusTestId={returnFocusTestId}
      cancelTestId="arb-scan-confirm-cancel"
      confirmTestId="arb-scan-confirm-run"
    >
      <ul className="list-disc ps-5 space-y-2 text-sm text-muted-foreground">
        <li>{t('arb_scan_confirm_public_data') || 'Uses public MEXC market data only.'}</li>
        <li>{t('arb_scan_confirm_no_order') || 'No order will be created.'}</li>
        <li>{t('arb_scan_confirm_no_execution') || 'No financial execution will occur.'}</li>
        <li>
          {t('arb_scan_confirm_conflict_note') ||
            'The scan may be rejected if another scan is already running.'}
        </li>
      </ul>
    </AgentProductConfirmation>
  );
};

export default ArbitrageScanConfirmDialog;
