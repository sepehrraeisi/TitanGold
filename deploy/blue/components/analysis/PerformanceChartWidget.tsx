import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { AnalysisPerformancePoint, AnalysisTimeRange } from '../../types.ts';

interface PerformanceChartWidgetProps {
    range: AnalysisTimeRange;
    performance: Record<AnalysisTimeRange, AnalysisPerformancePoint[]>;
    onRangeChange: (range: AnalysisTimeRange) => void;
    onRefresh: () => void;
    isUpdating: boolean;
    lastUpdatedLabel?: string;
}

const ranges: AnalysisTimeRange[] = ['1W', '1M', '3M', '6M', '1Y'];

const PerformanceChartWidget: React.FC<PerformanceChartWidgetProps> = ({
    range,
    performance,
    onRangeChange,
    onRefresh,
    isUpdating,
    lastUpdatedLabel,
}) => {
    const { t } = useLanguage();
    const series = performance[range] ?? [];

    const { linePoints, areaPoints } = useMemo(() => {
        if (series.length === 0) {
            return { linePoints: '', areaPoints: '' };
        }

        const width = 500;
        const height = 220;
        const paddingX = 32;
        const paddingY = 24;
        const drawableWidth = width - paddingX * 2;
        const drawableHeight = height - paddingY * 2;
        const equities = series.map(point => point.equity);
        const minEquity = Math.min(...equities);
        const maxEquity = Math.max(...equities);
        const rangeEquity = maxEquity - minEquity || 1;

        const mapPoint = (point: AnalysisPerformancePoint, index: number) => {
            const x = paddingX + (index / Math.max(series.length - 1, 1)) * drawableWidth;
            const normalized = (point.equity - minEquity) / rangeEquity;
            const y = height - paddingY - normalized * drawableHeight;
            return { x, y };
        };

        const coordinates = series.map(mapPoint);
        const line = coordinates.map(point => `${point.x},${point.y}`).join(' ');
        const area = `${coordinates.map(point => `${point.x},${point.y}`).join(' ')} ${paddingX + drawableWidth},${height - paddingY} ${paddingX},${height - paddingY}`;

        return { linePoints: line, areaPoints: area };
    }, [series]);

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                <div>
                    <h3 className="font-semibold text-white">{t('portfolio_performance_chart')}</h3>
                    {lastUpdatedLabel && <p className="text-xs text-gray-500 mt-1">{lastUpdatedLabel}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 text-xs">
                        {ranges.map(option => (
                            <button
                                key={option}
                                onClick={() => onRangeChange(option)}
                                disabled={isUpdating || range === option}
                                className={`px-3 py-1 rounded-md border ${range === option ? 'bg-purple-600/80 border-purple-500 text-white' : 'bg-gray-700/50 border-gray-600 text-gray-200 hover:bg-gray-700'} disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                                {t(`portfolio_range_${option.toLowerCase()}`)}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isUpdating}
                        className="text-xs px-3 py-1 rounded-md border border-gray-600 text-gray-200 hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isUpdating ? t('updating') : t('refresh')}
                    </button>
                </div>
            </div>
            <div className="h-64 bg-gray-800/20 rounded-md flex items-center justify-center overflow-hidden">
                {series.length === 0 ? (
                    <p className="text-xs text-gray-500">{t('no_performance_data')}</p>
                ) : (
                    <svg width="100%" height="100%" viewBox="0 0 500 220" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="analysisAreaGradient" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <rect x="0" y="0" width="500" height="220" fill="#111321" />
                        <polygon points={areaPoints} fill="url(#analysisAreaGradient)" opacity={0.8} />
                        <polyline points={linePoints} fill="none" stroke="#a855f7" strokeWidth="2" />
                    </svg>
                )}
            </div>
        </div>
    );
};

export default PerformanceChartWidget;