/**
 * Exchange Abstraction Layer - Unit Tests
 * Purpose: Test exchange interface, factory, and implementations
 * Date: 2026-01-31
 * Task: BACKEND-020 - Abstract Exchange Integration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  IExchange,
  ExchangeError,
  ExchangeNotConfiguredError,
  RateLimitError,
  InsufficientBalanceError
} from '../../services/exchanges/IExchange.js';
import { MexcExchange } from '../../services/exchanges/MexcExchange.js';
import { BinanceExchange } from '../../services/exchanges/BinanceExchange.js';
import { 
  ExchangeFactory,
  exchangeFactory,
  getExchange,
  getDefaultExchange
} from '../../services/exchanges/ExchangeFactory.js';

describe('Exchange Abstraction Layer (BACKEND-020)', () => {
  
  // ===================================================================
  // IExchange Interface Tests
  // ===================================================================
  
  describe('IExchange - Base Interface', () => {
    
    it('should require implementation of all interface methods', async () => {
      const exchange = new IExchange();
      
      // All methods should throw "must be implemented" errors
      expect(() => exchange.getName()).toThrow('must be implemented');
      expect(() => exchange.isInitialized()).toThrow('must be implemented');
      await expect(exchange.initialize(1)).rejects.toThrow('must be implemented');
      await expect(exchange.loadMarkets(1)).rejects.toThrow('must be implemented');
      await expect(exchange.fetchTicker(1, 'BTC/USDT')).rejects.toThrow('must be implemented');
      await expect(exchange.fetchTickers(1, [])).rejects.toThrow('must be implemented');
      await expect(exchange.fetchOrderBook(1, 'BTC/USDT')).rejects.toThrow('must be implemented');
      await expect(exchange.fetchOHLCV(1, 'BTC/USDT')).rejects.toThrow('must be implemented');
      await expect(exchange.fetchBalance(1)).rejects.toThrow('must be implemented');
      await expect(exchange.createOrder(1, 'BTC/USDT', 'market', 'buy', 0.1)).rejects.toThrow('must be implemented');
      await expect(exchange.cancelOrder(1, '123', 'BTC/USDT')).rejects.toThrow('must be implemented');
      await expect(exchange.fetchOpenOrders(1)).rejects.toThrow('must be implemented');
      await expect(exchange.fetchOrder(1, '123', 'BTC/USDT')).rejects.toThrow('must be implemented');
      await expect(exchange.getExchangeInfo(1)).rejects.toThrow('must be implemented');
      await expect(exchange.healthCheck()).rejects.toThrow('must be implemented');
    });
  });

  // ===================================================================
  // Exchange Errors Tests
  // ===================================================================
  
  describe('Exchange Errors', () => {
    
    it('should create ExchangeError with all fields', () => {
      const error = new ExchangeError('Test error', 'MEXC', 'TEST_CODE', { detail: 'test' });
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ExchangeError);
      expect(error.message).toBe('Test error');
      expect(error.exchange).toBe('MEXC');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('number');
    });

    it('should create ExchangeNotConfiguredError with proper message', () => {
      const error = new ExchangeNotConfiguredError('MEXC', { userId: 123 });
      
      expect(error).toBeInstanceOf(ExchangeError);
      expect(error).toBeInstanceOf(ExchangeNotConfiguredError);
      expect(error.message).toContain('MEXC');
      expect(error.message).toContain('API keys not configured');
      expect(error.code).toBe('EXCHANGE_NOT_CONFIGURED');
      expect(error.details.userId).toBe(123);
    });

    it('should create RateLimitError with retry info', () => {
      const error = new RateLimitError('MEXC', 5000, { endpoint: '/api/ticker' });
      
      expect(error).toBeInstanceOf(ExchangeError);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toContain('rate limit exceeded');
      expect(error.message).toContain('5000ms');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.retryAfter).toBe(5000);
      expect(error.details.endpoint).toBe('/api/ticker');
    });

    it('should create InsufficientBalanceError with balance info', () => {
      const error = new InsufficientBalanceError('MEXC', 'USDT', 1000, 500);
      
      expect(error).toBeInstanceOf(ExchangeError);
      expect(error).toBeInstanceOf(InsufficientBalanceError);
      expect(error.message).toContain('Insufficient USDT balance');
      expect(error.message).toContain('Required: 1000');
      expect(error.message).toContain('Available: 500');
      expect(error.code).toBe('INSUFFICIENT_BALANCE');
      expect(error.details.currency).toBe('USDT');
      expect(error.details.required).toBe(1000);
      expect(error.details.available).toBe(500);
    });
  });

  // ===================================================================
  // MexcExchange Tests
  // ===================================================================
  
  describe('MexcExchange - Implementation', () => {
    
    it('should extend IExchange', () => {
      const mexc = new MexcExchange();
      expect(mexc).toBeInstanceOf(IExchange);
    });

    it('should return correct exchange name', () => {
      const mexc = new MexcExchange();
      expect(mexc.getName()).toBe('MEXC');
    });

    it('should start uninitialized', () => {
      const mexc = new MexcExchange();
      expect(mexc.isInitialized()).toBe(false);
    });

    it('should normalize symbol format (remove slash)', async () => {
      const mexc = new MexcExchange();
      
      // Mock the underlying mexcService
      mexc.mexcService.fetchTicker = jest.fn().mockResolvedValue({
        symbol: 'BTCUSDT',
        last: 50000,
        bid: 49999,
        ask: 50001,
        high: 51000,
        low: 49000,
        volume: 1000,
        timestamp: Date.now()
      });

      await mexc.initialize(null);
      const ticker = await mexc.fetchTicker(null, 'BTC/USDT');
      
      // Verify it called with normalized symbol
      expect(mexc.mexcService.fetchTicker).toHaveBeenCalledWith(null, 'BTCUSDT');
      expect(ticker.symbol).toBe('BTCUSDT');
    });

    it('should throw ExchangeError on failures', async () => {
      const mexc = new MexcExchange();
      
      // Mock failure
      mexc.mexcService.fetchTicker = jest.fn().mockRejectedValue(new Error('Network error'));

      await mexc.initialize(null);
      
      await expect(mexc.fetchTicker(null, 'BTC/USDT'))
        .rejects.toThrow(ExchangeError);
    });

    it('should require userId for trading operations', async () => {
      const mexc = new MexcExchange();
      
      await mexc.initialize(null);
      
      await expect(mexc.fetchBalance(null))
        .rejects.toThrow('User ID is required');
      
      await expect(mexc.createOrder(null, 'BTC/USDT', 'market', 'buy', 0.1))
        .rejects.toThrow('User ID is required');
      
      await expect(mexc.cancelOrder(null, '123', 'BTC/USDT'))
        .rejects.toThrow('User ID is required');
    });
  });

  // ===================================================================
  // BinanceExchange Tests
  // ===================================================================
  
  describe('BinanceExchange - Stub Implementation', () => {
    
    it('should extend IExchange', () => {
      const binance = new BinanceExchange();
      expect(binance).toBeInstanceOf(IExchange);
    });

    it('should return correct exchange name', () => {
      const binance = new BinanceExchange();
      expect(binance.getName()).toBe('Binance');
    });

    it('should throw ExchangeNotConfiguredError on initialize', async () => {
      const binance = new BinanceExchange();
      
      await expect(binance.initialize(1))
        .rejects.toThrow(ExchangeNotConfiguredError);
    });

    it('should throw NOT_IMPLEMENTED error for all methods', async () => {
      const binance = new BinanceExchange();
      
      await expect(binance.loadMarkets(1))
        .rejects.toThrow('not yet implemented');
      
      await expect(binance.fetchTicker(1, 'BTC/USDT'))
        .rejects.toThrow('not yet implemented');
      
      await expect(binance.fetchBalance(1))
        .rejects.toThrow('not yet implemented');
    });

    it('should return degraded status in health check', async () => {
      const binance = new BinanceExchange();
      
      const health = await binance.healthCheck();
      
      expect(health.status).toBe('degraded');
      expect(health.exchange).toBe('Binance');
      expect(health.error).toContain('not yet implemented');
    });
  });

  // ===================================================================
  // ExchangeFactory Tests
  // ===================================================================
  
  describe('ExchangeFactory', () => {
    
    beforeEach(() => {
      exchangeFactory.clearCache();
    });

    afterEach(() => {
      exchangeFactory.clearCache();
    });

    it('should list supported exchanges', () => {
      const supported = exchangeFactory.getSupportedExchanges();
      
      expect(Array.isArray(supported)).toBe(true);
      expect(supported).toContain('mexc');
      expect(supported).toContain('binance');
    });

    it('should check if exchange is supported', () => {
      expect(exchangeFactory.isSupported('mexc')).toBe(true);
      expect(exchangeFactory.isSupported('MEXC')).toBe(true);
      expect(exchangeFactory.isSupported('binance')).toBe(true);
      expect(exchangeFactory.isSupported('kraken')).toBe(false);
    });

    it('should get exchange by name', () => {
      const mexc = exchangeFactory.getExchange('mexc');
      
      expect(mexc).toBeInstanceOf(MexcExchange);
      expect(mexc.getName()).toBe('MEXC');
    });

    it('should be case-insensitive when getting exchange', () => {
      const mexc1 = exchangeFactory.getExchange('MEXC');
      const mexc2 = exchangeFactory.getExchange('mexc');
      
      expect(mexc1).toBeInstanceOf(MexcExchange);
      expect(mexc2).toBeInstanceOf(MexcExchange);
    });

    it('should throw error for unsupported exchange', () => {
      expect(() => exchangeFactory.getExchange('kraken'))
        .toThrow('not supported');
    });

    it('should return default exchange (MEXC)', () => {
      const defaultExchange = exchangeFactory.getDefaultExchange();
      
      expect(defaultExchange).toBeInstanceOf(MexcExchange);
      expect(defaultExchange.getName()).toBe('MEXC');
    });

    it('should cache exchange instances', () => {
      const mexc1 = exchangeFactory.getExchange('mexc');
      const mexc2 = exchangeFactory.getExchange('mexc');
      
      // Should return same instance
      expect(mexc1).toBe(mexc2);
    });

    it('should create new instance when forceNew is true', () => {
      const mexc1 = exchangeFactory.getExchange('mexc');
      const mexc2 = exchangeFactory.getExchange('mexc', true);
      
      // Should return different instances
      expect(mexc1).not.toBe(mexc2);
    });

    it('should clear cache for specific exchange', () => {
      const mexc1 = exchangeFactory.getExchange('mexc');
      exchangeFactory.clearCache('mexc');
      const mexc2 = exchangeFactory.getExchange('mexc');
      
      // Should return different instance after cache clear
      expect(mexc1).not.toBe(mexc2);
    });

    it('should clear all cached exchanges', () => {
      const mexc1 = exchangeFactory.getExchange('mexc');
      const binance1 = exchangeFactory.getExchange('binance');
      
      exchangeFactory.clearCache();
      
      const mexc2 = exchangeFactory.getExchange('mexc');
      const binance2 = exchangeFactory.getExchange('binance');
      
      expect(mexc1).not.toBe(mexc2);
      expect(binance1).not.toBe(binance2);
    });

    it('should allow registering new exchange', () => {
      class TestExchange extends IExchange {
        getName() { return 'Test'; }
        isInitialized() { return false; }
      }

      exchangeFactory.registerExchange('test', TestExchange);
      
      expect(exchangeFactory.isSupported('test')).toBe(true);
      const testExchange = exchangeFactory.getExchange('test');
      expect(testExchange.getName()).toBe('Test');
    });
  });

  // ===================================================================
  // Convenience Functions Tests
  // ===================================================================
  
  describe('Convenience Functions', () => {
    
    beforeEach(() => {
      exchangeFactory.clearCache();
    });

    it('getExchange() should work', () => {
      const exchange = getExchange('mexc');
      expect(exchange).toBeInstanceOf(MexcExchange);
    });

    it('getDefaultExchange() should work', () => {
      const exchange = getDefaultExchange();
      expect(exchange).toBeInstanceOf(MexcExchange);
    });

    it('getExchange() should default to MEXC', () => {
      const exchange = getExchange();
      expect(exchange.getName()).toBe('MEXC');
    });
  });

  // ===================================================================
  // Integration Tests
  // ===================================================================
  
  describe('Integration: Complete Workflow', () => {
    
    beforeEach(() => {
      exchangeFactory.clearCache();
    });

    it('should complete full workflow with MEXC', async () => {
      // Get exchange
      const exchange = getExchange('mexc');
      expect(exchange.getName()).toBe('MEXC');
      expect(exchange.isInitialized()).toBe(false);

      // Mock initialize
      exchange.mexcService.initializeExchange = jest.fn().mockResolvedValue(true);
      
      // Initialize
      await exchange.initialize(null);
      expect(exchange.isInitialized()).toBe(true);

      // Mock ticker fetch
      exchange.mexcService.fetchTicker = jest.fn().mockResolvedValue({
        symbol: 'BTCUSDT',
        last: 50000,
        bid: 49999,
        ask: 50001
      });

      // Fetch ticker
      const ticker = await exchange.fetchTicker(null, 'BTC/USDT');
      expect(ticker.symbol).toBe('BTCUSDT');
      expect(ticker.last).toBe(50000);
    });

    it('should handle errors gracefully', async () => {
      const exchange = getExchange('mexc');
      
      // Mock initialization failure
      exchange.mexcService.initializeExchange = jest.fn().mockRejectedValue(
        Object.assign(new Error('API keys not configured'), { code: 'MEXC_NOT_CONFIGURED' })
      );

      // Should throw ExchangeNotConfiguredError
      await expect(exchange.initialize(1))
        .rejects.toThrow(ExchangeNotConfiguredError);
    });

    it('should prevent using Binance (not implemented)', async () => {
      const exchange = getExchange('binance');
      
      // Initialize should fail
      await expect(exchange.initialize(1))
        .rejects.toThrow(ExchangeNotConfiguredError);
    });
  });

  // ===================================================================
  // Health Check Tests
  // ===================================================================
  
  describe('Health Checks', () => {
    
    it('should perform health check on MEXC', async () => {
      const exchange = getExchange('mexc');
      
      // Mock system ticker fetch
      exchange.mexcService.fetchSystemTicker = jest.fn().mockResolvedValue({ last: 50000 });

      const health = await exchange.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.exchange).toBe('MEXC');
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.timestamp).toBeDefined();
    });

    it('should report unhealthy on error', async () => {
      const exchange = getExchange('mexc');
      
      // Mock failure
      exchange.mexcService.fetchSystemTicker = jest.fn().mockRejectedValue(new Error('Network error'));

      const health = await exchange.healthCheck();
      
      expect(health.status).toBe('unhealthy');
      expect(health.error).toContain('Network error');
    });

    it('should check all exchanges via factory', async () => {
      const results = await exchangeFactory.getHealthStatus();
      
      expect(results).toHaveProperty('mexc');
      expect(results).toHaveProperty('binance');
      expect(results.binance.status).toBe('degraded');
    });
  });
});
