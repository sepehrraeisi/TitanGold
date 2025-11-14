import React, { useState, useEffect } from 'react';
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
import * as api from '../services/api.ts';
import { PortfolioAsset, RiskMetric } from '../types.ts';

interface PortfolioData {
    stats: any[];
    assets: PortfolioAsset[];
    riskMetrics: RiskMetric[];
}

const Portfolio: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<PortfolioData | null>(null);
    
    useEffect(() => {
        const fetchData = async () => {
            const portfolioData = await api.fetchPortfolioPageData();
            setData(portfolioData);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }
    
    if (!data) {
        return <div className="text-center p-10 text-red-500">{t('error_occurred')}</div>
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {data.stats.map(stat => (
                    <StatCard key={stat.label} label={t(stat.label)} value={stat.value} change={stat.change} subValue={stat.subValue} />
                ))}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <PnLChartWidget />
                    <AssetHoldingsWidget assets={data.assets} />
                </div>
                <div className="space-y-6">
                    <RiskAnalysisWidget />
                    <CorrelationMatrixWidget />
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="space-y-6">
                    <MonthlyReturnsWidget />
                    <RiskMetricsWidget metrics={data.riskMetrics} />
                 </div>
                 <div className="lg:col-span-2 space-y-6">
                    <AssetDistributionWidget />
                    <AIPortfolioAnalysisWidget />
                 </div>
            </div>
        </div>
    );
};

export default Portfolio;