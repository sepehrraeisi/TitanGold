
import React, { useState, useMemo } from 'react';
import * as api from '../../../../../../services/api';
import { DataHubState, DataPipelineSourceSnapshot } from '../../../../../../types';
import { SummaryCard } from '../../../../../ui/summary-card';
import { EmptyState } from '../../../../../ui/empty-state';
import { ActionButton } from '../../../../../ui/action-button';
import { StatusBadge } from '../../../../../ui/status-badge';
import ApiWrapper from '../../../../../common/ApiWrapper';
import { useAsync } from '../../../../../../hooks/useAsync';

interface SmartPrioritizationProps {
    dataHub: DataHubState;
    setDataHub: (hub: DataHubState) => void;
    onRefresh: () => void;
    t: (key: string) => string;
    formatTimeAgo: (timestamp?: string) => string;
    sourceQualityMap: Record<string, DataPipelineSourceSnapshot>;
    getStatusBadgeClass: (status?: string) => string;
}

const SmartPrioritization: React.FC<SmartPrioritizationProps> = ({
    dataHub,
    setDataHub,
    onRefresh,
    t,
    formatTimeAgo,
    sourceQualityMap,
    getStatusBadgeClass
}) => {
    const toggleAsync = useAsync(api.setSmartPrioritizationEnabled);
    const calculateAsync = useAsync(api.calculateSourcePriorities);
    const saveFactorsAsync = useAsync(api.updatePrioritizationFactors);
    const setOverrideAsync = useAsync(api.setPriorityOverride);
    const removeOverrideAsync = useAsync(api.removePriorityOverride);

    const [showConfigModal, setShowConfigModal] = useState(false);
    const [overrideSourceId, setOverrideSourceId] = useState<string | null>(null);
    const [overrideValue, setOverrideValue] = useState<number>(50);

    const advanced = dataHub.advanced || { smartPrioritization: { enabled: false, rules: [] } };
    const prioritization = advanced.smartPrioritization;

    // Calculate summary metrics
    const summary = useMemo(() => {
        const rules = prioritization.rules || [];
        const avgPriority = rules.length > 0
            ? rules.reduce((sum, r) => sum + r.calculatedPriority, 0) / rules.length
            : 0;

        const highPriority = rules.filter(r => r.calculatedPriority >= 70).length;
        const mediumPriority = rules.filter(r => r.calculatedPriority >= 40 && r.calculatedPriority < 70).length;
        const lowPriority = rules.filter(r => r.calculatedPriority < 40).length;

        return {
            total: rules.length,
            avgPriority: avgPriority.toFixed(1),
            highPriority,
            mediumPriority,
            lowPriority,
            lastUpdate: prioritization.lastUpdate
        };
    }, [prioritization]);

    // Default factor weights
    const defaultFactors = {
        quality: 30,
        freshness: 25,
        reliability: 25,
        categoryImportance: 20
    };

    const [factorWeights, setFactorWeights] = useState(defaultFactors);

    const handleToggleSmartPrioritization = async (enabled: boolean) => {
        try {
            const updated = await toggleAsync.execute(enabled);
            setDataHub(updated);
            onRefresh();
        } catch (e: any) {
            console.error('Failed to toggle smart prioritization:', e);
        }
    };

    const handleCalculatePriorities = async () => {
        try {
            await calculateAsync.execute();
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e: any) {
            console.error('Calculation failed:', e);
        }
    };

    const handleSaveFactorWeights = async () => {
        try {
            await saveFactorsAsync.execute(factorWeights);
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
            setShowConfigModal(false);
        } catch (e: any) {
            console.error('Failed to save factors:', e);
        }
    };

    const handleSetOverride = async (sourceId: string, priority: number) => {
        try {
            await setOverrideAsync.execute(sourceId, priority);
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
            setOverrideSourceId(null);
        } catch (e: any) {
            console.error('Failed to set override:', e);
        }
    };

    const handleRemoveOverride = async (sourceId: string) => {
        try {
            await removeOverrideAsync.execute(sourceId);
            const updated = await api.fetchDataHubState();
            setDataHub(updated);
            onRefresh();
        } catch (e: any) {
            console.error('Failed to remove override:', e);
        }
    };

    // Sort rules by priority
    const sortedRules = useMemo(() => {
        return [...(prioritization.rules || [])].sort((a, b) => b.calculatedPriority - a.calculatedPriority);
    }, [prioritization.rules]);

    const getPriorityColor = (priority: number) => {
        if (priority >= 70) return 'text-green-400';
        if (priority >= 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getPriorityLabel = (priority: number) => {
        if (priority >= 70) return 'High';
        if (priority >= 40) return 'Medium';
        return 'Low';
    };

    return (
        <ApiWrapper
            error={toggleAsync.error || calculateAsync.error || saveFactorsAsync.error || setOverrideAsync.error || removeOverrideAsync.error}
            setError={() => {
                toggleAsync.setError(null);
                calculateAsync.setError(null);
                saveFactorsAsync.setError(null);
                setOverrideAsync.setError(null);
                removeOverrideAsync.setError(null);
            }}
            isLoading={toggleAsync.isLoading || calculateAsync.isLoading || saveFactorsAsync.isLoading || setOverrideAsync.isLoading || removeOverrideAsync.isLoading}
        >
            <div className="bg-card border border-border rounded-lg p-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            📊 {t('smart_prioritization') || 'Smart Prioritization'}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('prioritization_desc') || 'Automatically prioritize data sources based on quality, freshness, and reliability'}
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={prioritization.enabled}
                                onChange={(e) => handleToggleSmartPrioritization(e.target.checked)}
                                disabled={toggleAsync.isLoading}
                                className="rounded"
                            />
                            <span className="text-foreground">{t('enable') || 'Enable'}</span>
                        </label>
                        <ActionButton
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowConfigModal(true)}
                            disabled={!prioritization.enabled}
                        >
                            ⚙️ {t('configure') || 'Configure'}
                        </ActionButton>
                        <ActionButton
                            variant="primary"
                            size="sm"
                            loading={calculateAsync.isLoading}
                            onClick={handleCalculatePriorities}
                            disabled={!prioritization.enabled}
                        >
                            {t('calculate_priorities') || 'Calculate'}
                        </ActionButton>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <SummaryCard
                        label={t('total_sources') || 'Total Sources'}
                        value={summary.total}
                        icon={<span className="text-2xl">📦</span>}
                    />
                    <SummaryCard
                        label={t('avg_priority') || 'Avg Priority'}
                        value={summary.avgPriority}
                        icon={<span className="text-2xl">📈</span>}
                    />
                    <SummaryCard
                        label={t('high_priority') || 'High Priority'}
                        value={summary.highPriority}
                        variant="success"
                        icon={<span className="text-2xl">🔥</span>}
                    />
                    <SummaryCard
                        label={t('low_priority') || 'Low Priority'}
                        value={summary.lowPriority}
                        variant="warning"
                        icon={<span className="text-2xl">❄️</span>}
                    />
                </div>

                {/* Priority Distribution Chart */}
                {sortedRules.length > 0 && (
                    <div className="bg-secondary/20 border border-border rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-semibold text-foreground mb-3">
                            {t('priority_distribution') || 'Priority Distribution'}
                        </h4>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs">
                                <div className="w-20 text-muted-foreground">{t('high') || 'High'}</div>
                                <div className="flex-1 bg-background rounded-full h-6 overflow-hidden">
                                    <div
                                        className="bg-green-500 h-full flex items-center justify-end pr-2 text-white text-[10px] font-bold"
                                        style={{ width: `${(summary.highPriority / summary.total) * 100}%` }}
                                    >
                                        {summary.highPriority > 0 && summary.highPriority}
                                    </div>
                                </div>
                                <div className="w-12 text-right text-muted-foreground">
                                    {((summary.highPriority / summary.total) * 100).toFixed(0)}%
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <div className="w-20 text-muted-foreground">{t('medium') || 'Medium'}</div>
                                <div className="flex-1 bg-background rounded-full h-6 overflow-hidden">
                                    <div
                                        className="bg-yellow-500 h-full flex items-center justify-end pr-2 text-white text-[10px] font-bold"
                                        style={{ width: `${(summary.mediumPriority / summary.total) * 100}%` }}
                                    >
                                        {summary.mediumPriority > 0 && summary.mediumPriority}
                                    </div>
                                </div>
                                <div className="w-12 text-right text-muted-foreground">
                                    {((summary.mediumPriority / summary.total) * 100).toFixed(0)}%
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <div className="w-20 text-muted-foreground">{t('low') || 'Low'}</div>
                                <div className="flex-1 bg-background rounded-full h-6 overflow-hidden">
                                    <div
                                        className="bg-red-500 h-full flex items-center justify-end pr-2 text-white text-[10px] font-bold"
                                        style={{ width: `${(summary.lowPriority / summary.total) * 100}%` }}
                                    >
                                        {summary.lowPriority > 0 && summary.lowPriority}
                                    </div>
                                </div>
                                <div className="w-12 text-right text-muted-foreground">
                                    {((summary.lowPriority / summary.total) * 100).toFixed(0)}%
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sources List */}
                {sortedRules.length > 0 ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-foreground">
                                {t('source_priorities') || 'Source Priorities'}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                {summary.lastUpdate ? `${t('last_update') || 'Updated'}: ${formatTimeAgo(summary.lastUpdate)}` : ''}
                            </p>
                        </div>
                        {sortedRules.slice(0, 20).map(rule => {
                            const source = dataHub.sources.find(s => s.id === rule.sourceId);
                            const sourceSignal = sourceQualityMap[rule.sourceId];
                            const isOverridden = rule.manualOverride !== undefined;
                            const priority = isOverridden ? rule.manualOverride! : rule.calculatedPriority;

                            return (
                                <div key={rule.sourceId} className="border border-border rounded-lg p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h5 className="font-semibold text-foreground">
                                                    {source?.name || rule.sourceId}
                                                </h5>
                                                <StatusBadge
                                                    status={priority >= 70 ? 'success' : priority >= 40 ? 'warning' : 'error'}
                                                    label={getPriorityLabel(priority)}
                                                    size="sm"
                                                />
                                                {isOverridden && (
                                                    <StatusBadge status="info" label="Manual" size="sm" />
                                                )}
                                            </div>

                                            {/* Priority Bar */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="flex-1 bg-background rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className={`h-full ${priority >= 70 ? 'bg-green-500' : priority >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                        style={{ width: `${priority}%` }}
                                                    />
                                                </div>
                                                <span className={`text-sm font-bold ${getPriorityColor(priority)}`}>
                                                    {priority.toFixed(1)}
                                                </span>
                                            </div>

                                            {/* Factors */}
                                            {!isOverridden && rule.factors && (
                                                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2">
                                                    {Object.entries(rule.factors).map(([key, weight]) => (
                                                        <span key={key} className="inline-flex items-center gap-1">
                                                            <span className="capitalize">{t(key) || key}:</span>
                                                            <span className="text-foreground font-medium">{(weight * 100).toFixed(0)}%</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Pipeline Signal */}
                                            {sourceSignal && (
                                                <div className="text-[11px] text-muted-foreground mt-2 flex flex-wrap gap-3">
                                                    <span className="flex items-center gap-1">
                                                        {t('pipeline_signal_last_status') || 'Status'}:
                                                        <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${getStatusBadgeClass(sourceSignal.lastStatus)}`}>
                                                            {sourceSignal.lastStatus}
                                                        </span>
                                                    </span>
                                                    {typeof sourceSignal.lastResponseTime === 'number' && (
                                                        <span>{sourceSignal.lastResponseTime} ms</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-1">
                                            {overrideSourceId === rule.sourceId ? (
                                                <div className="flex flex-col gap-2 bg-secondary/20 p-2 rounded">
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        value={overrideValue}
                                                        onChange={(e) => setOverrideValue(Number(e.target.value))}
                                                        className="w-32"
                                                    />
                                                    <div className="flex gap-1">
                                                        <ActionButton
                                                            variant="success"
                                                            size="sm"
                                                            onClick={() => handleSetOverride(rule.sourceId, overrideValue)}
                                                        >
                                                            ✓
                                                        </ActionButton>
                                                        <ActionButton
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setOverrideSourceId(null)}
                                                        >
                                                            ✕
                                                        </ActionButton>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <ActionButton
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setOverrideSourceId(rule.sourceId);
                                                            setOverrideValue(Math.round(priority));
                                                        }}
                                                    >
                                                        📌 {t('override') || 'Override'}
                                                    </ActionButton>
                                                    {isOverridden && (
                                                        <ActionButton
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRemoveOverride(rule.sourceId)}
                                                        >
                                                            🔄 {t('reset') || 'Reset'}
                                                        </ActionButton>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {sortedRules.length > 20 && (
                            <p className="text-xs text-center text-muted-foreground py-2">
                                {t('showing_top_20') || 'Showing top 20 sources'} ({sortedRules.length} {t('total') || 'total'})
                            </p>
                        )}
                    </div>
                ) : (
                    <EmptyState
                        icon={<span className="text-4xl">📊</span>}
                        title={t('no_priorities') || 'No priorities calculated'}
                        description={t('priorities_desc') || 'Enable smart prioritization and click Calculate to automatically prioritize your data sources'}
                        action={
                            prioritization.enabled ? (
                                <ActionButton
                                    variant="primary"
                                    onClick={handleCalculatePriorities}
                                    loading={calculateAsync.isLoading}
                                >
                                    {t('calculate_now') || 'Calculate Now'}
                                </ActionButton>
                            ) : undefined
                        }
                    />
                )}

                {/* Factor Configuration Modal */}
                {showConfigModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
                            <h3 className="text-lg font-semibold text-foreground mb-4">
                                {t('configure_factors') || 'Configure Priority Factors'}
                            </h3>
                            <div className="space-y-4 mb-6">
                                {Object.entries(factorWeights).map(([key, value]) => (
                                    <div key={key}>
                                        <label className="block text-sm font-medium text-foreground mb-2 capitalize">
                                            {t(key) || key}: {value}%
                                        </label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={value}
                                            onChange={(e) => setFactorWeights(prev => ({
                                                ...prev,
                                                [key]: Number(e.target.value)
                                            }))}
                                            className="w-full"
                                        />
                                    </div>
                                ))}
                                <div className="bg-secondary/20 rounded p-3 text-xs text-muted-foreground">
                                    <p className="font-semibold mb-1">{t('total') || 'Total'}: {Object.values(factorWeights).reduce((a, b) => a + b, 0)}%</p>
                                    <p>{t('factor_weights_note') || 'Adjust weights to control how each factor influences priority calculation'}</p>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <ActionButton
                                    variant="ghost"
                                    onClick={() => setShowConfigModal(false)}
                                >
                                    {t('cancel') || 'Cancel'}
                                </ActionButton>
                                <ActionButton
                                    variant="primary"
                                    loading={saveFactorsAsync.isLoading}
                                    onClick={handleSaveFactorWeights}
                                >
                                    {t('save') || 'Save'}
                                </ActionButton>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ApiWrapper>
    );
};

export default SmartPrioritization;
