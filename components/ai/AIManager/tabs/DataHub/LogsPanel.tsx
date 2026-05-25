import React, { useMemo, useState } from 'react';
import { DataAccessLog } from '../../../../../types';
import {
    DATAHUB_SHELL,
    DATAHUB_INNER_LIST,
    INPUT_CLASS,
    SELECT_CLASS,
    BTN_PRIMARY,
    BTN_SECONDARY,
    BTN_OUTLINE_SKY,
    DataHubAlert,
    DataHubEmpty,
    MetricCard,
    StatusPill,
} from './dataHubUi';

interface LogsPanelProps {
    t: (key: string) => string;
    accessLogs: DataAccessLog[];
    logStatusCounts: Record<string, number>;
    downloadCSV: (data: any[], filename: string) => void;
    isLoading?: boolean;
    error?: string | null;
    setError?: (err: string | null) => void;
    onRetry?: () => void;
}

function logStatusVariant(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
    if (status === 'success') return 'success';
    if (status === 'failed') return 'error';
    if (status === 'timeout') return 'warning';
    if (status === 'cached') return 'info';
    return 'neutral';
}

const LogsPanel: React.FC<LogsPanelProps> = ({
    t,
    accessLogs,
    logStatusCounts,
    downloadCSV,
    isLoading = false,
    error = null,
    setError = () => {},
    onRetry,
}) => {
    const [logsSourceFilter, setLogsSourceFilter] = useState('');
    const [logsAgentFilter, setLogsAgentFilter] = useState('');
    const [logsStatusFilter, setLogsStatusFilter] = useState<'all' | 'success' | 'cached' | 'failed' | 'timeout'>(
        'all',
    );
    const [telegramOnlyFilter, setTelegramOnlyFilter] = useState(false);
    const [visibleLogs, setVisibleLogs] = useState(50);

    const translateTelegramError = (errorMessage: string | undefined): { original: string; translated: string } => {
        if (!errorMessage) return { original: '', translated: '' };

        const errorLower = errorMessage.toLowerCase();
        const rules: { match: string; key: string }[] = [
            { match: 'flood', key: 'telegram_error_flood_wait' },
            { match: 'flood_wait', key: 'telegram_error_flood_wait' },
            { match: 'phone_code_invalid', key: 'telegram_error_code_invalid' },
            { match: 'phone_code_expired', key: 'telegram_error_code_expired' },
            { match: 'username_invalid', key: 'telegram_error_username_invalid' },
            { match: 'session_password_needed', key: 'telegram_error_password_required' },
            { match: 'phone_number_invalid', key: 'telegram_error_phone_invalid' },
            { match: 'user_deleted', key: 'telegram_error_user_deleted' },
            { match: 'channel_private', key: 'telegram_error_channel_private' },
        ];

        for (const rule of rules) {
            if (errorLower.includes(rule.match)) {
                return { original: errorMessage, translated: t(rule.key) };
            }
        }

        return { original: errorMessage, translated: errorMessage };
    };

    const filteredLogs = useMemo(() => {
        let logs = accessLogs;

        if (telegramOnlyFilter) {
            logs = logs.filter(
                log =>
                    log.dataType?.toLowerCase().includes('telegram') ||
                    log.sourceId?.toLowerCase().includes('telegram') ||
                    log.error?.toLowerCase().includes('telegram') ||
                    log.error?.toLowerCase().includes('flood') ||
                    log.error?.toLowerCase().includes('phone_code'),
            );
        }

        if (logsSourceFilter.trim()) {
            const query = logsSourceFilter.trim().toLowerCase();
            logs = logs.filter(
                log =>
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

    const handleRetry = () => {
        setError(null);
        onRetry?.();
    };

    return (
        <div className={DATAHUB_SHELL}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
                <div>
                    <h3 className="text-sm md:text-base font-semibold text-foreground">{t('access_logs')}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">{t('access_logs_desc')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setTelegramOnlyFilter(!telegramOnlyFilter)}
                        className={
                            telegramOnlyFilter
                                ? 'text-[11px] px-3 py-1.5 rounded-full border border-sky-500/60 bg-sky-500/15 text-sky-200'
                                : BTN_OUTLINE_SKY
                        }
                    >
                        {telegramOnlyFilter ? t('telegram_logs_active') : t('telegram_logs_only')}
                    </button>
                    <input
                        value={logsSourceFilter}
                        onChange={e => setLogsSourceFilter(e.target.value)}
                        placeholder={t('log_filter_source_placeholder')}
                        className={`${INPUT_CLASS} max-w-[160px]`}
                    />
                    <input
                        value={logsAgentFilter}
                        onChange={e => setLogsAgentFilter(e.target.value)}
                        placeholder={t('log_filter_agent_placeholder')}
                        className={`${INPUT_CLASS} max-w-[120px]`}
                    />
                    <select
                        value={logsStatusFilter}
                        onChange={e => setLogsStatusFilter(e.target.value as typeof logsStatusFilter)}
                        className={SELECT_CLASS}
                    >
                        <option value="all">{t('status_all')}</option>
                        <option value="success">{t('success')}</option>
                        <option value="cached">{t('cached')}</option>
                        <option value="failed">{t('failed')}</option>
                        <option value="timeout">{t('timeout')}</option>
                    </select>
                    <button
                        type="button"
                        onClick={() => {
                            setLogsSourceFilter('');
                            setLogsAgentFilter('');
                            setLogsStatusFilter('all');
                            setTelegramOnlyFilter(false);
                        }}
                        className={BTN_SECONDARY}
                    >
                        {t('reset_filters')}
                    </button>
                    <button
                        type="button"
                        onClick={() => downloadCSV(filteredLogs, 'access-logs')}
                        disabled={!filteredLogs.length}
                        className={BTN_SECONDARY}
                    >
                        {t('export_csv')}
                    </button>
                </div>
            </div>

            {error && (
                <DataHubAlert
                    variant="error"
                    message={error}
                    onRetry={onRetry ? handleRetry : undefined}
                    retryLabel={t('retry')}
                />
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {(['success', 'cached', 'failed', 'timeout'] as const).map(status => (
                    <MetricCard
                        key={status}
                        label={t(status)}
                        value={logStatusCounts[status] || 0}
                        color={
                            status === 'success'
                                ? 'emerald'
                                : status === 'cached'
                                  ? 'blue'
                                  : status === 'failed'
                                    ? 'red'
                                    : 'amber'
                        }
                    />
                ))}
            </div>

            <div className={DATAHUB_INNER_LIST}>
                {isLoading && accessLogs.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">{t('logs_loading')}</div>
                ) : visibleFilteredLogs.length === 0 ? (
                    <DataHubEmpty message={t('no_logs')} />
                ) : (
                    <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
                        <table className="w-full text-[11px]">
                            <thead className="sticky top-0 bg-slate-950/95 z-10">
                                <tr className="border-b border-slate-800 text-muted-foreground text-left">
                                    <th className="py-2 pr-3">{t('agent')}</th>
                                    <th className="py-2 pr-3">{t('source')}</th>
                                    <th className="py-2 pr-3">{t('data_type')}</th>
                                    <th className="py-2 pr-3">{t('status')}</th>
                                    <th className="py-2">{t('timestamp')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleFilteredLogs.map(log => {
                                    const isTelegramLog =
                                        log.dataType?.toLowerCase().includes('telegram') ||
                                        log.sourceId?.toLowerCase().includes('telegram') ||
                                        log.error?.toLowerCase().includes('telegram') ||
                                        log.error?.toLowerCase().includes('flood') ||
                                        log.error?.toLowerCase().includes('phone_code');

                                    const errorTranslation = log.error
                                        ? translateTelegramError(log.error)
                                        : null;
                                    const hasTranslatedError =
                                        errorTranslation &&
                                        errorTranslation.translated !== errorTranslation.original;

                                    return (
                                        <React.Fragment key={log.id}>
                                            <tr
                                                className={`border-b border-slate-900/60 hover:bg-slate-900/40 ${
                                                    isTelegramLog ? 'bg-sky-500/5' : ''
                                                }`}
                                            >
                                                <td className="py-2 pr-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-medium text-foreground">
                                                            {log.agentId}
                                                        </span>
                                                        {isTelegramLog && (
                                                            <StatusPill label={t('telegram')} variant="info" />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-2 pr-3 font-mono text-[10px]">{log.sourceId}</td>
                                                <td className="py-2 pr-3 text-muted-foreground">{log.dataType}</td>
                                                <td className="py-2 pr-3">
                                                    <StatusPill
                                                        label={t(log.status)}
                                                        variant={logStatusVariant(log.status)}
                                                    />
                                                </td>
                                                <td className="py-2 text-muted-foreground whitespace-nowrap">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </td>
                                            </tr>
                                            {log.error && (
                                                <tr className="border-b border-slate-900/60 bg-red-500/5">
                                                    <td colSpan={5} className="py-2 px-1">
                                                        <p className="text-[11px] text-red-300 font-mono break-words">
                                                            {hasTranslatedError
                                                                ? errorTranslation!.translated
                                                                : log.error}
                                                        </p>
                                                        {hasTranslatedError && (
                                                            <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                                                                {t('original_error')}: {errorTranslation!.original}
                                                            </p>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {visibleLogs < filteredLogs.length && (
                <div className="text-center mt-4">
                    <button
                        type="button"
                        onClick={() => setVisibleLogs(prev => prev + 50)}
                        className={BTN_SECONDARY}
                    >
                        {t('load_more')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default LogsPanel;
