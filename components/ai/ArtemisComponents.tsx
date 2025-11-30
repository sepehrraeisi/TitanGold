import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { ArtemisState, ArtemisLog, ArtemisConfig, TradingScenario } from '../../types.ts';
import SchedulerSettings from './SchedulerSettings.tsx';

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
        {children}
    </div>
);

// Backtesting Component
export const Backtesting: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => {
    if (!artemis) {
        return <Card><div className="text-center p-10">{t('loading') || 'Loading...'}</div></Card>;
    }
    
    const [isRunning, setIsRunning] = useState(false);
    const [isLoadingResults, setIsLoadingResults] = useState(true);
    const [backtestResults, setBacktestResults] = useState<api.BacktestResult[]>([]);
    const [scenarios, setScenarios] = useState<any[]>([]);
    const [selectedScenario, setSelectedScenario] = useState<string>('');
    const [timeRange, setTimeRange] = useState<'1d' | '1w' | '1m' | '3m'>('1m');
    const [filterTimeRange, setFilterTimeRange] = useState<string>('all');
    const [filterScenario, setFilterScenario] = useState<string>('all');
    const [selectedResult, setSelectedResult] = useState<api.BacktestResult | null>(null);
    
    useEffect(() => {
        const loadData = async () => {
            setIsLoadingResults(true);
            try {
                const [results, scenarioList] = await Promise.all([
                    api.fetchBacktestResults(),
                    api.fetchTradingScenarios(),
                ]);
                setBacktestResults(results);
                setScenarios(scenarioList);
            } catch (e) {
                console.error('Failed to load backtest data:', e);
            } finally {
                setIsLoadingResults(false);
            }
        };
        loadData();
    }, []);
    
    const handleRunBacktest = async () => {
        if (!selectedScenario && !confirm(t('backtest_no_scenario_confirm') || 'Run backtest without a specific scenario?')) {
            return;
        }
        setIsRunning(true);
        try {
            const result = await api.runBacktest({
                scenarioId: selectedScenario || undefined,
                timeRange,
                mode: artemis.mode,
            });
            setBacktestResults([result, ...backtestResults]);
            setSelectedResult(result);
            onRefresh();
        } catch (e) {
            console.error('Backtest failed:', e);
            alert(t('backtest_failed') || 'Backtest failed. Please try again.');
        } finally {
            setIsRunning(false);
        }
    };

    const handleDeleteResult = async (resultId: string) => {
        if (!confirm(t('backtest_delete_confirm') || 'Delete this backtest result?')) {
            return;
        }
        try {
            await api.deleteBacktestResult(resultId);
            setBacktestResults(backtestResults.filter(r => r.id !== resultId));
            if (selectedResult?.id === resultId) {
                setSelectedResult(null);
            }
        } catch (e) {
            console.error('Failed to delete result:', e);
            alert(t('backtest_delete_failed') || 'Failed to delete result.');
        }
    };

    const filteredResults = backtestResults.filter(result => {
        if (filterTimeRange !== 'all' && result.timeRange !== filterTimeRange) return false;
        if (filterScenario !== 'all' && result.scenarioId !== filterScenario) return false;
        return true;
    });

    const formatTimeAgo = (timestamp: string): string => {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now.getTime() - time.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return t('just_now') || 'Just now';
        if (diffMins < 60) return `${diffMins} ${t('minutes_ago') || 'min ago'}`;
        if (diffHours < 24) return `${diffHours} ${t('hours_ago') || 'hours ago'}`;
        return `${diffDays} ${t('days_ago') || 'days ago'}`;
    };
    
    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('backtesting_system') || 'Backtesting System'}</h3>
                        <p className="text-xs text-muted-foreground">
                            {t('backtesting_desc') || 'Test trading strategies against historical data from Data Hub'}
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('select_scenario') || 'Select Scenario'}</label>
                        <select
                            value={selectedScenario}
                            onChange={(e) => setSelectedScenario(e.target.value)}
                            className="w-full p-2 bg-background border border-border rounded text-foreground text-sm"
                        >
                            <option value="">{t('all_scenarios') || 'All Scenarios'}</option>
                            {scenarios.map(scenario => (
                                <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('time_range') || 'Time Range'}</label>
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value as any)}
                            className="w-full p-2 bg-background border border-border rounded text-foreground text-sm"
                        >
                            <option value="1d">{t('1_day') || '1 Day'}</option>
                            <option value="1w">{t('1_week') || '1 Week'}</option>
                            <option value="1m">{t('1_month') || '1 Month'}</option>
                            <option value="3m">{t('3_months') || '3 Months'}</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleRunBacktest}
                            disabled={isRunning}
                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {isRunning ? t('running_backtest') || 'Running...' : t('run_backtest') || 'Run Backtest'}
                        </button>
                    </div>
                </div>
            </Card>
            
            {isLoadingResults ? (
                <Card><div className="text-center p-10">{t('loading') || 'Loading...'}</div></Card>
            ) : (
                <>
                    {filteredResults.length > 0 && (
                        <Card>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                                <h3 className="font-semibold text-foreground">{t('backtest_results') || 'Backtest Results'}</h3>
                                <div className="flex gap-2">
                                    <select
                                        value={filterTimeRange}
                                        onChange={(e) => setFilterTimeRange(e.target.value)}
                                        className="px-3 py-2 bg-background border border-border rounded text-foreground text-xs"
                                    >
                                        <option value="all">{t('all_time_ranges') || 'All Time Ranges'}</option>
                                        <option value="1d">{t('1_day') || '1 Day'}</option>
                                        <option value="1w">{t('1_week') || '1 Week'}</option>
                                        <option value="1m">{t('1_month') || '1 Month'}</option>
                                        <option value="3m">{t('3_months') || '3 Months'}</option>
                                    </select>
                                    <select
                                        value={filterScenario}
                                        onChange={(e) => setFilterScenario(e.target.value)}
                                        className="px-3 py-2 bg-background border border-border rounded text-foreground text-xs"
                                    >
                                        <option value="all">{t('all_scenarios') || 'All Scenarios'}</option>
                                        {scenarios.map(scenario => (
                                            <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {filteredResults.map((result) => (
                                    <div 
                                        key={result.id} 
                                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                            selectedResult?.id === result.id 
                                                ? 'border-purple-500 bg-purple-500/10' 
                                                : 'border-border hover:bg-secondary/50'
                                        }`}
                                        onClick={() => setSelectedResult(result)}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-semibold text-foreground">
                                                    {result.scenarioName || t('backtest_no_scenario') || 'No Scenario'}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {new Date(result.startDate).toLocaleDateString()} - {new Date(result.endDate).toLocaleDateString()}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatTimeAgo(result.executedAt)}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                    (result.totalProfit || 0) >= 0 
                                                        ? 'bg-green-500/20 text-green-400' 
                                                        : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                    ${(result.totalProfit || 0).toFixed(2)}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteResult(result.id);
                                                    }}
                                                    className="text-xs px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded"
                                                >
                                                    {t('delete') || 'Delete'}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                            <div>
                                                <p className="text-xs text-muted-foreground">{t('total_trades') || 'Total Trades'}</p>
                                                <p className="font-semibold text-foreground">{result.totalTrades || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">{t('win_rate') || 'Win Rate'}</p>
                                                <p className="font-semibold text-foreground">{result.winRate?.toFixed(1) || 0}%</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">{t('accuracy') || 'Accuracy'}</p>
                                                <p className="font-semibold text-foreground">{result.accuracy?.toFixed(1) || 0}%</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">{t('sharpe_ratio') || 'Sharpe Ratio'}</p>
                                                <p className="font-semibold text-foreground">{result.sharpeRatio?.toFixed(2) || '0.00'}</p>
                                            </div>
                                        </div>
                                        {result.totalReturn !== undefined && (
                                            <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                                <div>
                                                    <p className="text-muted-foreground">{t('total_return') || 'Total Return'}</p>
                                                    <p className={`font-semibold ${(result.totalReturn || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {(result.totalReturn || 0).toFixed(2)}%
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">{t('max_drawdown') || 'Max Drawdown'}</p>
                                                    <p className="font-semibold text-foreground">{result.maxDrawdown?.toFixed(2) || '0.00'}%</p>
                                                </div>
                                                {result.profitFactor !== undefined && (
                                                    <div>
                                                        <p className="text-muted-foreground">{t('profit_factor') || 'Profit Factor'}</p>
                                                        <p className="font-semibold text-foreground">{result.profitFactor.toFixed(2)}</p>
                                                    </div>
                                                )}
                                                {result.initialCapital !== undefined && (
                                                    <div>
                                                        <p className="text-muted-foreground">{t('initial_capital') || 'Initial Capital'}</p>
                                                        <p className="font-semibold text-foreground">${result.initialCapital.toFixed(2)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                    {filteredResults.length === 0 && !isLoadingResults && (
                        <Card>
                            <div className="text-center p-10 text-muted-foreground">
                                {t('backtest_no_results') || 'No backtest results found. Run a backtest to get started.'}
                            </div>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
};

// System Logs Component
export const SystemLogs: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => {
    if (!artemis) {
        return <Card><div className="text-center p-10">{t('loading') || 'Loading...'}</div></Card>;
    }
    
    const [logs, setLogs] = useState<ArtemisLog[]>([]);
    const [typeFilter, setTypeFilter] = useState<'all' | 'command' | 'decision' | 'trade' | 'error' | 'system' | 'config_change'>('all');
    const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'critical'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState<ArtemisLog | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(30); // seconds
    const logsPerPage = 50;
    
    const loadLogs = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const filter: any = {};
            if (typeFilter !== 'all') {
                filter.filter = typeFilter;
            }
            if (levelFilter !== 'all') {
                filter.level = levelFilter;
            }
            filter.limit = logsPerPage * currentPage;
            const data = await api.fetchArtemisLogs(filter);
            setLogs(data);
        } catch (e) {
            console.error('Failed to load logs:', e);
        } finally {
            setIsLoading(false);
        }
    }, [typeFilter, levelFilter, currentPage]);
    
    useEffect(() => {
        loadLogs();
    }, [loadLogs]);
    
    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(() => {
                loadLogs();
            }, autoRefreshInterval * 1000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, autoRefreshInterval, loadLogs]);
    
    const filteredLogs = React.useMemo(() => {
        return logs.filter(log => {
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                if (!log.action.toLowerCase().includes(query) && 
                    !log.source.toLowerCase().includes(query) &&
                    !(log.details && JSON.stringify(log.details).toLowerCase().includes(query))) {
                    return false;
                }
            }
            return true;
        });
    }, [logs, searchQuery]);
    
    const displayedLogs = React.useMemo(() => {
        return filteredLogs.slice(0, currentPage * logsPerPage);
    }, [filteredLogs, currentPage]);
    
    const logStats = React.useMemo(() => {
        return {
            total: logs.length,
            errors: logs.filter(l => l.level === 'error' || l.level === 'critical').length,
            warnings: logs.filter(l => l.level === 'warning').length,
            info: logs.filter(l => l.level === 'info').length,
        };
    }, [logs]);
    
    const handleExportLogs = () => {
        const dataStr = JSON.stringify(filteredLogs, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `artemis-logs-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };
    
    const handleClearLogs = async () => {
        if (!confirm(t('clear_logs_confirm') || "Are you sure you want to clear all logs? This action cannot be undone.")) {
            return;
        }
        try {
            // In production, this would call an API to clear logs
            await api.clearArtemisLogs();
            setLogs([]);
            alert(t('logs_cleared') || 'Logs cleared successfully');
            loadLogs();
        } catch (e) {
            console.error('Failed to clear logs:', e);
            alert(t('clear_logs_failed') || 'Failed to clear logs');
        }
    };
    
    const formatTimeAgo = (timestamp: string) => {
        const now = Date.now();
        const time = new Date(timestamp).getTime();
        const diff = now - time;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return t('just_now') || 'Just now';
    };
    
    if (isLoading && logs.length === 0) {
        return <Card><div className="text-center p-10">{t('loading')}</div></Card>;
    }
    
    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('system_logs') || 'System Logs'}</h3>
                        <p className="text-xs text-muted-foreground">
                            {t('logs_desc') || 'View and manage system activity logs'}
                        </p>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <span className="text-muted-foreground">{t('auto_refresh') || 'Auto Refresh'}</span>
                        </label>
                        {autoRefresh && (
                            <select
                                value={autoRefreshInterval}
                                onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value))}
                                className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                            >
                                <option value="10">10s</option>
                                <option value="30">30s</option>
                                <option value="60">1m</option>
                                <option value="300">5m</option>
                            </select>
                        )}
                        <button
                            onClick={handleExportLogs}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('export_logs') || 'Export'}
                        </button>
                        <button
                            onClick={handleClearLogs}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('clear_logs') || 'Clear'}
                        </button>
                    </div>
                </div>
                
                {logs.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('total_logs') || 'Total'}</p>
                            <p className="text-xl font-semibold text-foreground">{logStats.total}</p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('errors') || 'Errors'}</p>
                            <p className="text-xl font-semibold text-red-400">{logStats.errors}</p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('warnings') || 'Warnings'}</p>
                            <p className="text-xl font-semibold text-yellow-400">{logStats.warnings}</p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('info') || 'Info'}</p>
                            <p className="text-xl font-semibold text-blue-400">{logStats.info}</p>
                        </div>
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <select
                        value={typeFilter}
                        onChange={(e) => {
                            setTypeFilter(e.target.value as any);
                            setCurrentPage(1);
                        }}
                        className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                    >
                        <option value="all">{t('all_types') || 'All Types'}</option>
                        <option value="command">{t('commands') || 'Commands'}</option>
                        <option value="decision">{t('decisions') || 'Decisions'}</option>
                        <option value="trade">{t('trades') || 'Trades'}</option>
                        <option value="error">{t('errors') || 'Errors'}</option>
                        <option value="system">{t('system') || 'System'}</option>
                        <option value="config_change">{t('config_change') || 'Config Change'}</option>
                    </select>
                    <select
                        value={levelFilter}
                        onChange={(e) => {
                            setLevelFilter(e.target.value as any);
                            setCurrentPage(1);
                        }}
                        className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                    >
                        <option value="all">{t('all_levels') || 'All Levels'}</option>
                        <option value="info">{t('info') || 'Info'}</option>
                        <option value="warning">{t('warning') || 'Warning'}</option>
                        <option value="error">{t('error') || 'Error'}</option>
                        <option value="critical">{t('critical') || 'Critical'}</option>
                    </select>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('search_logs') || 'Search logs...'}
                        className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                    />
                </div>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {displayedLogs.length > 0 ? (
                        displayedLogs.map(log => (
                            <div 
                                key={log.id} 
                                className={`p-3 border rounded-lg text-sm hover:border-purple-500/50 transition-colors cursor-pointer ${
                                    log.level === 'error' || log.level === 'critical' ? 'border-red-500/30 bg-red-500/10' :
                                    log.level === 'warning' ? 'border-yellow-500/30 bg-yellow-500/10' :
                                    'border-border'
                                }`}
                                onClick={() => setSelectedLog(log)}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded text-xs ${
                                                log.level === 'error' || log.level === 'critical' ? 'bg-red-500/20 text-red-400' :
                                                log.level === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                                log.level === 'info' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-gray-500/20 text-gray-400'
                                            }`}>
                                                {t(log.level) || log.level}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{t(log.type) || log.type}</span>
                                            {log.agentId && (
                                                <span className="text-xs text-muted-foreground">
                                                    {t('agent') || 'Agent'}: {log.agentId}
                                                </span>
                                            )}
                                        </div>
                                        <p className="font-semibold text-foreground">{log.action}</p>
                                        {log.details && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {JSON.stringify(log.details).substring(0, 150)}...
                                            </p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('source') || 'Source'}: {t(log.source) || log.source} · {formatTimeAgo(log.timestamp)}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {log.result && (
                                            <span className={`px-2 py-1 rounded-full text-xs ${
                                                log.result === 'success' ? 'bg-green-500/20 text-green-400' :
                                                log.result === 'failed' ? 'bg-red-500/20 text-red-400' :
                                                'bg-gray-500/20 text-gray-400'
                                            }`}>
                                                {t(log.result) || log.result}
                                            </span>
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-10">{t('no_logs_found') || 'No logs found.'}</p>
                    )}
                </div>
                
                {filteredLogs.length > displayedLogs.length && (
                    <div className="flex justify-center mt-4">
                        <button
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-sm"
                        >
                            {t('load_more') || 'Load More'} ({filteredLogs.length - displayedLogs.length} {t('remaining') || 'remaining'})
                        </button>
                    </div>
                )}
            </Card>
            
            {selectedLog && (
                <LogDetailsModal
                    log={selectedLog}
                    onClose={() => setSelectedLog(null)}
                    t={t}
                />
            )}
        </div>
    );
};

// Log Details Modal
const LogDetailsModal: React.FC<{
    log: ArtemisLog;
    onClose: () => void;
    t: (key: string) => string;
}> = ({ log, onClose, t }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">{log.action}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('log_details') || 'Log Details'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
                        {t('close') || 'Close'}
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('level') || 'Level'}</p>
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                log.level === 'error' || log.level === 'critical' ? 'bg-red-500/20 text-red-400' :
                                log.level === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                log.level === 'info' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-gray-500/20 text-gray-400'
                            }`}>
                                {t(log.level) || log.level}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('type') || 'Type'}</p>
                            <p className="text-sm font-semibold text-foreground">{t(log.type) || log.type}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('source') || 'Source'}</p>
                            <p className="text-sm font-semibold text-foreground">{t(log.source) || log.source}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('timestamp') || 'Timestamp'}</p>
                            <p className="text-sm font-semibold text-foreground">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                        {log.agentId && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">{t('agent') || 'Agent'}</p>
                                <p className="text-sm font-semibold text-foreground">{log.agentId}</p>
                            </div>
                        )}
                        {log.userId && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">{t('user') || 'User'}</p>
                                <p className="text-sm font-semibold text-foreground">{log.userId}</p>
                            </div>
                        )}
                        {log.result && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">{t('result') || 'Result'}</p>
                                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                    log.result === 'success' ? 'bg-green-500/20 text-green-400' :
                                    log.result === 'failed' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                                }`}>
                                    {t(log.result) || log.result}
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <div>
                        <p className="text-xs text-muted-foreground mb-2">{t('action') || 'Action'}</p>
                        <p className="text-sm font-semibold text-foreground bg-secondary/40 p-3 rounded border border-border">
                            {log.action}
                        </p>
                    </div>
                    
                    {log.details && (
                        <div>
                            <p className="text-xs text-muted-foreground mb-2">{t('details') || 'Details'}</p>
                            <pre className="text-xs text-foreground bg-secondary/40 p-3 rounded border border-border overflow-x-auto font-mono">
                                {JSON.stringify(log.details, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Artemis Settings Component
export const ArtemisSettings: React.FC<{ artemis: ArtemisState; t: (key: string) => string; onRefresh: () => void }> = ({ artemis, t, onRefresh }) => {
    if (!artemis || !artemis.decisionEngine) {
        return <Card><div className="text-center p-10">{t('loading') || 'Loading...'}</div></Card>;
    }
    
    const getDefaultConfig = (): ArtemisConfig => ({
        decisionEngine: {
            strategy: 'voting',
            activeModel: 'internal',
            confidenceThreshold: 75,
            autoExecution: false,
            requireApproval: true,
            maxConcurrentTrades: 5,
        },
        learning: {
            activeLearning: false,
            autoRetrain: false,
            retrainInterval: 24,
            minAccuracyForRetrain: 70,
            backtestBeforeRetrain: true,
        },
        monitoring: {
            healthCheckInterval: 5,
            alertOnError: true,
            alertChannels: {
                dashboard: true,
                telegram: false,
                email: false,
            },
        },
        security: {
            requireMFA: false,
            logAllCommands: true,
            encryptSensitiveData: true,
            sessionTimeout: 30,
        },
        integration: {
            mexc: {
                enabled: true,
                testnet: artemis.mode === 'demo',
            },
            telegram: {
                enabled: false,
                channels: [],
            },
        },
        ui: {
            language: 'en',
            theme: 'dark',
            widgets: [],
        },
    });
    
    const [config, setConfig] = useState<ArtemisConfig>(artemis.config || getDefaultConfig());
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'decision' | 'learning' | 'security' | 'monitoring' | 'integration' | 'ui' | 'scheduler'>('decision');
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [newTelegramChannel, setNewTelegramChannel] = useState('');
    const [newTelegramBotToken, setNewTelegramBotToken] = useState('');
    
    const handleSave = async () => {
        // Validation
        if (config.decisionEngine.confidenceThreshold < 0 || config.decisionEngine.confidenceThreshold > 100) {
            alert(t('validation_error') || 'Confidence threshold must be between 0 and 100');
            return;
        }
        if (config.decisionEngine.maxConcurrentTrades < 1 || config.decisionEngine.maxConcurrentTrades > 20) {
            alert(t('validation_error') || 'Max concurrent trades must be between 1 and 20');
            return;
        }
        if (config.learning.retrainInterval < 1) {
            alert(t('validation_error') || 'Retrain interval must be at least 1 hour');
            return;
        }
        if (config.security.sessionTimeout < 5) {
            alert(t('validation_error') || 'Session timeout must be at least 5 minutes');
            return;
        }
        if (config.monitoring.healthCheckInterval < 1) {
            alert(t('validation_error') || 'Health check interval must be at least 1 minute');
            return;
        }
        
        setIsSaving(true);
        try {
            await api.updateArtemisConfig({ config });
            alert(t('settings_saved') || 'Settings saved successfully!');
            onRefresh();
        } catch (e) {
            console.error('Failed to save settings:', e);
            alert(t('settings_save_failed') || 'Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleReset = () => {
        setConfig(getDefaultConfig());
        setShowResetConfirm(false);
    };
    
    const handleExport = () => {
        const dataStr = JSON.stringify(config, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `artemis-config-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };
    
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string) as ArtemisConfig;
                setConfig(imported);
                alert(t('config_imported') || 'Configuration imported successfully!');
            } catch (error) {
                console.error('Failed to import config:', error);
                alert(t('config_import_failed') || 'Failed to import configuration. Invalid file format.');
            }
        };
        reader.readAsText(file);
    };
    
    const addTelegramChannel = () => {
        if (newTelegramChannel.trim()) {
            setConfig({
                ...config,
                integration: {
                    ...config.integration,
                    telegram: {
                        ...config.integration.telegram,
                        channels: [...(config.integration.telegram.channels || []), newTelegramChannel.trim()],
                    },
                },
            });
            setNewTelegramChannel('');
        }
    };
    
    const removeTelegramChannel = (channel: string) => {
        setConfig({
            ...config,
            integration: {
                ...config.integration,
                telegram: {
                    ...config.integration.telegram,
                    channels: config.integration.telegram.channels.filter(c => c !== channel),
                },
            },
        });
    };
    
    const tabs = [
        { id: 'decision' as const, label: t('decision_engine') || 'Decision Engine', icon: '⚙️' },
        { id: 'learning' as const, label: t('learning') || 'Learning', icon: '📚' },
        { id: 'security' as const, label: t('security') || 'Security', icon: '🔒' },
        { id: 'monitoring' as const, label: t('monitoring') || 'Monitoring', icon: '📊' },
        { id: 'integration' as const, label: t('integration') || 'Integration', icon: '🔌' },
        { id: 'ui' as const, label: t('ui') || 'UI', icon: '🎨' },
        { id: 'scheduler' as const, label: t('scheduler_24_7') || '24/7 Scheduler', icon: '⏰' },
    ];
    
    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('artemis_settings') || 'Artemis Settings'}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('artemis_settings_desc') || 'Configure Artemis AI system settings'}
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={handleExport}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('export_config') || 'Export'}
                        </button>
                        <label className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm cursor-pointer">
                            {t('import_config') || 'Import'}
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleImport}
                                className="hidden"
                            />
                        </label>
                        <button
                            onClick={() => setShowResetConfirm(true)}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('reset_to_default') || 'Reset'}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {isSaving ? t('saving') || 'Saving...' : t('save_settings') || 'Save Settings'}
                        </button>
                    </div>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-purple-500 text-purple-400'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
                
                {/* Tab Content */}
                <div className="space-y-6">
                    {/* Decision Engine Settings */}
                    {activeTab === 'decision' && (
                        <div className="border border-border rounded-lg p-4">
                            <h4 className="font-semibold text-foreground mb-3">{t('decision_engine_settings') || 'Decision Engine Settings'}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('strategy') || 'Strategy'}</label>
                                    <select
                                        value={config.decisionEngine.strategy}
                                        onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, strategy: e.target.value as any}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    >
                                        <option value="voting">{t('voting') || 'Voting'}</option>
                                        <option value="weighted">{t('weighted') || 'Weighted'}</option>
                                        <option value="mixture_of_experts">{t('mixture_of_experts') || 'Mixture of Experts'}</option>
                                        <option value="consensus">{t('consensus') || 'Consensus'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('active_model') || 'Active Model'}</label>
                                    <select
                                        value={config.decisionEngine.activeModel}
                                        onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, activeModel: e.target.value as any}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    >
                                        <option value="internal">{t('internal') || 'Internal'}</option>
                                        <option value="claude">{t('claude') || 'Claude'}</option>
                                        <option value="gemini">{t('gemini') || 'Gemini'}</option>
                                        <option value="openai">{t('openai') || 'OpenAI'}</option>
                                        <option value="deepseek">{t('deepseek') || 'DeepSeek'}</option>
                                        <option value="hybrid">{t('hybrid') || 'Hybrid'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('confidence_threshold') || 'Confidence Threshold'} (%)</label>
                                    <input
                                        type="number"
                                        value={config.decisionEngine.confidenceThreshold}
                                        onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, confidenceThreshold: parseInt(e.target.value) || 75}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                        min="0"
                                        max="100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('max_concurrent_trades') || 'Max Concurrent Trades'}</label>
                                    <input
                                        type="number"
                                        value={config.decisionEngine.maxConcurrentTrades}
                                        onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, maxConcurrentTrades: parseInt(e.target.value) || 5}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                        min="1"
                                        max="20"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.decisionEngine.autoExecution}
                                        onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, autoExecution: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('auto_execution') || 'Auto Execution'}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.decisionEngine.requireApproval}
                                        onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, requireApproval: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('require_approval') || 'Require Approval'}</label>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Learning Settings */}
                    {activeTab === 'learning' && (
                        <div className="border border-border rounded-lg p-4">
                            <h4 className="font-semibold text-foreground mb-3">{t('learning_settings') || 'Learning Settings'}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.learning.activeLearning}
                                        onChange={(e) => setConfig({...config, learning: {...config.learning, activeLearning: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('active_learning') || 'Active Learning'}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.learning.autoRetrain}
                                        onChange={(e) => setConfig({...config, learning: {...config.learning, autoRetrain: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('auto_retrain') || 'Auto Retrain'}</label>
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('retrain_interval') || 'Retrain Interval'} (hours)</label>
                                    <input
                                        type="number"
                                        value={config.learning.retrainInterval}
                                        onChange={(e) => setConfig({...config, learning: {...config.learning, retrainInterval: parseInt(e.target.value) || 24}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('min_accuracy_retrain') || 'Min Accuracy for Retrain'} (%)</label>
                                    <input
                                        type="number"
                                        value={config.learning.minAccuracyForRetrain}
                                        onChange={(e) => setConfig({...config, learning: {...config.learning, minAccuracyForRetrain: parseInt(e.target.value) || 70}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                        min="0"
                                        max="100"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.learning.backtestBeforeRetrain}
                                        onChange={(e) => setConfig({...config, learning: {...config.learning, backtestBeforeRetrain: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('backtest_before_retrain') || 'Backtest Before Retrain'}</label>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Security Settings */}
                    {activeTab === 'security' && (
                        <div className="border border-border rounded-lg p-4">
                            <h4 className="font-semibold text-foreground mb-3">{t('security_settings') || 'Security Settings'}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.security.requireMFA}
                                        onChange={(e) => setConfig({...config, security: {...config.security, requireMFA: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('require_mfa') || 'Require Multi-Factor Authentication'}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.security.logAllCommands}
                                        onChange={(e) => setConfig({...config, security: {...config.security, logAllCommands: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('log_all_commands') || 'Log All Commands'}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.security.encryptSensitiveData}
                                        onChange={(e) => setConfig({...config, security: {...config.security, encryptSensitiveData: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('encrypt_sensitive_data') || 'Encrypt Sensitive Data'}</label>
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('session_timeout') || 'Session Timeout'} (minutes)</label>
                                    <input
                                        type="number"
                                        value={config.security.sessionTimeout}
                                        onChange={(e) => setConfig({...config, security: {...config.security, sessionTimeout: parseInt(e.target.value) || 30}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                        min="5"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Monitoring Settings */}
                    {activeTab === 'monitoring' && (
                        <div className="border border-border rounded-lg p-4">
                            <h4 className="font-semibold text-foreground mb-3">{t('monitoring_settings') || 'Monitoring Settings'}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('health_check_interval') || 'Health Check Interval'} (minutes)</label>
                                    <input
                                        type="number"
                                        value={config.monitoring.healthCheckInterval}
                                        onChange={(e) => setConfig({...config, monitoring: {...config.monitoring, healthCheckInterval: parseInt(e.target.value) || 5}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                        min="1"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.monitoring.alertOnError}
                                        onChange={(e) => setConfig({...config, monitoring: {...config.monitoring, alertOnError: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('alert_on_error') || 'Alert on Error'}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.monitoring.alertChannels.dashboard}
                                        onChange={(e) => setConfig({...config, monitoring: {...config.monitoring, alertChannels: {...config.monitoring.alertChannels, dashboard: e.target.checked}}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('dashboard_alerts') || 'Dashboard Alerts'}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.monitoring.alertChannels.telegram}
                                        onChange={(e) => setConfig({...config, monitoring: {...config.monitoring, alertChannels: {...config.monitoring.alertChannels, telegram: e.target.checked}}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('telegram_alerts') || 'Telegram Alerts'}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.monitoring.alertChannels.email}
                                        onChange={(e) => setConfig({...config, monitoring: {...config.monitoring, alertChannels: {...config.monitoring.alertChannels, email: e.target.checked}}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('email_alerts') || 'Email Alerts'}</label>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Integration Settings */}
                    {activeTab === 'integration' && (
                        <div className="space-y-4">
                            {/* MEXC Integration */}
                            <div className="border border-border rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-3">{t('mexc_integration') || 'MEXC Integration'}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={config.integration.mexc.enabled}
                                            onChange={(e) => setConfig({...config, integration: {...config.integration, mexc: {...config.integration.mexc, enabled: e.target.checked}}})}
                                            className="w-4 h-4"
                                        />
                                        <label className="text-sm text-foreground">{t('enable_mexc') || 'Enable MEXC'}</label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={config.integration.mexc.testnet}
                                            onChange={(e) => setConfig({...config, integration: {...config.integration, mexc: {...config.integration.mexc, testnet: e.target.checked}}})}
                                            className="w-4 h-4"
                                        />
                                        <label className="text-sm text-foreground">{t('use_testnet') || 'Use Testnet'}</label>
                                    </div>
                                    {config.integration.mexc.apiKey && (
                                        <div>
                                            <label className="block text-sm text-muted-foreground mb-1">{t('api_key') || 'API Key'}</label>
                                            <input
                                                type="password"
                                                value={config.integration.mexc.apiKey}
                                                onChange={(e) => setConfig({...config, integration: {...config.integration, mexc: {...config.integration.mexc, apiKey: e.target.value}}})}
                                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                                placeholder={t('api_key_placeholder') || 'Enter API key'}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Telegram Integration */}
                            <div className="border border-border rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-3">{t('telegram_integration') || 'Telegram Integration'}</h4>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={config.integration.telegram.enabled}
                                            onChange={(e) => setConfig({...config, integration: {...config.integration, telegram: {...config.integration.telegram, enabled: e.target.checked}}})}
                                            className="w-4 h-4"
                                        />
                                        <label className="text-sm text-foreground">{t('enable_telegram') || 'Enable Telegram'}</label>
                                    </div>
                                    {config.integration.telegram.enabled && (
                                        <>
                                            <div>
                                                <label className="block text-sm text-muted-foreground mb-1">{t('bot_token') || 'Bot Token'}</label>
                                                <input
                                                    type="password"
                                                    value={newTelegramBotToken || config.integration.telegram.botToken || ''}
                                                    onChange={(e) => {
                                                        setNewTelegramBotToken(e.target.value);
                                                        setConfig({...config, integration: {...config.integration, telegram: {...config.integration.telegram, botToken: e.target.value}}});
                                                    }}
                                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                                    placeholder={t('bot_token_placeholder') || 'Enter bot token'}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-muted-foreground mb-1">{t('channels') || 'Channels'}</label>
                                                <div className="flex gap-2 mb-2">
                                                    <input
                                                        type="text"
                                                        value={newTelegramChannel}
                                                        onChange={(e) => setNewTelegramChannel(e.target.value)}
                                                        onKeyPress={(e) => e.key === 'Enter' && addTelegramChannel()}
                                                        className="flex-1 p-2 bg-secondary border border-border rounded text-foreground"
                                                        placeholder={t('channel_placeholder') || 'Enter channel ID or username'}
                                                    />
                                                    <button
                                                        onClick={addTelegramChannel}
                                                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                                                    >
                                                        {t('add') || 'Add'}
                                                    </button>
                                                </div>
                                                {config.integration.telegram.channels && config.integration.telegram.channels.length > 0 && (
                                                    <div className="space-y-2">
                                                        {config.integration.telegram.channels.map(channel => (
                                                            <div key={channel} className="flex items-center justify-between p-2 bg-secondary rounded">
                                                                <span className="text-sm text-foreground">{channel}</span>
                                                                <button
                                                                    onClick={() => removeTelegramChannel(channel)}
                                                                    className="text-red-400 hover:text-red-300 text-sm"
                                                                >
                                                                    {t('remove') || 'Remove'}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* 24/7 Scheduler Settings */}
                    {activeTab === 'scheduler' && (
                        <div className="space-y-6">
                            <SchedulerSettings />
                        </div>
                    )}
                    
                    {/* UI Settings */}
                    {activeTab === 'ui' && (
                        <div className="border border-border rounded-lg p-4">
                            <h4 className="font-semibold text-foreground mb-3">{t('ui_settings') || 'UI Settings'}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('language') || 'Language'}</label>
                                    <select
                                        value={config.ui.language}
                                        onChange={(e) => setConfig({...config, ui: {...config.ui, language: e.target.value as 'en' | 'fa'}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    >
                                        <option value="en">{t('english') || 'English'}</option>
                                        <option value="fa">{t('farsi') || 'Farsi'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('theme') || 'Theme'}</label>
                                    <select
                                        value={config.ui.theme}
                                        onChange={(e) => setConfig({...config, ui: {...config.ui, theme: e.target.value as 'dark' | 'light'}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    >
                                        <option value="dark">{t('dark') || 'Dark'}</option>
                                        <option value="light">{t('light') || 'Light'}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
            
            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
                        <h3 className="font-semibold text-foreground mb-2">{t('reset_to_default') || 'Reset to Default'}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            {t('reset_confirm_message') || 'Are you sure you want to reset all settings to default values? This action cannot be undone.'}
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-semibold rounded-lg text-sm"
                            >
                                {t('cancel') || 'Cancel'}
                            </button>
                            <button
                                onClick={handleReset}
                                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg text-sm"
                            >
                                {t('reset') || 'Reset'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

