/**
 * Order Executor Service
 * BACKEND-011: Implement Order Management Agent
 * 
 * Handles order execution on MEXC exchange:
 * - Market orders
 * - Limit orders
 * - Stop-loss orders
 * - Take-profit orders
 * - Order modification
 * - Order cancellation
 * 
 * Implements safety checks and validation
 */

import { logger } from './logger.js';
import { mexcService } from './mexc.js';

/**
 * Order types supported
 */
export const OrderType = {
  MARKET: 'market',
  LIMIT: 'limit',
  STOP_LOSS: 'stop_loss',
  STOP_LOSS_LIMIT: 'stop_loss_limit',
  TAKE_PROFIT: 'take_profit',
  TAKE_PROFIT_LIMIT: 'take_profit_limit'
};

/**
 * Order sides
 */
export const OrderSide = {
  BUY: 'buy',
  SELL: 'sell'
};

/**
 * Order status
 */
export const OrderStatus = {
  PENDING: 'pending',
  OPEN: 'open',
  FILLED: 'filled',
  PARTIALLY_FILLED: 'partially_filled',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  REJECTED: 'rejected'
};

/**
 * Place a market order
 * @param {number} userId - User ID
 * @param {string} symbol - Trading pair (e.g., 'BTC/USDT')
 * @param {string} side - Order side ('buy' or 'sell')
 * @param {number} amount - Order amount in base currency
 * @param {Object} options - Additional options
 * @returns {Object} Order result
 */
