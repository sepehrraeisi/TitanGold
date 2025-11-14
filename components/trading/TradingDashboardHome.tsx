import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { Asset, Trade, TradingKPI, TradingTimeRange, ChartPoint, TradingDashboardData } from '../../types.ts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.tsx';
import Button from '../ui/button.tsx';
import Skeleton from '../ui/skeleton.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.tsx';
import ScrollArea from '../ui/scroll-area.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';
import { cn } from '../../lib/utils.ts';
import { fetchTradingDashboardData, createSimulatedTrade } from '../../services/api.ts';

type SortKey = 'pair' | 'side' | 'price' | 'amount' | 'time';

type SortDirection = 'asc' | 'desc';

const createEmptyChart = (): Record<TradingTimeRange, ChartPoint[]> => ({
  '1H': [],
  '24H': [],
  '7D': [],
  '1M': [],
  '1Y': [],
});

const baseTranslations = {
  overviewTitle: { en: 'Trading Overview', fa: 'نمای کلی معاملات' },
  overviewSubtitle: {
    en: 'Monitor key metrics, live trades, and portfolio allocations in real-time.',
    fa: 'شاخص‌های کلیدی، معاملات زنده و وضعیت پورتفولیو را در لحظه دنبال کنید.',
  },
  loading: { en: 'Loading trading overview…', fa: 'در حال بارگذاری وضعیت معاملات…' },
  errorLoading: { en: 'Unable to load trading data.', fa: 'امکان بارگذاری داده‌های معاملاتی وجود ندارد.' },
  retry: { en: 'Retry', fa: 'تلاش مجدد' },
  lastUpdated: { en: 'Last updated', fa: 'آخرین به‌روزرسانی' },
  refresh: { en: 'Refresh Data', fa: 'به‌روزرسانی داده‌ها' },
  simulateTrade: { en: 'Simulate Trade', fa: 'شبیه‌سازی معامله' },
  kpiAssets: { en: 'Total Asset Value', fa: 'ارزش کل دارایی' },
  kpiPnL: { en: '24h Profit / Loss', fa: 'سود/زیان ۲۴ ساعته' },
  kpiVolume: { en: 'Trading Volume', fa: 'حجم معاملات' },
  kpiAvailable: { en: 'Available Balance', fa: 'موجودی قابل معامله' },
  priceChartTitle: { en: 'Price Performance', fa: 'نمودار قیمت' },
  tradesTitle: { en: 'Recent Trades', fa: 'معاملات اخیر' },
  emptyTrades: { en: 'No trades recorded yet.', fa: 'هنوز معامله‌ای ثبت نشده است.' },
  newTrade: { en: 'New Trade', fa: 'معامله جدید' },
  viewAll: { en: 'View All', fa: 'نمایش همه' },
  type: { en: 'Type', fa: 'نوع' },
  pair: { en: 'Pair', fa: 'جفت ارز' },
  price: { en: 'Price', fa: 'قیمت' },
  amount: { en: 'Amount', fa: 'مقدار' },
  time: { en: 'Time', fa: 'زمان' },
  portfolioTitle: { en: 'Portfolio Assets', fa: 'دارایی‌های پورتفولیو' },
  portfolioEmpty: { en: 'No assets tracked yet.', fa: 'هنوز دارایی‌ای ثبت نشده است.' },
  chartEmpty: { en: 'No chart data available for this range.', fa: 'اطلاعات نمودار برای این بازه موجود نیست.' },
};

const kpiLabels: Record<string, { en: string; fa: string }> = {
  trading_kpi_total_asset_value: baseTranslations.kpiAssets,
  trading_kpi_24h_pnl: baseTranslations.kpiPnL,
  trading_kpi_volume: baseTranslations.kpiVolume,
  trading_kpi_available_balance: baseTranslations.kpiAvailable,
};

