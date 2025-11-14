import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import StatCard from './StatCard.tsx';
import {
    emergencyStopAutopilot,
    fetchAutopilotState,
    resetAutopilotSystem,
    runAutopilotQuickAction,
    setAutopilotActive,
    startAutopilotGoal,
    temporaryPauseAutopilot,
    updateAutopilotBudget,
    updateAutopilotMode,
    updateAutopilotRiskLevel,
} from '../../services/api.ts';
import type { AutopilotMode, AutopilotQuickAction, AutopilotRiskLevel, AutopilotState } from '../../types.ts';

const ControlCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <div className={`bg-[#1c1e2f] border border-gray-700/50 rounded-lg ${className ?? ''}`}>
        <h3 className="font-semibold text-white p-4 border-b border-gray-700/50">{title}</h3>
        <div className="p-4 space-y-4">{children}</div>
    </div>
);

type FeedbackState = { type: 'success' | 'error'; message: string } | null;

type StatusTone = 'success' | 'warning' | 'info';

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const modeLabelKeys: Record<AutopilotMode, string> = {
    balanced: 'balanced_mode',
    aggressive: 'aggressive_mode',
    scalping: 'scalping_mode',
    capital_preservation: 'capital_preservation_mode',
};

const riskLabelKeys: Record<AutopilotRiskLevel, string> = {
    conservative: 'conservative_risk',
    balanced: 'balanced_risk',
    aggressive: 'aggressive_risk',
};

const quickActions: AutopilotQuickAction[] = ['ai_decisions', 'performance_report', 'export_settings'];

