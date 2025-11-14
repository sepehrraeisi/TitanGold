
import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { RecentActivity as RecentActivityType } from '../../types.ts';

const WidgetCard: React.FC<{ title: string; children: React.ReactNode; value?: string; subValue?: string; showFooter?: boolean; footerText?: string }> = ({ title, children, showFooter, footerText }) => (
    <div className="bg-white dark:bg-[#1c1e2f] border border-slate-200 dark:border-gray-700/50 rounded-lg p-4 h-full flex flex-col">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-300">{title}</h3>
            <svg className="h-5 w-5 text-slate-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
        </div>
        <div className="flex-grow mt-2 overflow-y-auto">
            {children}
        </div>
        {showFooter && (
             <div className="pt-2 mt-auto border-t border-slate-200 dark:border-gray-700/50 text-center">
                <a href="#" className="text-sm text-purple-600 dark:text-purple-400 hover:underline">{footerText}</a>
            </div>
        )}
    </div>
);

const RecentActivity: React.FC = () => {
    const { t } = useLanguage();
    
    const activities: RecentActivityType[] = [
        // This is now a placeholder as there's no dedicated widget in the new design.
        // It can be used to populate a more detailed "Recent Activity" page later.
    ];

    return (
       <WidgetCard title={t('recent_activity')} showFooter={true} footerText={t('view_all')}>
            <p className="text-center text-slate-500 dark:text-gray-500 text-sm h-full flex items-center justify-center">
                Loading recent activities...
            </p>
        </WidgetCard>
    );
};

export default RecentActivity;