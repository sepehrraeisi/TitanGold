/**
 * Risk Gate Service
 * Pre-trade risk assessment to block dangerous trades
 */

const RISK_AGENT_ID = '79bbdf0b-94a3-4cbc-adef-98c25f5ba1a7';

class RiskGateService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Check risk gate before executing trade
   * @param {Object} trade - Trade details
   * @param {string} trade.symbol - Trading pair (e.g., 'BTC/USDT')
   * @param {string} trade.side - 'buy' or 'sell'
   * @param {number} trade.amount - Trade amount
   * @param {number} trade.price - Trade price
   * @param {string} trade.userId - User ID (optional, for logging)
   * @returns {Promise<Object>} { allowed: boolean, reason?: string, riskAssessment: Object }
   */
  async checkRiskGate(trade) {
    const startTime = Date.now();
    
    try {
      // Call Risk Agent's run logic directly (internal call, no HTTP)
      const riskAssessment = await this.assessRisk(trade);
      
      // Determine if trade should be blocked
      const shouldBlock = this.shouldBlockTrade(riskAssessment);
      
      // Log risk gate decision
      await this.logRiskGateDecision(trade, riskAssessment, shouldBlock, Date.now() - startTime);
      
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
      
      // FAIL-OPEN: If risk gate fails, allow trade but log the error
      // This prevents risk system failures from blocking all trading
      await this.logRiskGateError(trade, error, Date.now() - startTime);
      
      return {
        allowed: true,
        reason: 'RISK_GATE_ERROR',
        message: 'Risk assessment failed, trade allowed with warning',
        error: error.message
      };
    }
  }

  /**
   * Assess risk for a trade
   * Calls Risk Agent logic directly (no HTTP to avoid auth issues)
   */
  async assessRisk(trade) {
    // Calculate notional value
    const notional = trade.amount * (trade.price || 1);
    
    // Prepare input for risk assessment
    const inputData = {
      symbol: trade.symbol || trade.pair || 'UNKNOWN',
      action: trade.side?.toUpperCase() || 'BUY',
      amount: notional
    };
    
    // Query ai_agents for Risk Agent config
    const agentResult = await this.db.query(
      'SELECT config FROM ai_agents WHERE id = $1',
      [RISK_AGENT_ID]
    );
    
    if (agentResult.rows.length === 0) {
      throw new Error('Risk Agent not found');
    }
    
    const config = agentResult.rows[0].config;
    
    // Perform risk assessment logic (simplified version)
    // In production, this would use the full Risk Agent logic
    const riskScore = this.calculateRiskScore(trade, config);
    const riskLevel = this.getRiskLevel(riskScore);
    const recommendation = this.getRecommendation(riskLevel, trade);
    
    return {
      recommendation,
      confidence: 75, // Base confidence
      riskLevel,
      riskScore,
      timestamp: new Date().toISOString(),
      ...inputData
    };
  }

  /**
   * Calculate risk score based on trade and config
   */
  calculateRiskScore(trade, config) {
    let score = 30; // Base risk
    
    // Check position size against limits
    const notional = trade.amount * (trade.price || 1);
    const maxPositionSize = config?.parameters?.position_limit || 10000;
    
    if (notional > maxPositionSize) {
      score += 30; // High risk for oversized positions
    }
    
    // Add random market volatility factor
    score += Math.random() * 20;
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get risk level from score
   */
  getRiskLevel(score) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Get recommendation based on risk level
   */
  getRecommendation(riskLevel, trade) {
    if (riskLevel === 'critical') return 'REDUCE';
    if (riskLevel === 'high') return 'REDUCE';
    if (riskLevel === 'medium') return 'HOLD';
    return 'HOLD';
  }

  /**
   * Determine if trade should be blocked
   */
  shouldBlockTrade(riskAssessment) {
    // Block if recommendation is REDUCE or REJECT
    if (riskAssessment.recommendation === 'REDUCE' || 
        riskAssessment.recommendation === 'REJECT') {
      return true;
    }
    
    // Block if risk level is critical
    if (riskAssessment.riskLevel === 'critical') {
      return true;
    }
    
    return false;
  }

  /**
   * Log risk gate decision to database
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
          riskLevel: riskAssessment.riskLevel
        })
      ]);
      
      console.log(`🛡️ Risk Gate: Trade ${blocked ? 'BLOCKED' : 'ALLOWED'} (${riskAssessment.riskLevel} risk)`);
    } catch (error) {
      console.error('❌ Failed to log risk gate decision:', error);
    }
  }

  /**
   * Log risk gate error
   */
  async logRiskGateError(trade, error, durationMs) {
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
          failOpen: true
        })
      ]);
    } catch (logError) {
      console.error('❌ Failed to log risk gate error:', logError);
    }
  }
}

export default RiskGateService;
