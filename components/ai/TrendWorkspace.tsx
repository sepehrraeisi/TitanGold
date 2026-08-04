import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAgentExecutionGate } from '../../hooks/useAgentExecutionGate.ts';
import type { OnNavigateHandler, TrendAgentSection } from '../../types/navigation.ts';
import type { AIAgent } from '../../types.ts';
import {
  fetchTrendIntegrations,
  fetchTrendOverview,
  fetchTrendRunDetail,
  fetchTrendRuns,
  fetchTrendSettings,
  runTrendAnalysis,
  updateTrendSettings,
  createTrendIdempotencyKey,
  type TrendOverview,
  type TrendRunSummary,
  type TrendSettings,
  type TrendSnapshot,
  type TrendIntegrations,
} from '../../services/trendCoreClient.ts';
import {
  PrimaryButton,
  SecondaryButton,
  DataHubAlert,
  StatusPill,
} from './AIManager/tabs/DataHub/dataHubUi.tsx';
import {
  AgentActionBar,
  AgentContentSurface,
  AgentEmptyState,
  AgentErrorState,
  AgentLoadingState,
  AgentMetricGrid,
  AgentPrimaryAction,
  AgentProductDialog,
  AgentSectionHeader,
  AgentSectionNavigation,
} from './product/index.ts';
import { TrendAnalyzeConfirmDialog } from './trend/TrendAnalyzeConfirmDialog.tsx';
import { AgentProductDetailLayer } from './product/AgentProductDetailLayer.tsx';
import {
  TREND_COMPARE_TIMEFRAMES,
  integrationEntries,
  integrationLabel,
  integrationReason,
  integrationStatusLabel,
  localizeDirection,
  localizeFreshness,
  localizeRegime,
  localizeStrength,
  resolveEvidenceText,
} from './trend/trendUiHelpers.ts';

const TAB_ITEMS: Array<{ id: TrendAgentSection; labelKey: string }> = [
  { id: 'overview', labelKey: 'tab_overview' },
  { id: 'regimeStrength', labelKey: 'trend_tab_regime_strength' },
  { id: 'evidence', labelKey: 'trend_tab_evidence' },
  { id: 'weakeningReversal', labelKey: 'trend_tab_weakening_reversal' },
  { id: 'multiTimeframe', labelKey: 'trend_tab_multi_timeframe' },
  { id: 'history', labelKey: 'trend_tab_history' },
  { id: 'settings', labelKey: 'tab_settings' },
  { id: 'integration', labelKey: 'tab_integration' },
];

const NA = (t: (k: string) => string) => t('not_available') || 'N/A';

export interface TrendWorkspaceProps {
  agent: AIAgent;
  initialSection?: TrendAgentSection;
  initialRunId?: string;
  embedded?: boolean;
  onBack: () => void;
  onNavigate?: OnNavigateHandler;
  onUpdate: (agent: AIAgent) => void;
}

