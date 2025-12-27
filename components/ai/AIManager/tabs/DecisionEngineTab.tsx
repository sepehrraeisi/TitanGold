import React, { useMemo, useState } from 'react';
import * as api from '../../../../services/api.ts';
import { ArtemisState, DecisionEngineState, AgentSignal } from '../../../../types.ts';

type Props = {
    artemis: ArtemisState;
    t: (key: string) => string;
    onRefresh: () => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
};

const DecisionEngineTab: React.FC<Props> = ({ artemis, t, onRefresh, Card }) => {
    const [isMakingDecision, setIsMakingDecision] = useState(false);
    const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [decisionFilter, setDecisionFilter] = useState<'all' | 'trade' | 'risk_management' | 'portfolio_adjustment' | 'agent_control'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'executed' | 'failed' | 'cancelled'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const decisionSeries = useMemo(() => {
        const decisions = artemis.decisionEngine?.recentDecisions || [];
        return decisions.slice(-30).map((d, idx) => ({
            index: idx,
            confidence: d.output?.confidence ?? (d as any).confidence ?? 0,
            accuracy: d.learning?.accuracy ?? null,
            wasSuccessful: d.learning?.learned ? (d.learning.accuracy ?? 0) >= 70 : null,
            timestamp: (d as any).createdAt || d.timestamp || d.id,
        }));
    }, [artemis.decisionEngine?.recentDecisions]);

    const handleMakeDecision = async () => {
        setIsMakingDecision(true);
        try {
            // No mock data – let backend use real signals/state
            const decision = await api.makeArtemisDecision([]);
            alert(t('decision_made') || `Decision made: ${decision.output.action} (${decision.output.confidence}% confidence)`);
            onRefresh();
        } catch (e) {
            console.error('Failed to make decision:', e);
            alert(t('decision_failed') || 'Failed to make decision');
        } finally {
            setIsMakingDecision(false);
        }
    };

    const handleUpdateConfig = async (updates: Partial<DecisionEngineState>) => {
        setIsUpdatingConfig(true);
        try {
            await api.updateArtemisConfig({ decisionEngine: { ...artemis.decisionEngine, ...updates } });
            onRefresh();
            setShowConfigModal(false);
            alert(t('config_updated') || 'Configuration updated successfully');
        } catch (e) {
            console.error('Failed to update config:', e);
            alert(t('config_update_failed') || 'Failed to update configuration');
        } finally {
            setIsUpdatingConfig(false);
        }
    };

    const filteredDecisions = useMemo(() => {
        return (artemis.decisionEngine.recentDecisions || []).filter(decision => {
            if (decisionFilter !== 'all' && decision.type !== decisionFilter) return false;
            if (statusFilter !== 'all' && decision.execution.status !== statusFilter) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                return (
                    decision.output.action.toLowerCase().includes(q) ||
                    decision.process.method.toLowerCase().includes(q) ||
                    decision.type.toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [artemis.decisionEngine.recentDecisions, decisionFilter, statusFilter, searchQuery]);

    const performanceStats = useMemo(() => {
        const decisions = artemis.decisionEngine.recentDecisions || [];
        const executed = decisions.filter(d => d.execution.status === 'executed');
        const successful = executed.filter(d => d.learning.accuracy !== undefined && d.learning.accuracy >= 70);
        const avgConfidence = decisions.length > 0 ? decisions.reduce((sum, d) => sum + d.output.confidence, 0) / decisions.length : 0;
        return {
            total: decisions.length,
            executed: executed.length,
            successful: successful.length,
            successRate: executed.length > 0 ? (successful.length / executed.length) * 100 : 0,
            avgConfidence,
            avgExecutionTime: artemis.decisionEngine.performance.avgExecutionTime,
        };
    }, [artemis.decisionEngine]);

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('decision_engine_configuration') || 'Decision Engine Configuration'}</h3>
                        <p className="text-xs text-muted-foreground">
                            {t('decision_engine_desc') || 'Configure decision-making strategy, models, and thresholds'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowConfigModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('configure') || 'Configure'}
                        </button>
                        <button
                            onClick={handleMakeDecision}
                            disabled={isMakingDecision}
                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {isMakingDecision ? t('processing') || 'Processing...' : t('make_decision') || 'Make Decision'}
                        </button>
                    </div>
                </div>
                {showConfigModal && (
                    <div className="mt-4 border-t border-border pt-4 space-y-3 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">
                                    {t('strategy') || 'Strategy'}
                                </label>
                                <select
                                    defaultValue={artemis.decisionEngine.strategy}
                                    onChange={(e) => handleUpdateConfig({ strategy: e.target.value as DecisionEngineState['strategy'] })}
                                    className="w-full px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                                >
                                    <option value="voting">{t('voting') || 'voting'}</option>
                                    <option value="weighted">{t('weighted') || 'weighted'}</option>
                                    <option value="mixture_of_experts">{t('mixture_of_experts') || 'mixture_of_experts'}</option>
                                    <option value="consensus">{t('consensus') || 'consensus'}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">
                                    {t('active_model') || 'Active Model'}
                                </label>
                                <select
                                    defaultValue={artemis.decisionEngine.activeModel}
                                    onChange={(e) => handleUpdateConfig({ activeModel: e.target.value as DecisionEngineState['activeModel'] })}
                                    className="w-full px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                                >
                                    <option value="internal">internal</option>
                                    <option value="claude">claude</option>
                                    <option value="gemini">gemini</option>
                                    <option value="openai">openai</option>
                                    <option value="deepseek">deepseek</option>
                                    <option value="openrouter">openrouter</option>
                                    <option value="hybrid">hybrid</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">
                                    {t('confidence_threshold') || 'Confidence Threshold'}
                                </label>
                                <input
                                    type="number"
                                    defaultValue={artemis.decisionEngine.confidenceThreshold}
                                    min={0}
                                    max={100}
                                    onBlur={(e) => {
                                        const v = parseInt(e.target.value || '0', 10);
                                        if (!Number.isNaN(v)) handleUpdateConfig({ confidenceThreshold: v });
                                    }}
                                    className="w-full px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="px-3 py-1 text-xs rounded border border-border text-muted-foreground hover:bg-secondary/40"
                                disabled={isUpdatingConfig}
                            >
                                {t('cancel') || 'Cancel'}
                            </button>
                            <button
                                onClick={onRefresh}
                                className="px-3 py-1 text-xs rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                                disabled={isUpdatingConfig}
                            >
                                {isUpdatingConfig ? (t('processing') || 'Processing...') : (t('refresh') || 'Refresh')}
                            </button>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-center">
                    <Stat label={t('strategy') || 'Strategy'} value={t(artemis.decisionEngine.strategy) || artemis.decisionEngine.strategy} />
                    <Stat label={t('active_model') || 'Active Model'} value={t(artemis.decisionEngine.activeModel) || artemis.decisionEngine.activeModel} />
                    <Stat label={t('confidence_threshold') || 'Confidence Threshold'} value={`${artemis.decisionEngine.confidenceThreshold}%`} />
                    <Stat label={t('performance_accuracy') || 'Performance Accuracy'} value={`${artemis.decisionEngine.performance.accuracy.toFixed(1)}%`} />
                </div>
                {performanceStats.total > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <SmallStat label={t('total_decisions') || 'Total'} value={performanceStats.total} />
                        <SmallStat label={t('executed') || 'Executed'} value={performanceStats.executed} valueClass="text-blue-400" />
                        <SmallStat label={t('successful') || 'Successful'} value={performanceStats.successful} valueClass="text-green-400" />
                        <SmallStat label={t('success_rate') || 'Success Rate'} value={`${performanceStats.successRate.toFixed(1)}%`} />
                        <SmallStat label={t('avg_confidence') || 'Avg Confidence'} value={`${performanceStats.avgConfidence.toFixed(1)}%`} />
                    </div>
                )}
            </Card>

            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-foreground">{t('recent_decisions') || 'Recent Decisions'}</h3>
                    <div className="flex gap-2">
                        <select
                            value={decisionFilter}
                            onChange={(e) => setDecisionFilter(e.target.value as any)}
                            className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                        >
                            <option value="all">{t('all_types') || 'All Types'}</option>
                            <option value="trade">{t('trade') || 'Trade'}</option>
                            <option value="risk_management">{t('risk_management') || 'Risk Management'}</option>
                            <option value="portfolio_adjustment">{t('portfolio_adjustment') || 'Portfolio Adjustment'}</option>
                            <option value="agent_control">{t('agent_control') || 'Agent Control'}</option>
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                        >
                            <option value="all">{t('all_statuses') || 'All Statuses'}</option>
                            <option value="pending">{t('pending') || 'Pending'}</option>
                            <option value="executed">{t('executed') || 'Executed'}</option>
                            <option value="failed">{t('failed') || 'Failed'}</option>
                            <option value="cancelled">{t('cancelled') || 'Cancelled'}</option>
                        </select>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('search') || 'Search'}
                            className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                        />
                    </div>
                </div>
                <div className="space-y-3">
                    {filteredDecisions.length === 0 ? (
                        <p className="text-muted-foreground text-sm">{t('no_data') || 'No data available'}</p>
                    ) : filteredDecisions.map(decision => (
                        <div key={decision.id} className="p-3 bg-secondary/40 rounded-md">
                            <div className="flex justify-between text-sm">
                                <div>
                                    <p className="font-semibold text-foreground">{decision.output.action}</p>
                                    <p className="text-muted-foreground text-xs">
                                        {t(decision.type) || decision.type}
                                    </p>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {t(decision.execution.status) || decision.execution.status}
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {decision.process.method} • {t('confidence') || 'Confidence'}: {decision.output.confidence}%
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="font-semibold text-foreground">{value}</p>
    </div>
);

const SmallStat: React.FC<{ label: string; value: string | number; valueClass?: string }> = ({ label, value, valueClass }) => (
    <div className="bg-secondary/40 rounded p-3 text-center">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={`text-xl font-semibold text-foreground ${valueClass || ''}`}>{value}</p>
    </div>
);

export default DecisionEngineTab;

