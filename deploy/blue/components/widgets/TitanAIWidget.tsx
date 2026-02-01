import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const TitanAIWidget: React.FC = () => {
    const { t } = useLanguage();

    const stats = [
        { label: t('active'), value: 12 },
        { label: t('training'), value: 2 },
        { label: t('standby'), value: 1 },
    ];

    return (
        <div className="bg-card border-2 border-primary/50 rounded-lg p-4 h-full flex flex-col shadow-lg">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-muted-foreground">{t('titan_ai')}</h3>
                <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
            </div>
            <p className="text-2xl font-bold text-foreground">Agent 15</p>
            <p className="text-xs text-muted-foreground">{`${t('avg_performance')} 87%`}</p>
            
            <div className="flex justify-between items-end h-full mt-2">
                <div className="flex space-x-4">
                    {stats.map(stat => (
                        <div key={stat.label}>
                            <p className="text-xl font-bold text-foreground">{stat.value}</p>
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </div>
                    ))}
                </div>
                <button className="text-xs bg-primary/20 hover:bg-primary/30 text-primary font-semibold py-1 px-3 rounded-full transition-colors">
                    {t('manage_ai')}
                </button>
            </div>
        </div>
    );
};

export default TitanAIWidget;