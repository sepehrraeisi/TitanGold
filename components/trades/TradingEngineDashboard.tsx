import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type { ArtemisState } from '../../types.ts';
import { ConfirmModal } from '../ui/confirm-modal.tsx';
import { Toast } from '../ui/toast.tsx';

interface TradingEngineStatus {
    isRunning: boolean;
    mode: 'demo' | 'live';
    activeTrades: number;
    maxConcurrentTrades: number;
    queueSize: number;
    stats: {
        totalOpportunities: number;
        executedTrades: number;
        successfulTrades: number;
        failedTrades: number;
        totalProfit: number;
        dailyProfit: number;
        dailyLoss: number;
    };
    scanners: string[];
}

interface Trade {
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    type: string;
    entryPrice: number;
    currentPrice?: number;
    quantity: number;
    status: string;
    profit?: number;
    profitPercent?: number;
    createdAt: number;
}

interface Opportunity {
    id: string;
    symbol: string;
    type: string;
    side: 'BUY' | 'SELL';
    price: number;
    confidence: number;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    timestamp: number;
}

interface TradingEngineDashboardProps {
    autopilotState?: any;
    artemisState?: any;
    tradingEngineStatus?: TradingEngineStatus | null;
    onStatusChange?: () => void;
}

const TradingEngineDashboard: React.FC<TradingEngineDashboardProps> = ({ autopilotState, artemisState, tradingEngineStatus: propStatus, onStatusChange }) => {
    const { t } = useLanguage();
    const [status, setStatus] = useState<TradingEngineStatus | null>(propStatus || null);
    const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [artemis, setArtemis] = useState<ArtemisState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [config, setConfig] = useState<any>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [opportunityFilter, setOpportunityFilter] = useState<'all' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('all');
    
    // Sync with autopilot state if provided
    useEffect(() => {
        if (autopilotState && !status) {
            // If we have autopilot state but no engine status, try to infer
            // This ensures consistency between the two sections
        }
    }, [autopilotState, status]);

    // Sync with prop status
    useEffect(() => {
        if (propStatus) {
            setStatus(propStatus);
        }
    }, [propStatus]);

    useEffect(() => {
        fetchData();
        // Only refresh if not loading and backend is available
        const interval = setInterval(() => {
            if (!isLoading && propStatus) {
                fetchData();
            }
        }, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, []); // Empty dependency array - only run once on mount

    const fetchData = async () => {
        try {
            // Use prop status if available, otherwise fetch
            if (propStatus) {
                setStatus(propStatus);
            } else {
                const statusData = await api.fetchTradingEngineStatus().catch(err => {
                    console.error('Failed to fetch trading engine status:', err);
                    return null;
                });
                if (statusData) {
                    setStatus(statusData);
                }
            }

            const [tradesData, opportunitiesData] = await Promise.all([
                api.fetchActiveTrades().catch(() => []),
                api.fetchTradingOpportunities().catch(() => []),
            ]);
            
            setActiveTrades(tradesData || []);
            setOpportunities(opportunitiesData || []);
            
            if (artemisState) {
                // Use parent artemis state if available
                setArtemis(artemisState);
            } else {
                const artemisData = await api.fetchArtemisState().catch(() => null);
                if (artemisData) {
                    setArtemis(artemisData);
                }
            }
        } catch (error) {
            console.error('Failed to fetch trading engine data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStart = async () => {
        setIsStarting(true);
        try {
            await api.startTradingEngine();
            await fetchData();
            if (onStatusChange) onStatusChange();
        } catch (error) {
            setToast({ message: t('operation_failed') || 'Failed to start trading engine', type: 'error' });
        } finally {
            setIsStarting(false);
        }
    };

    const handleStop = async () => {
        setIsStopping(true);
        try {
            await api.stopTradingEngine();
            await fetchData();
            if (onStatusChange) onStatusChange();
        } catch (error) {
            setToast({ message: t('operation_failed') || 'Failed to stop trading engine', type: 'error' });
        } finally {
            setIsStopping(false);
        }
    };

    // Emergency Stop handler removed - using parent's handler instead

    // Filter opportunities by priority
    const filteredOpportunities = useMemo(() => {
        if (opportunityFilter === 'all') return opportunities;
        return opportunities.filter(opp => opp.priority === opportunityFilter);
    }, [opportunities, opportunityFilter]);

    // Sort opportunities by priority and confidence
    const sortedOpportunities = useMemo(() => {
        const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return [...filteredOpportunities].sort((a, b) => {
            const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
            if (priorityDiff !== 0) return priorityDiff;
            return b.confidence - a.confidence;
        });
    }, [filteredOpportunities]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const formatPercent = (value: number) => {
        return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    };

    if (isLoading) {
        return (
            <div className="text-center p-10">
                <div className="animate-spin text-4xl mb-2">⚙️</div>
                <p>{t('loading') || 'Loading...'}</p>
            </div>
        );
    }

    // If no status data, show empty state instead of mock data
    if (!status) {
        return (
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="text-center py-10">
                    <p className="text-muted-foreground mb-4">{t('trading_engine_not_available') || 'Trading Engine is not available'}</p>
                    <button
                        onClick={fetchData}
                        className="px-4 py-2 bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg"
                    >
                        {t('retry') || 'Retry'}
                    </button>
                </div>
            </div>
        );
    }

    const winRate = status.stats.executedTrades > 0
        ? (status.stats.successfulTrades / status.stats.executedTrades) * 100
        : 0;

    return (
        <div className="space-y-6">
            {/* Header with Controls */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">
                            {t('trading_engine') || 'Trading Engine'}
                        </h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            {t('trading_engine_desc') || 'Real-time automated trading system with AI-powered decision making'}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`px-4 py-2 rounded-lg font-semibold ${
                            status.isRunning 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-600 text-white'
                        }`}>
                            {status.isRunning 
                                ? t('trading_engine_running') || '🟢 Running' 
                                : t('trading_engine_stopped') || '🔴 Stopped'}
                        </div>
                        {status.isRunning ? (
                            <button
                                onClick={handleStop}
                                disabled={isStopping}
                                className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold"
                            >
                                {isStopping ? t('stopping') || 'Stopping...' : t('stop_engine') || 'Stop Engine'}
                            </button>
                        ) : (
                            <button
                                onClick={handleStart}
                                disabled={isStarting}
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-semibold"
                            >
                                {isStarting ? t('starting') || 'Starting...' : t('start_engine') || 'Start Engine'}
                            </button>
                        )}
                        {/* Emergency Stop button removed - using parent's Emergency Stop button instead */}
                        <button
                            onClick={() => setShowConfig(!showConfig)}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-sm"
                        >
                            {t('settings') || '⚙️ Settings'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="text-sm text-muted-foreground mb-1">
                        {t('total_profit') || 'Total Profit'}
                    </div>
                    <div className={`text-2xl font-bold ${
                        status.stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                        {formatCurrency(status.stats.totalProfit)}
                    </div>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="text-sm text-muted-foreground mb-1">
                        {t('win_rate') || 'Win Rate'}
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                        {winRate.toFixed(1)}%
                    </div>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="text-sm text-muted-foreground mb-1">
                        {t('active_trades') || 'Active Trades'}
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                        {status.activeTrades} / {status.maxConcurrentTrades}
                    </div>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="text-sm text-muted-foreground mb-1">
                        {t('opportunities_queue') || 'Opportunities Queue'}
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                        {status.queueSize}
                    </div>
                </div>
            </div>

            {/* Active Trades */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {t('active_trades') || 'Active Trades'}
                </h3>
                {activeTrades.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        {t('no_active_trades') || 'No active trades'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left p-2 text-sm text-muted-foreground">{t('symbol') || 'Symbol'}</th>
                                    <th className="text-left p-2 text-sm text-muted-foreground">{t('side') || 'Side'}</th>
                                    <th className="text-left p-2 text-sm text-muted-foreground">{t('entry_price') || 'Entry'}</th>
                                    <th className="text-left p-2 text-sm text-muted-foreground">{t('current_price') || 'Current'}</th>
                                    <th className="text-left p-2 text-sm text-muted-foreground">{t('quantity') || 'Quantity'}</th>
                                    <th className="text-left p-2 text-sm text-muted-foreground">{t('profit') || 'P&L'}</th>
                                    <th className="text-left p-2 text-sm text-muted-foreground">{t('profit_percent') || 'P&L %'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeTrades.map(trade => (
                                    <tr key={trade.id} className="border-b border-border/50">
                                        <td className="p-2 font-semibold text-foreground">{trade.symbol}</td>
                                        <td className="p-2">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                trade.side === 'BUY' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                                            }`}>
                                                {trade.side}
                                            </span>
                                        </td>
                                        <td className="p-2 text-foreground">{formatCurrency(trade.entryPrice)}</td>
                                        <td className="p-2 text-foreground">
                                            {trade.currentPrice ? formatCurrency(trade.currentPrice) : '-'}
                                        </td>
                                        <td className="p-2 text-foreground">{trade.quantity.toFixed(4)}</td>
                                        <td className={`p-2 font-semibold ${
                                            (trade.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                            {trade.profit ? formatCurrency(trade.profit) : '-'}
                                        </td>
                                        <td className={`p-2 font-semibold ${
                                            (trade.profitPercent || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                            {trade.profitPercent ? formatPercent(trade.profitPercent) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Opportunities Queue - Enhanced */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-foreground">
                        {t('opportunities_queue') || 'Opportunities Queue'}
                    </h3>
                    <div className="flex gap-2">
                        {(['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(filter => (
                            <button
                                key={filter}
                                onClick={() => setOpportunityFilter(filter)}
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                    opportunityFilter === filter
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-background border border-border text-muted-foreground hover:bg-secondary'
                                }`}
                            >
                                {filter === 'all' ? (t('all') || 'All') : filter}
                            </button>
                        ))}
                    </div>
                </div>
                {sortedOpportunities.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        {t('no_opportunities') || 'No opportunities in queue'}
                    </div>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {sortedOpportunities.slice(0, 20).map(opp => {
                            const timeAgo = Math.floor((Date.now() - opp.timestamp) / 1000);
                            const timeAgoText = timeAgo < 60 ? `${timeAgo}s` : timeAgo < 3600 ? `${Math.floor(timeAgo / 60)}m` : `${Math.floor(timeAgo / 3600)}h`;
                            
                            return (
                                <div
                                    key={opp.id}
                                    className="flex justify-between items-center p-3 border border-border rounded-lg bg-background/40 hover:bg-background/60 transition-colors"
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                            opp.priority === 'CRITICAL' ? 'bg-red-600 text-white animate-pulse' :
                                            opp.priority === 'HIGH' ? 'bg-orange-600 text-white' :
                                            opp.priority === 'MEDIUM' ? 'bg-yellow-600 text-white' :
                                            'bg-gray-600 text-white'
                                        }`}>
                                            {opp.priority}
                                        </span>
                                        <span className="font-semibold text-foreground min-w-[80px]">{opp.symbol}</span>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            opp.side === 'BUY' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                                        }`}>
                                            {opp.side}
                                        </span>
                                        <span className="text-muted-foreground text-sm capitalize">{opp.type.replace(/([A-Z])/g, ' $1').trim()}</span>
                                        <span className="text-xs text-muted-foreground">{timeAgoText} {t('ago') || 'ago'}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-foreground font-semibold">{formatCurrency(opp.price)}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {t('confidence') || 'Confidence'}: <span className={`font-semibold ${
                                                    opp.confidence >= 80 ? 'text-green-400' :
                                                    opp.confidence >= 60 ? 'text-yellow-400' :
                                                    'text-red-400'
                                                }`}>{opp.confidence.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {sortedOpportunities.length > 20 && (
                    <div className="mt-4 text-center text-sm text-muted-foreground">
                        {t('showing') || 'Showing'} 20 {t('of') || 'of'} {sortedOpportunities.length} {t('opportunities') || 'opportunities'}
                    </div>
                )}
            </div>

            {/* Scanners Status - Enhanced */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-foreground">
                        {t('scanners_status') || 'Scanners Status'}
                    </h3>
                    <span className="text-sm text-muted-foreground">
                        {t('scanning') || 'Scanning'} 400+ {t('cryptocurrencies') || 'cryptocurrencies'}
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { id: 'arbitrage', name: t('arbitrage_scanner') || 'Arbitrage Scanner', interval: '2s', icon: '⚡' },
                        { id: 'priceMovement', name: t('price_movement_scanner') || 'Price Movement Scanner', interval: '5s', icon: '📈' },
                        { id: 'volumeSpike', name: t('volume_spike_scanner') || 'Volume Spike Scanner', interval: '10s', icon: '📊' },
                        { id: 'pattern', name: t('pattern_scanner') || 'Pattern Scanner', interval: '30s', icon: '🔍' },
                    ].map(scanner => {
                        const isActive = status.scanners.includes(scanner.id);
                        return (
                            <div key={scanner.id} className={`p-4 border rounded-lg ${
                                isActive ? 'border-green-500/50 bg-green-500/10' : 'border-border bg-background/40'
                            }`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{scanner.icon}</span>
                                        <span className="text-sm font-semibold text-foreground">{scanner.name}</span>
                                    </div>
                                    <div className={`w-2 h-2 rounded-full ${
                                        isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                                    }`} />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {t('interval') || 'Interval'}: {scanner.interval}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Emergency Stop modal removed - using parent's modal instead */}

            {/* Toast Notifications */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default TradingEngineDashboard;

