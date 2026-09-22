/**
 * Artemis Core Stage 8 — Observed Outcome Source of Truth (S8-OBSERVED-OUTCOME-SOT).
 *
 * Canonical append-only owner for ATTESTED / validated Observed Outcome artifacts.
 * Validation reuses S8-OBSERVED-OUTCOME-CONTRACT (`artemisObservedOutcomeContract.js`).
 *
 * Ownership (explicit):
 *   - This module + service is the SOLE SOURCE_OF_TRUTH for accepted Observed Outcomes.
 *   - artemisObservedOutcomeContract.js remains VALIDATION_BOUNDARY only.
 *   - Outcome Evaluation remains DEFERRED.
 *   - realizedPnl remains UNSUPPORTED_FOR_SHADOW.
 *
 * Does NOT:
 *   - redefine Outcome artifact semantics
 *   - fetch market data / network / provider / LLM
 *   - activate Worker / Scheduler / Feeder / B10 / global Shadow Runtime
 *   - authorize Live / Paper / orders / wallet / financial execution
 *   - mutate C8.1 / C.1–C.6 / Decision / Context / Evidence / MC-SOT / Task State
 */

import { createHash } from 'node:crypto';
import {
  OBSERVED_OUTCOME_CONTRACT_VERSION,
  OBSERVED_OUTCOME_POLICY_VERSION,
  OBSERVED_OUTCOME_SCHEMA_VERSION,
  OUTCOME_EVALUATION_STATUS,
  REALIZED_PNL_STATUS,
  REQUIRED_HARD_FLAGS,
} from './artemisObservedOutcomeContract.js';

export const OBSERVED_OUTCOME_SOT_STAGE =
  'ARTEMIS_CORE_STAGE_8_OBSERVED_OUTCOME_SOURCE_OF_TRUTH';
export const OBSERVED_OUTCOME_SOT_SLICE_ID = 'S8-OBSERVED-OUTCOME-SOT';
export const OBSERVED_OUTCOME_SOT_SCHEMA_VERSION = '1.0.0';
export const OBSERVED_OUTCOME_SOT_CONTRACT_VERSION =
  'artemis-observed-outcome-sot-1.0.0';
export const OBSERVED_OUTCOME_SOT_POLICY_VERSION =
  'stage8-observed-outcome-sot-1.0.0';
export const OBSERVED_OUTCOME_SOT_WRITER =
  'artemisObservedOutcomeSourceOfTruth';
export const OBSERVED_OUTCOME_SOT_METHOD_KEY =
  'accept_observed_outcome_append_only';
export const OBSERVED_OUTCOME_SOT_ARTIFACT_TYPE =
  'OBSERVED_OUTCOME_SOT_RECORD';
export const OBSERVED_OUTCOME_SOT_AUTHORITY_CLASS = 'OBSERVED_OUTCOME';
export const OBSERVED_OUTCOME_SOT_OWNERSHIP_ROLE = 'SOURCE_OF_TRUTH';
export const OBSERVED_OUTCOME_SOT_IS_SOURCE_OF_TRUTH = true;
export const OBSERVED_OUTCOME_SOT_IMPLEMENTATION_SHAPE =
  'HYBRID_ATTESTATION_FIRST / VALIDATED_OUTCOME_ENVELOPE_SOT_ONLY';

/** Validation boundary remains the Outcome Contract — not this SoT. */
export const OBSERVED_OUTCOME_VALIDATION_BOUNDARY =
  'artemisObservedOutcomeContract';

export const ACCEPT_STATUS = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  ALREADY_PRESENT: 'ALREADY_PRESENT',
  CONFLICT: 'CONFLICT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  REJECTED: 'REJECTED',
});

export const ZERO_OBSERVED_OUTCOME_SOT_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  networkRequestCount: 0,
  providerRequestCount: 0,
  llmCallCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
  runtimeMutationCount: 0,
  emergencyStopClearCount: 0,
  agentExecutionCount: 0,
  sotAppendCount: 0,
  sotUpdateCount: 0,
  sotDeleteCount: 0,
  dbWrites: 0,
  redisWrites: 0,
  network: 0,
  provider: 0,
  llm: 0,
  orders: 0,
  wallet: 0,
  financialExecution: 0,
  worker: 0,
  scheduler: 0,
  feeder: 0,
  b10: 0,
  outcomeEvaluation: 0,
});

