/**
 * Order Tracker Service
 * BACKEND-011: Implement Order Management Agent
 * 
 * Monitors and tracks order status:
 * - Order status polling
 * - Partial fill detection
 * - Order completion tracking
 * - Order history
 * - Real-time order updates
 */

import { logger } from './logger.js';
import { mexcService } from './mexc.js';
import { OrderStatus, isOrderFilled, isOrderPartiallyFilled } from './orderExecutor.js';

// In-memory order tracking
const trackedOrders = new Map();
const orderHistory = new Map();

/**
 * Start tracking an order
 * @param {number} userId - User ID
 * @param {string} orderId - Order ID to track
 * @param {string} symbol - Trading pair
 * @param {Object} options - Tracking options
 * @returns {Object} Tracking info
 */
export async function startTracking(userId, orderId, symbol, options = {}) {
  try {
    logger.info('👀 Starting order tracking', { userId, orderId, symbol });
    
    if (!orderId || !symbol) {
      throw new Error('Order ID and symbol are required');
    }
    
    // Fetch initial order status
    const order = await fetchOrderStatus(userId, orderId, symbol);
    
    const trackingInfo = {
      userId,
      orderId,
      symbol,
      startTime: Date.now(),
      lastCheck: Date.now(),
      checkCount: 1,
      status: order.status,
      filled: order.filled || 0,
      remaining: order.remaining || order.amount,
      updates: [
        {
          timestamp: Date.now(),
          status: order.status,
          filled: order.filled || 0,
          remaining: order.remaining || order.amount
        }
      ],
      callbacks: options.callbacks || {},
      pollInterval: options.pollInterval || 5000, // 5 seconds default
      maxChecks: options.maxChecks || 360 // 30 minutes at 5s intervals
    };
    
    trackedOrders.set(orderId, trackingInfo);
    
    logger.info('✅ Order tracking started', { orderId, status: order.status });
    
    return {
      success: true,
      orderId,
      trackingInfo,
      initialStatus: order.status
    };
    
  } catch (error) {
    logger.error('❌ Failed to start tracking', error);
    throw error;
  }
}

/**
 * Stop tracking an order
 * @param {string} orderId - Order ID to stop tracking
 * @returns {Object} Result
 */
export function stopTracking(orderId) {
  try {
    logger.info('🛑 Stopping order tracking', { orderId });
    
    const trackingInfo = trackedOrders.get(orderId);
    
    if (!trackingInfo) {
      return {
        success: false,
        message: 'Order not being tracked'
      };
    }
    
    // Move to history
    orderHistory.set(orderId, {
      ...trackingInfo,
      endTime: Date.now(),
      duration: Date.now() - trackingInfo.startTime
    });
    
    // Remove from active tracking
    trackedOrders.delete(orderId);
    
    logger.info('✅ Order tracking stopped', { orderId });
    
    return {
      success: true,
      orderId,
      checkCount: trackingInfo.checkCount,
      duration: Date.now() - trackingInfo.startTime
    };
    
  } catch (error) {
    logger.error('❌ Failed to stop tracking', error);
    throw error;
  }
}

/**
 * Fetch current order status from exchange
 * @param {number} userId - User ID
 * @param {string} orderId - Order ID
 * @param {string} symbol - Trading pair
 * @returns {Object} Order status
 */
export async function fetchOrderStatus(userId, orderId, symbol) {
  try {
    await mexcService.getExchange(userId);
    
    const order = await mexcService.exchange.fetchOrder(orderId, symbol);
    
    return {
      id: order.id,
      symbol: order.symbol,
      type: order.type,
      side: order.side,
      price: order.price,
      amount: order.amount,
      filled: order.filled || 0,
      remaining: order.remaining || (order.amount - (order.filled || 0)),
      status: order.status,
      timestamp: order.timestamp,
      datetime: order.datetime,
      fee: order.fee,
      trades: order.trades || [],
      info: order.info
    };
    
  } catch (error) {
    logger.error('❌ Failed to fetch order status', error);
    throw error;
  }
}

/**
 * Fetch multiple orders status
 * @param {number} userId - User ID
 * @param {Array} orderIds - Array of order IDs
 * @param {string} symbol - Trading pair
 * @returns {Array} Array of order statuses
 */
export async function fetchMultipleOrders(userId, orderIds, symbol) {
  try {
    const results = [];
    
    for (const orderId of orderIds) {
      try {
        const order = await fetchOrderStatus(userId, orderId, symbol);
        results.push({
          success: true,
          order
        });
      } catch (error) {
        results.push({
          success: false,
          orderId,
          error: error.message
        });
      }
    }
    
    return results;
    
  } catch (error) {
    logger.error('❌ Failed to fetch multiple orders', error);
    throw error;
  }
}

