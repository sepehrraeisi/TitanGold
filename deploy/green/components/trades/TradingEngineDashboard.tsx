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
        // 🎯 Silent background refresh every 10 seconds (not 5s to reduce load)
        const interval = setInterval(() => {
            if (!isLoading) {
                // Silent fetch - don't show loading spinner
                fetchData();
            }
        }, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, [isLoading]); // Re-run if isLoading changes

    const fetchData = async () => {
        try {
            // Always fetch fresh status from backend
            const statusData = await api.fetchTradingEngineStatus().catch(err => {
                console.error('Failed to fetch trading engine status:', err);
                return propStatus || null; // Fallback to prop if fetch fails
            });
            
            if (statusData) {
                setStatus(statusData);
            } else if (propStatus) {
                // Only use propStatus as absolute fallback
                setStatus(propStatus);
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
            <div className="space-y-4 sm:space-y-6 pb-6">
                <div className="h-32 bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {Array.from({ length: 4 }).map((_, idx) => (
                        <div key={idx} className="h-24 bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl animate-pulse" />
                    ))}
                </div>
                <div className="h-64 bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl animate-pulse" />
            </div>
        );
    }

    // If no status data, show empty state instead of mock data
    if (!status) {
        return (
            <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-6 sm:p-8 shadow-lg">
                <div className="text-center py-10">
                    <svg className="w-12 h-12 mx-auto mb-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-gray-300 mb-2 font-medium">{t('trading_engine_not_available') || 'Trading Engine is not available'}</p>
                    <p className="text-xs text-gray-500 mb-6">Please check your connection and try again</p>
                    <button
                        onClick={fetchData}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold transition-all duration-200 shadow-lg shadow-purple-500/30 active:scale-95"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356-2A8.001 8.001 0 004 12c0 2.127.72 4.06 1.92 5.636m0 0a7.995 7.995 0 01-1.92-5.636c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8c-2.127 0-4.06-.72-5.636-1.92m0 0L4 20m15.356-5H19" />
                        </svg>
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
        <div className="space-y-4 sm:space-y-6 pb-6">
            {/* Header with Controls - Improved Design */}
            <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-5 sm:p-6 shadow-lg">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 sm:gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-white">
                                    {t('trading_engine') || 'Trading Engine'}
                                </h2>
                                <p className="text-sm text-gray-400 mt-1">
                                    {t('trading_engine_desc') || 'Real-time automated trading system with AI-powered decision making'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                        <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm ${
                            status.isRunning 
                                ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30' 
                                : 'bg-gradient-to-r from-gray-600/20 to-gray-700/20 text-gray-400 border border-gray-600/30'
                        }`}>
                            <div className={`w-2 h-2 rounded-full ${status.isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                            {status.isRunning 
                                ? t('trading_engine_running') || 'Running' 
                                : t('trading_engine_stopped') || 'Stopped'}
                        </div>
                        {status.isRunning ? (
                            <button
                                onClick={handleStop}
                                disabled={isStopping}
                                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-all duration-200 shadow-lg shadow-red-500/30 active:scale-95"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                </svg>
                                {isStopping ? t('stopping') || 'Stopping...' : t('stop_engine') || 'Stop'}
                            </button>
                        ) : (
                            <button
                                onClick={handleStart}
                                disabled={isStarting}
                                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-all duration-200 shadow-lg shadow-green-500/30 active:scale-95"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {isStarting ? t('starting') || 'Starting...' : t('start_engine') || 'Start'}
                            </button>
                        )}
                        <button
                            onClick={() => setShowConfig(!showConfig)}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-semibold text-sm transition-all duration-200 shadow-lg shadow-purple-500/30 active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {t('settings') || 'Settings'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Statistics Grid - Improved Design */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-4 shadow-lg">
                    <div className="text-xs sm:text-sm text-gray-400 mb-2">
                        {t('total_profit') || 'Total Profit'}
                    </div>
                    <div className={`text-xl sm:text-2xl font-bold ${
                        status.stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                        {formatCurrency(status.stats.totalProfit)}
                    </div>
                </div>
                <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-4 shadow-lg">
                    <div className="text-xs sm:text-sm text-gray-400 mb-2">
                        {t('win_rate') || 'Win Rate'}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-white">
                        {winRate.toFixed(1)}%
                    </div>
                </div>
                <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-4 shadow-lg">
                    <div className="text-xs sm:text-sm text-gray-400 mb-2">
                        {t('active_trades') || 'Active Trades'}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-white">
                        <span className="text-blue-400">{status.activeTrades}</span>
                        <span className="text-gray-500"> / </span>
                        <span className="text-gray-400">{status.maxConcurrentTrades}</span>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-4 shadow-lg">
                    <div className="text-xs sm:text-sm text-gray-400 mb-2">
                        {t('opportunities_queue') || 'Queue'}
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-white">
                        {status.queueSize}
                    </div>
                </div>
            </div>

            {/* Active Trades - Improved Design */}
            <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-5 sm:p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-5">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <h3 className="text-lg sm:text-xl font-bold text-white">
                        {t('active_trades') || 'Active Trades'}
                    </h3>
                </div>
                {activeTrades.length === 0 ? (
                    <div className="text-center py-12 bg-gray-800/40 border border-dashed border-gray-700 rounded-lg">
                        <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-gray-400 text-sm">{t('no_active_trades') || 'No active trades'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-700/50">
                                    <th className="text-left p-3 text-xs sm:text-sm text-gray-400 font-semibold">{t('symbol') || 'Symbol'}</th>
                                    <th className="text-left p-3 text-xs sm:text-sm text-gray-400 font-semibold">{t('side') || 'Side'}</th>
                                    <th className="text-left p-3 text-xs sm:text-sm text-gray-400 font-semibold">{t('entry_price') || 'Entry'}</th>
                                    <th className="text-left p-3 text-xs sm:text-sm text-gray-400 font-semibold">{t('current_price') || 'Current'}</th>
                                    <th className="text-left p-3 text-xs sm:text-sm text-gray-400 font-semibold">{t('quantity') || 'Quantity'}</th>
                                    <th className="text-left p-3 text-xs sm:text-sm text-gray-400 font-semibold">{t('profit') || 'P&L'}</th>
                                    <th className="text-left p-3 text-xs sm:text-sm text-gray-400 font-semibold">{t('profit_percent') || 'P&L %'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeTrades.map(trade => (
                                    <tr key={trade.id} className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors">
                                        <td className="p-3 font-semibold text-white text-sm">{trade.symbol}</td>
                                        <td className="p-3">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                                                trade.side === 'BUY' 
                                                    ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30' 
                                                    : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                                            }`}>
                                                {trade.side}
                                            </span>
                                        </td>
                                        <td className="p-3 text-gray-300 text-sm font-mono">{formatCurrency(trade.entryPrice)}</td>
                                        <td className="p-3 text-gray-300 text-sm font-mono">
                                            {trade.currentPrice ? formatCurrency(trade.currentPrice) : <span className="text-gray-500">-</span>}
                                        </td>
                                        <td className="p-3 text-gray-300 text-sm font-mono">{trade.quantity.toFixed(4)}</td>
                                        <td className={`p-3 font-semibold text-sm ${
                                            (trade.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                            {trade.profit ? formatCurrency(trade.profit) : <span className="text-gray-500">-</span>}
                                        </td>
                                        <td className={`p-3 font-semibold text-sm ${
                                            (trade.profitPercent || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                            {trade.profitPercent ? formatPercent(trade.profitPercent) : <span className="text-gray-500">-</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Opportunities Queue - Enhanced Design */}
            <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-5 sm:p-6 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-5">
                    <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        <h3 className="text-lg sm:text-xl font-bold text-white">
                            {t('opportunities_queue') || 'Opportunities Queue'}
                        </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(filter => (
                            <button
                                key={filter}
                                onClick={() => setOpportunityFilter(filter)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                    opportunityFilter === filter
                                        ? 'bg-gradient-to-r from-purple-600/40 to-blue-600/40 text-white border border-purple-500/50 shadow-md shadow-purple-500/20'
                                        : 'bg-gray-800/50 border border-gray-700/50 text-gray-300 hover:bg-gray-700/50 hover:border-gray-600/50'
                                }`}
                            >
                                {filter === 'all' ? (t('all') || 'All') : filter}
                            </button>
                        ))}
                    </div>
                </div>
                {sortedOpportunities.length === 0 ? (
                    <div className="text-center py-12 bg-gray-800/40 border border-dashed border-gray-700 rounded-lg">
                        <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        <p className="text-gray-400 text-sm">{t('no_opportunities') || 'No opportunities in queue'}</p>
                    </div>
                ) : (
                    <div className="space-y-2.5 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                        {sortedOpportunities.slice(0, 20).map(opp => {
                            const timeAgo = Math.floor((Date.now() - opp.timestamp) / 1000);
                            const timeAgoText = timeAgo < 60 ? `${timeAgo}s` : timeAgo < 3600 ? `${Math.floor(timeAgo / 60)}m` : `${Math.floor(timeAgo / 3600)}h`;
                            
                            return (
                                <div
                                    key={opp.id}
                                    className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border border-gray-700/50 rounded-lg bg-gray-800/40 hover:bg-gray-800/60 transition-all duration-200 hover:border-gray-600/50"
                                >
                                    <div className="flex flex-wrap items-center gap-3 flex-1">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                                            opp.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30 animate-pulse' :
                                            opp.priority === 'HIGH' ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30' :
                                            opp.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30' :
                                            'bg-gray-500/20 text-gray-400 ring-1 ring-gray-500/30'
                                        }`}>
                                            {opp.priority}
                                        </span>
                                        <span className="font-bold text-white min-w-[80px] text-sm">{opp.symbol}</span>
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                                            opp.side === 'BUY' 
                                                ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30' 
                                                : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                                        }`}>
                                            {opp.side}
                                        </span>
                                        <span className="text-gray-400 text-xs sm:text-sm capitalize">{opp.type.replace(/([A-Z])/g, ' $1').trim()}</span>
                                        <span className="text-xs text-gray-500">{timeAgoText} {t('ago') || 'ago'}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-white font-bold text-sm font-mono">{formatCurrency(opp.price)}</div>
                                            <div className="text-xs text-gray-400 mt-1">
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
                    <div className="mt-4 text-center text-xs sm:text-sm text-gray-400 bg-gray-800/30 px-4 py-2 rounded-lg border border-gray-700/30">
                        {t('showing') || 'Showing'} 20 {t('of') || 'of'} {sortedOpportunities.length} {t('opportunities') || 'opportunities'}
                    </div>
                )}
            </div>

            {/* Scanners Status - Enhanced Design */}
            <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-5 sm:p-6 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5">
                    <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <h3 className="text-lg sm:text-xl font-bold text-white">
                            {t('scanners_status') || 'Scanners Status'}
                        </h3>
                    </div>
                    <span className="text-xs sm:text-sm text-gray-400 bg-gray-800/40 px-3 py-1.5 rounded-lg border border-gray-700/30">
                        {t('scanning') || 'Scanning'} 400+ {t('cryptocurrencies') || 'cryptocurrencies'}
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {[
                        { id: 'arbitrage', name: t('arbitrage_scanner') || 'Arbitrage Scanner', interval: '2s', icon: '⚡', color: 'yellow' },
                        { id: 'priceMovement', name: t('price_movement_scanner') || 'Price Movement Scanner', interval: '5s', icon: '📈', color: 'green' },
                        { id: 'volumeSpike', name: t('volume_spike_scanner') || 'Volume Spike Scanner', interval: '10s', icon: '📊', color: 'blue' },
                        { id: 'pattern', name: t('pattern_scanner') || 'Pattern Scanner', interval: '30s', icon: '🔍', color: 'purple' },
                    ].map(scanner => {
                        const isActive = status.scanners.includes(scanner.id);
                        return (
                            <div key={scanner.id} className={`p-4 border rounded-xl transition-all duration-200 ${
                                isActive 
                                    ? 'border-green-500/50 bg-gradient-to-br from-green-500/10 to-emerald-500/5 shadow-lg shadow-green-500/10' 
                                    : 'border-gray-700/50 bg-gray-800/30'
                            }`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{scanner.icon}</span>
                                        <span className="text-sm font-semibold text-white">{scanner.name}</span>
                                    </div>
                                    <div className="relative flex h-3 w-3">
                                        {isActive && (
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        )}
                                        <div className={`relative inline-flex rounded-full h-3 w-3 ${
                                            isActive ? 'bg-green-500' : 'bg-gray-500'
                                        }`} />
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400">
                                    {t('interval') || 'Interval'}: <span className="font-semibold text-gray-300">{scanner.interval}</span>
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

