import React, { Suspense, lazy, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { useArtemisState } from '../hooks/useArtemisState.ts';
import * as api from '../../../services/api.ts';
import { AIManagerOverview, ArtemisState } from '../../../types.ts';

const OverviewTab = lazy(() => import('./tabs/OverviewTab.tsx'));
const DecisionEngineTab = lazy(() => import('./tabs/DecisionEngineTab.tsx'));
const OrchestrationTab = lazy(() => import('./tabs/OrchestrationTab.tsx'));
const LearningTab = lazy(() => import('./tabs/LearningTab.tsx'));
const MonitoringTab = lazy(() => import('./tabs/MonitoringTab.tsx'));
const ScenariosTab = lazy(() => import('./tabs/ScenariosTab.tsx'));
const DataHubTab = lazy(() => import('./tabs/DataHubTab.tsx'));
const BacktestingTab = lazy(() => import('./tabs/BacktestingTab.tsx'));
const SystemLogsTab = lazy(() => import('./tabs/SystemLogsTab.tsx'));
const SettingsTab = lazy(() => import('./tabs/SettingsTab.tsx'));

type ArtemisTab =
    | 'overview'
    | 'decision_engine'
    | 'orchestration'
    | 'learning'
    | 'monitoring'
    | 'scenarios'
    | 'data_hub'
    | 'backtesting'
    | 'logs'
    | 'settings';

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-card border border-border rounded-lg p-4 ${className || ''}`}>
        {children}
    </div>
);

const AIManager: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AIManagerOverview | null>(null);
    const { state: artemis, loading: artemisLoading, error: artemisError, reload: reloadArtemis, setSafeState: setArtemis } = useArtemisState();
    const [activeTab, setActiveTab] = useState<ArtemisTab>('overview');
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const managerData = await api.fetchAIManagerData();
                setData(managerData);
                if (managerData.artemis) {
                    setArtemis(managerData.artemis);
                } else {
                    await reloadArtemis();
                }
            } catch (e) {
                console.error('Failed to load AIManager data:', e);
                setError(e instanceof Error ? e.message : 'Failed to load data');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [reloadArtemis, setArtemis]);

    if (isLoading || artemisLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

    const combinedError = error || artemisError;
    if (combinedError) {
        return (
            <div className="text-center p-10">
                <p className="text-red-400 mb-4">{t('error_loading') || 'Error loading data'}: {combinedError}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                >
                    {t('reload') || 'Reload'}
                </button>
            </div>
        );
    }

    if (!data || !artemis) {
        return <div className="text-center p-10">{t('no_data') || 'No data available'}</div>;
    }

    const tabs: { id: ArtemisTab; label: string }[] = [
        { id: 'overview', label: t('artemis_overview') || 'Overview' },
        { id: 'decision_engine', label: t('artemis_decision_engine') || 'Decision Engine' },
        { id: 'orchestration', label: t('artemis_orchestration') || 'Agent Orchestration' },
        { id: 'learning', label: t('artemis_learning') || 'Learning System' },
        { id: 'monitoring', label: t('artemis_monitoring') || 'System Monitoring' },
        { id: 'scenarios', label: t('artemis_scenarios') || 'Trading Scenarios' },
        { id: 'data_hub', label: t('artemis_data_hub') || 'Data Hub' },
        { id: 'backtesting', label: t('artemis_backtesting') || 'Backtesting' },
        { id: 'logs', label: t('artemis_logs') || 'System Logs' },
        { id: 'settings', label: t('artemis_settings') || 'Settings' },
    ];

    const refreshArtemis = async () => {
        try {
            await reloadArtemis();
        } catch (e) {
            console.error('Failed to refresh Artemis state:', e);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{t('artemis_central_ai') || 'Artemis Central AI Controller'}</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('artemis_description') || 'Central decision-making and coordination system for autonomous trading'}
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            artemis.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            artemis.status === 'standby' ? 'bg-yellow-500/20 text-yellow-400' :
                            artemis.status === 'maintenance' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-red-500/20 text-red-400'
                        }`}>
                            {t(artemis.status) || artemis.status}
                        </span>
                        <button
                            onClick={async () => {
                                const newMode = artemis.mode === 'demo' ? 'real' : 'demo';
                                if (confirm(t('switch_mode_confirm') || `Switch to ${newMode} mode? This will affect all trading operations.`)) {
                                    try {
                                        const updated = await api.updateArtemisMode(newMode);
                                        setArtemis(updated);
                                        alert(t('mode_switched') || `Mode switched to ${newMode}`);
                                    } catch (e) {
                                        console.error('Failed to switch mode:', e);
                                        alert(t('mode_switch_failed') || 'Failed to switch mode');
                                    }
                                }
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all hover:opacity-80 ${
                                artemis.mode === 'real' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                            }`}
                            title={t('click_to_switch_mode') || 'Click to switch between demo and real mode'}
                        >
                            {artemis.mode === 'real' ? '🔴 ' : '🟢 '}
                            {t(artemis.mode) || artemis.mode}
                        </button>
                    </div>
                </div>

                <div className="border-b border-border">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-purple-500 text-purple-400'
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </Card>

            <div className="mt-6">
                <Suspense fallback={<div className="text-center p-10">{t('loading')}</div>}>
                    {activeTab === 'overview' && <OverviewTab data={data} artemis={artemis} t={t} onRefresh={refreshArtemis} onNavigate={setActiveTab} Card={Card} />}
                    {activeTab === 'decision_engine' && <DecisionEngineTab artemis={artemis} t={t} onRefresh={refreshArtemis} Card={Card} />}
                    {activeTab === 'orchestration' && <OrchestrationTab t={t} Card={Card} />}
                    {activeTab === 'learning' && <LearningTab t={t} Card={Card} />}
                    {activeTab === 'monitoring' && <MonitoringTab artemis={artemis} t={t} onRefresh={refreshArtemis} Card={Card} />}
                    {activeTab === 'scenarios' && <ScenariosTab t={t} onRefresh={refreshArtemis} Card={Card} />}
                    {activeTab === 'data_hub' && <DataHubTab artemis={artemis} t={t} onRefresh={refreshArtemis} Card={Card} />}
                    {activeTab === 'backtesting' && <BacktestingTab artemis={artemis} t={t} onRefresh={refreshArtemis} Card={Card} />}
                    {activeTab === 'logs' && <SystemLogsTab artemis={artemis} t={t} onRefresh={refreshArtemis} Card={Card} />}
                    {activeTab === 'settings' && <SettingsTab artemis={artemis} t={t} onRefresh={refreshArtemis} Card={Card} />}
                </Suspense>
            </div>
        </div>
    );
};

export default AIManager;

