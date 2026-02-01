// Database Service using Dexie (wrapper around IndexedDB) for persistent storage with localStorage fallback
// Updated with atomic transactions (FRONTEND-007)
import Dexie, { Table } from 'dexie';
import type {
  User,
  FavoriteItem,
  PortfolioPageData,
  Trade,
  AIAgent,
} from '../types.ts';

const DB_NAME = 'TitanTradingDB';
const DB_VERSION = 1;
const STORAGE_PREFIX = 'titan_';

// Define the database schema using Dexie
class TitanTradingDB extends Dexie {
  users!: Table<User, string>;
  notificationSettings!: Table<any, string>;
  favorites!: Table<FavoriteItem, string>;
  trades!: Table<Trade, string>;
  settings!: Table<{ key: string; value?: any; [key: string]: any }, string>;
  portfolio!: Table<any, string>;
  connectionSettings!: Table<any, string>;
  walletConnections!: Table<any, string>;
  defiPositions!: Table<any, string>;
  aiAgents!: Table<AIAgent, string>;
  aiTrainingSessions!: Table<any, string>;

  constructor() {
    super(DB_NAME);
    this.version(DB_VERSION).stores({
      users: 'id',
      notificationSettings: 'id',
      favorites: 'id',
      trades: 'id',
      settings: 'key',
      portfolio: 'id',
      connectionSettings: 'id',
      walletConnections: 'id',
      defiPositions: 'id',
      aiAgents: 'id',
      aiTrainingSessions: 'id',
    });
  }
}

class DatabaseService {
  private dexieDb: TitanTradingDB;
  private useIndexedDB: boolean = true;

  constructor() {
    this.dexieDb = new TitanTradingDB();
  }

  async init(): Promise<void> {
    // Check if IndexedDB is available
    if (!window.indexedDB) {
      console.warn('IndexedDB not available, using localStorage');
      this.useIndexedDB = false;
      return;
    }

    try {
      // Open the database to verify it works
      await this.dexieDb.open();
      this.useIndexedDB = true;
      console.log('✅ Dexie database initialized successfully');
    } catch (error) {
      console.warn('Dexie DB failed to open, using localStorage:', error);
      this.useIndexedDB = false;
    }
  }

