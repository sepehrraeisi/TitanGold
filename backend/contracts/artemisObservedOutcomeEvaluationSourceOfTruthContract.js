/**
 * Artemis Core Stage 8 — Observed Outcome Evaluation Source of Truth
 * (S8-OBSERVED-OUTCOME-EVALUATION-SOT).
 *
 * Canonical append-only owner for ALREADY-VALIDATED Observed Outcome Evaluation
 * artifacts. Validation reuses S8-OBSERVED-OUTCOME-EVALUATION-CONTRACT
 * (`artemisObservedOutcomeEvaluationContract.js`).
 *
 * Ownership (explicit):
 *   - This module + service is the SOLE SOURCE_OF_TRUTH for accepted Evaluations.
 *   - artemisObservedOutcomeEvaluationContract.js remains VALIDATION_BOUNDARY only
 *     (isSourceOfTruth = false).
 *   - Observed Outcome Contract / Outcome SoT remain separate READ/REFERENCE owners.
 *   - Decision / Context / C8.1 / Task State / Binding remain unchanged.
 *
 * Does NOT:
 *   - perform evaluation / recompute MATCH|MISMATCH|…
 *   - calculate realizedPnl / ROI / calibration / accuracy
 *   - fetch market data / network / provider / LLM
 *   - activate Worker / Scheduler / Feeder / B10 / global Shadow Runtime
 *   - authorize Live / Paper / orders / wallet / financial execution
 *   - invent Replay / Calibration / Evaluation persistence runtime
 *   - mutate C8.1 / C.1–C.6 / Decision / Context / Evidence / Outcome SoT
 */

import { createHash } from 'node:crypto';
import {
  OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
  OBSERVED_OUTCOME_EVALUATION_POLICY_VERSION,
  OBSERVED_OUTCOME_EVALUATION_SCHEMA_VERSION,
  REQUIRED_HARD_FLAGS,
  EVALUATION_STATUS,
} from './artemisObservedOutcomeEvaluationContract.js';

export const OBSERVED_OUTCOME_EVALUATION_SOT_STAGE =
  'ARTEMIS_CORE_STAGE_8_OBSERVED_OUTCOME_EVALUATION_SOURCE_OF_TRUTH';
export const OBSERVED_OUTCOME_EVALUATION_SOT_SLICE_ID =
  'S8-OBSERVED-OUTCOME-EVALUATION-SOT';
export const OBSERVED_OUTCOME_EVALUATION_SOT_SCHEMA_VERSION = '1.0.0';
export const OBSERVED_OUTCOME_EVALUATION_SOT_CONTRACT_VERSION =
  'artemis-observed-outcome-evaluation-sot-1.0.0';
export const OBSERVED_OUTCOME_EVALUATION_SOT_POLICY_VERSION =
  'stage8-observed-outcome-evaluation-sot-1.0.0';
export const OBSERVED_OUTCOME_EVALUATION_SOT_WRITER =
  'artemisObservedOutcomeEvaluationSourceOfTruth';
export const OBSERVED_OUTCOME_EVALUATION_SOT_METHOD_KEY =
  'accept_observed_outcome_evaluation_append_only';
export const OBSERVED_OUTCOME_EVALUATION_SOT_ARTIFACT_TYPE =
  'OBSERVED_OUTCOME_EVALUATION_SOT_RECORD';
/** Matches Evaluation Contract authority class (Rule02 AUTHORITY_CLASS). */
export const OBSERVED_OUTCOME_EVALUATION_SOT_AUTHORITY_CLASS =
  'OUTCOME_EVALUATION';
export const OBSERVED_OUTCOME_EVALUATION_SOT_OWNERSHIP_ROLE = 'SOURCE_OF_TRUTH';
export const OBSERVED_OUTCOME_EVALUATION_SOT_IS_SOURCE_OF_TRUTH = true;
export const OBSERVED_OUTCOME_EVALUATION_SOT_IMPLEMENTATION_SHAPE =
  'HYBRID_ATTESTATION_FIRST / VALIDATED_EVALUATION_ENVELOPE_SOT_ONLY';

/** Validation boundary remains the Evaluation Contract — not this SoT. */
export const OBSERVED_OUTCOME_EVALUATION_VALIDATION_BOUNDARY =
  'artemisObservedOutcomeEvaluationContract';

