import {
  evaluateSourceAccess,
  listRegistryAgents,
  logSourceAccessConfigUpdated,
  resolveAgentKey,
  RUNTIME_AGENT_KEYS,
  sourceAccessAllowedSql,
  validateAgentKeys,
} from '../services/sourceAccessControlService.js';
import { query } from '../database/db.js';
import { logger } from '../services/logger.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function clean(value) {
  const v = firstValue(value);
  return v == null || String(v).trim() === '' ? null : String(v).trim();
}

function deriveRuntimeAgentKey(req) {
  const path = req.originalUrl || req.url || '';
  if (
    path.includes('/data-hub/telegram-publishers/') ||
    path.includes('/data-sources/publish-telegram')
  ) {
    return RUNTIME_AGENT_KEYS.PUBLISHER;
  }
  return null;
}

export function extractAccessControlContext(req) {
  const body = req.body || {};
  const queryParams = req.query || {};
  const params = req.params || {};
  const context = req.context || {};

  const agentKey =
    clean(req.headers['x-agent-key']) ||
    clean(req.headers['x-agentkey']) ||
    clean(req.headers['x-titan-agent-key']) ||
    clean(body.agentKey) ||
    clean(body.agent_key) ||
    clean(queryParams.agentKey) ||
    clean(queryParams.agent_key) ||
    clean(context.agentKey) ||
    clean(context.agent_key) ||
    deriveRuntimeAgentKey(req);

  const sourceId =
    clean(body.source_id) ||
    clean(body.sourceId) ||
    clean(body.input?.source_id) ||
    clean(body.input?.sourceId) ||
    clean(body.config?.source_id) ||
    clean(body.config?.sourceId) ||
    clean(queryParams.source_id) ||
    clean(queryParams.sourceId) ||
    clean(params.source_id) ||
    clean(params.sourceId);

  const dataType =
    clean(body.data_type) ||
    clean(body.dataType) ||
    clean(body.input?.data_type) ||
    clean(body.input?.dataType) ||
    clean(queryParams.data_type) ||
    clean(queryParams.dataType);

  return { agentKey, sourceId, dataType };
}

async function resolveAgentKeyFromRoute(req, currentAgentKey) {
  if (currentAgentKey && currentAgentKey !== 'unknown') return currentAgentKey;
  const match = String(req.originalUrl || '').match(/\/api\/v1\/ai-agents\/([^/?]+)\/run(?:-v2)?/);
  const id = match?.[1];
  if (!id || !UUID_RE.test(id)) return currentAgentKey || 'unknown';

  try {
    const result = await query('SELECT agent_key FROM ai_agents WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0]?.agent_key || currentAgentKey || 'unknown';
  } catch (error) {
    logger.warn('Access gateway agent lookup failed', { id, error: error.message });
    return currentAgentKey || 'unknown';
  }
}

export function markAccessControlChecked(req, decision, context) {
  req.accessControl = {
    enforced: true,
    allowed: decision.allowed,
    sourceId: context.sourceId,
    agentKey: context.agentKey,
    dataType: context.dataType || null,
    reason: decision.reason,
    policy: decision.policy,
  };
}

export async function enforceSourceAccess(req, {
  sourceId,
  agentKey,
  dataType = null,
  action,
  userId,
} = {}) {
  if (!sourceId) return { allowed: true, reason: 'no_source_id' };

  const context = {
    sourceId,
    agentKey: agentKey || 'unknown',
    dataType,
  };

  const decision = await evaluateSourceAccess({
    sourceId: context.sourceId,
    agentKey: context.agentKey,
    userId: userId || req?.user?.id,
    action: action || req?.route?.path || req?.originalUrl || 'access_control_gateway',
    dataType: context.dataType,
  });

  if (req) markAccessControlChecked(req, decision, context);
  return decision;
}

export function buildAllowedAccessControl({ sourceId, agentKey, dataType = null, reason = 'allowed' }) {
  return {
    enforced: true,
    allowed: true,
    sourceId,
    agentKey,
    dataType,
    reason,
    policy: 'gateway',
  };
}

export async function filterAllowedAgentsThroughGateway(
  sourceId,
  agentKeys,
  normalizedData = {},
  { userId = null, action = 'pipeline_route' } = {},
) {
  const dataType = normalizedData.data_type || normalizedData.type || null;
  const allowed = [];

  for (const agentKey of agentKeys) {
    const decision = await enforceSourceAccess(null, {
      sourceId,
      agentKey,
      userId,
      action,
      dataType,
    });
    if (decision.allowed) allowed.push(agentKey);
  }

  return allowed;
}

export function assertAccessControlGateway({
  accessControl,
  sourceId,
  agentKey,
  message = 'Source access denied by ACL',
}) {
  if (!sourceId) {
    const err = new Error('source_id is required');
    err.status = 400;
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (
    !accessControl?.enforced ||
    accessControl.allowed !== true ||
    accessControl.sourceId !== sourceId ||
    accessControl.agentKey !== agentKey
  ) {
    const err = new Error(message);
    err.status = 403;
    err.code = 'SOURCE_ACCESS_DENIED';
    throw err;
  }
}

export async function accessControlGateway(req, res, next) {
  try {
    const context = extractAccessControlContext(req);
    if (!context.sourceId) {
      return next();
    }

    context.agentKey = await resolveAgentKeyFromRoute(req, context.agentKey || 'unknown');
    const decision = await enforceSourceAccess(req, {
      ...context,
      action: req.route?.path || req.originalUrl || 'access_control_gateway',
    });

    if (!decision.allowed) {
      return res.status(403).json({
        error: 'SOURCE_ACCESS_DENIED',
        code: 'SOURCE_ACCESS_DENIED',
        reason: decision.reason,
      });
    }

    return next();
  } catch (error) {
    logger.error('Access control gateway failed', {
      error: error.message,
      path: req.originalUrl,
    });
    return res.status(error.status || 500).json({
      error: error.code || 'ACCESS_CONTROL_GATEWAY_ERROR',
      code: error.code || 'ACCESS_CONTROL_GATEWAY_ERROR',
      reason: error.message,
    });
  }
}

export default accessControlGateway;
export {
  listRegistryAgents,
  logSourceAccessConfigUpdated,
  resolveAgentKey,
  RUNTIME_AGENT_KEYS,
  sourceAccessAllowedSql,
  validateAgentKeys,
};
