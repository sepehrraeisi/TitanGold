/**
 * ============================================================================
 * TitanGold User Preferences React Hook
 * ============================================================================
 * 
 * React hook for managing user preferences with:
 *   - Automatic loading on mount
 *   - Optimistic updates
 *   - Error handling
 *   - Loading states
 *   - Auto-migration on first use
 * 
 * @module hooks/useUserPreferences
 * @version 1.0.0
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import userPreferencesService, {
    UserPreferences,
    ThemePreferences,
    LanguagePreferences,
    NotificationPreferences,
    TradingPreferences,
    WalletPreferences,
    SecurityPreferences,
    DashboardPreferences,
    ApiPreferences
} from '../services/userPreferences';

export interface UsePreferencesResult {
    // Data
    preferences: UserPreferences | null;
    version: number;
    
    // Loading states
    loading: boolean;
    saving: boolean;
    syncing: boolean;
    migrating: boolean;
    
    // Error handling
    error: string | null;
    
    // Actions
    refresh: () => Promise<void>;
    updateCategory: (category: keyof UserPreferences, values: any) => Promise<void>;
    bulkUpdate: (updates: Array<{ category: keyof UserPreferences; values: any }>) => Promise<void>;
    sync: () => Promise<void>;
    clear: () => void;
    
    // Migration
    runMigration: () => Promise<{ success: boolean; migrated: number; errors: string[] }>;
    needsMigration: boolean;
}

/**
 * Hook for managing user preferences
 */
export function useUserPreferences(): UsePreferencesResult {
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [version, setVersion] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [syncing, setSyncing] = useState<boolean>(false);
    const [migrating, setMigrating] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [needsMigration, setNeedsMigration] = useState<boolean>(false);

    /**
     * Load preferences from API
     */
    const loadPreferences = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await userPreferencesService.getAllPreferences(true);
            
            if (response.success && response.data) {
                setPreferences(response.data.preferences);
                setVersion(response.data.version);
            } else {
                throw new Error('Failed to load preferences');
            }
        } catch (err: any) {
            console.error('Error loading preferences:', err);
            setError(err.message || 'Failed to load preferences');
            
            // Try cache as fallback
            const cacheStats = userPreferencesService.getCacheStats();
            if (cacheStats.hasData) {
                const cached = await userPreferencesService.getAllPreferences(true);
                if (cached.success) {
                    setPreferences(cached.data.preferences);
                    setVersion(cached.data.version);
                    setError('Using cached preferences (offline mode)');
                }
            }
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Update a specific category
     */
    const updateCategory = useCallback(async (
        category: keyof UserPreferences,
        values: any
    ) => {
        try {
            setSaving(true);
            setError(null);
            
            // Optimistic update
            setPreferences(prev => prev ? { ...prev, [category]: values } : { [category]: values });
            
            const response = await userPreferencesService.updateCategoryPreferences(
                category,
                values,
                'web'
            );
            
            if (response.success && response.data) {
                setVersion(response.data.version);
                console.log(`✅ ${category} updated successfully`);
            } else {
                throw new Error(`Failed to update ${category}`);
            }
        } catch (err: any) {
            console.error(`Error updating ${category}:`, err);
            setError(err.message || `Failed to update ${category}`);
            
            // Revert optimistic update
            await loadPreferences();
        } finally {
            setSaving(false);
        }
    }, [loadPreferences]);

    /**
     * Bulk update multiple categories
     */
    const bulkUpdate = useCallback(async (
        updates: Array<{ category: keyof UserPreferences; values: any }>
    ) => {
        try {
            setSaving(true);
            setError(null);
            
            // Optimistic update
            setPreferences(prev => {
                const newPrefs = { ...prev };
                updates.forEach(({ category, values }) => {
                    newPrefs[category] = values;
                });
                return newPrefs;
            });
            
            const response = await userPreferencesService.bulkUpdatePreferences(updates, 'web');
            
            if (response.success && response.data) {
                setPreferences(response.data.preferences);
                setVersion(response.data.version);
                console.log(`✅ Bulk update successful: ${updates.length} categories`);
            } else {
                throw new Error('Bulk update failed');
            }
        } catch (err: any) {
            console.error('Error bulk updating:', err);
            setError(err.message || 'Failed to bulk update preferences');
            
            // Revert optimistic update
            await loadPreferences();
        } finally {
            setSaving(false);
        }
    }, [loadPreferences]);

    /**
     * Sync with server (handles conflicts)
     */
    const sync = useCallback(async () => {
        if (!preferences) return;
        
        try {
            setSyncing(true);
            setError(null);
            
            const response = await userPreferencesService.syncPreferences(
                preferences,
                version
            );
            
            if (response.success && response.data) {
                setPreferences(response.data.preferences);
                setVersion(response.data.version);
                
                if (response.sync?.hasConflict) {
                    setError(response.sync.message);
                    console.warn('⚠️ Sync conflict:', response.sync.message);
                } else {
                    console.log('✅ Sync successful:', response.sync?.action);
                }
            }
        } catch (err: any) {
            console.error('Error syncing:', err);
            setError(err.message || 'Failed to sync preferences');
        } finally {
            setSyncing(false);
        }
    }, [preferences, version]);

    /**
     * Refresh from server (bypass cache)
     */
    const refresh = useCallback(async () => {
        userPreferencesService.clearCache();
        await loadPreferences();
    }, [loadPreferences]);

    /**
     * Clear all preferences
     */
    const clear = useCallback(() => {
        userPreferencesService.clearCache();
        setPreferences(null);
        setVersion(0);
        setError(null);
    }, []);

    /**
     * Run migration from LocalStorage
     */
    const runMigration = useCallback(async () => {
        try {
            setMigrating(true);
            setError(null);
            
            const result = await userPreferencesService.migrateLegacyPreferences();
            
            if (result.success) {
                console.log(`✅ Migration completed: ${result.migrated} categories`);
                if (result.errors.length > 0) {
                    console.warn('Migration warnings:', result.errors);
                }
                
                // Reload preferences after migration
                await loadPreferences();
                setNeedsMigration(false);
            } else {
                throw new Error(`Migration failed: ${result.errors.join(', ')}`);
            }
            
            return result;
        } catch (err: any) {
            console.error('Migration error:', err);
            setError(err.message || 'Migration failed');
            return { success: false, migrated: 0, errors: [err.message] };
        } finally {
            setMigrating(false);
        }
    }, [loadPreferences]);

    /**
     * Initialize on mount
     */
    useEffect(() => {
        // Check if migration is needed
        const migrationNeeded = userPreferencesService.needsMigration();
        setNeedsMigration(migrationNeeded);
        
        // Load preferences
        loadPreferences();
        
        // Optional: Start auto-sync
        // userPreferencesService.startAutoSync();
        
        // Cleanup
        return () => {
            // userPreferencesService.stopAutoSync();
        };
    }, [loadPreferences]);

    return {
        // Data
        preferences,
        version,
        
        // States
        loading,
        saving,
        syncing,
        migrating,
        error,
        
        // Actions
        refresh,
        updateCategory,
        bulkUpdate,
        sync,
        clear,
        
        // Migration
        runMigration,
        needsMigration
    };
}

