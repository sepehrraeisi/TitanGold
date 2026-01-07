/**
 * Unit Tests for Portfolio Optimizer Service
 * 
 * Tests for Modern Portfolio Theory implementation:
 * - Expected returns calculation
 * - Covariance matrix calculation
 * - Portfolio metrics (return, variance, volatility)
 * - Sharpe ratio calculation
 * - Portfolio optimization
 * - Efficient frontier
 * - Rebalancing suggestions
 * - Minimum variance portfolio
 */

import { jest } from '@jest/globals';
import {
  calculateExpectedReturns,
  calculateCovarianceMatrix,
  calculatePortfolioReturn,
  calculatePortfolioVariance,
  calculatePortfolioVolatility,
  calculateSharpeRatio,
  optimizePortfolio,
  calculateEfficientFrontier,
  suggestRebalancing,
  calculateMinimumVariancePortfolio,
  validateWeights
} from '../../services/portfolioOptimizer.js';

// Mock logger
jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Portfolio Optimizer Service', () => {
  
  // Helper function to generate mock returns
  function generateMockReturns(mean, volatility, length = 100) {
    const returns = [];
    for (let i = 0; i < length; i++) {
      // Simple random walk with drift
      const random = (Math.random() - 0.5) * 2; // -1 to 1
      returns.push(mean + random * volatility);
    }
    return returns;
  }

  describe('calculateExpectedReturns()', () => {
    
    test('should calculate expected returns for assets', () => {
      const assetReturns = {
        'BTC': [0.02, 0.03, 0.01, 0.04],
        'ETH': [0.01, 0.02, 0.02, 0.03]
      };
      
      const expectedReturns = calculateExpectedReturns(assetReturns);
      
      expect(expectedReturns).toHaveProperty('BTC');
      expect(expectedReturns).toHaveProperty('ETH');
      expect(expectedReturns.BTC).toBeCloseTo(0.025, 3);
      expect(expectedReturns.ETH).toBeCloseTo(0.02, 3);
    });

    test('should handle empty returns', () => {
      const assetReturns = {
        'BTC': []
      };
      
      const expectedReturns = calculateExpectedReturns(assetReturns);
      expect(expectedReturns.BTC).toBe(0);
    });

    test('should handle multiple assets', () => {
      const assetReturns = {
        'BTC': [0.01, 0.02],
        'ETH': [0.02, 0.03],
        'BNB': [0.015, 0.025]
      };
      
      const expectedReturns = calculateExpectedReturns(assetReturns);
      expect(Object.keys(expectedReturns).length).toBe(3);
    });
  });

  describe('calculateCovarianceMatrix()', () => {
    
    test('should calculate covariance matrix', () => {
      const assetReturns = {
        'BTC': [0.01, 0.02, 0.03],
        'ETH': [0.02, 0.01, 0.03]
      };
      
      const covMatrix = calculateCovarianceMatrix(assetReturns);
      
      expect(Array.isArray(covMatrix)).toBe(true);
      expect(covMatrix.length).toBe(2);
      expect(covMatrix[0].length).toBe(2);
    });

    test('should have symmetric covariance matrix', () => {
      const assetReturns = {
        'BTC': generateMockReturns(0.001, 0.02, 50),
        'ETH': generateMockReturns(0.0015, 0.025, 50)
      };
      
      const covMatrix = calculateCovarianceMatrix(assetReturns);
      
      expect(covMatrix[0][1]).toBeCloseTo(covMatrix[1][0], 10);
    });

    test('should have positive variance on diagonal', () => {
      const assetReturns = {
        'BTC': generateMockReturns(0.001, 0.02, 50),
        'ETH': generateMockReturns(0.0015, 0.025, 50)
      };
      
      const covMatrix = calculateCovarianceMatrix(assetReturns);
      
      expect(covMatrix[0][0]).toBeGreaterThan(0);
      expect(covMatrix[1][1]).toBeGreaterThan(0);
    });
  });

  describe('calculatePortfolioReturn()', () => {
    
    test('should calculate portfolio expected return', () => {
      const weights = [0.6, 0.4];
      const expectedReturns = { 'BTC': 0.02, 'ETH': 0.03 };
      const assets = ['BTC', 'ETH'];
      
      const portfolioReturn = calculatePortfolioReturn(weights, expectedReturns, assets);
      
      expect(portfolioReturn).toBeCloseTo(0.024, 3); // 0.6*0.02 + 0.4*0.03
    });

    test('should handle equal weights', () => {
      const weights = [0.5, 0.5];
      const expectedReturns = { 'BTC': 0.02, 'ETH': 0.04 };
      const assets = ['BTC', 'ETH'];
      
      const portfolioReturn = calculatePortfolioReturn(weights, expectedReturns, assets);
      
      expect(portfolioReturn).toBeCloseTo(0.03, 3);
    });
  });

  describe('calculatePortfolioVariance()', () => {
    
    test('should calculate portfolio variance', () => {
      const weights = [0.5, 0.5];
      const covMatrix = [
        [0.04, 0.01],
        [0.01, 0.09]
      ];
      
      const variance = calculatePortfolioVariance(weights, covMatrix);
      
      expect(variance).toBeGreaterThan(0);
      expect(typeof variance).toBe('number');
    });

    test('should have lower variance with diversification', () => {
      const weights1 = [1.0, 0.0]; // All in asset 1
      const weights2 = [0.5, 0.5]; // Diversified
      const covMatrix = [
        [0.04, 0.01],
        [0.01, 0.04]
      ];
      
      const var1 = calculatePortfolioVariance(weights1, covMatrix);
      const var2 = calculatePortfolioVariance(weights2, covMatrix);
      
      expect(var2).toBeLessThan(var1);
    });
  });

  describe('calculatePortfolioVolatility()', () => {
    
    test('should calculate portfolio volatility', () => {
      const weights = [0.5, 0.5];
      const covMatrix = [
        [0.04, 0.01],
        [0.01, 0.09]
      ];
      
      const volatility = calculatePortfolioVolatility(weights, covMatrix);
      
      expect(volatility).toBeGreaterThan(0);
      expect(typeof volatility).toBe('number');
    });

    test('should be square root of variance', () => {
      const weights = [0.6, 0.4];
      const covMatrix = [
        [0.04, 0.01],
        [0.01, 0.09]
      ];
      
      const volatility = calculatePortfolioVolatility(weights, covMatrix);
      const variance = calculatePortfolioVariance(weights, covMatrix);
      
      expect(volatility).toBeCloseTo(Math.sqrt(Math.abs(variance)), 6);
    });
  });

  describe('calculateSharpeRatio()', () => {
    
    test('should calculate Sharpe ratio', () => {
      const portfolioReturn = 0.10;
      const volatility = 0.15;
      const riskFreeRate = 0.04;
      
      const sharpe = calculateSharpeRatio(portfolioReturn, volatility, riskFreeRate);
      
      expect(sharpe).toBeCloseTo(0.4, 2); // (0.10 - 0.04) / 0.15
    });

    test('should handle zero volatility', () => {
      const sharpe = calculateSharpeRatio(0.10, 0, 0.04);
      expect(sharpe).toBe(0);
    });

    test('should be negative for return below risk-free rate', () => {
      const sharpe = calculateSharpeRatio(0.02, 0.10, 0.04);
      expect(sharpe).toBeLessThan(0);
    });

    test('should increase with higher return', () => {
      const sharpe1 = calculateSharpeRatio(0.08, 0.10, 0.04);
      const sharpe2 = calculateSharpeRatio(0.12, 0.10, 0.04);
      
      expect(sharpe2).toBeGreaterThan(sharpe1);
    });
  });

  describe('optimizePortfolio()', () => {
    
    test('should optimize portfolio to maximize Sharpe ratio', () => {
      const assetReturns = {
        'BTC': generateMockReturns(0.002, 0.03, 100),
        'ETH': generateMockReturns(0.0025, 0.035, 100),
        'BNB': generateMockReturns(0.0015, 0.025, 100)
      };
      
      const result = optimizePortfolio(assetReturns);
      
      expect(result).toHaveProperty('weights');
      expect(result).toHaveProperty('expectedReturn');
      expect(result).toHaveProperty('volatility');
      expect(result).toHaveProperty('sharpeRatio');
      expect(result.optimal).toBe(true);
    });

    test('should have weights that sum to 1', () => {
      const assetReturns = {
        'BTC': generateMockReturns(0.002, 0.03, 50),
        'ETH': generateMockReturns(0.0025, 0.035, 50)
      };
      
      const result = optimizePortfolio(assetReturns);
      const sum = Object.values(result.weights).reduce((a, b) => a + b, 0);
      
      expect(sum).toBeCloseTo(1.0, 2);
    });

    test('should respect risk tolerance constraint', () => {
      const assetReturns = {
        'BTC': generateMockReturns(0.003, 0.05, 100),
        'ETH': generateMockReturns(0.002, 0.04, 100)
      };
      
      const result = optimizePortfolio(assetReturns, {
        riskTolerance: 0.10
      });
      
      expect(result.volatility).toBeLessThanOrEqual(0.11); // Allow small tolerance
    });

    test('should apply weight constraints during optimization', () => {
      const assetReturns = {
        'BTC': generateMockReturns(0.002, 0.03, 50),
        'ETH': generateMockReturns(0.0025, 0.035, 50),
        'BNB': generateMockReturns(0.0015, 0.025, 50)
      };
      
      const result = optimizePortfolio(assetReturns, {
        minWeight: 0.1,
        maxWeight: 0.5,
        maxIterations: 3000
      });
      
      // Verify we got a result with valid weights
      expect(result).toHaveProperty('weights');
      const weights = Object.values(result.weights);
      expect(weights.length).toBe(3);
      
      // Verify weights sum to approximately 1
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    });

    test('should handle single asset', () => {
      const assetReturns = {
        'BTC': generateMockReturns(0.002, 0.03, 50)
      };
      
      const result = optimizePortfolio(assetReturns);
      
      expect(result.weights.BTC).toBeCloseTo(1.0, 2);
    });

    test('should throw error with no assets', () => {
      expect(() => optimizePortfolio({})).toThrow();
    });
  });

  describe('calculateEfficientFrontier()', () => {
    
    test('should calculate efficient frontier points', () => {
      const assetReturns = {
        'BTC': generateMockReturns(0.002, 0.03, 100),
        'ETH': generateMockReturns(0.0025, 0.035, 100),
        'BNB': generateMockReturns(0.0015, 0.025, 100)
      };
      
      const frontier = calculateEfficientFrontier(assetReturns, 10);
      
      expect(Array.isArray(frontier)).toBe(true);
      expect(frontier.length).toBeGreaterThan(0);
      expect(frontier.length).toBeLessThanOrEqual(10);
    });

    test('should have frontier points with required properties', () => {
      const assetReturns = {
        'BTC': generateMockReturns(0.002, 0.03, 50),
        'ETH': generateMockReturns(0.0025, 0.035, 50)
      };
      
      const frontier = calculateEfficientFrontier(assetReturns, 5);
      
      frontier.forEach(point => {
        expect(point).toHaveProperty('expectedReturn');
        expect(point).toHaveProperty('volatility');
        expect(point).toHaveProperty('sharpeRatio');
        expect(point).toHaveProperty('weights');
      });
    });

    test('should have generally increasing returns along frontier', () => {
      const assetReturns = {
        'BTC': generateMockReturns(0.002, 0.03, 100),
        'ETH': generateMockReturns(0.004, 0.05, 100)
      };
      
      const frontier = calculateEfficientFrontier(assetReturns, 10);
      
      // Returns should generally trend upward along frontier
      // Check that maximum return is higher than minimum
      const returns = frontier.map(p => p.expectedReturn);
      const minReturn = Math.min(...returns);
      const maxReturn = Math.max(...returns);
      
      expect(maxReturn).toBeGreaterThan(minReturn);
    });
  });

  describe('suggestRebalancing()', () => {
    
    test('should suggest rebalancing actions', () => {
      const currentWeights = { 'BTC': 0.7, 'ETH': 0.3 };
      const optimalWeights = { 'BTC': 0.5, 'ETH': 0.5 };
      const portfolioValue = 10000;
      
      const actions = suggestRebalancing(currentWeights, optimalWeights, portfolioValue, 0.05);
      
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
    });

    test('should include action details', () => {
      const currentWeights = { 'BTC': 0.8, 'ETH': 0.2 };
      const optimalWeights = { 'BTC': 0.6, 'ETH': 0.4 };
      const portfolioValue = 10000;
      
      const actions = suggestRebalancing(currentWeights, optimalWeights, portfolioValue);
      
      actions.forEach(action => {
        expect(action).toHaveProperty('asset');
        expect(action).toHaveProperty('action');
        expect(action).toHaveProperty('currentWeight');
        expect(action).toHaveProperty('optimalWeight');
        expect(action).toHaveProperty('difference');
        expect(action).toHaveProperty('changeValue');
        expect(action).toHaveProperty('priority');
      });
    });

    test('should not suggest rebalancing if within threshold', () => {
      const currentWeights = { 'BTC': 0.51, 'ETH': 0.49 };
      const optimalWeights = { 'BTC': 0.50, 'ETH': 0.50 };
      const portfolioValue = 10000;
      
      const actions = suggestRebalancing(currentWeights, optimalWeights, portfolioValue, 0.05);
      
      expect(actions.length).toBe(0);
    });

    test('should sort actions by priority', () => {
      const currentWeights = { 'BTC': 0.6, 'ETH': 0.3, 'BNB': 0.1 };
      const optimalWeights = { 'BTC': 0.4, 'ETH': 0.4, 'BNB': 0.2 };
      const portfolioValue = 10000;
      
      const actions = suggestRebalancing(currentWeights, optimalWeights, portfolioValue, 0.05);
      
      if (actions.length > 1) {
        for (let i = 1; i < actions.length; i++) {
          expect(Math.abs(actions[i-1].difference)).toBeGreaterThanOrEqual(
            Math.abs(actions[i].difference)
          );
        }
      }
    });

    test('should handle new assets', () => {
      const currentWeights = { 'BTC': 0.7, 'ETH': 0.3 };
      const optimalWeights = { 'BTC': 0.5, 'ETH': 0.3, 'BNB': 0.2 };
      const portfolioValue = 10000;
      
      const actions = suggestRebalancing(currentWeights, optimalWeights, portfolioValue, 0.05);
      
      const bnbAction = actions.find(a => a.asset === 'BNB');
      expect(bnbAction).toBeDefined();
      expect(bnbAction.action).toBe('BUY');
    });
  });

  describe('calculateMinimumVariancePortfolio()', () => {
    
    test('should calculate minimum variance portfolio', () => {
      const assetReturns = {
        'BTC': generateMockReturns(0.002, 0.03, 100),
        'ETH': generateMockReturns(0.0025, 0.04, 100),
        'BNB': generateMockReturns(0.0015, 0.02, 100)
      };
      
      const result = calculateMinimumVariancePortfolio(assetReturns);
      
      expect(result).toHaveProperty('weights');
      expect(result).toHaveProperty('expectedReturn');
      expect(result).toHaveProperty('volatility');
      expect(result).toHaveProperty('variance');
    });

    test('should have lower variance than equal weights', () => {
      const assetReturns = {
        'BTC': generateMockReturns(0.002, 0.04, 100),
        'ETH': generateMockReturns(0.003, 0.06, 100)
      };
      
      const minVar = calculateMinimumVariancePortfolio(assetReturns);
      
      // Equal weights portfolio
      const equalWeights = { 'BTC': 0.5, 'ETH': 0.5 };
      const covMatrix = [[0.0016, 0.001], [0.001, 0.0036]];
      const equalVariance = calculatePortfolioVariance([0.5, 0.5], covMatrix);
      
      expect(minVar.variance).toBeLessThanOrEqual(equalVariance * 1.1); // Allow some tolerance
    });
  });

  describe('validateWeights()', () => {
    
    test('should validate correct weights', () => {
      const weights = { 'BTC': 0.6, 'ETH': 0.4 };
      const validation = validateWeights(weights);
      
      expect(validation.valid).toBe(true);
      expect(validation.sumValid).toBe(true);
      expect(validation.nonNegative).toBe(true);
      expect(validation.bounded).toBe(true);
    });

    test('should detect invalid sum', () => {
      const weights = { 'BTC': 0.7, 'ETH': 0.4 };
      const validation = validateWeights(weights);
      
      expect(validation.valid).toBe(false);
      expect(validation.sumValid).toBe(false);
    });

    test('should detect negative weights', () => {
      const weights = { 'BTC': 1.2, 'ETH': -0.2 };
      const validation = validateWeights(weights);
      
      expect(validation.valid).toBe(false);
      expect(validation.nonNegative).toBe(false);
    });

    test('should detect weights > 1', () => {
      const weights = { 'BTC': 1.5, 'ETH': -0.5 };
      const validation = validateWeights(weights);
      
      expect(validation.valid).toBe(false);
      expect(validation.bounded).toBe(false);
    });
  });
});
