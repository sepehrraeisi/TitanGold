import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import StatCard from './StatCard.tsx';
import TradingChartWidget from './TradingChartWidget.tsx';
import QuickTradeWidget from './QuickTradeWidget.tsx';
import AIAssistantWidget from './AIAssistantWidget.tsx';
import PortfolioDonutChartWidget from './PortfolioDonutChartWidget.tsx';
import PerformanceAnalysisWidget from './PerformanceAnalysisWidget.tsx';
import RecentTradesWidget from './RecentTradesWidget.tsx';

const ManualTrades: React.FC = () => {
    const { t } = useLanguage();

    const stats = [
        { label: t('win_rate'), value: '78.4%' },
        { label: t('today_profit'), value: '$245.67+' },
        { label: t('total_profit'), value: '$12,450.00' },
        { label: t('sharpe_ratio'), value: '2.47', subValue: t('adjusted_performance') },
        { label: t('best_trade'), value: '12.3%+', subValue: 'BTC/USDT' },
        { label: t('trades_volume'), value: '$45.2K', subValue: '24 hours' },
        { label: t('active_trades'), value: '8', subValue: 'In progress' },
    ];

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white">{t('professional_manual_trades')}</h2>
                <p className="text-gray-400">{t('professional_manual_desc')}</p>
                <p className="text-xs text-yellow-400 mt-2 animate-pulse">{t('simulation_mode')}</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {stats.map(stat => (
                    <StatCard key={stat.label} label={stat.label} value={stat.value} subValue={stat.subValue} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <TradingChartWidget />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <QuickTradeWidget />
                        <AIAssistantWidget />
                    </div>
                </div>
                <div className="space-y-6">
                    <PortfolioDonutChartWidget />
                    <PerformanceAnalysisWidget />
                    <RecentTradesWidget />
                </div>
            </div>
        </div>
    );
};

export default ManualTrades;
