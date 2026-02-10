import React, { useState, useEffect } from 'react';
import * as api from '../../../../services/api';
import { DataSource } from '../../../../types';

type Props = {
    sources: DataSource[];
    t: (key: string) => string;
};

const CollectedDataPanel: React.FC<Props> = ({ sources, t }) => {
    const [data, setData] = useState<any[]>([]);
    const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0, hasMore: false });
    const [isLoading, setIsLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
    const [isLoadingRecord, setIsLoadingRecord] = useState(false);

    const loadData = async (offset = 0) => {
        setIsLoading(true);
        try {
            const filters = {
                status: statusFilter === 'all' ? undefined : statusFilter,
                source_id: sourceFilter === 'all' ? undefined : sourceFilter,
                limit: pagination.limit,
                offset
            };
            const response = await api.fetchCollectedData(filters);
            if (offset === 0) {
                setData(response.data);
            } else {
                setData(prev => [...prev, ...response.data]);
            }
            setPagination(response.pagination);
        } catch (e) {
            console.error('Failed to load collected data:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData(0);
    }, [statusFilter, sourceFilter]);

    const handleViewRecord = async (id: string) => {
        setIsLoadingRecord(true);
        try {
            const record = await api.fetchSingleCollectedData(id);
            setSelectedRecord(record);
        } catch (e) {
            alert(t('failed_to_load_record') || 'Failed to load record details');
        } finally {
            setIsLoadingRecord(false);
        }
    };

    const formatJSON = (val: any) => {
        try {
            return JSON.stringify(val, null, 2);
        } catch (e) {
            return String(val);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-secondary/20 p-4 rounded-lg">
                <div className="flex flex-wrap gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-background border border-border rounded px-3 py-1.5 text-sm"
                    >
                        <option value="all">{t('all_statuses') || 'All Statuses'}</option>
                        <option value="pending">{t('pending') || 'Pending'}</option>
                        <option value="processed">{t('processed') || 'Processed'}</option>
                        <option value="error">{t('error') || 'Error'}</option>
                    </select>

                    <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        className="bg-background border border-border rounded px-3 py-1.5 text-sm max-w-[200px]"
                    >
                        <option value="all">{t('all_sources') || 'All Sources'}</option>
                        {sources.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={() => loadData(0)}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm transition"
                >
                    {isLoading ? t('refreshing') || 'Refreshing...' : t('refresh') || 'Refresh'}
                </button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/50 text-muted-foreground uppercase text-[10px] tracking-wider">
                        <tr>
                            <th className="px-4 py-3 font-medium">{t('source') || 'Source'}</th>
                            <th className="px-4 py-3 font-medium">{t('collected_at') || 'Collected At'}</th>
                            <th className="px-4 py-3 font-medium">{t('status') || 'Status'}</th>
                            <th className="px-4 py-3 font-medium text-right">{t('actions') || 'Actions'}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {data.length > 0 ? (
                            data.map((record) => (
                                <tr key={record.id} className="hover:bg-accent/20 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-foreground">{record.source_name || record.source_id}</div>
                                        <div className="text-[11px] text-muted-foreground">{record.source_type}</div>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                        {new Date(record.collected_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${record.status === 'processed' ? 'bg-green-500/20 text-green-400' :
                                                record.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                            {t(record.status) || record.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleViewRecord(record.id)}
                                            className="text-blue-400 hover:text-blue-300 transition"
                                        >
                                            {t('view_details') || 'View Details'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                                    {isLoading ? t('loading_collected_data') || 'Fetching collected data...' : t('no_collected_data') || 'No collected data found.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {pagination.hasMore && (
                <div className="flex justify-center mt-4">
                    <button
                        onClick={() => loadData(pagination.offset + pagination.limit)}
                        disabled={isLoading}
                        className="bg-secondary hover:bg-accent text-sm px-6 py-2 rounded-lg transition"
                    >
                        {isLoading ? t('loading_more') || 'Loading...' : t('load_more') || 'Load More'}
                    </button>
                </div>
            )}

            {/* Record Detail Modal */}
            {selectedRecord && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-foreground">
                                    {t('record_details') || 'Record Details'}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    ID: {selectedRecord.id}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedRecord(null)}
                                className="text-muted-foreground hover:text-foreground text-2xl transition"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-secondary/30 p-4 rounded-lg">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('source') || 'Source'}</p>
                                    <p className="font-semibold text-foreground">{selectedRecord.source_name}</p>
                                    <p className="text-xs text-muted-foreground">{selectedRecord.source_type}</p>
                                </div>
                                <div className="bg-secondary/30 p-4 rounded-lg">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('status') || 'Status'}</p>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${selectedRecord.status === 'processed' ? 'bg-green-500/20 text-green-400' :
                                            selectedRecord.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                                'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                        {t(selectedRecord.status) || selectedRecord.status}
                                    </span>
                                </div>
                                <div className="bg-secondary/30 p-4 rounded-lg">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('collected_at') || 'Collected'}</p>
                                    <p className="text-sm text-foreground">{new Date(selectedRecord.collected_at).toLocaleString()}</p>
                                </div>
                            </div>

                            {selectedRecord.error_message && (
                                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
                                    <p className="text-xs text-red-400 uppercase tracking-wider font-bold mb-1">{t('error_message') || 'Error Message'}</p>
                                    <p className="text-sm text-red-300">{selectedRecord.error_message}</p>
                                </div>
                            )}

                            <div>
                                <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                    {t('raw_data') || 'Raw Data'}
                                </h4>
                                <pre className="bg-background/80 border border-border p-4 rounded-lg text-xs text-muted-foreground overflow-x-auto max-h-60 overflow-y-auto font-mono">
                                    {formatJSON(selectedRecord.raw_data)}
                                </pre>
                            </div>

                            {selectedRecord.normalized_data && (
                                <div>
                                    <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                        {t('normalized_data') || 'Normalized Data'}
                                    </h4>
                                    <pre className="bg-background/80 border border-border p-4 rounded-lg text-xs text-muted-foreground overflow-x-auto max-h-60 overflow-y-auto font-mono">
                                        {formatJSON(selectedRecord.normalized_data)}
                                    </pre>
                                </div>
                            )}

                            {selectedRecord.metadata && (
                                <div>
                                    <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                                        {t('metadata') || 'Metadata'}
                                    </h4>
                                    <pre className="bg-background/80 border border-border p-4 rounded-lg text-xs text-muted-foreground overflow-x-auto font-mono">
                                        {formatJSON(selectedRecord.metadata)}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-border bg-secondary/10 text-right">
                            <button
                                onClick={() => setSelectedRecord(null)}
                                className="bg-secondary hover:bg-accent text-foreground px-6 py-2 rounded-lg transition"
                            >
                                {t('close') || 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CollectedDataPanel;
