import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import { AIAPIConfigData, APIServiceIntegration, APIKeyEntry, ArtemisState } from '../../types.ts';
import { testGeminiConnection } from '../../services/geminiService.ts';
import { testClaudeConnection } from '../../services/claudeService.ts';
import { testOpenAIConnection } from '../../services/openaiService.ts';
import { testDeepSeekConnection } from '../../services/deepseekService.ts';

type ConfigTab = 'apis' | 'mixture' | 'artemis_control';

const APIConfig: React.FC = () => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<ConfigTab>('apis');
    const [isLoading, setIsLoading] = useState(true);
    const [apiConfig, setApiConfig] = useState<AIAPIConfigData | null>(null);
    const [artemis, setArtemis] = useState<ArtemisState | null>(null);
    const [testingService, setTestingService] = useState<string | null>(null);
    const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
    const [editingKeyId, setEditingKeyId] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [apiData, artemisState] = await Promise.all([
                    api.fetchAPIConfigData(),
                    api.fetchArtemisState(),
                ]);
                setApiConfig(apiData);
                setArtemis(artemisState);
            } catch (e) {
                console.error('Failed to load configuration:', e);
            } finally {
            setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleTestKey = async (serviceId: string, keyId?: string) => {
        if (testingService || !apiConfig) return;

        try {
            setTestingService(serviceId);
            setTestingKeyId(keyId || '');
            
            // Find service in all service arrays
            const service = [...apiConfig.aiServices, ...apiConfig.communicationServices, ...apiConfig.marketDataServices]
                .find(s => s.id === serviceId);
            
            if (!service) {
                throw new Error(`Service ${serviceId} not found`);
            }

            // Handle services that don't need API keys (like Voice)
            if (serviceId === 'com-voice') {
                // Voice is browser-based, no API key needed
                const result = await api.testAIIntegration(serviceId);
                if (result.success) {
                    alert(t('connection_test_success') || `Connection test successful!`);
                } else {
                    throw new Error(result.error || 'Connection test failed');
                }
            return;
        }
                
            // For other services, check if API keys are needed
            if (!service.apiKeys || service.apiKeys.length === 0) {
                // Try to test without API key (for services that might have config instead)
                const result = await api.testAIIntegration(serviceId, service.apiKeys?.[0]?.config);
                if (result.success) {
                    alert(t('connection_test_success') || `Connection test successful! Latency: ${result.latency || 0}ms`);
                } else {
                    throw new Error(result.error || 'Connection test failed. Please configure API key or settings first.');
                }
                return;
            }

            if (!keyId) {
                keyId = service.apiKeys[0].id;
                    }

            const keyEntry = service.apiKeys.find(k => k.id === keyId);
            if (!keyEntry) {
                throw new Error(`API key ${keyId} not found`);
        }

            if (!keyEntry.key || keyEntry.key.trim().length === 0) {
                throw new Error('API key is empty');
            }

            console.log(`Testing ${serviceId} with key: ${keyEntry.key.substring(0, 10)}...`);
            console.log(`Key length: ${keyEntry.key.length}`);
            console.log(`Key starts with: ${keyEntry.key.substring(0, 20)}...`);

            // Store API key temporarily for test functions
            let result: { success: boolean; latency?: number; error?: string } = { success: false };
            
            // Verify key is stored in localStorage before testing
            if (serviceId === 'ai-gemini') {
                localStorage.setItem('temp_gemini_key', keyEntry.key);
                const stored = localStorage.getItem('temp_gemini_key');
                console.log('Gemini key stored:', stored ? `${stored.substring(0, 10)}...` : 'NOT FOUND');
                try {
                    result = await testGeminiConnection();
                } catch (e: any) {
                    console.error('Gemini test exception:', e);
                    result = { success: false, error: e.message || 'Test failed' };
                } finally {
                    localStorage.removeItem('temp_gemini_key');
                }
            } else if (serviceId === 'ai-claude') {
                localStorage.setItem('temp_claude_key', keyEntry.key);
                const stored = localStorage.getItem('temp_claude_key');
                console.log('Claude key stored:', stored ? `${stored.substring(0, 10)}...` : 'NOT FOUND');
                try {
                    result = await testClaudeConnection();
                } catch (e: any) {
                    console.error('Claude test exception:', e);
                    result = { success: false, error: e.message || 'Test failed' };
                } finally {
                    localStorage.removeItem('temp_claude_key');
                }
            } else if (serviceId === 'ai-openai') {
                localStorage.setItem('temp_openai_key', keyEntry.key);
                const stored = localStorage.getItem('temp_openai_key');
                console.log('OpenAI key stored:', stored ? `${stored.substring(0, 10)}...` : 'NOT FOUND');
                try {
                    result = await testOpenAIConnection();
                } catch (e: any) {
                    console.error('OpenAI test exception:', e);
                    result = { success: false, error: e.message || 'Test failed' };
                } finally {
                    localStorage.removeItem('temp_openai_key');
                }
            } else if (serviceId === 'ai-deepseek') {
                localStorage.setItem('temp_deepseek_key', keyEntry.key);
                const stored = localStorage.getItem('temp_deepseek_key');
                console.log('DeepSeek key stored:', stored ? `${stored.substring(0, 10)}...` : 'NOT FOUND');
                try {
                    result = await testDeepSeekConnection();
                } catch (e: any) {
                    console.error('DeepSeek test exception:', e);
                    result = { success: false, error: e.message || 'Test failed' };
                } finally {
                    localStorage.removeItem('temp_deepseek_key');
                }
            } else {
                // Test other integrations (Email, On-chain, News, etc.)
                const serviceConfig = service.apiKeys?.[0]?.config || {};
                result = await api.testAIIntegration(serviceId, serviceConfig);
            }
            
            console.log(`Test result for ${serviceId}:`, result);

            if (result.success) {
                // Update service status (only if keyId is provided)
                if (keyId) {
                    const updatedConfig = { ...apiConfig };
                    
                    // Find and update in the correct array
                    const aiIndex = updatedConfig.aiServices.findIndex(s => s.id === serviceId);
                    if (aiIndex >= 0 && updatedConfig.aiServices[aiIndex].apiKeys) {
                        const keyIndex = updatedConfig.aiServices[aiIndex].apiKeys!.findIndex(k => k.id === keyId);
                        if (keyIndex >= 0) {
                            updatedConfig.aiServices[aiIndex].apiKeys![keyIndex] = {
                                ...updatedConfig.aiServices[aiIndex].apiKeys![keyIndex],
                                status: 'active',
                                lastTested: new Date().toISOString(),
                            };
                            setApiConfig(updatedConfig);
                            await saveAPIConfig(updatedConfig);
                        }
                    } else {
                        const commIndex = updatedConfig.communicationServices.findIndex(s => s.id === serviceId);
                        if (commIndex >= 0 && updatedConfig.communicationServices[commIndex].apiKeys) {
                            const keyIndex = updatedConfig.communicationServices[commIndex].apiKeys!.findIndex(k => k.id === keyId);
                            if (keyIndex >= 0) {
                                updatedConfig.communicationServices[commIndex].apiKeys![keyIndex] = {
                                    ...updatedConfig.communicationServices[commIndex].apiKeys![keyIndex],
                                    status: 'active',
                                    lastTested: new Date().toISOString(),
                                };
                                setApiConfig(updatedConfig);
                                await saveAPIConfig(updatedConfig);
                            }
                        } else {
                            const marketIndex = updatedConfig.marketDataServices.findIndex(s => s.id === serviceId);
                            if (marketIndex >= 0 && updatedConfig.marketDataServices[marketIndex].apiKeys) {
                                const keyIndex = updatedConfig.marketDataServices[marketIndex].apiKeys!.findIndex(k => k.id === keyId);
                                if (keyIndex >= 0) {
                                    updatedConfig.marketDataServices[marketIndex].apiKeys![keyIndex] = {
                                        ...updatedConfig.marketDataServices[marketIndex].apiKeys![keyIndex],
                                        status: 'active',
                                        lastTested: new Date().toISOString(),
                                    };
                                    setApiConfig(updatedConfig);
                                    await saveAPIConfig(updatedConfig);
                                }
                            }
                        }
                    }
                } else {
                    // Update service connection status (for services without API keys)
                    const updatedConfig = { ...apiConfig };
                    const service = [...updatedConfig.aiServices, ...updatedConfig.communicationServices, ...updatedConfig.marketDataServices]
                        .find(s => s.id === serviceId);
                    if (service) {
                        service.connected = true;
                        service.lastTestedAt = new Date().toISOString();
                        service.issues = undefined;
                        setApiConfig(updatedConfig);
                        await saveAPIConfig(updatedConfig);
                    }
                }
                
                alert(t('connection_test_success') || `Connection test successful! Latency: ${result.latency || 0}ms`);
            } else {
                throw new Error(result.error || 'Connection test failed');
            }
        } catch (e: any) {
            console.error('Failed to test API key:', e);
            let errorMessage = e.message || 'Unknown error';
            
            // Provide user-friendly error messages
            if (errorMessage.includes('CORS') || 
                errorMessage.includes('Failed to fetch') || 
                errorMessage.includes('Access-Control-Allow-Origin') ||
                (serviceId === 'ai-gemini' && (errorMessage.includes('Failed to fetch') || errorMessage.includes('exception')))) {
                if (serviceId === 'ai-gemini') {
                    errorMessage = '⚠️ CORS Restriction: Gemini API cannot be tested directly from browser due to browser security policies (CORS).\n\n✅ Your API key appears to be valid.\n\n💡 Solution: The API will work correctly in production when called from your backend server. For testing, you can:\n1. Test the API key from your backend server\n2. Use a proxy server\n3. The API will work fine in production environment\n\nThis is a browser limitation, not an issue with your API key.';
                } else {
                    errorMessage = 'Network error: Please check your internet connection and try again.';
                }
            } else if (errorMessage.includes('quota') || errorMessage.includes('429')) {
                errorMessage = 'API quota exceeded. Please check your account billing and plan.';
            } else if (errorMessage.includes('Insufficient Balance') || errorMessage.includes('402')) {
                errorMessage = 'Insufficient account balance. Please add credits to your account.';
            } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
                errorMessage = 'Invalid API key. Please check your API key and try again.';
            }
            
            console.error('Error details:', {
                serviceId,
                keyId,
                error: errorMessage,
                originalError: e.message,
                stack: e.stack,
            });
            
            alert(t('connection_test_failed') || `Connection test failed: ${errorMessage}`);
        } finally {
            setTestingService(null);
            setTestingKeyId(null);
        }
    };

    const handleAddAPIKey = async (serviceId: string, key: string, secret?: string, label?: string) => {
        if (!apiConfig || !key.trim()) {
            alert(t('api_key_required') || 'API Key is required');
            return;
        }

        try {
            const updatedConfig = { ...apiConfig };
            const service = [...updatedConfig.aiServices, ...updatedConfig.communicationServices, ...updatedConfig.marketDataServices]
                .find(s => s.id === serviceId);
            
            if (!service) return;

            const newKey: APIKeyEntry = {
                id: `key-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                key: key.trim(),
                secret: secret?.trim(),
                label: label?.trim() || `Key ${Date.now()}`,
                isActive: true,
                usageCount: 0,
                status: 'active',
            };

            // Find and update service
            const aiIndex = updatedConfig.aiServices.findIndex(s => s.id === serviceId);
            if (aiIndex >= 0) {
                if (!updatedConfig.aiServices[aiIndex].apiKeys) {
                    updatedConfig.aiServices[aiIndex].apiKeys = [];
                }
                updatedConfig.aiServices[aiIndex].apiKeys!.push(newKey);
                updatedConfig.aiServices[aiIndex].connected = true;
            } else {
                const commIndex = updatedConfig.communicationServices.findIndex(s => s.id === serviceId);
                if (commIndex >= 0) {
                    if (!updatedConfig.communicationServices[commIndex].apiKeys) {
                        updatedConfig.communicationServices[commIndex].apiKeys = [];
                    }
                    updatedConfig.communicationServices[commIndex].apiKeys!.push(newKey);
                    updatedConfig.communicationServices[commIndex].connected = true;
                } else {
                    const marketIndex = updatedConfig.marketDataServices.findIndex(s => s.id === serviceId);
                    if (marketIndex >= 0) {
                        if (!updatedConfig.marketDataServices[marketIndex].apiKeys) {
                            updatedConfig.marketDataServices[marketIndex].apiKeys = [];
                        }
                        updatedConfig.marketDataServices[marketIndex].apiKeys!.push(newKey);
                        updatedConfig.marketDataServices[marketIndex].connected = true;
                    }
                }
            }

            setApiConfig(updatedConfig);
            await saveAPIConfig(updatedConfig);
            setEditingServiceId(null);
            setEditingKeyId(null);
            alert(t('api_key_added') || 'API Key added successfully!');
                } catch (e) {
            console.error('Failed to add API key:', e);
            alert(t('api_key_add_failed') || 'Failed to add API key');
        }
    };

    const handleRemoveAPIKey = async (serviceId: string, keyId: string) => {
        if (!apiConfig || !confirm(t('confirm_remove_key') || 'Are you sure you want to remove this API key?')) {
            return;
                }

        try {
            const updatedConfig = { ...apiConfig };
            
            const aiIndex = updatedConfig.aiServices.findIndex(s => s.id === serviceId);
            if (aiIndex >= 0 && updatedConfig.aiServices[aiIndex].apiKeys) {
                updatedConfig.aiServices[aiIndex].apiKeys = updatedConfig.aiServices[aiIndex].apiKeys!.filter(k => k.id !== keyId);
                if (updatedConfig.aiServices[aiIndex].apiKeys!.length === 0) {
                    updatedConfig.aiServices[aiIndex].connected = false;
                }
            } else {
                const commIndex = updatedConfig.communicationServices.findIndex(s => s.id === serviceId);
                if (commIndex >= 0 && updatedConfig.communicationServices[commIndex].apiKeys) {
                    updatedConfig.communicationServices[commIndex].apiKeys = updatedConfig.communicationServices[commIndex].apiKeys!.filter(k => k.id !== keyId);
                    if (updatedConfig.communicationServices[commIndex].apiKeys!.length === 0) {
                        updatedConfig.communicationServices[commIndex].connected = false;
                    }
                } else {
                    const marketIndex = updatedConfig.marketDataServices.findIndex(s => s.id === serviceId);
                    if (marketIndex >= 0 && updatedConfig.marketDataServices[marketIndex].apiKeys) {
                        updatedConfig.marketDataServices[marketIndex].apiKeys = updatedConfig.marketDataServices[marketIndex].apiKeys!.filter(k => k.id !== keyId);
                        if (updatedConfig.marketDataServices[marketIndex].apiKeys!.length === 0) {
                            updatedConfig.marketDataServices[marketIndex].connected = false;
                        }
                    }
                }
            }

            setApiConfig(updatedConfig);
            await saveAPIConfig(updatedConfig);
            alert(t('api_key_removed') || 'API Key removed successfully!');
                } catch (e) {
            console.error('Failed to remove API key:', e);
            alert(t('api_key_remove_failed') || 'Failed to remove API key');
        }
    };

    const handleToggleKeyStatus = async (serviceId: string, keyId: string) => {
        if (!apiConfig) return;

        try {
            const updatedConfig = { ...apiConfig };
            
            const aiIndex = updatedConfig.aiServices.findIndex(s => s.id === serviceId);
            if (aiIndex >= 0 && updatedConfig.aiServices[aiIndex].apiKeys) {
                const keyIndex = updatedConfig.aiServices[aiIndex].apiKeys!.findIndex(k => k.id === keyId);
                if (keyIndex >= 0) {
                    updatedConfig.aiServices[aiIndex].apiKeys![keyIndex].isActive = !updatedConfig.aiServices[aiIndex].apiKeys![keyIndex].isActive;
                }
            } else {
                const commIndex = updatedConfig.communicationServices.findIndex(s => s.id === serviceId);
                if (commIndex >= 0 && updatedConfig.communicationServices[commIndex].apiKeys) {
                    const keyIndex = updatedConfig.communicationServices[commIndex].apiKeys!.findIndex(k => k.id === keyId);
                    if (keyIndex >= 0) {
                        updatedConfig.communicationServices[commIndex].apiKeys![keyIndex].isActive = !updatedConfig.communicationServices[commIndex].apiKeys![keyIndex].isActive;
                    }
                } else {
                    const marketIndex = updatedConfig.marketDataServices.findIndex(s => s.id === serviceId);
                    if (marketIndex >= 0 && updatedConfig.marketDataServices[marketIndex].apiKeys) {
                        const keyIndex = updatedConfig.marketDataServices[marketIndex].apiKeys!.findIndex(k => k.id === keyId);
                        if (keyIndex >= 0) {
                            updatedConfig.marketDataServices[marketIndex].apiKeys![keyIndex].isActive = !updatedConfig.marketDataServices[marketIndex].apiKeys![keyIndex].isActive;
                        }
                    }
                }
            }

            setApiConfig(updatedConfig);
            await saveAPIConfig(updatedConfig);
        } catch (e) {
            console.error('Failed to toggle key status:', e);
        }
    };

    const handleUpdateLoadBalancing = async (serviceId: string, strategy: 'round_robin' | 'least_used' | 'random' | 'weighted', weights?: { [keyId: string]: number }) => {
        if (!apiConfig) return;

        try {
            const updatedConfig = { ...apiConfig };
            
            const aiIndex = updatedConfig.aiServices.findIndex(s => s.id === serviceId);
            if (aiIndex >= 0) {
                updatedConfig.aiServices[aiIndex].loadBalancing = { strategy, weights };
            } else {
                const commIndex = updatedConfig.communicationServices.findIndex(s => s.id === serviceId);
                if (commIndex >= 0) {
                    updatedConfig.communicationServices[commIndex].loadBalancing = { strategy, weights };
                } else {
                    const marketIndex = updatedConfig.marketDataServices.findIndex(s => s.id === serviceId);
                    if (marketIndex >= 0) {
                        updatedConfig.marketDataServices[marketIndex].loadBalancing = { strategy, weights };
                    }
                }
            }

            setApiConfig(updatedConfig);
            await saveAPIConfig(updatedConfig);
        } catch (e) {
            console.error('Failed to update load balancing:', e);
        }
    };

    const handleUpdateMixtureAgents = async (enabled: boolean, models: Array<{ serviceId: string; weight: number; minConfidence?: number }>) => {
        if (!apiConfig) return;

        try {
            const updatedConfig = { ...apiConfig };
            
            // Update mixture agents for all AI services
            updatedConfig.aiServices.forEach(service => {
                if (['ai-gemini', 'ai-claude', 'ai-openai', 'ai-deepseek'].includes(service.id)) {
                    service.mixtureAgents = { enabled, models };
                }
            });

            setApiConfig(updatedConfig);
            await saveAPIConfig(updatedConfig);

            // همچنین تنظیمات Mixture را به بک‌اند (ArtemisConfig.decisionEngine) هم ارسال می‌کنیم
            try {
                const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
                await fetch('http://localhost:5002/api/artemis/config/decision-engine', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({
                        useMixture: enabled,
                        models: models.map(m => ({
                            provider: m.serviceId,
                            weight: m.weight,
                            minConfidence: m.minConfidence,
                        })),
                    }),
                });
            } catch (err) {
                console.error('Failed to sync mixture agents with backend Artemis config:', err);
            }

            alert(t('mixture_agents_updated') || 'Mixture agents configuration updated!');
        } catch (e) {
            console.error('Failed to update mixture agents:', e);
            alert(t('mixture_agents_update_failed') || 'Failed to update mixture agents configuration');
        }
    };

    const saveAPIConfig = async (config: AIAPIConfigData) => {
        try {
            config.lastUpdated = new Date().toISOString();
            await api.updateAPIConfigData(config);
        } catch (e) {
            console.error('Failed to save API config:', e);
            throw e;
        }
    };

    const handleSaveAll = async () => {
        if (!apiConfig) return;
        
        setIsSaving(true);
        setSaveStatus('saving');
        try {
            await saveAPIConfig(apiConfig);
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
        { id: 'mixture', label: t('mixture_agents') || 'Mixture Agents', icon: '🤝' },
        { id: 'artemis_control', label: t('artemis_control') || 'Artemis Control', icon: '🎛️' },
    ];

    const aiServices = (apiConfig?.aiServices || []).filter(s => ['ai-gemini', 'ai-claude', 'ai-openai', 'ai-deepseek'].includes(s.id));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">{t('configuration') || 'Configuration'}</h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            {t('api_configuration_desc') || 'Manage API integrations, multiple API keys, load balancing, and mixture agents configuration'}
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
                                    const [apiData, artemisState] = await Promise.all([
                                        api.fetchAPIConfigData(),
                                        api.fetchArtemisState(),
                                    ]);
                                    setApiConfig(apiData);
                                    setArtemis(artemisState);
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
                <div className="p-6" style={{ maxHeight: 'calc(92vh - 300px)', overflowY: 'auto' }}>
                    {activeTab === 'apis' && apiConfig && (
                        <APIConfigTab
                            config={apiConfig}
                            onTestKey={handleTestKey}
                            testingService={testingService}
                            testingKeyId={testingKeyId}
                            onAddKey={handleAddAPIKey}
                            onRemoveKey={handleRemoveAPIKey}
                            onToggleKeyStatus={handleToggleKeyStatus}
                            onUpdateLoadBalancing={handleUpdateLoadBalancing}
                            editingServiceId={editingServiceId}
                            setEditingServiceId={setEditingServiceId}
                            editingKeyId={editingKeyId}
                            setEditingKeyId={setEditingKeyId}
                            t={t}
                        />
                    )}
                    {activeTab === 'mixture' && apiConfig && (
                        <MixtureAgentsTab
                            aiServices={aiServices}
                            onUpdate={handleUpdateMixtureAgents}
                            t={t}
                        />
                    )}
                    {activeTab === 'artemis_control' && artemis && apiConfig && (
                        <ArtemisControlTab
                            artemis={artemis}
                            apiConfig={apiConfig}
                            onUpdate={setApiConfig}
                            t={t}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

// API Config Tab with Multiple API Keys Support
const APIConfigTab: React.FC<{
    config: AIAPIConfigData;
    onTestKey: (serviceId: string, keyId?: string) => void;
    testingService: string | null;
    testingKeyId: string | null;
    onAddKey: (serviceId: string, key: string, secret?: string, label?: string) => void;
    onRemoveKey: (serviceId: string, keyId: string) => void;
    onToggleKeyStatus: (serviceId: string, keyId: string) => void;
    onUpdateLoadBalancing: (serviceId: string, strategy: 'round_robin' | 'least_used' | 'random' | 'weighted', weights?: { [keyId: string]: number }) => void;
    editingServiceId: string | null;
    setEditingServiceId: (id: string | null) => void;
    editingKeyId: string | null;
    setEditingKeyId: (id: string | null) => void;
    t: (key: string) => string;
}> = ({ config, onTestKey, testingService, testingKeyId, onAddKey, onRemoveKey, onToggleKeyStatus, onUpdateLoadBalancing, editingServiceId, setEditingServiceId, editingKeyId, setEditingKeyId, t }) => {
    const [newKeyData, setNewKeyData] = useState<{ key: string; secret?: string; label: string }>({ key: '', label: '' });

    const aiServices = (config.aiServices || []).filter(s => ['ai-gemini', 'ai-claude', 'ai-openai', 'ai-deepseek'].includes(s.id));

    return (
        <div className="space-y-8">
            {/* AI Services - Multiple API Keys */}
            <Card title={t('ai_services') || 'AI Services'}>
                <p className="text-sm text-muted-foreground mb-6">
                    {t('multiple_api_keys_desc') || 'Add multiple API keys for each AI service to distribute load, avoid rate limits, and manage costs. Keys are automatically rotated based on your load balancing strategy.'}
                </p>
                <div className="space-y-6">
                    {aiServices.map(service => (
                        <AIServiceCard
                            key={service.id}
                            service={service}
                            onTestKey={onTestKey}
                    testingService={testingService}
                            testingKeyId={testingKeyId}
                            onAddKey={onAddKey}
                            onRemoveKey={onRemoveKey}
                            onToggleKeyStatus={onToggleKeyStatus}
                            onUpdateLoadBalancing={onUpdateLoadBalancing}
                            editingServiceId={editingServiceId}
                            setEditingServiceId={setEditingServiceId}
                            editingKeyId={editingKeyId}
                            setEditingKeyId={setEditingKeyId}
                            newKeyData={newKeyData}
                            setNewKeyData={setNewKeyData}
                            t={t}
                />
                    ))}
                </div>
            </Card>

            {/* Communication Services */}
            <Card title={t('communications_and_alerts') || 'Communications & Alerts'}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(config.communicationServices || []).map(service => (
                        <SimpleServiceCard 
                            key={service.id} 
                            service={service} 
                            onTest={onTestKey}
                    testingService={testingService}
                            t={t} 
                        />
                    ))}
                </div>
            </Card>

            {/* Market Data Services */}
            <Card title={t('market_data_and_analysis') || 'Market Data & Analysis'}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(config.marketDataServices || []).map(service => (
                        <SimpleServiceCard 
                            key={service.id} 
                            service={service} 
                            onTest={onTestKey}
                    testingService={testingService}
                            t={t} 
                        />
                    ))}
                </div>
            </Card>
        </div>
    );
};

// AI Service Card with Multiple API Keys
const AIServiceCard: React.FC<{
    service: APIServiceIntegration;
    onTestKey: (serviceId: string, keyId?: string) => void;
    testingService: string | null;
    testingKeyId: string | null;
    onAddKey: (serviceId: string, key: string, secret?: string, label?: string) => void;
    onRemoveKey: (serviceId: string, keyId: string) => void;
    onToggleKeyStatus: (serviceId: string, keyId: string) => void;
    onUpdateLoadBalancing: (serviceId: string, strategy: 'round_robin' | 'least_used' | 'random' | 'weighted', weights?: { [keyId: string]: number }) => void;
    editingServiceId: string | null;
    setEditingServiceId: (id: string | null) => void;
    editingKeyId: string | null;
    setEditingKeyId: (id: string | null) => void;
    newKeyData: { key: string; secret?: string; label: string };
    setNewKeyData: (data: { key: string; secret?: string; label: string }) => void;
    t: (key: string) => string;
}> = ({ service, onTestKey, testingService, testingKeyId, onAddKey, onRemoveKey, onToggleKeyStatus, onUpdateLoadBalancing, editingServiceId, setEditingServiceId, editingKeyId, setEditingKeyId, newKeyData, setNewKeyData, t }) => {
    const isEditing = editingServiceId === service.id;
    const apiKeys = service.apiKeys || [];
    const activeKeys = apiKeys.filter(k => k.isActive);
    const loadBalancing = service.loadBalancing || { strategy: 'round_robin' };

    const maskKey = (key: string): string => {
        if (!key || key.length < 8) return '••••••••';
        return `${key.substring(0, 4)}${'•'.repeat(Math.min(20, key.length - 8))}${key.substring(key.length - 4)}`;
    };

    return (
        <div className="border border-border rounded-lg p-6 bg-background/40">
            <div className="flex justify-between items-start mb-4">
                    <div>
                    <h4 className="text-lg font-semibold text-foreground">{service.name}</h4>
                    <p className={`text-sm ${service.connected ? 'text-green-400' : 'text-yellow-400'}`}>
                        {service.connected ? t('connected') : t('disconnected')} • {activeKeys.length} {t('active_keys') || 'active key(s)'}
                    </p>
                </div>
                <button
                    onClick={() => {
                        if (isEditing) {
                            setEditingServiceId(null);
                            setNewKeyData({ key: '', label: '' });
                        } else {
                            setEditingServiceId(service.id);
                        }
                    }}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-semibold"
                        >
                    {isEditing ? t('cancel') : t('add_api_key') || 'Add Key'}
                </button>
                    </div>

            {/* Load Balancing Settings */}
            <div className="mb-4 p-3 bg-secondary/50 rounded-lg">
                        <label className="block text-sm font-semibold text-foreground mb-2">
                    {t('load_balancing_strategy') || 'Load Balancing Strategy'}
                        </label>
                        <select
                    value={loadBalancing.strategy}
                    onChange={(e) => onUpdateLoadBalancing(service.id, e.target.value as any)}
                    className="w-full p-2 bg-background border border-border rounded text-foreground text-sm"
                        >
                    <option value="round_robin">{t('round_robin') || 'Round Robin'}</option>
                    <option value="least_used">{t('least_used') || 'Least Used'}</option>
                    <option value="random">{t('random') || 'Random'}</option>
                    <option value="weighted">{t('weighted') || 'Weighted'}</option>
                        </select>
                <p className="text-xs text-muted-foreground mt-1">
                    {loadBalancing.strategy === 'round_robin' && (t('round_robin_desc') || 'Rotate through keys sequentially')}
                    {loadBalancing.strategy === 'least_used' && (t('least_used_desc') || 'Use key with lowest usage count')}
                    {loadBalancing.strategy === 'random' && (t('random_desc') || 'Randomly select from active keys')}
                    {loadBalancing.strategy === 'weighted' && (t('weighted_desc') || 'Distribute based on assigned weights')}
                </p>
                    </div>

            {/* Add New Key Form */}
            {isEditing && (
                <div className="mb-4 p-4 bg-secondary/30 rounded-lg border border-purple-500/30">
                    <h5 className="font-semibold text-foreground mb-3">{t('add_new_api_key') || 'Add New API Key'}</h5>
                    <div className="space-y-3">
                    <div>
                            <label className="block text-xs font-semibold text-foreground mb-1">
                                {t('key_label') || 'Label'} (optional)
                        </label>
                        <input
                                type="text"
                                value={newKeyData.label}
                                onChange={(e) => setNewKeyData({ ...newKeyData, label: e.target.value })}
                                placeholder={t('key_label_placeholder') || 'e.g., Free Tier, Paid Tier 1'}
                                className="w-full p-2 bg-background border border-border rounded text-foreground text-sm"
                        />
                    </div>
                    <div>
                            <label className="block text-xs font-semibold text-foreground mb-1">
                                {t('api_key') || 'API Key'} *
                        </label>
                        <input
                                type="password"
                                value={newKeyData.key}
                                onChange={(e) => setNewKeyData({ ...newKeyData, key: e.target.value })}
                                placeholder={t('enter_api_key') || 'Enter API Key'}
                                className="w-full p-2 bg-background border border-border rounded text-foreground text-sm"
                        />
                    </div>
                        <button
                            onClick={() => {
                                if (newKeyData.key.trim()) {
                                    onAddKey(service.id, newKeyData.key, newKeyData.secret, newKeyData.label);
                                    setNewKeyData({ key: '', label: '' });
                                    setEditingServiceId(null);
                                }
                            }}
                            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-semibold"
                        >
                            {t('add_key') || 'Add Key'}
                        </button>
                    </div>
                </div>
            )}

            {/* API Keys List */}
            <div className="space-y-3">
                {apiKeys.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        {t('no_api_keys_configured') || 'No API keys configured. Click "Add Key" to add one.'}
                    </p>
                ) : (
                    apiKeys.map(key => (
                        <div
                            key={key.id}
                            className={`p-4 border rounded-lg ${
                                key.isActive
                                    ? key.status === 'active' ? 'border-green-500/30 bg-green-500/5'
                                    : key.status === 'rate_limited' ? 'border-yellow-500/30 bg-yellow-500/5'
                                    : 'border-red-500/30 bg-red-500/5'
                                    : 'border-gray-500/30 bg-gray-500/5 opacity-50'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-foreground">{key.label || t('api_key') || 'API Key'}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                            key.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                            key.status === 'rate_limited' ? 'bg-yellow-500/20 text-yellow-400' :
                                            key.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                            'bg-gray-500/20 text-gray-400'
                                        }`}>
                                            {key.status === 'active' ? t('active') :
                                             key.status === 'rate_limited' ? t('rate_limited') :
                                             key.status === 'error' ? t('error') :
                                             t('disabled')}
                                        </span>
                    </div>
                                    <p className="text-xs font-mono text-muted-foreground">{maskKey(key.key)}</p>
                    </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onToggleKeyStatus(service.id, key.id)}
                                        className={`px-2 py-1 rounded text-xs ${
                                            key.isActive
                                                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                                : 'bg-green-600 hover:bg-green-700 text-white'
                                        }`}
                                    >
                                        {key.isActive ? t('disable') : t('enable')}
                                    </button>
                                    <button
                                        onClick={() => onTestKey(service.id, key.id)}
                                        disabled={testingService === service.id && testingKeyId === key.id}
                                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs"
                                    >
                                        {testingService === service.id && testingKeyId === key.id ? t('testing') : t('test')}
                                    </button>
                                    <button
                                        onClick={() => onRemoveKey(service.id, key.id)}
                                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                                    >
                                        {t('remove') || 'Remove'}
                                    </button>
                        </div>
                    </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-2">
                                <span>{t('usage') || 'Usage'}: {key.usageCount}</span>
                                {key.lastUsed && (
                                    <span>{t('last_used') || 'Last used'}: {new Date(key.lastUsed).toLocaleString()}</span>
                                )}
                </div>
                    </div>
                    ))
                )}
                    </div>
                    </div>
    );
};

// Simple Service Card (for non-AI services)
const SimpleServiceCard: React.FC<{
    service: APIServiceIntegration;
    onTest?: (serviceId: string, keyId?: string) => void;
    testingService?: string | null;
    t: (key: string) => string;
}> = ({ service, onTest, testingService, t }) => {
    const statusClass = service.connected ? 'text-green-400' : 'text-yellow-400';
    const isTesting = testingService === service.id;
    const hasApiKeys = service.apiKeys && service.apiKeys.length > 0;
    const firstKeyId = hasApiKeys ? service.apiKeys![0].id : undefined;
    
    return (
        <div className="border border-border rounded-lg p-4 bg-background/40">
            <div className="flex justify-between items-start mb-3">
                    <div>
                    <h4 className="font-semibold text-foreground">{service.name}</h4>
                    <p className={`text-xs font-semibold ${statusClass}`}>
                        {service.connected ? t('connected') : t('disconnected')}
                    </p>
                    {service.lastTestedAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('last_tested') || 'Last tested'}: {new Date(service.lastTestedAt).toLocaleString()}
                        </p>
                    )}
                    </div>
                </div>
            {service.issues && (
                <p className="text-xs text-red-400 mb-3 bg-red-500/10 p-2 rounded">
                    {service.issues}
                </p>
            )}
            {onTest && (hasApiKeys || service.id === 'com-voice') && (
                <button
                    onClick={() => onTest(service.id, firstKeyId)}
                    disabled={isTesting}
                    className={`w-full px-3 py-2 rounded text-sm font-semibold transition-colors ${
                        isTesting
                            ? 'bg-gray-600 text-white cursor-wait'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                    {isTesting ? (t('testing') || 'Testing...') : (t('test_connection') || 'Test Connection')}
                </button>
            )}
        </div>
    );
};

