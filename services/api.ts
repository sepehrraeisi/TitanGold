import { _data } from './_data.ts';
import type {
    User,
    FavoriteItem,
    FavoriteAlert,
    FavoriteAlertInput,
    FavoritesPageData,
    FavoritesSummary,
    CryptoAsset,
    MarketMover,
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
    PortfolioRebalanceStrategy,
    RiskMetric,
    AnalysisStat,
    AnalysisPageData,
    AnalysisTimeRange,
    AnalysisPerformancePoint,
    AnalysisDistributionSlice,
    AnalysisRiskMetric,
    AnalysisReportTemplate,
    SmartPrediction,
    PerformanceTrade,
    NewsArticle,
    EconomicEvent,
    NewsSummaryStat,
    NewsSentimentSnapshot,
    NewsSource,
    NewsAlert,
    NewsBriefing,
    NewsPageData,
    AIAgent,
    AIProvider,
    AIManagerOverview,
    AIAnalyticsMetrics,
    AITrainingStats,
    AITrainingSession,
    AITrainingMode,
    APIServiceIntegration,
    AIAPIConfigData,
    AICenterData,
    GoldAsset,
    GoldPrediction,
    GoldNewsArticle,
    GoldPageData,
    GoldOverviewStat,
    GoldMarketDriver,
    GoldPricePoint,
    GoldTimeRange,
    GoldAlert,
    GoldAlertInput,
    GoldTelegramChannel,
    GoldPublishTemplate,
    GoldPublishItem,
    GoldPublishResponse,
    DataSource,
    TelegramPublisherConfig,
    Workflow,
    AutopilotState,
    AutopilotMode,
    AutopilotRiskLevel,
    AutopilotQuickAction,
    AutopilotQuickActionResult,
    TradingDashboardData,
    TradingKPI,
    TradingTimeRange,
    ChartPoint,
    Trade,
    ManualTradingPageData,
    ManualQuickTradeOrder,
    WalletSettingsData,
    WalletPreferences,
    WalletSecurityControl,
    WalletConnector,
    ProfileSettingsData,
    ProfileDetailsUpdate,
    ProfileCommunicationSettings,
    ProfilePasswordChangeRequest,
    SecuritySettingsData,
    SecurityAlertSettings,
    SecuritySession,
    ManagedUser,
    UserManagementData,
    UserInvitation,
    UserRoleOption,
} from '../types.ts';

// --- SIMULATED BACKEND ---

const FAKE_LATENCY = 800;

// Simulate a database
let db: typeof _data = { ..._data };
let goldAlertSequence = _data.gold.alerts.length;
let userInviteSequence = _data.userManagement?.invitations.length ?? 0;
let userSequence = _data.userManagement?.users.length ?? 0;

const ensureAutopilotState = (): AutopilotState => {
    if (!db.autopilotState) {
        throw new Error('Autopilot state not initialized');
    }
    return db.autopilotState;
};

const ensureTradingDashboard = (): TradingDashboardData => {
    if (!db.tradingDashboard) {
        throw new Error('Trading dashboard not initialized');
    }
    return db.tradingDashboard;
};

const ensureManualTrading = (): ManualTradingPageData => {
    if (!db.manualTrading) {
        throw new Error('Manual trading data not initialized');
    }
    return db.manualTrading;
};

const ensurePortfolio = (): PortfolioPageData => {
    if (!db.portfolio) {
        throw new Error('Portfolio data not initialized');
    }
    return db.portfolio;
};

const ensureAnalysis = (): AnalysisPageData => {
    if (!db.analysis) {
        throw new Error('Analysis data not initialized');
    }
    return db.analysis;
};

const ensureNews = (): NewsPageData => {
    if (!db.news) {
        throw new Error('News data not initialized');
    }
    return db.news;
};

const ensureAICenter = (): AICenterData => {
    if (!db.aiCenter) {
        throw new Error('AI center data not initialized');
    }
    return db.aiCenter;
};

const ensureGold = (): GoldPageData => {
    if (!db.gold) {
        throw new Error('Gold data not initialized');
    }
    return db.gold;
};

const ensureWalletSettings = (): WalletSettingsData => {
    if (!db.walletData) {
        throw new Error('Wallet settings not initialized');
    }
    return db.walletData;
};

const ensureProfileSettings = (): ProfileSettingsData => {
    if (!db.profileSettings) {
        throw new Error('Profile settings not initialized');
    }
    return db.profileSettings;
};

const ensureSecuritySettings = (): SecuritySettingsData => {
    if (!db.securitySettings) {
        throw new Error('Security settings not initialized');
    }
    return db.securitySettings;
};

const ensureUserManagement = (): UserManagementData => {
    if (!db.userManagement) {
        throw new Error('User management data not initialized');
    }
    return db.userManagement;
};

const cloneAutopilotState = (state: AutopilotState): AutopilotState => ({
    ...state,
    goal: { ...state.goal },
    metrics: { ...state.metrics },
});

const cloneChart = (chart: Record<TradingTimeRange, ChartPoint[]>): Record<TradingTimeRange, ChartPoint[]> => {
    const entries = Object.entries(chart) as [TradingTimeRange, ChartPoint[]][];
    return entries.reduce((acc, [range, points]) => {
        acc[range] = points.map(point => ({ ...point }));
        return acc;
    }, {} as Record<TradingTimeRange, ChartPoint[]>);
};

const cloneTradingDashboard = (dashboard: TradingDashboardData): TradingDashboardData => ({
    ...dashboard,
    kpis: dashboard.kpis.map((kpi: TradingKPI) => ({ ...kpi })),
    trades: dashboard.trades.map((trade: Trade) => ({ ...trade })),
    assets: dashboard.assets.map(asset => ({ ...asset })),
    chart: cloneChart(dashboard.chart),
});

const cloneManualTrading = (data: ManualTradingPageData): ManualTradingPageData => ({
    ...data,
    stats: data.stats.map(stat => ({ ...stat })),
    chart: data.chart.map(point => ({ ...point })),
    quickTrade: {
        ...data.quickTrade,
        amountPresets: [...data.quickTrade.amountPresets],
    },
    recommendations: data.recommendations.map(item => ({ ...item })),
    sentiment: { ...data.sentiment },
    strategies: data.strategies.map(item => ({ ...item })),
    portfolio: data.portfolio.map(item => ({ ...item })),
    performance: data.performance.map(item => ({ ...item })),
    recentTrades: data.recentTrades.map(item => ({ ...item })),
});

const cloneAIAgent = (agent: AIAgent): AIAgent => ({
    ...agent,
    capabilities: [...agent.capabilities],
});

const cloneAIProvider = (provider: AIProvider): AIProvider => ({ ...provider });

const cloneAITrainingSession = (session: AITrainingSession): AITrainingSession => ({
    ...session,
    agentIds: [...session.agentIds],
});

const cloneAITrainingStats = (stats: AITrainingStats): AITrainingStats => ({
    ...stats,
    runningSessions: stats.runningSessions.map(cloneAITrainingSession),
    queue: stats.queue.map(cloneAITrainingSession),
    recentHistory: stats.recentHistory.map(cloneAITrainingSession),
});

const cloneAIAnalytics = (analytics: AIAnalyticsMetrics): AIAnalyticsMetrics => ({
    realtime: {
        ...analytics.realtime,
        agentDistribution: { ...analytics.realtime.agentDistribution },
    },
    performance: { ...analytics.performance },
    resourceUsage: {
        cpu: analytics.resourceUsage.cpu,
        gpu: analytics.resourceUsage.gpu,
        memory: analytics.resourceUsage.memory,
        precision: [...analytics.resourceUsage.precision],
        recall: [...analytics.resourceUsage.recall],
    },
    agentMatrix: analytics.agentMatrix.map(row => ({ ...row })),
    lastUpdated: analytics.lastUpdated,
});

const cloneGoldPricePoint = (point: GoldPricePoint): GoldPricePoint => ({ ...point });

const cloneGoldOverviewStat = (stat: GoldOverviewStat): GoldOverviewStat => ({ ...stat });

const cloneGoldMarketDriver = (driver: GoldMarketDriver): GoldMarketDriver => ({ ...driver });

const cloneGoldPrediction = (prediction: GoldPrediction): GoldPrediction => ({
    ...prediction,
    scenarios: { ...prediction.scenarios },
    confidenceBreakdown: { ...prediction.confidenceBreakdown },
    signals: prediction.signals.map(signal => ({ ...signal })),
    recommendedActions: [...prediction.recommendedActions],
});

const cloneGoldNewsArticle = (article: GoldNewsArticle): GoldNewsArticle => ({
    ...article,
    tags: [...article.tags],
});

const cloneGoldAlert = (alert: GoldAlert): GoldAlert => ({ ...alert });

const cloneGoldTelegramChannel = (channel: GoldTelegramChannel): GoldTelegramChannel => ({
    ...channel,
    autoPost: { ...channel.autoPost },
});

const cloneGoldTelegramTemplate = (template: GoldPublishTemplate): GoldPublishTemplate => ({ ...template });

const cloneGoldTelegram = (telegram: GoldPageData['telegram']): GoldPageData['telegram'] => ({
    ...telegram,
    channels: telegram.channels.map(cloneGoldTelegramChannel),
    templates: telegram.templates.map(cloneGoldTelegramTemplate),
});

const cloneGold = (data: GoldPageData): GoldPageData => ({
    ...data,
    stats: data.stats.map(cloneGoldOverviewStat),
    priceRanges: (Object.entries(data.priceRanges) as [GoldTimeRange, GoldPricePoint[]][]).reduce(
        (acc, [range, points]) => {
            acc[range] = points.map(cloneGoldPricePoint);
            return acc;
        },
        {} as Record<GoldTimeRange, GoldPricePoint[]>,
    ),
    assets: data.assets.map(asset => ({ ...asset })),
    prediction: cloneGoldPrediction(data.prediction),
    news: data.news.map(cloneGoldNewsArticle),
    marketDrivers: data.marketDrivers.map(cloneGoldMarketDriver),
    telegram: cloneGoldTelegram(data.telegram),
    alerts: data.alerts.map(cloneGoldAlert),
});

const generateGoldAlertId = (): string => {
    goldAlertSequence += 1;
    return `gold-alert-${goldAlertSequence}`;
};

const cloneWalletSettings = (settings: WalletSettingsData): WalletSettingsData => ({
    stats: { ...settings.stats },
    assets: settings.assets.map(asset => ({ ...asset })),
    transactions: settings.transactions.map(transaction => ({ ...transaction })),
    connectors: settings.connectors.map(connector => ({ ...connector })),
    securityControls: settings.securityControls.map(control => ({ ...control })),
    preferences: { ...settings.preferences },
    lastSyncedAt: settings.lastSyncedAt,
});

const cloneProfileSettings = (settings: ProfileSettingsData): ProfileSettingsData => ({
    profile: { ...settings.profile },
    communications: { ...settings.communications },
    metrics: settings.metrics.map(metric => ({ ...metric })),
    integrations: settings.integrations.map(integration => ({ ...integration })),
    activity: settings.activity.map(entry => ({ ...entry })),
    lastUpdated: settings.lastUpdated,
});

const cloneSecuritySettings = (settings: SecuritySettingsData): SecuritySettingsData => ({
    score: settings.score,
    twoFactor: { ...settings.twoFactor },
    methods: settings.methods.map(method => ({ ...method })),
    sessions: settings.sessions.map(session => ({ ...session })),
    events: settings.events.map(event => ({ ...event })),
    alerts: { ...settings.alerts },
    trustedLocations: [...settings.trustedLocations],
    lastReviewed: settings.lastReviewed,
});

const cloneUserManagement = (settings: UserManagementData): UserManagementData => ({
    users: settings.users.map(user => ({ ...user, permissions: [...user.permissions] })),
    invitations: settings.invitations.map(invitation => ({ ...invitation })),
    availableRoles: settings.availableRoles.map(role => ({ ...role })),
    defaultRoleKey: settings.defaultRoleKey,
    lastUpdated: settings.lastUpdated,
});

const cloneAIManagerOverview = (overview: AIManagerOverview): AIManagerOverview => ({
    summary: { ...overview.summary },
    providers: overview.providers.map(cloneAIProvider),
    topAgents: overview.topAgents.map(agent => ({ ...agent })),
    lastUpdated: overview.lastUpdated,
});

const cloneAPIServiceIntegration = (service: APIServiceIntegration): APIServiceIntegration => ({
    ...service,
});

const cloneAIAPIConfig = (config: AIAPIConfigData): AIAPIConfigData => ({
    aiServices: config.aiServices.map(cloneAPIServiceIntegration),
    exchangeServices: config.exchangeServices.map(cloneAPIServiceIntegration),
    communicationServices: config.communicationServices.map(cloneAPIServiceIntegration),
    marketDataServices: config.marketDataServices.map(cloneAPIServiceIntegration),
    lastUpdated: config.lastUpdated,
});

const cloneAICenter = (center: AICenterData): AICenterData => ({
    overview: cloneAIManagerOverview(center.overview),
    agents: center.agents.map(cloneAIAgent),
    analytics: cloneAIAnalytics(center.analytics),
    training: cloneAITrainingStats(center.training),
    apiConfig: cloneAIAPIConfig(center.apiConfig),
});

