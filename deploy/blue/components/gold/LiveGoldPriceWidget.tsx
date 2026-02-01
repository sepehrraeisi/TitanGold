import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { GoldAsset, GoldPricePoint, GoldTimeRange } from '../../types.ts';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs.tsx';
import Button from '../ui/button.tsx';

interface LiveGoldPriceWidgetProps {
    assets: GoldAsset[];
    priceRanges: Record<GoldTimeRange, GoldPricePoint[]>;
    activeRange: GoldTimeRange;
    onRangeChange: (range: GoldTimeRange) => void;
    onRefresh: () => void;
    isRefreshing: boolean;
    lastUpdated?: string;
}

const ranges: GoldTimeRange[] = ['1D', '1W', '1M', '3M', '1Y'];

const formatPrice = (value: number): string => value.toLocaleString('en-US');

const LiveGoldPriceWidget: React.FC<LiveGoldPriceWidgetProps> = ({
    assets,
    priceRanges,
    activeRange,
    onRangeChange,
    onRefresh,
    isRefreshing,
    lastUpdated,
}) => {
    const { t, language } = useLanguage();
    const points = priceRanges[activeRange] ?? [];

    const chartPoints = useMemo(() => {
        if (points.length < 2) {
            return '';
        }
        const min = Math.min(...points.map(point => point.price));
        const max = Math.max(...points.map(point => point.price));
        const span = Math.max(max - min, 1);

        return points
            .map((point, index) => {
                const x = (index / (points.length - 1)) * 100;
                const y = 100 - ((point.price - min) / span) * 100;
                return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(' ');
    }, [points]);

    const latestPoint = points[points.length - 1];
    const firstPoint = points[0];
    const rangeChange = latestPoint && firstPoint
        ? ((latestPoint.price - firstPoint.price) / firstPoint.price) * 100
        : 0;

    const formattedUpdated = lastUpdated
        ? new Date(lastUpdated).toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US', { hour12: false })
        : null;

    return (
        <div className="bg-card border border-border rounded-lg">
            <div className="flex flex-col gap-4 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">{t('live_gold_prices')}</h3>
                    {formattedUpdated && (
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('last_updated', { time: formattedUpdated })}
                        </p>
                    )}
                </div>
                <Button
                    variant="outline"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="h-8 px-3 text-xs self-start md:self-auto"
                >
                    {isRefreshing ? t('loading') : t('refresh_market')}
                </Button>
            </div>

            <div className="space-y-4 p-4">
                <Tabs value={activeRange} onValueChange={value => onRangeChange(value as GoldTimeRange)}>
                    <TabsList className="grid grid-cols-5 bg-secondary/50">
                        {ranges.map(range => (
                            <TabsTrigger key={range} value={range} className="text-xs">
                                {t(`gold_range_${range}`)}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                <div className="relative">
                    <svg viewBox="0 0 100 40" className="h-24 w-full text-purple-400">
                        <polyline
                            points={chartPoints || '0,40 100,40'}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                    </svg>
                    {latestPoint && (
                        <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                            <div className="font-semibold text-foreground">
                                {t('current_price')}: {formatPrice(latestPoint.price)}
                            </div>
                            <div>
                                {t('change')}: <span className={rangeChange >= 0 ? 'text-positive' : 'text-negative'}>
                                    {rangeChange >= 0 ? '+' : ''}{rangeChange.toFixed(2)}%
                                </span>
                            </div>
                            <div>
                                {t('volume')}: {latestPoint.volume.toLocaleString('en-US')}
                            </div>
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase">
                            <tr>
                                <th className="px-4 py-3">{t('asset')}</th>
                                <th className="px-4 py-3 text-right">{t('buy_price')} (IRR)</th>
                                <th className="px-4 py-3 text-right">{t('sell_price')} (IRR)</th>
                                <th className="px-4 py-3 text-right">{t('change')}</th>
                            </tr>
                        </thead>
                        <tbody className="text-card-foreground">
                            {assets.map(asset => (
                                <tr key={asset.id} className="border-t border-border">
                                    <td className="px-4 py-3 font-semibold">{asset.name}</td>
                                    <td className="px-4 py-3 font-mono text-right">{formatPrice(asset.buyPrice)}</td>
                                    <td className="px-4 py-3 font-mono text-right">{formatPrice(asset.sellPrice)}</td>
                                    <td
                                        className={`px-4 py-3 font-semibold text-right ${asset.change >= 0 ? 'text-positive' : 'text-negative'}`}
                                    >
                                        {asset.change >= 0 ? '+' : ''}{asset.change.toFixed(2)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LiveGoldPriceWidget;