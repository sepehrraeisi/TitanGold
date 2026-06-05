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
  role: 'Admin' | 'Trader' | 'Viewer' | 'Analyst';
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
  pair?: string; // Trading pair (e.g., 'BTC/USDT')
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
  volume24h?: number;
  hasAlert: boolean;
  priceHistory?: number[];
  _priceChangeDirection?: 'up' | 'down' | null;
  _priceUpdateTime?: number;
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

export interface WalletConnector {
  id: string;
  name: string;
  type: 'exchange' | 'wallet' | 'defi';
  status: 'connected' | 'error' | 'disconnected' | 'syncing';
  lastSyncedAt: string;
  descriptionKey: string;
}

export interface WalletSecurityControl {
  id: string;
  labelKey: string;
  enabled: boolean;
}

export interface WalletPreferences {
  baseCurrency: string;
  autoRefreshIntervalMinutes: number;
  lowBalanceThreshold: number;
  showZeroBalance: boolean;
}

export interface WalletStatsOverview {
  totalAssets: number;
  activeWallets: number;
  profit24h: number;
  coldStorage: number;
}

export interface WalletSettingsData {
  stats: WalletStatsOverview;
  assets: WalletAsset[];
  transactions: WalletTransaction[];
  connectors: WalletConnector[];
  securityControls: WalletSecurityControl[];
  preferences: WalletPreferences;
  lastSyncedAt: string;
}

export type ProfileStatus = 'verified' | 'pending' | 'restricted';

export type ProfileIntegrationType = 'exchange' | 'wallet' | 'ai' | 'messaging';

export interface ProfileMetric {
  id: string;
  labelKey: string;
  value: string;
  change?: number;
  direction?: 'up' | 'down';
}

export interface ProfileIntegration {
  id: string;
  nameKey: string;
  type: ProfileIntegrationType;
  status: 'connected' | 'error' | 'syncing';
  lastSyncedAt: string;
}

export interface ProfileActivityEntry {
  id: string;
  timestamp: string;
  messageKey: string;
  context?: string;
}

export interface ProfileCommunicationSettings {
  emailReports: boolean;
  smsAlerts: boolean;
  aiSummaries: boolean;
  tradePush: boolean;
  weeklyDigest: boolean;
}

export interface ProfileDetails {
  id: string;
  fullName: string;
  email: string;
  username: string;
  jobTitle: string;
  phone: string;
  timezone: string;
  language: 'en' | 'fa';
  location: string;
  status: ProfileStatus;
  memberSince: string;
  lastLoginAt: string;
  avatarUrl?: string;
}

export interface ProfileSettingsData {
  profile: ProfileDetails;
  communications: ProfileCommunicationSettings;
  metrics: ProfileMetric[];
  integrations: ProfileIntegration[];
  activity: ProfileActivityEntry[];
  lastUpdated: string;
}

export type ProfileDetailsUpdate = Partial<Pick<ProfileDetails,
  'fullName' | 'email' | 'jobTitle' | 'phone' | 'timezone' | 'language' | 'location'>>;

export interface ProfilePasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SecurityMethod {
  id: string;
  type: 'authenticator' | 'sms' | 'hardware_key';
  enabled: boolean;
  lastUsedAt?: string;
  deviceName?: string;
}

export type SecuritySeverity = 'low' | 'medium' | 'high';

export interface SecuritySession {
  id: string;
  device: string;
  location: string;
  ipAddress: string;
  lastActiveAt: string;
  current: boolean;
  risk: SecuritySeverity;
}

export interface SecurityEvent {
  id: string;
  timestamp: string;
  titleKey: string;
  descriptionKey: string;
  severity: SecuritySeverity;
}

export interface SecurityAlertSettings {
  suspiciousLogin: boolean;
  largeWithdrawal: boolean;
  newDevice: boolean;
}

export interface SecuritySettingsData {
  score: number;
  twoFactor: {
    enabled: boolean;
    primaryMethod: SecurityMethod['type'];
    backupCodesRemaining: number;
    lastUpdated: string;
  };
  methods: SecurityMethod[];
  sessions: SecuritySession[];
  events: SecurityEvent[];
  alerts: SecurityAlertSettings;
  trustedLocations: string[];
  lastReviewed: string;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  username?: string; // Username for login (derived from email or name)
  password?: string; // Password hash (stored separately for security)
  roleKey: string;
  status: 'active' | 'invited' | 'suspended';
  lastActiveAt?: string;
  createdAt: string;
  twoFactorEnabled: boolean;
  permissions: string[];
}

export interface UserInvitation {
  id: string;
  email: string;
  roleKey: string;
  invitedAt: string;
  invitedBy: string;
  lastSentAt: string;
}
export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  details?: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserRoleOption {
  roleKey: string;
  descriptionKey: string;
  permissions: string[]; // Add permissions array
  isCustom?: boolean; // Whether this is a custom role or system role
  createdAt?: string; // When custom role was created
  createdBy?: string; // Who created the custom role
}

export interface UserManagementData {
  users: ManagedUser[];
  invitations: UserInvitation[];
  availableRoles: UserRoleOption[];
  defaultRoleKey: string;
  lastUpdated: string;
  activityLog?: UserActivity[]; // Activity log for all users
  registrationEnabled: boolean; // Enable/disable public registration
  registrationDefaultRole: string; // Default role for new registrations
}

export interface AIAgent {
  id: string;
  agent_key?: string; // ✅ NEW: agent_key for frontend lookup
  name: string;
  role: string;
  status: 'active' | 'inactive' | 'training';

  // ML-specific metrics (null for rule-based agents like fundamental)
  accuracy?: number | null;
  trainingProgress?: number | null;
  learningTime?: number | null;
  knowledgeSize?: number | null;

  // Universal metrics
  decisions: number;
  level: 'Expert' | 'Advanced' | 'Intermediate';
  capabilities: string[];
  lastUpdate: string;

  // Fundamental-specific metrics
  totalAnalyses?: number;
  activeHours?: number;
  dataStoredMB?: number;

  // Arbitrage-specific metrics
  totalScans?: number;
  opportunitiesFound?: number;
  totalProfitUSDT?: number;

  // Technical Analysis Agent specific fields
  technicalAnalysisConfig?: TechnicalAnalysisConfig;
  performanceMetrics?: AgentPerformanceMetrics;
  activeStrategies?: string[];
  lastAnalysis?: TechnicalAnalysisResult;
  // Risk Management Agent specific fields
  riskManagementConfig?: RiskManagementConfig;
  riskMetrics?: RiskManagementMetrics;
  lastRiskAssessment?: RiskAssessment;
  // Sentiment Analysis Agent specific fields
  sentimentAnalysisConfig?: SentimentAnalysisConfig;
  sentimentMetrics?: SentimentMetrics;
  lastSentimentAnalysis?: SentimentAnalysisResult;
  // Pattern Recognition Agent specific fields
  patternRecognitionConfig?: PatternRecognitionConfig;
  patternMetrics?: PatternMetrics;
  lastPatternAnalysis?: PatternAnalysisResult;
  // Price Prediction Agent specific fields
  pricePredictionConfig?: PricePredictionConfig;
  pricePredictionMetrics?: PricePredictionMetrics;
  lastPricePrediction?: PricePredictionResult;
  // Arbitrage Agent specific fields
  arbitrageConfig?: ArbitrageConfig;
  arbitrageMetrics?: ArbitrageMetrics;
  lastArbitrageScan?: ArbitrageScanResult;
  // Portfolio Allocation Agent specific fields
  portfolioAllocationConfig?: PortfolioAllocationConfig;
  allocationMetrics?: PortfolioAllocationMetrics;
  lastAllocationAnalysis?: PortfolioAllocationResult;
  // Liquidity Analysis Agent specific fields
  liquidityAnalysisConfig?: LiquidityAnalysisConfig;
  liquidityMetrics?: LiquidityAnalysisMetrics;
  lastLiquidityAnalysis?: LiquidityAnalysisResult;
  // Trend Detection Agent specific fields
  trendDetectionConfig?: TrendDetectionConfig;
  trendMetrics?: TrendDetectionMetrics;
  lastTrendDetection?: TrendDetectionResult;
  // Optimization Agent specific fields
  optimizationConfig?: OptimizationConfig;
  optimizationMetrics?: OptimizationMetrics;
  lastOptimizationResult?: OptimizationResult;
  // Order Management Agent specific fields
  orderManagementConfig?: OrderManagementConfig;
  orderManagementMetrics?: OrderManagementMetrics;
  lastOrderManagementRun?: OrderManagementResult;
  // Fundamental Analysis Agent specific fields
  fundamentalAnalysisConfig?: FundamentalAnalysisConfig;
  fundamentalMetrics?: FundamentalAnalysisMetrics;
  lastFundamentalAnalysis?: FundamentalAnalysisResult;
  // Market Intelligence Agent specific fields
  marketIntelligenceConfig?: MarketIntelligenceConfig;
  marketIntelligenceMetrics?: MarketIntelligenceMetrics;
  lastMarketIntelligenceResult?: MarketIntelligenceResult;
  lastTimingAnalysis?: TimingAnalysisResult;
  // Learning and adaptation
  learningData?: {
    mistakes: Array<{
      timestamp: string;
      prediction: any;
      actual: any;
      error: number;
      learned: boolean;
    }>;
    improvements: Array<{
      timestamp: string;
      metric: string;
      before: number;
      after: number;
      improvement: number;
    }>;
  };
  // Artemis control
  artemisCommands?: ArtemisCommand[];
}

// Technical Analysis Agent Configuration
export interface TechnicalAnalysisConfig {
  enabledIndicators: TechnicalIndicator[];
  timeframes: Timeframe[];
  riskLevel: 'low' | 'medium' | 'high';
  minConfidence: number;
  maxPositions: number;
  autoTrading: boolean;
  notificationSettings: {
    onSignal: boolean;
    onAlert: boolean;
    onError: boolean;
  };
  advancedSettings: {
    useMachineLearning: boolean;
    useDeepLearning: boolean;
    ensembleMode: boolean;
    realTimeAnalysis: boolean;
  };
}

export interface TechnicalIndicator {
  id: string;
  name: string;
  enabled: boolean;
  parameters: { [key: string]: number | string };
  weight: number; // 0-100, importance in decision making
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

export interface TechnicalAnalysisResult {
  timestamp: string;
  symbol: string;
  timeframe: Timeframe;
  signal: 'buy' | 'sell' | 'hold';
  confidence: number;
  indicators: {
    indicatorId: string;
    value: number;
    signal: 'buy' | 'sell' | 'neutral';
    weight: number;
  }[];
  priceTarget?: {
    entry: number;
    stopLoss: number;
    takeProfit: number;
  };
  reasoning: string;
}

export interface AgentPerformanceMetrics {
  totalSignals: number;
  successfulSignals: number;
  winRate: number;
  averageConfidence: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  recentPerformance: {
    last24h: { signals: number; winRate: number };
    last7d: { signals: number; winRate: number };
    last30d: { signals: number; winRate: number };
  };
}

// Agent Control Commands
export interface AgentControlCommand {
  agentId: string;
  command: 'start' | 'stop' | 'pause' | 'resume' | 'restart' | 'update_config' | 'run_analysis' | 'clear_cache';
  parameters?: { [key: string]: any };
}

// Risk Management Agent Configuration
export interface RiskManagementConfig {
  maxPositionSize: number; // Maximum position size as % of portfolio
  maxDailyLoss: number; // Maximum daily loss as %
  maxWeeklyLoss: number; // Maximum weekly loss as %
  maxMonthlyLoss: number; // Maximum monthly loss as %
  maxDrawdown: number; // Maximum drawdown as %
  stopLossPercentage: number; // Default stop loss %
  takeProfitPercentage: number; // Default take profit %
  riskPerTrade: number; // Risk per trade as % of portfolio
  minRiskRewardRatio: number; // Minimum acceptable R/R
  maxOpenPositions: number; // Maximum concurrent positions
  leverageLimit: number; // Maximum leverage allowed
  correlationLimit: number; // Maximum correlation between positions (0-1)
  volatilityThreshold: number; // Maximum volatility allowed
  positionSizingMode: 'percent' | 'fixed';
  fixedPositionSize: number; // Used when positionSizingMode === 'fixed'
  trailingStop: {
    enabled: boolean;
    distancePercent: number;
    activationPercent: number;
    cooldownMinutes: number;
  };
  diversificationSettings: {
    maxPerAssetPercent: number;
    maxPerSectorPercent: number;
    minAssets: number;
    rebalanceFrequency: 'daily' | 'weekly' | 'monthly';
  };
  exposureControls: {
    perAsset: number;
    perSector: number;
    derivativesRatio: number;
    stableReservePercent: number;
  };
  allowedAssets: string[];
  restrictedAssets: string[];
  alerting: {
    sensitivity: 'low' | 'medium' | 'high';
    channels: {
      dashboard: boolean;
      email: boolean;
      telegram: boolean;
    };
    smartCloseEnabled: boolean;
    notifyOnAutoClose: boolean;
  };
  integrationSettings: {
    syncWithTechnical: boolean;
    syncWithTiming: boolean;
    syncWithVolume: boolean;
    enforceLimitsInExecution: boolean;
    autoHedge: boolean;
  };
  enabledRiskRules: RiskRule[];
  autoAdjustment: {
    enabled: boolean;
    learningMode: boolean; // Learn from mistakes
    adjustBasedOnPerformance: boolean;
    adjustBasedOnMarketConditions: boolean;
  };
  notificationSettings: {
    onRiskLimit: boolean;
    onStopLoss: boolean;
    onTakeProfit: boolean;
    onHighRisk: boolean;
  };
  advancedSettings: {
    useMachineLearning: boolean;
    dynamicRiskAdjustment: boolean;
    portfolioHeatMap: boolean;
    realTimeMonitoring: boolean;
    stressTesting?: boolean;
  };
  marketStressTests?: {
    enableStressTests: boolean;
    varConfidence: number;
  };
}

export interface RiskRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: string; // e.g., "positionSize > maxPositionSize"
  action: 'block' | 'warn' | 'reduce' | 'close';
  priority: number; // Higher priority = checked first
  parameters: { [key: string]: number | string };
}

