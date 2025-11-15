import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { ManualTradingPortfolioSlice } from '../../types.ts';

interface PortfolioDonutChartWidgetProps {
    portfolio: ManualTradingPortfolioSlice[];
}

const PortfolioDonutChartWidget: React.FC<PortfolioDonutChartWidgetProps> = ({ portfolio }) => {
    const { t, language } = useLanguage();
    const currencyFormatter = useMemo(() => new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }), [language]);

    const donutSegments = useMemo(() => {
        let offset = 0;
        return portfolio.map(slice => {
            const segment = {
                ...slice,
                dashArray: `${slice.percentage}, 100`,
                dashOffset: -offset,
            };
            offset += slice.percentage;
            return segment;
        });
    }, [portfolio]);

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('portfolio_overview')}</h3>
            {portfolio.length === 0 ? (
                <div className="text-xs text-gray-400 bg-gray-800/40 border border-dashed border-gray-700 rounded-md p-4 text-center">
                    {t('manual_trades_empty_portfolio')}
                </div>
            ) : (
                <div className="flex items-center justify-center gap-6">
                    <div className="relative w-32 h-32">
                        <svg viewBox="0 0 36 36" className="w-full h-full">
                            <circle cx="18" cy="18" r="15.915" fill="none" stroke="#374151" strokeWidth="3" />
                            {donutSegments.map(segment => (
                                <circle
                                    key={segment.id}
                                    cx="18"
                                    cy="18"
                                    r="15.915"
                                    fill="none"
                                    stroke={segment.color}
                                    strokeWidth="3"
                                    strokeDasharray={segment.dashArray}
                                    strokeDashoffset={segment.dashOffset}
                                />
                            ))}
                        </svg>
                    </div>
                    <div className="text-sm space-y-2">
                        {portfolio.map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-gray-200">{item.asset}</span>
                                <span className="font-semibold text-gray-300">{item.percentage.toFixed(1)}%</span>
                                <span className="text-xs text-gray-400">{currencyFormatter.format(item.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortfolioDonutChartWidget;
