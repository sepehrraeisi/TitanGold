import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import {
  fetchMexcCapabilitySummary,
  saveMexcConnection,
  deleteMexcConnection,
  type MexcCapabilitySummary,
  type SafeConnectionDto,
} from '../../../services/connectionsApi.ts';

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

function toneForOperational(state?: string) {
  if (state === 'enabled') return 'ok' as const;
  if (state === 'disabled' || state === 'disabled_pending_explicit_authorization') return 'warn' as const;
  if (String(state || '').startsWith('blocked')) return 'bad' as const;
  return 'neutral' as const;
}

function formatDuration(iso: string | null | undefined, language: string): string {
  if (!iso) return 'N/A';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'N/A';
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

function formatLocalizedDateTime(iso: string | null | undefined, language: string): string {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'N/A';
  return d.toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function keyGrantLabel(keyGrant: string | undefined, t: (k: string) => string): string | null {
  if (!keyGrant || keyGrant === 'not_applicable') return null;
  return `${t('mexc_key_grant')}: ${keyGrant}`;
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
  const [showTechnical, setShowTechnical] = useState(false);

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
      const enabled = caps.filter((c) => c.operationalState === 'enabled').length;
      const blocked = caps.filter((c) => String(c.operationalState || '').startsWith('blocked')).length;
      const disabled = caps.length - enabled - blocked;
      const topBlocked = caps.find((c) => c.blockedReason)?.blockedReason || null;
      return { group, total: caps.length, enabled, blocked, disabled, topBlocked, caps };
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
      setMessage({ type: 'info', text: t('connections_saved_untested') });
      await onChanged();
      await loadSummary();
    } catch (error: any) {
      setMessage({ type: 'error', text: t(error?.message || 'connections_internal_error') });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft({ apiKey: '', apiSecret: '' });
    setShowSecrets(false);
    setConfirmDelete(false);
    onClose();
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
  const credentialAge = formatDuration(summary?.connection?.credentialAgeHint, language);
  const lastRotation = formatLocalizedDateTime(summary?.connection?.lastRotationAt, language);

  // Primary consumers for concise view (not every wallet sub-function)
  const primaryConsumers = (summary?.consumers || []).filter((c) =>
    ['portfolio', 'arbitrage', 'spot_trading_read', 'futures_trading_read', 'wallet', 'risk_agents', 'market_data_agents'].includes(c.consumerId),
  );

  return (
    <div
      className="space-y-4 border-t border-white/5 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 p-4"
      data-testid="mexc-connection-panel"
      dir={dir}
    >
      {/* Provider summary — single MEXC heading */}
      <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-sm" aria-labelledby="mexc-summary-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 id="mexc-summary-title" className="text-sm font-semibold text-white">
              MEXC
            </h4>
            <p className="mt-1 text-xs text-slate-400" data-testid="mexc-overall-state">
              {overall ? (t(`mexc_state_${overall.code}`) !== `mexc_state_${overall.code}`
                ? t(`mexc_state_${overall.code}`)
                : overall.label) : t('connections_configured_not_verified')}
            </p>
          </div>
          <StatePill
            label={summary?.privateAuthentication?.verified ? t('mexc_auth_authenticated') : t('connections_configured_not_verified')}
            tone={summary?.privateAuthentication?.verified ? 'ok' : 'warn'}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-3">
            <p className="mb-1 text-[11px] text-emerald-300/80">{t('mexc_public_market')}</p>
            <p className="text-sm font-semibold text-emerald-100" data-testid="mexc-public-spot">
              {summary?.publicMarket?.spot?.available ? t('mexc_available') : t('mexc_unknown')}
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-3">
            <p className="mb-1 text-[11px] text-blue-300/80">{t('mexc_private_auth')}</p>
            <p className="text-sm font-semibold text-blue-100" data-testid="mexc-private-auth">
              {summary?.connection?.authState?.replace(/_/g, ' ') || t('connections_not_configured')}
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent p-3">
            <p className="mb-1 text-[11px] text-slate-300/80">{t('mexc_last_verified')}</p>
            <p className="text-sm font-semibold text-slate-100" data-testid="mexc-last-verified">
              {summary?.connection?.lastVerifiedAt
                ? formatLocalizedDateTime(summary.connection.lastVerifiedAt, language)
                : 'N/A'}
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-3">
            <p className="mb-1 text-[11px] text-amber-300/80">{t('mexc_last_failure')}</p>
            <p className="truncate text-sm font-semibold text-amber-100" data-testid="mexc-last-failure" title={summary?.connection?.lastSanitizedFailure?.code || ''}>
              {summary?.connection?.lastSanitizedFailure?.code || 'N/A'}
            </p>
          </div>
        </div>

        {(summary?.usedByModules?.length ?? 0) > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            {t('mexc_used_by')}: {summary?.usedByModules?.join(', ')}
          </p>
        )}
      </section>

      {/* Credential management */}
      <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-cred-title">
        <h4 id="mexc-cred-title" className="text-sm font-semibold text-white">{t('mexc_credentials')}</h4>
        <p className="mt-1 text-xs text-slate-400">{t('mexc_credentials_hint')}</p>
        {connection.maskedKeyIdentifier && (
          <p className="mt-2 text-xs text-slate-400">
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
              className="w-full rounded-md border border-white/10 bg-slate-950/70 p-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
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
                className="w-full rounded-md border border-white/10 bg-slate-950/70 p-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
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
          <span data-testid="mexc-credential-age">{t('mexc_credential_age')}: {credentialAge}</span>
          <span data-testid="mexc-last-rotation">{t('mexc_last_rotation')}: {lastRotation}</span>
        </div>
      </section>

      {/* Verification workflow — Test Connection gated */}
      <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-verify-title">
        <h4 id="mexc-verify-title" className="text-sm font-semibold text-white">{t('mexc_verification')}</h4>
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

      {/* Capability Matrix — progressive disclosure */}
      <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-matrix-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 id="mexc-matrix-title" className="text-sm font-semibold text-white">{t('mexc_capability_matrix')}</h4>
          <button
            type="button"
            className="text-[11px] text-indigo-300 hover:text-indigo-200"
            onClick={() => setShowTechnical((s) => !s)}
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
            {groupSummaries.map(({ group, total, enabled, blocked, disabled, topBlocked, caps }) => {
              const open = Boolean(expandedGroups[group]);
              return (
                <div key={group} className="rounded-lg border border-white/5 bg-slate-950/40" data-testid={`mexc-cap-group-${group}`}>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-start"
                    onClick={() => setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }))}
                    aria-expanded={open}
                    data-testid={`mexc-cap-group-toggle-${group}`}
                  >
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-300">{group}</span>
                    <span className="flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                      <StatePill label={`${total}`} tone="neutral" />
                      <StatePill label={`${t('mexc_enabled_count')}: ${enabled}`} tone="ok" />
                      <StatePill label={`${t('mexc_blocked_count')}: ${blocked}`} tone="bad" />
                      <StatePill label={`${t('mexc_disabled_count')}: ${disabled}`} tone="warn" />
                    </span>
                  </button>
                  {!open && topBlocked && (
                    <p className="border-t border-white/5 px-3 py-2 text-[11px] text-amber-200/80" data-testid={`mexc-cap-group-blocked-${group}`}>
                      {topBlocked}
                    </p>
                  )}
                  {open && (
                    <div className="space-y-2 border-t border-white/5 p-2">
                      {caps.map((cap) => {
                        const kg = keyGrantLabel(cap.keyGrant, t);
                        return (
                          <div
                            key={cap.capabilityId}
                            className="rounded-lg border border-white/5 bg-slate-950/50 p-3"
                            data-testid={`mexc-cap-${cap.capabilityId}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm text-slate-100">
                                {(cap as any).humanLabel || cap.capabilityId.replace(/_/g, ' ')}
                              </span>
                              <StatePill label={cap.operationalState} tone={toneForOperational(cap.operationalState)} />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <StatePill label={`${t('mexc_provider')}: ${cap.providerSupport}`} tone="info" />
                              {kg && <StatePill label={kg} tone="neutral" />}
                              <StatePill label={`${t('mexc_verification_state')}: ${cap.verificationState}`} tone="neutral" />
                            </div>
                            {cap.blockedReason && open && (
                              <p className="mt-2 text-xs text-amber-200/90">{cap.blockedReason}</p>
                            )}
                            {showTechnical && (
                              <p className="mt-1 font-mono text-[10px] text-slate-500" data-testid={`mexc-cap-code-${cap.capabilityId}`}>
                                {cap.capabilityId}
                              </p>
                            )}
                            <p className="mt-1 text-[11px] text-slate-500">
                              {t('mexc_last_checked')}: {cap.lastVerifiedAt
                                ? formatLocalizedDateTime(cap.lastVerifiedAt, language)
                                : 'N/A'}
                            </p>
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

      {/* Consumer mapping */}
      <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-consumers-title">
        <h4 id="mexc-consumers-title" className="text-sm font-semibold text-white">{t('mexc_consumers')}</h4>
        <div className="mt-3 space-y-2" data-testid="mexc-consumers">
          {primaryConsumers.map((c) => (
            <div key={c.consumerId} className="rounded-lg border border-white/5 bg-slate-950/50 p-3" data-testid={`mexc-consumer-${c.consumerId}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-slate-100">{c.displayName}</span>
                <StatePill
                  label={c.eligible ? t('mexc_eligible') : t('mexc_blocked')}
                  tone={c.eligible ? 'ok' : 'bad'}
                />
              </div>
              {showTechnical && (
                <p className="mt-1 text-[11px] text-slate-500">
                  {t('mexc_required')}: {(c.requiredCapabilities || []).join(', ')}
                </p>
              )}
              {c.blockedReason && <p className="mt-1 text-xs text-amber-200/90">{c.blockedReason}</p>}
            </div>
          ))}
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          data-testid="connection-save-MEXC"
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
        >
          {connection.configured ? t('mexc_rotate_credentials') : t('save_changes')}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          data-testid="connection-cancel-MEXC"
          className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          {t('cancel')}
        </button>
        {connection.configured && (
          <button
            type="button"
            onClick={handleDelete}
            data-testid="connection-delete-MEXC"
            className="rounded-md border border-red-500/40 px-3 py-2 text-sm text-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
          >
            {confirmDelete ? t('mexc_confirm_delete') : t('delete')}
          </button>
        )}
        {!dirty && (
          <span className="self-center text-[11px] text-slate-500">{t('mexc_save_disabled_hint')}</span>
        )}
      </div>
    </div>
  );
}
