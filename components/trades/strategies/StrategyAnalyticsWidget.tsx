import React, { useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { Strategy } from '../../../types.ts';

interface StrategyAnalyticsWidgetProps {
    strategy: Strategy | null;
}

const StrategyAnalyticsWidget: React.FC<StrategyAnalyticsWidgetProps> = ({ strategy }) => {
    const { t } = useLanguage();

    const metrics = useMemo(() => {
        if (!strategy) {
            return {
                sharpeRatio: 0,
                maxDrawdown: 0,
                winRate: 0,
                avgReturn: 0,
                volatility: 0,
                calmarRatio: 0,
            };
        }

        return {
            sharpeRatio: strategy.sharpe || 0,
            maxDrawdown: strategy.maxDrawdown || 0,
            winRate: strategy.winRate || 0,
            avgReturn: strategy.roi || 0,
            volatility: Math.abs(strategy.maxDrawdown || 0) * 1.5, // Estimated volatility
            calmarRatio: strategy.roi && strategy.maxDrawdown 
                ? (strategy.roi / Math.abs(strategy.maxDrawdown)) 
                : 0,
        };
    }, [strategy]);

    if (!strategy) {
        return (
            <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3">{t('strategy_analytics') || 'Strategy Analytics'}</h3>
                <p className="text-sm text-center text-gray-500 py-10">{t('select_strategy_prompt') || 'Select a strategy to view analytics'}</p>
            </div>
        );
    }

    const MetricCard: React.FC<{ label: string; value: string | number; color?: string }> = ({ label, value, color = 'text-white' }) => (
        <div className="p-3 bg-gray-800/40 rounded-md">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className={`text-lg font-semibold ${color}`}>
                {typeof value === 'number' ? value.toFixed(2) : value}
            </p>
        </div>
    );

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('strategy_analytics') || 'Strategy Analytics'}</h3>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <MetricCard
                        label={t('sharpe_ratio') || 'Sharpe Ratio'}
                        value={metrics.sharpeRatio}
                        color={metrics.sharpeRatio > 2 ? 'text-green-400' : metrics.sharpeRatio > 1 ? 'text-yellow-400' : 'text-red-400'}
                    />
                    <MetricCard
                        label={t('max_drawdown') || 'Max Drawdown'}
                        value={`${metrics.maxDrawdown.toFixed(2)}%`}
                        color="text-red-400"
                    />
                    <MetricCard
                        label={t('win_rate') || 'Win Rate'}
                        value={`${metrics.winRate.toFixed(1)}%`}
                        color={metrics.winRate > 60 ? 'text-green-400' : metrics.winRate > 50 ? 'text-yellow-400' : 'text-red-400'}
                    />
                    <MetricCard
                        label={t('avg_return') || 'Avg Return'}
                        value={`${metrics.avgReturn.toFixed(1)}%`}
                        color={metrics.avgReturn > 0 ? 'text-green-400' : 'text-red-400'}
                    />
                    <MetricCard
                        label={t('volatility') || 'Volatility'}
                        value={`${metrics.volatility.toFixed(2)}%`}
                        color="text-yellow-400"
                    />
                    <MetricCard
                        label={t('calmar_ratio') || 'Calmar Ratio'}
                        value={metrics.calmarRatio}
                        color={metrics.calmarRatio > 3 ? 'text-green-400' : metrics.calmarRatio > 1 ? 'text-yellow-400' : 'text-red-400'}
                    />
                </div>

                <div className="pt-4 border-t border-gray-700/50">
                    <h4 className="text-sm font-semibold text-white mb-2">{t('risk_assessment') || 'Risk Assessment'}</h4>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">{t('risk_level') || 'Risk Level'}:</span>
                            <span className={
                                metrics.maxDrawdown < 5 ? 'text-green-400' :
                                metrics.maxDrawdown < 10 ? 'text-yellow-400' : 'text-red-400'
                            }>
                                {metrics.maxDrawdown < 5 ? t('low') || 'Low' :
                                 metrics.maxDrawdown < 10 ? t('medium') || 'Medium' : t('high') || 'High'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">{t('performance_rating') || 'Performance Rating'}:</span>
                            <span className={
                                metrics.sharpeRatio > 2 && metrics.winRate > 60 ? 'text-green-400' :
                                metrics.sharpeRatio > 1 && metrics.winRate > 50 ? 'text-yellow-400' : 'text-red-400'
                            }>
                                {metrics.sharpeRatio > 2 && metrics.winRate > 60 ? t('excellent') || 'Excellent' :
                                 metrics.sharpeRatio > 1 && metrics.winRate > 50 ? t('good') || 'Good' : t('needs_improvement') || 'Needs Improvement'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StrategyAnalyticsWidget;

