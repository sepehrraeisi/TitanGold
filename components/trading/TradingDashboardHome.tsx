import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { Asset, Trade } from '../../types.ts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.tsx';
import Button from '../ui/button.tsx';
import Skeleton from '../ui/skeleton.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.tsx';
import ScrollArea from '../ui/scroll-area.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';
import { cn } from '../../lib/utils.ts';

type SortKey = 'pair' | 'side' | 'price' | 'amount' | 'time';

type SortDirection = 'asc' | 'desc';

interface KPI {
  id: string;
  label: { en: string; fa: string };
  value: string;
  change?: string;
  positive?: boolean;
}

interface ChartPoint {
  timestamp: string;
  value: number;
}

type TimeRange = '1H' | '24H' | '7D' | '1M' | '1Y';

const chartSeeds: Record<TimeRange, ChartPoint[]> = {
  '1H': Array.from({ length: 12 }).map((_, i) => ({ timestamp: `${i * 5}`.padStart(2, '0'), value: 32000 + Math.sin(i / 2) * 420 })),
  '24H': Array.from({ length: 24 }).map((_, i) => ({ timestamp: `${i}`.padStart(2, '0'), value: 32500 + Math.cos(i / 3) * 650 })),
  '7D': Array.from({ length: 7 }).map((_, i) => ({ timestamp: `D${i + 1}`, value: 33100 + Math.sin(i / 1.5) * 1200 })),
  '1M': Array.from({ length: 30 }).map((_, i) => ({ timestamp: `${i + 1}`, value: 31500 + Math.sin(i / 3) * 1800 })),
  '1Y': Array.from({ length: 12 }).map((_, i) => ({ timestamp: `M${i + 1}`, value: 28000 + Math.sin(i / 1.5) * 2500 })),
};

const translations = {
  portfolioTitle: { en: 'Portfolio Assets', fa: 'دارایی‌های پورتفولیو' },
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
  portfolioEmpty: { en: 'No assets tracked yet.', fa: 'هنوز دارایی‌ای ثبت نشده است.' },
  loading: { en: 'Loading trading overview…', fa: 'در حال بارگذاری وضعیت معاملات…' },
};

const formatTime = (value: number): string => `${value.toString().padStart(2, '0')}:00`;

