import { jest } from '@jest/globals';

// Mock Redis client BEFORE importing cache
let mockRedisClient;
let mockData = new Map();

function createMockRedisClient() {
  mockData.clear();
  
  return {
    get: jest.fn(async (key) => mockData.get(key) || null),
    set: jest.fn(async (key, value, options) => {
      mockData.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (keys) => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      let deleted = 0;
      keyArray.forEach(key => {
        if (mockData.has(key)) {
          mockData.delete(key);
          deleted++;
        }
      });
      return deleted;
    }),
    scan: jest.fn(async (cursor, options) => {
      const keys = Array.from(mockData.keys());
      const pattern = options.MATCH.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      const matched = keys.filter(k => regex.test(k));
      
      return {
        cursor: '0',
        keys: matched
      };
    }),
    isOpen: true
  };
}

// Initialize mock client
mockRedisClient = createMockRedisClient();

jest.unstable_mockModule('../../utils/redis.js', () => ({
  getRedisClient: jest.fn(async () => mockRedisClient),
  isRedisAvailable: jest.fn(() => mockRedisClient?.isOpen === true)
}));

// Import cache service AFTER mocks are set up
const cacheModule = await import('../../services/cache.js');
const { 
  buildCacheKey, 
  getCache, 
  setCache, 
  deleteCache,
  invalidateAgentCache,
  invalidateAgentSymbolCache,
  getCacheOrFetch,
  getCacheStats,
  resetCacheStats
} = cacheModule;

