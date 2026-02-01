import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { ManualTradingPerformancePoint } from '../../types.ts';

interface PerformanceAnalysisWidgetProps {
    performance: ManualTradingPerformancePoint[];
}

const PerformanceAnalysisWidget: React.FC<PerformanceAnalysisWidgetProps> = ({ performance }) => {
    const { t, language } = useLanguage();

    const { 
        linePoints, 
        areaPath, 
        minValue, 
        maxValue,
        currentValue,
        changePercent,
        chartWidth,
        chartHeight
    } = useMemo(() => {
        if (performance.length === 0) {
            return { 
                linePoints: '', 
                areaPath: '',
                minValue: 0,
                maxValue: 0,
                currentValue: 0,
                changePercent: 0,
                chartWidth: 300,
                chartHeight: 120,
            };
        }

        const paddingX = 20;
        const paddingY = 15;
        const width = 300;
        const height = 120;
        const values = performance.map(point => point.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const range = maxValue - minValue || 1;
        const stepX = (width - paddingX * 2) / Math.max(1, performance.length - 1);

        const coordinates = performance.map((point, index) => {
            const x = paddingX + index * stepX;
            const normalized = (point.value - minValue) / range;
            const y = height - paddingY - normalized * (height - paddingY * 2);
            return { x, y, value: point.value };
        });

        const polyline = coordinates.map(c => `${c.x},${c.y}`).join(' ');
        const firstCoord = coordinates[0];
        const lastCoord = coordinates[coordinates.length - 1];
        const area = `M${firstCoord.x},${height - paddingY} ${polyline} L${lastCoord.x},${height - paddingY} Z`;

        const currentValue = performance[performance.length - 1]?.value || 0;
        const previousValue = performance[performance.length - 2]?.value || currentValue;
        const changePercent = previousValue !== 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;

        return { 
            linePoints: polyline, 
            areaPath: area,
            minValue,
            maxValue,
            currentValue,
            changePercent,
            chartWidth: width,
            chartHeight: height,
        };
    }, [performance]);

    const formatValue = (value: number) => {
        return new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(value);
    };

    const isPositive = changePercent >= 0;

    return (
        <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-5 sm:p-6 shadow-lg">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-700/50">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/30 to-emerald-500/30 flex items-center justify-center shadow-lg shadow-green-500/20">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                </div>
                <div>
                    <h3 className="font-bold text-white text-lg">{t('performance_analysis')}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Trading performance</p>
                </div>
            </div>

            {performance.length === 0 ? (
                <div className="bg-gray-800/30 border border-dashed border-gray-700/50 rounded-xl p-8 text-center">
                    <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <p className="text-sm text-gray-400">{t('manual_trades_empty_performance')}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-3">
                            <div className="text-xs text-gray-400 mb-1">Current</div>
                            <div className="text-lg font-bold text-white">{formatValue(currentValue)}</div>
                        </div>
                        <div className={`bg-gradient-to-br ${isPositive ? 'from-green-500/20 to-emerald-500/10' : 'from-red-500/20 to-rose-500/10'} border ${isPositive ? 'border-green-500/30' : 'border-red-500/30'} rounded-lg p-3`}>
                            <div className="text-xs text-gray-400 mb-1">Change</div>
                            <div className={`text-lg font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                            </div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-gradient-to-br from-[#0d0f19] to-[#0a0c14] rounded-xl p-4 border border-gray-800/50">
                        <svg 
                            width="100%" 
                            height="120" 
                            viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                            preserveAspectRatio="xMidYMid meet"
                            className="w-full"
                        >
                            <defs>
                                <linearGradient id="performance-gradient" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                </linearGradient>
                                <filter id="glow">
                                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                    <feMerge>
                                        <feMergeNode in="coloredBlur"/>
                                        <feMergeNode in="SourceGraphic"/>
                                    </feMerge>
                                </filter>
                            </defs>
                            
                            {/* Grid Lines */}
                            {[1, 2, 3].map(i => (
                                <line 
                                    key={`grid-${i}`}
                                    x1="20" 
                                    y1={i * 30} 
                                    x2={chartWidth - 20} 
                                    y2={i * 30} 
                                    stroke="#2a2d42" 
                                    strokeWidth="1" 
                                    strokeDasharray="2,2"
                                />
                            ))}

                            {/* Area */}
                            <path 
                                d={areaPath} 
                                fill="url(#performance-gradient)" 
                            />
                            
                            {/* Line */}
                            <polyline 
                                points={linePoints} 
                                fill="none" 
                                stroke="#10b981" 
                                strokeWidth="2.5"
                                filter="url(#glow)"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>

                    {/* Min/Max Labels */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Min: {formatValue(minValue)}</span>
                        <span>Max: {formatValue(maxValue)}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PerformanceAnalysisWidget;
