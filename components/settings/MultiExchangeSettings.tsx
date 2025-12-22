import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../../services/api-auth.ts';

interface ExchangeConnection {
    exchange: string;
    apiKey: string;
    apiSecret: string;
    isConnected: boolean;
    isTestnet: boolean;
    lastSyncAt: string | null;
    permissions: string[];
    accountInfo: {
        totalBalance?: number;
        currencies?: string[];
    };
}

interface HealthStatus {
    exchange: string;
    status: 'healthy' | 'stale' | 'error';
    lastSync: string | null;
    minutesSinceSync: number | null;
    accountInfo: any;
}

const EXCHANGE_ICONS: Record<string, string> = {
    'MEXC': '🟣',
    'Binance': '🟡',
    'Bybit': '🟠',
    'KuCoin': '🟢',
    'Gate.io': '🔵',
};

const EXCHANGE_COLORS: Record<string, string> = {
    'MEXC': '#9c27b0',
    'Binance': '#f0b90b',
    'Bybit': '#ff6600',
    'KuCoin': '#24ae8f',
    'Gate.io': '#2354e6',
};

export default function MultiExchangeSettings() {
    const [connections, setConnections] = useState<ExchangeConnection[]>([]);
    const [healthStatus, setHealthStatus] = useState<HealthStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedExchange, setExpandedExchange] = useState<string | null>(null);
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [testingExchange, setTestingExchange] = useState<string | null>(null);
    const [savingExchange, setSavingExchange] = useState<string | null>(null);
    const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error' | 'info'; text: string }>>({});

    useEffect(() => {
        loadConnections();
        loadHealthStatus();
        
        // Refresh health status every 30 seconds
        const interval = setInterval(loadHealthStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadConnections = async () => {
        try {
            setLoading(true);
            console.log('MultiExchange: Loading connections via authenticatedFetch...');

            // استفاده از همان مکانیزم احراز هویت سراسری
            const response = await authenticatedFetch('/connections/exchanges', {
                method: 'GET',
            });
            
            console.log('MultiExchange: Response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('MultiExchange: Loaded connections:', data);
                setConnections(data.connections || []);
            } else {
                console.error('MultiExchange: Failed to load, status:', response.status);
                // Set empty connections to show UI anyway
                setConnections([]);
            }
        } catch (error) {
            console.error('Failed to load exchange connections:', error);
            // Set empty connections to show UI anyway
            setConnections([]);
        } finally {
            setLoading(false);
            console.log('MultiExchange: Loading complete, loading =', false);
        }
    };

    const loadHealthStatus = async () => {
        try {
            const response = await fetch('/api/connections/exchanges/health/status', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                setHealthStatus(data.health || []);
            }
        } catch (error) {
            console.error('Failed to load health status:', error);
        }
    };

    const handleSaveConnection = async (exchangeName: string) => {
        const connection = connections.find(c => c.exchange === exchangeName);
        if (!connection || !connection.apiKey || !connection.apiSecret) {
            setMessages(prev => ({
                ...prev,
                [exchangeName]: { type: 'error', text: 'API Key and Secret are required' }
            }));
            return;
        }

        try {
            setSavingExchange(exchangeName);
            const response = await fetch(`/api/connections/exchanges/${exchangeName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    apiKey: connection.apiKey,
                    apiSecret: connection.apiSecret,
                    isTestnet: connection.isTestnet,
                }),
            });

            const result = await response.json();
            
            if (response.ok && result.success) {
                setMessages(prev => ({
                    ...prev,
                    [exchangeName]: { type: 'success', text: result.message }
                }));
                
                setConnections(prev => prev.map(c => 
                    c.exchange === exchangeName 
                        ? { 
                            ...c, 
                            isConnected: result.isConnected,
                            permissions: result.permissions || [],
                            accountInfo: result.accountInfo || {},
                        } 
                        : c
                ));
                
                await loadHealthStatus();
            } else {
                setMessages(prev => ({
                    ...prev,
                    [exchangeName]: { type: 'error', text: result.error || 'Failed to save connection' }
                }));
            }
        } catch (error) {
            setMessages(prev => ({
                ...prev,
                [exchangeName]: { type: 'error', text: 'Failed to save connection' }
            }));
        } finally {
            setSavingExchange(null);
        }
    };

    const handleTestConnection = async (exchangeName: string) => {
        const connection = connections.find(c => c.exchange === exchangeName);
        if (!connection || !connection.apiKey || !connection.apiSecret) {
            setMessages(prev => ({
                ...prev,
                [exchangeName]: { type: 'error', text: 'API Key and Secret are required' }
            }));
            return;
        }

        try {
            setTestingExchange(exchangeName);
            const response = await fetch(`/api/connections/exchanges/${exchangeName}/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    apiKey: connection.apiKey,
                    apiSecret: connection.apiSecret,
                    isTestnet: connection.isTestnet,
                }),
            });

            const result = await response.json();
            
            if (result.success) {
                setMessages(prev => ({
                    ...prev,
                    [exchangeName]: { type: 'success', text: '✅ Connection successful!' }
                }));
                
                if (result.permissions) {
                    setConnections(prev => prev.map(c => 
                        c.exchange === exchangeName 
                            ? { ...c, permissions: result.permissions, accountInfo: result.accountInfo || {} } 
                            : c
                    ));
                }
            } else {
                setMessages(prev => ({
                    ...prev,
                    [exchangeName]: { type: 'error', text: `❌ ${result.message || 'Connection failed'}` }
                }));
            }
        } catch (error) {
            setMessages(prev => ({
                ...prev,
                [exchangeName]: { type: 'error', text: '❌ Failed to test connection' }
            }));
        } finally {
            setTestingExchange(null);
        }
    };

    const handleDeleteConnection = async (exchangeName: string) => {
        if (!confirm(`Are you sure you want to delete ${exchangeName} connection?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/connections/exchanges/${exchangeName}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });

            if (response.ok) {
                setMessages(prev => ({
                    ...prev,
                    [exchangeName]: { type: 'info', text: 'Connection deleted' }
                }));
                
                setConnections(prev => prev.map(c => 
                    c.exchange === exchangeName 
                        ? { 
                            ...c, 
                            apiKey: '', 
                            apiSecret: '', 
                            isConnected: false, 
                            permissions: [], 
                            accountInfo: {} 
                        } 
                        : c
                ));
                
                await loadHealthStatus();
            }
        } catch (error) {
            setMessages(prev => ({
                ...prev,
                [exchangeName]: { type: 'error', text: 'Failed to delete connection' }
            }));
        }
    };

    const getHealthStatusForExchange = (exchangeName: string) => {
        return healthStatus.find(h => h.exchange === exchangeName);
    };

    const renderHealthIndicator = (exchangeName: string) => {
        const health = getHealthStatusForExchange(exchangeName);
        const connection = connections.find(c => c.exchange === exchangeName);
        
        if (!connection?.isConnected) {
            return <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">Not Connected</span>;
        }
        
        if (!health) {
            return <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">Unknown</span>;
        }

        const statusConfig = {
            healthy: { label: 'Healthy', color: 'bg-green-500/20 text-green-400', icon: '✓' },
            stale: { label: 'Stale', color: 'bg-yellow-500/20 text-yellow-400', icon: '⚠' },
            error: { label: 'Error', color: 'bg-red-500/20 text-red-400', icon: '✕' },
        };

        const config = statusConfig[health.status];
        
        return (
            <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs rounded ${config.color}`}>
                    {config.icon} {config.label}
                </span>
                {health.minutesSinceSync !== null && (
                    <span className="text-xs text-gray-400">
                        {health.minutesSinceSync < 1 
                            ? 'Just now' 
                            : `${health.minutesSinceSync}m ago`}
                    </span>
                )}
            </div>
        );
    };

    if (loading) {
        console.log('MultiExchange: Rendering loading state');
        return (
            <div className="bg-[#161B22] border border-gray-800 rounded-lg p-8">
                <div className="flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span className="ml-3 text-gray-400">Loading exchanges...</span>
                </div>
            </div>
        );
    }

    console.log('MultiExchange: Rendering main content, connections:', connections.length);

    return (
        <div className="bg-[#161B22] border border-gray-800 rounded-lg">
            <div className="p-6 border-b border-gray-800">
                <h3 className="text-lg font-semibold text-white">Exchange Connections</h3>
                <p className="text-sm text-gray-400 mt-1">
                    Connect your exchange accounts to enable automated trading. Your API keys are stored securely.
                </p>
            </div>
            
            <div className="p-6 space-y-4">
                {connections.map((connection) => {
                    const isExpanded = expandedExchange === connection.exchange;
                    const showSecret = showSecrets[connection.exchange] || false;
                    const message = messages[connection.exchange];

                    return (
                        <div key={connection.exchange} className="bg-[#0D111C] border border-gray-700 rounded-lg overflow-hidden">
                            {/* Header */}
                            <div 
                                className="p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                                onClick={() => setExpandedExchange(isExpanded ? null : connection.exchange)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1">
                                        <span className="text-3xl">{EXCHANGE_ICONS[connection.exchange]}</span>
                                        <div className="flex-1">
                                            <h4 
                                                className="font-semibold text-lg"
                                                style={{ color: EXCHANGE_COLORS[connection.exchange] }}
                                            >
                                                {connection.exchange}
                                            </h4>
                                            {renderHealthIndicator(connection.exchange)}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {connection.isConnected && connection.permissions.length > 0 && (
                                            <div className="flex gap-1 mr-2">
                                                {connection.permissions.map(perm => (
                                                    <span 
                                                        key={perm} 
                                                        className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded border border-blue-500/30"
                                                    >
                                                        {perm}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        
                                        <svg 
                                            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div className="p-4 border-t border-gray-700 space-y-4">
                                    {message && (
                                        <div className={`p-3 rounded ${
                                            message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                            message.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                            'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        }`}>
                                            {message.text}
                                        </div>
                                    )}

                                    {/* API Key Input */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            API Key
                                        </label>
                                        <input
                                            type="text"
                                            value={connection.apiKey}
                                            onChange={(e) => {
                                                setConnections(prev => prev.map(c =>
                                                    c.exchange === connection.exchange
                                                        ? { ...c, apiKey: e.target.value }
                                                        : c
                                                ));
                                            }}
                                            placeholder="Enter your API key"
                                            className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500 text-white"
                                        />
                                    </div>

                                    {/* API Secret Input */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            API Secret
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showSecret ? 'text' : 'password'}
                                                value={connection.apiSecret}
                                                onChange={(e) => {
                                                    setConnections(prev => prev.map(c =>
                                                        c.exchange === connection.exchange
                                                            ? { ...c, apiSecret: e.target.value }
                                                            : c
                                                    ));
                                                }}
                                                placeholder="Enter your API secret"
                                                className="w-full p-2 pr-10 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500 text-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowSecrets(prev => ({
                                                    ...prev,
                                                    [connection.exchange]: !showSecret
                                                }))}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                            >
                                                {showSecret ? '👁️' : '👁️‍🗨️'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Account Info */}
                                    {connection.accountInfo?.currencies && connection.accountInfo.currencies.length > 0 && (
                                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                                            <div className="flex items-start gap-2">
                                                <span className="text-blue-400">ℹ️</span>
                                                <div className="flex-1">
                                                    <p className="text-sm text-blue-400 font-medium">
                                                        Account Info: {connection.accountInfo.totalBalance || 0} assets with balance
                                                    </p>
                                                    <p className="text-xs text-blue-300 mt-1">
                                                        Currencies: {connection.accountInfo.currencies.join(', ')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => handleSaveConnection(connection.exchange)}
                                            disabled={savingExchange === connection.exchange || !connection.apiKey || !connection.apiSecret}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors flex items-center gap-2"
                                        >
                                            {savingExchange === connection.exchange ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    Saving...
                                                </>
                                            ) : (
                                                'Save & Test'
                                            )}
                                        </button>

                                        <button
                                            onClick={() => handleTestConnection(connection.exchange)}
                                            disabled={testingExchange === connection.exchange || !connection.apiKey || !connection.apiSecret}
                                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-md transition-colors flex items-center gap-2"
                                        >
                                            {testingExchange === connection.exchange ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    Testing...
                                                </>
                                            ) : (
                                                'Test Connection'
                                            )}
                                        </button>

                                        {connection.isConnected && (
                                            <button
                                                onClick={() => handleDeleteConnection(connection.exchange)}
                                                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-md transition-colors border border-red-600/30"
                                            >
                                                🗑️ Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
