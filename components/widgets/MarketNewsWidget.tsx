
import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { MarketNews } from '../../types.ts';

const WidgetCard: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (
    <div className="bg-white dark:bg-[#1c1e2f] border border-slate-200 dark:border-gray-700/50 rounded-lg p-4 h-full flex flex-col">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-300">{title}</h3>
            <svg className="h-5 w-5 text-slate-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
        </div>
        <div className="flex-grow mt-2">
            {children}
        </div>
    </div>
);

const MarketNewsWidget: React.FC = () => {
    const { t } = useLanguage();
    const news: MarketNews[] = [
        { id: '1', title: t('btc_resistance'), source: t('analyst_prediction'), time: '2h ago' },
        { id: '2', title: t('eth_update'), source: t('performance_boost'), time: '4h ago' }
    ];

    return (
        <WidgetCard title={t('market_news')}>
            <div className="space-y-4">
                {news.map(item => (
                    <div key={item.id}>
                        <p className="font-semibold text-sm">{item.title}</p>
                        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-gray-400 mt-1">
                            <span>{item.source}</span>
                            <span>{item.time}</span>
                        </div>
                    </div>
                ))}
            </div>
        </WidgetCard>
    );
};

export default MarketNewsWidget;