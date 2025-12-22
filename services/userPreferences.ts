/**
 * ============================================================================
 * TitanGold User Preferences Service
 * ============================================================================
 * 
 * Frontend service layer for managing user preferences with:
 *   - API integration with backend
 *   - LocalStorage fallback for offline mode
 *   - Automatic sync with conflict resolution
 *   - Caching for performance
 *   - Error handling and retry logic
 *   - Migration from old LocalStorage format
 * 
 * @module services/userPreferences
 * @version 1.0.0
 * @author TitanGold Development Team
 * @date 2025-12-22
 * ============================================================================
 */

// API wrapper for user preferences endpoints
const api = {
    get: async (url: string) => {
        const token = localStorage.getItem('titan_token');
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        return response.json();
    },
    
    post: async (url: string, data: any) => {
        const token = localStorage.getItem('titan_token');
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify(data)
        });
        return response.json();
    },
    
    put: async (url: string, data: any) => {
        const token = localStorage.getItem('titan_token');
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify(data)
        });
        return response.json();
    }
};

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UserPreferences {
    theme?: ThemePreferences;
    language?: LanguagePreferences;
    notifications?: NotificationPreferences;
    trading?: TradingPreferences;
    wallet?: WalletPreferences;
    security?: SecurityPreferences;
    dashboard?: DashboardPreferences;
    api?: ApiPreferences;
}

export interface ThemePreferences {
    mode?: 'light' | 'dark';
    color?: string;
    fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
    animations?: boolean;
}

export interface LanguagePreferences {
    language?: string;
    timezone?: string;
    dateFormat?: string;
    currency?: string;
}

export interface NotificationPreferences {
    email?: boolean;
    push?: boolean;
    telegram?: boolean;
    sound?: boolean;
}

export interface TradingPreferences {
    defaultLeverage?: number;
    confirmOrders?: boolean;
    autoRefresh?: boolean;
}

export interface WalletPreferences {
    autoConnect?: boolean;
    showBalance?: boolean;
    confirmTransactions?: boolean;
}

export interface SecurityPreferences {
    twoFactorEnabled?: boolean;
    sessionTimeout?: number;
    ipWhitelist?: string[];
}

export interface DashboardPreferences {
    layout?: string;
    widgets?: string[];
    refreshInterval?: number;
}

export interface ApiPreferences {
    exchanges?: Record<string, any>;
    rateLimits?: Record<string, any>;
}

export interface PreferencesResponse {
    success: boolean;
    data: {
        preferences: UserPreferences;
        version: number;
        lastSyncAt?: string;
        updatedAt?: string;
        isNew?: boolean;
    };
    message?: string;
}

export interface CategoryResponse {
    success: boolean;
    data: {
        category: string;
        preferences: any;
        version: number;
    };
    message?: string;
}