const mutateTradingDashboard = (
    mutator: (draft: TradingDashboardData) => void
): TradingDashboardData => {
    const base = cloneTradingDashboard(ensureTradingDashboard());
    mutator(base);
    base.lastUpdated = new Date().toISOString();
    db.tradingDashboard = base;
    return cloneTradingDashboard(base);
};

const mutateManualTrading = (
    mutator: (draft: ManualTradingPageData) => void,
): ManualTradingPageData => {
    const base = cloneManualTrading(ensureManualTrading());
    mutator(base);
    base.lastUpdated = new Date().toISOString();
    db.manualTrading = base;
    return cloneManualTrading(base);
};

const mutateAICenter = (
    mutator: (draft: AICenterData) => void,
): AICenterData => {
    const base = cloneAICenter(ensureAICenter());
    mutator(base);
    db.aiCenter = base;
    return cloneAICenter(base);
};

const mutateWalletSettings = (
    mutator: (draft: WalletSettingsData) => void,
): WalletSettingsData => {
    const base = cloneWalletSettings(ensureWalletSettings());
    mutator(base);
    base.lastSyncedAt = new Date().toISOString();
    db.walletData = base;
    return cloneWalletSettings(base);
};

const mutateProfileSettings = (
    mutator: (draft: ProfileSettingsData) => void,
): ProfileSettingsData => {
    const base = cloneProfileSettings(ensureProfileSettings());
    mutator(base);
    base.lastUpdated = new Date().toISOString();
    db.profileSettings = base;
    return cloneProfileSettings(base);
};

const mutateSecuritySettings = (
    mutator: (draft: SecuritySettingsData) => void,
): SecuritySettingsData => {
    const base = cloneSecuritySettings(ensureSecuritySettings());
    mutator(base);
    db.securitySettings = base;
    return cloneSecuritySettings(base);
};

const mutateUserManagement = (
    mutator: (draft: UserManagementData) => void,
): UserManagementData => {
    const base = cloneUserManagement(ensureUserManagement());
    mutator(base);
    base.lastUpdated = new Date().toISOString();
    db.userManagement = base;
    return cloneUserManagement(base);
};

const recalculateAISummary = (draft: AICenterData): void => {
    const total = draft.agents.length;
    const active = draft.agents.filter(agent => agent.status === 'active').length;
    const inTraining = draft.agents.filter(agent => agent.status === 'training').length;
    const avgAccuracy = total
        ? Number((draft.agents.reduce((sum, agent) => sum + agent.accuracy, 0) / total).toFixed(1))
        : 0;

    draft.overview.summary = {
        ...draft.overview.summary,
        totalAgents: total,
        activeAgents: active,
        inTraining,
        avgAccuracy,
    };
};

const refreshAIOverview = (draft: AICenterData): void => {
    recalculateAISummary(draft);
    draft.overview.topAgents = draft.agents
        .slice()
        .sort((a, b) => b.accuracy - a.accuracy)
        .slice(0, 5)
        .map(agent => ({
            id: agent.id,
            name: agent.name,
            role: agent.role,
            accuracy: agent.accuracy,
            status: agent.status,
        }));
    draft.overview.lastUpdated = new Date().toISOString();
};

const updateTrainingTimestamp = (draft: AICenterData): void => {
    draft.training.lastUpdated = new Date().toISOString();
};

const updateAnalyticsTimestamp = (draft: AICenterData): void => {
    draft.analytics.lastUpdated = new Date().toISOString();
};

const updateAPIConfigTimestamp = (draft: AICenterData): void => {
    draft.apiConfig.lastUpdated = new Date().toISOString();
};

const findIntegrationById = (config: AIAPIConfigData, serviceId: string): APIServiceIntegration | undefined => {
    const groups = [
        config.aiServices,
        config.exchangeServices,
        config.communicationServices,
        config.marketDataServices,
    ];

    for (const group of groups) {
        const service = group.find(item => item.id === serviceId);
        if (service) {
            return service;
        }
    }

    return undefined;
};

const updateActiveTrainingAgents = (draft: AICenterData): void => {
    const agentIds = new Set<string>();
    draft.training.runningSessions.forEach(session => {
        session.agentIds.forEach(id => agentIds.add(id));
    });
    draft.training.activeTrainingAgents = agentIds.size;
};

const mutateNews = (
    mutator: (draft: NewsPageData) => void,
): NewsPageData => {
    const base = cloneNews(ensureNews());
    mutator(base);
    base.lastUpdated = new Date().toISOString();
    db.news = base;
    return cloneNews(base);
};

const mutateGold = (
    mutator: (draft: GoldPageData) => void,
): GoldPageData => {
    const base = cloneGold(ensureGold());
    mutator(base);
    base.lastUpdated = new Date().toISOString();
    db.gold = base;
    return cloneGold(base);
};

