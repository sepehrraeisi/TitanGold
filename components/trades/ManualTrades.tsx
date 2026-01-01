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
        <div className="space-y-4 sm:space-y-6">
            <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-white">{t('professional_manual_trades')}</h2>
                        <p className="text-gray-400 text-xs sm:text-sm">{t('professional_manual_desc')}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs text-gray-300">
                        <span className="text-xs">{lastUpdatedLabel}</span>
                        <button
                            onClick={() => void loadData()}
                            className="px-3 py-1.5 rounded-md border border-purple-400/40 text-purple-200 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
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

            {/* Pair Selector */}
            <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <label className="text-sm text-gray-400 whitespace-nowrap">{t('trading_pair')}:</label>
                    <select
                        value={selectedPair}
                        onChange={e => setSelectedPair(e.target.value)}
                        className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="BTC/USDT">BTC/USDT</option>
                        <option value="ETH/USDT">ETH/USDT</option>
                        <option value="BNB/USDT">BNB/USDT</option>
                        <option value="SOL/USDT">SOL/USDT</option>
                        <option value="XRP/USDT">XRP/USDT</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
                <div className="xl:col-span-2 space-y-4 sm:space-y-6">
                    {/* Chart and Order Book */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

                    {/* Trading Widgets */}
                    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-3 sm:p-4">
                        <div className="flex flex-wrap gap-2 mb-4">
                            <button
                                onClick={() => setActiveView('quick')}
                                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                                    activeView === 'quick'
                                        ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50'
                                        : 'bg-gray-700/40 text-gray-300 border border-gray-700 hover:bg-gray-700'
                                }`}
                            >
                                {t('quick_trade')}
                            </button>
                            <button
                                onClick={() => setActiveView('advanced')}
                                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                                    activeView === 'advanced'
                                        ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50'
                                        : 'bg-gray-700/40 text-gray-300 border border-gray-700 hover:bg-gray-700'
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
