import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchArtemisLogsFromServer } from '../../../../services/api-backend.ts';
import { ArtemisLog, ArtemisState } from '../../../../types.ts';

type Props = {
    artemis: ArtemisState;
    t: (key: string) => string;
    onRefresh: () => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
};

const SystemLogsTab: React.FC<Props> = ({ artemis, t, onRefresh, Card }) => {
    if (!artemis) {
        return (
            <Card>
                <div className="text-center p-10">{t('loading') || 'Loading...'}</div>
            </Card>
        );
    }

    const [logs, setLogs] = useState<ArtemisLog[]>([]);
    const [typeFilter, setTypeFilter] = useState<'all' | 'command' | 'decision' | 'trade' | 'error' | 'system' | 'config_change'>('all');
    const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'critical'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState<ArtemisLog | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(30); // seconds
    const logsPerPage = 50;

    const loadLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const filter: any = {};
            if (typeFilter !== 'all') {
                filter.filter = typeFilter;
            }
            if (levelFilter !== 'all') {
                filter.level = levelFilter;
            }
            filter.limit = logsPerPage * currentPage;
            
            // Use backend API instead of IndexedDB
            const data = await fetchArtemisLogsFromServer(filter);
            setLogs(data);
        } catch (e) {
            console.error('Failed to load logs from server:', e);
            // Show error to user
            setLogs([]);
        } finally {
            setIsLoading(false);
        }
    }, [typeFilter, levelFilter, currentPage]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(() => {
                loadLogs();
            }, autoRefreshInterval * 1000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, autoRefreshInterval, loadLogs]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                if (
                    !log.action.toLowerCase().includes(query) &&
                    !log.source.toLowerCase().includes(query) &&
                    !(log.details && JSON.stringify(log.details).toLowerCase().includes(query))
                ) {
                    return false;
                }
            }
            return true;
        });
    }, [logs, searchQuery]);

    const displayedLogs = useMemo(() => {
        return filteredLogs.slice(0, currentPage * logsPerPage);
    }, [filteredLogs, currentPage]);

    const logStats = useMemo(() => {
        return {
            total: logs.length,
            errors: logs.filter(l => l.level === 'error' || l.level === 'critical').length,
            warnings: logs.filter(l => l.level === 'warning').length,
            info: logs.filter(l => l.level === 'info').length,
        };
    }, [logs]);

    const handleExportLogs = () => {
        const dataStr = JSON.stringify(filteredLogs, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `artemis-logs-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleClearLogs = async () => {
        if (!window.confirm(t('clear_logs_confirm') || 'Are you sure you want to clear all logs? This action cannot be undone.')) {
            return;
        }
        try {
            await api.clearArtemisLogs();
            setLogs([]);
            alert(t('logs_cleared') || 'Logs cleared successfully');
            loadLogs();
            onRefresh();
        } catch (e) {
            console.error('Failed to clear logs:', e);
            alert(t('clear_logs_failed') || 'Failed to clear logs');
        }
    };

    const formatTimeAgo = (timestamp: string) => {
        const now = Date.now();
        const time = new Date(timestamp).getTime();
        const diff = now - time;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return t('just_now') || 'Just now';
    };

    if (isLoading && logs.length === 0) {
        return (
            <Card>
                <div className="text-center p-10">{t('loading') || 'Loading...'}</div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('system_logs') || 'System Logs'}</h3>
                        <p className="text-xs text-muted-foreground">
                            {t('logs_desc') || 'View and manage system activity logs'}
                        </p>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <span className="text-muted-foreground">{t('auto_refresh') || 'Auto Refresh'}</span>
                        </label>
                        {autoRefresh && (
                            <select
                                value={autoRefreshInterval}
                                onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value))}
                                className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                            >
                                <option value="10">10s</option>
                                <option value="30">30s</option>
                                <option value="60">1m</option>
                                <option value="300">5m</option>
                            </select>
                        )}
                        <button
                            onClick={handleExportLogs}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('export_logs') || 'Export'}
                        </button>
                        <button
                            onClick={handleClearLogs}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('clear_logs') || 'Clear'}
                        </button>
                    </div>
                </div>

                {logs.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('total_logs') || 'Total'}</p>
                            <p className="text-xl font-semibold text-foreground">{logStats.total}</p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('errors') || 'Errors'}</p>
                            <p className="text-xl font-semibold text-red-400">{logStats.errors}</p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('warnings') || 'Warnings'}</p>
                            <p className="text-xl font-semibold text-yellow-400">{logStats.warnings}</p>
                        </div>
                        <div className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground text-xs">{t('info') || 'Info'}</p>
                            <p className="text-xl font-semibold text-blue-400">{logStats.info}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <select
                        value={typeFilter}
                        onChange={(e) => {
                            setTypeFilter(e.target.value as any);
                            setCurrentPage(1);
                        }}
                        className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                    >
                        <option value="all">{t('all_types') || 'All Types'}</option>
                        <option value="command">{t('commands') || 'Commands'}</option>
                        <option value="decision">{t('decisions') || 'Decisions'}</option>
                        <option value="trade">{t('trades') || 'Trades'}</option>
                        <option value="error">{t('errors') || 'Errors'}</option>
                        <option value="system">{t('system') || 'System'}</option>
                        <option value="config_change">{t('config_change') || 'Config Change'}</option>
                    </select>
                    <select
                        value={levelFilter}
                        onChange={(e) => {
                            setLevelFilter(e.target.value as any);
                            setCurrentPage(1);
                        }}
                        className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                    >
                        <option value="all">{t('all_levels') || 'All Levels'}</option>
                        <option value="info">{t('info') || 'Info'}</option>
                        <option value="warning">{t('warning') || 'Warning'}</option>
                        <option value="error">{t('error') || 'Error'}</option>
                        <option value="critical">{t('critical') || 'Critical'}</option>
                    </select>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('search_logs') || 'Search logs...'}
                        className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                    />
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {displayedLogs.length > 0 ? (
                        displayedLogs.map(log => (
                            <div
                                key={log.id}
                                className={`p-3 border rounded-lg text-sm hover:border-purple-500/50 transition-colors cursor-pointer ${
                                    log.level === 'error' || log.level === 'critical'
                                        ? 'border-red-500/30 bg-red-500/10'
                                        : log.level === 'warning'
                                        ? 'border-yellow-500/30 bg-yellow-500/10'
                                        : 'border-border'
                                }`}
                                onClick={() => setSelectedLog(log)}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span
                                                className={`px-2 py-0.5 rounded text-xs ${
                                                    log.level === 'error' || log.level === 'critical'
                                                        ? 'bg-red-500/20 text-red-400'
                                                        : log.level === 'warning'
                                                        ? 'bg-yellow-500/20 text-yellow-400'
                                                        : log.level === 'info'
                                                        ? 'bg-blue-500/20 text-blue-400'
                                                        : 'bg-gray-500/20 text-gray-400'
                                                }`}
                                            >
                                                {t(log.level) || log.level}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{t(log.type) || log.type}</span>
                                            {log.agentId && (
                                                <span className="text-xs text-muted-foreground">
                                                    {t('agent') || 'Agent'}: {log.agentId}
                                                </span>
                                            )}
                                        </div>
                                        <p className="font-semibold text-foreground">{log.action}</p>
                                        {log.details && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {JSON.stringify(log.details).substring(0, 150)}...
                                            </p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('source') || 'Source'}: {t(log.source) || log.source} · {formatTimeAgo(log.timestamp)}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {log.result && (
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs ${
                                                    log.result === 'success'
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : log.result === 'failed'
                                                        ? 'bg-red-500/20 text-red-400'
                                                        : 'bg-gray-500/20 text-gray-400'
                                                }`}
                                            >
                                                {t(log.result) || log.result}
                                            </span>
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-10">
                            {t('no_logs_found') || 'No logs found.'}
                        </p>
                    )}
                </div>

                {filteredLogs.length > displayedLogs.length && (
                    <div className="flex justify-center mt-4">
                        <button
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-sm"
                        >
                            {t('load_more') || 'Load More'} ({filteredLogs.length - displayedLogs.length}{' '}
                            {t('remaining') || 'remaining'})
                        </button>
                    </div>
                )}
            </Card>

            {selectedLog && (
                <LogDetailsModal
                    log={selectedLog}
                    onClose={() => setSelectedLog(null)}
                    t={t}
                />
            )}
        </div>
    );
};

