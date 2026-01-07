/**
 * @fileoverview Risk Agent Core Logic (Internal Module)
 * @module services/risk-agent
 * @description
 * Extracted from backend/routes/ai-agents.js (agent-2 logic).
 * This module provides the real Risk Agent logic as a reusable internal function.
 * NO HTTP dependencies, NO authentication required.
 * Used by:
 * - /api/ai-agents/:id/run (HTTP API)
 * - RiskGateService (pre-trade risk checks)
 * - Trading Engine (direct internal calls)
 */

import * as aiService from './ai.js';
import { logger } from '../services/logger.js';

/**
 * @typedef {Object} RiskAssessmentInput
 * @property {string} [symbol] - Trading symbol (e.g., 'BTC/USDT', 'PORTFOLIO')
 * @property {string} [action] - Trade action (e.g., 'BUY', 'SELL', 'ASSESS')
 * @property {number} [amount] - Trade amount in base currency
 * @property {number} [price] - Trade price (optional)
 * @property {Object} [marketData] - Current market data (optional)
 */

/**
 * @typedef {Object} RiskAssessmentResult
 * @property {string} agentId - Agent identifier (usually UUID)
 * @property {string} function - Function name ('runRiskAssessment')
 * @property {string} recommendation - 'REDUCE' | 'HOLD' | 'INCREASE'
 * @property {number} confidence - Confidence score (0-100)
 * @property {string} riskLevel - 'low' | 'medium' | 'high' | 'critical'
 * @property {string} [symbol] - Trading symbol
 * @property {Object} _meta - Metadata
 * @property {boolean} _meta.isFallback - True if AI call failed and fallback was used
 * @property {number} _meta.executionTime - Execution time in milliseconds
 */

/**
 * Timeout wrapper for promises
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} timeoutMessage - Error message on timeout
 * @returns {Promise}
 */
async function withTimeout(promise, timeoutMs, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
}

/**
 * Safe JSON parser with error handling
 * @param {string} text - JSON string to parse
 * @returns {Object|null} Parsed object or null on error
 */
function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    logger.error('❌ JSON parse error:', e.message);
    return null;
  }
}

/**
 * Calculate risk score using deterministic heuristics
 * @param {RiskAssessmentInput} input - Risk assessment input
 * @returns {Object} Risk score calculation result
 */
function calculateRiskScore(input) {
  const { symbol, action, amount, price } = input;
  
  let riskScore = 50; // Base risk: neutral
  let factors = [];
  
  // Factor 1: Trade size
  if (amount) {
    if (amount > 10000) {
      riskScore += 20;
      factors.push('Large trade size (>10k)');
    } else if (amount > 5000) {
      riskScore += 10;
      factors.push('Medium trade size (5k-10k)');
    } else if (amount < 100) {
      riskScore -= 5;
      factors.push('Small trade size (<100)');
    }
  }
  
  // Factor 2: Action type
  if (action === 'BUY') {
    riskScore += 5; // Buying increases exposure
    factors.push('BUY action increases exposure');
  } else if (action === 'SELL') {
    riskScore -= 5; // Selling reduces exposure
    factors.push('SELL action reduces exposure');
  }
  
  // Factor 3: Symbol volatility (heuristic)
  if (symbol && symbol.includes('BTC')) {
    riskScore += 10;
    factors.push('High volatility asset (BTC)');
  } else if (symbol && symbol.includes('ETH')) {
    riskScore += 8;
    factors.push('Medium-high volatility asset (ETH)');
  } else if (symbol && symbol.includes('USDT')) {
    riskScore -= 10;
    factors.push('Stable asset (USDT)');
  }
  
  // Clamp to 0-100
  riskScore = Math.max(0, Math.min(100, riskScore));
  
  return { riskScore, factors };
}

/**
 * Determine risk level from risk score
 * @param {number} riskScore - Risk score (0-100)
 * @returns {string} Risk level: 'low' | 'medium' | 'high' | 'critical'
 */
function getRiskLevel(riskScore) {
  if (riskScore >= 80) return 'critical';
  if (riskScore >= 60) return 'high';
  if (riskScore >= 40) return 'medium';
  return 'low';
}

/**
 * Determine recommendation from risk score
 * @param {number} riskScore - Risk score (0-100)
 * @returns {string} Recommendation: 'REDUCE' | 'HOLD' | 'INCREASE'
 */
function getRecommendation(riskScore) {
  if (riskScore >= 70) return 'REDUCE';
  if (riskScore <= 30) return 'INCREASE';
  return 'HOLD';
}

