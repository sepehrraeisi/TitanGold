import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAgentExecutionGate } from '../../hooks/useAgentExecutionGate.ts';
import type { OnNavigateHandler } from '../../types/navigation.ts';
import { lifecycleLabelKey } from '../../utils/agentStatusProjection.ts';
import * as api from '../../services/api.ts';
import {
    BTN_ACTION_BLUE,
    BTN_WARNING,
    DATAHUB_SHELL,
    FOCUS_RING,
    PrimaryButton,
    SecondaryButton,
    DataHubAlert,
    DataHubSectionHeader,
    MetricCard as DataHubMetricCard,
    StatusPill,
} from './AIManager/tabs/DataHub/dataHubUi.tsx';
import AgentControlShell from './shell/AgentControlShell.tsx';
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

type ArbitragePanelLoadErrorKind = 'permission' | 'auth' | 'network' | 'generic';

type ArbitragePanelLoadError = {
    kind: ArbitragePanelLoadErrorKind;
    status?: number;
};

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

const formatScanTimestamp = (value: string | null | undefined, t: (k: string) => string) => {
    if (!value) return NA(t);
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return NA(t);
    return d.toLocaleString();
};

const mapOverviewScanStatus = (
    scan: ArbitrageScanResult | null,
    metrics: ArbitrageMetrics | null,
): 'never' | 'completed' | 'failed' | 'legacy' | 'unavailable' => {
    if (!scan && !metrics?.scanStats?.lastCompletedAt) return 'never';
    if (!scan && metrics?.scanStats?.lastCompletedAt) return 'unavailable';
    // Backend owns classification — never invent Legacy on the client.
    if (scan?.classification === 'legacy' || scan?.legacy === true) return 'legacy';
    if (scan?.classification === 'partial' || scan?.legacy === null) return 'unavailable';
    const anyScan = scan as (ArbitrageScanResult & { status?: string; error?: boolean; errorMessage?: string | null }) | null;
    if (anyScan?.error || anyScan?.status === 'failed' || anyScan?.errorMessage) return 'failed';
    if (anyScan?.status === 'unavailable') return 'unavailable';
    return 'completed';
};

const humanizeScanStatus = (
    status: ReturnType<typeof mapOverviewScanStatus>,
    t: (k: string) => string,
) => {
    switch (status) {
        case 'never':
            return t('arbitrage_overview_never_scanned') || 'Never scanned';
        case 'failed':
            return t('arbitrage_overview_scan_failed') || 'Scan failed';
        case 'legacy':
            return t('legacy_scan') || 'Legacy scan';
        case 'unavailable':
            return t('arbitrage_overview_data_unavailable') || 'Data unavailable';
        default:
            return t('completed') || 'Completed';
    }
};

const getLoadErrorMessage = (error: ArbitragePanelLoadError | null, t: (k: string) => string) => {
    if (!error) return null;
    if (error.kind === 'permission') {
        return t('arbitrage_overview_permission_limited') || 'You do not have permission to view this overview.';
    }
    if (error.kind === 'auth') {
        return t('arbitrage_overview_auth_required') || 'Authentication is required to load this overview.';
    }
    if (error.kind === 'network') {
        return t('arbitrage_overview_network_error') || 'Network error while loading the overview.';
    }
    return t('arbitrage_overview_error_help') || t('load_failed') || 'Failed to load overview data. Retry when ready.';
};

