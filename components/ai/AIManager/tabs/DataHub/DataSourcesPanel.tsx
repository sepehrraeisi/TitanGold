import React, { useState, useEffect } from 'react';
import * as api from '../../../../../services/api';
import { DataSource, DataHubState } from '../../../../../types';
import Pagination from '../../../../common/Pagination';
import SkeletonLoader from '../../../../common/SkeletonLoader';
import ApiWrapper from '../../../../common/ApiWrapper';

interface DataSourcesPanelProps {
    t: (key: string) => string;
    formatTimeAgo: (date: string | Date) => string;
    onRefresh: () => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
    downloadCSV: (data: any[], filename: string) => void;
    setEditingSource: (source: DataSource | null) => void;
    setShowCreateSourceModal: (show: boolean) => void;
    setViewingSourceData: (source: DataSource | null) => void;
    handleTestSource: (id: string) => void;
    dataHub: DataHubState | null;
}

const DataSourcesPanel: React.FC<DataSourcesPanelProps> = ({
    t,
    formatTimeAgo,
    onRefresh,
    Card,
    downloadCSV,
    setEditingSource,
    setShowCreateSourceModal,
    setViewingSourceData,
    handleTestSource
}) => {
    const [sources, setSources] = useState<DataSource[]>([]);
    const [pagination, setPagination] = useState({
        page: 1,
        total: 0,
        totalPages: 0,
        limit: 20
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadSources = async (page: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.fetchDataSources(page, pagination.limit);
            setSources(response.data);
            setPagination({
                ...pagination,
                page: response.pagination.page,
                total: response.pagination.total,
                totalPages: response.pagination.totalPages
            });
        } catch (err: any) {
            console.error('Failed to load data sources:', err);
            setError(err.message || 'Failed to load data sources');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadSources(pagination.page);
    }, [pagination.page]);

    const handlePageChange = (newPage: number) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    return (
        <ApiWrapper
            error={error}
            setError={setError}
            isLoading={isLoading && sources.length === 0}
        >
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-foreground">{t('data_sources') || 'Data Sources'}</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => downloadCSV(sources, 'data-sources')}
                            className="bg-secondary hover:bg-accent text-secondary-foreground font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                        >
                            {t('export_csv') || 'Export CSV'}
                        </button>
                        <button
                            onClick={() => {
                                setEditingSource(null);
                                setShowCreateSourceModal(true);
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            {t('add_source') || '+ Add Source'}
                        </button>
                    </div>
                </div>

                <div className="space-y-3 min-h-[400px]">
                    {sources.length > 0 ? (
                        sources.map(source => (
                            <div key={source.id} className="border border-border rounded-lg p-4 hover:bg-secondary/50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-semibold text-foreground">{source.name}</h4>
                                        <p className="text-xs text-muted-foreground">{source.type} • {source.category}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${source.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                            source.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                                'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                            {t(source.status) || source.status}
                                        </span>
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${source.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                            source.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                                source.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-gray-500/20 text-gray-400'
                                            }`}>
                                            {t(source.priority) || source.priority}
                                        </span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                                    <div>
                                        <p className="text-muted-foreground">{t('success_rate') || 'Success Rate'}</p>
                                        <p className="font-semibold text-foreground">
                                            {typeof source.successRate === 'number'
                                                ? source.successRate.toFixed(1)
                                                : '0.0'
                                            }%
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">{t('reliability') || 'Reliability'}</p>
                                        <p className="font-semibold text-foreground">
                                            {typeof source.reliabilityScore === 'number'
                                                ? source.reliabilityScore.toFixed(0)
                                                : '0'
                                            }
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">{t('response_time') || 'Response Time'}</p>
                                        <p className="font-semibold text-foreground">{source.responseTime || 0}ms</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">{t('update_interval') || 'Update Interval'}</p>
                                        <p className="font-semibold text-foreground">{t(source.updateInterval) || source.updateInterval}</p>
                                    </div>
                                </div>

                                {/* Connection Status */}
                                <div className="mt-3 pt-3 border-t border-border">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${source.status === 'active' ? 'bg-green-500 animate-pulse' :
                                                source.status === 'error' ? 'bg-red-500' :
                                                    source.status === 'testing' ? 'bg-yellow-500 animate-pulse' :
                                                        'bg-gray-500'
                                                }`}></div>
                                            <span className="text-muted-foreground">
                                                {source.status === 'active' ? (t('connected') || 'Connected') :
                                                    source.status === 'error' ? (t('error') || 'Error') :
                                                        source.status === 'testing' ? (t('testing') || 'Testing...') :
                                                            (t('inactive') || 'Inactive')}
                                            </span>
                                        </div>
                                        <div className="text-muted-foreground">
                                            {source.lastSuccess ? (
                                                <span className="text-green-400">
                                                    {t('last_success') || 'Last success'}: {formatTimeAgo(source.lastSuccess)}
                                                </span>
                                            ) : source.lastUpdate ? (
                                                <span>
                                                    {t('last_update') || 'Last update'}: {formatTimeAgo(source.lastUpdate)}
                                                </span>
                                            ) : (
                                                <span>{t('never_updated') || 'Never updated'}</span>
                                            )}
                                        </div>
                                    </div>
                                    {source.lastError && (
                                        <div className="mt-2 text-xs text-red-400">
                                            {t('last_error') || 'Last error'}: {source.lastError}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={() => {
                                            setViewingSourceData(source);
                                        }}
                                        className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded"
                                    >
                                        {t('view_data') || 'View Data'}
                                    </button>
                                    <button
                                        onClick={() => handleTestSource(source.id)}
                                        disabled={source.status === 'testing'}
                                        className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded"
                                    >
                                        {source.status === 'testing' ? (t('testing') || 'Testing...') : (t('test_connection') || 'Test Connection')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingSource(source);
                                            setShowCreateSourceModal(true);
                                        }}
                                        className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                                    >
                                        {t('edit') || 'Edit'}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const confirmed = window.confirm(t('confirm_delete') || 'Are you sure?');
                                            if (confirmed) {
                                                try {
                                                    await api.deleteDataSource(source.id);
                                                    loadSources(pagination.page);
                                                    onRefresh();
                                                } catch (e) {
                                                    alert(t('delete_failed') || 'Failed');
                                                }
                                            }
                                        }}
                                        className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                                    >
                                        {t('delete') || 'Delete'}
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center p-12 text-muted-foreground border border-dashed border-border rounded-lg">
                            {t('no_sources_found') || 'No data sources found.'}
                        </div>
                    )}
                </div>

                <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    totalCount={pagination.total}
                    limit={pagination.limit}
                    onPageChange={handlePageChange}
                />
            </Card>
        </ApiWrapper>
    );
};

export default DataSourcesPanel;
