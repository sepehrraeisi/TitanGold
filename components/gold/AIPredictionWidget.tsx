import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { GoldPrediction } from '../../types.ts';
import { PublishableItem } from './TelegramPublisher.tsx';

interface AIPredictionWidgetProps {
    prediction: GoldPrediction;
    onPublish: (item: PublishableItem) => void;
}

const AIPredictionWidget: React.FC<AIPredictionWidgetProps> = ({ prediction, onPublish }) => {
    const { t } = useLanguage();
    
    const handlePublish = () => {
        onPublish({
            id: `pred-${prediction.id}`,
            type: 'Prediction',
            content: `${prediction.title}\n\n${t('short_term')}: ${prediction.shortTerm}\n${t('long_term')}: ${prediction.longTerm}\n${t('confidence')}: ${prediction.confidence}%`
        });
    };

    return (
        <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">{t('ai_prediction_scenarios')}</h3>
                <button onClick={handlePublish} className="bg-secondary hover:bg-accent text-xs font-semibold py-1 px-3 rounded-md transition-colors">{t('publish')}</button>
            </div>
            <div className="space-y-4">
                <div className="p-3 bg-secondary rounded-lg">
                    <p className="text-sm font-semibold text-purple-400">{t('short_term')}</p>
                    <p className="text-sm text-muted-foreground">{prediction.shortTerm}</p>
                </div>
                 <div className="p-3 bg-secondary rounded-lg">
                    <p className="text-sm font-semibold text-purple-400">{t('long_term')}</p>
                    <p className="text-sm text-muted-foreground">{prediction.longTerm}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="p-3 bg-green-500/10 border-l-4 border-green-500 rounded-r-lg">
                        <p className="text-sm font-semibold text-green-400">{t('scenario_bullish')}</p>
                        <p className="text-sm text-muted-foreground">{prediction.scenarios.bullish}</p>
                    </div>
                    <div className="p-3 bg-red-500/10 border-l-4 border-red-500 rounded-r-lg">
                        <p className="text-sm font-semibold text-red-400">{t('scenario_bearish')}</p>
                        <p className="text-sm text-muted-foreground">{prediction.scenarios.bearish}</p>
                    </div>
                </div>
                <div>
                     <p className="text-sm text-muted-foreground">{t('confidence')}:</p>
                     <div className="w-full bg-secondary rounded-full h-2.5">
                        <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: `${prediction.confidence}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIPredictionWidget;