import React, { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    TextField,
    Button,
    Typography,
    Box,
    Chip,
    Alert,
    CircularProgress,
    IconButton,
    Collapse,
    Grid,
    Divider,
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    CheckCircle,
    Error,
    Warning,
    Info,
    ExpandMore,
    ExpandLess,
    Delete,
} from '@mui/icons-material';
import * as api from '../../services/api';

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
            // Call new multi-exchange endpoint
            const response = await fetch('/api/connections/exchanges', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                setConnections(data.connections || []);
            }
        } catch (error) {
            console.error('Failed to load exchange connections:', error);
        } finally {
            setLoading(false);
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
                
                // Update connection with permissions and account info
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
                
                // Refresh health status
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
                
                // Update permissions if available
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
                
                // Reset connection
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
            return <Chip label="Not Connected" size="small" color="default" />;
        }
        
        if (!health) {
            return <Chip label="Unknown" size="small" color="default" />;
        }

        const statusConfig = {
            healthy: { label: 'Healthy', color: 'success' as const, icon: <CheckCircle fontSize="small" /> },
            stale: { label: 'Stale', color: 'warning' as const, icon: <Warning fontSize="small" /> },
            error: { label: 'Error', color: 'error' as const, icon: <Error fontSize="small" /> },
        };

        const config = statusConfig[health.status];
        
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                    label={config.label} 
                    size="small" 
                    color={config.color}
                    icon={config.icon}
                />
                {health.minutesSinceSync !== null && (
                    <Typography variant="caption" color="text.secondary">
                        {health.minutesSinceSync < 1 
                            ? 'Just now' 
                            : `${health.minutesSinceSync}m ago`}
                    </Typography>
                )}
            </Box>
        );
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Exchange Connections
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Connect your exchange accounts to enable automated trading. Your API keys are stored securely.
            </Typography>

            {connections.map((connection) => {
                const isExpanded = expandedExchange === connection.exchange;
                const showSecret = showSecrets[connection.exchange] || false;
                const message = messages[connection.exchange];

                return (
                    <Card key={connection.exchange} sx={{ mb: 2 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isExpanded ? 2 : 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                                    <Typography variant="h3" component="span">
                                        {EXCHANGE_ICONS[connection.exchange]}
                                    </Typography>
                                    <Box>
                                        <Typography variant="h6" sx={{ color: EXCHANGE_COLORS[connection.exchange] }}>
                                            {connection.exchange}
                                        </Typography>
                                        {renderHealthIndicator(connection.exchange)}
                                    </Box>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {connection.isConnected && connection.permissions.length > 0 && (
                                        <Box sx={{ display: 'flex', gap: 0.5, mr: 1 }}>
                                            {connection.permissions.map(perm => (
                                                <Chip 
                                                    key={perm} 
                                                    label={perm} 
                                                    size="small" 
                                                    variant="outlined"
                                                />
                                            ))}
                                        </Box>
                                    )}
                                    
                                    <IconButton
                                        onClick={() => setExpandedExchange(isExpanded ? null : connection.exchange)}
                                        size="small"
                                    >
                                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                                    </IconButton>
                                </Box>
                            </Box>

                            <Collapse in={isExpanded}>
                                <Divider sx={{ my: 2 }} />
                                
                                {message && (
                                    <Alert severity={message.type} sx={{ mb: 2 }}>
                                        {message.text}
                                    </Alert>
                                )}

                                <Grid container spacing={2}>
                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            label="API Key"
                                            value={connection.apiKey}
                                            onChange={(e) => {
                                                setConnections(prev => prev.map(c =>
                                                    c.exchange === connection.exchange
                                                        ? { ...c, apiKey: e.target.value }
                                                        : c
                                                ));
                                            }}
                                            placeholder="Enter your API key"
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            label="API Secret"
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
                                            InputProps={{
                                                endAdornment: (
                                                    <IconButton
                                                        onClick={() => setShowSecrets(prev => ({
                                                            ...prev,
                                                            [connection.exchange]: !showSecret
                                                        }))}
                                                        edge="end"
                                                        size="small"
                                                    >
                                                        {showSecret ? <VisibilityOff /> : <Visibility />}
                                                    </IconButton>
                                                ),
                                            }}
                                        />
                                    </Grid>

                                    {connection.accountInfo?.currencies && connection.accountInfo.currencies.length > 0 && (
                                        <Grid item xs={12}>
                                            <Alert severity="info" icon={<Info />}>
                                                <Typography variant="body2">
                                                    <strong>Account Info:</strong> {connection.accountInfo.totalBalance || 0} assets with balance
                                                </Typography>
                                                <Typography variant="caption">
                                                    Currencies: {connection.accountInfo.currencies.join(', ')}
                                                </Typography>
                                            </Alert>
                                        </Grid>
                                    )}

                                    <Grid item xs={12}>
                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                            <Button
                                                variant="contained"
                                                onClick={() => handleSaveConnection(connection.exchange)}
                                                disabled={savingExchange === connection.exchange || !connection.apiKey || !connection.apiSecret}
                                            >
                                                {savingExchange === connection.exchange ? (
                                                    <CircularProgress size={20} />
                                                ) : (
                                                    'Save & Test'
                                                )}
                                            </Button>

                                            <Button
                                                variant="outlined"
                                                onClick={() => handleTestConnection(connection.exchange)}
                                                disabled={testingExchange === connection.exchange || !connection.apiKey || !connection.apiSecret}
                                            >
                                                {testingExchange === connection.exchange ? (
                                                    <CircularProgress size={20} />
                                                ) : (
                                                    'Test Connection'
                                                )}
                                            </Button>

                                            {connection.isConnected && (
                                                <Button
                                                    variant="outlined"
                                                    color="error"
                                                    startIcon={<Delete />}
                                                    onClick={() => handleDeleteConnection(connection.exchange)}
                                                >
                                                    Delete
                                                </Button>
                                            )}
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Collapse>
                        </CardContent>
                    </Card>
                );
            })}
        </Box>
    );
}
