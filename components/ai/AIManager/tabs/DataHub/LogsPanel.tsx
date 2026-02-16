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
    const [telegramOnlyFilter, setTelegramOnlyFilter] = useState(false); // TASK-DHT-050
    const [visibleLogs, setVisibleLogs] = useState(50);

    // Helper function to translate Telegram error codes (TASK-DHT-051)
    const translateTelegramError = (errorMessage: string | undefined): { original: string; translated: string } => {
        if (!errorMessage) return { original: '', translated: '' };
        
        const errorLower = errorMessage.toLowerCase();
        const translations: Record<string, string> = {
            'flood': t('telegram_error_flood_wait') || 'Telegram has restricted requests. Please wait before retrying.',
            'flood_wait': t('telegram_error_flood_wait') || 'Telegram has restricted requests. Please wait before retrying.',
            'phone_code_invalid': t('telegram_error_code_invalid') || 'The verification code is invalid.',
            'phone_code_expired': t('telegram_error_code_expired') || 'The verification code has expired.',
            'username_invalid': t('telegram_error_username_invalid') || 'The Telegram username is invalid.',
            'session_password_needed': t('telegram_error_password_required') || 'Two-factor password is required.',
            'phone_number_invalid': t('telegram_error_phone_invalid') || 'The phone number is invalid.',
            'user_deleted': t('telegram_error_user_deleted') || 'The Telegram user account has been deleted.',
            'channel_private': t('telegram_error_channel_private') || 'The channel is private and requires authentication.',
        };

        for (const [key, translation] of Object.entries(translations)) {
            if (errorLower.includes(key)) {
                return { original: errorMessage, translated: translation };
            }
        }

        return { original: errorMessage, translated: errorMessage };
    };

    const filteredLogs = useMemo(() => {
        let logs = accessLogs;
        
        // Telegram-only filter (TASK-DHT-050)
        if (telegramOnlyFilter) {
            logs = logs.filter(log =>
                log.dataType?.toLowerCase().includes('telegram') ||
                log.sourceId?.toLowerCase().includes('telegram') ||
                log.error?.toLowerCase().includes('telegram') ||
                log.error?.toLowerCase().includes('flood') ||
                log.error?.toLowerCase().includes('phone_code')
            );
        }
        
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
    }, [accessLogs, logsSourceFilter, logsAgentFilter, logsStatusFilter, telegramOnlyFilter]);

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
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Telegram-only filter preset button (TASK-DHT-050) */}
                        <button
                            onClick={() => setTelegramOnlyFilter(!telegramOnlyFilter)}
                            className={`text-[11px] px-3 py-1.5 rounded-full border transition ${
                                telegramOnlyFilter
                                    ? 'border-sky-500/70 bg-sky-500/15 text-sky-200'
                                    : 'border-slate-600/70 bg-slate-900/70 text-foreground hover:border-sky-400'
                            }`}
                        >
                            {telegramOnlyFilter ? (
                                <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block mr-1" />
                                    {t('telegram_logs_only') || 'Telegram Only'} ✓
                                </>
                            ) : (
                                <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block mr-1" />
                                    {t('telegram_logs_only') || 'Telegram Only'}
                                </>
                            )}
                        </button>
                        
                        <input
                            value={logsSourceFilter}
                            onChange={e => setLogsSourceFilter(e.target.value)}
                            placeholder={t('log_filter_source_placeholder') || 'Source or data type'}
                            className="text-[11px] px-3 py-1.5 bg-background border border-border rounded text-foreground"
                        />
                        <input
                            value={logsAgentFilter}
                            onChange={e => setLogsAgentFilter(e.target.value)}
                            placeholder={t('log_filter_agent_placeholder') || 'Agent'}
                            className="text-[11px] px-3 py-1.5 bg-background border border-border rounded text-foreground"
                        />
                        <select
                            value={logsStatusFilter}
                            onChange={e => setLogsStatusFilter(e.target.value as typeof logsStatusFilter)}
                            className="text-[11px] px-3 py-1.5 bg-background border border-border rounded text-foreground"
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
                                setTelegramOnlyFilter(false);
                            }}
                            className="text-[11px] px-3 py-1.5 border border-border rounded text-muted-foreground hover:text-foreground transition"
                        >
                            {t('reset_filters') || 'Reset'}
                        </button>
                        <button
                            onClick={() => downloadCSV(filteredLogs, 'access-logs')}
                            className="text-[11px] px-3 py-1.5 bg-secondary hover:bg-accent text-secondary-foreground font-semibold rounded transition-colors"
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
                        visibleFilteredLogs.map(log => {
                            const isTelegramLog = log.dataType?.toLowerCase().includes('telegram') ||
                                log.sourceId?.toLowerCase().includes('telegram') ||
                                log.error?.toLowerCase().includes('telegram') ||
                                log.error?.toLowerCase().includes('flood') ||
                                log.error?.toLowerCase().includes('phone_code');
                            
                            const errorTranslation = log.error ? translateTelegramError(log.error) : null;
                            const hasTranslatedError = errorTranslation && errorTranslation.translated !== errorTranslation.original;

                            return (
                                <div 
                                    key={log.id} 
                                    className={`border rounded-lg p-3 text-xs transition-colors ${
                                        isTelegramLog
                                            ? 'border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-slate-950/90 to-slate-900/80 hover:border-sky-500/60'
                                            : 'border-border bg-background/50'
                                    }`}
                                >
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold text-foreground">{t('agent') || 'Agent'}: {log.agentId}</p>
                                                {isTelegramLog && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/40">
                                                        {t('telegram') || 'Telegram'}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-muted-foreground text-[11px]">
                                                {t('source') || 'Source'}: {log.sourceId} • {t('data_type') || 'Data Type'}: {log.dataType}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                                            log.status === 'success' ? 'bg-green-500/15 text-green-300' :
                                            log.status === 'cached' ? 'bg-blue-500/15 text-blue-300' :
                                            log.status === 'timeout' ? 'bg-amber-500/15 text-amber-300' :
                                            'bg-red-500/15 text-red-300'
                                        }`}>
                                            {t(log.status) || log.status}
                                        </span>
                                    </div>
                                    {log.error && (
                                        <div className="mt-2 pt-2 border-t border-slate-800/60">
                                            <p className="text-[11px] text-red-300 font-mono break-words">
                                                {hasTranslatedError ? errorTranslation!.translated : log.error}
                                            </p>
                                            {hasTranslatedError && (
                                                <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                                                    {t('original_error') || 'Original'}: {errorTranslation!.original}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
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
