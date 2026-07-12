/**
 * Centralized agent execution policy — user and system contexts.
 * Admin/trader capability alone never bypasses runtime gates.
 */

import { query } from '../database/db.js';
import { roleHasCapability, CAP } from './capabilities.js';
import { getAgentCapability, isLiveCapableAgent, SIDE_EFFECT_CLASS } from './agentCapabilityRegistry.js';
import {
  getRuntimeExecutionState,
  getEffectiveGlobalMode,
  isKillSwitchActive,
  isDeploymentEngineEnabled,
} from './runtimeExecutionStateService.js';
import { logger } from './logger.js';

export const REASON = Object.freeze({
  ALLOWED: 'ALLOWED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  CAPABILITY_DENIED: 'CAPABILITY_DENIED',
  AGENT_DISABLED: 'AGENT_DISABLED',
  AGENT_UNCLASSIFIED: 'AGENT_UNCLASSIFIED',
  KILL_SWITCH_ACTIVE: 'KILL_SWITCH_ACTIVE',
  GLOBAL_DEMO: 'GLOBAL_DEMO',
  USER_DEMO: 'USER_DEMO',
  LIVE_PERMISSION_DENIED: 'LIVE_PERMISSION_DENIED',
  PROVIDER_DISCONNECTED: 'PROVIDER_DISCONNECTED',
  DEPLOYMENT_DISABLED: 'DEPLOYMENT_DISABLED',
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
  RUNTIME_BLOCKED: 'RUNTIME_BLOCKED',
});

async function getUserRequestedMode(userId) {
  if (!userId) return 'demo';
  try {
    const result = await query(
      `SELECT preferences->'trading'->>'mode' AS mode
       FROM user_preferences
       WHERE user_id = $1 AND is_deleted = FALSE
       LIMIT 1`,
      [userId],
    );
    const mode = result.rows[0]?.mode;
    return mode === 'live' ? 'live' : 'demo';
  } catch (err) {
    logger.warn('Failed to read user trading mode, defaulting demo:', err.message);
    return 'demo';
  }
}

async function isBrokerConnected(userId) {
  if (!userId) return false;
  try {
    const result = await query(
      `SELECT COUNT(*)::int AS c
       FROM exchange_connections
       WHERE user_id = $1 AND is_active = TRUE AND api_key IS NOT NULL`,
      [userId],
    );
    return (result.rows[0]?.c || 0) > 0;
  } catch {
    return false;
  }
}

function requiresLiveSideEffects(agentKey, params = {}) {
  const cap = getAgentCapability(agentKey);
  if (cap.sideEffectClass === SIDE_EFFECT_CLASS.ORDER_LIVE) {
    const action = params?.action || params?.input?.action;
    if (action === 'place_order' || action === 'cancel_order' || action === 'modify_order') {
      return true;
    }
  }
  if (cap.sideEffectClass === SIDE_EFFECT_CLASS.PORTFOLIO_MUTATION) {
    return params?.apply === true || params?.input?.apply === true;
  }
  return cap.liveCapable && (
    cap.sideEffectClass === SIDE_EFFECT_CLASS.ORDER_LIVE ||
    cap.sideEffectClass === SIDE_EFFECT_CLASS.EXTERNAL_DELIVERY
  );
}

/**
 * @param {object} input
 * @param {'user'|'system'} input.identityType
 * @param {object} [input.user]
 * @param {string} input.agentKey
 * @param {boolean} [input.agentEnabled=true]
 * @param {object} [input.params={}]
 * @param {boolean} [input.confirmLive=false]
 * @param {string} [input.action='agent.run']
 */
