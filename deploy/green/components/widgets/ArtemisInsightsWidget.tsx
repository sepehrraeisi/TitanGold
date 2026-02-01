
import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { ArtemisInsight } from '../../types.ts';

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

const ArtemisInsightsWidget: React.FC = () => {
    const { t } = useLanguage();
    const insight: ArtemisInsight = {
        id: '1',
        title: t('artemis_recommendation'),
        text: t('market_consolidating'),
        confidence: 87
    };

    return (
        <WidgetCard title={t('artemis_insights')}>
            <div className="bg-blue-500/10 border-l-4 border-blue-400 p-3 rounded-r-lg">
                <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{insight.title}</p>
                <p className="text-sm text-slate-700 dark:text-gray-300 mt-1">{insight.text}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-semibold">Confidence: {insight.confidence}%</p>
            </div>
        </WidgetCard>
    );
};

export default ArtemisInsightsWidget;