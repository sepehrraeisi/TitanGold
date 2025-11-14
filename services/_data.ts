import type {
    User,
    FavoriteItem,
    FavoriteAlert,
    CryptoAsset,
    Strategy,
    PortfolioAsset,
    PortfolioOverviewStat,
    PortfolioPageData,
    PortfolioDistributionSlice,
    PortfolioRiskExposure,
    PortfolioCorrelationMatrix,
    PortfolioMonthlyReturn,
    PortfolioInsight,
    PortfolioPerformancePoint,
    PortfolioTimeRange,
    PortfolioActivity,
    RiskMetric,
    AnalysisStat,
    SmartPrediction,
    PerformanceTrade,
    NewsArticle,
    EconomicEvent,
    AIAgent,
    AIProvider,
    AIAnalyticsMetrics,
    WalletAsset,
    WalletTransaction,
    GoldAsset,
    GoldPrediction,
    GoldNewsArticle,
    DataSource,
    TelegramPublisherConfig,
    Workflow,
    AutopilotState,
    TradingDashboardData,
    TradingTimeRange,
    ChartPoint,
    ManualTradingPageData,
} from '../types.ts';

const users: User[] = [
    { id: '1', name: 'Sepehr', email: 'sepehr@titan.ai', role: 'Admin', password: 'password123' },
    { id: '2', name: 'Trader One', email: 'trader.one@titan.ai', role: 'Trader', password: 'password123' },
];

const autopilotState: AutopilotState = {
    isActive: true,
    operatingMode: 'balanced',
    tradingBudget: 50000,
    riskLevel: 'balanced',
    goal: {
        startCapital: 100,
        targetCapital: 500,
        progress: 72,
        etaMinutes: 204,
        lastSyncSeconds: 28,
        activeTrades: 12,
        maxConcurrentTrades: 20,
        successRate: 91,
        agentsOnline: 13,
        agentsTraining: 2,
        agentsTotal: 15,
        mode: 'auto',
        nextActionKey: 'autopilot_next_action_desc',
    },
    metrics: {
        totalPerformance: 7.0,
        winRate: 78.2,
        totalTrades: 156,
        todayProfit: 2847,
    },
    statusMessageKey: 'autopilot_status_running',
    lastUpdated: new Date().toISOString(),
};

const favorites: FavoriteItem[] = [
    { id: 'bitcoin', symbol: 'BTCUSDT', name: 'Bitcoin', price: 68543.21, change24h: 2.45, volume: '45.2B', hasAlert: true },
    { id: 'ethereum', symbol: 'ETHUSDT', name: 'Ethereum', price: 3498.76, change24h: -1.23, volume: '22.8B', hasAlert: false },
];

const favoriteAlerts: FavoriteAlert[] = [
    {
        id: 'alert-bitcoin-above-70k',
        favoriteId: 'bitcoin',
        condition: 'above',
        targetPrice: 70000,
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        isActive: true,
    }
];

const allAssets: CryptoAsset[] = [
    { id: 'solana', symbol: 'SOLUSDT', name: 'Solana' },
    { id: 'cardano', symbol: 'ADAUSDT', name: 'Cardano' },
    { id: 'avalanche', symbol: 'AVAXUSDT', name: 'Avalanche' },
    { id: 'chainlink', symbol: 'LINKUSDT', name: 'Chainlink' },
    { id: 'polkadot', symbol: 'DOTUSDT', name: 'Polkadot' },
    { id: 'shiba-inu', symbol: 'SHIBUSDT', name: 'Shiba Inu' },
    { id: 'dogecoin', symbol: 'DOGEUSDT', name: 'Dogecoin' },
];

