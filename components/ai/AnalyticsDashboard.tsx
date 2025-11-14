import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AIAnalyticsMetrics } from '../../types.ts';

const AnalyticsDashboard: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AIAnalyticsMetrics | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const analyticsData = await api.fetchAnalyticsData();
            setData(analyticsData);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }
    
    if (!data) return null;

    return (
        <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-4">
                 <h2 className="text-xl font-bold text-foreground">{t('advanced_ai_analytics')}</h2>
                <p className="text-muted-foreground text-sm">{t('advanced_ai_analytics_desc')}</p>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label={t('decisions_per_minute')} value={data.realtime.decisionRate.toFixed(1)} />
                <StatCard label={t('success_rate')} value={`${data.realtime.successRate.toFixed(1)}%`} />
                <StatCard label={t('system_uptime')} value={`${data.realtime.systemUptime.toFixed(1)}%`} />
                <StatCard label={t('agents_online')} value={`${data.realtime.agentDistribution.active}/${data.realtime.agentDistribution.active}`} />
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title={t('resource_usage')}>
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                         Resource chart loading...
                    </div>
                </Card>
                 <Card title={t('precision_recall')}>
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                        Precision/Recall chart loading...
                    </div>
                </Card>
             </div>

            <Card title={t('agent_performance_matrix')}>
                <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase">
                            <tr>
                                <th className="px-4 py-2">Agent</th>
                                <th className="px-4 py-2">{t('accuracy')}</th>
                                <th className="px-4 py-2">{t('success_rate')}</th>
                                <th className="px-4 py-2">{t('training_progress')}</th>
                                <th className="px-4 py-2">{t('status')}</th>
                            </tr>
                        </thead>
                        <tbody className="text-card-foreground">
                            {data.agentMatrix.map(agent => (
                                <tr key={agent.id} className="border-b border-border">
                                    <td className="px-4 py-2 font-semibold">{agent.name}</td>
                                    <td className="px-4 py-2">{agent.accuracy}%</td>
                                    <td className="px-4 py-2">{agent.successRate}%</td>
                                    <td className="px-4 py-2">{agent.progress}%</td>
                                    <td className="px-4 py-2 text-green-400">{t(agent.status)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
    <div className="bg-card border border-border p-4 rounded-lg">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
    </div>
);

export default AnalyticsDashboard;