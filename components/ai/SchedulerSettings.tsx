import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface SchedulerConfig {
    agents: {
        enabled: boolean;
        interval: number;
        agents: string[];
    };
    dataHub: {
        enabled: boolean;
        interval: number;
        autoRefresh: boolean;
        autoNormalize: boolean;
    };
    training: {
        enabled: boolean;
        interval: number;
        autoSchedule: boolean;
    };
    analytics: {
        enabled: boolean;
        interval: number;
        autoRefresh: boolean;
    };
    artemis: {
        enabled: boolean;
        interval: number;
        autoDecisions: boolean;
    };
}

interface SchedulerStatus {
    isRunning: boolean;
    config: SchedulerConfig;
    activeJobs: string[];
    intervals: string[];
}

const SchedulerSettings: React.FC = () => {
    const { t } = useLanguage();
    const [status, setStatus] = useState<SchedulerStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
            const response = await fetch('/api/scheduler/status', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setStatus(data);
            }
        } catch (error) {
            console.error('Failed to fetch scheduler status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleScheduler = async () => {
        setIsSaving(true);
        try {
            const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
            const endpoint = status?.isRunning ? '/api/scheduler/stop' : '/api/scheduler/start';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                await fetchStatus();
            }
        } catch (error) {
            console.error('Failed to toggle scheduler:', error);
            alert(t('operation_failed') || 'Operation failed');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateConfig = async (section: string, updates: any) => {
        setIsSaving(true);
        try {
            const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
            const response = await fetch(`/api/scheduler/config/${section}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });
            if (response.ok) {
                await fetchStatus();
                alert(t('config_updated') || 'Configuration updated');
            }
        } catch (error) {
            console.error('Failed to update config:', error);
            alert(t('update_failed') || 'Update failed');
        } finally {
            setIsSaving(false);
        }
    };

    const formatInterval = (ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    };

    if (isLoading || !status) {
        return (
            <div className="text-center p-10">
                <div className="animate-spin text-4xl mb-2">⚙️</div>
                <p>{t('loading') || 'Loading...'}</p>
            </div>
        );
    }

    const config = status.config;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">
                            {t('scheduler_24_7') || '24/7 Automation Scheduler'}
                        </h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            {t('scheduler_desc') || 'Configure automatic execution of all AI Center components'}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`px-4 py-2 rounded-lg font-semibold ${
                            status.isRunning 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-600 text-white'
                        }`}>
                            {status.isRunning 
                                ? t('scheduler_running') || '🟢 Running' 
                                : t('scheduler_stopped') || '🔴 Stopped'}
                        </div>
                        <button
                            onClick={handleToggleScheduler}
                            disabled={isSaving}
                            className={`px-6 py-2 rounded-lg font-semibold text-white ${
                                status.isRunning
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-green-600 hover:bg-green-700'
                            }`}
                        >
                            {status.isRunning 
                                ? t('stop_scheduler') || 'Stop Scheduler' 
                                : t('start_scheduler') || 'Start Scheduler'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Agents Scheduler */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">
                            {t('agents_scheduler') || '🤖 Agents Scheduler'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {t('agents_scheduler_desc') || 'Automatically execute all 15 AI agents'}
                        </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.agents.enabled}
                            onChange={(e) => handleUpdateConfig('agents', { enabled: e.target.checked })}
                            className="w-5 h-5"
                        />
                        <span className="text-sm">{t('enabled') || 'Enabled'}</span>
                    </label>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('execution_interval') || 'Execution Interval'}
                        </label>
                        <input
                            type="number"
                            value={config.agents.interval / 1000 / 60}
                            onChange={(e) => handleUpdateConfig('agents', { 
                                interval: parseInt(e.target.value) * 60 * 1000 
                            })}
                            min="1"
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('current_interval') || 'Current'}: {formatInterval(config.agents.interval)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Data Hub Scheduler */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">
                            {t('data_hub_scheduler') || '📊 Data Hub Scheduler'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {t('data_hub_scheduler_desc') || 'Automatically refresh all data sources'}
                        </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.dataHub.enabled}
                            onChange={(e) => handleUpdateConfig('dataHub', { enabled: e.target.checked })}
                            className="w-5 h-5"
                        />
                        <span className="text-sm">{t('enabled') || 'Enabled'}</span>
                    </label>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('refresh_interval') || 'Refresh Interval'}
                        </label>
                        <input
                            type="number"
                            value={config.dataHub.interval / 1000 / 60}
                            onChange={(e) => handleUpdateConfig('dataHub', { 
                                interval: parseInt(e.target.value) * 60 * 1000 
                            })}
                            min="1"
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('current_interval') || 'Current'}: {formatInterval(config.dataHub.interval)}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.dataHub.autoRefresh}
                                onChange={(e) => handleUpdateConfig('dataHub', { autoRefresh: e.target.checked })}
                                className="w-4 h-4"
                            />
                            <span className="text-sm">{t('auto_refresh') || 'Auto Refresh'}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.dataHub.autoNormalize}
                                onChange={(e) => handleUpdateConfig('dataHub', { autoNormalize: e.target.checked })}
                                className="w-4 h-4"
                            />
                            <span className="text-sm">{t('auto_normalize') || 'Auto Normalize'}</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Training Scheduler */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">
                            {t('training_scheduler') || '🎓 Training Scheduler'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {t('training_scheduler_desc') || 'Automatically schedule training sessions'}
                        </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.training.enabled}
                            onChange={(e) => handleUpdateConfig('training', { enabled: e.target.checked })}
                            className="w-5 h-5"
                        />
                        <span className="text-sm">{t('enabled') || 'Enabled'}</span>
                    </label>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('check_interval') || 'Check Interval'}
                        </label>
                        <input
                            type="number"
                            value={config.training.interval / 1000 / 60}
                            onChange={(e) => handleUpdateConfig('training', { 
                                interval: parseInt(e.target.value) * 60 * 1000 
                            })}
                            min="1"
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                        />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.training.autoSchedule}
                            onChange={(e) => handleUpdateConfig('training', { autoSchedule: e.target.checked })}
                            className="w-4 h-4"
                        />
                        <span className="text-sm">{t('auto_schedule_training') || 'Auto Schedule Training'}</span>
                    </label>
                </div>
            </div>

            {/* Analytics Scheduler */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">
                            {t('analytics_scheduler') || '📈 Analytics Scheduler'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {t('analytics_scheduler_desc') || 'Automatically refresh analytics data'}
                        </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.analytics.enabled}
                            onChange={(e) => handleUpdateConfig('analytics', { enabled: e.target.checked })}
                            className="w-5 h-5"
                        />
                        <span className="text-sm">{t('enabled') || 'Enabled'}</span>
                    </label>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('refresh_interval') || 'Refresh Interval'}
                        </label>
                        <input
                            type="number"
                            value={config.analytics.interval / 1000 / 60}
                            onChange={(e) => handleUpdateConfig('analytics', { 
                                interval: parseInt(e.target.value) * 60 * 1000 
                            })}
                            min="1"
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                        />
                    </div>
                </div>
            </div>

            {/* Artemis Scheduler */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">
                            {t('artemis_scheduler') || '🧠 Artemis Scheduler'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {t('artemis_scheduler_desc') || 'Automatically trigger Artemis decision cycles'}
                        </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.artemis.enabled}
                            onChange={(e) => handleUpdateConfig('artemis', { enabled: e.target.checked })}
                            className="w-5 h-5"
                        />
                        <span className="text-sm">{t('enabled') || 'Enabled'}</span>
                    </label>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('decision_interval') || 'Decision Interval'}
                        </label>
                        <input
                            type="number"
                            value={config.artemis.interval / 1000}
                            onChange={(e) => handleUpdateConfig('artemis', { 
                                interval: parseInt(e.target.value) * 1000 
                            })}
                            min="10"
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SchedulerSettings;

