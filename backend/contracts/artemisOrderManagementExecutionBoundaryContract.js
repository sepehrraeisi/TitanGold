/**
 * Artemis Core Stage 7.3.2.c.6 — Order Management Execution Boundary.
 *
 * PURE / LIBRARY-ONLY contract.
 *
 * This slice validates an Execution Intent after C.1–C.5 evidence exists.
 * It does not place, cancel, modify, sign, transmit, retry, or reconcile
 * real financial orders and does not call providers, DB, Redis, LLM, HTTP,
 * or runtime mutation surfaces.
 */

import {
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';
import {
  CAPABILITY_STATE,
  CONTROL_OUTCOME,
  LIQUIDITY_GATE_OUTCOME,
  PORTFOLIO_GATE_OUTCOME,
  RISK_GATE_OUTCOME,
  RUNTIME_GATE_OUTCOME,
} from './artemisControlChainContract.js';

export const EXECUTION_INTENT_STAGE = '7.3.2.c.6';
export const EXECUTION_INTENT_SCHEMA_VERSION = '1.0.0';
export const EXECUTION_INTENT_CONTRACT_VERSION = 'artemis-order-management-execution-boundary-1.0.0';
export const EXECUTION_INTENT_POLICY_VERSION = 'stage7-3-2-c6-order-management-1.0.0';
export const EXECUTION_INTENT_WRITER = 'artemisOrderManagementExecutionBoundaryContract';
export const EXECUTION_INTENT_METHOD_KEY = 'validate_execution_intent_fail_closed';

export const EXECUTION_INTENT_STATUS = Object.freeze({
  ACCEPTED: 'accepted',
  BLOCKED: 'blocked',
  EXPIRED: 'expired',
  DUPLICATE: 'duplicate',
  INVALID: 'invalid',
});

export const EXECUTION_INTENT_OPERATION = Object.freeze({
  PLACE: 'place',
  CANCEL: 'cancel',
  MODIFY: 'modify',
});

export const ORDER_TYPE = Object.freeze({
  MARKET: 'market',
  LIMIT: 'limit',
  STOP_LOSS: 'stop_loss',
  STOP_LOSS_LIMIT: 'stop_loss_limit',
  TAKE_PROFIT: 'take_profit',
  TAKE_PROFIT_LIMIT: 'take_profit_limit',
});

export const ORDER_SIDE = Object.freeze({
  BUY: 'buy',
  SELL: 'sell',
});

export const PROVIDER_CAPABILITY = Object.freeze({
  AVAILABLE: 'available',
  DENIED: 'denied',
  UNKNOWN: 'unknown',
});

export const CONFIRMATION_STATUS = Object.freeze({
  CONFIRMED: 'confirmed',
  NOT_CONFIRMED: 'not_confirmed',
  UNKNOWN: 'unknown',
});

export const ALLOWED_INTENT_FIELDS = Object.freeze([
  'intentId',
  'decisionId',
  'decisionContextId',
  'runId',
  'createdAt',
  'expiresAt',
  'idempotencyKey',
  'operation',
  'limits',
  'confirmation',
  'providerCapability',
  'lineage',
  'provenance',
]);

export const ALLOWED_OPERATION_FIELDS = Object.freeze([
  'kind',
  'orderType',
  'side',
  'symbol',
  'quantity',
  'price',
  'stopPrice',
  'providerId',
  'clientOrderId',
]);

export const ALLOWED_LIMIT_FIELDS = Object.freeze([
  'maxNotional',
  'maxQuantity',
  'maxAttempts',
]);

export const ALLOWED_CONFIRMATION_FIELDS = Object.freeze([
  'status',
  'confirmationId',
  'confirmedAt',
  'actor',
]);

export const ALLOWED_PROVIDER_FIELDS = Object.freeze([
  'providerId',
  'capability',
  'capabilityVersion',
  'observedAt',
]);

export const ALLOWED_LINEAGE_FIELDS = Object.freeze([
  'controlChainContractVersion',
  'riskRunId',
  'portfolioRunId',
  'liquidityRunId',
  'runtimeRunId',
  'sourceEvidenceIds',
]);

export const ALLOWED_PROVENANCE_FIELDS = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'recordedAt',
  'source',
]);

export const REQUIRED_HARD_FALSE_FLAGS = Object.freeze({
  liveExecutionEnabled: false,
  realProviderRequestEnabled: false,
  runtimeMutationEnabled: false,
  llmEnabled: false,
  networkEnabled: false,
});