export interface SyncResponse {
    success: boolean;
    data: {
        preferences: UserPreferences;
        version: number;
        updatedAt: string;
    };
    sync: {
        action: 'upload' | 'download' | 'merge';
        hasConflict: boolean;
        message: string;
    };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_KEY = 'titan_user_preferences_cache';
const CACHE_VERSION_KEY = 'titan_user_preferences_version';
const CACHE_TIMESTAMP_KEY = 'titan_user_preferences_timestamp';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const SYNC_INTERVAL = 30 * 1000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const RETRY_BACKOFF = 2; // exponential backoff multiplier

// ============================================================================
// RETRY HELPER
// ============================================================================

/**
 * Retry a function with exponential backoff
 * Only retries on network errors (5xx), not client errors (4xx)
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries = MAX_RETRIES,
    delay = RETRY_DELAY,
    attempt = 1
): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (attempt >= retries) {
            console.error(`Failed after ${retries} retries:`, error);
            throw error;
        }
        
        // Only retry on network errors, not on 4xx client errors
        if (error.response?.status >= 400 && error.response?.status < 500) {
            throw error;
        }
        
        const nextDelay = delay * Math.pow(RETRY_BACKOFF, attempt - 1);
        console.warn(`Retry attempt ${attempt}/${retries} after ${nextDelay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, nextDelay));
        return retryWithBackoff(fn, retries, delay, attempt + 1);
    }
}

// Legacy keys to migrate from
const LEGACY_KEYS = [
    'titan_theme',
    'titan_user',
    'titan_notification_settings',
    'titan_mexc_settings',
    'titan_wallet_connections',
    'titan_wallet_preferences',
    'titan_wallet_security_controls',
    'titan_wallet_security_settings',
    'titan_profile_settings',
    'titan_security_settings',
    'titan_appearance_settings',
];

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

class PreferencesCache {
    private cache: UserPreferences | null = null;
    private version: number = 0;
    private timestamp: number = 0;

    get(category?: string): any {
        if (!this.isValid()) {
            this.load();
        }
        
        if (category) {
            return this.cache?.[category as keyof UserPreferences];
        }
        
        return this.cache;
    }

    set(preferences: UserPreferences, version: number) {
        this.cache = preferences;
        this.version = version;
        this.timestamp = Date.now();
        this.persist();
    }

    setCategory(category: string, data: any, version: number) {
        if (!this.cache) {
            this.cache = {};
        }
        this.cache[category as keyof UserPreferences] = data;
        this.version = version;
        this.timestamp = Date.now();
        this.persist();
    }

    invalidate() {
        this.cache = null;
        this.version = 0;
        this.timestamp = 0;
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(CACHE_VERSION_KEY);
        localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    }

    isValid(): boolean {
        if (!this.cache || !this.timestamp) {
            return false;
        }
        
        const age = Date.now() - this.timestamp;
        return age < CACHE_TTL;
    }

    private load() {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            const version = localStorage.getItem(CACHE_VERSION_KEY);
            const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
            
            if (cached && version && timestamp) {
                this.cache = JSON.parse(cached);
                this.version = parseInt(version);
                this.timestamp = parseInt(timestamp);
            }
        } catch (error) {
            console.error('Failed to load cache:', error);
            this.invalidate();
        }
    }

    private persist() {
        try {
            if (this.cache) {
                localStorage.setItem(CACHE_KEY, JSON.stringify(this.cache));
                localStorage.setItem(CACHE_VERSION_KEY, this.version.toString());
                localStorage.setItem(CACHE_TIMESTAMP_KEY, this.timestamp.toString());
            }
        } catch (error) {
            console.error('Failed to persist cache:', error);
        }
    }

    getVersion(): number {
        return this.version;
    }
}

const cache = new PreferencesCache();

// ============================================================================
// API SERVICE
// ============================================================================

/**
 * Get all user preferences
 */
export async function getAllPreferences(useCache = true): Promise<PreferencesResponse> {
    // Check cache first
    if (useCache) {
        const cached = cache.get();
        if (cached) {
            return {
                success: true,
                data: {
                    preferences: cached,
                    version: cache.getVersion(),
                    isNew: false
                }
            };
        }
    }

    try {
        // 🚀 RETRY: Wrap API call with exponential backoff
        const response = await retryWithBackoff(() => api.get('/api/user-preferences'));
        
        if (response.success && response.data) {
            cache.set(response.data.preferences, response.data.version);
        }
        
        return response;
    } catch (error: any) {
        console.error('Failed to get preferences:', error);
        
        // Fallback to cache on error
        const cached = cache.get();
        if (cached) {
            return {
                success: true,
                data: {
                    preferences: cached,
                    version: cache.getVersion(),
                    isNew: false
                },
                message: 'Using cached preferences (offline mode)'
            };
        }
        
        throw error;
    }
}

/**
 * Get preferences for a specific category
 */
export async function getCategoryPreferences(
    category: keyof UserPreferences,
    useCache = true
): Promise<CategoryResponse> {
    // Check cache first
    if (useCache) {
        const cached = cache.get(category);
        if (cached) {
            return {
                success: true,
                data: {
                    category,
                    preferences: cached,
                    version: cache.getVersion()
                }
            };
        }
    }

    try {
        const response = await retryWithBackoff(() => api.get(`/api/user-preferences/category/${category}`));
        
        if (response.success && response.data) {
            cache.setCategory(category, response.data.preferences, response.data.version);
        }
        
        return response;
    } catch (error: any) {
        console.error(`Failed to get ${category} preferences:`, error);
        
        // Fallback to cache
        const cached = cache.get(category);
        if (cached) {
            return {
                success: true,
                data: {
                    category,
                    preferences: cached,
                    version: cache.getVersion()
                },
                message: 'Using cached preferences (offline mode)'
            };
        }
        
        throw error;
    }
}

/**
 * Update all preferences
 */
export async function updateAllPreferences(
    preferences: UserPreferences,
    syncSource = 'web'
): Promise<PreferencesResponse> {
    try {
        const response = await retryWithBackoff(() => api.put('/api/user-preferences', {
            preferences,
            version: cache.getVersion(),
            syncSource
        }));
        
        if (response.success && response.data) {
            cache.set(response.data.preferences, response.data.version);
        }
        
        return response;
    } catch (error: any) {
        console.error('Failed to update preferences:', error);
        throw error;
    }
}

/**
 * Update preferences for a specific category
 */
export async function updateCategoryPreferences(
    category: keyof UserPreferences,
    values: any,
    syncSource = 'web'
): Promise<CategoryResponse> {
    try {
        const response = await retryWithBackoff(() => api.put(`/api/user-preferences/category/${category}`, {
            values,
            version: cache.getVersion(),
            syncSource
        }));
        
        if (response.success && response.data) {
            cache.setCategory(category, values, response.data.version);
            console.log(`✅ ${category} preferences updated, version: ${response.data.version}`);
        }
        
        return response;
    } catch (error: any) {
        console.error(`Failed to update ${category} preferences:`, error);
        throw error;
    }
}

/**
 * Bulk update multiple categories
 */
export async function bulkUpdatePreferences(
    updates: Array<{ category: keyof UserPreferences; values: any }>,
    syncSource = 'web'
): Promise<PreferencesResponse> {
    try {
        const response = await retryWithBackoff(() => api.put('/api/user-preferences/bulk', {
            updates,
            version: cache.getVersion(),
            syncSource
        }));
        
        if (response.success && response.data) {
            cache.set(response.data.preferences, response.data.version);
            console.log(`✅ Bulk update completed: ${updates.length} categories, version: ${response.data.version}`);
        }
        
        return response;
    } catch (error: any) {
        console.error('Failed to bulk update preferences:', error);
        throw error;
    }
}

/**
 * Sync local preferences with server (handles conflicts)
 */
export async function syncPreferences(
    localPreferences: UserPreferences,
    localVersion: number,
    localTimestamp?: string
): Promise<SyncResponse> {
    try {
        const response = await retryWithBackoff(() => api.post('/api/user-preferences/sync', {
            localPreferences,
            localVersion,
            localTimestamp: localTimestamp || new Date().toISOString(),
            syncSource: 'web'
        }));
        
        if (response.success && response.data) {
            cache.set(response.data.preferences, response.data.version);
            
            if (response.sync?.hasConflict) {
                console.warn('⚠️ Sync conflict detected:', response.sync.message);
            } else {
                console.log('✅ Sync completed:', response.sync?.action);
            }
        }
        
        return response;
    } catch (error: any) {
        console.error('Failed to sync preferences:', error);
        throw error;
    }
}

/**
 * Get preference change history
 */
export async function getPreferenceHistory(
    limit = 50,
    offset = 0,
    category?: string
) {
    try {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            ...(category && { category })
        });
        
