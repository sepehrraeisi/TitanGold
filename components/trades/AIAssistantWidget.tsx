import React, { useMemo } from 'react';
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
    const { t, language } = useLanguage();
    const primaryRecommendation = recommendations[0];
    const secondaryRecommendations = recommendations.slice(1, 4); // Show max 3 secondary

    const sentimentColor = useMemo(() => {
        if (sentiment.score >= 70) return 'text-green-400';
        if (sentiment.score >= 40) return 'text-yellow-400';
        return 'text-red-400';
    }, [sentiment.score]);

    const sentimentBgColor = useMemo(() => {
        if (sentiment.score >= 70) return 'from-green-500/20 to-emerald-500/10';
        if (sentiment.score >= 40) return 'from-yellow-500/20 to-orange-500/10';
        return 'from-red-500/20 to-rose-500/10';
    }, [sentiment.score]);

    return (
        <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-5 sm:p-6 shadow-lg">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-700/50">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                </div>
                <div>
                    <h3 className="font-bold text-white text-lg">{t('ai_trading_assistant')}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Powered by Artemis AI</p>
                </div>
            </div>

            <div className="space-y-5">
                {/* Primary Recommendation */}
                {primaryRecommendation ? (
                    <div className="bg-gradient-to-br from-blue-500/20 via-indigo-500/15 to-purple-500/10 border border-blue-500/30 rounded-xl p-4 shadow-lg shadow-blue-500/10">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <p className="text-sm font-bold text-blue-200">{t(primaryRecommendation.titleKey)}</p>
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/20 border border-blue-400/30">
                                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                                        <span className="text-xs font-semibold text-blue-300">{primaryRecommendation.confidence}%</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed">{t(primaryRecommendation.descriptionKey)}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gray-800/30 border border-dashed border-gray-700/50 rounded-xl p-6 text-center">
                        <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <p className="text-sm text-gray-400">{t('manual_trades_empty_recommendations')}</p>
                    </div>
                )}

                {/* Secondary Recommendations */}
                {secondaryRecommendations.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            {t('other_recommendations') || 'Other Recommendations'}
                        </h4>
                        {secondaryRecommendations.map((recommendation, index) => (
                            <div 
                                key={recommendation.id} 
                                className="flex items-center justify-between bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2.5 transition-all duration-200 group"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                        <p className="text-xs font-semibold text-gray-200 truncate">{t(recommendation.titleKey)}</p>
                                    </div>
                                    <p className="text-xs text-gray-400 line-clamp-1">{t(recommendation.descriptionKey)}</p>
                                </div>
                                <div className="flex-shrink-0 ml-3">
                                    <div className="px-2 py-1 rounded-md bg-purple-500/20 border border-purple-400/30">
                                        <span className="text-xs font-bold text-purple-300">{recommendation.confidence}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Market Sentiment */}
                <div className="bg-gradient-to-br from-gray-800/40 to-gray-800/20 border border-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <p className="text-sm font-semibold text-gray-300">{t('market_sentiment')}</p>
                        </div>
                        <div className={`text-lg font-bold ${sentimentColor}`}>
                            {sentiment.score}
                        </div>
                    </div>
                    
                    {/* Sentiment Bar */}
                    <div className="relative h-3 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full overflow-hidden mb-2">
                        <div
                            className="absolute top-0 bottom-0 w-1 bg-white rounded-full shadow-lg"
                            style={{ left: `${Math.min(100, Math.max(0, sentiment.score))}%`, transform: 'translateX(-50%)' }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{t('bearish') || 'Bearish'}</span>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-md bg-gradient-to-r ${sentimentBgColor} border border-gray-700/50`}>
                            {t(sentiment.labelKey)}
                        </span>
                        <span className="text-xs text-gray-400">{t('bullish') || 'Bullish'}</span>
                    </div>
                </div>

                {/* Strategy Manager */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-sm font-semibold text-gray-300">{t('strategy_manager')}</p>
                    </div>
                    <div className="space-y-2">
                        {strategies.length > 0 ? (
                            strategies.map(strategy => (
                                <StrategyToggle
                                    key={strategy.id}
                                    strategy={t(strategy.nameKey)}
                                    performance={strategy.performance}
                                    isActive={strategy.isActive}
                                    onToggle={() => onToggleStrategy(strategy.id)}
                                    disabled={disabled}
                                />
                            ))
                        ) : (
                            <div className="text-center py-4 text-xs text-gray-500">
                                {t('no_strategies_available') || 'No strategies available'}
                            </div>
                        )}
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
    const performanceColor = performance >= 0 ? 'text-green-400' : 'text-red-400';
    const performanceBg = performance >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30';

    return (
        <div className="flex items-center justify-between bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700/50 rounded-lg p-3 transition-all duration-200 group">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-200">{strategy}</p>
                    <div className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${performanceBg} ${performanceColor}`}>
                        {performance >= 0 ? '+' : ''}{performance.toFixed(1)}%
                    </div>
                </div>
                <p className="text-xs text-gray-400">{t('performance')}: {performance.toFixed(1)}%</p>
            </div>
            <button
                onClick={onToggle}
                disabled={disabled}
                className={`relative flex-shrink-0 ml-3 w-14 h-7 rounded-full transition-all duration-300 ${
                    isActive
                        ? disabled
                            ? 'bg-green-500/30 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg shadow-green-500/30'
                        : disabled
                            ? 'bg-gray-700/50 cursor-not-allowed'
                            : 'bg-gray-700 hover:bg-gray-600'
                }`}
            >
                <div
                    className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                        isActive ? 'translate-x-7' : 'translate-x-0'
                    }`}
                />
                <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold transition-opacity duration-200 ${
                    isActive 
                        ? 'text-white opacity-100' 
                        : 'text-gray-400 opacity-0'
                }`}>
                    ON
                </span>
                <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold transition-opacity duration-200 ${
                    !isActive 
                        ? 'text-white opacity-100' 
                        : 'text-gray-400 opacity-0'
                }`}>
                    OFF
                </span>
            </button>
        </div>
    );
};

export default AIAssistantWidget;
