/**
 * BACKEND-016: Circuit Breaker Implementation
 * 
 * Implements the circuit breaker pattern for external API calls (MEXC, etc.)
 * to prevent cascading failures and provide graceful degradation.
 * 
 * Circuit States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail fast
 * - HALF_OPEN: Testing if service recovered
 * 
 * Configuration:
 * - failureThreshold: Number of consecutive failures before opening (default: 5)
 * - openTimeout: Time in ms before transitioning to half-open (default: 30000)
 * - successThreshold: Successful calls in half-open to close circuit (default: 2)
 * 
 * Date: 2026-01-31
 */

import { logger } from '../services/logger.js';

// Circuit states
export const CircuitState = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open'
};

/**
 * Circuit Breaker class
 */
export class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    
    // Configuration
    this.failureThreshold = options.failureThreshold || 5;
    this.openTimeout = options.openTimeout || 30000; // 30 seconds
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 10000; // Request timeout
    
    // State
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    
    // Metrics
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      stateTransitions: [],
      lastStateChange: null
    };
    
    logger.info(`✅ Circuit breaker initialized: ${name}`);
  }
  
  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Async function to execute
   * @returns {Promise} Function result
   */
  async execute(fn) {
    this.metrics.totalCalls++;
    
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        // Circuit still open, reject immediately
        this.metrics.rejectedCalls++;
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        error.isCircuitBreakerError = true;
        logger.warn(`⚠️  Circuit breaker ${this.name} rejected call (state: OPEN)`);
        throw error;
      }
      
      // Timeout elapsed, transition to half-open
      this.transitionTo(CircuitState.HALF_OPEN);
    }
    
    try {
      // Execute the function with timeout
      const result = await this.executeWithTimeout(fn);
      
      // Success
      this.onSuccess();
      return result;
      
    } catch (error) {
      // Failure
      this.onFailure(error);
      throw error;
    }
  }
  
  /**
   * Execute function with timeout
   * @param {Function} fn - Async function
   * @returns {Promise} Result
   */
  async executeWithTimeout(fn) {
    return Promise.race([
      fn(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${this.timeout}ms`));
        }, this.timeout);
      })
    ]);
  }
  
  /**
   * Handle successful execution
   */
  onSuccess() {
    this.metrics.successfulCalls++;
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.successThreshold) {
        // Enough successes, close the circuit
        this.transitionTo(CircuitState.CLOSED);
        this.successCount = 0;
      }
    }
  }
  
  /**
   * Handle failed execution
   * @param {Error} error - The error that occurred
   */
  onFailure(error) {
    this.metrics.failedCalls++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    logger.warn(`⚠️  Circuit breaker ${this.name} failure ${this.failureCount}/${this.failureThreshold}:`, error.message);
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Failed in half-open, reopen circuit
      this.transitionTo(CircuitState.OPEN);
      this.successCount = 0;
      
    } else if (this.state === CircuitState.CLOSED) {
      // Check if threshold reached
      if (this.failureCount >= this.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }
  
  /**
   * Transition to a new state
   * @param {string} newState - New circuit state
   */
  transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;
    
    const transition = {
      from: oldState,
      to: newState,
      timestamp: new Date().toISOString(),
      failureCount: this.failureCount
    };
    
    this.metrics.stateTransitions.push(transition);
    this.metrics.lastStateChange = transition.timestamp;
    
    // Keep only last 100 transitions
    if (this.metrics.stateTransitions.length > 100) {
      this.metrics.stateTransitions.shift();
    }
    
    if (newState === CircuitState.OPEN) {
      this.nextAttemptTime = Date.now() + this.openTimeout;
      logger.warn(`🔴 Circuit breaker ${this.name}: ${oldState} → OPEN (failures: ${this.failureCount})`);
      
    } else if (newState === CircuitState.HALF_OPEN) {
      logger.info(`🟡 Circuit breaker ${this.name}: ${oldState} → HALF_OPEN (testing recovery)`);
      
    } else if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      logger.info(`🟢 Circuit breaker ${this.name}: ${oldState} → CLOSED (recovered)`);
    }
  }
  
  /**
   * Get current state
   * @returns {string} Current circuit state
   */
  getState() {
    return this.state;
  }
  
  /**
   * Check if circuit is open
   * @returns {boolean} True if open
   */
  isOpen() {
    return this.state === CircuitState.OPEN;
  }
  
  /**
   * Get circuit metrics
   * @returns {Object} Metrics object
   */
  getMetrics() {
    const failureRate = this.metrics.totalCalls > 0 
      ? (this.metrics.failedCalls / this.metrics.totalCalls * 100).toFixed(2)
      : 0;
    
    const successRate = this.metrics.totalCalls > 0
      ? (this.metrics.successfulCalls / this.metrics.totalCalls * 100).toFixed(2)
      : 0;
    
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCalls: this.metrics.totalCalls,
      successfulCalls: this.metrics.successfulCalls,
      failedCalls: this.metrics.failedCalls,
      rejectedCalls: this.metrics.rejectedCalls,
      failureRate: parseFloat(failureRate),
      successRate: parseFloat(successRate),
      lastStateChange: this.metrics.lastStateChange,
      recentTransitions: this.metrics.stateTransitions.slice(-10)
    };
  }
  
  /**
   * Reset circuit breaker state
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    
    logger.info(`🔄 Circuit breaker ${this.name} reset to CLOSED`);
  }
  
  /**
   * Force open the circuit (for testing or manual control)
   */
  forceOpen() {
    this.transitionTo(CircuitState.OPEN);
  }
  
  /**
   * Force close the circuit (for testing or manual control)
   */
  forceClose() {
    this.failureCount = 0;
    this.successCount = 0;
    this.transitionTo(CircuitState.CLOSED);
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
export class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }
  
  /**
   * Get or create a circuit breaker
   * @param {string} name - Circuit breaker name
   * @param {Object} options - Configuration options
   * @returns {CircuitBreaker} Circuit breaker instance
   */
  getBreaker(name, options = {}) {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker(name, options);
      this.breakers.set(name, breaker);
    }
    return this.breakers.get(name);
  }
  
  /**
   * Get all circuit breakers
   * @returns {Map} All breakers
   */
  getAllBreakers() {
    return this.breakers;
  }
  
  /**
   * Get metrics for all breakers
   * @returns {Array} Array of metrics
   */
  getAllMetrics() {
    const metrics = [];
    for (const [name, breaker] of this.breakers.entries()) {
      metrics.push(breaker.getMetrics());
    }
    return metrics;
  }
  
  /**
   * Get health summary
   * @returns {Object} Health summary
   */
  getHealthSummary() {
    let total = 0;
    let open = 0;
    let halfOpen = 0;
    let closed = 0;
    
    for (const breaker of this.breakers.values()) {
      total++;
      if (breaker.state === CircuitState.OPEN) open++;
      else if (breaker.state === CircuitState.HALF_OPEN) halfOpen++;
      else closed++;
    }
    
    return {
      total,
      open,
      halfOpen,
      closed,
      healthy: closed === total
    };
  }
  
  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    logger.info('🔄 All circuit breakers reset');
  }
}

// Global circuit breaker manager instance
export const circuitBreakerManager = new CircuitBreakerManager();

// Default export
export default {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitState,
  circuitBreakerManager
};
