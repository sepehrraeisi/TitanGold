import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAgentExecutionGate } from '../../hooks/useAgentExecutionGate.ts';
import * as api from '../../services/api.ts';
import {
    BTN_ACTION_BLUE,
    BTN_WARNING,
    FOCUS_RING,
    PrimaryButton,
    SecondaryButton,
} from './AIManager/tabs/DataHub/dataHubUi.tsx';
import type {
    AIAgent,
    ArbitrageConfig,
    ArbitrageMetrics,
    ArbitrageScanHistoryItem,
    ArbitrageScanResult,
    ArbitrageSpreadCandidate,
    ArbitrageStrategyConfig,
} from '../../types.ts';

const btnClass = (base: string) => `${base} ${FOCUS_RING} inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors`.trim();

type ArbitrageTab = 'overview' | 'candidates' | 'history' | 'profitRisk' | 'settings' | 'integration';

const TAB_ITEMS: Array<{ id: ArbitrageTab; labelKey: string }> = [
    { id: 'overview', labelKey: 'tab_overview' },
    { id: 'candidates', labelKey: 'tab_arbitrage_candidates' },
    { id: 'history', labelKey: 'tab_scan_history' },
    { id: 'profitRisk', labelKey: 'tab_profit_risk' },
    { id: 'settings', labelKey: 'tab_settings' },
    { id: 'integration', labelKey: 'tab_integration' },
];

const NA = (t: (k: string) => string) => t('not_available') || 'N/A';

const formatCurrency = (value: number | null | undefined, t: (k: string) => string) => {
    if (value == null || Number.isNaN(Number(value))) return NA(t);
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
    }).format(Number(value));
};

const formatRiskScore = (value: number | null | undefined, t: (k: string) => string) => {
    if (value == null || Number.isNaN(Number(value))) return NA(t);
    return `${Number(value).toFixed(0)} / 100`;
};

const formatBps = (value: number | null | undefined, t: (k: string) => string) => {
    if (value == null || Number.isNaN(Number(value))) return NA(t);
    return `${Number(value).toFixed(2)} bps`;
};

const strategyLabel = (item: { strategy?: string; strategyLabelKey?: string }, t: (k: string) => string) => {
    const key = item.strategyLabelKey || `strategy_${item.strategy || 'mexc_spot_spread_monitor'}`;
    const mapped =
        item.strategy === 'spot' || item.strategy === 'mexc_spot_spread_monitor'
            ? t('strategy_mexc_spot_spread_monitor')
            : t(key);
    if (!mapped || mapped === key || mapped.startsWith('strategy_')) {
        return t('strategy_mexc_spot_spread_monitor') || 'MEXC spot spread monitor';
    }
    return mapped;
};

interface ArbitrageAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

