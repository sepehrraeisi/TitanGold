import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import StatCard from './StatCard.tsx';
import TradingChartWidget from './TradingChartWidget.tsx';
import QuickTradeWidget from './QuickTradeWidget.tsx';
import AIAssistantWidget from './AIAssistantWidget.tsx';
import PortfolioDonutChartWidget from './PortfolioDonutChartWidget.tsx';
import PerformanceAnalysisWidget from './PerformanceAnalysisWidget.tsx';
import RecentTradesWidget from './RecentTradesWidget.tsx';
import { executeManualQuickTrade, fetchManualTradingPageData, toggleManualStrategy } from '../../services/api.ts';
import type { ManualQuickTradeOrder, ManualTradingPageData, ManualTradingStat } from '../../types.ts';

type FeedbackState = { type: 'success' | 'error'; message: string } | null;

const ManualTrades: React.FC = () => {
    const { t, language } = useLanguage();
    const [data, setData] = useState<ManualTradingPageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionPending, setIsActionPending] = useState(false);
    const [feedback, setFeedback] = useState<FeedbackState>(null);

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetchManualTradingPageData();
            setData(response);
        } catch (error) {
            console.error('Failed to load manual trading data', error);
            setFeedback({ type: 'error', message: t('manual_trades_error_loading') });
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        if (!feedback) {
            return;
        }
        const timer = setTimeout(() => setFeedback(null), 4000);
        return () => clearTimeout(timer);
    }, [feedback]);

    const formatStatValue = useCallback((stat: ManualTradingStat): string => {
        const decimals = stat.decimals ?? (stat.format === 'currency' ? 2 : stat.format === 'percent' ? 1 : 0);
        if (stat.format === 'currency') {
            const formatter = new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: decimals,
                minimumFractionDigits: decimals,
            });
            const formatted = formatter.format(Math.abs(stat.value));
            if (stat.showSign) {
                const sign = stat.value >= 0 ? '+' : '-';
                return `${sign}${formatted}`;
            }
            return formatted;
        }

        if (stat.format === 'percent') {
            const sign = stat.showSign && stat.value >= 0 ? '+' : stat.showSign ? '' : '';
            return `${sign}${stat.value.toFixed(decimals)}%`;
        }

        if (stat.decimals !== undefined) {
            const formatter = new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
                maximumFractionDigits: stat.decimals,
                minimumFractionDigits: stat.decimals,
            });
            return formatter.format(stat.value);
        }

        return stat.value.toString();
    }, [language]);

    const formattedStats = useMemo(() => {
        if (!data) {
            return [] as Array<{ id: string; label: string; value: string; subValue?: string }>;
        }
        return data.stats.map(stat => ({
            id: stat.id,
            label: t(stat.labelKey),
            value: formatStatValue(stat),
            subValue: stat.subLabelKey ? t(stat.subLabelKey) : undefined,
        }));
    }, [data, formatStatValue, t]);

    const lastUpdatedLabel = useMemo(() => {
        if (!data) {
            return '';
        }
        const date = new Date(data.lastUpdated);
        const formatter = new Intl.DateTimeFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
        return t('last_updated', { time: formatter.format(date) });
    }, [data, language, t]);

    const handleQuickTrade = useCallback(async (order: ManualQuickTradeOrder) => {
        setIsActionPending(true);
        try {
            const updated = await executeManualQuickTrade(order);
            setData(updated);
            setFeedback({ type: 'success', message: t('manual_trades_quick_trade_success') });
        } catch (error) {
            console.error('Failed to execute quick trade', error);
            setFeedback({ type: 'error', message: t('manual_trades_error_action') });
        } finally {
            setIsActionPending(false);
        }
    }, [t]);

    const handleStrategyToggle = useCallback(async (strategyId: string) => {
        setIsActionPending(true);
        try {
            const updated = await toggleManualStrategy(strategyId);
            setData(updated);
            setFeedback({ type: 'success', message: t('manual_trades_strategy_updated') });
        } catch (error) {
            console.error('Failed to toggle strategy', error);
            setFeedback({ type: 'error', message: t('manual_trades_error_action') });
        } finally {
            setIsActionPending(false);
        }
    }, [t]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-32 bg-[#1c1e2f] border border-gray-700/50 rounded-lg animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {Array.from({ length: 7 }).map((_, index) => (
                        <div key={index} className="h-24 bg-[#1c1e2f] border border-gray-700/50 rounded-lg animate-pulse" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-64 bg-[#1c1e2f] border border-gray-700/50 rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="space-y-4">
                <div className="bg-[#1c1e2f] border border-red-500/40 rounded-lg p-6">
                    <p className="text-sm text-gray-300">{t('manual_trades_error_loading')}</p>
                    <button
                        onClick={() => {
                            setFeedback(null);
                            void loadData();
                        }}
                        className="mt-4 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        {t('retry')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-bold text-white">{t('professional_manual_trades')}</h2>
                        <p className="text-gray-400">{t('professional_manual_desc')}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-300">
                        <span>{lastUpdatedLabel}</span>
                        <button
                            onClick={() => void loadData()}
                            className="px-3 py-1 rounded-md border border-purple-400/40 text-purple-200 hover:bg-purple-500/20"
                            disabled={isActionPending}
                        >
                            {t('refresh')}
                        </button>
                    </div>
                </div>
                <p className="text-xs text-yellow-400 mt-2 animate-pulse">{t('simulation_mode')}</p>
            </div>

            {feedback && (
                <div
                    className={`rounded-lg border px-4 py-3 text-sm ${
                        feedback.type === 'success'
                            ? 'border-green-500/40 bg-green-500/10 text-green-200'
                            : 'border-red-500/40 bg-red-500/10 text-red-200'
                    }`}
                >
                    {feedback.message}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {formattedStats.map(stat => (
                    <StatCard
                        key={stat.id}
                        label={stat.label}
                        value={stat.value}
                        subValue={stat.subValue}
                    />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <TradingChartWidget chart={data.chart} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <QuickTradeWidget
                            data={data.quickTrade}
                            onSubmit={handleQuickTrade}
                            disabled={isActionPending}
                        />
                        <AIAssistantWidget
                            recommendations={data.recommendations}
                            sentiment={data.sentiment}
                            strategies={data.strategies}
                            onToggleStrategy={handleStrategyToggle}
                            disabled={isActionPending}
                        />
                    </div>
                </div>
                <div className="space-y-6">
                    <PortfolioDonutChartWidget portfolio={data.portfolio} />
                    <PerformanceAnalysisWidget performance={data.performance} />
                    <RecentTradesWidget trades={data.recentTrades} />
                </div>
            </div>
        </div>
    );
};

export default ManualTrades;