/**
 * Get all open orders for a symbol
 * @param {number} userId - User ID
 * @param {string} symbol - Trading pair (optional, all if not provided)
 * @returns {Array} Array of open orders
 */
export async function getOpenOrders(userId, symbol = null) {
  try {
    await mexcService.getExchange(userId);
    
    const orders = await mexcService.exchange.fetchOpenOrders(symbol);
    
    logger.info('📋 Fetched open orders', {
      userId,
      symbol: symbol || 'all',
      count: orders.length
    });
    
    return orders;
    
  } catch (error) {
    logger.error('❌ Failed to fetch open orders', error);
    throw error;
  }
}

/**
 * Get order history for a symbol
 * @param {number} userId - User ID
 * @param {string} symbol - Trading pair
 * @param {number} limit - Maximum number of orders to fetch
 * @returns {Array} Array of historical orders
 */
export async function getOrderHistory(userId, symbol, limit = 100) {
  try {
    await mexcService.getExchange(userId);
    
    const orders = await mexcService.exchange.fetchOrders(symbol, undefined, limit);
    
    logger.info('📜 Fetched order history', {
      userId,
      symbol,
      count: orders.length
    });
    
    return orders;
    
  } catch (error) {
    logger.error('❌ Failed to fetch order history', error);
    throw error;
  }
}

/**
 * Poll order status updates
 * @param {string} orderId - Order ID to poll
 * @returns {Object} Updated order status
 */
export async function pollOrderStatus(orderId) {
  try {
    const trackingInfo = trackedOrders.get(orderId);
    
    if (!trackingInfo) {
      throw new Error('Order not being tracked');
    }
    
    // Fetch current status
    const order = await fetchOrderStatus(
      trackingInfo.userId,
      orderId,
      trackingInfo.symbol
    );
    
    // Update tracking info
    trackingInfo.lastCheck = Date.now();
    trackingInfo.checkCount++;
    trackingInfo.status = order.status;
    trackingInfo.filled = order.filled || 0;
    trackingInfo.remaining = order.remaining || order.amount;
    
    // Detect status changes
    const lastUpdate = trackingInfo.updates[trackingInfo.updates.length - 1];
    const statusChanged = lastUpdate.status !== order.status;
    const fillChanged = lastUpdate.filled !== order.filled;
    
    // Add update if status or fill amount changed
    if (statusChanged || fillChanged) {
      trackingInfo.updates.push({
        timestamp: Date.now(),
        status: order.status,
        filled: order.filled || 0,
        remaining: order.remaining || order.amount,
        statusChanged,
        fillChanged
      });
      
      logger.info('📊 Order status updated', {
        orderId,
        status: order.status,
        filled: order.filled,
        remaining: order.remaining
      });
      
      // Execute callbacks
      if (statusChanged && trackingInfo.callbacks.onStatusChange) {
        try {
          await trackingInfo.callbacks.onStatusChange(order);
        } catch (error) {
          logger.error('Callback error (onStatusChange):', error);
        }
      }
      
      if (fillChanged && trackingInfo.callbacks.onFillChange) {
        try {
          await trackingInfo.callbacks.onFillChange(order);
        } catch (error) {
          logger.error('Callback error (onFillChange):', error);
        }
      }
      
      // Check if order is filled
      if (isOrderFilled(order) && trackingInfo.callbacks.onFilled) {
        try {
          await trackingInfo.callbacks.onFilled(order);
        } catch (error) {
          logger.error('Callback error (onFilled):', error);
        }
        
        // Stop tracking filled orders
        stopTracking(orderId);
      }
      
      // Check if order is partially filled
      if (isOrderPartiallyFilled(order) && trackingInfo.callbacks.onPartialFill) {
        try {
          await trackingInfo.callbacks.onPartialFill(order);
        } catch (error) {
          logger.error('Callback error (onPartialFill):', error);
        }
      }
      
      // Check if order is cancelled
      if (order.status === OrderStatus.CANCELLED && trackingInfo.callbacks.onCancelled) {
        try {
          await trackingInfo.callbacks.onCancelled(order);
        } catch (error) {
          logger.error('Callback error (onCancelled):', error);
        }
        
        // Stop tracking cancelled orders
        stopTracking(orderId);
      }
    }
    
    return {
      success: true,
      order,
      statusChanged,
      fillChanged,
      updates: trackingInfo.updates.length
    };
    
  } catch (error) {
    logger.error('❌ Failed to poll order status', error);
    throw error;
  }
}

/**
 * Get tracking info for an order
 * @param {string} orderId - Order ID
 * @returns {Object} Tracking info
 */
