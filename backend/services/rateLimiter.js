/**
 * Rate Limiter با Exponential Backoff + Jitter + LRU Cache
 * برای مدیریت درخواست‌های API صرافی‌ها
 * 
 * Cache Strategy:
 * - Markets: 15min TTL (infrequent changes)
 * - Prices: 30s TTL (UI responsiveness)
 * - LRU eviction: max 100 entries
 */

class RateLimiter {
  constructor(config = {}) {
    this.maxRequests = config.maxRequests || 100; // Max requests per window
    this.windowMs = config.windowMs || 60000; // 1 minute
    this.minDelay = config.minDelay || 100; // 100ms
    this.maxDelay = config.maxDelay || 60000; // 60s
    this.jitterFactor = config.jitterFactor || 0.1; // 10%
    this.maxCacheSize = config.maxCacheSize || 100; // Increased from 50
    
    // Track requests per endpoint
    this.requests = new Map();
    this.backoffDelays = new Map();
    this.cache = new Map();
    this.cacheAccessOrder = []; // For LRU
  }

  /**
   * Calculate exponential backoff with jitter
   */
  calculateBackoff(attempts) {
    const exponential = Math.min(
      this.minDelay * Math.pow(2, attempts),
      this.maxDelay
    );
    
    // Add jitter (±10%)
    const jitter = exponential * this.jitterFactor * (Math.random() * 2 - 1);
    return Math.floor(exponential + jitter);
  }

  /**
   * Check if we can make a request
   */
  canMakeRequest(key) {
    const now = Date.now();
    const requestLog = this.requests.get(key) || [];
    
    // Remove expired requests
    const validRequests = requestLog.filter(
      timestamp => now - timestamp < this.windowMs
    );
    
    this.requests.set(key, validRequests);
    
    // Check if we're under limit
    return validRequests.length < this.maxRequests;
  }

  /**
   * Record a request
   */
  recordRequest(key) {
    const now = Date.now();
    const requestLog = this.requests.get(key) || [];
    requestLog.push(now);
    this.requests.set(key, requestLog);
    
    // Reset backoff on successful request
    this.backoffDelays.delete(key);
  }

  /**
   * Record a failed request (429 or error)
   */
  recordFailure(key) {
    const attempts = this.backoffDelays.get(key) || 0;
    this.backoffDelays.set(key, attempts + 1);
    
    const backoffMs = this.calculateBackoff(attempts);
    console.log(`⏱️  Rate limit hit for ${key}, backing off for ${backoffMs}ms (attempt ${attempts + 1})`);
    
    return backoffMs;
  }

  /**
   * Get current backoff delay
   */
  getBackoffDelay(key) {
    const attempts = this.backoffDelays.get(key) || 0;
    if (attempts === 0) return 0;
    
    return this.calculateBackoff(attempts - 1); // Use previous attempt's delay
  }

