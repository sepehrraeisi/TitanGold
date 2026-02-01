import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import StatCard from './portfolio/StatCard.tsx';
import PnLChartWidget from './portfolio/PnLChartWidget.tsx';
import AssetDistributionWidget from './portfolio/AssetDistributionWidget.tsx';
import AssetHoldingsWidget from './portfolio/AssetHoldingsWidget.tsx';
import RiskAnalysisWidget from './portfolio/RiskAnalysisWidget.tsx';
import CorrelationMatrixWidget from './portfolio/CorrelationMatrixWidget.tsx';
import MonthlyReturnsWidget from './portfolio/MonthlyReturnsWidget.tsx';
import RiskMetricsWidget from './portfolio/RiskMetricsWidget.tsx';
import AIPortfolioAnalysisWidget from './portfolio/AIPortfolioAnalysisWidget.tsx';
import Button from './ui/button.tsx';
import * as api from '../services/api.ts';
import type { PortfolioPageData, PortfolioOverviewStat, PortfolioTimeRange } from '../types.ts';

const Portfolio: React.FC = () => {
    const { t, language } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<PortfolioPageData | null>(null);
    const [selectedRange, setSelectedRange] = useState<PortfolioTimeRange>('1M');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isRebalancing, setIsRebalancing] = useState(false);
    const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const timestampFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
            }),
        [language],
    );

    const alignSelectedRange = useCallback(
        (payload: PortfolioPageData) => {
            if (!payload.performance[selectedRange]) {
                const ranges = Object.keys(payload.performance) as PortfolioTimeRange[];
                if (ranges.length > 0) {
                    setSelectedRange(ranges[0]);
                }
            }
        },
        [selectedRange],
    );

    const loadPortfolio = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const portfolioData = await api.fetchPortfolioPageData();
            setData(portfolioData);
            alignSelectedRange(portfolioData);
        } catch (err) {
            console.error(err);
            setError('portfolio_load_failed');
        } finally {
            setIsLoading(false);
        }
    }, [alignSelectedRange]);

    useEffect(() => {
        loadPortfolio();
    }, [loadPortfolio]);

    const formatCurrency = useCallback(
        (value: number, decimals = 2) =>
            new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            }).format(value),
        [language],
    );

    const formatPlain = useCallback(
        (value: number, decimals = 2) =>
            new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            }).format(value),
        [language],
    );

    const formatStatValue = useCallback(
        (stat: PortfolioOverviewStat) => {
            const decimals = stat.decimals ?? (stat.format === 'currency' ? 2 : stat.format === 'percent' ? 1 : 2);
            if (stat.format === 'currency') {
                return formatCurrency(stat.value, decimals);
            }
            if (stat.format === 'percent') {
                return `${formatPlain(stat.value, decimals)}%`;
            }
            return formatPlain(stat.value, decimals);
        },
        [formatCurrency, formatPlain],
    );

    const formatStatChange = useCallback(
        (stat: PortfolioOverviewStat) => {
            if (typeof stat.change !== 'number') {
                return undefined;
            }
            const decimals = stat.changeDecimals ?? stat.decimals ?? (stat.changeFormat === 'percent' ? 1 : 2);
            const sign = stat.change >= 0 ? '+' : '-';
            const absolute = Math.abs(stat.change);
            if (stat.changeFormat === 'currency') {
                const formatted = formatCurrency(absolute, decimals);
                return stat.showChangeSign === false ? formatted : `${sign}${formatted}`;
            }
            if (stat.changeFormat === 'percent') {
                const formatted = formatPlain(absolute, decimals);
                return stat.showChangeSign === false ? `${formatted}%` : `${sign}${formatted}%`;
            }
            const formatted = formatPlain(absolute, decimals);
            return stat.showChangeSign === false ? formatted : `${sign}${formatted}`;
        },
        [formatCurrency, formatPlain],
    );

    const formattedStats = useMemo(() => {
        if (!data) {
            return [];
        }
        return data.stats.map(stat => ({
            id: stat.id,
            label: t(stat.labelKey),
            value: formatStatValue(stat),
            change: formatStatChange(stat),
            subValue: stat.subLabelKey ? t(stat.subLabelKey, stat.subLabelParams) : undefined,
        }));
    }, [data, formatStatChange, formatStatValue, t]);

    const lastUpdatedLabel = useMemo(() => {
        if (!data) {
            return '';
        }
        return t('last_updated', { time: timestampFormatter.format(new Date(data.lastUpdated)) });
    }, [data, t, timestampFormatter]);

    const handleRefresh = useCallback(async () => {
        if (isRefreshing) {
            return;
        }
        try {
            setIsRefreshing(true);
            setError(null);
            const updated = await api.refreshPortfolioSnapshot();
            setData(updated);
            alignSelectedRange(updated);
        } catch (err) {
            console.error(err);
            setError('portfolio_action_failed');
        } finally {
            setIsRefreshing(false);
        }
    }, [alignSelectedRange, isRefreshing]);

    const handleRebalance = useCallback(async () => {
        if (isRebalancing) {
            return;
        }
        try {
            setIsRebalancing(true);
            setError(null);
            const updated = await api.rebalancePortfolio('risk_adjusted');
            setData(updated);
            alignSelectedRange(updated);
        } catch (err) {
            console.error(err);
            setError('portfolio_action_failed');
        } finally {
            setIsRebalancing(false);
        }
    }, [alignSelectedRange, isRebalancing]);

    const handleAcknowledge = useCallback(
        async (insightId: string) => {
            try {
                setAcknowledgingId(insightId);
                setError(null);
                const updated = await api.acknowledgePortfolioInsight(insightId);
                setData(updated);
                alignSelectedRange(updated);
            } catch (err) {
                console.error(err);
                setError('portfolio_action_failed');
            } finally {
                setAcknowledgingId(null);
            }
        },
        [alignSelectedRange],
    );

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

    if (!data) {
        return <div className="text-center p-10 text-red-500">{t('error_occurred')}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-white">{t('portfolio_overview_heading')}</h2>
                    <p className="text-xs text-gray-400">{lastUpdatedLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? t('updating') : t('refresh')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleRebalance}
                        disabled={isRebalancing}
                    >
                        {isRebalancing ? t('rebalancing') : t('rebalance_now')}
                    </Button>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-md border border-red-500/40 bg-red-500/10 text-sm text-red-300">
                    {t(error)}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {formattedStats.map(stat => (
                    <StatCard
                        key={stat.id}
                        label={stat.label}
                        value={stat.value}
                        change={stat.change}
                        subValue={stat.subValue}
                    />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <PnLChartWidget
                        performance={data.performance}
                        selectedRange={selectedRange}
                        onRangeChange={setSelectedRange}
                        onRefresh={handleRefresh}
                        isRefreshing={isRefreshing}
                    />
                    <AssetHoldingsWidget assets={data.holdings} isUpdating={isRefreshing || isRebalancing} />
                </div>
                <div className="space-y-6">
                    <RiskAnalysisWidget exposures={data.exposures} />
                    <CorrelationMatrixWidget correlation={data.correlation} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-6">
                    <MonthlyReturnsWidget returns={data.monthlyReturns} />
                    <RiskMetricsWidget metrics={data.riskMetrics} />
                </div>
                <div className="lg:col-span-2 space-y-6">
                    <AssetDistributionWidget distribution={data.distribution} />
                    <AIPortfolioAnalysisWidget
                        insights={data.insights}
                        onAcknowledge={handleAcknowledge}
                        acknowledgingId={acknowledgingId}
                    />
                </div>
            </div>
        </div>
    );
};

export default Portfolio;