import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AIAgent } from '../../types.ts';
import TechnicalAnalysisAgentControl from './TechnicalAnalysisAgentControl.tsx';
import RiskManagementAgentControl from './RiskManagementAgentControl.tsx';
import SentimentAgentControl from './SentimentAgentControl.tsx';
import PatternAgentControl from './PatternAgentControl.tsx';
import PricePredictionAgentControl from './PricePredictionAgentControl.tsx';
import ArbitrageAgentControl from './ArbitrageAgentControl.tsx';
import PortfolioAllocationAgentControl from './PortfolioAllocationAgentControl.tsx';
import LiquidityAgentControl from './LiquidityAgentControl.tsx';
import TrendAgentControl from './TrendAgentControl.tsx';
import OptimizationAgentControl from './OptimizationAgentControl.tsx';
import OrderManagementAgentControl from './OrderManagementAgentControl.tsx';
import FundamentalAgentControl from './FundamentalAgentControl.tsx';
import MarketIntelligenceAgentControl from './MarketIntelligenceAgentControl.tsx';
import VolumeAgentControl from './VolumeAgentControl.tsx';
import TimingAgentControl from './TimingAgentControl.tsx';

const AIAgents: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const agentData = await api.fetchAIAgents();
            setAgents(agentData);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const handleAgentUpdate = (updatedAgent: AIAgent) => {
        setAgents(prev => prev.map(a => a.id === updatedAgent.id ? updatedAgent : a));
        setSelectedAgent(updatedAgent);
    };

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

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
            
            {selectedAgent && selectedAgent.id === '1' && (
                <TechnicalAnalysisAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
            )}
            {selectedAgent && selectedAgent.id === '2' && (
                <RiskManagementAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
            )}
            {selectedAgent && selectedAgent.id === '3' && (
                <SentimentAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
            )}
            {selectedAgent && selectedAgent.id === '4' && (
                <PatternAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
            )}
            {selectedAgent && selectedAgent.id === '5' && (
                <PricePredictionAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
            )}
            {selectedAgent && selectedAgent.id === '6' && (
                <ArbitrageAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
            )}
            {selectedAgent && selectedAgent.id === '7' && (
                <PortfolioAllocationAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
            )}
            {selectedAgent && selectedAgent.id === '8' && (
                <LiquidityAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
            )}
            {selectedAgent && selectedAgent.id === '9' && (
                <TrendAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
            )}
            {selectedAgent && selectedAgent.id === '10' && (
                <OptimizationAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
            )}
            {selectedAgent && selectedAgent.id === '11' && (
                <OrderManagementAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
            )}
            {selectedAgent && selectedAgent.id === '12' && (
                <FundamentalAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
            )}
            {selectedAgent && selectedAgent.id === '13' && (
                <MarketIntelligenceAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
            )}
            {selectedAgent && selectedAgent.id === '14' && (
                <VolumeAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
            )}
            {selectedAgent && selectedAgent.id === '15' && (
                <TimingAgentControl
                    agent={selectedAgent}
                    onClose={() => setSelectedAgent(null)}
                    onUpdate={handleAgentUpdate}
                />
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