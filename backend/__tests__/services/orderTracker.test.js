/**
 * Order Tracker Service Unit Tests
 * BACKEND-011: Implement Order Management Agent
 */

import { jest } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../../services/mexc.js', () => {
  const mockExchange = {
    fetchOrder: jest.fn(),
    fetchOpenOrders: jest.fn(),
    fetchOrders: jest.fn()
  };
  
  return {
    mexcService: {
      getExchange: jest.fn().mockResolvedValue(mockExchange),
      exchange: mockExchange
    }
  };
});

jest.unstable_mockModule('../../services/orderExecutor.js', () => ({
  OrderStatus: {
    PENDING: 'pending',
    OPEN: 'open',
    FILLED: 'filled',
    PARTIALLY_FILLED: 'partially_filled',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired',
    REJECTED: 'rejected'
  },
  isOrderFilled: jest.fn((order) => order.status === 'filled' || order.status === 'closed'),
  isOrderPartiallyFilled: jest.fn((order) => 
    order.filled > 0 && order.filled < order.amount && order.status === 'open'
  )
}));

const orderTracker = await import('../../services/orderTracker.js');
const { mexcService } = await import('../../services/mexc.js');
const { isOrderFilled, isOrderPartiallyFilled } = await import('../../services/orderExecutor.js');

const {
  startTracking,
  stopTracking,
  fetchOrderStatus,
  getOpenOrders,
  getOrderHistory,
  getTrackingInfo,
  getAllTrackedOrders,
  clearOrderHistory,
  clearTrackedOrders
} = orderTracker;

