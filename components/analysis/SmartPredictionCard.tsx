import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { SmartPrediction } from '../../types.ts';

interface SmartPredictionCardProps {
    prediction: SmartPrediction;
}

const SmartPredictionCard: React.FC<SmartPredictionCardProps> = ({ prediction }) => {
    const { t } = useLanguage();

    const trendColor = {
        Bullish: 'text-green-400 border-green-500',
        Neutral: 'text-yellow-400 border-yellow-500',
        Bearish: 'text-red-400 border-red-500',
    };
    
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full flex flex-col">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold text-lg text-white">{prediction.symbol}</h4>
                    <p className={`text-sm font-semibold ${trendColor[prediction.trend]}`}>{t(prediction.trend.toLowerCase())}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-400">{t('target_price_label')}</p>
                    <p className="font-semibold text-white">{prediction.targetPrice}</p>
                </div>
            </div>

            <div className="my-3">
                <p className="text-xs text-gray-400">{t('analysis')}: <span className="text-gray-300">{prediction.analysis}</span></p>
            </div>
            
            <div className="mt-auto">
                <p className="text-xs text-gray-400">{t('confidence')}: {prediction.confidence}%</p>
                <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                    <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${prediction.confidence}%` }}></div>
                </div>
            </div>
        </div>
    );
};

export default SmartPredictionCard;