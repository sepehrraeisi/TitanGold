/**
 * Artemis Core Stage 9 — Decision Lineage Contract Boundary
 * (S9-DECISION-LINEAGE-CONTRACT).
 *
 * Deterministic, non-executing, library-only lineage envelope that binds
 * already-existing canonical Decision / Context / Evidence / Shadow /
 * Market Context / Task / Outcome / Evaluation thin references into a
 * reconstructable directional lineage artifact.
 *
 * Ownership (explicit):
 *   - VALIDATION / COMPOSITION BOUNDARY for Decision Lineage only.
 *   - isSourceOfTruth = false.
 *   - Does NOT own Decision, Decision Context, Evidence, Orchestration,
 *     Control Chain, C8.1, Market Context, Task State, Binding, Outcome,
 *     or Evaluation.
 *   - Does NOT persist, replay, calibrate, fetch, or authorize trading.
 *
 * Directional model:
 *   preDecision ancestors → decision node → postDecision descendants
 *
 * Does NOT:
 *   - fetch market data / network / provider / LLM
 *   - write DB / Redis
 *   - activate Worker / Scheduler / Feeder / B10 / Shadow Runtime
 *   - execute Replay / reconstruction / rehydration
 *   - invent Lineage SoT / table / migration / service
 *   - modify frozen Stage 8 owners or C.1–C.6
 */

import {
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
} from './artemisEvidenceContract.js';
import { DECISION_CONTRACT_VERSION } from './artemisDecisionContract.js';
import { DECISION_CONTEXT_CONTRACT_VERSION } from './artemisDecisionContextContract.js';
import { ORCHESTRATION_CONTRACT_VERSION } from './artemisEvidenceOrchestrationContract.js';
import { CONTROL_CHAIN_CONTRACT_VERSION } from './artemisControlChainContract.js';
import { SHADOW_RECORDING_CONTRACT_VERSION } from './artemisShadowDecisionRecordingBoundaryContract.js';
import { MARKET_CONTEXT_CONTRACT_VERSION } from './artemisMarketContextContract.js';
import { MARKET_CONTEXT_SOT_CONTRACT_VERSION } from './artemisMarketContextSourceOfTruthContract.js';
import { SHADOW_RUNTIME_CONTRACT_VERSION } from './artemisShadowRuntimeLibraryBoundaryContract.js';
import { SHADOW_TASK_STATE_CONTRACT_VERSION } from './artemisShadowTaskStateBoundaryContract.js';
import { SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION } from './artemisShadowTaskCycleCompositionBoundaryContract.js';
import { SHADOW_TASK_STATE_ACTIVATION_CONTRACT_VERSION } from './artemisShadowTaskStateActivationBoundaryContract.js';
import { OBSERVED_OUTCOME_CONTRACT_VERSION } from './artemisObservedOutcomeContract.js';
import { OBSERVED_OUTCOME_SOT_CONTRACT_VERSION } from './artemisObservedOutcomeSourceOfTruthContract.js';
import { OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION } from './artemisObservedOutcomeEvaluationContract.js';
import { OBSERVED_OUTCOME_EVALUATION_SOT_CONTRACT_VERSION } from './artemisObservedOutcomeEvaluationSourceOfTruthContract.js';

export const DECISION_LINEAGE_STAGE =
  'ARTEMIS_CORE_STAGE_9_DECISION_LINEAGE_CONTRACT_BOUNDARY';
export const DECISION_LINEAGE_SLICE_ID = 'S9-DECISION-LINEAGE-CONTRACT';
export const DECISION_LINEAGE_SCHEMA_VERSION = '1.0.0';
export const DECISION_LINEAGE_CONTRACT_VERSION =
  'artemis-decision-lineage-1.0.0';
export const DECISION_LINEAGE_POLICY_VERSION =
  'stage9-decision-lineage-contract-1.0.0';
export const DECISION_LINEAGE_WRITER = 'artemisDecisionLineageContract';
export const DECISION_LINEAGE_METHOD_KEY =
  'compose_decision_lineage_fail_closed';
export const DECISION_LINEAGE_ARTIFACT_TYPE = 'ARTEMIS_DECISION_LINEAGE';
export const DECISION_LINEAGE_AUTHORITY_CLASS = 'DECISION_LINEAGE';
export const DECISION_LINEAGE_OWNERSHIP_ROLE = 'VALIDATION_BOUNDARY';
export const DECISION_LINEAGE_IS_SOURCE_OF_TRUTH = false;
export const DECISION_LINEAGE_IMPLEMENTATION_VERSION = '1.0.0';

export const RECONSTRUCTABILITY_STATUS = Object.freeze({
  COMPLETE: 'COMPLETE',
  PARTIAL: 'PARTIAL',
  INSUFFICIENT: 'INSUFFICIENT',
});

export const MAX_LINEAGE_UTF8_BYTES = 32 * 1024;
export const MAX_STRING_CHARS = 256;
export const MAX_LIMITATIONS = 64;

export const ZERO_LINEAGE_SIDE_EFFECTS = Object.freeze({
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
  dbWrites: 0,
  redisWrites: 0,
  network: 0,
  provider: 0,
  llm: 0,
  orders: 0,
  wallet: 0,
  financialExecution: 0,
  runtimeMutation: 0,
  worker: 0,
  scheduler: 0,
  queue: 0,
  lease: 0,
  lock: 0,
  b10: 0,
  feeder: 0,
  persistence: 0,
  replay: 0,
  replayExecution: 0,
  calibration: 0,
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  decisionEligible: false,
  executionEligible: false,
  approvedForExecution: false,
  liveTradingEnabled: false,
  paperTradingEnabled: false,
  providerConnected: false,
  runtimeActivated: false,
  shadowRuntimeActivated: false,
  workerActivated: false,
  schedulerActivated: false,
  b10WriteAttempted: false,
  replayActivated: false,
  persistenceEnabled: false,
});

export const DECISION_LINEAGE_LIMITATIONS = Object.freeze([
  'stage9_decision_lineage_contract_boundary_only',
  'library_only',
  'in_memory_only',
  'deterministic_non_executing',
  'validation_boundary_not_sot',
  'is_source_of_truth_false',
  'persistence_not_enabled',
  'no_lineage_sot',
  'no_replay',
  'no_calibration',
  'no_reconstruction_execution',
  'references_only_no_embedded_payloads',
  'directional_pre_decision_to_post_decision',
  'lookahead_protection',
  'leakage_protection',
  'does_not_fetch_market_data',
  'does_not_activate_worker_or_scheduler',
  'does_not_activate_global_shadow_runtime',
  'does_not_activate_b10',
  'does_not_authorize_execution',
  'does_not_call_llm_or_provider',
  'does_not_write_db_or_redis',
  'outcome_and_evaluation_are_descendants_only',
  'unavailable_provenance_not_fabricated',
]);