export const ZERO_SIDE_EFFECTS = Object.freeze({
  providerRequestCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
  dbWriteCount: 0,
  redisWriteCount: 0,
  llmCallCount: 0,
  networkRequestCount: 0,
  runtimeMutationCount: 0,
});

export const C6_LIMITATIONS = Object.freeze([
  'stage7_3_2_c6_execution_boundary_only',
  'library_only',
  'no_real_provider_requests',
  'no_financial_execution',
  'no_live_trading',
  'no_wallet_transfer_withdrawal',
  'no_runtime_mutation',
  'no_emergency_stop_clear',
  'no_llm_or_network',
  'no_db_or_redis',
  'no_parallel_provider_exchange_ssot',
  'unknown_provider_outcome_requires_reconciliation',
]);

const ENUMS = {
  operation: new Set(Object.values(EXECUTION_INTENT_OPERATION)),
  orderType: new Set(Object.values(ORDER_TYPE)),
  side: new Set(Object.values(ORDER_SIDE)),
  capability: new Set(Object.values(PROVIDER_CAPABILITY)),
  confirmation: new Set(Object.values(CONFIRMATION_STATUS)),
};

function fail(code, errors = [], extra = {}) {
  return {
    ok: false,
    status: EXECUTION_INTENT_STATUS.INVALID,
    code,
    errors,
    ...extra,
  };
}

function assertPlainObject(value, field, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push({ field, code: 'required_object' });
    return false;
  }
  return true;
}

function assertAllowlist(value, allowed, field, errors) {
  if (!assertPlainObject(value, field, errors)) return false;
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      errors.push({ field: `${field}.${key}`, code: 'unknown_field' });
    }
  }
  return true;
}

function assertString(value, field, errors, { required = false, max = 512 } = {}) {
  if (value == null) {
    if (required) errors.push({ field, code: 'required' });
    return;
  }
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    errors.push({ field, code: 'invalid_string' });
  }
}

function assertPositiveNumber(value, field, errors, { required = false } = {}) {
  if (value == null) {
    if (required) errors.push({ field, code: 'required' });
    return;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    errors.push({ field, code: 'invalid_positive_number' });
  }
}

function assertNonNegativeNumber(value, field, errors, { required = false } = {}) {
  if (value == null) {
    if (required) errors.push({ field, code: 'required' });
    return;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    errors.push({ field, code: 'invalid_non_negative_number' });
  }
}

function validateUuid(value, field, errors, { required = false } = {}) {
  if (value == null) {
    if (required) errors.push({ field, code: 'required' });
    return;
  }
  if (!isCanonicalUuid(value)) errors.push({ field, code: 'invalid_uuid' });
}

function validateTimestamp(value, field, errors, { required = false } = {}) {
  if (value == null) {
    if (required) errors.push({ field, code: 'required' });
    return;
  }
  if (!isIsoTimestamp(value)) errors.push({ field, code: 'invalid_timestamp' });
}

function validateUpstreamGate(ref, field, expectedAgentId, allowedOutcomes, errors) {
  if (!assertPlainObject(ref, field, errors)) return;
  assertString(ref.agentId, `${field}.agentId`, errors, { required: true, max: 64 });
  if (ref.agentId !== expectedAgentId) {
    errors.push({ field: `${field}.agentId`, code: 'invalid_agent_id', expected: expectedAgentId });
  }
  assertString(ref.authorityClass, `${field}.authorityClass`, errors, { required: true, max: 128 });
  assertString(ref.outcome, `${field}.outcome`, errors, { required: true, max: 64 });
  if (ref.outcome != null && !allowedOutcomes.has(ref.outcome)) {
    errors.push({ field: `${field}.outcome`, code: 'invalid_outcome' });
  }
  assertString(ref.reasonKey, `${field}.reasonKey`, errors, { required: true, max: 256 });
  assertString(ref.runId, `${field}.runId`, errors, { required: true, max: 128 });
  if (ref.freshness != null && typeof ref.freshness !== 'string') {
    errors.push({ field: `${field}.freshness`, code: 'invalid_freshness' });
  }
}

