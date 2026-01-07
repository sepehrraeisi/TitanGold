/**
 * @fileoverview Risk Gate Service
 * @module services/risk-gate
 * @description
 * Pre-trade risk assessment to block dangerous trades.
 * 
 * Key Features:
 * - Uses real Risk Agent logic (no Math.random())
 * - Deterministic behavior for testing
 * - Configurable fail-open/fail-closed based on TRADING_MODE
 * - Logs all decisions to ai_decisions table
 * 
 * Integration:
 * - Called by ManualTradingService before MEXC order execution
 * - Direct internal function calls (no HTTP, no auth)
 * 
 * Fail Modes:
 * - DEMO mode: fail-open (allow trade on error)
 * - LIVE mode: fail-closed (block trade on error)
 */

import * as riskAgent from './risk-agent.js';
import { logger } from '../services/logger.js';

const RISK_AGENT_ID = '79bbdf0b-94a3-4cbc-adef-98c25f5ba1a7';

class RiskGateService {
  /**
   * @param {Object} db - Database connection (query method)
   * @param {string} [tradingMode='demo'] - Trading mode: 'demo' or 'live'
   */
  constructor(db, tradingMode = 'demo') {
    this.db = db;
    this.tradingMode = tradingMode || process.env.TRADING_MODE || 'demo';
    
    logger.info(`🛡️ RiskGateService initialized (mode: ${this.tradingMode})`);
  }

  /**
   * Check risk gate before executing trade
   * @param {Object} trade - Trade details
   * @param {string} trade.symbol - Trading pair (e.g., 'BTC/USDT')
   * @param {string} trade.side - 'buy' or 'sell'
   * @param {number} trade.amount - Trade amount
   * @param {number} trade.price - Trade price
   * @param {string} [trade.userId] - User ID (optional, for logging)
   * @returns {Promise<Object>} { allowed: boolean, reason?: string, riskAssessment: Object }
   * 
   * @description
   * Main entry point for pre-trade risk checks.
   * 
   * Flow:
   * 1. Call Risk Agent's runRiskAssessment (internal, deterministic)
   * 2. Check if trade should be blocked based on recommendation/riskLevel
   * 3. Log decision to ai_decisions table (decision_type='risk_gate')
   * 4. Return { allowed, reason, riskAssessment }
   * 
   * Error Handling:
   * - DEMO mode: fail-open (allow trade, log error)
   * - LIVE mode: fail-closed (block trade, log error)
   */
  async checkRiskGate(trade) {
    const startTime = Date.now();
    
    try {
      // 1️⃣ Run Risk Agent assessment (uses real AI logic + deterministic fallback)
      const riskAssessment = await this.assessRisk(trade);
      
      // 2️⃣ Determine if trade should be blocked
      const shouldBlock = this.shouldBlockTrade(riskAssessment, trade);
      
      // 3️⃣ Log risk gate decision
      await this.logRiskGateDecision(trade, riskAssessment, shouldBlock, Date.now() - startTime);
      
      // 4️⃣ Return result
      if (shouldBlock) {
        return {
          allowed: false,
          reason: 'RISK_GATE_BLOCKED',
          message: `Trade blocked by Risk Agent: ${riskAssessment.riskLevel} risk (${riskAssessment.recommendation})`,
          riskAssessment
        };
      }
      
      return {
        allowed: true,
        riskAssessment
      };
      
    } catch (error) {
      logger.error('❌ Risk gate error:', error);
      
      // ⚠️  FAIL MODE: Demo vs Live
      const shouldFailOpen = this.tradingMode === 'demo';
      const allowed = shouldFailOpen;
      
      // Log error
      await this.logRiskGateError(trade, error, Date.now() - startTime, allowed);
      
      if (shouldFailOpen) {
        // DEMO: fail-open (allow trade with warning)
        logger.warn('⚠️  Risk gate error in DEMO mode: allowing trade (fail-open)');
        return {
          allowed: true,
          reason: 'RISK_GATE_ERROR_FAIL_OPEN',
          message: 'Risk assessment failed, trade allowed with warning (DEMO mode)',
          error: error.message
        };
      } else {
        // LIVE: fail-closed (block trade)
        logger.error('🚫 Risk gate error in LIVE mode: blocking trade (fail-closed)');
        return {
          allowed: false,
          reason: 'RISK_GATE_ERROR_FAIL_CLOSED',
          message: 'Risk assessment failed, trade blocked for safety (LIVE mode)',
          error: error.message
        };
      }
    }
  }