const HARD_FLAG_KEYS = Object.freeze(Object.keys(REQUIRED_HARD_FLAGS));
const RECONSTRUCTABILITY_SET = new Set(Object.values(RECONSTRUCTABILITY_STATUS));

const ALLOWED_INPUT_TOP = Object.freeze([
  'decisionRef',
  'decisionContextRef',
  'evidenceOrchestrationRef',
  'controlChainRef',
  'shadowRecordingRef',
  'marketContextRef',
  'taskRef',
  'bindingRef',
  'shadowCycleEnvelopeRef',
  'outcomeRef',
  'evaluationRef',
  'preDecision',
  'decision',
  'postDecision',
  'recordedAt',
  'lineageId',
  'provenance',
  'limitations',
  'implementationVersion',
  'expectedReconstructabilityStatus',
  ...HARD_FLAG_KEYS,
]);

const ALLOWED_ARTIFACT_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'artifactType',
  'authorityClass',
  'sliceId',
  'lineageId',
  'recordedAt',
  'preDecision',
  'decision',
  'postDecision',
  'versions',
  'reconstructabilityStatus',
  'provenance',
  'limitations',
  'sideEffects',
  'ownershipRole',
  'isSourceOfTruth',
  'implementationVersion',
  ...HARD_FLAG_KEYS,
]);

const ALLOWED_DECISION_REF = Object.freeze([
  'decisionId',
  'contractVersion',
  'decisionContextId',
  'analysisAt',
  'createdAt',
]);

const ALLOWED_CONTEXT_REF = Object.freeze([
  'contextId',
  'contractVersion',
]);

const ALLOWED_EOS_REF = Object.freeze([
  'orchestrationId',
  'contractVersion',
]);

const ALLOWED_CONTROL_REF = Object.freeze([
  'controlChainArtifactId',
  'contractVersion',
]);

const ALLOWED_SHADOW_RECORDING_REF = Object.freeze([
  'shadowRecordingArtifactId',
  'contractVersion',
]);

const ALLOWED_MARKET_CONTEXT_REF = Object.freeze([
  'marketContextId',
  'contractVersion',
  'venue',
  'marketType',
  'symbol',
  'timeframe',
  'sourceTimestamp',
]);

const ALLOWED_TASK_REF = Object.freeze([
  'taskId',
  'contractVersion',
  'attempt',
]);

const ALLOWED_BINDING_REF = Object.freeze([
  'bindingId',
  'contractVersion',
]);

const ALLOWED_CYCLE_REF = Object.freeze([
  'shadowCycleEnvelopeId',
  'contractVersion',
]);

const ALLOWED_OUTCOME_REF = Object.freeze([
  'outcomeId',
  'contractVersion',
  'outcomeObservedAt',
  'recordedAt',
]);

const ALLOWED_EVALUATION_REF = Object.freeze([
  'evaluationId',
  'contractVersion',
  'recordedAt',
]);

const ALLOWED_PRE_DECISION = Object.freeze([
  'decisionContextRef',
  'evidenceOrchestrationRef',
  'controlChainRef',
  'marketContextRef',
]);

const ALLOWED_DECISION_SECTION = Object.freeze([
  'decisionRef',
  'shadowRecordingRef',
  'taskRef',
  'bindingRef',
  'shadowCycleEnvelopeRef',
]);

const ALLOWED_POST_DECISION = Object.freeze([
  'outcomeRef',
  'evaluationRef',
]);

const ALLOWED_VERSIONS = Object.freeze([
  'decisionContractVersion',
  'decisionContextContractVersion',
  'evidenceContractVersion',
  'orchestrationContractVersion',
  'controlChainContractVersion',
  'shadowRecordingContractVersion',
  'marketContextContractVersion',
  'marketContextSotContractVersion',
  'shadowRuntimeContractVersion',
  'shadowTaskStateContractVersion',
  'shadowTaskCycleBindingContractVersion',
  'shadowTaskStateActivationContractVersion',
  'observedOutcomeContractVersion',
  'observedOutcomeSotContractVersion',
  'observedOutcomeEvaluationContractVersion',
  'observedOutcomeEvaluationSotContractVersion',
  'decisionLineageContractVersion',
]);

const ALLOWED_PROVENANCE = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'recordedAt',
  'policyVersion',
  'implementationVersion',
  'note',
]);

const FORBIDDEN_KEYS = Object.freeze([
  'order',
  'orderId',
  'executionIntent',
  'executionCommand',
  'wallet',
  'transfer',
  'withdrawal',
  'financialExecution',
  'providerPayload',
  'exchangeResponse',
  'signedQuery',
  'credentials',
  'apiKey',
  'apiSecret',
  'ohlcv',
  'OHLCV',
  'ticker',
  'orderBook',
  'candles',
  'depth',
  'rawSeries',
  'marketSnapshot',
  'bid',
  'ask',
  'spread',
  'runId',
  'workerId',
  'lease',
  'lock',
  'queueState',
  'schedulerState',
  'scheduleAt',
  'cron',
  'pm_id',
  'PM2',
  'prompt',
  'modelResponse',
  'raw',
  'payload',
  'lookahead',
  'lookAhead',
  'futureData',
  'futureEvidence',
  'futureMarketData',
  'realizedPnl',
  'evaluationResult',
  'calibrationScore',
  'promotion',
  'approved',
  'action',
  'place_order',
  'cancel_order',
  'modify_order',
  'profit',
  'loss',
  'roi',
  'ROI',
  'return',
  'PnL',
  'pnl',
  'replayId',
  'replay',
  'replayExecution',
  'score',
  'numericScore',
  'performanceScore',
  'strategyScore',
  'qualityScore',
  'ranking',
  'winner',
  'loser',
  'recommendation',
  'probabilityAdjustment',
  'b10',
  'shadowWorker',
  'shadowScheduler',
  'fill',
  'fillPrice',
  'modelVersion',
  'configurationVersion',
  'policySnapshotId',
]);

const PRE_DECISION_FORBIDDEN_IDS = Object.freeze([
  'outcomeId',
  'evaluationId',
  'outcomeRef',
  'evaluationRef',
  'observedOutcomeRef',
]);

function fail(code, message, extra = {}) {
  return { ok: false, code, message, artifact: null, ...extra };
}

