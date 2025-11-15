import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { ManualTradingChartPoint } from '../../types.ts';

interface TradingChartWidgetProps {
    chart: ManualTradingChartPoint[];
}

const TradingChartWidget: React.FC<TradingChartWidgetProps> = ({ chart }) => {
    const { t } = useLanguage();

    const { linePoints, candles, volumes } = useMemo(() => {
        if (chart.length === 0) {
            return { linePoints: '', candles: [], volumes: [] } as const;
        }

        const width = 500;
        const height = 250;
        const paddingX = 24;
        const paddingY = 24;
        const drawableWidth = width - paddingX * 2;
        const drawableHeight = height - paddingY * 2;
        const prices = chart.flatMap(point => [point.open, point.close, point.high, point.low]);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice || 1;
        const volumes = chart.map(point => point.volume);
        const maxVolume = Math.max(...volumes) || 1;
        const candleWidth = Math.max(6, drawableWidth / Math.max(chart.length * 1.8, 12));
        const stepX = drawableWidth / Math.max(chart.length - 1, 1);

        const mapPriceToY = (price: number) => {
            const normalized = (price - minPrice) / priceRange;
            return height - paddingY - normalized * drawableHeight;
        };

        const linePoints = chart
            .map((point, index) => {
                const x = paddingX + index * stepX;
                const y = mapPriceToY(point.close);
                return `${x},${y}`;
            })
            .join(' ');

        const candles = chart.map((point, index) => {
            const xCenter = paddingX + index * stepX;
            const x = xCenter - candleWidth / 2;
            const highY = mapPriceToY(point.high);
            const lowY = mapPriceToY(point.low);
            const openY = mapPriceToY(point.open);
            const closeY = mapPriceToY(point.close);
            const isBullish = point.close >= point.open;
            const rectY = Math.min(openY, closeY);
            const rectHeight = Math.max(Math.abs(closeY - openY), 2);
            return {
                id: point.timestamp,
                x,
                width: candleWidth,
                highY,
                lowY,
                rectY,
                rectHeight,
                color: isBullish ? '#10b981' : '#f43f5e',
            };
        });

        const volumeBars = chart.map((point, index) => {
            const xCenter = paddingX + index * stepX;
            const x = xCenter - (candleWidth / 2);
            const barHeight = (point.volume / maxVolume) * (paddingY * 1.2);
            return {
                id: `${point.timestamp}-volume`,
                x,
                width: candleWidth,
                height: Math.max(barHeight, 4),
                y: height - barHeight - 4,
                color: point.close >= point.open ? '#10b981' : '#f43f5e',
            };
        });

        return { linePoints, candles, volumes: volumeBars } as const;
    }, [chart]);

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <div className="flex flex-wrap justify-between items-center mb-4">
                <h3 className="font-semibold text-white">{t('multi_dimensional_chart')}</h3>
                <div className="flex items-center gap-2 text-xs">
                    {['1H', '4H', '1D', 'AI'].map(range => (
                        <button
                            key={range}
                            className={`px-3 py-1 rounded-md border border-gray-700/70 ${range === 'AI' ? 'bg-purple-600/50 text-purple-200 border-purple-500/40' : 'bg-gray-700/40 text-gray-200 hover:bg-gray-700'}`}
                        >
                            {range === 'AI' ? t('ai_analysis') : range}
                        </button>
                    ))}
                </div>
            </div>
            <div className="h-96 w-full bg-[#0d0f19] rounded-md flex items-center justify-center">
                {chart.length === 0 ? (
                    <p className="text-xs text-gray-400">{t('manual_trades_empty_chart')}</p>
                ) : (
                    <svg width="100%" height="100%" viewBox="0 0 500 250" preserveAspectRatio="none">
                        {[1, 2, 3, 4].map(i => (
                            <line key={`row-${i}`} x1="0" y1={i * 50} x2="500" y2={i * 50} stroke="#2a2d42" strokeWidth="1" />
                        ))}
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                            <line key={`col-${i}`} x1={i * 50} y1="0" x2={i * 50} y2="250" stroke="#2a2d42" strokeWidth="1" />
                        ))}

                        {candles.map(candle => (
                            <g key={candle.id}>
                                <line
                                    x1={candle.x + candle.width / 2}
                                    y1={candle.highY}
                                    x2={candle.x + candle.width / 2}
                                    y2={candle.lowY}
                                    stroke={candle.color}
                                    strokeWidth="2"
                                />
                                <rect
                                    x={candle.x}
                                    y={candle.rectY}
                                    width={candle.width}
                                    height={candle.rectHeight}
                                    fill={candle.color}
                                    opacity={0.8}
                                    rx={1.5}
                                />
                            </g>
                        ))}

                        <polyline points={linePoints} fill="none" stroke="#4f46e5" strokeWidth="2" />

                        {volumes.map(bar => (
                            <rect
                                key={bar.id}
                                x={bar.x}
                                y={bar.y}
                                width={bar.width}
                                height={bar.height}
                                fill={bar.color}
                                opacity={0.4}
                            />
                        ))}
                    </svg>
                )}
            </div>
        </div>
    );
};

export default TradingChartWidget;
