import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { SmartPrediction } from '../../types.ts';

interface SmartPredictionCardProps {
    prediction: SmartPrediction;
    onRegenerate?: (id: string) => void;
    isProcessing?: boolean;
}

const SmartPredictionCard: React.FC<SmartPredictionCardProps> = ({ prediction, onRegenerate, isProcessing }) => {
    const { t } = useLanguage();

    const trendColor = {
        Bullish: 'text-green-400 border-green-500',
        Neutral: 'text-yellow-400 border-yellow-500',
        Bearish: 'text-red-400 border-red-500',
    } as const;

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full flex flex-col">
            <div className="flex justify-between items-start gap-3">
                <div>
                    <h4 className="font-bold text-lg text-white">{prediction.symbol}</h4>
                    <p className={`text-sm font-semibold ${trendColor[prediction.trend]}`}>{t(prediction.trend.toLowerCase())}</p>
                </div>
                <div className="text-right space-y-1">
                    <div>
                        <p className="text-xs text-gray-400">{t('target_price_label')}</p>
                        <p className="font-semibold text-white">{prediction.targetPrice}</p>
                    </div>
                    {onRegenerate && (
                        <button
                            type="button"
                            onClick={() => onRegenerate(prediction.id)}
                            disabled={isProcessing}
                            className="text-xs px-2 py-1 rounded-md border border-purple-500/40 text-purple-200 hover:bg-purple-600/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                            {isProcessing ? t('updating') : t('regenerate')}
                        </button>
                    )}
                </div>
            </div>

            <div className="my-3 text-xs text-gray-400">
                <p>{t('analysis')}: <span className="text-gray-300">{t(prediction.analysis)}</span></p>
                <p className="mt-1 text-[11px] text-gray-500">{prediction.timeframe}</p>
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