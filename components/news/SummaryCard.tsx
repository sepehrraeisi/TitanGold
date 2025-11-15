import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface SummaryCardProps {
    title: string;
    value: string | number;
    delta?: number;
    direction?: 'up' | 'down' | 'flat';
    suffix?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, delta, direction = 'flat', suffix }) => {
    const { t } = useLanguage();
    const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;
    const deltaColor =
        direction === 'up' ? 'text-green-400' : direction === 'down' ? 'text-red-400' : 'text-gray-400';
    const deltaPrefix = direction === 'up' ? '+' : direction === 'down' ? '-' : '';

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <p className="text-sm text-gray-400">{title}</p>
            <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-bold text-white">
                    {formattedValue}
                    {suffix ? ` ${suffix}` : ''}
                </p>
                {typeof delta === 'number' && (
                    <span className={`text-xs font-semibold ${deltaColor}`}>
                        {deltaPrefix}
                        {Math.abs(delta)}
                        <span className="ml-1 text-[10px] font-normal uppercase tracking-wide text-gray-500">
                            {t('vs_previous_period')}
                        </span>
                    </span>
                )}
            </div>
        </div>
    );
};

export default SummaryCard;