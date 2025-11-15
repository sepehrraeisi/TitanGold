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

export type ManualTradingStatFormat = 'percent' | 'currency' | 'plain';

export interface ManualTradingStat {
    id: string;
    labelKey: string;
    value: number;
    format: ManualTradingStatFormat;
    decimals?: number;
    showSign?: boolean;
    subLabelKey?: string;
}

export interface ManualTradingChartPoint {
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface ManualTradingQuickTradeConfig {
    pair: string;
    baseAsset: string;
    quoteAsset: string;
    price: number;
    changePercent: number;
    availableBalance: number;
    amountPresets: number[];
    defaultPreset: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    baseAssetPrecision: number;
}

export interface ManualQuickTradeOrder {
    side: 'buy' | 'sell';
    amountPercent: number;
    stopLossPercent?: number;
    takeProfitPercent?: number;
}

export interface ManualTradingRecommendation {
    id: string;
    titleKey: string;
    descriptionKey: string;
    type: 'buy' | 'sell' | 'hold';
    confidence: number;
}

export interface ManualTradingSentiment {
    score: number;
    labelKey: string;
}

export interface ManualTradingStrategy {
    id: string;
    nameKey: string;
    isActive: boolean;
    performance: number;
}

export interface ManualTradingPortfolioSlice {
    id: string;
    asset: string;
    percentage: number;
    color: string;
    value: number;
}

export interface ManualTradingPerformancePoint {
    timestamp: string;
    value: number;
}

export interface ManualTradingRecentTrade {
    id: string;
    side: 'buy' | 'sell';
    asset: string;
    pair: string;
    price: number;
    amount: number;
    pnl: number;
    pnlPercent: number;
    confidence?: number;
    executedAt: string;
}

export interface ManualTradingPageData {
    stats: ManualTradingStat[];
    chart: ManualTradingChartPoint[];
    quickTrade: ManualTradingQuickTradeConfig;
    recommendations: ManualTradingRecommendation[];
    sentiment: ManualTradingSentiment;
    strategies: ManualTradingStrategy[];
    portfolio: ManualTradingPortfolioSlice[];
    performance: ManualTradingPerformancePoint[];
    recentTrades: ManualTradingRecentTrade[];
    lastUpdated: string;
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

export type FavoriteAlertCondition = 'above' | 'below';

export interface FavoriteAlert {
  id: string;
  favoriteId: string;
  condition: FavoriteAlertCondition;
  targetPrice: number;
  createdAt: string;
  isActive: boolean;
}

export interface FavoriteAlertInput {
  condition: FavoriteAlertCondition;
  targetPrice: number;
}

export interface FavoritesSummary {
  totalItems: number;
  activeAlerts: number;
  gainers: number;
  decliners: number;
}

export interface FavoritesPageData {
  favorites: FavoriteItem[];
  gainers: MarketMover[];
  losers: MarketMover[];
  trending: MarketMover[];
  catalog: CryptoAsset[];
  alerts: FavoriteAlert[];
  summary: FavoritesSummary;
  lastUpdated: string;
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
  allocation?: number;
  targetAllocation?: number;
  color?: string;
  lastRebalancedAt?: string;
}

export type PortfolioStatFormat = 'currency' | 'percent' | 'plain';

export interface PortfolioOverviewStat {
  id: string;
  labelKey: string;
  value: number;
  format: PortfolioStatFormat;
  decimals?: number;
  change?: number;
  changeFormat?: PortfolioStatFormat;
  changeDecimals?: number;
  showChangeSign?: boolean;
  subLabelKey?: string;
  subLabelParams?: Record<string, string | number>;
}

export interface PortfolioPerformancePoint {
  timestamp: string;
  value: number;
  benchmark?: number;
}

export type PortfolioTimeRange = '1W' | '1M' | '3M' | '6M' | '1Y';

export interface PortfolioDistributionSlice {
  id: string;
  asset: string;
  percentage: number;
  value: number;
  color: string;
}

export interface PortfolioRiskExposure {
  id: string;
  metricKey: string;
  score: number; // 0 - 100
}

export interface PortfolioCorrelationMatrix {
  assets: string[];
  values: number[][];
}

export interface PortfolioMonthlyReturn {
  id: string;
  month: string;
  value: number;
  benchmark?: number;
}

export type PortfolioInsightTone = 'positive' | 'warning' | 'neutral';

export interface PortfolioInsight {
  id: string;
  titleKey: string;
  descriptionKey: string;
  tone: PortfolioInsightTone;
  confidence?: number;
  acknowledged?: boolean;
  timestamp: string;
}

export interface PortfolioActivity {
  id: string;
  timestamp: string;
  messageKey: string;
  metadata?: Record<string, string | number>;
}

export type PortfolioRebalanceStrategy = 'equal_weight' | 'risk_adjusted' | 'momentum_focus';

export interface PortfolioPageData {
  stats: PortfolioOverviewStat[];
  holdings: PortfolioAsset[];
  riskMetrics: RiskMetric[];
  performance: Record<PortfolioTimeRange, PortfolioPerformancePoint[]>;
  distribution: PortfolioDistributionSlice[];
  exposures: PortfolioRiskExposure[];
  correlation: PortfolioCorrelationMatrix;
  monthlyReturns: PortfolioMonthlyReturn[];
  insights: PortfolioInsight[];
  activities: PortfolioActivity[];
  lastUpdated: string;
}

export interface RiskMetric {
    label: string;
    value: string;
}

export type AnalysisTimeRange = '1W' | '1M' | '3M' | '6M' | '1Y';

export interface AnalysisPerformancePoint {
    timestamp: string;
    equity: number;
    pnl: number;
    drawdown: number;
}

export interface AnalysisStat {
    id: string;
    labelKey: string;
    subLabelKey: string;
    subLabelParams?: Record<string, string | number>;
    value: number;
    format: 'currency' | 'percent' | 'plain' | 'ratio';
    decimals?: number;
    prefix?: string;
    suffix?: string;
    change?: number;
    changeFormat?: 'percent' | 'plain';
    changeDecimals?: number;
    changeDirection?: 'up' | 'down';
}

export interface AnalysisDistributionSlice {
    id: string;
    labelKey: string;
    value: number;
    color: string;
}

export interface AnalysisRiskMetric {
    id: string;
    labelKey: string;
    descriptionKey?: string;
    value: number;
    format: 'currency' | 'percent' | 'plain' | 'ratio';
    decimals?: number;
    prefix?: string;
    suffix?: string;
    change?: number;
    changeFormat?: 'percent' | 'plain';
    changeDecimals?: number;
    changeDirection?: 'up' | 'down';
}

export interface AnalysisReportTemplate {
    id: string;
    format: 'pdf' | 'excel' | 'csv' | 'full';
    labelKey: string;
    descriptionKey?: string;
    isPrimary?: boolean;
    lastGeneratedAt?: string;
}

export interface AnalysisPageData {
    stats: AnalysisStat[];
    performance: Record<AnalysisTimeRange, AnalysisPerformancePoint[]>;
    activeRange: AnalysisTimeRange;
    distribution: AnalysisDistributionSlice[];
    riskMetrics: AnalysisRiskMetric[];
    predictions: SmartPrediction[];
    trades: PerformanceTrade[];
    reports: AnalysisReportTemplate[];
    lastUpdated: string;
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
  language: 'en' | 'fa';
  isBreaking?: boolean;
  pinned?: boolean;
  priority?: number;
  relatedAssets?: string[];
  tags?: string[];
  shareTargets?: string[];
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

export interface NewsSummaryStat {
    id: string;
    labelKey: string;
    value: number;
    delta: number;
    direction: 'up' | 'down' | 'flat';
    suffix?: string;
}

export interface NewsSentimentAsset {
    id: string;
    name: string;
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
    change: number;
}

export interface NewsSentimentHeatmapCell {
    id: string;
    label: string;
    value: number;
}

export interface NewsSentimentSnapshot {
    marketScore: number;
    bias: 'Bullish' | 'Bearish' | 'Neutral';
    change: number;
    trend: 'up' | 'down' | 'flat';
    trendingAssets: NewsSentimentAsset[];
    heatmap: NewsSentimentHeatmapCell[];
}

export type NewsAlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface NewsAlert {
    id: string;
    titleKey: string;
    descriptionKey: string;
    severity: NewsAlertSeverity;
    acknowledged: boolean;
    relatedArticleId?: string;
    timestamp: string;
}

export interface NewsSource {
    id: string;
    name: string;
    reliability: number;
    verified: boolean;
    isPriority: boolean;
    lastCheckedAt: string;
}

export type NewsWatchlistItemType = 'asset' | 'macro' | 'defi' | 'custom';

export interface NewsWatchlistItem {
    id: string;
    name: string;
    type: NewsWatchlistItemType;
    isActive: boolean;
}

export interface NewsFilterPreset {
    id: string;
    nameKey: string;
    categories: Array<NewsArticle['category'] | 'All'>;
    sentiments: Array<NewsArticle['sentiment'] | 'All'>;
    minImpact?: number;
    sources?: string[];
}

export interface NewsBriefing {
    title: string;
    summary: string;
    highlights: string[];
    generatedAt: string;
}

export interface NewsPageData {
    stats: NewsSummaryStat[];
    sentiment: NewsSentimentSnapshot;
    sources: NewsSource[];
    alerts: NewsAlert[];
    watchlist: NewsWatchlistItem[];
    filterPresets: NewsFilterPreset[];
    activeFilterId: string;
    articles: NewsArticle[];
    events: EconomicEvent[];
    breakingArticleId?: string;
    pinnedArticleIds?: string[];
    lastUpdated: string;
    lastBriefingGeneratedAt?: string;
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

export interface AISystemSummary {
    totalAgents: number;
    activeAgents: number;
    inTraining: number;
    avgAccuracy: number;
}

export interface AIManagerOverview {
    summary: AISystemSummary;
    providers: AIProvider[];
    topAgents: Array<Pick<AIAgent, 'id' | 'name' | 'role' | 'accuracy' | 'status'>>;
    lastUpdated: string;
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
    lastUpdated: string;
}

export type AITrainingMode = 'individual' | 'collective' | 'cross-functional';

export type AITrainingStatus = 'scheduled' | 'running' | 'completed';

export interface AITrainingSession {
    id: string;
    title: string;
    mode: AITrainingMode;
    agentIds: string[];
    status: AITrainingStatus;
    startedAt: string;
    expectedCompletionMinutes: number;
    completedAt?: string;
    accuracyGain?: number;
}

export interface AITrainingStats {
    sessions: number;
    avgAccuracy: number;
    activeTrainingAgents: number;
    runningSessions: AITrainingSession[];
    queue: AITrainingSession[];
    recentHistory: AITrainingSession[];
    lastUpdated: string;
}

export interface APIServiceIntegration {
    id: string;
    name: string;
    category: 'ai' | 'exchange' | 'communication' | 'market_data';
    hasSecret: boolean;
    connected: boolean;
    maskedKey: string;
    lastTestedAt?: string;
    issues?: string;
}

export interface AIAPIConfigData {
    aiServices: APIServiceIntegration[];
    exchangeServices: APIServiceIntegration[];
    communicationServices: APIServiceIntegration[];
    marketDataServices: APIServiceIntegration[];
    lastUpdated: string;
}

export interface AICenterData {
    overview: AIManagerOverview;
    agents: AIAgent[];
    analytics: AIAnalyticsMetrics;
    training: AITrainingStats;
    apiConfig: AIAPIConfigData;
}

export type GoldTimeRange = '1D' | '1W' | '1M' | '3M' | '1Y';

export interface GoldAsset {
    id: string;
    name: string;
    buyPrice: number;
    sellPrice: number;
    change: number;
}

export interface GoldOverviewStat {
    id: string;
    labelKey: string;
    value: string;
    delta: number;
    direction: 'up' | 'down' | 'flat';
    hintKey?: string;
}

export interface GoldPricePoint {
    timestamp: string;
    price: number;
    change: number;
    volume: number;
}

export interface GoldMarketDriver {
    id: string;
    labelKey: string;
    value: string;
    change: number;
    descriptionKey: string;
    updatedAt: string;
}

export interface GoldPredictionSignal {
    id: string;
    labelKey: string;
    descriptionKey: string;
    strength: 'strong' | 'moderate' | 'weak';
    confidence: number;
    lastUpdated: string;
}

export interface GoldPrediction {
    id: string;
    title: string;
    shortTerm: string;
    longTerm: string;
    confidence: number;
    horizon: string;
    updatedAt: string;
    scenarios: {
        bullish: string;
        bearish: string;
    };
    confidenceBreakdown: {
        ai: number;
        fundamental: number;
        technical: number;
    };
    signals: GoldPredictionSignal[];
    recommendedActions: string[];
    fullAnalysis: string;
}

export interface GoldNewsArticle {
    id: string;
    headline: string;
    source: string;
    verificationStatus: 'Verified' | 'Unverified';
    impactScore: number;
    aiAnalysis: string;
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
    category: string;
    publishedAt: string;
    watchlisted: boolean;
    pinned?: boolean;
    tags: string[];
}

export interface GoldAlert {
    id: string;
    labelKey: string;
    direction: 'up' | 'down';
    threshold: number;
    assetId: string;
    active: boolean;
    createdAt: string;
    lastTriggeredAt?: string;
}

export interface GoldAlertInput {
    assetId: string;
    direction: 'up' | 'down';
    threshold: number;
    labelKey?: string;
    active?: boolean;
}

export interface GoldTelegramChannel {
    id: string;
    name: string;
    handle: string;
    type: 'public' | 'vip' | 'private';
    subscribers: number;
    autoPost: {
        predictions: boolean;
        news: boolean;
        alerts: boolean;
    };
    lastPublishedAt?: string;
}

export interface GoldPublishTemplate {
    id: string;
    nameKey: string;
    descriptionKey: string;
}

export interface GoldPublishItem {
    id: string;
    type: 'Prediction' | 'News' | 'Alert';
    content: string;
}

export interface GoldTelegramSettings {
    channels: GoldTelegramChannel[];
    templates: GoldPublishTemplate[];
    defaultChannelId: string;
    lastPublishedAt?: string;
}

export interface GoldPageData {
    lastUpdated: string;
    activeRange: GoldTimeRange;
    stats: GoldOverviewStat[];
    priceRanges: Record<GoldTimeRange, GoldPricePoint[]>;
    assets: GoldAsset[];
    prediction: GoldPrediction;
    news: GoldNewsArticle[];
    marketDrivers: GoldMarketDriver[];
    telegram: GoldTelegramSettings;
    alerts: GoldAlert[];
}

export interface GoldPublishResponse {
    data: GoldPageData;
    channel: GoldTelegramChannel;
    publishedAt: string;
    message: string;
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