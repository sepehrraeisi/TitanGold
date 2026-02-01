
import React from 'react';
import { WatchlistItem } from '../../types.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';

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

const PriceTrackerWidget: React.FC = () => {
    const { t } = useLanguage();
    
    const items: WatchlistItem[] = [
        { id: 'btc', name: 'BTC/USDT', ticker: 'BTC', price: 43250, change24h: 2.34 },
        { id: 'eth', name: 'ETH/USDT', ticker: 'ETH', price: 2680, change24h: -1.23 },
    ];

    return (
        <WidgetCard title={t('price_tracker')}>
            <div className="space-y-4">
                {items.map(item => (
                    <div key={item.id} className="flex justify-between items-center">
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-right">
                            <p className="font-bold">${item.price.toLocaleString()}</p>
                            <p className={`text-sm font-semibold ${item.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </WidgetCard>
    );
};

export default PriceTrackerWidget;