/**
 * @fileoverview Risk Gate Service
 * @module services/risk-gate
 * @description
 * Pre-trade risk assessment to block dangerous trades.
 * Fail policy is derived from canonical runtime SSOT — never TRADING_MODE env.
 */

import * as riskAgent from './risk-agent.js';
import { logger } from '../services/logger.js';
import { getEffectiveGlobalMode, isKillSwitchActive } from './runtimeExecutionStateService.js';

const RISK_AGENT_ID = '79bbdf0b-94a3-4cbc-adef-98c25f5ba1a7';

class RiskGateService {
  /**
   * @param {Object} db - Database connection (query method)
   * @param {{ tradingMode?: string }} [options] - Test injection only; production ignores env fallbacks
   */
  constructor(db, options = {}) {
    this.db = db;
    this._injectedMode = options.tradingMode || null;
    logger.info('🛡️ RiskGateService initialized (runtime SSOT fail policy)');
  }

  /**
   * Resolve fail-open vs fail-closed from canonical runtime state.
   * Unknown/unavailable runtime → fail-closed (treat as kill switch active).
   */
  async resolveFailPolicy() {
    if (this._injectedMode === 'live') {
      return { label: 'injected_live', failClosedOnError: true, isLiveCapable: true };
    }
    if (this._injectedMode === 'demo') {
      return { label: 'injected_demo', failClosedOnError: false, isLiveCapable: false };
    }

    try {
      const [mode, killSwitch] = await Promise.all([
        getEffectiveGlobalMode(),
        isKillSwitchActive(),
      ]);
      if (killSwitch) {
        return { label: 'kill_switch', failClosedOnError: true, isLiveCapable: false };
      }
      if (mode === 'live') {
        return { label: 'live', failClosedOnError: true, isLiveCapable: true };
      }
      return { label: 'demo', failClosedOnError: false, isLiveCapable: false };
    } catch (error) {
      logger.warn('⚠️ Runtime SSOT unavailable for risk gate — fail-closed:', error.message);
      return { label: 'unknown', failClosedOnError: true, isLiveCapable: false };
    }
  }

  async checkRiskGate(trade) {
    const startTime = Date.now();
    const policy = await this.resolveFailPolicy();

    try {
      const riskAssessment = await this.assessRisk(trade);
      const shouldBlock = this.shouldBlockTrade(riskAssessment, trade);
      await this.logRiskGateDecision(trade, riskAssessment, shouldBlock, Date.now() - startTime, policy);

      if (shouldBlock) {
        return {
          allowed: false,
          reason: 'RISK_GATE_BLOCKED',
          message: `Trade blocked by Risk Agent: ${riskAssessment.riskLevel} risk (${riskAssessment.recommendation})`,
          riskAssessment,
        };
      }

      return { allowed: true, riskAssessment };
    } catch (error) {
      logger.error('❌ Risk gate error:', error);

      const allowed = !policy.failClosedOnError;
      await this.logRiskGateError(trade, error, Date.now() - startTime, allowed, policy);

      if (allowed) {
        logger.warn(`⚠️ Risk gate error in ${policy.label}: allowing trade (fail-open demo sim)`);
        return {
          allowed: true,
          reason: 'RISK_GATE_ERROR_FAIL_OPEN',
          message: 'Risk assessment failed, trade allowed with warning (demo simulation)',
          error: error.message,
        };
      }

      logger.error(`🚫 Risk gate error in ${policy.label}: blocking trade (fail-closed)`);
      return {
        allowed: false,
        reason: 'RISK_GATE_ERROR_FAIL_CLOSED',
        message: 'Risk assessment failed, trade blocked for safety',
        error: error.message,
      };
    }
  }

  async assessRisk(trade) {
    const notional = trade.amount * (trade.price || 1);
    const inputData = {
      symbol: trade.symbol || trade.pair || 'UNKNOWN',
      action: trade.side?.toUpperCase() || 'BUY',
      amount: notional,
      price: trade.price,
    };
    const result = await riskAgent.runRiskAssessment(inputData, RISK_AGENT_ID, 10000);
    result.timestamp = new Date().toISOString();
    return result;
  }

  shouldBlockTrade(riskAssessment) {
    if (riskAssessment.recommendation === 'REDUCE' || riskAssessment.recommendation === 'REJECT') {
      return true;
    }
    if (riskAssessment.riskLevel === 'critical') {
      return true;
    }
    const riskScore = riskAssessment.riskScore || riskAssessment._meta?.riskScore;
    if (riskScore !== undefined && riskScore >= 80) {
      return true;
    }
    return false;
  }

  async logRiskGateDecision(trade, riskAssessment, blocked, durationMs, policy) {
    try {
      const blockingRules = [];
      if (blocked) {
        if (riskAssessment.recommendation === 'REDUCE' || riskAssessment.recommendation === 'REJECT') {
          blockingRules.push(`recommendation=${riskAssessment.recommendation}`);
        }
        if (riskAssessment.riskLevel === 'critical') blockingRules.push('riskLevel=critical');
        const riskScore = riskAssessment.riskScore || riskAssessment._meta?.riskScore;
        if (riskScore !== undefined && riskScore >= 80) blockingRules.push(`riskScore=${riskScore}>=80`);
      }

      await this.db.query(`
        INSERT INTO ai_decisions (
          agent_id, user_id, decision_type, input_data, output_data,
          confidence, was_successful, execution_time_ms, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        RISK_AGENT_ID,
        trade.userId || null,
        'risk_gate',
        JSON.stringify({ symbol: trade.symbol || trade.pair, side: trade.side, amount: trade.amount, price: trade.price }),
        JSON.stringify(riskAssessment),
        riskAssessment.confidence,
        true,
        durationMs,
        JSON.stringify({
          blocked,
          runtimePolicy: policy.label,
          failClosedOnError: policy.failClosedOnError,
          recommendation: riskAssessment.recommendation,
          riskLevel: riskAssessment.riskLevel,
          isFallback: riskAssessment._meta?.isFallback || false,
          blockingRules: blockingRules.length > 0 ? blockingRules : undefined,
          tradeType: 'manual',
        }),
      ]);
    } catch (error) {
      logger.error('❌ Failed to log risk gate decision:', error);
    }
  }

  async logRiskGateError(trade, error, durationMs, allowed, policy) {
    try {
      await this.db.query(`
        INSERT INTO ai_decisions (
          agent_id, decision_type, input_data, output_data,
          was_successful, execution_time_ms, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        RISK_AGENT_ID,
        'risk_gate_error',
        JSON.stringify({ symbol: trade.symbol || trade.pair, side: trade.side, amount: trade.amount }),
        JSON.stringify({ error: error.message }),
        false,
        durationMs,
        JSON.stringify({
          errorType: error.name,
          runtimePolicy: policy.label,
          failMode: policy.failClosedOnError ? 'fail-closed' : 'fail-open',
          tradeAllowed: allowed,
        }),
      ]);
    } catch (logError) {
      logger.error('❌ Failed to log risk gate error:', logError);
    }
  }
}

export default RiskGateService;