function freezeDeep(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) freezeDeep(item);
    return Object.freeze(value);
  }
  for (const key of Object.keys(value)) freezeDeep(value[key]);
  return Object.freeze(value);
}

function assertAllowlist(obj, allowed, field, errors) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push({ field, code: 'required_object' });
    return false;
  }
  const allowedSet = allowed instanceof Set ? allowed : new Set(allowed);
  const unknownKeys = Object.keys(obj).filter((key) => !allowedSet.has(key));
  if (unknownKeys.length) {
    unknownKeys.forEach((key) => errors.push({ field: `${field}.${key}`, code: 'unknown_field' }));
    return false;
  }
  return true;
}

function assertString(field, value, errors, { required = false, max = MAX_STRING_CHARS } = {}) {
  if (value == null || value === '') {
    if (required) errors.push({ field, code: 'required_string' });
    return;
  }
  if (typeof value !== 'string') {
    errors.push({ field, code: 'invalid_string' });
    return;
  }
  if (value.length > max) errors.push({ field, code: 'string_too_long', max });
}

function hashToUuid(parts) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const text = parts.join('|');
  for (let i = 0; i < text.length; i += 1) {
    h1 ^= text.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= text.charCodeAt(text.length - 1 - i);
    h2 = Math.imul(h2, 0x01000193);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, '0');
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex = `${a}${b}${a}${b}`.slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function parseIsoMs(value) {
  return Date.parse(value);
}

function collectForbiddenKeysDeep(value, acc = [], prefix = '') {
  if (!value || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectForbiddenKeysDeep(value[i], acc, prefix ? `${prefix}[${i}]` : `[${i}]`);
    }
    return acc;
  }
  for (const key of Object.keys(value)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    if (key === 'sideEffects' && value[key] && typeof value[key] === 'object' && !Array.isArray(value[key])) {
      for (const seKey of Object.keys(value[key])) {
        const seVal = value[key][seKey];
        const sePath = `${fieldPath}.${seKey}`;
        if (typeof seVal === 'number') continue;
        if (FORBIDDEN_KEYS.includes(seKey)) {
          acc.push(sePath);
          continue;
        }
        if (seVal && typeof seVal === 'object') {
          collectForbiddenKeysDeep(seVal, acc, sePath);
        }
      }
      continue;
    }
    if (FORBIDDEN_KEYS.includes(key)) {
      acc.push(fieldPath);
      continue;
    }
    collectForbiddenKeysDeep(value[key], acc, fieldPath);
  }
  return acc;
}

function validateHardFlagsOnInput(input, errors) {
  for (const key of HARD_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== false) {
      errors.push({ field: key, code: 'hard_flag_must_be_false' });
    }
  }
}

function rejectPreDecisionContamination(section, fieldPrefix, errors) {
  if (!section || typeof section !== 'object' || Array.isArray(section)) return;
  for (const key of Object.keys(section)) {
    if (PRE_DECISION_FORBIDDEN_IDS.includes(key)) {
      errors.push({
        field: `${fieldPrefix}.${key}`,
        code: 'post_decision_descendant_in_pre_decision',
      });
    }
  }
  collectForbiddenKeysDeep(section).forEach((hit) => {
    if (hit.includes('outcomeId') || hit.includes('evaluationId') || hit.includes('outcomeRef') || hit.includes('evaluationRef')) {
      errors.push({
        field: `${fieldPrefix}.${hit}`,
        code: 'post_decision_descendant_in_pre_decision',
      });
    }
  });
}

function thinDecisionRef(ref, errors, field = 'decisionRef') {
  if (!assertAllowlist(ref, ALLOWED_DECISION_REF, field, errors)) return null;
  if (!isCanonicalUuid(ref.decisionId)) {
    errors.push({ field: `${field}.decisionId`, code: 'invalid_decision_id' });
  }
  if (ref.decisionContextId != null && !isCanonicalUuid(ref.decisionContextId)) {
    errors.push({ field: `${field}.decisionContextId`, code: 'invalid_context_id' });
  }
  if (ref.analysisAt != null && !isIsoTimestamp(ref.analysisAt)) {
    errors.push({ field: `${field}.analysisAt`, code: 'invalid_iso_timestamp' });
  }
  if (ref.createdAt != null && !isIsoTimestamp(ref.createdAt)) {
    errors.push({ field: `${field}.createdAt`, code: 'invalid_iso_timestamp' });
  }
  if (ref.contractVersion != null) {
    assertString(`${field}.contractVersion`, ref.contractVersion, errors);
    if (ref.contractVersion !== DECISION_CONTRACT_VERSION) {
      errors.push({
        field: `${field}.contractVersion`,
        code: 'contract_version_mismatch',
        expected: DECISION_CONTRACT_VERSION,
      });
    }
  }
  return {
    decisionId: ref.decisionId,
    contractVersion: ref.contractVersion || DECISION_CONTRACT_VERSION,
    ...(ref.decisionContextId != null ? { decisionContextId: ref.decisionContextId } : {}),
    ...(ref.analysisAt != null ? { analysisAt: ref.analysisAt } : {}),
    ...(ref.createdAt != null ? { createdAt: ref.createdAt } : {}),
  };
}

function thinContextRef(ref, errors, field = 'decisionContextRef') {
  if (ref == null) return null;
  if (!assertAllowlist(ref, ALLOWED_CONTEXT_REF, field, errors)) return null;
  if (!isCanonicalUuid(ref.contextId)) {
    errors.push({ field: `${field}.contextId`, code: 'invalid_context_id' });
  }
  if (ref.contractVersion != null && ref.contractVersion !== DECISION_CONTEXT_CONTRACT_VERSION) {
    errors.push({
      field: `${field}.contractVersion`,
      code: 'contract_version_mismatch',
      expected: DECISION_CONTEXT_CONTRACT_VERSION,
    });
  }
  return {
    contextId: ref.contextId,
    contractVersion: ref.contractVersion || DECISION_CONTEXT_CONTRACT_VERSION,
  };
}

function thinEosRef(ref, errors, field = 'evidenceOrchestrationRef') {
  if (ref == null) return null;
  if (!assertAllowlist(ref, ALLOWED_EOS_REF, field, errors)) return null;
  if (!isCanonicalUuid(ref.orchestrationId)) {
    errors.push({ field: `${field}.orchestrationId`, code: 'invalid_orchestration_id' });
  }
  if (ref.contractVersion != null && ref.contractVersion !== ORCHESTRATION_CONTRACT_VERSION) {
    errors.push({
      field: `${field}.contractVersion`,
      code: 'contract_version_mismatch',
      expected: ORCHESTRATION_CONTRACT_VERSION,
    });
  }
  return {
    orchestrationId: ref.orchestrationId,
    contractVersion: ref.contractVersion || ORCHESTRATION_CONTRACT_VERSION,
  };
}

