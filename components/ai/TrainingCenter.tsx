import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AITrainingSession, AITrainingStats, AITrainingMode, AITrainingStatus, AITrainingConfig } from '../../types.ts';

const TrainingCenter: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AITrainingStats | null>(null);
    const [isScheduling, setIsScheduling] = useState(false);
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filterMode, setFilterMode] = useState<'all' | AITrainingMode>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | AITrainingStatus>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
    const [trainingConfig, setTrainingConfig] = useState<AITrainingConfig | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const trainingData = await api.fetchTrainingData();
                setData(trainingData);
                setTrainingConfig(trainingData.config || null);
            } catch (e) {
                console.error('Failed to load training data:', e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
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
        } catch (e) {
            console.error('Failed to auto-configure with Artemis:', e);
            alert(t('artemis_config_failed') || 'Failed to auto-configure with Artemis');
        } finally {
            setIsAutoConfiguring(false);
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

    return (
        <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6 text-center">
                <h2 className="text-xl font-bold text-foreground">{t('training_center')}</h2>
                <p className="text-muted-foreground mt-1">{t('training_center_desc')}</p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                     <StatCard label={t('active_training_agents')} value={data.activeTrainingAgents} />
                     <StatCard label={t('total_sessions')} value={data.sessions} />
                     <StatCard label={t('average_accuracy')} value={`${data.avgAccuracy.toFixed(1)}%`} />
                </div>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                    >
                        {t('create_training_session') || 'Create Training Session'}
                    </button>
                    <button
                        onClick={handleScheduleSession}
                        className="bg-secondary hover:bg-accent text-secondary-foreground font-semibold py-2 px-6 rounded-lg transition-colors"
                        disabled={isScheduling}
                    >
                        {isScheduling ? t('scheduling') : t('schedule_quick_session') || 'Quick Schedule'}
                    </button>
                    <button
                        onClick={handleArtemisAutoConfig}
                        disabled={isAutoConfiguring}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-lg transition-all flex items-center gap-2"
                        title={t('artemis_auto_config_desc') || 'Let Artemis analyze current conditions and automatically configure optimal training settings'}
                    >
                        {isAutoConfiguring ? (
                            <>
                                <span className="animate-spin">⚙️</span>
                                {t('artemis_configuring') || 'Artemis Configuring...'}
                            </>
                        ) : (
                            <>
                                <span>🤖</span>
                                {t('artemis_auto_configure') || 'Artemis Auto Configure'}
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="bg-secondary hover:bg-accent text-secondary-foreground font-semibold py-2 px-6 rounded-lg transition-colors"
                    >
                        {showSettings ? t('hide_settings') || 'Hide Settings' : t('training_settings') || 'Training Settings'}
                    </button>
                    <p className="text-xs text-muted-foreground self-center">
                        {t('last_update')}: {new Date(data.lastUpdated).toLocaleString()}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <TrainingTypeCard
                    title={t('individual_training')}
                    description={t('individual_training_desc')} 
                    duration="15-30 min"
                    agents="1"
                />
                 <TrainingTypeCard 
                    title={t('collective_training')} 
                    description={t('collective_training_desc')} 
                    duration="45-60 min"
                    agents="3-8"
                />
                 <TrainingTypeCard 
                    title={t('cross_training')} 
                    description={t('cross_training_desc')} 
                    duration="30-45 min"
                    agents="2-5"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title={t('running_sessions')}>
                    {data.runningSessions.length === 0 ? (
                        <EmptyState message={t('no_running_sessions')} />
                    ) : (
                        <div className="space-y-4">
                            {data.runningSessions.map(session => (
                                <SessionCard
                                    key={session.id}
                                    session={session}
                                    actionLabel={t('complete_session')}
                                    isActionLoading={completingId === session.id}
                                    onAction={() => handleCompleteSession(session.id)}
                                    showProgress={true}
                                />
                            ))}
                        </div>
                    )}
                </Card>
                <Card title={t('queued_sessions')}>
                    {data.queue.length === 0 ? (
                        <EmptyState message={t('no_queued_sessions')} />
                    ) : (
                        <div className="space-y-4">
                            {data.queue.map(session => (
                                <SessionCard key={session.id} session={session} />
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            <Card title={t('recent_sessions')}>
                <div className="mb-4 flex flex-wrap gap-3">
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
                        aria-label={t('filter_by_mode') || 'Filter by mode'}
                    >
                        <option value="all">{t('all_modes') || 'All Modes'}</option>
                        <option value="individual">{t('individual_training')}</option>
                        <option value="collective">{t('collective_training')}</option>
                        <option value="cross-functional">{t('cross_training')}</option>
                    </select>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="p-2 bg-secondary border border-border rounded text-foreground text-sm"
                        aria-label={t('filter_by_status') || 'Filter by status'}
                    >
                        <option value="all">{t('all_statuses') || 'All Statuses'}</option>
                        <option value="scheduled">{t('scheduled') || 'Scheduled'}</option>
                        <option value="running">{t('running') || 'Running'}</option>
                        <option value="completed">{t('completed') || 'Completed'}</option>
                    </select>
                </div>
                {filteredSessions.length === 0 ? (
                    <EmptyState message={t('no_sessions_found') || 'No sessions found'} />
                ) : (
                    <div className="space-y-4">
                        {filteredSessions.map(session => (
                            <SessionCard 
                                key={session.id} 
                                session={session}
                                showProgress={session.status === 'running'}
                            />
                        ))}
                    </div>
                )}
            </Card>
            
            {showSettings && trainingConfig && (
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
                    t={t}
                />
            )}
        </div>
    );
};

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
                            aria-label={t('optimization_level') || 'Optimization Level'}
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

const TrainingTypeCard: React.FC<{title: string, description: string, duration: string, agents: string}> = ({title, description, duration, agents}) => (
    <div className="bg-card border border-border rounded-lg p-4 text-center hover:border-purple-500/50 transition-all cursor-pointer">
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
}> = ({ session, actionLabel, onAction, isActionLoading, showProgress = false }) => {
    const { t } = useLanguage();
    const startTime = new Date(session.startedAt);
    const completionTime = session.completedAt ? new Date(session.completedAt) : undefined;
    const now = new Date();
    const elapsed = now.getTime() - startTime.getTime();
    const totalExpected = session.expectedCompletionMinutes * 60 * 1000;
    const progress = showProgress && session.status === 'running' ? Math.min((elapsed / totalExpected) * 100, 95) : 0;

    const modeKey = `training_mode_${session.mode.replace('-', '_')}`;
    return (
        <div className="border border-border rounded-lg p-4 bg-background/40 hover:bg-background/60 transition-colors">
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                    <h4 className="font-semibold text-foreground text-sm">{session.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                            session.status === 'running' ? 'bg-green-500/20 text-green-400' :
                            session.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-yellow-500/20 text-yellow-400'
                        }`}>
                            {t(session.status)}
                        </span>
                        <span className="text-xs bg-purple-500/10 text-purple-300 px-2 py-1 rounded-full uppercase font-semibold">
                            {t(modeKey)}
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
            
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                    <p className="font-semibold text-foreground">{t('start_time')}</p>
                    <p>{startTime.toLocaleString()}</p>
                </div>
                <div>
                    <p className="font-semibold text-foreground">{t('expected_completion')}</p>
                    <p>{session.expectedCompletionMinutes} {t('minutes')}</p>
                </div>
                <div>
                    <p className="font-semibold text-foreground">{t('agents')}</p>
                    <p>{session.agentIds.length} {t('agent') || 'agent(s)'}</p>
                </div>
                {completionTime && (
                    <div>
                        <p className="font-semibold text-foreground">{t('completed_at')}</p>
                        <p>{completionTime.toLocaleString()}</p>
                    </div>
                )}
                {session.accuracyGain !== undefined && (
                    <div className="col-span-2">
                        <p className="font-semibold text-foreground">{t('accuracy_gain')}</p>
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
                        {isActionLoading ? t('processing') : actionLabel}
                    </button>
                </div>
            )}
        </div>
    );
};

const CreateSessionModal: React.FC<{
    onClose: () => void;
    onCreate: (data: {
        title: string;
        mode: AITrainingMode;
        agentIds: string[];
        expectedCompletionMinutes: number;
        startInMinutes?: number;
    }) => Promise<void>;
    t: (key: string) => string;
}> = ({ onClose, onCreate, t }) => {
    const [title, setTitle] = useState('');
    const [mode, setMode] = useState<AITrainingMode>('individual');
    const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
    const [expectedMinutes, setExpectedMinutes] = useState(30);
    const [startInMinutes, setStartInMinutes] = useState(5);
    const [availableAgents, setAvailableAgents] = useState<Array<{id: string; name: string}>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const loadAgents = async () => {
            try {
                const managerData = await api.fetchAIManagerData();
                const agents = managerData.agents.map(a => ({ id: a.id, name: a.name }));
                setAvailableAgents(agents);
            } catch (e) {
                console.error('Failed to load agents:', e);
            } finally {
                setIsLoading(false);
            }
        };
        loadAgents();
    }, []);

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
                            aria-label={t('training_mode') || 'Training Mode'}
                        >
                            <option value="individual">{t('individual_training')}</option>
                            <option value="collective">{t('collective_training')}</option>
                            <option value="cross-functional">{t('cross_training')}</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-1">{t('select_agents') || 'Select Agents'}</label>
                        {isLoading ? (
                            <p className="text-sm text-muted-foreground">{t('loading')}</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-secondary rounded border border-border">
                                {availableAgents.map(agent => (
                                    <label key={agent.id} htmlFor={`agent-${agent.id}`} className="flex items-center gap-2 p-2 hover:bg-background/50 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            id={`agent-${agent.id}`}
                                            checked={selectedAgents.includes(agent.id)}
                                            onChange={() => toggleAgent(agent.id)}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-sm text-foreground">{agent.name}</span>
                                    </label>
                                ))}
                            </div>
                        )}
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
