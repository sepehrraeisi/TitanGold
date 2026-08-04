import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendRunSummary } from '../../../services/trendCoreClient.ts';
import { localizeDirection, localizeRegime } from './trendUiHelpers.ts';

type TFn = (key: string) => string;

export type TrendHistoryTrendChartProps = {
  runs: TrendRunSummary[];
  t: TFn;
  locale: string;
  testId?: string;
};

export const TrendHistoryTrendChart: React.FC<TrendHistoryTrendChartProps> = ({
  runs,
  t,
  locale,
  testId = 'trend-history-chart',
}) => {
  const data = useMemo(() => {
    const completed = [...runs]
      .filter((r) => r.status === 'completed' && r.snapshotSummary)
      .reverse()
      .slice(-12);
    return completed.map((r) => ({
      label: new Date(r.startedAt).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
      }),
      adx: typeof r.snapshotSummary.adx === 'number' ? r.snapshotSummary.adx : null,
      direction: localizeDirection(String(r.snapshotSummary.direction || ''), t),
      regime: localizeRegime(String(r.snapshotSummary.regime || ''), t),
    }));
  }, [runs, t, locale]);

  if (data.length < 2) {
    return (
      <p className="text-xs text-slate-400" data-testid={`${testId}-empty`}>
        {t('trend_history_chart_insufficient')}
      </p>
    );
  }

  return (
    <div className="h-44 w-full min-w-0" data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 'auto']} tick={{ fontSize: 10 }} width={36} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="adx" name="ADX" stroke="#c084fc" dot strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendHistoryTrendChart;