  /**
   * Assess risk for a trade using real Risk Agent logic
   * @param {Object} trade - Trade details
   * @returns {Promise<Object>} Risk assessment result
   * 
   * @description
   * Calls the real Risk Agent logic (services/risk-agent.js).
   * NO Math.random() - fully deterministic.
   * Uses AI when available, falls back to heuristics on timeout/error.
   */
  async assessRisk(trade) {
    // Calculate notional value
    const notional = trade.amount * (trade.price || 1);
    
    // Prepare input for risk assessment
    const inputData = {
      symbol: trade.symbol || trade.pair || 'UNKNOWN',
      action: trade.side?.toUpperCase() || 'BUY',
      amount: notional,
      price: trade.price
    };
    
    // 🔥 NEW: Call real Risk Agent logic (internal module)
    // This uses the same logic as /api/ai-agents/:id/run (agent-2)
    const result = await riskAgent.runRiskAssessment(inputData, RISK_AGENT_ID, 10000);
    
    // Add timestamp
    result.timestamp = new Date().toISOString();
    
    return result;
  }

  /**
   * Determine if trade should be blocked
   * @param {Object} riskAssessment - Risk assessment result
   * @param {Object} trade - Trade details
   * @returns {boolean} True if trade should be blocked
   * 
   * @description
   * Deterministic Blocking Rules (checked in order):
   * 
   * Rule 1: recommendation = 'REDUCE' → BLOCK
   *   - Risk Agent recommends reducing exposure
   *   
   * Rule 2: recommendation = 'REJECT' → BLOCK
   *   - Risk Agent explicitly rejects the trade
   *   
   * Rule 3: riskLevel = 'critical' → BLOCK
   *   - Risk level is at critical threshold
   *   
   * Rule 4: riskScore >= 80 → BLOCK (if available in _meta)
   *   - Numeric risk score exceeds critical threshold
   * 
   * Policy:
   * - DEMO mode: fail-open (allow on error)
   * - LIVE mode: fail-closed (block on error)
   * 
   * All blocking decisions are logged with:
   * - blocked: true/false
   * - blockingRules: array of triggered rules
   * - mode: demo/live
   * - isFallback: true if AI failed
   */
  shouldBlockTrade(riskAssessment, trade) {
    // Rule 1 & 2: Block on REDUCE/REJECT recommendations
    if (riskAssessment.recommendation === 'REDUCE') {
      logger.info(`🚫 Risk Gate: BLOCK due to recommendation=REDUCE`);
      return true;
    }
    
    if (riskAssessment.recommendation === 'REJECT') {
      logger.info(`🚫 Risk Gate: BLOCK due to recommendation=REJECT`);
      return true;
    }
    
    // Rule 3: Block on critical risk level
    if (riskAssessment.riskLevel === 'critical') {
      logger.info(`🚫 Risk Gate: BLOCK due to riskLevel=critical`);
      return true;
    }
    
    // Rule 4: Check numeric risk score (if available)
    const riskScore = riskAssessment.riskScore || riskAssessment._meta?.riskScore;
    if (riskScore !== undefined && riskScore >= 80) {
      logger.info(`🚫 Risk Gate: BLOCK due to riskScore=${riskScore} >= 80`);
      return true;
    }
    
    // All rules passed → ALLOW
    logger.info(`✅ Risk Gate: ALLOW (recommendation=${riskAssessment.recommendation}, riskLevel=${riskAssessment.riskLevel})`);
    return false;
  }

