import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { RecentTrade } from '../../types.ts';

const RecentTradesWidget: React.FC = () => {
    const { t } = useLanguage();
    const trades: RecentTrade[] = [
        { id: '1', type: 'BUY', asset: 'BTC', pnl: 1250, pnlPercent: 2.3, time: '2m ago' },
        { id: '2', type: 'SELL', asset: 'ETH', pnl: -890, pnlPercent: -4.1, time: '15m ago' },
        { id: '3', type: 'BUY', asset: 'AI Signal', pnl: 0, pnlPercent: 0, confidence: 85, time: '32m ago' },
    ];
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('recent_trades')}</h3>
            <div className="space-y-3">
                {trades.map(trade => (
                    <div key={trade.id} className="flex justify-between items-center text-sm">
                        <div>
                            <p className="font-semibold text-white">
                                {trade.type === 'BUY' ? t('buy') : t('sell')} {trade.asset}
                                {trade.asset === 'AI Signal' && <span className="text-xs text-purple-400 ml-1">({t('ai_signal')})</span>}
                            </p>
                            <p className="text-xs text-gray-400">{trade.time}</p>
                        </div>
                        {trade.confidence ? (
                             <span className="text-sm font-semibold text-purple-300">
                               {t('confidence')} {trade.confidence}%
                            </span>
                        ) : (
                             <div className="text-right">
                                <p className={`font-semibold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {trade.pnl >= 0 ? '+' : '-'}${Math.abs(trade.pnl)}
                                </p>
                                <p className={`text-xs ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                     {trade.pnl >= 0 ? '+' : ''}{trade.pnlPercent}%
                                </p>
                            </div>
                        )}
                       
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RecentTradesWidget;