const ArbitrageAgentControl: React.FC<ArbitrageAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    const { guardExecution } = useAgentExecutionGate();
    const [activeTab, setActiveTab] = useState<ArbitrageTab>('overview');
    const [config, setConfig] = useState<ArbitrageConfig | null>(agent.arbitrageConfig || null);
    const [metrics, setMetrics] = useState<ArbitrageMetrics | null>(agent.arbitrageMetrics || null);
    const [scan, setScan] = useState<ArbitrageScanResult | null>(agent.lastArbitrageScan || null);
    const [historyItems, setHistoryItems] = useState<ArbitrageScanHistoryItem[]>([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isCommandPending, setIsCommandPending] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const scanPendingRef = useRef(false);
    const commandPendingRef = useRef(false);
    const savePendingRef = useRef(false);

    const loadHistory = async (page = 1) => {
        setHistoryLoading(true);
        try {
            const data = await api.fetchArbitrageScanHistory(agent.id, { page, pageSize: 10 });
            setHistoryItems(data.items);
            setHistoryPage(data.pagination.page);
            setHistoryTotal(data.pagination.total);
        } catch (e) {
            console.error('Failed to load scan history', e);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setLoadError(null);
            try {
                const data = await api.fetchArbitrageAgentData(agent.id);
                if (data.config) setConfig(data.config);
                if (data.metrics) setMetrics(data.metrics);
                if (data.lastScan) setScan(data.lastScan);
                await loadHistory(1);
            } catch (error) {
                console.error('Failed to load arbitrage agent data:', error);
                setLoadError(t('load_failed') || 'Failed to load agent data');
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agent.id]);

    const handleRunScan = async () => {
        if (scanPendingRef.current || isScanning) return;
        if (!guardExecution()) return;
        scanPendingRef.current = true;
        setIsScanning(true);
        try {
            const result = await api.runArbitrageAnalysis(agent.id);
            setScan(result);
            const agents = await api.fetchAIAgents();
            const updatedAgent = agents.find(a => a.id === agent.id);
            if (updatedAgent) {
                setMetrics(updatedAgent.arbitrageMetrics || {
                    ...metrics!,
                    totalScans: updatedAgent.decisions ?? (metrics?.totalScans || 0) + 1,
                });
                onUpdate(updatedAgent);
            } else {
                const refreshed = await api.fetchArbitrageAgentData(agent.id);
                if (refreshed.metrics) setMetrics(refreshed.metrics);
            }
            await loadHistory(1);
        } catch (error) {
            console.error('Failed to run arbitrage scan:', error);
            alert(t('analysis_failed') || 'Scan failed');
        } finally {
            scanPendingRef.current = false;
            setIsScanning(false);
        }
    };

    const handleUpdateConfig = async (updatedConfig: ArbitrageConfig) => {
        if (savePendingRef.current) return;
        savePendingRef.current = true;
        setIsLoading(true);
        try {
            await api.updateArbitrageConfig(agent.id, updatedConfig);
            setConfig(updatedConfig);
            alert(t('config_updated') || 'Configuration updated successfully');
        } catch (error) {
            console.error('Failed to update arbitrage config:', error);
            alert(t('update_failed') || 'Update failed');
        } finally {
            savePendingRef.current = false;
            setIsLoading(false);
        }
    };

    const handleControlCommand = async (command: string) => {
        if (commandPendingRef.current || isCommandPending) return;
        commandPendingRef.current = true;
        setIsCommandPending(true);
        try {
            await api.sendAgentControlCommand(agent.id, command);
            const agents = await api.fetchAIAgents();
            const updatedAgent = agents.find(a => a.id === agent.id);
            if (updatedAgent) onUpdate(updatedAgent);
        } catch (error) {
            console.error('Failed to execute command:', error);
            alert(t('command_failed') || 'Command failed');
        } finally {
            commandPendingRef.current = false;
            setIsCommandPending(false);
        }
    };

    const spreadCandidates = useMemo(
        () => scan?.candidates ?? [],
        [scan],
    );
    const rejectedCandidates = useMemo(
        () => scan?.rejectedCandidates ?? [],
        [scan],
    );
    const qualified = useMemo(
        () => scan?.qualifiedOpportunities ?? [],
        [scan],
    );

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#10141A] border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
                <Header agent={agent} t={t} onRunScan={handleRunScan} onClose={onClose} isScanning={isScanning} />
                <StatusBar
                    agent={agent}
                    metrics={metrics}
                    scan={scan}
                    onCommand={handleControlCommand}
                    commandPending={isCommandPending}
                    t={t}
                />

                <div className="px-6 pt-3 border-b border-gray-800 bg-[#0B1017]">
                    <p className="text-xs text-amber-300/90 mb-3">
                        {t('arbitrage_analytical_mode_banner') ||
                            'Analytical mode: MEXC spot bid/ask spread monitor. Not executable multi-leg arbitrage. No live orders.'}
                    </p>
                    <div className="flex flex-wrap gap-2 pb-3">
                        {TAB_ITEMS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                    activeTab === tab.id
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                                }`}
                            >
                                {t(tab.labelKey)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-[#0F151D]">
                    {isLoading && !scan && !metrics ? (
                        <EmptyState message={t('loading') || 'Loading...'} />
                    ) : loadError ? (
                        <EmptyState message={loadError} />
                    ) : (
                        <>
                            {activeTab === 'overview' && (
                                <OverviewTab
                                    scan={scan}
                                    metrics={metrics}
                                    spreadCandidates={spreadCandidates}
                                    t={t}
                                />
                            )}
                            {activeTab === 'candidates' && (
                                <CandidatesTab
                                    spreadCandidates={spreadCandidates}
                                    rejectedCandidates={rejectedCandidates}
                                    qualified={qualified}
                                    t={t}
                                />
                            )}
                            {activeTab === 'history' && (
                                <HistoryTab
                                    items={historyItems}
                                    total={historyTotal}
                                    page={historyPage}
                                    loading={historyLoading}
                                    onPage={loadHistory}
                                    t={t}
                                />
                            )}
                            {activeTab === 'profitRisk' && <ProfitRiskTab metrics={metrics} scan={scan} t={t} />}
                            {activeTab === 'settings' && config && (
                                <SettingsTab config={config} disabled={isLoading} onUpdate={handleUpdateConfig} t={t} />
                            )}
                            {activeTab === 'integration' && config && <IntegrationTab config={config} t={t} />}
                        </>
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between px-4 sm:px-6 py-5 border-b border-white/10 bg-[#0B1017]">
        <div className="min-w-0">
            <h2 className="text-2xl font-bold text-white">{agent.name}</h2>
            <p className="text-sm text-gray-400 mt-1">
                {t('arbitrage_agent_desc') ||
                    'Analytical MEXC spot bid/ask spread monitor. Does not execute trades.'}
            </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
            <PrimaryButton
                type="button"
                data-testid="arb-run-scan"
                data-variant="primary"
                onClick={onRunScan}
                disabled={isScanning || agent.status !== 'active'}
                aria-busy={isScanning}
                aria-label={isScanning ? t('scanning') || 'Scanning...' : t('run_scan') || 'Run Scan'}
            >
                {isScanning ? t('scanning') || 'Scanning...' : t('run_scan') || 'Run Scan'}
            </PrimaryButton>
            <SecondaryButton
                type="button"
                data-testid="arb-close"
                data-variant="neutral"
                onClick={onClose}
                aria-label={t('close') || 'Close'}
            >
                {t('close') || 'Close'}
            </SecondaryButton>
        </div>
    </div>
);

const StatusBar: React.FC<{
    agent: AIAgent;
    metrics: ArbitrageMetrics | null;
    scan: ArbitrageScanResult | null;
    onCommand: (command: string) => void;
    commandPending: boolean;
    t: (key: string) => string;
}> = ({ agent, metrics, scan, onCommand, commandPending, t }) => {
    const best = metrics?.qualifiedStats?.bestProfitBps ?? metrics?.bestProfitBps;
    const avgRisk = scan?.riskStats?.averageScore ?? scan?.avgRiskScore ?? metrics?.riskStats?.averageScore;
    return (
        <div className="px-4 sm:px-6 py-3 border-b border-white/10 bg-[#0B1017]">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <span
                        className={`px-3 py-1 rounded-full text-[10px] font-medium border ${
                            agent.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40'
                                : 'bg-slate-700 text-slate-300 border-slate-600'
                        }`}
                    >
                        {t(agent.status)}
                    </span>
                    <DataPoint label={t('total_scans') || 'Total scans'} value={metrics?.totalScans ?? 0} />
                    <DataPoint
                        label={t('best_qualified_profit_bps') || 'Best qualified profit (bps)'}
                        value={formatBps(best, t)}
                    />
                    <DataPoint
                        label={t('arbitrage_avg_risk_score') || 'Avg risk score'}
                        value={formatRiskScore(avgRisk, t)}
                    />
                    <DataPoint
                        label={t('qualified_opportunities') || 'Qualified opportunities'}
                        value={metrics?.qualifiedStats?.total ?? 0}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {agent.status === 'active' ? (
                        <button
                            type="button"
                            data-testid="arb-pause"
                            data-variant="warning"
                            onClick={() => onCommand('pause')}
                            disabled={commandPending}
                            aria-busy={commandPending}
                            aria-label={t('pause') || 'Pause'}
                            className={btnClass(BTN_WARNING)}
                        >
                            {commandPending ? t('loading') || 'Loading...' : t('pause') || 'Pause'}
                        </button>
                    ) : (
                        <button
                            type="button"
                            data-testid="arb-start"
                            data-variant="action-blue"
                            onClick={() => onCommand('start')}
                            disabled={commandPending}
                            aria-busy={commandPending}
                            aria-label={t('start') || 'Start'}
                            className={btnClass(BTN_ACTION_BLUE)}
                        >
                            {commandPending ? t('loading') || 'Loading...' : t('start') || 'Start'}
                        </button>
                    )}
                    <button
                        type="button"
                        data-testid="arb-restart"
                        data-variant="action-blue"
                        onClick={() => onCommand('restart')}
                        disabled={commandPending}
                        aria-busy={commandPending}
                        aria-label={t('restart') || 'Restart'}
                        className={btnClass(BTN_ACTION_BLUE)}
                    >
                        {commandPending ? t('loading') || 'Loading...' : t('restart') || 'Restart'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const OverviewTab: React.FC<{
    scan: ArbitrageScanResult | null;
    metrics: ArbitrageMetrics | null;
    spreadCandidates: ArbitrageSpreadCandidate[];
    t: (key: string) => string;
}> = ({ scan, metrics, spreadCandidates, t }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
                label={t('last_scan_at') || 'Last scan'}
                value={
                    scan?.timestamp
                        ? new Date(scan.timestamp).toLocaleString()
                        : metrics?.scanStats?.lastCompletedAt
                          ? new Date(metrics.scanStats.lastCompletedAt).toLocaleString()
                          : NA(t)
                }
            />
            <MetricCard
                label={t('spread_candidates') || 'Spread candidates'}
                value={scan?.candidateStats?.spreadCandidates ?? spreadCandidates.length}
            />
            <MetricCard
                label={t('rejected_candidates') || 'Rejected candidates'}
                value={scan?.candidateStats?.rejected ?? 0}
            />
            <MetricCard
                label={t('qualified_opportunities') || 'Qualified opportunities'}
                value={scan?.qualifiedStats?.total ?? 0}
            />
        </div>

        <SectionCard title={t('arbitrage_classification_note') || 'Classification'}>
            <p className="text-sm text-gray-300">
                {t('arbitrage_no_qualified_reason') ||
                    'Same-market bid/ask spreads are analytical only. Qualified arbitrage opportunities require a proven multi-leg executable strategy (not available in this slice).'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <MiniStat label={t('total_scans') || 'Total scans'} value={metrics?.totalScans ?? 0} />
                <MiniStat
                    label={t('best_qualified_profit_bps') || 'Best qualified profit'}
                    value={formatBps(metrics?.qualifiedStats?.bestProfitBps, t)}
                />
                <MiniStat
                    label={t('execution_support') || 'Execution'}
                    value={t('execution_unsupported') || 'Not supported'}
                />
            </div>
        </SectionCard>

        <SectionCard title={t('arbitrage_recent_spread_candidates') || 'Recent spread candidates'}>
            {spreadCandidates.length ? (
                <div className="space-y-3">
                    {spreadCandidates.slice(0, 5).map(c => (
                        <CandidateRow key={c.id} candidate={c} t={t} />
                    ))}
                </div>
            ) : (
                <EmptyState
                    message={t('arbitrage_no_spread_candidates') || 'No positive analytical spread candidates in the last scan.'}
                />
            )}
        </SectionCard>
    </div>
);

const CandidatesTab: React.FC<{
    spreadCandidates: ArbitrageSpreadCandidate[];
    rejectedCandidates: ArbitrageSpreadCandidate[];
    qualified: ArbitrageSpreadCandidate[];
    t: (key: string) => string;
}> = ({ spreadCandidates, rejectedCandidates, qualified, t }) => (
    <div className="space-y-6">
        <SectionCard title={t('qualified_opportunities') || 'Qualified opportunities'}>
            {qualified.length ? (
                qualified.map(c => <CandidateRow key={c.id} candidate={c} t={t} />)
            ) : (
                <EmptyState
                    message={
                        t('arbitrage_qualified_empty') ||
                        'No qualified arbitrage opportunities. Current monitor does not produce executable multi-leg routes.'
                    }
                />
            )}
        </SectionCard>
        <SectionCard title={t('spread_candidates') || 'Spread candidates'}>
            {spreadCandidates.length ? (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2">
                    {spreadCandidates.map(c => (
                        <CandidateRow key={c.id} candidate={c} t={t} />
                    ))}
                </div>
            ) : (
                <EmptyState message={t('arbitrage_no_spread_candidates') || 'No spread candidates.'} />
            )}
        </SectionCard>
        <SectionCard title={t('rejected_candidates') || 'Rejected candidates'}>
            {rejectedCandidates.length ? (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2">
                    {rejectedCandidates.map(c => (
                        <CandidateRow key={c.id} candidate={c} t={t} showRejection />
                    ))}
                </div>
            ) : (
                <EmptyState message={t('arbitrage_no_rejected') || 'No rejected candidates in the last scan.'} />
            )}
        </SectionCard>
    </div>
);

const HistoryTab: React.FC<{
    items: ArbitrageScanHistoryItem[];
    total: number;
    page: number;
    loading: boolean;
    onPage: (page: number) => void;
    t: (key: string) => string;
}> = ({ items, total, page, loading, onPage, t }) => (
    <div className="space-y-4">
        <SectionCard title={t('tab_scan_history') || 'Scan history'}>
            <p className="text-xs text-gray-400 mb-3">
                {t('arbitrage_scan_history_source') || 'Canonical source: ai_decisions (arbitrage_scan).'}{' '}
                {t('total_scans') || 'Total scans'}: {total}
            </p>
            <div className="mb-4 p-3 rounded-lg border border-gray-700 bg-gray-900/50 text-sm text-gray-300">
                {t('execution_history_unavailable') ||
                    'Execution history is not supported for this agent. No realized or captured profit is available.'}
            </div>
            {loading ? (
                <EmptyState message={t('loading') || 'Loading...'} />
            ) : items.length ? (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
                    {items.map(item => (
                        <div key={item.id} className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                            <div className="flex flex-wrap justify-between gap-3">
                                <div>
                                    <p className="text-white font-semibold">
                                        {item.completedAt ? new Date(item.completedAt).toLocaleString() : NA(t)}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {item.legacy
                                            ? t('legacy_scan') || 'Legacy scan'
                                            : t('analytical_scan') || 'Analytical scan'}{' '}
                                        · {item.status}
                                        {item.dryRun ? ` · ${t('dry_run') || 'Dry Run'}` : ''}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm">
                                    <MiniStat label={t('spread_candidates') || 'Spread'} value={item.candidateStats.spreadCandidates} />
                                    <MiniStat label={t('rejected_candidates') || 'Rejected'} value={item.candidateStats.rejected} />
                                    <MiniStat label={t('qualified_opportunities') || 'Qualified'} value={item.candidateStats.qualified} />
                                    <MiniStat
                                        label={t('arbitrage_avg_risk_score') || 'Risk'}
                                        value={formatRiskScore(item.riskStats.averageScore, t)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState message={t('arbitrage_no_scan_history') || 'No scan history yet.'} />
            )}
            {total > 10 && (
                <div className="flex gap-2 mt-4">
                    <button
                        disabled={page <= 1 || loading}
                        onClick={() => onPage(page - 1)}
                        className="px-3 py-1.5 text-xs rounded bg-gray-800 text-gray-200 disabled:opacity-40"
                    >
                        {t('previous') || 'Previous'}
                    </button>
                    <button
                        disabled={page * 10 >= total || loading}
                        onClick={() => onPage(page + 1)}
                        className="px-3 py-1.5 text-xs rounded bg-gray-800 text-gray-200 disabled:opacity-40"
                    >
                        {t('next') || 'Next'}
                    </button>
                </div>
            )}
        </SectionCard>
    </div>
);

const ProfitRiskTab: React.FC<{
    metrics: ArbitrageMetrics | null;
    scan: ArbitrageScanResult | null;
    t: (key: string) => string;
}> = ({ metrics, scan, t }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
                label={t('qualified_expected_net_profit') || 'Qualified expected net profit'}
                value={formatCurrency(metrics?.qualifiedStats?.expectedNetProfitUSDT, t)}
            />
            <MetricCard
                label={t('best_qualified_profit_bps') || 'Best qualified profit'}
                value={formatBps(metrics?.qualifiedStats?.bestProfitBps, t)}
            />
            <MetricCard
                label={t('arbitrage_avg_risk_score') || 'Avg risk score'}
                value={formatRiskScore(scan?.avgRiskScore ?? metrics?.riskStats?.averageScore, t)}
            />
            <MetricCard label={t('risk_alerts') || 'Risk alerts'} value={metrics?.riskAlerts ?? 0} />
        </div>
        <SectionCard title={t('arbitrage_risk_analysis') || 'Risk overview'}>
            <p className="text-sm text-gray-400">
                {t('arbitrage_risk_score_help') ||
                    'Risk score is a 0–100 analytical score (lower is better). It is not a percentage probability.'}
            </p>
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

    const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(config), [draft, config]);
    const spotStrategy = draft.strategies?.find(s => s.type === 'spot' || s.type === 'mexc_spot_spread_monitor');

    const updateSpot = (field: keyof ArbitrageStrategyConfig, value: number) => {
        setDraft(prev => ({
            ...prev,
            strategies: (prev.strategies || []).map(s =>
                s.type === 'spot' || s.type === 'mexc_spot_spread_monitor' ? { ...s, [field]: value } : s,
            ),
        }));
    };

    const handleSave = () => {
        if (disabled || !isDirty) return;
        onUpdate(draft);
    };

    const handleReset = () => {
        if (disabled || !isDirty) return;
        setDraft(config);
    };

    return (
        <div className="space-y-6">
            <SectionCard title={t('arbitrage_active_monitor') || 'Active monitor'}>
                <p className="text-sm text-emerald-300 mb-3">
                    {t('strategy_mexc_spot_spread_monitor') || 'MEXC spot spread monitor'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="text-xs text-gray-400 block">
                        {t('min_profit_bps') || 'Min profit (bps)'}
                        <input
                            type="number"
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                            value={spotStrategy?.minProfitBps ?? draft.opportunityThresholdBps ?? 20}
                            onChange={e => updateSpot('minProfitBps', Number(e.target.value))}
                            disabled={disabled}
                        />
                    </label>
                    <label className="text-xs text-gray-400 block">
                        {t('monitored_symbols') || 'Monitored symbols'}
                        <input
                            type="text"
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                            value={(draft.symbols || []).join(', ')}
                            onChange={e =>
                                setDraft(prev => ({
                                    ...prev,
                                    symbols: e.target.value
                                        .split(',')
                                        .map(s => s.trim().toUpperCase())
                                        .filter(Boolean),
                                }))
                            }
                            disabled={disabled}
                        />
                    </label>
                    <label className="text-xs text-gray-400 block">
                        {t('opportunity_threshold_bps') || 'Opportunity threshold (bps)'}
                        <input
                            type="number"
                            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                            value={draft.opportunityThresholdBps ?? 20}
                            onChange={e =>
                                setDraft(prev => ({ ...prev, opportunityThresholdBps: Number(e.target.value) }))
                            }
                            disabled={disabled}
                        />
                    </label>
                </div>
            </SectionCard>

            <SectionCard title={t('unsupported_capabilities') || 'Unsupported capabilities'}>
                <ul className="text-sm text-gray-400 space-y-2">
                    <li>{t('arbitrage_unsupported_triangle') || 'Triangular arbitrage — Not available'}</li>
                    <li>{t('arbitrage_unsupported_cross') || 'Cross-exchange arbitrage — Not available'}</li>
                    <li>{t('arbitrage_unsupported_futures') || 'MEXC futures scanning — Not available'}</li>
                    <li>{t('arbitrage_unsupported_auto_execute') || 'Auto Execute — Not supported (agent is not live-capable)'}</li>
                    <li>{t('arbitrage_unsupported_settlement') || 'Settlement / transfers — Not available'}</li>
                    <li>
                        {t('arbitrage_auto_execute_stored') || 'Stored Auto Execute preference'}:{' '}
                        {draft.execution?.autoExecuteStoredPreference || draft.execution?.autoExecute
                            ? t('stored_true_not_operational') || 'true (not operational)'
                            : 'false'}
                    </li>
                </ul>
            </SectionCard>

            <SectionCard title={t('notifications') || 'Notification preferences'}>
                <p className="text-xs text-amber-300 mb-3">
                    {t('arbitrage_notification_preference_note') ||
                        'These are preferences only. Delivery capability and delivery results are separate. No real notifications are sent from this panel in Demo + Emergency Stop.'}
                </p>
                <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                        type="checkbox"
                        checked={Boolean(draft.autoActions?.notifyOnOpportunity)}
                        onChange={e =>
                            setDraft(prev => ({
                                ...prev,
                                autoActions: { ...prev.autoActions, notifyOnOpportunity: e.target.checked },
                            }))
                        }
                        disabled={disabled}
                    />
                    {t('notify_on_opportunity') || 'Notify on opportunity (preference)'}
                </label>
            </SectionCard>

            <div className="flex flex-wrap items-center gap-2 pt-1">
                <SecondaryButton
                    type="button"
                    data-testid="arb-reset"
                    data-variant="neutral"
                    onClick={handleReset}
                    disabled={disabled || !isDirty}
                    aria-label={t('reset') || 'Reset'}
                >
                    {t('reset') || 'Reset'}
                </SecondaryButton>
                <PrimaryButton
                    type="button"
                    data-testid="arb-save-changes"
                    data-variant="primary"
                    onClick={handleSave}
                    disabled={disabled || !isDirty}
                    aria-busy={disabled}
                    aria-label={
                        disabled
                            ? t('saving') || 'Saving...'
                            : t('save_changes') || 'Save changes'
                    }
                >
                    {disabled ? t('saving') || 'Saving...' : t('save_changes') || 'Save changes'}
                </PrimaryButton>
            </div>
        </div>
    );
};

const IntegrationTab: React.FC<{ config: ArbitrageConfig; t: (key: string) => string }> = ({ config, t }) => (
    <SectionCard title={t('tab_integration') || 'Integrations'}>
        <div className="space-y-3 text-sm text-gray-300">
            <p>
                <span className="text-gray-500">{t('data_sources') || 'Data sources'}:</span> MEXC spot (public market
                data)
            </p>
            <p className="text-amber-300">
                {t('arbitrage_integration_truth') ||
                    'Binance, Gate, futures, settlement, and live execution integrations are not active for this agent.'}
            </p>
            <p>
                {t('execution_support') || 'Execution'}: {t('execution_unsupported') || 'Not supported'}
            </p>
            <p>
                {t('share_with_risk') || 'Share with Risk Agent'}:{' '}
                {config.integrationSettings?.shareWithRisk ? t('preference_only') || 'Preference only' : 'off'}
            </p>
        </div>
    </SectionCard>
);

const CandidateRow: React.FC<{
    candidate: ArbitrageSpreadCandidate;
    t: (key: string) => string;
    showRejection?: boolean;
}> = ({ candidate, t, showRejection }) => (
    <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
                <p className="text-xs uppercase text-emerald-400">{strategyLabel(candidate, t)}</p>
                <p className="text-white font-semibold">
                    {(candidate.path || []).join(' → ') || candidate.symbol || NA(t)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                    {candidate.timestamp ? new Date(candidate.timestamp).toLocaleString() : NA(t)}
                    {candidate.analytical ? ` · ${t('analytical') || 'Analytical'}` : ''}
                </p>
                {showRejection && candidate.rejectionReason && (
                    <p className="text-xs text-rose-300 mt-1">
                        {t('rejection_reason') || 'Rejection'}: {candidate.rejectionReason}
                    </p>
                )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
                <MiniStat
                    label={t('arbitrage_expected_profit') || 'Expected profit'}
                    value={formatBps(candidate.expectedProfitBps, t)}
                />
                <MiniStat
                    label={t('arbitrage_net_profit') || 'Expected net'}
                    value={formatCurrency(candidate.netProfitUSDT, t)}
                />
                <MiniStat label={t('risk_score') || 'Risk score'} value={formatRiskScore(candidate.riskScore, t)} />
            </div>
        </div>
    </div>
);

const DataPoint: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="text-xs">
        <span className="text-gray-500">{label}: </span>
        <span className="text-gray-200 font-semibold">{value}</span>
    </div>
);

const MetricCard: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl text-white font-semibold mt-2">{value}</p>
    </div>
);

const MiniStat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <p className="text-[10px] uppercase text-gray-500">{label}</p>
        <p className="text-sm text-white font-medium">{value}</p>
    </div>
);

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-[#10141A] border border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
        {children}
    </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-800 rounded-xl">{message}</div>
);

export default ArbitrageAgentControl;
