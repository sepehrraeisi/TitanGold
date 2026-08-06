import React, { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendChartSeries } from '../../../services/trendCoreClient.ts';

type TFn = (key: string) => string;

export type TrendAdxChartProps = {
  series: TrendChartSeries | null | undefined;
  currentAdx: number | null | undefined;
  momentum: string | null | undefined;
  t: TFn;
  locale: string;
  testId?: string;
};

export const TrendAdxChart: React.FC<TrendAdxChartProps> = ({
  series,
  currentAdx,
  momentum,
  t,
  locale,
  testId = 'trend-adx-chart',
}) => {
  const data = useMemo(() => {
    if (!series?.points?.length) return [];
    return series.points
      .filter((p) => p.adx != null)
      .map((p) => ({
        label: new Date(p.t).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
        }),
        adx: p.adx,
      }));
  }, [series, locale]);

  if (!data.length) {
    return (
      <p className="text-xs text-slate-400" data-testid={`${testId}-empty`}>
        {t('trend_adx_unavailable')}
      </p>
    );
  }

  const momentumLabel =
    momentum === 'strengthening'
      ? t('trend_adx_strengthening')
      : momentum === 'weakening'
        ? t('trend_adx_weakening')
        : null;

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex flex-wrap gap-3 text-xs">
        {currentAdx != null ? (
          <span>
            ADX: <span dir="ltr">{currentAdx}</span>
          </span>
        ) : null}
        {momentumLabel ? <span className="text-slate-400">{momentumLabel}</span> : null}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-400 mb-1">
        <span>{t('trend_adx_zone_weak')}</span>
        <span>{t('trend_adx_zone_developing')}</span>
        <span>{t('trend_adx_zone_moderate')}</span>
        <span>{t('trend_adx_zone_strong')}</span>
      </div>
      <div className="h-48 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <ReferenceArea y1={0} y2={20} fill="rgba(148,163,184,0.08)" />
            <ReferenceArea y1={20} y2={25} fill="rgba(251,191,36,0.08)" />
            <ReferenceArea y1={25} y2={40} fill="rgba(52,211,153,0.08)" />
            <ReferenceArea y1={40} y2={100} fill="rgba(56,189,248,0.08)" />
            <ReferenceLine y={20} stroke="rgba(148,163,184,0.4)" strokeDasharray="4 4" />
            <ReferenceLine y={25} stroke="rgba(251,191,36,0.5)" strokeDasharray="4 4" />
            <ReferenceLine y={40} stroke="rgba(56,189,248,0.5)" strokeDasharray="4 4" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis domain={[0, 'auto']} tick={{ fontSize: 10 }} width={36} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }}
            />
            <Area type="monotone" dataKey="adx" fill="rgba(167,139,250,0.15)" stroke="none" />
            <Line type="monotone" dataKey="adx" name="ADX" stroke="#c084fc" dot={false} strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrendAdxChart;
