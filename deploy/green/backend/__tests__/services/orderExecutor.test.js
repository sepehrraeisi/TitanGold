/**
 * Order Executor Service Unit Tests
 * BACKEND-011: Implement Order Management Agent
 */

import { jest } from '@jest/globals';

// Mock MEXC service before importing
jest.unstable_mockModule('../../services/mexc.js', () => {
  const mockExchange = {
    loadMarkets: jest.fn(),
    fetchTicker: jest.fn(),
    createOrder: jest.fn(),
    cancelOrder: jest.fn()
  };
  
  return {
    mexcService: {
      createOrder: jest.fn(),
      cancelOrder: jest.fn(),
      getExchange: jest.fn().mockResolvedValue(mockExchange),
      exchange: mockExchange
    }
  };
});

const orderExecutor = await import('../../services/orderExecutor.js');
const { mexcService } = await import('../../services/mexc.js');

const {
  placeMarketOrder,
  placeLimitOrder,
  placeStopLossOrder,
  placeTakeProfitOrder,
  cancelOrder,
  modifyOrder,
  OrderType,
  OrderSide,
  OrderStatus,
  calculateOrderValue,
  isOrderFilled,
  isOrderPartiallyFilled,
  isOrderPending
} = orderExecutor;

describe('Order Executor Service', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mexcService.exchange.loadMarkets.mockResolvedValue({
      'BTC/USDT': {
        id: 'BTCUSDT',
        symbol: 'BTC/USDT',
        limits: {
          amount: { min: 0.0001, max: 1000 },
          price: { min: 0.01, max: 1000000 }
        }
      }
    });
    
    mexcService.exchange.fetchTicker.mockResolvedValue({
      symbol: 'BTC/USDT',
      last: 65000,
      bid: 64999,
      ask: 65001
    });
  });
  
  describe('placeMarketOrder()', () => {
    
    test('should place market buy order successfully', async () => {
      const mockOrder = {
        id: 'order123',
        symbol: 'BTC/USDT',
        type: 'market',
        side: 'buy',
        amount: 0.01,
        filled: 0.01,
        remaining: 0,
        status: 'closed',
        timestamp: Date.now(),
        datetime: new Date().toISOString()
      };
      
      mexcService.createOrder.mockResolvedValue(mockOrder);
      
      const result = await placeMarketOrder(1, 'BTC/USDT', 'buy', 0.01);
      
      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.order.id).toBe('order123');
      expect(result.order.type).toBe('market');
      expect(result.order.side).toBe('buy');
      expect(mexcService.createOrder).toHaveBeenCalledWith(1, 'BTC/USDT', 'market', 'buy', 0.01);
    });
    
    test('should place market sell order successfully', async () => {
      const mockOrder = {
        id: 'order456',
        symbol: 'BTC/USDT',
        type: 'market',
        side: 'sell',
        amount: 0.01,
        filled: 0.01,
        remaining: 0,
        status: 'closed',
        timestamp: Date.now()
      };
      
      mexcService.createOrder.mockResolvedValue(mockOrder);
      
      const result = await placeMarketOrder(1, 'BTC/USDT', 'sell', 0.01);
      
      expect(result.success).toBe(true);
      expect(result.order.side).toBe('sell');
    });
    
    test('should validate symbol parameter', async () => {
      await expect(
        placeMarketOrder(1, '', 'buy', 0.01)
      ).rejects.toThrow('Invalid symbol');
    });
    
    test('should validate side parameter', async () => {
      await expect(
        placeMarketOrder(1, 'BTC/USDT', 'invalid', 0.01)
      ).rejects.toThrow('Invalid side');
    });
    
    test('should validate amount parameter', async () => {
      await expect(
        placeMarketOrder(1, 'BTC/USDT', 'buy', 0)
      ).rejects.toThrow('Invalid amount');
      
      await expect(
        placeMarketOrder(1, 'BTC/USDT', 'buy', -0.01)
      ).rejects.toThrow('Invalid amount');
    });
    
    test('should perform safety checks by default', async () => {
      const mockOrder = {
        id: 'order789',
        symbol: 'BTC/USDT',
        type: 'market',
        side: 'buy',
        amount: 0.01,
        status: 'closed',
        timestamp: Date.now()
      };
      
      mexcService.createOrder.mockResolvedValue(mockOrder);
      
      await placeMarketOrder(1, 'BTC/USDT', 'buy', 0.01);
      
      expect(mexcService.exchange.loadMarkets).toHaveBeenCalled();
    });
    
    test('should skip safety checks when disabled', async () => {
      const mockOrder = {
        id: 'order999',
        symbol: 'BTC/USDT',
        type: 'market',
        side: 'buy',
        amount: 0.01,
        status: 'closed',
        timestamp: Date.now()
      };
      
      mexcService.createOrder.mockResolvedValue(mockOrder);
      
      await placeMarketOrder(1, 'BTC/USDT', 'buy', 0.01, {
        enableSafetyChecks: false
      });
      
      expect(mexcService.exchange.loadMarkets).not.toHaveBeenCalled();
    });
    
  });
  
  describe('placeLimitOrder()', () => {
    
    test('should place limit buy order successfully', async () => {
      const mockOrder = {
        id: 'limit123',
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
      
      mexcService.createOrder.mockResolvedValue(mockOrder);
      
      const result = await placeLimitOrder(1, 'BTC/USDT', 'buy', 0.01, 64000);
      
      expect(result.success).toBe(true);
      expect(result.order.type).toBe('limit');
      expect(result.order.price).toBe(64000);
      expect(mexcService.createOrder).toHaveBeenCalledWith(
        1, 'BTC/USDT', 'limit', 'buy', 0.01, 64000
      );
    });
    
    test('should validate price parameter', async () => {
      await expect(
        placeLimitOrder(1, 'BTC/USDT', 'buy', 0.01, 0)
      ).rejects.toThrow('Invalid price');
      
      await expect(
        placeLimitOrder(1, 'BTC/USDT', 'buy', 0.01, -100)
      ).rejects.toThrow('Invalid price');
    });
    
    test('should warn on large price deviation', async () => {
      const mockOrder = {
        id: 'limit456',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        price: 55000, // ~15% below market
        amount: 0.01,
        status: 'open',
        timestamp: Date.now()
      };
      
      mexcService.createOrder.mockResolvedValue(mockOrder);
      
      // Should succeed with warning
      const result = await placeLimitOrder(1, 'BTC/USDT', 'buy', 0.01, 55000);
      expect(result.success).toBe(true);
    });
    
    test('should reject extreme price deviation', async () => {
      await expect(
        placeLimitOrder(1, 'BTC/USDT', 'buy', 0.01, 30000) // >50% deviation
      ).rejects.toThrow('Price deviation too high');
    });
    
  });
  
  describe('placeStopLossOrder()', () => {
    
    test('should place stop-loss order successfully', async () => {
      const mockOrder = {
        id: 'stop123',
        symbol: 'BTC/USDT',
        type: 'stop_loss',
        side: 'sell',
        amount: 0.01,
        stopPrice: 63000,
        status: 'open',
        timestamp: Date.now()
      };
      
      mexcService.exchange.createOrder.mockResolvedValue(mockOrder);
      
      const result = await placeStopLossOrder(1, 'BTC/USDT', 'sell', 0.01, 63000);
      
      expect(result.success).toBe(true);
      expect(result.order.type).toBe('stop_loss');
    });
    
    test('should validate stop price parameter', async () => {
      await expect(
        placeStopLossOrder(1, 'BTC/USDT', 'sell', 0.01, 0)
      ).rejects.toThrow('Invalid price');
    });
    
    test('should place stop-loss-limit order with limit price', async () => {
      const mockOrder = {
        id: 'stop456',
        symbol: 'BTC/USDT',
        type: 'stop_loss_limit',
        side: 'sell',
        amount: 0.01,
        stopPrice: 63000,
        price: 62900,
        status: 'open',
        timestamp: Date.now()
      };
      
      mexcService.exchange.createOrder.mockResolvedValue(mockOrder);
      
      const result = await placeStopLossOrder(1, 'BTC/USDT', 'sell', 0.01, 63000, 62900);
      
      expect(result.success).toBe(true);
      expect(mexcService.exchange.createOrder).toHaveBeenCalledWith(
        'BTC/USDT',
        'stop_loss_limit',
        'sell',
        0.01,
        62900,
        expect.objectContaining({ stopPrice: 63000 })
      );
    });
    
  });
  
  describe('placeTakeProfitOrder()', () => {
    
    test('should place take-profit order successfully', async () => {
      const mockOrder = {
        id: 'tp123',
        symbol: 'BTC/USDT',
        type: 'take_profit',
        side: 'sell',
        amount: 0.01,
        stopPrice: 67000,
        status: 'open',
        timestamp: Date.now()
      };
      
      mexcService.exchange.createOrder.mockResolvedValue(mockOrder);
      
      const result = await placeTakeProfitOrder(1, 'BTC/USDT', 'sell', 0.01, 67000);
      
      expect(result.success).toBe(true);
      expect(result.order.type).toBe('take_profit');
    });
    
    test('should validate take-profit price parameter', async () => {
      await expect(
        placeTakeProfitOrder(1, 'BTC/USDT', 'sell', 0.01, 0)
      ).rejects.toThrow('Invalid price');
    });
    
  });
  
  describe('cancelOrder()', () => {
    
    test('should cancel order successfully', async () => {
      mexcService.cancelOrder.mockResolvedValue({
        id: 'order123',
        status: 'cancelled'
      });
      
      const result = await cancelOrder(1, 'order123', 'BTC/USDT');
      
      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order123');
      expect(mexcService.cancelOrder).toHaveBeenCalledWith(1, 'order123', 'BTC/USDT');
    });
    
    test('should validate order ID', async () => {
      await expect(
        cancelOrder(1, '', 'BTC/USDT')
      ).rejects.toThrow('Order ID is required');
    });
    
    test('should validate symbol', async () => {
      await expect(
        cancelOrder(1, 'order123', '')
      ).rejects.toThrow('Symbol is required');
    });
    
  });
  
  describe('modifyOrder()', () => {
    
    test('should modify order successfully', async () => {
      // Mock cancel
      mexcService.cancelOrder.mockResolvedValue({ id: 'order123', status: 'cancelled' });
      
      // Mock new order
      const mockNewOrder = {
        id: 'order456',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        price: 64500,
        amount: 0.02,
        status: 'open',
        timestamp: Date.now()
      };
      
      mexcService.createOrder.mockResolvedValue(mockNewOrder);
      
      const result = await modifyOrder(1, 'order123', 'BTC/USDT', {
        type: 'limit',
        side: 'buy',
        amount: 0.02,
        price: 64500
      });
      
      expect(result.success).toBe(true);
      expect(result.oldOrderId).toBe('order123');
      expect(result.newOrder.id).toBe('order456');
    });
    
  });
  
  describe('Order Utility Functions', () => {
    
    test('calculateOrderValue should calculate correct value', () => {
      const order = { price: 65000, amount: 0.01 };
      expect(calculateOrderValue(order)).toBe(650);
    });
    
    test('isOrderFilled should detect filled orders', () => {
      expect(isOrderFilled({ status: OrderStatus.FILLED })).toBe(true);
      expect(isOrderFilled({ status: 'closed' })).toBe(true);
      expect(isOrderFilled({ status: OrderStatus.OPEN })).toBe(false);
    });
    
    test('isOrderPartiallyFilled should detect partial fills', () => {
      const order1 = {
        amount: 1,
        filled: 0.5,
        status: OrderStatus.OPEN
      };
      expect(isOrderPartiallyFilled(order1)).toBe(true);
      
      const order2 = {
        amount: 1,
        filled: 1,
        status: OrderStatus.FILLED
      };
      expect(isOrderPartiallyFilled(order2)).toBe(false);
      
      const order3 = {
        amount: 1,
        filled: 0,
        status: OrderStatus.OPEN
      };
      expect(isOrderPartiallyFilled(order3)).toBe(false);
    });
    
    test('isOrderPending should detect pending orders', () => {
      expect(isOrderPending({ status: OrderStatus.PENDING })).toBe(true);
      expect(isOrderPending({ status: OrderStatus.OPEN })).toBe(true);
      expect(isOrderPending({ status: OrderStatus.FILLED })).toBe(false);
    });
    
  });
  
  describe('Safety Checks', () => {
    
    test('should check minimum order amount', async () => {
      await expect(
        placeMarketOrder(1, 'BTC/USDT', 'buy', 0.00001) // Below minimum
      ).rejects.toThrow('below minimum');
    });
    
    test('should check maximum order amount', async () => {
      await expect(
        placeMarketOrder(1, 'BTC/USDT', 'buy', 2000) // Above maximum
      ).rejects.toThrow('exceeds maximum');
    });
    
    test('should validate symbol exists on exchange', async () => {
      mexcService.exchange.loadMarkets.mockResolvedValue({
        'ETH/USDT': { symbol: 'ETH/USDT' }
      });
      
      await expect(
        placeMarketOrder(1, 'INVALID/USDT', 'buy', 0.01)
      ).rejects.toThrow('not found on MEXC');
    });
    
  });
  
  describe('Error Handling', () => {
    
    test('should handle exchange errors gracefully', async () => {
      mexcService.createOrder.mockRejectedValue(new Error('Exchange error'));
      
      await expect(
        placeMarketOrder(1, 'BTC/USDT', 'buy', 0.01, { enableSafetyChecks: false })
      ).rejects.toThrow('Exchange error');
    });
    
    test('should handle network errors', async () => {
      mexcService.createOrder.mockRejectedValue(new Error('Network timeout'));
      
      await expect(
        placeMarketOrder(1, 'BTC/USDT', 'buy', 0.01, { enableSafetyChecks: false })
      ).rejects.toThrow('Network timeout');
    });
    
  });
  
});
