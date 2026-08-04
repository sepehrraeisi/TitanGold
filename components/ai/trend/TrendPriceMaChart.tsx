import React, { useMemo } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendChartSeries } from '../../../services/trendCoreClient.ts';

type TFn = (key: string) => string;

export type TrendPriceMaChartProps = {
  series: TrendChartSeries | null | undefined;
  symbol: string | null;
  timeframe: string | null;
  direction: string | null;
  t: TFn;
  locale: string;
  testId?: string;
};

export const TrendPriceMaChart: React.FC<TrendPriceMaChartProps> = ({
  series,
  symbol,
  timeframe,
  direction,
  t,
  locale,
  testId = 'trend-price-ma-chart',
}) => {
  const data = useMemo(() => {
    if (!series?.points?.length) return [];
    return series.points.map((p) => ({
      label: new Date(p.t).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      close: p.close,
      sma: p.sma,
      ema: p.ema,
    }));
  }, [series, locale]);

  if (!data.length) {
    return (
      <p className="text-xs text-slate-400" data-testid={`${testId}-empty`}>
        {t('trend_chart_no_data')}
      </p>
    );
  }

  const smaLabel = `SMA ${series?.smaPeriod ?? 50}`;
  const emaLabel = `EMA ${series?.emaPeriod ?? 20}`;

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        {symbol ? <span dir="ltr">{symbol}</span> : null}
        {timeframe ? <span dir="ltr">· {timeframe}</span> : null}
        {direction ? <span>· {direction}</span> : null}
      </div>
      <div className="h-56 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis
              tick={{ fontSize: 10 }}
              domain={['auto', 'auto']}
              width={56}
              tickFormatter={(v) => Number(v).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="close" name={t('trend_chart_close')} stroke="#38bdf8" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="sma" name={smaLabel} stroke="#a78bfa" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="ema" name={emaLabel} stroke="#34d399" dot={false} strokeWidth={1.5} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrendPriceMaChart;