function thinControlRef(ref, errors, field = 'controlChainRef') {
  if (ref == null) return null;
  if (!assertAllowlist(ref, ALLOWED_CONTROL_REF, field, errors)) return null;
  if (!isCanonicalUuid(ref.controlChainArtifactId)) {
    errors.push({ field: `${field}.controlChainArtifactId`, code: 'invalid_control_chain_id' });
  }
  if (ref.contractVersion != null && ref.contractVersion !== CONTROL_CHAIN_CONTRACT_VERSION) {
    errors.push({
      field: `${field}.contractVersion`,
      code: 'contract_version_mismatch',
      expected: CONTROL_CHAIN_CONTRACT_VERSION,
    });
  }
  return {
    controlChainArtifactId: ref.controlChainArtifactId,
    contractVersion: ref.contractVersion || CONTROL_CHAIN_CONTRACT_VERSION,
  };
}

function thinShadowRecordingRef(ref, errors, field = 'shadowRecordingRef') {
  if (ref == null) return null;
  if (!assertAllowlist(ref, ALLOWED_SHADOW_RECORDING_REF, field, errors)) return null;
  if (!isCanonicalUuid(ref.shadowRecordingArtifactId)) {
    errors.push({
      field: `${field}.shadowRecordingArtifactId`,
      code: 'invalid_shadow_recording_id',
    });
  }
  if (ref.contractVersion != null && ref.contractVersion !== SHADOW_RECORDING_CONTRACT_VERSION) {
    errors.push({
      field: `${field}.contractVersion`,
      code: 'contract_version_mismatch',
      expected: SHADOW_RECORDING_CONTRACT_VERSION,
    });
  }
  return {
    shadowRecordingArtifactId: ref.shadowRecordingArtifactId,
    contractVersion: ref.contractVersion || SHADOW_RECORDING_CONTRACT_VERSION,
  };
}

function thinMarketContextRef(ref, errors, field = 'marketContextRef') {
  if (ref == null) return null;
  if (!assertAllowlist(ref, ALLOWED_MARKET_CONTEXT_REF, field, errors)) return null;
  if (!isCanonicalUuid(ref.marketContextId)) {
    errors.push({ field: `${field}.marketContextId`, code: 'invalid_market_context_id' });
  }
  if (ref.sourceTimestamp != null && !isIsoTimestamp(ref.sourceTimestamp)) {
    errors.push({ field: `${field}.sourceTimestamp`, code: 'invalid_iso_timestamp' });
  }
  if (ref.contractVersion != null && ref.contractVersion !== MARKET_CONTEXT_CONTRACT_VERSION) {
    errors.push({
      field: `${field}.contractVersion`,
      code: 'contract_version_mismatch',
      expected: MARKET_CONTEXT_CONTRACT_VERSION,
    });
  }
  const out = {
    marketContextId: ref.marketContextId,
    contractVersion: ref.contractVersion || MARKET_CONTEXT_CONTRACT_VERSION,
  };
  if (ref.venue != null) out.venue = ref.venue;
  if (ref.marketType != null) out.marketType = ref.marketType;
  if (ref.symbol != null) out.symbol = ref.symbol;
  if (ref.timeframe != null) out.timeframe = ref.timeframe;
  if (ref.sourceTimestamp != null) out.sourceTimestamp = ref.sourceTimestamp;
  return out;
}

function thinTaskRef(ref, errors, field = 'taskRef') {
  if (ref == null) return null;
  if (!assertAllowlist(ref, ALLOWED_TASK_REF, field, errors)) return null;
  if (!isCanonicalUuid(ref.taskId)) {
    errors.push({ field: `${field}.taskId`, code: 'invalid_task_id' });
  }
  if (ref.attempt != null && (!Number.isInteger(ref.attempt) || ref.attempt < 1)) {
    errors.push({ field: `${field}.attempt`, code: 'invalid_attempt' });
  }
  if (ref.contractVersion != null && ref.contractVersion !== SHADOW_TASK_STATE_CONTRACT_VERSION) {
    errors.push({
      field: `${field}.contractVersion`,
      code: 'contract_version_mismatch',
      expected: SHADOW_TASK_STATE_CONTRACT_VERSION,
    });
  }
  const out = {
    taskId: ref.taskId,
    contractVersion: ref.contractVersion || SHADOW_TASK_STATE_CONTRACT_VERSION,
  };
  if (ref.attempt != null) out.attempt = ref.attempt;
  return out;
}

function thinBindingRef(ref, errors, field = 'bindingRef') {
  if (ref == null) return null;
  if (!assertAllowlist(ref, ALLOWED_BINDING_REF, field, errors)) return null;
  if (!isCanonicalUuid(ref.bindingId)) {
    errors.push({ field: `${field}.bindingId`, code: 'invalid_binding_id' });
  }
  if (
    ref.contractVersion != null
    && ref.contractVersion !== SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION
  ) {
    errors.push({
      field: `${field}.contractVersion`,
      code: 'contract_version_mismatch',
      expected: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
    });
  }
  return {
    bindingId: ref.bindingId,
    contractVersion: ref.contractVersion || SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
  };
}

function thinCycleRef(ref, errors, field = 'shadowCycleEnvelopeRef') {
  if (ref == null) return null;
  if (!assertAllowlist(ref, ALLOWED_CYCLE_REF, field, errors)) return null;
  if (!isCanonicalUuid(ref.shadowCycleEnvelopeId)) {
    errors.push({ field: `${field}.shadowCycleEnvelopeId`, code: 'invalid_cycle_id' });
  }
  if (ref.contractVersion != null && ref.contractVersion !== SHADOW_RUNTIME_CONTRACT_VERSION) {
    errors.push({
      field: `${field}.contractVersion`,
      code: 'contract_version_mismatch',
      expected: SHADOW_RUNTIME_CONTRACT_VERSION,
    });
  }
  return {
    shadowCycleEnvelopeId: ref.shadowCycleEnvelopeId,
    contractVersion: ref.contractVersion || SHADOW_RUNTIME_CONTRACT_VERSION,
  };
}

