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
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300">{t('overall_market_stats')}</h3>
            <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div>
                    <p className="text-gray-400">{t('btc_dominance')}</p>
                    <p className="font-bold text-white text-lg">
                        {stats ? `${stats.btcDominance.toFixed(2)}%` : '...'}
                    </p>
                </div>
                <div>
                    <p className="text-gray-400">{t('eth_dominance')}</p>
                    <p className="font-bold text-white text-lg">
                        {stats ? `${stats.ethDominance.toFixed(2)}%` : '...'}
                    </p>
                </div>
                <div>
                    <p className="text-gray-400">{t('24h_volume')}</p>
                    <p className="font-bold text-white text-lg">
                        {stats ? formatVolume(stats.totalVolume24h) : '...'}
                    </p>
                </div>
                <div>
                    <p className="text-gray-400">{t('market_cap')}</p>
                    <p className="font-bold text-white text-lg">
                        {stats ? formatVolume(stats.totalMarketCap) : '...'}
                    </p>
                </div>
            </div>
        </div>
    );
};

const SummaryCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; }> = ({ title, value, icon }) => (
    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 flex items-center space-x-4">
        <div className="bg-gray-700/50 p-3 rounded-full">
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-xl font-bold text-white">{value}</p>
        </div>
    </div>
);

const FearAndGreedGauge: React.FC<{ value: number }> = ({ value }) => {
    const { t } = useLanguage();
    const percentage = value / 100;
    const strokeDashoffset = 282.7 * (1 - (percentage * 0.5)); // Semicircle
    
    let colorClass = 'text-green-500';
    if (value < 25) colorClass = 'text-red-500';
    else if (value < 45) colorClass = 'text-yellow-500';
    
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full flex flex-col items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300 w-full">{t('fear_and_greed')}</h3>
            <div className="relative mt-2">
                <svg className="h-32 w-32 transform" viewBox="0 0 100 100">
                    <path d="M 10 50 A 40 40 0 0 1 90 50" strokeWidth="10" stroke="currentColor" fill="none" className="text-gray-700" />
                    <path d="M 10 50 A 40 40 0 0 1 90 50" strokeWidth="10" stroke="currentColor" fill="none" className={colorClass}
                        strokeDasharray="282.7"
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white">{value}</span>
                    <span className="text-sm font-semibold text-gray-400">{t('neutral')}</span>
                </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{t('updating')}</p>
        </div>
    );
};