const mapRejectionReason = (reason: string | null | undefined, t: (k: string) => string) => {
    if (!reason) return NA(t);
    const key = `arbitrage_rejection_${reason.toLowerCase()}`;
    const mapped = t(key);
    if (mapped && mapped !== key) return mapped;
    return reason
        .toLowerCase()
        .split('_')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

const summarizeRejectionReasons = (
    rejectedCandidates: ArbitrageSpreadCandidate[],
    t: (k: string) => string,
): string[] => {
    const counts = new Map<string, number>();
    for (const item of rejectedCandidates) {
        const label = mapRejectionReason(item.rejectionReason, t);
        counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([label, count]) => `${label} (${count})`);
};

const mapLoadError = (error: unknown): ArbitragePanelLoadError => {
    const raw = error as Error & { status?: number };
    const statusMatch = raw?.message?.match?.(/(\d{3})/);
    const status = raw.status || (statusMatch ? Number(statusMatch[1]) : undefined);
    if (status === 401) {
        return { kind: 'auth', status };
    }
    if (status === 403) {
        return { kind: 'permission', status };
    }
    if (raw?.message?.toLowerCase().includes('network') || raw?.name === 'TypeError') {
        return { kind: 'network', status };
    }
    return { kind: 'generic', status };
};

interface ArbitrageAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
    onNavigate?: OnNavigateHandler;
}

