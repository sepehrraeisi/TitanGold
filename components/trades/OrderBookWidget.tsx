import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
    const { t, language } = useLanguage();
    const [bids, setBids] = useState<OrderBookEntry[]>([]);
    const [asks, setAsks] = useState<OrderBookEntry[]>([]);
    const [spread, setSpread] = useState<number>(0);
    const [spreadPercent, setSpreadPercent] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [hoveredIndex, setHoveredIndex] = useState<{ type: 'bid' | 'ask'; index: number } | null>(null);

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
                    console.log('📊 Order book data received:', { bidsCount: data.bids?.length, asksCount: data.asks?.length, demo: data.demo });
                    if (data.bids && data.asks && data.bids.length > 0 && data.asks.length > 0) {
                        // Process bids (buy orders) - highest price first
                        const processedBids = data.bids
                            .slice(0, 12)
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
                            .slice(0, 12)
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

        for (let i = 0; i < 12; i++) {
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

    const formatPrice = useCallback((price: number) => {
        return new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(price);
    }, [language]);

    const formatAmount = useCallback((amount: number) => {
        return new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
        }).format(amount);
    }, [language]);

    const handlePriceClick = useCallback((price: number) => {
        onPriceSelect?.(price);
    }, [onPriceSelect]);

    if (isLoading) {
        return (
            <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-4 h-[600px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <div className="h-5 w-24 bg-gray-700/50 rounded animate-pulse" />
                    <div className="h-4 w-32 bg-gray-700/50 rounded animate-pulse" />
                </div>
                <div className="space-y-2 flex-1">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="h-8 bg-gray-800/50 rounded animate-pulse" />
                    ))}
                    <div className="h-10 bg-gray-800/50 rounded animate-pulse my-2" />
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="h-8 bg-gray-800/50 rounded animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    const bestBid = bids.length > 0 ? bids[bids.length - 1] : null;
    const bestAsk = asks.length > 0 ? asks[0] : null;

    return (
        <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-4 sm:p-5 h-[600px] flex flex-col shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700/50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="font-bold text-white text-sm sm:text-base">{t('order_book') || 'Order Book'}</h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">{t('spread') || 'Spread'}:</span>
                    <span className="text-yellow-400 font-semibold">
                        {formatPrice(spread)}
                    </span>
                    <span className="text-gray-500">
                        ({spreadPercent.toFixed(3)}%)
                    </span>
                </div>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-3 gap-2 text-xs font-semibold mb-2 pb-2 border-b border-gray-700/30">
                <div className="text-gray-400">{t('price') || 'Price'}</div>
                <div className="text-gray-400 text-right">{t('amount') || 'Amount'}</div>
                <div className="text-gray-400 text-right">{t('total') || 'Total'}</div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {/* Asks (Sell Orders) - Red */}
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                    <div className="space-y-0.5">
                        {asks.map((ask, index) => {
                            const widthPercent = (ask.total / maxTotal) * 100;
                            const isHovered = hoveredIndex?.type === 'ask' && hoveredIndex?.index === index;
                            const isBestPrice = index === 0;
                            
                            return (
                                <div
                                    key={`ask-${index}`}
                                    className="grid grid-cols-3 gap-2 text-xs py-1.5 px-2 rounded-md cursor-pointer transition-all duration-200 relative group"
                                    style={{
                                        backgroundColor: isHovered ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                                    }}
                                    onMouseEnter={() => setHoveredIndex({ type: 'ask', index })}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                    onClick={() => handlePriceClick(ask.price)}
                                >
                                    {/* Depth Visualization */}
                                    <div 
                                        className="absolute right-0 top-0 bottom-0 bg-red-500/10 transition-all duration-300 rounded-md"
                                        style={{ 
                                            width: `${widthPercent}%`,
                                            opacity: isHovered ? 0.3 : 0.15,
                                        }} 
                                    />
                                    
                                    {/* Content */}
                                    <div className={`relative z-10 font-mono ${isBestPrice ? 'text-red-300 font-bold' : 'text-red-400'}`}>
                                        {formatPrice(ask.price)}
                                    </div>
                                    <div className="text-gray-300 text-right relative z-10 font-mono">
                                        {formatAmount(ask.amount)}
                                    </div>
                                    <div className="text-gray-400 text-right relative z-10 font-mono">
                                        {formatAmount(ask.total)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Spread Indicator - Enhanced */}
                {bestAsk && bestBid && (
                    <div className="py-3 my-2 border-y border-gray-700/50 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 rounded-lg">
                        <div className="text-center">
                            <div className="text-xs text-gray-400 mb-1">{t('spread') || 'Spread'}</div>
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-yellow-400 font-bold text-sm font-mono">
                                    {formatPrice(spread)}
                                </span>
                                <span className="text-gray-500 text-xs">
                                    ({spreadPercent.toFixed(3)}%)
                                </span>
                            </div>
                            <div className="flex items-center justify-center gap-4 mt-2 text-xs">
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-500">Best Ask:</span>
                                    <span className="text-red-400 font-mono font-semibold">{formatPrice(bestAsk.price)}</span>
                                </div>
                                <div className="w-px h-4 bg-gray-700" />
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-500">Best Bid:</span>
                                    <span className="text-green-400 font-mono font-semibold">{formatPrice(bestBid.price)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bids (Buy Orders) - Green */}
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                    <div className="space-y-0.5">
                        {bids.map((bid, index) => {
                            const widthPercent = (bid.total / maxTotal) * 100;
                            const isHovered = hoveredIndex?.type === 'bid' && hoveredIndex?.index === index;
                            const isBestPrice = index === bids.length - 1;
                            
                            return (
                                <div
                                    key={`bid-${index}`}
                                    className="grid grid-cols-3 gap-2 text-xs py-1.5 px-2 rounded-md cursor-pointer transition-all duration-200 relative group"
                                    style={{
                                        backgroundColor: isHovered ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                                    }}
                                    onMouseEnter={() => setHoveredIndex({ type: 'bid', index })}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                    onClick={() => handlePriceClick(bid.price)}
                                >
                                    {/* Depth Visualization */}
                                    <div 
                                        className="absolute left-0 top-0 bottom-0 bg-green-500/10 transition-all duration-300 rounded-md"
                                        style={{ 
                                            width: `${widthPercent}%`,
                                            opacity: isHovered ? 0.3 : 0.15,
                                        }} 
                                    />
                                    
                                    {/* Content */}
                                    <div className={`relative z-10 font-mono ${isBestPrice ? 'text-green-300 font-bold' : 'text-green-400'}`}>
                                        {formatPrice(bid.price)}
                                    </div>
                                    <div className="text-gray-300 text-right relative z-10 font-mono">
                                        {formatAmount(bid.amount)}
                                    </div>
                                    <div className="text-gray-400 text-right relative z-10 font-mono">
                                        {formatAmount(bid.total)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderBookWidget;
