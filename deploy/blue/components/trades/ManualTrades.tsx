import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import StatCard from './StatCard.tsx';
import TradingChartWidget from './TradingChartWidget.tsx';
import QuickTradeWidget from './QuickTradeWidget.tsx';
import AdvancedOrderWidget from './AdvancedOrderWidget.tsx';
import OrderBookWidget from './OrderBookWidget.tsx';
import TradeHistoryWidget from './TradeHistoryWidget.tsx';
import OpenOrdersWidget from './OpenOrdersWidget.tsx';
import AIAssistantWidget from './AIAssistantWidget.tsx';
import PortfolioDonutChartWidget from './PortfolioDonutChartWidget.tsx';
import PerformanceAnalysisWidget from './PerformanceAnalysisWidget.tsx';
import RecentTradesWidget from './RecentTradesWidget.tsx';
import { executeManualQuickTrade, fetchManualTradingPageData, toggleManualStrategy, placeAdvancedOrder } from '../../services/api.ts';
import type { ManualQuickTradeOrder, ManualTradingPageData, ManualTradingStat } from '../../types.ts';

type FeedbackState = { type: 'success' | 'error'; message: string } | null;

const ManualTrades: React.FC = () => {
    const { t, language } = useLanguage();
    const [data, setData] = useState<ManualTradingPageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionPending, setIsActionPending] = useState(false);
    const [feedback, setFeedback] = useState<FeedbackState>(null);
    const [selectedPair, setSelectedPair] = useState<string>('BTC/USDT');
    const [activeView, setActiveView] = useState<'quick' | 'advanced'>('quick');

    const loadData = useCallback(async (silent = false) => {
        try {
            // Only show loading spinner on initial load, not on refreshes
            if (!silent) {
                setIsLoading(true);
            }
            setFeedback(null); // Clear previous errors
            if (!silent) {
                console.log('🔄 Loading manual trading data from backend...');
            }
            const response = await fetchManualTradingPageData();
            if (!silent) {
                console.log('✅ Manual trading data received:', response);
            }
            setData(response);
        } catch (error: any) {
            console.error('❌ Failed to load manual trading data:', error);
            const errorMessage = error?.message || t('manual_trades_error_loading');
            setFeedback({ 
                type: 'error', 
                message: `${t('manual_trades_error_loading')}: ${errorMessage}. Please ensure backend is running and MEXC API keys are configured.` 
            });
            setData(null); // Clear data on error
        } finally {
            if (!silent) {
                setIsLoading(false);
            }
        }
    }, [t]);

    useEffect(() => {
        void loadData(false); // Initial load with loading spinner
        // Refresh data every 30 seconds for real-time updates (silent mode)
        const interval = setInterval(() => {
            if (!isActionPending) {
                void loadData(true); // Silent refresh - no loading spinner, no flicker
            }
        }, 30000); // 30 seconds instead of 10
        return () => clearInterval(interval);
    }, [loadData, isActionPending]);

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
        if (!data || !data.lastUpdated) {
            return '';
        }
        
        try {
            const date = new Date(data.lastUpdated);
            // Check if date is valid
            if (isNaN(date.getTime())) {
                console.warn('Invalid lastUpdated date:', data.lastUpdated);
                return '';
            }
            
            const formatter = new Intl.DateTimeFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit',
            });
            return t('last_updated', { time: formatter.format(date) });
        } catch (error) {
            console.error('Error formatting lastUpdated:', error);
            return '';
        }
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

    const handleAdvancedOrder = useCallback(async (order: {
        type: 'market' | 'limit' | 'stop-loss' | 'take-profit' | 'stop-limit';
        side: 'buy' | 'sell';
        price?: number;
        amount: number;
        stopPrice?: number;
        limitPrice?: number;
    }) => {
        setIsActionPending(true);
        try {
            const updated = await placeAdvancedOrder({
                ...order,
                pair: selectedPair,
            });
            setData(updated);
            setFeedback({ type: 'success', message: t('order_placed_successfully') || 'Order placed successfully' });
        } catch (error: any) {
            console.error('Failed to place advanced order', error);
            setFeedback({ type: 'error', message: error?.message || t('manual_trades_error_action') });
        } finally {
            setIsActionPending(false);
        }
    }, [selectedPair, t]);

    const handleOrderCancel = useCallback(async () => {
        await loadData();
    }, [loadData]);

    if (isLoading) {
        return (
            <div className="space-y-4 sm:space-y-6">
                {/* Header Skeleton */}
                <div className="h-32 bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl animate-pulse" />
                
                {/* Stats Skeleton */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
                    {Array.from({ length: 7 }).map((_, index) => (
                        <div key={index} className="h-24 bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-lg animate-pulse" />
                    ))}
                </div>
                
                {/* Content Skeleton */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
                    <div className="xl:col-span-2 space-y-4 sm:space-y-6">
                        <div className="h-96 bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl animate-pulse" />
                        <div className="h-64 bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl animate-pulse" />
                    </div>
                    <div className="space-y-4 sm:space-y-6">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="h-48 bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="space-y-4">
                <div className="bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/40 rounded-xl p-6 sm:p-8 shadow-lg">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-red-200 mb-2">{t('manual_trades_error_loading')}</h3>
                            <p className="text-sm text-gray-300 mb-4">{t('manual_trades_error_loading')}</p>
                            <button
                                onClick={() => {
                                    setFeedback(null);
                                    void loadData();
                                }}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium transition-all duration-200 shadow-lg shadow-purple-500/30 active:scale-95"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {t('retry')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 pb-6">
            {/* Header Section - Improved Design */}
            <div className="bg-gradient-to-br from-purple-600/20 via-blue-600/20 to-indigo-600/20 border border-purple-500/30 rounded-xl p-4 sm:p-6 shadow-lg shadow-purple-500/10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-white">{t('professional_manual_trades')}</h2>
                                <p className="text-gray-400 text-xs sm:text-sm mt-0.5">{t('professional_manual_desc')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/40">
                                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                                <span className="text-xs text-yellow-300 font-medium">{t('simulation_mode')}</span>
                            </span>
                            {lastUpdatedLabel && (
                                <span className="text-xs text-gray-400">{lastUpdatedLabel}</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            onClick={() => void loadData()}
                            disabled={isActionPending}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-400/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 hover:border-purple-400/60 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        >
                            <svg className={`w-4 h-4 ${isActionPending ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span className="text-sm font-medium">{t('refresh')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Improved Feedback Messages */}
            {feedback && (
                <div
                    className={`rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm animate-in slide-in-from-top-2 duration-300 ${
                        feedback.type === 'success'
                            ? 'border-green-500/50 bg-gradient-to-r from-green-500/20 to-emerald-500/10 text-green-200 shadow-green-500/20'
                            : 'border-red-500/50 bg-gradient-to-r from-red-500/20 to-rose-500/10 text-red-200 shadow-red-500/20'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {feedback.type === 'success' ? (
                            <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        <span className="font-medium">{feedback.message}</span>
                    </div>
                </div>
            )}

            {/* Stats Grid - Improved Layout */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
                {formattedStats.map((stat, index) => (
                    <StatCard
                        key={stat.id}
                        label={stat.label}
                        value={stat.value}
                        subValue={stat.subValue}
                    />
                ))}
            </div>

            {/* Pair Selector - Improved Design */}
            <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-4 sm:p-5 shadow-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <label className="text-sm font-medium text-gray-300 whitespace-nowrap flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        {t('trading_pair')}:
                    </label>
                    <select
                        value={selectedPair}
                        onChange={e => setSelectedPair(e.target.value)}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-gray-800/60 border border-gray-700 rounded-lg text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all hover:border-gray-600"
                    >
                        <option value="BTC/USDT">BTC/USDT</option>
                        <option value="ETH/USDT">ETH/USDT</option>
                        <option value="BNB/USDT">BNB/USDT</option>
                        <option value="SOL/USDT">SOL/USDT</option>
                        <option value="XRP/USDT">XRP/USDT</option>
                    </select>
                </div>
            </div>

            {/* Main Content Grid - Improved Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
                <div className="xl:col-span-2 space-y-4 sm:space-y-6">
                    {/* Chart and Order Book - Improved Spacing */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                        <div className="lg:col-span-2">
                            <TradingChartWidget 
                                chart={data.chart}
                                onTimeframeChange={(timeframe) => {
                                    console.log('Timeframe changed to:', timeframe);
                                    // TODO: Fetch chart data for selected timeframe
                                }}
                            />
                        </div>
                        <div className="hidden lg:block">
                            <OrderBookWidget 
                                pair={selectedPair}
                                onPriceSelect={(price) => {
                                    // Set price in order widget when clicked
                                    console.log('Price selected from order book:', price);
                                }}
                            />
                        </div>
                    </div>

                    {/* Trading Widgets - Improved Design */}
                    <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-4 sm:p-6 shadow-lg">
                        <div className="flex flex-wrap gap-2 mb-6">
                            <button
                                onClick={() => setActiveView('quick')}
                                className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                                    activeView === 'quick'
                                        ? 'bg-gradient-to-r from-purple-600/40 to-blue-600/40 text-white border border-purple-500/50 shadow-lg shadow-purple-500/20'
                                        : 'bg-gray-700/40 text-gray-300 border border-gray-700 hover:bg-gray-700/60 hover:border-gray-600'
                                }`}
                            >
                                {t('quick_trade')}
                            </button>
                            <button
                                onClick={() => setActiveView('advanced')}
                                className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                                    activeView === 'advanced'
                                        ? 'bg-gradient-to-r from-purple-600/40 to-blue-600/40 text-white border border-purple-500/50 shadow-lg shadow-purple-500/20'
                                        : 'bg-gray-700/40 text-gray-300 border border-gray-700 hover:bg-gray-700/60 hover:border-gray-600'
                                }`}
                            >
                                {t('advanced_orders')}
                            </button>
                        </div>
                        {activeView === 'quick' ? (
                            <QuickTradeWidget
                                data={data.quickTrade}
                                onSubmit={handleQuickTrade}
                                disabled={isActionPending}
                            />
                        ) : (
                            <AdvancedOrderWidget
                                pair={selectedPair}
                                currentPrice={data.quickTrade.price}
                                availableBalance={data.quickTrade.availableBalance}
                                onSubmit={handleAdvancedOrder}
                                disabled={isActionPending}
                            />
                        )}
                    </div>

                    {/* AI Assistant */}
                    <AIAssistantWidget
                        recommendations={data.recommendations}
                        sentiment={data.sentiment}
                        strategies={data.strategies}
                        onToggleStrategy={handleStrategyToggle}
                        disabled={isActionPending}
                    />

                    {/* Trade History */}
                    <TradeHistoryWidget pair={selectedPair} limit={20} />
                </div>
                {/* Sidebar - Improved Spacing */}
                <div className="space-y-4 sm:space-y-6">
                    {/* Order Book for mobile */}
                    <div className="lg:hidden">
                        <OrderBookWidget 
                            pair={selectedPair}
                            onPriceSelect={(price) => {
                                console.log('Price selected from order book:', price);
                            }}
                        />
                    </div>
                    <PortfolioDonutChartWidget portfolio={data.portfolio} />
                    <PerformanceAnalysisWidget performance={data.performance} />
                    <OpenOrdersWidget 
                        pair={selectedPair}
                        onCancel={handleOrderCancel}
                    />
                    <RecentTradesWidget trades={data.recentTrades} />
                </div>
            </div>
        </div>
    );
};

export default ManualTrades;