describe('Cache Service', () => {
  beforeEach(() => {
    mockRedisClient = createMockRedisClient();
    mockData.clear();
    resetCacheStats();
  });

  describe('buildCacheKey', () => {
    test('should build correct cache key format', () => {
      const key = buildCacheKey('technical', 'BTCUSDT', '1h');
      expect(key).toBe('agent:technical:BTCUSDT:1h');
    });

    test('should use defaults for missing params', () => {
      const key = buildCacheKey('arbitrage');
      expect(key).toBe('agent:arbitrage:default:1h');
    });

    test('should handle all params', () => {
      const key = buildCacheKey('risk', 'ETHUSDT', '4h');
      expect(key).toBe('agent:risk:ETHUSDT:4h');
    });
  });

  describe('setCache and getCache', () => {
    test('should set and get simple value', async () => {
      const key = 'agent:technical:BTCUSDT:1h';
      const value = { signal: 'BUY', confidence: 0.85 };
      
      const setResult = await setCache(key, value, 300);
      expect(setResult).toBe(true);
      
      const cached = await getCache(key);
      expect(cached).toEqual(value);
    });

    test('should track cache hits', async () => {
      const key = 'agent:test:BTC:1h';
      await setCache(key, { test: 'data' }, 300);
      
      await getCache(key);
      await getCache(key);
      
      const stats = getCacheStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(0);
    });

    test('should track cache misses', async () => {
      await getCache('nonexistent:key');
      await getCache('another:missing');
      
      const stats = getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(2);
    });

    test('should calculate hit rate correctly', async () => {
      const key = 'agent:test:BTC:1h';
      await setCache(key, { test: 'data' }, 300);
      
      await getCache(key); // Hit
      await getCache(key); // Hit
      await getCache('missing'); // Miss
      
      const stats = getCacheStats();
      expect(stats.hit_rate).toBe(66.67); // 2/3 = 66.67%
    });

    test('should handle complex objects', async () => {
      const key = 'agent:complex:ETH:1d';
      const value = {
        indicators: [
          { name: 'RSI', value: 65, signal: 'NEUTRAL' },
          { name: 'MACD', value: 1.2, signal: 'BUY' }
        ],
        metadata: {
          timestamp: Date.now(),
          source: 'binance'
        }
      };
      
      await setCache(key, value, 300);
      const cached = await getCache(key);
      
      expect(cached).toEqual(value);
      expect(cached.indicators).toHaveLength(2);
    });

    test('should set TTL correctly', async () => {
      const key = 'agent:ttl:test:1h';
      await setCache(key, { data: 'test' }, 600);
      
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        key,
        expect.any(String),
        { EX: 600 }
      );
    });
  });

  describe('deleteCache', () => {
    test('should delete single key', async () => {
      const key = 'agent:test:BTC:1h';
      await setCache(key, { test: 'data' }, 300);
      
      const deleted = await deleteCache(key);
      expect(deleted).toBe(1);
      
      const cached = await getCache(key);
      expect(cached).toBeNull();
    });

    test('should delete with wildcard pattern', async () => {
      await setCache('agent:technical:BTC:1h', { test: 1 }, 300);
      await setCache('agent:technical:BTC:4h', { test: 2 }, 300);
      await setCache('agent:technical:ETH:1h', { test: 3 }, 300);
      
      const deleted = await deleteCache('agent:technical:BTC:*');
      expect(deleted).toBe(2);
      
      const btc1h = await getCache('agent:technical:BTC:1h');
      const btc4h = await getCache('agent:technical:BTC:4h');
      const eth1h = await getCache('agent:technical:ETH:1h');
      
      expect(btc1h).toBeNull();
      expect(btc4h).toBeNull();
      expect(eth1h).not.toBeNull();
    });
  });

  describe('invalidateAgentCache', () => {
    test('should invalidate all cache for agent', async () => {
      await setCache('agent:arbitrage:BTC:1h', { test: 1 }, 300);
      await setCache('agent:arbitrage:ETH:1h', { test: 2 }, 300);
      await setCache('agent:arbitrage:BTC:4h', { test: 3 }, 300);
      await setCache('agent:technical:BTC:1h', { test: 4 }, 300);
      
      const deleted = await invalidateAgentCache('arbitrage');
      expect(deleted).toBe(3);
      
      const techCache = await getCache('agent:technical:BTC:1h');
      expect(techCache).not.toBeNull();
    });
  });

  describe('invalidateAgentSymbolCache', () => {
    test('should invalidate cache for agent+symbol', async () => {
      await setCache('agent:technical:BTC:1h', { test: 1 }, 300);
      await setCache('agent:technical:BTC:4h', { test: 2 }, 300);
      await setCache('agent:technical:ETH:1h', { test: 3 }, 300);
      
      const deleted = await invalidateAgentSymbolCache('technical', 'BTC');
      expect(deleted).toBe(2);
      
      const ethCache = await getCache('agent:technical:ETH:1h');
      expect(ethCache).not.toBeNull();
    });
  });

  describe('getCacheOrFetch', () => {
    test('should return cached value if available', async () => {
      const key = 'agent:test:BTC:1h';
      const cachedData = { signal: 'BUY', fromCache: true };
      await setCache(key, cachedData, 300);
      
      const fetchFn = jest.fn(async () => ({ signal: 'SELL', fresh: true }));
      
      const result = await getCacheOrFetch(key, fetchFn, 300);
      
      expect(result.data).toEqual(cachedData);
      expect(result.fromCache).toBe(true);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    test('should fetch and cache on cache miss', async () => {
      const key = 'agent:test:ETH:1h';
      const freshData = { signal: 'BUY', fresh: true };
      const fetchFn = jest.fn(async () => freshData);
      
      const result = await getCacheOrFetch(key, fetchFn, 300);
      
      expect(result.data).toEqual(freshData);
      expect(result.fromCache).toBe(false);
      expect(fetchFn).toHaveBeenCalled();
      
      // Verify it was cached
      const cached = await getCache(key);
      expect(cached).toEqual(freshData);
    });
  });

  describe('getCacheStats', () => {
    test('should return accurate statistics', async () => {
      resetCacheStats();
      
      await setCache('key1', 'val1', 300);
      await setCache('key2', 'val2', 300);
      
      await getCache('key1'); // Hit
      await getCache('missing'); // Miss
      await getCache('key2'); // Hit
      
      await deleteCache('key1');
      
      const stats = getCacheStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(2);
      expect(stats.deletes).toBe(1);
      expect(stats.total_requests).toBe(3);
      expect(stats.hit_rate).toBe(66.67);
    });
  });

  describe('error handling', () => {
    test('should handle Redis unavailable gracefully', async () => {
      const redisUtils = await import('../../utils/redis.js');
      redisUtils.isRedisAvailable.mockReturnValue(false);
      
      const result = await getCache('any:key');
      expect(result).toBeNull();
      
      const setResult = await setCache('any:key', 'value', 300);
      expect(setResult).toBe(false);
      
      // Restore
      redisUtils.isRedisAvailable.mockReturnValue(true);
    });

    test('should fail gracefully on Redis errors', async () => {
      const originalGet = mockRedisClient.get;
      mockRedisClient.get = jest.fn().mockRejectedValue(new Error('Redis error'));
      
      const result = await getCache('error:key');
      expect(result).toBeNull();
      
      const stats = getCacheStats();
      expect(stats.errors).toBeGreaterThan(0);
      
      // Restore
      mockRedisClient.get = originalGet;
    });
  });
});