const numericValue = (value: string): number => {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatThousands = (value: number): string =>
    Math.round(value).toLocaleString('en-US');

const updateGoldStats = (stats: GoldOverviewStat[]): void => {
    stats.forEach(stat => {
        switch (stat.id) {
            case 'gold-stat-spot': {
                const base = numericValue(stat.value) || 2352.1;
                const delta = Number(((Math.random() - 0.45) * 1.2).toFixed(2));
                const next = Math.max(2250, Number((base + delta).toFixed(2)));
                stat.value = `$${next.toFixed(2)}`;
                stat.delta = Math.abs(delta);
                stat.direction = delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat';
                break;
            }
            case 'gold-stat-usdirr': {
                const base = numericValue(stat.value) || 59_400;
                const delta = Number(((Math.random() - 0.45) * 0.8).toFixed(2));
                const next = clamp(Math.round(base * (1 + delta / 100)), 52_000, 68_000);
                stat.value = formatThousands(next);
                stat.delta = Math.abs(delta);
                stat.direction = delta > 0.02 ? 'up' : delta < -0.02 ? 'down' : 'flat';
                break;
            }
            case 'gold-stat-coin': {
                const base = numericValue(stat.value) || 41_200_000;
                const delta = Number(((Math.random() - 0.45) * 0.9).toFixed(2));
                const next = clamp(Math.round(base * (1 + delta / 100)), 32_000_000, 55_000_000);
                stat.value = formatThousands(next);
                stat.delta = Math.abs(delta);
                stat.direction = delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat';
                break;
            }
            case 'gold-stat-sentiment': {
                const base = numericValue(stat.value) || 54;
                const delta = Number(((Math.random() - 0.45) * 6).toFixed(1));
                const next = clamp(Math.round(base + delta), 30, 80);
                stat.value = next.toString();
                stat.delta = Math.abs(delta);
                stat.direction = delta > 0.2 ? 'up' : delta < -0.2 ? 'down' : 'flat';
                break;
            }
            default:
                break;
        }
    });
};

const appendGoldPricePoint = (draft: GoldPageData): void => {
    const now = new Date().toISOString();
    const baseSeries = draft.priceRanges['1D'];
    const lastPrice = baseSeries[baseSeries.length - 1]?.price ?? 40_500_000;
    const change = Number(((Math.random() - 0.45) * 0.8).toFixed(2));
    const nextBase = clamp(Math.round(lastPrice * (1 + change / 100)), 32_000_000, 55_000_000);

    const createPoint = (price: number, delta: number): GoldPricePoint => ({
        timestamp: now,
        price,
        change: Number(delta.toFixed(2)),
        volume: Math.round(140 + Math.random() * 160),
    });

    (Object.keys(draft.priceRanges) as GoldTimeRange[]).forEach(range => {
        const points = draft.priceRanges[range];
        const modifier = range === '1D' ? 0.9 : range === '1W' ? 1.3 : range === '1M' ? 1.8 : range === '3M' ? 2.2 : 2.6;
        const delta = change + (Math.random() - 0.5) * modifier * 0.35;
        const last = points[points.length - 1]?.price ?? nextBase;
        const nextPrice = clamp(Math.round(last * (1 + delta / 100)), 30_000_000, 60_000_000);
        points.push(createPoint(nextPrice, delta));

        const limit = range === '1D' ? 18 : range === '1W' ? 32 : range === '1M' ? 40 : range === '3M' ? 32 : 30;
        while (points.length > limit) {
            points.shift();
        }
    });
};

const updateGoldAssets = (assets: GoldAsset[]): void => {
    assets.forEach(asset => {
        const drift = Number(((Math.random() - 0.45) * 0.9).toFixed(2));
        const midpoint = (asset.buyPrice + asset.sellPrice) / 2;
        const nextMidpoint = clamp(Math.round(midpoint * (1 + drift / 100)), 12_000_000, 60_000_000);
        const spread = Math.max(70_000, Math.abs(asset.buyPrice - asset.sellPrice));
        asset.buyPrice = Math.round(nextMidpoint + spread / 2);
        asset.sellPrice = Math.round(nextMidpoint - spread / 2);
        asset.change = Number(clamp(asset.change + drift, -4.5, 5).toFixed(2));
    });
};

const updateGoldDrivers = (drivers: GoldMarketDriver[]): void => {
    drivers.forEach(driver => {
        const delta = Number(((Math.random() - 0.45) * 1.2).toFixed(2));
        driver.change = delta;
        driver.updatedAt = new Date().toISOString();

        switch (driver.id) {
            case 'driver-global-spot': {
                const base = numericValue(driver.value) || 2352;
                const next = Math.max(2200, Number((base + delta * 4).toFixed(2)));
                driver.value = `$${next.toFixed(2)}`;
                break;
            }
            case 'driver-usdirr': {
                const base = numericValue(driver.value) || 59_400;
                const next = clamp(Math.round(base * (1 + delta / 100)), 52_000, 68_000);
                driver.value = formatThousands(next);
                break;
            }
            case 'driver-oil': {
                const base = numericValue(driver.value) || 86;
                const next = Math.max(58, Number((base + delta).toFixed(2)));
                driver.value = `$${next.toFixed(2)}`;
                break;
            }
            case 'driver-bond': {
                const base = numericValue(driver.value) || 3.9;
                const next = Math.max(0.8, Number((base + delta * 0.5).toFixed(2)));
                driver.value = `${next.toFixed(2)}%`;
                break;
            }
            default:
                break;
        }
    });
};

const adjustGoldConfidenceBreakdown = (prediction: GoldPrediction): void => {
    const ai = clamp(prediction.confidenceBreakdown.ai + Math.round((Math.random() - 0.5) * 6), 25, 55);
    const fundamental = clamp(prediction.confidenceBreakdown.fundamental + Math.round((Math.random() - 0.5) * 5), 20, 45);
    let technical = 100 - ai - fundamental;
    if (technical < 10) {
        technical = 10;
    }
    const total = ai + fundamental + technical;
    if (total !== 100) {
        technical += 100 - total;
    }
    prediction.confidenceBreakdown = { ai, fundamental, technical };
};

const recalculateGoldPrediction = (prediction: GoldPrediction): void => {
    const confidenceShift = Number(((Math.random() - 0.45) * 6).toFixed(1));
    prediction.confidence = Number(clamp(prediction.confidence + confidenceShift, 55, 90).toFixed(1));
    prediction.updatedAt = new Date().toISOString();
    adjustGoldConfidenceBreakdown(prediction);

    prediction.signals = prediction.signals.map(signal => {
        const nextConfidence = clamp(signal.confidence + Math.round((Math.random() - 0.45) * 12), 35, 95);
        const strength = nextConfidence > 75 ? 'strong' : nextConfidence < 55 ? 'weak' : 'moderate';
        return {
            ...signal,
            confidence: nextConfidence,
            strength,
            lastUpdated: prediction.updatedAt,
        };
    });

    const actions = [...prediction.recommendedActions];
    actions.unshift(actions.pop() ?? 'gold_action_watch_usdirr');
    prediction.recommendedActions = Array.from(new Set(actions));
};

const findGoldNews = (draft: GoldPageData, articleId: string): GoldNewsArticle | undefined =>
    draft.news.find(article => article.id === articleId);

const findGoldAlert = (draft: GoldPageData, alertId: string): GoldAlert | undefined =>
    draft.alerts.find(alert => alert.id === alertId);

const setNewsStatValue = (stats: NewsSummaryStat[], id: string, nextValue: number): void => {
    const stat = stats.find(item => item.id === id);
    if (!stat) {
        return;
    }
    const delta = Number((nextValue - stat.value).toFixed(1));
    stat.direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    stat.delta = Math.abs(delta);
    stat.value = nextValue;
};

const recalculateNewsStats = (draft: NewsPageData): void => {
    setNewsStatValue(draft.stats, 'news-total', draft.articles.length);
    setNewsStatValue(
        draft.stats,
        'news-high-impact',
        draft.events.filter(event => event.importance === 'high').length,
    );
    setNewsStatValue(
        draft.stats,
        'news-bullish',
        draft.articles.filter(article => article.sentiment === 'Bullish').length,
    );
    setNewsStatValue(
        draft.stats,
        'news-bearish',
        draft.articles.filter(article => article.sentiment === 'Bearish').length,
    );
};

const adjustNewsSentiment = (snapshot: NewsSentimentSnapshot): void => {
    const drift = Number(((Math.random() - 0.5) * 6).toFixed(1));
    const nextScore = Math.min(100, Math.max(0, snapshot.marketScore + drift));
    snapshot.trend = drift > 1 ? 'up' : drift < -1 ? 'down' : 'flat';
    snapshot.change = Number((snapshot.change * 0.4 + drift).toFixed(1));
    snapshot.marketScore = Number(nextScore.toFixed(1));
    snapshot.bias = snapshot.marketScore > 55 ? 'Bullish' : snapshot.marketScore < 45 ? 'Bearish' : 'Neutral';
    snapshot.trendingAssets = snapshot.trendingAssets.map(asset => ({
        ...asset,
        change: Number((asset.change + Number(((Math.random() - 0.5) * 4).toFixed(1))).toFixed(1)),
    }));
    snapshot.heatmap = snapshot.heatmap.map(cell => ({
        ...cell,
        value: Math.min(100, Math.max(0, cell.value + Math.round((Math.random() - 0.5) * 6))),
    }));
};

const adjustNewsSources = (sources: NewsSource[]): void => {
    const now = new Date().toISOString();
    sources.forEach(source => {
        const variance = Math.round((Math.random() - 0.5) * 6);
        source.reliability = Math.min(100, Math.max(50, source.reliability + variance));
        source.lastCheckedAt = now;
    });
};

const parseNumericValue = (value: string): { number: number; decimals: number; suffix: string } | null => {
    const trimmed = value.trim();
    const match = trimmed.match(/^(-?\d+)(?:\.(\d+))?(%?)$/);
    if (!match) {
        return null;
    }
    const decimals = match[2] ? match[2].length : 0;
    const number = parseFloat(match[1] + (match[2] ? `.${match[2]}` : ''));
    return { number, decimals, suffix: match[3] ?? '' };
};

const formatNumericValue = (value: number, decimals: number, suffix: string): string =>
    `${value.toFixed(decimals)}${suffix}`;

const advanceEconomicEvents = (events: EconomicEvent[]): void => {
    events.forEach(event => {
        const parsed = parseNumericValue(event.actual);
        if (!parsed) {
            return;
        }
        const varianceBase = event.importance === 'high' ? 0.6 : 0.3;
        const variance = (Math.random() - 0.5) * varianceBase;
        const next = parsed.number + variance;
        const decimals = parsed.decimals > 0 ? parsed.decimals : parsed.suffix ? 1 : 0;
        event.actual = formatNumericValue(next, decimals, parsed.suffix);
    });
};

type NewsArticleTemplate = {
    source: string;
    language?: 'en' | 'fa';
    headline: string;
    snippet: string;
    category: NewsArticle['category'];
    sentiment: NewsArticle['sentiment'];
    verificationStatus: NewsArticle['verificationStatus'];
    summary: string;
    verificationDetails: string;
    impactAnalysis: string;
    takeaways: string[];
    relatedAssets: string[];
    tags: string[];
    shareTargets?: string[];
};

const newsArticleTemplates: NewsArticleTemplate[] = [
    {
        source: 'Bloomberg',
        headline: 'Institutional desks hedge ahead of CPI release',
        snippet: 'Block trades on MEXC futures show strategic long hedging before macro catalysts.',
        category: 'Crypto',
        sentiment: 'Neutral',
        verificationStatus: 'Verified',
        summary: 'Mixed positioning signals controlled volatility into the event.',
        verificationDetails: 'Confirmed with derivatives desk reports and Artemis liquidity monitors.',
        impactAnalysis: 'Expect range-bound price action until macro data lands.',
        takeaways: [
            'Liquidity depth increased 12% overnight.',
            'Options skew pricing mild downside risk.',
            'Order book imbalance remains neutral.',
        ],
        relatedAssets: ['BTC', 'ETH'],
        tags: ['Macro', 'Derivatives'],
        shareTargets: ['@macro_watch'],
    },
    {
        source: 'CoinDesk',
        headline: 'Layer-2 activity surges on gaming token launches',
        snippet: 'Artemis highlighted a 34% spike in daily transactions across Arbitrum gaming ecosystems.',
        category: 'Crypto',
        sentiment: 'Bullish',
        verificationStatus: 'Verified',
        summary: 'Network growth remains broad-based with sustained fee revenue.',
        verificationDetails: 'Cross-checked with L2 analytics dashboards and MEXC listing data.',
        impactAnalysis: 'Supports continued upside for ecosystem governance tokens.',
        takeaways: [
            'Active addresses up 21% week-over-week.',
            'Bridge inflows remain net positive.',
            'On-chain fees holding above seasonal averages.',
        ],
        relatedAssets: ['ARB', 'MAGIC'],
        tags: ['Layer-2', 'Gaming'],
        shareTargets: ['@vip_signals'],
    },
    {
        source: 'Reuters',
        headline: 'Energy markets steady as OPEC maintains output guidance',
        snippet: 'Oil volatility cooled after OPEC signalled no immediate production changes.',
        category: 'Economy',
        sentiment: 'Neutral',
        verificationStatus: 'Verified',
        summary: 'Macro risk backdrop remains balanced for commodities.',
        verificationDetails: 'Verified with official OPEC communiqué and industry trackers.',
        impactAnalysis: 'Supports gradual rotation back into cyclicals and metals.',
        takeaways: [
            'Brent futures confined within 2% range.',
            'Option skews pricing modest downside.',
            'USD correlation remains elevated.',
        ],
        relatedAssets: ['OIL', 'XAU'],
        tags: ['Commodities', 'Macro'],
        shareTargets: ['@macro_watch'],
    },
    {
        source: 'Security Ledger',
        headline: 'Cross-chain bridge patches vulnerability after white-hat disclosure',
        snippet: 'A coordinated fix closed a replay attack vector impacting mid-size DeFi bridges.',
        category: 'Crypto',
        sentiment: 'Bullish',
        verificationStatus: 'Unverified',
        summary: 'Remediation reduces near-term exploit risk for wrapped assets.',
        verificationDetails: 'Awaiting public audit notes from participating security firms.',
        impactAnalysis: 'Positive signal for cross-chain volumes once audits complete.',
        takeaways: [
            'Patch deployed across 5 networks.',
            'Bridged liquidity restored within hours.',
            'No customer funds impacted.',
        ],
        relatedAssets: ['OP', 'FTM'],
        tags: ['Security', 'Infrastructure'],
        shareTargets: ['@risk_channel'],
    },
];

const randomFrom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const createNewsArticle = (): NewsArticle => {
    const template = randomFrom(newsArticleTemplates);
    const impactScore = Math.min(100, Math.max(50, Math.round(60 + Math.random() * 35)));
    const id = `news-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return {
        id,
        source: template.source,
        timestamp: 'Just now',
        headline: template.headline,
        snippet: template.snippet,
        category: template.category,
        verificationStatus: template.verificationStatus,
        impactScore,
        sentiment: template.sentiment,
        aiAnalysis: {
            summary: template.summary,
            verificationDetails: template.verificationDetails,
            impactAnalysis: template.impactAnalysis,
            keyTakeaways: [...template.takeaways],
        },
        link: '#',
        language: template.language ?? 'en',
        relatedAssets: [...template.relatedAssets],
        tags: [...template.tags],
        shareTargets: template.shareTargets ? [...template.shareTargets] : undefined,
        isBreaking: impactScore >= 85,
        priority: impactScore,
    };
};

const maybeAddNewsAlert = (draft: NewsPageData, article: NewsArticle): void => {
    if (article.impactScore < 80) {
        return;
    }
    const isBearish = article.sentiment === 'Bearish';
    const severity: NewsAlert['severity'] = isBearish ? 'critical' : 'high';
    const alert: NewsAlert = {
        id: `alert-${article.id}`,
        titleKey: isBearish ? 'alert_security_incident' : 'alert_high_impact_breakout',
        descriptionKey: isBearish ? 'alert_security_incident_desc' : 'alert_high_impact_breakout_desc',
        severity,
        acknowledged: false,
        relatedArticleId: article.id,
        timestamp: new Date().toISOString(),
    };
    draft.alerts = [alert, ...draft.alerts].slice(0, 6);
};

const buildNewsBriefing = (data: NewsPageData, generatedAt: string): NewsBriefing => {
    const breaking = (data.breakingArticleId && data.articles.find(article => article.id === data.breakingArticleId))
        ?? data.articles[0];
    const activeAlerts = data.alerts.filter(alert => !alert.acknowledged).length;
    const highImpactEvents = data.events.filter(event => event.importance === 'high').length;

    return {
        title: 'Titan Market Pulse',
        summary: `Artemis reviewed ${data.articles.length} stories. Sentiment is ${data.sentiment.bias.toLowerCase()} at ${data.sentiment.marketScore}.`,
        highlights: [
            breaking ? breaking.headline : 'No breaking headlines at this time.',
            `${highImpactEvents} high-impact macro events are on the radar today.`,
            `${activeAlerts} actionable alerts awaiting acknowledgment.`,
        ],
        generatedAt,
    };
};

const clonePerformance = (
    performance: Record<PortfolioTimeRange, PortfolioPerformancePoint[]>,
): Record<PortfolioTimeRange, PortfolioPerformancePoint[]> => {
    const entries = Object.entries(performance) as [PortfolioTimeRange, PortfolioPerformancePoint[]][];
    return entries.reduce((acc, [range, points]) => {
        acc[range] = points.map(point => ({ ...point }));
        return acc;
    }, {} as Record<PortfolioTimeRange, PortfolioPerformancePoint[]>);
};

const clonePortfolio = (data: PortfolioPageData): PortfolioPageData => ({
    ...data,
    stats: data.stats.map(stat => ({
        ...stat,
        subLabelParams: stat.subLabelParams ? { ...stat.subLabelParams } : undefined,
    })),
    holdings: data.holdings.map(asset => ({ ...asset })),
    riskMetrics: data.riskMetrics.map(metric => ({ ...metric })),
    performance: clonePerformance(data.performance),
    distribution: data.distribution.map(slice => ({ ...slice })),
    exposures: data.exposures.map(exposure => ({ ...exposure })),
    correlation: {
        assets: [...data.correlation.assets],
        values: data.correlation.values.map(row => [...row]),
    },
    monthlyReturns: data.monthlyReturns.map(item => ({ ...item })),
    insights: data.insights.map(item => ({ ...item })),
    activities: data.activities.map(activity => ({
        ...activity,
        metadata: activity.metadata ? { ...activity.metadata } : undefined,
    })),
});

const cloneAnalysisPerformance = (
    performance: Record<AnalysisTimeRange, AnalysisPerformancePoint[]>,
): Record<AnalysisTimeRange, AnalysisPerformancePoint[]> => {
    const entries = Object.entries(performance) as [AnalysisTimeRange, AnalysisPerformancePoint[]][];
    return entries.reduce((acc, [range, series]) => {
        acc[range] = series.map(point => ({ ...point }));
        return acc;
    }, {} as Record<AnalysisTimeRange, AnalysisPerformancePoint[]>);
};

const cloneAnalysis = (data: AnalysisPageData): AnalysisPageData => ({
    ...data,
    stats: data.stats.map(stat => ({
        ...stat,
        subLabelParams: stat.subLabelParams ? { ...stat.subLabelParams } : undefined,
    })),
    performance: cloneAnalysisPerformance(data.performance),
    distribution: data.distribution.map(slice => ({ ...slice })),
    riskMetrics: data.riskMetrics.map(metric => ({ ...metric })),
    predictions: data.predictions.map(prediction => ({ ...prediction })),
    trades: data.trades.map(trade => ({ ...trade })),
    reports: data.reports.map(report => ({ ...report })),
});

const cloneNewsArticle = (article: NewsArticle): NewsArticle => ({
    ...article,
    aiAnalysis: {
        ...article.aiAnalysis,
        keyTakeaways: [...article.aiAnalysis.keyTakeaways],
    },
    relatedAssets: article.relatedAssets ? [...article.relatedAssets] : undefined,
    tags: article.tags ? [...article.tags] : undefined,
    shareTargets: article.shareTargets ? [...article.shareTargets] : undefined,
});

const cloneNews = (data: NewsPageData): NewsPageData => ({
    ...data,
    stats: data.stats.map(stat => ({ ...stat })),
    sentiment: {
        ...data.sentiment,
        trendingAssets: data.sentiment.trendingAssets.map(asset => ({ ...asset })),
        heatmap: data.sentiment.heatmap.map(cell => ({ ...cell })),
    },
    sources: data.sources.map(source => ({ ...source })),
    alerts: data.alerts.map(alert => ({ ...alert })),
    watchlist: data.watchlist.map(item => ({ ...item })),
    filterPresets: data.filterPresets.map(preset => ({
        ...preset,
        categories: [...preset.categories],
        sentiments: [...preset.sentiments],
        sources: preset.sources ? [...preset.sources] : undefined,
    })),
    articles: data.articles.map(cloneNewsArticle),
    events: data.events.map(event => ({ ...event })),
    pinnedArticleIds: data.pinnedArticleIds ? [...data.pinnedArticleIds] : undefined,
});

const advancePerformanceSeries = (
    series: PortfolioPerformancePoint[],
    amplitude: number,
    hoursStep: number,
    maxPoints: number,
): PortfolioPerformancePoint[] => {
    if (series.length === 0) {
        return series;
    }

    const lastPoint = series[series.length - 1];
    const change = (Math.random() - 0.45) * amplitude;
    const nextValue = Math.max(lastPoint.value + change, lastPoint.value * 0.85);
    const baseline = lastPoint.benchmark ?? lastPoint.value * 0.97;
    const nextBenchmark = Math.max(baseline + change * 0.6, baseline * 0.9);

    const nextTimestamp = new Date(
        new Date(lastPoint.timestamp).getTime() + hoursStep * 60 * 60 * 1000,
    ).toISOString();

    const updated = [...series, {
        timestamp: nextTimestamp,
        value: Number(nextValue.toFixed(2)),
        benchmark: Number(nextBenchmark.toFixed(2)),
    }];

    while (updated.length > maxPoints) {
        updated.shift();
    }

    return updated;
};

const recalculatePortfolioSummary = (draft: PortfolioPageData) => {
    const totalValue = draft.holdings.reduce((sum, asset) => sum + asset.value, 0);
    const totalValueStat = draft.stats.find((stat: PortfolioOverviewStat) => stat.id === 'total_value');
    if (totalValueStat) {
        const decimals = totalValueStat.decimals ?? 2;
        totalValueStat.value = Number(totalValue.toFixed(decimals));
    }

    const netProfitStat = draft.stats.find((stat: PortfolioOverviewStat) => stat.id === 'net_profit');
    if (netProfitStat) {
        const totalProfit = draft.holdings.reduce((sum, asset) => sum + asset.pnl, 0);
        const decimals = netProfitStat.decimals ?? 0;
        netProfitStat.value = Number(totalProfit.toFixed(decimals));
    }

    const distributionMap = new Map<string, PortfolioDistributionSlice>(
        draft.distribution.map(slice => [slice.id, slice]),
    );

    draft.holdings.forEach(asset => {
        const percentage = totalValue > 0 ? (asset.value / totalValue) * 100 : 0;
        asset.allocation = Number(percentage.toFixed(2));
        const slice = distributionMap.get(asset.id);
        if (slice) {
            slice.percentage = Number(percentage.toFixed(2));
            slice.value = Number(asset.value.toFixed(2));
            slice.asset = asset.symbol;
            if (asset.color) {
                slice.color = asset.color;
            }
        } else {
            draft.distribution.push({
                id: asset.id,
                asset: asset.symbol,
                percentage: Number(percentage.toFixed(2)),
                value: Number(asset.value.toFixed(2)),
                color: asset.color ?? '#818cf8',
            });
        }
    });

    draft.distribution = draft.distribution.filter(slice =>
        draft.holdings.some(asset => asset.id === slice.id),
    );
};

const mutatePortfolio = (
    mutator: (draft: PortfolioPageData) => void,
): PortfolioPageData => {
    const base = clonePortfolio(ensurePortfolio());
    mutator(base);
    base.lastUpdated = new Date().toISOString();
    recalculatePortfolioSummary(base);
    db.portfolio = base;
    return clonePortfolio(base);
};

const mutateAnalysis = (
    mutator: (draft: AnalysisPageData) => void,
): AnalysisPageData => {
    const base = cloneAnalysis(ensureAnalysis());
    mutator(base);
    base.lastUpdated = new Date().toISOString();
    db.analysis = base;
    return cloneAnalysis(base);
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const updateStatTrend = (stat: PortfolioOverviewStat | undefined, variance: number) => {
    if (!stat) {
        return;
    }
    const decimals = stat.changeDecimals ?? stat.decimals ?? 2;
    const next = (stat.change ?? 0) + (Math.random() - 0.5) * variance;
    stat.change = Number(next.toFixed(decimals));
};

const recordPortfolioActivity = (
    draft: PortfolioPageData,
    messageKey: string,
    metadata?: Record<string, string | number>,
) => {
    draft.activities.unshift({
        id: `portfolio-activity-${Math.random().toString(36).slice(2, 10)}`,
        timestamp: new Date().toISOString(),
        messageKey,
        metadata,
    });
    draft.activities = draft.activities.slice(0, 25);
};

const analysisTradeConfigs = [
    { symbol: 'BTC/USDT', price: 45200, pricePrecision: 2, amountMin: 0.15, amountMax: 0.8, amountPrecision: 2 },
    { symbol: 'ETH/USDT', price: 2760, pricePrecision: 2, amountMin: 1.2, amountMax: 6.5, amountPrecision: 2 },
    { symbol: 'SOL/USDT', price: 105, pricePrecision: 2, amountMin: 120, amountMax: 420, amountPrecision: 0 },
    { symbol: 'XAU/USDT', price: 2035, pricePrecision: 2, amountMin: 1.1, amountMax: 3.4, amountPrecision: 2 },
    { symbol: 'ADA/USDT', price: 0.58, pricePrecision: 4, amountMin: 1400, amountMax: 3200, amountPrecision: 0 },
] as const;

const analysisRangeVariance: Record<AnalysisTimeRange, { equity: number; pnl: number; drawdown: number }> = {
    '1W': { equity: 1.8, pnl: 420, drawdown: 1.2 },
    '1M': { equity: 1.4, pnl: 520, drawdown: 1.1 },
    '3M': { equity: 1.2, pnl: 640, drawdown: 0.9 },
    '6M': { equity: 1.0, pnl: 760, drawdown: 0.8 },
    '1Y': { equity: 0.8, pnl: 920, drawdown: 0.7 },
};

const advanceAnalysisSeries = (
    series: AnalysisPerformancePoint[],
    variance: { equity: number; pnl: number; drawdown: number },
): AnalysisPerformancePoint[] => {
    if (series.length === 0) {
        return series;
    }

    const last = series[series.length - 1];
    const equityDeltaPercent = (Math.random() - 0.45) * variance.equity;
    const nextEquity = Math.max(50000, last.equity * (1 + equityDeltaPercent / 100));
    const pnlDelta = (Math.random() - 0.4) * variance.pnl;
    const drawdownDelta = (Math.random() - 0.55) * variance.drawdown;

    const nextPoint: AnalysisPerformancePoint = {
        timestamp: new Date().toISOString(),
        equity: Number(nextEquity.toFixed(2)),
        pnl: Number((last.pnl + pnlDelta).toFixed(2)),
        drawdown: Number(clamp(last.drawdown + drawdownDelta, 0.5, 25).toFixed(2)),
    };

    return [...series.slice(1), nextPoint];
};

const jitterDistribution = (distribution: AnalysisDistributionSlice[]) => {
    distribution.forEach(slice => {
        const delta = (Math.random() - 0.5) * 4.2;
        slice.value = clamp(slice.value + delta, 0, 100);
    });

    const total = distribution.reduce((sum, slice) => sum + slice.value, 0) || 1;
    distribution.forEach(slice => {
        slice.value = Number(((slice.value / total) * 100).toFixed(1));
    });
};

const adjustAnalysisStat = (stat: AnalysisStat) => {
    const decimals = stat.decimals ?? 2;
    switch (stat.format) {
        case 'currency': {
            const delta = (Math.random() - 0.5) * (stat.value * 0.015 + 900);
            stat.value = Number(Math.max(0, stat.value + delta).toFixed(decimals));
            break;
        }
        case 'percent': {
            const delta = (Math.random() - 0.5) * 2.4;
            stat.value = Number(clamp(stat.value + delta, 0, 100).toFixed(decimals));
            break;
        }
        case 'ratio': {
            const delta = (Math.random() - 0.5) * 0.25;
            stat.value = Number(Math.max(0.5, stat.value + delta).toFixed(decimals));
            break;
        }
        default: {
            const delta = (Math.random() - 0.5) * 0.18;
            stat.value = Number(Math.max(0, stat.value + delta).toFixed(decimals));
            break;
        }
    }

    if (stat.change !== undefined) {
        const decimalsChange = stat.changeDecimals ?? 1;
        const variance = stat.changeFormat === 'plain' ? 0.3 : 1.1;
        stat.change = Number((stat.change + (Math.random() - 0.5) * variance).toFixed(decimalsChange));
        stat.changeDirection = (stat.change ?? 0) >= 0 ? 'up' : 'down';
    }
};

const adjustRiskMetric = (metric: AnalysisRiskMetric) => {
    const decimals = metric.decimals ?? 2;
    switch (metric.format) {
        case 'currency': {
            const delta = (Math.random() - 0.5) * 160;
            metric.value = Number(Math.max(0, metric.value + delta).toFixed(decimals));
            break;
        }
        case 'percent': {
            const delta = (Math.random() - 0.5) * 1.3;
            metric.value = Number(clamp(metric.value + delta, 0, 100).toFixed(decimals));
            break;
        }
        case 'ratio': {
            const delta = (Math.random() - 0.5) * 0.2;
            metric.value = Number(Math.max(0.5, metric.value + delta).toFixed(decimals));
            break;
        }
        default: {
            const delta = (Math.random() - 0.5) * 0.2;
            metric.value = Number(Math.max(0, metric.value + delta).toFixed(decimals));
            break;
        }
    }

    if (metric.change !== undefined) {
        const decimalsChange = metric.changeDecimals ?? 1;
        const variance = metric.changeFormat === 'plain' ? 0.25 : 0.8;
        metric.change = Number((metric.change + (Math.random() - 0.5) * variance).toFixed(decimalsChange));
        metric.changeDirection = (metric.change ?? 0) >= 0 ? 'up' : 'down';
    }
};

const adjustSmartPrediction = (prediction: SmartPrediction) => {
    const numericTarget = parseFloat(prediction.targetPrice.replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(numericTarget)) {
        const deltaPercent = (Math.random() - 0.45) * 2.6;
        const nextTarget = Math.max(0, numericTarget * (1 + deltaPercent / 100));
        const prefix = prediction.targetPrice.trim().startsWith('$') ? '$' : '';
        const decimals = nextTarget >= 10 ? 2 : 4;
        prediction.targetPrice = `${prefix}${nextTarget.toFixed(decimals)}`;
    }
    const confidenceShift = Math.round((Math.random() - 0.4) * 7);
    prediction.confidence = clamp(prediction.confidence + confidenceShift, 45, 98);
};

const createAnalysisTrade = (): PerformanceTrade => {
    const config = analysisTradeConfigs[Math.floor(Math.random() * analysisTradeConfigs.length)];
    const type: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const amount = Number(
        clamp(
            config.amountMin + Math.random() * (config.amountMax - config.amountMin),
            config.amountMin,
            config.amountMax,
        ).toFixed(config.amountPrecision),
    );
    const entryBase = config.price * (0.97 + Math.random() * 0.06);
    const entryPrice = Number(entryBase.toFixed(config.pricePrecision));
    const exitMultiplier = 1 + (Math.random() - 0.45) * 0.07;
    const exitPrice = Number((entryPrice * exitMultiplier).toFixed(config.pricePrecision));
    const pnlValue = (type === 'BUY' ? exitPrice - entryPrice : entryPrice - exitPrice) * amount;
    const pnlPercentValue = (type === 'BUY'
        ? ((exitPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - exitPrice) / entryPrice) * 100);

    return {
        id: `analysis-trade-${Math.random().toString(36).slice(2, 10)}`,
        date: new Date().toISOString(),
        symbol: config.symbol,
        type,
        amount,
        entryPrice,
        exitPrice,
        pnl: Number(pnlValue.toFixed(2)),
        pnlPercent: Number(pnlPercentValue.toFixed(2)),
    };
};

const findAdjustmentAsset = (draft: PortfolioPageData, excludeId: string): PortfolioAsset | undefined => {
    return draft.holdings
        .filter(asset => asset.id !== excludeId && asset.value > 0)
        .sort((a, b) => b.value - a.value)[0];
};

const mutateAutopilotState = (
    mutator: (draft: AutopilotState) => void,
    statusKey?: string,
    nextActionKey?: string
): AutopilotState => {
    const base = cloneAutopilotState(ensureAutopilotState());
    mutator(base);
    base.lastUpdated = new Date().toISOString();
    if (statusKey) {
        base.statusMessageKey = statusKey;
    }
    if (nextActionKey) {
        base.goal.nextActionKey = nextActionKey;
    }
    db.autopilotState = base;
    return cloneAutopilotState(base);
};

const withLatency = <T>(value: T, delay = FAKE_LATENCY): Promise<T> =>
    new Promise(resolve => {
        setTimeout(() => resolve(value), delay);
    });

const ensureFavoriteCollections = () => {
    if (!db.favoriteAlerts) {
        db.favoriteAlerts = [];
    }
    if (!db.favorites) {
        db.favorites = [];
    }
};

const cloneFavorites = (favorites: FavoriteItem[] = []): FavoriteItem[] =>
    favorites.map(item => ({ ...item }));

const cloneFavoriteAlerts = (alerts: FavoriteAlert[] = []): FavoriteAlert[] =>
    alerts.map(alert => ({ ...alert }));

const cloneMovers = (items: MarketMover[] = []): MarketMover[] =>
    items.map(item => ({ ...item }));

const cloneAssets = (assets: CryptoAsset[] = []): CryptoAsset[] =>
    assets.map(asset => ({ ...asset }));

const syncFavoriteAlertFlags = (favorites: FavoriteItem[], alerts: FavoriteAlert[]) => {
    const activeMap = new Set(
        alerts.filter(alert => alert.isActive).map(alert => alert.favoriteId)
    );
    favorites.forEach(favorite => {
        favorite.hasAlert = activeMap.has(favorite.id);
    });
};

const summarizeFavorites = (favorites: FavoriteItem[], alerts: FavoriteAlert[]): FavoritesSummary => {
    const activeAlertIds = new Set(
        alerts.filter(alert => alert.isActive).map(alert => alert.favoriteId)
    );

    return {
        totalItems: favorites.length,
        activeAlerts: favorites.filter(item => activeAlertIds.has(item.id)).length,
        gainers: favorites.filter(item => item.change24h > 0).length,
        decliners: favorites.filter(item => item.change24h < 0).length,
    };
};

const buildFavoritesPage = (): FavoritesPageData => {
    ensureFavoriteCollections();
    const favorites = cloneFavorites(db.favorites);
    const alerts = cloneFavoriteAlerts(db.favoriteAlerts);
    syncFavoriteAlertFlags(favorites, alerts);

    return {
        favorites,
        alerts,
        gainers: cloneMovers(db.marketMovers?.gainers ?? []),
        losers: cloneMovers(db.marketMovers?.losers ?? []),
        trending: cloneMovers(db.marketMovers?.trending ?? []),
        catalog: cloneAssets(db.allAssets ?? []),
        summary: summarizeFavorites(favorites, alerts),
        lastUpdated: new Date().toISOString(),
    };
};

const mutateFavoritesState = (
    mutator: (draft: { favorites: FavoriteItem[]; alerts: FavoriteAlert[] }) => void,
): FavoritesPageData => {
    ensureFavoriteCollections();
    const draft = {
        favorites: cloneFavorites(db.favorites),
        alerts: cloneFavoriteAlerts(db.favoriteAlerts),
    };

    mutator(draft);
    syncFavoriteAlertFlags(draft.favorites, draft.alerts);

    db.favorites = cloneFavorites(draft.favorites);
    db.favoriteAlerts = cloneFavoriteAlerts(draft.alerts);

    return buildFavoritesPage();
};

// --- API FUNCTIONS ---

export const checkSession = (): Promise<User | null> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const sessionUser = sessionStorage.getItem('titan_user');
      if (sessionUser) {
        resolve(JSON.parse(sessionUser));
      } else {
        resolve(null);
      }
    }, 300);
  });
};

export const login = (username: string, pass: string): Promise<User | null> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const user = db.users.find(u => u.name.toLowerCase().replace(' ', '_') === username.toLowerCase() && u.password === pass);
      if (user) {
        const userToStore = { ...user };
        delete userToStore.password;
        sessionStorage.setItem('titan_user', JSON.stringify(userToStore));
        resolve(userToStore);
      } else {
        resolve(null);
      }
    }, FAKE_LATENCY);
  });
};

export const fetchDashboardData = (): Promise<any> => {
    return new Promise(resolve => {
        setTimeout(() => resolve({}), FAKE_LATENCY);
    });
}

export const fetchTradingDashboardData = (): Promise<TradingDashboardData> =>
    withLatency(cloneTradingDashboard(ensureTradingDashboard()), 600);

export const fetchManualTradingPageData = (): Promise<ManualTradingPageData> =>
    withLatency(cloneManualTrading(ensureManualTrading()), 500);

type SimulatedTradeInput = {
    pair: string;
    side: 'buy' | 'sell';
    price: number;
    amount: number;
    time?: string;
};

const randomId = () => Math.random().toString(36).slice(2, 10);

const maybeUpdateKpi = (kpis: TradingKPI[], id: string, updater: (kpi: TradingKPI) => void) => {
    const kpi = kpis.find(item => item.id === id);
    if (kpi) {
        updater(kpi);
    }
};

const updateManualTradingStat = (
    stats: ManualTradingPageData['stats'],
    id: string,
    updater: (stat: ManualTradingPageData['stats'][number]) => void,
) => {
    const stat = stats.find(item => item.id === id);
    if (stat) {
        updater(stat);
    }
};

export const executeManualQuickTrade = (
    order: ManualQuickTradeOrder,
): Promise<ManualTradingPageData> => {
    return withLatency(
        mutateManualTrading(draft => {
            const config = draft.quickTrade;
            const amountPercent = Math.min(100, Math.max(1, order.amountPercent || config.defaultPreset));
            const notional = Number(((config.availableBalance * amountPercent) / 100).toFixed(2));
            const baseAmount = Number((notional / config.price).toFixed(config.baseAssetPrecision));
            const direction = order.side === 'buy' ? 1 : -1;
            const pnlPercent = Number(((Math.random() * 1.8 + 0.4) * direction).toFixed(2));
            const pnlValue = Number(((notional * pnlPercent) / 100).toFixed(2));

            draft.recentTrades.unshift({
                id: randomId(),
                side: order.side,
                asset: config.baseAsset,
                pair: config.pair,
                price: Number(config.price.toFixed(2)),
                amount: baseAmount,
                pnl: pnlValue,
                pnlPercent,
                executedAt: new Date().toISOString(),
            });
            draft.recentTrades = draft.recentTrades.slice(0, 12);

            updateManualTradingStat(draft.stats, 'today_profit', stat => {
                stat.value = Number((stat.value + pnlValue).toFixed(stat.decimals ?? 2));
            });
            updateManualTradingStat(draft.stats, 'total_profit', stat => {
                stat.value = Number((stat.value + pnlValue).toFixed(stat.decimals ?? 2));
            });
            updateManualTradingStat(draft.stats, 'trades_volume', stat => {
                stat.value = Number((stat.value + notional).toFixed(stat.decimals ?? 0));
            });
            updateManualTradingStat(draft.stats, 'active_trades', stat => {
                const next = stat.value + (order.side === 'buy' ? 1 : -1);
                stat.value = Math.max(0, Math.round(next));
            });
            updateManualTradingStat(draft.stats, 'win_rate', stat => {
                const delta = (Math.random() * 0.6 + 0.1) * (direction > 0 ? 1 : -1);
                stat.value = Math.min(100, Math.max(0, Number((stat.value + delta).toFixed(stat.decimals ?? 1))));
            });

            draft.quickTrade.stopLossPercent = order.stopLossPercent ?? draft.quickTrade.stopLossPercent;
            draft.quickTrade.takeProfitPercent = order.takeProfitPercent ?? draft.quickTrade.takeProfitPercent;

            const balanceShift = direction > 0 ? -notional * 0.15 : notional * 0.1;
            draft.quickTrade.availableBalance = Number(
                Math.max(0, draft.quickTrade.availableBalance + balanceShift).toFixed(2)
            );

            draft.sentiment.score = Math.min(100, Math.max(0, Math.round(draft.sentiment.score + direction * (Math.random() * 2 - 0.5))));
        }),
        600,
    );
};

export const toggleManualStrategy = (strategyId: string): Promise<ManualTradingPageData> => {
    return withLatency(
        mutateManualTrading(draft => {
            const strategy = draft.strategies.find(item => item.id === strategyId);
            if (!strategy) {
                return;
            }

            strategy.isActive = !strategy.isActive;
            const performanceDelta = strategy.isActive ? Math.random() * 1.2 : -Math.random() * 1.2;
            strategy.performance = Number((strategy.performance + performanceDelta).toFixed(1));

            updateManualTradingStat(draft.stats, 'active_trades', stat => {
                const delta = strategy.isActive ? 1 : -1;
                stat.value = Math.max(0, Math.round(stat.value + delta));
            });

            updateManualTradingStat(draft.stats, 'win_rate', stat => {
                const delta = strategy.isActive ? Math.random() * 0.4 : -Math.random() * 0.4;
                stat.value = Math.min(100, Math.max(0, Number((stat.value + delta).toFixed(stat.decimals ?? 1))));
            });
        }),
        450,
    );
};

export const createSimulatedTrade = (input?: Partial<SimulatedTradeInput>): Promise<TradingDashboardData> => {
    const baseInput: SimulatedTradeInput = {
        pair: input?.pair ?? 'BTC/USDT',
        side: input?.side ?? (Math.random() > 0.5 ? 'buy' : 'sell'),
        price: input?.price ?? (Math.random() * 2000 + 25000),
        amount: input?.amount ?? Math.random() * 2,
        time: input?.time ?? new Date().toISOString(),
    };

    const updated = mutateTradingDashboard(draft => {
        const newTrade: Trade = {
            id: randomId(),
            ...baseInput,
        };
        draft.trades = [newTrade, ...draft.trades].slice(0, 20);

        const volumeDelta = baseInput.price * baseInput.amount;

        maybeUpdateKpi(draft.kpis, 'volume', kpi => {
            const numeric = Number(kpi.value.replace(/[^0-9.-]+/g, '')) || 0;
            const updatedValue = numeric + volumeDelta;
            const formatted = `$${updatedValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
            kpi.value = formatted;
            kpi.change = '+'.concat((Math.random() * 5 + 1).toFixed(1), '%');
            kpi.positive = true;
        });

        maybeUpdateKpi(draft.kpis, 'pnl_24h', kpi => {
            const direction = baseInput.side === 'buy' ? 1 : -1;
            const pnlDelta = direction * volumeDelta * 0.01;
            const numeric = Number(kpi.value.replace(/[^0-9.-]+/g, '')) || 0;
            const updatedValue = numeric + pnlDelta;
            const sign = updatedValue >= 0 ? '+' : '-';
            kpi.value = `${sign}$${Math.abs(updatedValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
            kpi.positive = updatedValue >= 0;
            kpi.change = `${updatedValue >= 0 ? '+' : ''}${(Math.random() * 3 + 1).toFixed(1)}%`;
        });
    });

    return withLatency(updated, 500);
};

export const fetchAutopilotState = (): Promise<AutopilotState> =>
    withLatency(cloneAutopilotState(ensureAutopilotState()));

export const setAutopilotActive = (isActive: boolean): Promise<AutopilotState> => {
    const statusKey = isActive ? 'autopilot_status_running' : 'autopilot_status_paused';
    const nextActionKey = isActive ? 'autopilot_next_action_resume' : 'autopilot_next_action_recalibrate';
    const updated = mutateAutopilotState(draft => {
        draft.isActive = isActive;
        draft.goal.mode = isActive ? 'auto' : 'paused';
        draft.goal.lastSyncSeconds = 5;
        if (isActive) {
            draft.goal.activeTrades = Math.min(
                draft.goal.maxConcurrentTrades,
                Math.max(4, draft.goal.activeTrades || Math.ceil(draft.goal.maxConcurrentTrades / 2))
            );
        } else {
            draft.goal.activeTrades = 0;
        }
        draft.goal.progress = Math.min(100, draft.goal.progress + (isActive ? 1.5 : 0));
    }, statusKey, nextActionKey);

    return withLatency(updated, 500);
};

export const updateAutopilotMode = (mode: AutopilotMode): Promise<AutopilotState> => {
    const updated = mutateAutopilotState(draft => {
        draft.operatingMode = mode;
        draft.goal.lastSyncSeconds = 8;
    }, 'autopilot_status_running', 'autopilot_next_action_recalibrate');

    return withLatency(updated, 450);
};

export const updateAutopilotBudget = (budget: number): Promise<AutopilotState> => {
    const updated = mutateAutopilotState(draft => {
        draft.tradingBudget = budget;
        draft.goal.lastSyncSeconds = 4;
    }, 'autopilot_status_running');

    return withLatency(updated, 450);
};

export const updateAutopilotRiskLevel = (riskLevel: AutopilotRiskLevel): Promise<AutopilotState> => {
    const updated = mutateAutopilotState(draft => {
        draft.riskLevel = riskLevel;
        draft.goal.lastSyncSeconds = 6;
    }, 'autopilot_status_running', 'autopilot_next_action_recalibrate');

    return withLatency(updated, 450);
};

export const startAutopilotGoal = (startCapital: number, targetCapital: number): Promise<AutopilotState> => {
    const updated = mutateAutopilotState(draft => {
        draft.goal.startCapital = startCapital;
        draft.goal.targetCapital = targetCapital;
        draft.goal.progress = 0;
        draft.goal.activeTrades = 0;
        draft.goal.etaMinutes = Math.max(45, Math.round((targetCapital - startCapital) * 1.8));
        draft.goal.lastSyncSeconds = 3;
    }, 'autopilot_status_running', 'autopilot_next_action_resume');

    return withLatency(updated, 650);
};

export const emergencyStopAutopilot = (): Promise<AutopilotState> => {
    const updated = mutateAutopilotState(draft => {
        draft.isActive = false;
        draft.goal.mode = 'paused';
        draft.goal.activeTrades = 0;
        draft.goal.lastSyncSeconds = 2;
    }, 'autopilot_status_emergency', 'autopilot_next_action_recalibrate');

    return withLatency(updated, 500);
};

export const temporaryPauseAutopilot = (): Promise<AutopilotState> => {
    const updated = mutateAutopilotState(draft => {
        draft.isActive = false;
        draft.goal.mode = 'paused';
        draft.goal.lastSyncSeconds = 2;
    }, 'autopilot_status_temp_pause', 'autopilot_next_action_recalibrate');

    return withLatency(updated, 400);
};

export const resetAutopilotSystem = (): Promise<AutopilotState> => {
    const updated = mutateAutopilotState(draft => {
        draft.isActive = true;
        draft.goal.mode = 'auto';
        draft.goal.progress = 0;
        draft.goal.activeTrades = Math.min(draft.goal.maxConcurrentTrades, 6);
        draft.goal.lastSyncSeconds = 5;
        draft.goal.etaMinutes = 240;
        draft.metrics.totalPerformance = 0.5;
        draft.metrics.todayProfit = 0;
    }, 'autopilot_status_reset', 'autopilot_next_action_resume');

    return withLatency(updated, 600);
};

export const runAutopilotQuickAction = (action: AutopilotQuickAction): Promise<AutopilotQuickActionResult> => {
    const actionMap: Record<AutopilotQuickAction, { actionKey: string; nextActionKey: string }> = {
        ai_decisions: { actionKey: 'autopilot_action_ai_decisions', nextActionKey: 'autopilot_next_action_review' },
        performance_report: { actionKey: 'autopilot_action_performance_report', nextActionKey: 'autopilot_next_action_review' },
        export_settings: { actionKey: 'autopilot_action_export_settings', nextActionKey: 'autopilot_next_action_recalibrate' },
    };

    const mapping = actionMap[action];
    const state = mutateAutopilotState(draft => {
        draft.goal.lastSyncSeconds = 1;
    }, 'autopilot_status_running', mapping.nextActionKey);

    return withLatency({ state, actionKey: mapping.actionKey }, 500);
};

export const fetchFavoritesPageData = (): Promise<FavoritesPageData> =>
    withLatency(buildFavoritesPage(), 500);

export const addFavorite = (assetId: string): Promise<FavoritesPageData> =>
    withLatency(mutateFavoritesState(draft => {
        const assetToAdd = db.allAssets?.find(asset => asset.id === assetId)
            ?? _data.allAssets.find(asset => asset.id === assetId);
        if (!assetToAdd) {
            return;
        }
        if (draft.favorites.some(item => item.id === assetId)) {
            return;
        }
        const newFavorite: FavoriteItem = {
            id: assetToAdd.id,
            symbol: assetToAdd.symbol,
            name: assetToAdd.name,
            price: Number((100 + Math.random() * 1000).toFixed(2)),
            change24h: parseFloat(((Math.random() - 0.5) * 12).toFixed(2)),
            volume: `${(Math.random() * 150 + 10).toFixed(2)}M`,
            hasAlert: false,
        };
        draft.favorites.unshift(newFavorite);
    }), 300);

export const removeFavorite = (itemId: string): Promise<FavoritesPageData> =>
    withLatency(mutateFavoritesState(draft => {
        draft.favorites = draft.favorites.filter(item => item.id !== itemId);
        draft.alerts = draft.alerts.filter(alert => alert.favoriteId !== itemId);
    }), 300);

export const createFavoriteAlert = (
    favoriteId: string,
    input: FavoriteAlertInput,
): Promise<FavoritesPageData> =>
    withLatency(mutateFavoritesState(draft => {
        const target = draft.favorites.find(item => item.id === favoriteId);
        if (!target) {
            return;
        }

        draft.alerts.forEach(alert => {
            if (alert.favoriteId === favoriteId) {
                alert.isActive = false;
            }
        });

        const alert: FavoriteAlert = {
            id: `alert-${Math.random().toString(36).slice(2, 10)}`,
            favoriteId,
            condition: input.condition,
            targetPrice: input.targetPrice,
            createdAt: new Date().toISOString(),
            isActive: true,
        };

        draft.alerts.push(alert);
    }), 400);

export const deactivateFavoriteAlert = (alertId: string): Promise<FavoritesPageData> =>
    withLatency(mutateFavoritesState(draft => {
        const alert = draft.alerts.find(item => item.id === alertId);
        if (alert) {
            alert.isActive = false;
        }
    }), 250);


export const fetchStrategies = (): Promise<Strategy[]> => {
    return new Promise(resolve => {
        setTimeout(() => resolve(db.strategies), FAKE_LATENCY);
    });
};

export const fetchPortfolioPageData = (): Promise<PortfolioPageData> =>
    withLatency(clonePortfolio(ensurePortfolio()), 400);

export const rebalancePortfolio = (
    strategy: PortfolioRebalanceStrategy,
): Promise<PortfolioPageData> =>
    withLatency(
        mutatePortfolio(draft => {
            if (draft.holdings.length === 0) {
                return;
            }

            const totalValue = draft.holdings.reduce((sum, asset) => sum + asset.value, 0);
            if (totalValue <= 0) {
                return;
            }

            const weightMap = new Map<string, number>();

            if (strategy === 'equal_weight') {
                const equalWeight = 1 / draft.holdings.length;
                draft.holdings.forEach(asset => weightMap.set(asset.id, equalWeight));
            } else if (strategy === 'risk_adjusted') {
                const scores = draft.holdings.map(asset => ({
                    id: asset.id,
                    score: asset.volatility > 0 ? 1 / asset.volatility : 1,
                }));
                const scoreTotal = scores.reduce((sum, entry) => sum + entry.score, 0);
                scores.forEach(entry => {
                    weightMap.set(entry.id, scoreTotal > 0 ? entry.score / scoreTotal : 0);
                });
            } else {
                const scores = draft.holdings.map(asset => ({
                    id: asset.id,
                    score: clamp(asset.pnlPercent + 12, 1, 150),
                }));
                const scoreTotal = scores.reduce((sum, entry) => sum + entry.score, 0);
                scores.forEach(entry => {
                    weightMap.set(entry.id, scoreTotal > 0 ? entry.score / scoreTotal : 0);
                });
            }

            draft.holdings.forEach(asset => {
                const share = clamp(weightMap.get(asset.id) ?? 0, 0, 1);
                const nextValue = Number((totalValue * share).toFixed(2));
                asset.value = nextValue;
                if (asset.currentPrice > 0) {
                    asset.amount = Number((nextValue / asset.currentPrice).toFixed(4));
                }
                asset.targetAllocation = Number((share * 100).toFixed(2));
                asset.lastRebalancedAt = new Date().toISOString();
            });

            draft.performance['1W'] = advancePerformanceSeries(draft.performance['1W'], 2200, 12, 18);
            draft.performance['1M'] = advancePerformanceSeries(draft.performance['1M'], 3600, 24, 34);
            draft.performance['3M'] = advancePerformanceSeries(draft.performance['3M'], 4800, 48, 40);
            draft.performance['6M'] = advancePerformanceSeries(draft.performance['6M'], 6200, 96, 34);
            draft.performance['1Y'] = advancePerformanceSeries(draft.performance['1Y'], 7800, 168, 30);

            updateStatTrend(draft.stats.find(stat => stat.id === 'total_value'), 1.4);
            updateStatTrend(draft.stats.find(stat => stat.id === 'net_profit'), 2.1);
            updateStatTrend(draft.stats.find(stat => stat.id === 'success_rate'), 0.8);

            recordPortfolioActivity(draft, 'portfolio_activity_rebalanced', { strategy });
        }),
        650,
    );

export const updatePortfolioAllocation = (
    assetId: string,
    targetAllocation: number,
): Promise<PortfolioPageData> =>
    withLatency(
        mutatePortfolio(draft => {
            const holding = draft.holdings.find(asset => asset.id === assetId);
            if (!holding) {
                return;
            }

            const totalValue = draft.holdings.reduce((sum, asset) => sum + asset.value, 0);
            if (totalValue <= 0) {
                return;
            }

            const clampedTarget = clamp(targetAllocation, 0, 100);
            const targetValue = Number(((totalValue * clampedTarget) / 100).toFixed(2));
            let delta = targetValue - holding.value;

            if (Math.abs(delta) < 1) {
                holding.targetAllocation = Number(clampedTarget.toFixed(2));
                return;
            }

            const adjustmentAsset = findAdjustmentAsset(draft, assetId);
            if (!adjustmentAsset) {
                return;
            }

            if (delta > 0) {
                const transferable = Math.min(delta, adjustmentAsset.value);
                adjustmentAsset.value = Number((adjustmentAsset.value - transferable).toFixed(2));
                delta = transferable;
            } else {
                const transferable = Math.min(-delta, holding.value);
                adjustmentAsset.value = Number((adjustmentAsset.value + transferable).toFixed(2));
                delta = -transferable;
            }

            if (adjustmentAsset.currentPrice > 0) {
                adjustmentAsset.amount = Number((adjustmentAsset.value / adjustmentAsset.currentPrice).toFixed(4));
            }

            holding.value = Number((holding.value + delta).toFixed(2));
            if (holding.currentPrice > 0) {
                holding.amount = Number((holding.value / holding.currentPrice).toFixed(4));
            }

            holding.targetAllocation = Number(clampedTarget.toFixed(2));

            updateStatTrend(draft.stats.find(stat => stat.id === 'net_profit'), 1.5);
            draft.performance['1W'] = advancePerformanceSeries(draft.performance['1W'], 1800, 12, 18);

            recordPortfolioActivity(draft, 'portfolio_activity_allocation_updated', {
                asset: holding.symbol,
                target: Number(clampedTarget.toFixed(2)),
            });
        }),
        450,
    );

export const acknowledgePortfolioInsight = (
    insightId: string,
): Promise<PortfolioPageData> =>
    withLatency(
        mutatePortfolio(draft => {
            const insight = draft.insights.find(item => item.id === insightId);
            if (!insight) {
                return;
            }

            insight.acknowledged = true;
            recordPortfolioActivity(draft, 'portfolio_activity_insight_acknowledged', { insight: insightId });
        }),
        220,
    );

export const refreshPortfolioSnapshot = (): Promise<PortfolioPageData> =>
    withLatency(
        mutatePortfolio(draft => {
            draft.holdings.forEach(asset => {
                const drift = 0.995 + Math.random() * 0.025;
                const nextPrice = asset.currentPrice * drift;
                asset.currentPrice = Number(nextPrice.toFixed(2));
                const nextValue = asset.amount * asset.currentPrice;
                asset.value = Number(nextValue.toFixed(2));
                const costBasis = asset.amount * asset.avgPrice;
                const pnl = nextValue - costBasis;
                asset.pnl = Number(pnl.toFixed(2));
                asset.pnlPercent = Number((costBasis === 0 ? 0 : (pnl / costBasis) * 100).toFixed(2));
            });

            draft.performance['1W'] = advancePerformanceSeries(draft.performance['1W'], 1500, 12, 18);
            draft.performance['1M'] = advancePerformanceSeries(draft.performance['1M'], 2400, 24, 34);
            draft.performance['3M'] = advancePerformanceSeries(draft.performance['3M'], 3600, 48, 40);
            draft.performance['6M'] = advancePerformanceSeries(draft.performance['6M'], 5200, 96, 34);
            draft.performance['1Y'] = advancePerformanceSeries(draft.performance['1Y'], 6800, 168, 30);

            updateStatTrend(draft.stats.find(stat => stat.id === 'total_value'), 1.1);
            updateStatTrend(draft.stats.find(stat => stat.id === 'net_profit'), 1.7);
            updateStatTrend(draft.stats.find(stat => stat.id === 'success_rate'), 0.5);

            recordPortfolioActivity(draft, 'portfolio_activity_snapshot_refreshed');
        }),
        320,
    );

export const fetchAnalysisPageData = (): Promise<AnalysisPageData> =>
    withLatency(cloneAnalysis(ensureAnalysis()), 500);

export const setAnalysisActiveRange = (
    range: AnalysisTimeRange,
): Promise<AnalysisPageData> =>
    withLatency(
        mutateAnalysis(draft => {
            if (draft.performance[range]) {
                draft.activeRange = range;
            }
        }),
        260,
    );

export const refreshAnalysisSnapshot = (): Promise<AnalysisPageData> =>
    withLatency(
        mutateAnalysis(draft => {
            (Object.keys(draft.performance) as AnalysisTimeRange[]).forEach(range => {
                const variance = analysisRangeVariance[range];
                draft.performance[range] = advanceAnalysisSeries(draft.performance[range], variance);
            });

            draft.stats.forEach(adjustAnalysisStat);
            jitterDistribution(draft.distribution);
            draft.riskMetrics.forEach(adjustRiskMetric);
            draft.predictions.forEach(adjustSmartPrediction);

            draft.trades = [createAnalysisTrade(), ...draft.trades].slice(0, 8);
        }),
        420,
    );

export const regenerateAnalysisPrediction = (
    predictionId: string,
): Promise<AnalysisPageData> =>
    withLatency(
        mutateAnalysis(draft => {
            const prediction = draft.predictions.find(item => item.id === predictionId);
            if (!prediction) {
                return;
            }
            adjustSmartPrediction(prediction);
        }),
        480,
    );

export const generateAnalysisReport = (
    reportId: string,
): Promise<{ data: AnalysisPageData; downloadUrl: string }> => {
    const updated = mutateAnalysis(draft => {
        const report = draft.reports.find(item => item.id === reportId);
        if (report) {
            report.lastGeneratedAt = new Date().toISOString();
        }
    });

    const downloadUrl = `https://titan.ai/reports/${reportId}-${Date.now()}`;
    return withLatency({ data: updated, downloadUrl }, 650);
};

export const fetchNewsPageData = (): Promise<NewsPageData> =>
    withLatency(cloneNews(ensureNews()), 500);

export const refreshNewsFeed = (): Promise<NewsPageData> =>
    withLatency(
        mutateNews(draft => {
            const article = createNewsArticle();
            draft.articles = [article, ...draft.articles].slice(0, 40);
            if (article.isBreaking) {
                draft.breakingArticleId = article.id;
            }
            maybeAddNewsAlert(draft, article);
            recalculateNewsStats(draft);
            adjustNewsSentiment(draft.sentiment);
            adjustNewsSources(draft.sources);
            advanceEconomicEvents(draft.events);
        }),
        420,
    );

export const updateNewsArticleVerification = (
    articleId: string,
    status: NewsArticle['verificationStatus'],
): Promise<NewsPageData> =>
    withLatency(
        mutateNews(draft => {
            const article = draft.articles.find(item => item.id === articleId);
            if (!article) {
                return;
            }
            article.verificationStatus = status;
            article.aiAnalysis.verificationDetails =
                status === 'Verified'
                    ? 'Verification complete — Artemis confirmed all priority sources.'
                    : status === 'Disputed'
                        ? 'Conflicting sources detected. Manual review requested.'
                        : 'Awaiting confirmations from priority news feeds.';
        }),
        320,
    );

export const pinNewsArticle = (articleId: string, pinned: boolean): Promise<NewsPageData> =>
    withLatency(
        mutateNews(draft => {
            const article = draft.articles.find(item => item.id === articleId);
            if (!article) {
                return;
            }
            article.pinned = pinned;
            article.priority = pinned ? Math.max(article.priority ?? 70, 90) : article.priority;
            const pinnedSet = new Set(draft.pinnedArticleIds ?? []);
            if (pinned) {
                pinnedSet.add(articleId);
            } else {
                pinnedSet.delete(articleId);
            }
            draft.pinnedArticleIds = Array.from(pinnedSet);
        }),
        260,
    );

export const acknowledgeNewsAlert = (alertId: string): Promise<NewsPageData> =>
    withLatency(
        mutateNews(draft => {
            const alert = draft.alerts.find(item => item.id === alertId);
            if (alert) {
                alert.acknowledged = true;
            }
        }),
        220,
    );

export const toggleNewsWatchlistItem = (itemId: string): Promise<NewsPageData> =>
    withLatency(
        mutateNews(draft => {
            const item = draft.watchlist.find(entry => entry.id === itemId);
            if (item) {
                item.isActive = !item.isActive;
            }
        }),
        240,
    );

export const setNewsActiveFilter = (presetId: string): Promise<NewsPageData> =>
    withLatency(
        mutateNews(draft => {
            if (draft.filterPresets.some(preset => preset.id === presetId)) {
                draft.activeFilterId = presetId;
            }
        }),
        200,
    );

export const generateNewsBriefing = (): Promise<{ data: NewsPageData; briefing: NewsBriefing }> => {
    let briefing: NewsBriefing | undefined;
    const updated = mutateNews(draft => {
        const generatedAt = new Date().toISOString();
        draft.lastBriefingGeneratedAt = generatedAt;
        briefing = buildNewsBriefing(draft, generatedAt);
    });

    return withLatency({ data: updated, briefing: briefing! }, 520);
};

export const fetchGoldPageData = (): Promise<GoldPageData> =>
    withLatency(cloneGold(ensureGold()), 500);

export const refreshGoldMarketSnapshot = (): Promise<GoldPageData> =>
    withLatency(
        mutateGold(draft => {
            updateGoldStats(draft.stats);
            appendGoldPricePoint(draft);
            updateGoldAssets(draft.assets);
            updateGoldDrivers(draft.marketDrivers);
        }),
        520,
    );

export const setGoldActiveRange = (range: GoldTimeRange): Promise<GoldPageData> =>
    withLatency(
        mutateGold(draft => {
            if (draft.priceRanges[range]) {
                draft.activeRange = range;
            }
        }),
        180,
    );

export const regenerateGoldPrediction = (): Promise<GoldPageData> =>
    withLatency(
        mutateGold(draft => {
            recalculateGoldPrediction(draft.prediction);
        }),
        540,
    );

export const updateGoldNewsVerification = (
    articleId: string,
    status: GoldNewsArticle['verificationStatus'],
): Promise<GoldPageData> =>
    withLatency(
        mutateGold(draft => {
            const article = findGoldNews(draft, articleId);
            if (!article) {
                return;
            }
            article.verificationStatus = status;
            const adjustment = status === 'Verified' ? -6 : 5;
            article.impactScore = clamp(article.impactScore + adjustment, 30, 100);
            if (status === 'Verified' && article.sentiment === 'Bearish') {
                article.sentiment = 'Neutral';
            }
        }),
        320,
    );

export const toggleGoldNewsWatchlist = (articleId: string): Promise<GoldPageData> =>
    withLatency(
        mutateGold(draft => {
            const article = findGoldNews(draft, articleId);
            if (article) {
                article.watchlisted = !article.watchlisted;
            }
        }),
        260,
    );

export const pinGoldNewsArticle = (articleId: string, pinned?: boolean): Promise<GoldPageData> =>
    withLatency(
        mutateGold(draft => {
            const article = findGoldNews(draft, articleId);
            if (!article) {
                return;
            }
            const next = typeof pinned === 'boolean' ? pinned : !article.pinned;
            if (next) {
                draft.news.forEach(item => {
                    if (item.id !== article.id) {
                        item.pinned = false;
                    }
                });
            }
            article.pinned = next;
        }),
        240,
    );

export const publishGoldToTelegram = (
    request: { channelId: string; templateId?: string; items: GoldPublishItem[] },
): Promise<GoldPublishResponse> => {
    const snapshot = cloneGold(ensureGold());
    const fallbackChannel = snapshot.telegram.channels.find(channel => channel.id === request.channelId)
        ?? snapshot.telegram.channels.find(channel => channel.id === snapshot.telegram.defaultChannelId)
        ?? snapshot.telegram.channels[0];

    if (!request.items.length || !fallbackChannel) {
        return withLatency({
            data: snapshot,
            channel: fallbackChannel ?? snapshot.telegram.channels[0],
            publishedAt: new Date().toISOString(),
            message: 'gold_publish_queue_empty',
        }, 180);
    }

    let publishedAt = new Date().toISOString();
    const updated = mutateGold(draft => {
        const channel = draft.telegram.channels.find(item => item.id === request.channelId)
            ?? draft.telegram.channels.find(item => item.id === draft.telegram.defaultChannelId);
        if (!channel) {
            throw new Error('gold_channel_not_found');
        }
        publishedAt = new Date().toISOString();
        channel.lastPublishedAt = publishedAt;
        draft.telegram.lastPublishedAt = publishedAt;
        draft.telegram.defaultChannelId = channel.id;
    });

    const channel = updated.telegram.channels.find(item => item.id === request.channelId)
        ?? updated.telegram.channels.find(item => item.id === updated.telegram.defaultChannelId)
        ?? updated.telegram.channels[0];

    return withLatency({
        data: updated,
        channel,
        publishedAt,
        message: request.templateId ? 'gold_publish_success_template' : 'gold_publish_success',
    }, 520);
};

export const createGoldAlert = (input: GoldAlertInput): Promise<GoldPageData> =>
    withLatency(
        mutateGold(draft => {
            const asset = draft.assets.find(item => item.id === input.assetId);
            const rawThreshold = Number.isFinite(input.threshold)
                ? Number(input.threshold)
                : 0;
            const normalizedThreshold = Number(rawThreshold.toFixed(2));
            const alert: GoldAlert = {
                id: generateGoldAlertId(),
                labelKey: input.labelKey ?? 'gold_alert_custom',
                direction: input.direction,
                threshold: normalizedThreshold,
                assetId: asset?.id ?? input.assetId,
                active: input.active ?? true,
                createdAt: new Date().toISOString(),
            };
            draft.alerts = [alert, ...draft.alerts];
        }),
        420,
    );

export const toggleGoldAlertActive = (alertId: string, active?: boolean): Promise<GoldPageData> =>
    withLatency(
        mutateGold(draft => {
            const alert = findGoldAlert(draft, alertId);
            if (!alert) {
                return;
            }
            alert.active = typeof active === 'boolean' ? active : !alert.active;
        }),
        300,
    );

export const updateGoldAlertThreshold = (alertId: string, threshold: number): Promise<GoldPageData> =>
    withLatency(
        mutateGold(draft => {
            const alert = findGoldAlert(draft, alertId);
            if (!alert) {
                return;
            }
            const normalized = Number.isFinite(threshold) ? Number(threshold.toFixed(2)) : alert.threshold;
            alert.threshold = normalized;
        }),
        320,
    );

export const acknowledgeGoldAlert = (alertId: string): Promise<GoldPageData> =>
    withLatency(
        mutateGold(draft => {
            const alert = findGoldAlert(draft, alertId);
            if (!alert) {
                return;
            }
            alert.lastTriggeredAt = new Date().toISOString();
        }),
        260,
    );

export const deleteGoldAlert = (alertId: string): Promise<GoldPageData> =>
    withLatency(
        mutateGold(draft => {
            draft.alerts = draft.alerts.filter(alert => alert.id !== alertId);
        }),
        350,
    );

export const fetchConnectionSettings = (): Promise<{ apiKey: string, apiSecret: string, isConnected: boolean }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(db.connectionSettings);
        }, FAKE_LATENCY);
    });
}

