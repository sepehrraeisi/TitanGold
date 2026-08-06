import React from 'react';
import {
  localizeSignalDirection,
  localizeSignalType,
  resolveEvidenceText,
} from './trendUiHelpers.ts';

type TFn = (key: string) => string;

export type TrendWeakeningReversalItemProps = {
  item: Record<string, unknown>;
  t: TFn;
  locale: string;
};

export const TrendWeakeningReversalItem: React.FC<TrendWeakeningReversalItemProps> = ({
  item,
  t,
  locale,
}) => {
  const evidenceState = String(item.evidenceState || (item.available ? 'detected' : 'insufficient'));
  if (evidenceState === 'insufficient') {
    return <p className="text-xs text-slate-400">{t('trend_evidence_insufficient')}</p>;
  }

  const text = resolveEvidenceText(item, t);
  const signalType = item.signalType ? String(item.signalType) : null;
  const direction = item.direction ? String(item.direction) : null;
  const severity = item.severity ? String(item.severity) : null;
  const ts = item.sourceTimestamp ? String(item.sourceTimestamp) : null;

  return (
    <div className="rounded border border-white/10 p-2 space-y-1 text-xs" data-testid="trend-evidence-item">
      <p className="text-slate-200">{text}</p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-slate-400">
        {signalType ? (
          <>
            <dt>{t('trend_evidence_signal_type')}</dt>
            <dd>{localizeSignalType(signalType, t)}</dd>
          </>
        ) : null}
        {direction ? (
          <>
            <dt>{t('trend_direction')}</dt>
            <dd>{localizeSignalDirection(direction, t)}</dd>
          </>
        ) : null}
        {severity ? (
          <>
            <dt>{t('trend_evidence_severity')}</dt>
            <dd>{t(`trend_evidence_severity_${severity}`) || t('not_available')}</dd>
          </>
        ) : null}
        {ts ? (
          <>
            <dt>{t('trend_evidence_source_time')}</dt>
            <dd dir="ltr">{new Date(ts).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</dd>
          </>
        ) : null}
        <dt>{t('trend_evidence_provenance')}</dt>
        <dd>{t('trend_evidence_provenance_analyzer')}</dd>
      </dl>
    </div>
  );
};

export default TrendWeakeningReversalItem;
