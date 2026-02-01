import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

type OrderType = 'market' | 'limit' | 'stop-loss' | 'take-profit' | 'stop-limit';
type OrderSide = 'buy' | 'sell';

interface AdvancedOrderWidgetProps {
    pair: string;
    currentPrice: number;
    availableBalance: number;
    onSubmit: (order: {
        type: OrderType;
        side: OrderSide;
        price?: number;
        amount: number;
        stopPrice?: number;
        limitPrice?: number;
    }) => void | Promise<void>;
    disabled?: boolean;
}

const AdvancedOrderWidget: React.FC<AdvancedOrderWidgetProps> = ({
    pair,
    currentPrice,
    availableBalance,
    onSubmit,
    disabled = false,
}) => {
    const { t } = useLanguage();
    const [orderType, setOrderType] = useState<OrderType>('limit');
    const [side, setSide] = useState<OrderSide>('buy');
    const [price, setPrice] = useState<string>(currentPrice.toFixed(2));
    const [amount, setAmount] = useState<string>('');
    const [stopPrice, setStopPrice] = useState<string>('');
    const [limitPrice, setLimitPrice] = useState<string>('');
    const [amountPercent, setAmountPercent] = useState<number>(25);

    const amountPresets = [10, 25, 50, 75, 100];

    const calculatedAmount = useMemo(() => {
        if (amount) {
            return parseFloat(amount) || 0;
        }
        return (availableBalance * amountPercent) / 100;
    }, [amount, amountPercent, availableBalance]);

    const totalValue = useMemo(() => {
        const priceValue = parseFloat(price) || currentPrice;
        return calculatedAmount * priceValue;
    }, [calculatedAmount, price, currentPrice]);

    const handleSubmit = () => {
        const order: any = {
            type: orderType,
            side,
            amount: calculatedAmount,
        };

        if (orderType === 'limit' || orderType === 'stop-limit') {
            order.price = parseFloat(price) || currentPrice;
        }

        if (orderType === 'stop-loss' || orderType === 'stop-limit') {
            order.stopPrice = parseFloat(stopPrice) || currentPrice * 0.98;
        }

        if (orderType === 'stop-limit') {
            order.limitPrice = parseFloat(limitPrice) || currentPrice * 0.99;
        }

        void onSubmit(order);
    };

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">{t('advanced_orders') || 'Advanced Orders'}</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => setSide('buy')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            side === 'buy'
                                ? 'bg-green-600/30 text-green-300 border border-green-500/50'
                                : 'bg-gray-700/40 text-gray-300 border border-gray-700'
                        }`}
                    >
                        {t('buy') || 'Buy'}
                    </button>
                    <button
                        onClick={() => setSide('sell')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            side === 'sell'
                                ? 'bg-red-600/30 text-red-300 border border-red-500/50'
                                : 'bg-gray-700/40 text-gray-300 border border-gray-700'
                        }`}
                    >
                        {t('sell') || 'Sell'}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {/* Order Type Selection */}
                <div>
                    <label className="text-xs text-gray-400 mb-2 block">{t('order_type') || 'Order Type'}</label>
                    <div className="grid grid-cols-2 gap-2">
                        {(['market', 'limit', 'stop-loss', 'take-profit', 'stop-limit'] as OrderType[]).map(type => (
                            <button
                                key={type}
                                onClick={() => setOrderType(type)}
                                disabled={disabled}
                                className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                                    orderType === type
                                        ? 'border-purple-500/70 bg-purple-500/20 text-purple-200'
                                        : 'border-gray-700 bg-gray-700/40 text-gray-300 hover:bg-gray-700'
                                }`}
                            >
                                {t(`order_type_${type}`) || type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Price Input (for limit orders) */}
                {(orderType === 'limit' || orderType === 'stop-limit') && (
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">
                            {t('limit_price') || 'Limit Price'} ({pair.split('/')[1]})
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                inputMode="decimal"
                                value={price}
                                onChange={e => setPrice(e.target.value)}
                                disabled={disabled}
                                className="flex-1 text-sm p-2 bg-gray-800/50 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder={currentPrice.toFixed(2)}
                            />
                            <button
                                onClick={() => setPrice(currentPrice.toFixed(2))}
                                disabled={disabled}
                                className="px-3 py-2 text-xs bg-gray-700/50 hover:bg-gray-700 rounded-md text-gray-300"
                            >
                                {t('market') || 'Market'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Stop Price (for stop-loss and stop-limit) */}
                {(orderType === 'stop-loss' || orderType === 'stop-limit') && (
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">
                            {t('stop_price') || 'Stop Price'} ({pair.split('/')[1]})
                        </label>
                        <input
                            type="number"
                            inputMode="decimal"
                            value={stopPrice}
                            onChange={e => setStopPrice(e.target.value)}
                            disabled={disabled}
                            className="w-full text-sm p-2 bg-gray-800/50 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder={(currentPrice * 0.98).toFixed(2)}
                        />
                    </div>
                )}

                {/* Limit Price (for stop-limit) */}
                {orderType === 'stop-limit' && (
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">
                            {t('limit_price') || 'Limit Price'} ({pair.split('/')[1]})
                        </label>
                        <input
                            type="number"
                            inputMode="decimal"
                            value={limitPrice}
                            onChange={e => setLimitPrice(e.target.value)}
                            disabled={disabled}
                            className="w-full text-sm p-2 bg-gray-800/50 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder={(currentPrice * 0.99).toFixed(2)}
                        />
                    </div>
                )}

                {/* Amount Input */}
                <div>
                    <label className="text-xs text-gray-400 mb-1 block">
                        {t('amount') || 'Amount'} ({pair.split('/')[0]})
                    </label>
                    <input
                        type="number"
                        inputMode="decimal"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        disabled={disabled}
                        className="w-full text-sm p-2 bg-gray-800/50 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="0.00"
                    />
                    <div className="flex justify-between text-xs gap-2 mt-2">
                        {amountPresets.map(preset => (
                            <button
                                key={preset}
                                onClick={() => {
                                    setAmountPercent(preset);
                                    setAmount('');
                                }}
                                disabled={disabled}
                                className={`flex-1 py-1 rounded-md border transition-colors ${
                                    amountPercent === preset && !amount
                                        ? 'border-purple-400/70 bg-purple-500/20 text-purple-200'
                                        : 'border-gray-700 bg-gray-700/40 text-gray-200 hover:bg-gray-700'
                                }`}
                            >
                                {preset === 100 ? 'MAX' : `${preset}%`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Total Value Display */}
                <div className="p-3 bg-gray-800/40 rounded-md">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">{t('total_value') || 'Total Value'}:</span>
                        <span className="text-white font-semibold">
                            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                        <span className="text-gray-500">{t('available') || 'Available'}:</span>
                        <span className="text-gray-400">
                            ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={disabled || calculatedAmount <= 0 || totalValue > availableBalance}
                    className={`w-full py-3 font-semibold rounded-md transition-colors ${
                        disabled || calculatedAmount <= 0 || totalValue > availableBalance
                            ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                            : side === 'buy'
                            ? 'bg-green-600/20 text-green-300 hover:bg-green-600/40'
                            : 'bg-red-600/20 text-red-300 hover:bg-red-600/40'
                    }`}
                >
                    {side === 'buy' ? t('place_buy_order') || 'Place Buy Order' : t('place_sell_order') || 'Place Sell Order'}
                </button>
            </div>
        </div>
    );
};

export default AdvancedOrderWidget;

