import React from 'react';
import type { TrendSnapshot } from '../../../services/trendCoreClient.ts';
import { StatusPill } from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import {
  localizeAgreement,
  localizeDirection,
  localizeFreshness,
  localizeRegime,
  localizeStrength,
} from './trendUiHelpers.ts';

export type TrendMtfRow = {
  timeframe: string;
  snapshot: TrendSnapshot;
  agreement: string;
  unavailableReason?: string | null;
};

type TFn = (key: string) => string;

export type TrendMtfMatrixProps = {
  rows: TrendMtfRow[];
  primaryTimeframe: string | null;
  t: TFn;
  locale: string;
  testId?: string;
};

export const TrendMtfMatrix: React.FC<TrendMtfMatrixProps> = ({
  rows,
  primaryTimeframe,
  t,
  locale,
  testId = 'trend-mtf-matrix',
}) => {
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto" data-testid={testId}>
      <table className="w-full text-sm border-collapse min-w-[520px]">
        <thead>
          <tr className="text-left text-xs text-slate-400 border-b border-white/10">
            <th className="py-2 pe-3">{t('timeframe')}</th>
            <th className="py-2 pe-3">{t('trend_direction')}</th>
            <th className="py-2 pe-3">{t('trend_regime')}</th>
            <th className="py-2 pe-3">{t('trend_strength')}</th>
            <th className="py-2 pe-3">ADX</th>
            <th className="py-2 pe-3">{t('trend_freshness')}</th>
            <th className="py-2">{t('trend_mtf_agreement')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const snap = row.snapshot;
            const isPrimary = row.timeframe === primaryTimeframe;
            return (
              <tr
                key={row.timeframe}
                className={`border-b border-white/5 ${isPrimary ? 'bg-purple-500/5' : ''}`}
                data-testid={`trend-mtf-row-${row.timeframe}`}
              >
                <td className="py-2 pe-3" dir="ltr">
                  {row.timeframe}
                  {isPrimary ? (
                    <span className="ms-2 text-[10px] text-purple-300">({t('trend_primary_tf')})</span>
                  ) : null}
                </td>
                <td className="py-2 pe-3">{localizeDirection(snap?.direction, t)}</td>
                <td className="py-2 pe-3">{localizeRegime(snap?.regime, t)}</td>
                <td className="py-2 pe-3">{localizeStrength(snap?.strengthClassification, t)}</td>
                <td className="py-2 pe-3" dir="ltr">
                  {snap?.adx?.value != null ? snap.adx.value : t('not_available')}
                </td>
                <td className="py-2 pe-3 text-xs">{localizeFreshness(snap, t, locale)}</td>
                <td className="py-2">
                  <StatusPill
                    label={localizeAgreement(row.agreement, t)}
                    variant={
                      row.agreement === 'agree'
                        ? 'success'
                        : row.agreement === 'conflict'
                          ? 'error'
                          : 'warning'
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TrendMtfMatrix;
