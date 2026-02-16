import React, { useState, useEffect, useMemo } from 'react';
import { DataSource } from '../../../../../../types';
import * as api from '../../../../../../services/api';

type Props = {
    source: DataSource;
    onClose: () => void;
    t: (key: string) => string;
};

const ViewSourceDataModal: React.FC<Props> = ({ source, onClose, t }) => {
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [pagination, setPagination] = useState({ limit: 10, offset: 0, total: 0 });
    const [filters, setFilters] = useState({
        status: 'all',
        startDate: '',
        endDate: '',
        search: ''
    });
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    // Debounce search
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(filters.search);
        }, 500);
        return () => clearTimeout(timer);
    }, [filters.search]);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const apiFilters: any = {
                source_id: source.id,
                limit: pagination.limit,
                offset: pagination.offset
            };

            if (filters.status !== 'all') apiFilters.status = filters.status;
            if (filters.startDate) apiFilters.start_date = filters.startDate;
            if (filters.endDate) apiFilters.end_date = filters.endDate;

            const response = await api.fetchCollectedData(apiFilters);
            setHistoryData(response.data);
            setPagination(prev => ({ ...prev, total: response.pagination.total }));
        } catch (e) {
            console.error('Failed to load history:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, [pagination.offset, filters.status, filters.startDate, filters.endDate, source.id]);

    // Client-side search filtering (since backend might not support partial text search on all fields efficiently yet)
    // Or if backend supports it, we would add it to apiFilters.
    // Assuming backend DOES NOT support 'search' param based on previous api.ts check.
    const displayedData = useMemo(() => {
        if (!debouncedSearch) return historyData;
        const lowerSearch = debouncedSearch.toLowerCase();
        return historyData.filter(record =>
            JSON.stringify(record).toLowerCase().includes(lowerSearch)
        );
    }, [historyData, debouncedSearch]);

    const formatData = (data: any): string => {
        if (!data) return t('no_data') || 'No data';
        try {
            return JSON.stringify(data, null, 2);
        } catch (e) {
            return String(data);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm md:text-base font-semibold text-foreground">
                                {t('source_data_history') || 'Source Data History'}
                            </h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900/60 border border-white/10 text-muted-foreground font-mono max-w-[220px] truncate">
                                {source.name}
                            </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            {t('select_record_to_view') || 'Browse collected records and inspect raw vs normalized data.'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground text-xl leading-none"
                        aria-label={t('close') || 'Close'}
                    >
                        ×
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-white/10 bg-slate-950/80">
                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">{t('search') || 'Search'}</label>
                        <input
                            type="text"
                            value={filters.search}
                            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                            placeholder={t('search_placeholder') || 'Search data...'}
                            className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground"
                        />
                    </div>
                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">{t('status') || 'Status'}</label>
                        <select
                            value={filters.status}
                            onChange={(e) => {
                                setFilters(prev => ({ ...prev, status: e.target.value }));
                                setPagination(prev => ({ ...prev, offset: 0 }));
                            }}
                            className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground"
                        >
                            <option value="all">{t('all') || 'All'}</option>
                            <option value="processed">{t('processed') || 'Processed'}</option>
                            <option value="pending">{t('pending') || 'Pending'}</option>
                            <option value="error">{t('error') || 'Error'}</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">{t('start_date') || 'Start Date'}</label>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => {
                                setFilters(prev => ({ ...prev, startDate: e.target.value }));
                                setPagination(prev => ({ ...prev, offset: 0 }));
                            }}
                            className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground"
                        />
                    </div>
                    <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">{t('end_date') || 'End Date'}</label>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => {
                                setFilters(prev => ({ ...prev, endDate: e.target.value }));
                                setPagination(prev => ({ ...prev, offset: 0 }));
                            }}
                            className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex bg-slate-950/70">
                    {/* List */}
                    <div className={`${selectedRecord ? 'w-1/3 hidden md:block' : 'w-full'} border-r border-slate-800/60 overflow-y-auto`}>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-40">
                                <div className="animate-spin text-2xl text-sky-400">⚙️</div>
                            </div>
                        ) : displayedData.length === 0 ? (
                            <div className="p-8 text-center text-[11px] text-muted-foreground">
                                {t('no_records_found') || 'No records found'}
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-800/60">
                                {displayedData.map((record) => (
                                    <div
                                        key={record.id}
                                        onClick={() => setSelectedRecord(record)}
                                        className={`p-3 cursor-pointer transition-colors border-l-2 ${
                                            selectedRecord?.id === record.id
                                                ? 'bg-slate-900/80 border-l-sky-400'
                                                : 'hover:bg-slate-900/40 border-l-transparent'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                                                    record.status === 'processed'
                                                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40'
                                                        : record.status === 'error'
                                                        ? 'bg-red-500/10 text-red-300 border border-red-500/40'
                                                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/40'
                                                }`}
                                            >
                                                {record.status}
                                            </span>
                                            <span className="text-[11px] text-muted-foreground">
                                                {new Date(record.collected_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-muted-foreground truncate">
                                            {new Date(record.collected_at).toLocaleTimeString()}
                                        </div>
                                        <div className="text-[11px] mt-1 truncate font-mono opacity-70 text-muted-foreground">
                                            ID: {record.id.substring(0, 8)}...
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        <div className="p-2 border-t border-slate-800/60 flex justify-between items-center text-[11px] text-muted-foreground">
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                                disabled={pagination.offset === 0 || isLoading}
                                className="px-2 py-1 rounded-full text-[11px] bg-slate-900/70 border border-slate-700 text-foreground disabled:opacity-40"
                            >
                                {t('prev') || 'Prev'}
                            </button>
                            <span>
                                {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} / {pagination.total}
                            </span>
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                                disabled={pagination.offset + pagination.limit >= pagination.total || isLoading}
                                className="px-2 py-1 rounded-full text-[11px] bg-slate-900/70 border border-slate-700 text-foreground disabled:opacity-40"
                            >
                                {t('next') || 'Next'}
                            </button>
                        </div>
                    </div>

                    {/* Details */}
                    {selectedRecord ? (
                        <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-br from-slate-950/80 via-slate-950/70 to-slate-900/80">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-semibold text-foreground">
                                    {t('record_details') || 'Record Details'}
                                </h4>
                                <button
                                    onClick={() => setSelectedRecord(null)}
                                    className="md:hidden text-[11px] text-sky-300 hover:text-sky-200"
                                >
                                    {t('back_to_list') || 'Back to List'}
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    <div className="rounded-xl border border-white/5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-3 backdrop-blur-sm">
                                        <div className="text-[11px] text-blue-300/80 mb-1">
                                            {t('id') || 'ID'}
                                        </div>
                                        <div className="font-mono text-foreground break-all">
                                            {selectedRecord.id}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-white/5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-3 backdrop-blur-sm">
                                        <div className="text-[11px] text-emerald-300/80 mb-1">
                                            {t('collected_at') || 'Collected At'}
                                        </div>
                                        <div className="text-foreground">
                                            {new Date(selectedRecord.collected_at).toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="text-[11px] text-muted-foreground mb-2 font-bold uppercase">
                                        {t('raw_data') || 'Raw Data'}
                                    </div>
                                    <pre className="bg-slate-950/80 p-4 rounded-lg text-[11px] font-mono overflow-x-auto border border-slate-800">
                                        {formatData(selectedRecord.raw_data)}
                                    </pre>
                                </div>

                                {selectedRecord.normalized_data && (
                                    <div>
                                        <div className="text-[11px] text-muted-foreground mb-2 font-bold uppercase">
                                            {t('normalized_data') || 'Normalized Data'}
                                        </div>
                                        <pre className="bg-slate-950/80 p-4 rounded-lg text-[11px] font-mono overflow-x-auto border border-emerald-500/40 text-emerald-300/90">
                                            {formatData(selectedRecord.normalized_data)}
                                        </pre>
                                    </div>
                                )}

                                {selectedRecord.error_message && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                                        <div className="text-[11px] text-red-400 mb-1 font-bold uppercase">
                                            {t('error') || 'Error'}
                                        </div>
                                        <div className="text-xs text-red-200">
                                            {selectedRecord.error_message}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground flex-col gap-2">
                            <div className="text-4xl opacity-20">📋</div>
                            <p className="text-[11px]">
                                {t('select_record_to_view') || 'Select a record to view details'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ViewSourceDataModal;

