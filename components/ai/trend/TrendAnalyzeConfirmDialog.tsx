import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { AgentProductConfirmation } from '../product/AgentProductConfirmation.tsx';
import { SELECT_CLASS, INPUT_CLASS } from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import {
  TREND_COMPARE_TIMEFRAMES,
  TREND_PRIMARY_TIMEFRAMES,
} from './trendUiHelpers.ts';
import type { TrendSettings } from '../../../services/trendCoreClient.ts';

export type TrendAnalyzeDraft = {
  symbol: string;
  timeframe: string;
  compareTimeframes: string[];
};

export type TrendAnalyzeConfirmDialogProps = {
  open: boolean;
  savedSettings: TrendSettings;
  initialDraft?: TrendAnalyzeDraft | null;
  onConfirm: (draft: TrendAnalyzeDraft) => void;
  onCancel: () => void;
  isRunning?: boolean;
};

function draftFromSettings(settings: TrendSettings): TrendAnalyzeDraft {
  return {
    symbol: settings.symbol,
    timeframe: settings.timeframe,
    compareTimeframes: [...settings.compareTimeframes],
  };
}

function draftOverridesSaved(saved: TrendSettings, draft: TrendAnalyzeDraft): boolean {
  if (draft.symbol !== saved.symbol) return true;
  if (draft.timeframe !== saved.timeframe) return true;
  if (draft.compareTimeframes.length !== saved.compareTimeframes.length) return true;
  return draft.compareTimeframes.some((tf, i) => tf !== saved.compareTimeframes[i]);
}

export const TrendAnalyzeConfirmDialog: React.FC<TrendAnalyzeConfirmDialogProps> = ({
  open,
  savedSettings,
  initialDraft,
  onConfirm,
  onCancel,
  isRunning = false,
}) => {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<TrendAnalyzeDraft>(() =>
    initialDraft || draftFromSettings(savedSettings),
  );

  useEffect(() => {
    if (open) {
      setDraft(initialDraft || draftFromSettings(savedSettings));
    }
  }, [open, savedSettings, initialDraft]);

  const hasOverrides = useMemo(
    () => draftOverridesSaved(savedSettings, draft),
    [savedSettings, draft],
  );

  if (!open) return null;

  const compareOptions = TREND_COMPARE_TIMEFRAMES.filter((tf) => tf !== draft.timeframe);

  return (
    <AgentProductConfirmation
      title={t('trend_confirm_analysis_title') || 'Run trend analysis?'}
      description={
        t('trend_confirm_analysis_desc') ||
        'This read-only analysis uses public MEXC OHLCV data. No orders or private account access.'
      }
      onConfirm={() => onConfirm(draft)}
      onCancel={onCancel}
      cancelLabel={t('cancel') || 'Cancel'}
      confirmLabel={isRunning ? t('loading') || 'Running...' : t('trend_run_analysis') || 'Run analysis'}
      pending={isRunning}
      cancelTestId="trend-analyze-confirm-cancel"
      confirmTestId="trend-analyze-confirm-run"
      returnFocusTestId="trend-run-analytical-analysis"
    >
      <div className="space-y-4 text-sm" data-testid="trend-analyze-confirm-form">
        <p className="text-xs text-slate-400">{t('trend_confirm_scope_public')}</p>

        {hasOverrides ? (
          <p className="text-xs text-amber-200/90" data-testid="trend-analyze-override-notice">
            {t('trend_confirm_one_time_override')}
          </p>
        ) : (
          <p className="text-xs text-slate-400" data-testid="trend-analyze-saved-notice">
            {t('trend_confirm_using_saved_settings')}
          </p>
        )}

        <label className="block">
          <span className="font-medium">{t('symbol') || 'Symbol'}</span>
          <input
            className={`mt-1 ${INPUT_CLASS}`}
            value={draft.symbol}
            dir="ltr"
            data-testid="trend-analyze-symbol"
            onChange={(e) => setDraft({ ...draft, symbol: e.target.value.trim() })}
          />
        </label>

        <label className="block">
          <span className="font-medium">{t('timeframe') || 'Timeframe'}</span>
          <select
            className={`mt-1 ${SELECT_CLASS}`}
            value={draft.timeframe}
            data-testid="trend-analyze-timeframe"
            onChange={(e) => {
              const timeframe = e.target.value;
              setDraft({
                ...draft,
                timeframe,
                compareTimeframes: draft.compareTimeframes.filter((tf) => tf !== timeframe),
              });
            }}
          >
            {TREND_PRIMARY_TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-2" data-testid="trend-analyze-compare-timeframes">
          <legend className="font-medium">{t('trend_compare_timeframes')}</legend>
          <p className="text-xs text-slate-400">{t('trend_compare_timeframes_help')}</p>
          <div className="flex flex-wrap gap-3">
            {compareOptions.map((tf) => {
              const selected = draft.compareTimeframes.includes(tf);
              return (
                <label key={tf} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected}
                    data-testid={`trend-analyze-compare-${tf}`}
                    onChange={() => {
                      const next = selected
                        ? draft.compareTimeframes.filter((x) => x !== tf)
                        : [...draft.compareTimeframes, tf].slice(0, 3);
                      setDraft({ ...draft, compareTimeframes: next });
                    }}
                  />
                  <span dir="ltr">{tf}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="rounded border border-white/10 p-3 space-y-1 bg-slate-950/50" data-testid="trend-analyze-summary">
          <p className="text-xs font-medium text-slate-300">{t('trend_confirm_submitted_values')}</p>
          <ul className="text-xs text-slate-400 space-y-0.5">
            <li>
              <span className="text-slate-500">{t('symbol')}:</span>{' '}
              <span dir="ltr">{draft.symbol}</span>
            </li>
            <li>
              <span className="text-slate-500">{t('timeframe')}:</span>{' '}
              <span dir="ltr">{draft.timeframe}</span>
            </li>
            <li>
              <span className="text-slate-500">{t('trend_compare_timeframes')}:</span>{' '}
              {draft.compareTimeframes.length
                ? draft.compareTimeframes.join(', ')
                : t('trend_compare_none')}
            </li>
          </ul>
        </div>
      </div>
    </AgentProductConfirmation>
  );
};

export default TrendAnalyzeConfirmDialog;