export const saveConnectionSettings = (settings: { apiKey: string, apiSecret: string, isConnected: boolean }): Promise<void> => {
     return new Promise(resolve => {
        setTimeout(() => {
            db.connectionSettings = settings;
            resolve();
        }, 500);
    });
}

export const testMexcConnection = (key: string, secret: string): Promise<{ success: boolean, message: string }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            if (key.length > 5 && secret.length > 5) {
                resolve({ success: true, message: "Connection successful!" });
            } else {
                resolve({ success: false, message: "Connection failed. Please check your keys." });
            }
        }, 1000);
    });
}

export const fetchNotificationSettings = (): Promise<{ botToken: string, channelId: string }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(db.notificationSettings);
        }, FAKE_LATENCY);
    });
}

export const saveNotificationSettings = (settings: { botToken: string, channelId: string }): Promise<void> => {
    return new Promise(resolve => {
        setTimeout(() => {
            db.notificationSettings = settings;
            resolve();
        }, 500);
    });
};

export const sendTestTelegramMessage = (botToken: string, channelId: string): Promise<{ success: boolean, message: string }> => {
     return new Promise(resolve => {
        setTimeout(() => {
            if (botToken && channelId) {
                resolve({ success: true, message: "Test message sent successfully!" });
            } else {
                resolve({ success: false, message: "Failed. Check token and ID." });
            }
        }, 1000);
    });
}