  async save<T>(storeName: string, data: T): Promise<void> {
    if (this.useIndexedDB) {
      try {
        const table = (this.dexieDb as any)[storeName];
        if (!table) {
          throw new Error(`Store ${storeName} not found`);
        }
        await table.put(data);
        return;
      } catch (e) {
        console.warn('Dexie save failed, using localStorage:', e);
        this.useIndexedDB = false;
      }
    }

    // Fallback to localStorage
    try {
      const key = `${STORAGE_PREFIX}${storeName}`;
      if (typeof data === 'object' && data !== null && 'id' in data) {
        // Save single item
        const existing = this.getFromLocalStorage<T[]>(key) || [];
        const index = existing.findIndex((item: any) => (item as any).id === (data as any).id);
        if (index >= 0) {
          existing[index] = data;
        } else {
          existing.push(data);
        }
        localStorage.setItem(key, JSON.stringify(existing));
      } else {
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (e) {
      console.error('localStorage save failed:', e);
      throw e;
    }
  }

  /**
   * Save multiple items in a single atomic transaction (FRONTEND-007)
   * Rolls back all changes if any save fails
   * Uses parallel processing for better performance
   * @param storeName - The store name (e.g., 'aiAgents')
   * @param items - Array of items to save
   * @returns Promise that resolves when all saves complete or rejects on error
   */
  async saveAll<T>(storeName: string, items: T[]): Promise<void> {
    if (items.length === 0) return;

    if (this.useIndexedDB) {
      try {
        const table = (this.dexieDb as any)[storeName];
        if (!table) {
          throw new Error(`Store ${storeName} not found`);
        }

        // Use Dexie transaction for atomic operation
        // If any save fails, all changes are rolled back automatically
        await this.dexieDb.transaction('rw', table, async () => {
          // Use bulkPut for optimal performance (Dexie optimizes this internally)
          await table.bulkPut(items);
        });
        
        console.log(`✅ Saved ${items.length} items to ${storeName} in single transaction`);
        return;
      } catch (e) {
        console.warn('Dexie bulk save failed, using localStorage:', e);
        this.useIndexedDB = false;
        // Fall through to localStorage
      }
    }

    // Fallback to localStorage
    try {
      const key = `${STORAGE_PREFIX}${storeName}`;
      
      // Get existing items
      const existing = this.getFromLocalStorage<T[]>(key) || [];
      
      // Create a map for O(1) lookups
      const existingMap = new Map(
        existing.map((item: any) => [(item as any).id, item])
      );
      
      // Update or add new items
      for (const item of items) {
        if (typeof item === 'object' && item !== null && 'id' in item) {
          existingMap.set((item as any).id, item);
        }
      }
      
      // Convert back to array and save
      const updated = Array.from(existingMap.values());
      localStorage.setItem(key, JSON.stringify(updated));
      
      console.log(`✅ Saved ${items.length} items to ${storeName} (localStorage fallback)`);
    } catch (e) {
      console.error('localStorage bulk save failed:', e);
      throw e;
    }
  }

  async get<T>(storeName: string, key: string): Promise<T | null> {
    if (this.useIndexedDB) {
      try {
        const table = (this.dexieDb as any)[storeName];
        if (!table) {
          throw new Error(`Store ${storeName} not found`);
        }
        const result = await table.get(key);
        // For settings store, result might have { key, value } structure
        if (result && storeName === 'settings' && 'value' in result) {
          return result as T;
        }
        return result || null;
      } catch (e) {
        console.warn('Dexie get failed, using localStorage:', e);
        this.useIndexedDB = false;
      }
    }

    // Fallback to localStorage
    try {
      const storageKey = `${STORAGE_PREFIX}${storeName}`;
      if (storeName === 'settings') {
        // For settings, try to get by key
        const items = this.getFromLocalStorage<Array<{ key: string; value: any }>>(storageKey);
        // Ensure items is an array
        if (!items || !Array.isArray(items)) {
          return null;
        }
        const found = items.find((item: any) => item.key === key);
        return found ? (found as T) : null;
      } else {
        // For other stores, use id
        const items = this.getFromLocalStorage<T[]>(storageKey);
        // Ensure items is an array
        if (!items || !Array.isArray(items)) {
          return null;
        }
        return items.find((item: any) => (item as any).id === key) || null;
      }
    } catch (e) {
      console.error('localStorage get failed:', e);
      return null;
    }
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    if (this.useIndexedDB) {
      try {
        const table = (this.dexieDb as any)[storeName];
        if (!table) {
          throw new Error(`Store ${storeName} not found`);
        }
        const result = await table.toArray();
        return result || [];
      } catch (e) {
        console.warn('Dexie getAll failed, using localStorage:', e);
        this.useIndexedDB = false;
      }
    }

    // Fallback to localStorage
    try {
      const storageKey = `${STORAGE_PREFIX}${storeName}`;
      return this.getFromLocalStorage<T[]>(storageKey) || [];
    } catch (e) {
      console.error('localStorage getAll failed:', e);
      return [];
    }
  }

  async delete(storeName: string, key: string): Promise<void> {
    if (this.useIndexedDB) {
      try {
        const table = (this.dexieDb as any)[storeName];
        if (!table) {
          throw new Error(`Store ${storeName} not found`);
        }
        await table.delete(key);
        return;
      } catch (e) {
        console.warn('Dexie delete failed, using localStorage:', e);
        this.useIndexedDB = false;
      }
    }

    // Fallback to localStorage
    try {
      const storageKey = `${STORAGE_PREFIX}${storeName}`;
      const items = this.getFromLocalStorage<any[]>(storageKey) || [];
      const filtered = items.filter((item: any) => (item as any).id !== key);
      localStorage.setItem(storageKey, JSON.stringify(filtered));
    } catch (e) {
      console.error('localStorage delete failed:', e);
      throw e;
    }
  }

  /**
   * Clear all data from a store (FRONTEND-007)
   * Useful for testing rollback behavior
   */
  async clear(storeName: string): Promise<void> {
    if (this.useIndexedDB) {
      try {
        const table = (this.dexieDb as any)[storeName];
        if (!table) {
          throw new Error(`Store ${storeName} not found`);
        }
        await table.clear();
        return;
      } catch (e) {
        console.warn('Dexie clear failed, using localStorage:', e);
        this.useIndexedDB = false;
      }
    }

    // Fallback to localStorage
    try {
      const storageKey = `${STORAGE_PREFIX}${storeName}`;
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error('localStorage clear failed:', e);
      throw e;
    }
  }

  /**
   * Get database instance for advanced operations (FRONTEND-007)
   * Allows direct access to Dexie for custom transactions
   */
  getDb(): TitanTradingDB {
    return this.dexieDb;
  }

  /**
   * Check if using IndexedDB or localStorage fallback
   */
  isUsingIndexedDB(): boolean {
    return this.useIndexedDB;
  }

  private getFromLocalStorage<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Failed to parse localStorage item:', e);
      return null;
    }
  }
}

export const database = new DatabaseService();