export type RiskAlertSeverity = 'info' | 'warning' | 'critical';
export type RiskAlertType =
  | 'drawdown'
  | 'exposure'
  | 'leverage'
  | 'diversification'
  | 'volatility'
  | 'compliance'
  | 'custom';

export interface RiskAlertSummary {
  id: string;
  title: string;
  message: string;
  type: RiskAlertType;
  severity: RiskAlertSeverity;
  occurredAt: string;
  acknowledged: boolean;
}

export interface RiskLimitUsage {
  window: 'daily' | 'weekly' | 'monthly';
  limitPercent: number;
  usedPercent: number;
  breaches: number;
  resetAt: string;
}

export interface RiskExposureBreakdown {
  asset: string;
  exposurePercent: number;
  allocationUsd: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  correlation: number;
  pnlPercent: number;
  leverage: number;
}

export interface RiskManagedPosition {
  symbol: string;
  sizePercent: number;
  exposureUsd: number;
  leverage: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  stopLossPercent: number;
  takeProfitPercent: number;
  trailingStopPercent?: number;
  entryPrice: number;
  currentPrice: number;
  pnlPercent: number;
  confidence: number;
  confirmationAgents: string[];
  recommendedAction: 'hold' | 'reduce' | 'close' | 'hedge';
}

export interface RiskLimitBreach {
  id: string;
  ruleId: string;
  description: string;
  triggeredAt: string;
  severity: 'medium' | 'high' | 'critical';
  actionTaken: 'notify' | 'close' | 'reduce' | 'block';
  status: 'open' | 'resolved';
}

export interface RiskDiversificationSnapshot {
  diversificationScore: number;
  herfindahlIndex: number;
  giniCoefficient: number;
  largestAssetPercent: number;
  sectors: Array<{
    name: string;
    percent: number;
    riskLevel: 'low' | 'medium' | 'high';
  }>;
}

export interface RiskPerformanceSummary {
  riskAdjustedReturn: number;
  sharpe: number;
  sortino: number;
  ulcerIndex: number;
  maxDrawdown: number;
  avgRiskReward: number;
  winRate: number;
  pnlYtd: number;
  pnlMtd: number;
  missedOpportunities: number;
}

export interface RiskAutomationStatus {
  trailingStopsActive: number;
  autoCloseEvents: number;
  hedgesOpen: number;
  integrationsSynced: number;
}

export interface RiskHeatmapCell {
  timeframe: string;
  riskScore: number;
  riskLabel: 'low' | 'medium' | 'high' | 'critical';
  context: string;
}

export interface RiskAssessment {
  timestamp: string;
  portfolioRisk: number; // Overall portfolio risk score (0-100)
  overallRisk: number; // Alias for portfolioRisk
  riskScore: number; // Alias for portfolioRisk
  positionRisks: {
    symbol: string;
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    reasons: string[];
  }[];
  recommendations: {
    action: 'reduce' | 'close' | 'hold' | 'increase';
    symbol?: string;
    reason: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }[];
  marketConditions: {
    volatility: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    liquidity: 'high' | 'medium' | 'low';
  };
  riskMetrics: {
    currentDrawdown: number;
    dailyPnL: number;
    exposure: number; // Total exposure as % of portfolio
    leverage: number;
    correlation: number; // Average correlation between positions
  };
}

export interface RiskManagementMetrics {
  totalAssessments: number;
  risksBlocked: number;
  risksMitigated: number;
  averageRiskScore: number;
  maxRiskScore: number;
  portfolioProtectionRate: number; // % of times portfolio was protected
  recentPerformance: {
    last24h: { assessments: number; risksBlocked: number; avgRiskScore: number };
    last7d: { assessments: number; risksBlocked: number; avgRiskScore: number };
    last30d: { assessments: number; risksBlocked: number; avgRiskScore: number };
  };
  learningMetrics: {
    mistakesLearned: number;
    predictionsImproved: number;
    accuracyGain: number; // % improvement
    lastLearningUpdate: string;
  };
  riskScores: {
    overall: number;
    drawdown: number;
    leverage: number;
    concentration: number;
    liquidity: number;
  };
  drawdownHistory: Array<{ timestamp: string; value: number }>;
  exposureBreakdown: RiskExposureBreakdown[];
  diversification: RiskDiversificationSnapshot;
  riskLimitUsage: RiskLimitUsage[];
  alerts: RiskAlertSummary[];
  limitBreaches: RiskLimitBreach[];
  openPositions: RiskManagedPosition[];
  performanceSummary: RiskPerformanceSummary;
  automationStatus: RiskAutomationStatus;
  riskHeatmap: RiskHeatmapCell[];
  correlationMatrix: PortfolioCorrelationMatrix;
  positionSizingInsights: {
    mode: 'percent' | 'fixed';
    recommendedSizePercent: number;
    currentExposurePercent: number;
    signalsAwaitingAdjustment: number;
  };
}

// Sentiment Analysis Agent Configuration
export type SentimentBias = 'Bullish' | 'Bearish' | 'Neutral';

export type SentimentAlertSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type SentimentReactionMode = 'auto' | 'alert' | 'wait';

export interface SentimentSourceStatus {
  id: string;
  name: string;
  type: 'news' | 'social' | 'market' | 'onchain' | 'search' | 'custom';
  enabled: boolean;
  coverage: number; // 0-100
  latencyMs: number;
  lastSync: string;
  health: 'good' | 'warning' | 'error';
}

export interface SentimentImpactAlert {
  id: string;
  asset?: string;
  channel: 'news' | 'social' | 'market' | 'onchain';
  type: 'trend_shift' | 'fear_spike' | 'news_impact' | 'social_surge' | 'custom';
  severity: SentimentAlertSeverity;
  message: string;
  impactScore: number;
  sentimentShift: number;
  detectedAt: string;
  region?: string;
  relatedSource?: string;
}

export interface SentimentHistoryPoint {
  timestamp: string;
  overallScore: number;
  newsScore: number;
  socialScore: number;
  marketScore: number;
  bias: SentimentBias;
  fearGreed: number;
  socialVolume: number;
  newsImpact: number;
}

export interface SentimentIntegrationStatus {
  id: string;
  name: string;
  status: 'synced' | 'pending' | 'disabled';
  lastSync: string;
  lastSignal?: string;
  actionRequired?: string;
}

export interface SentimentSourceConfig {
  news: {
    enabled: boolean;
    sources: string[];
    maxArticles: number;
    keywords: string[];
    minImpactScore: number;
  };
  social: {
    enabled: boolean;
    platforms: string[];
    keywords: string[];
    minVotes: number;
  };
  market: {
    enabled: boolean;
    metrics: Array<'fearGreed' | 'dominance' | 'volume' | 'priceMomentum'>;
    sensitivity: 'low' | 'medium' | 'high';
  };
  onchain?: {
    enabled: boolean;
    metrics: Array<'inflows' | 'outflows' | 'whaleActivity' | 'fundingRates'>;
    whaleThreshold: number;
  };
  search?: {
    enabled: boolean;
    platforms: string[];
    minTrendScore: number;
  };
}

export interface SentimentAnalysisConfig {
  sources: SentimentSourceConfig;
  weightings: {
    news: number;
    social: number;
    market: number;
  };
  alertThresholds: {
    bullish: number;
    bearish: number;
  };
  autoActions: {
    notifyOnExtreme: boolean;
    rebalanceOnBearish: boolean;
    pauseLongsOnExtremeBearish: boolean;
  };
  learning: {
    enabled: boolean;
    adjustWeights: boolean;
    adaptiveKeywords: boolean;
  };
  sensitivity: {
    sentimentImpact: 'low' | 'medium' | 'high';
    noiseFilter: number;
    trendShiftTrigger: number;
    momentumWindow: number;
  };
  monitoring: {
    assets: string[];
    includeOnChain: boolean;
    includeSocial: boolean;
    languages: string[];
    regions: string[];
    frequency: 'realtime' | '5m' | '15m' | 'hourly';
  };
  reactionStrategy: SentimentReactionMode;
  alerting: {
    impactThreshold: number;
    suddenShiftPercent: number;
    cooldownMinutes: number;
    channels: {
      dashboard: boolean;
      email: boolean;
      telegram: boolean;
    };
  };
  integrationSettings: {
    syncWithTechnical: boolean;
    syncWithRisk: boolean;
    syncWithTiming: boolean;
    shareWithVolume: boolean;
    shareWithArtemisCore: boolean;
  };
}

export interface SentimentArticleInsight {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  impactScore: number;
  sentimentScore: number;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  magnitude: number;
  keywords: string[];
}

export interface SentimentTrendingAsset {
  symbol: string;
  name: string;
  change24h: number;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  socialVolumeChange?: number;
  mentionScore?: number;
  newsImpact?: number;
}

export interface SentimentComponentScores {
  newsScore: number;
  socialScore: number;
  marketScore: number;
}

export interface SentimentAnalysisResult {
  timestamp: string;
  overallScore: number;
  bias: 'Bullish' | 'Bearish' | 'Neutral';
  components: SentimentComponentScores;
  newsImpactScore: number;
  sentimentMomentum: {
    value: number;
    direction: 'rising' | 'falling' | 'stable';
    label: string;
  };
  predictionScore: number;
  socialVolume: number;
  newsInsights: SentimentArticleInsight[];
  trendingAssets: SentimentTrendingAsset[];
  marketContext: {
    fearGreedIndex: number;
    fearGreedLabel: string;
    btcDominance?: number;
    totalVolume24h?: number;
  };
  socialContext: {
    votesUp: number;
    votesDown: number;
    sources: Array<{
      id: string;
      name: string;
      upVotes: number;
      downVotes: number;
    }>;
  };
  reasoning: string;
  impactAlerts: SentimentImpactAlert[];
}

export interface SentimentMetrics {
  totalAnalyses: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  averageScore: number;
  alertsTriggered: number;
  trendShiftAlerts: number;
  extremeEvents: number;
  newsImpactAverage: number;
  socialVolume24h: number;
  sentimentMomentum: number;
  predictionScoreAvg: number;
  recentPerformance: {
    last24h: { analyses: number; avgScore: number };
    last7d: { analyses: number; avgScore: number };
    last30d: { analyses: number; avgScore: number };
  };
  history: SentimentHistoryPoint[];
  activeAlerts: SentimentImpactAlert[];
  sourceStatus: SentimentSourceStatus[];
  integrations: SentimentIntegrationStatus[];
}

// Pattern Recognition Agent types
export interface PatternRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  direction: 'bullish' | 'bearish' | 'both';
  minReliability: number; // 0-1
  lookback: number; // number of candles to evaluate
}

export type PatternSensitivity = 'low' | 'medium' | 'high';

export interface PatternCategoryConfig {
  enabled: boolean;
  patterns: string[];
  maxActive: number;
}

export interface PatternTimeframePreference {
  patternId: string;
  timeframes: Timeframe[];
}

export interface PatternVolumeFilter {
  enabled: boolean;
  minVolumeMultiplier: number;
  lookbackCandles: number;
}

export interface PatternAlertChannelSettings {
  dashboard: boolean;
  email: boolean;
  telegram: boolean;
}

export interface PatternAlertingSettings {
  notifyOnBreakout: boolean;
  notifyOnFalseBreakout: boolean;
  minBreakoutScore: number;
  maxSignalsPerAsset: number;
  channels: PatternAlertChannelSettings;
}

export interface PatternIntegrationSettings {
  syncWithTechnical: boolean;
  syncWithTiming: boolean;
  shareWithRisk: boolean;
  forwardToArtemis: boolean;
}

export interface PatternRecognitionConfig {
  symbols: string[];
  timeframes: Timeframe[];
  patternRules: PatternRule[];
  confirmation: {
    requireVolumeSpike: boolean;
    volumeMultiplier: number;
    allowBreakoutConfirmation: boolean;
  };
  alertSettings: {
    notifyOnBullish: boolean;
    notifyOnBearish: boolean;
    minConfidence: number;
    breakout?: PatternAlertingSettings;
  };
  detectionSettings?: {
    sensitivity: PatternSensitivity;
    minDetectionScore: number;
    volumeFilter: PatternVolumeFilter;
    timeframeConfirmation: {
      enabled: boolean;
      higherTimeframe?: Timeframe;
    };
  };
  categories?: {
    classic: PatternCategoryConfig;
    candlestick: PatternCategoryConfig;
    algorithmic: PatternCategoryConfig;
  };
  timeframeOverrides?: PatternTimeframePreference[];
  learning: {
    enabled: boolean;
    adjustReliability: boolean;
    trackFalseSignals: boolean;
  };
  integrationSettings?: PatternIntegrationSettings;
}

