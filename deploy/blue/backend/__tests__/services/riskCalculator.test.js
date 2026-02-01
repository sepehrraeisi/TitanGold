/**
 * Unit Tests for Risk Calculator Service
 * BACKEND-004: Risk Management Agent Tests
 * Target: 80% coverage
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  calculateReturns,
  calculateHistoricalVaR,
  calculateParametricVaR,
  calculateKellyPositionSize,
  calculateFixedFractionalSize,
  calculateCorrelation,
  calculateCorrelationMatrix,
  calculateATRStopLoss,
  calculatePercentageStopLoss,
  calculatePortfolioRiskMetrics
} from '../../services/riskCalculator.js';

describe('Risk Calculator Service', () => {
  
  describe('calculateReturns', () => {
    it('should calculate returns from price data', () => {
      const prices = [
        { timestamp: '2024-01-01', close: 100 },
        { timestamp: '2024-01-02', close: 102 },
        { timestamp: '2024-01-03', close: 101 },
        { timestamp: '2024-01-04', close: 105 }
      ];
      
      const returns = calculateReturns(prices);
      
      expect(returns).toHaveLength(3);
      expect(returns[0]).toBeCloseTo(0.02, 4); // (102-100)/100 = 0.02
      expect(returns[1]).toBeCloseTo(-0.0098, 4); // (101-102)/102 ≈ -0.0098
      expect(returns[2]).toBeCloseTo(0.0396, 4); // (105-101)/101 ≈ 0.0396
    });
    
    it('should return empty array for insufficient data', () => {
      const prices = [{ timestamp: '2024-01-01', close: 100 }];
      const returns = calculateReturns(prices);
      expect(returns).toEqual([]);
    });
    
    it('should handle null/undefined input', () => {
      expect(calculateReturns(null)).toEqual([]);
      expect(calculateReturns(undefined)).toEqual([]);
    });
  });
  
  describe('calculateHistoricalVaR', () => {
    let returns;
    
    beforeEach(() => {
      // Generate sample returns: normal distribution with mean 0.001 and std 0.02
      returns = [];
      for (let i = 0; i < 100; i++) {
        const randomReturn = (Math.random() - 0.5) * 0.04 + 0.001;
        returns.push(randomReturn);
      }
    });
    
    it('should calculate VaR at 95% confidence level', () => {
      const portfolioValue = 100000;
      const var_result = calculateHistoricalVaR(returns, 0.95, portfolioValue);
      
      expect(var_result).toHaveProperty('method', 'historical_simulation');
      expect(var_result).toHaveProperty('var_1day');
      expect(var_result).toHaveProperty('var_1day_percent');
      expect(var_result).toHaveProperty('confidence_level', 0.95);
      expect(var_result.var_1day).toBeGreaterThan(0);
      expect(var_result.data_points).toBe(100);
    });
    
    it('should handle insufficient data', () => {
      const shortReturns = [0.01, 0.02, -0.01];
      const result = calculateHistoricalVaR(shortReturns, 0.95, 100000);
      
      expect(result).toHaveProperty('warning');
      expect(result.var_1day).toBe(0);
      expect(result.data_points).toBe(3);
    });
    
    it('should calculate VaR at different confidence levels', () => {
      const var95 = calculateHistoricalVaR(returns, 0.95, 100000);
      const var99 = calculateHistoricalVaR(returns, 0.99, 100000);
      
      // VaR should be higher at 99% confidence
      expect(var99.var_1day).toBeGreaterThanOrEqual(var95.var_1day);
    });
  });
  
  describe('calculateParametricVaR', () => {
    let returns;
    
    beforeEach(() => {
      returns = [];
      for (let i = 0; i < 100; i++) {
        returns.push((Math.random() - 0.5) * 0.04);
      }
    });
    
    it('should calculate parametric VaR', () => {
      const result = calculateParametricVaR(returns, 0.95, 100000);
      
      expect(result).toHaveProperty('method', 'parametric');
      expect(result).toHaveProperty('var_1day');
      expect(result).toHaveProperty('mean_return');
      expect(result).toHaveProperty('volatility');
      expect(result.var_1day).toBeGreaterThan(0);
    });
    
    it('should handle insufficient data', () => {
      const result = calculateParametricVaR([0.01, 0.02], 0.95, 100000);
      expect(result).toHaveProperty('warning');
    });
  });
  
  describe('calculateKellyPositionSize', () => {
    it('should calculate Kelly position size with positive edge', () => {
      const winRate = 0.6;
      const avgWin = 1000;
      const avgLoss = 500;
      const portfolioValue = 100000;
      
      const result = calculateKellyPositionSize(winRate, avgWin, avgLoss, portfolioValue, 0.02);
      
      expect(result).toHaveProperty('method', 'kelly_criterion');
      expect(result).toHaveProperty('position_size');
      expect(result).toHaveProperty('fractional_kelly_percent');
      expect(result.position_size).toBeGreaterThan(0);
      expect(result.recommendation).toContain('Trade recommended');
    });
    
    it('should recommend no trade with negative edge', () => {
      const winRate = 0.3;
      const avgWin = 500;
      const avgLoss = 1000;
      const portfolioValue = 100000;
      
      const result = calculateKellyPositionSize(winRate, avgWin, avgLoss, portfolioValue, 0.02);
      
      expect(result.position_size).toBe(0);
      expect(result.recommendation).toContain('No trade recommended');
    });
    
    it('should handle invalid parameters', () => {
      const result = calculateKellyPositionSize(0, 100, 50, 100000, 0.02);
      expect(result).toHaveProperty('warning');
      expect(result.position_size).toBe(0);
    });
    
    it('should calculate win/loss ratio correctly', () => {
      const result = calculateKellyPositionSize(0.55, 1000, 500, 100000, 0.02);
      expect(result.win_loss_ratio).toBeCloseTo(2, 2);
    });
  });
  
  describe('calculateFixedFractionalSize', () => {
    it('should calculate position size based on risk', () => {
      const portfolioValue = 100000;
      const riskPercent = 0.02;
      const entryPrice = 100;
      const stopLossPrice = 98;
      
      const result = calculateFixedFractionalSize(portfolioValue, riskPercent, entryPrice, stopLossPrice);
      
      expect(result).toHaveProperty('method', 'fixed_fractional');
      expect(result).toHaveProperty('position_size');
      expect(result).toHaveProperty('shares');
      expect(result.shares).toBe(1000); // Risk $2000 / $2 risk per share = 1000 shares
      expect(result.position_size).toBe(100000); // 1000 shares * $100 = $100,000
    });
    
    it('should handle invalid parameters', () => {
      const result = calculateFixedFractionalSize(0, 0.02, 100, 98);
      expect(result).toHaveProperty('warning');
      expect(result.position_size).toBe(0);
    });
    
    it('should calculate risk per share correctly', () => {
      const result = calculateFixedFractionalSize(100000, 0.01, 50, 48);
      expect(result.risk_per_share).toBe(2);
      expect(result.risk_amount).toBe(1000);
    });
  });
  
  describe('calculateCorrelation', () => {
    it('should calculate positive correlation', () => {
      const returns1 = [0.01, 0.02, 0.03, 0.04, 0.05];
      const returns2 = [0.011, 0.021, 0.031, 0.041, 0.051];
      
      const correlation = calculateCorrelation(returns1, returns2);
      
      expect(correlation).toBeGreaterThan(0.99);
      expect(correlation).toBeLessThanOrEqual(1);
    });
    
    it('should calculate negative correlation', () => {
      const returns1 = [0.01, 0.02, 0.03, 0.04, 0.05];
      const returns2 = [-0.01, -0.02, -0.03, -0.04, -0.05];
      
      const correlation = calculateCorrelation(returns1, returns2);
      
      expect(correlation).toBeLessThan(-0.99);
      expect(correlation).toBeGreaterThanOrEqual(-1);
    });
    
    it('should return 0 for mismatched arrays', () => {
      const returns1 = [0.01, 0.02, 0.03];
      const returns2 = [0.01, 0.02];
      
      const correlation = calculateCorrelation(returns1, returns2);
      expect(correlation).toBe(0);
    });
    
    it('should handle null/undefined input', () => {
      expect(calculateCorrelation(null, [1, 2, 3])).toBe(0);
      expect(calculateCorrelation([1, 2, 3], undefined)).toBe(0);
    });
  });
  
  describe('calculateCorrelationMatrix', () => {
    it('should calculate correlation matrix for multiple assets', () => {
      const assetReturns = {
        'BTC': [0.01, 0.02, 0.03, 0.02, 0.01],
        'ETH': [0.011, 0.021, 0.031, 0.021, 0.011],
        'ADA': [-0.01, -0.02, -0.01, 0.00, 0.01]
      };
      
      const result = calculateCorrelationMatrix(assetReturns);
      
      expect(result).toHaveProperty('matrix');
      expect(result).toHaveProperty('high_correlations');
      expect(result).toHaveProperty('diversification_score');
      expect(result.matrix).toHaveProperty('BTC');
      expect(result.matrix.BTC).toHaveProperty('ETH');
      expect(result.matrix.BTC.BTC).toBeCloseTo(1, 2); // Self-correlation = 1
    });
    
    it('should identify high correlations', () => {
      const assetReturns = {
        'STOCK1': [0.01, 0.02, 0.03, 0.04],
        'STOCK2': [0.011, 0.021, 0.031, 0.041]
      };
      
      const result = calculateCorrelationMatrix(assetReturns);
      
      expect(result.high_correlations.length).toBeGreaterThan(0);
      expect(result.high_correlations[0].correlation).toBeGreaterThan(0.7);
    });
    
    it('should calculate diversification score', () => {
      const assetReturns = {
        'A': [0.01, 0.02, 0.03],
        'B': [0.01, 0.02, 0.03]
      };
      
      const result = calculateCorrelationMatrix(assetReturns);
      
      expect(result.diversification_score).toBeGreaterThanOrEqual(0);
      expect(result.diversification_score).toBeLessThanOrEqual(100);
    });
  });
  
  describe('calculateATRStopLoss', () => {
    let priceData;
    
    beforeEach(() => {
      priceData = [];
      let price = 100;
      for (let i = 0; i < 20; i++) {
        price = price + (Math.random() - 0.5) * 2;
        priceData.push({
          high: price * 1.01,
          low: price * 0.99,
          close: price
        });
      }
    });
    
    it('should calculate ATR-based stop-loss for buy position', () => {
      const result = calculateATRStopLoss(priceData, 2, 100, 'buy');
      
      expect(result).toHaveProperty('method', 'atr');
      expect(result).toHaveProperty('atr');
      expect(result).toHaveProperty('stop_loss_price');
      expect(result.stop_loss_price).toBeLessThan(100);
      expect(result.side).toBe('buy');
    });
    
    it('should calculate ATR-based stop-loss for sell position', () => {
      const result = calculateATRStopLoss(priceData, 2, 100, 'sell');
      
      expect(result.stop_loss_price).toBeGreaterThan(100);
      expect(result.side).toBe('sell');
    });
    
    it('should handle insufficient data', () => {
      const shortData = priceData.slice(0, 10);
      const result = calculateATRStopLoss(shortData, 2, 100, 'buy');
      
      expect(result).toHaveProperty('warning');
      expect(result.stop_loss_price).toBe(0);
    });
    
    it('should use different ATR multipliers', () => {
      const result1 = calculateATRStopLoss(priceData, 1, 100, 'buy');
      const result2 = calculateATRStopLoss(priceData, 3, 100, 'buy');
      
      const distance1 = 100 - result1.stop_loss_price;
      const distance2 = 100 - result2.stop_loss_price;
      
      expect(distance2).toBeGreaterThan(distance1);
    });
  });
  
  describe('calculatePercentageStopLoss', () => {
    it('should calculate percentage stop-loss for buy', () => {
      const result = calculatePercentageStopLoss(100, 0.05, 'buy');
      
      expect(result).toHaveProperty('method', 'percentage');
      expect(result.stop_loss_price).toBeCloseTo(95, 2);
      expect(result.stop_percent).toBe(5);
    });
    
    it('should calculate percentage stop-loss for sell', () => {
      const result = calculatePercentageStopLoss(100, 0.05, 'sell');
      
      expect(result.stop_loss_price).toBeCloseTo(105, 2);
    });
    
    it('should handle invalid parameters', () => {
      const result = calculatePercentageStopLoss(0, 0.05, 'buy');
      expect(result).toHaveProperty('warning');
      expect(result.stop_loss_price).toBe(0);
    });
    
    it('should calculate potential loss', () => {
      const result = calculatePercentageStopLoss(100, 0.02, 'buy');
      expect(result.potential_loss).toBeCloseTo(2, 2);
    });
  });
  
  describe('calculatePortfolioRiskMetrics', () => {
    let returns;
    
    beforeEach(() => {
      returns = [];
      for (let i = 0; i < 100; i++) {
        returns.push((Math.random() - 0.5) * 0.04 + 0.001);
      }
    });
    
    it('should calculate portfolio risk metrics', () => {
      const result = calculatePortfolioRiskMetrics(returns, 0.04);
      
      expect(result).toHaveProperty('mean_return_daily');
      expect(result).toHaveProperty('mean_return_annual');
      expect(result).toHaveProperty('volatility_daily');
      expect(result).toHaveProperty('volatility_annual');
      expect(result).toHaveProperty('sharpe_ratio');
      expect(result).toHaveProperty('max_drawdown');
      expect(result).toHaveProperty('risk_assessment');
    });
    
    it('should calculate Sharpe ratio correctly', () => {
      const positiveReturns = Array(100).fill(0.01); // Consistent 1% daily returns
      const result = calculatePortfolioRiskMetrics(positiveReturns, 0.04);
      
      expect(result.sharpe_ratio).toBeGreaterThan(0);
      expect(result.mean_return_annual).toBeGreaterThan(result.volatility_annual);
    });
    
    it('should calculate maximum drawdown', () => {
      const result = calculatePortfolioRiskMetrics(returns, 0.04);
      
      expect(result.max_drawdown).toBeGreaterThanOrEqual(0);
      expect(result.max_drawdown).toBeLessThanOrEqual(1);
      expect(result.max_drawdown_percent).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle insufficient data', () => {
      const shortReturns = [0.01, 0.02];
      const result = calculatePortfolioRiskMetrics(shortReturns, 0.04);
      
      expect(result).toHaveProperty('warning');
      expect(result.volatility).toBe(0);
    });
    
    it('should annualize returns and volatility', () => {
      const dailyReturns = Array(100).fill(0.001); // 0.1% daily
      const result = calculatePortfolioRiskMetrics(dailyReturns, 0.04);
      
      // Annual return should be approximately daily * 252
      expect(result.mean_return_annual).toBeCloseTo(0.001 * 252, 2);
    });
  });
  
  describe('Edge Cases and Error Handling', () => {
    it('should handle empty arrays gracefully', () => {
      expect(calculateReturns([])).toEqual([]);
      expect(calculateCorrelation([], [])).toBe(0);
      expect(calculateHistoricalVaR([], 0.95, 100000).var_1day).toBe(0);
    });
    
    it('should handle zero values', () => {
      const result = calculateFixedFractionalSize(100000, 0, 100, 98);
      expect(result).toHaveProperty('warning');
    });
    
    it('should handle negative values appropriately', () => {
      const returns = Array(50).fill(null).map(() => -0.01 - Math.random() * 0.02);
      const metrics = calculatePortfolioRiskMetrics(returns, 0.04);
      
      expect(metrics).toHaveProperty('mean_return_daily');
      expect(metrics.mean_return_daily).toBeLessThan(0);
      expect(metrics.sharpe_ratio).toBeLessThan(0); // Negative returns should give negative Sharpe
    });
  });
});
