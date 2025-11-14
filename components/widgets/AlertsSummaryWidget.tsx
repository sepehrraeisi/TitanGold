
import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

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

const AlertsSummaryWidget: React.FC = () => {
    const { t } = useLanguage();
    const alerts = {
        active: 3,
        triggered: 2,
    };

    return (
        <WidgetCard title={t('alerts_summary')}>
            <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                    <span className="text-slate-500 dark:text-gray-400 text-sm">{t('active_alerts')}</span>
                    <span className="font-bold text-xl">{alerts.active}</span>
                </div>
                 <div className="flex justify-between items-baseline">
                    <span className="text-slate-500 dark:text-gray-400 text-sm">{t('triggered_today')}</span>
                    <span className="font-bold text-xl">{alerts.triggered}</span>
                </div>
                <div className="border-t border-slate-200 dark:border-gray-700/50 pt-2">
                    <p className="text-sm text-yellow-600 dark:text-yellow-400 font-semibold">BTC &gt; $44,000</p>
                    <p className="text-xs text-slate-500 dark:text-gray-500">30 mins ago</p>
                </div>
            </div>
        </WidgetCard>
    );
};

export default AlertsSummaryWidget;