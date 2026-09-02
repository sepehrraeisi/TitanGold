/**
 * Artemis Core Stage 6 — EvidenceOrchestrationSet contract.
 *
 * Model-independent and execution-independent.
 * Consumes Stage 4 validated/rejected evidence only.
 * Does NOT synthesize BUY/SELL/HOLD, Cognitive Decisions, or execution authorization.
 *
 * UNAVAILABLE / BLOCKED / NOT_APPLICABLE / STALE / MISSING are never NEUTRAL votes.
 * Correlated Agents in one family are never independent confirmations.
 */

import {
  AUTHORITY_CLASS,
  CANONICAL_AGENT_IDS,
  CORRELATION_FAMILY,
  DIRECTION,
} from './artemisEvidenceContract.js';
import { INGESTION_DISPOSITION } from './artemisEvidenceIngestionContract.js';

export const ORCHESTRATION_STAGE = 6;
export const ORCHESTRATION_SCHEMA_VERSION = '1.0.0';
export const ORCHESTRATION_CONTRACT_VERSION = 'artemis-evidence-orchestration-1.0.0';
export const ORCHESTRATION_WRITER = 'artemisEvidenceOrchestrationService';
export const ORCHESTRATION_POLICY_VERSION = 'stage6-orchestration-1.0.0';

export const ORCHESTRATION_READINESS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  UNAVAILABLE: 'UNAVAILABLE',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
});

export const CONFIRMATION_SEMANTICS = Object.freeze({
  CORRELATED_NOT_INDEPENDENT: 'correlated_not_independent',
  INDEPENDENT_FAMILY: 'independent_family',
  NON_DIRECTIONAL_AUTHORITY: 'non_directional_authority',
  NOT_APPLICABLE: 'not_applicable',
});

export const CONFLICT_KIND = Object.freeze({
  DIRECTIONAL_DISAGREEMENT: 'directional_disagreement',
  TIMEFRAME_MISMATCH: 'timeframe_mismatch',
  HORIZON_MISMATCH: 'horizon_mismatch',
  CONTEXT_MISMATCH: 'context_mismatch',
  FRESHNESS_INCOMPATIBILITY: 'freshness_incompatibility',
  SAME_AGENT_MULTIPLE_RECORDS: 'same_agent_multiple_records',
  CORRELATED_FAMILY_DISAGREEMENT: 'correlated_family_disagreement',
  AUTHORITY_ROLE_INCOMPATIBILITY: 'authority_role_incompatibility',
});

export const CONFLICT_SEVERITY = Object.freeze({
  INFORMATIONAL: 'informational',
  MATERIAL: 'material',
  BLOCKING: 'blocking',
});

/** Dispositions that may never enter included (usable) evidence. */
export const NON_CONSUMABLE_DISPOSITIONS = Object.freeze([
  INGESTION_DISPOSITION.REJECTED_INVALID,
  INGESTION_DISPOSITION.REJECTED_IDENTITY,
  INGESTION_DISPOSITION.REJECTED_STALE,
  INGESTION_DISPOSITION.REJECTED_EXPIRED,
  INGESTION_DISPOSITION.REJECTED_CONTEXT,
  INGESTION_DISPOSITION.UNAVAILABLE,
  INGESTION_DISPOSITION.BLOCKED,
  INGESTION_DISPOSITION.NOT_APPLICABLE,
]);

export const DIRECTIONAL_AUTHORITY_CLASSES = Object.freeze([
  AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
  AUTHORITY_CLASS.OPPORTUNITY_FORECAST,
]);

export const NON_VOTING_AUTHORITY_CLASSES = Object.freeze([
  AUTHORITY_CLASS.CONTROL_VETO,
  AUTHORITY_CLASS.CONTROL_SIZING,
  AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
  AUTHORITY_CLASS.EXECUTION,
  AUTHORITY_CLASS.NOT_APPLICABLE,
]);

export const DIRECTIONAL_VALUES = Object.freeze([
  DIRECTION.BULLISH,
  DIRECTION.BEARISH,
  DIRECTION.SIDEWAYS,
  DIRECTION.NEUTRAL,
]);

export const ZERO_ORCHESTRATION_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  agentExecutionCount: 0,
  providerRequestCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
});

export const ORCHESTRATION_LIMITATIONS = Object.freeze([
  'stage6_evidence_orchestration_only',
  'no_cognitive_decision',
  'no_financial_recommendation_synthesis',
  'no_majority_voting',
  'no_weighted_voting',
  'no_confidence_averaging',
  'no_execution_authorization',
  'correlated_evidence_not_independent_confirmation',
  'unavailable_blocked_not_applicable_not_neutral',
  'missing_evidence_not_negative',
]);

export {
  AUTHORITY_CLASS,
  CANONICAL_AGENT_IDS,
  CORRELATION_FAMILY,
  DIRECTION,
  INGESTION_DISPOSITION,
};

export default {
  ORCHESTRATION_STAGE,
  ORCHESTRATION_SCHEMA_VERSION,
  ORCHESTRATION_CONTRACT_VERSION,
  ORCHESTRATION_WRITER,
  ORCHESTRATION_POLICY_VERSION,
  ORCHESTRATION_READINESS,
  CONFIRMATION_SEMANTICS,
  CONFLICT_KIND,
  CONFLICT_SEVERITY,
  NON_CONSUMABLE_DISPOSITIONS,
  DIRECTIONAL_AUTHORITY_CLASSES,
  NON_VOTING_AUTHORITY_CLASSES,
  DIRECTIONAL_VALUES,
  ZERO_ORCHESTRATION_SIDE_EFFECTS,
  ORCHESTRATION_LIMITATIONS,
};
