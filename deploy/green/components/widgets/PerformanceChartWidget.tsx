
import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const WidgetCard: React.FC<{ title: string; children: React.ReactNode; showHeader?: boolean; }> = ({ title, children, showHeader=true }) => (
    <div className="bg-white dark:bg-[#1c1e2f] border border-slate-200 dark:border-gray-700/50 rounded-lg h-full flex flex-col">
        {showHeader && (
            <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-gray-700/50">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-300">{title}</h3>
                <svg className="h-5 w-5 text-slate-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
            </div>
        )}
        <div className="flex-grow p-4">
            {children}
        </div>
    </div>
);


const PerformanceChartWidget: React.FC = () => {
    const { t } = useLanguage();
    return (
        <WidgetCard title={t('performance_chart')}>
            <div className="relative h-48 flex items-center justify-center">
                 <p className="text-slate-400 dark:text-gray-500 text-sm">{t('loading_chart')}</p>
                 <div className="absolute top-2 right-2 bg-black/30 backdrop-blur-sm p-2 rounded-lg text-xs text-gray-300 cursor-grab flex items-center gap-2">
                     <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 2.50002L2.5 5.50002L5.5 8.50002M9.5 2.50002L12.5 5.50002L9.5 8.50002M2.5 12.5L5.5 9.5M9.5 12.5L12.5 9.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                     {t('drag_to_move')}
                 </div>
            </div>
        </WidgetCard>
    );
};

export default PerformanceChartWidget;