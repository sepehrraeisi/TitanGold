import React, { useMemo, useState } from 'react';
import { DataCategory, DataHubState } from '../../../../../types';
import { DataHubApiError } from '../../../../../services/dataSourcesApi';
import {
    DATAHUB_SHELL,
    DATAHUB_INNER_LIST,
    INPUT_CLASS,
    BTN_PRIMARY,
    BTN_SECONDARY,
    BTN_OUTLINE_SKY,
    BTN_OUTLINE_SLATE,
    BTN_OUTLINE_RED,
    DataHubAlert,
    DataHubEmpty,
    MetricCard,
    StatusPill,
    dataHubWriteGate,
} from './dataHubUi';
import { formatDataHubQueryError } from './dataHubI18n';
import { useDataHubPermissions } from './hooks/useDataHubPermissions';

interface CategoriesPanelProps {
    t: (key: string) => string;
    categories: DataCategory[];
    categoryMetricsById: Record<string, { inflow: number; passRate: number }>;
    downloadCSV: (data: any[], filename: string) => void;
    setEditingCategory: (category: DataCategory | null) => void;
    setShowCreateCategoryModal: (show: boolean) => void;
    onRefresh: () => void;
    handleDeleteCategory: (id: string) => void | Promise<void>;
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
    isLoading = false,
    apiError = null,
    dataHub,
}) => {
    const { canWrite } = useDataHubPermissions();
    const wg = (extraDisabled = false) => dataHubWriteGate(canWrite, t, extraDisabled);
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

    const metrics = useMemo(() => {
        const withTelegram = categories.filter(c => (telegramSourceCountByCategory[c.name] || 0) > 0).length;
        const withMetrics = categories.filter(c => categoryMetricsById[c.id]).length;
        return {
            total: categories.length,
            filtered: filteredCategoriesList.length,
            withTelegram,
            withMetrics,
        };
    }, [categories, filteredCategoriesList.length, telegramSourceCountByCategory, categoryMetricsById]);

    const queryError = formatDataHubQueryError(t, apiError);

    const countSummary = t('categories_count_summary').replace('{{count}}', String(categories.length));

    return (
        <div className={DATAHUB_SHELL}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
                <div>
                    <h3 className="text-sm md:text-base font-semibold text-foreground">{t('data_categories')}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">{t('data_categories_desc')}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{countSummary}</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <button type="button" onClick={onRefresh} disabled={isLoading} className={BTN_PRIMARY}>
                        {isLoading ? t('refreshing') : t('refresh')}
                    </button>
                    <input
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        placeholder={t('category_filter_placeholder')}
                        className={`${INPUT_CLASS} max-w-[180px]`}
                    />
                    <input
                        value={categoryTagFilter}
                        onChange={e => setCategoryTagFilter(e.target.value)}
                        placeholder={t('category_tag_filter_placeholder')}
                        className={`${INPUT_CLASS} max-w-[200px]`}
                    />
                    <button
                        type="button"
                        onClick={() => {
                            setCategoryFilter('');
                            setCategoryTagFilter('');
                        }}
                        className={BTN_SECONDARY}
                    >
                        {t('reset_filters')}
                    </button>
                    <button
                        type="button"
                        onClick={() => downloadCSV(filteredCategoriesList, 'data-categories')}
                        disabled={!filteredCategoriesList.length}
                        className={BTN_SECONDARY}
                    >
                        {t('export_csv')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setEditingCategory(null);
                            setShowCreateCategoryModal(true);
                        }}
                        className={BTN_PRIMARY}
                        disabled={wg().disabled}
                        title={wg().title}
                    >
                        {t('add_category')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <MetricCard label={t('categories_metric_total')} value={metrics.total} color="blue" />
                <MetricCard label={t('categories_metric_filtered')} value={metrics.filtered} color="purple" />
                <MetricCard label={t('categories_metric_telegram')} value={metrics.withTelegram} color="emerald" />
                <MetricCard label={t('categories_metric_tracked')} value={metrics.withMetrics} color="amber" />
            </div>

            {queryError && (
                <DataHubAlert
                    variant={queryError.variant}
                    message={queryError.message}
                    onRetry={queryError.retryable ? onRefresh : undefined}
                    retryLabel={t('retry')}
                />
            )}

            <div className={DATAHUB_INNER_LIST}>
                {isLoading && categories.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">{t('categories_loading')}</div>
                ) : filteredCategoriesList.length === 0 ? (
                    <DataHubEmpty
                        message={
                            categories.length === 0 ? t('no_categories_yet') : t('no_categories_match')
                        }
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredCategoriesList.map(category => {
                            const rowMetrics = categoryMetricsById[category.id];
                            const tgCount = telegramSourceCountByCategory[category.name] || 0;
                            return (
                                <div
                                    key={category.id}
                                    className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-3 hover:border-purple-500/40 transition-colors"
                                >
                                    <div className="flex justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-sm font-semibold text-foreground truncate">
                                                    {category.name}
                                                </h4>
                                                {tgCount > 0 && (
                                                    <StatusPill
                                                        label={`${tgCount} ${t('telegram')}`}
                                                        variant="info"
                                                    />
                                                )}
                                            </div>
                                            {category.description && (
                                                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                                    {category.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right text-[11px] text-muted-foreground shrink-0">
                                            <div>
                                                {t('sources')}:{' '}
                                                <span className="text-foreground font-semibold">
                                                    {category.sourceCount}
                                                </span>
                                            </div>
                                            <div>
                                                {t('data_types')}:{' '}
                                                <span className="text-foreground font-semibold">
                                                    {category.dataTypes.length}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {rowMetrics && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="rounded-lg border border-white/5 bg-slate-950/70 p-2">
                                                <p className="text-[10px] text-muted-foreground mb-1">
                                                    {t('category_inflow')}
                                                </p>
                                                <p className="text-sm font-semibold text-foreground">
                                                    {rowMetrics.inflow}
                                                </p>
                                            </div>
                                            <div className="rounded-lg border border-white/5 bg-slate-950/70 p-2">
                                                <p className="text-[10px] text-muted-foreground mb-1">
                                                    {t('category_pass_rate')}
                                                </p>
                                                <p className="text-sm font-semibold text-emerald-300">
                                                    {rowMetrics.passRate.toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {(category.tags.length > 0 || category.dataTypes.length > 0) && (
                                        <div className="flex flex-wrap gap-1">
                                            {category.tags.slice(0, 4).map(tag => (
                                                <StatusPill key={tag} label={tag} variant="neutral" />
                                            ))}
                                            {category.dataTypes.slice(0, 2).map(dt => (
                                                <StatusPill key={dt} label={dt} variant="primary" />
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2 pt-2 border-t border-slate-800/80">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingCategory(category);
                                                setShowCreateCategoryModal(true);
                                            }}
                                            className={BTN_OUTLINE_SLATE}
                                            disabled={wg().disabled}
                                            title={wg().title}
                                        >
                                            {t('edit')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteCategory(category.id)}
                                            className={BTN_OUTLINE_RED}
                                            disabled={wg().disabled}
                                            title={wg().title}
                                        >
                                            {t('delete')}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoriesPanel;
