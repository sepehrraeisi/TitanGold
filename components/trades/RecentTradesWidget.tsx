import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { ManualTradingRecentTrade } from '../../types.ts';

interface RecentTradesWidgetProps {
    trades: ManualTradingRecentTrade[];
}

const RecentTradesWidget: React.FC<RecentTradesWidgetProps> = ({ trades }) => {
    const { t, language } = useLanguage();
    const currencyFormatter = useMemo(() => new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
    }), [language]);

    const relativeFormatter = useMemo(
        () => new Intl.RelativeTimeFormat(language === 'fa' ? 'fa-IR' : 'en-US', { numeric: 'auto' }),
        [language]
    );

    const formatTimeAgo = (timestamp: string | undefined | null) => {
        if (!timestamp) {
            return '--';
        }
        
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) {
            return '--';
        }
        const diffMs = Date.now() - date.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        if (diffMinutes < 1) {
            return t('just_now');
        }
        if (diffMinutes < 60) {
            return relativeFormatter.format(-diffMinutes, 'minute');
        }
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) {
            return relativeFormatter.format(-diffHours, 'hour');
        }
        const diffDays = Math.floor(diffHours / 24);
        return relativeFormatter.format(-diffDays, 'day');
    };

    return (
        <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-5 sm:p-6 shadow-lg">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-700/50">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <h3 className="font-bold text-white text-lg">{t('recent_trades')}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Latest activities</p>
                </div>
            </div>

            {trades.length === 0 ? (
                <div className="bg-gray-800/30 border border-dashed border-gray-700/50 rounded-xl p-8 text-center">
                    <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-gray-400">{t('manual_trades_empty_trades')}</p>
                </div>
            ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto scrollbar-thin">
                    {trades.map(trade => {
                        const isGain = trade.pnl >= 0;
                        const isBuy = trade.side === 'buy';
                        
                        return (
                            <div 
                                key={trade.id} 
                                className="flex items-center justify-between bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700/50 rounded-lg p-3 transition-all duration-200 group"
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {/* Side Icon */}
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                                        isBuy 
                                            ? 'bg-green-500/20 border border-green-500/30' 
                                            : 'bg-red-500/20 border border-red-500/30'
                                    }`}>
                                        <svg 
                                            className={`w-4 h-4 ${isBuy ? 'text-green-400' : 'text-red-400'}`} 
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            {isBuy ? (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                            ) : (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                            )}
                                        </svg>
                                    </div>
                                    
                                    {/* Trade Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold text-white text-sm">
                                                {trade.asset}
                                            </p>
                                            <span className="text-xs text-gray-500">({trade.pair})</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                            <span className="capitalize">{t(trade.side)}</span>
                                            <span>•</span>
                                            <span>{formatTimeAgo(trade.executedAt)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* PnL */}
                                {typeof trade.confidence === 'number' ? (
                                    <div className="flex-shrink-0 ml-3">
                                        <div className="px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-400/30">
                                            <span className="text-xs font-semibold text-purple-300">
                                                {trade.confidence}%
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-shrink-0 ml-3 text-right">
                                        <div className={`text-sm font-bold ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                                            {isGain ? '+' : ''}{currencyFormatter.format(trade.pnl)}
                                        </div>
                                        <div className={`text-xs font-semibold ${isGain ? 'text-green-500' : 'text-red-500'}`}>
                                            {isGain ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default RecentTradesWidget;
