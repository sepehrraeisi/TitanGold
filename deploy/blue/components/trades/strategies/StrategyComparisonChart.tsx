import React from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { Strategy } from '../../../types.ts';

interface StrategyComparisonChartProps {
    strategies: Strategy[];
}

const StrategyComparisonChart: React.FC<StrategyComparisonChartProps> = ({ strategies }) => {
    const { t } = useLanguage();
    const colors = ['#818cf8', '#a78bfa', '#f472b6', '#fb923c', '#4ade80'];

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('strategy_performance_comparison')}</h3>
            <div className="h-72 bg-gray-800/30 rounded-lg p-4 relative">
                {/* Placeholder for a real chart library */}
                <svg width="100%" height="100%" viewBox="0 0 500 200" preserveAspectRatio="none">
                    {/* Y-Axis labels */}
                    <text x="10" y="10" fill="#9ca3af" fontSize="10">150%</text>
                    <text x="10" y="100" fill="#9ca3af" fontSize="10">0%</text>
                    <text x="0" y="195" fill="#9ca3af" fontSize="10">-100%</text>
                    
                    {/* Grid Lines */}
                    <line x1="30" y1="0" x2="30" y2="200" stroke="#374151" strokeWidth="1" />
                    <line x1="30" y1="100" x2="500" y2="100" stroke="#4b5563" strokeWidth="1" strokeDasharray="2" />

                    {/* Chart lines */}
                    <polyline points="30,100 80,80 130,90 180,70 230,75 280,60 330,65 380,50 430,55 480,40" fill="none" stroke={colors[0]} strokeWidth="2" />
                    <polyline points="30,100 80,95 130,105 180,90 230,95 280,85 330,90 380,80 430,85 480,75" fill="none" stroke={colors[1]} strokeWidth="2" />
                    <polyline points="30,100 80,110 130,100 180,115 230,105 280,120 330,110 380,125 430,115 480,130" fill="none" stroke={colors[2]} strokeWidth="2" />

                </svg>
            </div>
             <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-4 text-xs">
                {strategies.slice(0, 5).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i] }}></div>
                        <span>{s.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StrategyComparisonChart;
