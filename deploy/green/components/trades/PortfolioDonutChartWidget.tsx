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

    const { donutSegments, totalValue } = useMemo(() => {
        let offset = 0;
        const segments = portfolio.map(slice => {
            const segment = {
                ...slice,
                dashArray: `${slice.percentage}, 100`,
                dashOffset: -offset,
            };
            offset += slice.percentage;
            return segment;
        });
        const total = portfolio.reduce((sum, item) => sum + item.value, 0);
        return { donutSegments: segments, totalValue: total };
    }, [portfolio]);

    return (
        <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-5 sm:p-6 shadow-lg">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-700/50">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <div>
                    <h3 className="font-bold text-white text-lg">{t('portfolio_overview')}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Asset distribution</p>
                </div>
            </div>

            {portfolio.length === 0 ? (
                <div className="bg-gray-800/30 border border-dashed border-gray-700/50 rounded-xl p-8 text-center">
                    <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-sm text-gray-400">{t('manual_trades_empty_portfolio')}</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Donut Chart */}
                    <div className="relative flex items-center justify-center">
                        <div className="relative w-40 h-40 sm:w-48 sm:h-48">
                            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                                {/* Background Circle */}
                                <circle 
                                    cx="18" 
                                    cy="18" 
                                    r="15.915" 
                                    fill="none" 
                                    stroke="#374151" 
                                    strokeWidth="3" 
                                />
                                {/* Segments */}
                                {donutSegments.map((segment, index) => (
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
                                        strokeLinecap="round"
                                        className="transition-all duration-300 hover:opacity-80"
                                    />
                                ))}
                            </svg>
                            {/* Center Text */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className="text-xs text-gray-400 mb-0.5">Total</div>
                                <div className="text-lg font-bold text-white">
                                    {currencyFormatter.format(totalValue)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="space-y-2.5">
                        {portfolio.map((item, index) => (
                            <div 
                                key={item.id} 
                                className="flex items-center justify-between bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700/50 rounded-lg p-3 transition-all duration-200 group"
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div 
                                        className="w-4 h-4 rounded-full flex-shrink-0 shadow-lg"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-white text-sm">{item.asset}</span>
                                            <span className="text-xs text-gray-400">({item.symbol})</span>
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {currencyFormatter.format(item.value)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 ml-3">
                                    <div className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30">
                                        <span className="text-sm font-bold text-blue-300">
                                            {item.percentage.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortfolioDonutChartWidget;
