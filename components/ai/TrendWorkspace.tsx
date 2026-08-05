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
import {
  TrendAnalyzeConfirmDialog,
  type TrendAnalyzeDraft,
} from './trend/TrendAnalyzeConfirmDialog.tsx';
import { AgentProductDetailLayer } from './product/AgentProductDetailLayer.tsx';
import { TrendFeedbackBanner } from './trend/TrendFeedbackBanner.tsx';
import {
  sanitizeTrendApiError,
  sanitizeTrendSettingsError,
  type TrendFeedback,
} from './trend/trendFeedback.ts';
import { TrendPriceMaChart } from './trend/TrendPriceMaChart.tsx';
import { TrendAdxChart } from './trend/TrendAdxChart.tsx';
import { TrendMtfMatrix, type TrendMtfRow } from './trend/TrendMtfMatrix.tsx';
import { TrendHistoryTrendChart } from './trend/TrendHistoryTrendChart.tsx';
import { TrendRunComparisonPanel } from './trend/TrendRunComparisonPanel.tsx';
import { TrendWeakeningReversalItem } from './trend/TrendWeakeningReversalItem.tsx';
import {
  TREND_COMPARE_TIMEFRAMES,
  TREND_PRIMARY_TIMEFRAMES,
  extractHistoryFilterOptions,
  filterComparableHistoryRuns,
  integrationEntries,
  integrationLabel,
  integrationReason,
  integrationStatusLabel,
  localizeAgreement,
  localizeDirection,
  localizeFreshness,
  localizeRegime,
  localizeStrength,
  localizeSummary,
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
  const [multiTimeframe, setMultiTimeframe] = useState<TrendMtfRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<TrendFeedback | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<TrendSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [historyDetailRunId, setHistoryDetailRunId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<{
    run: TrendRunSummary;
    snapshot: TrendSnapshot;
    comparison: Record<string, unknown>;
    multiTimeframe: TrendMtfRow[];
  } | null>(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const [historySymbolFilter, setHistorySymbolFilter] = useState('');
  const [historyTimeframeFilter, setHistoryTimeframeFilter] = useState('');
  const idempotencyRef = useRef<string | null>(null);

  const scheduledMonitoringState =
    overview?.scheduler?.scheduledMonitoringStatus === 'not_scheduled' ? 'not_scheduled' : 'active';

  const compareTimeframesConfigured = (settings?.compareTimeframes?.length ?? 0) > 0;
  const latestSnapshot = overview?.latestSnapshot ?? selectedSnapshot;

  useEffect(() => {
    if (settings?.symbol) setHistorySymbolFilter(settings.symbol);
    if (settings?.timeframe) setHistoryTimeframeFilter(settings.timeframe);
  }, [settings?.symbol, settings?.timeframe, settings?.version]);

  const historyFilterOptions = useMemo(() => extractHistoryFilterOptions(runs), [runs]);
  const historyChartSymbol = historySymbolFilter || settings?.symbol || 'BTC/USDT';
  const historyChartTimeframe = historyTimeframeFilter || settings?.timeframe || '1h';
  const filteredHistoryRuns = useMemo(
    () => filterComparableHistoryRuns(runs, historyChartSymbol, historyChartTimeframe),
    [runs, historyChartSymbol, historyChartTimeframe],
  );

  const loadOverview = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await fetchTrendOverview(agent.id);
      setOverview(data);
    } catch (e: unknown) {
      const err = e as Error;
      setLoadError(err?.message || t('trend_load_failed'));
    }
  }, [agent.id, t]);

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
      .then((d) => {
        setSelectedSnapshot(d.snapshot);
        setMultiTimeframe((d.multiTimeframe || []) as TrendMtfRow[]);
      })
      .catch(() => setFeedback({ state: 'load_failed' }));
  }, [agent.id, selectedRunId]);

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
      setHistoryDetail({ ...detail, multiTimeframe: (detail.multiTimeframe || []) as TrendMtfRow[] });
      setSelectedRunId(runId);
      setSelectedSnapshot(detail.snapshot);
      setMultiTimeframe((detail.multiTimeframe || []) as TrendMtfRow[]);
    } catch {
      setFeedback({ state: 'load_failed' });
      setHistoryDetailRunId(null);
    } finally {
      setHistoryDetailLoading(false);
    }
  };

  const closeHistoryDetail = () => {
    setHistoryDetailRunId(null);
    setHistoryDetail(null);
  };

  const executionBlockedFeedback = (): TrendFeedback => ({
    state: 'execution_blocked',
    detail:
      blockReason === 'CAPABILITY_DENIED'
        ? t('agents_permission_limited')
        : undefined,
  });

  const handleRunAnalysis = async (draft: TrendAnalyzeDraft) => {
    if (!settings) return;
    if (!guardExecution()) {
      setFeedback(executionBlockedFeedback());
      return;
    }
    if (!idempotencyRef.current) idempotencyRef.current = createTrendIdempotencyKey();
    setIsAnalyzing(true);
    setFeedback({ state: 'analysis_preparing' });
    try {
      setFeedback({ state: 'analysis_running' });
      const result = await runTrendAnalysis(agent.id, {
        symbol: draft.symbol,
        timeframe: draft.timeframe,
        compareTimeframes: draft.compareTimeframes,
        idempotencyKey: idempotencyRef.current,
      });
      idempotencyRef.current = null;
      setConfirmOpen(false);
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              latestSnapshot: result.snapshot,
              latestRun: result.run,
              metrics: {
                ...prev.metrics,
                totalRuns: prev.metrics.totalRuns + (result.idempotent ? 0 : 1),
              },
            }
          : prev,
      );
      setSelectedSnapshot(result.snapshot);
      setMultiTimeframe((result.multiTimeframe || []) as TrendMtfRow[]);
      if (!result.idempotent) await loadRuns();
      setFeedback({ state: 'analysis_completed' });
    } catch (e: unknown) {
      setFeedback(sanitizeTrendApiError(e, t));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsDraft || !settings) return;
    if (!guardExecution()) {
      setFeedback(executionBlockedFeedback());
      return;
    }
    setIsSavingSettings(true);
    setFeedback({ state: 'settings_saving' });
    try {
      const saved = await updateTrendSettings(agent.id, {
        symbol: settingsDraft.symbol,
        timeframe: settingsDraft.timeframe,
        compareTimeframes: settingsDraft.compareTimeframes,
        adxPeriod: settingsDraft.adxPeriod,
        smaPeriod: settingsDraft.smaPeriod,
        emaPeriod: settingsDraft.emaPeriod,
        trendLineLookback: settingsDraft.trendLineLookback,
        candleCount: settingsDraft.candleCount,
        version: settings.version,
      });
      setSettings(saved);
      setSettingsDraft(saved);
      setFeedback({ state: 'settings_saved' });
    } catch (e: unknown) {
      setFeedback(sanitizeTrendSettingsError(e, t));
    } finally {
      setIsSavingSettings(false);
    }
  };

  const metrics = useMemo(() => {
    const snap = latestSnapshot;
    if (!snap) return [];
    return [
      { id: 'symbol', label: t('symbol'), value: snap.symbol || t('not_available') },
      { id: 'timeframe', label: t('timeframe'), value: snap.timeframe || t('not_available') },
      { id: 'direction', label: t('trend_direction'), value: localizeDirection(snap.direction, t) },
      { id: 'regime', label: t('trend_regime'), value: localizeRegime(snap.regime, t) },
      {
        id: 'strength',
        label: t('trend_strength'),
        value: localizeStrength(snap.strengthClassification, t),
      },
      { id: 'adx', label: 'ADX', value: snap.adx?.value != null ? String(snap.adx.value) : t('not_available') },
      {
        id: 'freshness',
        label: t('trend_freshness'),
        value: localizeFreshness(snap, t, language),
      },
    ];
  }, [latestSnapshot, t, language]);

  const mtfRows: TrendMtfRow[] = useMemo(() => {
    const rows = [...multiTimeframe];
    if (latestSnapshot?.timeframe && !rows.some((r) => r.timeframe === latestSnapshot.timeframe)) {
      rows.unshift({
        timeframe: latestSnapshot.timeframe,
        snapshot: latestSnapshot,
        agreement: 'primary',
      });
    }
    return rows;
  }, [multiTimeframe, latestSnapshot]);

  const renderEvidenceList = (items: Array<Record<string, unknown>>, emptyKey: string) => {
    if (items.length === 0) {
      return <p className="text-xs text-slate-400">{t(emptyKey)}</p>;
    }
    return (
      <ul className="list-disc ps-5 space-y-1">
        {items.map((e, i) => (
          <li key={i}>{resolveEvidenceText(e, t)}</li>
        ))}
      </ul>
    );
  };

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
          message={t('no_trend_data')}
          testId="trend-overview-empty"
        />
      );
    }
    const summaryText = localizeSummary(latestSnapshot, t);
    return (
      <AgentContentSurface testId="trend-tab-panel">
        <AgentSectionHeader title={t('tab_overview')} />
        <AgentMetricGrid metrics={metrics} testId="trend-overview-metrics" />
        {summaryText ? <p className="text-sm text-slate-300 mt-4">{summaryText}</p> : null}
        {latestSnapshot.adx?.interpretationKey ? (
          <p className="text-xs text-slate-400 mt-2">{t(latestSnapshot.adx.interpretationKey)}</p>
        ) : null}
        {overview?.comparison?.available === true ? (
          <p className="text-xs text-slate-400 mt-2">
            {overview.comparison.regimeChanged ? t('trend_change') : t('trend_no_prior_comparison')}
          </p>
        ) : overview?.comparison?.available === false ? (
          <p className="text-xs text-slate-400 mt-2">{t('trend_no_prior_comparison')}</p>
        ) : null}
        <div className="mt-6">
          <h4 className="text-sm font-medium mb-2">{t('trend_chart_price_ma_title')}</h4>
          <TrendPriceMaChart
            series={latestSnapshot.chartSeries}
            symbol={latestSnapshot.symbol}
            timeframe={latestSnapshot.timeframe}
            direction={localizeDirection(latestSnapshot.direction, t)}
            t={t}
            locale={language}
          />
        </div>
      </AgentContentSurface>
    );
  };

  const renderSnapshotSection = (titleKey: string, testId: string, body: () => React.ReactNode) => (
    <AgentContentSurface testId={testId}>
      <AgentSectionHeader title={t(titleKey)} />
      {!latestSnapshot ? (
        <AgentEmptyState message={t('no_trend_data')} testId={`${testId}-empty`} />
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
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <StatusPill label={localizeRegime(latestSnapshot!.regime, t)} variant="info" />
              <StatusPill
                label={localizeStrength(latestSnapshot!.strengthClassification, t)}
                variant="primary"
              />
            </div>
            <p className="text-xs text-slate-400">{t('trend_regime_explanation')}</p>
            <div>
              <h4 className="font-medium mb-2">{t('trend_adx_chart_title')}</h4>
              <TrendAdxChart
                series={latestSnapshot!.chartSeries}
                currentAdx={latestSnapshot!.adx?.value}
                momentum={latestSnapshot!.adx?.momentum}
                t={t}
                locale={language}
              />
            </div>
            <p className="text-xs text-slate-400">
              {latestSnapshot!.adx?.interpretationKey
                ? t(latestSnapshot!.adx.interpretationKey)
                : t('trend_adx_unavailable')}
            </p>
          </div>
        ));
      case 'evidence':
        return renderSnapshotSection('trend_tab_evidence', 'trend-panel-evidence', () => (
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">{t('trend_supporting_evidence')}</h4>
              {renderEvidenceList(latestSnapshot!.supportingEvidence, 'trend_no_supporting_evidence')}
            </div>
            <div>
              <h4 className="font-medium mb-2">{t('trend_conflicting_evidence')}</h4>
              {renderEvidenceList(latestSnapshot!.conflictingEvidence, 'trend_no_conflicting_evidence')}
            </div>
          </div>
        ));
      case 'weakeningReversal':
        return renderSnapshotSection('trend_tab_weakening_reversal', 'trend-panel-weakeningReversal', () => {
          const weakening = latestSnapshot!.weakeningEvidence;
          const reversal = latestSnapshot!.reversalEvidence;
          if (weakening.length === 0 && reversal.length === 0) {
            return (
              <div className="space-y-2 text-sm text-slate-400">
                <p>{t('trend_no_weakening_evidence')}</p>
                <p>{t('trend_no_reversal_evidence')}</p>
              </div>
            );
          }
          return (
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">{t('trend_weakening_section')}</h4>
                {weakening.length === 0 ? (
                  <p className="text-xs text-slate-400">{t('trend_no_weakening_evidence')}</p>
                ) : (
                  weakening.map((w, i) => (
                    <TrendWeakeningReversalItem key={`w-${i}`} item={w} t={t} locale={language} />
                  ))
                )}
              </div>
              <div>
                <h4 className="font-medium mb-2">{t('trend_reversal_section')}</h4>
                {reversal.length === 0 ? (
                  <p className="text-xs text-slate-400">{t('trend_no_reversal_evidence')}</p>
                ) : (
                  reversal.map((r, i) => (
                    <TrendWeakeningReversalItem key={`r-${i}`} item={r} t={t} locale={language} />
                  ))
                )}
              </div>
            </div>
          );
        });
      case 'multiTimeframe':
        return (
          <AgentContentSurface testId="trend-panel-multiTimeframe">
            <AgentSectionHeader title={t('trend_tab_multi_timeframe')} />
            {!compareTimeframesConfigured ? (
              <div className="space-y-3" data-testid="trend-mtf-unavailable">
                <AgentEmptyState message={t('trend_mtf_unavailable')} />
                <SecondaryButton
                  onClick={() => handleTabChange('settings')}
                  data-testid="trend-mtf-configure-action"
                >
                  {t('trend_mtf_configure_action')}
                </SecondaryButton>
              </div>
            ) : !latestSnapshot ? (
              <AgentEmptyState message={t('no_trend_data')} testId="trend-panel-multiTimeframe-empty" />
            ) : mtfRows.length <= 1 ? (
              <AgentEmptyState message={t('trend_mtf_no_data')} testId="trend-mtf-empty" />
            ) : (
              <TrendMtfMatrix
                rows={mtfRows}
                primaryTimeframe={latestSnapshot.timeframe}
                t={t}
                locale={language}
              />
            )}
          </AgentContentSurface>
        );
      case 'history':
        return (
          <AgentContentSurface testId="trend-panel-history">
            <AgentSectionHeader title={t('trend_tab_history')} />
            {runs.length === 0 ? (
              <AgentEmptyState message={t('no_trend_data')} testId="trend-history-empty" />
            ) : (
              <div className="space-y-4">
                <div
                  className="flex flex-wrap gap-3 items-end text-sm"
                  data-testid="trend-history-filters"
                >
                  <label className="block">
                    <span className="text-xs text-slate-400">{t('symbol')}</span>
                    <select
                      className="mt-1 block rounded bg-slate-900 border border-white/10 px-2 py-1"
                      value={historyChartSymbol}
                      data-testid="trend-history-filter-symbol"
                      onChange={(e) => setHistorySymbolFilter(e.target.value)}
                    >
                      {(historyFilterOptions.symbols.length
                        ? historyFilterOptions.symbols
                        : [historyChartSymbol]
                      ).map((sym) => (
                        <option key={sym} value={sym}>
                          {sym}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-400">{t('timeframe')}</span>
                    <select
                      className="mt-1 block rounded bg-slate-900 border border-white/10 px-2 py-1"
                      value={historyChartTimeframe}
                      data-testid="trend-history-filter-timeframe"
                      onChange={(e) => setHistoryTimeframeFilter(e.target.value)}
                    >
                      {(historyFilterOptions.timeframes.length
                        ? historyFilterOptions.timeframes
                        : [historyChartTimeframe]
                      ).map((tf) => (
                        <option key={tf} value={tf}>
                          {tf}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-slate-400 pb-1">
                    {t('trend_history_chart_points')}: {filteredHistoryRuns.length}
                  </p>
                </div>
                <TrendHistoryTrendChart
                  runs={runs}
                  symbol={historyChartSymbol}
                  timeframe={historyChartTimeframe}
                  t={t}
                  locale={language}
                />
                <ul className="divide-y divide-white/5">
                  {runs.map((run) => (
                    <li key={run.runId} className="py-2 flex flex-col sm:flex-row sm:justify-between gap-2 text-sm">
                      <div>
                        <span dir="ltr">{run.symbol}</span> · <span dir="ltr">{run.timeframe}</span> ·{' '}
                        {localizeDirection(run.snapshotSummary?.direction as string, t)}
                        <span className="text-slate-400 ms-2">
                          · {t(`trend_run_status_${run.status}`) || run.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">
                          {new Date(run.startedAt).toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US')}
                        </span>
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          data-testid={`trend-history-row-${run.runId}`}
                          onClick={() => openHistoryDetail(run.runId)}
                        >
                          {t('trend_history_view_detail')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AgentContentSurface>
        );
      case 'settings':
        return (
          <AgentContentSurface testId="trend-panel-settings">
            <AgentSectionHeader title={t('tab_settings')} />
            {!settingsDraft || !settings ? (
              <AgentLoadingState message={t('loading')} />
            ) : (
              <div className="space-y-4 max-w-md">
                <label className="block text-sm">
                  {t('symbol')}
                  <input
                    className="mt-1 w-full rounded bg-slate-900 border border-white/10 px-3 py-2"
                    value={settingsDraft.symbol}
                    dir="ltr"
                    onChange={(e) => setSettingsDraft({ ...settingsDraft, symbol: e.target.value })}
                    data-testid="trend-settings-symbol"
                  />
                </label>
                <label className="block text-sm">
                  {t('timeframe')}
                  <select
                    className="mt-1 w-full rounded bg-slate-900 border border-white/10 px-3 py-2"
                    value={settingsDraft.timeframe}
                    onChange={(e) => {
                      const timeframe = e.target.value;
                      setSettingsDraft({
                        ...settingsDraft,
                        timeframe,
                        compareTimeframes: settingsDraft.compareTimeframes.filter((tf) => tf !== timeframe),
                      });
                    }}
                    data-testid="trend-settings-timeframe"
                  >
                    {TREND_PRIMARY_TIMEFRAMES.map((tf) => (
                      <option key={tf} value={tf}>
                        {tf}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="block text-sm space-y-2" data-testid="trend-settings-compare-timeframes">
                  <legend>{t('trend_compare_timeframes')}</legend>
                  <p className="text-xs text-slate-400">{t('trend_compare_timeframes_help')}</p>
                  <div className="flex flex-wrap gap-3">
                    {TREND_COMPARE_TIMEFRAMES.filter((tf) => tf !== settingsDraft.timeframe).map((tf) => {
                      const selected = settingsDraft.compareTimeframes.includes(tf);
                      return (
                        <label key={tf} className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={!selected && settingsDraft.compareTimeframes.length >= 3}
                            data-testid={`trend-settings-compare-${tf}`}
                            onChange={() => {
                              const next = selected
                                ? settingsDraft.compareTimeframes.filter((x) => x !== tf)
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
                <div className="rounded border border-white/10 p-3 text-xs text-slate-400 space-y-1">
                  <p className="font-medium text-slate-300">{t('trend_settings_effective')}</p>
                  <p>
                    {t('symbol')}: <span dir="ltr">{settings.symbol}</span> · {t('timeframe')}:{' '}
                    <span dir="ltr">{settings.timeframe}</span>
                  </p>
                  <p>
                    {t('trend_compare_timeframes')}:{' '}
                    {settings.compareTimeframes.length
                      ? settings.compareTimeframes.join(', ')
                      : t('trend_compare_none')}
                  </p>
                </div>
                <p className="text-xs text-slate-400">{t('trend_auto_execute_blocked')}</p>
                <PrimaryButton
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  data-testid="trend-settings-save"
                >
                  {isSavingSettings ? t('saving') || t('loading') : t('save')}
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
                              : entry.status === 'not_scheduled'
                                ? 'neutral'
                                : 'warning'
                          }
                        />
                      </div>
                      {reason ? <p className="text-xs text-slate-400">{reason}</p> : null}
                    </li>
                  );
                })}
                <li className="rounded border border-white/10 p-3 text-xs text-slate-400">
                  {t('trend_agent_state_limited_explanation')}
                </li>
              </ul>
            )}
          </AgentContentSurface>
        );
      default:
        return null;
    }
  };

  const dismissibleFeedback =
    feedback &&
    ['analysis_completed', 'settings_saved', 'stale_data'].includes(feedback.state);

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
              title={t('trend_history_detail_title')}
              closeLabel={t('close')}
              onClose={closeHistoryDetail}
              layerTestId="trend-history-detail-layer"
              panelTestId="trend-history-detail-panel"
            >
              {historyDetailLoading || !historyDetail ? (
                <AgentLoadingState message={t('loading')} testId="trend-history-detail-loading" />
              ) : (
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-slate-400">{t('trend_history_run_id')}:</span>{' '}
                    <span dir="ltr">{historyDetail.run.runId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{t('trend_history_status')}:</span>{' '}
                    {t(`trend_run_status_${historyDetail.run.status}`) || historyDetail.run.status}
                  </div>
                  <div>
                    <span className="text-slate-400">{t('trend_freshness')}:</span>{' '}
                    {localizeFreshness(historyDetail.snapshot, t, language)}
                  </div>
                  {historyDetail.run.errorMessage ? (
                    <DataHubAlert variant="error" message={historyDetail.run.errorMessage} />
                  ) : null}
                  <TrendRunComparisonPanel
                    comparison={historyDetail.comparison}
                    snapshot={historyDetail.snapshot}
                    t={t}
                    locale={language}
                  />
                  <div>
                    <h4 className="font-medium">{t('trend_supporting_evidence')}</h4>
                    {renderEvidenceList(
                      historyDetail.snapshot.supportingEvidence,
                      'trend_no_supporting_evidence',
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
              savedSettings={settings}
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
              label={t('trend_run_analysis')}
              onClick={() => {
                if (!guardExecution()) {
                  setFeedback(executionBlockedFeedback());
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
            tabs={TAB_ITEMS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) }))}
            activeTab={activeTab}
            onTabChange={(id) => handleTabChange(id as TrendAgentSection)}
            ariaLabel={t('trend_sections')}
            testId="trend-section-nav"
            idPrefix="trend"
          />
        }
        testId="agent-product-dialog"
      >
        <div className="space-y-3" data-testid="trend-workspace">
          {feedback ? (
            <TrendFeedbackBanner
              feedback={feedback}
              t={t}
              onDismiss={dismissibleFeedback ? () => setFeedback(null) : undefined}
              dismissLabel={t('close')}
            />
          ) : null}
          {renderPanel()}
        </div>
      </AgentProductDialog>
    </div>
  );
};

export default TrendWorkspace;
