import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import {
  fetchMexcCapabilitySummary,
  saveMexcConnection,
  deleteMexcConnection,
  type MexcCapabilitySummary,
  type SafeConnectionDto,
} from '../../../services/connectionsApi.ts';
import {
  translateAuthState,
  translateConsumerName,
} from '../../../utils/mexcDisplayLabels.ts';
import {
  productStatusFromCapability,
  selectCapabilityProductReason,
  selectConsumerProductReason,
  translateReasonKind,
  type MexcReasonKind,
} from '../../../utils/mexcReasonPriority.ts';

interface DraftSecrets {
  apiKey: string;
  apiSecret: string;
}

interface Props {
  connection: SafeConnectionDto;
  onChanged: () => Promise<void> | void;
  onClose: () => void;
}

const GROUP_ORDER = [
  'Market Data',
  'Spot',
  'Futures',
  'Wallet',
  'Transfers',
  'P2P',
  'Account',
];

/** Product-facing consumers — read and execute kept separate */
const PRIMARY_CONSUMER_IDS = [
  'portfolio',
  'arbitrage',
  'market_data_agents',
  'spot_trading_read',
  'spot_trading_execute',
  'futures_trading_read',
  'futures_trading_execute',
  'wallet',
  'wallet_withdrawal_execute',
  'wallet_transfer_execute',
  'risk_agents',
] as const;

function StatePill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'ok' | 'warn' | 'bad' | 'neutral' | 'info';
}) {
  const tones: Record<string, string> = {
    ok: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/40',
    warn: 'bg-amber-500/10 text-amber-200 border-amber-500/40',
    bad: 'bg-red-500/10 text-red-200 border-red-500/40',
    info: 'bg-blue-500/10 text-blue-200 border-blue-500/40',
    neutral: 'bg-slate-700/40 text-slate-200 border-slate-600/50',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] ${tones[tone]}`}>
      {label}
    </span>
  );
}

function formatDuration(iso: string | null | undefined, language: string, t: (k: string) => string): string {
  if (!iso) return t('mexc_never');
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return t('mexc_never');
  const diffMs = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (language === 'fa') {
    if (days > 0) return `${days} روز`;
    if (hours > 0) return `${hours} ساعت`;
    if (minutes > 0) return `${minutes} دقیقه`;
    return 'کمتر از یک دقیقه';
  }
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}

function formatLocalizedDateTime(iso: string | null | undefined, language: string, t: (k: string) => string): string {
  if (!iso) return t('mexc_never');
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return t('mexc_never');
  return d.toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function productStatusLabel(status: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    available: 'mexc_status_available',
    pending: 'mexc_status_pending',
    blocked: 'mexc_status_blocked',
    unavailable: 'mexc_status_unavailable',
  };
  return t(map[status] || 'mexc_status_blocked');
}

function toneForProductStatus(status: string) {
  if (status === 'available') return 'ok' as const;
  if (status === 'pending') return 'warn' as const;
  if (status === 'unavailable') return 'neutral' as const;
  return 'bad' as const;
}

function consumerEligibilityLabel(
  consumer: { eligible?: boolean; registered?: boolean; sideEffectClass?: string },
  t: (k: string) => string,
): { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' } {
  if (consumer.registered === false) {
    return { label: t('mexc_not_registered'), tone: 'neutral' };
  }
  if (consumer.eligible) return { label: t('mexc_eligible'), tone: 'ok' };
  if (consumer.sideEffectClass === 'financial_write' || consumer.sideEffectClass === 'account_mutation') {
    return { label: t('mexc_blocked'), tone: 'bad' };
  }
  return { label: t('mexc_limited'), tone: 'warn' };
}

function humanizeCapabilityId(id: string, t: (k: string) => string): string {
  const key = `mexc_cap_label_${id}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return id.replace(/_/g, ' ');
}

