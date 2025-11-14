import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { PortfolioDistributionSlice } from '../../types.ts';

interface AssetDistributionWidgetProps {
    distribution: PortfolioDistributionSlice[];
}

const AssetDistributionWidget: React.FC<AssetDistributionWidgetProps> = ({ distribution }) => {
    const { t } = useLanguage();

    const segments = useMemo(() => {
        let cumulativeOffset = 0;
        return distribution.map(slice => {
            const dashArray = `${slice.percentage} ${100 - slice.percentage}`;
            const dashOffset = -cumulativeOffset;
            cumulativeOffset += slice.percentage;
            return {
                ...slice,
                dashArray,
                dashOffset,
            };
        });
    }, [distribution]);

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <h3 className="font-semibold text-white mb-4">{t('asset_distribution')}</h3>
            {distribution.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-gray-400">
                    {t('no_distribution_data')}
                </div>
            ) : (
                <div className="flex items-center justify-center h-full gap-6">
                    <svg
                        width="240"
                        height="240"
                        viewBox="0 0 50 50"
                        className="w-full h-full max-w-[240px] max-h-[240px]"
                    >
                        <circle
                            cx="25"
                            cy="25"
                            r="15.915"
                            fill="transparent"
                            stroke="#1f2937"
                            strokeWidth="8"
                        ></circle>
                        {segments.map(segment => (
                            <circle
                                key={segment.id}
                                cx="25"
                                cy="25"
                                r="15.915"
                                fill="transparent"
                                stroke={segment.color}
                                strokeWidth="8"
                                strokeDasharray={segment.dashArray}
                                strokeDashoffset={segment.dashOffset}
                                strokeLinecap="round"
                            ></circle>
                        ))}
                        <text
                            x="50%"
                            y="50%"
                            dominantBaseline="middle"
                            textAnchor="middle"
                            fill="#e5e7eb"
                            fontSize="10"
                            fontWeight={600}
                        >
                            {t('allocation')}
                        </text>
                    </svg>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                        {distribution.map(item => (
                            <div key={item.id} className="flex items-center gap-3">
                                <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: item.color }}
                                ></span>
                                <div className="flex flex-col">
                                    <span className="text-white font-semibold">{item.asset}</span>
                                    <span className="text-gray-400">
                                        {item.percentage.toFixed(2)}% · ${item.value.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDistributionWidget;