const TradingDashboardHome: React.FC = () => {
  const { language } = useLanguage();
  const locale = language === 'fa' ? 'fa-IR' : 'en-US';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<TradingKPI[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [chartRanges, setChartRanges] = useState<Record<TradingTimeRange, ChartPoint[]>>(createEmptyChart());
  const [selectedRange, setSelectedRange] = useState<TradingTimeRange>('24H');
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [direction, setDirection] = useState<SortDirection>('desc');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const translate = (key: keyof typeof baseTranslations) => baseTranslations[key][language];

  const applyDashboard = useCallback((data: TradingDashboardData) => {
    setKpis(data.kpis);
    setTrades(data.trades);
    setAssets(data.assets);
    setChartRanges({ ...createEmptyChart(), ...data.chart });
    setLastUpdated(data.lastUpdated);
    setSelectedRange(prev => (data.chart[prev] ? prev : '24H'));
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTradingDashboardData();
      applyDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error');
    } finally {
      setLoading(false);
    }
  }, [applyDashboard]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const sortedTrades = useMemo(() => {
    const sorted = [...trades];
    sorted.sort((a, b) => {
      const multiplier = direction === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'pair':
          return multiplier * a.pair.localeCompare(b.pair);
        case 'side':
          return multiplier * a.side.localeCompare(b.side);
        case 'price':
          return multiplier * (a.price - b.price);
        case 'amount':
          return multiplier * (a.amount - b.amount);
        case 'time':
        default:
          return multiplier * (new Date(a.time).getTime() - new Date(b.time).getTime());
      }
    });
    return sorted;
  }, [trades, sortKey, direction]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setDirection('desc');
    }
  };

  const handleSimulateTrade = async () => {
    setIsSimulating(true);
    setError(null);
    try {
      const data = await createSimulatedTrade();
      applyDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error');
    } finally {
      setIsSimulating(false);
    }
  };

  const formattedUpdated = lastUpdated
    ? new Date(lastUpdated).toLocaleString(locale, { hour12: false })
    : null;

  const formatNumber = (value: number, maximumFractionDigits = 2) =>
    value.toLocaleString(locale, { maximumFractionDigits });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);

  const labelKpi = (key: string) => kpiLabels[key]?.[language] ?? key;

  const showTradesEmpty = !loading && sortedTrades.length === 0;
  const showAssetsEmpty = !loading && assets.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">{translate('overviewTitle')}</h2>
          <p className="text-sm text-gray-400">{translate('overviewSubtitle')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {formattedUpdated && (
            <span className="text-xs text-gray-400">
              {translate('lastUpdated')}: {formattedUpdated}
            </span>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!loading) {
                  void loadDashboard();
                }
              }}
              disabled={loading}
            >
              {translate('refresh')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSimulateTrade()}
              disabled={loading || isSimulating}
            >
              {isSimulating ? `${translate('simulateTrade')}…` : translate('simulateTrade')}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Card className="border border-red-500/40 bg-red-500/10">
          <CardContent className="flex flex-col gap-3 py-6 text-red-200 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">{translate('errorLoading')}</p>
              <p className="text-sm text-red-300/80">{error}</p>
            </div>
            <Button variant="outline" onClick={() => void loadDashboard()}>
              {translate('retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 w-full rounded-xl" />)
          : kpis.map(metric => (
              <Card key={metric.id} className="bg-gradient-to-br from-[#111827] via-[#0e1625] to-[#111827]">
                <CardHeader className="mb-2 space-y-1.5">
                  <CardTitle className="text-sm text-gray-400">{labelKpi(metric.labelKey)}</CardTitle>
                  <div className="text-2xl font-semibold text-white">{metric.value}</div>
                </CardHeader>
                {metric.change && (
                  <CardContent>
                    <span className={cn('text-sm font-medium', metric.positive ? 'text-emerald-400' : 'text-red-400')}>
                      {metric.change}
                    </span>
                  </CardContent>
                )}
              </Card>
            ))}
      </div>

      <Card className="border border-gray-800/60 bg-[#101528]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-xl text-white">{baseTranslations.priceChartTitle[language]}</CardTitle>
            <p className="text-sm text-gray-400">BTC / USDT</p>
          </div>
          <Tabs value={selectedRange} onValueChange={value => setSelectedRange(value as TradingTimeRange)}>
            <TabsList>
              {(['1H', '24H', '7D', '1M', '1Y'] as TradingTimeRange[]).map(range => (
                <TabsTrigger key={range} value={range}>
                  {range}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {(['1H', '24H', '7D', '1M', '1Y'] as TradingTimeRange[]).map(range => (
          <TabsContent key={range} value={range} className="mt-6">
            {loading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : chartRanges[range]?.length ? (
              <div className="relative h-64 w-full">
                <svg viewBox="0 0 400 200" className="h-full w-full">
                  <defs>
                    <linearGradient id={`chartFill-${range}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polyline
                    fill={`url(#chartFill-${range})`}
                    stroke="#3b82f6"
                    strokeWidth="2"
                    points={chartRanges[range]
                      .map((point, index) => {
                        const x = (index / Math.max(chartRanges[range].length - 1, 1)) * 400;
                        const normalized = (point.value - 26000) / 8000;
                        const y = 180 - normalized * 160;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                  {chartRanges[range].map((point, index) => {
                    const x = (index / Math.max(chartRanges[range].length - 1, 1)) * 400;
                    const normalized = (point.value - 26000) / 8000;
                    const y = 180 - normalized * 160;
                    return (
                      <g key={`${point.timestamp}-${index}`}>
                        <circle cx={x} cy={y} r={2.5} fill="#60a5fa" />
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="flex h-64 w-full items-center justify-center rounded-lg border border-dashed border-gray-700 text-sm text-gray-400">
                {baseTranslations.chartEmpty[language]}
              </div>
            )}
          </TabsContent>
        ))}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-white">{baseTranslations.tradesTitle[language]}</CardTitle>
            <Button variant="ghost" className="text-xs text-gray-400 hover:text-white">
              {baseTranslations.viewAll[language]}
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : showTradesEmpty ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-gray-400">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 5h18M3 12h18M3 19h18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm">{baseTranslations.emptyTrades[language]}</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead onClick={() => handleSort('pair')} className="cursor-pointer text-gray-400">
                        {baseTranslations.pair[language]}
                      </TableHead>
                      <TableHead onClick={() => handleSort('side')} className="cursor-pointer text-gray-400">
                        {baseTranslations.type[language]}
                      </TableHead>
                      <TableHead onClick={() => handleSort('price')} className="cursor-pointer text-gray-400">
                        {baseTranslations.price[language]}
                      </TableHead>
                      <TableHead onClick={() => handleSort('amount')} className="cursor-pointer text-gray-400">
                        {baseTranslations.amount[language]}
                      </TableHead>
                      <TableHead onClick={() => handleSort('time')} className="cursor-pointer text-gray-400">
                        {baseTranslations.time[language]}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTrades.map(trade => (
                      <TableRow key={trade.id}>
                        <TableCell className="font-medium text-white">{trade.pair}</TableCell>
                        <TableCell className={cn('uppercase', trade.side === 'buy' ? 'text-emerald-400' : 'text-red-400')}>
                          {trade.side}
                        </TableCell>
                        <TableCell className="text-gray-300">${formatNumber(trade.price, 2)}</TableCell>
                        <TableCell className="text-gray-300">{formatNumber(trade.amount, 4)}</TableCell>
                        <TableCell className="text-gray-400">
                          {new Date(trade.time).toLocaleString(locale, { hour12: false })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-white">{baseTranslations.portfolioTitle[language]}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full rounded-md" />
                ))}
              </div>
            ) : showAssetsEmpty ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-gray-400">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm">{baseTranslations.portfolioEmpty[language]}</span>
              </div>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-3 pr-2">
                  {assets.map(asset => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between rounded-lg border border-gray-800/70 bg-[#0f1424] p-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">{asset.name}</div>
                        <div className="text-xs uppercase text-gray-500">{asset.symbol}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">{formatCurrency(asset.currentValue)}</div>
                        <div className="text-xs text-gray-400">{formatNumber(asset.amount, 4)} {asset.symbol}</div>
                        <div className={cn('text-xs font-medium', asset.change24h >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TradingDashboardHome;