function validateExecutionIntentShape(intent, errors) {
  if (!assertAllowlist(intent, ALLOWED_INTENT_FIELDS, 'executionIntent', errors)) return;
  validateUuid(intent.intentId, 'executionIntent.intentId', errors, { required: true });
  validateUuid(intent.decisionId, 'executionIntent.decisionId', errors, { required: true });
  validateUuid(intent.decisionContextId, 'executionIntent.decisionContextId', errors, { required: true });
  validateUuid(intent.runId, 'executionIntent.runId', errors, { required: true });
  validateTimestamp(intent.createdAt, 'executionIntent.createdAt', errors, { required: true });
  validateTimestamp(intent.expiresAt, 'executionIntent.expiresAt', errors, { required: true });
  assertString(intent.idempotencyKey, 'executionIntent.idempotencyKey', errors, { required: true, max: 256 });

  if (!assertAllowlist(intent.operation, ALLOWED_OPERATION_FIELDS, 'executionIntent.operation', errors)) return;
  if (!ENUMS.operation.has(intent.operation.kind)) errors.push({ field: 'executionIntent.operation.kind', code: 'invalid_operation' });

  const needsOrderShape = intent.operation.kind !== EXECUTION_INTENT_OPERATION.CANCEL;
  if (needsOrderShape && !ENUMS.orderType.has(intent.operation.orderType)) {
    errors.push({ field: 'executionIntent.operation.orderType', code: 'invalid_order_type' });
  }
  if (needsOrderShape && !ENUMS.side.has(intent.operation.side)) {
    errors.push({ field: 'executionIntent.operation.side', code: 'invalid_side' });
  }
  assertString(intent.operation.symbol, 'executionIntent.operation.symbol', errors, { required: true, max: 64 });
  if (needsOrderShape) {
    assertPositiveNumber(intent.operation.quantity, 'executionIntent.operation.quantity', errors, { required: true });
  }
  if (intent.operation.price != null) assertPositiveNumber(intent.operation.price, 'executionIntent.operation.price', errors);
  if (intent.operation.stopPrice != null) assertPositiveNumber(intent.operation.stopPrice, 'executionIntent.operation.stopPrice', errors);
  assertString(intent.operation.providerId, 'executionIntent.operation.providerId', errors, { required: true, max: 128 });
  if (intent.operation.clientOrderId != null) assertString(intent.operation.clientOrderId, 'executionIntent.operation.clientOrderId', errors, { max: 256 });

  if (intent.operation.kind === EXECUTION_INTENT_OPERATION.CANCEL && !intent.operation.clientOrderId) {
    errors.push({ field: 'executionIntent.operation.clientOrderId', code: 'required_for_cancel' });
  }
  if (intent.operation.kind === EXECUTION_INTENT_OPERATION.MODIFY && !intent.operation.clientOrderId) {
    errors.push({ field: 'executionIntent.operation.clientOrderId', code: 'required_for_modify' });
  }

  if (needsOrderShape && (intent.operation.orderType === ORDER_TYPE.LIMIT
    || intent.operation.orderType === ORDER_TYPE.STOP_LOSS_LIMIT
    || intent.operation.orderType === ORDER_TYPE.TAKE_PROFIT_LIMIT)) {
    assertPositiveNumber(intent.operation.price, 'executionIntent.operation.price', errors, { required: true });
  }
  if (needsOrderShape && (intent.operation.orderType === ORDER_TYPE.STOP_LOSS
    || intent.operation.orderType === ORDER_TYPE.STOP_LOSS_LIMIT
    || intent.operation.orderType === ORDER_TYPE.TAKE_PROFIT
    || intent.operation.orderType === ORDER_TYPE.TAKE_PROFIT_LIMIT)) {
    assertPositiveNumber(intent.operation.stopPrice, 'executionIntent.operation.stopPrice', errors, { required: true });
  }

  if (!assertAllowlist(intent.limits, ALLOWED_LIMIT_FIELDS, 'executionIntent.limits', errors)) return;
  assertPositiveNumber(intent.limits.maxNotional, 'executionIntent.limits.maxNotional', errors, { required: true });
  assertPositiveNumber(intent.limits.maxQuantity, 'executionIntent.limits.maxQuantity', errors, { required: true });
  if (intent.limits.maxAttempts != null) assertNonNegativeNumber(intent.limits.maxAttempts, 'executionIntent.limits.maxAttempts', errors);
  if (intent.limits.maxAttempts != null && !Number.isInteger(intent.limits.maxAttempts)) {
    errors.push({ field: 'executionIntent.limits.maxAttempts', code: 'invalid_integer' });
  }

  if (!assertAllowlist(intent.confirmation, ALLOWED_CONFIRMATION_FIELDS, 'executionIntent.confirmation', errors)) return;
  if (!ENUMS.confirmation.has(intent.confirmation.status)) {
    errors.push({ field: 'executionIntent.confirmation.status', code: 'invalid_confirmation_status' });
  }
  if (intent.confirmation.status !== CONFIRMATION_STATUS.CONFIRMED) {
    errors.push({ field: 'executionIntent.confirmation.status', code: 'confirmation_required' });
  }
  assertString(intent.confirmation.confirmationId, 'executionIntent.confirmation.confirmationId', errors, { required: true, max: 256 });
  validateTimestamp(intent.confirmation.confirmedAt, 'executionIntent.confirmation.confirmedAt', errors, { required: true });
  assertString(intent.confirmation.actor, 'executionIntent.confirmation.actor', errors, { required: true, max: 256 });

  if (!assertAllowlist(intent.providerCapability, ALLOWED_PROVIDER_FIELDS, 'executionIntent.providerCapability', errors)) return;
  assertString(intent.providerCapability.providerId, 'executionIntent.providerCapability.providerId', errors, { required: true, max: 128 });
  if (intent.providerCapability.providerId !== intent.operation.providerId) {
    errors.push({ field: 'executionIntent.providerCapability.providerId', code: 'provider_id_mismatch' });
  }
  if (!ENUMS.capability.has(intent.providerCapability.capability)) {
    errors.push({ field: 'executionIntent.providerCapability.capability', code: 'invalid_provider_capability' });
  }
  assertString(intent.providerCapability.capabilityVersion, 'executionIntent.providerCapability.capabilityVersion', errors, { required: true, max: 128 });
  validateTimestamp(intent.providerCapability.observedAt, 'executionIntent.providerCapability.observedAt', errors, { required: true });

  if (!assertAllowlist(intent.lineage, ALLOWED_LINEAGE_FIELDS, 'executionIntent.lineage', errors)) return;
  assertString(intent.lineage.controlChainContractVersion, 'executionIntent.lineage.controlChainContractVersion', errors, { required: true, max: 128 });
  for (const key of ['riskRunId', 'portfolioRunId', 'liquidityRunId', 'runtimeRunId']) {
    validateUuid(intent.lineage[key], `executionIntent.lineage.${key}`, errors, { required: true });
  }
  if (!Array.isArray(intent.lineage.sourceEvidenceIds) || intent.lineage.sourceEvidenceIds.length === 0) {
    errors.push({ field: 'executionIntent.lineage.sourceEvidenceIds', code: 'required_non_empty_array' });
  } else {
    intent.lineage.sourceEvidenceIds.forEach((id, index) => {
      assertString(id, `executionIntent.lineage.sourceEvidenceIds[${index}]`, errors, { required: true, max: 256 });
    });
  }

  if (!assertAllowlist(intent.provenance, ALLOWED_PROVENANCE_FIELDS, 'executionIntent.provenance', errors)) return;
  assertString(intent.provenance.writer, 'executionIntent.provenance.writer', errors, { required: true, max: 128 });
  assertString(intent.provenance.methodKey, 'executionIntent.provenance.methodKey', errors, { required: true, max: 128 });
  assertString(intent.provenance.stage, 'executionIntent.provenance.stage', errors, { required: true, max: 32 });
  assertString(intent.provenance.source, 'executionIntent.provenance.source', errors, { required: true, max: 256 });
  validateTimestamp(intent.provenance.recordedAt, 'executionIntent.provenance.recordedAt', errors, { required: true });

  if (intent.provenance.stage !== EXECUTION_INTENT_STAGE) {
    errors.push({ field: 'executionIntent.provenance.stage', code: 'invalid_stage' });
  }
}

