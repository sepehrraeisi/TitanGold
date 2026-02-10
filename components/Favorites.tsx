import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { FavoriteItem, MarketMover, CryptoAsset, FavoritesPageData, FavoriteAlertInput } from '../types.ts';
import AddFavoriteModal from './modals/AddFavoriteModal.tsx';
import SetAlertModal from './modals/SetAlertModal.tsx';
import ActionMenu from './favorites/ActionMenu.tsx';
import MiniChart from './favorites/MiniChart.tsx';
import FavoritesAnalytics from './favorites/FavoritesAnalytics.tsx';
import * as api from '../services/api.ts';
import favoritesService from '../services/favorites.ts';
import { useWebSocket, WebSocketMessage } from '../hooks/useWebSocket.ts';
import { AIAgent } from '../types.ts';

// Market Stats Widget Component
const MarketStatsWidget: React.FC = () => {
    const { t } = useLanguage();
    const [stats, setStats] = useState<{
        btcDominance: number;
        ethDominance: number;
        totalVolume24h: number;
        totalMarketCap: number;
    } | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const marketStats = await api.fetchMexcMarketStats();
                setStats(marketStats);
            } catch (error) {
                console.error('Failed to fetch market stats:', error);
            }
        };
        fetchStats();
        // Refresh market stats every 60 seconds (less frequent, not critical)
        const interval = setInterval(fetchStats, 60000);
        return () => clearInterval(interval);
    }, []);

    const formatVolume = (volume: number): string => {
        if (volume >= 1000000000000) {
            return `$${(volume / 1000000000000).toFixed(2)}T`;
        } else if (volume >= 1000000000) {
            return `$${(volume / 1000000000).toFixed(2)}B`;
        } else if (volume >= 1000000) {
            return `$${(volume / 1000000).toFixed(2)}M`;
        }
        return `$${volume.toFixed(2)}`;
    };

    return (
        <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-lg">
                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <h3 className="text-sm font-semibold text-gray-300">{t('overall_market_stats')}</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-800/30 rounded-lg p-3 hover:bg-gray-800/50 transition-colors">
                    <p className="text-xs text-gray-400 mb-1">{t('btc_dominance')}</p>
                    <p className="font-bold text-white text-lg">
                        {stats ? `${stats.btcDominance.toFixed(2)}%` : '...'}
                    </p>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-3 hover:bg-gray-800/50 transition-colors">
                    <p className="text-xs text-gray-400 mb-1">{t('eth_dominance')}</p>
                    <p className="font-bold text-white text-lg">
                        {stats ? `${stats.ethDominance.toFixed(2)}%` : '...'}
                    </p>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-3 hover:bg-gray-800/50 transition-colors">
                    <p className="text-xs text-gray-400 mb-1">{t('24h_volume')}</p>
                    <p className="font-bold text-white text-lg">
                        {stats ? formatVolume(stats.totalVolume24h) : '...'}
                    </p>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-3 hover:bg-gray-800/50 transition-colors">
                    <p className="text-xs text-gray-400 mb-1">{t('market_cap')}</p>
                    <p className="font-bold text-white text-lg">
                        {stats ? formatVolume(stats.totalMarketCap) : '...'}
                    </p>
                </div>
            </div>
        </div>
    );
};

const SummaryCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color?: string; }> = ({ title, value, icon, color = 'purple' }) => {
    const colorClasses = {
        purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-300',
        yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-300',
        green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-300',
        red: 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-300',
    };

    const iconBgClasses = {
        purple: 'bg-gradient-to-br from-purple-500/30 to-purple-600/20',
        yellow: 'bg-gradient-to-br from-yellow-500/30 to-yellow-600/20',
        green: 'bg-gradient-to-br from-green-500/30 to-green-600/20',
        red: 'bg-gradient-to-br from-red-500/30 to-red-600/20',
    };

    return (
        <div className={`bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border ${colorClasses[color as keyof typeof colorClasses]} rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]`}>
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{title}</p>
                    <p className="text-2xl font-bold text-white">{value}</p>
                </div>
                <div className={`${iconBgClasses[color as keyof typeof iconBgClasses]} p-3 rounded-xl`}>
                    {icon}
                </div>
            </div>
        </div>
    );
};

