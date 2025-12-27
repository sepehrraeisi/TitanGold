import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface FavoriteAnalytics {
    mostFavorited: Array<{
        asset_id: string;
        symbol: string;
        name: string;
        favorite_count: number;
    }>;
    mostViewed: Array<{
        asset_id: string;
        symbol: string;
        name: string;
        view_count: number;
        last_viewed_at: string;
    }>;
    alertStats: Array<{
        condition: 'above' | 'below';
        count: number;
        active_count: number;
        triggered_count: number;
    }>;
    engagement: {
        total_favorites: number;
        avg_view_count: number;
        max_view_count: number;
        viewed_favorites: number;
        recentAdditions: number;
    };
}

const FavoritesAnalytics: React.FC = () => {
    const { t } = useLanguage();
    const [analytics, setAnalytics] = useState<FavoriteAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token') || undefined;
            const response = await fetch('/api/favorites/analytics', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                credentials: 'include', // allow cookie-based auth if in use
            });
            
            const data = await response.json();
            
            if (data.success) {
                setAnalytics(data.analytics);
            } else {
                setError(data.error || 'Failed to load analytics');
            }
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
            setError('Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-8">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span className="ml-3 text-gray-400">Loading analytics...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                <p className="text-red-300">{error}</p>
            </div>
        );
    }

    if (!analytics) {
        return null;
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">{t('favorites_analytics') || 'Favorites Analytics'}</h2>

            {/* Engagement Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
                    <p className="text-sm text-gray-400">{t('total_favorites') || 'Total Favorites'}</p>
                    <p className="text-3xl font-bold text-white mt-2">{analytics.engagement.total_favorites}</p>
                </div>
                
                <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
                    <p className="text-sm text-gray-400">{t('recent_additions') || 'Recent (7 days)'}</p>
                    <p className="text-3xl font-bold text-green-400 mt-2">{analytics.engagement.recentAdditions}</p>
                </div>
                
                <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
                    <p className="text-sm text-gray-400">{t('avg_views') || 'Avg Views'}</p>
                    <p className="text-3xl font-bold text-blue-400 mt-2">
                        {analytics.engagement.avg_view_count ? parseFloat(analytics.engagement.avg_view_count.toString()).toFixed(1) : '0'}
                    </p>
                </div>
                
                <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
                    <p className="text-sm text-gray-400">{t('viewed_favorites') || 'Viewed'}</p>
                    <p className="text-3xl font-bold text-purple-400 mt-2">
                        {analytics.engagement.viewed_favorites} / {analytics.engagement.total_favorites}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Most Favorited Assets (Global) */}
                <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                        🌍 {t('most_favorited_globally') || 'Most Favorited (Global)'}
                    </h3>
                    <div className="space-y-3">
                        {analytics.mostFavorited.length === 0 ? (
                            <p className="text-gray-500 text-sm">{t('no_data') || 'No data available'}</p>
                        ) : (
                            analytics.mostFavorited.map((asset, index) => (
                                <div
                                    key={asset.asset_id}
                                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-gray-400 font-semibold text-sm">#{index + 1}</span>
                                        <div>
                                            <p className="font-bold text-white">{asset.symbol}</p>
                                            <p className="text-xs text-gray-400">{asset.name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-blue-400">{asset.favorite_count}</p>
                                        <p className="text-xs text-gray-500">{t('users') || 'users'}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Most Viewed Favorites (User) */}
                <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                        👁️ {t('most_viewed_by_you') || 'Most Viewed By You'}
                    </h3>
                    <div className="space-y-3">
                        {analytics.mostViewed.length === 0 ? (
                            <p className="text-gray-500 text-sm">{t('no_data') || 'No data available'}</p>
                        ) : (
                            analytics.mostViewed.map((asset, index) => (
                                <div
                                    key={asset.asset_id}
                                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-gray-400 font-semibold text-sm">#{index + 1}</span>
                                        <div>
                                            <p className="font-bold text-white">{asset.symbol}</p>
                                            <p className="text-xs text-gray-400">{asset.name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-purple-400">{asset.view_count}</p>
                                        <p className="text-xs text-gray-500">{t('views') || 'views'}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Alert Statistics */}
            {analytics.alertStats.length > 0 && (
                <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                        🔔 {t('alert_statistics') || 'Alert Statistics'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {analytics.alertStats.map((stat) => (
                            <div key={stat.condition} className="p-4 bg-gray-800/50 rounded-lg">
                                <p className="text-sm font-semibold text-gray-300 mb-3">
                                    {stat.condition === 'above' ? '📈 Above' : '📉 Below'} {t('price') || 'Price'}
                                </p>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div>
                                        <p className="text-2xl font-bold text-white">{stat.count}</p>
                                        <p className="text-xs text-gray-500">{t('total') || 'Total'}</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-green-400">{stat.active_count}</p>
                                        <p className="text-xs text-gray-500">{t('active') || 'Active'}</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-yellow-400">{stat.triggered_count}</p>
                                        <p className="text-xs text-gray-500">{t('triggered') || 'Triggered'}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FavoritesAnalytics;
