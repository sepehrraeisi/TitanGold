import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AIManagerOverview, AIProvider } from '../../types.ts';

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
        {children}
    </div>
);

const AIManager: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AIManagerOverview | null>(null);
    
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const managerData = await api.fetchAIManagerData();
            setData(managerData);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

    if (!data) {
        return null;
    }
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold text-foreground mb-3">{t('artemis_mother_brain')}</h3>
                         <div className="space-y-2">
                            <ProgressBar label={t('strategic_thinking')} value={92} />
                            <ProgressBar label={t('market_intelligence')} value={165} maxValue={200} />
                            <ProgressBar label={t('emotional_quotient')} value={87} />
                            <ProgressBar label={t('adaptability')} value={89} />
                         </div>
                    </div>
                     <div>
                        <h3 className="font-semibold text-foreground mb-3">{t('system_summary')}</h3>
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <Stat value={data.summary.totalAgents} label={t('total_agents')} />
                            <Stat value={data.summary.activeAgents} label={t('active_agents_count')} />
                            <Stat value={data.summary.inTraining} label={t('in_training')} />
                            <Stat value={`${data.summary.avgAccuracy.toFixed(1)}%`} label={t('avg_accuracy')} />
                        </div>
                    </div>
                </Card>
                <Card>
                    <h3 className="font-semibold text-foreground mb-3">{t('external_providers')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {data.providers.map(p => (
                            <ProviderStat key={p.id} name={p.name} performance={p.performance} usage={p.usage} />
                        ))}
                    </div>
                </Card>
            </div>
            <div className="space-y-6">
                <Card>
                    <h3 className="font-semibold text-foreground mb-3">{t('collective_intelligence')}</h3>
                    <div className="space-y-2 text-sm">
                        <Metric label={t('crowd_efficiency')} value="93%" />
                        <Metric label={t('knowledge_sharing')} value="87%" />
                        <Metric label={t('consensus_accuracy')} value="95%" />
                    </div>
                </Card>
                <Card>
                    <h3 className="font-semibold text-foreground mb-3">{t('top_agents')}</h3>
                    <div className="space-y-3">
                        {data.topAgents.map(agent => (
                            <div key={agent.id} className="flex justify-between items-center text-sm">
                                <div>
                                    <p className="font-semibold text-foreground">{agent.name}</p>
                                    <p className="text-xs text-muted-foreground">{agent.role}</p>
                                </div>
                                <span className="font-bold text-purple-400">{agent.accuracy.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground text-right">
                        {t('last_update')}: {new Date(data.lastUpdated).toLocaleString()}
                    </p>
                </Card>
            </div>
        </div>
    );
};

const ProgressBar: React.FC<{label: string, value: number, maxValue?: number}> = ({ label, value, maxValue = 100 }) => (
    <div>
        <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground font-semibold">{value}</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5">
            <div className="bg-purple-500 h-1.5 rounded-full" style={{width: `${(value / maxValue) * 100}%`}}></div>
        </div>
    </div>
);

const Stat: React.FC<{ value: string|number, label: string }> = ({ value, label }) => (
    <div className="bg-secondary p-3 rounded-lg">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
    </div>
);

const ProviderStat: React.FC<{name: string, performance: number, usage: number}> = ({name, performance, usage}) => (
    <div className="text-center p-3 border border-border rounded-lg">
        <p className="font-bold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{`Perf: ${performance}%`}</p>
        <p className="text-xs text-muted-foreground">{`Usage: ${usage}`}</p>
    </div>
);

const Metric: React.FC<{label: string, value: string}> = ({label, value}) => (
    <div className="flex justify-between items-center">
        <span className="text-card-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
    </div>
);

export default AIManager;