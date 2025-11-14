import type { User, FavoriteItem, FavoriteAlert, CryptoAsset, Strategy, PortfolioAsset, RiskMetric, AnalysisStat, SmartPrediction, PerformanceTrade, NewsArticle, EconomicEvent, AIAgent, AIProvider, AIAnalyticsMetrics, WalletAsset, WalletTransaction, GoldAsset, GoldPrediction, GoldNewsArticle, DataSource, TelegramPublisherConfig, Workflow, AutopilotState, TradingDashboardData, TradingTimeRange, ChartPoint } from '../types.ts';

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

const portfolioStats = [
    { label: 'total_portfolio_value', value: '$271,406.51', change: '+8.85%' },
    { label: 'success_rate', value: '77.3%', subValue: 'from_trades' },
    { label: 'sharpe_ratio', value: '1.91' },
];

const portfolioAssets: PortfolioAsset[] = [
    { id: '1', name: 'Bitcoin', symbol: 'BTC', amount: 40.3259, avgPrice: 26882.69, currentPrice: 48865.95, value: 1291.35, pnl: 0, pnlPercent: 3.11, volatility: 13.5 },
    { id: '2', name: 'Ethereum', symbol: 'ETH', amount: 38.0700, avgPrice: 49579.22, currentPrice: 34237.14, value: 6202.96, pnl: 0, pnlPercent: 11.91, volatility: 18.2 },
    { id: '3', name: 'Cardano', symbol: 'ADA', amount: 11.1996, avgPrice: 38770.08, currentPrice: 19806.29, value: 1318.05, pnl: 0, pnlPercent: -0.03, volatility: 17.6 },
];

const riskMetrics: RiskMetric[] = [
    { label: 'var_95', value: '$7,315.52' },
    { label: 'sortino_ratio', value: '2.26' },
    { label: 'portfolio_beta', value: '1.31' },
    { label: 'jensen_alpha', value: '0.49%' },
    { label: 'info_ratio', value: '1.26' },
];

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
    portfolioStats,
    portfolioAssets,
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
    goldAssets,
    goldPrediction,
    goldNews,
    automationSettings
};