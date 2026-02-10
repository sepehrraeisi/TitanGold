import React, { useMemo, useState } from 'react';
import * as api from '../../../../../services/api';
import { DataPipelineSnapshot, DataNormalizationSummary, NormalizedDataRecord } from '../../../../../types';
import SkeletonLoader from '../../../../common/SkeletonLoader';
import ApiWrapper from '../../../../common/ApiWrapper';

interface PipelinePanelProps {
    t: (key: string) => string;
    pipelineSnapshot: DataPipelineSnapshot | undefined;
    pipelineHistory: any[];
    normalizationSummary: DataNormalizationSummary | undefined;
    normalizedData: NormalizedDataRecord[];
    handleRefreshPipelineSnapshot: () => void;
    isLoadingPipeline: boolean;
    pipelineError: string | null;
    setPipelineError: (err: string | null) => void;
    formatTimeAgo: (date: string | Date | undefined) => string;
    selectedSnapshotId: string;
    setSelectedSnapshotId: (id: string) => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
}

const PipelinePanel: React.FC<PipelinePanelProps> = ({
    t,
    pipelineSnapshot,
    pipelineHistory,
    normalizationSummary,
    normalizedData,
    handleRefreshPipelineSnapshot,
    isLoadingPipeline,
    pipelineError,
    setPipelineError,
    formatTimeAgo,
    selectedSnapshotId,
    setSelectedSnapshotId,
    Card
}) => {
    const [categorySearch, setCategorySearch] = useState('');
    const [sourceSearch, setSourceSearch] = useState('');
    const [sourceStatusFilter, setSourceStatusFilter] = useState<'all' | 'success' | 'cached' | 'failed' | 'timeout'>('all');

    const latestSnapshot = pipelineSnapshot || pipelineHistory[0]?.snapshot;

    const activeSnapshot = useMemo(() => {
        if (!latestSnapshot) {
            return undefined;
        }
        if (selectedSnapshotId === 'latest' || pipelineHistory.length === 0) {
            return latestSnapshot;
        }
        const entry = pipelineHistory.find(item => item.id === selectedSnapshotId);
        return entry?.snapshot || latestSnapshot;
    }, [selectedSnapshotId, latestSnapshot, pipelineHistory]);

    const filteredCategories = useMemo(() => {
        if (!activeSnapshot) {
            return [];
        }
        const query = categorySearch.trim().toLowerCase();
        return activeSnapshot.categories.filter(category =>
            !query || category.name.toLowerCase().includes(query),
        );
    }, [activeSnapshot, categorySearch]);

    const filteredSources = useMemo(() => {
        if (!activeSnapshot) {
            return [];
        }
        const query = sourceSearch.trim().toLowerCase();
        return activeSnapshot.sources.filter(source => {
            const matchesQuery =
                !query ||
                source.name.toLowerCase().includes(query) ||
                source.category.toLowerCase().includes(query) ||
                source.lastDataType.toLowerCase().includes(query);
            const matchesStatus =
                sourceStatusFilter === 'all' || source.lastStatus === sourceStatusFilter;
            return matchesQuery && matchesStatus;
        });
    }, [activeSnapshot, sourceSearch, sourceStatusFilter]);

    const latestNormalized = normalizedData.slice(0, 6);

    return (
        <ApiWrapper
            error={pipelineError}
            setError={setPipelineError}
            isLoading={isLoadingPipeline}
        >
            <Card>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('data_preparation') || 'Data Preparation & Screening'}</h3>
                        <p className="text-xs text-muted-foreground">
                            {t('data_preparation_desc') || 'Aggregate quality metrics to ensure every downstream system receives clean, recent and trusted data.'}
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                        {pipelineHistory.length > 0 && (
                            <div className="text-xs">
                                <label className="block text-muted-foreground mb-1">
                                    {t('snapshot_history') || 'Snapshot History'}
                                </label>
                                <select
                                    value={selectedSnapshotId}
                                    onChange={e => setSelectedSnapshotId(e.target.value)}
                                    className="px-3 py-2 bg-background border border-border rounded text-xs text-foreground"
                                >
                                    <option value="latest">{t('snapshot_latest') || 'Latest'}</option>
                                    {pipelineHistory.map(entry => (
                                        <option key={entry.id} value={entry.id}>
                                            {new Date(entry.generatedAt).toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <button
                            onClick={handleRefreshPipelineSnapshot}
                            disabled={isLoadingPipeline}
                            className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded"
                        >
                            {isLoadingPipeline ? (t('loading') || 'Loading...') : (t('refresh_pipeline') || 'Refresh Pipeline')}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                    <input
                        value={categorySearch}
                        onChange={e => setCategorySearch(e.target.value)}
                        placeholder={t('category_filter_placeholder') || 'Filter categories'}
                        className="px-3 py-2 bg-background border border-border rounded text-xs text-foreground"
                    />
                    <input
                        value={sourceSearch}
                        onChange={e => setSourceSearch(e.target.value)}
                        placeholder={t('source_filter_placeholder') || 'Search sources or data types'}
                        className="px-3 py-2 bg-background border border-border rounded text-xs text-foreground"
                    />
                    <select
                        value={sourceStatusFilter}
                        onChange={e => setSourceStatusFilter(e.target.value as typeof sourceStatusFilter)}
                        className="px-3 py-2 bg-background border border-border rounded text-xs text-foreground"
                    >
                        <option value="all">{t('status_all') || 'All statuses'}</option>
                        <option value="success">{t('success') || 'Success'}</option>
                        <option value="cached">{t('cached') || 'Cached'}</option>
                        <option value="failed">{t('failed') || 'Failed'}</option>
                        <option value="timeout">{t('timeout') || 'Timeout'}</option>
                    </select>
                </div>

                {activeSnapshot ? (
                    <div className="space-y-6">
                        {/* Summary Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="bg-secondary/30 rounded p-4 flex flex-col items-center">
                                <p className="text-xs text-muted-foreground mb-1">{t('total_records') || 'Total Records'}</p>
                                <p className="text-xl font-bold">{activeSnapshot.totalRecords || 0}</p>
                            </div>
                            <div className="bg-secondary/30 rounded p-4 flex flex-col items-center">
                                <p className="text-xs text-muted-foreground mb-1">{t('normalized_percent') || 'Normalized %'}</p>
                                <p className="text-xl font-bold">{(activeSnapshot.normalizedPercent || 0).toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <p className="text-sm text-muted-foreground">
                            {t('pipeline_empty_state') || 'No snapshot available yet. Refresh to calculate current screening metrics.'}
                        </p>
                    </div>
                )}
            </Card>
        </ApiWrapper>
    );
};

export default PipelinePanel;
