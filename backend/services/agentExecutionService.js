/**
 * Shared agent execution — used by API routes and scheduler/worker.
 */

import { query } from '../database/db.js';
import agentRegistry from './agents/registry.js';
import { evaluateExecutionPolicy, REASON } from './agentExecutionPolicyService.js';
import { webhookDispatcher } from './webhookDispatcher.js';
import { notifyAgentCompleted, notifyAgentFailed } from '../websocket/server.js';
import { logger } from './logger.js';
import { executeArbitrageAnalyticalScan } from './arbitrageRunService.js';

export async function writeExecutionAudit({
  userId = null,
  agentId,
  agentKey,
  action,
  allowed,
  reasonCode,
  effectiveMode,
  sideEffectsSuppressed,
  metadata = {},
}) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
      [
        userId,
        allowed ? `agent.execution.${action}` : `agent.execution.denied`,
        'ai_agent',
        agentId,
        JSON.stringify({
          agent_key: agentKey,
          reason_code: reasonCode,
          effective_mode: effectiveMode,
          side_effects_suppressed: sideEffectsSuppressed,
          ...metadata,
        }),
      ],
    );
  } catch (err) {
    logger.warn('Execution audit write failed:', err.message);
  }
}

/**
 * Execute agent with policy enforcement.
 * @returns {Promise<{ ok: boolean, policy: object, result?: object, error?: object }>}
 */
export async function executeAgentRun({
  agentId,
  symbol,
  timeframe = '1h',
  config = {},
  input = {},
  identityType = 'user',
  user = null,
  confirmLive = false,
  suppressExternalSideEffects = null,
}) {
  const agentResult = await query(
    `SELECT id, agent_key, name, type, status, config, metadata, is_enabled
     FROM ai_agents WHERE id = $1 LIMIT 1`,
    [agentId],
  );

  if (agentResult.rows.length === 0) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'AI agent not found' };
  }

  const agent = agentResult.rows[0];
  const mergedConfig = { ...(agent.config || {}), ...(config || {}) };
  const params = { symbol, timeframe, config: mergedConfig, input, action: input?.action };

  const policy = await evaluateExecutionPolicy({
    identityType,
    user,
    agentKey: agent.agent_key,
    agentEnabled: agent.is_enabled,
    params,
    confirmLive,
    action: 'agent.run',
  });

  const sideEffectsSuppressed =
    suppressExternalSideEffects ?? policy.sideEffectsSuppressed;

  await writeExecutionAudit({
    userId: user?.id || null,
    agentId: agent.id,
    agentKey: agent.agent_key,
    action: 'run',
    allowed: policy.allowed,
    reasonCode: policy.reasonCode,
    effectiveMode: policy.effectiveMode,
    sideEffectsSuppressed,
  });

  if (!policy.allowed) {
    return {
      ok: false,
      status: policy.reasonCode === REASON.CONFIRMATION_REQUIRED ? 409 : 403,
      code: policy.reasonCode,
      message: policy.suppressionReason || policy.reasonCode,
      policy: sanitizePolicy(policy),
    };
  }

  if (!agent.agent_key) {
    return { ok: false, status: 500, code: 'CONTRACT_ERROR', message: 'Agent missing agent_key' };
  }

  // Force dry-run params for order agent when side effects suppressed
  const runParams = {
    agent_id: agent.id,
    userId: user?.id,
    symbol,
    timeframe,
    config: mergedConfig,
    input: {
      ...input,
      dry_run: sideEffectsSuppressed || policy.effectiveMode !== 'live',
      effective_mode: policy.effectiveMode,
    },
  };

  let result;
  try {
    if (agent.agent_key === 'arbitrage') {
      const trigger = input?.trigger === 'scheduled' ? 'scheduled' : 'manual';
      const scanResult = await executeArbitrageAnalyticalScan({
        agentId: agent.id,
        trigger,
        user,
        configOverride: mergedConfig,
        runtimeMode: policy.effectiveMode,
        schedulerOwner: input?.schedulerOwner || 'titan-engine-worker',
      });

      if (scanResult.skipped) {
        return {
          ok: true,
          status: 200,
          agent,
          result: scanResult,
          policy: sanitizePolicy(policy),
          sideEffectsSuppressed,
          skipped: true,
        };
      }

      result = {
        ...(scanResult.raw || {}),
        scanRun: scanResult.scanRun,
        candidates: scanResult.candidates,
      };
    } else {
      result = await agentRegistry.runAgent(agent.agent_key, runParams);
    }
  } catch (error) {
    if (!sideEffectsSuppressed) {
      try {
        await webhookDispatcher.triggerAgentEvent(user?.id, 'agent.failed', {
          agent_id: agent.id,
          agent_key: agent.agent_key,
          error_message: error.message,
          timestamp: new Date().toISOString(),
        });
      } catch { /* ignore */ }
    }
    return {
      ok: false,
      status: 500,
      code: 'AI_ERROR',
      message: error.message,
      policy: sanitizePolicy(policy),
    };
  }

  // DB writes for decisions/metadata (audit trail — allowed in demo)
  if (agent.agent_key !== 'arbitrage') {
    await query(
      `INSERT INTO ai_decisions (agent_id, decision_type, confidence, input_data, output_data, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, NOW())`,
      [
        agent.id,
        result?.decision_type || 'analysis',
        typeof result?.confidence === 'number' ? result.confidence : 0.5,
        JSON.stringify({ symbol, timeframe, config: mergedConfig, input, policy: sanitizePolicy(policy) }),
        JSON.stringify({ ...(result || {}), _execution: { effective_mode: policy.effectiveMode, side_effects_suppressed: sideEffectsSuppressed } }),
      ],
    );
  }

  const newMetadata = {
    ...(agent.metadata || {}),
    last_result: result || null,
    last_error: null,
    last_run_at: new Date().toISOString(),
    last_effective_mode: policy.effectiveMode,
  };

  await query(
    `UPDATE ai_agents SET last_active_at = NOW(), updated_at = NOW(), metadata = $2::jsonb WHERE id = $1`,
    [agent.id, JSON.stringify(newMetadata)],
  );

  if (agent.agent_key === 'arbitrage') {
    return {
      ok: true,
      status: 200,
      agent,
      result,
      policy: sanitizePolicy(policy),
      sideEffectsSuppressed,
    };
  }

  if (!sideEffectsSuppressed) {
    try {
      await webhookDispatcher.triggerAgentEvent(user?.id, 'agent.completed', {
        agent_id: agent.id,
        agent_key: agent.agent_key,
        agent_name: agent.name,
        symbol,
        timeframe,
        effective_mode: policy.effectiveMode,
        timestamp: new Date().toISOString(),
      });
    } catch { /* ignore */ }

    try {
      notifyAgentCompleted(agent.id, agent.agent_key, user?.id, result, { symbol, timeframe });
    } catch { /* ignore */ }
  }

  return {
    ok: true,
    status: 200,
    agent,
    result,
    policy: sanitizePolicy(policy),
    sideEffectsSuppressed,
  };
}

