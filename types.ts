export interface ActiveTrade {
  id: string;
  pair: string;
  type: 'BUY' | 'SELL';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  aiAgent: string;
}

export interface WatchlistItem {
  id: string;
  name: string;
  ticker: string;
  price: number;
  change24h: number;
}

export interface RecentActivity {
  id: string;
  timestamp: string;
  description: string;
  status: 'Completed' | 'In Progress' | 'Failed';
}

export interface ChatMessage {
    id: number;
    sender: 'user' | 'bot';
    text: string;
    isTyping?: boolean;
}

export interface GroundingSource {
    web?: {
        uri: string;
        title: string;
    };
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: 'Admin' | 'Trader' | 'Viewer';
    password?: string; // For mock auth
}

export interface Asset {
    id: string;
    name: string;
    symbol: string;
    amount: number;
    currentValue: number;
    change24h: number;
}

export interface Trade {
    id: string;
    pair: string;
    side: 'buy' | 'sell';
    price: number;
    amount: number;
    time: string;
}

export type TradingTimeRange = '1H' | '24H' | '7D' | '1M' | '1Y';

export interface ChartPoint {
    timestamp: string;
    value: number;
}

export interface TradingKPI {
    id: string;
    labelKey: string;
    value: string;
    change?: string;
    positive: boolean;
}

export interface TradingDashboardData {
    kpis: TradingKPI[];
    trades: Trade[];
    assets: Asset[];
    chart: Record<TradingTimeRange, ChartPoint[]>;
    lastUpdated: string;
}

export interface AIPrediction {
  id: string;
  aiAgent: string;
  asset: string;
  prediction: string;
  probability: number;
  status: 'Pending' | 'Correct' | 'Incorrect';
  timestamp: string;
}

export interface TradingSignal {
  id: string;
  type: 'BUY' | 'SELL';
  asset: string;
  strength: 'Strong' | 'Medium';
  indicators: string;
}

export interface ArtemisInsight {
  id: string;
  title: string;
  text: string;
  confidence: number;
}

export interface MarketNews {
  id: string;
  title: string;
  source: string;
  time: string;
}

export interface FavoriteItem {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume: string;
  hasAlert: boolean;
}

export interface MarketMover {
  id: string;
  symbol: string;
  name: string;
  change: number;
}

export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
}

export interface RecentTrade {
  id: string;
  type: 'BUY' | 'SELL';
  asset: string;
  pnl: number;
  pnlPercent: number;
  confidence?: number;
  time: string;
}

export interface Strategy {
  id: string;
  name: string;
  type: string;
  agents: number;
  status: 'active' | 'inactive';
  roi: number;
  winRate: number;
  trades: number;
  sharpe: number;
  maxDrawdown: number;
  chartData: number[];
  rank: 'A' | 'B' | 'T' | 'S' | 'D' | 'N' | 'M';
}

export interface PortfolioAsset {
  id: string;
  name: string;
  symbol: string;
  amount: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  volatility: number;
}

export interface RiskMetric {
    label: string;
    value: string;
}

export interface AnalysisStat {
    label: string;
    value: string;
    subValue: string;
    change?: number;
}

export interface SmartPrediction {
    id: string;
    symbol: string;
    trend: 'Bullish' | 'Neutral' | 'Bearish';
    targetPrice: string;
    timeframe: string;
    confidence: number;
    analysis: string;
}

export interface PerformanceTrade {
    id: string;
    date: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    amount: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
}

export interface NewsArticle {
  id: string;
  source: string;
  timestamp: string;
  headline: string;
  snippet: string;
  category: 'Crypto' | 'Economy' | 'Politics';
  verificationStatus: 'Verified' | 'Unverified' | 'Disputed';
  impactScore: number; // 0-100
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  aiAnalysis: {
    summary: string;
    verificationDetails: string;
    impactAnalysis: string;
    keyTakeaways: string[];
  };
  link: string;
}

export interface EconomicEvent {
    id: string;
    time: string;
    country: string;
    event: string;
    importance: 'high' | 'medium' | 'low';
    previous: string;
    forecast: string;
    actual: string;
}

export interface WalletAsset {
  id: string;
  name: string;
  symbol: string;
  value: number;
  percentage: number;
}

export interface WalletTransaction {
  id: string;
  type: 'Deposit' | 'Withdrawal' | 'Trade';
  amount: string;
  exchange: string;
  time: string;
  status: 'Completed' | 'Pending';
}