export async function placeMarketOrder(userId, symbol, side, amount, options = {}) {
  try {
    logger.info('📊 Placing market order', { symbol, side, amount });
    
    // Validate inputs
    validateOrderParams(symbol, side, amount);
    
    // Safety checks
    if (options.enableSafetyChecks !== false) {
      await performSafetyChecks(userId, symbol, side, amount, options);
    }
    
    // Place order via MEXC
    const order = await mexcService.createOrder(
      userId,
      symbol,
      'market',
      side,
      amount
    );
    
    logger.info('✅ Market order placed', {
      orderId: order.id,
      symbol,
      side,
      amount,
      status: order.status
    });
    
    return {
      success: true,
      order: normalizeOrder(order),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('❌ Market order failed', error);
    throw error;
  }
}

/**
 * Place a limit order
 * @param {number} userId - User ID
 * @param {string} symbol - Trading pair
 * @param {string} side - Order side
 * @param {number} amount - Order amount
 * @param {number} price - Limit price
 * @param {Object} options - Additional options
 * @returns {Object} Order result
 */
export async function placeLimitOrder(userId, symbol, side, amount, price, options = {}) {
  try {
    logger.info('📊 Placing limit order', { symbol, side, amount, price });
    
    // Validate inputs
    validateOrderParams(symbol, side, amount, price);
    
    if (!price || price <= 0) {
      throw new Error('Invalid price for limit order');
    }
    
    // Safety checks
    if (options.enableSafetyChecks !== false) {
      await performSafetyChecks(userId, symbol, side, amount, { ...options, price });
    }
    
    // Place order via MEXC
    const order = await mexcService.createOrder(
      userId,
      symbol,
      'limit',
      side,
      amount,
      price
    );
    
    logger.info('✅ Limit order placed', {
      orderId: order.id,
      symbol,
      side,
      amount,
      price,
      status: order.status
    });
    
    return {
      success: true,
      order: normalizeOrder(order),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('❌ Limit order failed', error);
    throw error;
  }
}

/**
 * Place a stop-loss order
 * @param {number} userId - User ID
 * @param {string} symbol - Trading pair
 * @param {string} side - Order side
 * @param {number} amount - Order amount
 * @param {number} stopPrice - Stop trigger price
 * @param {number} limitPrice - Optional limit price (for stop-loss-limit)
 * @param {Object} options - Additional options
 * @returns {Object} Order result
 */
export async function placeStopLossOrder(userId, symbol, side, amount, stopPrice, limitPrice = null, options = {}) {
  try {
    logger.info('🛑 Placing stop-loss order', {
      symbol,
      side,
      amount,
      stopPrice,
      limitPrice
    });
    
    // Validate inputs
    validateOrderParams(symbol, side, amount, stopPrice);
    
    if (!stopPrice || stopPrice <= 0) {
      throw new Error('Invalid stop price for stop-loss order');
    }
    
    // Safety checks
    if (options.enableSafetyChecks !== false) {
      await performSafetyChecks(userId, symbol, side, amount, {
        ...options,
        stopPrice,
        limitPrice
      });
    }
    
    // MEXC uses stop-market or stop-limit orders
    const orderType = limitPrice ? 'stop_loss_limit' : 'stop_loss';
    
    // For CCXT compatibility, we'll use stop-loss market/limit
    const order = await mexcService.exchange.createOrder(
      symbol,
      orderType,
      side,
      amount,
      limitPrice || undefined,
      {
        stopPrice: stopPrice
      }
    );
    
    logger.info('✅ Stop-loss order placed', {
      orderId: order.id,
      symbol,
      side,
      amount,
      stopPrice,
      status: order.status
    });
    
    return {
      success: true,
      order: normalizeOrder(order),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('❌ Stop-loss order failed', error);
    throw error;
  }
}

/**
 * Place a take-profit order
 * @param {number} userId - User ID
 * @param {string} symbol - Trading pair
 * @param {string} side - Order side
 * @param {number} amount - Order amount
 * @param {number} takeProfitPrice - Take-profit trigger price
 * @param {number} limitPrice - Optional limit price (for take-profit-limit)
 * @param {Object} options - Additional options
 * @returns {Object} Order result
 */
export async function placeTakeProfitOrder(userId, symbol, side, amount, takeProfitPrice, limitPrice = null, options = {}) {
  try {
    logger.info('💰 Placing take-profit order', {
      symbol,
      side,
      amount,
      takeProfitPrice,
      limitPrice
    });
    
    // Validate inputs
    validateOrderParams(symbol, side, amount, takeProfitPrice);
    
    if (!takeProfitPrice || takeProfitPrice <= 0) {
      throw new Error('Invalid take-profit price');
    }
    
    // Safety checks
    if (options.enableSafetyChecks !== false) {
      await performSafetyChecks(userId, symbol, side, amount, {
        ...options,
        takeProfitPrice,
        limitPrice
      });
    }
    
    // MEXC uses take-profit market/limit orders
    const orderType = limitPrice ? 'take_profit_limit' : 'take_profit';
    
    const order = await mexcService.exchange.createOrder(
      symbol,
      orderType,
      side,
      amount,
      limitPrice || undefined,
      {
        stopPrice: takeProfitPrice
      }
    );
    
    logger.info('✅ Take-profit order placed', {
      orderId: order.id,
      symbol,
      side,
      amount,
      takeProfitPrice,
      status: order.status
    });
    
    return {
      success: true,
      order: normalizeOrder(order),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('❌ Take-profit order failed', error);
    throw error;
  }
}

/**
 * Cancel an order
 * @param {number} userId - User ID
 * @param {string} orderId - Order ID to cancel
 * @param {string} symbol - Trading pair
 * @returns {Object} Cancellation result
 */
export async function cancelOrder(userId, orderId, symbol) {
  try {
    logger.info('🚫 Cancelling order', { orderId, symbol });
    
    if (!orderId) {
      throw new Error('Order ID is required');
    }
    
    if (!symbol) {
      throw new Error('Symbol is required');
    }
    
    const result = await mexcService.cancelOrder(userId, orderId, symbol);
    
    logger.info('✅ Order cancelled', { orderId, symbol });
    
    return {
      success: true,
      orderId,
      symbol,
      result,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('❌ Order cancellation failed', error);
    throw error;
  }
}

/**
 * Modify an existing order (cancel and replace)
 * @param {number} userId - User ID
 * @param {string} orderId - Order ID to modify
 * @param {string} symbol - Trading pair
 * @param {Object} newParams - New order parameters
 * @returns {Object} Modification result
 */
export async function modifyOrder(userId, orderId, symbol, newParams) {
  try {
    logger.info('✏️ Modifying order', { orderId, symbol, newParams });
    
    // Cancel existing order
    await cancelOrder(userId, orderId, symbol);
    
    // Place new order with updated parameters
    let newOrder;
    
    if (newParams.type === 'market') {
      newOrder = await placeMarketOrder(
        userId,
        symbol,
        newParams.side,
        newParams.amount,
        newParams.options || {}
      );
    } else if (newParams.type === 'limit') {
      newOrder = await placeLimitOrder(
        userId,
        symbol,
        newParams.side,
        newParams.amount,
        newParams.price,
        newParams.options || {}
      );
    } else if (newParams.type === 'stop_loss') {
      newOrder = await placeStopLossOrder(
        userId,
        symbol,
        newParams.side,
        newParams.amount,
        newParams.stopPrice,
        newParams.limitPrice,
        newParams.options || {}
      );
    } else if (newParams.type === 'take_profit') {
      newOrder = await placeTakeProfitOrder(
        userId,
        symbol,
        newParams.side,
        newParams.amount,
        newParams.takeProfitPrice,
        newParams.limitPrice,
        newParams.options || {}
      );
    } else {
      throw new Error(`Unsupported order type: ${newParams.type}`);
    }
    
    logger.info('✅ Order modified', {
      oldOrderId: orderId,
      newOrderId: newOrder.order.id
    });
    
    return {
      success: true,
      oldOrderId: orderId,
      newOrder: newOrder.order,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('❌ Order modification failed', error);
    throw error;
  }
}

/**
 * Validate order parameters
 * @param {string} symbol - Trading pair
 * @param {string} side - Order side
 * @param {number} amount - Order amount
 * @param {number} price - Optional price
 */
function validateOrderParams(symbol, side, amount, price = null) {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Invalid symbol');
  }
  
  if (!side || (side !== 'buy' && side !== 'sell')) {
    throw new Error('Invalid side (must be "buy" or "sell")');
  }
  
  if (!amount || amount <= 0) {
    throw new Error('Invalid amount (must be positive)');
  }
  
  if (price !== null && price <= 0) {
    throw new Error('Invalid price (must be positive)');
  }
}

/**
 * Perform safety checks before placing order
 * @param {number} userId - User ID
 * @param {string} symbol - Trading pair
 * @param {string} side - Order side
 * @param {number} amount - Order amount
 * @param {Object} options - Options including price checks
 */
async function performSafetyChecks(userId, symbol, side, amount, options = {}) {
  try {
    // Check 1: Validate symbol exists
    await mexcService.getExchange(userId);
    const markets = await mexcService.exchange.loadMarkets();
    
    if (!markets[symbol]) {
      throw new Error(`Invalid symbol: ${symbol} not found on MEXC`);
    }
    
    const market = markets[symbol];
    
    // Check 2: Minimum order amount
    if (market.limits && market.limits.amount && market.limits.amount.min) {
      if (amount < market.limits.amount.min) {
        throw new Error(
          `Order amount ${amount} below minimum ${market.limits.amount.min} for ${symbol}`
        );
      }
    }
    
    // Check 3: Maximum order amount
    if (market.limits && market.limits.amount && market.limits.amount.max) {
      if (amount > market.limits.amount.max) {
        throw new Error(
          `Order amount ${amount} exceeds maximum ${market.limits.amount.max} for ${symbol}`
        );
      }
    }
    
    // Check 4: Price deviation check for limit orders
    if (options.price) {
      const ticker = await mexcService.exchange.fetchTicker(symbol);
      const currentPrice = ticker.last;
      const priceDeviation = Math.abs(options.price - currentPrice) / currentPrice;
      
      // Warn if price deviates more than 10% from current price
      if (priceDeviation > 0.1) {
        logger.warn('⚠️ Price deviation warning', {
          symbol,
          orderPrice: options.price,
          currentPrice,
          deviation: `${(priceDeviation * 100).toFixed(2)}%`
        });
      }
      
      // Reject if price deviates more than 50% (likely error)
      if (priceDeviation > 0.5) {
        throw new Error(
          `Price deviation too high: ${(priceDeviation * 100).toFixed(2)}% from market price`
        );
      }
    }
    
    // Check 5: Stop price validation
    if (options.stopPrice || options.takeProfitPrice) {
      const ticker = await mexcService.exchange.fetchTicker(symbol);
      const currentPrice = ticker.last;
      const targetPrice = options.stopPrice || options.takeProfitPrice;
      
      // Stop-loss should be below current price for long, above for short
      if (options.stopPrice) {
        if (side === 'sell' && targetPrice >= currentPrice) {
          logger.warn('⚠️ Stop-loss price validation warning', {
            message: 'Stop-loss SELL order above current price',
            stopPrice: targetPrice,
            currentPrice
          });
        }
      }
      
      // Take-profit should be above current price for long, below for short
      if (options.takeProfitPrice) {
        if (side === 'sell' && targetPrice <= currentPrice) {
          logger.warn('⚠️ Take-profit price validation warning', {
            message: 'Take-profit SELL order below current price',
            takeProfitPrice: targetPrice,
            currentPrice
          });
        }
      }
    }
    
    logger.info('✅ Safety checks passed');
    
  } catch (error) {
    logger.error('❌ Safety check failed', error);
    throw error;
  }
}

/**
 * Normalize order response from exchange
 * @param {Object} order - Raw order from exchange
 * @returns {Object} Normalized order
 */
function normalizeOrder(order) {
  return {
    id: order.id,
    clientOrderId: order.clientOrderId,
    symbol: order.symbol,
    type: order.type,
    side: order.side,
    price: order.price,
    amount: order.amount,
    filled: order.filled || 0,
    remaining: order.remaining || order.amount,
    status: normalizeStatus(order.status),
    timestamp: order.timestamp,
    datetime: order.datetime,
    fee: order.fee,
    trades: order.trades || [],
    info: order.info
  };
}

/**
 * Normalize order status
 * @param {string} status - Raw status from exchange
 * @returns {string} Normalized status
 */
function normalizeStatus(status) {
  const statusMap = {
    'open': OrderStatus.OPEN,
    'closed': OrderStatus.FILLED,
    'canceled': OrderStatus.CANCELLED,
    'cancelled': OrderStatus.CANCELLED,
    'expired': OrderStatus.EXPIRED,
    'rejected': OrderStatus.REJECTED,
    'pending': OrderStatus.PENDING
  };
  
  return statusMap[status] || status;
}

/**
 * Calculate order value
 * @param {Object} order - Order object
 * @returns {number} Total order value
 */
export function calculateOrderValue(order) {
  if (order.price && order.amount) {
    return order.price * order.amount;
  }
  return 0;
}

/**
 * Check if order is filled
 * @param {Object} order - Order object
 * @returns {boolean} True if order is filled
 */
export function isOrderFilled(order) {
  return order.status === OrderStatus.FILLED || order.status === 'closed';
}

/**
 * Check if order is partially filled
 * @param {Object} order - Order object
 * @returns {boolean} True if order is partially filled
 */
export function isOrderPartiallyFilled(order) {
  return order.filled > 0 && order.filled < order.amount && order.status === OrderStatus.OPEN;
}

/**
 * Check if order is pending
 * @param {Object} order - Order object
 * @returns {boolean} True if order is pending
 */
export function isOrderPending(order) {
  return order.status === OrderStatus.PENDING || order.status === OrderStatus.OPEN;
}

export default {
  OrderType,
  OrderSide,
  OrderStatus,
  placeMarketOrder,
  placeLimitOrder,
  placeStopLossOrder,
  placeTakeProfitOrder,
  cancelOrder,
  modifyOrder,
  calculateOrderValue,
  isOrderFilled,
  isOrderPartiallyFilled,
  isOrderPending
};
