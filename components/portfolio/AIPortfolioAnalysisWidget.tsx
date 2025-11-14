import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { PortfolioInsight } from '../../types.ts';
import Button from '../ui/button.tsx';

interface AIPortfolioAnalysisWidgetProps {
    insights: PortfolioInsight[];
    onAcknowledge?: (id: string) => void;
    acknowledgingId?: string | null;
}

const toneColors: Record<PortfolioInsight['tone'], string> = {
    positive: 'text-green-400',
    warning: 'text-yellow-400',
    neutral: 'text-blue-400',
};

const AIPortfolioAnalysisWidget: React.FC<AIPortfolioAnalysisWidgetProps> = ({
    insights,
    onAcknowledge,
    acknowledgingId,
}) => {
    const { t, language } = useLanguage();

    const timestampFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
            }),
        [language],
    );

    if (insights.length === 0) {
        return (
            <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
                <h3 className="font-semibold text-white mb-4">{t('ai_portfolio_analysis')}</h3>
                <div className="h-full min-h-[180px] flex items-center justify-center text-sm text-gray-400">
                    {t('no_portfolio_insights')}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <h3 className="font-semibold text-white mb-4">{t('ai_portfolio_analysis')}</h3>
            <div className="space-y-4">
                {insights.map(insight => (
                    <div key={insight.id} className="flex items-start gap-3">
                        <div className={`mt-1 ${toneColors[insight.tone]}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h4 className="font-semibold text-white text-sm">{t(insight.titleKey)}</h4>
                                    <p className="text-xs text-gray-400">{t(insight.descriptionKey)}</p>
                                </div>
                                {typeof insight.confidence === 'number' && (
                                    <span className="text-xs text-purple-300 bg-purple-500/10 px-2 py-1 rounded-full">
                                        {t('confidence_score', { value: insight.confidence })}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                                <span>{timestampFormatter.format(new Date(insight.timestamp))}</span>
                                {onAcknowledge && !insight.acknowledged && (
                                    <Button
                                        variant="ghost"
                                        className="text-xs px-2 h-7"
                                        onClick={() => onAcknowledge(insight.id)}
                                        disabled={acknowledgingId === insight.id}
                                    >
                                        {acknowledgingId === insight.id ? t('updating') : t('mark_as_handled')}
                                    </Button>
                                )}
                                {insight.acknowledged && (
                                    <span className="text-green-400">{t('insight_acknowledged')}</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AIPortfolioAnalysisWidget;
