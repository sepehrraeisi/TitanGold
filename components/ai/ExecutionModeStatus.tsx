import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { fetchExecutionRuntime, type ExecutionRuntimeView } from '../../services/executionRuntimeApi.ts';
import * as api from '../../services/api.ts';
import { ConfirmModal } from '../ui/confirm-modal.tsx';
import { Toast } from '../ui/toast.tsx';

/**
 * Header execution status — separates requested preference from effective runtime.
 */
const ExecutionModeStatus: React.FC = () => {
  const { t } = useLanguage();
  const [runtime, setRuntime] = useState<ExecutionRuntimeView | null>(null);
  const [requestedMode, setRequestedMode] = useState<'demo' | 'live'>('demo');
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

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
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    const next = requestedMode === 'demo' ? 'live' : 'demo';
    try {
      const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
      const res = await fetch('/api/v1/settings/trading-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: next }),
      });
      if (!res.ok) throw new Error('Failed');
      setRequestedMode(next);
      setToast({
        message: t('mode_preference_updated') || `Preference set to ${next.toUpperCase()} (does not grant live permission)`,
        type: 'info',
      });
      await refresh();
    } catch {
      setToast({ message: t('mode_switch_failed') || 'Failed to update preference', type: 'error' });
    }
  };

  if (loading) {
    return <div className="w-16 h-5 bg-gray-700/50 rounded animate-pulse" aria-hidden="true" />;
  }

  const effective = runtime?.effectiveMode || 'demo';
  const kill = runtime?.killSwitchActive;
  const isRequestedDemo = requestedMode === 'demo';

  return (
    <>
      <div
        className="flex items-center gap-2 cursor-pointer group"
        onClick={handleToggle}
        title={
          kill
            ? (t('kill_switch_active') || 'Emergency stop active — effective execution is Demo')
            : (t('requested_vs_effective') || `Requested: ${requestedMode.toUpperCase()} · Effective: ${effective.toUpperCase()}`)
        }
        role="group"
        aria-label={t('execution_mode_status') || 'Execution mode status'}
      >
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5">
            <div className={`relative w-10 h-5 flex items-center rounded-full p-0.5 ${isRequestedDemo ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-red-500/20 border border-red-500/40'}`}>
              <div className={`w-3.5 h-3.5 rounded-full shadow ${isRequestedDemo ? 'bg-yellow-400' : 'bg-red-400 translate-x-4'}`} />
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground hidden lg:inline">
              {t('requested') || 'Req'}: {requestedMode.toUpperCase()}
            </span>
          </div>
          <span className={`text-[10px] font-bold ${kill ? 'text-red-400' : effective === 'live' ? 'text-red-400' : 'text-amber-400'}`}>
            {t('effective') || 'Eff'}: {kill ? 'DEMO' : effective.toUpperCase()}
            {runtime && !runtime.workerAcknowledged && kill ? ' · …' : ''}
          </span>
        </div>
      </div>
      <ConfirmModal
        isOpen={showConfirm}
        message={
          requestedMode === 'demo'
            ? (t('switch_preference_live_confirm') || 'Set preference to LIVE? This does not enable live execution without admin/runtime gates.')
            : (t('switch_preference_demo_confirm') || 'Set preference to DEMO?')
        }
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        type={requestedMode === 'demo' ? 'warning' : 'info'}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
};

export default ExecutionModeStatus;