/**
 * Run Risk Assessment (Internal Core Logic)
 * @param {RiskAssessmentInput} input - Risk assessment input
 * @param {string} [agentId='agent-2'] - Agent identifier
 * @param {number} [timeoutMs=10000] - Timeout for AI call (default: 10s)
 * @returns {Promise<RiskAssessmentResult>} Risk assessment result
 * 
 * @description
 * This is the real Risk Agent logic extracted from backend/routes/ai-agents.js.
 * 
 * Flow:
 * 1. Build prompt for Artemis AI
 * 2. Call Artemis with 10s timeout
 * 3. Parse JSON response
 * 4. If AI succeeds: return result with isFallback=false
 * 5. If AI fails/timeouts: calculate deterministic fallback with isFallback=true
 * 
 * Fallback Strategy:
 * - Uses deterministic heuristics (trade size, action, symbol volatility)
 * - NO Math.random() - fully deterministic
 * - Provides consistent results for testing
 * 
 * Usage:
 * ```javascript
 * const riskAgent = require('./services/risk-agent');
 * const result = await riskAgent.runRiskAssessment({
 *   symbol: 'BTC/USDT',
 *   action: 'BUY',
 *   amount: 15000
 * });
 * logger.info(result.recommendation); // 'REDUCE', 'HOLD', or 'INCREASE'
 * logger.info(result.riskLevel);      // 'low', 'medium', 'high', or 'critical'
 * logger.info(result._meta.isFallback); // true if AI failed
 * ```
 */
async function runRiskAssessment(input, agentId = 'agent-2', timeoutMs = 10000) {
  const startTime = Date.now();
  const { symbol, action, amount } = input;
  
  // Build AI prompt
  const prompt = `
You are the Risk Management Agent in the TitanGold trading system.
Assess the risk profile for:
- Symbol: ${symbol || 'PORTFOLIO'}
- Action: ${action || 'ASSESS'}
- Amount: ${amount || 'N/A'}

Return ONLY JSON:
{
  "recommendation": "REDUCE" | "HOLD" | "INCREASE",
  "confidence": <number 0-100>,
  "riskLevel": "low" | "medium" | "high" | "critical"
}
`;

  try {
    // 1️⃣ Try to get AI response with timeout
    const raw = await withTimeout(
      aiService.askArtemis(prompt),
      timeoutMs,
      `Risk Agent timeout after ${timeoutMs}ms`
    );
    
    // 2️⃣ Parse JSON response
    const parsed = safeParseJson(raw);
    
    if (parsed && parsed.recommendation) {
      // ✅ AI SUCCESS
      const executionTime = Date.now() - startTime;
      
      // Calculate numeric risk score from riskLevel for consistency
      let riskScore;
      switch (parsed.riskLevel) {
        case 'critical': riskScore = 90; break;
        case 'high': riskScore = 75; break;
        case 'medium': riskScore = 50; break;
        case 'low': riskScore = 25; break;
        default: riskScore = 50;
      }
      
      return {
        agentId,
        function: 'runRiskAssessment',
        recommendation: parsed.recommendation,
        confidence: parsed.confidence ?? 60,
        riskLevel: parsed.riskLevel || 'medium',
        riskScore, // ✅ Add riskScore to root for easy access
        symbol,
        _meta: {
          isFallback: false,
          executionTime,
          source: 'ai',
          riskScore // ✅ Keep in _meta for consistency
        }
      };
    }
    
    // Invalid response → fall through to fallback
    logger.warn('⚠️  Risk Agent: AI returned invalid response, using fallback');
    
  } catch (error) {
    // AI call failed or timed out
    logger.error('❌ Risk Agent AI error:', error.message);
  }
  
  // 3️⃣ FALLBACK: Deterministic Heuristic-Based Risk Assessment
  const { riskScore, factors } = calculateRiskScore(input);
  const riskLevel = getRiskLevel(riskScore);
  const recommendation = getRecommendation(riskScore);
  const executionTime = Date.now() - startTime;
  
  logger.info(`🛡️  Risk Agent FALLBACK: score=${riskScore}, level=${riskLevel}, recommendation=${recommendation}`);
  logger.info(`   Factors: ${factors.join('; ')}`);
  
  return {
    agentId,
    function: 'runRiskAssessment',
    recommendation,
    confidence: Math.round(100 - riskScore / 2), // Higher risk → lower confidence
    riskLevel,
    riskScore, // ✅ Add riskScore to root for easy access
    symbol,
    _meta: {
      isFallback: true,
      executionTime,
      source: 'heuristic',
      riskScore, // ✅ Keep in _meta for consistency
      factors
    }
  };
}

// Export as ES6
export {
  runRiskAssessment,
  calculateRiskScore,
  getRiskLevel,
  getRecommendation
};
