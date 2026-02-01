import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { EconomicEvent } from '../../types.ts';

interface EconomicCalendarWidgetProps {
    events: EconomicEvent[];
}

const EconomicCalendarWidget: React.FC<EconomicCalendarWidgetProps> = ({ events }) => {
    const { t } = useLanguage();
    
    const importanceColor = {
        high: 'bg-red-500',
        medium: 'bg-yellow-500',
        low: 'bg-blue-500',
    };

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('economic_calendar')}</h3>
            <div className="space-y-3">
                {events.map(event => (
                    <div key={event.id} className="text-xs">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-300">{event.time}</span>
                            <div className={`w-2 h-2 rounded-full ${importanceColor[event.importance]}`}></div>
                            <span className="font-semibold text-white">{event.event} ({event.country})</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-gray-400">
                             <div><span className="font-semibold text-gray-500">{t('actual')}:</span> {event.actual}</div>
                             <div><span className="font-semibold text-gray-500">{t('forecast')}:</span> {event.forecast}</div>
                             <div><span className="font-semibold text-gray-500">{t('previous')}:</span> {event.previous}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EconomicCalendarWidget;