const LogDetailsModal: React.FC<{
    log: ArtemisLog;
    onClose: () => void;
    t: (key: string) => string;
}> = ({ log, onClose, t }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">{log.action}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('log_details') || 'Log Details'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
                        {t('close') || 'Close'}
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('level') || 'Level'}</p>
                            <span
                                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                    log.level === 'error' || log.level === 'critical'
                                        ? 'bg-red-500/20 text-red-400'
                                        : log.level === 'warning'
                                        ? 'bg-yellow-500/20 text-yellow-400'
                                        : log.level === 'info'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'bg-gray-500/20 text-gray-400'
                                }`}
                            >
                                {t(log.level) || log.level}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('type') || 'Type'}</p>
                            <p className="text-sm font-semibold text-foreground">{t(log.type) || log.type}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('source') || 'Source'}</p>
                            <p className="text-sm font-semibold text-foreground">{t(log.source) || log.source}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">{t('timestamp') || 'Timestamp'}</p>
                            <p className="text-sm font-semibold text-foreground">
                                {new Date(log.timestamp).toLocaleString()}
                            </p>
                        </div>
                        {log.agentId && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">{t('agent') || 'Agent'}</p>
                                <p className="text-sm font-semibold text-foreground">{log.agentId}</p>
                            </div>
                        )}
                        {log.userId && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">{t('user') || 'User'}</p>
                                <p className="text-sm font-semibold text-foreground">{log.userId}</p>
                            </div>
                        )}
                        {log.result && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">{t('result') || 'Result'}</p>
                                <span
                                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                        log.result === 'success'
                                            ? 'bg-green-500/20 text-green-400'
                                            : log.result === 'failed'
                                            ? 'bg-red-500/20 text-red-400'
                                            : 'bg-gray-500/20 text-gray-400'
                                    }`}
                                >
                                    {t(log.result) || log.result}
                                </span>
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="text-xs text-muted-foreground mb-2">{t('action') || 'Action'}</p>
                        <p className="text-sm font-semibold text-foreground bg-secondary/40 p-3 rounded border border-border">
                            {log.action}
                        </p>
                    </div>

                    {log.details && (
                        <div>
                            <p className="text-xs text-muted-foreground mb-2">{t('details') || 'Details'}</p>
                            <pre className="text-xs text-foreground bg-secondary/40 p-3 rounded border border-border overflow-x-auto font-mono">
                                {JSON.stringify(log.details, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SystemLogsTab;

