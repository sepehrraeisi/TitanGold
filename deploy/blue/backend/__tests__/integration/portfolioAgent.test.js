/**
 * Integration Tests for Portfolio Allocation Agent
 * 
 * Tests end-to-end functionality including:
 * - Portfolio optimization with real data structure
 * - Risk tolerance integration
 * - Rebalancing recommendations
 * - Integration with Risk Calculator
 * - Performance metrics
 */

import { jest } from '@jest/globals';
import portfolioAgent from '../../services/agents/portfolio.js';

// Mock logger
jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Portfolio Allocation Agent Integration Tests', () => {
  
  // Helper to generate mock price history
  function generatePriceHistory(startPrice, numPoints = 100, volatility = 0.02) {
    const prices = [];
    let price = startPrice;
    const baseTime = Date.now() - (numPoints * 3600000);
    
    for (let i = 0; i < numPoints; i++) {
      const change = (Math.random() - 0.48) * price * volatility;
      price = Math.max(price + change, startPrice * 0.5);
      
      prices.push({
        timestamp: baseTime + (i * 3600000),
        close: price
      });
    }
    
    return prices;
  }

  describe('run() - Portfolio Optimization', () => {
    
    test('should optimize portfolio with multiple assets', async () => {
      const portfolio = {
        assets: [
          {
            symbol: 'BTC/USDT',
            quantity: 0.5,
            priceHistory: generatePriceHistory(50000, 100)
          },
          {
            symbol: 'ETH/USDT',
            quantity: 5,
            priceHistory: generatePriceHistory(3000, 100)
          },
          {
            symbol: 'BNB/USDT',
            quantity: 20,
            priceHistory: generatePriceHistory(400, 100)
          }
        ]
      };

      const result = await portfolioAgent.run({
        userId: 1,
        portfolio,
        config: { riskTolerance: 'moderate' }
      });

      expect(result).toHaveProperty('agent_key', 'portfolio_allocation');
      expect(result).toHaveProperty('current_allocation');
      expect(result).toHaveProperty('optimal_allocation');
      expect(result).toHaveProperty('rebalancing');
      expect(result).toHaveProperty('risk_metrics');
    });

    test('should include current allocation metrics', async () => {
      const portfolio = {
        assets: [
          {
            symbol: 'BTC/USDT',
            quantity: 1,
            priceHistory: generatePriceHistory(50000, 50)
          },
          {
            symbol: 'ETH/USDT',
            quantity: 10,
            priceHistory: generatePriceHistory(3000, 50)
          }
        ]
      };

      const result = await portfolioAgent.run({ userId: 1, portfolio });

      expect(result.current_allocation).toHaveProperty('weights');
      expect(result.current_allocation).toHaveProperty('metrics');
      expect(result.current_allocation).toHaveProperty('total_value');
      expect(result.current_allocation.metrics).toHaveProperty('expectedReturn');
      expect(result.current_allocation.metrics).toHaveProperty('volatility');
      expect(result.current_allocation.metrics).toHaveProperty('sharpeRatio');
    });

    test('should include optimal allocation', async () => {
      const portfolio = {
        assets: [
          {
            symbol: 'BTC/USDT',
            quantity: 1,
            priceHistory: generatePriceHistory(50000, 50)
          },
          {
            symbol: 'ETH/USDT',
            quantity: 10,
            priceHistory: generatePriceHistory(3000, 50)
          }
        ]
      };

      const result = await portfolioAgent.run({ userId: 1, portfolio });

      expect(result.optimal_allocation).toHaveProperty('weights');
      expect(result.optimal_allocation).toHaveProperty('metrics');
      expect(result.optimal_allocation).toHaveProperty('validation');
      
      const validation = result.optimal_allocation.validation;
      expect(validation.valid).toBe(true);
      expect(validation.sumValid).toBe(true);
    });

    test('should suggest rebalancing when needed', async () => {
      const portfolio = {
        assets: [
          {
            symbol: 'BTC/USDT',
            quantity: 2, // Heavily weighted to BTC
            priceHistory: generatePriceHistory(50000, 50)
          },
          {
            symbol: 'ETH/USDT',
            quantity: 1, // Small weight
            priceHistory: generatePriceHistory(3000, 50)
          }
        ]
      };

      const result = await portfolioAgent.run({ userId: 1, portfolio });

      expect(result.rebalancing).toHaveProperty('required');
      expect(result.rebalancing).toHaveProperty('actions');
      expect(result.rebalancing).toHaveProperty('estimated_trades');
      
      if (result.rebalancing.required) {
        expect(result.rebalancing.actions.length).toBeGreaterThan(0);
        result.rebalancing.actions.forEach(action => {
          expect(action).toHaveProperty('asset');
          expect(action).toHaveProperty('action');
          expect(action).toHaveProperty('currentWeight');
          expect(action).toHaveProperty('optimalWeight');
          expect(action).toHaveProperty('priority');
        });
      }
    });

    test('should handle different risk tolerances', async () => {
      const portfolio = {
        assets: [
          {
            symbol: 'BTC/USDT',
            quantity: 1,
            priceHistory: generatePriceHistory(50000, 50)
          },
          {
            symbol: 'ETH/USDT',
            quantity: 10,
            priceHistory: generatePriceHistory(3000, 50)
          }
        ]
      };

      const conservative = await portfolioAgent.run({
        userId: 1,
        portfolio,
        config: { riskTolerance: 'conservative' }
      });

      const aggressive = await portfolioAgent.run({
        userId: 1,
        portfolio,
        config: { riskTolerance: 'aggressive' }
      });

      expect(conservative.risk_tolerance).toBe('conservative');
      expect(aggressive.risk_tolerance).toBe('aggressive');
      expect(conservative.risk_metrics.max_allowed_volatility).toBeLessThan(
        aggressive.risk_metrics.max_allowed_volatility
      );
    });

    test('should handle different optimization goals', async () => {
      const portfolio = {
        assets: [
          {
            symbol: 'BTC/USDT',
            quantity: 1,
            priceHistory: generatePriceHistory(50000, 100)
          },
          {
            symbol: 'ETH/USDT',
            quantity: 10,
            priceHistory: generatePriceHistory(3000, 100)
          },
          {
            symbol: 'BNB/USDT',
            quantity: 20,
            priceHistory: generatePriceHistory(400, 100)
          }
        ]
      };

      const sharpeOpt = await portfolioAgent.run({
        userId: 1,
        portfolio,
        config: { optimizationGoal: 'sharpe' }
      });

      const minVarOpt = await portfolioAgent.run({
        userId: 1,
        portfolio,
        config: { optimizationGoal: 'min_variance' }
      });

      expect(sharpeOpt.optimization_goal).toBe('sharpe');
      expect(minVarOpt.optimization_goal).toBe('min_variance');
    });

    test('should include improvement metrics', async () => {
      const portfolio = {
        assets: [
          {
            symbol: 'BTC/USDT',
            quantity: 1,
            priceHistory: generatePriceHistory(50000, 50)
          },
          {
            symbol: 'ETH/USDT',
            quantity: 10,
            priceHistory: generatePriceHistory(3000, 50)
          }
        ]
      };

      const result = await portfolioAgent.run({ userId: 1, portfolio });

      expect(result).toHaveProperty('improvement');
      expect(result.improvement).toHaveProperty('returnImprovement');
      expect(result.improvement).toHaveProperty('volatilityReduction');
      expect(result.improvement).toHaveProperty('sharpeImprovement');
    });

    test('should calculate efficient frontier when requested', async () => {
      const portfolio = {
        assets: [
          {
            symbol: 'BTC/USDT',
            quantity: 1,
            priceHistory: generatePriceHistory(50000, 100)
          },
          {
            symbol: 'ETH/USDT',
            quantity: 10,
            priceHistory: generatePriceHistory(3000, 100)
          },
          {
            symbol: 'BNB/USDT',
            quantity: 20,
            priceHistory: generatePriceHistory(400, 100)
          }
        ]
      };

      const result = await portfolioAgent.run({
        userId: 1,
        portfolio,
        config: { includeEfficientFrontier: true }
      });

      expect(result.efficient_frontier).toBeDefined();
      expect(Array.isArray(result.efficient_frontier)).toBe(true);
      expect(result.efficient_frontier.length).toBeGreaterThan(0);
    });

    test('should cache results', async () => {
      const portfolio = {
        assets: [
          {
            symbol: 'BTC/USDT',
            quantity: 1,
            priceHistory: generatePriceHistory(50000, 50)
          },
          {
            symbol: 'ETH/USDT',
            quantity: 10,
            priceHistory: generatePriceHistory(3000, 50)
          }
        ]
      };

      const result1 = await portfolioAgent.run({ userId: 1, portfolio });
      const result2 = await portfolioAgent.run({ userId: 1, portfolio });

      expect(result2).toHaveProperty('from_cache', true);
      expect(result2).toHaveProperty('cache_age_ms');
    });

    test('should handle errors gracefully', async () => {
      const result = await portfolioAgent.run({
        userId: 1,
        portfolio: null
      });

      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('agent_key', 'portfolio_allocation');
    });

    test('should require at least 2 assets', async () => {
      const portfolio = {
        assets: [
          {
            symbol: 'BTC/USDT',
            quantity: 1,
            priceHistory: generatePriceHistory(50000, 50)
          }
        ]
      };

      const result = await portfolioAgent.run({ userId: 1, portfolio });

      expect(result).toHaveProperty('error');
    });

    test('should include metadata', async () => {
      const portfolio = {
        assets: [
          {
            symbol: 'BTC/USDT',
            quantity: 1,
            priceHistory: generatePriceHistory(50000, 50)
          },
          {
            symbol: 'ETH/USDT',
            quantity: 10,
            priceHistory: generatePriceHistory(3000, 50)
          }
        ]
      };

      const result = await portfolioAgent.run({ userId: 1, portfolio });

      expect(result).toHaveProperty('_meta');
      expect(result._meta).toHaveProperty('version');
      expect(result._meta).toHaveProperty('method', 'modern_portfolio_theory');
      expect(result._meta).toHaveProperty('confidence');
    });
  });

  describe('getDetails()', () => {
    
    test('should return agent details', async () => {
      const details = await portfolioAgent.getDetails({ userId: 1 });

      expect(details).toHaveProperty('agent_key', 'portfolio_allocation');
      expect(details).toHaveProperty('name');
      expect(details).toHaveProperty('description');
      expect(details).toHaveProperty('status', 'active');
      expect(details).toHaveProperty('version');
      expect(details).toHaveProperty('capabilities');
      expect(details).toHaveProperty('metrics');
    });

    test('should include capabilities list', async () => {
      const details = await portfolioAgent.getDetails({ userId: 1 });

      expect(Array.isArray(details.capabilities)).toBe(true);
      expect(details.capabilities.length).toBeGreaterThan(0);
    });
  });

  describe('defaultConfig()', () => {
    
    test('should return default configuration', () => {
      const config = portfolioAgent.defaultConfig();

      expect(config).toHaveProperty('enabled', true);
      expect(config).toHaveProperty('riskTolerance', 'moderate');
      expect(config).toHaveProperty('riskFreeRate', 0.04);
      expect(config).toHaveProperty('optimizationGoal', 'sharpe');
    });
  });

  describe('Performance', () => {
    
    test('should complete within reasonable time', async () => {
      const portfolio = {
        assets: [
          {
            symbol: 'BTC/USDT',
            quantity: 1,
            priceHistory: generatePriceHistory(50000, 100)
          },
          {
            symbol: 'ETH/USDT',
            quantity: 10,
            priceHistory: generatePriceHistory(3000, 100)
          },
          {
            symbol: 'BNB/USDT',
            quantity: 20,
            priceHistory: generatePriceHistory(400, 100)
          }
        ]
      };

      const startTime = Date.now();
      await portfolioAgent.run({ userId: 1, portfolio });
      const executionTime = Date.now() - startTime;

      expect(executionTime).toBeLessThan(5000);
    });
  });
});
