import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const MarketSentimentWidget: React.FC = () => {
    const { t } = useLanguage();
    
    const sentiments = [
        { asset: 'BTC Sentiment', bullish: 75, neutral: 15, bearish: 10 },
        { asset: 'ETH Sentiment', bullish: 60, neutral: 30, bearish: 10 },
    ];

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('market_sentiment')}</h3>
            <div className="space-y-4">
                {sentiments.map(s => (
                    <div key={s.asset}>
                        <p className="text-sm font-semibold text-gray-300 mb-1">{s.asset}</p>
                        <div className="flex h-2 rounded-full overflow-hidden">
                            <div className="bg-green-500" style={{ width: `${s.bullish}%` }}></div>
                            <div className="bg-yellow-500" style={{ width: `${s.neutral}%` }}></div>
                            <div className="bg-red-500" style={{ width: `${s.bearish}%` }}></div>
                        </div>
                         <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>{s.bullish}% {t('bullish')}</span>
                             <span>{s.bearish}% {t('bearish')}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MarketSentimentWidget;