function validateUpstreamGates(input, errors) {
  validateUpstreamGate(input.riskEvidenceRef, 'riskEvidenceRef', 'risk', new Set(Object.values(RISK_GATE_OUTCOME)), errors);
  validateUpstreamGate(input.portfolioEvidenceRef, 'portfolioEvidenceRef', 'portfolio', new Set(Object.values(PORTFOLIO_GATE_OUTCOME)), errors);
  validateUpstreamGate(input.liquidityEvidenceRef, 'liquidityEvidenceRef', 'liquidity', new Set(Object.values(LIQUIDITY_GATE_OUTCOME)), errors);

  if (!input.runtimeGate || typeof input.runtimeGate !== 'object') {
    errors.push({ field: 'runtimeGate', code: 'required_object' });
  } else {
    assertString(input.runtimeGate.outcome, 'runtimeGate.outcome', errors, { required: true, max: 64 });
    if (!Object.values(RUNTIME_GATE_OUTCOME).includes(input.runtimeGate.outcome)) {
      errors.push({ field: 'runtimeGate.outcome', code: 'invalid_outcome' });
    }
    assertString(input.runtimeGate.authorityClass, 'runtimeGate.authorityClass', errors, { required: true, max: 128 });
    if (input.runtimeGate.outcome === RUNTIME_GATE_OUTCOME.CLEAR && input.runtimeGate.authorityClass !== 'titangold_runtime_safety_ssot') {
      errors.push({ field: 'runtimeGate.authorityClass', code: 'invalid_runtime_authority' });
    }
  }

  if (input.controlOutcome != null && !Object.values(CONTROL_OUTCOME).includes(input.controlOutcome)) {
    errors.push({ field: 'controlOutcome', code: 'invalid_control_outcome' });
  }
}