export interface DetectedPattern {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  patternId: string;
  patternName: string;
  direction: 'bullish' | 'bearish';
  reliability: number;
  confidence: number;
  price: number;
  detectedAt: string;
  confirmation?: string;
}

export interface CandlestickPatternInsight {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  pattern: string;
  sentiment: 'bullish' | 'bearish';
  confidence: number;
  detectedAt: string;
}

export type BreakoutStatus = 'pending' | 'confirmed' | 'failed';

export interface PatternBreakoutAlert {
  id: string;
  symbol: string;
  patternName: string;
  direction: 'bullish' | 'bearish';
  breakoutScore: number;
  confidence: number;
  status: BreakoutStatus;
  detectedAt: string;
  validationAt?: string;
  notes?: string;
}

export interface PatternHistoryEntry {
  id: string;
  timestamp: string;
  symbol: string;
  patternName: string;
  direction: 'bullish' | 'bearish';
  outcome: 'win' | 'loss' | 'pending';
  entryPrice: number;
  exitPrice?: number;
  performanceBps?: number;
}

export interface PatternFrequencyStat {
  patternName: string;
  occurrences: number;
  successRate: number;
}

export interface PatternAnalysisResult {
  timestamp: string;
  symbol: string;
  timeframe: Timeframe;
  detectedPatterns: DetectedPattern[];
  summary: string;
  stats: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  detectionScore: number;
  breakoutPotential: number;
  trendSignal: {
    type: 'continuation' | 'reversal' | 'neutral';
    confidence: number;
    label: string;
  };
  patternFrequency: PatternFrequencyStat[];
  candlestickPatterns: CandlestickPatternInsight[];
  breakoutAlerts: PatternBreakoutAlert[];
}

export interface PatternMetrics {
  totalAnalyses: number;
  patternsDetected: number;
  bullishPatterns: number;
  bearishPatterns: number;
  confirmedPatterns: number;
  accuracy: number;
  falseSignals: number;
  detectionScoreAvg: number;
  breakoutSuccessRate: number;
  averageBreakoutPotential: number;
  patternFrequency: PatternFrequencyStat[];
  candlestickHits: number;
  breakoutAlertsTriggered: number;
  history: PatternHistoryEntry[];
  recentPerformance: {
    last24h: { patterns: number; accuracy: number };
    last7d: { patterns: number; accuracy: number };
    last30d: { patterns: number; accuracy: number };
  };
}

export type PredictionHorizon = '1h' | '4h' | '1d' | '1w';

export interface PricePredictionConfig {
  symbols: string[];
  horizons: PredictionHorizon[];
  candlesLookback: number;
  modelWeights: {
    trend: number;
    momentum: number;
    meanReversion: number;
  };
  alertThresholds: {
    minConfidence: number;
    maxErrorPercent: number;
  };
  confidenceLevels?: number[];
  scenarioWeights?: {
    optimistic: number;
    base: number;
    pessimistic: number;
  };
  dataSources?: {
    sentiment: boolean;
    news: boolean;
    onchain: boolean;
    macro: boolean;
  };
  autoActions: {
    notifyOnBreakout: boolean;
    pauseTradesOnHighError: boolean;
    syncWithRisk?: boolean;
    pushToDashboard?: boolean;
  };
  learning: {
    enabled: boolean;
    adjustWeights: boolean;
    adaptiveLookback: boolean;
    autoBacktest?: boolean;
  };
  integrationSettings?: {
    shareWithTechnical: boolean;
    shareWithVolume: boolean;
    shareWithSentiment: boolean;
    forwardToArtemis: boolean;
  };
}

export interface ForecastPoint {
  horizon: PredictionHorizon;
  predictedPrice: number;
  confidence: number;
  errorMargin: number;
  expectedMovePercent: number;
  direction: 'up' | 'down' | 'flat';
  probability?: number;
}

export interface PricePredictionResult {
  timestamp: string;
  symbol: string;
  basePrice: number;
  forecasts: ForecastPoint[];
  scenarios?: {
    optimistic: {
      targetPrice: number;
      probability: number;
      narrative: string;
    };
    base: {
      targetPrice: number;
      probability: number;
      narrative: string;
    };
    pessimistic: {
      targetPrice: number;
      probability: number;
      narrative: string;
    };
  };
  confidenceInterval?: {
    upper: number;
    lower: number;
    level: number;
  };
  trendPrediction?: {
    direction: 'bullish' | 'bearish' | 'neutral';
    probability: number;
  };
  methodology: string;
  reasoning: string;
  historicalError?: {
    meanAbsolutePercent: number;
    lastErrors: number[];
  };
}

export interface PricePredictionMetrics {
  totalPredictions: number;
  alertsTriggered: number;
  averageErrorPercent: number;
  hitRate: number;
  maxDrawdownFromPrediction: number;
  rmse?: number;
  mae?: number;
  accuracy?: number;
  forecastBias?: number;
  confidenceScore?: number;
  scenarioDistribution?: {
    bullish: number;
    neutral: number;
    bearish: number;
  };
  forecastHistory?: Array<{
    timestamp: string;
    predicted: number;
    actual: number;
    errorPercent: number;
  }>;
  recentPerformance: {
    last24h: { predictions: number; hitRate: number };
    last7d: { predictions: number; hitRate: number };
    last30d: { predictions: number; hitRate: number };
  };
}

export type ArbitrageStrategyType = 'triangular' | 'spot_vs_perp' | 'cross_exchange';
export type ArbitrageDetectionSensitivity = 'conservative' | 'balanced' | 'aggressive';

export interface ArbitrageExchangeConfig {
  id: string;
  name: string;
  markets: Array<'spot' | 'perpetual'>;
  enabled: boolean;
  tradingFeeBps: number;
  latencyMs?: number;
}

export interface ArbitrageStrategyConfig {
  type: ArbitrageStrategyType;
  enabled: boolean;
  minProfitBps: number;
  maxSlippageBps: number;
  maxExposureUSDT: number;
}

export interface ArbitrageExecutionSettings {
  autoExecute: boolean;
  preferSpeed: boolean;
  maxConcurrent: number;
  capitalPerTradeUSDT: number;
  maxDailyExecutions: number;
}

export interface ArbitrageRiskControls {
  maxLatencyMs: number;
  maxTransferMinutes: number;
  minDepthUSD: number;
  riskLimitUSDT: number;
}

export interface ArbitrageNotificationSettings {
  immediate: boolean;
  dashboardOnly: boolean;
  channels: {
    email: boolean;
    telegram: boolean;
    webhook: boolean;
  };
}

export interface ArbitrageIntegrationSettings {
  shareWithRisk: boolean;
  shareWithPortfolio?: boolean;
  forwardToArtemis: boolean;
  triggerMode?: 'auto' | 'manual';
}

export interface ArbitrageSettlementSettings {
  allowCrossExchange: boolean;
  trackWithdrawalLimits: boolean;
  maxTransfersPerDay: number;
}

export interface ArbitrageConfig {
  exchanges: ArbitrageExchangeConfig[];
  strategies: ArbitrageStrategyConfig[];
  symbols: string[];
  opportunityThresholdBps: number;
  detectionSensitivity: ArbitrageDetectionSensitivity;
  execution: ArbitrageExecutionSettings;
  riskControls: ArbitrageRiskControls;
  notifications: ArbitrageNotificationSettings;
  autoActions: {
    notifyOnOpportunity: boolean;
    simulateRoutes: boolean;
    pauseOnHighLatency: boolean;
  };
  learning: {
    enabled: boolean;
    adjustFees: boolean;
    tightenThresholds: boolean;
  };
  integrationSettings?: ArbitrageIntegrationSettings;
  settlement?: ArbitrageSettlementSettings;
}

export interface ArbitrageRouteLeg {
  market: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  exchangeId: string;
}

export interface ArbitrageOpportunity {
  id: string;
  strategy: ArbitrageStrategyType;
  path: string[];
  expectedProfitBps: number;
  expectedProfitUSDT: number;
  netProfitUSDT: number;
  netProfitBps: number;
  notionalUSDT: number;
  legs: ArbitrageRouteLeg[];
  requiredExchanges: string[];
  timestamp: string;
  confidence: number;
  riskScore: number;
  executionTimeMs: number;
  latencyMs?: number;
  feeImpactBps: number;
  transferCostUSDT: number;
  status: 'open' | 'expired' | 'simulated';
}

export interface ArbitrageExecutionRecord {
  id: string;
  opportunityId: string;
  strategy: ArbitrageStrategyType;
  profitUSDT: number;
  profitBps: number;
  status: 'executed' | 'failed' | 'simulated';
  riskScore: number;
  executionTimeMs: number;
  exchangePath: string[];
  timestamp: string;
  notes?: string;
}

export interface ArbitrageOpportunityHistoryEntry {
  id: string;
  timestamp: string;
  profitUSDT: number;
  profitBps: number;
  riskScore: number;
  executed: boolean;
  strategy: ArbitrageStrategyType;
}

export interface ArbitrageMetrics {
  totalScans: number;
  opportunitiesFound: number;
  averageProfitBps: number;
  bestProfitBps: number;
  simulatedVolumeUSDT: number;
  netProfitCapturedUSDT: number;
  avgExecutionMs: number;
  successRate: number;
  riskAlerts: number;
  opportunityFrequency24h: number;
  executionHistory: ArbitrageExecutionRecord[];
  opportunityHistory: ArbitrageOpportunityHistoryEntry[];
  recentPerformance: {
    last24h: { scans: number; opportunities: number; avgProfitBps: number; netProfitUSDT: number };
    last7d: { scans: number; opportunities: number; avgProfitBps: number; netProfitUSDT: number };
    last30d: { scans: number; opportunities: number; avgProfitBps: number; netProfitUSDT: number };
  };
}

export interface ArbitrageScanResult {
  timestamp: string;
  opportunities: ArbitrageOpportunity[];
  exchangesChecked: string[];
  symbolsChecked: string[];
  avgRiskScore: number;
  netProfitPotentialUSDT: number;
  avgExecutionMs: number;
}

export interface AllocationTarget {
  symbol: string;
  targetPercent: number;
  minPercent: number;
  maxPercent: number;
  rebalanceThreshold: number;
}

export type PortfolioGoal =
  | 'growth'
  | 'income'
  | 'capital_preservation'
  | 'diversification'
  | 'market_focus';

export type AllocationSensitivity = 'low' | 'medium' | 'high';

export interface AllocationPriorityAsset {
  symbol: string;
  priority: 'low' | 'medium' | 'high';
}

export interface PortfolioConstraint {
  id: string;
  type: 'max_asset' | 'min_liquidity' | 'stable_reserve' | 'custom';
  description: string;
  thresholdPercent: number;
  enabled: boolean;
}

export interface PortfolioAllocationConfig {
  baseCurrency: string;
  goals: PortfolioGoal[];
  targets: AllocationTarget[];
  constraints: PortfolioConstraint[];
  autoSettings: {
    enabled: boolean;
    requireConfirmation: boolean;
    rebalanceOnSignal: boolean;
  };
  monitoring: {
    sensitivity: AllocationSensitivity;
    rebalanceSignalThreshold: number;
    rebalancePeriod: 'daily' | 'weekly' | 'monthly';
  };
  liquidityFilters: {
    minDailyVolumeUSD: number;
    minMarketCapUSD: number;
    maxConcentrationPercent: number;
    enforceStableReserve: boolean;
  };
  priorityAssets?: AllocationPriorityAsset[];
  rebalance: {
    mode: 'auto' | 'manual';
    frequency: 'hourly' | 'daily' | 'weekly';
    maxTradesPerRebalance: number;
    maxSingleTradeUSDT: number;
  };
  notificationSettings: {
    onDrift: boolean;
    onConstraintBreach: boolean;
    onAutoRebalance: boolean;
    onLiquidity: boolean;
    onGoalChange?: boolean;
  };
  learning: {
    enabled: boolean;
    adjustTargets: boolean;
    adaptiveFrequency: boolean;
  };
  integrationSettings?: {
    shareWithRisk: boolean;
    shareWithTechnical: boolean;
    shareWithPrediction: boolean;
    shareWithSentiment: boolean;
    forwardToArtemis: boolean;
  };
}

export interface PortfolioAllocation {
  symbol: string;
  valueUSDT: number;
  percentage: number;
}

export interface AllocationCorrelation {
  pair: string;
  value: number;
}

