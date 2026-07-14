import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { fetchExecutionRuntime, type ExecutionRuntimeView } from '../../services/executionRuntimeApi.ts';
import * as api from '../../services/api.ts';
import { ConfirmModal } from '../ui/confirm-modal.tsx';
import { Toast } from '../ui/toast.tsx';

/**
 * Header execution status — preference vs enforced active mode.
 * Preference updates must succeed under Emergency Stop without enabling Live.
 */
const ExecutionModeStatus: React.FC = () => {
  const { t } = useLanguage();
  const [runtime, setRuntime] = useState<ExecutionRuntimeView | null>(null);
  const [requestedMode, setRequestedMode] = useState<'demo' | 'live'>('demo');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    try {
      const [rt, pref] = await Promise.all([
        fetchExecutionRuntime(),
        api.fetchTradingMode().catch(() => ({ mode: 'demo' as const })),
      ]);
      setRuntime(rt);
      setRequestedMode(pref.mode === 'live' ? 'live' : 'demo');
    } catch {
      setRuntime(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saving) return;
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    const next = requestedMode === 'demo' ? 'live' : 'demo';
    setSaving(true);
    try {
      const result = await api.updateTradingMode(next);
      const persisted = result.mode === 'live' ? 'live' : 'demo';
      setRequestedMode(persisted);
      setToast({
        message: t('mode_preference_updated'),
        type: 'info',
      });
      await refresh();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : t('mode_switch_failed');
      setToast({ message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="w-16 h-5 bg-gray-700/50 rounded animate-pulse" aria-hidden="true" />;
  }

  const kill = !!runtime?.killSwitchActive;
  const activeMode = (kill ? 'demo' : runtime?.effectiveMode || 'demo').toUpperCase();
  const preferenceLabel = requestedMode.toUpperCase();
  const isRequestedDemo = requestedMode === 'demo';
  const confirmMessage = requestedMode === 'demo'
    ? t('switch_preference_live_confirm')
    : t('switch_preference_demo_confirm');

  return (
    <>
      <div
        ref={triggerRef}
        className={`flex items-center gap-2 cursor-pointer group ${saving ? 'opacity-60 pointer-events-none' : ''}`}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setShowConfirm(true);
          }
        }}
        title={kill ? t('kill_switch_active') : t('requested_vs_effective')}
        role="button"
        tabIndex={0}
        aria-label={t('execution_mode_status')}
        aria-busy={saving}
        data-testid="execution-mode-status"
        data-preference={requestedMode}
        data-effective={activeMode.toLowerCase()}
      >
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5">
            <div
              className={`relative w-10 h-5 flex items-center rounded-full p-0.5 ${
                isRequestedDemo ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-red-500/20 border border-red-500/40'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full shadow ${
                  isRequestedDemo ? 'bg-yellow-400' : 'bg-red-400 translate-x-4'
                }`}
              />
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground hidden lg:inline">
              {t('mode_preference_short')}: {preferenceLabel}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-bold ${kill ? 'text-red-400' : activeMode === 'LIVE' ? 'text-red-400' : 'text-amber-400'}`}>
              {t('mode_active_short')}: {activeMode}
            </span>
            {kill && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-500/50 bg-red-600/25 text-red-100"
                data-testid="header-emergency-stop"
              >
                {t('emergency_stop')}
              </span>
            )}
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={showConfirm}
        message={confirmMessage}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        type={requestedMode === 'demo' ? 'warning' : 'info'}
        returnFocusRef={triggerRef}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
};

export default ExecutionModeStatus;
