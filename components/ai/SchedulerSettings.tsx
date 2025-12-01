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

    const getDefaultStatus = (): SchedulerStatus => ({
        isRunning: false,
        config: {
            agents: {
                enabled: true,
                interval: 5 * 60 * 1000, // 5 minutes
                agents: []
            },
            dataHub: {
                enabled: true,
                interval: 2 * 60 * 1000, // 2 minutes
                autoRefresh: true,
                autoNormalize: true
            },
            training: {
                enabled: true,
                interval: 30 * 60 * 1000, // 30 minutes
                autoSchedule: false
            },
            analytics: {
                enabled: true,
                interval: 10 * 60 * 1000, // 10 minutes
                autoRefresh: true
            },
            artemis: {
                enabled: true,
                interval: 1 * 60 * 1000, // 1 minute
                autoDecisions: true
            }
        },
        activeJobs: [],
        intervals: []
    });

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
            } else {
                // If API fails, use default status
                console.warn('Failed to fetch scheduler status, using defaults');
                setStatus(getDefaultStatus());
            }
        } catch (error) {
            console.error('Failed to fetch scheduler status:', error);
            // Use default status on error
            setStatus(getDefaultStatus());
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleScheduler = async () => {
        if (!status) return;
        
        setIsSaving(true);
        try {
            const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
            if (!token) {
                alert(t('operation_failed') || 'Operation failed: No authentication token found. Please log in again.');
                setIsSaving(false);
                return;
            }
            
            const endpoint = status.isRunning ? '/api/scheduler/stop' : '/api/scheduler/start';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                await fetchStatus();
                // Show success message
                console.log('Scheduler toggled successfully:', result);
            } else {
                let errorMessage = 'Unknown error';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
                } catch (e) {
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                
                // More specific error messages
                if (response.status === 401) {
                    errorMessage = t('auth_required') || 'Authentication required. Please log in again.';
                } else if (response.status === 403) {
                    errorMessage = t('insufficient_permissions') || 'Insufficient permissions. You need admin or trader role.';
                } else if (response.status === 500) {
                    errorMessage = t('server_error') || 'Server error. Please check the console for details.';
                }
                
                console.error('Failed to toggle scheduler:', response.status, errorMessage);
                alert(t('operation_failed') || `Operation failed: ${errorMessage}`);
            }
        } catch (error: any) {
            console.error('Failed to toggle scheduler:', error);
            const errorMessage = error.message || 'Network error. Please check your connection.';
            alert(t('operation_failed') || `Operation failed: ${errorMessage}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateConfig = async (section: string, updates: any) => {
        if (!status) return;
        
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
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                alert(t('update_failed') || `Update failed: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error: any) {
            console.error('Failed to update config:', error);
            alert(t('update_failed') || `Update failed: ${error.message || 'Unknown error'}`);
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

    if (isLoading) {
        return (
            <div className="text-center p-10">
                <div className="animate-spin text-4xl mb-2">⚙️</div>
                <p>{t('loading') || 'Loading...'}</p>
            </div>
        );
    }

    // Use default status if status is null
    const currentStatus = status || getDefaultStatus();
    const config = currentStatus.config;

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
                            currentStatus.isRunning 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-600 text-white'
                        }`}>
                            {currentStatus.isRunning 
                                ? t('scheduler_running') || '🟢 Running' 
                                : t('scheduler_stopped') || '🔴 Stopped'}
                        </div>
                        <button
                            onClick={handleToggleScheduler}
                            disabled={isSaving}
                            className={`px-6 py-2 rounded-lg font-semibold text-white transition-colors ${
                                currentStatus.isRunning
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-green-600 hover:bg-green-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {currentStatus.isRunning 
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
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
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
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
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
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('current_interval') || 'Current'}: {formatInterval(config.training.interval)}
                        </p>
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
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('current_interval') || 'Current'}: {formatInterval(config.analytics.interval)}
                        </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.analytics.autoRefresh}
                            onChange={(e) => handleUpdateConfig('analytics', { autoRefresh: e.target.checked })}
                            className="w-4 h-4"
                        />
                        <span className="text-sm">{t('auto_refresh') || 'Auto Refresh'}</span>
                    </label>
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
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('current_interval') || 'Current'}: {formatInterval(config.artemis.interval)}
                        </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.artemis.autoDecisions}
                            onChange={(e) => handleUpdateConfig('artemis', { autoDecisions: e.target.checked })}
                            className="w-4 h-4"
                        />
                        <span className="text-sm">{t('auto_decisions') || 'Auto Decisions'}</span>
                    </label>
                </div>
            </div>
        </div>
    );
};

export default SchedulerSettings;

