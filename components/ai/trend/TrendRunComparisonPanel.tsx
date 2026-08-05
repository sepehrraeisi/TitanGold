import React from 'react';
import {
  localizeDirection,
  localizeFreshness,
  localizeRegime,
  localizeStrength,
} from './trendUiHelpers.ts';
import type { TrendSnapshot } from '../../../services/trendCoreClient.ts';

type TFn = (key: string) => string;

export type TrendComparisonDto = Record<string, unknown>;

export type TrendRunComparisonPanelProps = {
  comparison: TrendComparisonDto | null | undefined;
  snapshot: TrendSnapshot;
  t: TFn;
  locale: string;
  testId?: string;
};

function fieldRow(label: string, prior: string, current: string, changed: boolean) {
  return (
    <div className={`flex flex-wrap gap-x-2 text-xs ${changed ? 'text-amber-200' : 'text-slate-300'}`}>
      <span className="text-slate-500 min-w-[5rem]">{label}</span>
      <span>{prior}</span>
      <span>→</span>
      <span>{current}</span>
      {changed ? <span className="text-amber-300/80">({/* changed */}Δ)</span> : null}
    </div>
  );
}

export const TrendRunComparisonPanel: React.FC<TrendRunComparisonPanelProps> = ({
  comparison,
  snapshot,
  t,
  locale,
  testId = 'trend-run-comparison',
}) => {
  if (!comparison?.available) {
    const reasonKey = (comparison?.reasonKey as string) || 'trend_comparison_unavailable';
    const reason = t(reasonKey);
    return (
      <p className="text-xs text-slate-400" data-testid={`${testId}-unavailable`}>
        {reason === reasonKey ? t('trend_comparison_unavailable') : reason}
      </p>
    );
  }

  const direction = comparison.direction as { prior?: string; current?: string; changed?: boolean } | undefined;
  const regime = comparison.regime as { prior?: string; current?: string; changed?: boolean } | undefined;
  const strength = comparison.strengthClassification as { prior?: string; current?: string; changed?: boolean } | undefined;
  const adx = comparison.adx as { prior?: number | null; current?: number | null; delta?: number | null } | undefined;
  const freshness = comparison.freshness as { prior?: string; current?: string; changed?: boolean } | undefined;
  const supporting = comparison.supportingEvidence as { priorCount?: number; currentCount?: number } | undefined;
  const conflicting = comparison.conflictingEvidence as { priorCount?: number; currentCount?: number } | undefined;

  return (
    <div className="space-y-2 rounded border border-white/10 p-3 bg-slate-950/40" data-testid={testId}>
      <h4 className="text-sm font-medium">{t('trend_comparison_title')}</h4>
      {comparison.priorRunId ? (
        <p className="text-[10px] text-slate-500" data-testid={`${testId}-prior-run-id`}>
          {t('trend_comparison_prior_run')}: <span dir="ltr">{String(comparison.priorRunId)}</span>
        </p>
      ) : null}
      {direction
        ? fieldRow(
            t('trend_direction'),
            localizeDirection(direction.prior, t),
            localizeDirection(direction.current ?? snapshot.direction, t),
            Boolean(direction.changed),
          )
        : null}
      {regime
        ? fieldRow(
            t('trend_regime'),
            localizeRegime(regime.prior, t),
            localizeRegime(regime.current ?? snapshot.regime, t),
            Boolean(regime.changed),
          )
        : null}
      {strength
        ? fieldRow(
            t('trend_strength'),
            localizeStrength(strength.prior, t),
            localizeStrength(strength.current ?? snapshot.strengthClassification, t),
            Boolean(strength.changed),
          )
        : null}
      {adx ? (
        <div className={`text-xs ${adx.delta != null && adx.delta !== 0 ? 'text-amber-200' : 'text-slate-300'}`}>
          <span className="text-slate-500">ADX: </span>
          <span dir="ltr">{adx.prior ?? t('not_available')}</span>
          <span> → </span>
          <span dir="ltr">{adx.current ?? snapshot.adx?.value ?? t('not_available')}</span>
          {adx.delta != null ? (
            <span className="ms-2 text-slate-400" dir="ltr">
              (Δ {adx.delta > 0 ? '+' : ''}{adx.delta})
            </span>
          ) : null}
        </div>
      ) : null}
      {freshness
        ? fieldRow(
            t('trend_freshness'),
            t(`trend_freshness_${freshness.prior}`) || String(freshness.prior),
            t(`trend_freshness_${freshness.current}`) || String(freshness.current),
            Boolean(freshness.changed),
          )
        : null}
      {supporting ? (
        <p className="text-xs text-slate-400">
          {t('trend_supporting_evidence')}: {supporting.priorCount ?? 0} → {supporting.currentCount ?? 0}
        </p>
      ) : null}
      {conflicting ? (
        <p className="text-xs text-slate-400">
          {t('trend_conflicting_evidence')}: {conflicting.priorCount ?? 0} → {conflicting.currentCount ?? 0}
        </p>
      ) : null}
    </div>
  );
};

export default TrendRunComparisonPanel;
