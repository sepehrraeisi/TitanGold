import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAgentExecutionGate } from '../../hooks/useAgentExecutionGate.ts';
import type { OnNavigateHandler, ArbitrageAgentSection } from '../../types/navigation.ts';
import type { AIAgent, ArbitrageSpreadCandidate } from '../../types.ts';
import * as api from '../../services/api.ts';
import type {
    ArbitrageCoreCandidatesResponse,
    ArbitrageCoreIntegrations,
    ArbitrageCoreOverview,
    ArbitrageCoreRunDetail,
    ArbitrageCoreRunSummary,
    ArbitrageCoreSettings,
    ArbitrageMonitoringState,
} from '../../services/api.ts';
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

const btnClass = (base: string) =>
    `${base} ${FOCUS_RING} inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors`.trim();

type WorkspaceTab = ArbitrageAgentSection;

const TAB_ITEMS: Array<{ id: WorkspaceTab; labelKey: string }> = [
    { id: 'overview', labelKey: 'tab_overview' },
    { id: 'candidates', labelKey: 'tab_arbitrage_candidates' },
    { id: 'history', labelKey: 'tab_scan_history' },
    { id: 'profitRisk', labelKey: 'tab_profit_risk' },
    { id: 'settings', labelKey: 'tab_settings' },
    { id: 'integration', labelKey: 'tab_integration' },
];

const NA = (t: (k: string) => string) => t('not_available') || 'N/A';

const formatBps = (value: number | null | undefined, t: (k: string) => string) => {
    if (value == null || Number.isNaN(Number(value))) return NA(t);
    return `${Number(value).toFixed(2)} bps`;
};

const formatRiskScore = (value: number | null | undefined, t: (k: string) => string) => {
    if (value == null || Number.isNaN(Number(value))) return NA(t);
    return `${Number(value).toFixed(0)} / 100`;
};

const formatTimestamp = (value: string | null | undefined, t: (k: string) => string) => {
    if (!value) return NA(t);
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return NA(t);
    return d.toLocaleString();
};

export interface ArbitrageWorkspaceProps {
    agent: AIAgent;
    initialSection?: ArbitrageAgentSection;
    initialRunId?: string;
    onBack: () => void;
    onNavigate?: OnNavigateHandler;
    onUpdate: (agent: AIAgent) => void;
}

