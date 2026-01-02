import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import StatCard from './StatCard.tsx';
import TradingEngineDashboard from './TradingEngineDashboard.tsx';
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
    fetchArtemisState,
    fetchAIAgents,
    fetchTradingEngineStatus,
    fetchAPIConfigData,
    fetchConnectionSettings,
} from '../../services/api.ts';
import type { AutopilotMode, AutopilotQuickAction, AutopilotRiskLevel, AutopilotState, ArtemisState, AIAgent } from '../../types.ts';
import { Toast } from '../ui/toast.tsx';
import { ConfirmModal } from '../ui/confirm-modal.tsx';

const ControlCard: React.FC<{ title: string; children: React.ReactNode; className?: string; icon?: React.ReactNode }> = ({ title, children, className, icon }) => (
    <div className={`bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl shadow-lg ${className ?? ''}`}>
        <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-gray-700/50">
            {icon && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
                    {icon}
                </div>
            )}
            <h3 className="font-bold text-white text-base sm:text-lg">{title}</h3>
        </div>
        <div className="p-4 sm:p-5 space-y-4">{children}</div>
    </div>
);

type FeedbackState = { type: 'success' | 'error'; message: string } | null;
type StatusTone = 'success' | 'warning' | 'info' | 'error';

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
    const [artemis, setArtemis] = useState<ArtemisState | null>(null);
    const [aiAgents, setAIAgents] = useState<AIAgent[]>([]);
    const [tradingEngineStatus, setTradingEngineStatus] = useState<any>(null);
    const [apiConfig, setApiConfig] = useState<any>(null);
    const [mexcConnection, setMexcConnection] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<FeedbackState>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [budgetInput, setBudgetInput] = useState('');
    const [goalStart, setGoalStart] = useState('');
    const [goalTarget, setGoalTarget] = useState('');

    const syncFormState = useCallback((state: AutopilotState) => {
        setBudgetInput(state.tradingBudget.toString());
        setGoalStart(state.goal.startCapital.toString());
        setGoalTarget(state.goal.targetCapital.toString());
    }, []);

    const loadAllData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [artemisData, agentsData, engineStatus, apiConfigData, mexcConn] = await Promise.all([
                fetchArtemisState().catch(() => null),
                fetchAIAgents().catch(() => []),
                fetchTradingEngineStatus().catch(() => null),
                fetchAPIConfigData().catch(() => null),
                fetchConnectionSettings().catch(() => null),
            ]);

            // Build autopilot state from real data (not mock)
            if (artemisData && engineStatus) {
                const realAutopilotState: AutopilotState = {
                    isActive: artemisData.status === 'active' && engineStatus.isRunning,
                    operatingMode: 'balanced', // Can be synced from Artemis config
                    tradingBudget: 0, // Should come from real settings
                    riskLevel: 'balanced',
                    goal: {
                        startCapital: 0,
                        targetCapital: 0,
                        progress: 0,
                        etaMinutes: 0,
                        lastSyncSeconds: 0,
                        activeTrades: engineStatus.activeTrades || 0,
                        maxConcurrentTrades: engineStatus.maxConcurrentTrades || 20,
                        successRate: engineStatus.stats.executedTrades > 0
                            ? (engineStatus.stats.successfulTrades / engineStatus.stats.executedTrades) * 100
                            : 0,
                        agentsOnline: agentsData.filter(a => a.status === 'active').length,
                        agentsTraining: agentsData.filter(a => a.status === 'training').length,
                        agentsTotal: agentsData.length || 15,
                        mode: artemisData.status === 'active' ? 'auto' : 'paused',
                        nextActionKey: 'autopilot_next_action_desc',
                    },
                    metrics: {
                        totalPerformance: engineStatus.stats.totalProfit > 0 ? (engineStatus.stats.totalProfit / 100) : 0,
                        winRate: engineStatus.stats.executedTrades > 0
                            ? (engineStatus.stats.successfulTrades / engineStatus.stats.executedTrades) * 100
                            : 0,
                        totalTrades: engineStatus.stats.executedTrades || 0,
                        todayProfit: engineStatus.stats.dailyProfit || 0,
                    },
                    statusMessageKey: artemisData.status === 'active' ? 'autopilot_status_running' : 'autopilot_status_paused',
                    lastUpdated: new Date().toISOString(),
                };
                setAutopilot(realAutopilotState);
                syncFormState(realAutopilotState);
            } else {
                // If no real data, set minimal state
                const minimalState: AutopilotState = {
                    isActive: false,
                    operatingMode: 'balanced',
                    tradingBudget: 0,
                    riskLevel: 'balanced',
                    goal: {
                        startCapital: 0,
                        targetCapital: 0,
                        progress: 0,
                        etaMinutes: 0,
                        lastSyncSeconds: 0,
                        activeTrades: 0,
                        maxConcurrentTrades: 20,
                        successRate: 0,
                        agentsOnline: 0,
                        agentsTraining: 0,
                        agentsTotal: 15,
                        mode: 'paused',
                        nextActionKey: 'autopilot_next_action_desc',
                    },
                    metrics: {
                        totalPerformance: 0,
                        winRate: 0,
                        totalTrades: 0,
                        todayProfit: 0,
                    },
                    statusMessageKey: 'autopilot_status_paused',
                    lastUpdated: new Date().toISOString(),
                };
                setAutopilot(minimalState);
                syncFormState(minimalState);
            }

            if (artemisData) setArtemis(artemisData);
            if (agentsData) setAIAgents(agentsData);
            if (engineStatus) setTradingEngineStatus(engineStatus);
            if (apiConfigData) setApiConfig(apiConfigData);
            if (mexcConn) setMexcConnection(mexcConn);
        } catch (error) {
            console.error('Failed to load autopilot data', error);
            setFeedback({ type: 'error', message: t('autopilot_error_loading') || 'Failed to load data' });
        } finally {
            setIsLoading(false);
        }
    }, [syncFormState, t]);

    useEffect(() => {
        void loadAllData();
        // Only refresh if backend is available (not in error state)
        const interval = setInterval(() => {
            // Only refresh if we're not currently loading
            if (!isLoading) {
                void loadAllData();
            }
        }, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, []); // Empty dependency array - only run once on mount

    useEffect(() => {
        if (!feedback) return;
        const timer = setTimeout(() => setFeedback(null), 4000);
        return () => clearTimeout(timer);
    }, [feedback]);

    const showFeedback = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setFeedback({ type, message });
        setToast({ message, type });
    }, []);

    const formatCurrency = useCallback((value: number) => `$${numberFormatter.format(value)}`, []);

    const stats = useMemo(() => {
        if (!autopilot) {
            return [] as Array<{ label: string; value: string }>;
        }
        return [
            { label: t('total_performance') || 'Total Performance', value: `${percentFormatter.format(autopilot.metrics.totalPerformance)}%` },
            { label: t('win_rate') || 'Win Rate', value: `${percentFormatter.format(autopilot.metrics.winRate)}%` },
            { label: t('total_trades') || 'Total Trades', value: numberFormatter.format(autopilot.metrics.totalTrades) },
            { label: t('today_profit') || 'Today Profit', value: formatCurrency(autopilot.metrics.todayProfit) },
        ];
    }, [autopilot, formatCurrency, t]);

    // AI Integration Status - Real-time from Artemis and Agents
    const aiIntegrationStatus = useMemo(() => {
        const status: Array<{ id: string; name: string; status: string; tone: StatusTone; details?: string }> = [];

        // Artemis Status
        if (artemis) {
            // Calculate success rate safely
            const successRate = artemis.totalDecisions && artemis.successfulDecisions
                ? (artemis.successfulDecisions / artemis.totalDecisions) * 100
                : (artemis.successRate || 0);
            
            status.push({
                id: 'artemis',
                name: t('artemis_ai') || '🧠 Artemis AI',
                status: artemis.status === 'active' ? (t('active') || 'Active') : (t('inactive') || 'Inactive'),
                tone: artemis.status === 'active' ? 'success' : 'warning',
                details: `${artemis.totalDecisions || 0} ${t('decisions') || 'decisions'}, ${successRate.toFixed(1)}% ${t('success_rate') || 'success rate'}`,
            });
        }

        // External AI Providers Status (from Artemis config)
        if (artemis?.config?.decisionEngine) {
            const activeModel = artemis.config.decisionEngine.activeModel;
            const models = ['internal', 'claude', 'gemini', 'openai', 'deepseek'];
            const modelNames = {
                internal: t('internal_ai') || '🤖 Internal AI',
                claude: t('claude3') || '🤖 Claude 3',
                gemini: t('google_gemini') || '🤖 Google Gemini',
                openai: t('chatgpt4') || '🤖 ChatGPT-4',
                deepseek: t('deepseek') || '🤖 DeepSeek',
            };

            models.forEach(model => {
                if (activeModel === model || activeModel === 'hybrid') {
                    status.push({
                        id: model,
                        name: modelNames[model as keyof typeof modelNames] || model,
                        status: t('connected') || 'Connected',
                        tone: 'success',
                    });
                }
            });
        }

        // 15 AI Agents Status
        if (aiAgents.length > 0) {
            const activeAgents = aiAgents.filter(a => a.status === 'active').length;
            const trainingAgents = aiAgents.filter(a => a.status === 'training').length;
            status.push({
                id: 'ai_agents',
                name: t('ai_agents_15') || '🤖 AI Agents (15)',
                status: `${activeAgents}/${aiAgents.length} ${t('active') || 'Active'}`,
                tone: activeAgents >= 12 ? 'success' : activeAgents >= 8 ? 'warning' : 'error',
                details: trainingAgents > 0 ? `${trainingAgents} ${t('in_training') || 'in training'}` : undefined,
            });
        }

        return status;
    }, [artemis, aiAgents, t]);

    // Exchange Connection Status - Real data from connectionSettings (not mock)
    const exchangeStatus = useMemo(() => {
        const exchanges: Array<{ name: string; status: string; tone: StatusTone; lastTested?: string }> = [];
        
        // Check MEXC connection from real connectionSettings (not mock data)
        if (mexcConnection) {
            const isConnected = mexcConnection.isConnected === true && 
                               mexcConnection.apiKey && 
                               mexcConnection.apiSecret &&
                               mexcConnection.apiKey.length > 0 &&
                               mexcConnection.apiSecret.length > 0;
            exchanges.push({
                name: 'MEXC',
                status: isConnected ? (t('connected') || 'Connected') : (t('disconnected') || 'Disconnected'),
                tone: isConnected ? 'success' : 'error',
            });
        } else {
            // If no connection data, show as disconnected
            exchanges.push({
                name: 'MEXC',
                status: t('disconnected') || 'Disconnected',
                tone: 'error' as StatusTone,
            });
        }

        // Only show other exchanges if they're actually configured (not mock data)
        if (apiConfig?.exchangeServices) {
            apiConfig.exchangeServices.forEach((ex: any) => {
                // Skip MEXC as we already handled it above
                if (ex.name === 'MEXC' || ex.id === 'ex-mexc') return;
                
                // Only show if it's actually configured (has real apiKey/secret, not mock)
                // Mock data has patterns like 'MX***001', 'BN***221', etc.
                const hasRealConfig = ex.maskedKey && 
                                     ex.maskedKey !== 'Not configured' && 
                                     !ex.maskedKey.match(/^[A-Z]{2}\*\*\*[0-9]{3}$/); // Pattern for mock data
                
                if (hasRealConfig) {
                    const isConnected = ex.connected === true;
                    exchanges.push({
                        name: ex.name || ex.id?.replace('ex-', '').toUpperCase() || 'Unknown',
                        status: isConnected ? (t('connected') || 'Connected') : (t('disconnected') || 'Disconnected'),
                        tone: isConnected ? 'success' : 'error',
                        lastTested: ex.lastTestedAt,
                    });
                }
            });
        }

        return exchanges;
    }, [mexcConnection, apiConfig, t]);

    if (isLoading) {
        return (
            <div className="space-y-4 sm:space-y-6 pb-6">
                <div className="h-32 bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl animate-pulse" />
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    {Array.from({ length: 4 }).map((_, idx) => (
                        <div key={idx} className="h-24 bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl animate-pulse" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    {Array.from({ length: 3 }).map((_, idx) => (
                        <div key={idx} className="h-64 bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (!autopilot) {
        return (
            <div className="space-y-4 pb-6">
                <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-red-500/30 rounded-xl p-6 sm:p-8 shadow-lg">
                    <div className="text-center">
                        <svg className="w-12 h-12 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm sm:text-base text-gray-300 mb-2 font-medium">{t('autopilot_error_loading') || 'Failed to load autopilot state'}</p>
                        <p className="text-xs text-gray-500 mb-6">Please check your connection and try again</p>
                        <button
                            onClick={() => {
                                setIsLoading(true);
                                void loadAllData();
                            }}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold transition-all duration-200 shadow-lg shadow-purple-500/30 active:scale-95"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356-2A8.001 8.001 0 004 12c0 2.127.72 4.06 1.92 5.636m0 0a7.995 7.995 0 01-1.92-5.636c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8c-2.127 0-4.06-.72-5.636-1.92m0 0L4 20m15.356-5H19" />
                            </svg>
                            {t('retry') || 'Retry'}
                        </button>
                    </div>
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
            showFeedback(t(updated.isActive ? 'autopilot_feedback_resumed' : 'autopilot_feedback_paused') || 'Status updated');
        } catch (error) {
            console.error('Failed to toggle autopilot', error);
            showFeedback(t('autopilot_feedback_error') || 'Operation failed', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handleEmergencyStop = async () => {
        setShowEmergencyConfirm(false);
        setProcessing('emergency');
        try {
            const updated = await emergencyStopAutopilot();
            setAutopilot(updated);
            syncFormState(updated);
            showFeedback(t('autopilot_feedback_emergency') || 'Emergency stop executed');
        } catch (error) {
            console.error('Failed to trigger emergency stop', error);
            showFeedback(t('autopilot_feedback_error') || 'Operation failed', 'error');
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
            showFeedback(t('autopilot_feedback_temp_pause') || 'Temporarily paused');
        } catch (error) {
            console.error('Failed to pause autopilot', error);
            showFeedback(t('autopilot_feedback_error') || 'Operation failed', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handleResetSystem = async () => {
        setShowResetConfirm(false);
        setProcessing('reset');
        try {
            const updated = await resetAutopilotSystem();
            setAutopilot(updated);
            syncFormState(updated);
            showFeedback(t('autopilot_feedback_reset') || 'System reset');
        } catch (error) {
            console.error('Failed to reset autopilot', error);
            showFeedback(t('autopilot_feedback_error') || 'Operation failed', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handleModeChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value as AutopilotMode;
        if (value === autopilot.operatingMode) return;
        setProcessing('mode');
        try {
            const updated = await updateAutopilotMode(value);
            setAutopilot(updated);
            syncFormState(updated);
            showFeedback(t('autopilot_feedback_mode', { mode: t(modeLabelKeys[value]) }) || 'Mode updated');
        } catch (error) {
            console.error('Failed to update mode', error);
            showFeedback(t('autopilot_feedback_error') || 'Operation failed', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handleBudgetCommit = async () => {
        const parsed = Number(budgetInput);
        if (Number.isNaN(parsed) || parsed <= 0) {
            showFeedback(t('autopilot_feedback_error') || 'Invalid budget', 'error');
            syncFormState(autopilot);
            return;
        }
        if (parsed === autopilot.tradingBudget) return;
        setProcessing('budget');
        try {
            const updated = await updateAutopilotBudget(parsed);
            setAutopilot(updated);
            syncFormState(updated);
            showFeedback(t('autopilot_feedback_budget', { budget: numberFormatter.format(parsed) }) || 'Budget updated');
        } catch (error) {
            console.error('Failed to update budget', error);
            showFeedback(t('autopilot_feedback_error') || 'Operation failed', 'error');
            syncFormState(autopilot);
        } finally {
            setProcessing(null);
        }
    };

    const handleRiskChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value as AutopilotRiskLevel;
        if (value === autopilot.riskLevel) return;
        setProcessing('risk');
        try {
            const updated = await updateAutopilotRiskLevel(value);
            setAutopilot(updated);
            syncFormState(updated);
            showFeedback(t('autopilot_feedback_risk', { risk: t(riskLabelKeys[value]) }) || 'Risk level updated');
        } catch (error) {
            console.error('Failed to update risk level', error);
            showFeedback(t('autopilot_feedback_error') || 'Operation failed', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handleStartGoal = async () => {
        const startValue = Number(goalStart);
        const targetValue = Number(goalTarget);
        if (Number.isNaN(startValue) || Number.isNaN(targetValue) || startValue <= 0 || targetValue <= startValue) {
            showFeedback(t('autopilot_feedback_goal_invalid') || 'Invalid goal values', 'error');
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
            }) || 'Goal started');
        } catch (error) {
            console.error('Failed to start new goal', error);
            showFeedback(t('autopilot_feedback_error') || 'Operation failed', 'error');
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
            showFeedback(t('autopilot_feedback_quick_action', { action: t(result.actionKey) }) || 'Action completed');
        } catch (error) {
            console.error('Failed to run quick action', error);
            showFeedback(t('autopilot_feedback_error') || 'Operation failed', 'error');
        } finally {
            setProcessing(null);
        }
    };

    // Calculate goal progress
    const goalProgress = autopilot.goal.targetCapital > autopilot.goal.startCapital
        ? ((autopilot.goal.startCapital + (autopilot.metrics.todayProfit || 0) - autopilot.goal.startCapital) / (autopilot.goal.targetCapital - autopilot.goal.startCapital)) * 100
        : 0;

    return (
        <div className="space-y-4 sm:space-y-6 pb-6">
            {/* Professional Autopilot System Header - Improved Design */}
            <div className="bg-gradient-to-br from-purple-600/20 via-blue-600/20 to-indigo-600/20 border border-purple-500/30 rounded-xl p-5 sm:p-6 shadow-lg shadow-purple-500/10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                                    {t('professional_autopilot_system') || 'Professional Autopilot System'}
                                </h2>
                                <p className="text-sm text-gray-400">
                                    {t('full_control_desc') || 'Full control of your automated trades. Powered by Artemis AI and 15 specialized agents.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3 sm:gap-4 mt-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/40 border border-gray-700/50">
                                <div className={`w-2 h-2 rounded-full ${autopilot.isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                                <span className="text-xs sm:text-sm text-gray-300">
                                    {t('system_status') || 'System'}: <span className={`font-semibold ${autopilot.isActive ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {t(autopilot.isActive ? 'active' : 'inactive')}
                                    </span>
                                </span>
                            </div>
                            {artemis && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/40 border border-gray-700/50">
                                    <div className={`w-2 h-2 rounded-full ${artemis.status === 'active' ? 'bg-blue-400' : 'bg-gray-500'}`} />
                                    <span className="text-xs sm:text-sm text-gray-300">
                                        {t('artemis_ai') || 'Artemis'}: <span className="font-semibold text-blue-400 capitalize">{artemis.status}</span>
                                    </span>
                                </div>
                            )}
                            {tradingEngineStatus && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/40 border border-gray-700/50">
                                    <div className={`w-2 h-2 rounded-full ${tradingEngineStatus.isRunning ? 'bg-green-400' : 'bg-gray-500'}`} />
                                    <span className="text-xs sm:text-sm text-gray-300">
                                        {t('trading_engine') || 'Engine'}: <span className={`font-semibold ${tradingEngineStatus.isRunning ? 'text-green-400' : 'text-gray-400'}`}>
                                            {tradingEngineStatus.isRunning ? (t('running') || 'Running') : (t('stopped') || 'Stopped')}
                                        </span>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <button
                            onClick={() => setShowEmergencyConfirm(true)}
                            disabled={processing === 'emergency'}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-5 rounded-lg transition-all duration-200 shadow-lg shadow-red-500/30 active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            {processing === 'emergency' ? t('loading') || 'Loading...' : t('emergency_stop') || 'Emergency Stop'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Improved Feedback Messages */}
            {feedback && (
                <div
                    className={`rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm animate-in slide-in-from-top-2 duration-300 ${
                        feedback.type === 'success'
                            ? 'border-green-500/50 bg-gradient-to-r from-green-500/20 to-emerald-500/10 text-green-200 shadow-green-500/20'
                            : 'border-red-500/50 bg-gradient-to-r from-red-500/20 to-rose-500/10 text-red-200 shadow-red-500/20'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {feedback.type === 'success' ? (
                            <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        <span className="font-medium">{feedback.message}</span>
                    </div>
                </div>
            )}

            {/* Statistics Cards - Improved Layout */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {stats.map(stat => (
                    <StatCard key={stat.label} label={stat.label} value={stat.value} />
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - System Controls */}
                <div className="lg:col-span-2 space-y-6">
                    {/* System Control */}
                    <ControlCard 
                        title={t('system_control') || 'System Control'}
                        icon={
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        }
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-300 block mb-3">{t('autopilot_status') || 'Autopilot Status'}</label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleToggleActive}
                                            disabled={isToggleDisabled}
                                            aria-pressed={autopilot.isActive}
                                            className={`relative inline-flex h-9 w-16 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#1a1c2a] ${
                                                autopilot.isActive ? 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg shadow-green-500/30' : 'bg-gray-700'
                                            } ${isToggleDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'}`}
                                        >
                                            <span
                                                className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-lg transition-all duration-200 ${
                                                    autopilot.isActive ? 'translate-x-8' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                        <span className={`text-sm font-semibold ${autopilot.isActive ? 'text-green-400' : 'text-gray-400'}`}>
                                            {t(autopilot.isActive ? 'active' : 'inactive')}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-300 block mb-2">{t('operating_mode') || 'Operating Mode'}</label>
                                    <select
                                        className="w-full p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white transition-all duration-200 hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={autopilot.operatingMode}
                                        onChange={handleModeChange}
                                        disabled={processing === 'mode'}
                                    >
                                        {(Object.keys(modeLabelKeys) as AutopilotMode[]).map(mode => (
                                            <option key={mode} value={mode} className="bg-gray-800">
                                                {t(modeLabelKeys[mode])}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-300 block mb-2">{t('trading_budget') || 'Trading Budget'}</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
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
                                            className="w-full pl-8 pr-3 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-300 block mb-3">{t('risk_level') || 'Risk Level'}</label>
                                    <div className="space-y-2.5 bg-gray-800/30 p-3 rounded-lg border border-gray-700/30">
                                        {(Object.keys(riskLabelKeys) as AutopilotRiskLevel[]).map(level => (
                                            <label key={level} className="flex items-center gap-3 text-sm text-gray-200 cursor-pointer hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700/30">
                                                <input
                                                    type="radio"
                                                    name="risk"
                                                    value={level}
                                                    checked={autopilot.riskLevel === level}
                                                    onChange={handleRiskChange}
                                                    disabled={processing === 'risk'}
                                                    className="w-4 h-4 text-purple-500 bg-gray-700 border-gray-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                                                />
                                                <span className="font-medium">{t(riskLabelKeys[level])}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handleTemporaryPause}
                                        disabled={processing === 'temp_pause'}
                                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-600/80 to-amber-600/80 hover:from-yellow-600 hover:to-amber-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-all duration-200 shadow-lg shadow-yellow-500/20 active:scale-95"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {processing === 'temp_pause' ? t('loading') || 'Loading...' : t('temp_stop') || 'Pause'}
                                    </button>
                                    <button
                                        onClick={() => setShowResetConfirm(true)}
                                        disabled={processing === 'reset'}
                                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-all duration-200 shadow-lg active:scale-95"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356-2A8.001 8.001 0 004 12c0 2.127.72 4.06 1.92 5.636m0 0a7.995 7.995 0 01-1.92-5.636c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8c-2.127 0-4.06-.72-5.636-1.92m0 0L4 20m15.356-5H19" />
                                        </svg>
                                        {processing === 'reset' ? t('loading') || 'Loading...' : t('reset_system') || 'Reset'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </ControlCard>

                    {/* Target Goal */}
                    <ControlCard 
                        title={t('targeted_trades') || 'Target Goal'}
                        icon={
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                        }
                    >
                        <div className="space-y-5">
                            <div className="flex flex-col md:flex-row md:items-end gap-4">
                                <div className="flex-1">
                                    <label className="text-sm font-medium text-gray-300 block mb-2">{t('initial_amount') || 'Initial Amount'}</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                        <input
                                            type="number"
                                            value={goalStart}
                                            onChange={event => setGoalStart(event.target.value)}
                                            disabled={processing === 'goal'}
                                            className="w-full pl-8 pr-3 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="text-sm font-medium text-gray-300 block mb-2">{t('target_amount') || 'Target Amount'}</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                        <input
                                            type="number"
                                            value={goalTarget}
                                            onChange={event => setGoalTarget(event.target.value)}
                                            disabled={processing === 'goal'}
                                            className="w-full pl-8 pr-3 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleStartGoal}
                                    disabled={processing === 'goal'}
                                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg shadow-purple-500/30 active:scale-95"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {processing === 'goal' ? t('loading') || 'Loading...' : t('start_new_goal') || 'Start Goal'}
                                </button>
                            </div>
                            {autopilot.goal.targetCapital > autopilot.goal.startCapital && (
                                <div className="space-y-3 bg-gray-800/30 p-4 rounded-lg border border-gray-700/30">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-300 font-medium">{t('goal_progress') || 'Goal Progress'}</span>
                                        <span className="text-white font-bold text-lg">{Math.min(100, Math.max(0, goalProgress)).toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-700/50 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 h-3 rounded-full transition-all duration-500 shadow-lg shadow-purple-500/30"
                                            style={{ width: `${Math.min(100, Math.max(0, goalProgress))}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span className="font-medium">{formatCurrency(autopilot.goal.startCapital)}</span>
                                        <span className="font-medium">{formatCurrency(autopilot.goal.targetCapital)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ControlCard>
                </div>

                {/* Right Column - AI Status & Quick Actions */}
                <div className="space-y-6">
                    {/* AI Integration Status */}
                    <ControlCard 
                        title={t('ai_integration_status') || 'AI Integration Status'}
                        icon={
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                        }
                    >
                        <div className="space-y-3">
                            {aiIntegrationStatus.length === 0 ? (
                                <div className="text-center py-6 text-gray-500 text-sm">
                                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    <p>{t('no_ai_integration') || 'No AI integration available'}</p>
                                </div>
                            ) : (
                                aiIntegrationStatus.map(item => (
                                    <div key={item.id} className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/30 hover:bg-gray-800/60 transition-colors">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-gray-200">{item.name}</span>
                                            <span
                                                className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${
                                                    item.tone === 'success'
                                                        ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30'
                                                        : item.tone === 'warning'
                                                        ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30'
                                                        : item.tone === 'error'
                                                        ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                                                        : 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30'
                                                }`}
                                            >
                                                {item.status}
                                            </span>
                                        </div>
                                        {item.details && (
                                            <p className="text-xs text-gray-400 mt-2">{item.details}</p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </ControlCard>

                    {/* Exchange Connections - Always visible */}
                    <ControlCard 
                        title={t('exchange_connections') || 'Exchange Connections'}
                        icon={
                            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                            </svg>
                        }
                    >
                        {exchangeStatus.length === 0 ? (
                            <div className="text-center py-6 text-gray-500 text-sm">
                                <svg className="w-8 h-8 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                </svg>
                                <p>{t('no_exchanges_configured') || 'No exchanges configured'}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {exchangeStatus.map(exchange => (
                                    <div key={exchange.name} className="flex justify-between items-center p-3 rounded-lg bg-gray-800/40 border border-gray-700/30 hover:bg-gray-800/60 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`relative flex h-3 w-3 ${exchange.tone === 'success' ? '' : ''}`}>
                                                {exchange.tone === 'success' && (
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                )}
                                                <div className={`relative inline-flex rounded-full h-3 w-3 ${
                                                    exchange.tone === 'success' ? 'bg-green-500' : 'bg-red-500'
                                                }`} />
                                            </div>
                                            <span className="text-sm font-semibold text-gray-200">{exchange.name}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span
                                                className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${
                                                    exchange.tone === 'success'
                                                        ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30'
                                                        : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                                                }`}
                                            >
                                                {exchange.status}
                                            </span>
                                            {exchange.lastTested && (
                                                <span className="text-xs text-gray-500 mt-1">
                                                    {new Date(exchange.lastTested).toLocaleTimeString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ControlCard>

                    {/* Quick Actions */}
                    <ControlCard 
                        title={t('quick_actions') || 'Quick Actions'}
                        icon={
                            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        }
                    >
                        <div className="flex flex-col space-y-2.5">
                            {quickActions.map(action => (
                                <button
                                    key={action}
                                    onClick={() => handleQuickAction(action)}
                                    disabled={processing === action}
                                    className="w-full flex items-center justify-between gap-3 text-left p-3 bg-gradient-to-r from-gray-800/50 to-gray-800/30 hover:from-gray-700/50 hover:to-gray-700/30 border border-gray-700/50 hover:border-gray-600/50 rounded-lg text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed text-gray-200 hover:text-white group"
                                >
                                    <span className="font-medium">{processing === action ? t('loading') || 'Loading...' : t(action) || action}</span>
                                    <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                    </ControlCard>
                </div>
            </div>

            {/* Trading Engine Dashboard - Fully Integrated */}
            <div className="mt-8">
                {tradingEngineStatus ? (
                    <TradingEngineDashboard 
                        autopilotState={autopilot}
                        artemisState={artemis}
                        tradingEngineStatus={tradingEngineStatus}
                        onStatusChange={() => {
                            // Refresh all data when trading engine status changes
                            void loadAllData();
                        }}
                    />
                ) : (
                    <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-6 sm:p-8 shadow-lg">
                        <div className="text-center py-10">
                            <svg className="w-12 h-12 mx-auto mb-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p className="text-gray-300 mb-2 font-medium">{t('trading_engine_not_available') || 'Trading Engine is not available'}</p>
                            <p className="text-xs text-gray-500 mb-6">Please check your connection and try again</p>
                            <button
                                onClick={() => void loadAllData()}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold transition-all duration-200 shadow-lg shadow-purple-500/30 active:scale-95"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356-2A8.001 8.001 0 004 12c0 2.127.72 4.06 1.92 5.636m0 0a7.995 7.995 0 01-1.92-5.636c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8c-2.127 0-4.06-.72-5.636-1.92m0 0L4 20m15.356-5H19" />
                                </svg>
                                {t('retry') || 'Retry'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <ConfirmModal
                isOpen={showEmergencyConfirm}
                message={t('emergency_stop_confirm') || 'Are you sure you want to execute emergency stop? All active trades will be closed immediately.'}
                onConfirm={handleEmergencyStop}
                onCancel={() => setShowEmergencyConfirm(false)}
                type="danger"
            />

            <ConfirmModal
                isOpen={showResetConfirm}
                message={t('reset_system_confirm') || 'Are you sure you want to reset the system? All settings will be restored to defaults.'}
                onConfirm={handleResetSystem}
                onCancel={() => setShowResetConfirm(false)}
                type="warning"
            />

            {/* Toast Notifications */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default ProfessionalAutopilot;