export const fetchAIManagerData = (): Promise<AIManagerOverview> =>
    new Promise(resolve => {
        setTimeout(() => {
            resolve(cloneAIManagerOverview(ensureAICenter().overview));
        }, FAKE_LATENCY);
    });

export const fetchAIAgents = (): Promise<AIAgent[]> =>
    new Promise(resolve => {
        setTimeout(() => {
            resolve(ensureAICenter().agents.map(cloneAIAgent));
        }, FAKE_LATENCY);
    });

export const fetchTrainingData = (): Promise<AITrainingStats> =>
    new Promise(resolve => {
        setTimeout(() => {
            resolve(cloneAITrainingStats(ensureAICenter().training));
        }, FAKE_LATENCY);
    });

export const fetchAnalyticsData = (): Promise<AIAnalyticsMetrics> =>
    new Promise(resolve => {
        setTimeout(() => {
            resolve(cloneAIAnalytics(ensureAICenter().analytics));
        }, FAKE_LATENCY);
    });

export const fetchAPIConfigData = (): Promise<AIAPIConfigData> =>
    new Promise(resolve => {
        setTimeout(() => {
            resolve(cloneAIAPIConfig(ensureAICenter().apiConfig));
        }, FAKE_LATENCY);
    });

export const updateAIAgent = (
    agentId: string,
    updates: Partial<Pick<AIAgent, 'status' | 'trainingProgress' | 'accuracy' | 'decisions' | 'learningTime' | 'knowledgeSize'>>,
): Promise<AIAgent> =>
    new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const result = mutateAICenter(draft => {
                    const agent = draft.agents.find(item => item.id === agentId);
                    if (!agent) {
                        throw new Error('Agent not found');
                    }

                    if (updates.trainingProgress !== undefined) {
                        agent.trainingProgress = Math.max(0, Math.min(100, updates.trainingProgress));
                    }
                    if (updates.accuracy !== undefined) {
                        agent.accuracy = Number(Math.max(0, Math.min(100, updates.accuracy)).toFixed(1));
                    }
                    if (updates.decisions !== undefined) {
                        agent.decisions = Math.max(0, Math.round(updates.decisions));
                    }
                    if (updates.learningTime !== undefined) {
                        agent.learningTime = Math.max(0, Math.round(updates.learningTime));
                    }
                    if (updates.knowledgeSize !== undefined) {
                        agent.knowledgeSize = Math.max(0, updates.knowledgeSize);
                    }
                    if (updates.status) {
                        agent.status = updates.status;
                    }

                    agent.lastUpdate = new Date().toISOString();
                    refreshAIOverview(draft);
                    updateAnalyticsTimestamp(draft);
                });

                const updatedAgent = result.agents.find(item => item.id === agentId);
                if (!updatedAgent) {
                    throw new Error('Agent not found after update');
                }

                resolve(cloneAIAgent(updatedAgent));
            } catch (error) {
                reject(error);
            }
        }, FAKE_LATENCY);
    });

