import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { GoldPrediction, GoldPublishItem } from '../../types.ts';
import Button from '../ui/button.tsx';

interface AIPredictionWidgetProps {
    prediction: GoldPrediction;
    onPublish: (item: GoldPublishItem) => void;
    onRegenerate: () => void;
    isRegenerating: boolean;
}

const strengthColors: Record<GoldPrediction['signals'][number]['strength'], string> = {
    strong: 'text-green-400',
    moderate: 'text-yellow-400',
    weak: 'text-red-400',
};

const AIPredictionWidget: React.FC<AIPredictionWidgetProps> = ({ prediction, onPublish, onRegenerate, isRegenerating }) => {
    const { t, language } = useLanguage();

    const handlePublish = () => {
        onPublish({
            id: `pred-${prediction.id}`,
            type: 'Prediction',
            content: `${prediction.title}\n\n${t('short_term')}: ${prediction.shortTerm}\n${t('long_term')}: ${prediction.longTerm}\n${t('confidence')}: ${prediction.confidence}%`,
        });
    };

    const updatedAt = new Date(prediction.updatedAt).toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US', { hour12: false });

    return (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">{t('ai_prediction_scenarios')}</h3>
                    <p className="text-xs text-muted-foreground">{t('prediction_updated_at', { time: updatedAt })}</p>
                </div>
                <div className="flex items-center gap-2 self-start">
                    <Button variant="outline" onClick={handlePublish} className="h-8 px-3 text-xs">
                        {t('publish')}
                    </Button>
                    <Button variant="ghost" onClick={onRegenerate} disabled={isRegenerating} className="h-8 px-3 text-xs">
                        {isRegenerating ? t('loading') : t('regenerate_prediction')}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-3">
                    <div className="p-3 bg-secondary rounded-lg">
                        <p className="text-sm font-semibold text-purple-400">{t('short_term')}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{prediction.shortTerm}</p>
                    </div>
                    <div className="p-3 bg-secondary rounded-lg">
                        <p className="text-sm font-semibold text-purple-400">{t('long_term')}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{prediction.longTerm}</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="p-3 bg-green-500/10 border border-green-500/40 rounded-lg">
                        <p className="text-sm font-semibold text-green-400">{t('scenario_bullish')}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{prediction.scenarios.bullish}</p>
                    </div>
                    <div className="p-3 bg-red-500/10 border border-red-500/40 rounded-lg">
                        <p className="text-sm font-semibold text-red-400">{t('scenario_bearish')}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{prediction.scenarios.bearish}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <div>
                    <p className="text-sm font-semibold text-muted-foreground">{t('confidence_breakdown')}</p>
                    <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                        <ConfidencePill label={t('confidence_ai')} value={prediction.confidenceBreakdown.ai} />
                        <ConfidencePill label={t('confidence_fundamental')} value={prediction.confidenceBreakdown.fundamental} />
                        <ConfidencePill label={t('confidence_technical')} value={prediction.confidenceBreakdown.technical} />
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">{t('prediction_signals')}</p>
                    {prediction.signals.map(signal => (
                        <div key={signal.id} className="flex items-start justify-between rounded-md border border-border/60 bg-secondary/60 p-3 text-xs">
                            <div>
                                <p className="font-semibold text-foreground">{t(signal.labelKey)}</p>
                                <p className="text-muted-foreground mt-1 leading-snug">{t(signal.descriptionKey)}</p>
                            </div>
                            <div className="text-right">
                                <p className={`${strengthColors[signal.strength]} font-semibold`}>{t(`signal_strength_${signal.strength}`)}</p>
                                <p className="text-muted-foreground">{t('confidence')}: {signal.confidence}%</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div>
                    <p className="text-sm font-semibold text-muted-foreground">{t('recommended_actions')}</p>
                    <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-muted-foreground">
                        {prediction.recommendedActions.map(actionKey => (
                            <li key={actionKey}>{t(actionKey)}</li>
                        ))}
                    </ul>
                </div>

                <div>
                    <p className="text-sm font-semibold text-muted-foreground">{t('confidence')}</p>
                    <div className="w-full bg-secondary rounded-full h-2.5">
                        <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: `${prediction.confidence}%` }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const ConfidencePill: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="rounded-md border border-border/60 bg-secondary/60 p-2 text-center">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}%</p>
    </div>
);

export default AIPredictionWidget;