  /**
   * Wait for backoff period
   */
  async waitForBackoff(key) {
    const delay = this.getBackoffDelay(key);
    if (delay > 0) {
      console.log(`⏳ Waiting ${delay}ms before retry (${key})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Execute function with rate limiting
   * 
   * @param {string} key - Cache key
   * @param {function} fn - Function to execute
   * @param {boolean} useCache - Enable caching
   * @param {number} cacheTtl - Cache TTL in ms (default: context-specific)
   */
  async execute(key, fn, useCache = false, cacheTtl = null) {
    // Auto-detect TTL based on key pattern if not specified
    if (cacheTtl === null) {
      if (key.includes('loadMarkets') || key.includes('markets')) {
        cacheTtl = 900000; // 15 minutes for markets
      } else if (key.includes('ticker') || key.includes('price')) {
        cacheTtl = 30000; // 30 seconds for prices
      } else {
        cacheTtl = 60000; // 1 minute default
      }
    }

    // Check cache first
    if (useCache) {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < cacheTtl) {
        // Update LRU access order
        this.updateLRU(key);
        // console.log(`✅ Cache hit for ${key} (age: ${Math.floor((Date.now() - cached.timestamp) / 1000)}s)`);
        return cached.data;
      }
    }

    // Wait for backoff if needed
    await this.waitForBackoff(key);

    // Check rate limit
    if (!this.canMakeRequest(key)) {
      const backoffMs = this.recordFailure(key);
      throw new Error(`Rate limit exceeded for ${key}, retry after ${backoffMs}ms`);
    }

    try {
      const result = await fn();
      this.recordRequest(key);
      
      // Cache successful result with LRU eviction
      if (useCache) {
        this.setCacheWithLRU(key, result, cacheTtl);
      }
      
      return result;
    } catch (error) {
      // Handle 429 errors
      if (error.message?.includes('429') || error.code === 429) {
        const backoffMs = this.recordFailure(key);
        error.retryAfter = backoffMs;
      }
      throw error;
    }
  }

  /**
   * Set cache entry with LRU eviction
   */
  setCacheWithLRU(key, data, ttl) {
    // Enforce max cache size with LRU eviction
    if (this.cache.size >= this.maxCacheSize) {
      // Remove least recently used entry
      const lruKey = this.cacheAccessOrder.shift();
      if (lruKey && this.cache.has(lruKey)) {
        this.cache.delete(lruKey);
        // console.log(`🗑️ LRU evicted: ${lruKey}`);
      }
    }
    
    this.cache.set(key, {
      data: data,
      timestamp: Date.now(),
      ttl: ttl,
    });
    
    // Add to access order (most recent at end)
    this.updateLRU(key);
  }

  /**
   * Update LRU access order
   */
  updateLRU(key) {
    // Remove from current position
    const index = this.cacheAccessOrder.indexOf(key);
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1);
    }
    // Add to end (most recently used)
    this.cacheAccessOrder.push(key);
  }

  /**
   * Clear cache for a specific key or all
   */
  clearCache(key = null) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      totalRequests: Array.from(this.requests.values()).reduce(
        (sum, log) => sum + log.length,
        0
      ),
    };
  }

  /**
   * Clear expired cache entries
   */
  cleanupCache(maxAge = 900000) { // Increased from 120s to 15min
    const now = Date.now();
    let cleanedCount = 0;
    for (const [key, value] of this.cache.entries()) {
      const age = now - value.timestamp;
      const ttl = value.ttl || maxAge;
      if (age > ttl) {
        this.cache.delete(key);
        // Remove from LRU order
        const index = this.cacheAccessOrder.indexOf(key);
        if (index > -1) {
          this.cacheAccessOrder.splice(index, 1);
        }
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const stats = {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      utilizationPercent: Math.round((this.cache.size / this.maxCacheSize) * 100),
      entries: [],
      totalRequests: Array.from(this.requests.values()).reduce(
        (sum, log) => sum + log.length,
        0
      ),
    };

    // Add cache entry details
    for (const [key, value] of this.cache.entries()) {
      const age = Date.now() - value.timestamp;
      stats.entries.push({
        key,
        ageSeconds: Math.floor(age / 1000),
        ttlSeconds: Math.floor((value.ttl || 60000) / 1000),
      });
    }

    return stats;
  }
}

// Global instance for MEXC
export const mexcLimiter = new RateLimiter({
  maxRequests: 50, // MEXC allows ~50 requests per minute
  windowMs: 60000,
  minDelay: 1000,
  maxDelay: 60000,
  jitterFactor: 0.1,
});

// Global instance for other exchanges
export const exchangeLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000,
  minDelay: 500,
  maxDelay: 30000,
  jitterFactor: 0.1,
});

// Cleanup expired cache every 2 minutes (reduced from 1 minute)
// Less frequent cleanup since we have longer TTLs
setInterval(() => {
  mexcLimiter.cleanupCache();
  exchangeLimiter.cleanupCache();
}, 120000);

export default RateLimiter;