export const ACCEPT_STATUS = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  ALREADY_PRESENT: 'ALREADY_PRESENT',
  CONFLICT: 'CONFLICT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  REJECTED: 'REJECTED',
});

export const ZERO_OBSERVED_OUTCOME_EVALUATION_SOT_SIDE_EFFECTS = Object.freeze({
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
  replay: 0,
  calibration: 0,
  runtimeMutation: 0,
});

export const OBSERVED_OUTCOME_EVALUATION_SOT_LIMITATIONS = Object.freeze([
  'stage8_observed_outcome_evaluation_sot_only',
  'append_only_validated_evaluation_envelopes',
  'reuses_observed_outcome_evaluation_validation_boundary',
  'does_not_perform_evaluation_logic',
  'does_not_calculate_realized_pnl',
  'does_not_calculate_roi_or_calibration',
  'does_not_infer_missing_outcomes',
  'unavailable_is_not_success',
  'insufficient_data_is_not_match',
  'lookahead_protection',
  'leakage_protection',
  'no_network_provider_feeder',
  'no_shadow_runtime_activation',
  'no_worker_or_scheduler',
  'no_b10_activation',
  'no_replay',
  'no_calibration',
  'does_not_authorize_execution',
  'does_not_own_decision_or_outcome_ids',
  'does_not_own_task_or_binding_or_cycle_ids',
  'live_pg_migration_not_executed',
  'library_in_memory_sot_default',
]);

export { REQUIRED_HARD_FLAGS, EVALUATION_STATUS };

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
export function computeEvaluationPayloadSha256(durablePayload) {
  const utf8 = canonicalizeValue(durablePayload);
  return createHash('sha256').update(utf8, 'utf8').digest('hex');
}

/**
 * Build durable payload from a validated Evaluation artifact.
 * Identity remains owned by the Evaluation Contract (evaluationId).
 * @param {object} artifact
 * @param {{
 *   outcomeObservedAt?: string,
 *   shadowCycleEnvelopeId?: string|null,
 *   decisionTimestamp?: string|null,
 * }} [extras]
 * @returns {object}
 */
export function buildDurableEvaluationPayload(artifact, extras = {}) {
  const hardFlags = {};
  for (const key of Object.keys(REQUIRED_HARD_FLAGS)) {
    hardFlags[key] = false;
  }

  const decisionTimestamp = extras.decisionTimestamp
    ?? artifact.decisionRef?.analysisAt
    ?? artifact.decisionRef?.createdAt
    ?? null;

  const payload = {
    evaluationId: artifact.evaluationId,
    schemaVersion: OBSERVED_OUTCOME_EVALUATION_SOT_SCHEMA_VERSION,
    contractVersion: OBSERVED_OUTCOME_EVALUATION_SOT_CONTRACT_VERSION,
    policyVersion: OBSERVED_OUTCOME_EVALUATION_SOT_POLICY_VERSION,
    artifactType: OBSERVED_OUTCOME_EVALUATION_SOT_ARTIFACT_TYPE,
    validationContractVersion: OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
    validationSchemaVersion: OBSERVED_OUTCOME_EVALUATION_SCHEMA_VERSION,
    validationPolicyVersion: OBSERVED_OUTCOME_EVALUATION_POLICY_VERSION,
    decisionRef: {
      decisionId: artifact.decisionRef.decisionId,
      contractVersion: artifact.decisionRef.contractVersion,
    },
    outcomeRef: {
      outcomeId: artifact.outcomeRef.outcomeId,
      contractVersion: artifact.outcomeRef.contractVersion,
    },
    decisionContextRef: {
      contextId: artifact.decisionContextRef.contextId,
      contractVersion: artifact.decisionContextRef.contractVersion,
    },
    shadowLineage: {
      shadowRecordingArtifactId:
        artifact.shadowRecordingRef?.shadowRecordingArtifactId ?? null,
      taskId: artifact.taskRef?.taskId ?? null,
      bindingId: artifact.bindingRef?.bindingId ?? null,
      shadowCycleEnvelopeId: extras.shadowCycleEnvelopeId ?? null,
    },
    evaluation: {
      // Canonical contract field is evaluationStatus; evaluationResult is the
      // SoT alias preserving the same EVALUATION_STATUS enum (no expansion).
      evaluationStatus: artifact.evaluationStatus,
      evaluationResult: artifact.evaluationStatus,
      evaluationMethod: artifact.evaluationMethod,
      evaluationVersion: artifact.implementationVersion
        || artifact.evaluationMethod?.implementationVersion
        || null,
      observationClass: artifact.observationClass,
    },
    time: {
      decisionTimestamp,
      outcomeObservedAt: extras.outcomeObservedAt ?? null,
      evaluatedAt: artifact.recordedAt,
    },
    lineage: artifact.lineage,
    provenance: {
      writer: OBSERVED_OUTCOME_EVALUATION_SOT_WRITER,
      methodKey: OBSERVED_OUTCOME_EVALUATION_SOT_METHOD_KEY,
      stage: OBSERVED_OUTCOME_EVALUATION_SOT_STAGE,
      recordedAt: artifact.recordedAt,
      policyVersion: OBSERVED_OUTCOME_EVALUATION_SOT_POLICY_VERSION,
      validationWriter: artifact.provenance?.writer ?? null,
      validationMethodKey: artifact.provenance?.methodKey ?? null,
    },
    limitations: [...OBSERVED_OUTCOME_EVALUATION_SOT_LIMITATIONS],
    hardFlags,
  };

  if (artifact.marketContextRef != null) {
    payload.marketContextRef = {
      marketContextId: artifact.marketContextRef.marketContextId,
      contractVersion: artifact.marketContextRef.contractVersion,
    };
  }
  if (artifact.outcomeSotRef != null) {
    payload.outcomeSotRef = artifact.outcomeSotRef;
  }
  if (artifact.comparisonClaims != null) {
    payload.comparisonClaims = artifact.comparisonClaims;
  }
  if (artifact.blockedReason != null) {
    payload.blockedReason = artifact.blockedReason;
  }
  if (artifact.implementationVersion != null) {
    payload.implementationVersion = artifact.implementationVersion;
  }

  return payload;
}

