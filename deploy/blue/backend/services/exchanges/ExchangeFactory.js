/**
 * ExchangeFactory - Factory for Creating Exchange Instances
 * Purpose: Central factory to create and manage exchange instances
 * Date: 2026-01-31
 * Task: BACKEND-020 - Abstract Exchange Integration
 * 
 * This factory provides a unified way to create exchange instances.
 * Agents should use this factory instead of directly importing exchanges.
 * 
 * Usage:
 *   import { exchangeFactory } from './services/exchanges/ExchangeFactory.js';
 *   
 *   // Get default exchange (MEXC)
 *   const exchange = exchangeFactory.getExchange();
 *   
 *   // Get specific exchange
 *   const binance = exchangeFactory.getExchange('binance');
 *   
 *   // Initialize and use
 *   await exchange.initialize(userId);
 *   const ticker = await exchange.fetchTicker(userId, 'BTC/USDT');
 */

import MexcExchange from './MexcExchange.js';
import BinanceExchange from './BinanceExchange.js';
import { logger } from '../logger.js';

/**
 * Registry of available exchanges
 */
const EXCHANGE_REGISTRY = {
  mexc: MexcExchange,
  binance: BinanceExchange,
};

/**
 * Default exchange to use if none specified
 */
const DEFAULT_EXCHANGE = 'mexc';

/**
 * Singleton instances cache
 * Keyed by exchange name (lowercase)
 */
const instanceCache = new Map();

export class ExchangeFactory {
  /**
   * Get list of supported exchanges
   * @returns {string[]} Array of exchange names
   */
  getSupportedExchanges() {
    return Object.keys(EXCHANGE_REGISTRY);
  }

  /**
   * Check if an exchange is supported
   * @param {string} exchangeName - Exchange name
   * @returns {boolean} True if supported
   */
  isSupported(exchangeName) {
    const normalized = exchangeName.toLowerCase();
    return normalized in EXCHANGE_REGISTRY;
  }

  /**
   * Get or create an exchange instance
   * @param {string} exchangeName - Exchange name (default: 'mexc')
   * @param {boolean} forceNew - Force creation of new instance (default: false)
   * @returns {IExchange} Exchange instance
   * @throws {Error} If exchange is not supported
   */
  getExchange(exchangeName = DEFAULT_EXCHANGE, forceNew = false) {
    const normalized = exchangeName.toLowerCase();

    // Validate exchange is supported
    if (!this.isSupported(normalized)) {
      const supported = this.getSupportedExchanges().join(', ');
      throw new Error(
        `Exchange '${exchangeName}' is not supported. Supported exchanges: ${supported}`
      );
    }

    // Return cached instance if exists and not forcing new
    if (!forceNew && instanceCache.has(normalized)) {
      logger.debug(`📦 Using cached ${normalized.toUpperCase()} exchange instance`);
      return instanceCache.get(normalized);
    }

    // Create new instance
    const ExchangeClass = EXCHANGE_REGISTRY[normalized];
    const instance = new ExchangeClass();
    
    // Cache the instance
    if (!forceNew) {
      instanceCache.set(normalized, instance);
      logger.info(`✨ Created new ${normalized.toUpperCase()} exchange instance`);
    }

    return instance;
  }

  /**
   * Get the default exchange
   * @returns {IExchange} Default exchange instance
   */
  getDefaultExchange() {
    return this.getExchange(DEFAULT_EXCHANGE);
  }

  /**
   * Clear cached instances
   * Useful for testing or when switching configurations
   * @param {string} exchangeName - Specific exchange to clear (optional)
   */
  clearCache(exchangeName = null) {
    if (exchangeName) {
      const normalized = exchangeName.toLowerCase();
      if (instanceCache.has(normalized)) {
        instanceCache.delete(normalized);
        logger.info(`🗑️ Cleared ${normalized.toUpperCase()} exchange cache`);
      }
    } else {
      instanceCache.clear();
      logger.info('🗑️ Cleared all exchange caches');
    }
  }

  /**
   * Register a new exchange implementation
   * This allows for dynamic extension of supported exchanges
   * @param {string} exchangeName - Exchange name
   * @param {class} ExchangeClass - Exchange class (must extend IExchange)
   */
  registerExchange(exchangeName, ExchangeClass) {
    const normalized = exchangeName.toLowerCase();
    
    // Basic validation
    if (!ExchangeClass || typeof ExchangeClass !== 'function') {
      throw new Error('ExchangeClass must be a valid class constructor');
    }

    EXCHANGE_REGISTRY[normalized] = ExchangeClass;
    logger.info(`📝 Registered new exchange: ${normalized.toUpperCase()}`);
  }

  /**
   * Get exchange configuration from environment or database
   * @param {number|null} userId - User ID (null for system-wide)
   * @param {string} exchangeName - Exchange name (optional)
   * @returns {Promise<Object>} Exchange configuration
   */
  async getExchangeConfig(userId, exchangeName = null) {
    // TODO: Implement reading from database or config file
    // For now, return default configuration
    const exchange = exchangeName || DEFAULT_EXCHANGE;
    
    return {
      exchange,
      enabled: true,
      userId,
      timestamp: Date.now()
    };
  }

  /**
   * Initialize exchange with user context
   * Convenience method that gets exchange and initializes it
   * @param {number|null} userId - User ID (null for system-wide)
   * @param {string} exchangeName - Exchange name (default: mexc)
   * @returns {Promise<IExchange>} Initialized exchange instance
   */
  async initializeExchange(userId, exchangeName = DEFAULT_EXCHANGE) {
    const exchange = this.getExchange(exchangeName);
    await exchange.initialize(userId);
    return exchange;
  }

  /**
   * Get exchange health status for all or specific exchange
   * @param {string} exchangeName - Specific exchange name (optional)
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus(exchangeName = null) {
    if (exchangeName) {
      const exchange = this.getExchange(exchangeName);
      return await exchange.healthCheck();
    }

    // Check all exchanges
    const results = {};
    const exchanges = this.getSupportedExchanges();

    for (const name of exchanges) {
      try {
        const exchange = this.getExchange(name);
        results[name] = await exchange.healthCheck();
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          exchange: name,
          error: error.message,
          timestamp: Date.now()
        };
      }
    }

    return results;
  }
}

/**
 * Singleton instance of ExchangeFactory
 */
export const exchangeFactory = new ExchangeFactory();

/**
 * Convenience method: Get exchange instance
 * @param {string} exchangeName - Exchange name (default: 'mexc')
 * @returns {IExchange} Exchange instance
 */
export function getExchange(exchangeName = DEFAULT_EXCHANGE) {
  return exchangeFactory.getExchange(exchangeName);
}

/**
 * Convenience method: Get default exchange
 * @returns {IExchange} Default exchange instance
 */
export function getDefaultExchange() {
  return exchangeFactory.getDefaultExchange();
}

/**
 * Convenience method: Initialize exchange
 * @param {number|null} userId - User ID
 * @param {string} exchangeName - Exchange name
 * @returns {Promise<IExchange>} Initialized exchange
 */
export async function initializeExchange(userId, exchangeName = DEFAULT_EXCHANGE) {
  return await exchangeFactory.initializeExchange(userId, exchangeName);
}

export default exchangeFactory;
