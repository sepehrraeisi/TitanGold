
import React from 'react';
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


const PortfolioSummaryWidget: React.FC = () => {
    const { t } = useLanguage();

    return (
        <WidgetCard title={t('portfolio_summary')} value="$125,430" subValue={"+5.67% " + t('this_week')}>
            <div className="flex justify-between items-center mt-4">
                 <div>
                    <p className="text-xs text-slate-500 dark:text-gray-400">{t('total_pnl')}</p>
                    <p className="font-bold text-green-500 text-lg">$6,750+</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-gray-400">{t('assets')}</p>
                    <p className="font-bold text-lg">8</p>
                </div>
            </div>
        </WidgetCard>
    );
};

export default PortfolioSummaryWidget;