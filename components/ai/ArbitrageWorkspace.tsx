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
    PrimaryButton,
    SecondaryButton,
    DataHubAlert,
    StatusPill,
} from './AIManager/tabs/DataHub/dataHubUi.tsx';
import {
    AgentActionBar,
    AgentContentSurface,
    AgentPrimaryAction,
    AgentProductDialog,
    AgentSecondaryAction,
    AgentSectionHeader,
    AgentSectionNavigation,
} from './product/index.ts';
import ArbitrageOverviewSection from './arbitrage/ArbitrageOverviewSection.tsx';
import ArbitrageScanConfirmDialog from './arbitrage/ArbitrageScanConfirmDialog.tsx';
import { formatRejectionReason } from '../../utils/arbitrageReasonLabels.ts';
import {
    createScanIdempotencyKey,
    resolveArbitrageScanFeedback,
    type ArbitrageScanFeedback,
} from '../../utils/arbitrageScanFeedback.ts';


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
    /** When true, rendered inside AgentControlShell popup (no standalone page chrome). */
    embedded?: boolean;
    onBack: () => void;
    onNavigate?: OnNavigateHandler;
    onUpdate: (agent: AIAgent) => void;
}

const ArbitrageWorkspace: React.FC<ArbitrageWorkspaceProps> = ({
    agent,
    initialSection = 'overview',
    initialRunId,
    embedded = false,
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
    const [tabError, setTabError] = useState<string | null>(null);
    const [settingsLoadState, setSettingsLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
    const [settingsError, setSettingsError] = useState<string | null>(null);
    const [scanConfirmOpen, setScanConfirmOpen] = useState(false);
    const [scanFeedback, setScanFeedback] = useState<ArbitrageScanFeedback | null>(null);
    const scanPendingRef = useRef(false);
    const scanIdempotencyKeyRef = useRef<string | null>(null);

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
            if (data.settings) {
                setSettingsDraft(data.settings);
                setSettingsLoadState('loaded');
            }
            if (!selectedRunId && data.latestRun?.runId) {
                setSelectedRunId(data.latestRun.runId);
            }
        } catch (error) {
            console.error('Failed to load arbitrage overview:', error);
            setOverview(null);
            setLoadError(t('arbitrage_overview_error_help') || 'Failed to load overview data.');
        } finally {
            setIsLoading(false);
        }
    }, [agent.id, selectedRunId, t]);

    const loadSettings = useCallback(async () => {
        setSettingsLoadState('loading');
        setSettingsError(null);
        try {
            const saved = await api.fetchArbitrageSettings(agent.id);
            setSettingsDraft(saved);
            setSettingsLoadState('loaded');
            setOverview(prev => (prev ? { ...prev, settings: saved } : prev));
        } catch (error) {
            console.error('Failed to load arbitrage settings:', error);
            setSettingsError(t('load_failed') || 'Failed to load settings.');
            setSettingsLoadState('error');
        }
    }, [agent.id, t]);

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
        setTabError(null);
        try {
            if (activeTab === 'candidates') {
                const data = await api.fetchArbitrageCandidates(agent.id, {
                    runId: selectedRunId || overview?.latestRun?.runId,
                });
                setCandidates(data);
            } else if (activeTab === 'history') {
                const data = await api.fetchArbitrageRuns(agent.id, { page: runsPage, pageSize: 10 });
                setRuns(data.items ?? []);
                setRunsTotal(data.pagination?.total ?? 0);
                if (selectedRunId) {
                    const detail = await api.fetchArbitrageRunDetail(agent.id, selectedRunId);
                    setRunDetail(detail);
                } else {
                    setRunDetail(null);
                }
            } else if (activeTab === 'integration') {
                const data = await api.fetchArbitrageIntegrations(agent.id);
                setIntegrations(data);
            } else if (activeTab === 'settings') {
                await loadSettings();
            }
        } catch (error) {
            console.error('Failed to load arbitrage tab data:', error);
            setTabError(t('load_failed') || 'Failed to load section data.');
            if (activeTab === 'history') {
                setRuns([]);
            }
        } finally {
            setTabLoading(false);
        }
    }, [activeTab, agent.id, overview?.latestRun?.runId, runsPage, selectedRunId, loadSettings, t]);

    useEffect(() => {
        if (isLoading) return;
        void loadTabData();
    }, [activeTab, isLoading, loadTabData]);

    const executeManualScan = async () => {
        if (scanPendingRef.current || isScanning) return;
        if (!guardExecution()) return;
        scanPendingRef.current = true;
        setIsScanning(true);
        setScanFeedback({ kind: 'scanning', message: t('scanning') || 'Scanning...', retryable: false });
        const idempotencyKey = scanIdempotencyKeyRef.current || createScanIdempotencyKey();
        scanIdempotencyKeyRef.current = idempotencyKey;
        try {
            const result = await api.runArbitrageAnalyticalScan(agent.id, { idempotencyKey });
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
            setScanFeedback({
                kind: 'success',
                message: t('arb_scan_success') || 'Analytical scan completed.',
                retryable: false,
            });
            scanIdempotencyKeyRef.current = null;
        } catch (error) {
            console.error('Failed to run analytical scan:', error);
            setScanFeedback(resolveArbitrageScanFeedback(error as Error & { code?: string; status?: number }, t));
        } finally {
            scanPendingRef.current = false;
            setIsScanning(false);
            setScanConfirmOpen(false);
            window.requestAnimationFrame(() => {
                const scanTrigger = document.querySelector(
                    '[data-testid="agent-product-dialog"] [data-testid="arb-run-analytical-scan"]',
                ) as HTMLElement | null;
                scanTrigger?.focus?.();
            });
        }
    };

    const handleRunScan = () => {
        if (scanPendingRef.current || isScanning) return;
        if (!guardExecution()) return;
        setScanFeedback(null);
        setScanConfirmOpen(true);
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
            setScanFeedback({
                kind: 'server',
                message: t('command_failed') || 'Command failed',
                retryable: true,
            });
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
            setScanFeedback({
                kind: 'success',
                message: t('config_updated') || 'Configuration updated successfully',
                retryable: false,
            });
        } catch (error) {
            console.error('Failed to update arbitrage settings:', error);
            setScanFeedback({
                kind: 'server',
                message: t('update_failed') || 'Update failed',
                retryable: true,
            });
        } finally {
            setTabLoading(false);
        }
    };

    const monitoringState = overview?.settings?.monitoringState;
    const monitoringStateKnown = monitoringState === 'active' || monitoringState === 'paused';
    const monitoringActive = monitoringState === 'active';
    const hasHistoricalScans = (overview?.totalScanRuns ?? 0) > 0;
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

    const sectionTabs = TAB_ITEMS.map(tab => ({
        id: tab.id,
        label: t(tab.labelKey),
    }));

    const displayAgent = useMemo(
        () => ({
            ...agent,
            name: product?.displayName || t('strategy_mexc_spot_spread_monitor') || agent.name,
        }),
        [agent, product?.displayName, t],
    );

    const scanFeedbackBanner =
        scanFeedback && scanFeedback.kind !== 'idle' && scanFeedback.kind !== 'confirm' ? (
            <div
                role="status"
                aria-live="polite"
                data-testid="arb-scan-feedback"
                className="px-4 pt-3"
            >
                {scanFeedback.kind === 'success' ? (
                    <div className="p-2 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 text-[11px]">
                        {scanFeedback.message}
                    </div>
                ) : (
                    <DataHubAlert
                        variant={scanFeedback.kind === 'conflict' ? 'warning' : 'error'}
                        message={scanFeedback.message}
                        onRetry={
                            scanFeedback.retryable && !isScanning
                                ? () => {
                                      if (scanFeedback.kind === 'conflict') {
                                          void executeManualScan();
                                      } else {
                                          setScanConfirmOpen(true);
                                      }
                                  }
                                : undefined
                        }
                        retryLabel={t('retry') || 'Retry'}
                    />
                )}
            </div>
        ) : null;

    const actionBar = (
        <AgentActionBar>
            <AgentPrimaryAction
                label={
                    isScanning
                        ? t('scanning') || 'Scanning...'
                        : t('run_analytical_scan') || 'Run analytical scan'
                }
                onClick={handleRunScan}
                disabled={isScanning || agent.status !== 'active' || scanConfirmOpen}
                loading={isScanning}
                testId="arb-run-analytical-scan"
            />
            {monitoringStateKnown ? (
                monitoringActive ? (
                    <AgentSecondaryAction
                        label={
                            isMonitoringPending
                                ? t('loading') || 'Loading...'
                                : t('pause_monitoring') || 'Pause monitoring'
                        }
                        onClick={handleMonitoringToggle}
                        disabled={isMonitoringPending}
                        loading={isMonitoringPending}
                        variant="warning"
                        testId="arb-pause-monitoring"
                    />
                ) : (
                    <AgentSecondaryAction
                        label={
                            isMonitoringPending
                                ? t('loading') || 'Loading...'
                                : t('resume_monitoring') || 'Resume monitoring'
                        }
                        onClick={handleMonitoringToggle}
                        disabled={isMonitoringPending}
                        loading={isMonitoringPending}
                        testId="arb-resume-monitoring"
                    />
                )
            ) : (
                <StatusPill
                    label={t('arbitrage_overview_data_unavailable') || 'Monitoring state unavailable'}
                    variant="warning"
                />
            )}
        </AgentActionBar>
    );

    const sectionNavigation = (
        <AgentSectionNavigation
            tabs={sectionTabs}
            activeTab={activeTab}
            onTabChange={tabId => navigateSection(tabId as WorkspaceTab, selectedRunId)}
            ariaLabel={t('arbitrage_tabs') || 'Arbitrage tabs'}
            testId="arb-tablist"
            idPrefix="arb"
        />
    );

    const renderTabPanel = () => (
        <div
            role="tabpanel"
            id={`arb-panel-${activeTab}`}
            aria-labelledby={`arb-tab-${activeTab}`}
            data-testid="arb-tab-panel"
        >
            {activeTab === 'overview' ? (
                <ArbitrageOverviewSection
                    overview={overview}
                    isLoading={isLoading}
                    loadError={loadError}
                    onRetry={() => void loadOverview()}
                    onOpenTab={navigateSection}
                    t={t}
                />
            ) : isLoading ? (
                <AgentContentSurface>
                    <p className="text-sm text-muted-foreground">{t('loading') || 'Loading...'}</p>
                </AgentContentSurface>
            ) : loadError && activeTab !== 'settings' ? (
                <AgentContentSurface>
                    <DataHubAlert
                        variant="error"
                        message={loadError}
                        onRetry={() => void loadOverview()}
                        retryLabel={t('retry') || 'Retry'}
                    />
                </AgentContentSurface>
            ) : tabError ? (
                <AgentContentSurface>
                    <DataHubAlert
                        variant="error"
                        message={tabError}
                        onRetry={() => void loadTabData()}
                        retryLabel={t('retry') || 'Retry'}
                    />
                </AgentContentSurface>
            ) : tabLoading && activeTab !== 'settings' ? (
                <AgentContentSurface>
                    <p className="text-sm text-muted-foreground">{t('loading') || 'Loading...'}</p>
                </AgentContentSurface>
            ) : activeTab === 'candidates' ? (
                <AgentContentSurface>
                    <AgentSectionHeader title={t('tab_arbitrage_candidates') || 'Candidates'} />
                    <CandidatesSection
                        spreadCandidates={spreadCandidates}
                        rejectedCandidates={rejectedCandidates}
                        qualifiedCandidates={qualifiedCandidates}
                        failed={Boolean(tabError)}
                        t={t}
                    />
                </AgentContentSurface>
            ) : activeTab === 'history' ? (
                <AgentContentSurface>
                    <AgentSectionHeader title={t('tab_scan_history') || 'Scan history'} />
                    <HistorySection
                        runs={runs ?? []}
                        total={runsTotal}
                        page={runsPage}
                        runDetail={runDetail}
                        selectedRunId={selectedRunId}
                        onPage={setRunsPage}
                        onSelectRun={runId => {
                            setSelectedRunId(runId);
                            navigateSection('history', runId);
                        }}
                        onRetry={() => void loadTabData()}
                        failed={Boolean(tabError)}
                        t={t}
                    />
                </AgentContentSurface>
            ) : activeTab === 'profitRisk' ? (
                <AgentContentSurface>
                    <AgentSectionHeader title={t('tab_profit_risk') || 'Profit & Risk'} />
                    <ProfitRiskSection overview={overview} latestRun={latestRun} t={t} />
                </AgentContentSurface>
            ) : activeTab === 'settings' ? (
                <AgentContentSurface>
                    <AgentSectionHeader title={t('tab_settings') || 'Settings'} />
                    <SettingsSection
                        settings={settingsDraft}
                        dirty={settingsDirty}
                        loading={settingsLoadState === 'loading' || tabLoading}
                        loadState={settingsLoadState}
                        error={settingsError}
                        onChange={setSettingsDraft}
                        onSave={handleSaveSettings}
                        onRetry={() => void loadSettings()}
                        t={t}
                    />
                </AgentContentSurface>
            ) : activeTab === 'integration' ? (
                <AgentContentSurface>
                    <AgentSectionHeader title={t('tab_integration') || 'Integrations'} />
                    <IntegrationSection integrations={integrations} failed={Boolean(tabError)} t={t} />
                </AgentContentSurface>
            ) : null}
        </div>
    );

    if (embedded) {
        return (
            <AgentProductDialog
                agent={displayAgent}
                onClose={() => {
                    setScanConfirmOpen(false);
                    onBack();
                }}
                closeTestId="arb-popup-close"
                confirmationOpen={scanConfirmOpen}
                confirmation={
                    <ArbitrageScanConfirmDialog
                        open={scanConfirmOpen}
                        onCancel={() => setScanConfirmOpen(false)}
                        onConfirm={() => void executeManualScan()}
                        pending={isScanning}
                        t={t}
                    />
                }
                purpose={
                        product?.description ||
                        t('arbitrage_agent_desc') ||
                        'Analytical MEXC spot bid/ask spread monitor. Does not execute trades.'
                    }
                latestRunAt={
                    overview?.runTiming?.latestRunAt ||
                    latestRun?.completedAt ||
                    latestRun?.startedAt ||
                    null
                }
                monitoringState={monitoringState}
                safetyProductNote={
                    t('arbitrage_analytical_mode_banner') ||
                    'Analytical mode: MEXC spot bid/ask spread monitor. Not executable multi-leg arbitrage. No live orders.'
                }
                actionBar={actionBar}
                sectionNavigation={sectionNavigation}
            >
                {scanFeedbackBanner}
                {renderTabPanel()}
            </AgentProductDialog>
        );
    }

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
            </div>
            {actionBar}
            {sectionNavigation}
            {renderTabPanel()}
        </div>
    );
};

