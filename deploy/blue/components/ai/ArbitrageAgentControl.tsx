import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type {
    AIAgent,
    ArbitrageConfig,
    ArbitrageMetrics,
    ArbitrageOpportunity,
    ArbitrageOpportunityHistoryEntry,
    ArbitrageScanResult,
    ArbitrageStrategyConfig,
    ArbitrageExecutionRecord,
} from '../../types.ts';

type ArbitrageTab = 'overview' | 'opportunities' | 'history' | 'profitRisk' | 'settings' | 'integration';

const TAB_ITEMS: Array<{ id: ArbitrageTab; labelKey: string }> = [
    { id: 'overview', labelKey: 'tab_overview' },
    { id: 'opportunities', labelKey: 'tab_opportunities' },
    { id: 'history', labelKey: 'tab_execution_history' },
    { id: 'profitRisk', labelKey: 'tab_profit_risk' },
    { id: 'settings', labelKey: 'tab_settings' },
    { id: 'integration', labelKey: 'tab_integration' },
];

interface ArbitrageAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

const ArbitrageAgentControl: React.FC<ArbitrageAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<ArbitrageTab>('overview');
    const [config, setConfig] = useState<ArbitrageConfig | null>(agent.arbitrageConfig || null);
    const [metrics, setMetrics] = useState<ArbitrageMetrics | null>(agent.arbitrageMetrics || null);
    const [scan, setScan] = useState<ArbitrageScanResult | null>(agent.lastArbitrageScan || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await api.fetchArbitrageAgentData(agent.id);
                if (data.config) setConfig(data.config);
                if (data.metrics) setMetrics(data.metrics);
                if (data.lastScan) setScan(data.lastScan);
            } catch (error) {
                console.error('Failed to load arbitrage agent data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [agent.id]);

    const handleRunScan = async () => {
        setIsScanning(true);
        try {
            const result = await api.runArbitrageAnalysis(agent.id);
            setScan(result);
            const agents = await api.fetchAIAgents();
            const updatedAgent = agents.find(a => a.id === agent.id);
            if (updatedAgent) {
                setMetrics(updatedAgent.arbitrageMetrics || null);
                onUpdate(updatedAgent);
            }
        } catch (error) {
            console.error('Failed to run arbitrage scan:', error);
            alert(t('analysis_failed') || 'Scan failed');
        } finally {
            setIsScanning(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: ArbitrageConfig) => {
        setIsLoading(true);
        try {
            await api.updateArbitrageConfig(agent.id, updatedConfig);
            setConfig(updatedConfig);
            alert(t('config_updated') || 'Configuration updated successfully');
        } catch (error) {
            console.error('Failed to update arbitrage config:', error);
            alert(t('update_failed') || 'Update failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleControlCommand = async (command: string) => {
        setIsLoading(true);
        try {
            await api.sendAgentControlCommand(agent.id, command);
            const agents = await api.fetchAIAgents();
            const updatedAgent = agents.find(a => a.id === agent.id);
            if (updatedAgent) {
                onUpdate(updatedAgent);
            }
        } catch (error) {
            console.error('Failed to execute command:', error);
            alert(t('command_failed') || 'Command failed');
        } finally {
            setIsLoading(false);
        }
    };

    const opportunities = useMemo(() => scan?.opportunities ?? [], [scan]);
    const executionHistory = metrics?.executionHistory ?? [];
    const opportunityHistory = metrics?.opportunityHistory ?? [];

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#10141A] border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden">
                <Header agent={agent} t={t} onRunScan={handleRunScan} onClose={onClose} isScanning={isScanning} />
                <StatusBar agent={agent} metrics={metrics} scan={scan} onCommand={handleControlCommand} t={t} />

                <nav className="flex flex-wrap gap-4 px-6 border-b border-gray-800 bg-[#0B1017]">
                    {TAB_ITEMS.map(tab => {
                        const translation = t(tab.labelKey);
                        const label = (translation && translation !== tab.labelKey) 
                            ? translation 
                            : tab.labelKey.replace('tab_', '').replace(/_/g, ' ');
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-emerald-500 text-emerald-400'
                                        : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-6 bg-[#0F151D] overflow-y-auto" style={{ maxHeight: 'calc(92vh - 200px)' }}>
                    {activeTab === 'overview' && (
                        <OverviewTab agent={agent} scan={scan} metrics={metrics} opportunities={opportunities.slice(0, 4)} t={t} />
                    )}

                    {activeTab === 'opportunities' && (
                        <OpportunitiesTab opportunities={opportunities} t={t} />
                    )}

                    {activeTab === 'history' && (
                        <HistoryTab executionHistory={executionHistory} opportunityHistory={opportunityHistory} t={t} />
                    )}

                    {activeTab === 'profitRisk' && (
                        <ProfitRiskTab metrics={metrics} scan={scan} t={t} />
                    )}

                    {activeTab === 'settings' && config && (
                        <SettingsTab config={config} disabled={isLoading} onUpdate={handleUpdateConfig} t={t} />
                    )}

                    {activeTab === 'integration' && config && (
                        <IntegrationTab config={config} t={t} />
                    )}

                    {!scan && activeTab === 'overview' && (
                        <EmptyState message={t('no_scan_data') || 'No arbitrage scans have been executed yet.'} />
                    )}
                </div>
            </div>
        </div>
    );
};

const Header: React.FC<{
    agent: AIAgent;
    t: (key: string) => string;
    onRunScan: () => void;
    onClose: () => void;
    isScanning: boolean;
}> = ({ agent, t, onRunScan, onClose, isScanning }) => (
    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 bg-[#0B1017]">
        <div>
            <h2 className="text-2xl font-bold text-white">{agent.name}</h2>
            <p className="text-sm text-gray-400 mt-1">{t('arbitrage_agent_desc') || 'Scans exchanges for multi-route arbitrage.'}</p>
        </div>
        <div className="flex gap-3">
            <button
                onClick={onRunScan}
                disabled={isScanning || agent.status !== 'active'}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg text-sm"
            >
                {isScanning ? t('scanning') || 'Scanning...' : t('run_scan') || 'Run Scan'}
            </button>
            <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm">
                {t('close')}
            </button>
        </div>
    </div>
);

const StatusBar: React.FC<{
    agent: AIAgent;
    metrics: ArbitrageMetrics | null;
    scan: ArbitrageScanResult | null;
    onCommand: (command: string) => void;
    t: (key: string) => string;
}> = ({ agent, metrics, scan, onCommand, t }) => (
    <div className="px-6 py-3 border-b border-gray-800 bg-[#0B1017]">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
                <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        agent.status === 'active'
                            ? 'bg-green-500/20 text-green-400'
                            : agent.status === 'training'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-gray-500/20 text-gray-400'
                    }`}
                >
                    {t(agent.status)}
                </span>
                <DataPoint label={t('total_scans') || 'Total scans'} value={metrics?.totalScans ?? 0} />
                <DataPoint label={t('best_profit_bps') || 'Best profit (bps)'} value={metrics?.bestProfitBps?.toFixed(1) ?? '--'} />
                <DataPoint
                    label={t('net_profit_captured') || 'Net profit captured'}
                    value={formatCurrency(metrics?.netProfitCapturedUSDT)}
                />
                {scan && (
                    <DataPoint
                        label={t('arbitrage_avg_risk_score') || 'Avg risk score'}
                        value={scan.avgRiskScore?.toFixed(1) ?? '--'}
                    />
                )}
            </div>
            <div className="flex gap-2">
                {agent.status === 'active' ? (
                    <button
                        onClick={() => onCommand('pause')}
                        className="bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                    >
                        {t('pause')}
                    </button>
                ) : (
                    <button
                        onClick={() => onCommand('start')}
                        className="bg-green-600 hover:bg-green-500 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                    >
                        {t('start')}
                    </button>
                )}
                <button
                    onClick={() => onCommand('restart')}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                >
                    {t('restart')}
                </button>
            </div>
        </div>
    </div>
);

const OverviewTab: React.FC<{
    agent: AIAgent;
    scan: ArbitrageScanResult | null;
    metrics: ArbitrageMetrics | null;
    opportunities: ArbitrageOpportunity[];
    t: (key: string) => string;
}> = ({ agent, scan, metrics, opportunities, t }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard label={t('last_scan_at') || 'Last scan'} value={scan ? new Date(scan.timestamp).toLocaleString() : '--'} />
            <MetricCard label={t('arbitrage_active_opportunities') || 'Active opportunities'} value={scan?.opportunities.length ?? 0} />
            <MetricCard label={t('arbitrage_net_profit_potential') || 'Net profit potential'} value={formatCurrency(scan?.netProfitPotentialUSDT)} />
            <MetricCard label={t('arbitrage_avg_execution') || 'Avg execution (ms)'} value={scan?.avgExecutionMs ?? '--'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title={t('arbitrage_recent_opportunities') || 'Recent high-conviction opportunities'}>
                {opportunities.length ? (
                    <div className="space-y-3">
                        {opportunities.map(opp => (
                            <OpportunityRow key={opp.id} opportunity={opp} t={t} />
                        ))}
                    </div>
                ) : (
                    <EmptyState message={t('arbitrage_no_recent_opportunities') || 'No recent arbitrage routes detected.'} />
                )}
            </SectionCard>
            <SectionCard title={t('arbitrage_profit_analysis') || 'Profit & risk analysis'}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <MiniStat label={t('net_profit_captured') || 'Net profit'} value={formatCurrency(metrics?.netProfitCapturedUSDT)} />
                    <MiniStat label={t('success_rate') || 'Success rate'} value={`${metrics?.successRate?.toFixed(1) ?? '--'}%`} />
                    <MiniStat label={t('risk_alerts') || 'Risk alerts'} value={metrics?.riskAlerts ?? 0} />
                    <MiniStat label={t('avg_execution_ms') || 'Avg execution (ms)'} value={metrics?.avgExecutionMs ?? '--'} />
                </div>
            </SectionCard>
        </div>

        {/* Agent Capabilities */}
        <CapabilitiesSection agent={agent} />
    </div>
);

const OpportunitiesTab: React.FC<{ opportunities: ArbitrageOpportunity[]; t: (key: string) => string }> = ({ opportunities, t }) => (
    <SectionCard title={t('tab_opportunities') || 'Opportunities'}>
        {opportunities.length ? (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {opportunities.map(opp => (
                    <div key={opp.id} className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase text-emerald-400">{t(`strategy_${opp.strategy}`) || opp.strategy}</p>
                                <p className="text-white font-semibold">{opp.path.join(' → ')}</p>
                                <p className="text-xs text-gray-500 mt-1">{new Date(opp.timestamp).toLocaleString()}</p>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm">
                                <MiniStat label={t('arbitrage_expected_profit') || 'Expected profit'} value={`${opp.expectedProfitBps.toFixed(2)} bps`} />
                                <MiniStat label={t('arbitrage_net_profit') || 'Net profit'} value={formatCurrency(opp.netProfitUSDT)} />
                                <MiniStat label={t('risk_score') || 'Risk score'} value={`${opp.riskScore?.toFixed(1) ?? '--'}%`} />
                                <MiniStat label={t('arbitrage_execution_time') || 'Execution time'} value={`${opp.executionTimeMs ?? '--'} ms`} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <EmptyState message={t('no_opportunities_found') || 'No opportunities detected in the last scan.'} />
        )}
    </SectionCard>
);

const HistoryTab: React.FC<{
    executionHistory: ArbitrageExecutionRecord[];
    opportunityHistory: ArbitrageOpportunityHistoryEntry[];
    t: (key: string) => string;
}> = ({ executionHistory, opportunityHistory, t }) => (
    <div className="space-y-6">
        <SectionCard title={t('arbitrage_execution_history') || 'Execution history'}>
            {executionHistory.length ? (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
                    {executionHistory.map(record => (
                        <HistoryRow key={record.id} record={record} t={t} />
                    ))}
                </div>
            ) : (
                <EmptyState message={t('no_execution_history') || 'No executions have been recorded yet.'} />
            )}
        </SectionCard>
        <SectionCard title={t('arbitrage_opportunity_history') || 'Opportunity history'}>
            {opportunityHistory.length ? (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
                    {opportunityHistory.map(entry => (
                        <div key={entry.id} className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                            <div>
                                <p className="text-sm text-emerald-300 uppercase">{t(`strategy_${entry.strategy}`) || entry.strategy}</p>
                                <p className="text-white font-semibold">{new Date(entry.timestamp).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-400">{t('profit_bps') || 'Profit (bps)'}</p>
                                <p className="text-white font-semibold">{entry.profitBps.toFixed(2)}</p>
                                <p className="text-xs text-gray-500 mt-1">{formatCurrency(entry.profitUSDT)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState message={t('no_opportunities_history') || 'No opportunity history captured yet.'} />
            )}
        </SectionCard>
    </div>
);

const ProfitRiskTab: React.FC<{ metrics: ArbitrageMetrics | null; scan: ArbitrageScanResult | null; t: (key: string) => string }> = ({
    metrics,
    scan,
    t,
}) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label={t('net_profit_captured') || 'Net profit'} value={formatCurrency(metrics?.netProfitCapturedUSDT)} />
            <MetricCard label={t('success_rate') || 'Success rate'} value={`${metrics?.successRate?.toFixed(1) ?? '--'}%`} />
            <MetricCard label={t('avg_execution_ms') || 'Avg execution (ms)'} value={metrics?.avgExecutionMs ?? '--'} />
            <MetricCard label={t('risk_alerts') || 'Risk alerts'} value={metrics?.riskAlerts ?? 0} />
        </div>
        <SectionCard title={t('arbitrage_risk_analysis') || 'Risk overview'}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MiniStat label={t('arbitrage_avg_risk_score') || 'Avg risk score'} value={`${scan?.avgRiskScore?.toFixed(1) ?? '--'}%`} />
                <MiniStat label={t('arbitrage_net_profit_potential') || 'Net profit potential'} value={formatCurrency(scan?.netProfitPotentialUSDT)} />
                <MiniStat label={t('opportunity_frequency') || 'Opportunities (24h)'} value={metrics?.opportunityFrequency24h ?? 0} />
            </div>
        </SectionCard>
    </div>
);

const SettingsTab: React.FC<{
    config: ArbitrageConfig;
    disabled: boolean;
    onUpdate: (config: ArbitrageConfig) => void;
    t: (key: string) => string;
}> = ({ config, disabled, onUpdate, t }) => {
    const [draft, setDraft] = useState(config);

    useEffect(() => setDraft(config), [config]);

    const updateDraft = (updater: (prev: ArbitrageConfig) => ArbitrageConfig) => {
        setDraft(prev => updater(prev));
    };

    const parseList = (value: string) => value.split(',').map(item => item.trim().toUpperCase()).filter(Boolean);

    const handleSave = () => onUpdate(draft);

    const integrationDefaults = draft.integrationSettings ?? {
        shareWithRisk: true,
        shareWithPortfolio: false,
        forwardToArtemis: true,
        triggerMode: 'auto' as const,
    };

    return (
        <div className="space-y-6">
            <SectionCard title={t('exchanges') || 'Exchanges'}>
                <div className="space-y-3">
                    {draft.exchanges.map(exchange => (
                        <div key={exchange.id} className="bg-gray-900/40 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-white font-semibold">{exchange.name}</p>
                                    <p className="text-xs text-gray-500">{exchange.markets.join(', ').toUpperCase()}</p>
                                </div>
                                <ToggleField
                                    label=""
                                    checked={exchange.enabled}
                                    onChange={checked =>
                                        updateDraft(prev => ({
                                            ...prev,
                                            exchanges: prev.exchanges.map(ex => (ex.id === exchange.id ? { ...ex, enabled: checked } : ex)),
                                        }))
                                    }
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field
                                    label={t('trading_fee_bps') || 'Trading fee (bps)'}
                                    type="number"
                                    value={exchange.tradingFeeBps.toString()}
                                    onChange={value =>
                                        updateDraft(prev => ({
                                            ...prev,
                                            exchanges: prev.exchanges.map(ex =>
                                                ex.id === exchange.id ? { ...ex, tradingFeeBps: Number(value) || 0 } : ex,
                                            ),
                                        }))
                                    }
                                />
                                <Field
                                    label={t('latency_ms') || 'Latency (ms)'}
                                    type="number"
                                    value={(exchange.latencyMs ?? 0).toString()}
                                    onChange={value =>
                                        updateDraft(prev => ({
                                            ...prev,
                                            exchanges: prev.exchanges.map(ex =>
                                                ex.id === exchange.id ? { ...ex, latencyMs: Number(value) || 0 } : ex,
                                            ),
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            <SectionCard title={t('strategies') || 'Strategies'}>
                <div className="space-y-3">
                    {draft.strategies.map(strategy => (
                        <div key={strategy.type} className="bg-gray-900/40 border border-gray-800 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-white font-semibold">{t(`strategy_${strategy.type}`) || strategy.type}</p>
                                    <p className="text-xs text-gray-500">{t('min_profit_bps') || 'Min profit (bps)'}: {strategy.minProfitBps}</p>
                                </div>
                                <ToggleField
                                    label=""
                                    checked={strategy.enabled}
                                    onChange={checked =>
                                        updateDraft(prev => ({
                                            ...prev,
                                            strategies: prev.strategies.map(s =>
                                                s.type === strategy.type ? { ...s, enabled: checked } : s,
                                            ),
                                        }))
                                    }
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Field
                                    label={t('min_profit_bps') || 'Min profit (bps)'}
                                    type="number"
                                    value={strategy.minProfitBps.toString()}
                                    onChange={value => updateStrategy(draft, strategy, 'minProfitBps', Number(value), updateDraft)}
                                />
                                <Field
                                    label={t('max_slippage_bps') || 'Max slippage (bps)'}
                                    type="number"
                                    value={strategy.maxSlippageBps.toString()}
                                    onChange={value => updateStrategy(draft, strategy, 'maxSlippageBps', Number(value), updateDraft)}
                                />
                                <Field
                                    label={t('max_exposure') || 'Max exposure (USDT)'}
                                    type="number"
                                    value={strategy.maxExposureUSDT.toString()}
                                    onChange={value => updateStrategy(draft, strategy, 'maxExposureUSDT', Number(value), updateDraft)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            <SectionCard title={t('thresholds') || 'Thresholds & filters'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field
                        label={t('opportunity_threshold_bps') || 'Min spread (bps)'}
                        type="number"
                        value={draft.opportunityThresholdBps.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                opportunityThresholdBps: Number(value) || 0,
                            }))
                        }
                    />
                    <Field
                        label={t('detection_sensitivity') || 'Detection sensitivity'}
                        type="select"
                        value={draft.detectionSensitivity}
                        options={[
                            { value: 'conservative', label: t('sensitivity_conservative') || 'Conservative' },
                            { value: 'balanced', label: t('sensitivity_balanced') || 'Balanced' },
                            { value: 'aggressive', label: t('sensitivity_aggressive') || 'Aggressive' },
                        ]}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                detectionSensitivity: value as ArbitrageConfig['detectionSensitivity'],
                            }))
                        }
                    />
                    <Field
                        label={t('symbols_monitored') || 'Monitored symbols'}
                        value={draft.symbols.join(', ')}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                symbols: parseList(value),
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('execution_settings') || 'Execution settings'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ToggleField
                        label={t('auto_execute') || 'Auto execute'}
                        checked={draft.execution.autoExecute}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                execution: { ...prev.execution, autoExecute: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('prefer_speed') || 'Prioritise speed'}
                        checked={draft.execution.preferSpeed}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                execution: { ...prev.execution, preferSpeed: checked },
                            }))
                        }
                    />
                    <Field
                        label={t('capital_per_trade') || 'Capital per trade (USDT)'}
                        type="number"
                        value={draft.execution.capitalPerTradeUSDT.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                execution: { ...prev.execution, capitalPerTradeUSDT: Number(value) || 0 },
                            }))
                        }
                    />
                    <Field
                        label={t('max_concurrent') || 'Max concurrent routes'}
                        type="number"
                        value={draft.execution.maxConcurrent.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                execution: { ...prev.execution, maxConcurrent: Number(value) || 0 },
                            }))
                        }
                    />
                    <Field
                        label={t('max_daily_executions') || 'Max executions per day'}
                        type="number"
                        value={draft.execution.maxDailyExecutions.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                execution: { ...prev.execution, maxDailyExecutions: Number(value) || 0 },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('risk_controls') || 'Risk controls'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field
                        label={t('max_latency') || 'Max latency (ms)'}
                        type="number"
                        value={draft.riskControls.maxLatencyMs.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                riskControls: { ...prev.riskControls, maxLatencyMs: Number(value) || 0 },
                            }))
                        }
                    />
                    <Field
                        label={t('max_transfer_minutes') || 'Max transfer time (min)'}
                        type="number"
                        value={draft.riskControls.maxTransferMinutes.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                riskControls: { ...prev.riskControls, maxTransferMinutes: Number(value) || 0 },
                            }))
                        }
                    />
                    <Field
                        label={t('min_depth_usd') || 'Minimum depth (USD)'}
                        type="number"
                        value={draft.riskControls.minDepthUSD.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                riskControls: { ...prev.riskControls, minDepthUSD: Number(value) || 0 },
                            }))
                        }
                    />
                    <Field
                        label={t('risk_limit_usdt') || 'Risk limit (USDT)'}
                        type="number"
                        value={draft.riskControls.riskLimitUSDT.toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                riskControls: { ...prev.riskControls, riskLimitUSDT: Number(value) || 0 },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('notifications') || 'Notifications'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ToggleField
                        label={t('immediate_notifications') || 'Immediate alerts'}
                        checked={draft.notifications.immediate}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                notifications: { ...prev.notifications, immediate: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('dashboard_only') || 'Dashboard only'}
                        checked={draft.notifications.dashboardOnly}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                notifications: { ...prev.notifications, dashboardOnly: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('channel_email') || 'Email'}
                        checked={draft.notifications.channels.email}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                notifications: {
                                    ...prev.notifications,
                                    channels: { ...prev.notifications.channels, email: checked },
                                },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('channel_telegram') || 'Telegram'}
                        checked={draft.notifications.channels.telegram}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                notifications: {
                                    ...prev.notifications,
                                    channels: { ...prev.notifications.channels, telegram: checked },
                                },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('channel_webhook') || 'Webhook'}
                        checked={draft.notifications.channels.webhook}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                notifications: {
                                    ...prev.notifications,
                                    channels: { ...prev.notifications.channels, webhook: checked },
                                },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('auto_actions') || 'Auto actions'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ToggleField
                        label={t('notify_on_opportunity') || 'Notify on opportunity'}
                        checked={draft.autoActions.notifyOnOpportunity}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                autoActions: { ...prev.autoActions, notifyOnOpportunity: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('simulate_routes') || 'Simulate routes'}
                        checked={draft.autoActions.simulateRoutes}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                autoActions: { ...prev.autoActions, simulateRoutes: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('pause_on_high_latency') || 'Pause on high latency'}
                        checked={draft.autoActions.pauseOnHighLatency}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                autoActions: { ...prev.autoActions, pauseOnHighLatency: checked },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('integration_settings') || 'Integration settings'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ToggleField
                        label={t('share_with_risk') || 'Share with Risk agent'}
                        checked={integrationDefaults.shareWithRisk}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                integrationSettings: { ...integrationDefaults, shareWithRisk: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('share_with_volume') || 'Share with Volume agent'}
                        checked={integrationDefaults.shareWithPortfolio ?? false}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                integrationSettings: { ...integrationDefaults, shareWithPortfolio: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('forward_to_artemis') || 'Forward to Artemis'}
                        checked={integrationDefaults.forwardToArtemis}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                integrationSettings: { ...integrationDefaults, forwardToArtemis: checked },
                            }))
                        }
                    />
                    <Field
                        label={t('trigger_mode') || 'Trigger mode'}
                        type="select"
                        value={integrationDefaults.triggerMode || 'auto'}
                        options={[
                            { value: 'auto', label: t('trigger_auto') || 'Auto' },
                            { value: 'manual', label: t('trigger_manual') || 'Manual' },
                        ]}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                integrationSettings: { ...integrationDefaults, triggerMode: value as 'auto' | 'manual' },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <SectionCard title={t('settlement_settings') || 'Settlement settings'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ToggleField
                        label={t('allow_cross_exchange') || 'Allow cross-exchange'}
                        checked={draft.settlement?.allowCrossExchange ?? false}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                settlement: { ...(prev.settlement ?? { allowCrossExchange: false, trackWithdrawalLimits: false, maxTransfersPerDay: 5 }), allowCrossExchange: checked },
                            }))
                        }
                    />
                    <ToggleField
                        label={t('track_withdraw_limits') || 'Track withdrawal limits'}
                        checked={draft.settlement?.trackWithdrawalLimits ?? false}
                        onChange={checked =>
                            updateDraft(prev => ({
                                ...prev,
                                settlement: { ...(prev.settlement ?? { allowCrossExchange: false, trackWithdrawalLimits: false, maxTransfersPerDay: 5 }), trackWithdrawalLimits: checked },
                            }))
                        }
                    />
                    <Field
                        label={t('max_transfers') || 'Max transfers per day'}
                        type="number"
                        value={(draft.settlement?.maxTransfersPerDay ?? 5).toString()}
                        onChange={value =>
                            updateDraft(prev => ({
                                ...prev,
                                settlement: { ...(prev.settlement ?? { allowCrossExchange: false, trackWithdrawalLimits: false, maxTransfersPerDay: 5 }), maxTransfersPerDay: Number(value) || 0 },
                            }))
                        }
                    />
                </div>
            </SectionCard>

            <div className="flex justify-end gap-3">
                <button
                    onClick={() => setDraft(config)}
                    disabled={disabled}
                    className="px-4 py-2 rounded-lg text-sm bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                >
                    {t('reset_changes') || 'Reset'}
                </button>
                <button
                    onClick={handleSave}
                    disabled={disabled}
                    className="px-5 py-2 rounded-lg text-sm bg-emerald-500 hover:bg-emerald-400 text-white font-semibold disabled:opacity-50"
                >
                    {t('save_changes') || 'Save changes'}
                </button>
            </div>
        </div>
    );
};

const IntegrationTab: React.FC<{ config: ArbitrageConfig; t: (key: string) => string }> = ({ config, t }) => {
    const integration = config.integrationSettings;

    const integrationItems = [
        { label: t('share_with_risk') || 'Share with Risk agent', enabled: integration?.shareWithRisk },
        { label: t('share_with_volume') || 'Share with Volume agent', enabled: integration?.shareWithPortfolio },
        { label: t('forward_to_artemis') || 'Forward to Artemis', enabled: integration?.forwardToArtemis },
    ];

    const dataSources = [
        { label: 'MEXC', enabled: config.exchanges.some(ex => ex.id === 'mexc' && ex.enabled) },
        { label: 'Binance', enabled: config.exchanges.some(ex => ex.id === 'binance' && ex.enabled) },
        { label: 'Gate', enabled: config.exchanges.some(ex => ex.id === 'gate' && ex.enabled) },
    ];

    return (
        <div className="space-y-6">
            <SectionCard title={t('arbitrage_integration_status') || 'Integration status'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {integrationItems.map(item => (
                        <IntegrationRow key={item.label} label={item.label} enabled={item.enabled} />
                    ))}
                </div>
                {integration?.triggerMode && (
                    <p className="text-xs text-gray-400 mt-4">
                        {t('trigger_mode') || 'Trigger mode'}: <span className="text-white">{t(`trigger_${integration.triggerMode}`) || integration.triggerMode}</span>
                    </p>
                )}
            </SectionCard>
            <SectionCard title={t('data_sources') || 'Data sources'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {dataSources.map(source => (
                        <IntegrationRow key={source.label} label={source.label} enabled={source.enabled} />
                    ))}
                </div>
            </SectionCard>
            <SectionCard title={t('notifications') || 'Notifications'}>
                <ul className="space-y-2 text-sm text-gray-300">
                    <li>{config.notifications.immediate ? t('immediate_notifications') : t('dashboard_only')}</li>
                    <li>
                        {t('channels') || 'Channels'}:{' '}
                        {Object.entries(config.notifications.channels)
                            .filter(([, enabled]) => enabled)
                            .map(([channel]) => channel)
                            .join(', ') || t('none') || 'None'}
                    </li>
                </ul>
            </SectionCard>
        </div>
    );
};

const DataPoint: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <span className="text-xs text-gray-400">
        {label}: <span className="text-white font-semibold">{value}</span>
    </span>
);

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        {children}
    </section>
);

const MetricCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
    </div>
);

const MiniStat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div>
        <p className="text-xs text-gray-400 uppercase">{label}</p>
        <p className="text-white font-semibold">{value}</p>
    </div>
);

const OpportunityRow: React.FC<{ opportunity: ArbitrageOpportunity; t: (key: string) => string }> = ({ opportunity, t }) => (
    <div className="flex items-center justify-between">
        <div>
            <p className="text-white font-semibold">{opportunity.path.join(' → ')}</p>
            <p className="text-xs text-gray-500">{new Date(opportunity.timestamp).toLocaleTimeString()}</p>
        </div>
        <div className="flex gap-4 text-sm">
            <MiniStat label={t('profit_bps') || 'Profit (bps)'} value={opportunity.expectedProfitBps.toFixed(2)} />
            <MiniStat label={t('net_profit_captured') || 'Net profit'} value={formatCurrency(opportunity.netProfitUSDT)} />
            <MiniStat label={t('risk_score') || 'Risk score'} value={`${opportunity.riskScore?.toFixed(1) ?? '--'}%`} />
        </div>
    </div>
);

const HistoryRow: React.FC<{ record: ArbitrageExecutionRecord; t: (key: string) => string }> = ({ record, t }) => (
    <div className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-4">
        <div>
            <p className="text-white font-semibold">{t(`strategy_${record.strategy}`) || record.strategy}</p>
            <p className="text-xs text-gray-500">{new Date(record.timestamp).toLocaleString()}</p>
        </div>
        <div className="text-right">
            <p className="text-sm font-semibold text-emerald-400">{formatCurrency(record.profitUSDT)}</p>
            <p className="text-xs text-gray-400">{t(record.status) || record.status}</p>
        </div>
    </div>
);

const Field: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: 'text' | 'number' | 'select';
    options?: Array<{ value: string; label: string }>;
}> = ({ label, value, onChange, type = 'text', options }) => (
    <label className="text-sm text-gray-300 space-y-2">
        <span>{label}</span>
        {type === 'select' ? (
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
            >
                {options?.map(option => (
                    <option key={option.value} value={option.value} className="text-black">
                        {option.label}
                    </option>
                ))}
            </select>
        ) : (
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
            />
        )}
    </label>
);

const ToggleField: React.FC<{ label: string; checked: boolean; onChange: (value: boolean) => void }> = ({ label, checked, onChange }) => (
    <label className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-4 text-sm text-gray-200">
        <span>{label}</span>
        <input type="checkbox" className="accent-emerald-500 w-4 h-4" checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
);

const IntegrationRow: React.FC<{ label: string; enabled?: boolean }> = ({ label, enabled }) => (
    <div className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl p-4">
        <span className="text-sm text-white">{label}</span>
        <InfoBadge label={enabled ? 'ON' : 'OFF'} tone={enabled ? 'success' : 'muted'} />
    </div>
);

const InfoBadge: React.FC<{ label: string; tone?: 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'muted' }> = ({ label, tone = 'info' }) => {
    const tones: Record<typeof tone, string> = {
        success: 'bg-green-500/15 text-green-300',
        danger: 'bg-red-500/15 text-red-300',
        warning: 'bg-yellow-500/15 text-yellow-200',
        info: 'bg-blue-500/15 text-blue-200',
        accent: 'bg-emerald-500/20 text-emerald-200',
        muted: 'bg-gray-600/20 text-gray-300',
    };
    return <span className={`text-xs font-semibold px-3 py-1 rounded-full ${tones[tone]}`}>{label}</span>;
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="text-center text-gray-400 py-10 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">{message}</div>
);

const formatCurrency = (value?: number) => {
    if (value === undefined || Number.isNaN(value)) return '--';
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const updateStrategy = (
    strategy: ArbitrageStrategyConfig,
    field: keyof Pick<ArbitrageStrategyConfig, 'minProfitBps' | 'maxSlippageBps' | 'maxExposureUSDT'>,
    nextValue: number,
    updater: (updater: (prev: ArbitrageConfig) => ArbitrageConfig) => void,
) => {
    updater(prev => ({
        ...prev,
        strategies: prev.strategies.map(s => (s.type === strategy.type ? { ...s, [field]: nextValue } : s)),
    }));
};

// ----------------------------------------------------------------------------- //
// Capabilities Section
// ----------------------------------------------------------------------------- //

const ARBITRAGE_CAPABILITY_KEYS = [
    'arbitrage_capability_detection',
    'arbitrage_capability_net_profit',
    'arbitrage_capability_execution',
    'arbitrage_capability_risk_alerts',
    'arbitrage_capability_history',
    'arbitrage_capability_customization',
    'arbitrage_capability_collaboration',
    'arbitrage_capability_notifications',
] as const;

const CapabilitiesSection: React.FC<{ agent: AIAgent }> = ({ agent }) => {
    const { t } = useLanguage();
    const isArbitrageAgent = agent.id === '6' || agent.role === 'Arbitrage';
    const capabilityItems = isArbitrageAgent
        ? ARBITRAGE_CAPABILITY_KEYS.map(key => {
              const translation = t(key);
              const label = (translation && translation !== key) 
                  ? translation 
                  : key.replace('arbitrage_capability_', '').replace(/_/g, ' ');
              return {
                  key,
                  label,
              };
          })
        : agent.capabilities.map(cap => ({ key: cap, label: cap }));

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('capabilities') || 'Capabilities'}</h3>
            {isArbitrageAgent ? (
                <ul className="space-y-3 text-sm text-gray-300">
                    {capabilityItems.map(item => (
                        <li key={item.key} className="flex gap-3 items-start">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span>{item.label}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {capabilityItems.map(item => (
                        <span key={item.key} className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-sm">
                            {item.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ArbitrageAgentControl;

