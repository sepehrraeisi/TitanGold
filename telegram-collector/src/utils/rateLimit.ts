/**
 * Rate Limiter Middleware
 * Prevents API abuse using Token Bucket and Sliding Window algorithms
 */

interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Maximum requests per window
    message?: string;      // Custom error message
    skipSuccessfulRequests?: boolean;  // Don't count successful requests
    skipFailedRequests?: boolean;      // Don't count failed requests
}

interface RequestRecord {
    count: number;
    resetTime: number;
    requests: number[];  // Timestamps for sliding window
}

/**
 * In-memory store for rate limiting
 * In production, use Redis for distributed rate limiting
 */
class RateLimitStore {
    private store: Map<string, RequestRecord> = new Map();
    
    // Clean up expired entries every 5 minutes
    constructor() {
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
    
    get(key: string): RequestRecord | undefined {
        return this.store.get(key);
    }
    
    set(key: string, record: RequestRecord): void {
        this.store.set(key, record);
    }
    
    delete(key: string): void {
        this.store.delete(key);
    }
    
    private cleanup(): void {
        const now = Date.now();
        for (const [key, record] of this.store.entries()) {
            if (record.resetTime < now) {
                this.store.delete(key);
            }
        }
    }
    
    getStats() {
        return {
            totalKeys: this.store.size,
            keys: Array.from(this.store.keys()).slice(0, 10)  // Top 10
        };
    }
}

const rateLimitStore = new RateLimitStore();

/**
 * Create rate limiter middleware
 * 
 * @example
 * app.use('/api', rateLimiter({ windowMs: 60000, maxRequests: 100 }));
 */
export function rateLimiter(config: RateLimitConfig) {
    const {
        windowMs,
        maxRequests,
        message = 'Too many requests, please try again later',
        skipSuccessfulRequests = false,
        skipFailedRequests = false
    } = config;
    
    return (req: any, res: any, next: any) => {
        // Get client identifier (IP address)
        const clientId = getClientIdentifier(req);
        const now = Date.now();
        
        // Get or create record
        let record = rateLimitStore.get(clientId);
        
        if (!record) {
            record = {
                count: 0,
                resetTime: now + windowMs,
                requests: []
            };
        }
        
        // Reset if window expired
        if (now > record.resetTime) {
            record = {
                count: 0,
                resetTime: now + windowMs,
                requests: []
            };
        }
        
        // Sliding window: remove old requests
        record.requests = record.requests.filter(timestamp => timestamp > now - windowMs);
        
        // Check limit
        if (record.requests.length >= maxRequests) {
            const retryAfter = Math.ceil((record.resetTime - now) / 1000);
            
            res.setHeader('Retry-After', retryAfter);
            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', 0);
            res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());
            
            return res.status(429).json({
                error: 'Rate limit exceeded',
                message,
                retryAfter: `${retryAfter}s`,
                limit: maxRequests,
                window: `${windowMs / 1000}s`
            });
        }
        
        // Add current request
        record.requests.push(now);
        record.count++;
        rateLimitStore.set(clientId, record);
        
        // Set headers
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', maxRequests - record.requests.length);
        res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());
        
        // Handle response to update count
        if (skipSuccessfulRequests || skipFailedRequests) {
            const originalSend = res.send;
            res.send = function (data: any) {
                const shouldSkip = 
                    (skipSuccessfulRequests && res.statusCode < 400) ||
                    (skipFailedRequests && res.statusCode >= 400);
                
                if (shouldSkip && record) {
                    record.requests.pop();  // Remove this request from count
                    rateLimitStore.set(clientId, record);
                }
                
                return originalSend.call(this, data);
            };
        }
        
        next();
    };
}

/**
 * Get client identifier from request
 */
function getClientIdentifier(req: any): string {
    // Try to get real IP from proxy headers
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
        return realIp;
    }
    
    // Fallback to direct connection IP
    return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Token Bucket Rate Limiter
 * Better for burst handling
 */
export class TokenBucketLimiter {
    private tokens: number;
    private lastRefill: number;
    
    constructor(
        private readonly capacity: number,
        private readonly refillRate: number,  // tokens per second
        private readonly refillInterval: number = 1000
    ) {
        this.tokens = capacity;
        this.lastRefill = Date.now();
    }
    
    private refill(): void {
        const now = Date.now();
        const timePassed = now - this.lastRefill;
        const tokensToAdd = (timePassed / this.refillInterval) * this.refillRate;
        
        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }
    
    tryConsume(tokens: number = 1): boolean {
        this.refill();
        
        if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
        }
        
        return false;
    }
    
    getAvailableTokens(): number {
        this.refill();
        return Math.floor(this.tokens);
    }
    
    getStats() {
        return {
            available: this.getAvailableTokens(),
            capacity: this.capacity,
            refillRate: this.refillRate
        };
    }
}

/**
 * Per-endpoint rate limiters with different limits
 */
export const rateLimiters = {
    // Strict limit for data fetching
    strict: rateLimiter({
        windowMs: 60 * 1000,      // 1 minute
        maxRequests: 30,          // 30 requests per minute
        message: 'Too many requests to this endpoint. Please slow down.'
    }),
    
    // Moderate limit for channel operations
    moderate: rateLimiter({
        windowMs: 60 * 1000,      // 1 minute
        maxRequests: 60,          // 60 requests per minute
        message: 'Too many requests. Please wait a moment.'
    }),
    
    // Lenient limit for health checks
    lenient: rateLimiter({
        windowMs: 60 * 1000,      // 1 minute
        maxRequests: 120,         // 120 requests per minute
        skipSuccessfulRequests: true
    }),
    
    // Very strict for authentication
    auth: rateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,           // 5 attempts per 15 minutes
        message: 'Too many login attempts. Please try again later.'
    })
};

/**
 * Get rate limiter stats
 */
export function getRateLimiterStats() {
    return rateLimitStore.getStats();
}

/**
 * Clear rate limiter for a client (admin function)
 */
export function clearRateLimit(clientId: string) {
    rateLimitStore.delete(clientId);
}

/**
 * Global rate limiter for entire service
 */
export const globalRateLimiter = new TokenBucketLimiter(
    1000,  // capacity: 1000 tokens
    100,   // refill: 100 tokens per second
    1000   // interval: 1 second
);