export function sanitizePolicy(policy) {
  return {
    allowed: policy.allowed,
    reasonCode: policy.reasonCode,
    requestedMode: policy.requestedMode,
    effectiveMode: policy.effectiveMode,
    sideEffectClass: policy.sideEffectClass,
    sideEffectsAllowed: policy.sideEffectsAllowed,
    sideEffectsSuppressed: policy.sideEffectsSuppressed,
    suppressionReason: policy.suppressionReason,
    runtimeState: policy.runtimeState
      ? {
          deploymentEnabled: policy.runtimeState.deploymentEnabled,
          globalMode: policy.runtimeState.globalMode,
          killSwitchActive: policy.runtimeState.killSwitchActive,
          providerConnected: policy.runtimeState.providerConnected,
        }
      : undefined,
  };
}

export function buildExecutionResponse(execResult, uiResultTransformer) {
  if (!execResult.ok) {
    return {
      status: execResult.status,
      body: {
        ok: false,
        error: { code: execResult.code, message: execResult.message },
        policy: execResult.policy,
        indicators: [],
        result: { indicators: [] },
      },
    };
  }

  const uiResult = uiResultTransformer ? uiResultTransformer(execResult.result) : execResult.result;
  const policy = execResult.policy;

  return {
    status: 200,
    body: {
      ok: true,
      agent_id: execResult.agent.id,
      agent_key: execResult.agent.agent_key,
      policy,
      execution: {
        requested_mode: policy.requestedMode,
        effective_mode: policy.effectiveMode,
        side_effects_suppressed: execResult.sideEffectsSuppressed,
        suppression_reason: policy.suppressionReason,
      },
      ...uiResult,
      indicators: Array.isArray(uiResult?.indicators) ? uiResult.indicators : [],
      result: {
        ...uiResult,
        indicators: Array.isArray(uiResult?.indicators) ? uiResult.indicators : [],
      },
    },
  };
}
