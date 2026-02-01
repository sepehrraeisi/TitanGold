/**
 * IExchange Interface - Abstract Exchange API
 * Purpose: Define standard interface for all exchange integrations
 * Date: 2026-01-31
 * Task: BACKEND-020 - Abstract Exchange Integration
 * 
 * All exchange implementations must implement this interface.
 * This allows agents to work with any exchange without code changes.
 */

/**
 * Base Exchange Interface
 * All methods should return standardized data formats
 */
export class IExchange {
  /**
   * Get exchange name
   * @returns {string} Exchange name (e.g., 'MEXC', 'Binance')
   */
  getName() {
    throw new Error('getName() must be implemented');
  }

  /**
   * Initialize exchange with user's API keys
   * @param {number|null} userId - User ID (null for system-wide)
   * @returns {Promise<boolean>} True if initialized successfully
   */
  async initialize(userId) {
    throw new Error('initialize() must be implemented');
  }

  /**
   * Check if exchange is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    throw new Error('isInitialized() must be implemented');
  }

  /**
   * Load market information
   * @param {number|null} userId - User ID (null for system-wide)
   * @returns {Promise<Object>} Market data keyed by symbol
   */
  async loadMarkets(userId) {
    throw new Error('loadMarkets() must be implemented');
  }

  /**
   * Fetch ticker data for a symbol
   * @param {number|null} userId - User ID (null for system-wide)
   * @param {string} symbol - Trading symbol (e.g., 'BTC/USDT')
   * @returns {Promise<Object>} Ticker data
   * @returns {Object.symbol} string - Symbol
   * @returns {Object.last} number - Last price
   * @returns {Object.bid} number - Bid price
   * @returns {Object.ask} number - Ask price
   * @returns {Object.high} number - 24h high
   * @returns {Object.low} number - 24h low
   * @returns {Object.volume} number - 24h volume
   * @returns {Object.timestamp} number - Timestamp
   */
  async fetchTicker(userId, symbol) {
    throw new Error('fetchTicker() must be implemented');
  }

  /**
   * Fetch multiple tickers
   * @param {number|null} userId - User ID (null for system-wide)
   * @param {string[]} symbols - Array of symbols (empty for all)
   * @returns {Promise<Object>} Tickers keyed by symbol
   */
  async fetchTickers(userId, symbols = []) {
    throw new Error('fetchTickers() must be implemented');
  }

  /**
   * Fetch orderbook depth
   * @param {number|null} userId - User ID (null for system-wide)
   * @param {string} symbol - Trading symbol
   * @param {number} limit - Depth limit (default: 20)
   * @returns {Promise<Object>} Orderbook data
   * @returns {Object.bids} Array<[price, amount]> - Bid orders
   * @returns {Object.asks} Array<[price, amount]> - Ask orders
   * @returns {Object.timestamp} number - Timestamp
   */
  async fetchOrderBook(userId, symbol, limit = 20) {
    throw new Error('fetchOrderBook() must be implemented');
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
    throw new Error('fetchOHLCV() must be implemented');
  }

  /**
   * Fetch account balance
   * @param {number} userId - User ID (required)
   * @returns {Promise<Object>} Balance data keyed by currency
   * @returns {Object[currency].free} number - Available balance
   * @returns {Object[currency].used} number - Balance in orders
   * @returns {Object[currency].total} number - Total balance
   */
  async fetchBalance(userId) {
    throw new Error('fetchBalance() must be implemented');
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
   * @returns {Object.id} string - Order ID
   * @returns {Object.symbol} string - Symbol
   * @returns {Object.type} string - Order type
   * @returns {Object.side} string - Order side
   * @returns {Object.amount} number - Order amount
   * @returns {Object.price} number - Order price
   * @returns {Object.status} string - Order status
   */
  async createOrder(userId, symbol, type, side, amount, price = undefined) {
    throw new Error('createOrder() must be implemented');
  }

  /**
   * Cancel an order
   * @param {number} userId - User ID (required)
   * @param {string} orderId - Order ID
   * @param {string} symbol - Trading symbol
   * @returns {Promise<Object>} Cancelled order data
   */
  async cancelOrder(userId, orderId, symbol) {
    throw new Error('cancelOrder() must be implemented');
  }

  /**
   * Fetch open orders
   * @param {number} userId - User ID (required)
   * @param {string} symbol - Trading symbol (optional)
   * @returns {Promise<Array>} Array of open orders
   */
  async fetchOpenOrders(userId, symbol = undefined) {
    throw new Error('fetchOpenOrders() must be implemented');
  }

  /**
   * Fetch order status
   * @param {number} userId - User ID (required)
   * @param {string} orderId - Order ID
   * @param {string} symbol - Trading symbol
   * @returns {Promise<Object>} Order data
   */
  async fetchOrder(userId, orderId, symbol) {
    throw new Error('fetchOrder() must be implemented');
  }

  /**
   * Get exchange info (limits, fees, etc.)
   * @param {number|null} userId - User ID (null for system-wide)
   * @returns {Promise<Object>} Exchange information
   */
  async getExchangeInfo(userId) {
    throw new Error('getExchangeInfo() must be implemented');
  }

  /**
   * Health check - verify exchange connectivity
   * @returns {Promise<Object>} Health status
   * @returns {Object.status} string - 'healthy', 'degraded', 'unhealthy'
   * @returns {Object.latency} number - Response time in ms
   * @returns {Object.error} string - Error message if unhealthy
   */
  async healthCheck() {
    throw new Error('healthCheck() must be implemented');
  }
}

/**
 * Standardized error class for exchange operations
 */
export class ExchangeError extends Error {
  constructor(message, exchange, code = null, details = {}) {
    super(message);
    this.name = 'ExchangeError';
    this.exchange = exchange;
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
  }
}

/**
 * Specific error for when exchange is not configured
 */
export class ExchangeNotConfiguredError extends ExchangeError {
  constructor(exchange, details = {}) {
    super(
      `${exchange} API keys not configured. Please configure in Settings > Connections > Exchange API Keys`,
      exchange,
      'EXCHANGE_NOT_CONFIGURED',
      details
    );
    this.name = 'ExchangeNotConfiguredError';
  }
}

/**
 * Specific error for rate limiting
 */
export class RateLimitError extends ExchangeError {
  constructor(exchange, retryAfter = null, details = {}) {
    super(
      `${exchange} rate limit exceeded${retryAfter ? `. Retry after ${retryAfter}ms` : ''}`,
      exchange,
      'RATE_LIMIT_EXCEEDED',
      { retryAfter, ...details }
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Specific error for insufficient balance
 */
export class InsufficientBalanceError extends ExchangeError {
  constructor(exchange, currency, required, available, details = {}) {
    super(
      `Insufficient ${currency} balance. Required: ${required}, Available: ${available}`,
      exchange,
      'INSUFFICIENT_BALANCE',
      { currency, required, available, ...details }
    );
    this.name = 'InsufficientBalanceError';
  }
}

export default IExchange;
