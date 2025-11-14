import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { AnalysisStat } from '../../types.ts';

interface StatCardProps {
    stat: AnalysisStat;
}

const StatCard: React.FC<StatCardProps> = ({ stat }) => {
    const { t, language } = useLanguage();
    const locale = language === 'fa' ? 'fa-IR' : 'en-US';

    const formatNumber = (value: number, minimumFractionDigits: number, maximumFractionDigits: number) =>
        new Intl.NumberFormat(locale, { minimumFractionDigits, maximumFractionDigits }).format(value);

    const formatValue = (): string => {
        const decimals = stat.decimals ?? 2;
        switch (stat.format) {
            case 'currency': {
                const formatted = formatNumber(stat.value, decimals, decimals);
                return `${stat.prefix ?? ''}${formatted}${stat.suffix ?? ''}`;
            }
            case 'percent':
                return `${formatNumber(stat.value, decimals, decimals)}%`;
            case 'ratio':
                return `1:${formatNumber(stat.value, decimals, decimals)}`;
            default:
                return formatNumber(stat.value, decimals, decimals);
        }
    };

    const hasChange = typeof stat.change === 'number';
    const changeDecimals = stat.changeDecimals ?? (stat.changeFormat === 'plain' ? 2 : 1);
    const changeDirection = stat.changeDirection ?? ((stat.change ?? 0) >= 0 ? 'up' : 'down');
    const changeIsPositive = changeDirection === 'up';
    const changeColor = changeIsPositive ? 'text-green-400' : 'text-red-400';

    const renderChangeValue = () => {
        if (!hasChange) {
            return '';
        }
        const formatted = formatNumber(Math.abs(stat.change ?? 0), changeDecimals, changeDecimals);
        const suffix = stat.changeFormat === 'plain' ? '' : '%';
        return `${formatted}${suffix}`;
    };

    const icon = hasChange ? (
        changeIsPositive ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l5 5L20 7" />
            </svg>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12l-5-5L4 17" />
            </svg>
        )
    ) : null;

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 flex items-start justify-between">
            <div>
                <p className="text-sm text-gray-400">{t(stat.labelKey)}</p>
                <p className="text-2xl font-bold text-white mt-2">{formatValue()}</p>
                <p className="text-xs text-gray-500">{t(stat.subLabelKey, stat.subLabelParams)}</p>
            </div>
            {hasChange && (
                <div className="text-right">
                    {icon}
                    <p className={`text-sm font-semibold mt-2 ${changeColor}`}>
                        {(stat.change ?? 0) === 0 ? '' : changeIsPositive ? '+' : '-'}{renderChangeValue()}
                    </p>
                </div>
            )}
        </div>
    );
};

export default StatCard;