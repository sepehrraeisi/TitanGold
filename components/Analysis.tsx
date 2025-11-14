import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import StatCard from './analysis/StatCard.tsx';
import PerformanceChartWidget from './analysis/PerformanceChartWidget.tsx';
import DistributionDonutWidget from './analysis/DistributionDonutWidget.tsx';
import RiskAnalysisWidget from './analysis/RiskAnalysisWidget.tsx';
import SmartPredictionCard from './analysis/SmartPredictionCard.tsx';
import RecentTradesTable from './analysis/RecentTradesTable.tsx';
import ReportExportWidget from './analysis/ReportExportWidget.tsx';
import * as api from '../services/api.ts';
import { AnalysisStat, SmartPrediction, PerformanceTrade } from '../types.ts';

interface AnalysisData {
    stats: AnalysisStat[];
    predictions: SmartPrediction[];
    trades: PerformanceTrade[];
}

const Analysis: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AnalysisData | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            const analysisData = await api.fetchAnalysisPageData();
            setData(analysisData);
            setIsLoading(false);
        }
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
             <div>
                <h1 className="text-2xl font-bold text-white">{t('analysis_and_reporting')}</h1>
                <p className="text-gray-400 mt-1">{t('analysis_and_reporting_desc')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {data.stats.map(stat => <StatCard key={stat.label} {...stat} label={t(stat.label)} subValue={t(stat.subValue)} />)}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <PerformanceChartWidget />
                </div>
                <div className="space-y-6">
                    <DistributionDonutWidget 
                        title={t('pnl_distribution')}
                        data={[
                            { label: t('profitable_trades'), value: 75, color: '#22c55e' },
                            { label: t('losing_trades'), value: 25, color: '#ef4444' }
                        ]}
                    />
                    <RiskAnalysisWidget />
                </div>
            </div>

            <div className="space-y-4">
                 <h2 className="text-xl font-bold text-white">{t('smart_predictions')}</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {data.predictions.map(p => <SmartPredictionCard key={p.id} prediction={p} />)}
                </div>
            </div>

             <div className="space-y-4">
                 <h2 className="text-xl font-bold text-white">{t('recent_trades_performance')}</h2>
                 <RecentTradesTable trades={data.trades} />
             </div>
             
             <ReportExportWidget />

        </div>
    );
};

export default Analysis;