export interface AIAgent {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'inactive' | 'training';
  accuracy: number;
  trainingProgress: number;
  decisions: number;
  learningTime: number;
  knowledgeSize: number;
  level: 'Expert' | 'Advanced' | 'Intermediate';
  capabilities: string[];
  lastUpdate: string;
}

export interface AIProvider {
    id: 'google' | 'anthropic' | 'openai';
    name: string;
    performance: number;
    usage: number;
}

export interface AIAnalyticsMetrics {
    realtime: {
        decisionRate: number;
        successRate: number;
        systemUptime: number;
        agentDistribution: { active: number; training: number; offline: number };
    };
    performance: {
        totalDecisions: number;
        totalLearningHours: number;
        avgAccuracy: number;
        monthlyImprovement: number;
    };
    resourceUsage: {
        cpu: number;
        gpu: number;
        memory: number;
        precision: number[];
        recall: number[];
    };
    agentMatrix: Array<{ id: string; name: string; accuracy: number; successRate: number; progress: number; status: 'active' | 'training' | 'error' }>;
}

export interface GoldAsset {
    id: string;
    name: string;
    buyPrice: number;
    sellPrice: number;
    change: number;
}

export interface GoldPrediction {
    id: string;
    title: string;
    shortTerm: string;
    longTerm: string;
    confidence: number;
    scenarios: {
        bullish: string;
        bearish: string;
    };
    fullAnalysis: string;
}

export interface GoldNewsArticle {
    id: string;
    headline: string;
    source: string;
    verificationStatus: 'Verified' | 'Unverified';
    impactScore: number;
    aiAnalysis: string;
}

export interface DataSource {
  id: string;
  type: 'Telegram Channel' | 'News Website' | 'Custom API';
  value: string;
  status: 'connected' | 'error' | 'pending';
}

export interface TelegramPublisherConfig {
  id: string;
  channelName: string;
  botToken: string;
  channelId: string;
  schedule: 'instantly' | 'daily_9am' | 'weekdays_only';
  requiresApproval: boolean;
  autoPostTriggers: {
    gold_predictions: boolean;
    crypto_signals: boolean;
    verified_news: boolean;
    market_analysis: boolean;
  };
  contentFilters: {
    crypto_signal_strength: 'any' | 'medium' | 'strong';
    news_impact_score: number; // 0-100
  };
  messageTemplates: {
    gold_prediction: string;
    crypto_signal: string;
    news_article: string;
  };
}

export interface WorkflowTrigger {
    type: 'new_news_article' | 'new_crypto_signal' | 'market_event';
    source: string;
}

export interface WorkflowCondition {
    field: string;
    operator: 'greater_than' | 'equals' | 'contains';
    value: string | number;
}

export interface WorkflowAction {
    type: 'execute_trade' | 'send_telegram_post';
    target: string; // e.g., 'BTC' or channel ID
    parameters: any;
}

export interface Workflow {
    id: string;
    name: string;
    enabled: boolean;
    trigger: WorkflowTrigger;
    conditions: WorkflowCondition[];
    actions: WorkflowAction[];
}

export type AutopilotMode = 'balanced' | 'aggressive' | 'scalping' | 'capital_preservation';

export type AutopilotRiskLevel = 'conservative' | 'balanced' | 'aggressive';

export interface AutopilotGoal {
    startCapital: number;
    targetCapital: number;
    progress: number;
    etaMinutes: number;
    lastSyncSeconds: number;
    activeTrades: number;
    maxConcurrentTrades: number;
    successRate: number;
    agentsOnline: number;
    agentsTraining: number;
    agentsTotal: number;
    mode: 'auto' | 'paused';
    nextActionKey: string;
}

export interface AutopilotMetrics {
    totalPerformance: number;
    winRate: number;
    totalTrades: number;
    todayProfit: number;
}

export interface AutopilotState {
    isActive: boolean;
    operatingMode: AutopilotMode;
    tradingBudget: number;
    riskLevel: AutopilotRiskLevel;
    goal: AutopilotGoal;
    metrics: AutopilotMetrics;
    statusMessageKey: string;
    lastUpdated: string;
}

export type AutopilotQuickAction = 'ai_decisions' | 'performance_report' | 'export_settings';

export interface AutopilotQuickActionResult {
    state: AutopilotState;
    actionKey: string;
}