export const OBSERVED_OUTCOME_SOT_LIMITATIONS = Object.freeze([
  'stage8_observed_outcome_sot_only',
  'append_only_validated_outcome_envelopes',
  'reuses_observed_outcome_validation_boundary',
  'outcome_evaluation_deferred',
  'realized_pnl_unsupported_for_shadow',
  'no_network_provider_feeder',
  'no_shadow_runtime_activation',
  'no_worker_or_scheduler',
  'no_b10_activation',
  'does_not_authorize_execution',
  'does_not_own_task_or_binding_or_cycle_ids',
  'does_not_own_market_context_or_shadow_recording_ids',
  'live_pg_migration_not_executed',
  'library_in_memory_sot_default',
]);

export { REQUIRED_HARD_FLAGS };

function canonicalizeValue(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeValue(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalizeValue(value[k])}`).join(',')}}`;
}

/**
 * Payload hash for identical / conflict detection.
 * @param {object} durablePayload
 * @returns {string} hex sha256
 */
export function computeOutcomePayloadSha256(durablePayload) {
  const utf8 = canonicalizeValue(durablePayload);
  return createHash('sha256').update(utf8, 'utf8').digest('hex');
}

/**
 * Build durable payload from a validated Observed Outcome artifact.
 * Identity remains owned by the Outcome Contract (outcomeId).
 * @param {object} artifact
 * @returns {object}
 */
export function buildDurableOutcomePayload(artifact) {
  const hardFlags = {};
  for (const key of Object.keys(REQUIRED_HARD_FLAGS)) {
    hardFlags[key] = false;
  }

  const payload = {
    outcomeId: artifact.outcomeId,
    schemaVersion: OBSERVED_OUTCOME_SOT_SCHEMA_VERSION,
    contractVersion: OBSERVED_OUTCOME_SOT_CONTRACT_VERSION,
    policyVersion: OBSERVED_OUTCOME_SOT_POLICY_VERSION,
    validationContractVersion: OBSERVED_OUTCOME_CONTRACT_VERSION,
    validationSchemaVersion: OBSERVED_OUTCOME_SCHEMA_VERSION,
    validationPolicyVersion: OBSERVED_OUTCOME_POLICY_VERSION,
    outcomeObservedAt: artifact.outcomeObservedAt,
    recordedAt: artifact.recordedAt,
    decisionRef: artifact.decisionRef,
    decisionContextRef: artifact.decisionContextRef,
    shadowRecordingRef: artifact.shadowRecordingRef,
    marketContextRef: artifact.marketContextRef,
    lineage: artifact.lineage,
    provenance: artifact.provenance,
    outcomeEvaluationStatus: artifact.outcomeEvaluationStatus
      || OUTCOME_EVALUATION_STATUS,
    realizedPnlStatus: artifact.realizedPnlStatus || REALIZED_PNL_STATUS,
    hardFlags,
  };

  if (artifact.taskRef != null) payload.taskRef = artifact.taskRef;
  if (artifact.cycleBindingRef != null) {
    payload.cycleBindingRef = artifact.cycleBindingRef;
  }
  if (artifact.shadowCycleEnvelopeRef != null) {
    payload.shadowCycleEnvelopeRef = artifact.shadowCycleEnvelopeRef;
  }
  if (artifact.correlationId != null) {
    payload.correlationId = artifact.correlationId;
  }
  if (artifact.implementationVersion != null) {
    payload.implementationVersion = artifact.implementationVersion;
  }

  return payload;
}

/**
 * Compose an immutable SoT record from a validated Outcome artifact.
 * @param {object} artifact — freezeDeep artifact from buildObservedOutcome
 * @returns {object}
 */
