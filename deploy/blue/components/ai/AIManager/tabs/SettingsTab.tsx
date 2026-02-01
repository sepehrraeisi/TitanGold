import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../../../../services/api.ts';
import { ArtemisConfig, ArtemisState } from '../../../../types.ts';
import { OnNavigateHandler } from '../../../../types/navigation.ts';
import { useAppContext } from '../../../../context/AppContext.tsx';
import { isAdminRole } from '../../../../utils/auth.ts';
import SchedulerSettings from '../../SchedulerSettings.tsx';

type Props = {
    artemis: ArtemisState;
    t: (key: string) => string;
    onRefresh: () => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
    onNavigate?: OnNavigateHandler;
};

type SettingsTabId = 'decision' | 'learning' | 'security' | 'monitoring' | 'integration' | 'ui' | 'scheduler';

/**
 * Redirect Card Component for Duplicate Settings Tabs
 * Redirects to Settings → Configuration → [subtab]
 */
type RedirectCardProps = {
    title: string;
    description: string;
    settingsSubtab: string;
    features?: string[];
    onNavigate?: OnNavigateHandler;
    isAdmin: boolean;
    t: (key: string) => string;
};

const RedirectCard: React.FC<RedirectCardProps> = ({
    title,
    description,
    settingsSubtab,
    features = [],
    onNavigate,
    isAdmin,
    t,
}) => {
    const handleOpenSettings = () => {
        if (!isAdmin) return;
        
        if (onNavigate) {
            onNavigate({
                view: 'settings',
                settingsTab: 'configuration',
                settingsSubtab: settingsSubtab,
            });
        }
    };

    return (
        <div className="border border-yellow-500/30 rounded-lg p-6 bg-yellow-500/5">
            <div className="flex flex-col items-center text-center space-y-4">
                {/* Warning Icon */}
                <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>

                {/* Title & Description */}
                <div>
                    <h4 className="text-lg font-semibold text-foreground mb-2">{title}</h4>
                    <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
                </div>

                {/* Features List (if provided) */}
                {features.length > 0 && (
                    <div className="w-full max-w-md p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg text-left">
                        <p className="text-sm font-semibold text-foreground mb-2">
                            📋 {t('available_in_settings') || 'Available in Settings'}:
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            {features.map((feature, idx) => (
                                <li key={idx}>• {feature}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Action Button or Admin Warning */}
                {isAdmin ? (
                    <button
                        onClick={handleOpenSettings}
                        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg text-sm shadow-lg transition-all duration-200 hover:shadow-xl flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {t('open_in_settings') || 'Open in Settings'}
                    </button>
                ) : (
                    <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg max-w-md">
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>
                                <span className="font-semibold">{t('admin_only') || 'Admin Only'}:</span>{' '}
                                {t('admin_only_feature_desc') || 'This configuration is only available to Admin users.'}
                            </span>
                        </p>
                    </div>
                )}

                {/* Info Note */}
                <div className="w-full max-w-2xl p-3 bg-gray-500/5 border border-gray-500/20 rounded text-left">
                    <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">ℹ️ {t('note') || 'Note'}:</span>{' '}
                        {t('settings_consolidated_note') || 'These settings have been consolidated into the Settings menu to provide a single source of truth and reduce duplication.'}
                    </p>
                </div>
            </div>
        </div>
    );
};

const SettingsTab: React.FC<Props> = ({ artemis, t, onRefresh, Card, onNavigate }) => {
    const { user } = useAppContext();
    const isAdmin = isAdminRole(user?.role);

    // Guard: Check if artemis exists
    if (!artemis) {
        return (
            <Card>
                <div className="text-center p-10">
                    <div className="text-sm text-muted-foreground">{t('loading_settings') || 'Loading settings...'}</div>
                </div>
            </Card>
        );
    }

    const getDefaultConfig = (): ArtemisConfig => ({
        decisionEngine: {
            strategy: 'voting',
            activeModel: 'internal',
            confidenceThreshold: 75,
            autoExecution: false,
            requireApproval: true,
            maxConcurrentTrades: 5,
        },
        learning: {
            activeLearning: false,
            autoRetrain: false,
            retrainInterval: 24,
            minAccuracyForRetrain: 70,
            backtestBeforeRetrain: true,
        },
        monitoring: {
            healthCheckInterval: 5,
            alertOnError: true,
            alertChannels: {
                dashboard: true,
                telegram: false,
                email: false,
            },
        },
        security: {
            requireMFA: false,
            logAllCommands: true,
            encryptSensitiveData: true,
            sessionTimeout: 30,
        },
        integration: {
            mexc: {
                enabled: true,
                testnet: artemis.mode === 'demo',
            },
            telegram: {
                enabled: false,
                channels: [],
            },
        },
        ui: {
            language: 'en',
            theme: 'dark',
            widgets: [],
        },
    });

    // Merge artemis.config with defaults (handle empty config)
    const safeInitialConfig = useMemo(() => {
        const defaults = getDefaultConfig();
        const raw = artemis.config || {};
        
        return {
            decisionEngine: { ...defaults.decisionEngine, ...(raw.decisionEngine || {}) },
            learning: { ...defaults.learning, ...(raw.learning || {}) },
            monitoring: { ...defaults.monitoring, ...(raw.monitoring || {}) },
            security: { ...defaults.security, ...(raw.security || {}) },
            integration: { ...defaults.integration, ...(raw.integration || {}) },
            ui: { ...defaults.ui, ...(raw.ui || {}) },
        };
    }, [artemis.config, artemis.mode]);

    const [config, setConfig] = useState<ArtemisConfig>(safeInitialConfig);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<SettingsTabId>('decision');
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [newTelegramChannel, setNewTelegramChannel] = useState('');
    const [newTelegramBotToken, setNewTelegramBotToken] = useState('');

    const tabs = useMemo(
        () => [
            { id: 'decision' as SettingsTabId, label: t('decision_engine') || 'Decision Engine', icon: '⚙️' },
            { id: 'learning' as SettingsTabId, label: t('learning') || 'Learning', icon: '📚' },
            { id: 'security' as SettingsTabId, label: t('security') || 'Security', icon: '🔒' },
            { id: 'monitoring' as SettingsTabId, label: t('monitoring') || 'Monitoring', icon: '📊' },
            { id: 'integration' as SettingsTabId, label: t('integration') || 'Integration', icon: '🔌' },
            { id: 'ui' as SettingsTabId, label: t('ui') || 'UI', icon: '🎨' },
            { id: 'scheduler' as SettingsTabId, label: t('scheduler_24_7') || '24/7 Scheduler', icon: '⏰' },
        ],
        [t],
    );

    const validate = (): boolean => {
        if (config.decisionEngine.confidenceThreshold < 0 || config.decisionEngine.confidenceThreshold > 100) {
            alert(t('validation_error') || 'Confidence threshold must be between 0 and 100');
            return false;
        }
        if (config.decisionEngine.maxConcurrentTrades < 1 || config.decisionEngine.maxConcurrentTrades > 20) {
            alert(t('validation_error') || 'Max concurrent trades must be between 1 and 20');
            return false;
        }
        if (config.learning.retrainInterval < 1) {
            alert(t('validation_error') || 'Retrain interval must be at least 1 hour');
            return false;
        }
        if (config.security.sessionTimeout < 5) {
            alert(t('validation_error') || 'Session timeout must be at least 5 minutes');
            return false;
        }
        if (config.monitoring.healthCheckInterval < 1) {
            alert(t('validation_error') || 'Health check interval must be at least 1 minute');
            return false;
        }
        return true;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setIsSaving(true);
        try {
            await api.updateArtemisConfig({ config });
            alert(t('settings_saved') || 'Settings saved successfully!');
            onRefresh();
        } catch (e) {
            console.error('Failed to save settings:', e);
            alert(t('settings_save_failed') || 'Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setConfig(getDefaultConfig());
        setShowResetConfirm(false);
    };

    const handleExport = () => {
        const dataStr = JSON.stringify(config, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `artemis-config-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string) as ArtemisConfig;
                setConfig(imported);
                alert(t('config_imported') || 'Configuration imported successfully!');
            } catch (error) {
                console.error('Failed to import config:', error);
                alert(t('config_import_failed') || 'Failed to import configuration. Invalid file format.');
            }
        };
        reader.readAsText(file);
    };

    const addTelegramChannel = () => {
        if (newTelegramChannel.trim()) {
            setConfig({
                ...config,
                integration: {
                    ...config.integration,
                    telegram: {
                        ...config.integration.telegram,
                        channels: [...(config.integration.telegram.channels || []), newTelegramChannel.trim()],
                    },
                },
            });
            setNewTelegramChannel('');
        }
    };

    const removeTelegramChannel = (channel: string) => {
        setConfig({
            ...config,
            integration: {
                ...config.integration,
                telegram: {
                    ...config.integration.telegram,
                    channels: (config.integration.telegram.channels || []).filter(c => c !== channel),
                },
            },
        });
    };

    const syncFromState = useCallback(() => {
        // If artemis.config has new fields, merge; otherwise keep defaults
        if (artemis.config) {
            setConfig(prev => ({ ...getDefaultConfig(), ...prev, ...artemis.config }));
        }
    }, [artemis.config]);

    useEffect(() => {
        syncFromState();
    }, [syncFromState]);

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('artemis_settings') || 'Artemis Settings'}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('artemis_settings_desc') || 'Configure Artemis AI system settings'}
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={handleExport}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('export_config') || 'Export'}
                        </button>
                        <label className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm cursor-pointer">
                            {t('import_config') || 'Import'}
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleImport}
                                className="hidden"
                            />
                        </label>
                        <button
                            onClick={() => setShowResetConfirm(true)}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('reset_to_default') || 'Reset'}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {isSaving ? t('saving') || 'Saving...' : t('save_settings') || 'Save Settings'}
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-purple-500 text-purple-400'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="space-y-6">
                    {/* Decision Engine - REDIRECT TO SETTINGS */}
                    {activeTab === 'decision' && (
                        <RedirectCard
                            title={t('decision_engine_moved') || 'Decision Engine Configuration Moved'}
                            description={t('decision_engine_moved_desc') || 'Decision Engine settings are now managed in Settings → Configuration → Decision Engine to provide a unified configuration experience.'}
                            settingsSubtab="decision-engine"
                            features={[
                                'Strategy Selection (Voting, Weighted, Mixture of Experts, Consensus)',
                                'Active Model (Internal, Claude, Gemini, OpenAI, DeepSeek, OpenRouter, Hybrid)',
                                'Confidence Threshold (0-100%)',
                                'Auto Execution & Approval Settings',
                                'Max Concurrent Trades (1-20)',
                            ]}
                            onNavigate={onNavigate}
                            isAdmin={isAdmin}
                            t={t}
                        />
                    )}

                    {/* Learning */}
                    {activeTab === 'learning' && (
                        <div className="border border-border rounded-lg p-4">
                            <h4 className="font-semibold text-foreground mb-3">{t('learning_settings') || 'Learning Settings'}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.learning.activeLearning}
                                        onChange={(e) => setConfig({...config, learning: {...config.learning, activeLearning: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('active_learning') || 'Active Learning'}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.learning.autoRetrain}
                                        onChange={(e) => setConfig({...config, learning: {...config.learning, autoRetrain: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('auto_retrain') || 'Auto Retrain'}</label>
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('retrain_interval') || 'Retrain Interval'} (hours)</label>
                                    <input
                                        type="number"
                                        value={config.learning.retrainInterval}
                                        onChange={(e) => setConfig({...config, learning: {...config.learning, retrainInterval: parseInt(e.target.value) || 24}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('min_accuracy_retrain') || 'Min Accuracy for Retrain'} (%)</label>
                                    <input
                                        type="number"
                                        value={config.learning.minAccuracyForRetrain}
                                        onChange={(e) => setConfig({...config, learning: {...config.learning, minAccuracyForRetrain: parseInt(e.target.value) || 70}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                        min="0"
                                        max="100"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.learning.backtestBeforeRetrain}
                                        onChange={(e) => setConfig({...config, learning: {...config.learning, backtestBeforeRetrain: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('backtest_before_retrain') || 'Backtest Before Retrain'}</label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Security - REDIRECT TO SETTINGS */}
                    {activeTab === 'security' && (
                        <RedirectCard
                            title={t('security_moved') || 'Security Configuration Moved'}
                            description={t('security_moved_desc') || 'Security settings are now managed in Settings → Configuration → Security to provide a unified configuration experience.'}
                            settingsSubtab="security"
                            features={[
                                'Multi-Factor Authentication (MFA)',
                                'Command Logging',
                                'Data Encryption',
                                'Session Timeout (minutes)',
                                'Access Control Policies',
                            ]}
                            onNavigate={onNavigate}
                            isAdmin={isAdmin}
                            t={t}
                        />
                    )}

                    {/* Monitoring - REDIRECT TO SETTINGS */}
                    {activeTab === 'monitoring' && (
                        <RedirectCard
                            title={t('monitoring_moved') || 'Monitoring Configuration Moved'}
                            description={t('monitoring_moved_desc') || 'Monitoring settings are now managed in Settings → Configuration → Monitoring to provide a unified configuration experience.'}
                            settingsSubtab="monitoring"
                            features={[
                                'Health Check Interval (minutes)',
                                'Error Alerts',
                                'Alert Channels (Dashboard, Telegram, Email)',
                                'System Performance Metrics',
                                'Log Retention Policies',
                            ]}
                            onNavigate={onNavigate}
                            isAdmin={isAdmin}
                            t={t}
                        />
                    )}

                    {/* Integration - REDIRECT TO SETTINGS */}
                    {activeTab === 'integration' && (
                        <RedirectCard
                            title={t('integration_moved') || 'Integration Configuration Moved'}
                            description={t('integration_moved_desc') || 'Integration settings (MEXC, Telegram, API Keys) are now managed in Settings → Configuration → Integrations to provide a unified configuration experience.'}
                            settingsSubtab="integrations"
                            features={[
                                'MEXC Exchange Integration (API Keys, Testnet)',
                                'Telegram Bot Configuration (Token, Channels)',
                                'External API Management',
                                'Webhook Configuration',
                                'Third-Party Service Integration',
                            ]}
                            onNavigate={onNavigate}
                            isAdmin={isAdmin}
                            t={t}
                        />
                    )}

                    {/* Scheduler */}
                    {activeTab === 'scheduler' && (
                        <div className="space-y-6">
                            <SchedulerSettings t={t} />
                        </div>
                    )}

                    {/* UI */}
                    {activeTab === 'ui' && (
                        <div className="border border-border rounded-lg p-4">
                            <h4 className="font-semibold text-foreground mb-3">{t('ui_settings') || 'UI Settings'}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('language') || 'Language'}</label>
                                    <select
                                        value={config.ui.language}
                                        onChange={(e) => setConfig({...config, ui: {...config.ui, language: e.target.value as 'en' | 'fa'}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    >
                                        <option value="en">{t('english') || 'English'}</option>
                                        <option value="fa">{t('farsi') || 'Farsi'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('theme') || 'Theme'}</label>
                                    <select
                                        value={config.ui.theme}
                                        onChange={(e) => setConfig({...config, ui: {...config.ui, theme: e.target.value as 'dark' | 'light'}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    >
                                        <option value="dark">{t('dark') || 'Dark'}</option>
                                        <option value="light">{t('light') || 'Light'}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
                        <h3 className="font-semibold text-foreground mb-2">{t('reset_to_default') || 'Reset to Default'}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            {t('reset_confirm_message') || 'Are you sure you want to reset all settings to default values? This action cannot be undone.'}
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-semibold rounded-lg text-sm"
                            >
                                {t('cancel') || 'Cancel'}
                            </button>
                            <button
                                onClick={handleReset}
                                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg text-sm"
                            >
                                {t('reset') || 'Reset'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsTab;

