// Database Service using IndexedDB for persistent storage with localStorage fallback
import type {
  User,
  FavoriteItem,
  PortfolioPageData,
  Trade,
} from '../types.ts';

const DB_NAME = 'TitanTradingDB';
const DB_VERSION = 1;
const STORAGE_PREFIX = 'titan_';

class DatabaseService {
  private db: IDBDatabase | null = null;
  private useIndexedDB: boolean = true;

  async init(): Promise<void> {
    // Check if IndexedDB is available
    if (!window.indexedDB) {
      console.warn('IndexedDB not available, using localStorage');
      this.useIndexedDB = false;
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.warn('IndexedDB failed to open, using localStorage:', request.error);
        this.useIndexedDB = false;
        resolve(); // Don't reject, fallback to localStorage
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.useIndexedDB = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('notificationSettings')) {
          db.createObjectStore('notificationSettings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('favorites')) {
          db.createObjectStore('favorites', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('trades')) {
          db.createObjectStore('trades', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('portfolio')) {
          db.createObjectStore('portfolio', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('connectionSettings')) {
          db.createObjectStore('connectionSettings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('walletConnections')) {
          db.createObjectStore('walletConnections', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('defiPositions')) {
          db.createObjectStore('defiPositions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('aiAgents')) {
          db.createObjectStore('aiAgents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('aiTrainingSessions')) {
          db.createObjectStore('aiTrainingSessions', { keyPath: 'id' });
        }
        // automationSettings is stored in 'settings' store with key 'automation'
        // aiCenter data is stored in 'settings' store with keys: 'ai_overview', 'ai_analytics', 'ai_api_config'
      };
    });
  }

  async save<T>(storeName: string, data: T): Promise<void> {
    if (this.useIndexedDB && this.db) {
      try {
        return new Promise((resolve, reject) => {
          const transaction = this.db!.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          const request = store.put(data);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (e) {
        console.warn('IndexedDB save failed, using localStorage:', e);
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

  async get<T>(storeName: string, key: string): Promise<T | null> {
    if (this.useIndexedDB && this.db) {
      try {
        return new Promise((resolve, reject) => {
          const transaction = this.db!.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const request = store.get(key);
          request.onsuccess = () => {
            const result = request.result;
            // For settings store, result might have { key, value } structure
            if (result && storeName === 'settings' && 'value' in result) {
              resolve(result as T);
            } else {
              resolve(result || null);
            }
          };
          request.onerror = () => reject(request.error);
        });
      } catch (e) {
        console.warn('IndexedDB get failed, using localStorage:', e);
        this.useIndexedDB = false;
      }
    }

    // Fallback to localStorage
    try {
      const storageKey = `${STORAGE_PREFIX}${storeName}`;
      if (storeName === 'settings') {
        // For settings, try to get by key
        const items = this.getFromLocalStorage<Array<{ key: string; value: any }>>(storageKey) || [];
        const found = items.find((item: any) => item.key === key);
        return found ? (found as T) : null;
      } else {
        // For other stores, use id
        const items = this.getFromLocalStorage<T[]>(storageKey) || [];
        return items.find((item: any) => (item as any).id === key) || null;
      }
    } catch (e) {
      console.error('localStorage get failed:', e);
      return null;
    }
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    if (this.useIndexedDB && this.db) {
      try {
        return new Promise((resolve, reject) => {
          const transaction = this.db!.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
        });
      } catch (e) {
        console.warn('IndexedDB getAll failed, using localStorage:', e);
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
    if (this.useIndexedDB && this.db) {
      try {
        return new Promise((resolve, reject) => {
          const transaction = this.db!.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          const request = store.delete(key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (e) {
        console.warn('IndexedDB delete failed, using localStorage:', e);
        this.useIndexedDB = false;
      }
    }

    // Fallback to localStorage
    try {
      const storageKey = `${STORAGE_PREFIX}${storeName}`;
      const items = this.getFromLocalStorage<T[]>(storageKey) || [];
      const filtered = items.filter((item: any) => (item as any).id !== key);
      localStorage.setItem(storageKey, JSON.stringify(filtered));
    } catch (e) {
      console.error('localStorage delete failed:', e);
      throw e;
    }
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
