import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { PortfolioMonthlyReturn } from '../../types.ts';

interface MonthlyReturnsWidgetProps {
    returns: PortfolioMonthlyReturn[];
}

const MonthlyReturnsWidget: React.FC<MonthlyReturnsWidgetProps> = ({ returns }) => {
    const { t, language } = useLanguage();

    const dateFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
                month: 'short',
                year: 'numeric',
            }),
        [language],
    );

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('monthly_returns')}</h3>
            {returns.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-sm text-gray-400">
                    {t('no_monthly_returns')}
                </div>
            ) : (
                <div className="space-y-3 text-sm">
                    {returns.map(item => {
                        const positive = item.value >= 0;
                        const label = dateFormatter.format(new Date(item.month));
                        return (
                            <div key={item.id} className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-gray-300">{label}</span>
                                    {typeof item.benchmark === 'number' && (
                                        <span className="text-xs text-gray-500">
                                            {t('benchmark_return', { value: item.benchmark.toFixed(2) })}
                                        </span>
                                    )}
                                </div>
                                <span
                                    className={`font-semibold ${positive ? 'text-green-400' : 'text-red-400'}`}
                                >
                                    {positive ? '+' : ''}{item.value.toFixed(2)}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MonthlyReturnsWidget;
