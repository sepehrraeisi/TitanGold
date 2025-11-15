import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AITrainingSession, AITrainingStats } from '../../types.ts';

const TrainingCenter: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AITrainingStats | null>(null);
    const [isScheduling, setIsScheduling] = useState(false);
    const [completingId, setCompletingId] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const trainingData = await api.fetchTrainingData();
            setData(trainingData);
            setIsLoading(false);
        };
        fetchData();
    }, []);

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
        } finally {
            setCompletingId(null);
        }
    };

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6 text-center">
                <h2 className="text-xl font-bold text-foreground">{t('training_center')}</h2>
                <p className="text-muted-foreground mt-1">{t('training_center_desc')}</p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                     <StatCard label={t('active_training_agents')} value={data.activeTrainingAgents} />
                     <StatCard label={t('total_sessions')} value={data.sessions} />
                     <StatCard label={t('average_accuracy')} value={`${data.avgAccuracy}%`} />
                </div>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                        onClick={handleScheduleSession}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg"
                        disabled={isScheduling}
                    >
                        {isScheduling ? t('scheduling') : t('schedule_new_session')}
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
                {data.recentHistory.length === 0 ? (
                    <EmptyState message={t('no_recent_sessions')} />
                ) : (
                    <div className="space-y-4">
                        {data.recentHistory.map(session => (
                            <SessionCard key={session.id} session={session} />
                        ))}
                    </div>
                )}
            </Card>
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
    <div className="bg-card border border-border rounded-lg p-4 text-center hover:border-purple-500/50 transition-all">
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
}> = ({ session, actionLabel, onAction, isActionLoading }) => {
    const { t } = useLanguage();
    const startTime = new Date(session.startedAt);
    const completionTime = session.completedAt ? new Date(session.completedAt) : undefined;

    const modeKey = `training_mode_${session.mode.replace('-', '_')}`;
    return (
        <div className="border border-border rounded-lg p-4 bg-background/40">
            <div className="flex justify-between items-start gap-3">
                <div>
                    <h4 className="font-semibold text-foreground text-sm">{session.title}</h4>
                    <p className="text-xs text-muted-foreground">{t(session.status)}</p>
                </div>
                <span className="text-xs bg-purple-500/10 text-purple-300 px-2 py-1 rounded-full uppercase font-semibold">
                    {t(modeKey)}
                </span>
            </div>
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
                    <p>{session.agentIds.join(', ')}</p>
                </div>
                {completionTime && (
                    <div>
                        <p className="font-semibold text-foreground">{t('completed_at')}</p>
                        <p>{completionTime.toLocaleString()}</p>
                    </div>
                )}
                {session.accuracyGain !== undefined && (
                    <div>
                        <p className="font-semibold text-foreground">{t('accuracy_gain')}</p>
                        <p>+{session.accuracyGain.toFixed(1)}%</p>
                    </div>
                )}
            </div>
            {actionLabel && onAction && (
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={onAction}
                        disabled={isActionLoading}
                        className="text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-1.5 px-4 rounded-md"
                    >
                        {isActionLoading ? t('processing') : actionLabel}
                    </button>
                </div>
            )}
        </div>
    );
};

export default TrainingCenter;