import React from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { AgentProductConfirmation } from '../product/AgentProductConfirmation.tsx';

export type TrendAnalyzeConfirmDialogProps = {
  open: boolean;
  symbol: string;
  timeframe: string;
  compareTimeframes: string[];
  onConfirm: () => void;
  onCancel: () => void;
  isRunning?: boolean;
};

export const TrendAnalyzeConfirmDialog: React.FC<TrendAnalyzeConfirmDialogProps> = ({
  open,
  symbol,
  timeframe,
  compareTimeframes,
  onConfirm,
  onCancel,
  isRunning = false,
}) => {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <AgentProductConfirmation
      title={t('trend_confirm_analysis_title') || 'Run trend analysis?'}
      description={
        t('trend_confirm_analysis_desc') ||
        'This read-only analysis uses public MEXC OHLCV data. No orders or private account access.'
      }
      onConfirm={onConfirm}
      onCancel={onCancel}
      cancelLabel={t('cancel') || 'Cancel'}
      confirmLabel={isRunning ? t('loading') || 'Running...' : t('trend_run_analysis') || 'Run analysis'}
      pending={isRunning}
      cancelTestId="trend-analyze-confirm-cancel"
      confirmTestId="trend-analyze-confirm-run"
      returnFocusTestId="trend-run-analytical-analysis"
    >
      <ul className="text-sm space-y-1 text-slate-300">
        <li>
          <span className="font-medium">{t('symbol') || 'Symbol'}:</span>{' '}
          <span dir="ltr" className="inline-block">{symbol}</span>
        </li>
        <li>
          <span className="font-medium">{t('timeframe') || 'Timeframe'}:</span> {timeframe}
        </li>
        {compareTimeframes.length > 0 ? (
          <li>
            <span className="font-medium">{t('trend_compare_timeframes') || 'Compare'}:</span>{' '}
            {compareTimeframes.join(', ')}
          </li>
        ) : null}
      </ul>
    </AgentProductConfirmation>
  );
};

export default TrendAnalyzeConfirmDialog;
