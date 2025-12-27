import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../../../../services/api.ts';
import { ArtemisState, BacktestResult, TradingScenario } from '../../../../types.ts';

type Props = {
    artemis: ArtemisState;
    t: (key: string) => string;
    onRefresh: () => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
};

const BacktestingTab: React.FC<Props> = ({ artemis, t, onRefresh, Card }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [isLoadingResults, setIsLoadingResults] = useState(true);
    const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([]);
    const [scenarios, setScenarios] = useState<TradingScenario[]>([]);
    const [selectedScenario, setSelectedScenario] = useState<string>('');
    const [timeRange, setTimeRange] = useState<'1d' | '1w' | '1m' | '3m'>('1m');
    const [filterTimeRange, setFilterTimeRange] = useState<string>('all');
    const [filterScenario, setFilterScenario] = useState<string>('all');
    const [selectedResult, setSelectedResult] = useState<BacktestResult | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setIsLoadingResults(true);
            try {
                const [results, scenarioList] = await Promise.all([
                    api.fetchBacktestResults(),
                    api.fetchTradingScenarios(),
                ]);
                setBacktestResults(results || []);
                setScenarios(scenarioList || []);
            } catch (e) {
                console.error('Failed to load backtest data:', e);
            } finally {
                setIsLoadingResults(false);
            }
        };
        loadData();
    }, []);

    const formatTimeAgo = (timestamp: string): string => {
        if (!timestamp) return '-';
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

    const filteredResults = useMemo(() => {
        return backtestResults.filter(result => {
            if (filterTimeRange !== 'all' && result.timeRange !== filterTimeRange) return false;
            if (filterScenario !== 'all' && result.scenarioId !== filterScenario) return false;
            return true;
        });
    }, [backtestResults, filterScenario, filterTimeRange]);

    const handleRunBacktest = async () => {
        if (!selectedScenario && !window.confirm(t('backtest_no_scenario_confirm') || 'Run backtest without a specific scenario?')) {
            return;
        }
        setIsRunning(true);
        try {
            const result = await api.runBacktest({
                scenarioId: selectedScenario || undefined,
                timeRange,
                mode: artemis.mode,
            });
            setBacktestResults(prev => [result, ...prev]);
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
        if (!window.confirm(t('backtest_delete_confirm') || 'Delete this backtest result?')) {
            return;
        }
        try {
            await api.deleteBacktestResult(resultId);
            setBacktestResults(prev => prev.filter(r => r.id !== resultId));
            if (selectedResult?.id === resultId) {
                setSelectedResult(null);
            }
        } catch (e) {
            console.error('Failed to delete result:', e);
            alert(t('backtest_delete_failed') || 'Failed to delete result.');
        }
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
                                                <p className="font-semibold text-foreground">{(result as any).accuracy?.toFixed(1) || 0}%</p>
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
                    {selectedResult && (
                        <Card className="border-purple-500/30 bg-purple-500/5">
                            <h4 className="font-semibold text-foreground mb-3">{t('backtest_selected_result') || 'Selected Result'}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-muted-foreground">{t('scenario') || 'Scenario'}</p>
                                    <p className="font-semibold text-foreground">{selectedResult.scenarioName || t('backtest_no_scenario') || 'No Scenario'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{t('time_range') || 'Time Range'}</p>
                                    <p className="font-semibold text-foreground">{selectedResult.timeRange}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{t('executed_at') || 'Executed at'}</p>
                                    <p className="font-semibold text-foreground">{formatTimeAgo(selectedResult.executedAt)}</p>
                                </div>
                                {selectedResult.initialCapital !== undefined && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t('initial_capital') || 'Initial Capital'}</p>
                                        <p className="font-semibold text-foreground">${selectedResult.initialCapital.toFixed(2)}</p>
                                    </div>
                                )}
                                {selectedResult.finalCapital !== undefined && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t('final_capital') || 'Final Capital'}</p>
                                        <p className="font-semibold text-foreground">${selectedResult.finalCapital.toFixed(2)}</p>
                                    </div>
                                )}
                                {selectedResult.profitFactor !== undefined && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t('profit_factor') || 'Profit Factor'}</p>
                                        <p className="font-semibold text-foreground">{selectedResult.profitFactor.toFixed(2)}</p>
                                    </div>
                                )}
                                {selectedResult.profitableTrades !== undefined && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t('profitable_trades') || 'Profitable trades'}</p>
                                        <p className="font-semibold text-foreground">{selectedResult.profitableTrades}</p>
                                    </div>
                                )}
                                {selectedResult.averageWin !== undefined && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t('average_win') || 'Average win'}</p>
                                        <p className="font-semibold text-foreground">${selectedResult.averageWin.toFixed(2)}</p>
                                    </div>
                                )}
                                {selectedResult.averageLoss !== undefined && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">{t('average_loss') || 'Average loss'}</p>
                                        <p className="font-semibold text-foreground">${selectedResult.averageLoss.toFixed(2)}</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
};

export default BacktestingTab;

