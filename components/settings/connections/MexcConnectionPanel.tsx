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
  if (state === 'disabled') return 'warn' as const;
  if (String(state || '').startsWith('blocked')) return 'bad' as const;
  return 'neutral' as const;
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

  return (
    <div
      className="space-y-4 border-t border-white/5 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 p-4"
      data-testid="mexc-connection-panel"
      dir={dir}
    >
      {/* Provider summary */}
      <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-sm" aria-labelledby="mexc-summary-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 id="mexc-summary-title" className="text-sm font-semibold text-white">
              MEXC
            </h4>
            <p className="mt-1 text-xs text-slate-400" data-testid="mexc-overall-state">
              {overall ? t(`mexc_state_${overall.code}`) !== `mexc_state_${overall.code}`
                ? t(`mexc_state_${overall.code}`)
                : overall.label : t('connections_configured_not_verified')}
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
              {summary?.connection?.lastVerifiedAt || 'N/A'}
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
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
          <span>{t('mexc_credential_age')}: {summary?.connection?.credentialAgeHint || 'N/A'}</span>
          <span>{t('mexc_last_rotation')}: {summary?.connection?.lastRotationAt || 'N/A'}</span>
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

      {/* Capability Matrix */}
      <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-matrix-title">
        <h4 id="mexc-matrix-title" className="text-sm font-semibold text-white">{t('mexc_capability_matrix')}</h4>
        <p className="mt-1 text-xs text-slate-400">{t('mexc_capability_matrix_hint')}</p>
        {loading ? (
          <p className="mt-3 text-sm text-slate-400">{t('loading')}</p>
        ) : (
          <div className="mt-3 space-y-4" data-testid="mexc-capability-matrix">
            {GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
              <div key={group}>
                <h5 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{group}</h5>
                <div className="space-y-2">
                  {grouped[group].map((cap) => (
                    <div
                      key={cap.capabilityId}
                      className="rounded-lg border border-white/5 bg-slate-950/50 p-3"
                      data-testid={`mexc-cap-${cap.capabilityId}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm text-slate-100">{cap.capabilityId}</span>
                        <StatePill label={cap.operationalState} tone={toneForOperational(cap.operationalState)} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatePill label={`${t('mexc_provider')}: ${cap.providerSupport}`} tone="info" />
                        <StatePill label={`${t('mexc_key_grant')}: ${cap.keyGrant}`} tone="neutral" />
                        <StatePill label={`${t('mexc_verification_state')}: ${cap.verificationState}`} tone="neutral" />
                      </div>
                      {cap.blockedReason && (
                        <p className="mt-2 text-xs text-amber-200/90">{cap.blockedReason}</p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-500">
                        {t('mexc_last_checked')}: {cap.lastVerifiedAt || 'N/A'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Consumer mapping */}
      <section className="rounded-xl border border-white/5 bg-slate-900/60 p-4" aria-labelledby="mexc-consumers-title">
        <h4 id="mexc-consumers-title" className="text-sm font-semibold text-white">{t('mexc_consumers')}</h4>
        <div className="mt-3 space-y-2" data-testid="mexc-consumers">
          {(summary?.consumers || []).map((c) => (
            <div key={c.consumerId} className="rounded-lg border border-white/5 bg-slate-950/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-slate-100">{c.displayName}</span>
                <StatePill
                  label={c.eligible ? t('mexc_eligible') : t('mexc_blocked')}
                  tone={c.eligible ? 'ok' : 'bad'}
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {t('mexc_required')}: {(c.requiredCapabilities || []).join(', ')}
              </p>
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
