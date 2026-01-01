import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { ManualTradingRecentTrade } from '../../types.ts';

interface RecentTradesWidgetProps {
    trades: ManualTradingRecentTrade[];
}

const RecentTradesWidget: React.FC<RecentTradesWidgetProps> = ({ trades }) => {
    const { t, language } = useLanguage();
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
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('recent_trades')}</h3>
            {trades.length === 0 ? (
                <p className="text-xs text-gray-400">{t('manual_trades_empty_trades')}</p>
            ) : (
                <div className="space-y-3">
                    {trades.map(trade => {
                        const isGain = trade.pnl >= 0;
                        return (
                            <div key={trade.id} className="flex justify-between items-center text-sm">
                                <div>
                                    <p className="font-semibold text-white">
                                        {t(trade.side === 'buy' ? 'buy' : 'sell')} {trade.asset}
                                        <span className="text-xs text-gray-400 ml-1">({trade.pair})</span>
                                    </p>
                                    <p className="text-xs text-gray-400">{formatTimeAgo(trade.executedAt)}</p>
                                </div>
                                {typeof trade.confidence === 'number' ? (
                                    <span className="text-sm font-semibold text-purple-300">
                                        {t('confidence')}: {trade.confidence}%
                                    </span>
                                ) : (
                                    <div className="text-right">
                                        <p className={`font-semibold ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                                            {isGain ? '+' : '-'}${Math.abs(trade.pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </p>
                                        <p className={`text-xs ${isGain ? 'text-green-500' : 'text-red-500'}`}>
                                            {isGain ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                                        </p>
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