export interface AllocationLiquidityAlert {
  symbol: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface AllocationRoiProjection {
  symbol: string;
  expectedRoiPercent: number;
  expectedVolatilityPercent: number;
  confidence: number;
}

export interface AllocationRebalanceSignal {
  action: 'rebalance' | 'maintain' | 'hedge';
  reason: string;
  confidence: number;
  window: string;
}

export interface RebalanceAction {
  symbol: string;
  action: 'buy' | 'sell';
  currentPercent: number;
  targetPercent: number;
  differencePercent: number;
  requiredAmountUSDT: number;
  priority: 'low' | 'medium' | 'high';
}

export interface PortfolioAllocationResult {
  timestamp: string;
  totalValueUSDT: number;
  allocations: PortfolioAllocation[];
  optimalAllocation?: PortfolioAllocation[];
  driftScore: number;
  rebalanceNeeded: boolean;
  recommendedActions: RebalanceAction[];
  riskRewardScore?: number;
  diversificationIndex?: number;
  correlationMatrix?: AllocationCorrelation[];
  liquidityAlerts?: AllocationLiquidityAlert[];
  rebalanceSignal?: AllocationRebalanceSignal;
  expectedRoi?: AllocationRoiProjection[];
  notes?: string;
}

export interface PortfolioAllocationMetrics {
  totalAnalyses: number;
  totalRebalances: number;
  autoRebalances: number;
  averageDrift: number;
  constraintsBreached: number;
  avgRiskRewardScore?: number;
  avgDiversificationIndex?: number;
  liquidityAlerts24h?: number;
  rebalanceSignalsTriggered?: number;
  correlationHotspots?: AllocationCorrelation[];
  history?: Array<{
    timestamp: string;
    totalValueUSDT: number;
    roiPercent: number;
    driftScore: number;
  }>;
  recentPerformance: {
    last24h: { analyses: number; avgDrift: number };
    last7d: { analyses: number; avgDrift: number };
    last30d: { analyses: number; avgDrift: number };
  };
}

export type LiquidityAlertSeverity = 'info' | 'warning' | 'critical';
export type LiquidityAlertType =
  | 'spread_spike'
  | 'depth_drop'
  | 'imbalance'
  | 'slippage'
  | 'flow_out'
  | 'high_liquidity'
  | 'low_liquidity';

export interface LiquidityAlertSettings {
  onSpreadWiden: boolean;
  onLiquidityDrop: boolean;
  onOrderBookImbalance: boolean;
  onHighLiquidity?: boolean;
  onLowLiquidity?: boolean;
  onFlowOut?: boolean;
  onSlippageRisk?: boolean;
  sensitivity?: 'low' | 'medium' | 'high';
  channels?: {
    dashboard: boolean;
    email: boolean;
    telegram: boolean;
  };
}

export interface LiquidityMonitoringSettings {
  imbalanceThreshold: number; // 0-1
  spreadThresholdBps: number;
  minDepthUSD: number;
  maxSlippageUSD: number;
  minVolume24hUSD?: number;
  analysisIntervalMinutes?: number;
  trackMarketImpact?: boolean;
  includeOrderBookDepth?: boolean;
  enableOnChainFlows?: boolean;
}

export interface LiquidityFilterSettings {
  targetMarkets: string[];
  preferredExchanges: string[];
  enforceDepthCheck: boolean;
  enforceSpreadCheck: boolean;
  requireMultipleMarkets: boolean;
}

export interface LiquiditySlippageControls {
  maxSlippageBps: number;
  targetOrderSizeUSD: number;
  alertOnImpactScore: boolean;
}

export interface LiquidityCapitalFlowSettings {
  enabled: boolean;
  lookbackHours: number;
  minFlowUSD: number;
  includeStablecoins: boolean;
}

export interface LiquidityIntegrationSettings {
  shareWithArtemis: boolean;
  syncWithRisk: boolean;
  syncWithAllocation: boolean;
  syncWithArbitrage: boolean;
  forwardToExecution: boolean;
}

export interface LiquidityScheduleSettings {
  mode: 'real_time' | 'periodic';
  frequencyMinutes: number;
  analysisWindow: '1m' | '5m' | '15m' | '1h' | '4h';
}

export interface LiquidityAnalysisConfig {
  symbols: string[];
  depthLevels: number[];
  monitoring: LiquidityMonitoringSettings;
  alerts: LiquidityAlertSettings;
  filters?: LiquidityFilterSettings;
  slippageControls?: LiquiditySlippageControls;
  capitalFlow?: LiquidityCapitalFlowSettings;
  integrations?: LiquidityIntegrationSettings;
  schedule?: LiquidityScheduleSettings;
  learning: {
    enabled: boolean;
    adjustThresholds: boolean;
  };
}

export interface LiquiditySnapshot {
  symbol: string;
  market?: string;
  bestBid: number;
  bestAsk: number;
  spreadBps: number;
  buyDepthUSD: number;
  sellDepthUSD: number;
  totalDepthUSD: number;
  imbalance: number;
  slippageUSD: number;
  volume24hUSD?: number;
  severe?: boolean;
}

export interface LiquidityHeatmapEntry {
  symbol: string;
  market: string;
  volume24hUSD: number;
  depthUSD: number;
  spreadBps: number;
  liquidityScore: number;
  status: 'high' | 'medium' | 'low';
}

export interface LiquiditySlippageEstimate {
  symbol: string;
  orderSizeUSD: number;
  expectedSlippageBps: number;
  slippageUSD: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface LiquidityCapitalFlowEntry {
  symbol: string;
  inflowUSD: number;
  outflowUSD: number;
  netFlowUSD: number;
  direction: 'inflow' | 'outflow' | 'neutral';
}

export interface LiquidityAlertDetail {
  id: string;
  symbol: string;
  type: LiquidityAlertType;
  severity: LiquidityAlertSeverity;
  message: string;
  value?: number;
  threshold?: number;
  timestamp: string;
}

export interface LiquidityAnalysisResult {
  timestamp: string;
  snapshots: LiquiditySnapshot[];
  averageSpreadBps: number;
  averageImbalance: number;
  liquidityRatio?: number;
  marketImpactScore?: number;
  capitalFlowScore?: number;
  slippageRiskScore?: number;
  liquidityMap?: LiquidityHeatmapEntry[];
  slippageRisks?: LiquiditySlippageEstimate[];
  capitalFlows?: LiquidityCapitalFlowEntry[];
  alerts?: LiquidityAlertDetail[];
  alertsTriggered: string[];
  notes?: string;
}

export interface LiquidityAnalysisMetrics {
  totalAnalyses: number;
  severeEvents: number;
  averageSpreadBps: number;
  averageDepthUSD: number;
  imbalanceEvents: number;
  spreadEvents: number;
  depthDrops: number;
  liquidityIndexAvg?: number;
  highLiquidityAssets?: number;
  lowLiquidityAlerts?: number;
  slippageWarnings?: number;
  capitalFlowUSD?: {
    inflow: number;
    outflow: number;
  };
  history?: Array<{
    timestamp: string;
    liquidityRatio: number;
    avgSpread: number;
    netFlowUSD: number;
  }>;
  recentPerformance: {
    last24h: { analyses: number; avgSpread: number };
    last7d: { analyses: number; avgSpread: number };
    last30d: { analyses: number; avgSpread: number };
  };
}

export type TrendDirection = 'bullish' | 'bearish' | 'sideways';

export interface TrendDetectionMethod {
  id: 'slope' | 'ema_cross' | 'adx' | 'macd' | 'parabolic_sar' | 'ma';
  enabled: boolean;
  weight: number;
  parameters?: { [key: string]: number };
}

export interface TrendDetectionConfig {
  symbols: string[];
  timeframes: Timeframe[];
  methods: TrendDetectionMethod[];
  thresholds: {
    strongStrength: number;
    weakStrength: number;
    adxStrong: number;
    slopeStrong: number;
    reversalSensitivity: number; // 0-1
    breakoutSensitivity: number; // 0-1
  };
  alerts: {
    onTrendChange: boolean;
    onStrongTrend: boolean;
    onWeakTrend: boolean;
    onTrendReversal: boolean;
    onTrendContinuation: boolean;
    onBreakout: boolean;
  };
  filters: {
    requireVolumeConfirmation: boolean;
    requireSentimentValidation: boolean;
    minVolumeMultiplier: number;
    sentimentThreshold: number; // -1 to 1
    trendTypeFilter: ('strong' | 'weak' | 'neutral')[];
  };
  learning: {
    enabled: boolean;
    adjustThresholds: boolean;
    adjustWeights: boolean;
  };
  integrationSettings?: {
    shareWithArtemis: boolean;
    syncWithTechnical: boolean;
    syncWithPattern: boolean;
    syncWithSentiment: boolean;
    forwardToExecution: boolean;
  };
  alertChannels?: {
    dashboard: boolean;
    email: boolean;
    messenger: boolean;
  };
}

export interface TrendSignalDetail {
  symbol: string;
  timeframe: Timeframe;
  direction: TrendDirection;
  strength: number;
  confidence: number;
  slope: number;
  adx?: number;
  lastPrice: number;
  duration?: number; // minutes/hours since trend started
  reversalSignal?: 'reversal' | 'continuation' | null;
  breakoutAlert?: boolean;
  volumeConfirmed?: boolean;
  sentimentValidated?: boolean;
  notes?: string;
}

export interface TrendAlertDetail {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  type: 'trend_change' | 'reversal' | 'continuation' | 'breakout' | 'strong_trend' | 'weak_trend';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  value?: number;
  threshold?: number;
}

export interface TrendMapEntry {
  symbol: string;
  timeframes: Record<Timeframe, {
    direction: TrendDirection;
    strength: number;
    confidence: number;
  }>;
  overallDirection: TrendDirection;
  overallStrength: number;
  status: 'strong' | 'moderate' | 'weak' | 'neutral';
}

export interface TrendHistoryEntry {
  timestamp: string;
  symbol: string;
  timeframe: Timeframe;
  direction: TrendDirection;
  strength: number;
  confidence: number;
  reversal?: boolean;
  continuation?: boolean;
}

export interface TrendDetectionResult {
  timestamp: string;
  signals: TrendSignalDetail[];
  summary: {
    bullish: number;
    bearish: number;
    sideways: number;
    strong: number;
  };
  alerts: string[];
  alertDetails?: TrendAlertDetail[];
  trendMap?: TrendMapEntry[];
  multiTimeframeComparison?: Record<string, Record<Timeframe, TrendDirection>>;
}

export interface TrendDetectionMetrics {
  totalAnalyses: number;
  bullishTrends: number;
  bearishTrends: number;
  sidewaysTrends: number;
  strongTrends: number;
  alertsTriggered: number;
  reversalsDetected: number;
  continuationsDetected: number;
  breakoutsDetected: number;
  averageStrength: number;
  averageConfidence: number;
  averageDuration: number; // average trend duration in minutes
  recentPerformance: {
    last24h: { analyses: number; strongTrends: number; reversals: number; breakouts: number };
    last7d: { analyses: number; strongTrends: number; reversals: number; breakouts: number };
    last30d: { analyses: number; strongTrends: number; reversals: number; breakouts: number };
  };
  history?: TrendHistoryEntry[];
}

export interface OptimizationTargetParameter {
  id: string;
  agentId: string;
  parameterKey: string;
  label: string;
  min: number;
  max: number;
  step: number;
  currentValue: number;
  weight: number;
}

export type OptimizationMetric = 'accuracy' | 'latency' | 'risk' | 'cost';

export interface OptimizationObjective {
  id: string;
  metric: OptimizationMetric;
  direction: 'maximize' | 'minimize';
  target: number;
  weight: number;
}

export interface OptimizationRecommendation {
  id: string;
  parameterId: string;
  description: string;
  proposedValue: number;
  expectedImpact: number;
  confidence: number;
  constraint?: string;
}

export interface OptimizationConfig {
  symbols: string[];
  timeframes: Timeframe[];
  targetAgents: string[];
  targetStrategies?: string[];
  parameters: OptimizationTargetParameter[];
  objectives: OptimizationObjective[];
  exploration: {
    mode: 'grid' | 'bayesian' | 'evolutionary';
    maxIterations: number;
    explorationRate: number;
  };
  constraints: {
    maxDrawdownPercent: number;
    minWinRatePercent: number;
    maxLatencyMs: number;
    timeConstraints?: {
      allowedHours?: number[];
      allowedDays?: number[];
    };
    volumeConstraints?: {
      minVolume?: number;
      maxVolume?: number;
    };
    assetConstraints?: {
      allowedAssets?: string[];
      restrictedAssets?: string[];
    };
  };
  automation: {
    autoDeploy: boolean;
    notifyOnImprovement: boolean;
    requireApproval: boolean;
    periodicOptimization?: boolean;
    optimizationIntervalHours?: number;
  };
  learning: {
    enabled: boolean;
    adjustExploration: boolean;
    adaptObjectives: boolean;
    maintainHistory?: boolean;
  };
  backtest?: {
    enabled: boolean;
    lookbackDays: number;
    metrics: ('profit' | 'sharpe' | 'drawdown' | 'winrate')[];
    minTrades: number;
  };
  integrationSettings?: {
    shareWithArtemis: boolean;
    syncWithRisk: boolean;
    syncWithPortfolio: boolean;
    syncWithExecution: boolean;
    forwardToDashboard: boolean;
  };
  alertChannels?: {
    dashboard: boolean;
    email: boolean;
    messenger: boolean;
  };
}

export interface StrategyRankingEntry {
  strategyId: string;
  strategyName: string;
  agentId: string;
  rank: number;
  performanceScore: number;
  profitScore: number;
  riskScore: number;
  efficiencyScore: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  totalTrades?: number;
  lastOptimized?: string;
}

export interface BacktestResult {
  id: string;
  strategyId: string;
  strategyName: string;
  timestamp: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  parameters: Record<string, number>;
  notes?: string;
}

export interface OptimizationLogEntry {
  id: string;
  timestamp: string;
  type: 'optimization' | 'deployment' | 'rollback' | 'suggestion_applied' | 'constraint_violation';
  status: 'success' | 'failure' | 'partial';
  description: string;
  strategyId?: string;
  agentId?: string;
  changes?: Array<{ parameterId: string; oldValue: number; newValue: number }>;
  result?: {
    fitnessScore: number;
    improvement: number;
    objectivesMet: number;
    objectivesTotal: number;
  };
  error?: string;
}

export interface CurrentVsOptimized {
  parameterId: string;
  parameterLabel: string;
  currentValue: number;
  optimizedValue: number;
  improvement: number;
  impact: number;
  confidence: number;
  applied: boolean;
}

export interface OptimizationResult {
  timestamp: string;
  mode: 'grid' | 'bayesian' | 'evolutionary';
  iterations: number;
  evaluations: number;
  fitnessScore: number;
  objectiveScores: Array<{ objectiveId: string; metric: OptimizationMetric; achieved: number; target: number; weight: number }>;
  bestParameters: Array<{ parameterId: string; value: number; improvement: number }>;
  improvements: {
    accuracy: number;
    latency: number;
    risk: number;
    cost: number;
  };
  recommendations: OptimizationRecommendation[];
  datasetSample?: {
    symbol: string;
    timeframe: Timeframe;
    volatility: number;
    trendSlope: number;
    liquidityScore: number;
  };
  currentVsOptimized?: CurrentVsOptimized[];
  strategyRankings?: StrategyRankingEntry[];
  backtestResults?: BacktestResult[];
  efficiencyIndex?: number;
  notes?: string;
}

export interface OptimizationMetrics {
  totalRuns: number;
  successfulRuns: number;
  objectiveSatisfactionRate: number;
  averageImprovement: number;
  averageFitness: number;
  bestFitness: number;
  efficiencyIndex: number;
  lastRun?: {
    timestamp: string;
    fitness: number;
    improvement: number;
  };
  recentRuns: Array<{ timestamp: string; fitness: number; improvement: number }>;
  parameterHistory: Array<{ parameterId: string; label: string; lastValue: number; trend: 'up' | 'down' | 'stable'; impact: number }>;
  optimizationLog?: OptimizationLogEntry[];
  strategyRankings?: StrategyRankingEntry[];
}

export type OrderRoute = 'spot' | 'perpetual' | 'grid' | 'twap' | 'iceberg';

export interface OrderManagementConfig {
  symbols: string[];
  baseCurrency: string;
  maxConcurrentOrders: number;
  maxNotionalPerOrder: number;
  defaultRoute: OrderRoute;
  allowedRoutes: OrderRoute[];
  execution: {
    timeoutMs: number;
    retryCount: number;
    maxSlippageBps: number;
    partialFillThreshold: number;
    autoOrderEnabled: boolean;
    requireManualApproval: boolean;
    orderSplittingEnabled: boolean;
    maxOrderSize: number;
    slippageTolerance: number;
  };
  riskLimits: {
    maxDailyVolume: number;
    maxOpenNotional: number;
    cancelOnDisconnect: boolean;
  };
  monitoring: {
    latencyAlertMs: number;
    slippageAlertBps: number;
    stuckOrderMinutes: number;
  };
  learning: {
    enabled: boolean;
    adjustSlippage: boolean;
    adjustTimeouts: boolean;
    rerouteOnFailure: boolean;
  };
  orderTypes?: {
    market: boolean;
    limit: boolean;
    stopLoss: boolean;
    stopLimit: boolean;
    ioc: boolean;
    oco: boolean;
  };
  retryPolicy?: {
    enabled: boolean;
    maxRetries: number;
    retryDelayMs: number;
    alertOnFailure: boolean;
    manualIntervention: boolean;
  };
  exchangeSettings?: {
    preferredExchanges: string[];
    priority: 'speed' | 'cost' | 'reliability';
  };
  integrationSettings?: {
    shareWithArtemis: boolean;
    syncWithSignals: boolean;
    syncWithRisk: boolean;
    syncWithLiquidity: boolean;
    syncWithAllocation: boolean;
    forwardToDashboard: boolean;
  };
  alertChannels?: {
    dashboard: boolean;
    email: boolean;
    messenger: boolean;
  };
}

export interface OrderTicket {
  ticketId: string;
  clientOrderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  route: OrderRoute;
  type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'ioc' | 'oco';
  createdAt: string;
  expiresAt?: string;
  status: 'pending' | 'open' | 'filled' | 'partial' | 'canceled' | 'failed';
  meta?: { [key: string]: any };
  allocation?: {
    totalParts: number;
    currentPart: number;
    partSize: number;
  };
}

export interface ExecutionReport {
  ticketId: string;
  exchangeOrderId?: string;
  status: 'pending' | 'filled' | 'partial' | 'canceled' | 'failed';
  filledQuantity: number;
  avgFillPrice?: number;
  slippageBps?: number;
  latencyMs?: number;
  errorCode?: string;
  completedAt?: string;
}

export interface OrderHistoryEntry {
  ticketId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  quantity: number;
  price?: number;
  executedPrice?: number;
  status: 'filled' | 'canceled' | 'failed';
  timestamp: string;
  latencyMs?: number;
  slippageBps?: number;
  fillRate?: number;
}

export interface ExecutionAnalysisDetail {
  ticketId: string;
  symbol: string;
  fillRate: number;
  latencyMs: number;
  slippageBps: number;
  executionPrice: number;
  targetPrice?: number;
  priceDifference?: number;
  orderSize: number;
  filledSize: number;
  route: OrderRoute;
  orderType: string;
  timestamp: string;
}

export interface OrderAlertDetail {
  id: string;
  type: 'order_canceled' | 'order_failed' | 'execution_error' | 'slippage_warning' | 'latency_warning' | 'stuck_order';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  ticketId?: string;
  symbol?: string;
  timestamp: string;
  action?: 'retry' | 'cancel' | 'manual_intervention';
}

export interface OrderTypeMix {
  market: number;
  limit: number;
  stop: number;
  stop_limit: number;
  ioc: number;
  oco: number;
}

export interface OrderManagementResult {
  timestamp: string;
  tickets: OrderTicket[];
  executions: ExecutionReport[];
  summary: {
    totalTickets: number;
    filled: number;
    partial: number;
    failed: number;
    avgLatencyMs: number;
    avgSlippageBps: number;
    executionSuccessRate: number;
  };
  alerts: string[];
  alertDetails?: OrderAlertDetail[];
  orderHistory?: OrderHistoryEntry[];
  executionAnalysis?: ExecutionAnalysisDetail[];
  orderTypeMix?: OrderTypeMix;
  notes?: string;
}

export interface OrderManagementMetrics {
  totalRuns: number;
  ticketsProcessed: number;
  fillRate: number;
  averageLatencyMs: number;
  averageSlippageBps: number;
  cancels: number;
  failures: number;
  rerouted: number;
  executionSuccessRate: number;
  recentPerformance: {
    last24h: { runs: number; fillRate: number; successRate: number };
    last7d: { runs: number; fillRate: number; successRate: number };
  };
  routeUsage: Array<{ route: OrderRoute; count: number }>;
  orderTypeMix?: OrderTypeMix;
  orderHistory?: OrderHistoryEntry[];
}

export interface FundamentalAnalysisConfig {
  symbols: string[];
  lookbackDays: number;
  assetTypes?: ('stock' | 'crypto' | 'mixed')[];
  analysisTimeframe?: 'short' | 'medium' | 'long';
  dataSources: {
    onchain: boolean;
    macro: boolean;
    funding: boolean;
    news: boolean;
    financial: boolean;
    events: boolean;
  };
  weights: {
    onchain: number;
    macro: number;
    funding: number;
    news: number;
    financial: number;
    events: number;
  };
  thresholds: {
    bullish: number;
    bearish: number;
    overvalued: number;
    undervalued: number;
  };
  alerts: {
    onScoreSpike: boolean;
    onMacroShock: boolean;
    onFundingAnomaly: boolean;
    onOvervalued: boolean;
    onUndervalued: boolean;
    onEventImpact: boolean;
  };
  filters?: {
    minMarketCap?: number;
    minVolume?: number;
    profitability?: boolean;
  };
  outputType?: 'alerts_only' | 'buy_sell' | 'rating';
  learning: {
    enabled: boolean;
    adjustWeights: boolean;
    adjustThresholds: boolean;
  };
  integrationSettings?: {
    shareWithArtemis: boolean;
    syncWithPricePrediction: boolean;
    syncWithPortfolio: boolean;
    syncWithRisk: boolean;
    forwardToDashboard: boolean;
  };
  alertChannels?: {
    dashboard: boolean;
    email: boolean;
    messenger: boolean;
  };
}

export interface FinancialRatio {
  name: string;
  value: number;
  benchmark?: number;
  status: 'good' | 'fair' | 'poor';
  description?: string;
}

export interface CompanyProjectData {
  symbol: string;
  name: string;
  type: 'stock' | 'crypto';
  marketCap?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  team?: {
    size?: number;
    active?: boolean;
    experience?: string;
  };
  roadmap?: {
    milestones: Array<{ name: string; date: string; status: 'completed' | 'in_progress' | 'planned' }>;
  };
  funding?: {
    totalRaised?: number;
    rounds?: Array<{ round: string; amount: number; date: string }>;
  };
  whitepaper?: {
    available: boolean;
    url?: string;
  };
}

export interface EventImpactAnalysis {
  id: string;
  symbol: string;
  eventType: 'earnings' | 'merger' | 'listing' | 'partnership' | 'regulation' | 'upgrade' | 'downgrade' | 'other';
  title: string;
  description: string;
  date: string;
  impactScore: number;
  impactDirection: 'positive' | 'negative' | 'neutral';
  affectedMetrics: string[];
  estimatedPriceImpact?: number;
}

export interface OnChainData {
  symbol: string;
  whaleDistribution: {
    top10: number;
    top100: number;
    concentration: number;
  };
  addressActivity: {
    activeAddresses: number;
    newAddresses: number;
    transactionCount: number;
  };
  tokenomics: {
    totalSupply: number;
    circulatingSupply: number;
    lockedSupply: number;
    inflationRate?: number;
    stakingRate?: number;
  };
  networkHealth: {
    hashRate?: number;
    activeNodes?: number;
    transactionVolume: number;
  };
}

export interface FairValueHistoryEntry {
  timestamp: string;
  symbol: string;
  intrinsicValue: number;
  marketPrice: number;
  fairValueRatio: number;
  valuationStatus: 'undervalued' | 'fair' | 'overvalued';
}

export interface FundamentalSignal {
  symbol: string;
  score: number;
  verdict: 'bullish' | 'bearish' | 'neutral';
  rating?: 'buy' | 'hold' | 'sell';
  intrinsicValue?: number;
  fairPrice?: number;
  valuationStatus?: 'undervalued' | 'fair' | 'overvalued';
  growthPotential?: number;
  healthIndex?: number;
  fundingRate?: number;
  macroScore?: number;
  newsScore?: number;
  onchainScore?: number;
  notes?: string;
  factors: Array<{
    name: string;
    value: number;
    weight: number;
    impact: number;
  }>;
  financialRatios?: FinancialRatio[];
}

export interface FundamentalAnalysisResult {
  timestamp: string;
  averageScore: number;
  marketSummary: {
    fearGreed: number;
    macroLabel: string;
    fundingImbalance: number;
  };
  signals: FundamentalSignal[];
  alerts: string[];
  companyProjectData?: CompanyProjectData[];
  eventImpacts?: EventImpactAnalysis[];
  onChainData?: OnChainData[];
  fairValueHistory?: FairValueHistoryEntry[];
}

export interface FundamentalAnalysisMetrics {
  totalAnalyses: number;
  averageScore: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  alertsTriggered: number;
  undervaluedDetections: number;
  overvaluedDetections: number;
  recentPerformance: {
    last24h: { analyses: number; avgScore: number };
    last7d: { analyses: number; avgScore: number };
  };
  fairValueHistory?: FairValueHistoryEntry[];
}

export type MarketIntelligenceRiskMode = 'conservative' | 'balanced' | 'aggressive';

export type MarketIntelligenceSignalPriority = 'high' | 'medium' | 'low';

export type MarketIntelligenceSignalStatus = 'active' | 'executed' | 'expired' | 'cancelled';

export interface MarketIntelligenceModelConfig {
  id: string;
  name: string;
  type: 'technical' | 'fundamental' | 'sentiment' | 'macro' | 'flow';
  description?: string;
  enabled: boolean;
  weight: number;
}

export interface MarketIntelligenceIndicatorConfig {
  id: string;
  name: string;
  enabled: boolean;
  weight: number;
  parameters: Record<string, number>;
}

export interface MarketIntelligenceFilterConfig {
  minVolumeUsd: number;
  minLiquidityScore: number;
  volatilityLookback: number;
  volatilityThreshold: number;
  includeSymbols?: string[];
  excludeSymbols?: string[];
}

export interface MarketIntelligenceAISettings {
  primaryModel: 'transformer' | 'gradient_boost' | 'hybrid';
  confidenceThreshold: number;
  retrainingHours: number;
  ensembleEnabled: boolean;
  reinforcementLearning: boolean;
}

export interface MarketIntelligenceConfig {
  symbols: string[];
  timeframes: Timeframe[];
  riskMode: MarketIntelligenceRiskMode;
  maxConcurrentSignals: number;
  dataSources?: {
    news: boolean;
    macroIndicators: boolean;
    blockTrades: boolean;
    capitalFlows: boolean;
    parallelMarkets: boolean;
    sentiment: boolean;
    premiumAPIs: boolean;
  };
  alertSensitivity?: 'low' | 'medium' | 'high';
  targetMarkets?: ('stock' | 'crypto' | 'forex' | 'commodity')[];
  dataCombinationModel?: 'traditional' | 'realtime' | 'ai_driven';
  updateRate?: 'realtime' | 'batch';
  opportunityRiskTypes?: ('macro' | 'flow' | 'correlation' | 'event' | 'technical')[];
  newsPriority?: 'high' | 'medium' | 'low';
  capitalAllocation: {
    perTradePercent: number;
    maxDailyLossPercent: number;
    maxDrawdownPercent: number;
    maxSimultaneousTrades: number;
  };
  strategy: {
    combineTechnical: boolean;
    combineFundamental: boolean;
    combineSentiment: boolean;
    models: MarketIntelligenceModelConfig[];
    indicators: MarketIntelligenceIndicatorConfig[];
  };
  filters: MarketIntelligenceFilterConfig;
  riskControls: {
    stopLossPercent: number;
    takeProfitPercent: number;
    riskRewardRatio: number;
    maxOpenPositions: number;
    confidenceThreshold: number;
  };
  automation: {
    autoExecute: boolean;
    sendToArtemis: boolean;
    syncWithRiskAgent: boolean;
    notifyOnSignal: boolean;
    notifyOnDegradation: boolean;
  };
  aiSettings: MarketIntelligenceAISettings;
  integrationSettings?: {
    shareWithArtemis: boolean;
    syncWithTechnical: boolean;
    syncWithFundamental: boolean;
    syncWithSentiment: boolean;
    syncWithPortfolio: boolean;
    syncWithRisk: boolean;
    forwardToDashboard: boolean;
  };
  alertChannels?: {
    dashboard: boolean;
    email: boolean;
    messenger: boolean;
  };
}

export interface MarketIntelligenceSignal {
  id: string;
  symbol: string;
  direction: 'buy' | 'sell';
  timeframe: Timeframe;
  priority: MarketIntelligenceSignalPriority;
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  latencyMs: number;
  issuedAt: string;
  expiresAt?: string;
  status: MarketIntelligenceSignalStatus;
  roi?: number;
  reason?: string;
  tags?: string[];
  filtersPassed?: string[];
  indicators?: Array<{ id: string; value: number; signal: 'buy' | 'sell' | 'neutral'; weight: number }>;
}

export interface MarketOverview {
  overallStatus: 'bullish' | 'bearish' | 'neutral';
  marketScore: number;
  trendDirection: 'up' | 'down' | 'sideways';
  volatilityLevel: 'low' | 'medium' | 'high';
  opportunities: number;
  risks: number;
  keyIndicators: Array<{ name: string; value: number; status: 'positive' | 'negative' | 'neutral' }>;
}

export interface MacroTrendSignal {
  id: string;
  market: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  timeframe: string;
  relatedMarkets: string[];
  description?: string;
}

export interface FlowActivityData {
  symbol: string;
  capitalInflow: number;
  capitalOutflow: number;
  netFlow: number;
  whaleTransactions: number;
  institutionalActivity: number;
  blockTrades: number;
  timestamp: string;
}

export interface OpportunityRiskAlert {
  id: string;
  type: 'opportunity' | 'risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'macro' | 'flow' | 'correlation' | 'event' | 'technical';
  title: string;
  description: string;
  affectedMarkets: string[];
  timestamp: string;
  expiry?: string;
  action?: string;
}

export interface MarketEventImpactAnalysis {
  id: string;
  eventType: 'economic' | 'political' | 'regulatory' | 'corporate' | 'crypto' | 'other';
  title: string;
  description: string;
  date: string;
  affectedMarkets: string[];
  impactScore: number;
  impactDirection: 'positive' | 'negative' | 'neutral';
  estimatedDuration: string;
}

export interface CorrelationMatrixEntry {
  asset1: string;
  asset2: string;
  correlation: number;
  timeframe: string;
  significance: 'high' | 'medium' | 'low';
}

export interface HeatmapRanking {
  asset: string;
  category: string;
  score: number;
  rank: number;
  change: number;
  indicators: Array<{ name: string; value: number }>;
}

export interface MarketIntelligenceResult {
  timestamp: string;
  lookbackWindow: string;
  marketsScanned: number;
  datasetsUsed: string[];
  summary: {
    roiPercent: number;
    netProfitUsd: number;
    winLossRatio: number;
    maxDrawdownPercent: number;
    signalAccuracy: number;
    avgLatencyMs: number;
    riskReward: number;
    predictionSuccess: number;
  };
  signals: MarketIntelligenceSignal[];
  analytics: {
    timeframeBreakdown: Array<{ timeframe: Timeframe; signals: number; accuracy: number }>;
    benchmarkComparison: { benchmarkRoi: number; agentRoi: number };
    correlationHeatmap: Array<{ pair: string; correlation: number }>;
    riskExposure: { exposurePercent: number; capitalDeployedPercent: number; alerts: string[] };
  };
  riskAlerts: string[];
  marketOverview?: MarketOverview;
  macroTrendSignals?: MacroTrendSignal[];
  flowActivity?: FlowActivityData[];
  opportunityRiskAlerts?: OpportunityRiskAlert[];
  eventImpacts?: MarketEventImpactAnalysis[];
  correlationMatrix?: CorrelationMatrixEntry[];
  heatmapRanking?: HeatmapRanking[];
  notes?: string;
}

export interface MarketIntelligenceMetrics {
  totalRuns: number;
  totalSignals: number;
  activeSignals: number;
  executedSignals: number;
  roiPercent: number;
  netProfitUsd: number;
  winLossRatio: number;
  maxDrawdownPercent: number;
  signalAccuracy: number;
  avgLatencyMs: number;
  avgRiskReward: number;
  predictionSuccess: number;
  periodPerformance: {
    today: { signals: number; roi: number };
    week: { signals: number; roi: number };
    month: { signals: number; roi: number };
  };
  distribution: {
    bySymbol: Array<{ symbol: string; count: number; accuracy: number }>;
    byDirection: { buy: number; sell: number };
  };
  riskStatus: {
    exposurePercent: number;
    openCapitalPercent: number;
    alerts: number;
  };
}

export type VolumeProfileScope = 'session' | 'day' | 'week' | 'month';

export type VolumeAlertType = 'unusual_volume' | 'breakout' | 'smart_money' | 'imbalance';

export type VolumeAlertSeverity = 'info' | 'warning' | 'critical';

export interface VolumeProfileNode {
  price: number;
  volume: number;
  type: 'hvn' | 'lvn' | 'neutral';
}

export interface VolumeIndicatorSnapshot {
  obv: number;
  vwap: number;
  mfi: number;
  cmf: number;
  vpt: number;
  pvi: number;
  nvi: number;
}

export interface VolumeSignal {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  signalType: 'breakout' | 'divergence' | 'climax' | 'accumulation' | 'distribution';
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  relativeVolume: number;
  volumeStrength: number;
  buySellRatio: number;
  notes?: string;
}

export interface VolumeAlert {
  id: string;
  symbol: string;
  alertType: VolumeAlertType;
  severity: VolumeAlertSeverity;
  message: string;
  timestamp: string;
}

export interface VolumeAnalysisConfig {
  symbols: string[];
  timeframes: Timeframe[];
  profile: {
    rows: number;
    scope: VolumeProfileScope;
    valueAreaPercent: number;
    hvnSensitivity: number;
    lvnSensitivity: number;
    compareWithPrevious: boolean;
  };
  indicators: {
    obv: { smoothingPeriod: number; enableSma: boolean };
    vwap: { mode: 'session' | 'rolling'; rollingPeriods: number };
    mfi: { period: number; overbought: number; oversold: number };
    cmf: { period: number };
    vpt: { enabled: boolean };
    pvi: { enabled: boolean };
    nvi: { enabled: boolean };
  };
  filters: {
    minRelativeVolume: number;
    minDailyVolumeUsd: number;
    volumeSpikeThresholdPercent: number;
    minBuySellRatio: number;
    lookbackBars: number;
  };
  alerts: {
    unusualVolume: boolean;
    breakoutConfirmation: boolean;
    smartMoneyFlow: boolean;
    buySellImbalance: boolean;
    sensitivity: 'low' | 'medium' | 'high';
    channels: {
      telegram: boolean;
      email: boolean;
      dashboard: boolean;
    };
    watchlist: string[];
  };
  integration: {
    weightPercent: number;
    priority: 'low' | 'medium' | 'high';
    combinationMode: 'and' | 'or' | 'weighted';
    forwardSignalsTo: string[];
  };
  automation: {
    autoRun: boolean;
    intervalMinutes: number;
    syncWithArtemis: boolean;
  };
}

export interface VolumeAnalysisResult {
  timestamp: string;
  summary: {
    totalVolumeUsd: number;
    averageRelativeVolume: number;
    volumeStrengthScore: number;
    pocPrice: number;
    vah: number;
    val: number;
  };
  unusualVolume: Array<{
    symbol: string;
    relativeVolume: number;
    volumeUsd: number;
    changePercent: number;
  }>;
  profile: {
    symbol: string;
    poc: number;
    vah: number;
    val: number;
    hvnLevels: VolumeProfileNode[];
    lvnLevels: VolumeProfileNode[];
    histogram: Array<{ price: number; volume: number }>;
  }[];
  indicators: Record<string, VolumeIndicatorSnapshot>;
  signals: VolumeSignal[];
  multiTimeframe: Array<{
    symbol: string;
    timeframe: Timeframe;
    relativeVolume: number;
    agreementScore: number;
    trend: 'rising' | 'falling' | 'flat';
  }>;
  alerts: VolumeAlert[];
  vsa?: VolumeSpreadAnalysis[];
  accumulationDistribution?: AccumulationDistributionSignal[];
  analytics?: VolumeAnalytics;
}

export interface VolumeSpreadAnalysis {
  symbol: string;
  timeframe: Timeframe;
  spread: number;
  volume: number;
  vsaSignal: 'accumulation' | 'distribution' | 'noDemand' | 'noSupply' | 'climax' | 'neutral';
  confidence: number;
  timestamp: string;
}

export interface AccumulationDistributionSignal {
  symbol: string;
  timeframe: Timeframe;
  signalType: 'accumulation' | 'distribution';
  strength: number;
  volumeConfirmation: boolean;
  priceAction: 'rising' | 'falling' | 'sideways';
  confidence: number;
  timestamp: string;
}

export interface VolumeAnalytics {
  valueAreaAnalysis: Array<{
    symbol: string;
    poc: number;
    vah: number;
    val: number;
    valueAreaVolume: number;
    totalVolume: number;
    valueAreaPercent: number;
  }>;
  hvnLvnAnalysis: Array<{
    symbol: string;
    hvnCount: number;
    lvnCount: number;
    strongestHVN: { price: number; volume: number } | null;
    strongestLVN: { price: number; volume: number } | null;
  }>;
  multiTimeframeBreakdown: Array<{
    symbol: string;
    timeframes: Array<{
      timeframe: Timeframe;
      relativeVolume: number;
      trend: 'rising' | 'falling' | 'flat';
      agreementScore: number;
    }>;
    overallAgreement: number;
  }>;
}

export interface VolumeAnalysisMetrics {
  totalRuns: number;
  avgRelativeVolume: number;
  volumeStrengthScore: number;
  pocReliability: number;
  hvnDetected: number;
  lvnDetected: number;
  alertsTriggered: number;
  unusualAssets: number;
  timeframeBreakdown: Array<{ timeframe: Timeframe; avgRvol: number; signals: number }>;
  indicatorScores: {
    obvTrend: number;
    mfiScore: number;
    cmfScore: number;
    vwapDistance: number;
  };
  recentPerformance: {
    last24h: { runs: number; avgScore: number };
    last7d: { runs: number; avgScore: number };
  };
}

export type TimingIndicatorMix = 'ma_rsi' | 'macd_bb' | 'hybrid';

export type TimingSignalType = 'entry' | 'exit';

export type TimingSignalStatus = 'active' | 'triggered' | 'expired';

export interface TimingIndicatorSettings {
  movingAverages: { fast: number; slow: number };
  rsi: { period: number; overbought: number; oversold: number };
  macd: { fast: number; slow: number; signal: number };
  bollinger: { period: number; stdDev: number };
  atr: { period: number; multiplier: number };
}

export interface TimingAlertSettings {
  entryAlerts: boolean;
  exitAlerts: boolean;
  volatilityAlerts: boolean;
  sensitivity: 'low' | 'medium' | 'high';
  channels: {
    dashboard: boolean;
    email: boolean;
    telegram: boolean;
  };
}

export interface TimingAutomationSettings {
  autoExecute: boolean;
  requireConfirmation: boolean;
  syncWithVolumeAgent: boolean;
  schedule: 'immediate' | 'on_close' | 'time_based';
  confirmationCandles: number;
}

export interface TimingAnalysisConfig {
  symbols: string[];
  timeframes: Timeframe[];
  indicatorMix: TimingIndicatorMix;
  confirmationScore: number;
  holdTimeMinutes: number;
  maxSlippageBps: number;
  indicators: TimingIndicatorSettings;
  automation: TimingAutomationSettings;
  alerts: TimingAlertSettings;
}

export interface TimingIndicatorSnapshot {
  fastMA: number;
  slowMA: number;
  maTrend: 'bullish' | 'bearish' | 'neutral';
  rsi: number;
  macd: number;
  macdSignal: number;
  bbUpper: number;
  bbLower: number;
  atr: number;
}

export interface TimingSignal {
  id: string;
  symbol: string;
  signalType: TimingSignalType;
  timeframe: Timeframe;
  price: number;
  confidence: number;
  confirmationScore: number;
  holdMinutes: number;
  recommendedExit?: number;
  status: TimingSignalStatus;
  slippageBps?: number;
  notes?: string;
}

export interface TimingAlert {
  id: string;
  symbol: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
}

export interface TimingMultiTimeframeSnapshot {
  symbol: string;
  timeframe: Timeframe;
  trend: 'bullish' | 'bearish' | 'neutral';
  confirmation: number;
  relativeVolume: number;
}

export interface TimingAnalysisResult {
  timestamp: string;
  activeCountdowns: Array<{
    symbol: string;
    signalType: TimingSignalType;
    expiresAt: string;
    remainingSeconds: number;
  }>;
  timeline: Array<{ timestamp: string; entrySignals: number; exitSignals: number }>;
  signals: TimingSignal[];
  performance: {
    entryAccuracy: number;
    exitAccuracy: number;
    avgHoldMinutes: number;
    missedOpportunityRate: number;
    avgSlippageBps: number;
    tradeDurationDistribution: Array<{ label: string; count: number }>;
  };
  indicators: Record<string, TimingIndicatorSnapshot>;
  multiTimeframe: TimingMultiTimeframeSnapshot[];
  alerts: TimingAlert[];
}

export interface TimingAnalysisMetrics {
  totalRuns: number;
  entryAccuracy: number;
  exitAccuracy: number;
  avgHoldMinutes: number;
  missedOpportunityRate: number;
  avgSlippageBps: number;
  signalsGenerated: number;
  activeCountdowns: number;
  timeframeStats: Array<{ timeframe: Timeframe; entryAccuracy: number; exitAccuracy: number }>;
  recentPerformance: {
    last24h: { runs: number; entryAccuracy: number; exitAccuracy: number };
    last7d: { runs: number; entryAccuracy: number; exitAccuracy: number };
  };
}

// Artemis Control Interface (Legacy - kept for backward compatibility)
// New enhanced version is defined above

// Duplicate removed - RiskManagementConfig and RiskRule are defined above

export interface RiskCondition {
  type: 'portfolio_value' | 'daily_pnl' | 'drawdown' | 'position_size' | 'leverage' | 'correlation' | 'volatility';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  timeframe?: '1h' | '4h' | '1d' | '1w';
}

export interface RiskAction {
  type: 'reduce_position' | 'close_position' | 'stop_trading' | 'adjust_leverage' | 'alert' | 'auto_hedge';
  parameters: { [key: string]: number | string | boolean };
}

export interface RiskAdjustment {
  timestamp: string;
  ruleId: string;
  previousValue: number;
  newValue: number;
  reason: string;
  outcome: 'success' | 'failure' | 'pending';
  confidence: number;
}

export interface AdvancedRiskAssessment {
  timestamp: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  portfolioRisk: {
    totalExposure: number;
    leverageUsed: number;
    diversificationScore: number;
    correlationRisk: number;
  };
  positionRisks: PositionRisk[];
  recommendations: RiskRecommendation[];
  predictedOutcome?: {
    probability: number;
    expectedLoss: number;
    expectedGain: number;
    confidence: number;
  };
  learningInsights?: {
    similarPastSituations: number;
    successRate: number;
    suggestedAdjustments: string[];
  };
}

export interface PositionRisk {
  positionId: string;
  symbol: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  currentExposure: number;
  stopLossDistance: number;
  volatility: number;
  correlationWithPortfolio: number;
}

export interface RiskRecommendation {
  type: 'reduce' | 'close' | 'hedge' | 'adjust' | 'monitor';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  expectedImpact: number; // Expected improvement in risk score
  confidence: number;
}

// Artemis Central AI Controller
export interface ArtemisState {
  id: string;
  status: 'active' | 'standby' | 'maintenance' | 'error';
  mode: 'demo' | 'real';
  lastDecisionTime: string;
  totalDecisions: number;
  successRate: number;
  systemHealth: SystemHealth;
  activeAgents: string[];
  decisionEngine: DecisionEngineState;
  learningSystem: LearningSystemState;
  orchestration: OrchestrationState;
  dataHub?: DataHubState;
  config?: ArtemisConfig;
  logs?: ArtemisLog[];
}

export interface ArtemisConfig {
  decisionEngine: {
    strategy: 'voting' | 'weighted' | 'mixture_of_experts' | 'consensus';
    activeModel: 'internal' | 'claude' | 'gemini' | 'openai' | 'deepseek' | 'hybrid';
    confidenceThreshold: number;
    autoExecution: boolean;
    requireApproval: boolean;
    maxConcurrentTrades: number;
  };
  learning: {
    activeLearning: boolean;
    autoRetrain: boolean;
    retrainInterval: number; // hours
    minAccuracyForRetrain: number;
    backtestBeforeRetrain: boolean;
  };
  monitoring: {
    healthCheckInterval: number; // minutes
    alertOnError: boolean;
    alertChannels: {
      dashboard: boolean;
      telegram: boolean;
      email: boolean;
    };
  };
  security: {
    requireMFA: boolean;
    logAllCommands: boolean;
    encryptSensitiveData: boolean;
    sessionTimeout: number; // minutes
  };
  integration: {
    mexc: {
      enabled: boolean;
      apiKey?: string;
      apiSecret?: string;
      testnet: boolean;
    };
    telegram: {
      enabled: boolean;
      botToken?: string;
      channels: string[];
    };
  };
  ui: {
    language: 'en' | 'fa';
    theme: 'dark' | 'light';
    widgets: string[];
  };
}

export interface ArtemisLog {
  id: string;
  timestamp: string;
  type: 'command' | 'decision' | 'trade' | 'error' | 'system' | 'config_change';
  level: 'info' | 'warning' | 'error' | 'critical';
  source: string; // user, agent, system
  action: string;
  details: any;
  userId?: string;
  agentId?: string;
  result?: 'success' | 'failed' | 'pending';
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  agents: AgentHealth[];
  integrations: IntegrationHealth[];
  resources: ResourceHealth;
  alerts: SystemAlert[];
}

export interface AgentHealth {
  agentId: string;
  status: 'active' | 'inactive' | 'error' | 'training';
  lastUpdate: string;
  performance: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    apiCalls: number;
  };
  errors: string[];
  uptime: number;
}

export interface IntegrationHealth {
  type: 'exchange' | 'ai_provider' | 'news' | 'telegram';
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  lastCheck: string;
  latency?: number;
  errorRate?: number;
}

export interface ResourceHealth {
  cpu: number;
  memory: number;
  network: number;
  storage: number;
  apiQuota: {
    used: number;
    limit: number;
    resetAt: string;
  };
}

export interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'critical';
  message: string;
  timestamp: string;
  source: string;
  resolved: boolean;
}

