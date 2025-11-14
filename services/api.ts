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
    SmartPrediction,
    PerformanceTrade,
    NewsArticle,
    EconomicEvent,
    AIAgent,
    AIProvider,
    AIAnalyticsMetrics,
    GoldAsset,
    GoldPrediction,
    GoldNewsArticle,
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
} from '../types.ts';

// --- SIMULATED BACKEND ---

const FAKE_LATENCY = 800;

// Simulate a database
let db: typeof _data = { ..._data };

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

export const fetchAnalysisPageData = (): Promise<{ stats: AnalysisStat[], predictions: SmartPrediction[], trades: PerformanceTrade[] }> => {
     return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                stats: db.analysisStats,
                predictions: db.smartPredictions,
                trades: db.performanceTrades,
            });
        }, FAKE_LATENCY);
    });
};

export const fetchNewsPageData = (): Promise<{ articles: NewsArticle[], events: EconomicEvent[] }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                articles: db.newsArticles,
                events: db.economicEvents,
            });
        }, FAKE_LATENCY);
    });
};

export const fetchGoldPageData = (): Promise<{ assets: GoldAsset[], prediction: GoldPrediction, news: GoldNewsArticle[] }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                assets: db.goldAssets,
                prediction: db.goldPrediction,
                news: db.goldNews,
            });
        }, FAKE_LATENCY);
    });
};

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

export const fetchAIManagerData = (): Promise<{ summary: any, providers: AIProvider[], topAgents: any[] }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                summary: db.aiSystemSummary,
                providers: db.aiProviders,
                topAgents: db.aiAgents.slice(0, 5).sort((a, b) => b.accuracy - a.accuracy)
            });
        }, FAKE_LATENCY);
    });
}

export const fetchAIAgents = (): Promise<AIAgent[]> => {
    return new Promise(resolve => setTimeout(() => resolve(db.aiAgents), FAKE_LATENCY));
}

export const fetchTrainingData = (): Promise<any> => {
    return new Promise(resolve => setTimeout(() => resolve({ sessions: 4388, avgAccuracy: 89.7 }), FAKE_LATENCY));
}

export const fetchAnalyticsData = (): Promise<AIAnalyticsMetrics> => {
    return new Promise(resolve => setTimeout(() => resolve(db.aiAnalytics), FAKE_LATENCY));
}

export const fetchAPIConfigData = (): Promise<any> => {
    return new Promise(resolve => setTimeout(() => resolve({}), FAKE_LATENCY));
}

export const fetchWalletData = (): Promise<any> => {
    return new Promise(resolve => setTimeout(() => resolve(db.walletData), FAKE_LATENCY));
}

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
            console.log("Saved Automation Settings:", settings);
            resolve();
        }, 500);
    });
};