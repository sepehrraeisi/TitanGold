import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { fetchAutopilotState } from '../../services/api.ts';
import type { AutopilotState } from '../../types.ts';

const WidgetCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white dark:bg-[#1c1e2f] border border-slate-200 dark:border-gray-700/50 rounded-lg p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-300">{title}</h3>
            <svg className="h-5 w-5 text-slate-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        </div>
        <div className="flex-grow">{children}</div>
    </div>
);

const clampProgress = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

const AutopilotWidget: React.FC = () => {
    const { t } = useLanguage();
    const [state, setState] = useState<AutopilotState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const loadState = useCallback(async (withSpinner = false) => {
        if (withSpinner) {
            setIsLoading(true);
        }
        try {
            const data = await fetchAutopilotState();
            setState(data);
            setHasError(false);
        } catch (error) {
            console.error('Failed to load autopilot widget', error);
            setHasError(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadState(true);
        const interval = setInterval(() => {
            void loadState(false);
        }, 30000);
        return () => clearInterval(interval);
    }, [loadState]);

    const formatCurrency = useCallback((value: number) => `$${numberFormatter.format(value)}`, []);

    const formatEta = useCallback((minutes: number) => {
        if (minutes <= 0) {
            return t('autopilot_eta_ready');
        }
        const days = Math.floor(minutes / 1440);
        const hours = Math.floor((minutes % 1440) / 60);
        const mins = Math.round(minutes % 60);
        const parts: string[] = [];
        if (days) {
            parts.push(`${days}d`);
        }
        if (hours) {
            parts.push(`${hours}h`);
        }
        if (mins && parts.length < 2) {
            parts.push(`${mins}m`);
        }
        return parts.join(' ');
    }, [t]);

    const formatLastSync = useCallback((seconds: number) => {
        if (seconds <= 0) {
            return '0s';
        }
        if (seconds < 60) {
            return `${Math.round(seconds)}s`;
        }
        const minutes = seconds / 60;
        if (minutes < 60) {
            return `${Math.round(minutes)}m`;
        }
        return `${Math.round(minutes / 60)}h`;
    }, []);

    if (isLoading) {
        return (
            <WidgetCard title={t('autopilot_overview')}>
                <div className="h-full flex flex-col justify-between animate-pulse space-y-4">
                    <div className="space-y-2">
                        <div className="h-4 bg-slate-200 dark:bg-gray-800 rounded w-3/4" />
                        <div className="h-4 bg-slate-200 dark:bg-gray-800 rounded w-1/2" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-3 bg-slate-200 dark:bg-gray-800 rounded" />
                        <div className="h-3 bg-slate-200 dark:bg-gray-800 rounded" />
                    </div>
                    <div className="h-16 bg-slate-200 dark:bg-gray-800 rounded" />
                </div>
            </WidgetCard>
        );
    }

    if (hasError || !state) {
        return (
            <WidgetCard title={t('autopilot_overview')}>
                <div className="h-full flex flex-col items-start justify-between">
                    <p className="text-sm text-slate-500 dark:text-gray-400">{t('autopilot_error_loading')}</p>
                    <button
                        onClick={() => {
                            void loadState(true);
                        }}
                        className="mt-4 px-3 py-1.5 text-xs font-semibold rounded-md bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        {t('retry')}
                    </button>
                </div>
            </WidgetCard>
        );
    }

    const statusLabel = state.isActive ? t('autopilot_mode_auto') : t('autopilot_mode_standby');
    const statusClasses = state.isActive
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        : 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    const goal = state.goal;

    return (
        <WidgetCard title={t('autopilot_overview')}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">{t('autopilot_goal')}</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white mt-1">
                        {formatCurrency(goal.startCapital)} → {formatCurrency(goal.targetCapital)}
                    </p>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${statusClasses}`}>
                    {statusLabel}
                </span>
            </div>

            <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400">
                    <span>{t('autopilot_progress')}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{clampProgress(goal.progress)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-gray-800 rounded-full mt-2">
                    <div
                        className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                        style={{ width: `${clampProgress(goal.progress)}%` }}
                    />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400 mt-2">
                    <span>{t('autopilot_eta', { time: formatEta(goal.etaMinutes) })}</span>
                    <span>{t('autopilot_last_sync', { time: formatLastSync(goal.lastSyncSeconds) })}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                <div className="bg-slate-100 dark:bg-gray-800/60 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">{t('autopilot_active_trades')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {goal.activeTrades}/{goal.maxConcurrentTrades}
                    </p>
                </div>
                <div className="bg-slate-100 dark:bg-gray-800/60 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">{t('autopilot_success_rate')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{goal.successRate}%</p>
                </div>
                <div className="bg-slate-100 dark:bg-gray-800/60 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">{t('autopilot_agents_online')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {goal.agentsOnline}/{goal.agentsTotal}
                    </p>
                </div>
                <div className="bg-slate-100 dark:bg-gray-800/60 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">{t('autopilot_agents_training')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{goal.agentsTraining}</p>
                </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20">
                <p className="text-xs font-semibold text-emerald-400">{t('autopilot_next_action')}</p>
                <p className="text-[11px] text-slate-600 dark:text-gray-300 mt-1 leading-relaxed">
                    {t(goal.nextActionKey)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-2 leading-relaxed">
                    {t(state.statusMessageKey)}
                </p>
            </div>
        </WidgetCard>
    );
};

export default AutopilotWidget;
