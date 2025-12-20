import React from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { Strategy } from '../../../types.ts';

interface StrategyCardProps {
    strategy: Strategy;
    onToggle?: () => void;
    isSelected?: boolean;
    onEdit?: (strategy: Strategy) => void;
    onBacktest?: (strategy: Strategy) => void;
    onCopy?: (strategyId: string) => void;
}

const StrategyCard: React.FC<StrategyCardProps> = ({ strategy, onToggle, isSelected = false, onEdit, onBacktest, onCopy }) => {
    const { t } = useLanguage();

    const rankColor = {
        A: 'bg-green-500/20 text-green-300 border-green-500',
        B: 'bg-blue-500/20 text-blue-300 border-blue-500',
        T: 'bg-purple-500/20 text-purple-300 border-purple-500',
        S: 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
        D: 'bg-red-500/20 text-red-300 border-red-500',
        N: 'bg-gray-500/20 text-gray-300 border-gray-500',
        M: 'bg-indigo-500/20 text-indigo-300 border-indigo-500',
    };

    const Metric: React.FC<{ label: string, value: string | number }> = ({ label, value }) => (
        <div className="text-center">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="font-semibold text-white">{value}</p>
        </div>
    );
    
    return (
        <div className={`bg-[#1c1e2f] border ${isSelected ? 'border-purple-500/50' : 'border-gray-700/50'} rounded-lg p-4 flex flex-col md:flex-row gap-4 transition-all`}>
            <div className={`w-full md:w-10 flex md:flex-col items-center justify-center rounded-lg border-2 ${rankColor[strategy.rank]}`}>
                <span className="font-bold text-2xl">{strategy.rank}</span>
            </div>
            <div className="flex-grow">
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-bold text-white">{strategy.name}</h4>
                        <p className="text-xs text-gray-400">{strategy.type} - {strategy.agents} Agents</p>
                    </div>
                    {/* Toggle Switch */}
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${strategy.status === 'active' ? 'text-green-400' : 'text-gray-500'}`}>
                            {t(strategy.status) || strategy.status}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle?.();
                            }}
                            className={`${strategy.status === 'active' ? 'bg-green-600' : 'bg-gray-600'} relative inline-flex items-center h-5 rounded-full w-9 transition-colors`}
                        >
                            <span className={`${strategy.status === 'active' ? 'translate-x-5' : 'translate-x-1'} inline-block w-3 h-3 transform bg-white rounded-full transition-transform`} />
                        </button>
                    </div>
                </div>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-gray-700/50">
                    <Metric label={t('roi')} value={`${strategy.roi}%`} />
                    <Metric label={t('win_rate')} value={`${strategy.winRate}%`} />
                    <Metric label={t('trades')} value={strategy.trades} />
                    <Metric label={t('sharpe_ratio')} value={strategy.sharpe} />
                </div>
            </div>
            <div className="w-full md:w-48 flex flex-col justify-between items-center gap-2">
                <div className="w-full h-16 bg-gray-800/50 rounded-md">
                     <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
                         <path d="M0,40 L10,30 L20,35 L30,25 L40,30 L50,20 L60,25 L70,15 L80,20 L90,10 L100,15 L100,40 Z" fill="url(#chart-gradient)" />
                         <polyline points="0,30 10,30 20,35 30,25 40,30 50,20 60,25 70,15 80,20 90,10 100,15" fill="none" stroke="#4f46e5" strokeWidth="1"/>
                         <defs>
                            <linearGradient id="chart-gradient" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.3"/>
                                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0"/>
                            </linearGradient>
                        </defs>
                     </svg>
                </div>
                <div className="flex w-full gap-2 text-xs">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit?.(strategy);
                        }}
                        className="flex-1 p-1 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                    >
                        {t('edit')}
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onBacktest?.(strategy);
                        }}
                        className="flex-1 p-1 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                    >
                        {t('backtest')}
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onCopy?.(strategy.id);
                        }}
                        className="flex-1 p-1 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                    >
                        {t('copy')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StrategyCard;