function thinOutcomeRef(ref, errors, field = 'outcomeRef') {
  if (ref == null) return null;
  if (!assertAllowlist(ref, ALLOWED_OUTCOME_REF, field, errors)) return null;
  if (!isCanonicalUuid(ref.outcomeId)) {
    errors.push({ field: `${field}.outcomeId`, code: 'invalid_outcome_id' });
  }
  if (ref.outcomeObservedAt != null && !isIsoTimestamp(ref.outcomeObservedAt)) {
    errors.push({ field: `${field}.outcomeObservedAt`, code: 'invalid_iso_timestamp' });
  }
  if (ref.recordedAt != null && !isIsoTimestamp(ref.recordedAt)) {
    errors.push({ field: `${field}.recordedAt`, code: 'invalid_iso_timestamp' });
  }
  if (ref.contractVersion != null && ref.contractVersion !== OBSERVED_OUTCOME_CONTRACT_VERSION) {
    errors.push({
      field: `${field}.contractVersion`,
      code: 'contract_version_mismatch',
      expected: OBSERVED_OUTCOME_CONTRACT_VERSION,
    });
  }
  const out = {
    outcomeId: ref.outcomeId,
    contractVersion: ref.contractVersion || OBSERVED_OUTCOME_CONTRACT_VERSION,
  };
  if (ref.outcomeObservedAt != null) out.outcomeObservedAt = ref.outcomeObservedAt;
  if (ref.recordedAt != null) out.recordedAt = ref.recordedAt;
  return out;
}

function thinEvaluationRef(ref, errors, field = 'evaluationRef') {
  if (ref == null) return null;
  if (!assertAllowlist(ref, ALLOWED_EVALUATION_REF, field, errors)) return null;
  if (!isCanonicalUuid(ref.evaluationId)) {
    errors.push({ field: `${field}.evaluationId`, code: 'invalid_evaluation_id' });
  }
  if (ref.recordedAt != null && !isIsoTimestamp(ref.recordedAt)) {
    errors.push({ field: `${field}.recordedAt`, code: 'invalid_iso_timestamp' });
  }
  if (
    ref.contractVersion != null
    && ref.contractVersion !== OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION
  ) {
    errors.push({
      field: `${field}.contractVersion`,
      code: 'contract_version_mismatch',
      expected: OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
    });
  }
  const out = {
    evaluationId: ref.evaluationId,
    contractVersion: ref.contractVersion || OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
  };
  if (ref.recordedAt != null) out.recordedAt = ref.recordedAt;
  return out;
}

function mergeOptionalRef(flat, section, idField, mismatchCode, field, errors) {
  if (flat == null) return section || null;
  if (section == null) return flat;
  if (flat[idField] !== section[idField]) {
    errors.push({ field, code: mismatchCode });
  }
  return { ...section, ...flat };
}

function decisionTimeMs(decisionRef) {
  if (!decisionRef) return null;
  if (isIsoTimestamp(decisionRef.analysisAt)) return parseIsoMs(decisionRef.analysisAt);
  if (isIsoTimestamp(decisionRef.createdAt)) return parseIsoMs(decisionRef.createdAt);
  return null;
}

function validateTemporalIntegrity({
  decisionRef,
  marketContextRef,
  outcomeRef,
  evaluationRef,
  recordedAt,
}, errors) {
  const decisionMs = decisionTimeMs(decisionRef);
  const lineageRecordedMs = isIsoTimestamp(recordedAt) ? parseIsoMs(recordedAt) : null;

  if (marketContextRef?.sourceTimestamp && decisionMs != null) {
    const sourceMs = parseIsoMs(marketContextRef.sourceTimestamp);
    if (Number.isFinite(sourceMs) && sourceMs > decisionMs) {
      errors.push({
        field: 'preDecision.marketContextRef.sourceTimestamp',
        code: 'pre_decision_after_decision',
      });
    }
  }

  if (outcomeRef) {
    const outcomeMs = isIsoTimestamp(outcomeRef.outcomeObservedAt)
      ? parseIsoMs(outcomeRef.outcomeObservedAt)
      : (isIsoTimestamp(outcomeRef.recordedAt) ? parseIsoMs(outcomeRef.recordedAt) : null);
    if (decisionMs != null && outcomeMs != null && outcomeMs < decisionMs) {
      errors.push({
        field: 'postDecision.outcomeRef.outcomeObservedAt',
        code: 'outcome_before_decision',
      });
    }
  }

  if (evaluationRef?.recordedAt) {
    const evalMs = parseIsoMs(evaluationRef.recordedAt);
    const outcomeAnchor = outcomeRef
      ? (isIsoTimestamp(outcomeRef.recordedAt)
        ? parseIsoMs(outcomeRef.recordedAt)
        : (isIsoTimestamp(outcomeRef.outcomeObservedAt)
          ? parseIsoMs(outcomeRef.outcomeObservedAt)
          : null))
      : null;
    if (outcomeAnchor != null && Number.isFinite(evalMs) && evalMs < outcomeAnchor) {
      errors.push({
        field: 'postDecision.evaluationRef.recordedAt',
        code: 'evaluation_before_outcome',
      });
    }
    if (decisionMs != null && Number.isFinite(evalMs) && evalMs < decisionMs) {
      errors.push({
        field: 'postDecision.evaluationRef.recordedAt',
        code: 'evaluation_before_decision',
      });
    }
  }

  if (decisionMs != null && lineageRecordedMs != null && lineageRecordedMs < decisionMs) {
    errors.push({
      field: 'recordedAt',
      code: 'lineage_recorded_before_decision',
    });
  }
}

function validateProvenance(provenance, recordedAt, errors) {
  if (provenance == null) return null;
  if (!assertAllowlist(provenance, ALLOWED_PROVENANCE, 'provenance', errors)) return null;
  assertString('provenance.writer', provenance.writer, errors);
  assertString('provenance.methodKey', provenance.methodKey, errors);
  assertString('provenance.stage', provenance.stage, errors);
  if (provenance.recordedAt != null && !isIsoTimestamp(provenance.recordedAt)) {
    errors.push({ field: 'provenance.recordedAt', code: 'invalid_iso_timestamp' });
  }
  if (
    provenance.recordedAt != null
    && isIsoTimestamp(recordedAt)
    && provenance.recordedAt !== recordedAt
  ) {
    errors.push({ field: 'provenance.recordedAt', code: 'provenance_recorded_at_mismatch' });
  }
  assertString('provenance.policyVersion', provenance.policyVersion, errors);
  assertString('provenance.implementationVersion', provenance.implementationVersion, errors);
  assertString('provenance.note', provenance.note, errors);
  return {
    writer: provenance.writer ?? DECISION_LINEAGE_WRITER,
    methodKey: provenance.methodKey ?? DECISION_LINEAGE_METHOD_KEY,
    stage: provenance.stage ?? DECISION_LINEAGE_STAGE,
    recordedAt: provenance.recordedAt ?? recordedAt,
    policyVersion: provenance.policyVersion ?? DECISION_LINEAGE_POLICY_VERSION,
    implementationVersion:
      provenance.implementationVersion ?? DECISION_LINEAGE_IMPLEMENTATION_VERSION,
    ...(provenance.note != null ? { note: provenance.note } : {}),
  };
}

