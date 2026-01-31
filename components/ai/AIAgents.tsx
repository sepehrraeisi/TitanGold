import React, { useState, useEffect, Suspense } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AIAgent } from '../../types.ts';
import ErrorBoundary from '../ErrorBoundary.tsx';
import { getAgentControl } from './agentRegistry.ts';
import LoadingSpinner, { AgentLoadingSpinner } from '../ui/LoadingSpinner';
import SkeletonLoader, { AgentListSkeleton } from '../ui/SkeletonLoader';

const AIAgents: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const agentData = await api.fetchAIAgents();
            setAgents(agentData);
        } catch (e: any) {
            console.error('Failed to load AI agents:', e);
            const message = e?.message || e?.toString() || 'Unknown error';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAgentUpdate = (updatedAgent: AIAgent) => {
        setAgents(prev => prev.map(a => a.id === updatedAgent.id ? updatedAgent : a));
        setSelectedAgent(updatedAgent);
    };

    if (isLoading) {
        return <AgentListSkeleton count={6} />;
    }

    if (error) {
        return (
            <div className="text-center p-10 space-y-3">
                <p className="text-sm text-red-400">
                    {t('failed_to_load_data') || 'Failed to load AI agents.'}
                </p>
                <button
                    onClick={fetchData}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold"
                >
                    {t('retry') || 'Retry'}
                </button>
            </div>
        );
    }

    // Get the agent control component dynamically
    const agentRegistryEntry = selectedAgent ? getAgentControl(selectedAgent.agent_key) : null;

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map(agent => (
                    <AgentCard
                        key={agent.id}
                        agent={agent}
                        onOpenControlPanel={() => setSelectedAgent(agent)}
                    />
                ))}
            </div>
            
            {/* Lazy-loaded agent control panel with loading spinner */}
            {selectedAgent && agentRegistryEntry && (
                <ErrorBoundary fallbackTitle={agentRegistryEntry.fallbackTitle}>
                    <Suspense fallback={
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-card border border-border rounded-lg p-8">
                                <AgentLoadingSpinner agentName={selectedAgent.name} />
                            </div>
                        </div>
                    }>
                        <agentRegistryEntry.component
                            agent={selectedAgent}
                            onClose={() => setSelectedAgent(null)}
                            onUpdate={handleAgentUpdate}
                        />
                    </Suspense>
                </ErrorBoundary>
            )}
        </>
    );
};

const AgentCard: React.FC<{ agent: AIAgent; onOpenControlPanel: () => void }> = ({ agent, onOpenControlPanel }) => {
    const { t } = useLanguage();
    
    return (
         <div className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start">
                    <div>
                         <h3 className="font-bold text-foreground">{agent.name}: {agent.role}</h3>
                         <p className={`text-xs font-semibold ${agent.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>{t(agent.status)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xl font-bold text-purple-400">{agent.accuracy.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">{t('accuracy')}</p>
                    </div>
                </div>
                <div className="my-4 space-y-2 text-xs">
                    <ProgressBar label={t('training_progress')} value={agent.trainingProgress} />
                    <Metric label={t('decisions')} value={agent.decisions.toLocaleString()} />
                    <Metric label={t('learning_time_hours')} value={agent.learningTime.toLocaleString()} />
                    <Metric label={t('knowledge_size_mb')} value={`${agent.knowledgeSize.toFixed(1)}MB`} />
                </div>
                 <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-1">{t('capabilities')}</h4>
                    <div className="flex flex-wrap gap-1">
                        {agent.capabilities.map(c => <span key={c} className="text-xs bg-secondary px-2 py-0.5 rounded">{c}</span>)}
                    </div>
                 </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                 <button
                     onClick={onOpenControlPanel}
                     className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1 px-3 rounded-md"
                 >
                     {t('control_panel')}
                 </button>
                 <span className="text-xs text-muted-foreground">{t('last_update')}: {new Date(agent.lastUpdate).toLocaleTimeString()}</span>
            </div>
        </div>
    )
};

const Metric: React.FC<{label: string, value: string}> = ({label, value}) => (
    <div className="flex justify-between items-center">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
    </div>
);

const ProgressBar: React.FC<{label: string, value: number}> = ({ label, value }) => (
    <div>
        <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground font-semibold">{value.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5">
            <div className="bg-purple-500 h-1.5 rounded-full" style={{width: `${value}%`}}></div>
        </div>
    </div>
);

export default AIAgents;