export const scheduleAITrainingSession = (
    input: {
        title: string;
        mode: AITrainingMode;
        agentIds: string[];
        expectedCompletionMinutes: number;
        startInMinutes?: number;
    },
): Promise<AITrainingStats> =>
    new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const result = mutateAICenter(draft => {
                    const session: AITrainingSession = {
                        id: `session-${Date.now()}`,
                        title: input.title,
                        mode: input.mode,
                        agentIds: [...input.agentIds],
                        status: 'scheduled',
                        startedAt: new Date(Date.now() + (input.startInMinutes ?? 5) * 60 * 1000).toISOString(),
                        expectedCompletionMinutes: input.expectedCompletionMinutes,
                    };

                    draft.training.queue.push(session);
                    draft.training.sessions += 1;
                    updateTrainingTimestamp(draft);
                    updateActiveTrainingAgents(draft);
                });

                resolve(cloneAITrainingStats(result.training));
            } catch (error) {
                reject(error);
            }
        }, FAKE_LATENCY);
    });

export const completeAITrainingSession = (
    sessionId: string,
    accuracyGain: number,
): Promise<AITrainingStats> =>
    new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const result = mutateAICenter(draft => {
                    const runningIndex = draft.training.runningSessions.findIndex(session => session.id === sessionId);
                    if (runningIndex === -1) {
                        throw new Error('Training session is not running');
                    }

                    const runningSession = draft.training.runningSessions.splice(runningIndex, 1)[0];
                    const completed: AITrainingSession = {
                        ...runningSession,
                        status: 'completed',
                        completedAt: new Date().toISOString(),
                        accuracyGain,
                    };

                    draft.training.recentHistory = [completed, ...draft.training.recentHistory].slice(0, 12);

                    const perAgentGain = accuracyGain / Math.max(1, completed.agentIds.length);
                    completed.agentIds.forEach(agentId => {
                        const agent = draft.agents.find(item => item.id === agentId);
                        if (agent) {
                            agent.accuracy = Number(Math.min(100, agent.accuracy + perAgentGain).toFixed(1));
                            agent.trainingProgress = Math.min(100, Number((agent.trainingProgress + 5).toFixed(1)));
                            agent.lastUpdate = new Date().toISOString();
                        }
                    });

                    const nextSession = draft.training.queue.shift();
                    if (nextSession) {
                        nextSession.status = 'running';
                        nextSession.startedAt = new Date().toISOString();
                        draft.training.runningSessions.push(nextSession);
                    }

                    updateActiveTrainingAgents(draft);
                    updateTrainingTimestamp(draft);
                    refreshAIOverview(draft);
                    updateAnalyticsTimestamp(draft);
                });

                resolve(cloneAITrainingStats(result.training));
            } catch (error) {
                reject(error);
            }
        }, FAKE_LATENCY);
    });

