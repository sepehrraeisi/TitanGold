import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { AnalysisRiskMetric } from '../../types.ts';

interface RiskAnalysisWidgetProps {
    metrics: AnalysisRiskMetric[];
}

const RiskAnalysisWidget: React.FC<RiskAnalysisWidgetProps> = ({ metrics }) => {
    const { t, language } = useLanguage();
    const locale = language === 'fa' ? 'fa-IR' : 'en-US';

    const formatMetricValue = (metric: AnalysisRiskMetric) => {
        const decimals = metric.decimals ?? 2;
        const formatter = new Intl.NumberFormat(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });

        switch (metric.format) {
            case 'currency':
                return `${metric.prefix ?? ''}${formatter.format(metric.value)}${metric.suffix ?? ''}`;
            case 'percent':
                return `${formatter.format(metric.value)}%`;
            case 'ratio':
                return `1:${formatter.format(metric.value)}`;
            default:
                return formatter.format(metric.value);
        }
    };

    const formatChange = (metric: AnalysisRiskMetric) => {
        if (typeof metric.change !== 'number') {
            return null;
        }
        const decimals = metric.changeDecimals ?? (metric.changeFormat === 'plain' ? 2 : 1);
        const formatter = new Intl.NumberFormat(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
        const suffix = metric.changeFormat === 'plain' ? '' : '%';
        const direction = metric.changeDirection ?? (metric.change >= 0 ? 'up' : 'down');
        const sign = metric.change === 0 ? '' : direction === 'up' ? '+' : '-';
        const color = direction === 'up' ? 'text-emerald-400' : 'text-rose-400';
        return (
            <span className={`text-xs font-medium ${color}`}>
                {sign}{formatter.format(Math.abs(metric.change))}{suffix}
            </span>
        );
    };

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <h3 className="font-semibold text-white mb-4">{t('risk_analysis')}</h3>
            {metrics.length === 0 ? (
                <p className="text-xs text-gray-500">{t('no_risk_metrics')}</p>
            ) : (
                <div className="space-y-3">
                    {metrics.map(metric => (
                        <div key={metric.id} className="flex justify-between items-center p-2 bg-gray-800/30 rounded-md">
                            <div>
                                <p className="text-sm text-gray-300">{t(metric.labelKey)}</p>
                                {metric.descriptionKey && (
                                    <p className="text-xs text-gray-500">{t(metric.descriptionKey)}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-white">{formatMetricValue(metric)}</p>
                                {formatChange(metric)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RiskAnalysisWidget;