/**
 * Hook for a specific preference category
 */
export function useCategoryPreferences<T = any>(
    category: keyof UserPreferences
): {
    data: T | null;
    loading: boolean;
    saving: boolean;
    error: string | null;
    update: (values: Partial<T>) => Promise<void>;
    refresh: () => Promise<void>;
} {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const loadCategory = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await userPreferencesService.getCategoryPreferences(category, true);
            
            if (response.success && response.data) {
                setData(response.data.preferences);
            }
        } catch (err: any) {
            console.error(`Error loading ${category}:`, err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [category]);

    const update = useCallback(async (values: Partial<T>) => {
        try {
            setSaving(true);
            setError(null);
            
            // Optimistic update
            setData(prev => prev ? { ...prev, ...values } : values as T);
            
            const response = await userPreferencesService.updateCategoryPreferences(
                category,
                values,
                'web'
            );
            
            if (response.success && response.data) {
                setData(response.data.preferences);
            }
        } catch (err: any) {
            console.error(`Error updating ${category}:`, err);
            setError(err.message);
            await loadCategory();
        } finally {
            setSaving(false);
        }
    }, [category, loadCategory]);

    const refresh = useCallback(async () => {
        userPreferencesService.clearCache();
        await loadCategory();
    }, [loadCategory]);

    useEffect(() => {
        loadCategory();
    }, [loadCategory]);

    return {
        data,
        loading,
        saving,
        error,
        update,
        refresh
    };
}

export default useUserPreferences;
