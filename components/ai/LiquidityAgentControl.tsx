import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type { AIAgent } from '../../types.ts';

/**
 * Liquidity Agent Control Component
 * Phase 0.5: Minimal UI - Overview Tab Only
 * 
 * Displays:
 * - Liquidity Score
 * - Risk Level
 * - Key Metrics (Spread, Slippage, Scans)
 * - Status & Controls
 * 
 * NO CHARTS until /run returns real data
 */

type LiquidityTab = 'overview' | 'settings';

const TAB_ITEMS: Array<{ id: LiquidityTab; labelKey: string }> = [
    { id: 'overview', labelKey: 'tab_overview' },
    { id: 'settings', labelKey: 'tab_settings' },
];

interface LiquidityAgentControlProps {
    agent: AIAgent;
    onClose: () => void;
    onUpdate: (agent: AIAgent) => void;
}

interface LiquidityMetrics {
    totalScans: number;
    activeHours: number;
    avgLiquidityScore: number;
    avgSpread: number;
    avgDepth: number;
    lastScanAt: string | null;
}

interface LiquidityStatus {
    status: string;
    mode: string;
    symbols: string[];
    enabled: boolean;
    lastRunAt: string | null;
    isRunning: boolean;
}

interface LiquiditySettings {
    enabled: boolean;
    mode: string;
    symbols: string[];
    depthLevels: number[];
    slippageThresholds: {
        low: number;
        medium: number;
        high: number;
    };
    alertRules: {
        liquidityDrop: { enabled: boolean; threshold: number };
        spreadWiden: { enabled: boolean; threshold: number };
        imbalance: { enabled: boolean; threshold: number };
        slippageHigh: { enabled: boolean; threshold: number };
    };
    integrations: {
        dashboard: boolean;
        telegram: boolean;
    };
}

