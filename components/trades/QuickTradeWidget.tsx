import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { ManualQuickTradeOrder, ManualTradingQuickTradeConfig } from '../../types.ts';

interface QuickTradeWidgetProps {
    data: ManualTradingQuickTradeConfig;
    onSubmit: (order: ManualQuickTradeOrder) => void | Promise<void>;
    disabled?: boolean;
}

const QuickTradeWidget: React.FC<QuickTradeWidgetProps> = ({ data, onSubmit, disabled }) => {
    const { t, language } = useLanguage();
    const [selectedPercent, setSelectedPercent] = useState<number>(data.defaultPreset);
    const [stopLoss, setStopLoss] = useState<string>(data.stopLossPercent.toString());
    const [takeProfit, setTakeProfit] = useState<string>(data.takeProfitPercent.toString());

    useEffect(() => {
        setSelectedPercent(data.defaultPreset);
        setStopLoss(data.stopLossPercent.toString());
        setTakeProfit(data.takeProfitPercent.toString());
    }, [data]);

    const currencyFormatter = useMemo(() => new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
    }), [language]);

    const handleSubmit = (side: 'buy' | 'sell') => {
        const stopLossValue = Number.isFinite(Number(stopLoss)) ? Number(stopLoss) : data.stopLossPercent;
        const takeProfitValue = Number.isFinite(Number(takeProfit)) ? Number(takeProfit) : data.takeProfitPercent;
        void onSubmit({
            side,
            amountPercent: selectedPercent,
            stopLossPercent: stopLossValue,
            takeProfitPercent: takeProfitValue,
            pair: data.pair, // Include pair in order
        });
    };

    const changeTone = data.changePercent >= 0 ? 'text-green-400' : 'text-red-400';

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <h3 className="font-semibold text-white mb-4">{t('quick_trade')}</h3>
            <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-800/40 rounded-md">
                    <div>
                        <p className="font-semibold text-white">{data.pair}</p>
                        <p className="text-xs text-gray-400">{t('available_balance')}: {currencyFormatter.format(data.availableBalance)}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-white">{currencyFormatter.format(data.price)}</p>
                        <p className={`text-xs ${changeTone}`}>
                            {data.changePercent >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => handleSubmit('buy')}
                        disabled={disabled}
                        className={`w-full py-2 font-semibold rounded-md transition-colors ${disabled ? 'bg-green-600/10 text-green-200/60 cursor-not-allowed' : 'bg-green-600/20 text-green-300 hover:bg-green-600/40'}`}
                    >
                        {t('quick_buy')}
                    </button>
                    <button
                        onClick={() => handleSubmit('sell')}
                        disabled={disabled}
                        className={`w-full py-2 font-semibold rounded-md transition-colors ${disabled ? 'bg-red-600/10 text-red-200/60 cursor-not-allowed' : 'bg-red-600/20 text-red-300 hover:bg-red-600/40'}`}
                    >
                        {t('quick_sell')}
                    </button>
                </div>

                <div className="flex justify-between text-xs gap-2">
                    {data.amountPresets.map(preset => (
                        <button
                            key={preset}
                            onClick={() => setSelectedPercent(preset)}
                            disabled={disabled}
                            className={`flex-1 py-1 rounded-md border transition-colors ${selectedPercent === preset ? 'border-purple-400/70 bg-purple-500/20 text-purple-200' : 'border-gray-700 bg-gray-700/40 text-gray-200 hover:bg-gray-700'}`}
                        >
                            {preset === 100 ? 'MAX' : `${preset}%`}
                        </button>
                    ))}
                </div>

                <div>
                    <label className="text-xs text-gray-400">{t('stop_loss')}</label>
                    <input
                        type="number"
                        inputMode="decimal"
                        value={stopLoss}
                        onChange={event => setStopLoss(event.target.value)}
                        disabled={disabled}
                        className="w-full text-sm mt-1 p-2 bg-gray-800/50 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder={`${data.stopLossPercent}%`}
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-400">{t('take_profit')}</label>
                    <input
                        type="number"
                        inputMode="decimal"
                        value={takeProfit}
                        onChange={event => setTakeProfit(event.target.value)}
                        disabled={disabled}
                        className="w-full text-sm mt-1 p-2 bg-gray-800/50 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder={`${data.takeProfitPercent}%`}
                    />
                </div>
            </div>
        </div>
    );
};

export default QuickTradeWidget;
