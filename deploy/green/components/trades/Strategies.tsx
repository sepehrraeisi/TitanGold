import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { Strategy } from '../../types.ts';
import StrategyCard from './strategies/StrategyCard.tsx';
import TopPerformersWidget from './strategies/TopPerformersWidget.tsx';
import StrategyComparisonChart from './strategies/StrategyComparisonChart.tsx';
import StrategyBacktestWidget from './strategies/StrategyBacktestWidget.tsx';
import StrategyAnalyticsWidget from './strategies/StrategyAnalyticsWidget.tsx';
import { 
    fetchStrategies, 
    toggleStrategy, 
    createStrategy, 
    generateAIStrategy,
    copyStrategy,
    updateStrategy,
    groupBacktestStrategies,
    optimizeAllStrategies,
    exportAllStrategies,
    allocatePortfolio,
} from '../../services/api.ts';

const Strategies: React.FC = () => {
    const { t } = useLanguage();
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [sortBy, setSortBy] = useState<'roi' | 'winRate' | 'trades' | 'sharpe'>('roi');
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newStrategyName, setNewStrategyName] = useState('');
    const [newStrategyType, setNewStrategyType] = useState('Custom');

    const loadStrategies = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            console.log('🔄 Loading strategies from backend...');
            const data = await fetchStrategies();
            console.log('✅ Strategies loaded successfully:', data);
            setStrategies(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error('❌ Failed to load strategies:', err);
            const errorMessage = err?.message || 'Failed to load strategies';
            setError(`Unable to load strategies data: ${errorMessage}. Please ensure backend is running and database is accessible.`);
            setStrategies([]); // Clear strategies on error
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadStrategies();
    }, [loadStrategies]);

    const totals = useMemo(() => {
        if (strategies.length === 0) {
            return {
                totalReturn: '0%',
                avgWinRate: '0%',
                totalTrades: '0',
            };
        }
        const totalRoi = strategies.reduce((sum, s) => sum + s.roi, 0);
        const totalWinRate = strategies.reduce((sum, s) => sum + s.winRate, 0);
        const totalTrades = strategies.reduce((sum, s) => sum + s.trades, 0);
        return {
            totalReturn: `${(totalRoi / strategies.length).toFixed(1)}%`,
            avgWinRate: `${(totalWinRate / strategies.length).toFixed(1)}%`,
            totalTrades: totalTrades.toLocaleString(),
        };
    }, [strategies]);

    const filteredAndSortedStrategies = useMemo(() => {
        let filtered = strategies;

        // Filter by status
        if (filter !== 'all') {
            filtered = filtered.filter(s => s.status === filter);
        }

        // Sort
        filtered = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'roi':
                    return b.roi - a.roi;
                case 'winRate':
                    return b.winRate - a.winRate;
                case 'trades':
                    return b.trades - a.trades;
                case 'sharpe':
                    return (b.sharpe || 0) - (a.sharpe || 0);
                default:
                    return 0;
            }
        });

        return filtered;
    }, [strategies, filter, sortBy]);

    const handleStrategyToggle = useCallback(async (strategyId: string) => {
        try {
            await toggleStrategy(strategyId);
            await loadStrategies();
        } catch (error) {
            console.error('Failed to toggle strategy:', error);
        }
    }, [loadStrategies]);

    const handleBacktest = useCallback(async (config: {
        strategyId: string;
        startDate: string;
        endDate: string;
        initialCapital: number;
    }) => {
        // TODO: Implement backtest API call
        console.log('Running backtest:', config);
        // This will be implemented when backend endpoint is ready
    }, []);

    const handleCreateStrategy = useCallback(async () => {
        try {
            setIsProcessing('create');
            if (selectedStrategy) {
                // Update existing strategy
                await updateStrategy(selectedStrategy.id, {
                    name: newStrategyName || undefined,
                    type: newStrategyType || undefined,
                });
            } else {
                // Create new strategy
                await createStrategy(newStrategyName || undefined, newStrategyType || undefined);
            }
            setShowCreateModal(false);
            setNewStrategyName('');
            setNewStrategyType('Custom');
            setSelectedStrategy(null);
            await loadStrategies();
        } catch (error: any) {
            console.error('Failed to create/update strategy:', error);
            alert(error?.message || 'Failed to create/update strategy');
        } finally {
            setIsProcessing(null);
        }
    }, [newStrategyName, newStrategyType, selectedStrategy, loadStrategies]);

    const handleGenerateAIStrategy = useCallback(async () => {
        try {
            setIsProcessing('ai-generate');
            await generateAIStrategy();
            await loadStrategies();
        } catch (error: any) {
            console.error('Failed to generate AI strategy:', error);
            alert(error?.message || 'Failed to generate AI strategy');
        } finally {
            setIsProcessing(null);
        }
    }, [loadStrategies]);

    const handleGroupBacktest = useCallback(async () => {
        try {
            setIsProcessing('group-backtest');
            const activeStrategyIds = strategies.filter(s => s.status === 'active').map(s => s.id);
            if (activeStrategyIds.length === 0) {
                alert('No active strategies to backtest');
                return;
            }
            const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const endDate = new Date().toISOString().split('T')[0];
            await groupBacktestStrategies(activeStrategyIds, startDate, endDate, 10000);
            alert('Group backtest initiated successfully');
        } catch (error: any) {
            console.error('Failed to start group backtest:', error);
            alert(error?.message || 'Failed to start group backtest');
        } finally {
            setIsProcessing(null);
        }
    }, [strategies]);

    const handleOptimizeAll = useCallback(async () => {
        try {
            setIsProcessing('optimize-all');
            await optimizeAllStrategies();
            alert('Optimization initiated for all strategies');
        } catch (error: any) {
            console.error('Failed to optimize strategies:', error);
            alert(error?.message || 'Failed to optimize strategies');
        } finally {
            setIsProcessing(null);
        }
    }, []);

    const handleExportAll = useCallback(async () => {
        try {
            setIsProcessing('export-all');
            await exportAllStrategies();
        } catch (error: any) {
            console.error('Failed to export strategies:', error);
            alert(error?.message || 'Failed to export strategies');
        } finally {
            setIsProcessing(null);
        }
    }, []);

    const handleAllocatePortfolio = useCallback(async () => {
        try {
            setIsProcessing('allocate-portfolio');
            // Calculate equal allocation for all active strategies
            const activeStrategies = strategies.filter(s => s.status === 'active');
            if (activeStrategies.length === 0) {
                alert('No active strategies to allocate');
                return;
            }
            const allocationPercent = 100 / activeStrategies.length;
            const allocations: Record<string, number> = {};
            activeStrategies.forEach(s => {
                allocations[s.id] = allocationPercent;
            });
            await allocatePortfolio(allocations);
            alert('Portfolio allocation updated successfully');
        } catch (error: any) {
            console.error('Failed to allocate portfolio:', error);
            alert(error?.message || 'Failed to allocate portfolio');
        } finally {
            setIsProcessing(null);
        }
    }, [strategies]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-16 bg-[#1c1e2f] border border-gray-700/50 rounded-lg animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-24 bg-[#1c1e2f] border border-gray-700/50 rounded-lg animate-pulse" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-64 bg-[#1c1e2f] border border-gray-700/50 rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <div className="bg-[#1c1e2f] border border-red-500/40 rounded-lg p-6">
                    <p className="text-sm text-gray-300">{error}</p>
                    <button
                        onClick={() => void loadStrategies()}
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
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
                <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">{t('strategy_management')}</h2>
                    <p className="text-gray-400 text-xs sm:text-sm">{t('strategy_management_desc')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        disabled={isProcessing === 'create'}
                        className="flex-1 sm:flex-none bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm transition-colors"
                    >
                        {isProcessing === 'create' ? t('loading') || 'Loading...' : t('new_strategy')}
                    </button>
                    <button 
                        onClick={() => void handleGenerateAIStrategy()}
                        disabled={isProcessing === 'ai-generate'}
                        className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm transition-colors"
                    >
                        {isProcessing === 'ai-generate' ? t('loading') || 'Loading...' : t('ai_smart_generate')}
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <StatCard label={t('total_return')} value={totals.totalReturn} subValue={t('last_30_days')} />
                <StatCard label={t('avg_win_rate')} value={totals.avgWinRate} subValue={t('all_strategies')} />
                <StatCard label={t('total_trades')} value={totals.totalTrades} subValue={t('this_month')} />
            </div>

            {/* Filters and Sort */}
            <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
                        <label className="text-xs sm:text-sm text-gray-400 whitespace-nowrap">{t('filter')}:</label>
                        <div className="flex gap-2">
                            {(['all', 'active', 'inactive'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`flex-1 sm:flex-none px-2 sm:px-3 py-1 text-xs rounded-md border transition-colors ${
                                        filter === f
                                            ? 'border-purple-500/70 bg-purple-500/20 text-purple-200'
                                            : 'border-gray-700 bg-gray-700/40 text-gray-300 hover:bg-gray-700'
                                    }`}
                                >
                                    {t(f === 'all' ? 'all' : f)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
                        <label className="text-xs sm:text-sm text-gray-400 whitespace-nowrap">{t('sort_by')}:</label>
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as any)}
                            className="w-full sm:w-auto px-2 sm:px-3 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="roi">{t('roi')}</option>
                            <option value="winRate">{t('win_rate')}</option>
                            <option value="trades">{t('trades')}</option>
                            <option value="sharpe">{t('sharpe_ratio')}</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
                <div className="xl:col-span-2 space-y-3 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <h3 className="font-semibold text-white text-sm sm:text-base">{t('strategy_list')}</h3>
                        <span className="text-xs text-gray-400">
                            {filteredAndSortedStrategies.length} {t('strategies')}
                        </span>
                    </div>
                    {filteredAndSortedStrategies.length === 0 ? (
                        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-8 text-center">
                            <p className="text-gray-400">{t('no_strategies_found') || 'No strategies found'}</p>
                        </div>
                    ) : (
                        filteredAndSortedStrategies.map(strategy => (
                            <div
                                key={strategy.id}
                                onClick={() => setSelectedStrategy(strategy.id === selectedStrategy?.id ? null : strategy)}
                                className={`cursor-pointer transition-all ${
                                    selectedStrategy?.id === strategy.id ? 'ring-2 ring-purple-500/50' : ''
                                }`}
                            >
                                <StrategyCard 
                                    strategy={strategy}
                                    onToggle={() => void handleStrategyToggle(strategy.id)}
                                    isSelected={selectedStrategy?.id === strategy.id}
                                    onEdit={(s) => {
                                        setSelectedStrategy(s);
                                        setShowCreateModal(true);
                                        setNewStrategyName(s.name);
                                        setNewStrategyType(s.type);
                                    }}
                                    onBacktest={(s) => {
                                        setSelectedStrategy(s);
                                        // Backtest widget will handle it
                                    }}
                                    onCopy={async (id) => {
                                        try {
                                            setIsProcessing('copy');
                                            await copyStrategy(id);
                                            await loadStrategies();
                                        } catch (error: any) {
                                            console.error('Failed to copy strategy:', error);
                                            alert(error?.message || 'Failed to copy strategy');
                                        } finally {
                                            setIsProcessing(null);
                                        }
                                    }}
                                />
                            </div>
                        ))
                    )}
                </div>
                <div className="space-y-4 sm:space-y-6">
                    {selectedStrategy ? (
                        <>
                            <StrategyAnalyticsWidget strategy={selectedStrategy} />
                            <StrategyBacktestWidget 
                                strategy={selectedStrategy}
                                onBacktest={handleBacktest}
                            />
                        </>
                    ) : (
                        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-3 sm:p-4">
                            <h3 className="font-semibold text-white mb-2 sm:mb-3 text-sm sm:text-base">{t('strategy_details')}</h3>
                            <p className="text-xs sm:text-sm text-center text-gray-500 py-6 sm:py-10">{t('select_strategy_prompt')}</p>
                        </div>
                    )}
                    <TopPerformersWidget strategies={strategies} />
                    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-3 sm:p-4">
                        <h3 className="font-semibold text-white mb-2 sm:mb-3 text-sm sm:text-base">{t('quick_actions')}</h3>
                        <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                            <button 
                                onClick={() => void handleGroupBacktest()}
                                disabled={isProcessing === 'group-backtest'}
                                className="p-2 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                            >
                                {isProcessing === 'group-backtest' ? t('loading') || '...' : t('group_backtest')}
                            </button>
                            <button 
                                onClick={() => void handleOptimizeAll()}
                                disabled={isProcessing === 'optimize-all'}
                                className="p-2 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                            >
                                {isProcessing === 'optimize-all' ? t('loading') || '...' : t('optimize_all')}
                            </button>
                            <button 
                                onClick={() => void handleExportAll()}
                                disabled={isProcessing === 'export-all'}
                                className="p-2 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                            >
                                {isProcessing === 'export-all' ? t('loading') || '...' : t('export_all')}
                            </button>
                            <button 
                                onClick={() => void handleAllocatePortfolio()}
                                disabled={isProcessing === 'allocate-portfolio'}
                                className="p-2 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                            >
                                {isProcessing === 'allocate-portfolio' ? t('loading') || '...' : t('allocate_portfolio')}
                            </button>
                         </div>
                    </div>
                </div>
            </div>

            <StrategyComparisonChart strategies={strategies} />

            {/* Create/Edit Strategy Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => {
                    setShowCreateModal(false);
                    setNewStrategyName('');
                    setNewStrategyType('Custom');
                    setSelectedStrategy(null);
                }}>
                    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-4">{selectedStrategy ? t('edit') + ' ' + t('strategy') : t('new_strategy')}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">{t('strategy')} {t('name')}</label>
                                <input
                                    type="text"
                                    value={newStrategyName}
                                    onChange={e => setNewStrategyName(e.target.value)}
                                    className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder={t('strategy') + ' ' + t('name')}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">{t('strategy')} {t('type')}</label>
                                <select
                                    value={newStrategyType}
                                    onChange={e => setNewStrategyType(e.target.value)}
                                    className="w-full p-2 bg-gray-800/50 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="Custom">Custom</option>
                                    <option value="AI">AI</option>
                                    <option value="Scalping">Scalping</option>
                                    <option value="Trend">Trend</option>
                                    <option value="Swing">Swing</option>
                                    <option value="Arbitrage">Arbitrage</option>
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setNewStrategyName('');
                                        setNewStrategyType('Custom');
                                        setSelectedStrategy(null);
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={() => void handleCreateStrategy()}
                                    disabled={isProcessing === 'create'}
                                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                >
                                    {isProcessing === 'create' ? t('loading') : (selectedStrategy ? t('update') : t('create'))}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard: React.FC<{ label: string, value: string, subValue: string }> = ({ label, value, subValue }) => (
    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        <p className="text-xs text-gray-500">{subValue}</p>
    </div>
);


export default Strategies;
