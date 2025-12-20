import React, { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { Strategy } from '../../../types.ts';

interface StrategyBacktestWidgetProps {
    strategy: Strategy | null;
    onBacktest?: (config: {
        strategyId: string;
        startDate: string;
        endDate: string;
        initialCapital: number;
    }) => void | Promise<void>;
}

const StrategyBacktestWidget: React.FC<StrategyBacktestWidgetProps> = ({ strategy, onBacktest }) => {
    const { t } = useLanguage();
    const [startDate, setStartDate] = useState<string>(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [initialCapital, setInitialCapital] = useState<string>('10000');
    const [isRunning, setIsRunning] = useState(false);

    const handleBacktest = async () => {
        if (!strategy || !onBacktest) return;
        
        setIsRunning(true);
        try {
            await onBacktest({
                strategyId: strategy.id,
                startDate,
                endDate,
                initialCapital: parseFloat(initialCapital) || 10000,
            });
        } finally {
            setIsRunning(false);
        }
    };

    if (!strategy) {
        return (
            <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3">{t('strategy_backtest') || 'Strategy Backtest'}</h3>
                <p className="text-sm text-center text-gray-500 py-10">{t('select_strategy_prompt') || 'Select a strategy to backtest'}</p>
            </div>
        );
    }

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-4">{t('strategy_backtest') || 'Strategy Backtest'}</h3>
            <div className="space-y-4">
                <div>
                    <label className="text-xs text-gray-400 mb-1 block">{t('strategy') || 'Strategy'}</label>
                    <div className="p-2 bg-gray-800/50 rounded-md text-sm text-white">{strategy.name}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">{t('start_date') || 'Start Date'}</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            max={endDate}
                            className="w-full text-sm p-2 bg-gray-800/50 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">{t('end_date') || 'End Date'}</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            min={startDate}
                            max={new Date().toISOString().split('T')[0]}
                            className="w-full text-sm p-2 bg-gray-800/50 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs text-gray-400 mb-1 block">{t('initial_capital') || 'Initial Capital'}</label>
                    <input
                        type="number"
                        value={initialCapital}
                        onChange={e => setInitialCapital(e.target.value)}
                        min="100"
                        step="100"
                        className="w-full text-sm p-2 bg-gray-800/50 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="10000"
                    />
                </div>

                <button
                    onClick={handleBacktest}
                    disabled={isRunning || !startDate || !endDate}
                    className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded-md border border-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isRunning ? t('running') || 'Running...' : t('run_backtest') || 'Run Backtest'}
                </button>
            </div>
        </div>
    );
};

export default StrategyBacktestWidget;