export interface DecisionEngineState {
  strategy: 'voting' | 'weighted' | 'mixture_of_experts' | 'consensus';
  activeModel: 'internal' | 'claude' | 'gemini' | 'openai' | 'deepseek' | 'hybrid';
  confidenceThreshold: number;
  recentDecisions: Decision[];
  performance: {
    accuracy: number;
    avgConfidence: number;
    avgExecutionTime: number;
  };
  macroTrendSignals?: MacroTrendSignal[];
  flowActivity?: FlowActivityData[];
}

export interface Decision {
  id: string;
  timestamp: string;
  type: 'trade' | 'risk_management' | 'portfolio_adjustment' | 'agent_control';
  input: {
    signals: AgentSignal[];
    marketData: any;
    portfolioState: any;
  };
  process: {
    method: string;
    modelsUsed: string[];
    reasoning: string;
  };
  output: {
    action: string;
    confidence: number;
    parameters: { [key: string]: any };
  };
  execution: {
    status: 'pending' | 'executed' | 'failed' | 'cancelled';
    result?: any;
    actualOutcome?: any;
    error?: string;
  };
  learning: {
    predictedOutcome: any;
    actualOutcome?: any;
    accuracy?: number;
    learned: boolean;
  };
}

export interface AgentSignal {
  agentId: string;
  agentName: string;
  signalType: string;
  confidence: number;
  data: any;
  timestamp: string;
}

