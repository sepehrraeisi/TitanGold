import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import {
  fetchMexcCapabilitySummary,
  fetchMexcVerificationHistory,
  saveMexcConnection,
  deleteMexcConnection,
  type MexcCapabilitySummary,
  type MexcVerificationHistoryItem,
  type SafeConnectionDto,
} from '../../../services/connectionsApi.ts';
import {
  getAuthStateLabel,
  getCapabilityConsumerStatusLabel,
  getCapabilityLabel,
  getConsumerLabel,
  getGroupLabel,
  getKeyGrantLabel,
  getOperationalStateLabel,
  getProviderSupportLabel,
  getVerificationLabel,
} from '../../../utils/mexcDisplayLabels.ts';
import {
  formatUsedBySummary,
  productStatusFromCapability,
  selectCapabilityProductReason,
  selectConsumerProductReason,
  selectGroupProductReason,
  translateReasonKind,
} from '../../../utils/mexcReasonPriority.ts';
import { buildMexcProviderSummary } from '../../../utils/mexcProviderSummary.ts';
import {
  buildMexcManageNavigation,
  normalizeMexcManageSection,
  type MexcManageSection,
} from '../../../utils/settingsNavigation.ts';
import { readStateFromURL } from '../../../utils/urlSync.ts';
import type { OnNavigateHandler } from '../../../types/navigation.ts';
import { DataHubSubTabBar } from '../../ai/AIManager/tabs/DataHub/dataHubUi.tsx';
import {
  GROUP_ORDER,
  PRIMARY_CONSUMER_IDS,
  StatePill,
  consumerEligibilityLabel,
  formatDuration,
  formatLocalizedDateTime,
  productStatusLabel,
  toneForProductStatus,
  type DraftSecrets,
} from './mexcPanelShared.tsx';

interface Props {
  connection: SafeConnectionDto;
  onChanged: () => Promise<void> | void;
  onClose: () => void;
  onNavigate?: OnNavigateHandler;
  initialSection?: string;
}

const HISTORY_FILTERS = ['all', 'verified', 'warning', 'failed', 'corrected'] as const;

function clearDraftSecrets(setDraft: React.Dispatch<React.SetStateAction<DraftSecrets>>, setShowSecrets: (v: boolean) => void) {
  setDraft({ apiKey: '', apiSecret: '' });
  setShowSecrets(false);
}