        return await retryWithBackoff(() => api.get(`/api/user-preferences/history?${params}`));
    } catch (error: any) {
        console.error('Failed to get preference history:', error);
        throw error;
    }
}

/**
 * Get available preference categories
 */
export async function getCategories() {
    try {
        return await retryWithBackoff(() => api.get('/api/user-preferences/categories'));
    } catch (error: any) {
        console.error('Failed to get categories:', error);
        throw error;
    }
}

// ============================================================================
// MIGRATION FROM LOCALSTORAGE
// ============================================================================

/**
 * Migrate legacy LocalStorage preferences to database
 */
export async function migrateLegacyPreferences(): Promise<{
    success: boolean;
    migrated: number;
    errors: string[];
}> {
    const migrated: string[] = [];
    const errors: string[] = [];
    const preferences: UserPreferences = {};

    console.log('🔄 Starting migration from LocalStorage...');

    // Extract theme settings
    try {
        const theme = localStorage.getItem('titan_theme');
        const appearanceSettings = localStorage.getItem('titan_appearance_settings');
        
        if (theme) {
            preferences.theme = { mode: theme as any };
            migrated.push('theme');
        }
        
        if (appearanceSettings) {
            const parsed = JSON.parse(appearanceSettings);
            preferences.theme = { ...preferences.theme, ...parsed };
        }
    } catch (error: any) {
        errors.push(`Theme migration failed: ${error.message}`);
    }

    // Extract notification settings
    try {
        const notifications = localStorage.getItem('titan_notification_settings');
        if (notifications) {
            const parsed = JSON.parse(notifications);
            preferences.notifications = {
                email: parsed.telegram?.notificationTypes?.trades || false,
                push: parsed.browser?.enabled || false,
                telegram: parsed.telegram?.enabled || false,
                sound: true
            };
            migrated.push('notifications');
        }
    } catch (error: any) {
        errors.push(`Notifications migration failed: ${error.message}`);
    }

    // Extract wallet settings
    try {
        const walletPrefs = localStorage.getItem('titan_wallet_preferences');
        const walletSecurity = localStorage.getItem('titan_wallet_security_settings');
        
        if (walletPrefs || walletSecurity) {
            preferences.wallet = {
                autoConnect: false,
                showBalance: true,
                confirmTransactions: true
            };
            migrated.push('wallet');
        }
    } catch (error: any) {
        errors.push(`Wallet migration failed: ${error.message}`);
    }

    // Extract profile/language settings
    try {
        const profileSettings = localStorage.getItem('titan_profile_settings');
        const user = localStorage.getItem('titan_user');
        
        if (profileSettings || user) {
            preferences.language = {
                language: 'en',
                timezone: 'UTC',
                currency: 'USD'
            };
            migrated.push('language');
        }
    } catch (error: any) {
        errors.push(`Language migration failed: ${error.message}`);
    }

    // Extract MEXC/API settings
    try {
        const mexcSettings = localStorage.getItem('titan_mexc_settings');
        if (mexcSettings) {
            const parsed = JSON.parse(mexcSettings);
            preferences.api = {
                exchanges: { mexc: parsed },
                rateLimits: {}
            };
            migrated.push('api');
        }
    } catch (error: any) {
        errors.push(`API migration failed: ${error.message}`);
    }

    // Upload to server if we have any preferences
    if (Object.keys(preferences).length > 0) {
        try {
            const updates = Object.entries(preferences).map(([category, values]) => ({
                category: category as keyof UserPreferences,
                values
            }));
            
            await bulkUpdatePreferences(updates, 'migration');
            
            console.log(`✅ Migration completed: ${migrated.length} categories migrated`);
            
            // Clear legacy keys after successful migration
            LEGACY_KEYS.forEach(key => {
                try {
                    localStorage.removeItem(key);
                } catch (error) {
                    console.warn(`Failed to remove legacy key ${key}:`, error);
                }
            });
            
            return {
                success: true,
                migrated: migrated.length,
                errors
            };
        } catch (error: any) {
            errors.push(`Upload to server failed: ${error.message}`);
            return {
                success: false,
                migrated: 0,
                errors
            };
        }
    }

    return {
        success: true,
        migrated: 0,
        errors
    };
}

