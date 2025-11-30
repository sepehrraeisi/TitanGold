import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type { ArtemisState } from '../../types.ts';

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

const TradingEngineDashboard: React.FC = () => {
    const { t } = useLanguage();
    const [status, setStatus] = useState<TradingEngineStatus | null>(null);
    const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [artemis, setArtemis] = useState<ArtemisState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [config, setConfig] = useState<any>(null);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [statusData, tradesData, opportunitiesData, artemisData] = await Promise.all([
                api.fetchTradingEngineStatus(),
                api.fetchActiveTrades(),
                api.fetchTradingOpportunities(),
                api.fetchArtemisState(),
            ]);
            
            setStatus(statusData);
            setActiveTrades(tradesData);
            setOpportunities(opportunitiesData);
            setArtemis(artemisData);
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
        } catch (error) {
            alert(t('operation_failed') || 'Failed to start trading engine');
        } finally {
            setIsStarting(false);
        }
    };

    const handleStop = async () => {
        setIsStopping(true);
        try {
            await api.stopTradingEngine();
            await fetchData();
        } catch (error) {
            alert(t('operation_failed') || 'Failed to stop trading engine');
        } finally {
            setIsStopping(false);
        }
    };

    const handleEmergencyStop = async () => {
        if (!confirm(t('emergency_stop_confirm') || 'Are you sure you want to execute emergency stop? All positions will be closed.')) {
            return;
        }
        
        try {
            await api.emergencyStopTradingEngine('manual');
            await fetchData();
            alert(t('emergency_stop_executed') || 'Emergency stop executed');
        } catch (error) {
            alert(t('operation_failed') || 'Failed to execute emergency stop');
        }
    };

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

    if (isLoading || !status) {
        return (
            <div className="text-center p-10">
                <div className="animate-spin text-4xl mb-2">⚙️</div>
                <p>{t('loading') || 'Loading...'}</p>
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
                        <button
                            onClick={handleEmergencyStop}
                            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold text-sm"
                        >
                            {t('emergency_stop') || '🛑 Emergency Stop'}
                        </button>
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

            {/* Opportunities Queue */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {t('opportunities_queue') || 'Opportunities Queue'}
                </h3>
                {opportunities.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        {t('no_opportunities') || 'No opportunities in queue'}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {opportunities.slice(0, 10).map(opp => (
                            <div
                                key={opp.id}
                                className="flex justify-between items-center p-3 border border-border rounded-lg bg-background/40"
                            >
                                <div className="flex items-center gap-4">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                        opp.priority === 'CRITICAL' ? 'bg-red-600 text-white' :
                                        opp.priority === 'HIGH' ? 'bg-orange-600 text-white' :
                                        opp.priority === 'MEDIUM' ? 'bg-yellow-600 text-white' :
                                        'bg-gray-600 text-white'
                                    }`}>
                                        {opp.priority}
                                    </span>
                                    <span className="font-semibold text-foreground">{opp.symbol}</span>
                                    <span className={`px-2 py-1 rounded text-xs ${
                                        opp.side === 'BUY' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                                    }`}>
                                        {opp.side}
                                    </span>
                                    <span className="text-muted-foreground text-sm">{opp.type}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-foreground">{formatCurrency(opp.price)}</span>
                                    <span className="text-sm text-muted-foreground">
                                        {t('confidence') || 'Confidence'}: {opp.confidence.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Scanners Status */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {t('scanners_status') || 'Scanners Status'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['arbitrage', 'priceMovement', 'volumeSpike', 'pattern'].map(scanner => (
                        <div key={scanner} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${
                                status.scanners.includes(scanner) ? 'bg-green-500' : 'bg-gray-500'
                            }`} />
                            <span className="text-sm text-foreground capitalize">
                                {scanner.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TradingEngineDashboard;

