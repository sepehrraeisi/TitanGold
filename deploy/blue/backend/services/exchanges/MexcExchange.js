/**
 * MexcExchange - MEXC Exchange Adapter
 * Purpose: Adapter to make existing MEXC service conform to IExchange interface
 * Date: 2026-01-31
 * Task: BACKEND-020 - Abstract Exchange Integration
 * 
 * This adapter wraps the existing MexcService and exposes it through
 * the standardized IExchange interface.
 */

import { IExchange, ExchangeError, ExchangeNotConfiguredError } from './IExchange.js';
import { mexcService } from '../mexc.js';
import { logger } from '../logger.js';

export class MexcExchange extends IExchange {
  constructor() {
    super();
    this.mexcService = mexcService; // Use singleton instance
    this.initialized = false;
    this.exchangeName = 'MEXC';
  }

  /**
   * Get exchange name
   * @returns {string} Exchange name
   */
  getName() {
    return this.exchangeName;
  }

  /**
   * Initialize exchange with user's API keys
   * @param {number|null} userId - User ID (null for system-wide)
   * @returns {Promise<boolean>} True if initialized successfully
   */
  async initialize(userId) {
    try {
      await this.mexcService.initializeExchange(userId);
      this.initialized = true;
      logger.info(`✅ ${this.exchangeName} initialized for user ${userId || 'system'}`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to initialize ${this.exchangeName}:`, error);
      
      if (error.code === 'MEXC_NOT_CONFIGURED') {
        throw new ExchangeNotConfiguredError(this.exchangeName, { userId });
      }
      
      throw new ExchangeError(
        `Failed to initialize ${this.exchangeName}: ${error.message}`,
        this.exchangeName,
        'INITIALIZATION_ERROR',
        { userId, originalError: error.message }
      );
    }
  }

  /**
   * Check if exchange is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Load market information
   * @param {number|null} userId - User ID (null for system-wide)
   * @returns {Promise<Object>} Market data keyed by symbol
   */
  async loadMarkets(userId) {
    try {
      return await this.mexcService.loadMarkets(userId);
    } catch (error) {
      throw new ExchangeError(
        `Failed to load markets from ${this.exchangeName}: ${error.message}`,
        this.exchangeName,
        'LOAD_MARKETS_ERROR',
        { userId, originalError: error.message }
      );
    }
  }

  /**
   * Fetch ticker data for a symbol
   * @param {number|null} userId - User ID (null for system-wide)
   * @param {string} symbol - Trading symbol (e.g., 'BTC/USDT' or 'BTCUSDT')
   * @returns {Promise<Object>} Ticker data
   */
  async fetchTicker(userId, symbol) {
    try {
      // Normalize symbol format (remove slash if present)
      const normalizedSymbol = symbol.replace('/', '');
      
      const ticker = await this.mexcService.fetchTicker(userId, normalizedSymbol);
      
      // Ensure standardized format
      return {
        symbol: ticker.symbol || normalizedSymbol,
        last: ticker.last || ticker.close,
        bid: ticker.bid,
        ask: ticker.ask,
        high: ticker.high,
        low: ticker.low,
        volume: ticker.baseVolume || ticker.volume,
        timestamp: ticker.timestamp || Date.now(),
        ...ticker // Include any additional fields
      };
    } catch (error) {
      throw new ExchangeError(
        `Failed to fetch ticker for ${symbol} from ${this.exchangeName}: ${error.message}`,
        this.exchangeName,
        'FETCH_TICKER_ERROR',
        { userId, symbol, originalError: error.message }
      );
    }
  }

  /**
   * Fetch multiple tickers
   * @param {number|null} userId - User ID (null for system-wide)
   * @param {string[]} symbols - Array of symbols (empty for all)
   * @returns {Promise<Object>} Tickers keyed by symbol
   */
  async fetchTickers(userId, symbols = []) {
    try {
      // Normalize symbols (remove slashes)
      const normalizedSymbols = symbols.map(s => s.replace('/', ''));
      
      return await this.mexcService.fetchPrices(userId, normalizedSymbols);
    } catch (error) {
      throw new ExchangeError(
        `Failed to fetch tickers from ${this.exchangeName}: ${error.message}`,
        this.exchangeName,
        'FETCH_TICKERS_ERROR',
        { userId, symbols, originalError: error.message }
      );
    }
  }

  /**
   * Fetch orderbook depth
   * @param {number|null} userId - User ID (null for system-wide)
   * @param {string} symbol - Trading symbol
   * @param {number} limit - Depth limit (default: 20)
   * @returns {Promise<Object>} Orderbook data
   */
  async fetchOrderBook(userId, symbol, limit = 20) {
    try {
      // Normalize symbol format
      const normalizedSymbol = symbol.replace('/', '');
      
      const orderbook = await this.mexcService.fetchOrderBook(userId, normalizedSymbol, limit);
      
      // Ensure standardized format
      return {
        bids: orderbook.bids || [],
        asks: orderbook.asks || [],
        timestamp: orderbook.timestamp || Date.now(),
        symbol: normalizedSymbol,
        ...orderbook
      };
    } catch (error) {
      throw new ExchangeError(
        `Failed to fetch orderbook for ${symbol} from ${this.exchangeName}: ${error.message}`,
        this.exchangeName,
        'FETCH_ORDERBOOK_ERROR',
        { userId, symbol, limit, originalError: error.message }
      );
    }
  }

  /**
   * Fetch OHLCV (candlestick) data
   * @param {number|null} userId - User ID (null for system-wide)
   * @param {string} symbol - Trading symbol
   * @param {string} timeframe - Timeframe (e.g., '1h', '4h', '1d')
   * @param {number} limit - Number of candles (default: 100)
   * @returns {Promise<Array>} Array of [timestamp, open, high, low, close, volume]
   */
  async fetchOHLCV(userId, symbol, timeframe = '1h', limit = 100) {
    try {
      // Normalize symbol format
      const normalizedSymbol = symbol.replace('/', '');
      
      return await this.mexcService.fetchOHLCV(userId, normalizedSymbol, timeframe, limit);
    } catch (error) {
      throw new ExchangeError(
        `Failed to fetch OHLCV for ${symbol} from ${this.exchangeName}: ${error.message}`,
        this.exchangeName,
        'FETCH_OHLCV_ERROR',
        { userId, symbol, timeframe, limit, originalError: error.message }
      );
    }
  }

  /**
   * Fetch account balance
   * @param {number} userId - User ID (required)
   * @returns {Promise<Object>} Balance data keyed by currency
   */
  async fetchBalance(userId) {
    if (!userId) {
      throw new ExchangeError(
        'User ID is required for fetchBalance',
        this.exchangeName,
        'MISSING_USER_ID'
      );
    }

    try {
      return await this.mexcService.getBalance(userId);
    } catch (error) {
      throw new ExchangeError(
        `Failed to fetch balance from ${this.exchangeName}: ${error.message}`,
        this.exchangeName,
        'FETCH_BALANCE_ERROR',
        { userId, originalError: error.message }
      );
    }
  }

  /**
   * Create an order
   * @param {number} userId - User ID (required)
   * @param {string} symbol - Trading symbol
   * @param {string} type - Order type ('market', 'limit')
   * @param {string} side - Order side ('buy', 'sell')
   * @param {number} amount - Order amount
   * @param {number} price - Order price (required for limit orders)
   * @returns {Promise<Object>} Order data
   */
  async createOrder(userId, symbol, type, side, amount, price = undefined) {
    if (!userId) {
      throw new ExchangeError(
        'User ID is required for createOrder',
        this.exchangeName,
        'MISSING_USER_ID'
      );
    }

    try {
      // Normalize symbol format
      const normalizedSymbol = symbol.replace('/', '');
      
      return await this.mexcService.createOrder(
        userId,
        normalizedSymbol,
        type,
        side,
        amount,
        price
      );
    } catch (error) {
      throw new ExchangeError(
        `Failed to create order on ${this.exchangeName}: ${error.message}`,
        this.exchangeName,
        'CREATE_ORDER_ERROR',
        { userId, symbol, type, side, amount, price, originalError: error.message }
      );
    }
  }

  /**
   * Cancel an order
   * @param {number} userId - User ID (required)
   * @param {string} orderId - Order ID
   * @param {string} symbol - Trading symbol
   * @returns {Promise<Object>} Cancelled order data
   */
  async cancelOrder(userId, orderId, symbol) {
    if (!userId) {
      throw new ExchangeError(
        'User ID is required for cancelOrder',
        this.exchangeName,
        'MISSING_USER_ID'
      );
    }

    try {
      // Normalize symbol format
      const normalizedSymbol = symbol.replace('/', '');
      
      return await this.mexcService.cancelOrder(userId, orderId, normalizedSymbol);
    } catch (error) {
      throw new ExchangeError(
        `Failed to cancel order on ${this.exchangeName}: ${error.message}`,
        this.exchangeName,
        'CANCEL_ORDER_ERROR',
        { userId, orderId, symbol, originalError: error.message }
      );
    }
  }

  /**
   * Fetch open orders
   * @param {number} userId - User ID (required)
   * @param {string} symbol - Trading symbol (optional)
   * @returns {Promise<Array>} Array of open orders
   */
  async fetchOpenOrders(userId, symbol = undefined) {
    if (!userId) {
      throw new ExchangeError(
        'User ID is required for fetchOpenOrders',
        this.exchangeName,
        'MISSING_USER_ID'
      );
    }

    try {
      // Normalize symbol if provided
      const normalizedSymbol = symbol ? symbol.replace('/', '') : undefined;
      
      return await this.mexcService.getOpenOrders(userId, normalizedSymbol);
    } catch (error) {
      throw new ExchangeError(
        `Failed to fetch open orders from ${this.exchangeName}: ${error.message}`,
        this.exchangeName,
        'FETCH_OPEN_ORDERS_ERROR',
        { userId, symbol, originalError: error.message }
      );
    }
  }

  /**
   * Fetch order status
   * @param {number} userId - User ID (required)
   * @param {string} orderId - Order ID
   * @param {string} symbol - Trading symbol
   * @returns {Promise<Object>} Order data
   */
  async fetchOrder(userId, orderId, symbol) {
    if (!userId) {
      throw new ExchangeError(
        'User ID is required for fetchOrder',
        this.exchangeName,
        'MISSING_USER_ID'
      );
    }

    try {
      // Normalize symbol format
      const normalizedSymbol = symbol.replace('/', '');
      
      return await this.mexcService.getOrder(userId, orderId, normalizedSymbol);
    } catch (error) {
      throw new ExchangeError(
        `Failed to fetch order from ${this.exchangeName}: ${error.message}`,
        this.exchangeName,
        'FETCH_ORDER_ERROR',
        { userId, orderId, symbol, originalError: error.message }
      );
    }
  }

  /**
   * Get exchange info (limits, fees, etc.)
   * @param {number|null} userId - User ID (null for system-wide)
   * @returns {Promise<Object>} Exchange information
   */
  async getExchangeInfo(userId) {
    try {
      return await this.mexcService.getExchangeInfo(userId);
    } catch (error) {
      throw new ExchangeError(
        `Failed to fetch exchange info from ${this.exchangeName}: ${error.message}`,
        this.exchangeName,
        'FETCH_EXCHANGE_INFO_ERROR',
        { userId, originalError: error.message }
      );
    }
  }

  /**
   * Health check - verify exchange connectivity
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const startTime = Date.now();
    
    try {
      // Try to fetch a common ticker to verify connectivity
      await this.mexcService.fetchSystemTicker('BTCUSDT');
      
      const latency = Date.now() - startTime;
      
      return {
        status: 'healthy',
        exchange: this.exchangeName,
        latency,
        timestamp: Date.now()
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      
      return {
        status: 'unhealthy',
        exchange: this.exchangeName,
        latency,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
}

export default MexcExchange;
