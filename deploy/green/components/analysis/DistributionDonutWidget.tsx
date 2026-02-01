import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { AnalysisDistributionSlice } from '../../types.ts';

interface DonutProps {
    title: string;
    data: AnalysisDistributionSlice[];
}

const DistributionDonutWidget: React.FC<DonutProps> = ({ title, data }) => {
    const { t } = useLanguage();

    const { total, arcs } = useMemo(() => {
        const totalValue = data.reduce((sum, item) => sum + item.value, 0) || 1;
        let cumulative = 0;
        const segments = data.map(item => {
            const ratio = item.value / totalValue;
            const dasharray = ratio * 100;
            const dashoffset = cumulative;
            cumulative += dasharray;
            return { ...item, dasharray, dashoffset };
        });
        return { total: totalValue, arcs: segments };
    }, [data]);

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <h3 className="font-semibold text-white mb-4">{title}</h3>
            <div className="flex items-center justify-center gap-6">
                <div className="relative w-28 h-28">
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                        {arcs.map(item => (
                            <circle
                                key={item.id}
                                cx="18"
                                cy="18"
                                r="15.915"
                                fill="transparent"
                                stroke={item.color}
                                strokeWidth="4"
                                strokeDasharray={`${item.dasharray} ${100 - item.dasharray}`}
                                strokeDashoffset={-item.dashoffset}
                            />
                        ))}
                    </svg>
                </div>
                <div className="text-sm space-y-2">
                    {data.map(item => (
                        <div key={item.id} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                            <span>{t(item.labelKey)}</span>
                            <span className="font-bold text-gray-300">{item.value.toFixed(1)}%</span>
                        </div>
                    ))}
                    <p className="text-xs text-gray-500 pt-2">{t('total_trades_tracked', { count: Math.round(total) })}</p>
                </div>
            </div>
        </div>
    );
};

export default DistributionDonutWidget;