export const updateAIProviderStats = (
    providerId: AIProvider['id'],
    updates: Partial<Pick<AIProvider, 'usage' | 'performance'>>,
): Promise<AIManagerOverview> =>
    new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const result = mutateAICenter(draft => {
                    const provider = draft.overview.providers.find(item => item.id === providerId);
                    if (!provider) {
                        throw new Error('Provider not found');
                    }

                    if (updates.usage !== undefined) {
                        provider.usage = Math.max(0, updates.usage);
                    }

                    if (updates.performance !== undefined) {
                        provider.performance = Math.max(0, Math.min(100, updates.performance));
                    }

                    draft.overview.providers = draft.overview.providers.map(cloneAIProvider);
                    draft.overview.lastUpdated = new Date().toISOString();
                });

                resolve(cloneAIManagerOverview(result.overview));
            } catch (error) {
                reject(error);
            }
        }, FAKE_LATENCY);
    });

export const testAIIntegration = (
    serviceId: string,
    succeed = true,
): Promise<APIServiceIntegration> =>
    new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const result = mutateAICenter(draft => {
                    const service = findIntegrationById(draft.apiConfig, serviceId);
                    if (!service) {
                        throw new Error('Integration not found');
                    }

                    service.lastTestedAt = new Date().toISOString();
                    if (succeed) {
                        service.connected = true;
                        service.issues = undefined;
                    } else {
                        service.connected = false;
                        service.issues = 'Connection test failed';
                    }

                    updateAPIConfigTimestamp(draft);
                });

                const updated = findIntegrationById(result.apiConfig, serviceId);
                if (!updated) {
                    throw new Error('Integration not found after update');
                }

                resolve(cloneAPIServiceIntegration(updated));
            } catch (error) {
                reject(error);
            }
        }, FAKE_LATENCY);
    });