export interface LearningSystemState {
  totalDecisions: number;
  totalTrades: number;
  accuracyHistory: Array<{ date: string; accuracy: number }>;
  improvements: Improvement[];
  mistakes: Mistake[];
  activeLearning: boolean;
  lastTraining: string;
  modelVersions: ModelVersion[];
}

export interface Improvement {
  id: string;
  timestamp: string;
  area: string;
  before: number;
  after: number;
  improvement: number;
  method: string;
}

export interface Mistake {
  id: string;
  timestamp: string;
  decisionId: string;
  type: string;
  prediction: any;
  actual: any;
  error: number;
  learned: boolean;
  correction: string;
}

export interface ModelVersion {
  version: string;
  trainedAt: string;
  accuracy: number;
  performance: number;
  active: boolean;
}

export interface OrchestrationState {
  activeAgents: number;
  agentTasks: AgentTask[];
  resourceAllocation: { [agentId: string]: ResourceAllocation };
  failoverStatus: FailoverStatus;
}

export interface AgentTask {
  agentId: string;
  task: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'running' | 'completed' | 'failed';
  assignedAt: string;
  completedAt?: string;
}

export interface ResourceAllocation {
  cpu: number;
  memory: number;
  priority: number;
  maxConcurrentTasks: number;
}

export interface FailoverStatus {
  enabled: boolean;
  fallbackAgents: { [agentId: string]: string[] };
  lastFailover?: {
    timestamp: string;
    fromAgent: string;
    toAgent: string;
    reason: string;
  };
}

