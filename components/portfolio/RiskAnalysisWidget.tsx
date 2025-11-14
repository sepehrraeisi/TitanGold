import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const RiskAnalysisWidget: React.FC = () => {
    const { t } = useLanguage();
    
    // Static points for a hexagon radar chart
    const points = "80,15 139,45 139,105 80,135 21,105 21,45";

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('risk_analysis')}</h3>
            <div className="h-48 flex items-center justify-center">
                 <svg viewBox="0 0 160 150" className="w-full h-full">
                    {/* Labels */}
                    <text x="80" y="10" textAnchor="middle" fontSize="10" fill="#9ca3af">{t('var')}</text>
                    <text x="145" y="45" textAnchor="middle" fontSize="10" fill="#9ca3af">{t('drawdown')}</text>
                    <text x="145" y="110" textAnchor="middle" fontSize="10" fill="#9ca3af">{t('volatility')}</text>
                    <text x="80" y="150" textAnchor="middle" fontSize="10" fill="#9ca3af">{t('sharpe')}</text>
                    <text x="15" y="110" textAnchor="middle" fontSize="10" fill="#9ca3af">{t('diversity')}</text>
                    <text x="15" y="45" textAnchor="middle" fontSize="10" fill="#9ca3af">{t('liquidity')}</text>

                    {/* Radar grid lines */}
                    <polygon points={points} fill="none" stroke="#374151" />
                    <line x1="80" y1="75" x2="80" y2="15" stroke="#374151" />
                    <line x1="80" y1="75" x2="139" y2="45" stroke="#374151" />
                    <line x1="80" y1="75" x2="139" y2="105" stroke="#374151" />
                    <line x1="80" y1="75" x2="80" y2="135" stroke="#374151" />
                    <line x1="80" y1="75" x2="21" y2="105" stroke="#374151" />
                    <line x1="80" y1="75" x2="21" y2="45" stroke="#374151" />
                    
                    {/* Data polygon */}
                    <polygon points="80,30 110,55 120,90 80,120 40,95 50,60" fill="rgba(167, 139, 250, 0.3)" stroke="#a78bfa" strokeWidth="2" />
                </svg>
            </div>
        </div>
    );
};

export default RiskAnalysisWidget;