function checkUpstreamSafety(input, errors) {
  const reasons = [];

  if (input.controlOutcome !== CONTROL_OUTCOME.CONTROL_PASS_BOUNDED) {
    reasons.push('control_chain_not_control_pass_bounded');
  }

  if (input.riskEvidenceRef.outcome !== RISK_GATE_OUTCOME.PASS
    && input.riskEvidenceRef.outcome !== RISK_GATE_OUTCOME.LIMIT) {
    reasons.push('risk_not_pass_or_limit');
  }

  if (input.portfolioEvidenceRef.outcome !== PORTFOLIO_GATE_OUTCOME.AVAILABLE) {
    reasons.push('portfolio_not_available');
  }

  if (input.liquidityEvidenceRef.outcome !== LIQUIDITY_GATE_OUTCOME.FEASIBLE) {
    reasons.push('liquidity_not_feasible');
  }

  if (input.runtimeGate.outcome !== RUNTIME_GATE_OUTCOME.CLEAR) {
    reasons.push('runtime_not_clear');
  }

  if (input.runtimeGate.authorityClass !== 'titangold_runtime_safety_ssot') {
    reasons.push('runtime_authority_invalid');
  }

  if (input.runtimeGate.capabilityState != null
    && input.runtimeGate.capabilityState !== CAPABILITY_STATE.GRANTED) {
    reasons.push('runtime_capability_not_granted');
  }

  if (input.executionIntent.providerCapability?.capability !== PROVIDER_CAPABILITY.AVAILABLE) {
    reasons.push('provider_capability_not_available');
  }

  return reasons;
}

function checkIntentLimits(intent, errors) {
  const quantity = intent.operation.quantity;
  if (quantity > intent.limits.maxQuantity) {
    errors.push({ field: 'executionIntent.operation.quantity', code: 'quantity_exceeds_limit' });
  }

  if (intent.operation.price != null
    && quantity * intent.operation.price > intent.limits.maxNotional) {
    errors.push({ field: 'executionIntent.operation', code: 'notional_exceeds_limit' });
  }
}

function checkExpiry(intent, now) {
  const nowMs = Date.parse(now);
  const createdMs = Date.parse(intent.createdAt);
  const expiresMs = Date.parse(intent.expiresAt);
  if (![nowMs, createdMs, expiresMs].every(Number.isFinite)) return { expired: true, reason: 'invalid_time' };
  if (expiresMs <= createdMs) return { expired: true, reason: 'expiry_not_after_creation' };
  if (nowMs >= expiresMs) return { expired: true, reason: 'intent_expired' };
  if (createdMs > nowMs) return { expired: true, reason: 'created_in_future' };
  return { expired: false };
}

