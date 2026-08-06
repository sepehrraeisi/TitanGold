import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendRunSummary } from '../../../services/trendCoreClient.ts';
import { filterComparableHistoryRuns } from './trendUiHelpers.ts';

type TFn = (key: string) => string;

export type TrendHistoryTrendChartProps = {
  runs: TrendRunSummary[];
  symbol: string;
  timeframe: string;
  t: TFn;
  locale: string;
  testId?: string;
};

export const TrendHistoryTrendChart: React.FC<TrendHistoryTrendChartProps> = ({
  runs,
  symbol,
  timeframe,
  t,
  locale,
  testId = 'trend-history-chart',
}) => {
  const data = useMemo(() => {
    const comparable = filterComparableHistoryRuns(runs, symbol, timeframe)
      .slice()
      .reverse()
      .slice(-12);
    return comparable.map((r) => ({
      runId: r.runId,
      label: new Date(r.startedAt).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
      }),
      adx: typeof r.snapshotSummary.adx === 'number' ? r.snapshotSummary.adx : null,
    }));
  }, [runs, symbol, timeframe, locale]);

  if (data.length < 2) {
    return (
      <p className="text-xs text-slate-400" data-testid={`${testId}-empty`}>
        {t('trend_history_chart_insufficient_filtered')}
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid={testId}>
      <p className="text-xs text-slate-400" data-testid={`${testId}-scope`}>
        {t('trend_history_chart_scope')}: <span dir="ltr">{symbol}</span> · <span dir="ltr">{timeframe}</span>
      </p>
      <div className="h-44 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 'auto']} tick={{ fontSize: 10 }} width={36} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }}
              formatter={(value, _name, item) => {
                const runId = (item?.payload as { runId?: string })?.runId;
                return [`${value} (${runId || ''})`, 'ADX'];
              }}
            />
            <Line
              type="monotone"
              dataKey="adx"
              name="ADX"
              stroke="#c084fc"
              dot
              strokeWidth={2}
              data-testid={`${testId}-line`}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="text-[10px] text-slate-500 space-y-0.5" data-testid={`${testId}-run-ids`}>
        {data.map((p) => (
          <li key={p.runId} dir="ltr">
            {p.label}: {p.adx} — {p.runId}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TrendHistoryTrendChart;
