/**
 * Order Management Agent
 * BACKEND-011: Implement Order Management Agent
 * 
 * Provides comprehensive order management:
 * - Order placement (market, limit, stop-loss, take-profit)
 * - Order monitoring and tracking
 * - Order modification and cancellation
 * - Partial fill handling
 * - Order status updates
 * - MEXC exchange integration
 */

import { logger } from '../logger.js';
import {
  placeMarketOrder,
  placeLimitOrder,
  placeStopLossOrder,
  placeTakeProfitOrder,
  cancelOrder,
  modifyOrder,
  OrderType,
  OrderSide,
  OrderStatus
} from '../orderExecutor.js';
import {
  startTracking,
  stopTracking,
  fetchOrderStatus,
  getOpenOrders,
  getOrderHistory,
  monitorOrderUntilComplete,
  checkPartialFills,
  getAllTrackedOrders
} from '../orderTracker.js';

// Cache for agent operations
const cache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Run order management agent
 * @param {Object} params - Request parameters
 * @returns {Object} Agent result
 */
export async function run({ userId, symbol, action, config = {} }) {
  const startTime = Date.now();
  
  try {
    logger.info('📦 Order Management Agent started', {
      userId,
      symbol,
      action,
      config: Object.keys(config)
    });
    
    let result;
    
    switch (action) {
      case 'place_order':
        result = await handlePlaceOrder(userId, symbol, config);
        break;
      
      case 'cancel_order':
        result = await handleCancelOrder(userId, config);
        break;
      
      case 'modify_order':
        result = await handleModifyOrder(userId, symbol, config);
        break;
      
      case 'get_status':
        result = await handleGetStatus(userId, config);
        break;
      
      case 'get_open_orders':
        result = await handleGetOpenOrders(userId, symbol);
        break;
      
      case 'get_order_history':
        result = await handleGetOrderHistory(userId, symbol, config);
        break;
      
      case 'monitor_order':
        result = await handleMonitorOrder(userId, config);
        break;
      
      case 'check_partial_fills':
        result = await handleCheckPartialFills(userId, symbol, config);
        break;
      
      default:
        // Default: get open orders
        result = await handleGetOpenOrders(userId, symbol);
    }
    
    const response = {
      agent: 'order_management',
      symbol,
      action,
      timestamp: new Date().toISOString(),
      result,
      metadata: {
        execution_time_ms: Date.now() - startTime,
        success: true,
        tracked_orders: getAllTrackedOrders().length
      }
    };
    
    logger.info('✅ Order Management Agent completed', {
      action,
      executionTime: Date.now() - startTime
    });
    
    return response;
    
  } catch (error) {
    logger.error('❌ Order Management Agent error', error);
    
    return {
      agent: 'order_management',
      symbol,
      action,
      timestamp: new Date().toISOString(),
      error: error.message,
      metadata: {
        execution_time_ms: Date.now() - startTime,
        success: false
      }
    };
  }
}

/**
 * Handle place order action
 */
async function handlePlaceOrder(userId, symbol, config) {
  const {
    orderType,
    side,
    amount,
    price,
    stopPrice,
    takeProfitPrice,
    limitPrice,
    enableSafetyChecks = true,
    startTracking: shouldTrack = true
  } = config;
  
  if (!orderType || !side || !amount) {
    throw new Error('Missing required parameters: orderType, side, amount');
  }
  
  let orderResult;
  
  switch (orderType) {
    case OrderType.MARKET:
      orderResult = await placeMarketOrder(userId, symbol, side, amount, {
        enableSafetyChecks
      });
      break;
    
    case OrderType.LIMIT:
      if (!price) {
        throw new Error('Price required for limit order');
      }
      orderResult = await placeLimitOrder(userId, symbol, side, amount, price, {
        enableSafetyChecks
      });
      break;
    
    case OrderType.STOP_LOSS:
    case OrderType.STOP_LOSS_LIMIT:
      if (!stopPrice) {
        throw new Error('Stop price required for stop-loss order');
      }
      orderResult = await placeStopLossOrder(
        userId,
        symbol,
        side,
        amount,
        stopPrice,
        limitPrice,
        { enableSafetyChecks }
      );
      break;
    
    case OrderType.TAKE_PROFIT:
    case OrderType.TAKE_PROFIT_LIMIT:
      if (!takeProfitPrice) {
        throw new Error('Take-profit price required');
      }
      orderResult = await placeTakeProfitOrder(
        userId,
        symbol,
        side,
        amount,
        takeProfitPrice,
        limitPrice,
        { enableSafetyChecks }
      );
      break;
    
    default:
      throw new Error(`Unsupported order type: ${orderType}`);
  }
  
  // Start tracking if requested
  if (shouldTrack && orderResult.success) {
    try {
      await startTracking(userId, orderResult.order.id, symbol, {
        pollInterval: config.pollInterval || 5000
      });
    } catch (error) {
      logger.warn('Failed to start tracking', error);
    }
  }
  
  return {
    action: 'place_order',
    orderType,
    side,
    amount,
    ...orderResult
  };
}

