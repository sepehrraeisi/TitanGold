import React, { useMemo, useState, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { ManualTradingChartPoint } from '../../types.ts';

interface TradingChartWidgetProps {
    chart: ManualTradingChartPoint[];
    onTimeframeChange?: (timeframe: string) => void;
}

const TradingChartWidget: React.FC<TradingChartWidgetProps> = ({ chart, onTimeframeChange }) => {
    const { t, language } = useLanguage();
    const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1H');
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const timeframes = [
        { key: '1H', label: '1H' },
        { key: '4H', label: '4H' },
        { key: '1D', label: '1D' },
        { key: '1W', label: '1W' },
        { key: 'AI', label: t('ai_analysis') },
    ];

    const { 
        linePoints, 
        candles, 
        volumes, 
        priceLabels, 
        minPrice, 
        maxPrice,
        chartWidth,
        chartHeight,
        paddingX,
        paddingY,
        drawableWidth,
        drawableHeight
    } = useMemo(() => {
        if (chart.length === 0) {
            return {
                linePoints: '',
                candles: [],
                volumes: [],
                priceLabels: [],
                minPrice: 0,
                maxPrice: 0,
                chartWidth: 1200,
                chartHeight: 600,
                paddingX: 80,
                paddingY: 50,
                drawableWidth: 1040,
                drawableHeight: 450,
            };
        }

        // 🎯 Larger chart for better visibility (international standard)
        const width = 1200;
        const height = 600;
        const paddingX = 80;
        const paddingY = 50;
        const volumeHeight = 80;
        const drawableWidth = width - paddingX * 2;
        const drawableHeight = height - paddingY - volumeHeight;
        
        const prices = chart.flatMap(point => [point.open, point.close, point.high, point.low]);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice || 1;
        const volumes = chart.map(point => point.volume);
        const maxVolume = Math.max(...volumes) || 1;
        const candleWidth = Math.max(4, drawableWidth / Math.max(chart.length * 1.5, 20));
        const stepX = drawableWidth / Math.max(chart.length - 1, 1);

        const mapPriceToY = (price: number) => {
            const normalized = (price - minPrice) / priceRange;
            return paddingY + (1 - normalized) * drawableHeight;
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
                xCenter,
                width: candleWidth,
                highY,
                lowY,
                rectY,
                rectHeight,
                color: isBullish ? '#10b981' : '#ef4444',
                price: point.close,
                timestamp: point.timestamp,
            };
        });

        const volumeBars = chart.map((point, index) => {
            const xCenter = paddingX + index * stepX;
            const x = xCenter - (candleWidth / 2);
            const barHeight = (point.volume / maxVolume) * volumeHeight;
            return {
                id: `${point.timestamp}-volume`,
                x,
                width: candleWidth,
                height: Math.max(barHeight, 2),
                y: height - barHeight,
                color: point.close >= point.open ? '#10b981' : '#ef4444',
            };
        });

        // Generate price labels
        const numLabels = 5;
        const priceLabels = Array.from({ length: numLabels }, (_, i) => {
            const price = minPrice + (maxPrice - minPrice) * (i / (numLabels - 1));
            const y = mapPriceToY(price);
            return { price, y };
        });

        return { 
            linePoints, 
            candles, 
            volumes: volumeBars,
            priceLabels,
            minPrice,
            maxPrice,
            chartWidth: width,
            chartHeight: height,
            paddingX,
            paddingY,
            drawableWidth,
            drawableHeight: drawableHeight + volumeHeight,
        };
    }, [chart]);

    const formatPrice = useCallback((price: number) => {
        return new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(price);
    }, [language]);

    const handleTimeframeChange = useCallback((timeframe: string) => {
        setSelectedTimeframe(timeframe);
        onTimeframeChange?.(timeframe);
    }, [onTimeframeChange]);

    const hoveredCandle = hoveredIndex !== null ? candles[hoveredIndex] : null;

    return (
        <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-4 sm:p-6 shadow-lg">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 pb-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">{t('multi_dimensional_chart')}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Real-time price action</p>
                    </div>
                </div>
                
                {/* Timeframe Selector */}
                <div className="flex items-center gap-2 flex-wrap">
                    {timeframes.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => handleTimeframeChange(key)}
                            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
                                selectedTimeframe === key
                                    ? key === 'AI'
                                        ? 'bg-gradient-to-r from-purple-600/50 to-blue-600/50 text-white border border-purple-500/50 shadow-lg shadow-purple-500/20'
                                        : 'bg-gradient-to-r from-purple-600/40 to-blue-600/40 text-white border border-purple-500/50 shadow-lg shadow-purple-500/20'
                                    : 'bg-gray-700/40 text-gray-300 border border-gray-700 hover:bg-gray-700/60 hover:border-gray-600'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart Container */}
            <div className="relative bg-gradient-to-br from-[#0d0f19] to-[#0a0c14] rounded-xl p-4 border border-gray-800/50">
                {chart.length === 0 ? (
                    <div className="h-[400px] flex items-center justify-center">
                        <div className="text-center">
                            <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <p className="text-sm text-gray-400">{t('manual_trades_empty_chart')}</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Price Info Tooltip */}
                        {hoveredCandle && (
                            <div 
                                className="absolute z-20 bg-gray-900/95 border border-gray-700 rounded-lg p-3 shadow-xl pointer-events-none"
                                style={{
                                    left: `${hoveredCandle.xCenter}px`,
                                    top: `${hoveredCandle.rectY - 60}px`,
                                    transform: 'translateX(-50%)',
                                }}
                            >
                                <div className="text-xs space-y-1">
                                    <div className="text-white font-semibold">{formatPrice(hoveredCandle.price)}</div>
                                    <div className="text-gray-400">
                                        {new Date(hoveredCandle.timestamp).toLocaleTimeString(language === 'fa' ? 'fa-IR' : 'en-US')}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Chart SVG */}
                        <div className="relative overflow-hidden rounded-lg">
                            <svg 
                                width="100%" 
                                height="400" 
                                viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                                preserveAspectRatio="xMidYMid meet"
                                className="w-full"
                            >
                                {/* Grid Lines - Horizontal */}
                                {priceLabels.map((label, i) => (
                                    <g key={`grid-h-${i}`}>
                                        <line 
                                            x1={paddingX} 
                                            y1={label.y} 
                                            x2={chartWidth - paddingX} 
                                            y2={label.y} 
                                            stroke="#2a2d42" 
                                            strokeWidth="1" 
                                            strokeDasharray="2,2"
                                        />
                                        <text 
                                            x={paddingX - 10} 
                                            y={label.y + 4} 
                                            fill="#6b7280" 
                                            fontSize="10" 
                                            textAnchor="end"
                                            className="font-mono"
                                        >
                                            {formatPrice(label.price)}
                                        </text>
                                    </g>
                                ))}

                                {/* Grid Lines - Vertical */}
                                {Array.from({ length: 6 }, (_, i) => {
                                    const x = paddingX + (i * (drawableWidth / 5));
                                    return (
                                        <line 
                                            key={`grid-v-${i}`}
                                            x1={x} 
                                            y1={paddingY} 
                                            x2={x} 
                                            y2={chartHeight - 60} 
                                            stroke="#2a2d42" 
                                            strokeWidth="1" 
                                            strokeDasharray="2,2"
                                        />
                                    );
                                })}

                                {/* Volume Bars */}
                                {volumes.map(bar => (
                                    <rect
                                        key={bar.id}
                                        x={bar.x}
                                        y={bar.y}
                                        width={bar.width}
                                        height={bar.height}
                                        fill={bar.color}
                                        opacity={0.3}
                                        rx={1}
                                    />
                                ))}

                                {/* Candlesticks */}
                                {candles.map((candle, index) => (
                                    <g 
                                        key={candle.id}
                                        onMouseEnter={() => setHoveredIndex(index)}
                                        onMouseLeave={() => setHoveredIndex(null)}
                                        className="cursor-pointer"
                                    >
                                        {/* Wick */}
                                        <line
                                            x1={candle.xCenter}
                                            y1={candle.highY}
                                            x2={candle.xCenter}
                                            y2={candle.lowY}
                                            stroke={candle.color}
                                            strokeWidth="1.5"
                                            opacity={hoveredIndex === index ? 1 : 0.8}
                                        />
                                        {/* Body */}
                                        <rect
                                            x={candle.x}
                                            y={candle.rectY}
                                            width={candle.width}
                                            height={candle.rectHeight}
                                            fill={candle.color}
                                            opacity={hoveredIndex === index ? 1 : 0.9}
                                            rx={1}
                                            className="transition-opacity duration-200"
                                        />
                                    </g>
                                ))}

                                {/* Price Line */}
                                <polyline 
                                    points={linePoints} 
                                    fill="none" 
                                    stroke="#6366f1" 
                                    strokeWidth="2" 
                                    opacity="0.6"
                                    className="drop-shadow-lg"
                                />

                                {/* Hover Line */}
                                {hoveredIndex !== null && (
                                    <line
                                        x1={candles[hoveredIndex].xCenter}
                                        y1={paddingY}
                                        x2={candles[hoveredIndex].xCenter}
                                        y2={chartHeight - 60}
                                        stroke="#6366f1"
                                        strokeWidth="1"
                                        strokeDasharray="4,4"
                                        opacity="0.5"
                                    />
                                )}
                            </svg>
                        </div>

                        {/* Chart Info */}
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700/50">
                            <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded bg-green-500" />
                                    <span className="text-gray-400">Bullish</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded bg-red-500" />
                                    <span className="text-gray-400">Bearish</span>
                                </div>
                            </div>
                            <div className="text-xs text-gray-500">
                                {chart.length} {t('candles') || 'candles'}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TradingChartWidget;