export async function evaluateExecutionPolicy({
  identityType = 'user',
  user = null,
  agentKey,
  agentEnabled = true,
  params = {},
  confirmLive = false,
  action = 'agent.run',
}) {
  const agentCap = getAgentCapability(agentKey);
  const sideEffectClass = agentCap.sideEffectClass;
  const liveSideEffectsRequested = requiresLiveSideEffects(agentKey, params);

  const runtimeState = await getRuntimeExecutionState();
  const globalMode = await getEffectiveGlobalMode();
  const killSwitchActive = runtimeState.killSwitchActive === true;
  const deploymentEnabled = isDeploymentEngineEnabled();

  let requestedMode = 'demo';
  let role = null;
  let providerConnected = false;

  if (identityType === 'user') {
    if (!user?.id) {
      return buildDecision({
        allowed: false,
        reasonCode: REASON.UNAUTHENTICATED,
        requestedMode: 'demo',
        effectiveMode: 'demo',
        sideEffectClass,
        sideEffectsAllowed: false,
        sideEffectsSuppressed: true,
        suppressionReason: REASON.UNAUTHENTICATED,
        identityType,
        role: null,
        runtimeState: { deploymentEnabled, globalMode, killSwitchActive, providerConnected: false },
      });
    }
    role = user.role;
    requestedMode = await getUserRequestedMode(user.id);
    providerConnected = await isBrokerConnected(user.id);

    const readOnly = action === 'agent.read';
    const configure = action.startsWith('agent.configure') || action.startsWith('agent.enable');
    const executeCap = liveSideEffectsRequested
      ? CAP.AI_AGENT_EXECUTE_LIVE_CAPABLE
      : CAP.AI_AGENT_EXECUTE_SAFE;

    let requiredCap = executeCap;
    if (readOnly) requiredCap = CAP.AI_AGENT_READ;
    if (configure) requiredCap = action.includes('enable') ? CAP.AI_AGENT_ENABLE_DISABLE : CAP.AI_AGENT_CONFIGURE;

    if (!roleHasCapability(role, requiredCap)) {
      return buildDecision({
        allowed: false,
        reasonCode: REASON.CAPABILITY_DENIED,
        requestedMode,
        effectiveMode: 'demo',
        sideEffectClass,
        sideEffectsAllowed: false,
        sideEffectsSuppressed: true,
        suppressionReason: REASON.CAPABILITY_DENIED,
        identityType,
        role,
        capability: requiredCap,
        runtimeState: { deploymentEnabled, globalMode, killSwitchActive, providerConnected },
      });
    }
  } else {
    // System context — still obeys global runtime, not user preference
    requestedMode = globalMode === 'live' ? 'live' : 'demo';
    role = 'system';
    providerConnected = true; // system checks broker at execution layer if needed
  }

  if (!agentEnabled) {
    return buildDecision({
      allowed: false,
      reasonCode: REASON.AGENT_DISABLED,
      requestedMode,
      effectiveMode: 'demo',
      sideEffectClass,
      sideEffectsAllowed: false,
      sideEffectsSuppressed: true,
      suppressionReason: REASON.AGENT_DISABLED,
      identityType,
      role,
      runtimeState: { deploymentEnabled, globalMode, killSwitchActive, providerConnected },
    });
  }

  if (sideEffectClass === SIDE_EFFECT_CLASS.UNCLASSIFIED) {
    return buildDecision({
      allowed: false,
      reasonCode: REASON.AGENT_UNCLASSIFIED,
      requestedMode,
      effectiveMode: 'demo',
      sideEffectClass,
      sideEffectsAllowed: false,
      sideEffectsSuppressed: true,
      suppressionReason: REASON.AGENT_UNCLASSIFIED,
      identityType,
      role,
      runtimeState: { deploymentEnabled, globalMode, killSwitchActive, providerConnected },
    });
  }

  if (killSwitchActive) {
    const allowDryRun = !liveSideEffectsRequested;
    return buildDecision({
      allowed: allowDryRun,
      reasonCode: REASON.KILL_SWITCH_ACTIVE,
      requestedMode,
      effectiveMode: 'dry_run',
      sideEffectClass,
      sideEffectsAllowed: false,
      sideEffectsSuppressed: true,
      suppressionReason: REASON.KILL_SWITCH_ACTIVE,
      identityType,
      role,
      runtimeState: { deploymentEnabled, globalMode, killSwitchActive, providerConnected },
    });
  }

  // Determine effective mode
  let effectiveMode = 'dry_run';
  let sideEffectsAllowed = false;
  let sideEffectsSuppressed = true;
  let suppressionReason = REASON.GLOBAL_DEMO;
  let allowed = true;
  let reasonCode = REASON.ALLOWED;

  const wantsLive =
    liveSideEffectsRequested &&
    (identityType === 'system' ? globalMode === 'live' : requestedMode === 'live');

  if (wantsLive) {
    if (globalMode !== 'live') {
      effectiveMode = 'dry_run';
      sideEffectsSuppressed = true;
      suppressionReason = REASON.GLOBAL_DEMO;
      allowed = true; // safe analysis still runs
    } else if (identityType === 'user' && !roleHasCapability(role, CAP.LIVE_TRADING)) {
      allowed = false;
      reasonCode = REASON.LIVE_PERMISSION_DENIED;
      suppressionReason = REASON.LIVE_PERMISSION_DENIED;
    } else if (identityType === 'user' && !providerConnected) {
      allowed = liveSideEffectsRequested ? false : true;
      reasonCode = liveSideEffectsRequested ? REASON.PROVIDER_DISCONNECTED : REASON.ALLOWED;
      suppressionReason = REASON.PROVIDER_DISCONNECTED;
      effectiveMode = 'dry_run';
    } else if (liveSideEffectsRequested && !confirmLive && identityType === 'user') {
      allowed = false;
      reasonCode = REASON.CONFIRMATION_REQUIRED;
      suppressionReason = REASON.CONFIRMATION_REQUIRED;
      effectiveMode = 'dry_run';
    } else if (isLiveCapableAgent(agentKey) && liveSideEffectsRequested) {
      effectiveMode = 'live';
      sideEffectsAllowed = true;
      sideEffectsSuppressed = false;
      suppressionReason = undefined;
    } else {
      effectiveMode = 'dry_run';
      sideEffectsSuppressed = true;
      suppressionReason = REASON.USER_DEMO;
    }
  } else {
    // Safe / demo path — external side effects suppressed
    effectiveMode = requestedMode === 'live' && globalMode === 'live' ? 'demo' : 'dry_run';
    if (sideEffectClass === SIDE_EFFECT_CLASS.WEBHOOK ||
        sideEffectClass === SIDE_EFFECT_CLASS.EXTERNAL_DELIVERY ||
        sideEffectClass === SIDE_EFFECT_CLASS.ORDER_LIVE) {
      sideEffectsSuppressed = true;
      suppressionReason = liveSideEffectsRequested ? REASON.USER_DEMO : REASON.GLOBAL_DEMO;
    } else {
      // Analysis + DB audit writes allowed in demo/dry_run
      sideEffectsSuppressed = false;
      sideEffectsAllowed = false; // not live external
      suppressionReason = undefined;
    }
  }

  return buildDecision({
    allowed,
    reasonCode,
    requestedMode,
    effectiveMode,
    sideEffectClass,
    sideEffectsAllowed,
    sideEffectsSuppressed,
    suppressionReason,
    identityType,
    role,
    runtimeState: { deploymentEnabled, globalMode, killSwitchActive, providerConnected },
  });
}