export function composeOutcomeRecord(artifact) {
  const durablePayload = buildDurableOutcomePayload(artifact);
  const payloadSha256 = computeOutcomePayloadSha256(durablePayload);

  const record = {
    outcomeId: artifact.outcomeId,
    payloadSha256,
    decisionId: artifact.decisionRef.decisionId,
    decisionContextId: artifact.decisionContextRef.contextId,
    shadowRecordingArtifactId:
      artifact.shadowRecordingRef.shadowRecordingArtifactId,
    marketContextId: artifact.marketContextRef.marketContextId,
    outcomeObservedAt: artifact.outcomeObservedAt,
    recordedAt: artifact.recordedAt,
    sourceTimestamp: artifact.marketContextRef.sourceTimestamp,
    venue: artifact.marketContextRef.venue,
    marketType: artifact.marketContextRef.marketType,
    symbol: artifact.marketContextRef.symbol,
    timeframe: artifact.marketContextRef.timeframe,
    taskId: artifact.taskRef?.taskId ?? null,
    bindingId: artifact.cycleBindingRef?.bindingId ?? null,
    shadowCycleEnvelopeId:
      artifact.shadowCycleEnvelopeRef?.shadowCycleEnvelopeId ?? null,
    correlationId: artifact.correlationId ?? null,
    writer: OBSERVED_OUTCOME_SOT_WRITER,
    methodKey: OBSERVED_OUTCOME_SOT_METHOD_KEY,
    stage: OBSERVED_OUTCOME_SOT_STAGE,
    policyVersion: OBSERVED_OUTCOME_SOT_POLICY_VERSION,
    schemaVersion: OBSERVED_OUTCOME_SOT_SCHEMA_VERSION,
    contractVersion: OBSERVED_OUTCOME_SOT_CONTRACT_VERSION,
    validationContractVersion: OBSERVED_OUTCOME_CONTRACT_VERSION,
    implementationVersion: artifact.implementationVersion
      ?? artifact.provenance?.implementationVersion
      ?? null,
    durablePayload,
    outcomeArtifact: artifact,
    hardFlags: { ...REQUIRED_HARD_FLAGS },
    ownership: {
      role: OBSERVED_OUTCOME_SOT_OWNERSHIP_ROLE,
      isSourceOfTruth: OBSERVED_OUTCOME_SOT_IS_SOURCE_OF_TRUTH,
      sliceId: OBSERVED_OUTCOME_SOT_SLICE_ID,
      stage: OBSERVED_OUTCOME_SOT_STAGE,
      writer: OBSERVED_OUTCOME_SOT_WRITER,
      methodKey: OBSERVED_OUTCOME_SOT_METHOD_KEY,
      validationBoundary: OBSERVED_OUTCOME_VALIDATION_BOUNDARY,
    },
    limitations: [...OBSERVED_OUTCOME_SOT_LIMITATIONS],
    outcomeEvaluationStatus: OUTCOME_EVALUATION_STATUS,
    realizedPnlStatus: REALIZED_PNL_STATUS,
  };

  return Object.freeze(record);
}

export function createZeroSideEffects(overrides = {}) {
  return { ...ZERO_OBSERVED_OUTCOME_SOT_SIDE_EFFECTS, ...overrides };
}

export default {
  OBSERVED_OUTCOME_SOT_STAGE,
  OBSERVED_OUTCOME_SOT_SLICE_ID,
  OBSERVED_OUTCOME_SOT_SCHEMA_VERSION,
  OBSERVED_OUTCOME_SOT_CONTRACT_VERSION,
  OBSERVED_OUTCOME_SOT_POLICY_VERSION,
  OBSERVED_OUTCOME_SOT_WRITER,
  OBSERVED_OUTCOME_SOT_METHOD_KEY,
  OBSERVED_OUTCOME_SOT_ARTIFACT_TYPE,
  OBSERVED_OUTCOME_SOT_AUTHORITY_CLASS,
  OBSERVED_OUTCOME_SOT_OWNERSHIP_ROLE,
  OBSERVED_OUTCOME_SOT_IS_SOURCE_OF_TRUTH,
  ACCEPT_STATUS,
  ZERO_OBSERVED_OUTCOME_SOT_SIDE_EFFECTS,
  OBSERVED_OUTCOME_SOT_LIMITATIONS,
  REQUIRED_HARD_FLAGS,
  computeOutcomePayloadSha256,
  buildDurableOutcomePayload,
  composeOutcomeRecord,
  createZeroSideEffects,
};
