import React, { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface OrderBookEntry {
    price: number;
    amount: number;
    total: number;
}

interface OrderBookWidgetProps {
    pair: string;
    onPriceSelect?: (price: number) => void;
}

const OrderBookWidget: React.FC<OrderBookWidgetProps> = ({ pair, onPriceSelect }) => {
    const { t } = useLanguage();
    const [bids, setBids] = useState<OrderBookEntry[]>([]);
    const [asks, setAsks] = useState<OrderBookEntry[]>([]);
    const [spread, setSpread] = useState<number>(0);
    const [spreadPercent, setSpreadPercent] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrderBook = async () => {
            try {
                setIsLoading(true);
                const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
                const response = await fetch(`/api/manual-trades/orderbook/${encodeURIComponent(pair)}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.bids && data.asks) {
                        // Process bids (buy orders) - highest price first
                        const processedBids = data.bids
                            .slice(0, 15)
                            .map((bid: [number, number], index: number, arr: [number, number][]) => {
                                const price = bid[0];
                                const amount = bid[1];
                                const prevTotal = index > 0 ? arr.slice(0, index).reduce((sum, b) => sum + b[1], 0) : 0;
                                return {
                                    price,
                                    amount,
                                    total: prevTotal + amount,
                                };
                            })
                            .reverse(); // Show highest first

                        // Process asks (sell orders) - lowest price first
                        const processedAsks = data.asks
                            .slice(0, 15)
                            .map((ask: [number, number], index: number, arr: [number, number][]) => {
                                const price = ask[0];
                                const amount = ask[1];
                                const prevTotal = index > 0 ? arr.slice(0, index).reduce((sum, a) => sum + a[1], 0) : 0;
                                return {
                                    price,
                                    amount,
                                    total: prevTotal + amount,
                                };
                            });

                        setBids(processedBids);
                        setAsks(processedAsks);

                        // Calculate spread
                        if (processedAsks.length > 0 && processedBids.length > 0) {
                            const bestAsk = processedAsks[0].price;
                            const bestBid = processedBids[processedBids.length - 1].price;
                            const spreadValue = bestAsk - bestBid;
                            const spreadPercentValue = (spreadValue / bestBid) * 100;
                            setSpread(spreadValue);
                            setSpreadPercent(spreadPercentValue);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to fetch order book:', error);
                // Generate mock data for demonstration
                generateMockOrderBook();
            } finally {
                setIsLoading(false);
            }
        };

        void fetchOrderBook();
        const interval = setInterval(fetchOrderBook, 2000); // Update every 2 seconds
        return () => clearInterval(interval);
    }, [pair]);

    const generateMockOrderBook = () => {
        // Mock data for demonstration
        const basePrice = 50000;
        const mockBids: OrderBookEntry[] = [];
        const mockAsks: OrderBookEntry[] = [];

        for (let i = 0; i < 15; i++) {
            const bidPrice = basePrice - (i * 10) - Math.random() * 5;
            const askPrice = basePrice + (i * 10) + Math.random() * 5;
            const amount = Math.random() * 2 + 0.1;

            mockBids.push({
                price: bidPrice,
                amount,
                total: mockBids.reduce((sum, b) => sum + b.amount, 0) + amount,
            });

            mockAsks.push({
                price: askPrice,
                amount,
                total: mockAsks.reduce((sum, a) => sum + a.amount, 0) + amount,
            });
        }

        setBids(mockBids.reverse());
        setAsks(mockAsks);

        if (mockAsks.length > 0 && mockBids.length > 0) {
            const bestAsk = mockAsks[0].price;
            const bestBid = mockBids[mockBids.length - 1].price;
            const spreadValue = bestAsk - bestBid;
            setSpread(spreadValue);
            setSpreadPercent((spreadValue / bestBid) * 100);
        }
    };

    const maxTotal = useMemo(() => {
        const bidMax = bids.length > 0 ? Math.max(...bids.map(b => b.total)) : 0;
        const askMax = asks.length > 0 ? Math.max(...asks.map(a => a.total)) : 0;
        return Math.max(bidMax, askMax);
    }, [bids, asks]);

    const formatPrice = (price: number) => {
        return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatAmount = (amount: number) => {
        return amount.toFixed(4);
    };

    if (isLoading) {
        return (
            <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-4">{t('order_book') || 'Order Book'}</h3>
                <div className="space-y-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="h-6 bg-gray-800/50 rounded animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">{t('order_book') || 'Order Book'}</h3>
                <div className="text-xs text-gray-400">
                    {t('spread') || 'Spread'}: <span className="text-yellow-400">{formatPrice(spread)} ({spreadPercent.toFixed(3)}%)</span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs mb-2 pb-2 border-b border-gray-700/50">
                <div className="text-gray-400">{t('price') || 'Price'}</div>
                <div className="text-gray-400 text-right">{t('amount') || 'Amount'}</div>
                <div className="text-gray-400 text-right">{t('total') || 'Total'}</div>
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto">
                {/* Asks (Sell Orders) - Red */}
                {asks.map((ask, index) => {
                    const widthPercent = (ask.total / maxTotal) * 100;
                    return (
                        <div
                            key={`ask-${index}`}
                            className="grid grid-cols-3 gap-2 text-xs py-1 hover:bg-red-500/10 cursor-pointer transition-colors relative group"
                            onClick={() => onPriceSelect?.(ask.price)}
                        >
                            <div className="absolute left-0 top-0 bottom-0 bg-red-500/10" style={{ width: `${widthPercent}%` }} />
                            <div className="text-red-400 relative z-10">{formatPrice(ask.price)}</div>
                            <div className="text-gray-300 text-right relative z-10">{formatAmount(ask.amount)}</div>
                            <div className="text-gray-400 text-right relative z-10">{formatAmount(ask.total)}</div>
                        </div>
                    );
                })}

                {/* Spread Indicator */}
                {asks.length > 0 && bids.length > 0 && (
                    <div className="py-2 border-y border-gray-700/50 my-1">
                        <div className="text-center text-xs">
                            <span className="text-gray-400">{t('spread') || 'Spread'}: </span>
                            <span className="text-yellow-400 font-semibold">
                                {formatPrice(spread)} ({spreadPercent.toFixed(3)}%)
                            </span>
                        </div>
                    </div>
                )}

                {/* Bids (Buy Orders) - Green */}
                {bids.map((bid, index) => {
                    const widthPercent = (bid.total / maxTotal) * 100;
                    return (
                        <div
                            key={`bid-${index}`}
                            className="grid grid-cols-3 gap-2 text-xs py-1 hover:bg-green-500/10 cursor-pointer transition-colors relative group"
                            onClick={() => onPriceSelect?.(bid.price)}
                        >
                            <div className="absolute left-0 top-0 bottom-0 bg-green-500/10" style={{ width: `${widthPercent}%` }} />
                            <div className="text-green-400 relative z-10">{formatPrice(bid.price)}</div>
                            <div className="text-gray-300 text-right relative z-10">{formatAmount(bid.amount)}</div>
                            <div className="text-gray-400 text-right relative z-10">{formatAmount(bid.total)}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default OrderBookWidget;

