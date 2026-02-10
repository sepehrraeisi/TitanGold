/**
 * Retry Utility with Exponential Backoff
 * Handles transient failures in Telegram API calls
 */

export interface RetryOptions {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    onRetry: () => {}
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
    const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
    const delayWithCap = Math.min(exponentialDelay, options.maxDelayMs);
    
    // Add jitter (±20%) to prevent thundering herd
    const jitter = delayWithCap * 0.2 * (Math.random() * 2 - 1);
    return Math.floor(delayWithCap + jitter);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED') {
        return true;
    }

    // Telegram rate limit errors
    if (error.message?.includes('FLOOD_WAIT') || 
        error.message?.includes('Too Many Requests') ||
        error.errorMessage === 'FLOOD') {
        return true;
    }

    // Telegram temporary errors
    if (error.message?.includes('INTERNAL') ||
        error.message?.includes('TIMEOUT') ||
        error.message?.includes('CONNECTION_NOT_INITED') ||
        error.errorMessage === 'TIMEOUT') {
        return true;
    }

    // HTTP 5xx errors
    if (error.response?.status >= 500 && error.response?.status < 600) {
        return true;
    }

    return false;
}

/**
 * Execute function with retry logic
 * 
 * @example
 * const result = await withRetry(
 *   () => client.getMessages(channel, { limit: 50 }),
 *   { 
 *     maxRetries: 3,
 *     onRetry: (err, attempt) => console.log(`Retry ${attempt}: ${err.message}`)
 *   }
 * );
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options };
    
    let lastError: Error;
    
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            
            // Check if we should retry
            if (attempt >= opts.maxRetries || !isRetryableError(error)) {
                throw error;
            }
            
            // Calculate delay
            const delay = calculateDelay(attempt, opts);
            
            // Call retry callback
            opts.onRetry(error, attempt + 1);
            
            console.warn(
                `⚠️  Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms - Error: ${error.message}`
            );
            
            // Wait before retrying
            await sleep(delay);
        }
    }
    
    throw lastError!;
}

/**
 * Retry decorator for class methods
 * 
 * @example
 * class TelegramService {
 *   @Retry({ maxRetries: 3 })
 *   async fetchMessages(channel: string) {
 *     return await client.getMessages(channel);
 *   }
 * }
 */
export function Retry(options: RetryOptions = {}) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function (...args: any[]) {
            return withRetry(
                () => originalMethod.apply(this, args),
                options
            );
        };
        
        return descriptor;
    };
}

/**
 * Circuit breaker state
 */
enum CircuitState {
    CLOSED = 'CLOSED',      // Normal operation
    OPEN = 'OPEN',          // Failing, reject immediately
    HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Circuit Breaker pattern for Telegram API
 * Prevents cascading failures by opening circuit after threshold
 */
export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private successCount: number = 0;
    private lastFailureTime: number = 0;
    
    constructor(
        private readonly failureThreshold: number = 5,
        private readonly resetTimeoutMs: number = 60000,
        private readonly halfOpenSuccessThreshold: number = 2
    ) {}
    
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // Check if circuit is open
        if (this.state === CircuitState.OPEN) {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;
            
            if (timeSinceLastFailure < this.resetTimeoutMs) {
                throw new Error(`Circuit breaker is OPEN. Try again in ${Math.ceil((this.resetTimeoutMs - timeSinceLastFailure) / 1000)}s`);
            }
            
            // Try half-open
            this.state = CircuitState.HALF_OPEN;
            this.successCount = 0;
            console.log('🔄 Circuit breaker transitioning to HALF_OPEN');
        }
        
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    
    private onSuccess(): void {
        this.failureCount = 0;
        
        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            
            if (this.successCount >= this.halfOpenSuccessThreshold) {
                this.state = CircuitState.CLOSED;
                console.log('✅ Circuit breaker CLOSED (recovered)');
            }
        }
    }
    
    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        this.successCount = 0;
        
        if (this.failureCount >= this.failureThreshold) {
            this.state = CircuitState.OPEN;
            console.error(`🔴 Circuit breaker OPEN after ${this.failureCount} failures`);
        }
    }
    
    getState(): CircuitState {
        return this.state;
    }
    
    getStats() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null
        };
    }
}