function computeReconstructability({
  decisionRef,
  decisionContextRef,
  shadowRecordingRef,
  evidenceOrchestrationRef,
  controlChainRef,
  marketContextRef,
}) {
  if (!decisionRef?.decisionId) return RECONSTRUCTABILITY_STATUS.INSUFFICIENT;
  const hasContext = Boolean(decisionContextRef?.contextId);
  const hasRecording = Boolean(shadowRecordingRef?.shadowRecordingArtifactId);
  const hasEvidence = Boolean(evidenceOrchestrationRef?.orchestrationId);
  const hasControl = Boolean(controlChainRef?.controlChainArtifactId);
  const hasMarket = Boolean(marketContextRef?.marketContextId);
  if (hasContext && hasRecording && (hasEvidence || hasControl || hasMarket)) {
    return RECONSTRUCTABILITY_STATUS.COMPLETE;
  }
  if (hasContext || hasRecording || hasEvidence || hasControl || hasMarket) {
    return RECONSTRUCTABILITY_STATUS.PARTIAL;
  }
  return RECONSTRUCTABILITY_STATUS.INSUFFICIENT;
}

function buildVersions({
  hasContext,
  hasEos,
  hasControl,
  hasRecording,
  hasMarket,
  hasTask,
  hasBinding,
  hasCycle,
  hasOutcome,
  hasEvaluation,
}) {
  const versions = {
    decisionContractVersion: DECISION_CONTRACT_VERSION,
    decisionLineageContractVersion: DECISION_LINEAGE_CONTRACT_VERSION,
    evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
  };
  if (hasContext) versions.decisionContextContractVersion = DECISION_CONTEXT_CONTRACT_VERSION;
  if (hasEos) versions.orchestrationContractVersion = ORCHESTRATION_CONTRACT_VERSION;
  if (hasControl) versions.controlChainContractVersion = CONTROL_CHAIN_CONTRACT_VERSION;
  if (hasRecording) versions.shadowRecordingContractVersion = SHADOW_RECORDING_CONTRACT_VERSION;
  if (hasMarket) {
    versions.marketContextContractVersion = MARKET_CONTEXT_CONTRACT_VERSION;
    versions.marketContextSotContractVersion = MARKET_CONTEXT_SOT_CONTRACT_VERSION;
  }
  if (hasCycle) versions.shadowRuntimeContractVersion = SHADOW_RUNTIME_CONTRACT_VERSION;
  if (hasTask) {
    versions.shadowTaskStateContractVersion = SHADOW_TASK_STATE_CONTRACT_VERSION;
    versions.shadowTaskStateActivationContractVersion =
      SHADOW_TASK_STATE_ACTIVATION_CONTRACT_VERSION;
  }
  if (hasBinding) {
    versions.shadowTaskCycleBindingContractVersion =
      SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION;
  }
  if (hasOutcome) {
    versions.observedOutcomeContractVersion = OBSERVED_OUTCOME_CONTRACT_VERSION;
    versions.observedOutcomeSotContractVersion = OBSERVED_OUTCOME_SOT_CONTRACT_VERSION;
  }
  if (hasEvaluation) {
    versions.observedOutcomeEvaluationContractVersion =
      OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION;
    versions.observedOutcomeEvaluationSotContractVersion =
      OBSERVED_OUTCOME_EVALUATION_SOT_CONTRACT_VERSION;
  }
  return versions;
}

/**
 * Compose/validate one Decision Lineage artifact (library-only).
 *
 * @param {object} input
 * @returns {{ ok: true, code: string, message: string, artifact: object, sideEffects: object, bytes: number }
 *   | { ok: false, code: string, message: string, artifact: null, errors?: object[] }}
 */
