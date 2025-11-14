import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const WidgetCard: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (
    <div className="bg-white dark:bg-[#1c1e2f] border border-slate-200 dark:border-gray-700/50 rounded-lg p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-300">{title}</h3>
            <svg className="h-5 w-5 text-slate-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        </div>
        <div className="flex-grow mt-2">
            {children}
        </div>
    </div>
);

const AutopilotWidget: React.FC = () => {
    const { t } = useLanguage();

    const autopilot = {
        start: 100,
        target: 500,
        progress: 72,
        activeTrades: 12,
        maxTrades: 20,
        successRate: 91,
        agentsOnline: 13,
        agentsTotal: 15,
        training: 2,
        eta: '3h 24m',
        lastSync: '28s'
    };

    return (
        <WidgetCard title={t('autopilot_overview')}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wide">{t('autopilot_goal')}</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white mt-1">
                        {t('autopilot_goal_value', { start: `$${autopilot.start}`, target: `$${autopilot.target}` })}
                    </p>
                </div>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {t('autopilot_mode_auto')}
                </span>
            </div>

            <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400">
                    <span>{t('autopilot_progress')}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{autopilot.progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-gray-800 rounded-full mt-2">
                    <div
                        className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                        style={{ width: `${autopilot.progress}%` }}
                    />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400 mt-2">
                    <span>{t('autopilot_eta', { time: autopilot.eta })}</span>
                    <span>{t('autopilot_last_sync', { time: autopilot.lastSync })}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                <div className="bg-slate-100 dark:bg-gray-800/60 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">{t('autopilot_active_trades')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{autopilot.activeTrades}/{autopilot.maxTrades}</p>
                </div>
                <div className="bg-slate-100 dark:bg-gray-800/60 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">{t('autopilot_success_rate')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{autopilot.successRate}%</p>
                </div>
                <div className="bg-slate-100 dark:bg-gray-800/60 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">{t('autopilot_agents_online')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{autopilot.agentsOnline}/{autopilot.agentsTotal}</p>
                </div>
                <div className="bg-slate-100 dark:bg-gray-800/60 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">{t('autopilot_agents_training')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{autopilot.training}</p>
                </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20">
                <p className="text-xs font-semibold text-emerald-400">{t('autopilot_next_action')}</p>
                <p className="text-[11px] text-slate-600 dark:text-gray-300 mt-1 leading-relaxed">
                    {t('autopilot_next_action_desc')}
                </p>
            </div>
        </WidgetCard>
    );
};

export default AutopilotWidget;