const marketMovers = {
    gainers: [
        { id: 'shib', symbol: 'SHIB', name: 'Shiba Inu', change: 15.67 },
        { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', change: 12.45 },
        { id: 'link', symbol: 'LINK', name: 'Chainlink', change: 8.91 },
    ],
    losers: [
        { id: 'luna', symbol: 'LUNA', name: 'Terra Luna', change: -8.45 },
        { id: 'avax', symbol: 'AVAX', name: 'Avalanche', change: -6.23 },
    ],
    trending: [
        { id: 'btc', symbol: 'BTC', name: 'Bitcoin', change: 2.45 },
        { id: 'eth', symbol: 'ETH', name: 'Ethereum', change: -1.23 },
        { id: 'sol', symbol: 'SOL', name: 'Solana', change: 5.67 },
        { id: 'ada', symbol: 'ADA', name: 'Cardano', change: 2.34 },
    ]
};

const strategies: Strategy[] = [
    { id: '1', name: 'Al Prediction Pro', type: 'AI', agents: 3, status: 'active', roi: 45.2, winRate: 89.3, trades: 234, sharpe: 3.47, maxDrawdown: 3.2, chartData: [5, 10, 15, 25, 30, 40, 45], rank: 'A' },
    { id: '2', name: 'BTC Scalping Master', type: 'Scalping', agents: 1, status: 'active', roi: 38.7, winRate: 82.1, trades: 567, sharpe: 2.89, maxDrawdown: 4.7, chartData: [10, 12, 18, 22, 28, 35, 38], rank: 'B' },
    { id: '3', name: 'Trend Following ETH', type: 'Trend', agents: 2, status: 'active', roi: 31.4, winRate: 75.6, trades: 189, sharpe: 2.34, maxDrawdown: 6.1, chartData: [5, 8, 14, 20, 21, 25, 31], rank: 'T' },
    { id: '4', name: 'Swing Trading Altcoins', type: 'Swing', agents: 4, status: 'active', roi: 28.9, winRate: 71.2, trades: 145, sharpe: 2.12, maxDrawdown: 8.3, chartData: [8, 10, 15, 18, 20, 25, 29], rank: 'S' },
    { id: '5', name: 'Arbitrage Multi-Exchange', type: 'Arbitrage', agents: 5, status: 'active', roi: 22.1, winRate: 94.7, trades: 891, sharpe: 1.87, maxDrawdown: 1.8, chartData: [15, 16, 18, 20, 21, 22, 22], rank: 'A' },
    { id: '6', name: 'DCA Bitcoin Strategy', type: 'Trend', agents: 2, status: 'inactive', roi: 18.5, winRate: 68.3, trades: 78, sharpe: 1.65, maxDrawdown: 12.4, chartData: [5, 6, 8, 10, 12, 15, 18], rank: 'D' },
];

const portfolioStats: PortfolioOverviewStat[] = [
    {
        id: 'total_value',
        labelKey: 'total_portfolio_value',
        value: 269121.5,
        format: 'currency',
        decimals: 2,
        change: 2.85,
        changeFormat: 'percent',
        changeDecimals: 2,
        showChangeSign: true,
    },
    {
        id: 'net_profit',
        labelKey: 'net_profit',
        value: 82450,
        format: 'currency',
        decimals: 0,
        change: 12.4,
        changeFormat: 'percent',
        changeDecimals: 1,
        showChangeSign: true,
    },
    {
        id: 'success_rate',
        labelKey: 'success_rate',
        value: 77.3,
        format: 'percent',
        decimals: 1,
        change: 1.6,
        changeFormat: 'percent',
        changeDecimals: 1,
        showChangeSign: true,
        subLabelKey: 'from_trades',
        subLabelParams: { count: 428 },
    },
    {
        id: 'sharpe_ratio',
        labelKey: 'sharpe_ratio',
        value: 1.91,
        format: 'plain',
        decimals: 2,
        change: 0.12,
        changeFormat: 'plain',
        changeDecimals: 2,
        showChangeSign: true,
    },
];

const portfolioHoldings: PortfolioAsset[] = [
    {
        id: 'btc',
        name: 'Bitcoin',
        symbol: 'BTC',
        amount: 2.45,
        avgPrice: 26882.69,
        currentPrice: 48650,
        value: 119192.5,
        pnl: 53331.6,
        pnlPercent: 80.97,
        volatility: 14.2,
        allocation: 44.29,
        targetAllocation: 42,
        color: '#f7931a',
        lastRebalancedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'eth',
        name: 'Ethereum',
        symbol: 'ETH',
        amount: 18.2,
        avgPrice: 1895.42,
        currentPrice: 2675,
        value: 48685,
        pnl: 14159.6,
        pnlPercent: 41.03,
        volatility: 18.7,
        allocation: 18.09,
        targetAllocation: 19,
        color: '#627eea',
        lastRebalancedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'sol',
        name: 'Solana',
        symbol: 'SOL',
        amount: 320,
        avgPrice: 62.75,
        currentPrice: 96.4,
        value: 30848,
        pnl: 10768,
        pnlPercent: 53.6,
        volatility: 27.5,
        allocation: 11.46,
        targetAllocation: 10,
        color: '#14f195',
        lastRebalancedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'bnb',
        name: 'BNB',
        symbol: 'BNB',
        amount: 48,
        avgPrice: 412.35,
        currentPrice: 542,
        value: 26016,
        pnl: 6230.4,
        pnlPercent: 31.51,
        volatility: 19.8,
        allocation: 9.67,
        targetAllocation: 10,
        color: '#f0b90b',
        lastRebalancedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'usdt',
        name: 'Tether',
        symbol: 'USDT',
        amount: 22000,
        avgPrice: 1,
        currentPrice: 1,
        value: 22000,
        pnl: 0,
        pnlPercent: 0,
        volatility: 0.2,
        allocation: 8.17,
        targetAllocation: 8,
        color: '#26a17b',
        lastRebalancedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'link',
        name: 'Chainlink',
        symbol: 'LINK',
        amount: 950,
        avgPrice: 9.85,
        currentPrice: 14.4,
        value: 13680,
        pnl: 4315.5,
        pnlPercent: 46.02,
        volatility: 24.3,
        allocation: 5.08,
        targetAllocation: 6,
        color: '#2a5ada',
        lastRebalancedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'ada',
        name: 'Cardano',
        symbol: 'ADA',
        amount: 15000,
        avgPrice: 0.43,
        currentPrice: 0.58,
        value: 8700,
        pnl: 2250,
        pnlPercent: 34.09,
        volatility: 22.1,
        allocation: 3.23,
        targetAllocation: 5,
        color: '#0033ad',
        lastRebalancedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
];

const riskMetrics: RiskMetric[] = [
    { label: 'var_95', value: '$7,315.52' },
    { label: 'sortino_ratio', value: '2.26' },
    { label: 'portfolio_beta', value: '1.31' },
    { label: 'jensen_alpha', value: '0.49%' },
    { label: 'info_ratio', value: '1.26' },
];

const generatePortfolioPerformance = (
    points: number,
    base: number,
    amplitude: number,
    hoursStep: number,
): PortfolioPerformancePoint[] =>
    Array.from({ length: points }).map((_, index) => {
        const phase = index / Math.max(points - 1, 1);
        const seasonal = Math.sin(phase * Math.PI * 2) * amplitude;
        const drift = phase * amplitude * 0.45;
        const noise = (Math.random() - 0.5) * amplitude * 0.2;
        const value = base + seasonal + drift + noise;
        const benchmarkBase = base * 0.96;
        const benchmark = benchmarkBase + seasonal * 0.65 + drift * 0.55;
        return {
            timestamp: new Date(Date.now() - (points - 1 - index) * hoursStep * 60 * 60 * 1000).toISOString(),
            value: Number(value.toFixed(2)),
            benchmark: Number(benchmark.toFixed(2)),
        };
    });

const portfolioPerformance: Record<PortfolioTimeRange, PortfolioPerformancePoint[]> = {
    '1W': generatePortfolioPerformance(14, 255000, 4200, 12),
    '1M': generatePortfolioPerformance(30, 248000, 6200, 24),
    '3M': generatePortfolioPerformance(36, 235000, 7800, 48),
    '6M': generatePortfolioPerformance(30, 226000, 9500, 96),
    '1Y': generatePortfolioPerformance(26, 208000, 11200, 168),
};

const portfolioDistribution: PortfolioDistributionSlice[] = portfolioHoldings.map(asset => ({
    id: asset.id,
    asset: asset.symbol,
    percentage: Number((asset.allocation ?? 0).toFixed(2)),
    value: Number(asset.value.toFixed(2)),
    color: asset.color ?? '#818cf8',
}));

const portfolioExposures: PortfolioRiskExposure[] = [
    { id: 'exp-var', metricKey: 'var', score: 72 },
    { id: 'exp-drawdown', metricKey: 'drawdown', score: 64 },
    { id: 'exp-volatility', metricKey: 'volatility', score: 58 },
    { id: 'exp-sharpe', metricKey: 'sharpe', score: 82 },
    { id: 'exp-diversity', metricKey: 'diversity', score: 76 },
    { id: 'exp-liquidity', metricKey: 'liquidity', score: 88 },
];

const portfolioCorrelation: PortfolioCorrelationMatrix = {
    assets: ['BTC', 'ETH', 'SOL', 'BNB', 'LINK', 'ADA'],
    values: [
        [1.0, 0.79, 0.63, 0.58, 0.52, 0.49],
        [0.79, 1.0, 0.68, 0.61, 0.57, 0.54],
        [0.63, 0.68, 1.0, 0.55, 0.48, 0.46],
        [0.58, 0.61, 0.55, 1.0, 0.51, 0.44],
        [0.52, 0.57, 0.48, 0.51, 1.0, 0.42],
        [0.49, 0.54, 0.46, 0.44, 0.42, 1.0],
    ],
};

const portfolioMonthlyReturns: PortfolioMonthlyReturn[] = [
    { id: '2023-10', month: '2023-10-01', value: 2.18, benchmark: 1.62 },
    { id: '2023-11', month: '2023-11-01', value: 3.94, benchmark: 2.75 },
    { id: '2023-12', month: '2023-12-01', value: 5.62, benchmark: 3.88 },
    { id: '2024-01', month: '2024-01-01', value: -1.84, benchmark: -2.45 },
    { id: '2024-02', month: '2024-02-01', value: 4.37, benchmark: 2.91 },
    { id: '2024-03', month: '2024-03-01', value: 6.12, benchmark: 3.45 },
    { id: '2024-04', month: '2024-04-01', value: 3.48, benchmark: 1.82 },
    { id: '2024-05', month: '2024-05-01', value: -2.57, benchmark: -3.14 },
    { id: '2024-06', month: '2024-06-01', value: 5.21, benchmark: 2.64 },
    { id: '2024-07', month: '2024-07-01', value: 4.88, benchmark: 2.12 },
    { id: '2024-08', month: '2024-08-01', value: -1.96, benchmark: -2.75 },
    { id: '2024-09', month: '2024-09-01', value: 3.77, benchmark: 1.95 },
];

const portfolioInsights: PortfolioInsight[] = [
    {
        id: 'insight-outperform',
        titleKey: 'outperform_market',
        descriptionKey: 'outperform_market_desc',
        tone: 'positive',
        confidence: 92,
        acknowledged: false,
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'insight-concentration',
        titleKey: 'high_btc_concentration',
        descriptionKey: 'high_btc_concentration_desc',
        tone: 'warning',
        confidence: 74,
        acknowledged: false,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'insight-rebalance',
        titleKey: 'rebalance_opportunity',
        descriptionKey: 'rebalance_opportunity_desc',
        tone: 'neutral',
        confidence: 68,
        acknowledged: true,
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'insight-risk',
        titleKey: 'excellent_risk_management',
        descriptionKey: 'excellent_risk_management_desc',
        tone: 'positive',
        confidence: 81,
        acknowledged: false,
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    },
];

const portfolioActivities: PortfolioActivity[] = [
    {
        id: 'activity-1',
        timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        messageKey: 'portfolio_activity_rebalanced',
        metadata: { strategy: 'equal_weight' },
    },
    {
        id: 'activity-2',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        messageKey: 'portfolio_activity_allocation_updated',
        metadata: { asset: 'BTC', target: 42 },
    },
    {
        id: 'activity-3',
        timestamp: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
        messageKey: 'portfolio_activity_new_signal',
        metadata: { asset: 'SOL', confidence: 84 },
    },
];

const portfolio: PortfolioPageData = {
    stats: portfolioStats,
    holdings: portfolioHoldings,
    riskMetrics,
    performance: portfolioPerformance,
    distribution: portfolioDistribution,
    exposures: portfolioExposures,
    correlation: portfolioCorrelation,
    monthlyReturns: portfolioMonthlyReturns,
    insights: portfolioInsights,
    activities: portfolioActivities,
    lastUpdated: new Date().toISOString(),
};

const analysisStats: AnalysisStat[] = [
    { label: 'success_rate', value: '85%', subValue: 'excellent_performance', change: 3.2 },
    { label: 'sharpe_ratio', value: '2.34', subValue: 'excellent_performance' },
    { label: 'max_drawdown', value: '5.2%', subValue: 'good_risk_control', change: -1.1 },
    { label: 'total_capital', value: '$125,000', subValue: 'total_growth', change: 25.3 },
];

const smartPredictions: SmartPrediction[] = [
    { id: '1', symbol: 'BTC/USDT', trend: 'Bullish', targetPrice: '$48,000', timeframe: '7 Days', confidence: 87, analysis: 'btc_prediction_analysis' },
    { id: '2', symbol: 'ETH/USDT', trend: 'Neutral', targetPrice: '$2,900', timeframe: '3 Days', confidence: 65, analysis: 'eth_prediction_analysis' },
    { id: '3', symbol: 'SOL/USDT', trend: 'Bullish', targetPrice: '$120', timeframe: '5 Days', confidence: 92, analysis: 'sol_prediction_analysis' },
];

const tradingChartSeeds: Record<TradingTimeRange, ChartPoint[]> = {
    '1H': Array.from({ length: 12 }).map((_, i) => ({ timestamp: `${(i * 5).toString().padStart(2, '0')}`, value: 32000 + Math.sin(i / 2) * 420 })),
    '24H': Array.from({ length: 24 }).map((_, i) => ({ timestamp: `${i.toString().padStart(2, '0')}`, value: 32500 + Math.cos(i / 3) * 650 })),
    '7D': Array.from({ length: 7 }).map((_, i) => ({ timestamp: `D${i + 1}`, value: 33100 + Math.sin(i / 1.5) * 1200 })),
    '1M': Array.from({ length: 30 }).map((_, i) => ({ timestamp: `${i + 1}`, value: 31500 + Math.sin(i / 3) * 1800 })),
    '1Y': Array.from({ length: 12 }).map((_, i) => ({ timestamp: `M${i + 1}`, value: 28000 + Math.sin(i / 1.5) * 2500 })),
};

const tradingDashboard: TradingDashboardData = {
    kpis: [
        { id: 'total_value', labelKey: 'trading_kpi_total_asset_value', value: '$271,406', change: '+3.1%', positive: true },
        { id: 'pnl_24h', labelKey: 'trading_kpi_24h_pnl', value: '+$5,482', change: '+2.9%', positive: true },
        { id: 'volume', labelKey: 'trading_kpi_volume', value: '$1,240,000', change: '+11%', positive: true },
        { id: 'available_balance', labelKey: 'trading_kpi_available_balance', value: '$86,500', change: '-4.5%', positive: false },
    ],
    trades: [
        { id: '1', pair: 'BTC/USDT', side: 'buy', price: 48650, amount: 0.8, time: '2024-01-12T08:32:00Z' },
        { id: '2', pair: 'ETH/USDT', side: 'sell', price: 2680, amount: 12, time: '2024-01-12T07:58:00Z' },
        { id: '3', pair: 'SOL/USDT', side: 'buy', price: 98.4, amount: 180, time: '2024-01-12T07:10:00Z' },
        { id: '4', pair: 'XAU/USDT', side: 'buy', price: 2055, amount: 4, time: '2024-01-12T06:45:00Z' },
    ],
    assets: [
        { id: 'btc', name: 'Bitcoin', symbol: 'BTC', amount: 4.25, currentValue: 207000, change24h: 2.4 },
        { id: 'eth', name: 'Ethereum', symbol: 'ETH', amount: 62, currentValue: 165000, change24h: -1.2 },
        { id: 'sol', name: 'Solana', symbol: 'SOL', amount: 820, currentValue: 98400, change24h: 6.8 },
        { id: 'xau', name: 'Gold Token', symbol: 'XAU', amount: 15, currentValue: 30280, change24h: 0.5 },
    ],
    chart: tradingChartSeeds,
    lastUpdated: new Date().toISOString(),
};

const manualTrading: ManualTradingPageData = {
    stats: [
        { id: 'win_rate', labelKey: 'win_rate', value: 78.4, format: 'percent', decimals: 1 },
        { id: 'today_profit', labelKey: 'today_profit', value: 245.67, format: 'currency', decimals: 2, showSign: true },
        { id: 'total_profit', labelKey: 'total_profit', value: 12450, format: 'currency', decimals: 2 },
        { id: 'sharpe_ratio', labelKey: 'sharpe_ratio', value: 2.47, format: 'plain', decimals: 2, subLabelKey: 'adjusted_performance' },
        { id: 'best_trade', labelKey: 'best_trade', value: 12.3, format: 'percent', decimals: 1, showSign: true },
        { id: 'trades_volume', labelKey: 'trades_volume', value: 45200, format: 'currency', decimals: 0, subLabelKey: 'past_24_hours' },
        { id: 'active_trades', labelKey: 'active_trades', value: 8, format: 'plain', subLabelKey: 'in_progress' },
    ],
    chart: Array.from({ length: 24 }).map((_, index) => {
        const base = 43000 + Math.sin(index / 3) * 520;
        const open = base - 80 + Math.sin(index) * 40;
        const close = base + Math.cos(index / 2) * 55;
        const high = Math.max(open, close) + 70 + Math.random() * 35;
        const low = Math.min(open, close) - 70 - Math.random() * 35;
        const timestamp = new Date(Date.now() - (23 - index) * 60 * 60 * 1000).toISOString();
        return {
            timestamp,
            open: Number(open.toFixed(2)),
            high: Number(high.toFixed(2)),
            low: Number(low.toFixed(2)),
            close: Number(close.toFixed(2)),
            volume: Number((Math.random() * 900 + 450).toFixed(0)),
        };
    }),
    quickTrade: {
        pair: 'BTC/USDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        price: 43250,
        changePercent: 2.45,
        availableBalance: 12500,
        amountPresets: [25, 50, 75, 100],
        defaultPreset: 50,
        stopLossPercent: 2.5,
        takeProfitPercent: 5,
        baseAssetPrecision: 4,
    },
    recommendations: [
        { id: 'rec-btc', titleKey: 'smart_recommendation', descriptionKey: 'buy_recommendation', type: 'buy', confidence: 84 },
        { id: 'rec-eth', titleKey: 'ai_signal', descriptionKey: 'ai_signal_description', type: 'hold', confidence: 68 },
    ],
    sentiment: { score: 72, labelKey: 'greed_state' },
    strategies: [
        { id: 'btc_scalping', nameKey: 'btc_scalping', isActive: true, performance: 12.3 },
        { id: 'eth_dca', nameKey: 'eth_dca', isActive: false, performance: 6.8 },
    ],
    portfolio: [
        { id: 'btc', asset: 'BTC', percentage: 45.2, color: '#f7931a', value: 125600 },
        { id: 'eth', asset: 'ETH', percentage: 32.1, color: '#627eea', value: 89200 },
        { id: 'usdt', asset: 'USDT', percentage: 22.7, color: '#26a17b', value: 63000 },
    ],
    performance: Array.from({ length: 16 }).map((_, index) => ({
        timestamp: new Date(Date.now() - (15 - index) * 60 * 60 * 1000).toISOString(),
        value: 100 + Math.sin(index / 2) * 8 + index * 0.8,
    })),
    recentTrades: [
        { id: 'manual-1', side: 'buy', asset: 'BTC', pair: 'BTC/USDT', price: 42850, amount: 0.35, pnl: 185, pnlPercent: 1.2, executedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
        { id: 'manual-2', side: 'sell', asset: 'ETH', pair: 'ETH/USDT', price: 2675, amount: 11.5, pnl: -220, pnlPercent: -0.9, executedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
        { id: 'manual-3', side: 'buy', asset: 'AI Signal', pair: 'SOL/USDT', price: 96.4, amount: 120, pnl: 0, pnlPercent: 0, confidence: 85, executedAt: new Date(Date.now() - 32 * 60 * 1000).toISOString() },
    ],
    lastUpdated: new Date().toISOString(),
};

const performanceTrades: PerformanceTrade[] = [
    { id: '1', date: '2023-10-30', symbol: 'BTC/USDT', type: 'BUY', amount: 0.5, entryPrice: 42000, exitPrice: 45000, pnl: 1500, pnlPercent: 7.14 },
    { id: '2', date: '2023-10-29', symbol: 'ETH/USDT', type: 'SELL', amount: 2, entryPrice: 2800, exitPrice: 2650, pnl: 300, pnlPercent: 5.36 },
];

const newsArticles: NewsArticle[] = [
    { id: '1', source: 'CoinDesk', timestamp: '10m ago', headline: 'Bitcoin Pushes Past $47,000 as Key Resistance Breaks', snippet: 'The price of Bitcoin has surged past a critical resistance level, reaching over $47,000.', category: 'Crypto', verificationStatus: 'Verified', impactScore: 85, sentiment: 'Bullish', aiAnalysis: { summary: 'Strong bullish signal.', verificationDetails: 'Confirmed by multiple on-chain sources.', impactAnalysis: 'High potential for short-term rally.', keyTakeaways: ['Breakout confirmed.', 'Volume increasing.'] }, link: '#' },
    { id: '2', source: 'Ethereum Foundation', timestamp: '1h ago', headline: 'Ethereum Releases New "London" Fork Update', snippet: 'The London hard fork aims to reduce transaction fees and has been successfully implemented.', category: 'Crypto', verificationStatus: 'Verified', impactScore: 70, sentiment: 'Bullish', aiAnalysis: { summary: 'Positive long-term development.', verificationDetails: 'Official announcement.', impactAnalysis: 'May lead to deflationary pressure on ETH.', keyTakeaways: ['EIP-1559 is live.', 'Fee market changes.'] }, link: '#' },
    { id: '3', source: 'Reuters', timestamp: '2h ago', headline: 'US Federal Reserve Holds Interest Rates Steady', snippet: 'The Fed has decided to maintain the current interest rate, citing stable but watched inflation.', category: 'Economy', verificationStatus: 'Verified', impactScore: 90, sentiment: 'Neutral', aiAnalysis: { summary: 'Market expected this.', verificationDetails: 'Official press conference.', impactAnalysis: 'Reduces short-term market uncertainty.', keyTakeaways: ['No rate hike.', 'Inflation monitoring continues.'] }, link: '#' },
];

const economicEvents: EconomicEvent[] = [
    { id: '1', time: '09:00', country: 'US', event: 'CPI Data', importance: 'high', previous: '3.2%', forecast: '3.1%', actual: '3.0%' },
    { id: '2', time: '14:30', country: 'EU', event: 'ECB Interest Rate', importance: 'high', previous: '4.5%', forecast: '4.5%', actual: '4.5%' },
    { id: '3', time: '16:00', country: 'UK', event: 'GDP Growth', importance: 'medium', previous: '0.2%', forecast: '0.3%', actual: '0.2%' },
];

const connectionSettings = { apiKey: '', apiSecret: '', isConnected: false };
const notificationSettings = { botToken: '', channelId: '' };

const aiAgents: AIAgent[] = Array.from({ length: 15 }, (_, i) => ({
    id: `${i + 1}`,
    name: `Agent ${i + 1}`,
    role: ['Technical Analysis', 'Risk Management', 'Sentiment Analysis', 'Pattern Recognition', 'Price Prediction', 'Arbitrage', 'Liquidity Analysis', 'Portfolio Management', 'Trend Detection', 'Optimization', 'Order Management', 'Fundamental Analysis', 'Market Making', 'Volume Analysis', 'Timing'][i],
    status: i < 12 ? 'active' : i < 14 ? 'training' : 'inactive',
    accuracy: 85 + Math.random() * 15,
    trainingProgress: Math.random() * 100,
    decisions: Math.floor(Math.random() * 50000),
    learningTime: Math.floor(Math.random() * 4000),
    knowledgeSize: Math.random() * 4000,
    level: 'Expert',
    capabilities: ['Capability A', 'Capability B', 'Capability C'],
    lastUpdate: `2023-11-26, ${Math.floor(Math.random()*24)}:${Math.floor(Math.random()*60)}`,
}));

const aiProviders: AIProvider[] = [
    { id: 'google', name: 'Google Gemini', performance: 92, usage: 832 },
    { id: 'anthropic', name: 'Anthropic Claude', performance: 91, usage: 1247 },
    { id: 'openai', name: 'OpenAI GPT', performance: 94, usage: 0 },
];

const aiSystemSummary = {
    totalAgents: 15,
    activeAgents: 15,
    inTraining: 2,
    avgAccuracy: 90.6,
};

const aiAnalytics: AIAnalyticsMetrics = {
    realtime: { decisionRate: 1.2, successRate: 89.3, systemUptime: 99.8, agentDistribution: { active: 15, training: 0, offline: 0 } },
    performance: { totalDecisions: 354574, totalLearningHours: 26755, avgAccuracy: 89.3, monthlyImprovement: 2.3 },
    resourceUsage: { cpu: 67, gpu: 91.8, memory: 52, precision: [0.9, 0.92, 0.91, 0.93, 0.94, 0.93, 0.942], recall: [0.88, 0.89, 0.88, 0.9, 0.91, 0.9, 0.918] },
    agentMatrix: aiAgents.slice(0, 12).map(a => ({ id: a.id, name: a.role.substring(0, 15) + '...', accuracy: parseFloat(a.accuracy.toFixed(1)), successRate: parseFloat((a.accuracy - Math.random() * 5).toFixed(1)), progress: parseFloat(a.trainingProgress.toFixed(1)), status: a.status as any })),
};

const walletData = {
    stats: {
        totalAssets: 23015,
        activeWallets: 3,
        profit24h: 12.5,
        coldStorage: 1
    },
    assets: [
        { id: 'usdt', name: 'Tether', symbol: 'USDT', value: 14982, percentage: 65 },
        { id: 'btc', name: 'Bitcoin', symbol: 'BTC', value: 2.45, percentage: 25 },
        { id: 'eth', name: 'Ethereum', symbol: 'ETH', value: 3.2, percentage: 8 },
        { id: 'bnb', name: 'BNB', symbol: 'BNB', value: 15.8, percentage: 2 },
    ] as WalletAsset[],
    transactions: [
        {id: '1', type: 'Deposit', amount: '1.2 BTC', exchange: 'MEXC', time: '2h ago', status: 'Completed'},
        {id: '2', type: 'Withdrawal', amount: '1500 USDT', exchange: 'Cold Wallet', time: '8h ago', status: 'Completed'},
        {id: '3', type: 'Trade', amount: 'BUY 0.5 ETH', exchange: 'MEXC', time: '1d ago', status: 'Completed'},
    ] as WalletTransaction[],
};

const goldAssets: GoldAsset[] = [
    { id: 'emami', name: 'سکه امامی', buyPrice: 41500000, sellPrice: 41400000, change: 0.5 },
    { id: 'azadi', name: 'سکه بهار آزادی', buyPrice: 38000000, sellPrice: 37900000, change: 0.2 },
    { id: 'gram', name: 'گرم طلای ۱۸ عیار', buyPrice: 3850000, sellPrice: 3840000, change: -0.1 },
];

const goldPrediction: GoldPrediction = {
    id: '1',
    title: 'پیش‌بینی کوتاه‌مدت و بلندمدت بازار طلا',
    shortTerm: 'روند خنثی با نوسان محدود در کانال ۴۱ تا ۴۲ میلیون تومان برای سکه امامی.',
    longTerm: 'وابسته به نرخ دلار و اونس جهانی، پتانسیل رشد تا کانال ۴۵ میلیون تومان در سه ماه آینده وجود دارد.',
    confidence: 78,
    scenarios: {
        bullish: 'در صورت افزایش تنش‌های منطقه‌ای، احتمال شکست مقاومت ۴۳ میلیون تومان وجود دارد.',
        bearish: 'در صورت کاهش نرخ دلار نیمایی، حمایت ۴۰ میلیون تومانی در دسترس خواهد بود.'
    },
    fullAnalysis: 'تحلیل کامل مبتنی بر داده‌های فاندامنتال و تکنیکال...'
};

const goldNews: GoldNewsArticle[] = [
    { id: '1', headline: 'نرخ بهره بانک مرکزی بدون تغییر باقی ماند', source: 'دنیای اقتصاد', verificationStatus: 'Verified', impactScore: 70, aiAnalysis: 'این خبر اثر خنثی در کوتاه‌مدت دارد اما ثبات را به بازار می‌دهد.' },
    { id: '2', headline: 'آمار جدید از ذخایر طلای بانک‌های مرکزی جهان منتشر شد', source: 'تجارت نیوز', verificationStatus: 'Verified', impactScore: 55, aiAnalysis: 'افزایش ذخایر توسط چین می‌تواند سیگنال مثبتی برای اونس جهانی باشد.' },
    { id: '3', headline: 'شایعه عرضه سکه در مرکز مبادلات ارزی', source: 'شبکه‌های اجتماعی', verificationStatus: 'Unverified', impactScore: 85, aiAnalysis: 'این خبر تایید نشده است اما در صورت صحت، می‌تواند باعث کاهش قیمت کوتاه‌مدت شود.' },
];

const automationSettings = {
    dataSources: [
        { id: '1', type: 'Telegram Channel', value: '@CryptoNews', status: 'connected' },
        { id: '2', type: 'News Website', value: 'https://cointelegraph.com', status: 'connected' },
        { id: '3', type: 'Custom API', value: 'https://api.someprovider.com/data', status: 'error' },
    ] as DataSource[],
    telegramConfigs: [
        {
            id: '1',
            channelName: 'Public Gold Analysis',
            botToken: '123:ABC',
            channelId: '@gold_analysis',
            schedule: 'instantly',
            requiresApproval: false,
            autoPostTriggers: {
                gold_predictions: true,
                crypto_signals: false,
                verified_news: true,
                market_analysis: false,
            },
            contentFilters: {
                crypto_signal_strength: 'any',
                news_impact_score: 50,
            },
            messageTemplates: {
                gold_prediction: '🚨 **GOLD PREDICTION** 🚨\n\n{content}',
                crypto_signal: '',
                news_article: '📰 **VERIFIED NEWS** 📰\n\n{content}',
            }
        },
        {
            id: '2',
            channelName: 'VIP Crypto Signals',
            botToken: '456:DEF',
            channelId: '@vip_signals',
            schedule: 'daily_9am',
            requiresApproval: true,
            autoPostTriggers: {
                gold_predictions: false,
                crypto_signals: true,
                verified_news: false,
                market_analysis: true,
            },
            contentFilters: {
                crypto_signal_strength: 'strong',
                news_impact_score: 75,
            },
            messageTemplates: {
                gold_prediction: '',
                crypto_signal: '⚡️ **{asset} Signal** ⚡️\n\n**Type:** {type}\n**Confidence:** {confidence}%',
                news_article: '',
            }
        }
    ] as TelegramPublisherConfig[],
    workflows: [
        {
            id: '1',
            name: 'High-Impact BTC News Scalp',
            enabled: true,
            trigger: { type: 'new_news_article', source: 'All Verified' },
            conditions: [
                { field: 'impactScore', operator: 'greater_than', value: 80 },
                { field: 'sentiment', operator: 'equals', value: 'Bullish' },
                { field: 'content', operator: 'contains', value: 'BTC' },
            ],
            actions: [
                { type: 'execute_trade', target: 'BTC', parameters: { side: 'BUY', amount: 0.1, type: 'market' } },
                { type: 'send_telegram_post', target: '@vip_signals', parameters: { content: 'Executing automated trade based on high-impact BTC news.' } },
            ]
        },
         {
            id: '2',
            name: 'Gold Price Spike Alert',
            enabled: false,
            trigger: { type: 'market_event', source: 'Gold Price' },
            conditions: [
                { field: 'price_change_5m', operator: 'greater_than', value: 0.5 },
            ],
            actions: [
                { type: 'send_telegram_post', target: '@gold_analysis', parameters: { content: '🚨 **Gold Price Alert:** Price has increased by more than 0.5% in the last 5 minutes!' } },
            ]
        }
    ] as Workflow[],
};


export const _data = {
    users,
    autopilotState,
    favorites,
    favoriteAlerts,
    allAssets,
    marketMovers,
    strategies,
    portfolio,
    riskMetrics,
    analysisStats,
    smartPredictions,
    performanceTrades,
    newsArticles,
    economicEvents,
    connectionSettings,
    notificationSettings,
    aiAgents,
    aiProviders,
    aiSystemSummary,
    aiAnalytics,
    walletData,
    tradingDashboard,
    manualTrading,
    goldAssets,
    goldPrediction,
    goldNews,
    automationSettings
};