  /**
   * Log risk gate decision to database
   * @param {Object} trade - Trade details
   * @param {Object} riskAssessment - Risk assessment result
   * @param {boolean} blocked - Whether trade was blocked
   * @param {number} durationMs - Execution time in milliseconds
   * 
   * @description
   * Logs complete risk gate decision with metadata:
   * - blocked: true/false
   * - mode: demo/live
   * - recommendation: REDUCE/HOLD/INCREASE
   * - riskLevel: low/medium/high/critical
   * - isFallback: true if AI failed
   * - cached: false (risk gate never uses cache)
   * - riskScore: numeric risk score (if available)
   * - blockingRules: array of rules that triggered blocking
   */
  async logRiskGateDecision(trade, riskAssessment, blocked, durationMs) {
    try {
      // Determine which rules triggered blocking (for audit)
      const blockingRules = [];
      if (blocked) {
        if (riskAssessment.recommendation === 'REDUCE' || riskAssessment.recommendation === 'REJECT') {
          blockingRules.push(`recommendation=${riskAssessment.recommendation}`);
        }
        if (riskAssessment.riskLevel === 'critical') {
          blockingRules.push('riskLevel=critical');
        }
        const riskScore = riskAssessment.riskScore || riskAssessment._meta?.riskScore;
        if (riskScore !== undefined && riskScore >= 80) {
          blockingRules.push(`riskScore=${riskScore}>=80`);
        }
      }
      
      await this.db.query(`
        INSERT INTO ai_decisions (
          agent_id,
          user_id,
          decision_type,
          input_data,
          output_data,
          confidence,
          was_successful,
          execution_time_ms,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        RISK_AGENT_ID,
        trade.userId || null,
        'risk_gate',
        JSON.stringify({
          symbol: trade.symbol || trade.pair,
          side: trade.side,
          amount: trade.amount,
          price: trade.price
        }),
        JSON.stringify(riskAssessment),
        riskAssessment.confidence,
        true, // was_successful = true (gate executed successfully)
        durationMs,
        JSON.stringify({
          blocked,
          mode: this.tradingMode, // demo or live
          recommendation: riskAssessment.recommendation,
          riskLevel: riskAssessment.riskLevel,
          isFallback: riskAssessment._meta?.isFallback || false,
          cached: false, // risk gate never uses cache
          riskScore: riskAssessment.riskScore || riskAssessment._meta?.riskScore,
          blockingRules: blockingRules.length > 0 ? blockingRules : undefined,
          tradeType: 'manual'
        })
      ]);
      
      logger.info(`🛡️ Risk Gate [${this.tradingMode.toUpperCase()}]: Trade ${blocked ? 'BLOCKED ❌' : 'ALLOWED ✅'} (${riskAssessment.riskLevel} risk, ${riskAssessment.recommendation}, ${riskAssessment._meta?.isFallback ? 'fallback' : 'AI'})`);
      if (blocked && blockingRules.length > 0) {
        logger.info(`   Blocking Rules: ${blockingRules.join('; ')}`);
      }
    } catch (error) {
      logger.error('❌ Failed to log risk gate decision:', error);
      // Don't throw - logging failure shouldn't block trades
    }
  }

  /**
   * Log risk gate error to database
   * @param {Object} trade - Trade details
   * @param {Error} error - Error object
   * @param {number} durationMs - Execution time in milliseconds
   * @param {boolean} allowed - Whether trade was allowed despite error
   */
  async logRiskGateError(trade, error, durationMs, allowed) {
    try {
      await this.db.query(`
        INSERT INTO ai_decisions (
          agent_id,
          decision_type,
          input_data,
          output_data,
          was_successful,
          execution_time_ms,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        RISK_AGENT_ID,
        'risk_gate_error',
        JSON.stringify({
          symbol: trade.symbol || trade.pair,
          side: trade.side,
          amount: trade.amount
        }),
        JSON.stringify({ error: error.message }),
        false, // was_successful = false
        durationMs,
        JSON.stringify({
          errorType: error.name,
          failMode: this.tradingMode === 'demo' ? 'fail-open' : 'fail-closed',
          tradeAllowed: allowed,
          tradingMode: this.tradingMode
        })
      ]);
    } catch (logError) {
      logger.error('❌ Failed to log risk gate error:', logError);
    }
  }
}

// Export as ES6 default
export default RiskGateService;
