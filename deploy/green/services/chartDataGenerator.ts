/**
 * Chart Data Generator - Generate demo chart data
 */

export interface ChartDataPoint {
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * Generate demo chart data (OHLCV candles)
 * @param length - Number of candles to generate
 * @param basePrice - Starting price
 * @param symbol - Trading symbol (for variation)
 * @returns Array of chart data points
 */
export function generateDemoChartData(
    length: number = 100,
    basePrice: number = 42000,
    symbol: string = 'BTC/USDT'
): ChartDataPoint[] {
    const now = Date.now();
    
    // Adjust base price based on symbol
    if (symbol.includes('ETH')) basePrice = 2500;
    else if (!symbol.includes('BTC')) basePrice = 100;
    
    return Array.from({ length }, (_, i) => {
        const timestamp = now - (length - i) * 3600000; // 1 hour intervals
        const random = () => (Math.random() - 0.5) * 0.02; // ±2% variation
        const open = basePrice * (1 + random());
        const close = open * (1 + random());
        const high = Math.max(open, close) * (1 + Math.abs(random()));
        const low = Math.min(open, close) * (1 - Math.abs(random()));
        const volume = Math.random() * 1000;
        
        return {
            timestamp: new Date(timestamp).toISOString(),
            open,
            high,
            low,
            close,
            volume,
        };
    });
}