const CandidatesSection: React.FC<{
    spreadCandidates: ArbitrageSpreadCandidate[];
    rejectedCandidates: ArbitrageSpreadCandidate[];
    qualifiedCandidates: ArbitrageSpreadCandidate[];
    failed?: boolean;
    t: (key: string) => string;
}> = ({ spreadCandidates, rejectedCandidates, qualifiedCandidates, failed, t }) => {
    if (failed) {
        return (
            <EmptyBlock message={t('arbitrage_overview_data_unavailable') || 'Candidate data unavailable.'} />
        );
    }
    return (
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
};

const HistorySection: React.FC<{
    runs: ArbitrageCoreRunSummary[];
    total: number;
    page: number;
    runDetail: ArbitrageCoreRunDetail | null;
    selectedRunId?: string;
    onPage: (page: number) => void;
    onSelectRun: (runId: string) => void;
    onRetry: () => void;
    failed?: boolean;
    t: (key: string) => string;
}> = ({ runs, total, page, runDetail, selectedRunId, onPage, onSelectRun, onRetry, failed, t }) => {
    const safeRuns = Array.isArray(runs) ? runs : [];
    const symbolsRequested = runDetail?.symbolsRequested ?? [];
    const symbolsEvaluated = runDetail?.symbolsEvaluated ?? [];
    const rejectionEntries = Object.entries(runDetail?.rejectionSummary ?? {});

    if (failed) {
        return (
            <DataHubAlert
                variant="error"
                message={t('load_failed') || 'Failed to load scan history.'}
                onRetry={onRetry}
                retryLabel={t('retry') || 'Retry'}
            />
        );
    }

    return (
    <div className="space-y-4">
        <SectionBlock title={t('tab_scan_history') || 'Scan history'}>
            <p className="text-xs text-gray-400 mb-3" data-testid="arb-history-total">
                {t('total_scans') || 'Total scans'}: {total}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
                {t('arb_history_analytical_only_product') ||
                    'Scan history shows analytical monitoring runs only. Execution history and realized profit are unavailable.'}
            </p>
            {safeRuns.length ? (
                <div className="space-y-3">
                    {safeRuns.map(item => (
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
                <p className="text-sm text-gray-300">
                    {t('monitored_symbols') || 'Symbols requested'}: {symbolsRequested.length}
                </p>
                <p className="text-sm text-gray-300">
                    {t('symbols_evaluated') || 'Symbols evaluated'}: {symbolsEvaluated.length}
                </p>
                {rejectionEntries.length ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {rejectionEntries.map(([reason, count]) => (
                            <StatusPill
                                key={reason}
                                label={`${formatRejectionReason(reason, t)}: ${count}`}
                                variant="warning"
                            />
                        ))}
                    </div>
                ) : null}
            </SectionBlock>
        ) : null}
    </div>
    );
};

const ProfitRiskSection: React.FC<{
    overview: ArbitrageCoreOverview | null;
    latestRun: ArbitrageCoreRunSummary | null | undefined;
    t: (key: string) => string;
}> = ({ overview, latestRun, t }) => {
    const funnel = latestRun?.funnel ?? {};
    const rejectionEntries = Object.entries(latestRun?.rejectionSummary ?? {});
    const settings = overview?.settings;

    return (
    <div className="space-y-4" data-testid="arb-profit-risk">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <MetricBlock
                label={t('total_scans') || 'Total scans'}
                value={overview?.totalScanRuns ?? 0}
            />
            <MetricBlock
                label={t('qualified_opportunities') || 'Qualified opportunities'}
                value={funnel.qualified ?? 0}
            />
            <MetricBlock
                label={t('rejected_candidates') || 'Rejected candidates'}
                value={funnel.rejected ?? 0}
            />
            <MetricBlock
                label={t('assumed_fees_bps') || 'Assumed fees (bps)'}
                value={settings?.assumedFeesBps != null ? settings.assumedFeesBps : NA(t)}
            />
            <MetricBlock
                label={t('assumed_slippage_bps') || 'Assumed slippage (bps)'}
                value={settings?.assumedSlippageBps != null ? settings.assumedSlippageBps : NA(t)}
            />
            <MetricBlock
                label={t('min_profit_bps') || 'Minimum net spread (bps)'}
                value={settings?.minimumNetSpreadBps != null ? settings.minimumNetSpreadBps : NA(t)}
            />
        </div>
        {rejectionEntries.length ? (
            <SectionBlock title={t('rejection_summary') || 'Rejection distribution'}>
                <div className="flex flex-wrap gap-2">
                    {rejectionEntries.map(([reason, count]) => (
                        <StatusPill key={reason} label={`${reason}: ${count}`} variant="warning" />
                    ))}
                </div>
            </SectionBlock>
        ) : (
            <p className="text-sm text-gray-400">
                {t('arbitrage_no_rejection_summary') ||
                    'No rejection distribution available for the latest run.'}
            </p>
        )}
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
};

const SettingsSection: React.FC<{
    settings: ArbitrageCoreSettings | null;
    dirty: boolean;
    loading: boolean;
    loadState: 'idle' | 'loading' | 'loaded' | 'error';
    error: string | null;
    onChange: (next: ArbitrageCoreSettings) => void;
    onSave: () => void;
    onRetry: () => void;
    t: (key: string) => string;
}> = ({ settings, dirty, loading, loadState, error, onChange, onSave, onRetry, t }) => {
    if (loadState === 'loading' || (loadState === 'idle' && !settings)) {
        return <p className="text-sm text-muted-foreground">{t('loading') || 'Loading...'}</p>;
    }
    if (loadState === 'error' || !settings) {
        return (
            <DataHubAlert
                variant="error"
                message={error || t('load_failed') || 'Failed to load settings.'}
                onRetry={onRetry}
                retryLabel={t('retry') || 'Retry'}
            />
        );
    }

    return (
    <div className="space-y-6" data-testid="arb-settings">
        {settings.isDefault ? (
            <DataHubAlert
                variant="warning"
                message={t('arbitrage_settings_defaults_not_saved') || 'Defaults not yet saved'}
            />
        ) : null}
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
                {t('execution_support') || 'Execution'}: {t('execution_unsupported') || 'Not supported'}
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
};

const IntegrationSection: React.FC<{
    integrations: (ArbitrageCoreIntegrations & { items?: import('../../services/arbitrageCoreClient.ts').ArbitrageIntegrationItem[] }) | null;
    failed?: boolean;
    t: (key: string) => string;
}> = ({ integrations, failed, t }) => {
    if (failed || !integrations) {
        return (
            <EmptyBlock
                message={t('arbitrage_overview_data_unavailable') || 'Integration status unavailable.'}
            />
        );
    }

    const items = integrations.items ?? [];

    return (
    <SectionBlock title={t('tab_integration') || 'Integrations'}>
        <div className="space-y-3">
            {items.map(item => (
                <div key={item.id} className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <StatusPill label={item.state} variant={item.state === 'available' ? 'info' : 'warning'} />
                    </div>
                    {item.owner ? (
                        <p className="text-xs text-gray-500 mt-1">
                            {t('owner') || 'Owner'}: {item.owner}
                        </p>
                    ) : null}
                    {item.safeReason ? (
                        <p className="text-xs text-gray-400 mt-1">{item.safeReason}</p>
                    ) : item.state === 'unavailable' ? (
                        <p className="text-xs text-gray-400 mt-1">
                            {t('arbitrage_overview_data_unavailable') || 'Status unavailable'}
                        </p>
                    ) : null}
                </div>
            ))}
        </div>
        <p className="text-xs text-amber-300 mt-4">
            {t('arbitrage_integration_truth') ||
                'Binance, Gate, futures, settlement, and live execution integrations are not active for this agent.'}
        </p>
    </SectionBlock>
    );
};

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
                {t('rejection_reason') || 'Rejection'}:{' '}
                {formatRejectionReason(candidate.rejectionReason, t)}
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
