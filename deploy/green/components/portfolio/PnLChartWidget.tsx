import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { PortfolioPerformancePoint, PortfolioTimeRange } from '../../types.ts';
import Button from '../ui/button.tsx';

interface PnLChartWidgetProps {
    performance: Record<PortfolioTimeRange, PortfolioPerformancePoint[]>;
    selectedRange: PortfolioTimeRange;
    onRangeChange: (range: PortfolioTimeRange) => void;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

const chartWidth = 520;
const chartHeight = 220;
const paddingX = 36;
const paddingY = 28;

const rangeLabels: Record<PortfolioTimeRange, string> = {
    '1W': 'portfolio_range_1w',
    '1M': 'portfolio_range_1m',
    '3M': 'portfolio_range_3m',
    '6M': 'portfolio_range_6m',
    '1Y': 'portfolio_range_1y',
};

const PnLChartWidget: React.FC<PnLChartWidgetProps> = ({
    performance,
    selectedRange,
    onRangeChange,
    onRefresh,
    isRefreshing,
}) => {
    const { t, language } = useLanguage();

    const ranges = useMemo(
        () => Object.keys(performance) as PortfolioTimeRange[],
        [performance],
    );

    const points = performance[selectedRange] ?? [];

    const currencyFormatter = useMemo(
        () =>
            new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
            }),
        [language],
    );

    const percentFormatter = useMemo(
        () =>
            new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
            }),
        [language],
    );

    const { polyline, benchmarkLine, fillPath, summary } = useMemo(() => {
        if (points.length === 0) {
            return {
                polyline: '',
                benchmarkLine: '',
                fillPath: '',
                summary: null as null | {
                    latest: string;
                    change: string;
                    positive: boolean;
                },
            };
        }

        const values = points.map(point => point.value);
        const benchmarks = points.map(point => point.benchmark ?? point.value * 0.97);
        const minValue = Math.min(...values, ...benchmarks);
        const maxValue = Math.max(...values, ...benchmarks);
        const span = Math.max(maxValue - minValue, 1);
        const horizontalSpace = Math.max(points.length - 1, 1);

        const toCoords = (value: number, index: number) => {
            const x = paddingX + (index / horizontalSpace) * (chartWidth - paddingX * 2);
            const y =
                chartHeight -
                paddingY -
                ((value - minValue) / span) * (chartHeight - paddingY * 2);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        };

        const polylinePoints = points.map((point, index) => toCoords(point.value, index));
        const benchmarkPoints = points.map((point, index) => toCoords(point.benchmark ?? point.value * 0.97, index));

        const fillCoordinates = [
            `${paddingX},${chartHeight - paddingY}`,
            ...polylinePoints,
            `${chartWidth - paddingX},${chartHeight - paddingY}`,
        ];

        const startValue = points[0].value;
        const latestValue = points[points.length - 1].value;
        const changeValue = latestValue - startValue;
        const changePercent = startValue === 0 ? 0 : (changeValue / startValue) * 100;

        const changeLabel = changeValue >= 0
            ? t('portfolio_gain', {
                percent: percentFormatter.format(Math.abs(changePercent)),
                amount: currencyFormatter.format(Math.abs(changeValue)),
            })
            : t('portfolio_loss', {
                percent: percentFormatter.format(Math.abs(changePercent)),
                amount: currencyFormatter.format(Math.abs(changeValue)),
            });

        return {
            polyline: polylinePoints.join(' '),
            benchmarkLine: benchmarkPoints.join(' '),
            fillPath: fillCoordinates.join(' '),
            summary: {
                latest: currencyFormatter.format(latestValue),
                change: changeLabel,
                positive: changeValue >= 0,
            },
        };
    }, [points, currencyFormatter, percentFormatter, t]);

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
                <div>
                    <h3 className="font-semibold text-white">{t('advanced_pnl_chart')}</h3>
                    {summary && (
                        <div className="mt-1 text-xs text-gray-400">
                            <span className="text-sm font-semibold text-white mr-2">{summary.latest}</span>
                            <span className={summary.positive ? 'text-green-400' : 'text-red-400'}>
                                {summary.change}
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                    {ranges.map(range => (
                        <button
                            key={range}
                            onClick={() => onRangeChange(range)}
                            className={`px-3 py-1 rounded-md transition-colors ${
                                selectedRange === range
                                    ? 'bg-purple-600/60 text-purple-100'
                                    : 'bg-gray-700/40 hover:bg-gray-700/70 text-gray-300'
                            }`}
                        >
                            {t(rangeLabels[range])}
                        </button>
                    ))}
                    {onRefresh && (
                        <Button
                            variant="outline"
                            className="text-xs h-8"
                            onClick={onRefresh}
                            disabled={isRefreshing}
                        >
                            {isRefreshing ? t('updating') : t('refresh')}
                        </Button>
                    )}
                </div>
            </div>
            <div className="h-64 bg-gray-800/20 rounded-md">
                {points.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-gray-400">
                        {t('no_performance_data')}
                    </div>
                ) : (
                    <svg
                        width="100%"
                        height="100%"
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                        preserveAspectRatio="none"
                    >
                        <defs>
                            <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgba(129, 140, 248, 0.35)" />
                                <stop offset="100%" stopColor="rgba(129, 140, 248, 0)" />
                            </linearGradient>
                        </defs>
                        <polyline
                            points={fillPath}
                            fill="url(#portfolioGradient)"
                            stroke="none"
                        />
                        <polyline
                            points={polyline}
                            fill="none"
                            stroke="#818cf8"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                        <polyline
                            points={benchmarkLine}
                            fill="none"
                            stroke="#a78bfa"
                            strokeWidth="1.5"
                            strokeDasharray="6,6"
                            strokeLinecap="round"
                        />
                        <text x={paddingX} y={paddingY} fill="#818cf8" fontSize="12">
                            {t('portfolio_value')}
                        </text>
                        <text x={paddingX} y={paddingY + 14} fill="#a78bfa" fontSize="12">
                            {t('moving_average')}
                        </text>
                    </svg>
                )}
            </div>
        </div>
    );
};

export default PnLChartWidget;