import React from 'react';
import { DataHubState, DataSource } from '../../../../../types';
import { DataHubApiError } from '../../../../../services/dataSourcesApi';
import type { DataSourcesPagination } from '../../../../../services/dataSourcesApi';

type Props = {
    t: (key: string) => string;
    formatTimeAgo: (date: string | Date) => string;
    onRefresh: () => void;
    Card: React.ComponentType<any>;
    downloadCSV: (filename: string, rows: any[]) => void;
    setEditingSource: (source: DataSource | null) => void;
    setShowCreateSourceModal: (show: boolean) => void;
    setViewingSourceData: (source: DataSource | null) => void;
    handleTestSource: (sourceId: string) => void | Promise<void>;
    handleDeleteSource: (sourceId: string, hard?: boolean) => void | Promise<void>;
    handleRestoreSource: (sourceId: string) => void | Promise<void>;
    dataHub: DataHubState;
    setActiveView?: (view: 'sources' | 'categories' | 'pipeline' | 'health' | 'logs' | 'advanced' | 'telegram') => void;
    pagination?: DataSourcesPagination;
    page: number;
    onPageChange: (page: number) => void;
    isLoading?: boolean;
    apiError?: DataHubApiError | Error | null;
};

const DataSourcesPanel: React.FC<Props> = ({
    t,
    formatTimeAgo,
    onRefresh,
    Card,
    downloadCSV,
    setEditingSource,
    setShowCreateSourceModal,
    setViewingSourceData,
    handleTestSource,
    handleDeleteSource,
    handleRestoreSource,
    dataHub,
    setActiveView,
    pagination,
    page,
    onPageChange,
    isLoading,
    apiError,
}) => {
    const sources = dataHub.sources || [];

    const handleExport = () => {
        if (!sources.length) return;
        downloadCSV('data-sources', sources);
    };

    const conflictMessage =
        apiError instanceof DataHubApiError && apiError.status === 409 ? apiError.message : null;
    const serverError =
        apiError instanceof DataHubApiError && apiError.status >= 500 ? apiError.message : null;

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h3 className="font-semibold text-foreground">
                        {t('data_sources') || 'Data Sources'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {t('data_sources_desc') ||
                            'Manage and monitor all upstream sources your AI agents rely on (Telegram, RSS, APIs, web).'}
                    </p>
                    {pagination && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {t('sources_pagination_summary') ||
                                `Page ${pagination.page} · ${sources.length} of ${pagination.total} sources`}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-slate-600/70 bg-slate-900/70 text-foreground hover:border-purple-400 hover:text-purple-200 transition disabled:opacity-50"
                    >
                        {isLoading ? (t('refreshing') || 'Refreshing…') : (t('refresh') || 'Refresh')}
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={!sources.length}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-slate-600/70 bg-slate-900/70 text-foreground hover:border-emerald-400 hover:text-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                        {t('export_csv') || 'Export CSV'}
                    </button>
                    <button
                        onClick={() => {
                            setEditingSource(null);
                            setShowCreateSourceModal(true);
                        }}
                        className="text-[11px] px-3 py-1.5 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/40"
                    >
                        {t('add_source') || '+ Add Source'}
                    </button>
                </div>
            </div>

            {conflictMessage && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    {conflictMessage}
                </div>
            )}

            {serverError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-sm text-red-200">{serverError}</span>
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="text-[11px] px-3 py-1 rounded-full border border-red-400/60 text-red-200 hover:bg-red-500/10"
                    >
                        {t('retry') || 'Retry'}
                    </button>
                </div>
            )}

            <Card className="bg-slate-950/70 border border-white/5 shadow-[0_18px_60px_rgba(15,23,42,0.9)]">
                {sources.length === 0 && !isLoading ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                        {t('no_data_sources') || 'No data sources configured yet.'}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sources.map((source) => {
                            const isTelegram = source.type === 'telegram';
                            return (
                                <div
                                    key={source.id}
                                    className="rounded-xl border border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-slate-950/90 to-slate-900/80 px-4 py-3 hover:border-purple-500/60 hover:shadow-[0_0_25px_rgba(168,85,247,0.25)] transition-colors"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-semibold text-foreground">
                                                    {source.name}
                                                </h4>
                                                {isTelegram && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/40 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                                        {t('telegram') || 'Telegram'}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                {source.type} • {source.category}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 justify-end">
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                    source.status === 'active'
                                                        ? 'bg-emerald-500/15 text-emerald-300'
                                                        : source.status === 'error'
                                                        ? 'bg-red-500/15 text-red-300'
                                                        : source.status === 'testing'
                                                        ? 'bg-amber-500/15 text-amber-300'
                                                        : 'bg-slate-500/20 text-slate-300'
                                                }`}
                                            >
                                                {t(source.status) || source.status}
                                            </span>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                    source.priority === 'critical'
                                                        ? 'bg-red-500/15 text-red-300'
                                                        : source.priority === 'high'
                                                        ? 'bg-orange-500/15 text-orange-300'
                                                        : source.priority === 'medium'
                                                        ? 'bg-yellow-500/15 text-yellow-300'
                                                        : 'bg-slate-500/20 text-slate-300'
                                                }`}
                                            >
                                                {t(source.priority) || source.priority}
                                            </span>
                                        </div>
                                    </div>

                                    {isTelegram && source.config && (
                                        <div className="mt-3 pt-3 border-t border-slate-800/60">
                                            <p className="text-[10px] text-muted-foreground mb-2">
                                                {t('telegram_channel_settings') || 'Channel Settings'}
                                            </p>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                                                {source.config.channelUsername && (
                                                    <div>
                                                        <p className="text-muted-foreground">
                                                            {t('username') || 'Username'}
                                                        </p>
                                                        <p className="font-mono text-sky-300">
                                                            @{source.config.channelUsername}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-[11px]">
                                        <div>
                                            <p className="text-muted-foreground">
                                                {t('success_rate') || 'Success Rate'}
                                            </p>
                                            <p className="font-semibold text-foreground">
                                                {source.successRate.toFixed(1)}%
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">
                                                {t('reliability') || 'Reliability'}
                                            </p>
                                            <p className="font-semibold text-foreground">
                                                {source.reliabilityScore.toFixed(0)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">
                                                {t('response_time') || 'Response Time'}
                                            </p>
                                            <p className="font-semibold text-foreground">
                                                {(source.responseTime || 0) + 'ms'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">
                                                {t('update_interval') || 'Update Interval'}
                                            </p>
                                            <p className="font-semibold text-foreground">
                                                {t(source.updateInterval) || source.updateInterval}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px]">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`w-2 h-2 rounded-full ${
                                                    source.status === 'active'
                                                        ? 'bg-emerald-400 animate-pulse'
                                                        : source.status === 'error'
                                                        ? 'bg-red-500'
                                                        : source.status === 'testing'
                                                        ? 'bg-amber-400 animate-pulse'
                                                        : 'bg-slate-500'
                                                }`}
                                            />
                                            <span className="text-muted-foreground">
                                                {source.status === 'active'
                                                    ? t('connected') || 'Connected'
                                                    : source.status === 'error'
                                                    ? t('error') || 'Error'
                                                    : source.status === 'testing'
                                                    ? t('testing') || 'Testing...'
                                                    : t('inactive') || 'Inactive'}
                                            </span>
                                        </div>
                                        <div className="text-muted-foreground">
                                            {source.lastSuccess ? (
                                                <span className="text-emerald-300">
                                                    {t('last_success') || 'Last success'}:{' '}
                                                    {formatTimeAgo(source.lastSuccess)}
                                                </span>
                                            ) : source.lastUpdate ? (
                                                <span>
                                                    {t('last_update') || 'Last update'}:{' '}
                                                    {formatTimeAgo(source.lastUpdate)}
                                                </span>
                                            ) : (
                                                <span>{t('never_updated') || 'Never updated'}</span>
                                            )}
                                        </div>
                                    </div>

                                    {source.lastError && (
                                        <div className="mt-2 text-[11px] text-red-300">
                                            {t('last_error') || 'Last error'}: {source.lastError}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {isTelegram && setActiveView && (
                                            <button
                                                onClick={() => setActiveView('telegram')}
                                                className="text-[11px] px-3 py-1 rounded-full border border-sky-500/70 text-sky-200 hover:bg-sky-500/10 transition flex items-center gap-1"
                                            >
                                                {t('open_in_telegram_collector') || 'Open in Telegram Collector'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setViewingSourceData(source)}
                                            className="text-[11px] px-3 py-1 rounded-full border border-purple-500/70 text-purple-200 hover:bg-purple-500/10 transition"
                                        >
                                            {t('view_data') || 'View Data'}
                                        </button>
                                        <button
                                            onClick={() => handleTestSource(source.id)}
                                            className="text-[11px] px-3 py-1 rounded-full border border-emerald-500/70 text-emerald-200 hover:bg-emerald-500/10 transition"
                                        >
                                            {t('test_connection') || 'Test Connection'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingSource(source);
                                                setShowCreateSourceModal(true);
                                            }}
                                            className="text-[11px] px-3 py-1 rounded-full border border-slate-600 text-slate-100 hover:bg-slate-600/30 transition"
                                        >
                                            {t('edit') || 'Edit'}
                                        </button>
                                        {source.status === 'inactive' ? (
                                            <button
                                                onClick={() => handleRestoreSource(source.id)}
                                                className="text-[11px] px-3 py-1 rounded-full border border-blue-500/70 text-blue-200 hover:bg-blue-500/10 transition"
                                            >
                                                {t('restore') || 'Restore'}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleDeleteSource(source.id, false)}
                                                className="text-[11px] px-3 py-1 rounded-full border border-amber-500/70 text-amber-200 hover:bg-amber-500/10 transition"
                                            >
                                                {t('soft_delete') || 'Soft Delete'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteSource(source.id, true)}
                                            className="text-[11px] px-3 py-1 rounded-full border border-red-500/70 text-red-200 hover:bg-red-500/10 transition"
                                        >
                                            {t('hard_delete') || 'Hard Delete'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 text-[11px]">
                    <button
                        type="button"
                        disabled={!pagination.hasPrevPage || isLoading}
                        onClick={() => onPageChange(page - 1)}
                        className="px-3 py-1.5 rounded-full border border-slate-600/70 disabled:opacity-40"
                    >
                        {t('previous') || 'Previous'}
                    </button>
                    <span className="text-muted-foreground">
                        {t('page_of') || 'Page'} {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                        type="button"
                        disabled={!pagination.hasNextPage || isLoading}
                        onClick={() => onPageChange(page + 1)}
                        className="px-3 py-1.5 rounded-full border border-slate-600/70 disabled:opacity-40"
                    >
                        {t('next') || 'Next'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default DataSourcesPanel;
