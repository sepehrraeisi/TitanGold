import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AITrainingSession, AITrainingStats, AITrainingMode, AITrainingStatus, AITrainingConfig, AIAgent, ArtemisState } from '../../types.ts';

type TrainingTab = 'overview' | 'agents' | 'sessions' | 'recommendations' | 'history' | 'settings';

const TrainingCenter: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AITrainingStats | null>(null);
    const [artemis, setArtemis] = useState<ArtemisState | null>(null);
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [activeTab, setActiveTab] = useState<TrainingTab>('overview');
    const [isScheduling, setIsScheduling] = useState(false);
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filterMode, setFilterMode] = useState<'all' | AITrainingMode>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | AITrainingStatus>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
    const [trainingConfig, setTrainingConfig] = useState<AITrainingConfig | null>(null);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [trainingData, artemisState, agentsData] = await Promise.all([
                    api.fetchTrainingData(),
                    api.fetchArtemisState(),
                    api.fetchAIAgents(),
                ]);
                setData(trainingData);
                setArtemis(artemisState);
                setAgents(agentsData);
                setTrainingConfig(trainingData.config || null);
            } catch (e) {
                console.error('Failed to load training data:', e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const handleArtemisAutoConfig = async () => {
        setIsAutoConfiguring(true);
        try {
            const config = await api.artemisAutoConfigureTraining();
            setTrainingConfig(config);
            if (data) {
                const updatedData = { ...data, config };
                setData(updatedData);
            }
            alert(t('artemis_config_success') || 'Artemis has automatically configured training settings based on current conditions!');
        } catch (e: any) {
            console.error('Failed to auto-configure with Artemis:', e);
            const errorMessage = e?.message || e?.toString() || 'Unknown error';
            alert(`${t('artemis_config_failed') || 'Failed to auto-configure with Artemis'}: ${errorMessage}`);
        } finally {
            setIsAutoConfiguring(false);
        }
    };

    // Handle Train All - Create session for all agents immediately
    const handleTrainAll = async () => {
        if (!agents || agents.length === 0) {
            alert(t('no_agents_available') || 'No agents available');
            return;
        }

        if (!confirm(t('train_all_confirm') || `Create training session for all ${agents.length} agents?`)) {
            return;
        }

        setIsScheduling(true);
        try {
            const allAgentIds = agents.map(a => a.id);
            const response = await api.scheduleAITrainingSession({
                title: `Collective Training - All ${agents.length} Agents`,
                mode: 'collective',
                agentIds: allAgentIds,
                expectedCompletionMinutes: 60,
                startInMinutes: 0, // Start immediately
            });
            setData(response);
            alert(t('train_all_success') || `Training session created for all ${agents.length} agents!`);
        } catch (e: any) {
            console.error('Failed to train all agents:', e);
            const errorMessage = e?.message || e?.toString() || 'Unknown error';
            alert(`${t('train_all_failed') || 'Failed to train all agents'}: ${errorMessage}`);
        } finally {
            setIsScheduling(false);
        }
    };

    // Handle Train Now - Create immediate session for selected/recommended agents
    const handleTrainNow = async (agentIds: string[], mode: AITrainingMode = 'individual') => {
        if (!agentIds || agentIds.length === 0) {
            alert(t('select_agents_first') || 'Please select agents first');
            return;
        }

        setIsScheduling(true);
        try {
            const agentNames = agentIds.map(id => {
                const agent = agents.find(a => a.id === id);
                return agent?.name || agent?.role || `Agent ${id}`;
            }).join(', ');

            const response = await api.scheduleAITrainingSession({
                title: `Quick Training - ${agentNames}`,
                mode: mode,
                agentIds: agentIds,
                expectedCompletionMinutes: mode === 'individual' ? 25 : mode === 'collective' ? 45 : 35,
                startInMinutes: 0, // Start immediately
            });
            setData(response);
            alert(t('train_now_success') || `Training session started for ${agentIds.length} agent(s)!`);
        } catch (e: any) {
            console.error('Failed to start training:', e);
            const errorMessage = e?.message || e?.toString() || 'Unknown error';
            alert(`${t('train_now_failed') || 'Failed to start training'}: ${errorMessage}`);
        } finally {
            setIsScheduling(false);
        }
    };

    const handleScheduleSession = async () => {
        if (!data || isScheduling) {
            return;
        }

        try {
            setIsScheduling(true);
            const baseId = data.sessions + data.queue.length + data.runningSessions.length + 1;
            const response = await api.scheduleAITrainingSession({
                title: `Adaptive Reinforcement #${baseId}`,
                mode: 'collective',
                agentIds: data.runningSessions[0]?.agentIds.slice(0, 2) ?? ['1', '2'],
                expectedCompletionMinutes: 45,
                startInMinutes: 15,
            });
            setData(response);
        } catch (e) {
            console.error('Failed to schedule session:', e);
            alert(t('session_schedule_failed') || 'Failed to schedule session');
        } finally {
            setIsScheduling(false);
        }
    };

    const handleCompleteSession = async (sessionId: string) => {
        if (!data || completingId) {
            return;
        }

        try {
            setCompletingId(sessionId);
            const response = await api.completeAITrainingSession(sessionId, 1.6);
            setData(response);
        } catch (e) {
            console.error('Failed to complete session:', e);
            alert(t('session_complete_failed') || 'Failed to complete session');
        } finally {
            setCompletingId(null);
        }
    };

    // Get training recommendations from Artemis
    const trainingRecommendations = useMemo(() => {
        if (!artemis || !agents.length) return [];
        
        const recommendations: Array<{
            agentId: string;
            agentName: string;
            priority: 'high' | 'medium' | 'low';
            reason: string;
            suggestedMode: AITrainingMode;
            expectedGain: number;
        }> = [];

        agents.forEach(agent => {
            const accuracy = agent.accuracy || 0;
            const avgAccuracy = agents.reduce((sum, a) => sum + (a.accuracy || 0), 0) / agents.length;
            
            if (accuracy < avgAccuracy - 5) {
                recommendations.push({
                    agentId: agent.id,
                    agentName: agent.name || agent.role || `Agent ${agent.id}`,
                    priority: accuracy < avgAccuracy - 10 ? 'high' : 'medium',
                    reason: `Accuracy ${accuracy.toFixed(1)}% is below average ${avgAccuracy.toFixed(1)}%`,
                    suggestedMode: 'individual',
                    expectedGain: Math.min(5, (avgAccuracy - accuracy) * 0.5),
                });
            }
        });

        return recommendations.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }, [artemis, agents]);

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

    if (!data) {
        return <div className="text-center p-10 text-red-400">{t('failed_to_load_data') || 'Failed to load training data'}</div>;
    }

    const allSessions = [...data.runningSessions, ...data.queue, ...data.recentHistory];
    const filteredSessions = allSessions.filter(session => {
        const matchesSearch = !searchQuery || session.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesMode = filterMode === 'all' || session.mode === filterMode;
        const matchesStatus = filterStatus === 'all' || session.status === filterStatus;
        return matchesSearch && matchesMode && matchesStatus;
    });

    const tabs: { id: TrainingTab; label: string; icon: string }[] = [
        { id: 'overview', label: t('overview') || 'Overview', icon: '📊' },
        { id: 'agents', label: t('agents') || 'Agents', icon: '🤖' },
        { id: 'sessions', label: t('sessions') || 'Sessions', icon: '🎯' },
        { id: 'recommendations', label: t('recommendations') || 'Recommendations', icon: '💡' },
        { id: 'history', label: t('history') || 'History', icon: '📜' },
        { id: 'settings', label: t('settings') || 'Settings', icon: '⚙️' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">{t('training_center') || 'Training Center'}</h2>
                        <p className="text-muted-foreground mt-1">{t('training_center_desc') || 'AI Agent Training & Learning Management System'}</p>
                </div>
                    <div className="flex gap-2">
                    <button
                        onClick={handleArtemisAutoConfig}
                        disabled={isAutoConfiguring}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center gap-2 text-sm"
                            title={t('artemis_auto_config_desc') || 'Let Artemis analyze and configure optimal training settings'}
                    >
                        {isAutoConfiguring ? (
                            <>
                                <span className="animate-spin">⚙️</span>
                                    {t('artemis_configuring') || 'Configuring...'}
                            </>
                        ) : (
                            <>
                                <span>🤖</span>
                                {t('artemis_auto_configure') || 'Artemis Auto Configure'}
                            </>
                        )}
                    </button>
                    <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                            title={t('create_session_desc') || 'Open modal to create a custom training session'}
                    >
                            {t('create_session') || 'Create Session'}
                    </button>
                        <button
                            onClick={handleTrainAll}
                            disabled={isScheduling || !agents || agents.length === 0}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                            title={t('train_all_desc') || 'Create training session for all agents immediately'}
                        >
                            {isScheduling ? t('scheduling') || 'Scheduling...' : t('train_all') || 'Train All'}
                        </button>
                </div>
            </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <StatCard label={t('active_training_agents') || 'Active Training'} value={data.activeTrainingAgents} />
                    <StatCard label={t('total_sessions') || 'Total Sessions'} value={data.sessions} />
                    <StatCard label={t('average_accuracy') || 'Avg Accuracy'} value={`${data.avgAccuracy.toFixed(1)}%`} />
                    <StatCard label={t('artemis_status') || 'Artemis Status'} value={artemis?.status === 'active' ? '🟢 Active' : '⚪ Standby'} />
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-card border border-border rounded-lg">
                <nav className="flex border-b border-border overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 px-6 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'border-purple-500 text-purple-400'
                                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                            }`}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </nav>

                {/* Tab Content */}
                <div className="p-6" style={{ maxHeight: 'calc(92vh - 300px)', overflowY: 'auto' }}>
                    {activeTab === 'overview' && (
                        <OverviewTab
                            data={data}
                            artemis={artemis}
                            agents={agents}
                            trainingRecommendations={trainingRecommendations}
                            onScheduleSession={handleScheduleSession}
                            isScheduling={isScheduling}
                            t={t}
                        />
                    )}
                    {activeTab === 'agents' && (
                        <AgentsTab
                            agents={agents}
                            data={data}
                            onAgentSelect={setSelectedAgentId}
                            selectedAgentId={selectedAgentId}
                            onCreateSession={(agentIds) => {
                                // Open modal with pre-selected agents
                                setShowCreateModal(true);
                            }}
                            onTrainNow={handleTrainNow}
                            t={t}
                        />
                    )}
                    {activeTab === 'sessions' && (
                        <SessionsTab
                            runningSessions={data.runningSessions}
                            queuedSessions={data.queue}
                            onComplete={handleCompleteSession}
                            completingId={completingId}
                            t={t}
                        />
                    )}
                    {activeTab === 'recommendations' && (
                        <RecommendationsTab
                            recommendations={trainingRecommendations}
                            agents={agents}
                            onCreateSession={(agentIds, mode) => {
                                setShowCreateModal(true);
                            }}
                            onTrainNow={handleTrainNow}
                            t={t}
                        />
                    )}
                    {activeTab === 'history' && (
                        <HistoryTab
                            sessions={filteredSessions}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            filterMode={filterMode}
                            setFilterMode={setFilterMode}
                            filterStatus={filterStatus}
                            setFilterStatus={setFilterStatus}
                            t={t}
                        />
                    )}
                    {activeTab === 'settings' && trainingConfig && (
                        <TrainingSettingsPanel
                            config={trainingConfig}
                            onUpdate={async (updatedConfig) => {
                                try {
                                    const saved = await api.updateTrainingConfig(updatedConfig);
                                    setTrainingConfig(saved);
                                    if (data) {
                                        setData({ ...data, config: saved });
                                    }
                                    alert(t('settings_saved') || 'Settings saved successfully!');
                                } catch (e) {
                                    console.error('Failed to save settings:', e);
                                    alert(t('settings_save_failed') || 'Failed to save settings');
                                }
                            }}
                            t={t}
                        />
                    )}
                </div>
            </div>
            
            {showCreateModal && (
                <CreateSessionModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={async (sessionData) => {
                        try {
                            const response = await api.scheduleAITrainingSession(sessionData);
                            setData(response);
                            setShowCreateModal(false);
                            alert(t('session_created') || 'Training session created successfully!');
                        } catch (e) {
                            console.error('Failed to create session:', e);
                            alert(t('session_creation_failed') || 'Failed to create session');
                        }
                    }}
                    agents={agents}
                    t={t}
                />
            )}
        </div>
    );
};

// Overview Tab
const OverviewTab: React.FC<{
    data: AITrainingStats;
    artemis: ArtemisState | null;
    agents: AIAgent[];
    trainingRecommendations: any[];
    onScheduleSession: () => void;
    isScheduling: boolean;
    t: (key: string) => string;
}> = ({ data, artemis, agents, trainingRecommendations, onScheduleSession, isScheduling, t }) => {
    const lowPerformingAgents = agents.filter(a => (a.accuracy || 0) < 80);
    const highPerformingAgents = agents.filter(a => (a.accuracy || 0) >= 90);
    
    return (
        <div className="space-y-6">
            {/* Training Types */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <TrainingTypeCard
                    title={t('individual_training') || 'Individual Training'}
                    description={t('individual_training_desc') || 'Train a single agent to improve specific skills'}
                    duration="15-30 min"
                    agents="1"
                    icon="🎯"
                />
                 <TrainingTypeCard 
                    title={t('collective_training') || 'Collective Training'} 
                    description={t('collective_training_desc') || 'Train multiple agents together for coordinated learning'}
                    duration="45-60 min"
                    agents="3-8"
                    icon="👥"
                />
                 <TrainingTypeCard 
                    title={t('cross_training') || 'Cross Training'} 
                    description={t('cross_training_desc') || 'Train agents in pairs to learn from each other'}
                    duration="30-45 min"
                    agents="2-5"
                    icon="🔄"
                />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title={t('agent_performance') || 'Agent Performance'}>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t('total_agents') || 'Total Agents'}</span>
                            <span className="font-semibold text-foreground">{agents.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t('high_performers') || 'High Performers (≥90%)'}</span>
                            <span className="font-semibold text-green-400">{highPerformingAgents.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t('low_performers') || 'Low Performers (<80%)'}</span>
                            <span className="font-semibold text-red-400">{lowPerformingAgents.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t('avg_accuracy') || 'Average Accuracy'}</span>
                            <span className="font-semibold text-foreground">
                                {agents.length > 0 
                                    ? `${(agents.reduce((sum, a) => sum + (a.accuracy || 0), 0) / agents.length).toFixed(1)}%`
                                    : '0%'
                                }
                            </span>
                        </div>
                    </div>
                </Card>

                <Card title={t('artemis_insights') || 'Artemis Insights'}>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t('artemis_status') || 'Status'}</span>
                            <span className={`font-semibold ${artemis?.status === 'active' ? 'text-green-400' : 'text-gray-400'}`}>
                                {artemis?.status === 'active' ? '🟢 Active' : '⚪ Standby'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t('total_decisions') || 'Total Decisions'}</span>
                            <span className="font-semibold text-foreground">{artemis?.totalDecisions || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t('success_rate') || 'Success Rate'}</span>
                            <span className="font-semibold text-foreground">{artemis?.successRate?.toFixed(1) || 0}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t('recommendations') || 'Training Recommendations'}</span>
                            <span className="font-semibold text-purple-400">{trainingRecommendations.length}</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Running Sessions & Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title={t('running_sessions') || 'Running Sessions'}>
                    {data.runningSessions.length === 0 ? (
                        <EmptyState message={t('no_running_sessions') || 'No running sessions'} />
                    ) : (
                        <div className="space-y-4">
                            {data.runningSessions.map(session => (
                                <SessionCard
                                    key={session.id}
                                    session={session}
                                    showProgress={true}
                                    compact={true}
                                    t={t}
                                />
                            ))}
                        </div>
                    )}
                </Card>
                <Card title={t('queued_sessions') || 'Queued Sessions'}>
                    {data.queue.length === 0 ? (
                        <EmptyState message={t('no_queued_sessions') || 'No queued sessions'} />
                    ) : (
                        <div className="space-y-4">
                            {data.queue.map(session => (
                                <SessionCard key={session.id} session={session} compact={true} t={t} />
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* Top Recommendations */}
            {trainingRecommendations.length > 0 && (
                <Card title={t('top_recommendations') || 'Top Training Recommendations'}>
                    <div className="space-y-3">
                        {trainingRecommendations.slice(0, 5).map((rec, idx) => (
                            <div key={rec.agentId} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">{idx + 1}.</span>
                                    <div>
                                        <p className="font-semibold text-foreground">{rec.agentName}</p>
                                        <p className="text-xs text-muted-foreground">{rec.reason}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        rec.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                        rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        {rec.priority}
                                    </span>
                                    <span className="text-sm text-green-400">+{rec.expectedGain.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

// Agents Tab - Show all 15 agents with training status
const AgentsTab: React.FC<{
    agents: AIAgent[];
    data: AITrainingStats;
    onAgentSelect: (agentId: string | null) => void;
    selectedAgentId: string | null;
    onCreateSession: (agentIds: string[]) => void;
    onTrainNow: (agentIds: string[], mode: AITrainingMode) => void;
    t: (key: string) => string;
}> = ({ agents, data, onAgentSelect, selectedAgentId, onCreateSession, onTrainNow, t }) => {
    const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
    const agentRoles = [
        'Technical Analysis', 'Risk Management', 'Sentiment Analysis', 'Pattern Recognition', 'Price Prediction',
        'Arbitrage', 'Portfolio Allocation', 'Liquidity Analysis', 'Trend Detection', 'Optimization',
        'Order Management', 'Fundamental Analysis', 'Market Intelligence', 'Volume Analysis', 'Timing'
    ];

    const getAgentTrainingStatus = (agentId: string) => {
        const inRunning = data.runningSessions.some(s => s.agentIds.includes(agentId));
        const inQueue = data.queue.some(s => s.agentIds.includes(agentId));
        if (inRunning) return { status: 'running', session: data.runningSessions.find(s => s.agentIds.includes(agentId)) };
        if (inQueue) return { status: 'queued', session: data.queue.find(s => s.agentIds.includes(agentId)) };
        return { status: 'idle', session: null };
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-foreground">{t('all_agents') || 'All Agents (15)'}</h3>
                <div className="flex gap-2">
                    {selectedAgents.length > 0 && (
                        <>
                            <button
                                onClick={() => onTrainNow(selectedAgents, selectedAgents.length === 1 ? 'individual' : 'collective')}
                                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                                title={t('train_now_desc') || 'Start training immediately for selected agents'}
                            >
                                {t('train_now') || 'Train Now'} ({selectedAgents.length})
                            </button>
                            <button
                                onClick={() => onCreateSession(selectedAgents)}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                                title={t('create_session_desc') || 'Open modal to configure training session'}
                            >
                                {t('create_session') || 'Create Session'} ({selectedAgents.length})
                            </button>
                            <button
                                onClick={() => setSelectedAgents([])}
                                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                            >
                                {t('clear_selection') || 'Clear'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent, idx) => {
                    const trainingStatus = getAgentTrainingStatus(agent.id);
                    const accuracy = agent.accuracy || 0;
                    const isSelected = selectedAgentId === agent.id;
                    
                    return (
                        <div
                            key={agent.id}
                            onClick={() => {
                                onAgentSelect(isSelected ? null : agent.id);
                                // Toggle selection for multi-select
                                setSelectedAgents(prev => 
                                    prev.includes(agent.id)
                                        ? prev.filter(id => id !== agent.id)
                                        : [...prev, agent.id]
                                );
                            }}
                            className={`border rounded-lg p-4 cursor-pointer transition-all ${
                                selectedAgents.includes(agent.id)
                                    ? 'border-purple-500 bg-purple-500/10' 
                                    : 'border-border bg-card hover:border-purple-500/50'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className="font-semibold text-foreground">Agent {agent.id}</h4>
                                    <p className="text-xs text-muted-foreground">{agentRoles[idx] || agent.role}</p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                    trainingStatus.status === 'running' ? 'bg-green-500/20 text-green-400' :
                                    trainingStatus.status === 'queued' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-gray-500/20 text-gray-400'
                                }`}>
                                    {trainingStatus.status}
                                </span>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">{t('accuracy') || 'Accuracy'}</span>
                                    <span className={`font-semibold ${
                                        accuracy >= 90 ? 'text-green-400' :
                                        accuracy >= 80 ? 'text-yellow-400' :
                                        'text-red-400'
                                    }`}>
                                        {accuracy.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="w-full bg-secondary rounded-full h-2">
                                    <div 
                                        className={`h-2 rounded-full transition-all ${
                                            accuracy >= 90 ? 'bg-green-500' :
                                            accuracy >= 80 ? 'bg-yellow-500' :
                                            'bg-red-500'
                                        }`}
                                        style={{ width: `${Math.min(100, accuracy)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <span>{t('decisions') || 'Decisions'}: {agent.decisions || 0}</span>
                                    <span>{t('level') || 'Level'}: {agent.level || 'Expert'}</span>
                                </div>
                            </div>

                            {trainingStatus.session && (
                                <div className="mt-3 pt-3 border-t border-border">
                                    <p className="text-xs text-muted-foreground">{t('training_in') || 'Training in'}:</p>
                                    <p className="text-xs font-semibold text-foreground">{trainingStatus.session.title}</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Sessions Tab
const SessionsTab: React.FC<{
    runningSessions: AITrainingSession[];
    queuedSessions: AITrainingSession[];
    onComplete: (sessionId: string) => void;
    completingId: string | null;
    t: (key: string) => string;
}> = ({ runningSessions, queuedSessions, onComplete, completingId, t }) => {
    return (
        <div className="space-y-6">
            <Card title={t('running_sessions') || 'Running Sessions'}>
                {runningSessions.length === 0 ? (
                    <EmptyState message={t('no_running_sessions') || 'No running sessions'} />
                ) : (
                    <div className="space-y-4">
                        {runningSessions.map(session => (
                            <SessionCard
                                key={session.id}
                                session={session}
                                actionLabel={t('complete_session') || 'Complete'}
                                isActionLoading={completingId === session.id}
                                onAction={() => onComplete(session.id)}
                                showProgress={true}
                                t={t}
                            />
                        ))}
                    </div>
                )}
            </Card>

            <Card title={t('queued_sessions') || 'Queued Sessions'}>
                {queuedSessions.length === 0 ? (
                    <EmptyState message={t('no_queued_sessions') || 'No queued sessions'} />
                ) : (
                    <div className="space-y-4">
                        {queuedSessions.map(session => (
                            <SessionCard key={session.id} session={session} t={t} />
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

// Recommendations Tab
const RecommendationsTab: React.FC<{
    recommendations: any[];
    agents: AIAgent[];
    onCreateSession: (agentIds: string[], mode: AITrainingMode) => void;
    onTrainNow: (agentIds: string[], mode: AITrainingMode) => void;
    t: (key: string) => string;
}> = ({ recommendations, agents, onCreateSession, onTrainNow, t }) => {
    if (recommendations.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-muted-foreground">{t('no_recommendations') || 'No training recommendations at this time. All agents are performing well!'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                    {t('artemis_recommendations_desc') || 'Artemis has analyzed all agents and recommends training for the following agents to improve overall system performance.'}
                </p>
            </div>

            {recommendations.map((rec, idx) => {
                const agent = agents.find(a => a.id === rec.agentId);
                return (
                    <div key={rec.agentId} className="border border-border rounded-lg p-4 bg-card">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold text-purple-400">#{idx + 1}</span>
                                    <h4 className="font-semibold text-foreground">{rec.agentName}</h4>
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        rec.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                        rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        {rec.priority} priority
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{rec.reason}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onTrainNow([rec.agentId], rec.suggestedMode)}
                                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                                    title={t('train_now_desc') || 'Start training immediately'}
                                >
                                    {t('train_now') || 'Train Now'}
                                </button>
                                <button
                                    onClick={() => onCreateSession([rec.agentId], rec.suggestedMode)}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                                    title={t('create_session_desc') || 'Open modal to configure session'}
                                >
                                    {t('configure') || 'Configure'}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                            <div>
                                <p className="text-xs text-muted-foreground">{t('current_accuracy') || 'Current Accuracy'}</p>
                                <p className="font-semibold text-foreground">{agent?.accuracy?.toFixed(1) || 0}%</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{t('suggested_mode') || 'Suggested Mode'}</p>
                                <p className="font-semibold text-foreground capitalize">{rec.suggestedMode}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{t('expected_gain') || 'Expected Gain'}</p>
                                <p className="font-semibold text-green-400">+{rec.expectedGain.toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// History Tab
const HistoryTab: React.FC<{
    sessions: AITrainingSession[];
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filterMode: 'all' | AITrainingMode;
    setFilterMode: (mode: 'all' | AITrainingMode) => void;
    filterStatus: 'all' | AITrainingStatus;
    setFilterStatus: (status: 'all' | AITrainingStatus) => void;
    t: (key: string) => string;
}> = ({ sessions, searchQuery, setSearchQuery, filterMode, setFilterMode, filterStatus, setFilterStatus, t }) => {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
                    <input
                        type="text"
                        placeholder={t('search_sessions') || 'Search sessions...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 min-w-[200px] p-2 bg-secondary border border-border rounded text-foreground text-sm"
                    />
                    <select
                        value={filterMode}
                        onChange={(e) => setFilterMode(e.target.value as any)}
                        className="p-2 bg-secondary border border-border rounded text-foreground text-sm"
                    >
                        <option value="all">{t('all_modes') || 'All Modes'}</option>
                    <option value="individual">{t('individual_training') || 'Individual'}</option>
                    <option value="collective">{t('collective_training') || 'Collective'}</option>
                    <option value="cross-functional">{t('cross_training') || 'Cross Training'}</option>
                    </select>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="p-2 bg-secondary border border-border rounded text-foreground text-sm"
                    >
                        <option value="all">{t('all_statuses') || 'All Statuses'}</option>
                        <option value="scheduled">{t('scheduled') || 'Scheduled'}</option>
                        <option value="running">{t('running') || 'Running'}</option>
                        <option value="completed">{t('completed') || 'Completed'}</option>
                    </select>
                </div>

            {sessions.length === 0 ? (
                    <EmptyState message={t('no_sessions_found') || 'No sessions found'} />
                ) : (
                    <div className="space-y-4">
                    {sessions.map(session => (
                        <SessionCard key={session.id} session={session} t={t} />
                        ))}
                    </div>
                )}
        </div>
    );
};

// Helper Components
const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-card border border-border rounded-lg p-4 h-full">
        <h3 className="font-semibold text-foreground mb-4">{title}</h3>
        {children}
    </div>
);

const StatCard: React.FC<{label: string, value: string | number}> = ({label, value}) => (
    <div className="bg-secondary p-4 rounded-lg">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
);

const TrainingTypeCard: React.FC<{title: string, description: string, duration: string, agents: string, icon: string}> = ({title, description, duration, agents, icon}) => (
    <div className="bg-card border border-border rounded-lg p-4 text-center hover:border-purple-500/50 transition-all cursor-pointer">
        <div className="text-3xl mb-2">{icon}</div>
        <h3 className="font-bold text-lg text-purple-400">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1 h-12">{description}</p>
        <div className="mt-3 text-xs flex justify-around text-muted-foreground">
            <span>Duration: {duration}</span>
            <span>Agents: {agents}</span>
        </div>
    </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <p className="text-sm text-muted-foreground text-center py-6">{message}</p>
);

const SessionCard: React.FC<{
    session: AITrainingSession;
    actionLabel?: string;
    onAction?: () => void;
    isActionLoading?: boolean;
    showProgress?: boolean;
    compact?: boolean;
    t: (key: string) => string;
}> = ({ session, actionLabel, onAction, isActionLoading, showProgress = false, compact = false, t }) => {
    const startTime = new Date(session.startedAt);
    const completionTime = session.completedAt ? new Date(session.completedAt) : undefined;
    const now = new Date();
    const elapsed = now.getTime() - startTime.getTime();
    const totalExpected = session.expectedCompletionMinutes * 60 * 1000;
    const progress = showProgress && session.status === 'running' ? Math.min((elapsed / totalExpected) * 100, 95) : 0;

    const modeKey = `training_mode_${session.mode.replace('-', '_')}`;
    return (
        <div className={`border border-border rounded-lg p-4 bg-background/40 hover:bg-background/60 transition-colors ${compact ? 'p-3' : ''}`}>
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                    <h4 className={`font-semibold text-foreground ${compact ? 'text-sm' : ''}`}>{session.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                            session.status === 'running' ? 'bg-green-500/20 text-green-400' :
                            session.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-yellow-500/20 text-yellow-400'
                        }`}>
                            {t(session.status) || session.status}
                        </span>
                        <span className="text-xs bg-purple-500/10 text-purple-300 px-2 py-1 rounded-full uppercase font-semibold">
                            {t(modeKey) || session.mode}
                        </span>
                    </div>
                </div>
            </div>
            
            {showProgress && progress > 0 && (
                <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{t('progress') || 'Progress'}</span>
                        <span>{progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                            className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
                            style={{width: `${progress}%`}}
                        ></div>
                    </div>
                </div>
            )}
            
            <div className={`mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground ${compact ? 'grid-cols-3' : ''}`}>
                <div>
                    <p className="font-semibold text-foreground">{t('start_time') || 'Start Time'}</p>
                    <p>{startTime.toLocaleString()}</p>
                </div>
                <div>
                    <p className="font-semibold text-foreground">{t('expected_completion') || 'Expected'}</p>
                    <p>{session.expectedCompletionMinutes} {t('minutes') || 'min'}</p>
                </div>
                <div>
                    <p className="font-semibold text-foreground">{t('agents') || 'Agents'}</p>
                    <p>{session.agentIds.length} {t('agent') || 'agent(s)'}</p>
                </div>
                {completionTime && (
                    <div>
                        <p className="font-semibold text-foreground">{t('completed_at') || 'Completed'}</p>
                        <p>{completionTime.toLocaleString()}</p>
                    </div>
                )}
                {session.accuracyGain !== undefined && (
                    <div className={compact ? 'col-span-1' : 'col-span-2'}>
                        <p className="font-semibold text-foreground">{t('accuracy_gain') || 'Accuracy Gain'}</p>
                        <p className="text-green-400">+{session.accuracyGain.toFixed(1)}%</p>
                    </div>
                )}
            </div>
            {actionLabel && onAction && (
                <div className="mt-4 flex justify-end gap-2">
                    <button
                        onClick={onAction}
                        disabled={isActionLoading}
                        className="text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-1.5 px-4 rounded-md transition-colors"
                    >
                        {isActionLoading ? t('processing') || 'Processing...' : actionLabel}
                    </button>
                </div>
            )}
        </div>
    );
};

// Training Settings Panel (keeping existing implementation)
const TrainingSettingsPanel: React.FC<{
    config: AITrainingConfig;
    onUpdate: (config: AITrainingConfig) => Promise<void>;
    t: (key: string) => string;
}> = ({ config, onUpdate, t }) => {
    const [localConfig, setLocalConfig] = useState<AITrainingConfig>(config);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdate(localConfig);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-foreground">{t('training_settings') || 'Training Settings'}</h3>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                >
                    {isSaving ? t('saving') || 'Saving...' : t('save_settings') || 'Save Settings'}
                </button>
            </div>

            {/* Auto Training */}
            <div className="border border-border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3">{t('auto_training') || 'Auto Training'}</h4>
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="auto-training-enabled"
                            checked={localConfig.autoTraining.enabled}
                            onChange={(e) => setLocalConfig({
                                ...localConfig,
                                autoTraining: { ...localConfig.autoTraining, enabled: e.target.checked }
                            })}
                            className="w-4 h-4"
                        />
                        <label htmlFor="auto-training-enabled" className="text-sm text-foreground">{t('enable_auto_training') || 'Enable Auto Training'}</label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="min-accuracy-threshold" className="block text-sm text-muted-foreground mb-1">{t('min_accuracy_threshold') || 'Min Accuracy Threshold'} (%)</label>
                            <input
                                type="number"
                                id="min-accuracy-threshold"
                                value={localConfig.autoTraining.minAccuracyThreshold}
                                onChange={(e) => setLocalConfig({
                                    ...localConfig,
                                    autoTraining: { ...localConfig.autoTraining, minAccuracyThreshold: parseFloat(e.target.value) || 75 }
                                })}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                min="0"
                                max="100"
                            />
                        </div>
                        <div>
                            <label htmlFor="schedule-interval" className="block text-sm text-muted-foreground mb-1">{t('schedule_interval') || 'Schedule Interval'} (hours)</label>
                            <input
                                type="number"
                                id="schedule-interval"
                                value={localConfig.autoTraining.scheduleInterval}
                                onChange={(e) => setLocalConfig({
                                    ...localConfig,
                                    autoTraining: { ...localConfig.autoTraining, scheduleInterval: parseInt(e.target.value) || 24 }
                                })}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                min="1"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Resource Management */}
            <div className="border border-border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3">{t('resource_management') || 'Resource Management'}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="max-concurrent-sessions" className="block text-sm text-muted-foreground mb-1">{t('max_concurrent_sessions') || 'Max Concurrent Sessions'}</label>
                        <input
                            type="number"
                            id="max-concurrent-sessions"
                            value={localConfig.resourceManagement.maxConcurrentSessions}
                            onChange={(e) => setLocalConfig({
                                ...localConfig,
                                resourceManagement: { ...localConfig.resourceManagement, maxConcurrentSessions: parseInt(e.target.value) || 3 }
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            min="1"
                            max="10"
                        />
                    </div>
                    <div>
                        <label htmlFor="max-queue-size" className="block text-sm text-muted-foreground mb-1">{t('max_queue_size') || 'Max Queue Size'}</label>
                        <input
                            type="number"
                            id="max-queue-size"
                            value={localConfig.resourceManagement.maxQueueSize}
                            onChange={(e) => setLocalConfig({
                                ...localConfig,
                                resourceManagement: { ...localConfig.resourceManagement, maxQueueSize: parseInt(e.target.value) || 10 }
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            min="1"
                            max="50"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="priority-queue"
                            checked={localConfig.resourceManagement.priorityQueue}
                            onChange={(e) => setLocalConfig({
                                ...localConfig,
                                resourceManagement: { ...localConfig.resourceManagement, priorityQueue: e.target.checked }
                            })}
                            className="w-4 h-4"
                        />
                        <label htmlFor="priority-queue" className="text-sm text-foreground">{t('priority_queue') || 'Priority Queue'}</label>
                    </div>
                </div>
            </div>

            {/* Quality Control */}
            <div className="border border-border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3">{t('quality_control') || 'Quality Control'}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="min-accuracy-gain" className="block text-sm text-muted-foreground mb-1">{t('min_accuracy_gain') || 'Min Accuracy Gain'} (%)</label>
                        <input
                            type="number"
                            id="min-accuracy-gain"
                            value={localConfig.qualityControl.minAccuracyGain}
                            onChange={(e) => setLocalConfig({
                                ...localConfig,
                                qualityControl: { ...localConfig.qualityControl, minAccuracyGain: parseFloat(e.target.value) || 1.0 }
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            min="0"
                            step="0.1"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="require-backtest"
                            checked={localConfig.qualityControl.requireBacktest}
                            onChange={(e) => setLocalConfig({
                                ...localConfig,
                                qualityControl: { ...localConfig.qualityControl, requireBacktest: e.target.checked }
                            })}
                            className="w-4 h-4"
                        />
                        <label htmlFor="require-backtest" className="text-sm text-foreground">{t('require_backtest') || 'Require Backtest'}</label>
                    </div>
                </div>
            </div>

            {/* Artemis Control */}
            <div className="border border-border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3">{t('artemis_control') || 'Artemis Control'}</h4>
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="allow-artemis-auto-config"
                            checked={localConfig.artemisControl.allowArtemisAutoConfig}
                            onChange={(e) => setLocalConfig({
                                ...localConfig,
                                artemisControl: { ...localConfig.artemisControl, allowArtemisAutoConfig: e.target.checked }
                            })}
                            className="w-4 h-4"
                        />
                        <label htmlFor="allow-artemis-auto-config" className="text-sm text-foreground">{t('allow_artemis_auto_config') || 'Allow Artemis Auto Configuration'}</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="require-artemis-approval"
                            checked={localConfig.artemisControl.requireArtemisApproval}
                            onChange={(e) => setLocalConfig({
                                ...localConfig,
                                artemisControl: { ...localConfig.artemisControl, requireArtemisApproval: e.target.checked }
                            })}
                            className="w-4 h-4"
                        />
                        <label htmlFor="require-artemis-approval" className="text-sm text-foreground">{t('require_artemis_approval') || 'Require Artemis Approval'}</label>
                    </div>
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('optimization_level') || 'Optimization Level'}</label>
                        <select
                            value={localConfig.artemisControl.artemisOptimizationLevel}
                            onChange={(e) => setLocalConfig({
                                ...localConfig,
                                artemisControl: { ...localConfig.artemisControl, artemisOptimizationLevel: e.target.value as any }
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        >
                            <option value="conservative">{t('conservative') || 'Conservative'}</option>
                            <option value="balanced">{t('balanced') || 'Balanced'}</option>
                            <option value="aggressive">{t('aggressive') || 'Aggressive'}</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Create Session Modal
const CreateSessionModal: React.FC<{
    onClose: () => void;
    onCreate: (data: {
        title: string;
        mode: AITrainingMode;
        agentIds: string[];
        expectedCompletionMinutes: number;
        startInMinutes?: number;
    }) => Promise<void>;
    agents: AIAgent[];
    t: (key: string) => string;
}> = ({ onClose, onCreate, agents, t }) => {
    const [title, setTitle] = useState('');
    const [mode, setMode] = useState<AITrainingMode>('individual');
    const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
    const [expectedMinutes, setExpectedMinutes] = useState(30);
    const [startInMinutes, setStartInMinutes] = useState(5);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!title || selectedAgents.length === 0) {
            alert(t('fill_required_fields') || 'Please fill all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            await onCreate({
                title,
                mode,
                agentIds: selectedAgents,
                expectedCompletionMinutes: expectedMinutes,
                startInMinutes,
            });
        } catch (e) {
            console.error('Failed to create session:', e);
            alert(t('session_creation_failed') || 'Failed to create session');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleAgent = (agentId: string) => {
        setSelectedAgents(prev => 
            prev.includes(agentId) 
                ? prev.filter(id => id !== agentId)
                : [...prev, agentId]
        );
    };

    const agentRoles = [
        'Technical Analysis', 'Risk Management', 'Sentiment Analysis', 'Pattern Recognition', 'Price Prediction',
        'Arbitrage', 'Portfolio Allocation', 'Liquidity Analysis', 'Trend Detection', 'Optimization',
        'Order Management', 'Fundamental Analysis', 'Market Intelligence', 'Volume Analysis', 'Timing'
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-foreground">{t('create_training_session') || 'Create Training Session'}</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">✕</button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-1">{t('session_title') || 'Session Title'}</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            placeholder={t('enter_session_title') || 'Enter session title...'}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-1">{t('training_mode') || 'Training Mode'}</label>
                        <select
                            value={mode}
                            onChange={(e) => setMode(e.target.value as AITrainingMode)}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        >
                            <option value="individual">{t('individual_training') || 'Individual'}</option>
                            <option value="collective">{t('collective_training') || 'Collective'}</option>
                            <option value="cross-functional">{t('cross_training') || 'Cross Training'}</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-1">{t('select_agents') || 'Select Agents'} ({selectedAgents.length} selected)</label>
                        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 bg-secondary rounded border border-border">
                            {agents.map((agent, idx) => (
                                    <label key={agent.id} htmlFor={`agent-${agent.id}`} className="flex items-center gap-2 p-2 hover:bg-background/50 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            id={`agent-${agent.id}`}
                                            checked={selectedAgents.includes(agent.id)}
                                            onChange={() => toggleAgent(agent.id)}
                                            className="w-4 h-4"
                                        />
                                    <div className="flex-1">
                                        <span className="text-sm text-foreground font-semibold">Agent {agent.id}</span>
                                        <p className="text-xs text-muted-foreground">{agentRoles[idx] || agent.role}</p>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{(agent.accuracy || 0).toFixed(1)}%</span>
                                    </label>
                                ))}
                            </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="expected-duration" className="block text-sm font-semibold text-foreground mb-1">{t('expected_duration') || 'Expected Duration'} (minutes)</label>
                            <input
                                type="number"
                                id="expected-duration"
                                value={expectedMinutes}
                                onChange={(e) => setExpectedMinutes(parseInt(e.target.value) || 30)}
                                min="5"
                                max="180"
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-foreground mb-1">{t('start_in') || 'Start In'} (minutes)</label>
                            <input
                                type="number"
                                value={startInMinutes}
                                onChange={(e) => setStartInMinutes(parseInt(e.target.value) || 5)}
                                min="0"
                                max="1440"
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                            />
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm font-semibold transition-colors"
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !title || selectedAgents.length === 0}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                        {isSubmitting ? t('creating') || 'Creating...' : t('create') || 'Create'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TrainingCenter;