export default function MexcConnectionPanel({
  connection,
  onChanged,
  onClose,
  onNavigate,
  initialSection,
}: Props) {
  const { t, language } = useLanguage();
  const [summary, setSummary] = useState<MexcCapabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftSecrets>({ apiKey: '', apiSecret: '' });
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [showTechnical, setShowTechnical] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [expandedConsumers, setExpandedConsumers] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<MexcManageSection>(() =>
    normalizeMexcManageSection(initialSection || readStateFromURL()?.section),
  );
  const [historyFilter, setHistoryFilter] = useState<(typeof HISTORY_FILTERS)[number]>('all');
  const [historyItems, setHistoryItems] = useState<MexcVerificationHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const dirty = Boolean(draft.apiKey.trim() || draft.apiSecret.trim());
  const canSave = Boolean(draft.apiKey.trim() && draft.apiSecret.trim()) && !saving;

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMexcCapabilitySummary();
      setSummary(data);
    } catch (error: any) {
      setMessage({ type: 'error', text: t(error?.message || 'connections_internal_error') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    return () => {
      clearDraftSecrets(setDraft, setShowSecrets);
    };
  }, []);

  useEffect(() => {
    const syncFromUrl = () => {
      const section = normalizeMexcManageSection(readStateFromURL()?.section || initialSection);
      setActiveSection((prev) => {
        if (prev !== section) {
          clearDraftSecrets(setDraft, setShowSecrets);
          setCredentialsOpen(false);
        }
        return section;
      });
    };
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, [initialSection]);

  useEffect(() => {
    if (activeSection !== 'history') return;
    let cancelled = false;
    setHistoryLoading(true);
    (async () => {
      try {
        const data = await fetchMexcVerificationHistory(historyFilter);
        if (!cancelled) setHistoryItems(data.items || []);
      } catch (error: any) {
        if (!cancelled) {
          setHistoryItems([]);
          setMessage({ type: 'error', text: t(error?.message || 'connections_internal_error') });
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSection, historyFilter, t]);

  const navigateSection = (section: string) => {
    const normalized = normalizeMexcManageSection(section);
    if (normalized !== activeSection) {
      clearDraftSecrets(setDraft, setShowSecrets);
      setCredentialsOpen(false);
      setConfirmDelete(false);
    }
    setActiveSection(normalized);
    if (onNavigate) {
      onNavigate(buildMexcManageNavigation(normalized));
    }
  };

  const projection = useMemo(
    () => buildMexcProviderSummary({ connection, summary }),
    [connection, summary],
  );

  const grouped = useMemo(() => {
    const caps = summary?.capabilityMatrix?.capabilities || [];
    const map: Record<string, typeof caps> = {};
    for (const cap of caps) {
      const g = cap.group || 'Other';
      if (!map[g]) map[g] = [];
      map[g].push(cap);
    }
    return map;
  }, [summary]);

  const groupSummaries = useMemo(() => {
    return GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => {
      const caps = grouped[group];
      let available = 0;
      let pending = 0;
      let blocked = 0;
      let unavailable = 0;
      for (const cap of caps) {
        const status = productStatusFromCapability(cap);
        if (status === 'available') available += 1;
        else if (status === 'pending') pending += 1;
        else if (status === 'unavailable') unavailable += 1;
        else blocked += 1;
      }
      return {
        group,
        total: caps.length,
        available,
        pending,
        blocked,
        unavailable,
        primaryKind: selectGroupProductReason(caps),
        caps,
      };
    });
  }, [grouped]);

  const usedBySummary = useMemo(() => {
    const list = summary?.usedByConsumers?.length
      ? summary.usedByConsumers
      : (summary?.consumers || []).map((c) => ({
          consumerId: c.consumerId,
          displayName: c.displayName,
        }));
    return formatUsedBySummary(list, t, getConsumerLabel, 8);
  }, [summary, t]);

  const handleSave = async () => {
    if (!canSave) return;
    try {
      setSaving(true);
      await saveMexcConnection({
        apiKey: draft.apiKey.trim(),
        apiSecret: draft.apiSecret.trim(),
        isTestnet: false,
      });
      clearDraftSecrets(setDraft, setShowSecrets);
      setCredentialsOpen(false);
      setMessage({ type: 'info', text: t('connections_saved_untested') });
      await onChanged();
      await loadSummary();
    } catch (error: any) {
      setMessage({ type: 'error', text: t(error?.message || 'connections_internal_error') });
    } finally {
      setSaving(false);
    }
  };

  const handleCredentialCancel = () => {
    clearDraftSecrets(setDraft, setShowSecrets);
    setCredentialsOpen(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteMexcConnection();
      clearDraftSecrets(setDraft, setShowSecrets);
      setMessage({ type: 'info', text: t('connection_deleted') });
      await onChanged();
      onClose();
    } catch (error: any) {
      setMessage({ type: 'error', text: t(error?.message || 'connections_internal_error') });
    } finally {
      setConfirmDelete(false);
    }
  };

  const dir = language === 'fa' ? 'rtl' : 'ltr';
  const credentialAge = formatDuration(projection.credentialAgeHint, language, t);
  const lastRotation = formatLocalizedDateTime(projection.lastRotationAt, language, t);

  const primaryConsumers = useMemo(() => {
    const list = summary?.consumers || [];
    const byId = new Map(list.map((c) => [c.consumerId, c]));
    return PRIMARY_CONSUMER_IDS.map((id) => byId.get(id)).filter(Boolean) as typeof list;
  }, [summary]);

  const overallLabel = t(projection.overallStatusLabelKey);

  const capabilityById = useMemo(() => {
    const map = new Map<string, NonNullable<MexcCapabilitySummary['capabilityMatrix']>['capabilities'][number]>();
    for (const cap of summary?.capabilityMatrix?.capabilities || []) {
      map.set(cap.capabilityId, cap);
    }
    return map;
  }, [summary]);

  const sectionItems = useMemo(
    () => [
      { id: 'overview', label: t('mexc_section_overview') },
      { id: 'credentials', label: t('mexc_section_credentials') },
      { id: 'capabilities', label: t('mexc_section_capabilities') },
      { id: 'consumers', label: t('mexc_section_consumers') },
      { id: 'history', label: t('mexc_section_history') },
      { id: 'danger', label: t('mexc_section_danger'), activeVariant: 'warning' as const },
    ],
    [t],
  );

  const runtimeDemo = summary?.runtime?.realSideEffectsAllowed === false;
  const runtimeLiveImpossible = summary?.runtime?.liveImpossible !== false;

  return (
    <div
      className="space-y-4 border-t border-white/5 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 p-4"
      data-testid="mexc-connection-panel"
      data-technical-default="false"
      data-active-section={activeSection}
      dir={dir}
    >
      <DataHubSubTabBar
        items={sectionItems}
        activeId={activeSection}
        onChange={navigateSection}
        ariaLabel={t('mexc_sections_nav')}
        className="mb-2"
      />

      {activeSection === 'overview' && (
        <section className="space-y-3" aria-labelledby="mexc-overview-title" data-testid="mexc-section-overview">
          <h4 id="mexc-overview-title" className="sr-only">{t('mexc_section_overview')}</h4>
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4">
            <p className="sr-only">{t('mexc_details')}</p>
            <StatePill
              label={overallLabel}
              tone={projection.privateAuthenticationStatus === 'verified' ? 'ok' : 'warn'}
            />
            <p className="sr-only" data-testid="mexc-overall-state">
              {overallLabel}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-white/5 bg-slate-950/50 p-3">
              <p className="mb-1 text-[11px] text-slate-400">{t('mexc_overview_connection')}</p>
              <p className="text-sm font-semibold text-slate-100">{overallLabel}</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-slate-950/50 p-3">
              <p className="mb-1 text-[11px] text-emerald-300/80">{t('mexc_public_market')}</p>
              <p className="text-sm font-semibold text-emerald-100" data-testid="mexc-public-spot">
                {projection.publicMarketStatus === 'available' ? t('mexc_available') : t('mexc_unknown')}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-slate-950/50 p-3">
              <p className="mb-1 text-[11px] text-blue-300/80">{t('mexc_private_auth')}</p>
              <p className="text-sm font-semibold text-blue-100" data-testid="mexc-private-auth">
                {projection.privateAuthenticationStatus === 'verified'
                  ? t('mexc_authenticated')
                  : getAuthStateLabel(summary?.connection?.authState, t)}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-slate-950/50 p-3">
              <p className="mb-1 text-[11px] text-slate-400">{t('mexc_overview_read_capabilities')}</p>
              <p className="text-sm text-slate-100">
                {t('mexc_card_verified_reads')}: {projection.verifiedPrivateReadCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {projection.capabilityCounts.available} {t('mexc_status_available').toLowerCase()} ·{' '}
                {projection.capabilityCounts.pending} {t('mexc_status_pending').toLowerCase()} ·{' '}
                {projection.capabilityCounts.blocked} {t('mexc_status_blocked').toLowerCase()}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-slate-950/50 p-3">
              <p className="mb-1 text-[11px] text-slate-400">{t('mexc_overview_wallet_readiness')}</p>
              <p className="text-sm text-slate-100">
                {projection.walletReadiness === 'ready'
                  ? t('mexc_status_available')
                  : projection.walletReadiness === 'limited'
                    ? t('mexc_limited')
                    : projection.walletReadiness === 'blocked'
                      ? t('mexc_blocked')
                      : t('mexc_unknown')}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-slate-950/50 p-3" data-testid="mexc-runtime-execution">
              <p className="mb-1 text-[11px] text-slate-400">{t('mexc_overview_runtime_execution')}</p>
              <ul className="space-y-0.5 text-[11px] text-slate-300">
                <li>{runtimeDemo ? t('mexc_demo_active') : t('mexc_execution_unavailable')}</li>
                <li>{t('mexc_emergency_stop_active')}</li>
                <li>{runtimeLiveImpossible ? t('mexc_live_impossible') : t('mexc_execution_unavailable')}</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
            <span data-testid="mexc-last-verified">
              {t('mexc_latest_successful_verification')}:{' '}
              {formatLocalizedDateTime(projection.lastSuccessfulVerificationAt, language, t)}
            </span>
            <span data-testid="mexc-last-attempt">
              {t('mexc_last_attempt')}: {formatLocalizedDateTime(projection.lastAttemptAt, language, t)}
            </span>
            {projection.latestSafeWarningKey && !showTechnical && (
              <span data-testid="mexc-last-failure-safe">{t(projection.latestSafeWarningKey)}</span>
            )}
            {projection.latestSafeWarningCode && showTechnical && (
              <span data-testid="mexc-last-failure" className="font-mono ltr" dir="ltr" data-technical-code="true">
                {t('mexc_last_failure')}: {projection.latestSafeWarningCode}
              </span>
            )}
          </div>

          {usedBySummary.total > 0 && (
            <p className="text-xs text-slate-400" data-testid="mexc-used-by">
              {t(usedBySummary.labelKey)}: {usedBySummary.text}
            </p>
          )}

          <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-verify-title">
            <h4 id="mexc-verify-title" className="text-sm font-semibold text-white">
              {t('mexc_verification')}
            </h4>
            <p className="mt-1 text-xs text-slate-400" data-testid="connections-private-verification-unavailable">
              {t('mexc_verification_gated')}
            </p>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={t('mexc_verification_gated')}
              className="mt-3 cursor-not-allowed rounded-md bg-slate-700 px-3 py-2 text-sm text-slate-400"
              data-testid="mexc-test-connection-disabled"
            >
              {t('mexc_test_connection')}
            </button>
          </section>
        </section>
      )}

      {activeSection === 'credentials' && (
        <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-cred-title" data-testid="mexc-section-credentials">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 id="mexc-cred-title" className="text-sm font-semibold text-white">
              {t('mexc_credentials')}
            </h4>
            <button
              type="button"
              className="text-[11px] text-indigo-300 hover:text-indigo-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
              onClick={() => {
                if (credentialsOpen) {
                  handleCredentialCancel();
                } else {
                  clearDraftSecrets(setDraft, setShowSecrets);
                  setCredentialsOpen(true);
                }
              }}
              aria-expanded={credentialsOpen}
              data-testid="mexc-credentials-toggle"
            >
              {credentialsOpen ? t('mexc_hide_credentials') : t('mexc_rotate_credentials')}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500" data-testid="mexc-credential-meta">
            <span data-testid="mexc-credential-age">
              {t('mexc_credential_age')}: {credentialAge}
            </span>
            <span data-testid="mexc-last-rotation">
              {t('mexc_last_rotation')}: {lastRotation}
            </span>
            {projection.maskedKeyIdentifier && (
              <span className="font-mono ltr" dir="ltr">
                {t('connections_masked_key')}: {projection.maskedKeyIdentifier}
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{t('mexc_ip_restriction_guidance')}</p>
          <p className="mt-1 text-xs text-slate-400">
            {connection.credentialStatus || connection.status || t('connections_not_configured')}
          </p>

          {!credentialsOpen && (
            <p className="mt-2 text-xs text-slate-400">{t('mexc_credentials_collapsed_hint')}</p>
          )}

          {credentialsOpen && (
            <>
              <p className="mt-1 text-xs text-slate-400">{t('mexc_credentials_hint')}</p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-300" htmlFor="mexc-api-key">
                    {t('mexc_api_key')}
                  </label>
                  <input
                    id="mexc-api-key"
                    type="text"
                    autoComplete="off"
                    value={draft.apiKey}
                    onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
                    placeholder={connection.configured ? t('connections_leave_blank_rotate') : t('enter_api_key')}
                    className="w-full rounded-md border border-white/10 bg-slate-950/70 p-2 text-sm text-white ltr focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                    dir="ltr"
                    data-testid="mexc-api-key"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-300" htmlFor="mexc-api-secret">
                    {t('api_secret')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="mexc-api-secret"
                      type={showSecrets ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={draft.apiSecret}
                      onChange={(e) => setDraft((d) => ({ ...d, apiSecret: e.target.value }))}
                      placeholder={t('enter_api_secret')}
                      className="w-full rounded-md border border-white/10 bg-slate-950/70 p-2 text-sm text-white ltr focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                      dir="ltr"
                      data-testid="mexc-api-secret"
                    />
                    <button
                      type="button"
                      className="rounded border border-white/10 px-2 text-xs text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                      onClick={() => setShowSecrets((s) => !s)}
                    >
                      {showSecrets ? t('hide') : t('show')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2" data-testid="mexc-credential-actions">
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={handleSave}
                  data-testid="connection-save-MEXC"
                  title={!canSave ? t('mexc_save_disabled_hint') : undefined}
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
                >
                  {connection.configured ? t('mexc_rotate_credentials') : t('save_changes')}
                </button>
                <button
                  type="button"
                  onClick={handleCredentialCancel}
                  data-testid="connection-cancel-MEXC"
                  className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                >
                  {t('cancel')}
                </button>
                {!dirty && (
                  <span className="self-center text-[11px] text-slate-500">{t('mexc_save_disabled_hint')}</span>
                )}
              </div>
            </>
          )}

          <div className="mt-4 border-t border-white/5 pt-3">
            <p className="text-xs text-slate-400" data-testid="connections-private-verification-unavailable">
              {t('mexc_verification_gated')}
            </p>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={t('mexc_verification_gated')}
              className="mt-2 cursor-not-allowed rounded-md bg-slate-700 px-3 py-2 text-sm text-slate-400"
              data-testid="mexc-test-connection-disabled"
            >
              {t('mexc_test_connection')}
            </button>
          </div>
        </section>
      )}

      {activeSection === 'capabilities' && (
        <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-matrix-title" data-testid="mexc-section-capabilities">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 id="mexc-matrix-title" className="text-sm font-semibold text-white">
              {t('mexc_capability_matrix')}
            </h4>
            <button
              type="button"
              className="text-[11px] text-indigo-300 hover:text-indigo-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
              onClick={() => setShowTechnical((s) => !s)}
              aria-pressed={showTechnical}
              data-testid="mexc-matrix-technical-toggle"
            >
              {showTechnical ? t('mexc_hide_technical') : t('mexc_show_technical')}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">{t('mexc_capability_matrix_hint')}</p>
          {loading ? (
            <p className="mt-3 text-sm text-slate-400">{t('loading')}</p>
          ) : (
            <div className="mt-3 space-y-2" data-testid="mexc-capability-matrix">
              {groupSummaries.map(({ group, total, available, pending, blocked, unavailable, primaryKind, caps }) => {
                const open = Boolean(expandedGroups[group]);
                return (
                  <div key={group} className="rounded-lg border border-white/5 bg-slate-950/40" data-testid={`mexc-cap-group-${group}`}>
                    <button
                      type="button"
                      className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                      onClick={() => setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }))}
                      aria-expanded={open}
                      data-testid={`mexc-cap-group-toggle-${group}`}
                    >
                      <span className="text-xs font-medium text-slate-200">{getGroupLabel(group, t)}</span>
                      <span className="flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                        <StatePill label={`${total} ${t('mexc_capabilities_count')}`} tone="neutral" />
                        {available > 0 && <StatePill label={`${available} ${t('mexc_status_available').toLowerCase()}`} tone="ok" />}
                        {pending > 0 && <StatePill label={`${pending} ${t('mexc_status_pending').toLowerCase()}`} tone="warn" />}
                        {blocked > 0 && <StatePill label={`${blocked} ${t('mexc_status_blocked').toLowerCase()}`} tone="bad" />}
                        {unavailable > 0 && <StatePill label={`${unavailable} ${t('mexc_status_unavailable').toLowerCase()}`} tone="neutral" />}
                      </span>
                    </button>
                    {!open && primaryKind && (
                      <p className="border-t border-white/5 px-3 py-2 text-[11px] text-amber-200/80" data-testid={`mexc-cap-group-reason-${group}`}>
                        {translateReasonKind(primaryKind, t)}
                      </p>
                    )}
                    {open && (
                      <div className="space-y-2 border-t border-white/5 p-2">
                        {caps.map((cap) => {
                          const status = productStatusFromCapability(cap);
                          const reasonKind = selectCapabilityProductReason(cap);
                          const schemaWarning = Boolean(
                            cap.capabilityId === 'WALLET_CURRENCY_READ'
                            && (cap.dataContractState === 'warning' || cap.dataContractState === 'incompatible'),
                          );
                          const permissionIncomplete = Boolean(
                            cap.capabilityId === 'WALLET_CURRENCY_READ'
                            && cap.keyGrant === 'granted'
                            && (cap.verificationState === 'verification_error'
                              || (cap as any).directEndpointVerified === false),
                          );
                          return (
                            <div
                              key={cap.capabilityId}
                              className="rounded-lg border border-white/5 bg-slate-950/50 p-3"
                              data-testid={`mexc-cap-${cap.capabilityId}`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm text-slate-100">
                                  {getCapabilityLabel(cap.capabilityId, t)}
                                </span>
                                <StatePill label={productStatusLabel(status, t)} tone={toneForProductStatus(status)} />
                              </div>
                              {(status !== 'available' || schemaWarning || permissionIncomplete) && (
                                <p className="mt-2 text-xs text-amber-200/90" data-testid={`mexc-cap-reason-${cap.capabilityId}`}>
                                  {translateReasonKind(
                                    permissionIncomplete
                                      ? 'wallet_permission_available_incomplete'
                                      : schemaWarning
                                        ? 'wallet_schema_warning'
                                        : reasonKind,
                                    t,
                                  )}
                                </p>
                              )}
                              {permissionIncomplete && (
                                <div className="mt-1 space-y-0.5 text-[11px] text-slate-400" data-testid={`mexc-cap-wallet-permission-${cap.capabilityId}`}>
                                  <p>{t('mexc_reason_wallet_permission_available_incomplete')}</p>
                                  <p>{t('mexc_wallet_structures_unsupported')}</p>
                                </div>
                              )}
                              {schemaWarning && !permissionIncomplete && (
                                <p className="mt-1 text-[11px] text-slate-400" data-testid={`mexc-cap-access-${cap.capabilityId}`}>
                                  {t('mexc_wallet_structures_unsupported')}
                                </p>
                              )}
                              <p className="mt-1 text-[11px] text-slate-500" data-testid={`mexc-cap-last-checked-${cap.capabilityId}`}>
                                {t('mexc_last_checked')}:{' '}
                                {((cap as any).lastAttemptAt || cap.lastVerifiedAt)
                                  ? formatLocalizedDateTime((cap as any).lastAttemptAt || cap.lastVerifiedAt, language, t)
                                  : t('mexc_never_checked')}
                              </p>
                              {showTechnical && (
                                <div className="mt-2 space-y-1 border-t border-white/5 pt-2 text-[11px] text-slate-400" data-testid={`mexc-cap-tech-${cap.capabilityId}`}>
                                  <p>
                                    {t('mexc_provider')}: {getProviderSupportLabel(cap.providerSupport, t)}
                                  </p>
                                  <p>
                                    {t('mexc_key_grant')}: {getKeyGrantLabel(cap.keyGrant, t)}
                                  </p>
                                  <p>
                                    {t('mexc_verification_state')}: {getVerificationLabel(cap.verificationState, t)}
                                  </p>
                                  <p>
                                    {t('mexc_last_attempt_at')}:{' '}
                                    {(cap as any).lastAttemptAt
                                      ? formatLocalizedDateTime((cap as any).lastAttemptAt, language, t)
                                      : '—'}
                                  </p>
                                  <p>
                                    {t('mexc_last_verified_at')}:{' '}
                                    {cap.lastVerifiedAt
                                      ? formatLocalizedDateTime(cap.lastVerifiedAt, language, t)
                                      : 'null'}
                                  </p>
                                  <p>
                                    {t('mexc_operational')}: {getOperationalStateLabel(cap.operationalState, t)}
                                  </p>
                                  {cap.dataContractState && cap.dataContractState !== 'not_applicable' && (
                                    <p data-testid={`mexc-cap-data-contract-${cap.capabilityId}`}>
                                      {t('mexc_data_contract_state')}: {cap.dataContractState}
                                    </p>
                                  )}
                                  {cap.dataContractWarningCode && (
                                    <p className="font-mono text-[10px] text-slate-500 ltr" dir="ltr" data-technical-code="true" data-testid={`mexc-cap-warning-code-${cap.capabilityId}`}>
                                      {t('mexc_technical_warning_code')}: {cap.dataContractWarningCode}
                                    </p>
                                  )}
                                  <p className="font-mono text-[10px] text-slate-500 ltr" dir="ltr" data-technical-code="true" data-testid={`mexc-cap-code-${cap.capabilityId}`}>
                                    {t('mexc_technical_code')}: {cap.capabilityId}
                                  </p>
                                  <p className="font-mono text-[10px] text-slate-500 ltr" dir="ltr" data-technical-value="true" data-testid={`mexc-cap-tech-value-${cap.capabilityId}`}>
                                    {t('mexc_technical_verification_value')}: {cap.verificationState}
                                  </p>
                                  <p className="font-mono text-[10px] text-slate-500 ltr" dir="ltr" data-technical-value="true">
                                    {t('mexc_technical_operational_value')}: {cap.operationalState}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeSection === 'consumers' && (
        <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-consumers-title" data-testid="mexc-section-consumers">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 id="mexc-consumers-title" className="text-sm font-semibold text-white">
              {t('mexc_consumers')}
            </h4>
            <button
              type="button"
              className="text-[11px] text-indigo-300 hover:text-indigo-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
              onClick={() => setShowTechnical((s) => !s)}
              aria-pressed={showTechnical}
              data-testid="mexc-consumers-technical-toggle"
            >
              {showTechnical ? t('mexc_hide_technical') : t('mexc_show_technical')}
            </button>
          </div>
          <div className="mt-3 space-y-2" data-testid="mexc-consumers">
            {primaryConsumers.map((c) => {
              const consumerOpen = Boolean(expandedConsumers[c.consumerId]);
              const eligibility = consumerEligibilityLabel(c as any, t);
              const reasonKind = selectConsumerProductReason(c as any, capabilityById);
              return (
                <div
                  key={c.consumerId}
                  className="rounded-lg border border-white/5 bg-slate-950/50 p-3"
                  data-testid={`mexc-consumer-${c.consumerId}`}
                  data-consumer-expanded={consumerOpen ? 'true' : 'false'}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-slate-100">
                      {getConsumerLabel(c.consumerId, c.displayName, t)}
                    </span>
                    <StatePill label={eligibility.label} tone={eligibility.tone} />
                  </div>
                  {(!c.eligible || c.consumerReadiness === 'limited' || c.limitedByDataContract) && (
                    <p className="mt-1 text-xs text-amber-200/90" data-testid={`mexc-consumer-reason-${c.consumerId}`}>
                      {translateReasonKind(reasonKind, t)}
                    </p>
                  )}
                  <button
                    type="button"
                    className="mt-2 text-[11px] text-indigo-300 hover:text-indigo-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                    onClick={() =>
                      setExpandedConsumers((prev) => ({ ...prev, [c.consumerId]: !prev[c.consumerId] }))
                    }
                    aria-expanded={consumerOpen}
                    data-testid={`mexc-consumer-details-${c.consumerId}`}
                  >
                    {consumerOpen ? t('mexc_hide_details') : t('mexc_show_details')}
                  </button>
                  {consumerOpen && (
                    <div className="mt-2 space-y-2 text-[11px] text-slate-400" data-testid={`mexc-consumer-expanded-${c.consumerId}`}>
                      <div>
                        <p className="mb-1 font-medium text-slate-300">{t('mexc_required_capabilities')}</p>
                        <ul className="space-y-2">
                          {(c.requiredCapabilities || []).map((id) => {
                            const matrixCap = capabilityById.get(id);
                            return (
                              <li key={id} className="space-y-0.5" data-testid={`mexc-consumer-req-${c.consumerId}-${id}`}>
                                <div className="flex flex-wrap items-baseline gap-2">
                                  <span className="text-slate-200">{getCapabilityLabel(id, t)}</span>
                                  {showTechnical && (
                                    <span className="font-mono text-[10px] text-slate-500 ltr" dir="ltr" data-technical-code="true">
                                      {id}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-amber-200/80">
                                  {getCapabilityConsumerStatusLabel(id, matrixCap, t)}
                                </p>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeSection === 'history' && (
        <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-history-title" data-testid="mexc-section-history">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 id="mexc-history-title" className="text-sm font-semibold text-white">
              {t('mexc_section_history')}
            </h4>
            <button
              type="button"
              className="text-[11px] text-indigo-300 hover:text-indigo-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
              onClick={() => setShowTechnical((s) => !s)}
              aria-pressed={showTechnical}
              data-testid="mexc-history-technical-toggle"
            >
              {showTechnical ? t('mexc_hide_technical') : t('mexc_show_technical')}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
            <span>
              {t('mexc_latest_successful_verification')}:{' '}
              {formatLocalizedDateTime(projection.lastSuccessfulVerificationAt, language, t)}
            </span>
            <span>
              {t('mexc_last_attempt')}: {formatLocalizedDateTime(projection.lastAttemptAt, language, t)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label={t('mexc_section_history')}>
            {HISTORY_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={historyFilter === f}
                className={`rounded-md border px-2 py-1 text-[11px] ${
                  historyFilter === f
                    ? 'border-indigo-400/50 bg-indigo-500/10 text-indigo-200'
                    : 'border-white/10 text-slate-400 hover:bg-white/5'
                }`}
                onClick={() => setHistoryFilter(f)}
                data-testid={`mexc-history-filter-${f}`}
              >
                {t(`mexc_history_filter_${f}`)}
              </button>
            ))}
          </div>

          {historyLoading ? (
            <p className="mt-3 text-sm text-slate-400">{t('loading')}</p>
          ) : historyItems.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400" data-testid="mexc-history-empty">
              {t('mexc_history_empty')}
            </p>
          ) : (
            <ul className="mt-3 space-y-2" data-testid="mexc-history-list">
              {historyItems.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-lg border p-3 ${
                    item.isCorrection || item.outcome === 'corrected'
                      ? 'border-amber-500/40 bg-amber-950/20'
                      : 'border-white/5 bg-slate-950/50'
                  }`}
                  data-testid={`mexc-history-item-${item.id}`}
                  data-outcome={item.outcome}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-slate-100">
                      {item.capabilityId
                        ? getCapabilityLabel(item.capabilityId, t)
                        : t('mexc_verification')}
                    </span>
                    <StatePill
                      label={
                        item.outcome === 'corrected'
                          ? t('mexc_history_correction')
                          : item.outcome
                            ? t(`mexc_history_filter_${item.outcome}`) !== `mexc_history_filter_${item.outcome}`
                              ? t(`mexc_history_filter_${item.outcome}`)
                              : String(item.outcome)
                            : t('mexc_status_pending')
                      }
                      tone={
                        item.outcome === 'verified'
                          ? 'ok'
                          : item.outcome === 'warning' || item.outcome === 'corrected'
                            ? 'warn'
                            : item.outcome === 'failed'
                              ? 'bad'
                              : 'neutral'
                      }
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {formatLocalizedDateTime(item.testedAt, language, t)}
                  </p>
                  {item.sanitizedReason && (
                    <p className="mt-1 text-xs text-slate-400">{item.sanitizedReason}</p>
                  )}
                  {showTechnical && item.lastFailureCode && (
                    <p className="mt-1 font-mono text-[10px] text-slate-500 ltr" dir="ltr" data-technical-code="true">
                      {item.lastFailureCode}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeSection === 'danger' && connection.configured && (
        <section
          className="rounded-xl border border-red-500/30 bg-red-950/20 p-4"
          aria-labelledby="mexc-danger-title"
          data-testid="mexc-danger-zone"
        >
          <h4 id="mexc-danger-title" className="text-sm font-semibold text-red-200">
            {t('mexc_danger_zone')}
          </h4>
          <p className="mt-1 text-xs text-red-200/70">{t('mexc_danger_zone_hint')}</p>
          <button
            type="button"
            onClick={handleDelete}
            data-testid="connection-delete-MEXC"
            className="mt-3 rounded-md border border-red-500/50 bg-red-900/30 px-3 py-2 text-sm text-red-100 hover:bg-red-900/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
          >
            {confirmDelete ? t('mexc_confirm_delete') : t('delete')}
          </button>
        </section>
      )}

      {message && (
        <p
          className={`text-sm ${
            message.type === 'error' ? 'text-red-300' : message.type === 'success' ? 'text-emerald-300' : 'text-blue-300'
          }`}
          data-testid="connection-message-MEXC"
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
