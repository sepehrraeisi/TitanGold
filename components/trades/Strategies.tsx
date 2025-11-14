import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { Strategy } from '../../types.ts';
import StrategyCard from './strategies/StrategyCard.tsx';
import TopPerformersWidget from './strategies/TopPerformersWidget.tsx';
import StrategyComparisonChart from './strategies/StrategyComparisonChart.tsx';

const Strategies: React.FC = () => {
    const { t } = useLanguage();

    const strategies: Strategy[] = [
        { id: '1', name: 'Al Prediction Pro', type: 'AI', agents: 3, status: 'active', roi: 45.2, winRate: 89.3, trades: 234, sharpe: 3.47, maxDrawdown: 3.2, chartData: [5, 10, 15, 25, 30, 40, 45], rank: 'A' },
        { id: '2', name: 'BTC Scalping Master', type: 'Scalping', agents: 1, status: 'active', roi: 38.7, winRate: 82.1, trades: 567, sharpe: 2.89, maxDrawdown: 4.7, chartData: [10, 12, 18, 22, 28, 35, 38], rank: 'B' },
        { id: '3', name: 'Trend Following ETH', type: 'Trend', agents: 2, status: 'active', roi: 31.4, winRate: 75.6, trades: 189, sharpe: 2.34, maxDrawdown: 6.1, chartData: [5, 8, 14, 20, 21, 25, 31], rank: 'T' },
        { id: '4', name: 'Swing Trading Altcoins', type: 'Swing', agents: 4, status: 'active', roi: 28.9, winRate: 71.2, trades: 145, sharpe: 2.12, maxDrawdown: 8.3, chartData: [8, 10, 15, 18, 20, 25, 29], rank: 'S' },
        { id: '5', name: 'Arbitrage Multi-Exchange', type: 'Arbitrage', agents: 5, status: 'active', roi: 22.1, winRate: 94.7, trades: 891, sharpe: 1.87, maxDrawdown: 1.8, chartData: [15, 16, 18, 20, 21, 22, 22], rank: 'A' },
        { id: '6', name: 'DCA Bitcoin Strategy', type: 'Trend', agents: 2, status: 'inactive', roi: 18.5, winRate: 68.3, trades: 78, sharpe: 1.65, maxDrawdown: 12.4, chartData: [5, 6, 8, 10, 12, 15, 18], rank: 'D' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">{t('strategy_management')}</h2>
                    <p className="text-gray-400 text-sm">{t('strategy_management_desc')}</p>
                </div>
                <div className="flex gap-2">
                    <button className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm">{t('new_strategy')}</button>
                    <button className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm">{t('ai_smart_generate')}</button>
                </div>
            </div>
            
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label={t('total_return')} value="33.3%+" subValue="Last 30 days" />
                <StatCard label={t('avg_win_rate')} value="82.6%" subValue="All Strategies" />
                <StatCard label={t('total_trades')} value="1,247" subValue="This Month" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-semibold text-white">{t('strategy_list')}</h3>
                    {strategies.map(strategy => (
                        <StrategyCard key={strategy.id} strategy={strategy} />
                    ))}
                </div>
                <div className="space-y-6">
                    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
                         <h3 className="font-semibold text-white mb-3">{t('strategy_details')}</h3>
                         <p className="text-sm text-center text-gray-500 py-10">{t('select_strategy_prompt')}</p>
                    </div>
                    <TopPerformersWidget strategies={strategies} />
                    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
                         <h3 className="font-semibold text-white mb-3">{t('quick_actions')}</h3>
                         <div className="grid grid-cols-2 gap-2 text-sm">
                            <button className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg">{t('group_backtest')}</button>
                            <button className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg">{t('optimize_all')}</button>
                            <button className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg">{t('export_all')}</button>
                            <button className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg">{t('allocate_portfolio')}</button>
                         </div>
                    </div>
                </div>
            </div>

            <StrategyComparisonChart strategies={strategies} />
        </div>
    );
};

const StatCard: React.FC<{ label: string, value: string, subValue: string }> = ({ label, value, subValue }) => (
    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        <p className="text-xs text-gray-500">{subValue}</p>
    </div>
);


export default Strategies;
