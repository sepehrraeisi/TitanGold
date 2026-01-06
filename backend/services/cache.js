import { getRedisClient, isRedisAvailable } from '../utils/redis.js';

// Cache statistics for monitoring
let cacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  sets: 0,
  deletes: 0
};

/**
 * Get cache statistics
 * @returns {Object} Cache hit/miss stats
 */
export function getCacheStats() {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? ((cacheStats.hits / total) * 100).toFixed(2) : 0;
  
  return {
    ...cacheStats,
    total_requests: total,
    hit_rate: parseFloat(hitRate)
  };
}

/**
 * Reset cache statistics
 */
export function resetCacheStats() {
  cacheStats = {
    hits: 0,
    misses: 0,
    errors: 0,
    sets: 0,
    deletes: 0
  };
}

/**
 * Build cache key for agent results
 * Format: agent:{agent_key}:{symbol}:{timeframe}
 * 
 * @param {string} agentKey - Agent key (e.g., 'technical', 'arbitrage')
 * @param {string} symbol - Trading symbol (e.g., 'BTCUSDT')
 * @param {string} timeframe - Timeframe (e.g., '1h', '1d')
 * @returns {string} Cache key
 */
export function buildCacheKey(agentKey, symbol = 'default', timeframe = '1h') {
  return `agent:${agentKey}:${symbol}:${timeframe}`;
}

/**
 * Get value from Redis cache
 * 
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached value or null if not found/expired
 */
export async function getCache(key) {
  try {
    if (!isRedisAvailable()) {
      console.warn('⚠️ Redis not available, cache miss');
      cacheStats.misses++;
      return null;
    }

    const client = await getRedisClient();
    const value = await client.get(key);
    
    if (value) {
      cacheStats.hits++;
      console.log(`✅ Cache HIT: ${key}`);
      return JSON.parse(value);
    } else {
      cacheStats.misses++;
      console.log(`❌ Cache MISS: ${key}`);
      return null;
    }
  } catch (error) {
    cacheStats.errors++;
    console.error(`❌ Cache get error for key ${key}:`, error.message);
    return null; // Fail gracefully
  }
}

/**
 * Set value in Redis cache with TTL
 * 
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON stringified)
 * @param {number} ttlSeconds - Time to live in seconds (default: 300 = 5 minutes)
 * @returns {Promise<boolean>} Success status
 */
export async function setCache(key, value, ttlSeconds = 300) {
  try {
    if (!isRedisAvailable()) {
      console.warn('⚠️ Redis not available, skipping cache set');
      return false;
    }

    const client = await getRedisClient();
    const serialized = JSON.stringify(value);
    
    // Use EX option for TTL in seconds
    await client.set(key, serialized, {
      EX: ttlSeconds
    });
    
    cacheStats.sets++;
    console.log(`💾 Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
    return true;
  } catch (error) {
    cacheStats.errors++;
    console.error(`❌ Cache set error for key ${key}:`, error.message);
    return false; // Fail gracefully
  }
}

/**
 * Delete value from Redis cache
 * 
 * @param {string} key - Cache key or pattern (with wildcards)
 * @returns {Promise<number>} Number of keys deleted
 */
export async function deleteCache(key) {
  try {
    if (!isRedisAvailable()) {
      console.warn('⚠️ Redis not available, skipping cache delete');
      return 0;
    }

    const client = await getRedisClient();
    
    // If key contains wildcard, use SCAN + DEL pattern
    if (key.includes('*')) {
      let cursor = '0';
      let deletedCount = 0;
      
      do {
        const result = await client.scan(cursor, {
          MATCH: key,
          COUNT: 100
        });
        
        cursor = result.cursor;
        const keys = result.keys;
        
        if (keys.length > 0) {
          const deleted = await client.del(keys);
          deletedCount += deleted;
        }
      } while (cursor !== '0');
      
      cacheStats.deletes += deletedCount;
      console.log(`🗑️  Cache DELETE pattern: ${key} (${deletedCount} keys)`);
      return deletedCount;
    } else {
      // Single key delete
      const deleted = await client.del(key);
      cacheStats.deletes += deleted;
      console.log(`🗑️  Cache DELETE: ${key}`);
      return deleted;
    }
  } catch (error) {
    cacheStats.errors++;
    console.error(`❌ Cache delete error for key ${key}:`, error.message);
    return 0;
  }
}

/**
 * Invalidate all cache entries for a specific agent
 * 
 * @param {string} agentKey - Agent key (e.g., 'technical', 'arbitrage')
 * @returns {Promise<number>} Number of keys deleted
 */
export async function invalidateAgentCache(agentKey) {
  const pattern = `agent:${agentKey}:*`;
  const deleted = await deleteCache(pattern);
  console.log(`🔄 Invalidated cache for agent: ${agentKey} (${deleted} keys)`);
  return deleted;
}

/**
 * Invalidate cache for specific agent + symbol
 * 
 * @param {string} agentKey - Agent key
 * @param {string} symbol - Trading symbol
 * @returns {Promise<number>} Number of keys deleted
 */
export async function invalidateAgentSymbolCache(agentKey, symbol) {
  const pattern = `agent:${agentKey}:${symbol}:*`;
  const deleted = await deleteCache(pattern);
  console.log(`🔄 Invalidated cache for ${agentKey}/${symbol} (${deleted} keys)`);
  return deleted;
}

/**
 * Get or set cache (convenience method)
 * 
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Async function to fetch data if cache miss
 * @param {number} ttlSeconds - TTL in seconds
 * @returns {Promise<any>} Cached or fresh data
 */
export async function getCacheOrFetch(key, fetchFn, ttlSeconds = 300) {
  // Try cache first
  const cached = await getCache(key);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }
  
  // Cache miss - fetch fresh data
  const fresh = await fetchFn();
  
  // Store in cache
  await setCache(key, fresh, ttlSeconds);
  
  return { data: fresh, fromCache: false };
}

export default {
  buildCacheKey,
  getCache,
  setCache,
  deleteCache,
  invalidateAgentCache,
  invalidateAgentSymbolCache,
  getCacheOrFetch,
  getCacheStats,
  resetCacheStats
};
