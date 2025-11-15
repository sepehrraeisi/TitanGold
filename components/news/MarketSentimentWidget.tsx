import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { NewsSentimentSnapshot } from '../../types.ts';

interface MarketSentimentWidgetProps {
    sentiment: NewsSentimentSnapshot;
}

const MarketSentimentWidget: React.FC<MarketSentimentWidgetProps> = ({ sentiment }) => {
    const { t } = useLanguage();

    const biasColor =
        sentiment.bias === 'Bullish'
            ? 'text-green-400'
            : sentiment.bias === 'Bearish'
                ? 'text-red-400'
                : 'text-gray-300';

    const trendColor =
        sentiment.trend === 'up'
            ? 'text-green-400'
            : sentiment.trend === 'down'
                ? 'text-red-400'
                : 'text-gray-400';

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 space-y-5">
            <div>
                <h3 className="font-semibold text-white mb-2">{t('market_sentiment')}</h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">{t('sentiment_score')}</p>
                        <p className="text-3xl font-bold text-white">{sentiment.marketScore}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">{t('news_market_bias')}</p>
                        <p className={`text-sm font-semibold ${biasColor}`}>{t(sentiment.bias.toLowerCase())}</p>
                        <p className={`text-xs ${trendColor}`}>
                            {sentiment.change >= 0 ? '+' : ''}{sentiment.change} {t('points')}
                        </p>
                    </div>
                </div>
            </div>

            <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{t('news_trending_assets')}</p>
                <div className="space-y-3">
                    {sentiment.trendingAssets.map(asset => {
                        const barColor = asset.sentiment === 'Bullish'
                            ? 'bg-green-500'
                            : asset.sentiment === 'Bearish'
                                ? 'bg-red-500'
                                : 'bg-yellow-500';
                        const changeColor = asset.change >= 0 ? 'text-green-400' : 'text-red-400';
                        const width = Math.min(100, Math.abs(asset.change) * 4);
                        return (
                            <div key={asset.id}>
                                <div className="flex justify-between text-xs text-gray-300">
                                    <span>{asset.name}</span>
                                    <span className={changeColor}>
                                        {asset.change >= 0 ? '+' : ''}{asset.change}%
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <div className={`${barColor} h-2`} style={{ width: `${width}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{t('news_heatmap')}</p>
                <div className="grid grid-cols-3 gap-2">
                    {sentiment.heatmap.map(cell => (
                        <div key={cell.id} className="rounded-md border border-gray-700/70 bg-gray-900/40 p-2">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500">{cell.label}</p>
                            <p className="text-lg font-semibold text-white">{cell.value}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MarketSentimentWidget;