import React, { useMemo } from 'react';

interface MiniChartProps {
    prices: number[];
    change24h: number;
    width?: number;
    height?: number;
}

const MiniChart: React.FC<MiniChartProps> = ({ prices, change24h, width = 80, height = 30 }) => {
    const chartData = useMemo(() => {
        if (!prices || prices.length === 0) {
            // Generate mock data if no prices provided
            const mockPrices = Array.from({ length: 20 }, (_, i) => {
                const basePrice = 100;
                const variation = Math.sin(i / 3) * 10;
                return basePrice + variation;
            });
            return mockPrices;
        }
        
        // If only one price, duplicate it to create a flat line
        if (prices.length === 1) {
            return [prices[0], prices[0]];
        }
        
        return prices.slice(-20); // Last 20 data points
    }, [prices]);

    const minPrice = Math.min(...chartData);
    const maxPrice = Math.max(...chartData);
    const priceRange = maxPrice - minPrice || 1;

    const points = chartData.map((price, index) => {
        const x = (index / Math.max(chartData.length - 1, 1)) * width;
        const normalized = (price - minPrice) / priceRange;
        const y = height - normalized * height;
        return `${x},${y}`;
    }).join(' ');

    const lineColor = change24h >= 0 ? '#10b981' : '#ef4444';
    const fillColor = change24h >= 0 ? '#10b981' : '#ef4444';

    // Only render polyline if we have at least 2 points
    if (chartData.length < 2) {
        return (
            <div className="flex items-center justify-center w-[80px] h-[30px]">
                <div className="text-xs text-gray-500">-</div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center">
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                <defs>
                    <linearGradient id={`chartGradient-${Math.abs(change24h).toFixed(2)}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={fillColor} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polyline
                    points={points}
                    fill={`url(#chartGradient-${Math.abs(change24h).toFixed(2)})`}
                    stroke={lineColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
};

export default MiniChart;