/**
 * Check if migration is needed
 */
export function needsMigration(): boolean {
    return LEGACY_KEYS.some(key => localStorage.getItem(key) !== null);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clear all cached preferences
 */
export function clearCache() {
    cache.invalidate();
    console.log('✅ Cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
    return {
        isValid: cache.isValid(),
        version: cache.getVersion(),
        hasData: cache.get() !== null
    };
}

/**
 * Export preferences for backup
 */
export async function exportPreferences(): Promise<string> {
    const response = await getAllPreferences(false);
    return JSON.stringify(response.data, null, 2);
}

/**
 * Import preferences from backup
 */
export async function importPreferences(jsonData: string): Promise<PreferencesResponse> {
    try {
        const data = JSON.parse(jsonData);
        return await updateAllPreferences(data.preferences || data, 'import');
    } catch (error: any) {
        throw new Error(`Import failed: ${error.message}`);
    }
}

// ============================================================================
// AUTO-SYNC (Optional)
// ============================================================================

let syncIntervalId: NodeJS.Timeout | null = null;

/**
 * Start automatic background sync
 */
export function startAutoSync(interval = SYNC_INTERVAL) {
    if (syncIntervalId) {
        console.warn('Auto-sync already running');
        return;
    }

    console.log(`🔄 Starting auto-sync (interval: ${interval}ms)`);
    
    syncIntervalId = setInterval(async () => {
        try {
            const localPrefs = cache.get();
            const localVersion = cache.getVersion();
            
            if (localPrefs && localVersion > 0) {
                await syncPreferences(localPrefs, localVersion);
            }
        } catch (error) {
            console.error('Auto-sync failed:', error);
        }
    }, interval);
}

/**
 * Stop automatic background sync
 */
export function stopAutoSync() {
    if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
        console.log('✅ Auto-sync stopped');
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * User Preferences Service API
 */
export const userPreferencesService = {
    // Main API
    getPreferences: getAllPreferences,
    getCategoryPreferences,
    updatePreference: updateCategoryPreferences,
    updateAllPreferences,
    bulkUpdatePreferences,
    syncPreferences,
    getPreferenceHistory,
    getCategories,
    
    // Migration
    migrateLegacyPreferences,
    needsMigration,
    
    // Cache
    clearCache,
    getCacheStats,
    
    // Import/Export
    exportPreferences,
    importPreferences,
    
    // Auto-sync
    startAutoSync,
    stopAutoSync
};

// Default export for backward compatibility
export default userPreferencesService;