export function validateExecutionIntent(input = {}) {
  const errors = [];
  if (!assertPlainObject(input, 'input', errors)) return fail('invalid_input', errors);

  if (!assertPlainObject(input.executionIntent, 'executionIntent', errors)) {
    return fail('invalid_execution_intent', errors);
  }

  validateExecutionIntentShape(input.executionIntent, errors);
  validateUpstreamGates(input, errors);

  if (errors.length) {
    return fail('validation_failed', errors);
  }

  const expiry = checkExpiry(input.executionIntent, input.now ?? new Date().toISOString());
  if (expiry.expired) {
    return {
      ok: false,
      status: EXECUTION_INTENT_STATUS.EXPIRED,
      code: expiry.reason,
      errors: [{ field: 'executionIntent.expiresAt', code: expiry.reason }],
      sideEffects: { ...ZERO_SIDE_EFFECTS },
      ...REQUIRED_HARD_FALSE_FLAGS,
    };
  }

  checkIntentLimits(input.executionIntent, errors);
  if (errors.length) return fail('limit_validation_failed', errors);

  const blockedReasons = checkUpstreamSafety(input, errors);
  if (blockedReasons.length) {
    return {
      ok: true,
      status: EXECUTION_INTENT_STATUS.BLOCKED,
      code: 'upstream_gate_blocked',
      blockedReasons,
      sideEffects: { ...ZERO_SIDE_EFFECTS },
      ...REQUIRED_HARD_FALSE_FLAGS,
    };
  }

  const seen = input.seenIdempotencyKeys instanceof Set
    ? input.seenIdempotencyKeys
    : new Set(Array.isArray(input.seenIdempotencyKeys) ? input.seenIdempotencyKeys : []);
  if (seen.has(input.executionIntent.idempotencyKey)) {
    return {
      ok: true,
      status: EXECUTION_INTENT_STATUS.DUPLICATE,
      code: 'duplicate_idempotency_key',
      sideEffects: { ...ZERO_SIDE_EFFECTS },
      ...REQUIRED_HARD_FALSE_FLAGS,
    };
  }

  return {
    ok: true,
    status: EXECUTION_INTENT_STATUS.ACCEPTED,
    code: 'execution_intent_valid',
    executionIntent: structuredClone(input.executionIntent),
    dispatch: {
      permittedByC6Boundary: true,
      realProviderTransport: false,
      financialMutation: false,
      retryPolicy: 'no_blind_retry_unknown_provider_outcome',
    },
    sideEffects: { ...ZERO_SIDE_EFFECTS },
    ...REQUIRED_HARD_FALSE_FLAGS,
  };
}

export function classifyProviderOutcome(outcome) {
  const normalized = typeof outcome === 'string' ? outcome.trim().toLowerCase() : '';
  if (normalized === 'accepted' || normalized === 'open' || normalized === 'filled' || normalized === 'partially_filled') {
    return { state: 'known_success_or_live_state', retryable: false };
  }
  if (normalized === 'rejected' || normalized === 'cancelled' || normalized === 'expired') {
    return { state: 'known_terminal_failure', retryable: false };
  }
  return {
    state: 'unknown_provider_outcome',
    retryable: false,
    requiresReconciliation: true,
    failClosed: true,
  };
}

export function validateExecutionIntentArtifact(result) {
  const errors = [];
  if (!result || typeof result !== 'object') return fail('invalid_artifact', [{ field: 'result', code: 'required_object' }]);
  if (result.status === EXECUTION_INTENT_STATUS.ACCEPTED && result.dispatch?.realProviderTransport !== false) {
    errors.push({ field: 'dispatch.realProviderTransport', code: 'must_be_false' });
  }
  if (result.status === EXECUTION_INTENT_STATUS.ACCEPTED && result.dispatch?.financialMutation !== false) {
    errors.push({ field: 'dispatch.financialMutation', code: 'must_be_false' });
  }
  if (result.sideEffects?.financialExecutionCount !== 0 || result.sideEffects?.providerRequestCount !== 0) {
    errors.push({ field: 'sideEffects', code: 'non_zero_side_effects' });
  }
  if (result.executionIntent?.operation?.side != null
    && !ENUMS.side.has(result.executionIntent.operation.side)) {
    errors.push({ field: 'executionIntent.operation.side', code: 'invalid_side' });
  }
  if (utf8ByteLength(result) > 32 * 1024) {
    errors.push({ field: 'result', code: 'payload_too_large' });
  }
  if (errors.length) return fail('artifact_validation_failed', errors);
  return { ok: true };
}

export default {
  EXECUTION_INTENT_STAGE,
  EXECUTION_INTENT_SCHEMA_VERSION,
  EXECUTION_INTENT_CONTRACT_VERSION,
  EXECUTION_INTENT_POLICY_VERSION,
  EXECUTION_INTENT_STATUS,
  EXECUTION_INTENT_OPERATION,
  ORDER_TYPE,
  ORDER_SIDE,
  PROVIDER_CAPABILITY,
  CONFIRMATION_STATUS,
  REQUIRED_HARD_FALSE_FLAGS,
  ZERO_SIDE_EFFECTS,
  C6_LIMITATIONS,
  validateExecutionIntent,
  classifyProviderOutcome,
  validateExecutionIntentArtifact,
};
