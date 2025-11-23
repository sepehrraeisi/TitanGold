import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AIAPIConfigData, APIServiceIntegration, ArtemisConfig, AITrainingConfig } from '../../types.ts';
import { testGeminiConnection } from '../../services/geminiService.ts';
import { testClaudeConnection } from '../../services/claudeService.ts';
import { testOpenAIConnection } from '../../services/openaiService.ts';
import { testDeepSeekConnection } from '../../services/deepseekService.ts';

type ConfigTab = 'apis' | 'artemis' | 'training' | 'agents';

interface APIKeyState {
    [key: string]: {
        apiKey: string;
        apiSecret?: string;
        isEditing: boolean;
        isSaving: boolean;
    };
}

const APIConfig: React.FC = () => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<ConfigTab>('apis');
    const [isLoading, setIsLoading] = useState(true);
    const [apiConfig, setApiConfig] = useState<AIAPIConfigData | null>(null);
    const [artemisConfig, setArtemisConfig] = useState<ArtemisConfig | null>(null);
    const [trainingConfig, setTrainingConfig] = useState<AITrainingConfig | null>(null);
    const [testingService, setTestingService] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [apiKeys, setApiKeys] = useState<APIKeyState>({});

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [apiData, artemisState, trainingData] = await Promise.all([
                    api.fetchAPIConfigData(),
                    api.fetchArtemisState(),
                    api.fetchTrainingData(),
                ]);
                setApiConfig(apiData);
                setArtemisConfig(artemisState.config);
                setTrainingConfig(trainingData.config || null);
                
                // Load API keys from localStorage/database
                await loadAPIKeys();
            } catch (e) {
                console.error('Failed to load configuration:', e);
            } finally {
            setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const loadAPIKeys = async () => {
        try {
            // Load from localStorage (temporary - should be in IndexedDB)
            const savedKeys: APIKeyState = {};
            const allServices = [
                ...(apiConfig?.aiServices || []),
                ...(apiConfig?.exchangeServices || []),
                ...(apiConfig?.communicationServices || []),
                ...(apiConfig?.marketDataServices || []),
            ];
            
            // Special handling for Telegram Bot - load from Notification Settings
            try {
                const notificationSettings = await api.fetchNotificationSettings();
                if (notificationSettings?.telegram?.botToken) {
                    savedKeys['com-telegram'] = {
                        apiKey: notificationSettings.telegram.botToken,
                        apiSecret: '',
                        isEditing: false,
                        isSaving: false,
                    };
                }
            } catch (e) {
                console.warn('Failed to load Telegram bot token from notification settings:', e);
            }
            
            allServices.forEach(service => {
                // Skip Telegram Bot if already loaded from notification settings
                if (service.id === 'com-telegram' && savedKeys['com-telegram']) {
            return;
        }
                
                const stored = localStorage.getItem(`api_key_${service.id}`);
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        savedKeys[service.id] = {
                            apiKey: parsed.apiKey || '',
                            apiSecret: parsed.apiSecret || '',
                            isEditing: false,
                            isSaving: false,
                        };
                    } catch (e) {
                        console.warn(`Failed to parse stored key for ${service.id}:`, e);
                    }
                }
            });
            
            setApiKeys(savedKeys);
        } catch (e) {
            console.error('Failed to load API keys:', e);
        }
    };

    const handleTest = async (serviceId: string) => {
        if (testingService) return;

        try {
            setTestingService(serviceId);
            
            // Get API key for this service
            const keyData = apiKeys[serviceId];
            if (!keyData || !keyData.apiKey) {
                throw new Error('API key not configured');
            }

            // Test based on service type
            let result: { success: boolean; latency?: number; error?: string } = { success: false };
            
            // Test based on service type
            // Store API key temporarily in localStorage for test functions to read
            if (serviceId === 'ai-gemini') {
                localStorage.setItem('temp_gemini_key', keyData.apiKey);
                try {
                    result = await testGeminiConnection();
                } finally {
                    localStorage.removeItem('temp_gemini_key');
                }
            } else if (serviceId === 'ai-claude') {
                localStorage.setItem('temp_claude_key', keyData.apiKey);
                try {
                    result = await testClaudeConnection();
                } finally {
                    localStorage.removeItem('temp_claude_key');
                }
            } else if (serviceId === 'ai-openai') {
                localStorage.setItem('temp_openai_key', keyData.apiKey);
                try {
                    result = await testOpenAIConnection();
                } finally {
                    localStorage.removeItem('temp_openai_key');
                }
            } else if (serviceId === 'ai-deepseek') {
                console.log('Testing DeepSeek with API key:', keyData.apiKey ? `${keyData.apiKey.substring(0, 10)}...` : 'NOT SET');
                localStorage.setItem('temp_deepseek_key', keyData.apiKey);
                try {
                    result = await testDeepSeekConnection();
                    console.log('DeepSeek test result:', result);
                } catch (testError: any) {
                    console.error('DeepSeek test error:', testError);
                    result = { success: false, error: testError.message || 'Test failed' };
                } finally {
                    localStorage.removeItem('temp_deepseek_key');
                }
            } else {
                // For other services, use generic test
            await api.testAIIntegration(serviceId);
                result = { success: true };
            }

            if (result.success) {
                // Update service status
            const updated = await api.fetchAPIConfigData();
                setApiConfig(updated);
                alert(t('connection_test_success') || `Connection test successful! Latency: ${result.latency || 0}ms`);
            } else {
                throw new Error(result.error || 'Connection test failed');
            }
        } catch (e: any) {
            console.error('Failed to test service:', e);
            const errorMessage = e.message || result?.error || 'Connection test failed';
            alert(t('connection_test_failed') || `Connection test failed: ${errorMessage}`);
        } finally {
            setTestingService(null);
        }
    };

    const handleSaveAPIKey = async (serviceId: string) => {
        const keyData = apiKeys[serviceId];
        if (!keyData || !keyData.apiKey.trim()) {
            alert(t('api_key_required') || 'API Key is required');
            return;
        }

        try {
            setApiKeys(prev => ({
                ...prev,
                [serviceId]: { ...prev[serviceId], isSaving: true },
            }));

            // Special handling for Telegram Bot - save to Notification Settings
            if (serviceId === 'com-telegram') {
                try {
                    const notificationSettings = await api.fetchNotificationSettings();
                    notificationSettings.telegram.botToken = keyData.apiKey;
                    await api.saveNotificationSettings(notificationSettings);
                } catch (e) {
                    console.error('Failed to save Telegram bot token to notification settings:', e);
                }
            }

            // Special handling for Telegram Bot - save to Notification Settings
            if (serviceId === 'com-telegram') {
                try {
                    const notificationSettings = await api.fetchNotificationSettings();
                    notificationSettings.telegram.botToken = keyData.apiKey;
                    await api.saveNotificationSettings(notificationSettings);
                } catch (e) {
                    console.error('Failed to save Telegram bot token to notification settings:', e);
                }
            }

            // Save to localStorage (temporary - should be in IndexedDB with encryption)
            localStorage.setItem(`api_key_${serviceId}`, JSON.stringify({
                apiKey: keyData.apiKey,
                apiSecret: keyData.apiSecret || '',
            }));

            // Update environment variable (for current session)
            if (serviceId === 'ai-gemini') {
                process.env.GEMINI_API_KEY = keyData.apiKey;
            } else if (serviceId === 'ai-claude') {
                process.env.CLAUDE_API_KEY = keyData.apiKey;
            } else if (serviceId === 'ai-openai') {
                process.env.OPENAI_API_KEY = keyData.apiKey;
            } else if (serviceId === 'ai-deepseek') {
                process.env.DEEPSEEK_API_KEY = keyData.apiKey;
            }

            // Update API config
            const updated = await api.fetchAPIConfigData();
            setApiConfig(updated);

            setApiKeys(prev => ({
                ...prev,
                [serviceId]: {
                    ...prev[serviceId],
                    isEditing: false,
                    isSaving: false,
                },
            }));

            alert(t('api_key_saved') || 'API Key saved successfully!');
        } catch (e) {
            console.error('Failed to save API key:', e);
            alert(t('api_key_save_failed') || 'Failed to save API key');
        } finally {
            setApiKeys(prev => ({
                ...prev,
                [serviceId]: { ...prev[serviceId], isSaving: false },
            }));
        }
    };

    const handleEditAPIKey = (serviceId: string) => {
        setApiKeys(prev => ({
            ...prev,
            [serviceId]: {
                ...prev[serviceId] || { apiKey: '', apiSecret: '', isEditing: false, isSaving: false },
                isEditing: true,
            },
        }));
    };

    const handleCancelEdit = (serviceId: string) => {
        setApiKeys(prev => ({
            ...prev,
            [serviceId]: {
                ...prev[serviceId],
                isEditing: false,
            },
        }));
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        setSaveStatus('saving');
        try {
            // Save API Config
            if (apiConfig) {
                // API config is saved automatically on test
            }
            // Save Artemis Config
            if (artemisConfig) {
                await api.updateArtemisConfig({ config: artemisConfig });
            }
            // Save Training Config
            if (trainingConfig) {
                await api.updateTrainingConfig(trainingConfig);
            }
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e) {
            console.error('Failed to save configuration:', e);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin text-4xl mb-2">⚙️</div>
                    <p className="text-muted-foreground">{t('loading')}</p>
                </div>
            </div>
        );
    }

    const tabs: { id: ConfigTab; label: string; icon: string }[] = [
        { id: 'apis', label: t('api_integrations') || 'API Integrations', icon: '🔌' },
        { id: 'artemis', label: t('artemis_settings') || 'Artemis Settings', icon: '🤖' },
        { id: 'training', label: t('training_config') || 'Training Config', icon: '📚' },
        { id: 'agents', label: t('agent_settings') || 'Agent Settings', icon: '👥' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">{t('configuration') || 'Configuration'}</h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            {t('configuration_desc') || 'Manage Artemis-specific settings, AI integrations, and training configurations'}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleSaveAll}
                            disabled={isSaving}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                saveStatus === 'success'
                                    ? 'bg-green-600 text-white'
                                    : saveStatus === 'error'
                                    ? 'bg-red-600 text-white'
                                    : isSaving
                                    ? 'bg-gray-600 text-white cursor-wait'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }`}
                        >
                            {saveStatus === 'saving'
                                ? t('saving') || 'Saving...'
                                : saveStatus === 'success'
                                ? t('saved') || 'Saved!'
                                : saveStatus === 'error'
                                ? t('error') || 'Error'
                                : t('save_all_settings') || 'Save All Settings'}
                        </button>
                        <button
                            onClick={async () => {
                                setIsLoading(true);
                                try {
                                    const [apiData, artemisState, trainingData] = await Promise.all([
                                        api.fetchAPIConfigData(),
                                        api.fetchArtemisState(),
                                        api.fetchTrainingData(),
                                    ]);
                                    setApiConfig(apiData);
                                    setArtemisConfig(artemisState.config);
                                    setTrainingConfig(trainingData.config || null);
                                    await loadAPIKeys();
                                } finally {
                                    setIsLoading(false);
                                }
                            }}
                            className="px-4 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded-lg text-sm font-semibold transition-colors"
                        >
                            {t('refresh') || 'Refresh'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-card border border-border rounded-lg">
                <div className="border-b border-border">
                    <nav className="flex space-x-1 overflow-x-auto p-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap px-4 py-3 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                                    activeTab === tab.id
                                        ? 'bg-purple-600 text-white'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                                }`}
                            >
                                <span>{tab.icon}</span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {activeTab === 'apis' && apiConfig && (
                        <APIConfigTab
                            config={apiConfig}
                            onTest={handleTest}
                            testingService={testingService}
                            apiKeys={apiKeys}
                            onEdit={handleEditAPIKey}
                            onSave={handleSaveAPIKey}
                            onCancel={handleCancelEdit}
                            onKeyChange={(serviceId, field, value) => {
                                setApiKeys(prev => ({
                                    ...prev,
                                    [serviceId]: {
                                        ...prev[serviceId] || { apiKey: '', apiSecret: '', isEditing: false, isSaving: false },
                                        [field]: value,
                                    },
                                }));
                            }}
                        />
                    )}
                    {activeTab === 'artemis' && artemisConfig && (
                        <ArtemisConfigTab
                            config={artemisConfig}
                            onUpdate={setArtemisConfig}
                            t={t}
                        />
                    )}
                    {activeTab === 'training' && trainingConfig && (
                        <TrainingConfigTab
                            config={trainingConfig}
                            onUpdate={setTrainingConfig}
                            t={t}
                        />
                    )}
                    {activeTab === 'agents' && (
                        <AgentsConfigTab t={t} />
                    )}
                </div>
            </div>
        </div>
    );
};