const TradingDashboardHome: React.FC = () => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedRange, setSelectedRange] = useState<TimeRange>('24H');
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [direction, setDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const timer = setTimeout(() => {
      setKpis([
        { id: 'value', label: translations.kpiAssets, value: '$271,406', change: '+3.1%', positive: true },
        { id: 'pnl', label: translations.kpiPnL, value: '+$5,482', change: '+2.9%', positive: true },
        { id: 'volume', label: translations.kpiVolume, value: '$1,240,000', change: '+11%', positive: true },
        { id: 'available', label: translations.kpiAvailable, value: '$86,500', change: '-4.5%', positive: false },
      ]);

      const mockTrades: Trade[] = [
        { id: '1', pair: 'BTC/USDT', side: 'buy', price: 48650, amount: 0.8, time: '2024-01-12T08:32:00Z' },
        { id: '2', pair: 'ETH/USDT', side: 'sell', price: 2680, amount: 12, time: '2024-01-12T07:58:00Z' },
        { id: '3', pair: 'SOL/USDT', side: 'buy', price: 98.4, amount: 180, time: '2024-01-12T07:10:00Z' },
        { id: '4', pair: 'XAU/USDT', side: 'buy', price: 2055, amount: 4, time: '2024-01-12T06:45:00Z' },
      ];

      const mockAssets: Asset[] = [
        { id: 'btc', name: 'Bitcoin', symbol: 'BTC', amount: 4.25, currentValue: 207_000, change24h: 2.4 },
        { id: 'eth', name: 'Ethereum', symbol: 'ETH', amount: 62, currentValue: 165_000, change24h: -1.2 },
        { id: 'sol', name: 'Solana', symbol: 'SOL', amount: 820, currentValue: 98_400, change24h: 6.8 },
        { id: 'xau', name: 'Gold Token', symbol: 'XAU', amount: 15, currentValue: 30_280, change24h: 0.5 },
      ];

      setTrades(mockTrades);
      setAssets(mockAssets);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

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

  const chartData = chartSeeds[selectedRange];

  const label = (key: keyof typeof translations) => translations[key][language];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 w-full rounded-xl" />)
          : kpis.map(metric => (
              <Card key={metric.id} className="bg-gradient-to-br from-[#111827] via-[#0e1625] to-[#111827]">
                <CardHeader className="mb-2 space-y-1.5">
                  <CardTitle className="text-sm text-gray-400">{metric.label[language]}</CardTitle>
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
            <CardTitle className="text-xl text-white">{label('priceChartTitle')}</CardTitle>
            <p className="text-sm text-gray-400">BTC / USDT</p>
          </div>
          <Tabs value={selectedRange} onValueChange={value => setSelectedRange(value as TimeRange)}>
            <TabsList>
              {(['1H', '24H', '7D', '1M', '1Y'] as TimeRange[]).map(range => (
                <TabsTrigger key={range} value={range}>
                  {range}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <TabsContent value={selectedRange} className="mt-6">
          {loading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <div className="relative h-64 w-full">
              <svg viewBox="0 0 400 200" className="h-full w-full">
                <defs>
                  <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline
                  fill="url(#chartFill)"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  points={chartData
                    .map((point, index) => {
                      const x = (index / Math.max(chartData.length - 1, 1)) * 400;
                      const normalized = (point.value - 26000) / 8000;
                      const y = 180 - normalized * 160;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />
                {chartData.map((point, index) => {
                  const x = (index / Math.max(chartData.length - 1, 1)) * 400;
                  const normalized = (point.value - 26000) / 8000;
                  const y = 180 - normalized * 160;
                  return <circle key={point.timestamp} cx={x} cy={y} r={2} fill="#93c5fd" />;
                })}
              </svg>
              <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4 text-xs text-gray-500">
                {chartData.slice(0, 6).map(point => (
                  <span key={point.timestamp}>{point.timestamp}</span>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle className="text-white">{label('tradesTitle')}</CardTitle>
            <Button variant="ghost" className="text-xs text-gray-400 hover:text-white">
              {label('viewAll')}
            </Button>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : trades.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center space-y-2 text-gray-400">
              <div className="rounded-full bg-gray-900/60 p-3">
                <svg className="h-6 w-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.5 9.4l-4.5 4.5-4.5-4.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v10.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.75 19.25h14.5" />
                </svg>
              </div>
              <p className="text-sm">{label('emptyTrades')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => handleSort('pair')} className="cursor-pointer">
                    {label('pair')}
                  </TableHead>
                  <TableHead onClick={() => handleSort('side')} className="cursor-pointer">
                    {label('type')}
                  </TableHead>
                  <TableHead onClick={() => handleSort('price')} className="cursor-pointer">
                    {label('price')}
                  </TableHead>
                  <TableHead onClick={() => handleSort('amount')} className="cursor-pointer">
                    {label('amount')}
                  </TableHead>
                  <TableHead onClick={() => handleSort('time')} className="cursor-pointer">
                    {label('time')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTrades.map(trade => (
                  <TableRow key={trade.id}>
                    <TableCell className="font-medium text-white">{trade.pair}</TableCell>
                    <TableCell>
                      <span className={cn('rounded-full px-2 py-1 text-xs font-medium', trade.side === 'buy' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300')}>
                        {trade.side === 'buy' ? (language === 'fa' ? 'خرید' : 'Buy') : language === 'fa' ? 'فروش' : 'Sell'}
                      </span>
                    </TableCell>
                    <TableCell>${trade.price.toLocaleString()}</TableCell>
                    <TableCell>{trade.amount}</TableCell>
                    <TableCell>{formatTime(new Date(trade.time).getUTCHours())}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="border border-gray-800/80">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle className="text-white">{label('portfolioTitle')}</CardTitle>
            <Button variant="ghost" className="text-xs text-gray-400 hover:text-white">
              {label('viewAll')}
            </Button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center space-y-2 text-gray-400">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="8" strokeWidth="1.5" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6" />
              </svg>
              <p className="text-sm">{label('portfolioEmpty')}</p>
            </div>
          ) : (
            <ScrollArea>
              <ul className="space-y-3">
                {assets.map(asset => (
                  <li
                    key={asset.id}
                    className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0d1321]/60 p-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-white">{asset.name}</p>
                      <p className="text-xs text-gray-400">{asset.symbol}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-300">
                        {asset.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500">${asset.currentValue.toLocaleString()}</p>
                    </div>
                    <span className={cn('text-xs font-semibold', asset.change24h >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {asset.change24h >= 0 ? '+' : ''}
                      {asset.change24h}%
                    </span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </Card>
      </div>
    </div>
  );
};

export default TradingDashboardHome;
