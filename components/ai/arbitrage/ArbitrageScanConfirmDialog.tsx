import React, { useEffect, useId, useRef } from 'react';
import { DataHubModal, PrimaryButton, SecondaryButton } from '../AIManager/tabs/DataHub/dataHubUi.tsx';

export type ArbitrageScanConfirmDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  t: (key: string) => string;
  pending?: boolean;
};

export const ArbitrageScanConfirmDialog: React.FC<ArbitrageScanConfirmDialogProps> = ({
  open,
  onCancel,
  onConfirm,
  t,
  pending = false,
}) => {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <DataHubModal
      title={t('arb_scan_confirm_title') || 'Run analytical scan?'}
      subtitle={
        t('arb_scan_confirm_subtitle') ||
        'Read-only analytical scan using public MEXC market data.'
      }
      onClose={onCancel}
      footer={
        <>
          <SecondaryButton
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            disabled={pending}
            data-testid="arb-scan-confirm-cancel"
          >
            {t('cancel') || 'Cancel'}
          </SecondaryButton>
          <PrimaryButton
            type="button"
            onClick={onConfirm}
            disabled={pending}
            data-testid="arb-scan-confirm-run"
          >
            {pending
              ? t('scanning') || 'Scanning...'
              : t('arb_scan_confirm_run') || 'Run scan'}
          </PrimaryButton>
        </>
      }
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
    </DataHubModal>
  );
};

export default ArbitrageScanConfirmDialog;
