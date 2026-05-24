import React, { useMemo, useState } from 'react';
import { DataCategory, DataHubState } from '../../../../../types';
import { DataHubApiError } from '../../../../../services/dataSourcesApi';
import ApiWrapper from '../../../../common/ApiWrapper';

interface CategoriesPanelProps {
    t: (key: string) => string;
    categories: DataCategory[];
    categoryMetricsById: Record<string, { inflow: number; passRate: number }>;
    downloadCSV: (data: any[], filename: string) => void;
    setEditingCategory: (category: DataCategory | null) => void;
    setShowCreateCategoryModal: (show: boolean) => void;
    onRefresh: () => void;
    handleDeleteCategory: (id: string) => void | Promise<void>;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
    isLoading?: boolean;
    apiError?: DataHubApiError | Error | null;
    dataHub?: DataHubState | null;
}

const CategoriesPanel: React.FC<CategoriesPanelProps> = ({
    t,
    categories,
    categoryMetricsById,
    downloadCSV,
    setEditingCategory,
    setShowCreateCategoryModal,
    onRefresh,
    handleDeleteCategory,
    Card,
    isLoading = false,
    apiError = null,
    dataHub,
}) => {
    const [categoryFilter, setCategoryFilter] = useState('');
    const [categoryTagFilter, setCategoryTagFilter] = useState('');

    const filteredCategoriesList = useMemo(() => {
        const query = categoryFilter.trim().toLowerCase();
        const tagQuery = categoryTagFilter.trim().toLowerCase();
        return categories.filter(category => {
            const matchesName = !query || category.name.toLowerCase().includes(query);
            const matchesTags =
                !tagQuery ||
                category.tags.some(tag => tag.toLowerCase().includes(tagQuery)) ||
                category.dataTypes.some(type => type.toLowerCase().includes(tagQuery));
            return matchesName && matchesTags;
        });
    }, [categories, categoryFilter, categoryTagFilter]);

    const telegramSourceCountByCategory = useMemo(() => {
        if (!dataHub?.sources) return {};
        const counts: Record<string, number> = {};
        dataHub.sources
            .filter(source => source.type === 'telegram')
            .forEach(source => {
                const catName = source.category || 'uncategorized';
                counts[catName] = (counts[catName] || 0) + 1;
            });
        return counts;
    }, [dataHub?.sources]);

    const conflictMessage =
        apiError instanceof DataHubApiError && apiError.status === 409 ? apiError.message : null;
    const validationMessage =
        apiError instanceof DataHubApiError && apiError.status === 400 ? apiError.message : null;
    const serverError =
        apiError instanceof DataHubApiError && apiError.status >= 500 ? apiError.message : null;

    return (
        <ApiWrapper
            error={validationMessage || serverError || (apiError instanceof Error ? apiError.message : null)}
            setError={() => {}}
            isLoading={isLoading && categories.length === 0}
        >
            <div className="space-y-4">
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

                <Card>
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                        <div>
                            <h3 className="font-semibold text-foreground">{t('data_categories') || 'Data Categories'}</h3>
                            <p className="text-xs text-muted-foreground">
                                {t('data_categories_desc') ||
                                    'Filter categories by name, tag or data type to inspect their health.'}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                                {t('categories_count_summary') ||
                                    `${categories.length} categories loaded from API`}
                            </p>
                        </div>
                        <div className="flex flex-col md:flex-row gap-2">
                            <button
                                type="button"
                                onClick={onRefresh}
                                disabled={isLoading}
                                className="text-xs px-3 py-2 border border-border rounded text-muted-foreground hover:text-foreground transition disabled:opacity-50"
                            >
                                {isLoading ? (t('refreshing') || 'Refreshing…') : (t('refresh') || 'Refresh')}
                            </button>
                            <input
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                                placeholder={t('category_filter_placeholder') || 'Filter categories'}
                                className="px-3 py-2 bg-background border border-border rounded text-xs text-foreground"
                            />
                            <input
                                value={categoryTagFilter}
                                onChange={e => setCategoryTagFilter(e.target.value)}
                                placeholder={t('category_tag_filter_placeholder') || 'Filter tags or data types'}
                                className="px-3 py-2 bg-background border border-border rounded text-xs text-foreground"
                            />
                            <button
                                onClick={() => {
                                    setCategoryFilter('');
                                    setCategoryTagFilter('');
                                }}
                                className="text-xs px-3 py-2 border border-border rounded text-muted-foreground hover:text-foreground transition"
                            >
                                {t('reset_filters') || 'Reset'}
                            </button>
                            <button
                                onClick={() => downloadCSV(filteredCategoriesList, 'data-categories')}
                                className="bg-secondary hover:bg-accent text-secondary-foreground font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                            >
                                {t('export_csv') || 'Export CSV'}
                            </button>
                            <button
                                onClick={() => {
                                    setEditingCategory(null);
                                    setShowCreateCategoryModal(true);
                                }}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                            >
                                {t('add_category') || '+ Add Category'}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredCategoriesList.length > 0 ? (
                            filteredCategoriesList.map(category => {
                                const metrics = categoryMetricsById[category.id];
                                return (
                                    <div key={category.id} className="border border-border rounded-lg p-4 space-y-3">
                                        <div className="flex justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-foreground">{category.name}</h4>
                                                    {telegramSourceCountByCategory[category.name] > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/40 flex items-center gap-1">
                                                            <span className="w-1 h-1 rounded-full bg-sky-400" />
                                                            {telegramSourceCountByCategory[category.name]}{' '}
                                                            {t('telegram') || 'Telegram'}
                                                        </span>
                                                    )}
                                                </div>
                                                {category.description && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {category.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right text-xs text-muted-foreground">
                                                <div>
                                                    {t('sources') || 'Sources'}:{' '}
                                                    <span className="text-foreground font-semibold">
                                                        {category.sourceCount}
                                                    </span>
                                                </div>
                                                <div>
                                                    {t('data_types') || 'Data Types'}:{' '}
                                                    <span className="text-foreground font-semibold">
                                                        {category.dataTypes.length}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {metrics && (
                                            <div className="flex gap-3 text-xs">
                                                <div className="flex-1 bg-secondary/40 rounded p-2">
                                                    <p className="text-muted-foreground mb-1">
                                                        {t('category_inflow') || 'Inflow (24h)'}
                                                    </p>
                                                    <p className="text-lg font-semibold text-foreground">
                                                        {metrics.inflow}
                                                    </p>
                                                </div>
                                                <div className="flex-1 bg-secondary/40 rounded p-2">
                                                    <p className="text-muted-foreground mb-1">
                                                        {t('category_pass_rate') || 'Pass Rate'}
                                                    </p>
                                                    <p className="text-lg font-semibold text-green-400">
                                                        {metrics.passRate.toFixed(1)}%
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex gap-2 pt-2 border-t border-border">
                                            <button
                                                onClick={() => {
                                                    setEditingCategory(category);
                                                    setShowCreateCategoryModal(true);
                                                }}
                                                className="text-[10px] px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded transition-colors"
                                            >
                                                {t('edit') || 'Edit'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCategory(category.id)}
                                                className="text-[10px] px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-colors"
                                            >
                                                {t('delete') || 'Delete'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-sm text-muted-foreground col-span-2">
                                {t('no_categories_match') || 'No categories match the current filters.'}
                            </p>
                        )}
                    </div>
                </Card>
            </div>
        </ApiWrapper>
    );
};

export default CategoriesPanel;
