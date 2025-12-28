import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../../../../services/api.ts';
import { ArtemisConfig, ArtemisState } from '../../../../types.ts';
import SchedulerSettings from '../../SchedulerSettings.tsx';

type Props = {
    artemis: ArtemisState;
    t: (key: string) => string;
    onRefresh: () => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
};

type SettingsTabId = 'decision' | 'learning' | 'security' | 'monitoring' | 'integration' | 'ui' | 'scheduler';

const SettingsTab: React.FC<Props> = ({ artemis, t, onRefresh, Card }) => {
    if (!artemis) {
        return (
            <Card>
                <div className="text-center p-10">{t('loading') || 'Loading...'}</div>
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

    const [config, setConfig] = useState<ArtemisConfig>(artemis.config || getDefaultConfig());
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
                    {/* Decision Engine */}
                    {activeTab === 'decision' && (
                        <div className="border border-border rounded-lg p-4">
                            <h4 className="font-semibold text-foreground mb-3">{t('decision_engine_settings') || 'Decision Engine Settings'}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('strategy') || 'Strategy'}</label>
                                    <select
                                        value={config.decisionEngine.strategy}
                                        onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, strategy: e.target.value as any}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    >
                                        <option value="voting">{t('voting') || 'Voting'}</option>
                                        <option value="weighted">{t('weighted') || 'Weighted'}</option>
                                        <option value="mixture_of_experts">{t('mixture_of_experts') || 'Mixture of Experts'}</option>
                                        <option value="consensus">{t('consensus') || 'Consensus'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('active_model') || 'Active Model'}</label>
                                    <select
                                        value={config.decisionEngine.activeModel}
                                        onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, activeModel: e.target.value as any}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                    >
                                        <option value="internal">{t('internal') || 'Internal'}</option>
                                        <option value="claude">{t('claude') || 'Claude'}</option>
                                        <option value="gemini">{t('gemini') || 'Gemini'}</option>
                                        <option value="openai">{t('openai') || 'OpenAI'}</option>
                                        <option value="deepseek">{t('deepseek') || 'DeepSeek'}</option>
                                        <option value="openrouter">{t('openrouter') || 'OpenRouter'}</option>
                                        <option value="hybrid">{t('hybrid') || 'Hybrid'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('confidence_threshold') || 'Confidence Threshold'} (%)</label>
                                    <input
                                        type="number"
                                        value={config.decisionEngine.confidenceThreshold}
                                        onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, confidenceThreshold: parseInt(e.target.value) || 75}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                        min="0"
                                        max="100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('max_concurrent_trades') || 'Max Concurrent Trades'}</label>
                                    <input
                                        type="number"
                                        value={config.decisionEngine.maxConcurrentTrades}
                                        onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, maxConcurrentTrades: parseInt(e.target.value) || 5}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                        min="1"
                                        max="20"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.decisionEngine.autoExecution}
                                        onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, autoExecution: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('auto_execution') || 'Auto Execution'}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.decisionEngine.requireApproval}
                                        onChange={(e) => setConfig({...config, decisionEngine: {...config.decisionEngine, requireApproval: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('require_approval') || 'Require Approval'}</label>
                                </div>
                            </div>
                        </div>
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

                    {/* Security */}
                    {activeTab === 'security' && (
                        <div className="border border-border rounded-lg p-4">
                            <h4 className="font-semibold text-foreground mb-3">{t('security_settings') || 'Security Settings'}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.security.requireMFA}
                                        onChange={(e) => setConfig({...config, security: {...config.security, requireMFA: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('require_mfa') || 'Require Multi-Factor Authentication'}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.security.logAllCommands}
                                        onChange={(e) => setConfig({...config, security: {...config.security, logAllCommands: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('log_all_commands') || 'Log All Commands'}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.security.encryptSensitiveData}
                                        onChange={(e) => setConfig({...config, security: {...config.security, encryptSensitiveData: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('encrypt_sensitive_data') || 'Encrypt Sensitive Data'}</label>
                                </div>
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('session_timeout') || 'Session Timeout'} (minutes)</label>
                                    <input
                                        type="number"
                                        value={config.security.sessionTimeout}
                                        onChange={(e) => setConfig({...config, security: {...config.security, sessionTimeout: parseInt(e.target.value) || 30}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                        min="5"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Monitoring */}
                    {activeTab === 'monitoring' && (
                        <div className="border border-border rounded-lg p-4">
                            <h4 className="font-semibold text-foreground mb-3">{t('monitoring_settings') || 'Monitoring Settings'}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">{t('health_check_interval') || 'Health Check Interval'} (minutes)</label>
                                    <input
                                        type="number"
                                        value={config.monitoring.healthCheckInterval}
                                        onChange={(e) => setConfig({...config, monitoring: {...config.monitoring, healthCheckInterval: parseInt(e.target.value) || 5}})}
                                        className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                        min="1"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.monitoring.alertOnError}
                                        onChange={(e) => setConfig({...config, monitoring: {...config.monitoring, alertOnError: e.target.checked}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('alert_on_error') || 'Alert on Error'}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.monitoring.alertChannels.dashboard}
                                        onChange={(e) => setConfig({...config, monitoring: {...config.monitoring, alertChannels: {...config.monitoring.alertChannels, dashboard: e.target.checked}}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('dashboard_alerts') || 'Dashboard Alerts'}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.monitoring.alertChannels.telegram}
                                        onChange={(e) => setConfig({...config, monitoring: {...config.monitoring, alertChannels: {...config.monitoring.alertChannels, telegram: e.target.checked}}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('telegram_alerts') || 'Telegram Alerts'}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.monitoring.alertChannels.email}
                                        onChange={(e) => setConfig({...config, monitoring: {...config.monitoring, alertChannels: {...config.monitoring.alertChannels, email: e.target.checked}}})}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-foreground">{t('email_alerts') || 'Email Alerts'}</label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Integration */}
                    {activeTab === 'integration' && (
                        <div className="space-y-4">
                            {/* MEXC */}
                            <div className="border border-border rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-3">{t('mexc_integration') || 'MEXC Integration'}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={config.integration.mexc.enabled}
                                            onChange={(e) => setConfig({...config, integration: {...config.integration, mexc: {...config.integration.mexc, enabled: e.target.checked}}})}
                                            className="w-4 h-4"
                                        />
                                        <label className="text-sm text-foreground">{t('enable_mexc') || 'Enable MEXC'}</label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={config.integration.mexc.testnet}
                                            onChange={(e) => setConfig({...config, integration: {...config.integration, mexc: {...config.integration.mexc, testnet: e.target.checked}}})}
                                            className="w-4 h-4"
                                        />
                                        <label className="text-sm text-foreground">{t('use_testnet') || 'Use Testnet'}</label>
                                    </div>
                                    {config.integration.mexc.apiKey && (
                                        <div>
                                            <label className="block text-sm text-muted-foreground mb-1">{t('api_key') || 'API Key'}</label>
                                            <input
                                                type="password"
                                                value={config.integration.mexc.apiKey}
                                                onChange={(e) => setConfig({...config, integration: {...config.integration, mexc: {...config.integration.mexc, apiKey: e.target.value}}})}
                                                className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                                placeholder={t('api_key_placeholder') || 'Enter API key'}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Telegram */}
                            <div className="border border-border rounded-lg p-4">
                                <h4 className="font-semibold text-foreground mb-3">{t('telegram_integration') || 'Telegram Integration'}</h4>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={config.integration.telegram.enabled}
                                            onChange={(e) => setConfig({...config, integration: {...config.integration, telegram: {...config.integration.telegram, enabled: e.target.checked}}})}
                                            className="w-4 h-4"
                                        />
                                        <label className="text-sm text-foreground">{t('enable_telegram') || 'Enable Telegram'}</label>
                                    </div>
                                    {config.integration.telegram.enabled && (
                                        <>
                                            <div>
                                                <label className="block text-sm text-muted-foreground mb-1">{t('bot_token') || 'Bot Token'}</label>
                                                <input
                                                    type="password"
                                                    value={newTelegramBotToken || config.integration.telegram.botToken || ''}
                                                    onChange={(e) => {
                                                        setNewTelegramBotToken(e.target.value);
                                                        setConfig({...config, integration: {...config.integration, telegram: {...config.integration.telegram, botToken: e.target.value}}});
                                                    }}
                                                    className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                                                    placeholder={t('bot_token_placeholder') || 'Enter bot token'}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-muted-foreground mb-1">{t('channels') || 'Channels'}</label>
                                                <div className="flex gap-2 mb-2">
                                                    <input
                                                        type="text"
                                                        value={newTelegramChannel}
                                                        onChange={(e) => setNewTelegramChannel(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && addTelegramChannel()}
                                                        className="flex-1 p-2 bg-secondary border border-border rounded text-foreground"
                                                        placeholder={t('channel_placeholder') || 'Enter channel ID or username'}
                                                    />
                                                    <button
                                                        onClick={addTelegramChannel}
                                                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                                                    >
                                                        {t('add') || 'Add'}
                                                    </button>
                                                </div>
                                                {config.integration.telegram.channels && config.integration.telegram.channels.length > 0 && (
                                                    <div className="space-y-2">
                                                        {config.integration.telegram.channels.map(channel => (
                                                            <div key={channel} className="flex items-center justify-between p-2 bg-secondary rounded">
                                                                <span className="text-sm text-foreground">{channel}</span>
                                                                <button
                                                                    onClick={() => removeTelegramChannel(channel)}
                                                                    className="text-red-400 hover:text-red-300 text-sm"
                                                                >
                                                                    {t('remove') || 'Remove'}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
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

