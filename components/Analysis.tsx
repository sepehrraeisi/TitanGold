import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import StatCard from './analysis/StatCard.tsx';
import PerformanceChartWidget from './analysis/PerformanceChartWidget.tsx';
import DistributionDonutWidget from './analysis/DistributionDonutWidget.tsx';
import RiskAnalysisWidget from './analysis/RiskAnalysisWidget.tsx';
import SmartPredictionCard from './analysis/SmartPredictionCard.tsx';
import RecentTradesTable from './analysis/RecentTradesTable.tsx';
import ReportExportWidget from './analysis/ReportExportWidget.tsx';
import Skeleton from './ui/skeleton.tsx';
import * as api from '../services/api.ts';
import type { AnalysisPageData, AnalysisTimeRange } from '../types.ts';

const Analysis: React.FC = () => {
    const { t, language } = useLanguage();
    const locale = language === 'fa' ? 'fa-IR' : 'en-US';

    const [data, setData] = useState<AnalysisPageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
    const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
    const [reportId, setReportId] = useState<string | null>(null);

    const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }), [locale]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.fetchAnalysisPageData();
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'error_occurred');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRangeChange = async (nextRange: AnalysisTimeRange) => {
        if (!data || data.activeRange === nextRange) {
            return;
        }
        setUpdating(true);
        try {
            const updated = await api.setAnalysisActiveRange(nextRange);
            setData(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'error_occurred');
        } finally {
            setUpdating(false);
        }
    };

    const handleRefreshSnapshot = async () => {
        setUpdating(true);
        try {
            const updated = await api.refreshAnalysisSnapshot();
            setData(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'error_occurred');
        } finally {
            setUpdating(false);
        }
    };

    const handleRegeneratePrediction = async (predictionId: string) => {
        setRegeneratingId(predictionId);
        try {
            const updated = await api.regenerateAnalysisPrediction(predictionId);
            setData(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'error_occurred');
        } finally {
            setRegeneratingId(null);
        }
    };

    const handleGenerateReport = async (reportIdToGenerate: string) => {
        setReportId(reportIdToGenerate);
        try {
            const { data: updated } = await api.generateAnalysisReport(reportIdToGenerate);
            setData(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'error_occurred');
        } finally {
            setReportId(null);
        }
    };

    const lastUpdatedLabel = useMemo(() => {
        if (!data) {
            return undefined;
        }
        const formatted = dateFormatter.format(new Date(data.lastUpdated));
        return t('last_updated', { time: formatted });
    }, [data, dateFormatter, t]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="h-7 w-64" />
                    <Skeleton className="h-4 w-80 mt-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-28 w-full" />
                    ))}
                </div>
                <Skeleton className="h-72 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-40 w-full" />
                    ))}
                </div>
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg p-6 flex flex-col items-center gap-4">
                <p>{t('error_occurred')}</p>
                <button
                    type="button"
                    onClick={loadData}
                    className="px-4 py-2 rounded-md border border-red-500 text-red-200 hover:bg-red-500/20"
                >
                    {t('retry')}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('analysis_and_reporting')}</h1>
                    <p className="text-gray-400 mt-1">{t('analysis_and_reporting_desc')}</p>
                </div>
                {error && (
                    <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                        {t('error_occurred')}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {data.stats.map(stat => (
                    <StatCard key={stat.id} stat={stat} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <PerformanceChartWidget
                        range={data.activeRange}
                        performance={data.performance}
                        onRangeChange={handleRangeChange}
                        onRefresh={handleRefreshSnapshot}
                        isUpdating={updating}
                        lastUpdatedLabel={lastUpdatedLabel}
                    />
                </div>
                <div className="space-y-6">
                    <DistributionDonutWidget title={t('pnl_distribution')} data={data.distribution} />
                    <RiskAnalysisWidget metrics={data.riskMetrics} />
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-bold text-white">{t('smart_predictions')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {data.predictions.map(prediction => (
                        <SmartPredictionCard
                            key={prediction.id}
                            prediction={prediction}
                            onRegenerate={handleRegeneratePrediction}
                            isProcessing={regeneratingId === prediction.id}
                        />
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-bold text-white">{t('recent_trades_performance')}</h2>
                <RecentTradesTable trades={data.trades} />
            </div>

            <ReportExportWidget
                reports={data.reports}
                onGenerate={handleGenerateReport}
                generatingId={reportId}
            />
        </div>
    );
};

export default Analysis;
