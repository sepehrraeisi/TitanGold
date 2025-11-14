import { _data } from './_data.ts';
import type { User, FavoriteItem, CryptoAsset, Strategy, PortfolioAsset, RiskMetric, AnalysisStat, SmartPrediction, PerformanceTrade, NewsArticle, EconomicEvent, AIAgent, AIProvider, AIAnalyticsMetrics, GoldAsset, GoldPrediction, GoldNewsArticle, DataSource, TelegramPublisherConfig, Workflow } from '../types.ts';

// --- SIMULATED BACKEND ---

const FAKE_LATENCY = 800;

// Simulate a database
let db = { ..._data };

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