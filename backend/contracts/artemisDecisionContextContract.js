/**
 * Artemis Core Stage 7.1 — canonical Decision Context contract.
 *
 * Bounded envelope between Stage 6 EvidenceOrchestrationSet and a future
 * Cognitive Kernel. Model-independent and execution-independent.
 *
 * A Decision Context answers: what exact question is Artemis deciding, for
 * whom, under what market, temporal, operational and safety conditions?
 *
 * This is NOT:
 * - Agent evidence
 * - EvidenceOrchestrationSet
 * - an Artemis Decision / Cognitive Kernel output
 * - execution authorization, order intent, or a financial command
 *
 * UNAVAILABLE / BLOCKED / NOT_APPLICABLE / STALE / MISSING are never NEUTRAL.
 */

import { INGESTION_DISPOSITION } from './artemisEvidenceIngestionContract.js';
import { ORCHESTRATION_CONTRACT_VERSION } from './artemisEvidenceOrchestrationContract.js';
import {
  DATA_QUALITY_STATUS,
  FRESHNESS_STATUS,
  MARKET_TYPE,
} from './artemisEvidenceContract.js';

export const DECISION_CONTEXT_STAGE = 7.1;
export const DECISION_CONTEXT_SCHEMA_VERSION = '1.0.0';
export const DECISION_CONTEXT_CONTRACT_VERSION = 'artemis-decision-context-1.0.0';
export const DECISION_CONTEXT_WRITER = 'artemisDecisionContextService';
export const DECISION_CONTEXT_POLICY_VERSION = 'stage7-1-decision-context-1.0.0';
export const REQUIRED_ORCHESTRATION_CONTRACT_VERSION = ORCHESTRATION_CONTRACT_VERSION;

export const DECISION_CONTEXT_LIFECYCLE = Object.freeze({
  CREATED: 'CREATED',
  VALIDATED: 'VALIDATED',
  FROZEN: 'FROZEN',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
});

export const TASK_DOMAIN = Object.freeze({
  MARKET_ANALYSIS: 'market_analysis',
  RISK_REVIEW: 'risk_review',
  PORTFOLIO_REVIEW: 'portfolio_review',
  LIQUIDITY_REVIEW: 'liquidity_review',
});

export const OWNERSHIP_SCOPE_TYPE = Object.freeze({
  USER: 'user',
  TENANT: 'tenant',
  GLOBAL: 'global',
});

export const ENVIRONMENT = Object.freeze({
  TEST: 'test',
  STAGING: 'staging',
  PRODUCTION: 'production',
});

export const DECISION_MATURITY_MODE = Object.freeze({
  ADVISORY: 'advisory',
  SHADOW: 'shadow',
  PAPER: 'paper',
});

export const REQUESTED_RUNTIME_MODE = Object.freeze({
  ADVISORY: 'advisory',
  DEMO: 'demo',
  DRY_RUN: 'dry_run',
  SHADOW: 'shadow',
  PAPER: 'paper',
  LIVE: 'live',
});

export const EFFECTIVE_RUNTIME_MODE = Object.freeze({
  ADVISORY: 'advisory',
  DEMO: 'demo',
  DRY_RUN: 'dry_run',
  SHADOW: 'shadow',
  PAPER: 'paper',
});

export const PRIVACY_CLASS = Object.freeze({
  PUBLIC: 'public',
  INTERNAL_PRODUCT_SAFE: 'internal_product_safe',
  PRIVILEGED_DIAGNOSTIC: 'privileged_diagnostic',
  USER_PRIVATE: 'user_private',
});

export const EVIDENCE_REF_SEMANTICS = Object.freeze({
  USABLE_CURRENT: 'usable_current',
  UNAVAILABLE_NOT_NEUTRAL: 'unavailable_not_neutral',
  BLOCKED_NOT_NEUTRAL: 'blocked_not_neutral',
  NOT_APPLICABLE_NOT_NEUTRAL: 'not_applicable_not_neutral',
  MISSING_NOT_NEGATIVE: 'missing_not_negative',
  STALE_OR_EXPIRED_NOT_CURRENT: 'stale_or_expired_not_current',
  EXCLUDED_NOT_USABLE: 'excluded_not_usable',
});

export const ZERO_DECISION_CONTEXT_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  agentExecutionCount: 0,
  providerRequestCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
});

export const DECISION_CONTEXT_LIMITATIONS = Object.freeze([
  'stage7_1_decision_context_only',
  'no_cognitive_kernel',
  'no_artemis_decision_synthesis',
  'no_confidence_aggregation',
  'no_majority_voting',
  'no_weighted_voting',
  'no_execution_authorization',
  'no_order_intent',
  'unavailable_blocked_not_applicable_not_neutral',
  'missing_evidence_not_negative',
  'live_trading_not_authorized',
]);

export const FORBIDDEN_DECISION_CONTEXT_KEYS = Object.freeze([
  'orderId',
  'order_id',
  'executionCommand',
  'execution_command',
  'executionIntent',
  'walletAction',
  'wallet_action',
  'tradeInstruction',
  'trade_instruction',
  'apiKey',
  'api_key',
  'apiSecret',
  'api_secret',
  'credentials',
  'signedQuery',
  'signed_query',
]);

export const FORBIDDEN_EXECUTION_AUTHORITY_VALUES = Object.freeze([
  'BUY',
  'SELL',
  'EXECUTE',
  'LONG',
  'SHORT',
]);

export const MAX_ORCHESTRATION_SET_REFS = 8;
export const MAX_DECISION_CONTEXT_UTF8_BYTES = 32 * 1024;

export {
  DATA_QUALITY_STATUS,
  FRESHNESS_STATUS,
  INGESTION_DISPOSITION,
  MARKET_TYPE,
  ORCHESTRATION_CONTRACT_VERSION,
};

export default {
  DECISION_CONTEXT_STAGE,
  DECISION_CONTEXT_SCHEMA_VERSION,
  DECISION_CONTEXT_CONTRACT_VERSION,
  DECISION_CONTEXT_WRITER,
  DECISION_CONTEXT_POLICY_VERSION,
  REQUIRED_ORCHESTRATION_CONTRACT_VERSION,
  DECISION_CONTEXT_LIFECYCLE,
  TASK_DOMAIN,
  OWNERSHIP_SCOPE_TYPE,
  ENVIRONMENT,
  DECISION_MATURITY_MODE,
  REQUESTED_RUNTIME_MODE,
  EFFECTIVE_RUNTIME_MODE,
  PRIVACY_CLASS,
  EVIDENCE_REF_SEMANTICS,
  ZERO_DECISION_CONTEXT_SIDE_EFFECTS,
  DECISION_CONTEXT_LIMITATIONS,
  FORBIDDEN_DECISION_CONTEXT_KEYS,
  FORBIDDEN_EXECUTION_AUTHORITY_VALUES,
  MAX_ORCHESTRATION_SET_REFS,
  MAX_DECISION_CONTEXT_UTF8_BYTES,
};