const FearAndGreedGauge: React.FC<{ value: number; agents?: AIAgent[]; fearGreedData?: { index: number; label: string } }> = ({ value, agents = [], fearGreedData }) => {
    const { t } = useLanguage();
    const percentage = value / 100;
    const strokeDashoffset = 282.7 * (1 - (percentage * 0.5)); // Semicircle

    let colorClass = 'text-green-500';
    let bgGradient = 'from-green-500/20 to-emerald-500/10';
    let borderColor = 'border-green-500/30';
    let label = t('greed') || 'Greed';

    if (value < 25) {
        colorClass = 'text-red-500';
        bgGradient = 'from-red-500/20 to-rose-500/10';
        borderColor = 'border-red-500/30';
        label = t('fear') || 'Fear';
    } else if (value < 45) {
        colorClass = 'text-yellow-500';
        bgGradient = 'from-yellow-500/20 to-orange-500/10';
        borderColor = 'border-yellow-500/30';
        label = t('neutral') || 'Neutral';
    }

    // Filter relevant agents (Sentiment Analysis, Market Intelligence, Fundamental Analysis)
    const relevantAgents = agents.filter(agent =>
        agent.id === '3' || // Sentiment Analysis
        agent.id === '13' || // Market Intelligence
        agent.id === '12' // Fundamental Analysis
    );

    const getAgentName = (agentId: string) => {
        const names: Record<string, string> = {
            '3': 'Sentiment Analysis',
            '12': 'Fundamental Analysis',
            '13': 'Market Intelligence'
        };
        return names[agentId] || 'AI Agent';
    };

    const getAgentStatus = (agent: AIAgent) => {
        if (agent.status === 'active') return 'active';
        if (agent.status === 'training') return 'training';
        return 'inactive';
    };

    return (
        <div className={`bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border ${borderColor} rounded-xl p-5 shadow-lg h-full flex flex-col`}>
            <div className="flex items-center justify-between w-full mb-3">
                <div className="flex items-center gap-2">
                    <div className={`p-2 bg-gradient-to-br ${bgGradient} rounded-lg`}>
                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-300">{t('fear_and_greed')}</h3>
                </div>
            </div>

            <div className="relative flex-1 flex items-center justify-center mb-4">
                <svg className="h-32 w-32 transform" viewBox="0 0 100 100">
                    <defs>
                        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
                        </linearGradient>
                    </defs>
                    <path d="M 10 50 A 40 40 0 0 1 90 50" strokeWidth="12" stroke="currentColor" fill="none" className="text-gray-800/50" />
                    <path d="M 10 50 A 40 40 0 0 1 90 50" strokeWidth="12" stroke="currentColor" fill="none" className={`${colorClass} drop-shadow-[0_0_8px_currentColor]`}
                        strokeDasharray="282.7"
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white drop-shadow-lg">{value}</span>
                    <span className={`text-xs font-semibold ${colorClass} mt-1`}>{label}</span>
                </div>
            </div>

            {/* AI Agents Status */}
            {relevantAgents.length > 0 && (
                <div className="mt-auto pt-4 border-t border-gray-700/50">
                    <p className="text-xs text-gray-400 mb-2 font-medium">{t('monitoring_agents') || 'Monitoring Agents'}</p>
                    <div className="space-y-2">
                        {relevantAgents.map(agent => {
                            const status = getAgentStatus(agent);
                            const statusColor = status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                status === 'training' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                    'bg-gray-500/20 text-gray-400 border-gray-500/30';

                            // Get agent output/result
                            const getAgentOutput = (agent: AIAgent) => {
                                if (agent.id === '3') {
                                    // Sentiment Analysis
                                    const sentiment = agent.lastSentimentAnalysis;
                                    if (sentiment) {
                                        const score = sentiment.overallScore || sentiment.marketContext?.fearGreedIndex || 0;
                                        return {
                                            value: score,
                                            label: sentiment.bias || sentiment.marketContext?.fearGreedLabel || 'Neutral',
                                            color: score >= 60 ? 'text-green-400' : score <= 40 ? 'text-red-400' : 'text-yellow-400'
                                        };
                                    }
                                    // Fallback: Use Fear & Greed Index value from prop or gauge
                                    const fgValue = fearGreedData?.index ?? value;
                                    const fgLabel = fearGreedData?.label ?? label;
                                    return {
                                        value: fgValue,
                                        label: fgLabel,
                                        color: fgValue >= 60 ? 'text-green-400' : fgValue <= 40 ? 'text-red-400' : 'text-yellow-400'
                                    };
                                } else if (agent.id === '13') {
                                    // Market Intelligence
                                    const intelligence = agent.lastMarketIntelligenceResult;
                                    if (intelligence && intelligence.summary) {
                                        const accuracy = intelligence.summary.signalAccuracy || intelligence.summary.predictionSuccess || 0;
                                        return {
                                            value: accuracy,
                                            label: `${intelligence.summary.roiPercent?.toFixed(1) || 0}% ROI`,
                                            color: accuracy >= 70 ? 'text-green-400' : accuracy <= 50 ? 'text-red-400' : 'text-yellow-400'
                                        };
                                    }
                                    // Fallback: Show accuracy from agent metrics
                                    if (agent.accuracy) {
                                        return {
                                            value: agent.accuracy,
                                            label: 'Accuracy',
                                            color: agent.accuracy >= 80 ? 'text-green-400' : agent.accuracy <= 60 ? 'text-red-400' : 'text-yellow-400'
                                        };
                                    }
                                    // Default fallback: Show accuracy from agent metrics or 0
                                    return {
                                        value: agent.accuracy || 0,
                                        label: agent.accuracy ? 'Accuracy' : 'No data',
                                        color: agent.accuracy ? (agent.accuracy >= 80 ? 'text-green-400' : agent.accuracy <= 60 ? 'text-red-400' : 'text-yellow-400') : 'text-gray-400'
                                    };
                                } else if (agent.id === '12') {
                                    // Fundamental Analysis
                                    const fundamental = agent.lastFundamentalAnalysis;
                                    if (fundamental) {
                                        const score = fundamental.averageScore || 0;
                                        return {
                                            value: score,
                                            label: fundamental.marketSummary?.macroLabel || 'Neutral',
                                            color: score >= 60 ? 'text-green-400' : score <= 40 ? 'text-red-400' : 'text-yellow-400'
                                        };
                                    }
                                    // Fallback: Use Fear & Greed Index value from prop or gauge
                                    const fgValue = fearGreedData?.index ?? value;
                                    const fgLabel = fearGreedData?.label ?? label;
                                    return {
                                        value: fgValue,
                                        label: fgLabel,
                                        color: fgValue >= 60 ? 'text-green-400' : fgValue <= 40 ? 'text-red-400' : 'text-yellow-400'
                                    };
                                }
                                // Should never reach here, but just in case
                                return {
                                    value: 0,
                                    label: 'No data',
                                    color: 'text-gray-400'
                                };
                            };

                            const output = getAgentOutput(agent);

                            return (
                                <div key={agent.id} className={`p-3 rounded-lg border ${statusColor} text-xs transition-all duration-200 hover:shadow-lg`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-gray-200 truncate">{getAgentName(agent.id)}</span>
                                        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                                            <div className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-green-400 animate-pulse shadow-[0_0_4px_rgba(74,222,128,0.8)]' : status === 'training' ? 'bg-yellow-400 animate-pulse shadow-[0_0_4px_rgba(250,204,21,0.8)]' : 'bg-gray-500'}`}></div>
                                            <span className="text-[10px] font-semibold text-gray-300">
                                                {status === 'active' ? (t('active') || 'Active') :
                                                    status === 'training' ? (t('training') || 'Training') :
                                                        (t('inactive') || 'Inactive')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-gray-700/40">
                                        <span className={`text-[11px] font-medium ${(typeof output.value === 'number' && output.value === 0) || (typeof output.value === 'string' && output.value === '--') ? 'text-gray-500' : 'text-gray-300'}`}>
                                            {output.label || '--'}
                                        </span>
                                        <span className={`text-base font-bold ${output.color} drop-shadow-sm`}>
                                            {typeof output.value === 'number' ? (output.value === 0 ? '--' : output.value.toFixed(0)) : output.value}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const MoversList: React.FC<{ title: string; data: MarketMover[]; isGainers: boolean }> = ({ title, data, isGainers }) => {
    const colorClass = isGainers ? 'text-green-400' : 'text-red-400';
    const bgGradient = isGainers ? 'from-green-500/20 to-emerald-500/10' : 'from-red-500/20 to-rose-500/10';
    const borderColor = isGainers ? 'border-green-500/30' : 'border-red-500/30';
    const iconBg = isGainers ? 'bg-green-500/20' : 'bg-red-500/20';

    return (
        <div className={`bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border ${borderColor} rounded-xl p-5 shadow-lg h-full`}>
            <div className="flex items-center gap-2 mb-4">
                <div className={`p-2 ${iconBg} rounded-lg`}>
                    {isGainers ? (
                        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                        </svg>
                    )}
                </div>
                <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
            </div>
            <div className="space-y-2">
                {data.map(item => (
                    <div
                        key={item.id}
                        className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-all duration-200 group"
                    >
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate">{item.symbol}</p>
                            <p className="text-xs text-gray-400 truncate">{item.name}</p>
                        </div>
                        <span className={`font-bold text-lg ml-3 ${colorClass} drop-shadow-lg`}>
                            {isGainers ? '+' : ''}{item.change.toFixed(2)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

import type { ViewKey, OnNavigateHandler } from '../types/navigation.ts';

const Favorites: React.FC<{ onNavigate: OnNavigateHandler }> = ({ onNavigate }) => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<FavoritesPageData | null>(null);
    const [aiAgents, setAiAgents] = useState<AIAgent[]>([]);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<FavoriteItem | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [sortBy, setSortBy] = useState<'symbol' | 'price' | 'change24h' | 'volume'>('symbol');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [filterBy, setFilterBy] = useState<'all' | 'gainers' | 'decliners' | 'alerts'>('all');
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [fearGreedIndex, setFearGreedIndex] = useState<{ index: number; label: string } | null>(null);

    // 🚀 WebSocket for Real-time Price Updates (TEMPORARILY DISABLED - using polling instead)
    // Token: align with rest of app (titan_token), fallback to sessionStorage, optional for cookie-based auth
    const authToken = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token') || undefined;

    // 🔒 Dynamic WebSocket URL: Use WSS for HTTPS, WS for HTTP
    const getWebSocketUrl = () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host; // includes port if present
        return `${protocol}//${host}/ws/favorites`;
    };

    // TEMPORARILY DISABLED WebSocket - using polling instead until Cloudflare WebSocket is configured
    const { isConnected, isConnecting, error: wsError } = useWebSocket({
        url: getWebSocketUrl(),
        token: authToken,
        autoConnect: true, // ENABLED - was false
        onMessage: (message: WebSocketMessage) => {
            if (message.type === 'price_update' && message.data) {
                console.log('💹 Real-time price update:', message.data);

                // Update prices in real-time
                setData(prevData => {
                    if (!prevData) return prevData;

                    const updatedFavorites = prevData.favorites.map(fav => {
                        // Find matching price update
                        const priceUpdate = message.data.prices?.find(
                            (p: any) => p.symbol === fav.symbol || p.asset_id === fav.id
                        );

                        if (priceUpdate) {
                            // Track price change direction for animation
                            const priceChanged = priceUpdate.price !== fav.price;
                            const priceDirection: 'up' | 'down' | null = priceUpdate.price > fav.price ? 'up' : priceUpdate.price < fav.price ? 'down' : null;

                            // Build price history (last 20 prices)
                            const existingHistory = fav.priceHistory || [];
                            const newHistory = [...existingHistory, priceUpdate.price].slice(-20);

                            return {
                                ...fav,
                                price: priceUpdate.price,
                                change24h: priceUpdate.change24h || fav.change24h,
                                volume: priceUpdate.volume || fav.volume,
                                volume24h: priceUpdate.volume24h || fav.volume24h,
                                priceHistory: newHistory,
                                _priceChangeDirection: priceChanged ? priceDirection : null,
                                _priceUpdateTime: Date.now(),
                            };
                        }
                        return fav;
                    });

                    return {
                        ...prevData,
                        favorites: updatedFavorites,
                        lastUpdated: new Date().toISOString(),
                    };
                });
            }
        },
        onConnect: () => {
            console.log('✅ WebSocket connected to Favorites');
        },
        onDisconnect: () => {
            console.log('🔌 WebSocket disconnected from Favorites');
        },
        onError: (error) => {
            console.error('❌ WebSocket error:', error);
        },
    });

    // Helper function to refresh favorites data
    const refreshFavorites = async (): Promise<void> => {
        try {
            // Fetch favorites from backend
            const backendFavorites = await favoritesService.getAllFavorites();

            // Fetch full page data (for catalog, gainers, losers, prices)
            const favoritesData = await api.fetchFavoritesPageData();

            // Merge backend favorites with price data
            const mergedFavorites: FavoriteItem[] = backendFavorites.map(fav => {
                const existing = favoritesData.favorites.find(
                    f => f.id === fav.asset_id || f.symbol === fav.symbol
                );

                return {
                    id: fav.asset_id,
                    symbol: fav.symbol,
                    name: fav.name,
                    price: existing?.price || 0,
                    change24h: existing?.change24h || 0,
                    volume: existing?.volume || '0',
                    volume24h: existing?.volume24h,
                    hasAlert: existing?.hasAlert || false,
                    priceHistory: existing?.priceHistory || [],
                    _priceChangeDirection: existing?._priceChangeDirection,
                    _priceUpdateTime: existing?._priceUpdateTime
                };
            });

            // Update state
            setData({
                ...favoritesData,
                favorites: mergedFavorites
            });
        } catch (error) {
            console.error('Failed to refresh favorites:', error);
            throw error;
        }
    };

    // Initial data fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                console.log('🔄 Fetching favorites from backend...');
                await refreshFavorites();
                console.log('✅ Favorites loaded successfully');

                // Fetch AI Agents
                try {
                    const agents = await api.fetchAIAgents();
                    setAiAgents(agents);

                    // Try to get Fear & Greed Index from Sentiment Analysis Agent
                    const sentimentAgent = agents.find(a => a.id === '3');
                    if (sentimentAgent?.lastSentimentAnalysis?.marketContext) {
                        const fgIndex = sentimentAgent.lastSentimentAnalysis.marketContext.fearGreedIndex;
                        const fgLabel = sentimentAgent.lastSentimentAnalysis.marketContext.fearGreedLabel ||
                            (fgIndex < 25 ? 'Fear' : fgIndex < 45 ? 'Neutral' : 'Greed');
                        if (fgIndex !== undefined) {
                            setFearGreedIndex({ index: fgIndex, label: fgLabel });
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ Failed to load AI agents:', error);
                }

                // Fetch Fear & Greed Index directly if not available from agent
                const currentFearGreed = fearGreedIndex;
                if (!currentFearGreed) {
                    try {
                        const response = await fetch('https://api.alternative.me/fng/?limit=1');
                        if (response.ok) {
                            const json = await response.json();
                            const entry = json?.data?.[0];
                            if (entry) {
                                const value = parseInt(entry.value || '50', 10);
                                const classification = entry.value_classification || 'Neutral';
                                setFearGreedIndex({
                                    index: value,
                                    label: classification
                                });
                            }
                        }
                    } catch (error) {
                        console.warn('⚠️ Failed to fetch Fear & Greed Index:', error);
                    }
                }
            } catch (error) {
                console.error('❌ Failed to load favorites', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []); // Only run once on mount

    // Lightweight price updates (only prices, not full page refresh)
    useEffect(() => {
        if (!data || data.favorites.length === 0) {
            return; // Don't start interval if no favorites
        }

        // Lightweight price updates every 5 seconds (only prices, not full page)
        const priceUpdateInterval = setInterval(async () => {
            try {
                // Get all symbols from current favorites
                const symbols = data.favorites.map(fav => {
                    // Use id if it's a MEXC symbol, otherwise construct from symbol
                    return fav.id.includes('USDT') ? fav.id : `${fav.symbol}USDT`;
                });

                // Update only prices
                const priceMap = await api.updateWatchlistPrices(symbols);

                // Update state with new prices
                setData(prevData => {
                    if (!prevData) return prevData;

                    const updatedFavorites = prevData.favorites.map(fav => {
                        const mexcSymbol = fav.id.includes('USDT') ? fav.id : `${fav.symbol}USDT`;
                        const priceData = priceMap.get(mexcSymbol);

                        if (priceData) {
                            // Track price change direction for animation
                            const priceChanged = priceData.price !== fav.price;
                            const priceDirection: 'up' | 'down' | null = priceData.price > fav.price ? 'up' : priceData.price < fav.price ? 'down' : null;

                            // Build price history (last 20 prices)
                            const existingHistory = fav.priceHistory || [];
                            const newHistory = [...existingHistory, priceData.price].slice(-20); // Keep last 20 prices

                            return {
                                ...fav,
                                price: priceData.price,
                                change24h: priceData.change24h,
                                volume: priceData.volume,
                                volume24h: fav.volume24h,
                                priceHistory: newHistory,
                                _priceChangeDirection: priceChanged ? priceDirection : null,
                                _priceUpdateTime: Date.now(),
                            };
                        }
                        return fav;
                    });

                    // Update summary based on new prices
                    const updatedSummary = {
                        ...prevData.summary,
                        gainers: updatedFavorites.filter(f => f.change24h > 0).length,
                        decliners: updatedFavorites.filter(f => f.change24h < 0).length,
                    };

                    return {
                        ...prevData,
                        favorites: updatedFavorites,
                        summary: updatedSummary,
                        lastUpdated: new Date().toISOString(),
                    };
                });
            } catch (error) {
                console.warn('⚠️ Failed to update prices:', error);
            }
        }, isConnected ? 30000 : 5000); // 30s fallback if connected, 5s if polling only

        return () => clearInterval(priceUpdateInterval);
    }, [data?.favorites.length]); // Re-run only when favorites count changes

    useEffect(() => {
        if (!status) return;
        const timeout = setTimeout(() => setStatus(null), 4000);
        return () => clearTimeout(timeout);
    }, [status]);

    const handleAddFavorite = async (asset: CryptoAsset) => {
        try {
            // Add to backend
            await favoritesService.addFavorite(asset.id, asset.symbol, asset.name);

            // Refresh data
            await refreshFavorites();

            setStatus({ type: 'success', text: t('favorite_added', { asset: asset.symbol }) });
            setIsAddModalOpen(false); // Close modal after successful add
        } catch (error) {
            console.error('Failed to add favorite', error);
            setStatus({ type: 'error', text: t('error_occurred') });
        }
    };

    const handleRemoveFavorite = async (item: FavoriteItem) => {
        try {
            // Remove from backend by asset ID
            await favoritesService.removeFavoriteByAssetId(item.id);

            // Refresh data
            await refreshFavorites();

            setStatus({ type: 'success', text: t('favorite_removed', { asset: item.symbol }) });
        } catch (error) {
            console.error('Failed to remove favorite', error);
            setStatus({ type: 'error', text: t('error_occurred') });
        }
    };

    const handleCreateAlert = async (favorite: FavoriteItem, payload: FavoriteAlertInput) => {
        try {
            const updated = await api.createFavoriteAlert(favorite.id, payload);
            setData(updated);
            setStatus({ type: 'success', text: t('price_alert_saved', { asset: favorite.symbol }) });
        } catch (error) {
            console.error('Failed to create alert', error);
            setStatus({ type: 'error', text: t('error_occurred') });
            throw error;
        }
    };

    const handleSetAlert = (item: FavoriteItem) => {
        setSelectedAsset(item);
        setIsAlertModalOpen(true);
    };

    // Sort and filter logic
    const filteredAndSortedItems = useMemo(() => {
        if (!data?.favorites) return [];

        let items = [...data.favorites];

        // Filter by search term
        if (searchTerm) {
            items = items.filter(item =>
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filter by type (gainers, decliners, alerts)
        if (filterBy === 'gainers') {
            items = items.filter(item => item.change24h > 0);
        } else if (filterBy === 'decliners') {
            items = items.filter(item => item.change24h < 0);
        } else if (filterBy === 'alerts') {
            items = items.filter(item => item.hasAlert);
        }

        // Sort items
        items.sort((a, b) => {
            let aValue: number | string;
            let bValue: number | string;

            switch (sortBy) {
                case 'symbol':
                    aValue = a.symbol.toLowerCase();
                    bValue = b.symbol.toLowerCase();
                    break;
                case 'price':
                    aValue = a.price || 0;
                    bValue = b.price || 0;
                    break;
                case 'change24h':
                    aValue = a.change24h || 0;
                    bValue = b.change24h || 0;
                    break;
                case 'volume':
                    aValue = a.volume24h || 0;
                    bValue = b.volume24h || 0;
                    break;
                default:
                    return 0;
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortOrder === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            } else {
                return sortOrder === 'asc'
                    ? (aValue as number) - (bValue as number)
                    : (bValue as number) - (aValue as number);
            }
        });

        return items;
    }, [data?.favorites, searchTerm, sortBy, sortOrder, filterBy]);

    const filteredItems = filteredAndSortedItems;

    if (isLoading) {
        return <div className="text-center p-10">{t('loading')}</div>;
    }

    if (!data) {
        return <div className="text-center p-10 text-red-500">{t('error_occurred')}</div>
    }

    const summary = data.summary;

    return (
        <div className="space-y-6">
            {status && (
                <div
                    className={`rounded-lg border px-4 py-3 text-sm ${status.type === 'success'
                        ? 'border-green-500/40 bg-green-500/10 text-green-300'
                        : 'border-red-500/40 bg-red-500/10 text-red-300'
                        }`}
                >
                    {status.text}
                </div>
            )}

            {/* 🚀 NEW: WebSocket Connection Indicator */}
            <div className="flex items-center justify-end gap-2 text-xs">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${isConnected ? 'bg-green-500/20 text-green-400' :
                    isConnecting ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                    }`}>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' :
                        isConnecting ? 'bg-yellow-400 animate-pulse' :
                            'bg-red-400'
                        }`}></div>
                    <span>
                        {isConnected ? 'Live' : isConnecting ? 'Connecting...' : 'Disconnected'}
                    </span>
                </div>
                {wsError && (
                    <span className="text-red-400">{wsError}</span>
                )}
            </div>

            <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">{t('favorites_list')}</h1>
                    <p className="text-gray-400 mt-1 text-sm">{t('favorites_desc')}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowAnalytics(!showAnalytics)}
                        className="group relative bg-gradient-to-r from-blue-600 via-blue-600 to-cyan-600 hover:from-blue-700 hover:via-blue-700 hover:to-cyan-700 text-white font-medium py-2 px-4 rounded-lg flex items-center space-x-2 shadow-md hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden text-sm"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                        <div className="relative z-10 flex items-center space-x-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:rotate-12 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="relative z-10">{showAnalytics ? t('show_favorites') || 'Show Favorites' : t('show_analytics') || 'Show Analytics'}</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="group relative bg-gradient-to-r from-purple-600 via-purple-600 to-pink-600 hover:from-purple-700 hover:via-purple-700 hover:to-pink-700 text-white font-medium py-2 px-4 rounded-lg flex items-center space-x-2 shadow-md hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden text-sm"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                        <div className="relative z-10 flex items-center space-x-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            <span className="relative z-10">{t('add_new')}</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Conditional Rendering: Analytics or Favorites List */}
            {showAnalytics ? (
                <FavoritesAnalytics />
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard
                            title={t('total_items')}
                            value={summary.totalItems}
                            color="purple"
                            icon={<svg className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>}
                        />
                        <SummaryCard
                            title={t('active_alerts')}
                            value={summary.activeAlerts}
                            color="yellow"
                            icon={<svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
                        />
                        <SummaryCard
                            title={t('gainers')}
                            value={summary.gainers}
                            color="green"
                            icon={<svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>}
                        />
                        <SummaryCard
                            title={t('decliners')}
                            value={summary.decliners}
                            color="red"
                            icon={<svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>}
                        />
                    </div>

                    <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl shadow-lg overflow-hidden">
                        <div className="p-5 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/30 to-transparent">
                            <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-lg">
                                        <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                    <h2 className="font-semibold text-white text-lg">{t('real_time_prices')}</h2>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {/* Filter Buttons */}
                                    <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700/50">
                                        {(['all', 'gainers', 'decliners', 'alerts'] as const).map(filter => (
                                            <button
                                                key={filter}
                                                onClick={() => setFilterBy(filter)}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${filterBy === filter
                                                    ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
                                                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                                                    }`}
                                            >
                                                {t(`filter_${filter}`) || filter}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-4 items-center">
                                {/* Search */}
                                <div className="relative flex-1 min-w-[200px]">
                                    <input
                                        type="text"
                                        placeholder={t('search_assets')}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-2 px-4 pl-10 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                    />
                                    <svg className="h-4 w-4 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                                </div>
                                {/* Sort */}
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-400 font-medium">{t('sort_by') || 'Sort by:'}</label>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                                        className="bg-gray-800/50 border border-gray-700 rounded-xl py-2 px-3 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                        title={t('sort_by') || 'Sort by'}
                                    >
                                        <option value="symbol">{t('symbol') || 'Symbol'}</option>
                                        <option value="price">{t('price') || 'Price'}</option>
                                        <option value="change24h">{t('change_24h') || '24h Change'}</option>
                                        <option value="volume">{t('volume') || 'Volume'}</option>
                                    </select>
                                    <button
                                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all"
                                        title={sortOrder === 'asc' ? t('sort_desc') || 'Descending' : t('sort_asc') || 'Ascending'}
                                    >
                                        {sortOrder === 'asc' ? (
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                            </svg>
                                        ) : (
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto lg:overflow-visible relative">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-400 uppercase bg-gray-800/30">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">{t('symbol')}</th>
                                        <th className="px-6 py-4 font-semibold">{t('price')}</th>
                                        <th className="px-6 py-4 font-semibold">{t('change_24h')}</th>
                                        <th className="px-6 py-4 font-semibold">{t('volume')}</th>
                                        <th className="px-6 py-4 font-semibold">{t('chart') || 'Chart'}</th>
                                        <th className="px-6 py-4 font-semibold">{t('alert')}</th>
                                        <th className="px-6 py-4 text-right font-semibold">{t('action')}</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-200">
                                    {filteredItems.map(item => {
                                        const priceChangeDirection = item._priceChangeDirection;
                                        const isHighlighted = priceChangeDirection && item._priceUpdateTime && (Date.now() - item._priceUpdateTime) < 2000;

                                        return (
                                            <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gradient-to-r hover:from-gray-800/30 hover:to-transparent transition-all duration-200 group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-white">{item.symbol}</span>
                                                        <span className="text-gray-400 font-normal text-xs">{item.name}</span>
                                                    </div>
                                                </td>
                                                <td className={`px-6 py-4 font-semibold relative ${isHighlighted && priceChangeDirection === 'up' ? 'price-up-animation' : isHighlighted && priceChangeDirection === 'down' ? 'price-down-animation' : ''}`}>
                                                    <span className="text-white">${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </td>
                                                <td className={`px-6 py-4 font-semibold ${item.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    <span className="inline-flex items-center gap-1">
                                                        {item.change24h >= 0 ? (
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                            </svg>
                                                        ) : (
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                                                            </svg>
                                                        )}
                                                        {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-300">{item.volume}</td>
                                                <td className="px-6 py-4">
                                                    <MiniChart
                                                        prices={item.priceHistory || []}
                                                        change24h={item.change24h || 0}
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    {item.hasAlert && (
                                                        <div className="inline-flex items-center justify-center w-8 h-8 bg-yellow-500/20 rounded-lg">
                                                            <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <ActionMenu
                                                        item={item}
                                                        onSetAlert={() => handleSetAlert(item)}
                                                        onTrade={() => onNavigate('trades')}
                                                        onRemove={() => handleRemoveFavorite(item)}
                                                    />
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FearAndGreedGauge
                                value={fearGreedIndex?.index || 50}
                                agents={aiAgents}
                                fearGreedData={fearGreedIndex || undefined}
                            />
                            <MoversList title={t('top_gainers')} data={data.gainers} isGainers={true} />
                            <MoversList title={t('top_losers')} data={data.losers} isGainers={false} />
                            <MarketStatsWidget />
                        </div>
                        <div className="bg-gradient-to-br from-[#1c1e2f] to-[#1a1c2a] border border-gray-700/50 rounded-xl p-5 shadow-lg">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-lg">
                                    <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-semibold text-gray-300">{t('trending_coins')}</h3>
                            </div>
                            <div className="space-y-2">
                                {data.trending.map(item => (
                                    <div
                                        key={item.id}
                                        className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-all duration-200 group"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white truncate">{item.symbol}</p>
                                            <p className="text-xs text-gray-400 truncate">{item.name}</p>
                                        </div>
                                        <div className="text-right ml-3">
                                            <p className={`font-bold text-lg ${item.change >= 0 ? 'text-green-400' : 'text-red-400'} drop-shadow-lg`}>
                                                {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}%
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {isAddModalOpen && data && (
                <AddFavoriteModal
                    onClose={() => setIsAddModalOpen(false)}
                    onAddFavorite={handleAddFavorite}
                    existingFavorites={data.favorites || []}
                    availableAssets={data.catalog || []}
                />
            )}
            {isAlertModalOpen && selectedAsset && (
                <SetAlertModal
                    onClose={() => {
                        setIsAlertModalOpen(false);
                        setSelectedAsset(null);
                    }}
                    asset={selectedAsset}
                    onCreateAlert={payload => handleCreateAlert(selectedAsset, payload)}
                />
            )}
        </div>
    );
};

export default Favorites;