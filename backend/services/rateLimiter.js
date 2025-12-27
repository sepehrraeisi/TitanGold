/**
 * Rate Limiter با Exponential Backoff + Jitter + Cache
 * برای مدیریت درخواست‌های API صرافی‌ها
 */

class RateLimiter {
  constructor(config = {}) {
    this.maxRequests = config.maxRequests || 100; // Max requests per window
    this.windowMs = config.windowMs || 60000; // 1 minute
    this.minDelay = config.minDelay || 100; // 100ms
    this.maxDelay = config.maxDelay || 60000; // 60s
    this.jitterFactor = config.jitterFactor || 0.1; // 10%
    
    // Track requests per endpoint
    this.requests = new Map();
    this.backoffDelays = new Map();
    this.cache = new Map();
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
   */
  async execute(key, fn, useCache = false, cacheTtl = 300000) {
    // Check cache first
    if (useCache) {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < cacheTtl) {
        console.log(`✅ Cache hit for ${key}`);
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
      
      // Cache successful result
      if (useCache) {
        this.cache.set(key, {
          data: result,
          timestamp: Date.now(),
        });
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
  cleanupCache(maxAge = 600000) {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.cache.delete(key);
      }
    }
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

// Cleanup expired cache every 5 minutes
setInterval(() => {
  mexcLimiter.cleanupCache();
  exchangeLimiter.cleanupCache();
}, 300000);

export default RateLimiter;
