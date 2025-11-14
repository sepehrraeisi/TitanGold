import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import * as api from '../services/api.ts';

// Import all widgets
import TotalBalanceWidget from './widgets/TotalBalanceWidget.tsx';
import TitanAIWidget from './widgets/TitanAIWidget.tsx';
import ActiveTradesWidget from './widgets/ActiveTrades.tsx';
import PriceTrackerWidget from './widgets/MarketWatchlist.tsx';
import ArtemisStatusWidget from './widgets/SystemStatusWidget.tsx';
import PortfolioSummaryWidget from './widgets/PortfolioSummaryWidget.tsx';
import PerformanceChartWidget from './widgets/PerformanceChartWidget.tsx';
import TradingSignalsWidget from './widgets/TradingSignalsWidget.tsx';
import MarketNewsWidget from './widgets/MarketNewsWidget.tsx';
import ArtemisInsightsWidget from './widgets/ArtemisInsightsWidget.tsx';
import AlertsSummaryWidget from './widgets/AlertsSummaryWidget.tsx';
import RecentActivity from './widgets/RecentActivity.tsx';

const WidgetSkeleton: React.FC = () => (
    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="h-8 bg-gray-700 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-1/4"></div>
    </div>
);

const DashboardHome: React.FC = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    // In a real app, you'd fetch and store data here.
    // For now, we'll just simulate a loading delay.
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1500); // Simulate network request
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
        return (
            <>
                <div className="h-8 bg-gray-800 rounded w-1/3 mb-6 animate-pulse"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                    {Array.from({ length: 12 }).map((_, i) => <WidgetSkeleton key={i} />)}
                </div>
            </>
        );
    }
    
    return (
        <>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">{t('personal_dashboard')}</h1>
                <span className="text-sm text-gray-400">{t('last_updated', { time: new Date().toLocaleTimeString() })}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                <div className="md:col-span-1 lg:col-span-1 xl:col-span-1">
                    <TotalBalanceWidget />
                </div>
                <div className="md:col-span-1 lg:col-span-2 xl:col-span-2">
                    <TitanAIWidget />
                </div>
                <div className="md:col-span-1 lg:col-span-1 xl:col-span-1">
                    <ActiveTradesWidget />
                </div>
                <div className="md:col-span-1 lg:col-span-2 xl:col-span-2">
                    <PriceTrackerWidget />
                </div>
                
                <div className="md:col-span-1 lg:col-span-1 xl:col-span-1">
                    <ArtemisStatusWidget />
                </div>
                <div className="md:col-span-1 lg:col-span-2 xl:col-span-2">
                    <PortfolioSummaryWidget />
                </div>
                <div className="md:col-span-2 lg:col-span-3 xl:col-span-3">
                     <PerformanceChartWidget />
                </div>

                <div className="md:col-span-1 lg:col-span-2 xl:col-span-2">
                    <TradingSignalsWidget />
                </div>
                <div className="md:col-span-1 lg:col-span-2 xl:col-span-2">
                    <MarketNewsWidget />
                </div>
                 <div className="md:col-span-1 lg:col-span-1 xl:col-span-1">
                   <RecentActivity />
                </div>
                <div className="md:col-span-1 lg:col-span-1 xl:col-span-1">
                    <AlertsSummaryWidget />
                </div>
                <div className="md:col-span-2 lg:col-span-2 xl:col-span-2">
                    <ArtemisInsightsWidget />
                </div>

            </div>
        </>
    );
};

export default DashboardHome;