
import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { ActiveTrade } from '../../types.ts';

const WidgetCard: React.FC<{ title: string; children: React.ReactNode; value?: string; subValue?: string; }> = ({ title, value, subValue, children }) => (
    <div className="bg-white dark:bg-[#1c1e2f] border border-slate-200 dark:border-gray-700/50 rounded-lg p-4 h-full flex flex-col">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-300">{title}</h3>
            <svg className="h-5 w-5 text-slate-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
        </div>
        {value && <p className="text-2xl font-bold">{value}</p>}
        {subValue && <p className="text-xs text-slate-500 dark:text-gray-400">{subValue}</p>}
        <div className="flex-grow mt-2">
            {children}
        </div>
    </div>
);


const ActiveTradesWidget: React.FC = () => {
    const { t } = useLanguage();
    
    const trades: ActiveTrade[] = [
        { id: '1', pair: 'BTC', type: 'BUY', amount: 0.5, entryPrice: 68500, currentPrice: 42000, pnl: 0, pnlPercent: 2.3, aiAgent: '' },
        { id: '2', pair: 'ETH', type: 'SELL', amount: 10, entryPrice: 3800, currentPrice: 2700, pnl: 0, pnlPercent: -0.8, aiAgent: ''},
    ];

    return (
        <WidgetCard title={t('active_trades_widget')} value="8" subValue={t('win_rate') + ": 75%"}>
            <div className="space-y-3 mt-2">
                {trades.map(trade => (
                     <div key={trade.id} className="flex justify-between items-center text-sm">
                        <div>
                            <span className="font-bold">{trade.type} {trade.pair}</span>
                            <p className="text-xs text-slate-500 dark:text-gray-400">{trade.pair} @ ${trade.currentPrice.toLocaleString()}</p>
                        </div>
                        <span className={`font-semibold ${trade.pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(1)}%
                        </span>
                    </div>
                ))}
            </div>
        </WidgetCard>
    );
};

export default ActiveTradesWidget;