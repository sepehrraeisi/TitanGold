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

const RISK_AGENT_ID = '79bbdf0b-94a3-4cbc-adef-98c25f5ba1a7';

class RiskGateService {
  /**
   * @param {Object} db - Database connection (query method)
   * @param {string} [tradingMode='demo'] - Trading mode: 'demo' or 'live'
   */
  constructor(db, tradingMode = 'demo') {
    this.db = db;
    this.tradingMode = tradingMode || process.env.TRADING_MODE || 'demo';
    
    console.log(`🛡️ RiskGateService initialized (mode: ${this.tradingMode})`);
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
      console.error('❌ Risk gate error:', error);
      
      // ⚠️  FAIL MODE: Demo vs Live
      const shouldFailOpen = this.tradingMode === 'demo';
      const allowed = shouldFailOpen;
      
      // Log error
      await this.logRiskGateError(trade, error, Date.now() - startTime, allowed);
      
      if (shouldFailOpen) {
        // DEMO: fail-open (allow trade with warning)
        console.warn('⚠️  Risk gate error in DEMO mode: allowing trade (fail-open)');
        return {
          allowed: true,
          reason: 'RISK_GATE_ERROR_FAIL_OPEN',
          message: 'Risk assessment failed, trade allowed with warning (DEMO mode)',
          error: error.message
        };
      } else {
        // LIVE: fail-closed (block trade)
        console.error('🚫 Risk gate error in LIVE mode: blocking trade (fail-closed)');
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
   * Blocking Rules:
   * 1. recommendation = 'REDUCE' → BLOCK
   * 2. recommendation = 'REJECT' → BLOCK
   * 3. riskLevel = 'critical' → BLOCK
   * 
   * Additional heuristics (position limits):
   * 4. Trade size > position_limit → BLOCK (if configured)
   */
  shouldBlockTrade(riskAssessment, trade) {
    // Rule 1 & 2: Block on REDUCE/REJECT recommendations
    if (riskAssessment.recommendation === 'REDUCE' || 
        riskAssessment.recommendation === 'REJECT') {
      console.log(`🚫 Risk Gate: BLOCK due to recommendation=${riskAssessment.recommendation}`);
      return true;
    }
    
    // Rule 3: Block on critical risk level
    if (riskAssessment.riskLevel === 'critical') {
      console.log(`🚫 Risk Gate: BLOCK due to riskLevel=critical`);
      return true;
    }
    
    // Rule 4: Check position limit (optional, from metadata)
    const riskScore = riskAssessment._meta?.riskScore;
    if (riskScore !== undefined && riskScore >= 80) {
      console.log(`🚫 Risk Gate: BLOCK due to riskScore=${riskScore} >= 80`);
      return true;
    }
    
    return false;
  }

  /**
   * Log risk gate decision to database
   * @param {Object} trade - Trade details
   * @param {Object} riskAssessment - Risk assessment result
   * @param {boolean} blocked - Whether trade was blocked
   * @param {number} durationMs - Execution time in milliseconds
   */
  async logRiskGateDecision(trade, riskAssessment, blocked, durationMs) {
    try {
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
          tradeType: 'manual',
          recommendation: riskAssessment.recommendation,
          riskLevel: riskAssessment.riskLevel,
          isFallback: riskAssessment._meta?.isFallback || false,
          tradingMode: this.tradingMode
        })
      ]);
      
      console.log(`🛡️ Risk Gate: Trade ${blocked ? 'BLOCKED ❌' : 'ALLOWED ✅'} (${riskAssessment.riskLevel} risk, ${riskAssessment.recommendation})`);
    } catch (error) {
      console.error('❌ Failed to log risk gate decision:', error);
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
      console.error('❌ Failed to log risk gate error:', logError);
    }
  }
}

// Export as ES6 default
export default RiskGateService;
