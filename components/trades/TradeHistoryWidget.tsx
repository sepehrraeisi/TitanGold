import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface Trade {
    id: string;
    pair: string;
    side: 'buy' | 'sell';
    price: number;
    amount: number;
    pnl?: number;
    pnlPercent?: number;
    executedAt: string;
    status: string;
}

interface TradeHistoryWidgetProps {
    pair?: string;
    limit?: number;
}

const TradeHistoryWidget: React.FC<TradeHistoryWidgetProps> = ({ pair, limit = 50 }) => {
    const { t, language } = useLanguage();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'cancelled'>('all');
    const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');

    useEffect(() => {
        const loadTrades = async () => {
            try {
                setIsLoading(true);
                const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
                let url = `/api/manual-trades/recent?limit=${limit}`;
                if (pair) {
                    url += `&pair=${encodeURIComponent(pair)}`;
                }

                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    setTrades(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                console.error('Failed to load trade history:', error);
                setTrades([]);
            } finally {
                setIsLoading(false);
            }
        };

        void loadTrades();
        const interval = setInterval(loadTrades, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, [pair, limit]);

    const filteredTrades = useMemo(() => {
        let filtered = trades;

        // Filter by side
        if (filter !== 'all') {
            filtered = filtered.filter(t => t.side === filter);
        }

        // Filter by status
        if (statusFilter !== 'all') {
            filtered = filtered.filter(t => t.status === statusFilter);
        }

        // Filter by date range
        if (dateRange !== 'all') {
            const now = new Date();
            const cutoff = new Date();
            if (dateRange === 'today') {
                cutoff.setHours(0, 0, 0, 0);
            } else if (dateRange === 'week') {
                cutoff.setDate(now.getDate() - 7);
            } else if (dateRange === 'month') {
                cutoff.setMonth(now.getMonth() - 1);
            }
            filtered = filtered.filter(t => new Date(t.executedAt) >= cutoff);
        }

        return filtered;
    }, [trades, filter, statusFilter, dateRange]);

    const exportTrades = () => {
        const csv = [
            ['Date', 'Pair', 'Side', 'Price', 'Amount', 'Total', 'PnL', 'PnL %', 'Status'].join(','),
            ...filteredTrades.map(t => [
                new Date(t.executedAt).toISOString(),
                t.pair,
                t.side,
                t.price.toFixed(2),
                t.amount.toFixed(8),
                (t.price * t.amount).toFixed(2),
                t.pnl?.toFixed(2) || '0',
                t.pnlPercent?.toFixed(2) || '0',
                t.status,
            ].join(',')),
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trades-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    if (isLoading) {
        return (
            <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-4">{t('trade_history') || 'Trade History'}</h3>
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 bg-gray-800/50 rounded animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">{t('trade_history') || 'Trade History'}</h3>
                <button
                    onClick={exportTrades}
                    className="px-3 py-1 text-xs bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded-md border border-purple-500/40"
                >
                    {t('export') || 'Export'}
                </button>
            </div>

            {/* Filters */}
            <div className="space-y-2 mb-4">
                <div className="flex gap-2 flex-wrap">
                    {(['all', 'buy', 'sell'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                                filter === f
                                    ? 'border-purple-500/70 bg-purple-500/20 text-purple-200'
                                    : 'border-gray-700 bg-gray-700/40 text-gray-300 hover:bg-gray-700'
                            }`}
                        >
                            {t(f === 'all' ? 'all' : f) || f}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                    {(['all', 'today', 'week', 'month'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setDateRange(r)}
                            className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                                dateRange === r
                                    ? 'border-blue-500/70 bg-blue-500/20 text-blue-200'
                                    : 'border-gray-700 bg-gray-700/40 text-gray-300 hover:bg-gray-700'
                            }`}
                        >
                            {t(r === 'all' ? 'all' : r) || r}
                        </button>
                    ))}
                </div>
            </div>

            {/* Trades Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-gray-700/50">
                            <th className="text-left py-2 text-gray-400">{t('date') || 'Date'}</th>
                            <th className="text-left py-2 text-gray-400">{t('pair') || 'Pair'}</th>
                            <th className="text-left py-2 text-gray-400">{t('side') || 'Side'}</th>
                            <th className="text-right py-2 text-gray-400">{t('price') || 'Price'}</th>
                            <th className="text-right py-2 text-gray-400">{t('amount') || 'Amount'}</th>
                            <th className="text-right py-2 text-gray-400">{t('pnl') || 'PnL'}</th>
                            <th className="text-right py-2 text-gray-400">{t('status') || 'Status'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTrades.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-8 text-gray-500">
                                    {t('no_trades_found') || 'No trades found'}
                                </td>
                            </tr>
                        ) : (
                            filteredTrades.map(trade => (
                                <tr
                                    key={trade.id}
                                    className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors"
                                >
                                    <td className="py-2 text-gray-300">{formatDate(trade.executedAt)}</td>
                                    <td className="py-2 text-gray-300">{trade.pair}</td>
                                    <td className="py-2">
                                        <span
                                            className={`px-2 py-1 rounded text-xs ${
                                                trade.side === 'buy'
                                                    ? 'bg-green-500/20 text-green-300'
                                                    : 'bg-red-500/20 text-red-300'
                                            }`}
                                        >
                                            {trade.side.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="py-2 text-right text-gray-300">{formatCurrency(trade.price)}</td>
                                    <td className="py-2 text-right text-gray-300">{trade.amount.toFixed(4)}</td>
                                    <td className="py-2 text-right">
                                        {trade.pnl !== undefined ? (
                                            <span
                                                className={
                                                    trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                                                }
                                            >
                                                {trade.pnl >= 0 ? '+' : ''}
                                                {formatCurrency(trade.pnl)}
                                                {trade.pnlPercent !== undefined && (
                                                    <span className="text-xs ml-1">
                                                        ({trade.pnlPercent >= 0 ? '+' : ''}
                                                        {trade.pnlPercent.toFixed(2)}%)
                                                    </span>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-gray-500">-</span>
                                        )}
                                    </td>
                                    <td className="py-2 text-right">
                                        <span
                                            className={`px-2 py-1 rounded text-xs ${
                                                trade.status === 'open'
                                                    ? 'bg-blue-500/20 text-blue-300'
                                                    : trade.status === 'closed'
                                                    ? 'bg-gray-500/20 text-gray-300'
                                                    : 'bg-red-500/20 text-red-300'
                                            }`}
                                        >
                                            {trade.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TradeHistoryWidget;

