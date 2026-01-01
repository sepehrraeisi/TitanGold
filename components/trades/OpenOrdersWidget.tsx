import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface OpenOrder {
    id: string;
    pair: string;
    side: 'buy' | 'sell';
    type: string;
    amount: number;
    price?: number;
    stopPrice?: number;
    limitPrice?: number;
    status: string;
    createdAt: string;
}

interface OpenOrdersWidgetProps {
    pair?: string;
    onCancel?: (orderId: string) => void | Promise<void>;
}

const OpenOrdersWidget: React.FC<OpenOrdersWidgetProps> = ({ pair, onCancel }) => {
    const { t } = useLanguage();
    const [orders, setOrders] = useState<OpenOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [cancelling, setCancelling] = useState<string | null>(null);

    const loadOrders = useCallback(async () => {
        try {
            setIsLoading(true);
            const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
            let url = '/api/manual-trades/orders/open';
            if (pair) {
                url += `?pair=${encodeURIComponent(pair)}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                setOrders(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Failed to load open orders:', error);
            setOrders([]);
        } finally {
            setIsLoading(false);
        }
    }, [pair]);

    useEffect(() => {
        void loadOrders();
        const interval = setInterval(loadOrders, 3000); // Refresh every 3 seconds
        return () => clearInterval(interval);
    }, [loadOrders]);

    const handleCancel = async (orderId: string) => {
        try {
            setCancelling(orderId);
            const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
            const response = await fetch(`/api/manual-trades/orders/${orderId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                await loadOrders();
                if (onCancel) {
                    await onCancel(orderId);
                }
            }
        } catch (error) {
            console.error('Failed to cancel order:', error);
        } finally {
            setCancelling(null);
        }
    };

    const formatDate = (dateString: string | undefined | null) => {
        if (!dateString) {
            return '--';
        }
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return '--';
            }
            return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }).format(date);
        } catch (error) {
            console.error('Error formatting date:', error);
            return '--';
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    if (isLoading) {
        return (
            <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-4">{t('open_orders') || 'Open Orders'}</h3>
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-12 bg-gray-800/50 rounded animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">{t('open_orders') || 'Open Orders'}</h3>
                <button
                    onClick={() => void loadOrders()}
                    className="px-3 py-1 text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-md"
                >
                    {t('refresh') || 'Refresh'}
                </button>
            </div>

            {orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                    {t('no_open_orders') || 'No open orders'}
                </div>
            ) : (
                <div className="space-y-2">
                    {orders.map(order => (
                        <div
                            key={order.id}
                            className="p-3 bg-gray-800/40 rounded-md border border-gray-700/50 hover:border-gray-700 transition-colors"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`px-2 py-1 rounded text-xs ${
                                            order.side === 'buy'
                                                ? 'bg-green-500/20 text-green-300'
                                                : 'bg-red-500/20 text-red-300'
                                        }`}
                                    >
                                        {order.side.toUpperCase()}
                                    </span>
                                    <span className="text-sm font-semibold text-white">{order.pair}</span>
                                    <span className="text-xs text-gray-400">{order.type}</span>
                                </div>
                                <button
                                    onClick={() => void handleCancel(order.id)}
                                    disabled={cancelling === order.id}
                                    className="px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded border border-red-500/40 disabled:opacity-50"
                                >
                                    {cancelling === order.id ? t('cancelling') || 'Cancelling...' : t('cancel') || 'Cancel'}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-gray-400">{t('amount') || 'Amount'}: </span>
                                    <span className="text-gray-300">{order.amount.toFixed(4)}</span>
                                </div>
                                {order.price && (
                                    <div>
                                        <span className="text-gray-400">{t('price') || 'Price'}: </span>
                                        <span className="text-gray-300">{formatCurrency(order.price)}</span>
                                    </div>
                                )}
                                {order.stopPrice && (
                                    <div>
                                        <span className="text-gray-400">{t('stop_price') || 'Stop Price'}: </span>
                                        <span className="text-gray-300">{formatCurrency(order.stopPrice)}</span>
                                    </div>
                                )}
                                {order.limitPrice && (
                                    <div>
                                        <span className="text-gray-400">{t('limit_price') || 'Limit Price'}: </span>
                                        <span className="text-gray-300">{formatCurrency(order.limitPrice)}</span>
                                    </div>
                                )}
                            </div>
                            <div className="text-xs text-gray-500 mt-2">
                                {formatDate(order.createdAt)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OpenOrdersWidget;

