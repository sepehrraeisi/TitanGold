/**
 * Integration Tests for Risk Management Agent
 * BACKEND-004: End-to-end testing via API
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';
import { query } from '../../database/db.js';

describe('Risk Management Agent - End-to-End', () => {
  let testUser;
  let authToken;
  let testPortfolio;
  
  beforeAll(async () => {
    // Create test user
    const userResult = await query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      ['risk_test_user', 'risk_test@example.com', 'hashed_password', 'user']
    );
    testUser = userResult.rows[0];
    
    // Create auth token (mock - in real scenario would go through auth flow)
    authToken = 'mock_token_' + testUser.id;
    
    // Create test portfolio
    const portfolioResult = await query(
      `INSERT INTO portfolios (user_id, name, description, base_currency, is_main) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [testUser.id, 'Risk Test Portfolio', 'Portfolio for risk testing', 'USD', true]
    );
    testPortfolio = portfolioResult.rows[0];
    
    // Create some test trades
    const trades = [
      { symbol: 'BTC/USD', side: 'buy', amount: 0.5, price: 40000 },
      { symbol: 'ETH/USD', side: 'buy', amount: 5, price: 2500 },
      { symbol: 'BTC/USD', side: 'sell', amount: 0.2, price: 42000 },
      { symbol: 'ADA/USD', side: 'buy', amount: 1000, price: 0.5 }
    ];
    
    for (const trade of trades) {
      await query(
        `INSERT INTO trades (user_id, portfolio_id, symbol, side, type, amount, price, exchange, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - INTERVAL '1 day' * $10)`,
        [testUser.id, testPortfolio.id, trade.symbol, trade.side, 'market', trade.amount, trade.price, 'binance', 'completed', Math.floor(Math.random() * 30)]
      );
    }
  });
  
  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      await query('DELETE FROM trades WHERE user_id = $1', [testUser.id]);
      await query('DELETE FROM portfolios WHERE user_id = $1', [testUser.id]);
      await query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
  });
  
  describe('POST /api/v1/ai-agents/risk/run', () => {
    it('should execute risk analysis for portfolio', async () => {
      const response = await request(app)
        .post('/api/v1/ai-agents/risk/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          config: {
            portfolio_id: testPortfolio.id,
            confidence_level: 0.95,
            max_risk_per_trade: 0.02
          }
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('agent_key', 'risk');
      expect(response.body).toHaveProperty('result');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body).toHaveProperty('analysis');
      
      const analysis = response.body.analysis;
      expect(analysis).toHaveProperty('portfolio_id', testPortfolio.id);
      expect(analysis).toHaveProperty('portfolio_value');
      expect(analysis).toHaveProperty('risk_metrics');
      expect(analysis).toHaveProperty('position_sizing');
    });
    
    it('should calculate VaR for portfolio', async () => {
      const response = await request(app)
        .post('/api/v1/ai-agents/risk/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          config: { portfolio_id: testPortfolio.id }
        });
      
      expect(response.status).toBe(200);
      const analysis = response.body.analysis;
      
      expect(analysis.risk_metrics).toHaveProperty('historical_var');
      expect(analysis.risk_metrics).toHaveProperty('parametric_var');
      expect(analysis.risk_metrics.historical_var).toHaveProperty('var_1day');
      expect(analysis.risk_metrics.historical_var).toHaveProperty('confidence_level', 0.95);
    });
    
    it('should provide position sizing recommendations', async () => {
      const response = await request(app)
        .post('/api/v1/ai-agents/risk/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          symbol: 'BTC/USD',
          config: {
            portfolio_id: testPortfolio.id,
            entry_price: 40000,
            stop_loss_price: 38000,
            use_kelly_criterion: true
          }
        });
      
      expect(response.status).toBe(200);
      const analysis = response.body.analysis;
      
      expect(analysis.position_sizing).toBeDefined();
      expect(analysis.recommendations).toEqual(expect.arrayContaining([
        expect.stringContaining('position size')
      ]));
    });
    
    it('should calculate correlation matrix for multiple assets', async () => {
      const response = await request(app)
        .post('/api/v1/ai-agents/risk/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          config: { portfolio_id: testPortfolio.id }
        });
      
      expect(response.status).toBe(200);
      const analysis = response.body.analysis;
      
      if (analysis.positions_count >= 2) {
        expect(analysis.correlations).toBeDefined();
        expect(analysis.correlations).toHaveProperty('matrix');
        expect(analysis.correlations).toHaveProperty('diversification_score');
      }
    });
    
    it('should generate stop-loss recommendations', async () => {
      const response = await request(app)
        .post('/api/v1/ai-agents/risk/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          symbol: 'BTC/USD',
          config: {
            portfolio_id: testPortfolio.id,
            current_price: 40000,
            side: 'buy',
            stop_loss_method: 'atr',
            atr_multiplier: 2
          }
        });
      
      expect(response.status).toBe(200);
      const analysis = response.body.analysis;
      
      expect(analysis.stop_loss_recommendations).toBeDefined();
      expect(analysis.stop_loss_recommendations.length).toBeGreaterThan(0);
      expect(analysis.stop_loss_recommendations[0]).toHaveProperty('stop_loss_price');
    });
    
    it('should calculate risk/reward ratio when target provided', async () => {
      const response = await request(app)
        .post('/api/v1/ai-agents/risk/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          symbol: 'BTC/USD',
          config: {
            portfolio_id: testPortfolio.id,
            current_price: 40000,
            target_price: 45000,
            side: 'buy'
          }
        });
      
      expect(response.status).toBe(200);
      const analysis = response.body.analysis;
      
      expect(analysis).toHaveProperty('risk_reward');
      expect(analysis.risk_reward).toHaveProperty('risk_reward_ratio');
      expect(analysis.risk_reward).toHaveProperty('assessment');
    });
    
    it('should provide overall risk assessment', async () => {
      const response = await request(app)
        .post('/api/v1/ai-agents/risk/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          config: { portfolio_id: testPortfolio.id }
        });
      
      expect(response.status).toBe(200);
      const analysis = response.body.analysis;
      
      expect(analysis).toHaveProperty('overall_risk_level');
      expect(analysis).toHaveProperty('overall_risk_score');
      expect(['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL']).toContain(analysis.overall_risk_level);
      expect(analysis.overall_risk_score).toBeGreaterThanOrEqual(0);
      expect(analysis.overall_risk_score).toBeLessThanOrEqual(100);
    });
    
    it('should include warnings for high-risk scenarios', async () => {
      const response = await request(app)
        .post('/api/v1/ai-agents/risk/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          config: { portfolio_id: testPortfolio.id }
        });
      
      expect(response.status).toBe(200);
      const analysis = response.body.analysis;
      
      expect(analysis).toHaveProperty('warnings');
      expect(Array.isArray(analysis.warnings)).toBe(true);
    });
    
    it('should provide actionable recommendations', async () => {
      const response = await request(app)
        .post('/api/v1/ai-agents/risk/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          config: { portfolio_id: testPortfolio.id }
        });
      
      expect(response.status).toBe(200);
      const analysis = response.body.analysis;
      
      expect(analysis).toHaveProperty('recommendations');
      expect(Array.isArray(analysis.recommendations)).toBe(true);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
    
    it('should handle user with no portfolio', async () => {
      // Create user without portfolio
      const noPortfolioUser = await query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        ['no_portfolio_user', 'no_portfolio@example.com', 'hashed_password', 'user']
      );
      
      const response = await request(app)
        .post('/api/v1/ai-agents/risk/run')
        .set('Authorization', `Bearer mock_token_${noPortfolioUser.rows[0].id}`)
        .send({
          userId: noPortfolioUser.rows[0].id
        });
      
      expect(response.status).toBe(200);
      expect(response.body.result).toContain('No portfolio found');
      
      // Cleanup
      await query('DELETE FROM users WHERE id = $1', [noPortfolioUser.rows[0].id]);
    });
    
    it('should execute within reasonable time (< 5 seconds)', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/v1/ai-agents/risk/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          config: { portfolio_id: testPortfolio.id }
        });
      
      const executionTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(executionTime).toBeLessThan(5000);
      expect(response.body).toHaveProperty('execution_time_ms');
    });
  });
  
  describe('GET /api/v1/ai-agents/risk/details', () => {
    it('should return agent details and capabilities', async () => {
      const response = await request(app)
        .get('/api/v1/ai-agents/risk/details')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: testUser.id });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('agent_key', 'risk');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('capabilities');
      expect(Array.isArray(response.body.capabilities)).toBe(true);
      expect(response.body.capabilities.length).toBeGreaterThan(0);
    });
  });
  
  describe('Configuration Options', () => {
    it('should accept custom confidence level', async () => {
      const response = await request(app)
        .post('/api/v1/ai-agents/risk/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          config: {
            portfolio_id: testPortfolio.id,
            confidence_level: 0.99
          }
        });
      
      expect(response.status).toBe(200);
      const analysis = response.body.analysis;
      expect(analysis.risk_metrics.historical_var.confidence_level).toBe(0.99);
    });
    
    it('should accept custom max risk per trade', async () => {
      const response = await request(app)
        .post('/api/v1/ai-agents/risk/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          config: {
            portfolio_id: testPortfolio.id,
            max_risk_per_trade: 0.01
          }
        });
      
      expect(response.status).toBe(200);
      expect(response.body._meta.config.max_risk_per_trade).toBe(0.01);
    });
    
    it('should support different stop-loss methods', async () => {
      const response = await request(app)
        .post('/api/v1/ai-agents/risk/run')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          symbol: 'BTC/USD',
          config: {
            portfolio_id: testPortfolio.id,
            current_price: 40000,
            stop_loss_method: 'atr',
            atr_multiplier: 3
          }
        });
      
      expect(response.status).toBe(200);
      const analysis = response.body.analysis;
      const atrStop = analysis.stop_loss_recommendations.find(s => s.method === 'atr');
      expect(atrStop).toBeDefined();
      expect(atrStop.atr_multiplier).toBe(3);
    });
  });
});
