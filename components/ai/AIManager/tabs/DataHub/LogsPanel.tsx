import React, { useMemo, useState } from 'react';
import { DataAccessLog } from '../../../../../types';
import ApiWrapper from '../../../../common/ApiWrapper';

interface LogsPanelProps {
    t: (key: string) => string;
    accessLogs: DataAccessLog[];
    logStatusCounts: Record<string, number>;
    downloadCSV: (data: any[], filename: string) => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
    isLoading?: boolean;
    error?: string | null;
    setError?: (err: string | null) => void;
}

const LogsPanel: React.FC<LogsPanelProps> = ({ t, accessLogs, logStatusCounts, downloadCSV, Card, isLoading = false, error = null, setError = () => { } }) => {
    const [logsSourceFilter, setLogsSourceFilter] = useState('');
    const [logsAgentFilter, setLogsAgentFilter] = useState('');
    const [logsStatusFilter, setLogsStatusFilter] = useState<'all' | 'success' | 'cached' | 'failed' | 'timeout'>('all');
    const [visibleLogs, setVisibleLogs] = useState(50);

    const filteredLogs = useMemo(() => {
        let logs = accessLogs;
        if (logsSourceFilter.trim()) {
            const query = logsSourceFilter.trim().toLowerCase();
            logs = logs.filter(log =>
                log.sourceId.toLowerCase().includes(query) ||
                log.dataType.toLowerCase().includes(query),
            );
        }
        if (logsAgentFilter.trim()) {
            const query = logsAgentFilter.trim().toLowerCase();
            logs = logs.filter(log => log.agentId.toLowerCase().includes(query));
        }
        if (logsStatusFilter !== 'all') {
            logs = logs.filter(log => log.status === logsStatusFilter);
        }
        return logs;
    }, [accessLogs, logsSourceFilter, logsAgentFilter, logsStatusFilter]);

    const visibleFilteredLogs = useMemo(
        () => filteredLogs.slice(0, visibleLogs),
        [filteredLogs, visibleLogs],
    );

    return (
        <ApiWrapper
            error={error}
            setError={setError}
            isLoading={isLoading && accessLogs.length === 0}
        >
            <Card>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('access_logs') || 'Access Logs'}</h3>
                        <p className="text-xs text-muted-foreground">
                            {t('access_logs_desc') || 'Filter by source, agent or status to debug requests quickly.'}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs w-full lg:w-auto">
                        <input
                            value={logsSourceFilter}
                            onChange={e => setLogsSourceFilter(e.target.value)}
                            placeholder={t('log_filter_source_placeholder') || 'Source or data type'}
                            className="px-3 py-2 bg-background border border-border rounded text-foreground"
                        />
                        <input
                            value={logsAgentFilter}
                            onChange={e => setLogsAgentFilter(e.target.value)}
                            placeholder={t('log_filter_agent_placeholder') || 'Agent'}
                            className="px-3 py-2 bg-background border border-border rounded text-foreground"
                        />
                        <select
                            value={logsStatusFilter}
                            onChange={e => setLogsStatusFilter(e.target.value as typeof logsStatusFilter)}
                            className="px-3 py-2 bg-background border border-border rounded text-foreground"
                        >
                            <option value="all">{t('status_all') || 'All statuses'}</option>
                            <option value="success">{t('success') || 'Success'}</option>
                            <option value="cached">{t('cached') || 'Cached'}</option>
                            <option value="failed">{t('failed') || 'Failed'}</option>
                            <option value="timeout">{t('timeout') || 'Timeout'}</option>
                        </select>
                        <button
                            onClick={() => {
                                setLogsSourceFilter('');
                                setLogsAgentFilter('');
                                setLogsStatusFilter('all');
                            }}
                            className="px-3 py-2 border border-border rounded text-muted-foreground hover:text-foreground transition"
                        >
                            {t('reset_filters') || 'Reset'}
                        </button>
                        <button
                            onClick={() => downloadCSV(filteredLogs, 'access-logs')}
                            className="bg-secondary hover:bg-accent text-secondary-foreground font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                        >
                            {t('export_csv') || 'Export CSV'}
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
                    {['success', 'cached', 'failed', 'timeout'].map(status => (
                        <div key={status} className="bg-secondary/40 rounded p-3">
                            <p className="text-muted-foreground capitalize">{t(status) || status}</p>
                            <p className="text-xl font-semibold text-foreground">{logStatusCounts[status] || 0}</p>
                        </div>
                    ))}
                </div>
                <div className="space-y-2 max-h-[32rem] overflow-y-auto">
                    {visibleFilteredLogs.length > 0 ? (
                        visibleFilteredLogs.map(log => (
                            <div key={log.id} className="border border-border rounded p-3 text-xs">
                                <div className="flex justify-between items-center gap-3">
                                    <div>
                                        <p className="font-semibold text-foreground">{t('agent') || 'Agent'}: {log.agentId}</p>
                                        <p className="text-muted-foreground">
                                            {t('source') || 'Source'}: {log.sourceId} • {t('data_type') || 'Data Type'}: {log.dataType}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs ${log.status === 'success' ? 'bg-green-500/20 text-green-400' :
                                        log.status === 'cached' ? 'bg-blue-500/20 text-blue-400' :
                                            log.status === 'timeout' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-red-500/20 text-red-400'
                                        }`}>
                                        {t(log.status) || log.status}
                                    </span>
                                </div>
                                {log.error && (
                                    <p className="mt-2 text-[11px] text-red-400">{log.error}</p>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-10">{t('no_logs') || 'No access logs yet'}</p>
                    )}
                </div>
                {visibleLogs < filteredLogs.length && (
                    <div className="text-center mt-4">
                        <button
                            onClick={() => setVisibleLogs(prev => prev + 50)}
                            className="text-xs px-4 py-2 border border-border rounded hover:bg-secondary/30 transition"
                        >
                            {t('load_more') || 'Load more'}
                        </button>
                    </div>
                )}
            </Card>
        </ApiWrapper>
    );
};

export default LogsPanel;