export function buildDecisionLineage(input = {}) {
  const errors = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Decision Lineage input object required');
  }

  const forbiddenHits = collectForbiddenKeysDeep(input);
  for (const key of forbiddenHits) {
    errors.push({ field: key, code: 'forbidden_field' });
  }
  const secretHits = collectForbiddenSecretKeys(input);
  for (const key of secretHits) {
    errors.push({ field: key, code: 'secret_field_forbidden' });
  }
  if (errors.length) {
    return fail('forbidden_field', 'Decision Lineage input contains forbidden fields', { errors });
  }

  if (!assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors)) {
    return fail('unknown_field', 'Decision Lineage input contains unknown fields', { errors });
  }

  validateHardFlagsOnInput(input, errors);

  if (!isIsoTimestamp(input.recordedAt)) {
    errors.push({
      field: 'recordedAt',
      code: input.recordedAt == null ? 'required_recorded_at' : 'invalid_iso_timestamp',
    });
  }

  if (input.implementationVersion != null) {
    assertString('implementationVersion', input.implementationVersion, errors);
  }

  if (
    input.expectedReconstructabilityStatus != null
    && !RECONSTRUCTABILITY_SET.has(input.expectedReconstructabilityStatus)
  ) {
    errors.push({
      field: 'expectedReconstructabilityStatus',
      code: 'invalid_reconstructability_status',
    });
  }

  if (input.preDecision != null) {
    if (!assertAllowlist(input.preDecision, ALLOWED_PRE_DECISION, 'preDecision', errors)) {
      // already recorded
    }
    rejectPreDecisionContamination(input.preDecision, 'preDecision', errors);
  }
  if (input.decision != null) {
    assertAllowlist(input.decision, ALLOWED_DECISION_SECTION, 'decision', errors);
    rejectPreDecisionContamination(input.decision, 'decision', errors);
  }
  if (input.postDecision != null) {
    assertAllowlist(input.postDecision, ALLOWED_POST_DECISION, 'postDecision', errors);
  }

  const flatDecisionRef = input.decisionRef != null
    ? thinDecisionRef(input.decisionRef, errors, 'decisionRef')
    : null;
  const sectionDecisionRef = input.decision?.decisionRef != null
    ? thinDecisionRef(input.decision.decisionRef, errors, 'decision.decisionRef')
    : null;
  const decisionRef = mergeOptionalRef(
    flatDecisionRef,
    sectionDecisionRef,
    'decisionId',
    'decision_id_mismatch',
    'decision.decisionRef',
    errors,
  );
  if (decisionRef == null) {
    errors.push({ field: 'decisionRef', code: 'required_decision_ref' });
  }

  const decisionContextRef = mergeOptionalRef(
    thinContextRef(input.decisionContextRef, errors, 'decisionContextRef'),
    thinContextRef(input.preDecision?.decisionContextRef, errors, 'preDecision.decisionContextRef'),
    'contextId',
    'context_id_mismatch',
    'decisionContextRef',
    errors,
  );
  const evidenceOrchestrationRef = mergeOptionalRef(
    thinEosRef(input.evidenceOrchestrationRef, errors, 'evidenceOrchestrationRef'),
    thinEosRef(
      input.preDecision?.evidenceOrchestrationRef,
      errors,
      'preDecision.evidenceOrchestrationRef',
    ),
    'orchestrationId',
    'orchestration_id_mismatch',
    'evidenceOrchestrationRef',
    errors,
  );
  const controlChainRef = mergeOptionalRef(
    thinControlRef(input.controlChainRef, errors, 'controlChainRef'),
    thinControlRef(input.preDecision?.controlChainRef, errors, 'preDecision.controlChainRef'),
    'controlChainArtifactId',
    'control_chain_id_mismatch',
    'controlChainRef',
    errors,
  );
  const marketContextRef = mergeOptionalRef(
    thinMarketContextRef(input.marketContextRef, errors, 'marketContextRef'),
    thinMarketContextRef(
      input.preDecision?.marketContextRef,
      errors,
      'preDecision.marketContextRef',
    ),
    'marketContextId',
    'market_context_id_mismatch',
    'marketContextRef',
    errors,
  );

  const shadowRecordingRef = mergeOptionalRef(
    thinShadowRecordingRef(input.shadowRecordingRef, errors, 'shadowRecordingRef'),
    thinShadowRecordingRef(
      input.decision?.shadowRecordingRef,
      errors,
      'decision.shadowRecordingRef',
    ),
    'shadowRecordingArtifactId',
    'shadow_recording_id_mismatch',
    'shadowRecordingRef',
    errors,
  );
  const taskRef = mergeOptionalRef(
    thinTaskRef(input.taskRef, errors, 'taskRef'),
    thinTaskRef(input.decision?.taskRef, errors, 'decision.taskRef'),
    'taskId',
    'task_id_mismatch',
    'taskRef',
    errors,
  );
  const bindingRef = mergeOptionalRef(
    thinBindingRef(input.bindingRef, errors, 'bindingRef'),
    thinBindingRef(input.decision?.bindingRef, errors, 'decision.bindingRef'),
    'bindingId',
    'binding_id_mismatch',
    'bindingRef',
    errors,
  );
  const shadowCycleEnvelopeRef = mergeOptionalRef(
    thinCycleRef(input.shadowCycleEnvelopeRef, errors, 'shadowCycleEnvelopeRef'),
    thinCycleRef(
      input.decision?.shadowCycleEnvelopeRef,
      errors,
      'decision.shadowCycleEnvelopeRef',
    ),
    'shadowCycleEnvelopeId',
    'cycle_id_mismatch',
    'shadowCycleEnvelopeRef',
    errors,
  );

  const outcomeRef = mergeOptionalRef(
    thinOutcomeRef(input.outcomeRef, errors, 'outcomeRef'),
    thinOutcomeRef(input.postDecision?.outcomeRef, errors, 'postDecision.outcomeRef'),
    'outcomeId',
    'outcome_id_mismatch',
    'outcomeRef',
    errors,
  );
  const evaluationRef = mergeOptionalRef(
    thinEvaluationRef(input.evaluationRef, errors, 'evaluationRef'),
    thinEvaluationRef(input.postDecision?.evaluationRef, errors, 'postDecision.evaluationRef'),
    'evaluationId',
    'evaluation_id_mismatch',
    'evaluationRef',
    errors,
  );

  if (
    decisionRef?.decisionContextId != null
    && decisionContextRef?.contextId != null
    && decisionRef.decisionContextId !== decisionContextRef.contextId
  ) {
    errors.push({ field: 'decisionContextRef.contextId', code: 'context_id_mismatch' });
  }

  if (evaluationRef != null && outcomeRef == null) {
    errors.push({
      field: 'evaluationRef',
      code: 'evaluation_requires_outcome_descendant',
    });
  }

  validateTemporalIntegrity({
    decisionRef,
    marketContextRef,
    outcomeRef,
    evaluationRef,
    recordedAt: input.recordedAt,
  }, errors);

  const implementationVersion =
    input.implementationVersion || DECISION_LINEAGE_IMPLEMENTATION_VERSION;

  const provenance = validateProvenance(input.provenance, input.recordedAt, errors)
    || {
      writer: DECISION_LINEAGE_WRITER,
      methodKey: DECISION_LINEAGE_METHOD_KEY,
      stage: DECISION_LINEAGE_STAGE,
      recordedAt: input.recordedAt,
      policyVersion: DECISION_LINEAGE_POLICY_VERSION,
      implementationVersion,
    };

  let limitations = [...DECISION_LINEAGE_LIMITATIONS];
  if (input.limitations != null) {
    if (!Array.isArray(input.limitations)) {
      errors.push({ field: 'limitations', code: 'invalid_limitations_array' });
    } else if (input.limitations.length > MAX_LIMITATIONS) {
      errors.push({ field: 'limitations', code: 'too_many_limitations', max: MAX_LIMITATIONS });
    } else {
      for (let i = 0; i < input.limitations.length; i += 1) {
        assertString(`limitations[${i}]`, input.limitations[i], errors, { required: true });
      }
      if (!errors.some((e) => String(e.field).startsWith('limitations'))) {
        limitations = [...new Set([...DECISION_LINEAGE_LIMITATIONS, ...input.limitations])];
      }
    }
  }

  if (errors.length) {
    return fail('validation_failed', 'Decision Lineage validation failed', { errors });
  }

  const lineageId = hashToUuid([
    DECISION_LINEAGE_CONTRACT_VERSION,
    DECISION_LINEAGE_METHOD_KEY,
    decisionRef.decisionId,
    decisionContextRef?.contextId || '',
    evidenceOrchestrationRef?.orchestrationId || '',
    controlChainRef?.controlChainArtifactId || '',
    shadowRecordingRef?.shadowRecordingArtifactId || '',
    marketContextRef?.marketContextId || '',
    taskRef?.taskId || '',
    bindingRef?.bindingId || '',
    shadowCycleEnvelopeRef?.shadowCycleEnvelopeId || '',
    outcomeRef?.outcomeId || '',
    evaluationRef?.evaluationId || '',
    implementationVersion,
  ]);

  if (input.lineageId != null) {
    if (!isCanonicalUuid(input.lineageId)) {
      return fail('invalid_lineage_id', 'Caller-supplied lineageId is not a canonical UUID', {
        errors: [{ field: 'lineageId', code: 'invalid_uuid' }],
      });
    }
    if (input.lineageId !== lineageId) {
      return fail('lineage_id_conflict', 'Caller-supplied lineageId conflicts with computed identity', {
        errors: [{
          field: 'lineageId',
          code: 'lineage_id_conflict',
          expected: lineageId,
          received: input.lineageId,
        }],
      });
    }
  }

  const reconstructabilityStatus = computeReconstructability({
    decisionRef,
    decisionContextRef,
    shadowRecordingRef,
    evidenceOrchestrationRef,
    controlChainRef,
    marketContextRef,
  });

  if (
    input.expectedReconstructabilityStatus != null
    && input.expectedReconstructabilityStatus !== reconstructabilityStatus
  ) {
    return fail(
      'reconstructability_mismatch',
      'Expected reconstructabilityStatus does not match computed status',
      {
        errors: [{
          field: 'expectedReconstructabilityStatus',
          code: 'reconstructability_mismatch',
          expected: reconstructabilityStatus,
          received: input.expectedReconstructabilityStatus,
        }],
      },
    );
  }

  const preDecision = {};
  if (decisionContextRef) preDecision.decisionContextRef = decisionContextRef;
  if (evidenceOrchestrationRef) preDecision.evidenceOrchestrationRef = evidenceOrchestrationRef;
  if (controlChainRef) preDecision.controlChainRef = controlChainRef;
  if (marketContextRef) preDecision.marketContextRef = marketContextRef;

  const decision = { decisionRef };
  if (shadowRecordingRef) decision.shadowRecordingRef = shadowRecordingRef;
  if (taskRef) decision.taskRef = taskRef;
  if (bindingRef) decision.bindingRef = bindingRef;
  if (shadowCycleEnvelopeRef) decision.shadowCycleEnvelopeRef = shadowCycleEnvelopeRef;

  const postDecision = {};
  if (outcomeRef) postDecision.outcomeRef = outcomeRef;
  if (evaluationRef) postDecision.evaluationRef = evaluationRef;

  const versions = buildVersions({
    hasContext: Boolean(decisionContextRef),
    hasEos: Boolean(evidenceOrchestrationRef),
    hasControl: Boolean(controlChainRef),
    hasRecording: Boolean(shadowRecordingRef),
    hasMarket: Boolean(marketContextRef),
    hasTask: Boolean(taskRef),
    hasBinding: Boolean(bindingRef),
    hasCycle: Boolean(shadowCycleEnvelopeRef),
    hasOutcome: Boolean(outcomeRef),
    hasEvaluation: Boolean(evaluationRef),
  });

  if (!assertAllowlist(versions, ALLOWED_VERSIONS, 'versions', errors)) {
    return fail('artifact_shape_invalid', 'Decision Lineage versions shape invalid', { errors });
  }

  const artifact = {
    schemaVersion: DECISION_LINEAGE_SCHEMA_VERSION,
    contractVersion: DECISION_LINEAGE_CONTRACT_VERSION,
    policyVersion: DECISION_LINEAGE_POLICY_VERSION,
    artifactType: DECISION_LINEAGE_ARTIFACT_TYPE,
    authorityClass: DECISION_LINEAGE_AUTHORITY_CLASS,
    sliceId: DECISION_LINEAGE_SLICE_ID,
    lineageId,
    recordedAt: input.recordedAt,
    preDecision,
    decision,
    postDecision,
    versions,
    reconstructabilityStatus,
    provenance,
    limitations,
    sideEffects: { ...ZERO_LINEAGE_SIDE_EFFECTS },
    ownershipRole: DECISION_LINEAGE_OWNERSHIP_ROLE,
    isSourceOfTruth: DECISION_LINEAGE_IS_SOURCE_OF_TRUTH,
    implementationVersion,
    ...REQUIRED_HARD_FLAGS,
  };

  if (!assertAllowlist(artifact, ALLOWED_ARTIFACT_TOP, 'artifact', errors)) {
    return fail('artifact_shape_invalid', 'Decision Lineage artifact shape invalid', { errors });
  }

  const bytes = utf8ByteLength(JSON.stringify(artifact));
  if (bytes > MAX_LINEAGE_UTF8_BYTES) {
    return fail('artifact_too_large', 'Decision Lineage artifact exceeds size bound', {
      errors: [{
        field: 'artifact',
        code: 'artifact_too_large',
        bytes,
        max: MAX_LINEAGE_UTF8_BYTES,
      }],
    });
  }

  return {
    ok: true,
    code: 'DECISION_LINEAGE_BUILT',
    message: 'Decision Lineage artifact validated',
    artifact: freezeDeep(artifact),
    sideEffects: { ...ZERO_LINEAGE_SIDE_EFFECTS },
    bytes,
  };
}

/** Compatible alias — single canonical builder surface. */
export function validateDecisionLineage(input = {}) {
  return buildDecisionLineage(input);
}

export default {
  DECISION_LINEAGE_STAGE,
  DECISION_LINEAGE_SLICE_ID,
  DECISION_LINEAGE_SCHEMA_VERSION,
  DECISION_LINEAGE_CONTRACT_VERSION,
  DECISION_LINEAGE_POLICY_VERSION,
  DECISION_LINEAGE_WRITER,
  DECISION_LINEAGE_METHOD_KEY,
  DECISION_LINEAGE_ARTIFACT_TYPE,
  DECISION_LINEAGE_AUTHORITY_CLASS,
  DECISION_LINEAGE_OWNERSHIP_ROLE,
  DECISION_LINEAGE_IS_SOURCE_OF_TRUTH,
  DECISION_LINEAGE_IMPLEMENTATION_VERSION,
  RECONSTRUCTABILITY_STATUS,
  REQUIRED_HARD_FLAGS,
  ZERO_LINEAGE_SIDE_EFFECTS,
  DECISION_LINEAGE_LIMITATIONS,
  buildDecisionLineage,
  validateDecisionLineage,
};