describe('Order Tracker Service', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    clearOrderHistory();
    clearTrackedOrders();
  });
  
  describe('startTracking()', () => {
    
    test('should start tracking an order', async () => {
      const mockOrder = {
        id: 'order123',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        price: 64000,
        amount: 0.01,
        filled: 0,
        remaining: 0.01,
        status: 'open',
        timestamp: Date.now()
      };
      
      mexcService.exchange.fetchOrder.mockResolvedValue(mockOrder);
      
      const result = await startTracking(1, 'order123', 'BTC/USDT');
      
      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order123');
      expect(result.initialStatus).toBe('open');
      expect(mexcService.exchange.fetchOrder).toHaveBeenCalledWith('order123', 'BTC/USDT');
    });
    
    test('should validate required parameters', async () => {
      await expect(
        startTracking(1, '', 'BTC/USDT')
      ).rejects.toThrow('Order ID and symbol are required');
      
      await expect(
        startTracking(1, 'order123', '')
      ).rejects.toThrow('Order ID and symbol are required');
    });
    
    test('should store tracking info', async () => {
      const mockOrder = {
        id: 'order456',
        symbol: 'BTC/USDT',
        amount: 0.01,
        filled: 0,
        remaining: 0.01,
        status: 'open',
        timestamp: Date.now()
      };
      
      mexcService.exchange.fetchOrder.mockResolvedValue(mockOrder);
      
      await startTracking(1, 'order456', 'BTC/USDT');
      
      const info = getTrackingInfo('order456');
      expect(info).toBeDefined();
      expect(info.orderId).toBe('order456');
      expect(info.symbol).toBe('BTC/USDT');
      expect(info.status).toBe('open');
    });
    
  });
  
  describe('stopTracking()', () => {
    
    test('should stop tracking an order', async () => {
      const mockOrder = {
        id: 'order789',
        symbol: 'BTC/USDT',
        amount: 0.01,
        filled: 0,
        remaining: 0.01,
        status: 'open',
        timestamp: Date.now()
      };
      
      mexcService.exchange.fetchOrder.mockResolvedValue(mockOrder);
      
      await startTracking(1, 'order789', 'BTC/USDT');
      
      const result = stopTracking('order789');
      
      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order789');
      expect(result.checkCount).toBeGreaterThan(0);
      
      // Verify it's no longer being tracked
      const info = getTrackingInfo('order789');
      expect(info).toBeNull();
    });
    
    test('should handle stopping non-tracked order', () => {
      const result = stopTracking('nonexistent');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not being tracked');
    });
    
  });
  
  describe('fetchOrderStatus()', () => {
    
    test('should fetch order status from exchange', async () => {
      const mockOrder = {
        id: 'order999',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        price: 64000,
        amount: 0.01,
        filled: 0.005,
        remaining: 0.005,
        status: 'open',
        timestamp: Date.now(),
        datetime: new Date().toISOString()
      };
      
      mexcService.exchange.fetchOrder.mockResolvedValue(mockOrder);
      
      const order = await fetchOrderStatus(1, 'order999', 'BTC/USDT');
      
      expect(order.id).toBe('order999');
      expect(order.symbol).toBe('BTC/USDT');
      expect(order.filled).toBe(0.005);
      expect(order.remaining).toBe(0.005);
    });
    
    test('should handle fetch errors', async () => {
      mexcService.exchange.fetchOrder.mockRejectedValue(new Error('Order not found'));
      
      await expect(
        fetchOrderStatus(1, 'invalid', 'BTC/USDT')
      ).rejects.toThrow('Order not found');
    });
    
  });
  
  describe('getOpenOrders()', () => {
    
    test('should fetch open orders for a symbol', async () => {
      const mockOrders = [
        { id: 'order1', symbol: 'BTC/USDT', status: 'open' },
        { id: 'order2', symbol: 'BTC/USDT', status: 'open' }
      ];
      
      mexcService.exchange.fetchOpenOrders.mockResolvedValue(mockOrders);
      
      const orders = await getOpenOrders(1, 'BTC/USDT');
      
      expect(orders).toHaveLength(2);
      expect(orders[0].id).toBe('order1');
      expect(mexcService.exchange.fetchOpenOrders).toHaveBeenCalledWith('BTC/USDT');
    });
    
    test('should fetch all open orders when symbol not provided', async () => {
      const mockOrders = [
        { id: 'order1', symbol: 'BTC/USDT', status: 'open' },
        { id: 'order2', symbol: 'ETH/USDT', status: 'open' }
      ];
      
      mexcService.exchange.fetchOpenOrders.mockResolvedValue(mockOrders);
      
      const orders = await getOpenOrders(1);
      
      expect(orders).toHaveLength(2);
      expect(mexcService.exchange.fetchOpenOrders).toHaveBeenCalledWith(null);
    });
    
  });
  
  describe('getOrderHistory()', () => {
    
    test('should fetch order history', async () => {
      const mockOrders = [
        { id: 'order1', symbol: 'BTC/USDT', status: 'closed' },
        { id: 'order2', symbol: 'BTC/USDT', status: 'cancelled' }
      ];
      
      mexcService.exchange.fetchOrders.mockResolvedValue(mockOrders);
      
      const orders = await getOrderHistory(1, 'BTC/USDT', 50);
      
      expect(orders).toHaveLength(2);
      expect(mexcService.exchange.fetchOrders).toHaveBeenCalledWith('BTC/USDT', undefined, 50);
    });
    
    test('should use default limit', async () => {
      mexcService.exchange.fetchOrders.mockResolvedValue([]);
      
      await getOrderHistory(1, 'BTC/USDT');
      
      expect(mexcService.exchange.fetchOrders).toHaveBeenCalledWith('BTC/USDT', undefined, 100);
    });
    
  });
  
  describe('getAllTrackedOrders()', () => {
    
    test('should return all tracked orders', async () => {
      const mockOrder1 = {
        id: 'order1',
        symbol: 'BTC/USDT',
        amount: 0.01,
        filled: 0,
        remaining: 0.01,
        status: 'open',
        timestamp: Date.now()
      };
      
      const mockOrder2 = {
        id: 'order2',
        symbol: 'ETH/USDT',
        amount: 0.1,
        filled: 0,
        remaining: 0.1,
        status: 'open',
        timestamp: Date.now()
      };
      
      mexcService.exchange.fetchOrder
        .mockResolvedValueOnce(mockOrder1)
        .mockResolvedValueOnce(mockOrder2);
      
      await startTracking(1, 'order1', 'BTC/USDT');
      await startTracking(1, 'order2', 'ETH/USDT');
      
      const tracked = getAllTrackedOrders();
      
      expect(tracked).toHaveLength(2);
      expect(tracked[0].orderId).toBe('order1');
      expect(tracked[1].orderId).toBe('order2');
    });
    
    test('should return empty array when no orders tracked', () => {
      const tracked = getAllTrackedOrders();
      expect(tracked).toHaveLength(0);
    });
    
  });
  
  describe('Order Status Detection', () => {
    
    test('should detect filled orders', async () => {
      const mockOrder = {
        id: 'order_filled',
        symbol: 'BTC/USDT',
        amount: 0.01,
        filled: 0.01,
        remaining: 0,
        status: 'closed',
        timestamp: Date.now()
      };
      
      mexcService.exchange.fetchOrder.mockResolvedValue(mockOrder);
      
      await startTracking(1, 'order_filled', 'BTC/USDT');
      
      const order = await fetchOrderStatus(1, 'order_filled', 'BTC/USDT');
      
      expect(isOrderFilled(order)).toBe(true);
    });
    
    test('should detect partially filled orders', async () => {
      const mockOrder = {
        id: 'order_partial',
        symbol: 'BTC/USDT',
        amount: 0.01,
        filled: 0.005,
        remaining: 0.005,
        status: 'open',
        timestamp: Date.now()
      };
      
      mexcService.exchange.fetchOrder.mockResolvedValue(mockOrder);
      
      const order = await fetchOrderStatus(1, 'order_partial', 'BTC/USDT');
      
      expect(isOrderPartiallyFilled(order)).toBe(true);
    });
    
  });
  
  describe('Tracking Info', () => {
    
    test('should get tracking info for order', async () => {
      const mockOrder = {
        id: 'orderABC',
        symbol: 'BTC/USDT',
        amount: 0.01,
        filled: 0,
        remaining: 0.01,
        status: 'open',
        timestamp: Date.now()
      };
      
      mexcService.exchange.fetchOrder.mockResolvedValue(mockOrder);
      
      await startTracking(1, 'orderABC', 'BTC/USDT');
      
      const info = getTrackingInfo('orderABC');
      
      expect(info).toBeDefined();
      expect(info.orderId).toBe('orderABC');
      expect(info.symbol).toBe('BTC/USDT');
      expect(info.status).toBe('open');
      expect(info.checkCount).toBe(1);
      expect(info.duration).toBeGreaterThanOrEqual(0);
    });
    
    test('should return null for non-tracked order', () => {
      const info = getTrackingInfo('nonexistent');
      expect(info).toBeNull();
    });
    
  });
  
  describe('Error Handling', () => {
    
    test('should handle exchange errors during tracking', async () => {
      mexcService.exchange.fetchOrder.mockRejectedValue(new Error('Exchange unavailable'));
      
      await expect(
        startTracking(1, 'order123', 'BTC/USDT')
      ).rejects.toThrow('Exchange unavailable');
    });
    
    test('should handle errors fetching open orders', async () => {
      mexcService.exchange.fetchOpenOrders.mockRejectedValue(new Error('API error'));
      
      await expect(
        getOpenOrders(1, 'BTC/USDT')
      ).rejects.toThrow('API error');
    });
    
  });
  
});