const MoversList: React.FC<{ title: string; data: MarketMover[]; isGainers: boolean }> = ({ title, data, isGainers }) => {
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>
            <div className="space-y-3">
                {data.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                        <div>
                            <p className="font-bold text-white">{item.symbol}</p>
                            <p className="text-xs text-gray-400">{item.name}</p>
                        </div>
                        <span className={`font-semibold ${isGainers ? 'text-green-400' : 'text-red-400'}`}>
                            {isGainers ? '+' : ''}{item.change.toFixed(2)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const Favorites: React.FC<{setActiveView: (view: string) => void}> = ({setActiveView}) => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<FavoritesPageData | null>(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<FavoriteItem | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [sortBy, setSortBy] = useState<'symbol' | 'price' | 'change24h' | 'volume'>('symbol');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [filterBy, setFilterBy] = useState<'all' | 'gainers' | 'decliners' | 'alerts'>('all');
    const [showAnalytics, setShowAnalytics] = useState(false);

    // 🚀 NEW: WebSocket for Real-time Price Updates
    const { isConnected, isConnecting, error: wsError } = useWebSocket({
        url: 'ws://188.40.209.82:5002/ws/favorites',
        token: localStorage.getItem('token') || undefined,
        autoConnect: true,
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
                            const priceDirection = priceUpdate.price > fav.price ? 'up' : priceUpdate.price < fav.price ? 'down' : null;
                            
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
                            const priceDirection = priceData.price > fav.price ? 'up' : priceData.price < fav.price ? 'down' : null;
                            
                            // Build price history (last 20 prices)
                            const existingHistory = fav.priceHistory || [];
                            const newHistory = [...existingHistory, priceData.price].slice(-20); // Keep last 20 prices
                            
                            return {
                                ...fav,
                                price: priceData.price,
                                change24h: priceData.change24h,
                                volume: priceData.volume,
                                volume24h: priceData.volume24h,
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
        }, 5000); // Update every 5 seconds
        
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
                    className={`rounded-lg border px-4 py-3 text-sm ${
                        status.type === 'success'
                            ? 'border-green-500/40 bg-green-500/10 text-green-300'
                            : 'border-red-500/40 bg-red-500/10 text-red-300'
                    }`}
                >
                    {status.text}
                </div>
            )}
            
            {/* 🚀 NEW: WebSocket Connection Indicator */}
            <div className="flex items-center justify-end gap-2 text-xs">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                    isConnected ? 'bg-green-500/20 text-green-400' : 
                    isConnecting ? 'bg-yellow-500/20 text-yellow-400' : 
                    'bg-red-500/20 text-red-400'
                }`}>
                    <div className={`w-2 h-2 rounded-full ${
                        isConnected ? 'bg-green-400 animate-pulse' : 
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
                    <h1 className="text-2xl font-bold text-white">{t('favorites_list')}</h1>
                    <p className="text-gray-400 mt-1">{t('favorites_desc')}</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowAnalytics(!showAnalytics)} 
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span>{showAnalytics ? t('show_favorites') || 'Show Favorites' : t('show_analytics') || 'Show Analytics'}</span>
                    </button>
                    <button onClick={() => setIsAddModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        <span>{t('add_new')}</span>
                    </button>
                </div>
            </div>
            
            {/* Conditional Rendering: Analytics or Favorites List */}
            {showAnalytics ? (
                <FavoritesAnalytics />
            ) : (
                <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard title={t('total_items')} value={summary.totalItems} icon={<svg className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>} />
                <SummaryCard title={t('active_alerts')} value={summary.activeAlerts} icon={<svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>} />
                <SummaryCard title={t('gainers')} value={summary.gainers} icon={<svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>} />
                <SummaryCard title={t('decliners')} value={summary.decliners} icon={<svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>} />
            </div>

            <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg">
                <div className="p-4 border-b border-gray-700/50">
                    <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                        <h2 className="font-semibold text-white">{t('real_time_prices')}</h2>
                        <div className="flex flex-wrap gap-2">
                            {/* Filter Buttons */}
                            <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
                                {(['all', 'gainers', 'decliners', 'alerts'] as const).map(filter => (
                                    <button
                                        key={filter}
                                        onClick={() => setFilterBy(filter)}
                                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                            filterBy === filter
                                                ? 'bg-purple-600 text-white'
                                                : 'text-gray-400 hover:text-white'
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
                                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg py-1 px-3 pl-8 text-sm focus:ring-purple-500 focus:border-purple-500"
                            />
                            <svg className="h-4 w-4 text-gray-400 absolute top-1/2 left-2.5 -translate-y-1/2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                        </div>
                        {/* Sort */}
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400">{t('sort_by') || 'Sort by:'}</label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                                className="bg-gray-800/50 border border-gray-700 rounded-lg py-1 px-2 text-sm text-white focus:ring-purple-500 focus:border-purple-500"
                            >
                                <option value="symbol">{t('symbol') || 'Symbol'}</option>
                                <option value="price">{t('price') || 'Price'}</option>
                                <option value="change24h">{t('change_24h') || '24h Change'}</option>
                                <option value="volume">{t('volume') || 'Volume'}</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="p-1 text-gray-400 hover:text-white transition-colors"
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
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-400 uppercase">
                            <tr>
                                <th className="px-6 py-3">{t('symbol')}</th>
                                <th className="px-6 py-3">{t('price')}</th>
                                <th className="px-6 py-3">{t('change_24h')}</th>
                                <th className="px-6 py-3">{t('volume')}</th>
                                <th className="px-6 py-3">{t('chart') || 'Chart'}</th>
                                <th className="px-6 py-3">{t('alert')}</th>
                                <th className="px-6 py-3 text-right">{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-200">
                           {filteredItems.map(item => {
                                const priceChangeDirection = item._priceChangeDirection;
                                const isHighlighted = priceChangeDirection && item._priceUpdateTime && (Date.now() - item._priceUpdateTime) < 2000;
                                
                                return (
                             <tr key={item.id} className="border-b border-gray-800 hover:bg-gray-800/50 relative">
                                <td className="px-6 py-4 font-bold">{item.symbol} <span className="text-gray-400 font-normal text-xs">{item.name}</span></td>
                                <td className={`px-6 py-4 font-semibold relative rounded ${isHighlighted && priceChangeDirection === 'up' ? 'price-up-animation' : isHighlighted && priceChangeDirection === 'down' ? 'price-down-animation' : ''}`}>
                                    ${item.price.toLocaleString()}
                                </td>
                                <td className={`px-6 py-4 font-semibold ${item.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>{item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%</td>
                                <td className="px-6 py-4">{item.volume}</td>
                                <td className="px-6 py-4">
                                    <MiniChart 
                                        prices={item.priceHistory || []} 
                                        change24h={item.change24h || 0}
                                    />
                                </td>
                                <td className="px-6 py-4">{item.hasAlert && <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>}</td>
                                <td className="px-6 py-4 text-right">
                                    <ActionMenu
                                        item={item}
                                        onSetAlert={() => handleSetAlert(item)}
                                        onTrade={() => setActiveView('trades')}
                                        onRemove={() => handleRemoveFavorite(item)}
                                    />
                                </td>
                            </tr>
                           )})}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                   <FearAndGreedGauge value={23} />
                   <MoversList title={t('top_gainers')} data={data.gainers} isGainers={true} />
                   <MoversList title={t('top_losers')} data={data.losers} isGainers={false} />
                   <MarketStatsWidget />
                </div>
                 <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('trending_coins')}</h3>
                    <div className="space-y-3">
                         {data.trending.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-sm">
                                <div>
                                    <p className="font-bold text-white">{item.symbol}</p>
                                    <p className="text-xs text-gray-400">{item.name}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`font-semibold ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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