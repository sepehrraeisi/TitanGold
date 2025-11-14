import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { RiskMetric } from '../../types.ts';

interface RiskMetricsWidgetProps {
    metrics: RiskMetric[];
}

const RiskMetricsWidget: React.FC<RiskMetricsWidgetProps> = ({ metrics }) => {
    const { t } = useLanguage();

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-white">{t('risk_metrics')}</h3>
                <button className="text-xs text-purple-400 hover:underline">{t('manage_transactions')}</button>
            </div>
             <div className="space-y-2 text-sm">
                {metrics.map(m => (
                    <div key={m.label} className="flex justify-between items-center">
                        <span className="text-gray-400">{t(m.label)}</span>
                        <span className="font-semibold text-white">{m.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RiskMetricsWidget;