export default function MexcConnectionPanel({ connection, onChanged, onClose }: Props) {
  const { t, language } = useLanguage();
  const [summary, setSummary] = useState<MexcCapabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftSecrets>({ apiKey: '', apiSecret: '' });
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  // Documented default: technical details OFF — never restore from stale state
  const [showTechnical, setShowTechnical] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [expandedConsumers, setExpandedConsumers] = useState<Record<string, boolean>>({});

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
      setDraft({ apiKey: '', apiSecret: '' });
    };
  }, []);

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
      const reasonKinds: MexcReasonKind[] = [];
      for (const cap of caps) {
        const status = productStatusFromCapability(cap);
        if (status === 'available') available += 1;
        else if (status === 'pending') pending += 1;
        else if (status === 'unavailable') unavailable += 1;
        else blocked += 1;
        if (status !== 'available') {
          reasonKinds.push(selectCapabilityProductReason(cap));
        }
      }
      const primaryKind = reasonKinds.length
        ? reasonKinds.slice().sort((a, b) => {
            const order: MexcReasonKind[] = [
              'provider_unknown',
              'provider_maintenance',
              'provider_unavailable',
              'account_use_case_unknown',
              'auth_pending',
              'key_denied',
              'key_unknown',
              'user_capability',
              'runtime_tier4',
              'risk_confirmation',
              'generic',
            ];
            return order.indexOf(a) - order.indexOf(b);
          })[0]
        : null;
      return {
        group,
        total: caps.length,
        available,
        pending,
        blocked,
        unavailable,
        primaryKind,
        caps,
      };
    });
  }, [grouped]);

  const handleSave = async () => {
    if (!canSave) return;
    try {
      setSaving(true);
      await saveMexcConnection({
        apiKey: draft.apiKey.trim(),
        apiSecret: draft.apiSecret.trim(),
        isTestnet: false,
      });
      setDraft({ apiKey: '', apiSecret: '' });
      setShowSecrets(false);
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
    setDraft({ apiKey: '', apiSecret: '' });
    setShowSecrets(false);
    setCredentialsOpen(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteMexcConnection();
      setDraft({ apiKey: '', apiSecret: '' });
      setMessage({ type: 'info', text: t('connection_deleted') });
      await onChanged();
      onClose();
    } catch (error: any) {
      setMessage({ type: 'error', text: t(error?.message || 'connections_internal_error') });
    } finally {
      setConfirmDelete(false);
    }
  };

  const overall = summary?.overallTruthfulState;
  const dir = language === 'fa' ? 'rtl' : 'ltr';
  const credentialAge = formatDuration(summary?.connection?.credentialAgeHint, language, t);
  const lastRotation = formatLocalizedDateTime(summary?.connection?.lastRotationAt, language, t);

  const primaryConsumers = useMemo(() => {
    const list = summary?.consumers || [];
    const byId = new Map(list.map((c) => [c.consumerId, c]));
    return PRIMARY_CONSUMER_IDS.map((id) => byId.get(id)).filter(Boolean) as typeof list;
  }, [summary]);

  const overallLabel = overall
    ? t(`mexc_state_${overall.code}`) !== `mexc_state_${overall.code}`
      ? t(`mexc_state_${overall.code}`)
      : overall.label
    : t('connections_configured_not_verified');

  return (
    <div
      className="space-y-4 border-t border-white/5 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 p-4"
      data-testid="mexc-connection-panel"
      data-technical-default="false"
      dir={dir}
    >
      {/* Expanded provider details — no duplicate MEXC title; parent row owns heading */}
      <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-expanded-summary">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 id="mexc-expanded-summary" className="sr-only">
              MEXC
            </h4>
            <p className="text-xs text-slate-400" data-testid="mexc-overall-state">
              {overallLabel}
            </p>
          </div>
          <StatePill
            label={
              summary?.privateAuthentication?.verified
                ? t('mexc_auth_authenticated')
                : t('connections_configured_not_verified')
            }
            tone={summary?.privateAuthentication?.verified ? 'ok' : 'warn'}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-white/5 bg-slate-950/50 p-3">
            <p className="mb-1 text-[11px] text-emerald-300/80">{t('mexc_public_market')}</p>
            <p className="text-sm font-semibold text-emerald-100" data-testid="mexc-public-spot">
              {summary?.publicMarket?.spot?.available ? t('mexc_available') : t('mexc_unknown')}
            </p>
          </div>
          <div className="rounded-lg border border-white/5 bg-slate-950/50 p-3">
            <p className="mb-1 text-[11px] text-blue-300/80">{t('mexc_private_auth')}</p>
            <p className="text-sm font-semibold text-blue-100" data-testid="mexc-private-auth">
              {translateAuthState(summary?.connection?.authState, t)}
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
          <span data-testid="mexc-last-verified">
            {t('mexc_last_verified')}:{' '}
            {summary?.connection?.lastVerifiedAt
              ? formatLocalizedDateTime(summary.connection.lastVerifiedAt, language, t)
              : t('mexc_never')}
          </span>
          {summary?.connection?.lastSanitizedFailure?.code && (
            <span data-testid="mexc-last-failure" className="font-mono ltr" dir="ltr">
              {t('mexc_last_failure')}: {summary.connection.lastSanitizedFailure.code}
            </span>
          )}
        </div>

        {(summary?.usedByModules?.length ?? 0) > 0 && (
          <p className="mt-2 text-xs text-slate-400" data-testid="mexc-used-by">
            {t('mexc_used_by')}: {summary?.usedByModules?.join(', ')}
          </p>
        )}
      </section>

      {/* Credential management — collapsed by default; actions only when expanded */}
      <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-cred-title">
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
                setDraft({ apiKey: '', apiSecret: '' });
                setShowSecrets(false);
                setCredentialsOpen(true);
              }
            }}
            aria-expanded={credentialsOpen}
            data-testid="mexc-credentials-toggle"
          >
            {credentialsOpen ? t('mexc_hide_credentials') : t('mexc_show_credentials')}
          </button>
        </div>
        {!credentialsOpen && (
          <p className="mt-2 text-xs text-slate-400">{t('mexc_credentials_collapsed_hint')}</p>
        )}
        {credentialsOpen && (
          <>
            <p className="mt-1 text-xs text-slate-400">{t('mexc_credentials_hint')}</p>
            {connection.maskedKeyIdentifier && (
              <p className="mt-2 text-xs text-slate-400 font-mono ltr" dir="ltr">
                {t('connections_masked_key')}: {connection.maskedKeyIdentifier}
              </p>
            )}
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
            <p className="mt-2 text-[11px] text-slate-500">{t('mexc_ip_restriction_guidance')}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500" data-testid="mexc-credential-meta">
              <span data-testid="mexc-credential-age">
                {t('mexc_credential_age')}: {credentialAge}
              </span>
              <span data-testid="mexc-last-rotation">
                {t('mexc_last_rotation')}: {lastRotation}
              </span>
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
      </section>

      {/* Verification — locked informational */}
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

      {/* Capability Matrix */}
      <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-matrix-title">
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
                    <span className="text-xs font-medium text-slate-200">{t(`mexc_group_${group.replace(/\s+/g, '_').toLowerCase()}`) !== `mexc_group_${group.replace(/\s+/g, '_').toLowerCase()}` ? t(`mexc_group_${group.replace(/\s+/g, '_').toLowerCase()}`) : group}</span>
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
                        return (
                          <div
                            key={cap.capabilityId}
                            className="rounded-lg border border-white/5 bg-slate-950/50 p-3"
                            data-testid={`mexc-cap-${cap.capabilityId}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm text-slate-100">
                                {(cap as any).humanLabel || humanizeCapabilityId(cap.capabilityId, t)}
                              </span>
                              <StatePill label={productStatusLabel(status, t)} tone={toneForProductStatus(status)} />
                            </div>
                            {status !== 'available' && (
                              <p className="mt-2 text-xs text-amber-200/90">{translateReasonKind(reasonKind, t)}</p>
                            )}
                            <p className="mt-1 text-[11px] text-slate-500">
                              {t('mexc_last_checked')}:{' '}
                              {cap.lastVerifiedAt
                                ? formatLocalizedDateTime(cap.lastVerifiedAt, language, t)
                                : t('mexc_never_checked')}
                            </p>
                            {showTechnical && (
                              <div className="mt-2 space-y-1 border-t border-white/5 pt-2 font-mono text-[10px] text-slate-500 ltr" dir="ltr" data-testid={`mexc-cap-tech-${cap.capabilityId}`}>
                                <p data-testid={`mexc-cap-code-${cap.capabilityId}`}>{cap.capabilityId}</p>
                                <p>
                                  {t('mexc_provider')}: {cap.providerSupport}
                                </p>
                                <p>
                                  {t('mexc_key_grant')}: {cap.keyGrant}
                                </p>
                                <p>
                                  {t('mexc_verification_state')}: {cap.verificationState}
                                </p>
                                <p>
                                  {t('mexc_operational')}: {cap.operationalState}
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

      {/* Consumers — details collapsed by default */}
      <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-consumers-title">
        <h4 id="mexc-consumers-title" className="text-sm font-semibold text-white">
          {t('mexc_consumers')}
        </h4>
        <div className="mt-3 space-y-2" data-testid="mexc-consumers">
          {primaryConsumers.map((c) => {
            const consumerOpen = Boolean(expandedConsumers[c.consumerId]);
            const eligibility = consumerEligibilityLabel(c as any, t);
            const reasonKind = selectConsumerProductReason(c as any);
            return (
              <div
                key={c.consumerId}
                className="rounded-lg border border-white/5 bg-slate-950/50 p-3"
                data-testid={`mexc-consumer-${c.consumerId}`}
                data-consumer-expanded={consumerOpen ? 'true' : 'false'}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-slate-100">
                    {translateConsumerName(c.consumerId, c.displayName, t)}
                  </span>
                  <StatePill label={eligibility.label} tone={eligibility.tone} />
                </div>
                {!c.eligible && (
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
                  <div className="mt-2 space-y-1 text-[11px] text-slate-400" data-testid={`mexc-consumer-expanded-${c.consumerId}`}>
                    <p>
                      {t('mexc_required')}:{' '}
                      {(c.requiredCapabilities || [])
                        .map((id) => (showTechnical ? id : humanizeCapabilityId(id, t)))
                        .join(showTechnical ? ', ' : ' · ')}
                    </p>
                    {(c.optionalCapabilities || []).length > 0 && (
                      <p>
                        {t('mexc_optional')}:{' '}
                        {(c.optionalCapabilities || [])
                          .map((id) => (showTechnical ? id : humanizeCapabilityId(id, t)))
                          .join(showTechnical ? ', ' : ' · ')}
                      </p>
                    )}
                    {showTechnical && c.blockedReason && (
                      <p className="font-mono text-[10px] text-slate-500 ltr" dir="ltr">
                        {c.blockedReason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

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

      {connection.configured && (
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
    </div>
  );
}