const TrendWorkspace: React.FC<TrendWorkspaceProps> = ({
  agent,
  initialSection = 'overview',
  initialRunId,
  embedded = false,
  onBack,
  onNavigate,
}) => {
  const { t, language } = useLanguage();
  const { guardExecution, blockReason, canExecuteSafe, loading: executionGateLoading } = useAgentExecutionGate();
  const [activeTab, setActiveTab] = useState<TrendAgentSection>(initialSection);
  const [overview, setOverview] = useState<TrendOverview | null>(null);
  const [runs, setRuns] = useState<TrendRunSummary[]>([]);
  const [settings, setSettings] = useState<TrendSettings | null>(null);
  const [integrations, setIntegrations] = useState<TrendIntegrations | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(initialRunId);
  const [selectedSnapshot, setSelectedSnapshot] = useState<TrendSnapshot | null>(null);
  const [multiTimeframe, setMultiTimeframe] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<TrendSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [historyDetailRunId, setHistoryDetailRunId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<{
    run: TrendRunSummary;
    snapshot: TrendSnapshot;
    comparison: Record<string, unknown>;
    multiTimeframe: unknown[];
  } | null>(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const idempotencyRef = useRef<string | null>(null);

  const scheduledMonitoringState =
    overview?.scheduler?.scheduledMonitoringStatus === 'not_scheduled' ? 'not_scheduled' : 'active';

  const compareTimeframesConfigured = (settings?.compareTimeframes?.length ?? 0) > 0;

  const latestSnapshot = overview?.latestSnapshot ?? selectedSnapshot;

  const loadOverview = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await fetchTrendOverview(agent.id);
      setOverview(data);
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load overview');
    }
  }, [agent.id]);

  const loadRuns = useCallback(async () => {
    try {
      const data = await fetchTrendRuns(agent.id, 1, 20);
      setRuns(data.runs);
    } catch {
      /* optional */
    }
  }, [agent.id]);

  const loadSettings = useCallback(async () => {
    try {
      const s = await fetchTrendSettings(agent.id);
      setSettings(s);
      setSettingsDraft(s);
    } catch {
      /* optional */
    }
  }, [agent.id]);

  const loadIntegrations = useCallback(async () => {
    try {
      setIntegrations(await fetchTrendIntegrations(agent.id));
    } catch {
      /* optional */
    }
  }, [agent.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      await Promise.all([loadOverview(), loadRuns(), loadSettings(), loadIntegrations()]);
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOverview, loadRuns, loadSettings, loadIntegrations]);

  useEffect(() => {
    if (!selectedRunId) return;
    fetchTrendRunDetail(agent.id, selectedRunId)
      .then(d => {
        setSelectedSnapshot(d.snapshot);
        setMultiTimeframe(d.multiTimeframe || []);
      })
      .catch(() => setFeedback({ kind: 'error', message: t('trend_load_run_failed') || 'Failed to load run' }));
  }, [agent.id, selectedRunId, t]);

  const handleTabChange = (tab: TrendAgentSection) => {
    setActiveTab(tab);
    onNavigate?.({ view: 'ai', agentId: agent.id, agentSection: tab, runId: selectedRunId });
  };

  const openHistoryDetail = async (runId: string) => {
    setHistoryDetailRunId(runId);
    setHistoryDetailLoading(true);
    setHistoryDetail(null);
    try {
      const detail = await fetchTrendRunDetail(agent.id, runId);
      setHistoryDetail(detail);
      setSelectedRunId(runId);
      setSelectedSnapshot(detail.snapshot);
      setMultiTimeframe(detail.multiTimeframe || []);
    } catch {
      setFeedback({ kind: 'error', message: t('trend_load_run_failed') || 'Failed to load run' });
      setHistoryDetailRunId(null);
    } finally {
      setHistoryDetailLoading(false);
    }
  };

  const closeHistoryDetail = () => {
    setHistoryDetailRunId(null);
    setHistoryDetail(null);
  };

  const executionBlockedMessage =
    blockReason === 'CAPABILITY_DENIED'
      ? t('agents_permission_limited') || 'Your role cannot execute this agent action.'
      : t('trend_analysis_failed') || 'Analysis unavailable';

  const handleRunAnalysis = async () => {
    if (!settings) return;
    if (!guardExecution()) {
      setFeedback({ kind: 'error', message: executionBlockedMessage });
      return;
    }
    if (!idempotencyRef.current) idempotencyRef.current = createTrendIdempotencyKey();
    setIsAnalyzing(true);
    setFeedback(null);
    try {
      const result = await runTrendAnalysis(agent.id, {
        symbol: settings.symbol,
        timeframe: settings.timeframe,
        compareTimeframes: settings.compareTimeframes,
        idempotencyKey: idempotencyRef.current,
      });
      idempotencyRef.current = null;
      setConfirmOpen(false);
      setOverview(prev =>
        prev
          ? {
              ...prev,
              latestSnapshot: result.snapshot,
              latestRun: result.run,
              metrics: { ...prev.metrics, totalRuns: prev.metrics.totalRuns + (result.idempotent ? 0 : 1) },
            }
          : prev,
      );
      setMultiTimeframe(result.multiTimeframe || []);
      if (!result.idempotent) await loadRuns();
      setFeedback({
        kind: 'success',
        message: t('trend_analysis_complete') || 'Analysis complete',
      });
    } catch (e: any) {
      setFeedback({ kind: 'error', message: e?.message || t('trend_analysis_failed') || 'Analysis failed' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsDraft) return;
    if (!guardExecution()) {
      setFeedback({ kind: 'error', message: executionBlockedMessage });
      return;
    }
    setIsSavingSettings(true);
    try {
      const saved = await updateTrendSettings(agent.id, settingsDraft);
      setSettings(saved);
      setSettingsDraft(saved);
      setFeedback({ kind: 'success', message: t('settings_saved') || 'Settings saved' });
    } catch (e: any) {
      setFeedback({ kind: 'error', message: e?.message || t('settings_save_failed') || 'Save failed' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const metrics = useMemo(() => {
    const snap = latestSnapshot;
    if (!snap) return [];
    return [
      { id: 'direction', label: t('trend_direction') || 'Direction', value: localizeDirection(snap.direction, t) },
      { id: 'regime', label: t('trend_regime') || 'Regime', value: localizeRegime(snap.regime, t) },
      { id: 'adx', label: 'ADX', value: snap.adx?.value != null ? String(snap.adx.value) : NA(t) },
      { id: 'freshness', label: t('trend_freshness') || 'Freshness', value: localizeFreshness(snap, t, language) },
    ];
  }, [latestSnapshot, t, language]);

  const renderOverview = () => {
    if (isLoading && !overview) {
      return <AgentLoadingState message={t('loading')} testId="trend-overview-loading" />;
    }
    if (loadError && !overview) {
      return <AgentErrorState message={loadError} onRetry={loadOverview} testId="trend-overview-error" />;
    }
    if (!latestSnapshot) {
      return (
        <AgentEmptyState
          message={t('no_trend_data') || 'No analyses yet. Run a public-data trend analysis to begin.'}
          testId="trend-overview-empty"
        />
      );
    }
    return (
      <AgentContentSurface testId="trend-tab-panel">
        <AgentSectionHeader title={t('tab_overview')} />
        <AgentMetricGrid metrics={metrics} testId="trend-overview-metrics" />
        {latestSnapshot.summary ? (
          <p className="text-sm text-slate-300 mt-4">{latestSnapshot.summary}</p>
        ) : null}
        {latestSnapshot.adx?.interpretationKey ? (
          <p className="text-xs text-slate-400 mt-2">{t(latestSnapshot.adx.interpretationKey)}</p>
        ) : null}
        {overview?.comparison?.available === true ? (
          <p className="text-xs text-slate-400 mt-2">
            {overview.comparison.regimeChanged
              ? t('trend_change') || 'Regime changed vs prior run'
              : t('trend_no_prior_comparison') || 'No material change vs prior run.'}
          </p>
        ) : overview?.comparison?.available === false ? (
          <p className="text-xs text-slate-400 mt-2">{t('trend_no_prior_comparison') || 'No prior run to compare.'}</p>
        ) : null}
      </AgentContentSurface>
    );
  };

  const renderSnapshotSection = (titleKey: string, testId: string, body: () => React.ReactNode) => (
    <AgentContentSurface testId={testId}>
      <AgentSectionHeader title={t(titleKey)} />
      {!latestSnapshot ? (
        <AgentEmptyState message={NA(t)} testId={`${testId}-empty`} />
      ) : (
        body()
      )}
    </AgentContentSurface>
  );

  const renderPanel = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'regimeStrength':
        return renderSnapshotSection('trend_tab_regime_strength', 'trend-panel-regimeStrength', () => (
          <div className="space-y-2 text-sm">
            <div><StatusPill label={localizeRegime(latestSnapshot!.regime, t)} variant="info" /></div>
            <div>{t('trend_strength')}: {localizeStrength(latestSnapshot!.strengthClassification, t)}</div>
            <div>
              ADX: {latestSnapshot!.adx?.interpretationKey
                ? t(latestSnapshot!.adx.interpretationKey)
                : latestSnapshot!.adx?.interpretation || NA(t)}
            </div>
          </div>
        ));
      case 'evidence':
        return renderSnapshotSection('trend_tab_evidence', 'trend-panel-evidence', () => (
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-medium">{t('trend_supporting_evidence')}</h4>
              {latestSnapshot!.supportingEvidence.length === 0 ? NA(t) : (
                <ul className="list-disc ps-5">{latestSnapshot!.supportingEvidence.map((e, i) => (
                  <li key={i}>{resolveEvidenceText(e, t)}</li>
                ))}</ul>
              )}
            </div>
            <div>
              <h4 className="font-medium">{t('trend_conflicting_evidence')}</h4>
              {latestSnapshot!.conflictingEvidence.length === 0 ? NA(t) : (
                <ul className="list-disc ps-5">{latestSnapshot!.conflictingEvidence.map((e, i) => (
                  <li key={i}>{resolveEvidenceText(e, t)}</li>
                ))}</ul>
              )}
            </div>
          </div>
        ));
      case 'weakeningReversal':
        return renderSnapshotSection('trend_tab_weakening_reversal', 'trend-panel-weakeningReversal', () => (
          <div className="space-y-2 text-sm">
            {(latestSnapshot!.weakeningEvidence.length === 0 && latestSnapshot!.reversalEvidence.length === 0)
              ? NA(t)
              : (
                <>
                  {latestSnapshot!.weakeningEvidence.map((w, i) => (
                    <div key={`w-${i}`}>{resolveEvidenceText(w, t)}</div>
                  ))}
                  {latestSnapshot!.reversalEvidence.map((r, i) => (
                    <div key={`r-${i}`}>{resolveEvidenceText(r, t)}</div>
                  ))}
                </>
              )}
          </div>
        ));
      case 'multiTimeframe':
        return (
          <AgentContentSurface testId="trend-panel-multiTimeframe">
            <AgentSectionHeader title={t('trend_tab_multi_timeframe')} />
            {!compareTimeframesConfigured ? (
              <AgentEmptyState
                message={t('trend_mtf_unavailable') || 'Multi-timeframe comparison unavailable until configured in Settings.'}
                testId="trend-mtf-unavailable"
              />
            ) : !latestSnapshot ? (
              <AgentEmptyState message={NA(t)} testId="trend-panel-multiTimeframe-empty" />
            ) : multiTimeframe.length === 0 ? (
              <AgentEmptyState
                message={t('trend_mtf_no_data') || 'No comparison data yet.'}
                testId="trend-mtf-empty"
              />
            ) : (
              <ul className="space-y-2 text-sm">
                {(multiTimeframe as Array<{ timeframe: string; agreement: string; snapshot: TrendSnapshot }>).map(row => (
                  <li key={row.timeframe}>
                    <span dir="ltr">{row.timeframe}</span>: {localizeDirection(row.snapshot?.direction, t)} ({row.agreement})
                  </li>
                ))}
              </ul>
            )}
          </AgentContentSurface>
        );
      case 'history':
        return (
          <AgentContentSurface testId="trend-panel-history">
            <AgentSectionHeader title={t('trend_tab_history')} />
            {runs.length === 0 ? (
              <AgentEmptyState message={t('no_trend_data') || 'No history'} testId="trend-history-empty" />
            ) : (
              <ul className="divide-y divide-white/5">
                {runs.map(run => (
                  <li key={run.runId} className="py-2 flex flex-col sm:flex-row sm:justify-between gap-2 text-sm">
                    <div>
                      <span dir="ltr">{run.symbol}</span> · {run.timeframe} · {localizeDirection(run.snapshotSummary?.direction as string, t)}
                      <span className="text-slate-400 ms-2">
                        · {t(`trend_run_status_${run.status}`) || run.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">{new Date(run.startedAt).toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US')}</span>
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        data-testid={`trend-history-row-${run.runId}`}
                        onClick={() => openHistoryDetail(run.runId)}
                      >
                        {t('trend_history_view_detail') || 'View detail'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AgentContentSurface>
        );
      case 'settings':
        return (
          <AgentContentSurface testId="trend-panel-settings">
            <AgentSectionHeader title={t('tab_settings')} />
            {!settingsDraft ? (
              <AgentLoadingState message={t('loading')} />
            ) : (
              <div className="space-y-3 max-w-md">
                <label className="block text-sm">
                  {t('symbol') || 'Symbol'}
                  <input
                    className="mt-1 w-full rounded bg-slate-900 border border-white/10 px-3 py-2"
                    value={settingsDraft.symbol}
                    dir="ltr"
                    onChange={e => setSettingsDraft({ ...settingsDraft, symbol: e.target.value })}
                    data-testid="trend-settings-symbol"
                  />
                </label>
                <label className="block text-sm">
                  {t('timeframe') || 'Timeframe'}
                  <select
                    className="mt-1 w-full rounded bg-slate-900 border border-white/10 px-3 py-2"
                    value={settingsDraft.timeframe}
                    onChange={e => setSettingsDraft({ ...settingsDraft, timeframe: e.target.value })}
                    data-testid="trend-settings-timeframe"
                  >
                    {['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'].map(tf => (
                      <option key={tf} value={tf}>{tf}</option>
                    ))}
                  </select>
                </label>
                <fieldset className="block text-sm space-y-2" data-testid="trend-settings-compare-timeframes">
                  <legend>{t('trend_compare_timeframes') || 'Compare timeframes'}</legend>
                  <p className="text-xs text-slate-400">{t('trend_compare_timeframes_help')}</p>
                  <div className="flex flex-wrap gap-3">
                    {TREND_COMPARE_TIMEFRAMES.filter(tf => tf !== settingsDraft.timeframe).map(tf => {
                      const selected = settingsDraft.compareTimeframes.includes(tf);
                      return (
                        <label key={tf} className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            data-testid={`trend-settings-compare-${tf}`}
                            onChange={() => {
                              const next = selected
                                ? settingsDraft.compareTimeframes.filter(x => x !== tf)
                                : [...settingsDraft.compareTimeframes, tf].slice(0, 3);
                              setSettingsDraft({ ...settingsDraft, compareTimeframes: next });
                            }}
                          />
                          <span dir="ltr">{tf}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <p className="text-xs text-slate-400">{t('trend_auto_execute_blocked') || 'Auto Execute is unavailable (analytical only).'}</p>
                <PrimaryButton onClick={handleSaveSettings} disabled={isSavingSettings} data-testid="trend-settings-save">
                  {t('save') || 'Save'}
                </PrimaryButton>
              </div>
            )}
          </AgentContentSurface>
        );
      case 'integration':
        return (
          <AgentContentSurface testId="trend-panel-integration">
            <AgentSectionHeader title={t('tab_integration')} />
            {!integrations ? (
              <AgentLoadingState message={t('loading')} />
            ) : (
              <ul className="space-y-3 text-sm">
                {integrationEntries(integrations).map(({ key, ...entry }) => {
                  const statusLabel = integrationStatusLabel(entry, t);
                  const reason = integrationReason(entry, t);
                  return (
                    <li key={key} className="rounded border border-white/10 p-3 space-y-1">
                      <div className="flex justify-between gap-2 items-start">
                        <span className="font-medium">{integrationLabel(key, t)}</span>
                        <StatusPill
                          label={statusLabel}
                          variant={
                            ['available', 'online'].includes(String(entry.status))
                              ? 'success'
                              : 'warning'
                          }
                        />
                      </div>
                      {reason ? <p className="text-xs text-slate-400">{reason}</p> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </AgentContentSurface>
        );
      default:
        return null;
    }
  };

  return (
    <div className={embedded ? '' : 'min-h-screen'}>
      <AgentProductDialog
        agent={agent}
        onClose={onBack}
        purpose={t('trend_agent_desc') || agent.role}
        latestRunAt={overview?.metrics.lastRunAt}
        monitoringState={scheduledMonitoringState}
        detailOpen={Boolean(historyDetailRunId)}
        detail={
          historyDetailRunId ? (
            <AgentProductDetailLayer
              title={t('trend_history_detail_title') || 'Run detail'}
              closeLabel={t('close') || 'Close'}
              onClose={closeHistoryDetail}
              layerTestId="trend-history-detail-layer"
              panelTestId="trend-history-detail-panel"
            >
              {historyDetailLoading || !historyDetail ? (
                <AgentLoadingState message={t('loading')} testId="trend-history-detail-loading" />
              ) : (
                <div className="space-y-3 text-sm">
                  <div><span className="text-slate-400">{t('trend_history_run_id')}:</span>{' '}<span dir="ltr">{historyDetail.run.runId}</span></div>
                  <div><span className="text-slate-400">{t('trend_history_status')}:</span> {t(`trend_run_status_${historyDetail.run.status}`) || historyDetail.run.status}</div>
                  <div><span className="text-slate-400">{t('trend_freshness')}:</span> {localizeFreshness(historyDetail.snapshot, t, language)}</div>
                  {historyDetail.run.errorMessage ? (
                    <DataHubAlert variant="error">{historyDetail.run.errorMessage}</DataHubAlert>
                  ) : null}
                  {historyDetail.comparison?.available ? (
                    <p className="text-xs text-slate-400">
                      {historyDetail.comparison.regimeChanged ? t('trend_change') : t('trend_no_prior_comparison')}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">{t('trend_comparison_unavailable')}</p>
                  )}
                  <div>
                    <h4 className="font-medium">{t('trend_supporting_evidence')}</h4>
                    {historyDetail.snapshot.supportingEvidence.length === 0 ? NA(t) : (
                      <ul className="list-disc ps-5">
                        {historyDetail.snapshot.supportingEvidence.map((e, i) => (
                          <li key={i}>{resolveEvidenceText(e, t)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </AgentProductDetailLayer>
          ) : null
        }
        confirmationOpen={confirmOpen}
        confirmation={
          settings ? (
            <TrendAnalyzeConfirmDialog
              open={confirmOpen}
              symbol={settings.symbol}
              timeframe={settings.timeframe}
              compareTimeframes={settings.compareTimeframes}
              onConfirm={handleRunAnalysis}
              onCancel={() => setConfirmOpen(false)}
              isRunning={isAnalyzing}
            />
          ) : null
        }
        actionBar={
          <AgentActionBar>
            <AgentPrimaryAction
              testId="trend-run-analytical-analysis"
              label={t('trend_run_analysis') || 'Run analysis'}
              onClick={() => {
                if (!guardExecution()) {
                  setFeedback({ kind: 'error', message: executionBlockedMessage });
                  return;
                }
                setConfirmOpen(true);
              }}
              disabled={isAnalyzing || !settings || executionGateLoading || !canExecuteSafe}
              loading={isAnalyzing}
            />
          </AgentActionBar>
        }
        sectionNavigation={
          <AgentSectionNavigation
            tabs={TAB_ITEMS.map(tab => ({ id: tab.id, label: t(tab.labelKey) }))}
            activeTab={activeTab}
            onTabChange={id => handleTabChange(id as TrendAgentSection)}
            ariaLabel={t('trend_sections') || 'Trend sections'}
            testId="trend-section-nav"
            idPrefix="trend"
          />
        }
        testId="agent-product-dialog"
      >
        <div className="space-y-3" data-testid="trend-workspace">
        {feedback ? (
          <DataHubAlert variant={feedback.kind === 'error' ? 'error' : 'success'} className="mb-3">
            {feedback.message}
          </DataHubAlert>
        ) : null}
        {renderPanel()}
        </div>
      </AgentProductDialog>
    </div>
  );
};

export default TrendWorkspace;