const ArbitrageAgentControl: React.FC<ArbitrageAgentControlProps> = ({ agent, onClose, onUpdate, onNavigate }) => {
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
    const [loadError, setLoadError] = useState<ArbitragePanelLoadError | null>(null);
    const scanPendingRef = useRef(false);
    const commandPendingRef = useRef(false);
    const savePendingRef = useRef(false);

    const loadHistory = useCallback(async (page = 1) => {
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
    }, [agent.id]);

    const loadData = useCallback(async () => {
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
            setLoadError(mapLoadError(error));
        } finally {
            setIsLoading(false);
        }
    }, [agent.id, loadHistory]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        if (!onNavigate) return;
        onNavigate({ view: 'ai', agentId: agent.id, agentSection: 'overview' });
        onClose();
    }, [agent.id, onClose, onNavigate]);

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

    if (onNavigate) {
        return null;
    }

    return (
        <AgentControlShell
            agent={agent}
            onClose={onClose}
            closeTestId="arb-close"
            purpose={
                t('arbitrage_agent_desc') ||
                'Analytical MEXC spot bid/ask spread monitor. Does not execute trades.'
            }
            primaryAction={
                <PrimaryButton
                    type="button"
                    data-testid="arb-run-scan"
                    data-variant="primary"
                    onClick={handleRunScan}
                    disabled={isScanning || agent.status !== 'active'}
                    aria-busy={isScanning}
                    aria-label={isScanning ? t('scanning') || 'Scanning...' : t('run_scan') || 'Run Scan'}
                >
                    {isScanning ? t('scanning') || 'Scanning...' : t('run_scan') || 'Run Scan'}
                </PrimaryButton>
            }
            belowHeader={
                <>
                    <StatusBar
                        agent={agent}
                        metrics={metrics}
                        scan={scan}
                        onCommand={handleControlCommand}
                        commandPending={isCommandPending}
                        t={t}
                    />
                    <div className="px-4 sm:px-6 pt-3">
                        <p className="text-xs text-amber-300/90 mb-3">
                            {t('arbitrage_analytical_mode_banner') ||
                                'Analytical mode: MEXC spot bid/ask spread monitor. Not executable multi-leg arbitrage. No live orders.'}
                        </p>
                        <div
                            className="flex flex-nowrap sm:flex-wrap gap-2 pb-3 overflow-x-auto overscroll-x-contain"
                            role="tablist"
                            aria-label={t('arbitrage_tabs') || 'Arbitrage tabs'}
                            data-testid="arb-tablist"
                        >
                            {TAB_ITEMS.map(tab => {
                                const selected = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        id={`arb-tab-${tab.id}`}
                                        aria-selected={selected}
                                        aria-controls={`arb-panel-${tab.id}`}
                                        data-testid={`arb-tab-${tab.id}`}
                                        tabIndex={selected ? 0 : -1}
                                        onClick={() => setActiveTab(tab.id)}
                                        onKeyDown={e => {
                                            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                                            e.preventDefault();
                                            const idx = TAB_ITEMS.findIndex(item => item.id === activeTab);
                                            const delta = e.key === 'ArrowRight' ? 1 : -1;
                                            const next = TAB_ITEMS[(idx + delta + TAB_ITEMS.length) % TAB_ITEMS.length];
                                            setActiveTab(next.id);
                                            requestAnimationFrame(() => {
                                                document.getElementById(`arb-tab-${next.id}`)?.focus();
                                            });
                                        }}
                                        className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap ${FOCUS_RING} ${
                                            selected
                                                ? 'bg-purple-600/20 border-purple-500/60 text-purple-300'
                                                : 'border-slate-600/70 bg-slate-900/70 text-slate-300 hover:border-purple-400/50'
                                        }`}
                                    >
                                        {t(tab.labelKey)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            }
            embedChildren
        >
            <div
                className="p-4 sm:p-6 bg-[#0F151D]"
                role="tabpanel"
                id={`arb-panel-${activeTab}`}
                aria-labelledby={`arb-tab-${activeTab}`}
                data-testid="arb-tab-panel"
            >
                {activeTab === 'overview' ? (
                    <OverviewTab
                        scan={scan}
                        metrics={metrics}
                        spreadCandidates={spreadCandidates}
                        rejectedCandidates={rejectedCandidates}
                        qualified={qualified}
                        isLoading={isLoading}
                        loadError={loadError}
                        onRetry={loadData}
                        onOpenTab={setActiveTab}
                        t={t}
                    />
                ) : isLoading && !scan && !metrics ? (
                    <EmptyState message={t('loading') || 'Loading...'} />
                ) : loadError ? (
                    <EmptyState message={getLoadErrorMessage(loadError, t) || (t('load_failed') || 'Failed to load')} />
                ) : (
                    <>
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
        </AgentControlShell>
    );
};

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
        <div className="px-4 sm:px-6 py-3 border-b border-white/10" data-testid="arb-status-row">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3 min-w-0">
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
    rejectedCandidates: ArbitrageSpreadCandidate[];
    qualified: ArbitrageSpreadCandidate[];
    isLoading: boolean;
    loadError: ArbitragePanelLoadError | null;
    onRetry: () => void;
    onOpenTab: (tab: ArbitrageTab) => void;
    t: (key: string) => string;
}> = ({
    scan,
    metrics,
    spreadCandidates,
    rejectedCandidates,
    qualified,
    isLoading,
    loadError,
    onRetry,
    onOpenTab,
    t,
}) => {
    const scanStatus = mapOverviewScanStatus(scan, metrics);
    const completedAt = scan?.timestamp || metrics?.scanStats?.lastCompletedAt || null;
    const spreadCount = scan?.candidateStats?.spreadCandidates ?? spreadCandidates.length ?? 0;
    const rejectedCount = scan?.candidateStats?.rejected ?? rejectedCandidates.length ?? 0;
    const qualifiedCount = scan?.qualifiedStats?.total ?? qualified.length ?? 0;
    const avgRisk = scan?.riskStats?.averageScore ?? scan?.avgRiskScore ?? metrics?.riskStats?.averageScore ?? null;
    const isNeverScanned = scanStatus === 'never';
    const isFailed = scanStatus === 'failed';
    const isLegacy = scanStatus === 'legacy';
    const hasCandidates = spreadCount > 0;
    const hasRejected = rejectedCount > 0;
    const hasQualified = qualifiedCount > 0;
    const rejectionSummary = summarizeRejectionReasons(rejectedCandidates, t);

    const resultSummary = (() => {
        if (isNeverScanned) {
            return t('arbitrage_overview_never_scanned_help') || 'No analytical scan has completed yet. Run a safe scan to inspect current same-market spread conditions.';
        }
        if (isFailed) {
            return t('arbitrage_overview_scan_failed_help') || 'The latest analytical scan did not complete successfully. Retry or review scan history for failure details.';
        }
        if (!hasCandidates && !hasRejected) {
            return t('arbitrage_overview_no_candidates_help') || 'No positive analytical spread candidate was detected in the latest completed scan.';
        }
        if (!hasCandidates && hasRejected) {
            return t('arbitrage_overview_all_rejected_help') || 'Candidates were detected but all were rejected before qualifying as analytical spread candidates.';
        }
        if (hasCandidates && !hasQualified) {
            return t('arbitrage_overview_no_qualified_help') || 'Positive spread candidates were observed, but none qualify as executable arbitrage opportunities in the current analytical monitor.';
        }
        return t('arbitrage_overview_qualified_detected_help') || 'Qualified opportunities would appear here only for an executable proven strategy. This monitor remains analytical.';
    })();

    // One concise interpretation — do not repeat shell/banner analytical limitations.
    const interpretationMessage =
        t('arbitrage_overview_interpretation_compact') ||
        'No qualified multi-leg opportunity exists in this scan. Execution-backed profit is unavailable.';

    const emptyPreviewMessage = (() => {
        if (isNeverScanned) {
            return t('arbitrage_overview_never_scanned_help') || 'No analytical scan has completed yet.';
        }
        if (hasRejected && !hasCandidates) {
            return t('arbitrage_overview_all_rejected_help') || 'Candidates were detected but all were rejected.';
        }
        return t('arbitrage_no_spread_candidates') || 'No positive analytical spread candidates in the last scan.';
    })();

    const previewItems = [...spreadCandidates.slice(0, 2), ...rejectedCandidates.slice(0, 2)].slice(0, 3);
    const showRisk =
        avgRisk != null &&
        !Number.isNaN(Number(avgRisk)) &&
        (hasCandidates || hasRejected || hasQualified || Number(avgRisk) > 0);

    if (isLoading && !scan && !metrics) {
        return (
            <div className="space-y-6" data-testid="arb-overview-loading">
                <OverviewSkeleton />
            </div>
        );
    }

    if (loadError) {
        const isPermission = loadError.kind === 'permission' || loadError.kind === 'auth';
        return (
            <div className="space-y-6" data-testid={isPermission ? 'arb-overview-permission' : 'arb-overview-error'}>
                <div className={DATAHUB_SHELL}>
                    <DataHubSectionHeader
                        title={
                            isPermission
                                ? t('arbitrage_overview_permission_limited_title') || 'Permission limited'
                                : t('arbitrage_overview_error_title') || 'Overview unavailable'
                        }
                        subtitle={
                            isPermission
                                ? t('arbitrage_overview_permission_limited') || 'You do not have permission to view this overview.'
                                : getLoadErrorMessage(loadError, t) || (t('load_failed') || 'Failed to load')
                        }
                    />
                    <DataHubAlert
                        variant={isPermission ? 'warning' : 'error'}
                        message={getLoadErrorMessage(loadError, t) || (t('load_failed') || 'Failed to load')}
                        onRetry={isPermission ? undefined : onRetry}
                        retryLabel={t('retry') || 'Retry'}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5" data-testid="arb-overview">
            <section className={DATAHUB_SHELL} aria-label={t('arbitrage_overview_latest_scan') || 'Latest Scan'}>
                <DataHubSectionHeader
                    title={t('arbitrage_overview_latest_scan') || 'Latest Scan'}
                    subtitle={resultSummary}
                    actions={
                        <StatusPill
                            label={humanizeScanStatus(scanStatus, t)}
                            variant={isFailed ? 'error' : isNeverScanned || isLegacy ? 'warning' : 'info'}
                        />
                    }
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <DataHubMetricCard
                        label={t('last_scan_at') || 'Last scan'}
                        value={formatScanTimestamp(completedAt, t)}
                        color="blue"
                        valueState={completedAt ? 'loaded' : 'unavailable'}
                    />
                    <DataHubMetricCard
                        label={t('spread_candidates') || 'Spread candidates'}
                        value={spreadCount}
                        color="purple"
                        valueState={spreadCount === 0 ? 'zero' : 'loaded'}
                    />
                    <DataHubMetricCard
                        label={t('rejected_candidates') || 'Rejected candidates'}
                        value={rejectedCount}
                        color="amber"
                        valueState={rejectedCount === 0 ? 'zero' : 'loaded'}
                    />
                    <DataHubMetricCard
                        label={t('qualified_opportunities') || 'Qualified opportunities'}
                        value={qualifiedCount}
                        color="emerald"
                        valueState={qualifiedCount === 0 ? 'zero' : 'loaded'}
                    />
                </div>
                {showRisk ? (
                    <div className="mt-3" data-testid="arb-overview-risk">
                        <OverviewInfoBlock
                            label={t('arbitrage_avg_risk_score') || 'Avg risk score'}
                            value={formatRiskScore(avgRisk, t)}
                        />
                    </div>
                ) : null}
            </section>

            <section className={DATAHUB_SHELL} aria-label={t('arbitrage_overview_interpretation') || 'Interpretation'}>
                <DataHubSectionHeader
                    title={t('arbitrage_overview_interpretation') || 'Interpretation'}
                    subtitle={t('arbitrage_overview_interpretation_subtitle_compact') || 'Outcome context for the latest scan.'}
                />
                <p className="text-sm text-foreground leading-6" data-testid="arb-overview-interpretation">
                    {interpretationMessage}
                </p>
                {rejectionSummary.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-3" data-testid="arb-overview-rejection-summary">
                        {rejectionSummary.map(item => (
                            <StatusPill key={item} label={item} variant="warning" />
                        ))}
                    </div>
                ) : null}
                {isLegacy ? (
                    <p className="text-xs text-muted-foreground mt-3" data-testid="arb-overview-legacy-note">
                        {t('arbitrage_overview_legacy_once') ||
                            'Labeled Legacy by the current scan contract. Available fields only are shown.'}
                    </p>
                ) : null}
            </section>

            <section className={DATAHUB_SHELL} aria-label={t('arbitrage_overview_next_preview') || 'Next step'}>
                <DataHubSectionHeader
                    title={t('arbitrage_overview_next_preview') || 'Next step'}
                    subtitle={t('arbitrage_overview_next_preview_subtitle') || 'Compact preview or guidance. Full lists remain in Candidates.'}
                    actions={
                        <div className="flex flex-wrap gap-2">
                            <SecondaryButton type="button" onClick={() => onOpenTab('candidates')}>
                                {t('arbitrage_overview_review_candidates') || 'Review candidates'}
                            </SecondaryButton>
                            <SecondaryButton type="button" onClick={() => onOpenTab('history')}>
                                {t('arbitrage_overview_view_scan_history') || 'View scan history'}
                            </SecondaryButton>
                            <SecondaryButton type="button" onClick={() => onOpenTab('settings')}>
                                {t('arbitrage_overview_adjust_settings') || 'Review settings'}
                            </SecondaryButton>
                        </div>
                    }
                />
                {previewItems.length ? (
                    <div className="space-y-3" data-testid="arb-overview-preview">
                        {previewItems.map(candidate => (
                            <CompactCandidateRow key={candidate.id} candidate={candidate} t={t} />
                        ))}
                    </div>
                ) : (
                    <OverviewCompactEmpty
                        message={emptyPreviewMessage}
                        actionLabel={t('arbitrage_overview_view_scan_history') || 'View scan history'}
                        onAction={() => onOpenTab('history')}
                    />
                )}
            </section>
        </div>
    );
};

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
                                        {item.classification === 'legacy' || item.legacy === true
                                            ? t('legacy_scan') || 'Legacy scan'
                                            : item.classification === 'partial' || item.legacy === null
                                              ? t('arbitrage_overview_data_unavailable') || 'Data unavailable'
                                              : t('analytical_scan') || 'Analytical scan'}{' '}
                                        ·{' '}
                                        {item.status === 'failed'
                                            ? t('arbitrage_overview_scan_failed') || 'Scan failed'
                                            : item.status === 'unavailable'
                                              ? t('arbitrage_overview_data_unavailable') || 'Data unavailable'
                                              : t('completed') || 'Completed'}
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
                {(candidate as { lifecycle?: string }).lifecycle && (
                    <span className="inline-flex mt-1 rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-slate-200">
                        {t(lifecycleLabelKey((candidate as { lifecycle?: string }).lifecycle))}
                    </span>
                )}
                <p className="text-white font-semibold">
                    {(candidate.path || []).join(' → ') || candidate.symbol || NA(t)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                    {candidate.timestamp ? new Date(candidate.timestamp).toLocaleString() : NA(t)}
                    {candidate.analytical ? ` · ${t('analytical') || 'Analytical'}` : ''}
                </p>
                {showRejection && candidate.rejectionReason && (
                    <p className="text-xs text-rose-300 mt-1">
                        {t('rejection_reason') || 'Rejection'}: {mapRejectionReason(candidate.rejectionReason, t)}
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

const OverviewInfoBlock: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="bg-slate-950/70 border border-white/5 rounded-xl p-3">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground mt-1">{value}</p>
    </div>
);

const OverviewCompactEmpty: React.FC<{
    message: string;
    actionLabel: string;
    onAction: () => void;
}> = ({ message, actionLabel, onAction }) => (
    <div
        className="py-4 px-3 text-center text-xs text-muted-foreground bg-slate-900/60 border border-white/5 rounded-lg space-y-3"
        data-testid="arb-overview-empty"
    >
        <p className="leading-5 max-w-xl mx-auto">{message}</p>
        <SecondaryButton type="button" onClick={onAction}>
            {actionLabel}
        </SecondaryButton>
    </div>
);

const CompactCandidateRow: React.FC<{
    candidate: ArbitrageSpreadCandidate;
    t: (key: string) => string;
}> = ({ candidate, t }) => {
    const isRejected = candidate.classification === 'rejected_candidate';
    return (
        <div className="bg-slate-950/70 border border-white/5 rounded-xl p-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                        label={
                            isRejected
                                ? t('rejected_candidates') || 'Rejected candidates'
                                : t('spread_candidates') || 'Spread candidates'
                        }
                        variant={isRejected ? 'warning' : 'info'}
                    />
                </div>
                <p className="text-sm font-semibold text-foreground mt-2 break-words">
                    {(candidate.path || []).join(' → ') || candidate.symbol || NA(t)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 break-words">
                    {candidate.timestamp ? new Date(candidate.timestamp).toLocaleString() : NA(t)}
                </p>
                {isRejected ? (
                    <p className="text-[11px] text-amber-200 mt-2 break-words">
                        {t('rejection_reason') || 'Rejection'}: {mapRejectionReason(candidate.rejectionReason, t)}
                    </p>
                ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm shrink-0">
                <OverviewInfoBlock
                    label={t('arbitrage_expected_profit') || 'Expected profit'}
                    value={formatBps(candidate.expectedProfitBps, t)}
                />
                <OverviewInfoBlock
                    label={t('risk_score') || 'Risk score'}
                    value={formatRiskScore(candidate.riskScore, t)}
                />
            </div>
        </div>
    );
};

const OverviewSkeleton: React.FC = () => (
    <>
        {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className={DATAHUB_SHELL}>
                <div className="animate-pulse space-y-4">
                    <div className="h-5 w-40 rounded bg-slate-900/70" />
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        {Array.from({ length: 4 }).map((__, metricIdx) => (
                            <div key={metricIdx} className="rounded-xl border border-white/5 bg-slate-950/70 p-4 space-y-3">
                                <div className="h-3 w-24 rounded bg-slate-900/70" />
                                <div className="h-6 w-20 rounded bg-slate-900/70" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        ))}
    </>
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
