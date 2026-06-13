import React, { useMemo, useState } from 'react';
import { DataAccessLog } from '../../../../../types';
import { DataHubApiError } from '../../../../../services/dataSourcesApi';
import {
    DATAHUB_SHELL,
    DATAHUB_INNER_LIST,
    INPUT_CLASS,
    BTN_SECONDARY,
    BTN_OUTLINE_SKY,
    DataHubAlert,
    DataHubEmpty,
    MetricCard,
    StatusPill,
} from './dataHubUi';
import { formatDataHubQueryError } from './dataHubI18n';
import AccessLogDetailModal from './modals/AccessLogDetailModal';

interface LogsPanelProps {
    t: (key: string) => string;
    accessLogs: DataAccessLog[];
    logStatusCounts: Record<string, number>;
    downloadCSV: (data: any[], filename: string) => void;
    isLoading?: boolean;
    apiError?: DataHubApiError | Error | null;
    onRetry?: () => void;
    onNavigateToSource?: (sourceId: string) => void;
}

function logStatusVariant(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
    if (status === 'success') return 'success';
    if (status === 'failed') return 'error';
    if (status === 'timeout') return 'warning';
    if (status === 'cached') return 'info';
    return 'neutral';
}

function resolveSourceLabel(log: DataAccessLog, t: (key: string) => string): string {
    if (log.sourceName) return log.sourceName;
    if (log.sourceId) return t('unknown_source');
    return t('unknown_source');
}

const FILTER_SELECT_CLASS =
    'text-[11px] bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-foreground w-full min-w-0';

const LogsPanel: React.FC<LogsPanelProps> = ({
    t,
    accessLogs,
    logStatusCounts,
    downloadCSV,
    isLoading = false,
    apiError = null,
    onRetry,
    onNavigateToSource,
}) => {
    const [logsSourceFilter, setLogsSourceFilter] = useState('');
    const [logsAgentFilter, setLogsAgentFilter] = useState('');
    const [logsStatusFilter, setLogsStatusFilter] = useState<'all' | 'success' | 'cached' | 'failed' | 'timeout'>(
        'all',
    );
    const [telegramOnlyFilter, setTelegramOnlyFilter] = useState(false);
    const [visibleLogs, setVisibleLogs] = useState(50);
    const [selectedLog, setSelectedLog] = useState<DataAccessLog | null>(null);

    const filteredLogs = useMemo(() => {
        let logs = accessLogs;

        if (telegramOnlyFilter) {
            logs = logs.filter(
                log =>
                    log.dataType?.toLowerCase().includes('telegram') ||
                    log.action?.toLowerCase().includes('telegram') ||
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
                    (log.sourceName || '').toLowerCase().includes(query) ||
                    log.sourceId.toLowerCase().includes(query) ||
                    log.dataType.toLowerCase().includes(query) ||
                    (log.action || '').toLowerCase().includes(query),
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

    const queryError = formatDataHubQueryError(t, apiError);

    const handleRetry = () => {
        onRetry?.();
    };

    return (
        <div className={DATAHUB_SHELL}>
            <div className="mb-5">
                <div className="mb-4">
                    <h3 className="text-sm md:text-base font-semibold text-foreground">{t('access_logs')}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">{t('access_logs_desc')}</p>
                </div>

                <div className="space-y-3">
                    <div>
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
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        <input
                            value={logsSourceFilter}
                            onChange={e => setLogsSourceFilter(e.target.value)}
                            placeholder={t('log_filter_source_placeholder')}
                            className={INPUT_CLASS}
                        />
                        <input
                            value={logsAgentFilter}
                            onChange={e => setLogsAgentFilter(e.target.value)}
                            placeholder={t('log_filter_agent_placeholder')}
                            className={INPUT_CLASS}
                        />
                        <select
                            value={logsStatusFilter}
                            onChange={e => setLogsStatusFilter(e.target.value as typeof logsStatusFilter)}
                            className={FILTER_SELECT_CLASS}
                        >
                            <option value="all">{t('status_all')}</option>
                            <option value="success">{t('success')}</option>
                            <option value="cached">{t('cached')}</option>
                            <option value="failed">{t('failed')}</option>
                            <option value="timeout">{t('timeout')}</option>
                        </select>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
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
            </div>

            {queryError && (
                <DataHubAlert
                    variant={queryError.variant}
                    message={queryError.message}
                    onRetry={queryError.retryable && onRetry ? handleRetry : undefined}
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
                                    const logText = `${log.error || ''} ${log.message || ''}`.toLowerCase();
                                    const isTelegramLog =
                                        log.dataType?.toLowerCase().includes('telegram') ||
                                        log.action?.toLowerCase().includes('telegram') ||
                                        log.sourceId?.toLowerCase().includes('telegram') ||
                                        logText.includes('telegram') ||
                                        logText.includes('flood') ||
                                        logText.includes('phone_code');

                                    return (
                                        <tr
                                            key={log.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setSelectedLog(log)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setSelectedLog(log);
                                                }
                                            }}
                                            className={`border-b border-slate-900/60 hover:bg-slate-900/40 cursor-pointer ${
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
                                            <td className="py-2 pr-3 text-foreground">
                                                {resolveSourceLabel(log, t)}
                                            </td>
                                            <td className="py-2 pr-3 text-muted-foreground">
                                                {log.action || log.dataType}
                                            </td>
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

            {selectedLog && (
                <AccessLogDetailModal
                    log={selectedLog}
                    onClose={() => setSelectedLog(null)}
                    onOpenSource={onNavigateToSource}
                    t={t}
                />
            )}
        </div>
    );
};

export default LogsPanel;