// API Config Tab with full API Key management
const APIConfigTab: React.FC<{
    config: AIAPIConfigData;
    onTest: (id: string) => void;
    testingService: string | null;
    apiKeys: APIKeyState;
    onEdit: (id: string) => void;
    onSave: (id: string) => void;
    onCancel: (id: string) => void;
    onKeyChange: (serviceId: string, field: 'apiKey' | 'apiSecret', value: string) => void;
}> = ({ config, onTest, testingService, apiKeys, onEdit, onSave, onCancel, onKeyChange }) => {
    const { t } = useLanguage();
    return (
        <div className="space-y-8">
            <Card title={t('ai_services') || 'AI Services'}>
                <IntegrationGrid
                    services={config.aiServices}
                    onTest={onTest}
                    testingService={testingService}
                    apiKeys={apiKeys}
                    onEdit={onEdit}
                    onSave={onSave}
                    onCancel={onCancel}
                    onKeyChange={onKeyChange}
                />
            </Card>
            <Card title={t('artemis_data_integrations') || 'Artemis Data Integrations'}>
                <p className="text-sm text-muted-foreground mb-4">
                    {t('artemis_data_integrations_desc') || 'Configure data sources and integrations specifically for Artemis AI system. For general exchange connections, use Settings > Connections.'}
                </p>
                <IntegrationGrid
                    services={config.communicationServices}
                    onTest={onTest}
                    testingService={testingService}
                    apiKeys={apiKeys}
                    onEdit={onEdit}
                    onSave={onSave}
                    onCancel={onCancel}
                    onKeyChange={onKeyChange}
                />
            </Card>
            <Card title={t('communications_and_alerts') || 'Communications & Alerts'}>
                <IntegrationGrid
                    services={config.communicationServices}
                    onTest={onTest}
                    testingService={testingService}
                    apiKeys={apiKeys}
                    onEdit={onEdit}
                    onSave={onSave}
                    onCancel={onCancel}
                    onKeyChange={onKeyChange}
                />
            </Card>
            <Card title={t('market_data_and_analysis') || 'Market Data & Analysis'}>
                <IntegrationGrid
                    services={config.marketDataServices}
                    onTest={onTest}
                    testingService={testingService}
                    apiKeys={apiKeys}
                    onEdit={onEdit}
                    onSave={onSave}
                    onCancel={onCancel}
                    onKeyChange={onKeyChange}
                />
            </Card>
            <div className="flex justify-end">
                <p className="text-xs text-muted-foreground">
                    {t('last_update')}: {new Date(config.lastUpdated).toLocaleString()}
                </p>
            </div>
        </div>
    );
};

