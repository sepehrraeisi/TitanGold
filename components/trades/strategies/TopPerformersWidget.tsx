import React from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { Strategy } from '../../../types.ts';

interface TopPerformersWidgetProps {
    strategies: Strategy[];
}

const TopPerformersWidget: React.FC<TopPerformersWidgetProps> = ({ strategies }) => {
    const { t } = useLanguage();
    
    // Sort strategies by ROI descending and take top 3
    const topPerformers = [...strategies].sort((a, b) => b.roi - a.roi).slice(0, 3);

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-3">{t('top_performers')}</h3>
            <div className="space-y-3">
                {topPerformers.map((s, index) => (
                    <div key={s.id} className="flex justify-between items-center text-sm p-2 bg-gray-800/40 rounded-lg">
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-gray-400">{index + 1}</span>
                            <div>
                                <p className="font-semibold text-white">{s.name}</p>
                                <p className="text-xs text-gray-500">{s.type}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-green-400">{s.roi.toFixed(1)}%</p>
                            <p className="text-xs text-gray-400">{t('roi')}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TopPerformersWidget;