export function getTrackingInfo(orderId) {
  const info = trackedOrders.get(orderId);
  
  if (!info) {
    return null;
  }
  
  return {
    orderId,
    symbol: info.symbol,
    status: info.status,
    filled: info.filled,
    remaining: info.remaining,
    checkCount: info.checkCount,
    duration: Date.now() - info.startTime,
    lastCheck: info.lastCheck,
    updates: info.updates.length
  };
}

/**
 * Get all tracked orders
 * @returns {Array} Array of tracked order IDs with info
 */
export function getAllTrackedOrders() {
  const tracked = [];
  
  for (const [orderId, info] of trackedOrders.entries()) {
    tracked.push({
      orderId,
      symbol: info.symbol,
      status: info.status,
      filled: info.filled,
      remaining: info.remaining,
      checkCount: info.checkCount,
      duration: Date.now() - info.startTime
    });
  }
  
  return tracked;
}

/**
 * Get order history from tracker
 * @param {string} orderId - Optional order ID
 * @returns {Object|Array} Order history or all history
 */
export function getTrackedOrderHistory(orderId = null) {
  if (orderId) {
    return orderHistory.get(orderId) || null;
  }
  
  const history = [];
  for (const [id, info] of orderHistory.entries()) {
    history.push({
      orderId: id,
      symbol: info.symbol,
      status: info.status,
      filled: info.filled,
      checkCount: info.checkCount,
      duration: info.duration,
      startTime: info.startTime,
      endTime: info.endTime
    });
  }
  
  return history;
}

/**
 * Monitor order until completion or timeout
 * @param {number} userId - User ID
 * @param {string} orderId - Order ID
 * @param {string} symbol - Trading pair
 * @param {Object} options - Monitoring options
 * @returns {Object} Final order status
 */
export async function monitorOrderUntilComplete(userId, orderId, symbol, options = {}) {
  try {
    logger.info('⏱️ Monitoring order until complete', { orderId, symbol });
    
    const pollInterval = options.pollInterval || 5000; // 5 seconds
    const timeout = options.timeout || 300000; // 5 minutes
    const startTime = Date.now();
    
    // Start tracking
    await startTracking(userId, orderId, symbol, {
      pollInterval,
      callbacks: options.callbacks || {}
    });
    
    // Poll until complete or timeout
    while (Date.now() - startTime < timeout) {
      const result = await pollOrderStatus(orderId);
      
      // Check if order is in terminal state
      if (result.order.status === OrderStatus.FILLED ||
          result.order.status === OrderStatus.CANCELLED ||
          result.order.status === OrderStatus.REJECTED ||
          result.order.status === OrderStatus.EXPIRED) {
        
        logger.info('✅ Order reached terminal state', {
          orderId,
          status: result.order.status
        });
        
        return {
          success: true,
          order: result.order,
          duration: Date.now() - startTime,
          checks: trackedOrders.get(orderId)?.checkCount || 0
        };
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // Timeout reached
    logger.warn('⏰ Order monitoring timeout', { orderId });
    
    const finalOrder = await fetchOrderStatus(userId, orderId, symbol);
    stopTracking(orderId);
    
    return {
      success: false,
      timeout: true,
      order: finalOrder,
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    logger.error('❌ Order monitoring failed', error);
    throw error;
  }
}

/**
 * Check for partial fills across multiple orders
 * @param {number} userId - User ID
 * @param {Array} orderIds - Array of order IDs
 * @param {string} symbol - Trading pair
 * @returns {Array} Array of orders with partial fill status
 */
export async function checkPartialFills(userId, orderIds, symbol) {
  try {
    const results = [];
    
    for (const orderId of orderIds) {
      try {
        const order = await fetchOrderStatus(userId, orderId, symbol);
        
        results.push({
          orderId,
          symbol,
          filled: order.filled || 0,
          remaining: order.remaining || order.amount,
          isPartiallyFilled: isOrderPartiallyFilled(order),
          status: order.status
        });
      } catch (error) {
        results.push({
          orderId,
          error: error.message
        });
      }
    }
    
    return results;
    
  } catch (error) {
    logger.error('❌ Failed to check partial fills', error);
    throw error;
  }
}

/**
 * Clear order history
 */
export function clearOrderHistory() {
  orderHistory.clear();
  logger.info('🗑️ Order history cleared');
}

/**
 * Clear all tracked orders (for testing)
 */
export function clearTrackedOrders() {
  trackedOrders.clear();
  logger.info('🗑️ Tracked orders cleared');
}

export default {
  startTracking,
  stopTracking,
  fetchOrderStatus,
  fetchMultipleOrders,
  getOpenOrders,
  getOrderHistory,
  pollOrderStatus,
  getTrackingInfo,
  getAllTrackedOrders,
  getTrackedOrderHistory,
  clearOrderHistory,
  clearTrackedOrders,
  monitorOrderUntilComplete,
  checkPartialFills
};
