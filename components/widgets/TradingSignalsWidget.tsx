
import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { TradingSignal } from '../../types.ts';

const WidgetCard: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (
    <div className="bg-white dark:bg-[#1c1e2f] border border-slate-200 dark:border-gray-700/50 rounded-lg p-4 h-full flex flex-col">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-gray-300">{title}</h3>
            <svg className="h-5 w-5 text-slate-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
        </div>
        <div className="flex-grow mt-2">
            {children}
        </div>
    </div>
);

const Signal: React.FC<{signal: TradingSignal}> = ({signal}) => {
    const { t } = useLanguage();
    const isBuy = signal.type === 'BUY';
    const isStrong = signal.strength === 'Strong';

    return (
        <div className={`p-3 rounded-lg border-l-4 ${isBuy ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}`}>
            <div className="flex justify-between items-center">
                <span className={`font-bold ${isBuy ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>{signal.type} {signal.asset}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isStrong ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-300' : 'bg-slate-500/20 text-slate-600 dark:text-gray-300'}`}>
                    {isStrong ? t('strong_signal') : t('medium_signal')}
                </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{signal.indicators}</p>
        </div>
    );
}

const TradingSignalsWidget: React.FC = () => {
    const { t } = useLanguage();
    const signals: TradingSignal[] = [
        { id: '1', type: 'BUY', asset: 'BTC', strength: 'Strong', indicators: 'RSI: 32, MACD Crossover' },
        { id: '2', type: 'SELL', asset: 'ETH', strength: 'Medium', indicators: 'RSI: 58, Low Volume' }
    ];

    return (
        <WidgetCard title={t('trading_signals')}>
            <div className="space-y-3">
                {signals.map(s => <Signal key={s.id} signal={s} />)}
            </div>
        </WidgetCard>
    );
};

export default TradingSignalsWidget;