function buildDecision(fields) {
  return {
    allowed: fields.allowed,
    reasonCode: fields.reasonCode,
    requestedMode: fields.requestedMode,
    effectiveMode: fields.effectiveMode,
    sideEffectClass: fields.sideEffectClass,
    sideEffectsAllowed: fields.sideEffectsAllowed,
    sideEffectsSuppressed: fields.sideEffectsSuppressed,
    suppressionReason: fields.suppressionReason,
    identityType: fields.identityType,
    role: fields.role,
    capability: fields.capability,
    runtimeState: fields.runtimeState,
  };
}

export async function evaluateConfigurePolicy(user, action = 'agent.configure') {
  if (!user?.id) {
    return { allowed: false, reasonCode: REASON.UNAUTHENTICATED };
  }
  const cap = action.includes('enable') ? CAP.AI_AGENT_ENABLE_DISABLE : CAP.AI_AGENT_CONFIGURE;
  if (!roleHasCapability(user.role, cap)) {
    return { allowed: false, reasonCode: REASON.CAPABILITY_DENIED, capability: cap };
  }
  return { allowed: true, reasonCode: REASON.ALLOWED, capability: cap };
}

export async function evaluateReadPolicy(user) {
  if (!user?.id) {
    return { allowed: false, reasonCode: REASON.UNAUTHENTICATED };
  }
  if (!roleHasCapability(user.role, CAP.AI_AGENT_READ)) {
    return { allowed: false, reasonCode: REASON.CAPABILITY_DENIED };
  }
  return { allowed: true, reasonCode: REASON.ALLOWED };
}
