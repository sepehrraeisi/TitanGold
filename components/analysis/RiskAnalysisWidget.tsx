import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const RiskAnalysisWidget: React.FC = () => {
    const { t } = useLanguage();

    const metrics = [
        { label: `VaR 95%`, value: '$2,850', subValue: t('max_drawdown') },
        { label: t('risk_reward_ratio'), value: '1:3.2', subValue: t('optimal_ratio') },
        { label: t('volatility'), value: '12.8%', subValue: t('annual_volatility') },
    ];
    
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <h3 className="font-semibold text-white mb-4">{t('risk_analysis')}</h3>
            <div className="space-y-3">
                {metrics.map(metric => (
                    <div key={metric.label} className="flex justify-between items-center p-2 bg-gray-800/30 rounded-md">
                        <div>
                            <p className="text-sm text-gray-300">{metric.label}</p>
                            <p className="text-xs text-gray-500">{metric.subValue}</p>
                        </div>
                        <p className="text-lg font-bold text-white">{metric.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RiskAnalysisWidget;