/**
 * Handle cancel order action
 */
async function handleCancelOrder(userId, config) {
  const { orderId, symbol } = config;
  
  if (!orderId || !symbol) {
    throw new Error('Order ID and symbol required');
  }
  
  const result = await cancelOrder(userId, orderId, symbol);
  
  // Stop tracking if active
  try {
    stopTracking(orderId);
  } catch (error) {
    // Ignore if not tracked
  }
  
  return {
    action: 'cancel_order',
    ...result
  };
}

/**
 * Handle modify order action
 */
async function handleModifyOrder(userId, symbol, config) {
  const { orderId, newParams } = config;
  
  if (!orderId || !newParams) {
    throw new Error('Order ID and new parameters required');
  }
  
  const result = await modifyOrder(userId, orderId, symbol, newParams);
  
  // Update tracking if active
  try {
    stopTracking(orderId);
    if (result.success && newParams.startTracking !== false) {
      await startTracking(userId, result.newOrder.id, symbol);
    }
  } catch (error) {
    logger.warn('Failed to update tracking', error);
  }
  
  return {
    action: 'modify_order',
    ...result
  };
}

/**
 * Handle get order status action
 */
async function handleGetStatus(userId, config) {
  const { orderId, symbol } = config;
  
  if (!orderId || !symbol) {
    throw new Error('Order ID and symbol required');
  }
  
  const order = await fetchOrderStatus(userId, orderId, symbol);
  
  return {
    action: 'get_status',
    order
  };
}

/**
 * Handle get open orders action
 */
async function handleGetOpenOrders(userId, symbol) {
  const orders = await getOpenOrders(userId, symbol);
  
  return {
    action: 'get_open_orders',
    symbol: symbol || 'all',
    orders,
    count: orders.length
  };
}

/**
 * Handle get order history action
 */
async function handleGetOrderHistory(userId, symbol, config) {
  const limit = config.limit || 100;
  const orders = await getOrderHistory(userId, symbol, limit);
  
  return {
    action: 'get_order_history',
    symbol,
    orders,
    count: orders.length,
    limit
  };
}

/**
 * Handle monitor order action
 */
async function handleMonitorOrder(userId, config) {
  const { orderId, symbol, timeout, pollInterval } = config;
  
  if (!orderId || !symbol) {
    throw new Error('Order ID and symbol required');
  }
  
  const result = await monitorOrderUntilComplete(userId, orderId, symbol, {
    timeout: timeout || 300000,
    pollInterval: pollInterval || 5000
  });
  
  return {
    action: 'monitor_order',
    ...result
  };
}

/**
 * Handle check partial fills action
 */
async function handleCheckPartialFills(userId, symbol, config) {
  const { orderIds } = config;
  
  if (!orderIds || !Array.isArray(orderIds)) {
    throw new Error('Order IDs array required');
  }
  
  const results = await checkPartialFills(userId, orderIds, symbol);
  
  const partiallyFilled = results.filter(r => r.isPartiallyFilled);
  
  return {
    action: 'check_partial_fills',
    symbol,
    checked: results.length,
    partiallyFilled: partiallyFilled.length,
    results
  };
}

/**
 * Get agent details
 * @param {Object} params - Request parameters
 * @returns {Object} Agent information
 */
export async function getDetails({ userId }) {
  const trackedOrders = getAllTrackedOrders();
  
  return {
    agent: 'order_management',
    name: 'Order Management Agent',
    description: 'Comprehensive order execution and management on MEXC exchange',
    status: 'active',
    version: '1.0.0',
    capabilities: [
      'Place market orders',
      'Place limit orders',
      'Place stop-loss orders',
      'Place take-profit orders',
      'Cancel orders',
      'Modify orders',
      'Monitor order status',
      'Track partial fills',
      'Get open orders',
      'Get order history',
      'Real-time order tracking'
    ],
    supported_order_types: [
      OrderType.MARKET,
      OrderType.LIMIT,
      OrderType.STOP_LOSS,
      OrderType.STOP_LOSS_LIMIT,
      OrderType.TAKE_PROFIT,
      OrderType.TAKE_PROFIT_LIMIT
    ],
    order_sides: [
      OrderSide.BUY,
      OrderSide.SELL
    ],
    order_statuses: Object.values(OrderStatus),
    safety_features: [
      'Symbol validation',
      'Minimum/maximum amount checks',
      'Price deviation warnings',
      'Stop-loss price validation',
      'Take-profit price validation'
    ],
    current_tracking: {
      active_orders: trackedOrders.length,
      orders: trackedOrders
    },
    lastRun: trackedOrders.length > 0 ? new Date().toISOString() : null,
    metrics: {
      totalTracked: trackedOrders.length,
      avgExecutionTime: 0
    }
  };
}

/**
 * Get default configuration
 * @returns {Object} Default configuration
 */
export function defaultConfig() {
  return {
    enabled: true,
    action: 'get_open_orders',
    enableSafetyChecks: true,
    startTracking: true,
    pollInterval: 5000,
    timeout: 300000
  };
}

export default { run, getDetails, defaultConfig };
