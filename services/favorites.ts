/**
 * ============================================================================
 * Favorites Service Layer
 * ============================================================================
 * Frontend service for managing user's favorite crypto assets
 * Provides API integration, IndexedDB fallback, and automatic sync
 * ============================================================================
 */

import { database } from './database.ts';

// ============================================================================
// Types
// ============================================================================

export interface Favorite {
    id: number;
    asset_id: string;
    symbol: string;
    name: string;
    added_at: string;
    last_viewed_at?: string;
    view_count?: number;
}

export interface FavoriteAlert {
    id: number;
    favorite_id: number;
    condition: 'above' | 'below';
    target_price: number;
    is_active: boolean;
    triggered_at?: string;
    triggered_price?: number;
    notify_telegram: boolean;
    notify_browser: boolean;
    notify_email: boolean;
    created_at: string;
    updated_at: string;
}

export interface FavoritesResponse {
    success: boolean;
    favorites: Favorite[];
    count: number;
}

export interface AlertsResponse {
    success: boolean;
    alerts: FavoriteAlert[];
    count: number;
}

// ============================================================================
// Constants
// ============================================================================

const API_BASE = '/api/favorites';
const CACHE_KEY = 'titan_favorites_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get auth token:
 * - Primary: titan_token (set by backend login)
 * - Fallback: token inside titan_user (legacy)
 * If nothing is found, return null (allow cookie-based auth).
 */
function getAuthToken(): string | null {
    try {
        const direct = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
        if (direct) return direct;

        const userStr = localStorage.getItem('titan_user') || sessionStorage.getItem('titan_user');
        if (!userStr) return null;
        const user = JSON.parse(userStr);
        return user.token || user?.value?.token || null;
    } catch (error) {
        console.error('Failed to get auth token:', error);
        return null;
    }
}

/**
 * Create API request with auth headers
 */
async function apiRequest(
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include', // allow cookie-based auth
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response;
}

/**
 * Retry logic with exponential backoff
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries = MAX_RETRIES
): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries <= 0) throw error;
        
        // Only retry on network errors or 5xx server errors
        const shouldRetry = 
            !error.response || 
            (error.status >= 500 && error.status < 600);
        
        if (!shouldRetry) throw error;

        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (MAX_RETRIES - retries + 1)));
        return retryWithBackoff(fn, retries - 1);
    }
}

/**
 * Cache management
 */
const cache = {
    get(): Favorite[] | null {
        // Disabled localStorage caching per requirement; always fetch fresh
        return null;
    },

    set(data: Favorite[]): void {
        // No-op (caching disabled)
    },

    clear(): void {
        // No-op (caching disabled)
    }
};

// ============================================================================
// Favorites API
// ============================================================================

/**
 * Get all user's favorites from backend
 * Falls back to IndexedDB if backend is unavailable
 */
export async function getAllFavorites(): Promise<Favorite[]> {
    try {
        // Try cache first
        const cached = cache.get();
        if (cached) {
            console.log('✅ Favorites loaded from cache');
            return cached;
        }

        // Fetch from backend with retry
        const response = await retryWithBackoff(async () => {
            return await apiRequest('/', { method: 'GET' });
        });

        const data: FavoritesResponse = await response.json();
        
        if (data.success && data.favorites) {
            cache.set(data.favorites);
            return data.favorites;
        }

        throw new Error('Invalid response format');
    } catch (error: any) {
        console.warn('Backend unavailable, using IndexedDB fallback:', error.message);
        
        // Fallback to IndexedDB
        try {
            const indexedDBFavorites = await database.getAll<any>('favorites');
            return indexedDBFavorites || [];
        } catch (dbError) {
            console.error('IndexedDB fallback failed:', dbError);
            return [];
        }
    }
}

/**
 * Add new favorite
 */
export async function addFavorite(
    asset_id: string,
    symbol: string,
    name: string
): Promise<Favorite> {
    try {
        const response = await retryWithBackoff(async () => {
            return await apiRequest('/', {
                method: 'POST',
                body: JSON.stringify({ asset_id, symbol, name })
            });
        });

        const data = await response.json();
        
        if (data.success && data.favorite) {
            // Clear cache to force refresh
            cache.clear();
            
            // Also save to IndexedDB for offline access
            await database.save('favorites', {
                id: asset_id,
                asset_id,
                symbol,
                name,
                price: 0,
                change24h: 0,
                volume: '0',
                hasAlert: false
            }).catch(err => console.warn('IndexedDB save failed:', err));
            
            return data.favorite;
        }

        throw new Error(data.error || 'Failed to add favorite');
    } catch (error: any) {
        console.error('Failed to add favorite:', error);
        
        // Fallback: Save to IndexedDB only
        await database.save('favorites', {
            id: asset_id,
            asset_id,
            symbol,
            name,
            price: 0,
            change24h: 0,
            volume: '0',
            hasAlert: false
        });

        throw error;
    }
}

/**
 * Remove favorite by ID
 */
export async function removeFavorite(favoriteId: number): Promise<void> {
    try {
        await retryWithBackoff(async () => {
            return await apiRequest(`/${favoriteId}`, { method: 'DELETE' });
        });

        // Clear cache
        cache.clear();
    } catch (error: any) {
        console.error('Failed to remove favorite:', error);
        throw error;
    }
}

/**
 * Remove favorite by asset ID
 */
export async function removeFavoriteByAssetId(assetId: string): Promise<void> {
    try {
        await retryWithBackoff(async () => {
            return await apiRequest(`/by-asset/${assetId}`, { method: 'DELETE' });
        });

        // Clear cache and IndexedDB
        cache.clear();
        await database.delete('favorites', assetId).catch(console.warn);
    } catch (error: any) {
        console.error('Failed to remove favorite:', error);
        
        // Fallback: Remove from IndexedDB
        await database.delete('favorites', assetId);
        throw error;
    }
}

