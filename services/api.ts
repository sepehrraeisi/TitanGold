import { _data } from './_data.ts';
import type { User, FavoriteItem, CryptoAsset, Strategy, PortfolioAsset, RiskMetric, AnalysisStat, SmartPrediction, PerformanceTrade, NewsArticle, EconomicEvent, AIAgent, AIProvider, AIAnalyticsMetrics, GoldAsset, GoldPrediction, GoldNewsArticle, DataSource, TelegramPublisherConfig, Workflow, AutopilotState, AutopilotMode, AutopilotRiskLevel, AutopilotQuickAction, AutopilotQuickActionResult, TradingDashboardData, TradingKPI, TradingTimeRange, ChartPoint, Trade } from '../types.ts';

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

const mutateTradingDashboard = (
    mutator: (draft: TradingDashboardData) => void
): TradingDashboardData => {
    const base = cloneTradingDashboard(ensureTradingDashboard());
    mutator(base);
    base.lastUpdated = new Date().toISOString();
    db.tradingDashboard = base;
    return cloneTradingDashboard(base);
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

export const fetchFavoritesPageData = (): Promise<{ favorites: FavoriteItem[], gainers: any[], losers: any[], trending: any[] }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                favorites: db.favorites,
                gainers: db.marketMovers.gainers,
                losers: db.marketMovers.losers,
                trending: db.marketMovers.trending,
            });
        }, FAKE_LATENCY);
    });
};

export const addFavorite = (assetId: string): Promise<FavoriteItem[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const assetToAdd = _data.allAssets.find(a => a.id === assetId);
            if (assetToAdd && !db.favorites.some(f => f.id === assetId)) {
                const newFavorite: FavoriteItem = {
                    id: assetToAdd.id,
                    symbol: assetToAdd.symbol,
                    name: assetToAdd.name,
                    price: 100 + Math.random() * 1000,
                    change24h: (Math.random() - 0.5) * 10,
                    volume: `${(Math.random() * 100).toFixed(2)}M`,
                    hasAlert: false
                };
                db.favorites.unshift(newFavorite);
            }
            resolve([...db.favorites]);
        }, 300);
    });
};

export const removeFavorite = (itemId: string): Promise<FavoriteItem[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            db.favorites = db.favorites.filter(f => f.id !== itemId);
            resolve([...db.favorites]);
        }, 300);
    });
}


export const fetchStrategies = (): Promise<Strategy[]> => {
    return new Promise(resolve => {
        setTimeout(() => resolve(db.strategies), FAKE_LATENCY);
    });
};

export const fetchPortfolioPageData = (): Promise<{ stats: any[], assets: PortfolioAsset[], riskMetrics: RiskMetric[] }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                stats: db.portfolioStats,
                assets: db.portfolioAssets,
                riskMetrics: db.riskMetrics,
            });
        }, FAKE_LATENCY);
    });
};

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