export const fetchWalletData = (): Promise<WalletSettingsData> =>
    withLatency(cloneWalletSettings(ensureWalletSettings()), 480);

export const updateWalletPreferences = (preferences: WalletPreferences): Promise<WalletSettingsData> =>
    withLatency(
        mutateWalletSettings(draft => {
            draft.preferences = { ...preferences };
        }),
        520,
    );

export const toggleWalletSecurityControl = (controlId: string, enabled?: boolean): Promise<WalletSettingsData> =>
    withLatency(
        mutateWalletSettings(draft => {
            const control = draft.securityControls.find(item => item.id === controlId);
            if (!control) {
                return;
            }
            control.enabled = typeof enabled === 'boolean' ? enabled : !control.enabled;
        }),
        420,
    );

export const refreshWalletConnector = (
    connectorId: string,
    status: WalletConnector['status'] = 'connected',
): Promise<WalletSettingsData> =>
    withLatency(
        mutateWalletSettings(draft => {
            const connector = draft.connectors.find(item => item.id === connectorId);
            if (!connector) {
                return;
            }
            connector.status = status;
            connector.lastSyncedAt = new Date().toISOString();
        }),
        650,
    );

export const fetchAutomationSettings = (): Promise<{ dataSources: DataSource[], telegramConfigs: TelegramPublisherConfig[], workflows: Workflow[] }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(db.automationSettings);
        }, FAKE_LATENCY);
    });
};

export const saveAutomationSettings = (settings: { dataSources: DataSource[], telegramConfigs: TelegramPublisherConfig[], workflows: Workflow[] }): Promise<void> => {
    return new Promise(resolve => {
        setTimeout(() => {
            db.automationSettings.dataSources = settings.dataSources;
            db.automationSettings.telegramConfigs = settings.telegramConfigs;
            db.automationSettings.workflows = settings.workflows;
            resolve();
        }, 500);
    });
};

export const fetchProfileSettings = (): Promise<ProfileSettingsData> =>
    withLatency(cloneProfileSettings(ensureProfileSettings()), 420);

export const saveProfileDetails = (updates: ProfileDetailsUpdate): Promise<ProfileSettingsData> =>
    withLatency(
        mutateProfileSettings(draft => {
            draft.profile = { ...draft.profile, ...updates };
            draft.activity = [
                {
                    id: `profile-activity-${Math.random().toString(36).slice(2, 8)}`,
                    timestamp: new Date().toISOString(),
                    messageKey: 'profile_activity_details_updated',
                    context: draft.profile.fullName,
                },
                ...draft.activity,
            ].slice(0, 8);
        }),
        560,
    );

export const saveProfileCommunications = (preferences: ProfileCommunicationSettings): Promise<ProfileSettingsData> =>
    withLatency(
        mutateProfileSettings(draft => {
            draft.communications = { ...preferences };
            draft.activity = [
                {
                    id: `profile-activity-${Math.random().toString(36).slice(2, 8)}`,
                    timestamp: new Date().toISOString(),
                    messageKey: 'profile_activity_preferences_updated',
                },
                ...draft.activity,
            ].slice(0, 8);
        }),
        480,
    );

export const changeProfilePassword = ({ currentPassword, newPassword }: ProfilePasswordChangeRequest): Promise<{ success: boolean; message: string }> =>
    new Promise(resolve => {
        setTimeout(() => {
            const profile = ensureProfileSettings();
            const userRecord = db.users.find(user => user.email === profile.profile.email)
                ?? db.users[0];

            if (!userRecord) {
                resolve({ success: false, message: 'profile_password_error_user_missing' });
                return;
            }

            if (newPassword.length < 8) {
                resolve({ success: false, message: 'profile_password_error_length' });
                return;
            }

            if (userRecord.password !== currentPassword) {
                resolve({ success: false, message: 'profile_password_error_current' });
                return;
            }

            userRecord.password = newPassword;
            mutateProfileSettings(draft => {
                draft.activity = [
                    {
                        id: `profile-activity-${Math.random().toString(36).slice(2, 8)}`,
                        timestamp: new Date().toISOString(),
                        messageKey: 'profile_activity_password_changed',
                    },
                    ...draft.activity,
                ].slice(0, 8);
            });

            resolve({ success: true, message: 'profile_password_success' });
        }, 700);
    });

export const fetchSecuritySettings = (): Promise<SecuritySettingsData> =>
    withLatency(cloneSecuritySettings(ensureSecuritySettings()), 400);

export const toggleTwoFactorAuth = (enabled?: boolean): Promise<SecuritySettingsData> =>
    withLatency(
        mutateSecuritySettings(draft => {
            const next = typeof enabled === 'boolean' ? enabled : !draft.twoFactor.enabled;
            draft.twoFactor.enabled = next;
            draft.twoFactor.lastUpdated = new Date().toISOString();
            if (next && draft.twoFactor.backupCodesRemaining === 0) {
                draft.twoFactor.backupCodesRemaining = 8;
            }
            if (!next) {
                draft.twoFactor.backupCodesRemaining = 0;
            }
            draft.events = [
                {
                    id: `security-event-${Math.random().toString(36).slice(2, 8)}`,
                    timestamp: new Date().toISOString(),
                    titleKey: next ? 'security_event_2fa_enabled' : 'security_event_2fa_disabled',
                    descriptionKey: next ? 'security_event_2fa_enabled_desc' : 'security_event_2fa_disabled_desc',
                    severity: next ? 'low' : 'medium',
                },
                ...draft.events,
            ].slice(0, 8);
        }),
        520,
    );

export const updateSecurityAlerts = (alerts: SecurityAlertSettings): Promise<SecuritySettingsData> =>
    withLatency(
        mutateSecuritySettings(draft => {
            draft.alerts = { ...alerts };
        }),
        360,
    );

export const revokeSecuritySession = (sessionId: string): Promise<SecuritySettingsData> =>
    withLatency(
        mutateSecuritySettings(draft => {
            const session = draft.sessions.find(item => item.id === sessionId);
            if (!session) {
                return;
            }
            if (session.current) {
                session.current = false;
                session.lastActiveAt = new Date().toISOString();
            } else {
                draft.sessions = draft.sessions.filter(item => item.id !== sessionId);
            }
            draft.events = [
                {
                    id: `security-event-${Math.random().toString(36).slice(2, 8)}`,
                    timestamp: new Date().toISOString(),
                    titleKey: 'security_event_session_revoked',
                    descriptionKey: 'security_event_session_revoked_desc',
                    severity: 'medium',
                },
                ...draft.events,
            ].slice(0, 8);
        }),
        460,
    );

export const generateSecurityBackupCodes = (count = 8): Promise<{ codes: string[]; data: SecuritySettingsData }> =>
    new Promise(resolve => {
        setTimeout(() => {
            const codes = Array.from({ length: count }, () => Math.random().toString(36).slice(2, 8).toUpperCase());
            const updated = mutateSecuritySettings(draft => {
                draft.twoFactor.backupCodesRemaining = count;
                draft.twoFactor.lastUpdated = new Date().toISOString();
            });
            resolve({ codes, data: updated });
        }, 620);
    });

export const fetchUserManagement = (): Promise<UserManagementData> =>
    withLatency(cloneUserManagement(ensureUserManagement()), 520);

export const updateManagedUserRole = (userId: string, roleKey: string): Promise<UserManagementData> =>
    withLatency(
        mutateUserManagement(draft => {
            const user = draft.users.find(item => item.id === userId);
            if (user) {
                user.roleKey = roleKey;
            }
        }),
        420,
    );

export const toggleManagedUserStatus = (
    userId: string,
    status?: ManagedUser['status'],
): Promise<UserManagementData> =>
    withLatency(
        mutateUserManagement(draft => {
            const user = draft.users.find(item => item.id === userId);
            if (!user) {
                return;
            }
            if (status) {
                user.status = status;
            } else {
                user.status = user.status === 'suspended' ? 'active' : 'suspended';
            }
            if (user.status === 'active') {
                user.lastActiveAt = new Date().toISOString();
            }
        }),
        480,
    );

export const removeManagedUser = (userId: string): Promise<UserManagementData> =>
    withLatency(
        mutateUserManagement(draft => {
            draft.users = draft.users.filter(item => item.id !== userId);
        }),
        440,
    );

export const inviteManagedUser = (email: string, roleKey: string): Promise<UserManagementData> =>
    withLatency(
        mutateUserManagement(draft => {
            userInviteSequence += 1;
            const invitation: UserInvitation = {
                id: `invite-${userInviteSequence}`,
                email,
                roleKey,
                invitedAt: new Date().toISOString(),
                invitedBy: draft.users.find(user => user.roleKey === 'role_admin')?.name ?? 'Titan Admin',
                lastSentAt: new Date().toISOString(),
            };
            draft.invitations = [invitation, ...draft.invitations].slice(0, 8);
        }),
        600,
    );

export const resendUserInvitation = (invitationId: string): Promise<{ success: boolean; invitation?: UserInvitation }> =>
    new Promise(resolve => {
        setTimeout(() => {
            const updated = mutateUserManagement(draft => {
                const invitation = draft.invitations.find(item => item.id === invitationId);
                if (invitation) {
                    invitation.lastSentAt = new Date().toISOString();
                }
            });
            const invitation = updated.invitations.find(item => item.id === invitationId);
            resolve({ success: Boolean(invitation), invitation });
        }, 520);
    });