
import React, { useState, useMemo } from 'react';
import * as api from '../../../../../../services/api';
import { DataHubState } from '../../../../../../types';
import { SummaryCard } from '../../../../../ui/summary-card';
import { EmptyState } from '../../../../../ui/empty-state';
import { ActionButton } from '../../../../../ui/action-button';
import { StatusBadge } from '../../../../../ui/status-badge';
import ApiWrapper from '../../../../../common/ApiWrapper';
import { useAsync } from '../../../../../../hooks/useAsync';

interface ArchivingProps {
    dataHub: DataHubState;
    setDataHub: (hub: DataHubState) => void;
    onRefresh: () => void;
    t: (key: string) => string;
    formatTimeAgo: (timestamp?: string) => string;
}

const Archiving: React.FC<ArchivingProps> = ({
    dataHub,
    setDataHub,
    onRefresh,
    t,
    formatTimeAgo
}) => {
    const createAsync = useAsync(api.createManualArchive);
    const restoreAsync = useAsync(api.restoreFromArchive);
    const deleteAsync = useAsync(api.deleteArchive);
    const toggleBacktestAsync = useAsync(api.updateArchive);

    const [showRuleModal, setShowRuleModal] = useState(false);
    const [editingRule, setEditingRule] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');

    const advanced = dataHub.advanced || { archives: [] };
    const archives = advanced.archives || [];

    // Calculate summary metrics
    const summary = useMemo(() => {
        const totalSize = archives.reduce((sum, a) => sum + (a.sizeBytes || 0), 0);
        const backtestCount = archives.filter(a => a.usedForBacktest).length;
        const last30Days = archives.filter(a => {
            const date = new Date(a.archivedAt);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return date >= thirtyDaysAgo;
        }).length;

        return {
            total: archives.length,
            totalSize: (totalSize / (1024 * 1024)).toFixed(2), // MB
            backtestCount,
            last30Days
        };
    }, [archives]);

    // Filter archives
    const filteredArchives = useMemo(() => {
        return archives.filter(archive => {
            const matchesSearch = !searchTerm ||
                archive.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                archive.sourceId?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesCategory = filterCategory === 'all' || archive.category === filterCategory;

            return matchesSearch && matchesCategory;
        });
    }, [archives, searchTerm, filterCategory]);

    // Get unique categories
    const categories = useMemo(() => {
        const cats = new Set(archives.map(a => a.category).filter(Boolean));
        return Array.from(cats);
    }, [archives]);

    const handleCreateArchive = async () => {
        try {
            await createAsync.execute();
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e: any) {
            console.error('Failed to create archive:', e);
        }
    };

    const handleRestoreArchive = async (archiveId: string) => {
        try {
            await restoreAsync.execute(archiveId);
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e: any) {
            console.error('Failed to restore archive:', e);
        }
    };

    const handleDeleteArchive = async (archiveId: string) => {
        const confirmed = window.confirm(t('confirm_delete_archive') || 'Are you sure you want to delete this archive? This cannot be undone.');
        if (!confirmed) return;

        try {
            await deleteAsync.execute(archiveId);
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e: any) {
            console.error('Failed to delete archive:', e);
        }
    };

    const handleToggleBacktest = async (archiveId: string, usedForBacktest: boolean) => {
        try {
            await toggleBacktestAsync.execute(archiveId, { usedForBacktest: !usedForBacktest });
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e: any) {
            console.error('Failed to update archive:', e);
        }
    };

    return (
        <ApiWrapper
            error={createAsync.error || restoreAsync.error || deleteAsync.error || toggleBacktestAsync.error}
            setError={() => {
                createAsync.setError(null);
                restoreAsync.setError(null);
                deleteAsync.setError(null);
                toggleBacktestAsync.setError(null);
            }}
            isLoading={createAsync.isLoading || restoreAsync.isLoading || deleteAsync.isLoading || toggleBacktestAsync.isLoading}
        >
            <div className="bg-card border border-border rounded-lg p-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            📦 {t('data_archiving') || 'Data Archiving'}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('archiving_desc') || 'Archive old data for storage optimization and historical analysis'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <ActionButton
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowRuleModal(true)}
                        >
                            {t('manage_rules') || 'Manage Rules'}
                        </ActionButton>
                        <ActionButton
                            variant="primary"
                            size="sm"
                            loading={isLoadingArchives}
                            onClick={handleCreateArchive}
                        >
                            {t('create_archive') || '+ Create Archive'}
                        </ActionButton>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <SummaryCard
                        label={t('total_archives') || 'Total Archives'}
                        value={summary.total}
                        icon={<span className="text-2xl">📦</span>}
                    />
                    <SummaryCard
                        label={t('total_size') || 'Total Size'}
                        value={`${summary.totalSize} MB`}
                        icon={<span className="text-2xl">💾</span>}
                    />
                    <SummaryCard
                        label={t('backtest_ready') || 'Backtest Ready'}
                        value={summary.backtestCount}
                        variant="success"
                        icon={<span className="text-2xl">🧪</span>}
                    />
                    <SummaryCard
                        label={t('last_30_days') || 'Last 30 Days'}
                        value={summary.last30Days}
                        icon={<span className="text-2xl">📅</span>}
                    />
                </div>

                {/* Filters */}
                {archives.length > 0 && (
                    <div className="flex flex-col md:flex-row gap-3 mb-4">
                        <input
                            type="text"
                            placeholder={t('search_archives') || 'Search archives...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground"
                        />
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
                        >
                            <option value="all">{t('all_categories') || 'All Categories'}</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Archives List */}
                {filteredArchives.length > 0 ? (
                    <div className="space-y-3">
                        {filteredArchives.map(archive => (
                            <div key={archive.id} className="border border-border rounded-lg p-4">
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h4 className="font-semibold text-foreground">
                                                {archive.name || archive.sourceId}
                                            </h4>
                                            {archive.usedForBacktest && (
                                                <StatusBadge status="info" label="Backtest" size="sm" />
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide">Category</p>
                                                <p className="text-foreground font-medium">{archive.category || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide">Records</p>
                                                <p className="text-foreground font-medium">{archive.recordCount || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide">Size</p>
                                                <p className="text-foreground font-medium">
                                                    {((archive.sizeBytes || 0) / 1024).toFixed(1)} KB
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide">Archived</p>
                                                <p className="text-foreground font-medium">
                                                    {formatTimeAgo(archive.archivedAt)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <ActionButton
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleToggleBacktest(archive.id, archive.usedForBacktest)}
                                        >
                                            {archive.usedForBacktest ? '🧪 Remove from Backtest' : '🧪 Mark for Backtest'}
                                        </ActionButton>
                                        <ActionButton
                                            variant="secondary"
                                            size="sm"
                                            loading={isRestoring === archive.id}
                                            onClick={() => handleRestoreArchive(archive.id)}
                                        >
                                            {t('restore') || 'Restore'}
                                        </ActionButton>
                                        <ActionButton
                                            variant="danger"
                                            size="sm"
                                            loading={isDeletingRule === archive.id}
                                            onClick={() => handleDeleteArchive(archive.id)}
                                        >
                                            {t('delete') || 'Delete'}
                                        </ActionButton>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : archives.length > 0 ? (
                    <EmptyState
                        icon={<span className="text-4xl">🔍</span>}
                        title={t('no_matching_archives') || 'No matching archives'}
                        description={t('try_different_filters') || 'Try adjusting your search or filters'}
                    />
                ) : (
                    <EmptyState
                        icon={<span className="text-4xl">📦</span>}
                        title={t('no_archives') || 'No archives yet'}
                        description={t('archives_desc') || 'Archives help you save storage and keep historical data for backtesting'}
                        action={
                            <ActionButton
                                variant="primary"
                                onClick={handleCreateArchive}
                                loading={isLoadingArchives}
                            >
                                {t('create_first_archive') || 'Create Your First Archive'}
                            </ActionButton>
                        }
                    />
                )}

                {/* Archive Rules Info */}
                <div className="mt-6 bg-secondary/20 border border-border rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2">
                        {t('auto_archiving_rules') || 'Auto-Archiving Rules'}
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                        {t('auto_archiving_desc') || 'Set up rules to automatically archive old data based on age, size, or quality'}
                    </p>
                    <ActionButton
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowRuleModal(true)}
                    >
                        {t('configure_rules') || 'Configure Rules'}
                    </ActionButton>
                </div>
            </div>
        </ApiWrapper>
    );
};

export default Archiving;
