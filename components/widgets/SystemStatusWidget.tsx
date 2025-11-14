
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

const ArtemisStatusWidget: React.FC = () => {
    const { t } = useLanguage();
    const confidence = 85;

    return (
        <WidgetCard title={t('artemis_status')}>
            <div className="flex flex-col items-center justify-center h-full">
                <div className="relative">
                    <svg className="h-24 w-24 transform -rotate-90">
                        <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200 dark:text-gray-700" />
                        <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={2 * Math.PI * 40}
                            strokeDashoffset={(2 * Math.PI * 40) * (1 - confidence / 100)}
                            className="text-purple-500"
                        />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">{confidence}%</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-purple-500 dark:text-purple-300">{t('high_confidence')}</p>
            </div>
        </WidgetCard>
    );
};

export default ArtemisStatusWidget;