// Artemis Command (Enhanced)
export interface ArtemisCommand {
  commandId: string;
  timestamp: string;
  fromAgent?: string;
  targetAgentId: string | 'all';
  commandType: 'update_config' | 'run_analysis' | 'adjust_parameters' | 'learn_from_mistake' | 'request_data' | 'execute_trade' | 'manage_agent' | 'system_control';
  parameters: { [key: string]: any };
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  learningNote?: string;
}

// Artemis Data Hub
export interface DataHubState {
  id: string;
  status: 'active' | 'standby' | 'maintenance' | 'error';
  totalSources: number;
  activeSources: number;
  totalDataPoints: number;
  lastUpdateTime: string;
  sources: DataSource[];
  categories: DataCategory[];
  accessLogs: DataAccessLog[];
  health: DataHubHealth;
  cache: DataCacheStats;
  advanced?: DataHubAdvancedFeatures;
  telegramCollector?: TelegramCollectorState;
  pipelineSnapshot?: DataPipelineSnapshot;
  pipelineHistory?: DataPipelineHistoryEntry[];
  normalizedData?: NormalizedDataRecord[];
  normalizationSummary?: DataNormalizationSummary;
}

export type TelegramCollectorChannelStatus = 'idle' | 'syncing' | 'error' | 'paused';

export interface TelegramCollectorChannel {
  id: string;
  title: string;
  handle: string;
  status: TelegramCollectorChannelStatus;
  enabled: boolean;
  usingCollector: boolean;
  sourceId?: string;
  category?: string;
  lastSyncAt?: string;
  lastMessageAt?: string;
  messageCount24h?: number;
  fetchLatencyMs?: number;
  lastError?: string;
  lastTestAt?: string;
  lastTestStatus?: 'success' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface TelegramCollectorState {
  status: 'unknown' | 'online' | 'offline' | 'login_required';
  sessionUser?: string;
  lastLoginAt?: string;
  lastRefreshAt?: string;
  channels: TelegramCollectorChannel[];
  healthSummary?: TelegramCollectorHealthSummary;
}

export interface TelegramCollectorHealthSummary {
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  channelsTracked: number;
  channelsWithErrors: number;
  avgLatencyMs?: number;
  uptimeMs?: number;
  lastRefreshAt?: string;
  lastError?: string;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'api' | 'webhook' | 'rss' | 'web' | 'telegram' | 'website' | 'aggregator' | 'third_party';
  url?: string;
  endpoint?: string;
  category: string;
  tags: string[];
  status: 'active' | 'inactive' | 'error' | 'testing' | 'linked' | 'pending';
  /** When 'na', Success Rate shows N/A (collector ingestion, not bot-pull). */
  successRateDisplay?: 'na';
  telegramIngestionMode?: 'collector' | 'bot';
  priority: 'low' | 'medium' | 'high' | 'critical';
  updateInterval: 'realtime' | '1min' | '5min' | '15min' | '30min' | '1hour' | 'daily';
  lastUpdate?: string;
  lastSuccess?: string;
  lastError?: string;
  errorCount: number;
  successRate: number;
  reliabilityScore: number;
  responseTime?: number;
  credentials?: {
    apiKey?: string;
    secret?: string;
    token?: string;
    username?: string;
    password?: string;
  };
  config?: {
    headers?: Record<string, string>;
    params?: Record<string, string>;
    timeout?: number;
    retryCount?: number;
    format?: 'json' | 'xml' | 'rss' | 'html' | 'csv';
    maxDepth?: number;
    selector?: string;
    delay?: number;
    renderJS?: boolean;
  };
  metadata?: {
    description?: string;
    provider?: string;
    rateLimit?: string;
    dataFormat?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DataCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  tags: string[];
  sourceCount: number;
  dataTypes: string[];
  createdAt: string;
}

export interface DataAccessLog {
  id: string;
  timestamp: string;
  agentId: string;
  sourceId: string;
  dataType: string;
  status: 'success' | 'failed' | 'cached' | 'timeout';
  responseTime?: number;
  error?: string;
  dataSize?: number;
}

export interface DataHubHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  activeConnections: number;
  failedConnections: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errors: DataHubError[];
  lastHealthCheck: string;
}

export interface DataHubError {
  id: string;
  timestamp: string;
  sourceId: string;
  sourceName: string;
  errorType: 'connection' | 'timeout' | 'authentication' | 'parse' | 'rate_limit' | 'unknown';
  message: string;
  resolved: boolean;
}

export interface SystemError {
  id: string;
  context?: string;
  message: string;
  stack?: string;
  meta?: Record<string, any>;
  timestamp: string;
}

export interface DataCacheEntry {
  data: any;
  timestamp: number;
}

export interface DataCacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalSize: number;
  oldestEntry: string;
  newestEntry: string;
  evictionCount: number;
  data: Record<string, DataCacheEntry>;
}