/**
 * Check if asset is favorited
 */
export async function isFavorited(assetId: string): Promise<boolean> {
    try {
        const response = await apiRequest(`/check/${assetId}`, { method: 'GET' });
        const data = await response.json();
        return data.isFavorited === true;
    } catch (error) {
        // Fallback: Check IndexedDB
        try {
            const item = await database.get<any>('favorites', assetId);
            return item !== null;
        } catch {
            return false;
        }
    }
}

/**
 * Sync favorites from IndexedDB to backend
 */
export async function syncFavoritesFromIndexedDB(): Promise<{
    success: boolean;
    synced: number;
    skipped: number;
    errors?: string[];
}> {
    try {
        // Get favorites from IndexedDB
        const indexedDBFavorites = await database.getAll<any>('favorites');
        
        if (!indexedDBFavorites || indexedDBFavorites.length === 0) {
            return {
                success: true,
                synced: 0,
                skipped: 0
            };
        }

        // Transform to sync format
        const favorites = indexedDBFavorites.map((fav: any) => ({
            id: fav.id || fav.asset_id,
            symbol: fav.symbol,
            name: fav.name
        }));

        // Send to backend
        const response = await apiRequest('/sync', {
            method: 'POST',
            body: JSON.stringify({ favorites })
        });

        const data = await response.json();
        
        // Clear cache after successful sync
        if (data.success) {
            cache.clear();
        }

        return data;
    } catch (error: any) {
        console.error('Sync failed:', error);
        return {
            success: false,
            synced: 0,
            skipped: 0,
            errors: [error.message]
        };
    }
}

/**
 * Check if migration is needed (has IndexedDB data but not synced to backend)
 */
export async function needsMigration(): Promise<boolean> {
    try {
        // Check IndexedDB
        const indexedDBFavorites = await database.getAll<any>('favorites');
        if (!indexedDBFavorites || indexedDBFavorites.length === 0) {
            return false;
        }

        // Check if already migrated
        const migrated = localStorage.getItem('titan_favorites_migrated');
        if (migrated === 'true') {
            return false;
        }

        // Check backend (don't count cached data)
        try {
            cache.clear(); // Force fresh fetch
            const backendFavorites = await getAllFavorites();
            
            // If backend has data, assume migrated
            if (backendFavorites.length > 0) {
                localStorage.setItem('titan_favorites_migrated', 'true');
                return false;
            }
        } catch {
            // Backend error doesn't mean migration is needed
        }

        return true;
    } catch (error) {
        console.error('Failed to check migration status:', error);
        return false;
    }
}

// ============================================================================
// Alerts API
// ============================================================================

/**
 * Get alerts for a favorite
 */
export async function getAlertsForFavorite(favoriteId: number): Promise<FavoriteAlert[]> {
    try {
        const response = await apiRequest(`/${favoriteId}/alerts`, { method: 'GET' });
        const data: AlertsResponse = await response.json();
        return data.success ? data.alerts : [];
    } catch (error) {
        console.error('Failed to get alerts:', error);
        return [];
    }
}

/**
 * Get all active alerts
 */
export async function getActiveAlerts(): Promise<FavoriteAlert[]> {
    try {
        const response = await apiRequest('/alerts/active', { method: 'GET' });
        const data: AlertsResponse = await response.json();
        return data.success ? data.alerts : [];
    } catch (error) {
        console.error('Failed to get active alerts:', error);
        return [];
    }
}

/**
 * Create new alert
 */
export async function createAlert(
    favoriteId: number,
    condition: 'above' | 'below',
    target_price: number,
    notifications?: {
        telegram?: boolean;
        browser?: boolean;
        email?: boolean;
    }
): Promise<FavoriteAlert> {
    try {
        const response = await apiRequest(`/${favoriteId}/alerts`, {
            method: 'POST',
            body: JSON.stringify({
                condition,
                target_price,
                notify_telegram: notifications?.telegram ?? true,
                notify_browser: notifications?.browser ?? true,
                notify_email: notifications?.email ?? false
            })
        });

        const data = await response.json();
        if (!data.success || !data.alert) {
            throw new Error(data.error || 'Failed to create alert');
        }

        return data.alert;
    } catch (error: any) {
        console.error('Failed to create alert:', error);
        throw error;
    }
}

/**
 * Update alert
 */
export async function updateAlert(
    alertId: number,
    updates: Partial<FavoriteAlert>
): Promise<FavoriteAlert> {
    try {
        const response = await apiRequest(`/alerts/${alertId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });

        const data = await response.json();
        if (!data.success || !data.alert) {
            throw new Error(data.error || 'Failed to update alert');
        }

        return data.alert;
    } catch (error: any) {
        console.error('Failed to update alert:', error);
        throw error;
    }
}

/**
 * Delete alert
 */
export async function deleteAlert(alertId: number): Promise<void> {
    try {
        await apiRequest(`/alerts/${alertId}`, { method: 'DELETE' });
    } catch (error: any) {
        console.error('Failed to delete alert:', error);
        throw error;
    }
}

// ============================================================================
// Export
// ============================================================================

const favoritesService = {
    getAllFavorites,
    addFavorite,
    removeFavorite,
    removeFavoriteByAssetId,
    isFavorited,
    syncFavoritesFromIndexedDB,
    needsMigration,
    getAlertsForFavorite,
    getActiveAlerts,
    createAlert,
    updateAlert,
    deleteAlert,
    clearCache: () => cache.clear()
};

export default favoritesService;