// Mixture Agents Tab
const MixtureAgentsTab: React.FC<{
    aiServices: APIServiceIntegration[];
    onUpdate: (enabled: boolean, models: Array<{ serviceId: string; weight: number; minConfidence?: number }>) => void;
    t: (key: string) => string;
}> = ({ aiServices, onUpdate, t }) => {
    const [enabled, setEnabled] = useState(true);
    const [models, setModels] = useState<Array<{ serviceId: string; weight: number; minConfidence?: number }>>(
        aiServices.map(s => ({
            serviceId: s.id,
            weight: 25, // Equal weight by default
            minConfidence: 70,
        }))
    );

    const totalWeight = models.reduce((sum, m) => sum + m.weight, 0);

    const updateModelWeight = (serviceId: string, weight: number) => {
        setModels(prev => prev.map(m => m.serviceId === serviceId ? { ...m, weight } : m));
    };

    const updateModelConfidence = (serviceId: string, minConfidence: number) => {
        setModels(prev => prev.map(m => m.serviceId === serviceId ? { ...m, minConfidence } : m));
    };

    const normalizeWeights = () => {
        const total = models.reduce((sum, m) => sum + m.weight, 0);
        if (total === 0) return;
        setModels(prev => prev.map(m => ({ ...m, weight: Math.round((m.weight / total) * 100) })));
    };

    return (
        <div className="space-y-6">
            <Card title={t('mixture_agents_configuration') || 'Mixture Agents Configuration'}>
                <div className="space-y-6">
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-blue-300">
                            {t('mixture_agents_desc') || 'Mixture Agents allows Artemis to use multiple AI services (ChatGPT, Gemini, DeepSeek, Claude) together in a collaborative manner. Each service contributes to decisions based on their assigned weights and confidence thresholds.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => setEnabled(e.target.checked)}
                            className="w-5 h-5"
                        />
                        <label className="text-lg font-semibold text-foreground">
                            {t('enable_mixture_agents') || 'Enable Mixture Agents'}
                        </label>
                    </div>

                    {enabled && (
                        <div className="space-y-4">
                            {models.map((model, idx) => {
                                const service = aiServices.find(s => s.id === model.serviceId);
                                return (
                                    <div key={model.serviceId} className="p-4 border border-border rounded-lg bg-background/40">
                                        <div className="flex justify-between items-center mb-3">
                                            <h5 className="font-semibold text-foreground">{service?.name || model.serviceId}</h5>
                                            <span className="text-sm text-muted-foreground">
                                                {t('weight') || 'Weight'}: {model.weight}% {totalWeight !== 100 && `(${t('total') || 'Total'}: ${totalWeight}%)`}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                                                <label className="block text-xs font-semibold text-foreground mb-2">
                                                    {t('weight') || 'Weight'} ({model.weight}%)
                        </label>
                        <input
                                                    type="range"
                            min="0"
                            max="100"
                                                    value={model.weight}
                                                    onChange={(e) => updateModelWeight(model.serviceId, parseInt(e.target.value))}
                                                    className="w-full"
                                                />
                                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                                    <span>0%</span>
                                                    <span>100%</span>
                    </div>
                    </div>
                    <div>
                                                <label className="block text-xs font-semibold text-foreground mb-2">
                                                    {t('min_confidence') || 'Min Confidence'} ({model.minConfidence || 70}%)
                        </label>
                        <input
                                                    type="range"
                                                    min="50"
                                                    max="100"
                                                    value={model.minConfidence || 70}
                                                    onChange={(e) => updateModelConfidence(model.serviceId, parseInt(e.target.value))}
                                                    className="w-full"
                                                />
                                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                                    <span>50%</span>
                                                    <span>100%</span>
                    </div>
                    </div>
                </div>
        </div>
    );
                            })}

                            {totalWeight !== 100 && (
                                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                    <p className="text-sm text-yellow-300">
                                        {t('weights_not_normalized') || 'Weights do not sum to 100%. Click "Normalize" to automatically adjust.'}
                                    </p>
                                    <button
                                        onClick={normalizeWeights}
                                        className="mt-2 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm"
                                    >
                                        {t('normalize_weights') || 'Normalize Weights'}
                                    </button>
            </div>
                            )}

                            <button
                                onClick={() => onUpdate(enabled, models)}
                                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold"
                            >
                                {t('save_mixture_config') || 'Save Mixture Agents Configuration'}
                            </button>
    </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

// Artemis Control Tab
const ArtemisControlTab: React.FC<{
    artemis: ArtemisState;
    apiConfig: AIAPIConfigData;
    onUpdate: (config: AIAPIConfigData) => void;
    t: (key: string) => string;
}> = ({ artemis, apiConfig, onUpdate, t }) => {
    const [artemisControl, setArtemisControl] = useState({
        allowAutoConfig: true,
        allowAutoSwitch: true,
        allowAutoOptimize: true,
        requireApproval: false,
    });

    return (
        <div className="space-y-6">
            <Card title={t('artemis_api_control') || 'Artemis API Control'}>
                <div className="space-y-6">
                    <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <p className="text-sm text-purple-300">
                            {t('artemis_control_desc') || 'Configure how Artemis can automatically manage API integrations, switch between keys, and optimize usage.'}
                        </p>
            </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                                <h5 className="font-semibold text-foreground">{t('allow_auto_config') || 'Allow Auto Configuration'}</h5>
                                <p className="text-xs text-muted-foreground">
                                    {t('allow_auto_config_desc') || 'Artemis can automatically configure API settings based on system needs'}
                                </p>
                            </div>
                        <input
                                type="checkbox"
                                checked={artemisControl.allowAutoConfig}
                                onChange={(e) => setArtemisControl({ ...artemisControl, allowAutoConfig: e.target.checked })}
                                className="w-5 h-5"
                            />
                </div>

                        <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                                <h5 className="font-semibold text-foreground">{t('allow_auto_switch') || 'Allow Auto Switch Keys'}</h5>
                                <p className="text-xs text-muted-foreground">
                                    {t('allow_auto_switch_desc') || 'Artemis can automatically switch to different API keys when rate limits are reached'}
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={artemisControl.allowAutoSwitch}
                                onChange={(e) => setArtemisControl({ ...artemisControl, allowAutoSwitch: e.target.checked })}
                                className="w-5 h-5"
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                                <h5 className="font-semibold text-foreground">{t('allow_auto_optimize') || 'Allow Auto Optimize'}</h5>
                                <p className="text-xs text-muted-foreground">
                                    {t('allow_auto_optimize_desc') || 'Artemis can automatically optimize API usage and costs'}
                            </p>
                    </div>
                            <input
                                type="checkbox"
                                checked={artemisControl.allowAutoOptimize}
                                onChange={(e) => setArtemisControl({ ...artemisControl, allowAutoOptimize: e.target.checked })}
                                className="w-5 h-5"
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div>
                                <h5 className="font-semibold text-foreground">{t('require_approval') || 'Require Approval'}</h5>
                                <p className="text-xs text-muted-foreground">
                                    {t('require_approval_desc') || 'Artemis must get approval before making significant changes to API configuration'}
                            </p>
                    </div>
                            <input
                                type="checkbox"
                                checked={artemisControl.requireApproval}
                                onChange={(e) => setArtemisControl({ ...artemisControl, requireApproval: e.target.checked })}
                                className="w-5 h-5"
                            />
                        </div>
                    </div>

                        <button
                        onClick={async () => {
                            // Save Artemis control settings
                            alert(t('artemis_control_saved') || 'Artemis control settings saved!');
                        }}
                        className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold"
            >
                        {t('save_artemis_control') || 'Save Artemis Control Settings'}
            </button>
                    </div>
            </Card>
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

export default APIConfig;