export interface DataPipelineSourceSnapshot {
  sourceId: string;
  name: string;
  category: string;
  lastDataType: string;
  lastStatus: DataAccessLog['status'];
  operationalStatus?: 'active' | 'linked' | 'pending' | 'error';
  lastResponseTime?: number;
  lastChecked?: string;
  issues?: string[];
}

export interface DataPipelineCategorySnapshot {
  categoryId: string;
  name: string;
  inflow: number;
  passRate: number;
}

export interface DataPipelineSnapshot {
  lastRefreshed: string;
  totalRequests24h: number;
  passed24h: number;
  failed24h: number;
  pending24h: number;
  totalRecords: number;
  normalizedPercent: number;
  sources: DataPipelineSourceSnapshot[];
  categories: DataPipelineCategorySnapshot[];
}

export interface DataPipelineHistoryEntry {
  id: string;
  generatedAt: string;
  snapshot: DataPipelineSnapshot;
}

export type NormalizedDataStatus =
  | 'ready'
  | 'warning'
  | 'rejected'
  | 'pending_normalization'
  | 'ingested';

export interface NormalizedDataRecord {
  id: string;
  sourceId: string;
  sourceName?: string;
  category: string;
  dataType: string;
  tags: string[];
  payload: {
    title?: string;
    content?: string;
    value?: number;
    metadata?: Record<string, any>;
  };
  qualityScore?: number;
  qualityPending?: boolean;
  issues: string[];
  status: NormalizedDataStatus;
  receivedAt: string;
  normalizedAt: string;
}

export interface DataNormalizationSummary {
  totalProcessed: number;
  passed: number;
  warnings: number;
  rejected: number;
  lastProcessedAt?: string;
}

export interface DataRequest {
  agentId: string;
  dataType: string;
  category?: string;
  tags?: string[];
  sourceId?: string;
  format?: 'json' | 'raw';
  cache?: boolean;
  priority?: 'low' | 'medium' | 'high';
}

export interface DataResponse {
  success: boolean;
  data?: any;
  sourceId: string;
  timestamp: string;
  cached: boolean;
  error?: string;
}

// Advanced Data Hub Features
export interface WebCrawlerConfig {
  id: string;
  sourceId: string;
  url: string;
  selectors: {
    title?: string;
    content?: string;
    price?: string;
    volume?: string;
    date?: string;
  };
  interval: 'realtime' | '1min' | '5min' | '15min' | '30min' | '1hour' | 'daily';
  enabled: boolean;
  lastCrawl?: string;
  lastSuccess?: string;
  errorCount: number;
}

export interface AutoDiscoveryRule {
  id: string;
  name: string;
  pattern: string; // URL pattern or API endpoint pattern
  type: 'api' | 'rss' | 'website';
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  lastCheck?: string;
  discoveredCount: number;
}

export interface SourcePriorityRule {
  sourceId: string;
  basePriority: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    reliabilityWeight: number; // 0-1
    responseTimeWeight: number; // 0-1
    successRateWeight: number; // 0-1
    dataQualityWeight: number; // 0-1
  };
  calculatedPriority: number; // 0-100
  lastCalculated: string;
}

export interface SourceAccessControl {
  sourceId: string;
  allowedAgents: string[]; // Empty = all agents
  blockedAgents: string[];
  allowedDataTypes: string[]; // Empty = all types
  blockedDataTypes: string[];
  requireAuth: boolean;
  maxRequestsPerMinute?: number;
  maxRequestsPerDay?: number;
  rateLimitWindow: number; // seconds
}

export interface DataArchive {
  id: string;
  sourceId: string;
  dataType: string;
  timestamp: string;
  data: any;
  metadata: {
    agentId?: string;
    requestId?: string;
    size: number;
    format: string;
  };
  archivedAt: string;
  usedForBacktest: boolean;
}

export interface TelegramPublisher {
  id: string;
  name: string;
  botToken: string;
  chatId: string;
  enabled: boolean;
  filters: {
    sources?: string[];
    categories?: string[];
    dataTypes?: string[];
    priority?: 'low' | 'medium' | 'high' | 'critical';
    agentIds?: string[];
  };
  template: string; // Message template
  lastSent?: string;
  sentCount: number;
}

export interface AgentTopicRouteStats {
  last24h: {
    inflow: number;
    approved: number;
    published: number;
    passRate: number;
  };
  totalPublished?: number;
}

export interface AgentTopicRoute {
  id: string;
  agentId: string;
  agentName?: string;
  title: string;
  description?: string;
  categoryIds: string[];
  dataTypes: string[];
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  minPassRate?: number;
  minQualityScore?: number;
  includeStatuses: NormalizedDataStatus[];
  publisherTargets: string[];
  enabled: boolean;
  lastEvaluated?: string;
  lastPublishedAt?: string;
  stats?: AgentTopicRouteStats;
}

export interface AutomationScheduleConfig {
  enabled: boolean;
  intervalMinutes: number; // 1, 5, 15, 30, 60, 120, 240
  lastRun?: string;
  nextRun?: string;
  maxItemsPerRun: number; // 1-50
}

export interface DataAutomationConfig {
  lastSync?: string;
  agentTopics: AgentTopicRoute[];
  schedule?: AutomationScheduleConfig;
}

export type PublisherQueueStatus = 'pending' | 'processing';

export interface PublisherQueueItem {
  id: string;
  recordId: string;
  topicId: string;
  publisherId: string;
  agentId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: PublisherQueueStatus;
  createdAt: string;
  scheduledAt?: string;
  payloadPreview: string;
  category: string;
  dataType: string;
  qualityScore: number;
  normalizedStatus: NormalizedDataStatus;
}

export type PublisherHistoryStatus = 'sent' | 'failed';

export interface PublisherHistoryItem {
  id: string;
  queueId: string;
  recordId: string;
  topicId: string;
  publisherId: string;
  agentId: string;
  status: PublisherHistoryStatus;
  sentAt: string;
  latencyMs?: number;
  payloadPreview: string;
}

export interface DataHubAdvancedFeatures {
  webCrawlers: WebCrawlerConfig[];
  autoDiscovery: {
    enabled: boolean;
    rules: AutoDiscoveryRule[];
    lastScan?: string;
    discoveredSources: DataSource[];
  };
  smartPrioritization: {
    enabled: boolean;
    rules: SourcePriorityRule[];
    lastUpdate?: string;
  };
  accessControl: SourceAccessControl[];
  blacklist: {
    sources: string[];
    patterns: string[];
    reasons: Record<string, string>;
  };
  whitelist: {
    sources: string[];
    patterns: string[];
  };
  archives: DataArchive[];
  telegramPublishers: TelegramPublisher[];
  automation?: DataAutomationConfig;
  publisherQueue: PublisherQueueItem[];
  publisherHistory: PublisherHistoryItem[];
}

export interface DetectedSourceType {
  type: DataSource['type'];
  confidence: number;
  reason: string;
  normalizedUrl: string;
  indicators: string[];
  contentType?: string;
  meta?: Record<string, any>;
}

export interface DetectedSourceRecord extends DetectedSourceType {
  id: string;
  originalUrl: string;
  detectedAt: string;
  attempts?: string[];
}

// Trading Scenario
export interface TradingScenario {
  id: string;
  name: string;
  type: 'target_profit' | 'max_trades' | 'risk_reward' | 'custom';
  target: {
    profit?: number;
    maxTrades?: number;
    riskRewardRatio?: number;
    customRules?: { [key: string]: any };
  };
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  progress: {
    current: number;
    target: number;
    percentage: number;
  };
  trades: ScenarioTrade[];
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioTrade {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  executedAt: string;
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  profit?: number;
  scenarioId?: string;
}

export interface AIProvider {
  id: 'google' | 'anthropic' | 'openai' | 'deepseek';
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
  artemis?: ArtemisState;
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
  config?: AITrainingConfig;
}

export interface AITrainingConfig {
  autoTraining: {
    enabled: boolean;
    minAccuracyThreshold: number; // Trigger training if accuracy drops below this
    scheduleInterval: number; // hours
    priorityAgents: string[]; // Agent IDs that should be trained more frequently
  };
  trainingPolicies: {
    individualTraining: {
      enabled: boolean;
      minAccuracyForTraining: number;
      maxSessionsPerDay: number;
      preferredTimeSlots: string[]; // e.g., ['00:00-06:00']
    };
    collectiveTraining: {
      enabled: boolean;
      minAgentsForCollective: number;
      maxSessionsPerWeek: number;
      requireMinimumAccuracy: number;
    };
    crossTraining: {
      enabled: boolean;
      agentPairs: Array<{ agent1: string; agent2: string; priority: number }>;
      maxSessionsPerWeek: number;
    };
  };
  resourceManagement: {
    maxConcurrentSessions: number;
    maxQueueSize: number;
    priorityQueue: boolean;
    resourceAllocation: {
      cpuLimit: number; // percentage
      memoryLimit: number; // percentage
      gpuEnabled: boolean;
    };
  };
  qualityControl: {
    minAccuracyGain: number; // Minimum accuracy gain to consider training successful
    requireBacktest: boolean;
    backtestAccuracyThreshold: number;
    autoRetrainOnFailure: boolean;
  };
  scheduling: {
    preferredDays: string[]; // ['monday', 'tuesday', ...]
    avoidPeakHours: boolean;
    peakHours: string[]; // ['09:00-17:00']
    timezone: string;
  };
  notifications: {
    onSessionStart: boolean;
    onSessionComplete: boolean;
    onAccuracyGain: boolean;
    onTrainingFailure: boolean;
    channels: {
      dashboard: boolean;
      telegram: boolean;
      email: boolean;
    };
  };
  artemisControl: {
    allowArtemisAutoConfig: boolean;
    requireArtemisApproval: boolean;
    artemisOptimizationLevel: 'conservative' | 'balanced' | 'aggressive';
  };
}

export interface APIKeyEntry {
  id: string;
  key: string;
  secret?: string;
  label?: string; // User-friendly label like "Free Tier", "Paid Tier 1", etc.
  isActive: boolean;
  usageCount: number;
  lastUsed?: string;
  lastTested?: string;
  config?: any; // Additional configuration for services (SMTP, On-chain, News, etc.)
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay: number;
    tokensPerMonth?: number;
  };
  costPerRequest?: number;
  status: 'active' | 'rate_limited' | 'error' | 'disabled';
  errorMessage?: string;
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
  // Multiple API keys support
  apiKeys?: APIKeyEntry[];
  // Load balancing settings
  loadBalancing?: {
    strategy: 'round_robin' | 'least_used' | 'random' | 'weighted';
    weights?: { [keyId: string]: number };
  };
  // Mixture agents settings (for AI services)
  mixtureAgents?: {
    enabled: boolean;
    models: Array<{
      serviceId: string;
      weight: number;
      minConfidence?: number;
    }>;
  };
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

export interface AutomationDataSource {
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

// Ethereum Provider Types
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isMetaMask?: boolean;
    };
  }
}

// DeFi Types
export interface DeFiPosition {
  id: string;
  protocol: string;
  type: 'yield_farming' | 'liquidity_pool' | 'staking';
  asset: string;
  amount: number;
  apy: number;
  value: number;
  status: 'active' | 'pending' | 'completed';
  createdAt: string;
  lastUpdated: string;
}

export interface DeFiProtocol {
  id: string;
  name: string;
  type: 'yield_farming' | 'liquidity_pool' | 'staking';
  apy: number;
  tvl: number;
  supported: boolean;
  description: string;
}

export interface DeFiData {
  positions: DeFiPosition[];
  protocols: DeFiProtocol[];
  totalValue: number;
  totalYield: number;
  lastSyncedAt: string;
}
// ============================================================================
// TOPIC ROUTING (TASK-BE-013)
// ============================================================================

export interface TopicRoutingRule {
  id: string;
  name: string;
  keywords: string[];
  agent_key: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TopicRoutingLog {
  id: string;
  data_id: string;
  rule_id: string | null;
  matched_keywords: string[];
  agent_key: string;
  created_at: string;
  rule_name?: string;
  raw_data?: any;
}

export interface TopicRoutingState {
  rules: TopicRoutingRule[];
  logs: TopicRoutingLog[];
  totalLogs: number;
}

