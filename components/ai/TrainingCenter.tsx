import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';

const TrainingCenter: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const trainingData = await api.fetchTrainingData();
            setData(trainingData);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6 text-center">
                <h2 className="text-xl font-bold text-foreground">{t('training_center')}</h2>
                <p className="text-muted-foreground mt-1">{t('training_center_desc')}</p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                     <StatCard label={t('active_training_agents')} value={15} />
                     <StatCard label={t('total_sessions')} value={data.sessions} />
                     <StatCard label={t('average_accuracy')} value={`${data.avgAccuracy}%`} />
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
                <Card title={t('advanced_ml_settings')}>
                    {/* Placeholder for ML settings form */}
                     <p className="text-muted-foreground text-sm">{t('select_agents')}, {t('training_parameters')}...</p>
                     <div className="mt-4 text-center">
                        <button className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg">{t('start_advanced_training')}</button>
                     </div>
                </Card>
                 <Card title={t('session_history')}>
                     <p className="text-muted-foreground text-sm text-center py-8">{t('error_loading_history')}</p>
                 </Card>
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
    <div className="bg-card border border-border rounded-lg p-4 text-center hover:border-purple-500/50 transition-all">
        <h3 className="font-bold text-lg text-purple-400">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1 h-12">{description}</p>
        <div className="mt-3 text-xs flex justify-around text-muted-foreground">
            <span>Duration: {duration}</span>
            <span>Agents: {agents}</span>
        </div>
    </div>
);

export default TrainingCenter;