const LiquidityAgentControl: React.FC<LiquidityAgentControlProps> = ({ agent, onClose, onUpdate }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<LiquidityTab>('overview');
    const [metrics, setMetrics] = useState<LiquidityMetrics | null>(null);
    const [status, setStatus] = useState<LiquidityStatus | null>(null);
    const [settings, setSettings] = useState<LiquiditySettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        loadData();
    }, [agent.id]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            
            // 🆕 Golden Rule: Fetch all data from backend (single source of truth)
            const [metricsRes, statusRes, settingsRes] = await Promise.all([
                fetch('/api/agents/liquidity/metrics', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/agents/liquidity/status', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/agents/liquidity/settings', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (metricsRes.ok) {
                const data = await metricsRes.json();
                setMetrics(data.metrics);
            }

            if (statusRes.ok) {
                const data = await statusRes.json();
                setStatus(data);
            }

            if (settingsRes.ok) {
                const data = await settingsRes.json();
                setSettings(data.settings);
            }
        } catch (error) {
            console.error('Failed to load liquidity agent data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRunAnalysis = async () => {
        setIsRunning(true);
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await fetch('/api/agents/liquidity/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ symbol: 'BTCUSDT' })
            });

            if (!response.ok) {
                const error = await response.json();
                if (response.status === 501) {
                    alert('MEXC integration pending. Coming soon!');
                } else {
                    throw new Error(error.message || 'Analysis failed');
                }
            } else {
                const result = await response.json();
                alert('Analysis complete!');
                // Reload data
                await loadData();
                
                // Update agent in parent
                const agents = await api.fetchAIAgents();
                const updatedAgent = agents.find(a => a.id === agent.id);
                if (updatedAgent) {
                    onUpdate(updatedAgent);
                }
            }
        } catch (error) {
            console.error('Failed to run liquidity analysis:', error);
            alert(t('analysis_failed') || 'Analysis failed');
        } finally {
            setIsRunning(false);
        }
    };

    // 🆕 Golden Rule: Save → Refetch → Update State
    const handleUpdateSettings = async (updatedSettings: LiquiditySettings) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            
            // 1. Save to backend
            const response = await fetch('/api/agents/liquidity/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedSettings)
            });

            if (!response.ok) {
                throw new Error('Failed to update settings');
            }

            const result = await response.json();
            
            // 2. 🆕 Update local state with fresh data from backend (single source of truth)
            if (result.settings) {
                setSettings(result.settings);
            }
            
            // 3. Reload all data to sync status
            await loadData();
            
            // 4. Show success
            alert(t('settings_updated') || 'Settings updated successfully');
        } catch (error) {
            console.error('Failed to update liquidity settings:', error);
            alert(t('update_failed') || 'Update failed');
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const getRiskLevelColor = (riskLevel?: string) => {
        switch (riskLevel?.toLowerCase()) {
            case 'low': return 'text-green-400';
            case 'medium': return 'text-yellow-400';
            case 'high': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    const getRiskLevelBadge = (riskLevel?: string) => {
        const color = getRiskLevelColor(riskLevel);
        return (
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${color} bg-opacity-10 bg-current`}>
                {(riskLevel || 'Unknown').toUpperCase()}
            </span>
        );
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <div>
                    <h2 className="text-xl font-bold">{agent.name}</h2>
                    <p className="text-sm text-gray-400">Market Liquidity Analyzer</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    aria-label="Close"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800">
                {TAB_ITEMS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-6 py-3 font-medium transition-colors ${
                            activeTab === tab.id
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        {t(tab.labelKey) || tab.id.charAt(0).toUpperCase() + tab.id.slice(1)}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-gray-400">Loading...</div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Overview Tab */}
                        {activeTab === 'overview' && (
                            <>
                                {/* Agent Status Card */}
                                <div className="bg-gray-800 rounded-lg p-6">
                                    <h3 className="text-lg font-semibold mb-4">Agent Status</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-400">Status</p>
                                            <p className="text-lg font-semibold">
                                                {status?.enabled ? (
                                                    <span className="text-green-400">Active</span>
                                                ) : (
                                                    <span className="text-gray-400">Inactive</span>
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">Mode</p>
                                            <p className="text-lg font-semibold">{status?.mode || 'demo'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">Symbols</p>
                                            <p className="text-lg font-semibold">
                                                {status?.symbols?.join(', ') || 'None'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">Last Run</p>
                                            <p className="text-lg font-semibold">
                                                {status?.lastRunAt 
                                                    ? new Date(status.lastRunAt).toLocaleString()
                                                    : 'Never'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <button
                                            onClick={handleRunAnalysis}
                                            disabled={isRunning || !status?.enabled}
                                            className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                                                isRunning || !status?.enabled
                                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                            }`}
                                        >
                                            {isRunning ? 'Running Analysis...' : 'Run Analysis'}
                                        </button>
                                    </div>
                                </div>

                                {/* Liquidity Score Card */}
                                <div className="bg-gray-800 rounded-lg p-6">
                                    <h3 className="text-lg font-semibold mb-4">Liquidity Score</h3>
                                    <div className="flex items-center justify-center">
                                        <div className="relative w-48 h-48">
                                            {/* Circular gauge placeholder */}
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle
                                                    cx="96"
                                                    cy="96"
                                                    r="80"
                                                    stroke="currentColor"
                                                    strokeWidth="12"
                                                    fill="none"
                                                    className="text-gray-700"
                                                />
                                                <circle
                                                    cx="96"
                                                    cy="96"
                                                    r="80"
                                                    stroke="currentColor"
                                                    strokeWidth="12"
                                                    fill="none"
                                                    strokeDasharray={`${(metrics?.avgLiquidityScore || 0) * 5.02} 502`}
                                                    className="text-blue-500 transition-all duration-1000"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-4xl font-bold">
                                                    {metrics?.avgLiquidityScore?.toFixed(1) || '0.0'}
                                                </span>
                                                <span className="text-sm text-gray-400">/ 100</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 text-center">
                                        <p className="text-sm text-gray-400 mb-2">Risk Level</p>
                                        {getRiskLevelBadge(agent.riskLevel)}
                                    </div>
                                </div>

                                {/* Key Metrics Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-800 rounded-lg p-4">
                                        <p className="text-sm text-gray-400">Avg Spread</p>
                                        <p className="text-2xl font-bold">
                                            {metrics?.avgSpread?.toFixed(3) || '0.000'}%
                                        </p>
                                    </div>
                                    <div className="bg-gray-800 rounded-lg p-4">
                                        <p className="text-sm text-gray-400">Avg Depth</p>
                                        <p className="text-2xl font-bold">
                                            ${(metrics?.avgDepth || 0).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="bg-gray-800 rounded-lg p-4">
                                        <p className="text-sm text-gray-400">Total Scans</p>
                                        <p className="text-2xl font-bold">
                                            {metrics?.totalScans || 0}
                                        </p>
                                    </div>
                                    <div className="bg-gray-800 rounded-lg p-4">
                                        <p className="text-sm text-gray-400">Active Hours</p>
                                        <p className="text-2xl font-bold">
                                            {metrics?.activeHours?.toFixed(1) || '0.0'}h
                                        </p>
                                    </div>
                                </div>

                                {/* Info Note */}
                                <div className="bg-blue-900 bg-opacity-20 border border-blue-800 rounded-lg p-4">
                                    <p className="text-sm text-blue-300">
                                        <strong>Note:</strong> Advanced visualizations (charts, order book depth, slippage heatmaps) 
                                        will be available after the first successful analysis run.
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Settings Tab */}
                        {activeTab === 'settings' && settings && (
                            <LiquiditySettings 
                                settings={settings} 
                                disabled={isLoading} 
                                onUpdate={handleUpdateSettings} 
                                t={t} 
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// 🆕 Settings Component with Golden Rule pattern (like FundamentalAgent)
const LiquiditySettings: React.FC<{
    settings: any;
    disabled: boolean;
    onUpdate: (settings: any) => void;
    t: (key: string) => string;
}> = ({ settings, disabled, onUpdate, t }) => {
    // 🆕 Track local state and dirty flag
    const [localSettings, setLocalSettings] = React.useState(settings);
    const [isDirty, setIsDirty] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    // 🆕 Sync with parent settings when it changes from outside
    React.useEffect(() => {
        setLocalSettings(settings);
        setIsDirty(false);
    }, [settings]);

    const updateField = (field: string, value: any) => {
        setLocalSettings({ ...localSettings, [field]: value });
        setIsDirty(true);
    };

    const updateAlertRule = (key: string, field: string, value: any) => {
        setLocalSettings({
            ...localSettings,
            alertRules: {
                ...localSettings.alertRules,
                [key]: {
                    ...localSettings.alertRules[key],
                    [field]: value
                }
            }
        });
        setIsDirty(true);
    };

    const updateIntegration = (key: string, value: boolean) => {
        setLocalSettings({
            ...localSettings,
            integrations: {
                ...localSettings.integrations,
                [key]: value
            }
        });
        setIsDirty(true);
    };

    // 🆕 Save handler
    const handleSave = async () => {
        if (!isDirty || isSaving) return;
        
        setIsSaving(true);
        try {
            // 🐛 DEBUG: Log settings before save
            console.log('🔍 Saving settings:', localSettings);
            
            await onUpdate(localSettings);
            setIsDirty(false);
        } catch (error) {
            console.error('Save failed:', error);
            // onUpdate will show alert
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* 🆕 Save Button - Sticky at top */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 flex items-center justify-between sticky top-0 z-10">
                <div>
                    <p className="text-white font-semibold">{t('settings') || 'Settings'}</p>
                    {isDirty && (
                        <p className="text-xs text-yellow-400 mt-1">
                            {t('unsaved_changes') || 'You have unsaved changes'}
                        </p>
                    )}
                </div>
                <button
                    onClick={handleSave}
                    disabled={!isDirty || isSaving || disabled}
                    className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                        !isDirty || isSaving || disabled
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                >
                    {isSaving ? t('saving') || 'Saving...' : t('save_changes') || 'Save Changes'}
                </button>
            </div>

            {/* General Settings */}
            <div className="bg-gray-800 rounded-lg p-5 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('general_settings') || 'General Settings'}</h3>
                
                <div>
                    <label className="flex items-center text-sm text-gray-300 gap-2 mb-3">
                        <input
                            type="checkbox"
                            disabled={disabled}
                            checked={localSettings.enabled}
                            onChange={(e) => updateField('enabled', e.target.checked)}
                            className="w-4 h-4 accent-blue-500"
                        />
                        {t('enable_agent') || 'Enable Agent'}
                    </label>
                </div>

                <div>
                    <label className="block text-sm text-gray-400 mb-2">{t('mode') || 'Mode'}</label>
                    <select
                        disabled={disabled}
                        value={localSettings.mode}
                        onChange={(e) => updateField('mode', e.target.value)}
                        className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm"
                    >
                        <option value="demo">Demo</option>
                        <option value="live">Live</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm text-gray-400 mb-2">{t('tracked_symbols') || 'Tracked Symbols'}</label>
                    <textarea
                        rows={2}
                        disabled={disabled}
                        value={localSettings.symbols.join(', ')}
                        onChange={(e) => updateField('symbols', e.target.value.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean))}
                        className="w-full p-3 bg-gray-900 border border-gray-700 rounded-md text-white text-sm"
                    />
                </div>
            </div>

            {/* Alert Rules */}
            <div className="bg-gray-800 rounded-lg p-5 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('alert_rules') || 'Alert Rules'}</h3>
                
                {Object.entries(localSettings.alertRules).map(([key, rule]: [string, any]) => (
                    <div key={key} className="border border-gray-700 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-white font-medium">{t(key) || key}</span>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    disabled={disabled}
                                    checked={rule.enabled}
                                    onChange={(e) => updateAlertRule(key, 'enabled', e.target.checked)}
                                    className="w-4 h-4 accent-blue-500"
                                />
                                <span className="text-sm text-gray-400">{t('enabled') || 'Enabled'}</span>
                            </label>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">{t('threshold') || 'Threshold'}</label>
                            <input
                                type="number"
                                step={0.1}
                                disabled={disabled}
                                value={rule.threshold}
                                onChange={(e) => updateAlertRule(key, 'threshold', parseFloat(e.target.value))}
                                className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm"
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Integrations */}
            <div className="bg-gray-800 rounded-lg p-5 space-y-4">
                <h3 className="text-lg font-semibold text-white">{t('integrations') || 'Integrations'}</h3>
                
                <label className="flex items-center text-sm text-gray-300 gap-2">
                    <input
                        type="checkbox"
                        disabled={disabled}
                        checked={localSettings.integrations.dashboard}
                        onChange={(e) => updateIntegration('dashboard', e.target.checked)}
                        className="w-4 h-4 accent-blue-500"
                    />
                    {t('dashboard') || 'Dashboard'}
                </label>

                <label className="flex items-center text-sm text-gray-300 gap-2">
                    <input
                        type="checkbox"
                        disabled={disabled}
                        checked={localSettings.integrations.telegram}
                        onChange={(e) => updateIntegration('telegram', e.target.checked)}
                        className="w-4 h-4 accent-blue-500"
                    />
                    {t('telegram') || 'Telegram'}
                </label>
            </div>
        </div>
    );
};

export default LiquidityAgentControl;
