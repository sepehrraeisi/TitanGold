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

const ControlCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <div className={`bg-card border border-border rounded-lg ${className ?? ''}`}>
        <h3 className="font-semibold text-foreground p-4 border-b border-border">{title}</h3>
        <div className="p-4 space-y-4">{children}</div>
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
            <div className="space-y-6">
                <div className="h-32 bg-card border border-border rounded-lg animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, idx) => (
                        <div key={idx} className="h-24 bg-card border border-border rounded-lg animate-pulse" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, idx) => (
                        <div key={idx} className="h-64 bg-card border border-border rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (!autopilot) {
        return (
            <div className="space-y-4">
                <div className="bg-card border border-border rounded-lg p-6">
                    <p className="text-sm text-muted-foreground">{t('autopilot_error_loading') || 'Failed to load autopilot state'}</p>
                    <button
                        onClick={() => {
                            setIsLoading(true);
                            void loadAllData();
                        }}
                        className="mt-4 px-4 py-2 rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground"
                    >
                        {t('retry') || 'Retry'}
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
        <div className="space-y-6">
            {/* Professional Autopilot System Header */}
            <div className="bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-cyan-600/20 border border-purple-500/30 rounded-lg p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-foreground mb-2">
                            {t('professional_autopilot_system') || '🚀 Professional Autopilot System'}
                        </h2>
                        <p className="text-muted-foreground mb-2">
                            {t('full_control_desc') || 'Full control of your automated trades. Powered by Artemis AI and 15 specialized agents.'}
                        </p>
                        <div className="flex flex-wrap gap-4 mt-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${autopilot.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                                <span className="text-sm text-muted-foreground">
                                    {t('system_status') || 'System'}: <span className={`font-semibold ${autopilot.isActive ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {t(autopilot.isActive ? 'active' : 'inactive')}
                                    </span>
                                </span>
                </div>
                            {artemis && (
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${artemis.status === 'active' ? 'bg-blue-500' : 'bg-gray-500'}`} />
                                    <span className="text-sm text-muted-foreground">
                                        {t('artemis_ai') || 'Artemis'}: <span className="font-semibold text-blue-400">{artemis.status}</span>
                                    </span>
                                </div>
                            )}
                            {tradingEngineStatus && (
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${tradingEngineStatus.isRunning ? 'bg-green-500' : 'bg-gray-500'}`} />
                                    <span className="text-sm text-muted-foreground">
                                        {t('trading_engine') || 'Engine'}: <span className={`font-semibold ${tradingEngineStatus.isRunning ? 'text-green-400' : 'text-gray-400'}`}>
                                            {tradingEngineStatus.isRunning ? (t('running') || 'Running') : (t('stopped') || 'Stopped')}
                                        </span>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                    <button
                            onClick={() => setShowEmergencyConfirm(true)}
                        disabled={processing === 'emergency'}
                            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                            {processing === 'emergency' ? t('loading') || 'Loading...' : t('emergency_stop') || '🛑 Emergency Stop'}
                    </button>
                    </div>
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

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map(stat => (
                    <StatCard key={stat.label} label={stat.label} value={stat.value} />
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - System Controls */}
                <div className="lg:col-span-2 space-y-6">
                    {/* System Control */}
                    <ControlCard title={t('system_control') || 'System Control'}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-muted-foreground block mb-2">{t('autopilot_status') || 'Autopilot Status'}</label>
                                    <div className="flex items-center gap-3">
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
                                        <span className="text-sm text-foreground">{t(autopilot.isActive ? 'active' : 'inactive')}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground block mb-2">{t('operating_mode') || 'Operating Mode'}</label>
                                    <select
                                        className="w-full p-2 bg-background border border-border rounded-lg focus:ring-purple-500 focus:border-purple-500 text-foreground"
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
                                    <label className="text-sm text-muted-foreground block mb-2">{t('trading_budget') || 'Trading Budget'}</label>
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
                                        className="w-full p-2 bg-background border border-border rounded-lg text-foreground"
                                        placeholder="$0"
                                    />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-muted-foreground block mb-2">{t('risk_level') || 'Risk Level'}</label>
                                    <div className="space-y-2">
                                        {(Object.keys(riskLabelKeys) as AutopilotRiskLevel[]).map(level => (
                                            <label key={level} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="risk"
                                                    value={level}
                                                    checked={autopilot.riskLevel === level}
                                                    onChange={handleRiskChange}
                                                    disabled={processing === 'risk'}
                                                    className="text-purple-500 bg-background border-border focus:ring-purple-500"
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
                                        className={`flex-1 bg-yellow-600/80 hover:bg-yellow-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors`}
                                    >
                                        {processing === 'temp_pause' ? t('loading') || 'Loading...' : t('temp_stop') || '⏸️ Pause'}
                                    </button>
                                    <button
                                        onClick={() => setShowResetConfirm(true)}
                                        disabled={processing === 'reset'}
                                        className={`flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors`}
                                    >
                                        {processing === 'reset' ? t('loading') || 'Loading...' : t('reset_system') || '🔄 Reset'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </ControlCard>

                    {/* Target Goal */}
                    <ControlCard title={t('targeted_trades') || 'Target Goal'}>
                        <div className="space-y-4">
                        <div className="flex flex-col md:flex-row md:items-end gap-4">
                            <div className="flex-1">
                                    <label className="text-sm text-muted-foreground block mb-2">{t('initial_amount') || 'Initial Amount'}</label>
                                <input
                                    type="number"
                                    value={goalStart}
                                    onChange={event => setGoalStart(event.target.value)}
                                    disabled={processing === 'goal'}
                                        className="w-full p-2 bg-background border border-border rounded-lg text-foreground"
                                        placeholder="$0"
                                />
                            </div>
                            <div className="flex-1">
                                    <label className="text-sm text-muted-foreground block mb-2">{t('target_amount') || 'Target Amount'}</label>
                                <input
                                    type="number"
                                    value={goalTarget}
                                    onChange={event => setGoalTarget(event.target.value)}
                                    disabled={processing === 'goal'}
                                        className="w-full p-2 bg-background border border-border rounded-lg text-foreground"
                                        placeholder="$0"
                                />
                            </div>
                            <button
                                onClick={handleStartGoal}
                                disabled={processing === 'goal'}
                                    className={`bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-colors`}
                            >
                                    {processing === 'goal' ? t('loading') || 'Loading...' : t('start_new_goal') || '🎯 Start Goal'}
                            </button>
                            </div>
                            {autopilot.goal.targetCapital > autopilot.goal.startCapital && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{t('goal_progress') || 'Goal Progress'}</span>
                                        <span className="text-foreground font-semibold">{Math.min(100, Math.max(0, goalProgress)).toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${Math.min(100, Math.max(0, goalProgress))}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>{formatCurrency(autopilot.goal.startCapital)}</span>
                                        <span>{formatCurrency(autopilot.goal.targetCapital)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ControlCard>
                </div>

                {/* Right Column - AI Status & Quick Actions */}
                <div className="space-y-6">
                    {/* AI Integration Status */}
                    <ControlCard title={t('ai_integration_status') || 'AI Integration Status'}>
                        <div className="space-y-3">
                            {aiIntegrationStatus.map(item => (
                                <div key={item.id} className="space-y-1">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-foreground">{item.name}</span>
                                    <span
                                        className={`font-semibold ${
                                            item.tone === 'success'
                                                ? 'text-green-400'
                                                : item.tone === 'warning'
                                                ? 'text-yellow-400'
                                                    : item.tone === 'error'
                                                    ? 'text-red-400'
                                                : 'text-blue-400'
                                        }`}
                                    >
                                        {item.status}
                                    </span>
                                    </div>
                                    {item.details && (
                                        <p className="text-xs text-muted-foreground">{item.details}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ControlCard>

                    {/* Exchange Connections - Always visible */}
                    <ControlCard title={t('exchange_connections') || 'Exchange Connections'}>
                        {exchangeStatus.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                                {t('no_exchanges_configured') || 'No exchanges configured'}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {exchangeStatus.map(exchange => (
                                    <div key={exchange.name} className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${
                                                exchange.tone === 'success' ? 'bg-green-500' : 'bg-red-500'
                                            }`} />
                                            <span className="text-foreground font-medium">{exchange.name}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span
                                                className={`font-semibold ${
                                                    exchange.tone === 'success' ? 'text-green-400' : 'text-red-400'
                                                }`}
                                            >
                                                {exchange.status}
                                            </span>
                                            {exchange.lastTested && (
                                                <span className="text-xs text-muted-foreground">
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
                    <ControlCard title={t('quick_actions') || 'Quick Actions'}>
                        <div className="flex flex-col space-y-2">
                            {quickActions.map(action => (
                                <button
                                    key={action}
                                    onClick={() => handleQuickAction(action)}
                                    disabled={processing === action}
                                    className={`w-full text-left p-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-foreground`}
                                >
                                    {processing === action ? t('loading') || 'Loading...' : t(action) || action}
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
                    <div className="bg-card border border-border rounded-lg p-6">
                        <div className="text-center py-10">
                            <p className="text-muted-foreground mb-4">{t('trading_engine_not_available') || 'Trading Engine is not available'}</p>
                            <button
                                onClick={() => void loadAllData()}
                                className="px-4 py-2 bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg"
                            >
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