// Artemis Config Tab (unchanged)
const ArtemisConfigTab: React.FC<{
    config: ArtemisConfig;
    onUpdate: (config: ArtemisConfig) => void;
    t: (key: string) => string;
}> = ({ config, onUpdate, t }) => {
    const updateConfig = (updates: Partial<ArtemisConfig>) => {
        onUpdate({ ...config, ...updates });
    };

    return (
        <div className="space-y-6">
            {/* Decision Engine */}
            <ConfigSection title={t('decision_engine') || 'Decision Engine'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                            {t('strategy') || 'Strategy'}
                        </label>
                        <select
                            value={config.decisionEngine.strategy}
                            onChange={(e) => updateConfig({
                                decisionEngine: {
                                    ...config.decisionEngine,
                                    strategy: e.target.value as any,
                                },
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        >
                            <option value="voting">{t('voting') || 'Voting'}</option>
                            <option value="weighted">{t('weighted') || 'Weighted'}</option>
                            <option value="mixture_of_experts">{t('mixture_of_experts') || 'Mixture of Experts'}</option>
                            <option value="consensus">{t('consensus') || 'Consensus'}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                            {t('active_model') || 'Active Model'}
                        </label>
                        <select
                            value={config.decisionEngine.activeModel}
                            onChange={(e) => updateConfig({
                                decisionEngine: {
                                    ...config.decisionEngine,
                                    activeModel: e.target.value as any,
                                },
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        >
                            <option value="internal">{t('internal') || 'Internal'}</option>
                            <option value="claude">{t('claude') || 'Claude'}</option>
                            <option value="gemini">{t('gemini') || 'Gemini'}</option>
                            <option value="openai">{t('openai') || 'OpenAI'}</option>
                            <option value="deepseek">{t('deepseek') || 'DeepSeek'}</option>
                            <option value="hybrid">{t('hybrid') || 'Hybrid'}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                            {t('confidence_threshold') || 'Confidence Threshold'} ({config.decisionEngine.confidenceThreshold}%)
                        </label>
                        <input
                            type="range"
                            min="50"
                            max="100"
                            value={config.decisionEngine.confidenceThreshold}
                            onChange={(e) => updateConfig({
                                decisionEngine: {
                                    ...config.decisionEngine,
                                    confidenceThreshold: parseInt(e.target.value),
                                },
                            })}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                            {t('max_concurrent_trades') || 'Max Concurrent Trades'}
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            value={config.decisionEngine.maxConcurrentTrades}
                            onChange={(e) => updateConfig({
                                decisionEngine: {
                                    ...config.decisionEngine,
                                    maxConcurrentTrades: parseInt(e.target.value) || 5,
                                },
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={config.decisionEngine.autoExecution}
                            onChange={(e) => updateConfig({
                                decisionEngine: {
                                    ...config.decisionEngine,
                                    autoExecution: e.target.checked,
                                },
                            })}
                            className="w-4 h-4"
                        />
                        <label className="text-sm text-foreground">{t('auto_execution') || 'Auto Execution'}</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={config.decisionEngine.requireApproval}
                            onChange={(e) => updateConfig({
                                decisionEngine: {
                                    ...config.decisionEngine,
                                    requireApproval: e.target.checked,
                                },
                            })}
                            className="w-4 h-4"
                        />
                        <label className="text-sm text-foreground">{t('require_approval') || 'Require Approval'}</label>
                    </div>
                </div>
            </ConfigSection>

            {/* Learning */}
            <ConfigSection title={t('learning_system') || 'Learning System'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={config.learning.activeLearning}
                            onChange={(e) => updateConfig({
                                learning: { ...config.learning, activeLearning: e.target.checked },
                            })}
                            className="w-4 h-4"
                        />
                        <label className="text-sm text-foreground">{t('active_learning') || 'Active Learning'}</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={config.learning.autoRetrain}
                            onChange={(e) => updateConfig({
                                learning: { ...config.learning, autoRetrain: e.target.checked },
                            })}
                            className="w-4 h-4"
                        />
                        <label className="text-sm text-foreground">{t('auto_retrain') || 'Auto Retrain'}</label>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                            {t('retrain_interval') || 'Retrain Interval'} (hours)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="168"
                            value={config.learning.retrainInterval}
                            onChange={(e) => updateConfig({
                                learning: { ...config.learning, retrainInterval: parseInt(e.target.value) || 24 },
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                            {t('min_accuracy_for_retrain') || 'Min Accuracy for Retrain'} (%)
                        </label>
                        <input
                            type="number"
                            min="50"
                            max="100"
                            value={config.learning.minAccuracyForRetrain}
                            onChange={(e) => updateConfig({
                                learning: { ...config.learning, minAccuracyForRetrain: parseInt(e.target.value) || 70 },
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={config.learning.backtestBeforeRetrain}
                            onChange={(e) => updateConfig({
                                learning: { ...config.learning, backtestBeforeRetrain: e.target.checked },
                            })}
                            className="w-4 h-4"
                        />
                        <label className="text-sm text-foreground">{t('backtest_before_retrain') || 'Backtest Before Retrain'}</label>
                    </div>
                </div>
            </ConfigSection>

            {/* Monitoring */}
            <ConfigSection title={t('monitoring') || 'Monitoring'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                            {t('health_check_interval') || 'Health Check Interval'} (minutes)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="60"
                            value={config.monitoring.healthCheckInterval}
                            onChange={(e) => updateConfig({
                                monitoring: { ...config.monitoring, healthCheckInterval: parseInt(e.target.value) || 5 },
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={config.monitoring.alertOnError}
                            onChange={(e) => updateConfig({
                                monitoring: { ...config.monitoring, alertOnError: e.target.checked },
                            })}
                            className="w-4 h-4"
                        />
                        <label className="text-sm text-foreground">{t('alert_on_error') || 'Alert on Error'}</label>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-semibold text-foreground mb-2">
                            {t('alert_channels') || 'Alert Channels'}
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.monitoring.alertChannels.dashboard}
                                    onChange={(e) => updateConfig({
                                        monitoring: {
                                            ...config.monitoring,
                                            alertChannels: {
                                                ...config.monitoring.alertChannels,
                                                dashboard: e.target.checked,
                                            },
                                        },
                                    })}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm text-foreground">{t('dashboard') || 'Dashboard'}</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.monitoring.alertChannels.telegram}
                                    onChange={(e) => updateConfig({
                                        monitoring: {
                                            ...config.monitoring,
                                            alertChannels: {
                                                ...config.monitoring.alertChannels,
                                                telegram: e.target.checked,
                                            },
                                        },
                                    })}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm text-foreground">{t('telegram') || 'Telegram'}</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.monitoring.alertChannels.email}
                                    onChange={(e) => updateConfig({
                                        monitoring: {
                                            ...config.monitoring,
                                            alertChannels: {
                                                ...config.monitoring.alertChannels,
                                                email: e.target.checked,
                                            },
                                        },
                                    })}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm text-foreground">{t('email') || 'Email'}</span>
                            </label>
                        </div>
                    </div>
                </div>
            </ConfigSection>

            {/* Security */}
            <ConfigSection title={t('security') || 'Security'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={config.security.requireMFA}
                            onChange={(e) => updateConfig({
                                security: { ...config.security, requireMFA: e.target.checked },
                            })}
                            className="w-4 h-4"
                        />
                        <label className="text-sm text-foreground">{t('require_mfa') || 'Require MFA'}</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={config.security.logAllCommands}
                            onChange={(e) => updateConfig({
                                security: { ...config.security, logAllCommands: e.target.checked },
                            })}
                            className="w-4 h-4"
                        />
                        <label className="text-sm text-foreground">{t('log_all_commands') || 'Log All Commands'}</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={config.security.encryptSensitiveData}
                            onChange={(e) => updateConfig({
                                security: { ...config.security, encryptSensitiveData: e.target.checked },
                            })}
                            className="w-4 h-4"
                        />
                        <label className="text-sm text-foreground">{t('encrypt_sensitive_data') || 'Encrypt Sensitive Data'}</label>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                            {t('session_timeout') || 'Session Timeout'} (minutes)
                        </label>
                        <input
                            type="number"
                            min="5"
                            max="480"
                            value={config.security.sessionTimeout}
                            onChange={(e) => updateConfig({
                                security: { ...config.security, sessionTimeout: parseInt(e.target.value) || 30 },
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        />
                    </div>
                </div>
            </ConfigSection>

            {/* Integration */}
            <ConfigSection title={t('integration') || 'Integration'}>
                <div className="space-y-4">
                    <div className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold text-foreground mb-3">{t('mexc_exchange') || 'MEXC Exchange'}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.integration.mexc.enabled}
                                    onChange={(e) => updateConfig({
                                        integration: {
                                            ...config.integration,
                                            mexc: { ...config.integration.mexc, enabled: e.target.checked },
                                        },
                                    })}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm text-foreground">{t('enabled') || 'Enabled'}</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.integration.mexc.testnet}
                                    onChange={(e) => updateConfig({
                                        integration: {
                                            ...config.integration,
                                            mexc: { ...config.integration.mexc, testnet: e.target.checked },
                                        },
                                    })}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm text-foreground">{t('testnet') || 'Testnet'}</label>
                            </div>
                        </div>
                    </div>
                    <div className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold text-foreground mb-3">{t('telegram') || 'Telegram'}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.integration.telegram.enabled}
                                    onChange={(e) => updateConfig({
                                        integration: {
                                            ...config.integration,
                                            telegram: { ...config.integration.telegram, enabled: e.target.checked },
                                        },
                                    })}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm text-foreground">{t('enabled') || 'Enabled'}</label>
                            </div>
                        </div>
                    </div>
                </div>
            </ConfigSection>

            {/* UI - Removed Language and Theme (should be in Settings > Appearance) */}
        </div>
    );
};

// Training Config Tab (simplified)
const TrainingConfigTab: React.FC<{
    config: AITrainingConfig;
    onUpdate: (config: AITrainingConfig) => void;
    t: (key: string) => string;
}> = ({ config, onUpdate, t }) => {
    return (
        <div className="space-y-6">
            <ConfigSection title={t('auto_training') || 'Auto Training'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={config.autoTraining.enabled}
                            onChange={(e) => onUpdate({
                                ...config,
                                autoTraining: { ...config.autoTraining, enabled: e.target.checked },
                            })}
                            className="w-4 h-4"
                        />
                        <label className="text-sm text-foreground">{t('enable_auto_training') || 'Enable Auto Training'}</label>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                            {t('min_accuracy_threshold') || 'Min Accuracy Threshold'} (%)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={config.autoTraining.minAccuracyThreshold}
                            onChange={(e) => onUpdate({
                                ...config,
                                autoTraining: { ...config.autoTraining, minAccuracyThreshold: parseFloat(e.target.value) || 75 },
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                            {t('schedule_interval') || 'Schedule Interval'} (hours)
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={config.autoTraining.scheduleInterval}
                            onChange={(e) => onUpdate({
                                ...config,
                                autoTraining: { ...config.autoTraining, scheduleInterval: parseInt(e.target.value) || 24 },
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        />
                    </div>
                </div>
            </ConfigSection>

            <ConfigSection title={t('resource_management') || 'Resource Management'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                            {t('max_concurrent_sessions') || 'Max Concurrent Sessions'}
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={config.resourceManagement.maxConcurrentSessions}
                            onChange={(e) => onUpdate({
                                ...config,
                                resourceManagement: {
                                    ...config.resourceManagement,
                                    maxConcurrentSessions: parseInt(e.target.value) || 3,
                                },
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                            {t('max_queue_size') || 'Max Queue Size'}
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="50"
                            value={config.resourceManagement.maxQueueSize}
                            onChange={(e) => onUpdate({
                                ...config,
                                resourceManagement: {
                                    ...config.resourceManagement,
                                    maxQueueSize: parseInt(e.target.value) || 10,
                                },
                            })}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground"
                        />
                    </div>
                </div>
            </ConfigSection>
        </div>
    );
};

// System Config Tab - REMOVED: Language and Theme should be in Settings > Appearance

// Agents Config Tab
const AgentsConfigTab: React.FC<{ t: (key: string) => string }> = ({ t }) => {
    return (
        <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
                <p className="text-muted-foreground">
                    {t('agent_config_desc') || 'Individual agent configurations are managed in the Agents tab. Use this section for system-wide agent settings.'}
                </p>
            </div>
        </div>
    );
};

// Helper Components
const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-semibold text-lg text-foreground mb-5">{title}</h3>
        {children}
    </div>
);

const ConfigSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="border border-border rounded-lg p-6 bg-background/40">
        <h4 className="font-semibold text-lg text-foreground mb-4">{title}</h4>
        {children}
    </div>
);

const IntegrationGrid: React.FC<{
    services: APIServiceIntegration[];
    onTest: (id: string) => void;
    testingService: string | null;
    apiKeys: APIKeyState;
    onEdit: (id: string) => void;
    onSave: (id: string) => void;
    onCancel: (id: string) => void;
    onKeyChange: (serviceId: string, field: 'apiKey' | 'apiSecret', value: string) => void;
}> = ({ services, onTest, testingService, apiKeys, onEdit, onSave, onCancel, onKeyChange }) => {
    const { t } = useLanguage();
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map(service => (
                <APIInputGroup
                    key={service.id}
                    integration={service}
                    onTest={onTest}
                    disabled={testingService !== null && testingService !== service.id}
                    isTesting={testingService === service.id}
                    apiKeyData={apiKeys[service.id]}
                    onEdit={() => onEdit(service.id)}
                    onSave={() => onSave(service.id)}
                    onCancel={() => onCancel(service.id)}
                    onKeyChange={(field, value) => onKeyChange(service.id, field, value)}
                />
            ))}
            {services.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground text-center py-6">
                    {t('no_integrations_configured') || 'No integrations configured'}
                </p>
            )}
        </div>
    );
};

const APIInputGroup: React.FC<{
    integration: APIServiceIntegration;
    onTest: (id: string) => void;
    disabled?: boolean;
    isTesting?: boolean;
    apiKeyData?: APIKeyState[string];
    onEdit: () => void;
    onSave: () => void;
    onCancel: () => void;
    onKeyChange: (field: 'apiKey' | 'apiSecret', value: string) => void;
}> = ({ integration, onTest, disabled, isTesting, apiKeyData, onEdit, onSave, onCancel, onKeyChange }) => {
    const { t } = useLanguage();
    const statusClass = integration.connected ? 'text-green-400' : 'text-yellow-400';
    const isEditing = apiKeyData?.isEditing || false;
    const hasKey = apiKeyData?.apiKey || false;

    // Mask API key for display
    const maskKey = (key: string): string => {
        if (!key || key.length < 8) return '••••••••';
        return `${key.substring(0, 4)}${'•'.repeat(key.length - 8)}${key.substring(key.length - 4)}`;
    };

    return (
        <div className="space-y-4 border border-border rounded-lg p-4 bg-background/40 hover:border-purple-500/50 transition-all">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-semibold text-card-foreground">{integration.name}</h4>
                    <p className={`text-xs font-semibold ${statusClass}`}>
                        {integration.connected ? t('connected') : t('disconnected')}
                    </p>
                </div>
                {integration.lastTestedAt && (
                    <span className="text-[10px] text-muted-foreground">
                        {t('last_tested')}: {new Date(integration.lastTestedAt).toLocaleString()}
                    </span>
                )}
            </div>

            {isEditing ? (
                <div className="space-y-3">
                <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">
                            {integration.id === 'com-telegram' 
                                ? (t('telegram_bot_token') || 'Telegram Bot Token') 
                                : (t('api_key') || 'API Key')} *
                        </label>
                        <input
                            type="password"
                            value={apiKeyData?.apiKey || ''}
                            onChange={(e) => onKeyChange('apiKey', e.target.value)}
                            placeholder={integration.id === 'com-telegram' 
                                ? (t('enter_telegram_bot_token') || 'Enter Bot Token (from @BotFather)') 
                                : (t('enter_api_key') || 'Enter API Key')}
                            className="w-full p-2 bg-secondary border border-border rounded text-foreground text-sm"
                            autoFocus
                        />
                        {integration.id === 'com-telegram' && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {t('telegram_bot_token_hint') || 'Get your bot token from @BotFather on Telegram'}
                            </p>
                        )}
                </div>
                {integration.hasSecret && (
                    <div>
                            <label className="block text-xs font-semibold text-foreground mb-1">
                                {t('secret_key') || 'Secret Key'}
                            </label>
                            <input
                                type="password"
                                value={apiKeyData?.apiSecret || ''}
                                onChange={(e) => onKeyChange('apiSecret', e.target.value)}
                                placeholder={t('enter_secret_key') || 'Enter Secret Key'}
                                className="w-full p-2 bg-secondary border border-border rounded text-foreground text-sm"
                            />
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={onSave}
                            disabled={apiKeyData?.isSaving}
                            className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded text-sm font-semibold transition-colors"
                        >
                            {apiKeyData?.isSaving ? t('saving') || 'Saving...' : t('save') || 'Save'}
                        </button>
                        <button
                            onClick={onCancel}
                            className="px-3 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded text-sm font-semibold transition-colors"
                        >
                            {t('cancel') || 'Cancel'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                            {t('api_key') || 'API Key'}
                        </label>
                        {hasKey ? (
                            <p className="text-sm text-foreground font-mono bg-secondary/50 p-2 rounded">
                                {maskKey(apiKeyData!.apiKey)}
                            </p>
                        ) : (
                            <p className="text-xs text-yellow-400 italic">
                                {t('api_key_not_configured') || 'API Key not configured'}
                            </p>
                        )}
                    </div>
                    {integration.hasSecret && hasKey && (
                        <div>
                            <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                {t('secret_key') || 'Secret Key'}
                            </label>
                            <p className="text-sm text-foreground font-mono bg-secondary/50 p-2 rounded">
                                {apiKeyData?.apiSecret ? maskKey(apiKeyData.apiSecret) : '•••••••••••'}
                            </p>
                    </div>
                )}
                {integration.issues && (
                        <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded">
                            {integration.issues}
                        </p>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={onEdit}
                            className="flex-1 px-3 py-2 bg-secondary hover:bg-accent text-secondary-foreground rounded text-sm font-semibold transition-colors"
                        >
                            {hasKey ? t('edit') || 'Edit' : t('configure') || 'Configure'}
                        </button>
            <button
                onClick={() => onTest(integration.id)}
                            disabled={disabled || !hasKey}
                            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm font-semibold transition-colors"
            >
                            {isTesting ? t('testing') || 'Testing...' : t('test_api') || 'Test'}
            </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default APIConfig;