/**
 * Compose an immutable SoT record from a validated Evaluation artifact.
 * @param {object} artifact — freezeDeep artifact from buildObservedOutcomeEvaluation
 * @param {{
 *   outcomeObservedAt?: string,
 *   shadowCycleEnvelopeId?: string|null,
 *   decisionTimestamp?: string|null,
 * }} [extras]
 * @returns {object}
 */
export function composeEvaluationRecord(artifact, extras = {}) {
  const durablePayload = buildDurableEvaluationPayload(artifact, extras);
  const payloadSha256 = computeEvaluationPayloadSha256(durablePayload);
  const decisionTimestamp = extras.decisionTimestamp
    ?? artifact.decisionRef?.analysisAt
    ?? artifact.decisionRef?.createdAt
    ?? null;

  const outcomeObservedAt = extras.outcomeObservedAt ?? null;
  const evaluatedAt = artifact.recordedAt;
  const recordedAt = artifact.recordedAt;

  const record = {
    evaluationId: artifact.evaluationId,
    payloadSha256,
    decisionId: artifact.decisionRef.decisionId,
    outcomeId: artifact.outcomeRef.outcomeId,
    decisionContextId: artifact.decisionContextRef.contextId,
    shadowRecordingArtifactId:
      artifact.shadowRecordingRef?.shadowRecordingArtifactId ?? null,
    marketContextId: artifact.marketContextRef?.marketContextId ?? null,
    taskId: artifact.taskRef?.taskId ?? null,
    bindingId: artifact.bindingRef?.bindingId ?? null,
    shadowCycleEnvelopeId: extras.shadowCycleEnvelopeId ?? null,
    evaluationStatus: artifact.evaluationStatus,
    evaluationResult: artifact.evaluationStatus,
    observationClass: artifact.observationClass,
    decisionTimestamp,
    outcomeObservedAt,
    evaluatedAt,
    recordedAt,
    writer: OBSERVED_OUTCOME_EVALUATION_SOT_WRITER,
    methodKey: OBSERVED_OUTCOME_EVALUATION_SOT_METHOD_KEY,
    stage: OBSERVED_OUTCOME_EVALUATION_SOT_STAGE,
    policyVersion: OBSERVED_OUTCOME_EVALUATION_SOT_POLICY_VERSION,
    schemaVersion: OBSERVED_OUTCOME_EVALUATION_SOT_SCHEMA_VERSION,
    contractVersion: OBSERVED_OUTCOME_EVALUATION_SOT_CONTRACT_VERSION,
    validationContractVersion: OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
    implementationVersion: artifact.implementationVersion ?? null,
    durablePayload,
    evaluationArtifact: artifact,
    time: Object.freeze({
      decisionTimestamp,
      outcomeObservedAt,
      evaluatedAt,
    }),
    provenance: Object.freeze({
      writer: OBSERVED_OUTCOME_EVALUATION_SOT_WRITER,
      methodKey: OBSERVED_OUTCOME_EVALUATION_SOT_METHOD_KEY,
      stage: OBSERVED_OUTCOME_EVALUATION_SOT_STAGE,
      recordedAt,
      policyVersion: OBSERVED_OUTCOME_EVALUATION_SOT_POLICY_VERSION,
    }),
    lineage: Object.freeze({
      evaluationId: artifact.evaluationId,
      decisionId: artifact.decisionRef.decisionId,
      outcomeId: artifact.outcomeRef.outcomeId,
      decisionContextId: artifact.decisionContextRef.contextId,
      shadowRecordingArtifactId:
        artifact.shadowRecordingRef?.shadowRecordingArtifactId ?? null,
      marketContextId: artifact.marketContextRef?.marketContextId ?? null,
      taskId: artifact.taskRef?.taskId ?? null,
      bindingId: artifact.bindingRef?.bindingId ?? null,
      shadowCycleEnvelopeId: extras.shadowCycleEnvelopeId ?? null,
    }),
    hardFlags: { ...REQUIRED_HARD_FLAGS },
    ownership: {
      role: OBSERVED_OUTCOME_EVALUATION_SOT_OWNERSHIP_ROLE,
      isSourceOfTruth: OBSERVED_OUTCOME_EVALUATION_SOT_IS_SOURCE_OF_TRUTH,
      authorityClass: OBSERVED_OUTCOME_EVALUATION_SOT_AUTHORITY_CLASS,
      sliceId: OBSERVED_OUTCOME_EVALUATION_SOT_SLICE_ID,
      stage: OBSERVED_OUTCOME_EVALUATION_SOT_STAGE,
      writer: OBSERVED_OUTCOME_EVALUATION_SOT_WRITER,
      methodKey: OBSERVED_OUTCOME_EVALUATION_SOT_METHOD_KEY,
      validationBoundary: OBSERVED_OUTCOME_EVALUATION_VALIDATION_BOUNDARY,
    },
    limitations: [...OBSERVED_OUTCOME_EVALUATION_SOT_LIMITATIONS],
    sideEffects: { ...ZERO_OBSERVED_OUTCOME_EVALUATION_SOT_SIDE_EFFECTS },
  };

  return Object.freeze(record);
}

