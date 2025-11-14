import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const AIPortfolioAnalysisWidget: React.FC = () => {
    const { t } = useLanguage();
    
    const insights = [
        { title: t('outperform_market'), desc: t('outperform_market_desc'), iconColor: 'text-green-400' },
        { title: t('high_btc_concentration'), desc: t('high_btc_concentration_desc'), iconColor: 'text-yellow-400' },
        { title: t('rebalance_opportunity'), desc: t('rebalance_opportunity_desc'), iconColor: 'text-blue-400' },
        { title: t('excellent_risk_management'), desc: t('excellent_risk_management_desc'), iconColor: 'text-purple-400' },
    ];

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <h3 className="font-semibold text-white mb-4">{t('ai_portfolio_analysis')}</h3>
            <div className="space-y-4">
                {insights.map(insight => (
                    <div key={insight.title} className="flex items-start gap-3">
                        <div className={`mt-1 ${insight.iconColor}`}>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white text-sm">{insight.title}</h4>
                            <p className="text-xs text-gray-400">{insight.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AIPortfolioAnalysisWidget;