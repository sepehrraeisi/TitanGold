import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { ManualTradingRecommendation, ManualTradingSentiment, ManualTradingStrategy } from '../../types.ts';

interface AIAssistantWidgetProps {
    recommendations: ManualTradingRecommendation[];
    sentiment: ManualTradingSentiment;
    strategies: ManualTradingStrategy[];
    onToggleStrategy: (strategyId: string) => void | Promise<void>;
    disabled?: boolean;
}

const AIAssistantWidget: React.FC<AIAssistantWidgetProps> = ({
    recommendations,
    sentiment,
    strategies,
    onToggleStrategy,
    disabled,
}) => {
    const { t } = useLanguage();
    const primaryRecommendation = recommendations[0];
    const secondaryRecommendations = recommendations.slice(1);

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <h3 className="font-semibold text-white mb-4">{t('ai_trading_assistant')}</h3>
            <div className="space-y-4">
                {primaryRecommendation ? (
                    <div className="bg-blue-600/10 border-l-4 border-blue-500 p-3 rounded-r-md">
                        <p className="text-sm font-semibold text-blue-300">{t(primaryRecommendation.titleKey)}</p>
                        <p className="text-xs text-gray-300 mt-1">{t(primaryRecommendation.descriptionKey)}</p>
                        <p className="text-xs text-blue-200 mt-2">
                            {t('confidence')}: {primaryRecommendation.confidence}%
                        </p>
                    </div>
                ) : (
                    <div className="text-xs text-gray-400 bg-gray-800/40 border border-dashed border-gray-700 rounded-md p-3 text-center">
                        {t('manual_trades_empty_recommendations')}
                    </div>
                )}

                {secondaryRecommendations.length > 0 && (
                    <div className="space-y-2">
                        {secondaryRecommendations.map(recommendation => (
                            <div key={recommendation.id} className="flex items-center justify-between bg-gray-800/30 rounded-md px-3 py-2 text-xs">
                                <div>
                                    <p className="text-gray-200 font-medium">{t(recommendation.titleKey)}</p>
                                    <p className="text-gray-400">{t(recommendation.descriptionKey)}</p>
                                </div>
                                <span className="text-purple-200 font-semibold">{recommendation.confidence}%</span>
                            </div>
                        ))}
                    </div>
                )}

                <div>
                    <p className="text-sm font-semibold text-gray-300 mb-2">{t('market_sentiment')}</p>
                    <div className="flex items-center gap-4 bg-gray-800/50 p-3 rounded-md">
                        <div className="relative w-full h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full">
                            <div
                                className="absolute h-3 w-1 bg-white rounded-full -top-0.5"
                                style={{ left: `${Math.min(100, Math.max(0, sentiment.score))}%` }}
                            />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-green-300">{sentiment.score}</p>
                            <p className="text-xs text-gray-400">{t(sentiment.labelKey)}</p>
                        </div>
                    </div>
                </div>

                <div>
                    <p className="text-sm font-semibold text-gray-300 mb-2">{t('strategy_manager')}</p>
                    <div className="space-y-2">
                        {strategies.map(strategy => (
                            <StrategyToggle
                                key={strategy.id}
                                strategy={t(strategy.nameKey)}
                                performance={strategy.performance}
                                isActive={strategy.isActive}
                                onToggle={() => onToggleStrategy(strategy.id)}
                                disabled={disabled}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StrategyToggle: React.FC<{
    strategy: string;
    performance: number;
    isActive: boolean;
    onToggle: () => void;
    disabled?: boolean;
}> = ({ strategy, performance, isActive, onToggle, disabled }) => {
    const { t } = useLanguage();
    return (
        <div className="flex justify-between items-center text-sm p-2 bg-gray-800/50 rounded-md">
            <div>
                <p className="font-medium text-gray-200">{strategy}</p>
                <p className="text-xs text-gray-400">{t('performance')}: {performance.toFixed(1)}%</p>
            </div>
            <button
                onClick={onToggle}
                disabled={disabled}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${isActive
                    ? disabled
                        ? 'bg-green-500/10 text-green-200/60 cursor-not-allowed'
                        : 'bg-green-500/20 text-green-300 hover:bg-green-500/40'
                    : disabled
                        ? 'bg-gray-700/40 text-gray-400/60 cursor-not-allowed'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
            >
                {t(isActive ? 'on' : 'off')}
            </button>
        </div>
    );
};

export default AIAssistantWidget;
