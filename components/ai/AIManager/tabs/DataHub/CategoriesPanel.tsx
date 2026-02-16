import React, { useMemo, useState } from 'react';
import * as api from '../../../../../services/api';
import { DataCategory, DataHubState } from '../../../../../types';
import ApiWrapper from '../../../../common/ApiWrapper';

interface CategoriesPanelProps {
    t: (key: string) => string;
    categories: DataCategory[];
    categoryMetricsById: Record<string, { inflow: number; passRate: number }>;
    downloadCSV: (data: any[], filename: string) => void;
    setEditingCategory: (category: DataCategory | null) => void;
    setShowCreateCategoryModal: (show: boolean) => void;
    onRefresh: () => void;
    setDataHub: React.Dispatch<React.SetStateAction<DataHubState | null>>;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
    isLoading?: boolean;
    error?: string | null;
    setError?: (err: string | null) => void;
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
    setDataHub,
    Card,
    isLoading = false,
    error = null,
    setError = () => { },
    dataHub
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

    // Count Telegram sources per category (TASK-DHT-021, TASK-DHT-025)
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

    return (
        <ApiWrapper
            error={error}
            setError={setError}
            isLoading={isLoading && categories.length === 0}
        >
            <Card>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('data_categories') || 'Data Categories'}</h3>
                        <p className="text-xs text-muted-foreground">
                            {t('data_categories_desc') || 'Filter categories by name, tag or data type to inspect their health.'}
                        </p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2">
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
                                                        {telegramSourceCountByCategory[category.name]} {t('telegram') || 'Telegram'}
                                                    </span>
                                                )}
                                            </div>
                                            {category.description && (
                                                <p className="text-xs text-muted-foreground mt-1">{category.description}</p>
                                            )}
                                        </div>
                                        <div className="text-right text-xs text-muted-foreground">
                                            <div>{t('sources') || 'Sources'}: <span className="text-foreground font-semibold">{category.sourceCount}</span></div>
                                            {telegramSourceCountByCategory[category.name] > 0 && (
                                                <div className="text-sky-300">
                                                    {t('telegram_sources') || 'Telegram'}: <span className="font-semibold">{telegramSourceCountByCategory[category.name]}</span>
                                                </div>
                                            )}
                                            <div>{t('data_types') || 'Data Types'}: <span className="text-foreground font-semibold">{category.dataTypes.length}</span></div>
                                        </div>
                                    </div>
                                    {metrics && (
                                        <div className="flex gap-3 text-xs">
                                            <div className="flex-1 bg-secondary/40 rounded p-2">
                                                <p className="text-muted-foreground mb-1">{t('category_inflow') || 'Inflow (24h)'}</p>
                                                <p className="text-lg font-semibold text-foreground">{metrics.inflow}</p>
                                            </div>
                                            <div className="flex-1 bg-secondary/40 rounded p-2">
                                                <p className="text-muted-foreground mb-1">{t('category_pass_rate') || 'Pass Rate'}</p>
                                                <p className="text-lg font-semibold text-green-400">{metrics.passRate.toFixed(1)}%</p>
                                            </div>
                                        </div>
                                    )}
                                    {(category.tags.length > 0 || category.dataTypes.length > 0) && (
                                        <div className="text-[11px] text-muted-foreground">
                                            {category.tags.length > 0 && (
                                                <p className="mb-1">
                                                    {t('tags') || 'Tags'}: {category.tags.join(', ')}
                                                </p>
                                            )}
                                            {category.dataTypes.length > 0 && (
                                                <p>
                                                    {t('data_types') || 'Data Types'}: {category.dataTypes.join(', ')}
                                                </p>
                                            )}
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
                                            onClick={async () => {
                                                if (window.confirm(t('confirm_delete_category') || 'Are you sure you want to delete this category?')) {
                                                    try {
                                                        await api.deleteDataCategory(category.id);
                                                        const updated = await api.fetchDataHubState();
                                                        setDataHub(updated);
                                                        onRefresh();
                                                    } catch (e) {
                                                        alert(t('delete_failed') || 'Failed to delete category');
                                                    }
                                                }
                                            }}
                                            className="text-[10px] px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-colors"
                                        >
                                            {t('delete') || 'Delete'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-sm text-muted-foreground">{t('no_categories_match') || 'No categories match the current filters.'}</p>
                    )}
                </div>
            </Card>
        </ApiWrapper>
    );
};

export default CategoriesPanel;