export function createZeroSideEffects(overrides = {}) {
  return {
    ...ZERO_OBSERVED_OUTCOME_EVALUATION_SOT_SIDE_EFFECTS,
    ...overrides,
  };
}

export default {
  OBSERVED_OUTCOME_EVALUATION_SOT_STAGE,
  OBSERVED_OUTCOME_EVALUATION_SOT_SLICE_ID,
  OBSERVED_OUTCOME_EVALUATION_SOT_SCHEMA_VERSION,
  OBSERVED_OUTCOME_EVALUATION_SOT_CONTRACT_VERSION,
  OBSERVED_OUTCOME_EVALUATION_SOT_POLICY_VERSION,
  OBSERVED_OUTCOME_EVALUATION_SOT_WRITER,
  OBSERVED_OUTCOME_EVALUATION_SOT_METHOD_KEY,
  OBSERVED_OUTCOME_EVALUATION_SOT_ARTIFACT_TYPE,
  OBSERVED_OUTCOME_EVALUATION_SOT_AUTHORITY_CLASS,
  OBSERVED_OUTCOME_EVALUATION_SOT_OWNERSHIP_ROLE,
  OBSERVED_OUTCOME_EVALUATION_SOT_IS_SOURCE_OF_TRUTH,
  ACCEPT_STATUS,
  REQUIRED_HARD_FLAGS,
  EVALUATION_STATUS,
  computeEvaluationPayloadSha256,
  buildDurableEvaluationPayload,
  composeEvaluationRecord,
  createZeroSideEffects,
};
