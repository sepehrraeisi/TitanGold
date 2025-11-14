import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { ManualTradingPerformancePoint } from '../../types.ts';

interface PerformanceAnalysisWidgetProps {
    performance: ManualTradingPerformancePoint[];
}

const PerformanceAnalysisWidget: React.FC<PerformanceAnalysisWidgetProps> = ({ performance }) => {
    const { t } = useLanguage();

    const { linePoints, areaPath } = useMemo(() => {
        if (performance.length === 0) {
            return { linePoints: '', areaPath: '' };
        }

        const paddingX = 10;
        const paddingY = 12;
        const width = 200;
        const height = 80;
        const values = performance.map(point => point.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const range = maxValue - minValue || 1;
        const stepX = (width - paddingX * 2) / Math.max(1, performance.length - 1);

        const coordinates = performance.map((point, index) => {
            const x = paddingX + index * stepX;
            const normalized = (point.value - minValue) / range;
            const y = height - paddingY - normalized * (height - paddingY * 2);
            return `${x},${y}`;
        });

        const polyline = coordinates.join(' ');
        const area = `M${coordinates[0]} ${coordinates.slice(1).join(' ')} L${width - paddingX},${height - paddingY} L${paddingX},${height - paddingY} Z`;

        return { linePoints: polyline, areaPath: area };
    }, [performance]);

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('performance_analysis')}</h3>
            <div className="h-32 w-full bg-[#0d0f19] rounded-md flex items-center justify-center">
                {performance.length === 0 ? (
                    <p className="text-xs text-gray-400">{t('manual_trades_empty_performance')}</p>
                ) : (
                    <svg width="100%" height="100%" viewBox="0 0 200 80" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="manual-performance-gradient" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <polyline points={linePoints} fill="none" stroke="#818cf8" strokeWidth="2" />
                        <path d={areaPath} fill="url(#manual-performance-gradient)" />
                    </svg>
                )}
            </div>
        </div>
    );
};

export default PerformanceAnalysisWidget;
