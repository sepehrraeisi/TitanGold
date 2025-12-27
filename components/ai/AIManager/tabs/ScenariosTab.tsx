import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../../../../services/api.ts';
import { TradingScenario } from '../../../../types.ts';

type Props = {
    t: (key: string) => string;
    onRefresh: () => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
};

const ScenariosTab: React.FC<Props> = ({ t, onRefresh, Card }) => {
    const [scenarios, setScenarios] = useState<TradingScenario[]>([]);
    const [loading, setLoading] = useState(true);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed' | 'cancelled'>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'target_profit' | 'max_trades' | 'risk_reward' | 'custom'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [viewingScenario, setViewingScenario] = useState<TradingScenario | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    const loadScenarios = async () => {
        try {
            setLoading(true);
            setLoadError(null);
            const data = await api.fetchTradingScenarios();
            setScenarios(data || []);
        } catch (e) {
            console.error('Failed to load scenarios:', e);
            setScenarios([]);
            const message = e instanceof Error ? e.message : 'Unknown error';
            setLoadError(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadScenarios();
    }, []);

    const scenarioStats = useMemo(() => {
        const total = scenarios.length;
        const active = scenarios.filter(s => s.status === 'active').length;
        const totalTrades = scenarios.reduce((sum, s) => sum + (s.trades?.length || 0), 0);
        const totalProfit = scenarios.reduce(
            (sum, s) => sum + (s.trades || []).reduce((acc, t) => acc + (t.profit || 0), 0),
            0
        );
        return { total, active, totalTrades, totalProfit };
    }, [scenarios]);

    const filteredScenarios = useMemo(() => {
        return scenarios.filter(s => {
            if (statusFilter !== 'all' && s.status !== statusFilter) return false;
            if (typeFilter !== 'all' && s.type !== typeFilter) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                if (!s.name.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [scenarios, statusFilter, typeFilter, searchQuery]);

    const handleGenerateAIStrategy = async () => {
        try {
            setIsGeneratingAI(true);
            const newScenario = await api.generateAITradingScenario();
            setScenarios(prev => [newScenario, ...prev]);
            alert(
                t('ai_strategy_generated') ||
                    `AI strategy "${newScenario.name}" generated successfully!`
            );
        } catch (e) {
            console.error('Failed to generate AI strategy:', e);
            alert(
                t('ai_strategy_failed') ||
                    'Failed to generate AI strategy. Please try again.'
            );
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleCreateScenario = async (
        scenario: Omit<TradingScenario, 'id' | 'createdAt' | 'updatedAt' | 'trades' | 'progress'>
    ) => {
        try {
            const created = await api.createTradingScenario(scenario);
            setScenarios(prev => [...prev, created]);
            setShowCreateModal(false);
        } catch (e) {
            console.error('Failed to create scenario:', e);
            alert(t('create_failed') || 'Failed to create scenario');
        }
    };

    const handleRunBacktest = async (scenarioId: string) => {
        try {
            await api.runScenarioBacktest?.(scenarioId);
            alert(t('backtest_started') || 'Backtest started');
        } catch (e) {
            console.error('Failed to run backtest:', e);
            alert(t('backtest_failed') || 'Failed to run backtest');
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('trading_scenarios') || 'Trading Scenarios'}</h3>
                        <p className="text-xs text-muted-foreground">
                            {t('scenarios_desc') ||
                                'Create and manage trading scenarios with specific targets and rules'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleGenerateAIStrategy}
                            disabled={isGeneratingAI}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm flex items-center gap-2"
                        >
                            {isGeneratingAI ? (
                                <>
                                    <span className="animate-spin">⚙️</span>
                                    {t('generating_ai_strategy') || 'Generating AI Strategy...'}
                                </>
                            ) : (
                                <>
                                    <span>🤖</span>
                                    {t('generate_ai_strategy') || 'Generate AI Strategy'}
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('create_scenario') || '+ Create Scenario'}
                        </button>
                    </div>
                </div>

                {scenarios.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">
                                {t('total_scenarios') || 'Total'}
                            </p>
                            <p className="text-xl font-semibold text-foreground">{scenarioStats.total}</p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">
                                {t('active_scenarios') || 'Active'}
                            </p>
                            <p className="text-xl font-semibold text-green-400">
                                {scenarioStats.active}
                            </p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">
                                {t('total_trades') || 'Total Trades'}
                            </p>
                            <p className="text-xl font-semibold text-foreground">
                                {scenarioStats.totalTrades}
                            </p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">
                                {t('total_profit') || 'Total Profit'}
                            </p>
                            <p
                                className={`text-xl font-semibold ${
                                    scenarioStats.totalProfit >= 0
                                        ? 'text-green-400'
                                        : 'text-red-400'
                                }`}
                            >
                                ${scenarioStats.totalProfit.toFixed(2)}
                            </p>
                        </div>
                    </div>
                )}

                {scenarios.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('search_scenarios') || 'Search scenarios...'}
                            className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                        />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                        >
                            <option value="all">{t('all_statuses') || 'All Statuses'}</option>
                            <option value="active">{t('active') || 'Active'}</option>
                            <option value="paused">{t('paused') || 'Paused'}</option>
                            <option value="completed">{t('completed') || 'Completed'}</option>
                            <option value="cancelled">{t('cancelled') || 'Cancelled'}</option>
                        </select>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as any)}
                            className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                        >
                            <option value="all">{t('all_types') || 'All Types'}</option>
                            <option value="target_profit">{t('target_profit') || 'Target Profit'}</option>
                            <option value="max_trades">{t('max_trades') || 'Max Trades'}</option>
                            <option value="risk_reward">{t('risk_reward') || 'Risk/Reward'}</option>
                            <option value="custom">{t('custom') || 'Custom'}</option>
                        </select>
                    </div>
                )}

                {filteredScenarios.length > 0 ? (
                    <div className="space-y-3">
                        {filteredScenarios.map((scenario) => {
                            const trades = scenario.trades || [];
                            const tradesProfit = trades.reduce(
                                (sum, t) => sum + (t.profit || 0),
                                0
                            );
                            const profitableTrades = trades.filter(
                                (t) => (t.profit || 0) > 0
                            ).length;
                            const winRate =
                                trades.length > 0
                                    ? (profitableTrades / trades.length) * 100
                                    : 0;

                            return (
                                <div
                                    key={scenario.id}
                                    className="p-4 border border-border rounded-lg hover:border-purple-500/50 transition-colors"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold text-foreground">
                                                    {scenario.name}
                                                </p>
                                                {(scenario.name?.includes('AI') ||
                                                    scenario.name?.includes('Artemis')) && (
                                                    <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-400 rounded-full text-xs font-semibold flex items-center gap-1">
                                                        <span>🤖</span>
                                                        <span>AI</span>
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {t(scenario.type) || scenario.type} ·{' '}
                                                {t(scenario.status) || scenario.status}
                                            </p>
                                            {(scenario.target as any)?.description && (
                                                <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-purple-500/30 pl-2">
                                                    💡 {(scenario.target as any).description}
                                                </p>
                                            )}
                                        </div>
                                        <span
                                            className={`px-2 py-1 rounded-full text-xs ${
                                                scenario.status === 'active'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : scenario.status === 'completed'
                                                    ? 'bg-blue-500/20 text-blue-400'
                                                    : scenario.status === 'paused'
                                                    ? 'bg-yellow-500/20 text-yellow-400'
                                                    : 'bg-gray-500/20 text-gray-400'
                                            }`}
                                        >
                                            {t(scenario.status) || scenario.status}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                        {scenario.target?.profit && (
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('target_profit') || 'Target Profit'}
                                                </p>
                                                <p className="font-semibold text-foreground">
                                                    ${scenario.target.profit.toFixed(2)}
                                                </p>
                                            </div>
                                        )}
                                        {scenario.target?.maxTrades && (
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('max_trades') || 'Max Trades'}
                                                </p>
                                                <p className="font-semibold text-foreground">
                                                    {scenario.target.maxTrades}
                                                </p>
                                            </div>
                                        )}
                                        {scenario.target?.riskRewardRatio && (
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('risk_reward_ratio') || 'Risk/Reward'}
                                                </p>
                                                <p className="font-semibold text-foreground">
                                                    {scenario.target.riskRewardRatio.toFixed(2)}
                                                </p>
                                            </div>
                                        )}
                                        {scenario.progress && (
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('progress') || 'Progress'}
                                                </p>
                                                <p className="font-semibold text-foreground">
                                                    {scenario.progress.percentage.toFixed(1)}%
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {trades.length > 0 && (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-xs">
                                            <div>
                                                <p className="text-muted-foreground">
                                                    {t('current_profit') || 'Current Profit'}
                                                </p>
                                                <p
                                                    className={`font-semibold ${
                                                        tradesProfit >= 0
                                                            ? 'text-green-400'
                                                            : 'text-red-400'
                                                    }`}
                                                >
                                                    ${tradesProfit.toFixed(2)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">
                                                    {t('win_rate') || 'Win Rate'}
                                                </p>
                                                <p className="font-semibold text-foreground">
                                                    {winRate.toFixed(1)}%
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">
                                                    {t('profitable_trades') || 'Profitable'}
                                                </p>
                                                <p className="font-semibold text-foreground">
                                                    {profitableTrades}/{trades.length}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">
                                                    {t('avg_profit') || 'Avg Profit'}
                                                </p>
                                                <p
                                                    className={`font-semibold ${
                                                        tradesProfit >= 0
                                                            ? 'text-green-400'
                                                            : 'text-red-400'
                                                    }`}
                                                >
                                                    $
                                                    {trades.length > 0
                                                        ? (tradesProfit / trades.length).toFixed(2)
                                                        : '0.00'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {scenario.progress && (
                                        <div className="w-full bg-secondary rounded-full h-2 mb-2">
                                            <div
                                                className="bg-purple-500 h-2 rounded-full"
                                                style={{
                                                    width: `${scenario.progress.percentage}%`,
                                                }}
                                            ></div>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center">
                                        <div className="text-xs text-muted-foreground">
                                            <span>
                                                {t('trades') || 'Trades'}: {trades.length}
                                            </span>
                                            {scenario.updatedAt && (
                                                <span className="ml-3">
                                                    {new Date(
                                                        scenario.updatedAt
                                                    ).toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {trades.length > 0 && (
                                                <button
                                                    onClick={() => setViewingScenario(scenario)}
                                                    className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded"
                                                >
                                                    {t('view_trades') || 'View Trades'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() =>
                                                    handleRunBacktest(scenario.id)
                                                }
                                                className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
                                            >
                                                {t('run_backtest') || 'Backtest'}
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const confirmed = window.confirm(
                                                        t('confirm_delete_scenario') ||
                                                            `Are you sure you want to delete "${scenario.name}"?`
                                                    );
                                                    if (!confirmed) return;
                                                    try {
                                                        await api.deleteTradingScenario(
                                                            scenario.id
                                                        );
                                                        setScenarios(prev =>
                                                            prev.filter(
                                                                (s) =>
                                                                    s.id !==
                                                                    scenario.id
                                                            )
                                                        );
                                                        alert(
                                                            t('scenario_deleted') ||
                                                                'Scenario deleted successfully'
                                                        );
                                                    } catch (e) {
                                                        console.error(
                                                            'Failed to delete scenario:',
                                                            e
                                                        );
                                                        alert(
                                                            t('delete_failed') ||
                                                                'Failed to delete scenario'
                                                        );
                                                    }
                                                }}
                                                className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                                            >
                                                {t('delete') || 'Delete'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : scenarios.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground mb-4">
                            {t('no_scenarios') ||
                                'No trading scenarios created yet.'}
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('create_first_scenario') || 'Create First Scenario'}
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">
                            {t('no_scenarios_match') ||
                                'No scenarios match your filters.'}
                        </p>
                    </div>
                )}

                {filteredScenarios.length === 0 && !loading && (
                    <div className="mt-3">
                        {loadError ? (
                            <p className="text-sm text-red-400">
                                {t('failed_to_load_data') || 'Failed to load scenarios.'}
                            </p>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                {t('no_data') || 'No data available'}
                            </p>
                        )}
                    </div>
                )}
            </Card>

            {showCreateModal && (
                <CreateScenarioModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateScenario}
                    t={t}
                />
            )}

            {viewingScenario && (
                <ScenarioTradesModal
                    scenario={viewingScenario}
                    onClose={() => setViewingScenario(null)}
                    t={t}
                />
            )}
        </div>
    );
};

const CreateScenarioModal: React.FC<{
    onClose: () => void;
    onCreate: (
        scenario: Omit<TradingScenario, 'id' | 'createdAt' | 'updatedAt' | 'trades' | 'progress'>
    ) => Promise<void>;
    t: (key: string) => string;
}> = ({ onClose, onCreate, t }) => {
    const [name, setName] = useState('');
    const [type, setType] =
        useState<'target_profit' | 'max_trades' | 'risk_reward' | 'custom'>(
            'target_profit'
        );
    const [targetProfit, setTargetProfit] = useState(0);
    const [maxTrades, setMaxTrades] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!name) {
            alert(t('scenario_name_required') || 'Scenario name is required');
            return;
        }

        setIsSubmitting(true);
        try {
            const target: TradingScenario['target'] = {};
            if (type === 'target_profit') {
                if (targetProfit <= 0) {
                    alert(
                        t('target_profit_required') ||
                            'Target profit must be greater than 0'
                    );
                    return;
                }
                target.profit = targetProfit;
            } else if (type === 'max_trades') {
                if (maxTrades <= 0) {
                    alert(
                        t('max_trades_required') ||
                            'Max trades must be greater than 0'
                    );
                    return;
                }
                target.maxTrades = maxTrades;
            } else if (type === 'risk_reward') {
                if (targetProfit <= 0) {
                    alert(
                        t('risk_reward_required') ||
                            'Risk/Reward ratio must be greater than 0'
                    );
                    return;
                }
                target.riskRewardRatio = targetProfit;
            } else if (type === 'custom') {
                target.customRules = { description: String(targetProfit) };
            }

            await onCreate({
                name,
                type,
                target,
                status: 'active',
            });
        } catch (e) {
            console.error('Failed to create scenario:', e);
            alert(t('create_failed') || 'Failed to create scenario');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    {t('create_scenario') || 'Create Trading Scenario'}
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">
                            {t('scenario_name') || 'Scenario Name'}
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder={
                                t('enter_scenario_name') || 'Enter scenario name'
                            }
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">
                            {t('scenario_type') || 'Scenario Type'}
                        </label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as any)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        >
                            <option value="target_profit">
                                {t('target_profit') || 'Target Profit'}
                            </option>
                            <option value="max_trades">
                                {t('max_trades') || 'Max Trades'}
                            </option>
                            <option value="risk_reward">
                                {t('risk_reward') || 'Risk/Reward'}
                            </option>
                            <option value="custom">
                                {t('custom') || 'Custom'}
                            </option>
                        </select>
                    </div>

                    {type === 'target_profit' && (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('target_profit_amount') || 'Target Profit ($)'}
                            </label>
                            <input
                                type="number"
                                value={targetProfit}
                                onChange={(e) =>
                                    setTargetProfit(parseFloat(e.target.value) || 0)
                                }
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                placeholder="0"
                            />
                        </div>
                    )}

                    {type === 'max_trades' && (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('max_trades_count') || 'Max Trades'}
                            </label>
                            <input
                                type="number"
                                value={maxTrades}
                                onChange={(e) =>
                                    setMaxTrades(parseInt(e.target.value) || 0)
                                }
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                placeholder="0"
                            />
                        </div>
                    )}

                    {type === 'risk_reward' && (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('risk_reward_ratio') || 'Risk/Reward Ratio'}
                            </label>
                            <input
                                type="number"
                                value={targetProfit}
                                onChange={(e) =>
                                    setTargetProfit(parseFloat(e.target.value) || 0)
                                }
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                placeholder="2.0"
                            />
                        </div>
                    )}

                    {type === 'custom' && (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">
                                {t('custom_rules') || 'Custom Rules / Description'}
                            </label>
                            <textarea
                                value={String(targetProfit)}
                                onChange={(e) =>
                                    setTargetProfit(Number.NaN) ||
                                    setTargetProfit(Number(e.target.value) || 0)
                                }
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground text-sm min-h-[80px]"
                                placeholder={
                                    t('enter_custom_rules') ||
                                    'Describe custom rules for this scenario'
                                }
                            />
                        </div>
                    )}
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-secondary hover:bg-accent text-secondary-foreground font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {isSubmitting
                            ? t('creating') || 'Creating...'
                            : t('create') || 'Create'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ScenarioTradesModal: React.FC<{
    scenario: TradingScenario;
    onClose: () => void;
    t: (key: string) => string;
}> = ({ scenario, onClose, t }) => {
    const trades = scenario.trades || [];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">
                            {t('trades_for_scenario') || 'Trades for Scenario'}:{' '}
                            {scenario.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {t('total_trades') || 'Total Trades'}: {trades.length}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        {t('close') || 'Close'}
                    </button>
                </div>

                {trades.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t('no_trades') || 'No trades for this scenario yet.'}
                    </p>
                ) : (
                    <div className="space-y-2 text-sm">
                        {trades.map((trade, idx) => (
                            <div
                                key={idx}
                                className="p-2 border border-border rounded flex justify-between items-center"
                            >
                                <div>
                                    <p className="font-semibold text-foreground">
                                        {trade.symbol}{' '}
                                        <span className="text-xs text-muted-foreground">
                                            {trade.side}
                                        </span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {t('quantity') || 'Qty'}: {trade.quantity} @{' '}
                                        {trade.entryPrice}
                                        {trade.exitPrice && (
                                            <> → {trade.exitPrice}</>
                                        )}
                                    </p>
                                </div>
                                <div className="text-right text-xs">
                                    {trade.profit !== undefined && (
                                        <p
                                            className={
                                                trade.profit >= 0
                                                    ? 'text-green-400'
                                                    : 'text-red-400'
                                            }
                                        >
                                            {t('profit') || 'Profit'}:{' '}
                                            {trade.profit.toFixed(2)}
                                        </p>
                                    )}
                                    {trade.timestamp && (
                                        <p className="text-muted-foreground">
                                            {new Date(trade.timestamp).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScenariosTab;