const ArbitrageWorkspace: React.FC<ArbitrageWorkspaceProps> = ({
    agent,
    initialSection = 'overview',
    initialRunId,
    onBack,
    onNavigate,
    onUpdate,
}) => {
    const { t } = useLanguage();
    const { guardExecution } = useAgentExecutionGate();
    const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialSection);
    const [selectedRunId, setSelectedRunId] = useState<string | undefined>(initialRunId);
    const [overview, setOverview] = useState<ArbitrageCoreOverview | null>(null);
    const [candidates, setCandidates] = useState<ArbitrageCoreCandidatesResponse | null>(null);
    const [runs, setRuns] = useState<ArbitrageCoreRunSummary[]>([]);
    const [runsPage, setRunsPage] = useState(1);
    const [runsTotal, setRunsTotal] = useState(0);
    const [runDetail, setRunDetail] = useState<ArbitrageCoreRunDetail | null>(null);
    const [integrations, setIntegrations] = useState<ArbitrageCoreIntegrations | null>(null);
    const [settingsDraft, setSettingsDraft] = useState<ArbitrageCoreSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [tabLoading, setTabLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isMonitoringPending, setIsMonitoringPending] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const scanPendingRef = useRef(false);

    const navigateSection = useCallback(
        (section: WorkspaceTab, runId?: string) => {
            setActiveTab(section);
            if (runId) setSelectedRunId(runId);
            if (onNavigate) {
                onNavigate({
                    view: 'ai',
                    agentId: agent.id,
                    agentSection: section,
                    ...(runId ? { runId } : {}),
                });
            }
        },
        [agent.id, onNavigate],
    );

    const loadOverview = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const data = await api.fetchArbitrageOverview(agent.id);
            setOverview(data);
            setSettingsDraft(data.settings);
            if (!selectedRunId && data.latestRun?.runId) {
                setSelectedRunId(data.latestRun.runId);
            }
        } catch (error) {
            console.error('Failed to load arbitrage overview:', error);
            setLoadError(t('arbitrage_overview_error_help') || 'Failed to load overview data.');
        } finally {
            setIsLoading(false);
        }
    }, [agent.id, selectedRunId, t]);

    useEffect(() => {
        void loadOverview();
    }, [loadOverview]);

    useEffect(() => {
        setActiveTab(initialSection);
    }, [initialSection]);

    useEffect(() => {
        if (initialRunId) setSelectedRunId(initialRunId);
    }, [initialRunId]);

    const loadTabData = useCallback(async () => {
        setTabLoading(true);
        try {
            if (activeTab === 'candidates') {
                const data = await api.fetchArbitrageCandidates(agent.id, {
                    runId: selectedRunId || overview?.latestRun?.runId,
                });
                setCandidates(data);
            } else if (activeTab === 'history') {
                const data = await api.fetchArbitrageRuns(agent.id, { page: runsPage, pageSize: 10 });
                setRuns(data.items);
                setRunsTotal(data.pagination.total);
                if (selectedRunId) {
                    const detail = await api.fetchArbitrageRunDetail(agent.id, selectedRunId);
                    setRunDetail(detail);
                } else {
                    setRunDetail(null);
                }
            } else if (activeTab === 'integration') {
                const data = await api.fetchArbitrageIntegrations(agent.id);
                setIntegrations(data);
            }
        } catch (error) {
            console.error('Failed to load arbitrage tab data:', error);
        } finally {
            setTabLoading(false);
        }
    }, [activeTab, agent.id, overview?.latestRun?.runId, runsPage, selectedRunId]);

    useEffect(() => {
        if (isLoading) return;
        void loadTabData();
    }, [activeTab, isLoading, loadTabData]);

    const handleRunScan = async () => {
        if (scanPendingRef.current || isScanning) return;
        if (!guardExecution()) return;
        scanPendingRef.current = true;
        setIsScanning(true);
        try {
            const result = await api.runArbitrageAnalyticalScan(agent.id);
            if (result.scanRun?.runId) setSelectedRunId(result.scanRun.runId);
            await loadOverview();
            if (activeTab === 'candidates') {
                setCandidates(
                    result.candidates || {
                        runId: result.scanRun?.runId || null,
                        spreadCandidates: [],
                        rejectedCandidates: [],
                        qualifiedCandidates: [],
                    },
                );
            }
            const agents = await api.fetchAIAgents();
            const updatedAgent = agents.find(a => a.id === agent.id);
            if (updatedAgent) onUpdate(updatedAgent);
        } catch (error) {
            console.error('Failed to run analytical scan:', error);
            alert(t('analysis_failed') || 'Scan failed');
        } finally {
            scanPendingRef.current = false;
            setIsScanning(false);
        }
    };

    const handleMonitoringToggle = async () => {
        if (isMonitoringPending || !overview?.settings) return;
        const next: ArbitrageMonitoringState =
            overview.settings.monitoringState === 'active' ? 'paused' : 'active';
        setIsMonitoringPending(true);
        try {
            const updated = await api.updateArbitrageMonitoringState(agent.id, next);
            setOverview(prev =>
                prev ? { ...prev, settings: { ...prev.settings, ...updated, monitoringState: next } } : prev,
            );
            setSettingsDraft(prev => (prev ? { ...prev, ...updated, monitoringState: next } : prev));
            const agents = await api.fetchAIAgents();
            const updatedAgent = agents.find(a => a.id === agent.id);
            if (updatedAgent) onUpdate(updatedAgent);
        } catch (error) {
            console.error('Failed to update monitoring state:', error);
            alert(t('command_failed') || 'Command failed');
        } finally {
            setIsMonitoringPending(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!settingsDraft) return;
        setTabLoading(true);
        try {
            const saved = await api.updateArbitrageCoreSettings(agent.id, {
                monitoredSymbols: settingsDraft.monitoredSymbols,
                minimumNetSpreadBps: settingsDraft.minimumNetSpreadBps,
                notificationPreference: settingsDraft.notificationPreference,
            });
            setSettingsDraft(saved);
            setOverview(prev => (prev ? { ...prev, settings: saved } : prev));
            alert(t('config_updated') || 'Configuration updated successfully');
        } catch (error) {
            console.error('Failed to update arbitrage settings:', error);
            alert(t('update_failed') || 'Update failed');
        } finally {
            setTabLoading(false);
        }
    };

    const monitoringActive = overview?.settings?.monitoringState === 'active';
    const product = overview?.product;
    const latestRun = overview?.latestRun;
    const funnel = latestRun?.funnel || {};

    const spreadCandidates = candidates?.spreadCandidates ?? [];
    const rejectedCandidates = candidates?.rejectedCandidates ?? [];
    const qualifiedCandidates = candidates?.qualifiedCandidates ?? [];

    const settingsDirty = useMemo(() => {
        if (!settingsDraft || !overview?.settings) return false;
        return JSON.stringify(settingsDraft) !== JSON.stringify(overview.settings);
    }, [overview?.settings, settingsDraft]);

    return (
        <div className="space-y-5" data-testid="arb-workspace">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                    <SecondaryButton
                        type="button"
                        data-testid="arb-workspace-back"
                        onClick={onBack}
                        aria-label={t('back_to_agents') || 'Back to agents'}
                    >
                        {t('back_to_agents') || 'Back to agents'}
                    </SecondaryButton>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                            {product?.displayName || t('strategy_mexc_spot_spread_monitor') || 'MEXC Spot Spread Monitor'}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                            {product?.description ||
                                t('arbitrage_agent_desc') ||
                                'Analytical MEXC spot bid/ask spread monitor. Does not execute trades.'}
                        </p>
                    </div>
                    {product?.unavailableModes?.length ? (
                        <div className="flex flex-wrap gap-2" data-testid="arb-unavailable-modes">
                            {product.unavailableModes.map(item => (
                                <StatusPill
                                    key={item.mode}
                                    label={`${item.label} — ${t('unavailable') || item.state}`}
                                    variant="warning"
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <PrimaryButton
                        type="button"
                        data-testid="arb-run-analytical-scan"
                        data-variant="primary"
                        onClick={handleRunScan}
                        disabled={isScanning || agent.status !== 'active'}
                        aria-busy={isScanning}
                        aria-label={
                            isScanning
                                ? t('scanning') || 'Scanning...'
                                : t('run_analytical_scan') || 'Run analytical scan'
                        }
                    >
                        {isScanning
                            ? t('scanning') || 'Scanning...'
                            : t('run_analytical_scan') || 'Run analytical scan'}
                    </PrimaryButton>
                    {monitoringActive ? (
                        <button
                            type="button"
                            data-testid="arb-pause-monitoring"
                            data-variant="warning"
                            onClick={handleMonitoringToggle}
                            disabled={isMonitoringPending}
                            aria-busy={isMonitoringPending}
                            className={btnClass(BTN_WARNING)}
                        >
                            {isMonitoringPending
                                ? t('loading') || 'Loading...'
                                : t('pause_monitoring') || 'Pause monitoring'}
                        </button>
                    ) : (
                        <button
                            type="button"
                            data-testid="arb-resume-monitoring"
                            data-variant="action-blue"
                            onClick={handleMonitoringToggle}
                            disabled={isMonitoringPending}
                            aria-busy={isMonitoringPending}
                            className={btnClass(BTN_ACTION_BLUE)}
                        >
                            {isMonitoringPending
                                ? t('loading') || 'Loading...'
                                : t('resume_monitoring') || 'Resume monitoring'}
                        </button>
                    )}
                </div>
            </div>

            <div className="px-1">
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
                                onClick={() => navigateSection(tab.id, selectedRunId)}
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

            <div
                className={`${DATAHUB_SHELL} p-4 sm:p-6`}
                role="tabpanel"
                id={`arb-panel-${activeTab}`}
                aria-labelledby={`arb-tab-${activeTab}`}
                data-testid="arb-tab-panel"
            >
                {isLoading ? (
                    <p className="text-sm text-muted-foreground">{t('loading') || 'Loading...'}</p>
                ) : loadError ? (
                    <DataHubAlert
                        variant="error"
                        message={loadError}
                        onRetry={() => void loadOverview()}
                        retryLabel={t('retry') || 'Retry'}
                    />
                ) : activeTab === 'overview' ? (
                    <OverviewSection
                        overview={overview}
                        latestRun={latestRun}
                        funnel={funnel}
                        t={t}
                        onOpenTab={navigateSection}
                    />
                ) : tabLoading && activeTab !== 'settings' ? (
                    <p className="text-sm text-muted-foreground">{t('loading') || 'Loading...'}</p>
                ) : activeTab === 'candidates' ? (
                    <CandidatesSection
                        spreadCandidates={spreadCandidates}
                        rejectedCandidates={rejectedCandidates}
                        qualifiedCandidates={qualifiedCandidates}
                        t={t}
                    />
                ) : activeTab === 'history' ? (
                    <HistorySection
                        runs={runs}
                        total={runsTotal}
                        page={runsPage}
                        runDetail={runDetail}
                        selectedRunId={selectedRunId}
                        onPage={setRunsPage}
                        onSelectRun={runId => {
                            setSelectedRunId(runId);
                            navigateSection('history', runId);
                        }}
                        t={t}
                    />
                ) : activeTab === 'profitRisk' ? (
                    <ProfitRiskSection overview={overview} t={t} />
                ) : activeTab === 'settings' && settingsDraft ? (
                    <SettingsSection
                        settings={settingsDraft}
                        dirty={settingsDirty}
                        loading={tabLoading}
                        onChange={setSettingsDraft}
                        onSave={handleSaveSettings}
                        t={t}
                    />
                ) : activeTab === 'integration' ? (
                    <IntegrationSection integrations={integrations} t={t} />
                ) : null}
            </div>
        </div>
    );
};

const OverviewSection: React.FC<{
    overview: ArbitrageCoreOverview | null;
    latestRun: ArbitrageCoreRunSummary | null | undefined;
    funnel: Record<string, number>;
    t: (key: string) => string;
    onOpenTab: (tab: WorkspaceTab, runId?: string) => void;
}> = ({ overview, latestRun, funnel, t, onOpenTab }) => (
    <div className="space-y-5" data-testid="arb-overview">
        <DataHubSectionHeader
            title={t('arbitrage_overview_latest_scan') || 'Latest Scan'}
            subtitle={overview?.interpretation || t('arbitrage_overview_interpretation_compact')}
            actions={
                <StatusPill
                    label={latestRun?.status || t('arbitrage_overview_never_scanned') || 'Never scanned'}
                    variant={latestRun?.status === 'failed' ? 'error' : 'info'}
                />
            }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <DataHubMetricCard
                label={t('last_scan_at') || 'Last scan'}
                value={formatTimestamp(latestRun?.completedAt || latestRun?.startedAt, t)}
                color="blue"
                valueState={latestRun ? 'loaded' : 'unavailable'}
            />
            <DataHubMetricCard
                label={t('spread_candidates') || 'Spread candidates'}
                value={funnel.analyticalCandidates ?? funnel.spreadCandidates ?? 0}
                color="purple"
                valueState={(funnel.analyticalCandidates ?? 0) === 0 ? 'zero' : 'loaded'}
            />
            <DataHubMetricCard
                label={t('rejected_candidates') || 'Rejected candidates'}
                value={funnel.rejected ?? 0}
                color="amber"
                valueState={(funnel.rejected ?? 0) === 0 ? 'zero' : 'loaded'}
            />
            <DataHubMetricCard
                label={t('qualified_opportunities') || 'Qualified opportunities'}
                value={funnel.qualified ?? 0}
                color="emerald"
                valueState={(funnel.qualified ?? 0) === 0 ? 'zero' : 'loaded'}
            />
        </div>
        <div className="flex flex-wrap gap-2">
            <SecondaryButton type="button" onClick={() => onOpenTab('candidates', latestRun?.runId)}>
                {t('arbitrage_overview_review_candidates') || 'Review candidates'}
            </SecondaryButton>
            <SecondaryButton type="button" onClick={() => onOpenTab('history', latestRun?.runId)}>
                {t('arbitrage_overview_view_scan_history') || 'View scan history'}
            </SecondaryButton>
            <SecondaryButton type="button" onClick={() => onOpenTab('settings')}>
                {t('arbitrage_overview_adjust_settings') || 'Review settings'}
            </SecondaryButton>
        </div>
        <p className="text-xs text-muted-foreground">
            {t('total_scans') || 'Total scans'}: {overview?.totalScanRuns ?? 0}
        </p>
    </div>
);

const CandidatesSection: React.FC<{
    spreadCandidates: ArbitrageSpreadCandidate[];
    rejectedCandidates: ArbitrageSpreadCandidate[];
    qualifiedCandidates: ArbitrageSpreadCandidate[];
    t: (key: string) => string;
}> = ({ spreadCandidates, rejectedCandidates, qualifiedCandidates, t }) => (
    <div className="space-y-6">
        <SectionBlock title={t('qualified_opportunities') || 'Qualified opportunities'}>
            {qualifiedCandidates.length ? (
                qualifiedCandidates.map(c => <CandidateCard key={c.id} candidate={c} t={t} />)
            ) : (
                <EmptyBlock message={t('arbitrage_qualified_empty') || 'No qualified opportunities.'} />
            )}
        </SectionBlock>
        <SectionBlock title={t('spread_candidates') || 'Spread candidates'}>
            {spreadCandidates.length ? (
                spreadCandidates.map(c => <CandidateCard key={c.id} candidate={c} t={t} />)
            ) : (
                <EmptyBlock message={t('arbitrage_no_spread_candidates') || 'No spread candidates.'} />
            )}
        </SectionBlock>
        <SectionBlock title={t('rejected_candidates') || 'Rejected candidates'}>
            {rejectedCandidates.length ? (
                rejectedCandidates.map(c => <CandidateCard key={c.id} candidate={c} t={t} showRejection />)
            ) : (
                <EmptyBlock message={t('arbitrage_no_rejected') || 'No rejected candidates.'} />
            )}
        </SectionBlock>
    </div>
);

const HistorySection: React.FC<{
    runs: ArbitrageCoreRunSummary[];
    total: number;
    page: number;
    runDetail: ArbitrageCoreRunDetail | null;
    selectedRunId?: string;
    onPage: (page: number) => void;
    onSelectRun: (runId: string) => void;
    t: (key: string) => string;
}> = ({ runs, total, page, runDetail, selectedRunId, onPage, onSelectRun, t }) => (
    <div className="space-y-4">
        <SectionBlock title={t('tab_scan_history') || 'Scan history'}>
            <p className="text-xs text-gray-400 mb-3">
                {t('total_scans') || 'Total scans'}: {total}
            </p>
            {runs.length ? (
                <div className="space-y-3">
                    {runs.map(item => (
                        <button
                            key={item.runId}
                            type="button"
                            onClick={() => onSelectRun(item.runId)}
                            className={`w-full text-left bg-gray-900/40 border rounded-xl p-4 transition-colors ${
                                selectedRunId === item.runId
                                    ? 'border-purple-500/60'
                                    : 'border-gray-800 hover:border-purple-400/40'
                            }`}
                        >
                            <p className="text-white font-semibold">
                                {formatTimestamp(item.completedAt || item.startedAt, t)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {item.status || t('completed') || 'Completed'} · {item.trigger || 'manual'}
                            </p>
                        </button>
                    ))}
                </div>
            ) : (
                <EmptyBlock message={t('arbitrage_no_scan_history') || 'No scan history yet.'} />
            )}
            {total > 10 ? (
                <div className="flex gap-2 mt-4">
                    <SecondaryButton type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
                        {t('previous') || 'Previous'}
                    </SecondaryButton>
                    <SecondaryButton
                        type="button"
                        disabled={page * 10 >= total}
                        onClick={() => onPage(page + 1)}
                    >
                        {t('next') || 'Next'}
                    </SecondaryButton>
                </div>
            ) : null}
        </SectionBlock>
        {runDetail ? (
            <SectionBlock title={t('run_detail') || 'Run detail'}>
                <p className="text-sm text-gray-300">
                    {t('status') || 'Status'}: {runDetail.status || NA(t)}
                </p>
                <p className="text-sm text-gray-300">
                    {t('duration') || 'Duration'}: {runDetail.durationMs ?? NA(t)} ms
                </p>
            </SectionBlock>
        ) : null}
    </div>
);

const ProfitRiskSection: React.FC<{
    overview: ArbitrageCoreOverview | null;
    t: (key: string) => string;
}> = ({ overview, t }) => (
    <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricBlock
                label={t('total_scans') || 'Total scans'}
                value={overview?.totalScanRuns ?? 0}
            />
            <MetricBlock
                label={t('execution_support') || 'Execution'}
                value={t('execution_unsupported') || 'Not supported'}
            />
        </div>
        <p className="text-sm text-gray-400">
            {t('arbitrage_risk_score_help') ||
                'Risk score is a 0–100 analytical score (lower is better). It is not a percentage probability.'}
        </p>
        <div data-testid="arb-execution-unsupported">
            <StatusPill
                label={`${t('execution_support') || 'Execution'}: ${t('execution_unsupported') || 'Not supported'}`}
                variant="warning"
            />
        </div>
    </div>
);

const SettingsSection: React.FC<{
    settings: ArbitrageCoreSettings;
    dirty: boolean;
    loading: boolean;
    onChange: (next: ArbitrageCoreSettings) => void;
    onSave: () => void;
    t: (key: string) => string;
}> = ({ settings, dirty, loading, onChange, onSave, t }) => (
    <div className="space-y-6">
        <SectionBlock title={t('arbitrage_active_monitor') || 'Active monitor'}>
            <p className="text-sm text-emerald-300 mb-3">
                {t('strategy_mexc_spot_spread_monitor') || 'MEXC spot spread monitor'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-xs text-gray-400 block">
                    {t('min_profit_bps') || 'Min profit (bps)'}
                    <input
                        type="number"
                        className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                        value={settings.minimumNetSpreadBps ?? 20}
                        onChange={e =>
                            onChange({
                                ...settings,
                                minimumNetSpreadBps: Number(e.target.value),
                            })
                        }
                        disabled={loading}
                    />
                </label>
                <label className="text-xs text-gray-400 block">
                    {t('monitored_symbols') || 'Monitored symbols'}
                    <input
                        type="text"
                        className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                        value={(settings.monitoredSymbols || []).join(', ')}
                        onChange={e =>
                            onChange({
                                ...settings,
                                monitoredSymbols: e.target.value
                                    .split(',')
                                    .map(s => s.trim().toUpperCase())
                                    .filter(Boolean),
                            })
                        }
                        disabled={loading}
                    />
                </label>
            </div>
        </SectionBlock>
        <SectionBlock title={t('unsupported_capabilities') || 'Unsupported capabilities'}>
            <ul className="text-sm text-gray-400 space-y-2">
                <li>{t('arbitrage_unsupported_triangle') || 'Triangular arbitrage — Not available'}</li>
                <li>{t('arbitrage_unsupported_cross') || 'Cross-exchange arbitrage — Not available'}</li>
                <li>{t('arbitrage_unsupported_futures') || 'MEXC futures scanning — Not available'}</li>
                <li>{t('arbitrage_unsupported_auto_execute') || 'Auto Execute — Not supported'}</li>
            </ul>
            <p className="text-xs text-amber-300 mt-3" data-testid="arb-execution-supported-false">
                {t('execution_support') || 'Execution'}: {t('execution_unsupported') || 'Not supported'} (
                executionSupported=false)
            </p>
        </SectionBlock>
        <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
                type="checkbox"
                checked={Boolean(settings.notificationPreference)}
                onChange={e =>
                    onChange({ ...settings, notificationPreference: e.target.checked })
                }
                disabled={loading}
            />
            {t('notify_on_opportunity') || 'Notify on opportunity (preference)'}
        </label>
        <div className="flex gap-2">
            <PrimaryButton type="button" onClick={onSave} disabled={!dirty || loading}>
                {loading ? t('saving') || 'Saving...' : t('save_changes') || 'Save changes'}
            </PrimaryButton>
        </div>
    </div>
);

const IntegrationSection: React.FC<{
    integrations: ArbitrageCoreIntegrations | null;
    t: (key: string) => string;
}> = ({ integrations, t }) => (
    <SectionBlock title={t('tab_integration') || 'Integrations'}>
        <div className="space-y-3 text-sm text-gray-300">
            <p>
                <span className="text-gray-500">{t('data_sources') || 'Data sources'}:</span>{' '}
                {(integrations?.dataSources || ['MEXC spot (public market data)']).join(', ')}
            </p>
            <p className="text-amber-300">
                {t('arbitrage_integration_truth') ||
                    'Binance, Gate, futures, settlement, and live execution integrations are not active for this agent.'}
            </p>
            <p>
                {t('execution_support') || 'Execution'}: {t('execution_unsupported') || 'Not supported'}
            </p>
            {(integrations?.unavailableIntegrations || []).map(item => (
                <p key={item} className="text-xs text-muted-foreground">
                    {item}
                </p>
            ))}
        </div>
    </SectionBlock>
);

const CandidateCard: React.FC<{
    candidate: ArbitrageSpreadCandidate;
    t: (key: string) => string;
    showRejection?: boolean;
}> = ({ candidate, t, showRejection }) => (
    <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4 mb-3">
        <p className="text-white font-semibold">
            {(candidate.path || []).join(' → ') || candidate.symbol || NA(t)}
        </p>
        <div className="flex flex-wrap gap-4 text-sm mt-2">
            <span>
                {t('arbitrage_expected_profit') || 'Expected profit'}: {formatBps(candidate.expectedProfitBps, t)}
            </span>
            <span>
                {t('risk_score') || 'Risk score'}: {formatRiskScore(candidate.riskScore, t)}
            </span>
        </div>
        {showRejection && candidate.rejectionReason ? (
            <p className="text-xs text-rose-300 mt-2">
                {t('rejection_reason') || 'Rejection'}: {candidate.rejectionReason}
            </p>
        ) : null}
    </div>
);

const SectionBlock: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="bg-[#10141A] border border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
        {children}
    </section>
);

const MetricBlock: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl text-white font-semibold mt-2">{value}</p>
    </div>
);

const EmptyBlock: React.FC<{ message: string }> = ({ message }) => (
    <div className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-800 rounded-xl">
        {message}
    </div>
);

export default ArbitrageWorkspace;