const ProfessionalAutopilot: React.FC = () => {
    const { t } = useLanguage();
    const [autopilot, setAutopilot] = useState<AutopilotState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<FeedbackState>(null);
    const [budgetInput, setBudgetInput] = useState('');
    const [goalStart, setGoalStart] = useState('');
    const [goalTarget, setGoalTarget] = useState('');

    const syncFormState = useCallback((state: AutopilotState) => {
        setBudgetInput(state.tradingBudget.toString());
        setGoalStart(state.goal.startCapital.toString());
        setGoalTarget(state.goal.targetCapital.toString());
    }, []);

    const loadState = useCallback(async () => {
        try {
            const state = await fetchAutopilotState();
            setAutopilot(state);
            syncFormState(state);
        } catch (error) {
            console.error('Failed to load autopilot state', error);
            setFeedback({ type: 'error', message: t('autopilot_error_loading') });
        } finally {
            setIsLoading(false);
        }
    }, [syncFormState, t]);

    useEffect(() => {
        void loadState();
    }, [loadState]);

    useEffect(() => {
        if (!feedback) {
            return;
        }
        const timer = setTimeout(() => setFeedback(null), 4000);
        return () => clearTimeout(timer);
    }, [feedback]);

    const showFeedback = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setFeedback({ type, message });
    }, []);

    const formatCurrency = useCallback((value: number) => `$${numberFormatter.format(value)}`, []);
    const stats = useMemo(() => {
        if (!autopilot) {
            return [] as Array<{ label: string; value: string }>;
        }
        return [
            { label: t('total_performance'), value: `${percentFormatter.format(autopilot.metrics.totalPerformance)}%` },
            { label: t('win_rate'), value: `${percentFormatter.format(autopilot.metrics.winRate)}%` },
            { label: t('total_trades'), value: numberFormatter.format(autopilot.metrics.totalTrades) },
            { label: t('today_profit'), value: formatCurrency(autopilot.metrics.todayProfit) },
        ];
    }, [autopilot, formatCurrency, t]);

    const aiStatus = useMemo(() => {
        if (!autopilot) {
            return [] as Array<{ id: string; name: string; status: string; tone: StatusTone }>;
        }
        return [
            {
                id: 'artemis_ai',
                name: t('artemis_ai'),
                status: t(autopilot.isActive ? 'active' : 'inactive'),
                tone: autopilot.isActive ? 'success' : 'warning',
            },
            { id: 'chatgpt4', name: t('chatgpt4'), status: t('connected'), tone: 'success' },
            { id: 'google_gemini', name: t('google_gemini'), status: t('connected'), tone: 'success' },
            { id: 'claude3', name: t('claude3'), status: t('connected'), tone: 'success' },
            {
                id: 'ai_agents',
                name: t('ai_agents_15'),
                status: t('autopilot_agents_online_status', {
                    active: autopilot.goal.agentsOnline,
                    total: autopilot.goal.agentsTotal,
                }),
                tone: 'info',
            },
        ];
    }, [autopilot, t]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-32 bg-[#1c1e2f] border border-gray-700/50 rounded-lg animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, idx) => (
                        <div key={idx} className="h-24 bg-[#1c1e2f] border border-gray-700/50 rounded-lg animate-pulse" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, idx) => (
                        <div key={idx} className="h-64 bg-[#1c1e2f] border border-gray-700/50 rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (!autopilot) {
        return (
            <div className="space-y-4">
                <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-6">
                    <p className="text-sm text-gray-300">{t('autopilot_error_loading')}</p>
                    <button
                        onClick={() => {
                            setIsLoading(true);
                            void loadState();
                        }}
                        className="mt-4 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        {t('retry')}
                    </button>
                </div>
            </div>
        );
    }

    const isToggleDisabled = processing === 'toggle' || processing === 'emergency' || processing === 'temp_pause' || processing === 'reset';

    const handleToggleActive = async () => {
        setProcessing('toggle');
        try {
            const updated = await setAutopilotActive(!autopilot.isActive);
            setAutopilot(updated);
            syncFormState(updated);
            showFeedback(t(updated.isActive ? 'autopilot_feedback_resumed' : 'autopilot_feedback_paused'));
        } catch (error) {
            console.error('Failed to toggle autopilot', error);
            showFeedback(t('autopilot_feedback_error'), 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handleEmergencyStop = async () => {
        setProcessing('emergency');
        try {
            const updated = await emergencyStopAutopilot();
            setAutopilot(updated);
            syncFormState(updated);
            showFeedback(t('autopilot_feedback_emergency'));
        } catch (error) {
            console.error('Failed to trigger emergency stop', error);
            showFeedback(t('autopilot_feedback_error'), 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handleTemporaryPause = async () => {
        setProcessing('temp_pause');
        try {
            const updated = await temporaryPauseAutopilot();
            setAutopilot(updated);
            syncFormState(updated);
            showFeedback(t('autopilot_feedback_temp_pause'));
        } catch (error) {
            console.error('Failed to pause autopilot', error);
            showFeedback(t('autopilot_feedback_error'), 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handleResetSystem = async () => {
        setProcessing('reset');
        try {
            const updated = await resetAutopilotSystem();
            setAutopilot(updated);
            syncFormState(updated);
            showFeedback(t('autopilot_feedback_reset'));
        } catch (error) {
            console.error('Failed to reset autopilot', error);
            showFeedback(t('autopilot_feedback_error'), 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handleModeChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value as AutopilotMode;
        if (value === autopilot.operatingMode) {
            return;
        }
        setProcessing('mode');
        try {
            const updated = await updateAutopilotMode(value);
            setAutopilot(updated);
            syncFormState(updated);
            showFeedback(t('autopilot_feedback_mode', { mode: t(modeLabelKeys[value]) }));
        } catch (error) {
            console.error('Failed to update mode', error);
            showFeedback(t('autopilot_feedback_error'), 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handleBudgetCommit = async () => {
        const parsed = Number(budgetInput);
        if (Number.isNaN(parsed) || parsed <= 0) {
            showFeedback(t('autopilot_feedback_error'), 'error');
            syncFormState(autopilot);
            return;
        }
        if (parsed === autopilot.tradingBudget) {
            return;
        }
        setProcessing('budget');
        try {
            const updated = await updateAutopilotBudget(parsed);
            setAutopilot(updated);
            syncFormState(updated);
            showFeedback(t('autopilot_feedback_budget', { budget: numberFormatter.format(parsed) }));
        } catch (error) {
            console.error('Failed to update budget', error);
            showFeedback(t('autopilot_feedback_error'), 'error');
            syncFormState(autopilot);
        } finally {
            setProcessing(null);
        }
    };

    const handleRiskChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value as AutopilotRiskLevel;
        if (value === autopilot.riskLevel) {
            return;
        }
        setProcessing('risk');
        try {
            const updated = await updateAutopilotRiskLevel(value);
            setAutopilot(updated);
            syncFormState(updated);
            showFeedback(t('autopilot_feedback_risk', { risk: t(riskLabelKeys[value]) }));
        } catch (error) {
            console.error('Failed to update risk level', error);
            showFeedback(t('autopilot_feedback_error'), 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handleStartGoal = async () => {
        const startValue = Number(goalStart);
        const targetValue = Number(goalTarget);
        if (Number.isNaN(startValue) || Number.isNaN(targetValue) || startValue <= 0 || targetValue <= startValue) {
            showFeedback(t('autopilot_feedback_goal_invalid'), 'error');
            syncFormState(autopilot);
            return;
        }
        setProcessing('goal');
        try {
            const updated = await startAutopilotGoal(startValue, targetValue);
            setAutopilot(updated);
            syncFormState(updated);
            showFeedback(t('autopilot_feedback_goal', {
                start: formatCurrency(startValue),
                target: formatCurrency(targetValue),
            }));
        } catch (error) {
            console.error('Failed to start new goal', error);
            showFeedback(t('autopilot_feedback_error'), 'error');
            syncFormState(autopilot);
        } finally {
            setProcessing(null);
        }
    };

    const handleQuickAction = async (action: AutopilotQuickAction) => {
        setProcessing(action);
        try {
            const result = await runAutopilotQuickAction(action);
            setAutopilot(result.state);
            syncFormState(result.state);
            showFeedback(t('autopilot_feedback_quick_action', { action: t(result.actionKey) }));
        } catch (error) {
            console.error('Failed to run quick action', error);
            showFeedback(t('autopilot_feedback_error'), 'error');
        } finally {
            setProcessing(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                    <h2 className="text-xl font-bold text-white">{t('professional_autopilot_system')}</h2>
                    <p className="text-gray-400">{t('full_control_desc')}</p>
                    <p className="text-sm text-emerald-300 mt-3 max-w-xl">{t(autopilot.statusMessageKey)}</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm text-gray-300">{t('system_status')}</p>
                        <p className={`font-bold ${autopilot.isActive ? 'text-green-400' : 'text-yellow-400'}`}>
                            {t(autopilot.isActive ? 'active' : 'inactive')}
                        </p>
                    </div>
                    <button
                        onClick={handleEmergencyStop}
                        disabled={processing === 'emergency'}
                        className={`bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors ${processing === 'emergency' ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {processing === 'emergency' ? t('loading') : t('emergency_stop')}
                    </button>
                </div>
            </div>

            {feedback && (
                <div
                    className={`rounded-lg border px-4 py-3 text-sm ${
                        feedback.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                            : 'bg-red-500/10 border-red-500/40 text-red-200'
                    }`}
                >
                    {feedback.message}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map(stat => (
                    <StatCard key={stat.label} label={stat.label} value={stat.value} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <ControlCard title={t('system_control')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-gray-400">{t('autopilot_status')}</label>
                                    <div className="flex items-center gap-3 mt-2">
                                        <button
                                            onClick={handleToggleActive}
                                            disabled={isToggleDisabled}
                                            aria-pressed={autopilot.isActive}
                                            className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                                                autopilot.isActive ? 'bg-green-500/80' : 'bg-gray-700'
                                            } ${isToggleDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            <span
                                                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                                                    autopilot.isActive ? 'translate-x-8' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                        <span className="text-sm text-gray-300">{t(autopilot.isActive ? 'active' : 'inactive')}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">{t('operating_mode')}</label>
                                    <select
                                        className="w-full mt-2 p-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                                        value={autopilot.operatingMode}
                                        onChange={handleModeChange}
                                        disabled={processing === 'mode'}
                                    >
                                        {(Object.keys(modeLabelKeys) as AutopilotMode[]).map(mode => (
                                            <option key={mode} value={mode}>
                                                {t(modeLabelKeys[mode])}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">{t('trading_budget')}</label>
                                    <input
                                        type="number"
                                        value={budgetInput}
                                        onChange={event => setBudgetInput(event.target.value)}
                                        onBlur={handleBudgetCommit}
                                        onKeyDown={event => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                void handleBudgetCommit();
                                            }
                                        }}
                                        disabled={processing === 'budget'}
                                        className="w-full mt-2 p-2 bg-gray-800/50 border border-gray-700 rounded-lg"
                                    />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-gray-400">{t('risk_level')}</label>
                                    <div className="space-y-2 mt-2">
                                        {(Object.keys(riskLabelKeys) as AutopilotRiskLevel[]).map(level => (
                                            <label key={level} className="flex items-center gap-2 text-xs text-gray-300">
                                                <input
                                                    type="radio"
                                                    name="risk"
                                                    value={level}
                                                    checked={autopilot.riskLevel === level}
                                                    onChange={handleRiskChange}
                                                    disabled={processing === 'risk'}
                                                    className="text-purple-500 bg-gray-700 focus:ring-purple-500"
                                                />
                                                <span>{t(riskLabelKeys[level])}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-4">
                                    <button
                                        onClick={handleTemporaryPause}
                                        disabled={processing === 'temp_pause'}
                                        className={`flex-1 bg-yellow-600/80 hover:bg-yellow-600 text-white font-semibold py-2 rounded-lg text-sm transition-colors ${processing === 'temp_pause' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        {processing === 'temp_pause' ? t('loading') : t('temp_stop')}
                                    </button>
                                    <button
                                        onClick={handleResetSystem}
                                        disabled={processing === 'reset'}
                                        className={`flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded-lg text-sm transition-colors ${processing === 'reset' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        {processing === 'reset' ? t('loading') : t('reset_system')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </ControlCard>
                    <ControlCard title={t('targeted_trades')}>
                        <div className="flex flex-col md:flex-row md:items-end gap-4">
                            <div className="flex-1">
                                <label className="text-sm text-gray-400">{t('initial_amount')}</label>
                                <input
                                    type="number"
                                    value={goalStart}
                                    onChange={event => setGoalStart(event.target.value)}
                                    disabled={processing === 'goal'}
                                    className="w-full mt-2 p-2 bg-gray-800/50 border border-gray-700 rounded-lg"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-sm text-gray-400">{t('target_amount')}</label>
                                <input
                                    type="number"
                                    value={goalTarget}
                                    onChange={event => setGoalTarget(event.target.value)}
                                    disabled={processing === 'goal'}
                                    className="w-full mt-2 p-2 bg-gray-800/50 border border-gray-700 rounded-lg"
                                />
                            </div>
                            <button
                                onClick={handleStartGoal}
                                disabled={processing === 'goal'}
                                className={`bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors ${processing === 'goal' ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                {processing === 'goal' ? t('loading') : t('start_new_goal')}
                            </button>
                        </div>
                    </ControlCard>
                </div>
                <div className="space-y-6">
                    <ControlCard title={t('ai_status')}>
                        <div className="space-y-3">
                            {aiStatus.map(item => (
                                <div key={item.id} className="flex justify-between items-center text-sm">
                                    <span className="text-gray-300">{item.name}</span>
                                    <span
                                        className={`font-semibold ${
                                            item.tone === 'success'
                                                ? 'text-green-400'
                                                : item.tone === 'warning'
                                                ? 'text-yellow-400'
                                                : 'text-blue-400'
                                        }`}
                                    >
                                        {item.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </ControlCard>
                    <ControlCard title={t('quick_actions')}>
                        <div className="flex flex-col space-y-2">
                            {quickActions.map(action => (
                                <button
                                    key={action}
                                    onClick={() => handleQuickAction(action)}
                                    disabled={processing === action}
                                    className={`w-full text-left p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm transition-colors ${processing === action ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    {processing === action ? t('loading') : t(action)}
                                </button>
                            ))}
                        </div>
                    </ControlCard>
                </div>
            </div>
        </div>
    );
};

export default ProfessionalAutopilot;
