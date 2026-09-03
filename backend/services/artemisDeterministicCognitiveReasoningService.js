/**
 * Artemis Core Stage 7.2.b.2 — Deterministic Cognitive Reasoning Pipeline.
 *
 * Rule-based analytical layer over:
 *   Decision Context (7.1)
 *     + Cognitive Kernel Contract input (7.2.a)
 *     + EvidenceOrchestrationSet (Stage 6)
 *     + Cognitive Engine Interface (7.2.b.1)
 *
 * Produces a Cognitive Analysis Result. Library-only.
 *
 * Does NOT:
 * - call LLMs / AI providers / prompts / model adapters
 * - majority, weighted, or confidence averaging
 * - synthesize BUY/SELL/EXECUTE authority
 * - authorize execution, orders, wallet, or Live trading
 * - write DB / Redis
 * - modify legacy artemisOrchestrator or POST /api/v1/artemis/decision
 * - start the full Cognitive Engine product (cognitiveEngineStarted remains false)
 */

import {
  DECISION_CONTEXT_CONTRACT_VERSION,
} from '../contracts/artemisDecisionContextContract.js';
import {
  KERNEL_CONTRACT_VERSION,
  validateCognitiveKernelInput,
} from '../contracts/artemisCognitiveKernelContract.js';
import {
  CONFLICT_KIND,
  CONFLICT_SEVERITY,
  ORCHESTRATION_CONTRACT_VERSION,
} from '../contracts/artemisEvidenceOrchestrationContract.js';
import { INGESTION_DISPOSITION } from '../contracts/artemisEvidenceIngestionContract.js';
import {
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from '../contracts/artemisEvidenceContract.js';
import {
  ENGINE_ABSTENTION_STATE,
  ENGINE_INTERFACE_CONTRACT_VERSION,
  ENGINE_INTERFACE_LIMITATIONS,
  ENGINE_INTERFACE_SCHEMA_VERSION,
  ENGINE_INTERFACE_STAGE,
  ENGINE_UNCERTAINTY_STATE,
  FORBIDDEN_ENGINE_REQUEST_KEYS,
  FORBIDDEN_EXECUTION_AUTHORITY_VALUES,
  ZERO_ENGINE_INTERFACE_SIDE_EFFECTS,
  validateCognitiveAnalysisResult,
  validateCognitiveEngineInterfaceRequest,
} from '../contracts/artemisCognitiveEngineInterfaceContract.js';

export const DETERMINISTIC_REASONING_STAGE = '7.2.b.2';
export const DETERMINISTIC_REASONING_POLICY_VERSION = 'stage7-2b2-deterministic-reasoning-1.0.0';
export const DETERMINISTIC_REASONING_WRITER = 'artemisDeterministicCognitiveReasoningService';
export const DETERMINISTIC_REASONING_METHOD_KEY = 'deterministic_rule_pipeline_v1';
export const MAX_REASONING_UTF8_BYTES = 48 * 1024;

export const DETERMINISTIC_REASONING_LIMITATIONS = Object.freeze([
  'stage7_2b2_deterministic_reasoning_only',
  'no_llm_provider_calls',
  'no_model_prompts',
  'no_model_adapters',
  'no_majority_voting',
  'no_weighted_voting',
  'no_confidence_averaging',
  'conflicts_represented_not_voted',
  'unavailable_blocked_not_neutral',
  'missing_evidence_not_negative',
  'no_execution_authorization',
  'no_order_intent',
  'cognitive_engine_product_not_started',
  'live_trading_not_authorized',
]);

const FORBIDDEN_TOP_KEYS = Object.freeze([
  ...FORBIDDEN_ENGINE_REQUEST_KEYS,
  'rawAgentOutput',
  'raw_agent_output',
  'providerPayload',
  'modelResponse',
  'prompt',
]);

const STALE_DISPOSITIONS = new Set([
  INGESTION_DISPOSITION.REJECTED_STALE,
  INGESTION_DISPOSITION.REJECTED_EXPIRED,
]);

const INCOMPATIBLE_CONFLICT_KINDS = new Set([
  CONFLICT_KIND.TIMEFRAME_MISMATCH,
  CONFLICT_KIND.HORIZON_MISMATCH,
  CONFLICT_KIND.CONTEXT_MISMATCH,
  CONFLICT_KIND.AUTHORITY_ROLE_INCOMPATIBILITY,
]);

const DIRECTIONAL_CONFLICT_KINDS = new Set([
  CONFLICT_KIND.DIRECTIONAL_DISAGREEMENT,
  CONFLICT_KIND.CORRELATED_FAMILY_DISAGREEMENT,
  CONFLICT_KIND.SAME_AGENT_MULTIPLE_RECORDS,
]);

function fail(code, message, extra = {}) {
  return { ok: false, code, message, result: null, ...extra };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cmpStr(a, b) {
  return String(a).localeCompare(String(b));
}

function uniqueSorted(values) {
  return [...new Set(values.filter((v) => v != null && v !== ''))].sort(cmpStr);
}

function rejectForbiddenKeys(obj, errors, path = '') {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => rejectForbiddenKeys(item, errors, `${path}[${i}]`));
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    const next = path ? `${path}.${key}` : key;
    if (FORBIDDEN_TOP_KEYS.includes(key)) {
      errors.push({ field: next, code: 'forbidden_execution_or_provider_field' });
    } else if (value && typeof value === 'object') {
      rejectForbiddenKeys(value, errors, next);
    }
  }
}

function rejectExecutionAuthorityStrings(obj, errors, path = '') {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => rejectExecutionAuthorityStrings(item, errors, `${path}[${i}]`));
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    const next = path ? `${path}.${key}` : key;
    if (typeof value === 'string' && FORBIDDEN_EXECUTION_AUTHORITY_VALUES.includes(value)) {
      errors.push({ field: next, code: 'forbidden_execution_authority_value', value });
    } else if (value && typeof value === 'object') {
      rejectExecutionAuthorityStrings(value, errors, next);
    }
  }
}

function normalizeId(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Validate a frozen Stage 7.1 Decision Context artifact (not rebuild).
 */
function validateFrozenDecisionContext(decisionContext, errors) {
  if (!decisionContext || typeof decisionContext !== 'object' || Array.isArray(decisionContext)) {
    errors.push({ field: 'decisionContext', code: 'required_object' });
    return null;
  }
  if (decisionContext.contractVersion !== DECISION_CONTEXT_CONTRACT_VERSION) {
    errors.push({
      field: 'decisionContext.contractVersion',
      code: 'incompatible_decision_context_contract',
      expected: DECISION_CONTEXT_CONTRACT_VERSION,
    });
  }
  if (!isCanonicalUuid(decisionContext.contextId)) {
    errors.push({ field: 'decisionContext.contextId', code: 'invalid_uuid' });
  }
  const orchIds = asArray(decisionContext.evidenceReferences?.orchestrationSetIds);
  if (orchIds.length < 1) {
    errors.push({
      field: 'decisionContext.evidenceReferences.orchestrationSetIds',
      code: 'required_non_empty',
    });
  }
  orchIds.forEach((id, index) => {
    if (!isCanonicalUuid(id)) {
      errors.push({
        field: `decisionContext.evidenceReferences.orchestrationSetIds[${index}]`,
        code: 'invalid_uuid',
      });
    }
  });
  return decisionContext;
}

function validateOrchestrationSets(orchestrationSets, errors) {
  if (!Array.isArray(orchestrationSets) || orchestrationSets.length < 1) {
    errors.push({ field: 'orchestrationSets', code: 'required_non_empty' });
    return [];
  }
  const validated = [];
  const seen = new Set();
  orchestrationSets.forEach((set, index) => {
    const prefix = `orchestrationSets[${index}]`;
    if (!set || typeof set !== 'object' || Array.isArray(set)) {
      errors.push({ field: prefix, code: 'must_be_object' });
      return;
    }
    if (set.contractVersion !== ORCHESTRATION_CONTRACT_VERSION) {
      errors.push({
        field: `${prefix}.contractVersion`,
        code: 'incompatible_orchestration_contract',
        expected: ORCHESTRATION_CONTRACT_VERSION,
      });
    }
    if (!isCanonicalUuid(set.orchestrationId)) {
      errors.push({ field: `${prefix}.orchestrationId`, code: 'invalid_uuid' });
      return;
    }
    const id = normalizeId(set.orchestrationId);
    if (seen.has(id)) {
      errors.push({ field: `${prefix}.orchestrationId`, code: 'duplicate_orchestration_set_id' });
    }
    seen.add(id);
    if (!Array.isArray(set.includedEvidence)) {
      errors.push({ field: `${prefix}.includedEvidence`, code: 'must_be_array' });
    }
    if (!Array.isArray(set.excludedEvidence)) {
      errors.push({ field: `${prefix}.excludedEvidence`, code: 'must_be_array' });
    }
    if (!Array.isArray(set.missingEvidence)) {
      errors.push({ field: `${prefix}.missingEvidence`, code: 'must_be_array' });
    }
    if (!Array.isArray(set.conflicts)) {
      errors.push({ field: `${prefix}.conflicts`, code: 'must_be_array' });
    }
    validated.push(set);
  });
  return validated;
}

function assertIdSetsEqual(left, right, field, errors) {
  const a = uniqueSorted(left.map(normalizeId).filter(Boolean));
  const b = uniqueSorted(right.map(normalizeId).filter(Boolean));
  if (a.join(',') !== b.join(',')) {
    errors.push({ field, code: 'orchestration_set_id_mismatch', expected: b, actual: a });
  }
}

function flattenAnalysis(sets) {
  const included = [];
  const excluded = [];
  const missing = [];
  const conflicts = [];
  for (const set of sets) {
    included.push(...asArray(set.includedEvidence));
    excluded.push(...asArray(set.excludedEvidence));
    missing.push(...asArray(set.missingEvidence));
    conflicts.push(...asArray(set.conflicts));
  }
  conflicts.sort((a, b) => cmpStr(a?.conflictId || a?.kind, b?.conflictId || b?.kind));
  return { included, excluded, missing, conflicts };
}

function conflictKind(conflict) {
  return conflict?.kind || conflict?.conflictKind || null;
}

function conflictSeverity(conflict) {
  return conflict?.severity || conflict?.conflictSeverity || null;
}

function isBlockedExcluded(item) {
  return item?.disposition === INGESTION_DISPOSITION.BLOCKED
    || item?.semantics === 'blocked_not_neutral';
}

function isUnavailableExcluded(item) {
  return item?.disposition === INGESTION_DISPOSITION.UNAVAILABLE
    || item?.semantics === 'unavailable_not_neutral';
}

function isStaleExcluded(item) {
  return STALE_DISPOSITIONS.has(item?.disposition)
    || item?.semantics === 'stale_or_expired_not_current';
}

/**
 * Deterministic uncertainty / abstention classification.
 * Priority is fail-closed and explicit; conflicts are represented, never voted.
 */
export function classifyDeterministicUncertainty(analysis) {
  const { included, excluded, missing, conflicts } = analysis;
  const blocking = conflicts.filter((c) => conflictSeverity(c) === CONFLICT_SEVERITY.BLOCKING);
  const material = conflicts.filter((c) => conflictSeverity(c) === CONFLICT_SEVERITY.MATERIAL);

  const blockingFreshness = blocking.filter(
    (c) => conflictKind(c) === CONFLICT_KIND.FRESHNESS_INCOMPATIBILITY,
  );
  if (blockingFreshness.length) {
    return {
      uncertaintyState: ENGINE_UNCERTAINTY_STATE.STALE_CONTEXT,
      abstentionState: ENGINE_ABSTENTION_STATE.ABSTAIN_STALE,
      ruleKey: 'blocking_freshness_incompatibility',
      conflictKinds: uniqueSorted(blockingFreshness.map(conflictKind)),
    };
  }

  const blockingIncompatible = blocking.filter((c) => INCOMPATIBLE_CONFLICT_KINDS.has(conflictKind(c)));
  if (blockingIncompatible.length) {
    return {
      uncertaintyState: ENGINE_UNCERTAINTY_STATE.INCOMPATIBLE_EVIDENCE,
      abstentionState: ENGINE_ABSTENTION_STATE.ABSTAIN_INCOMPATIBLE,
      ruleKey: 'blocking_incompatible_conflict',
      conflictKinds: uniqueSorted(blockingIncompatible.map(conflictKind)),
    };
  }

  const blockingDirectional = blocking.filter((c) => DIRECTIONAL_CONFLICT_KINDS.has(conflictKind(c)));
  if (blockingDirectional.length) {
    return {
      uncertaintyState: ENGINE_UNCERTAINTY_STATE.CONFLICTING_EVIDENCE,
      abstentionState: ENGINE_ABSTENTION_STATE.ABSTAIN_CONFLICT,
      ruleKey: 'blocking_directional_conflict_represented',
      conflictKinds: uniqueSorted(blockingDirectional.map(conflictKind)),
    };
  }

  if (blocking.length) {
    return {
      uncertaintyState: ENGINE_UNCERTAINTY_STATE.BLOCKED,
      abstentionState: ENGINE_ABSTENTION_STATE.ABSTAIN_BLOCKED,
      ruleKey: 'blocking_conflict_generic',
      conflictKinds: uniqueSorted(blocking.map(conflictKind)),
    };
  }

  if (included.length === 0 && excluded.some(isBlockedExcluded)) {
    return {
      uncertaintyState: ENGINE_UNCERTAINTY_STATE.BLOCKED,
      abstentionState: ENGINE_ABSTENTION_STATE.ABSTAIN_BLOCKED,
      ruleKey: 'excluded_blocked_without_usable_included',
      conflictKinds: [],
    };
  }

  if (included.length === 0 && excluded.some(isUnavailableExcluded)) {
    return {
      uncertaintyState: ENGINE_UNCERTAINTY_STATE.UNAVAILABLE,
      abstentionState: ENGINE_ABSTENTION_STATE.ABSTAIN_UNAVAILABLE,
      ruleKey: 'excluded_unavailable_without_usable_included',
      conflictKinds: [],
    };
  }

  if (included.length === 0 && excluded.some(isStaleExcluded)) {
    return {
      uncertaintyState: ENGINE_UNCERTAINTY_STATE.STALE_CONTEXT,
      abstentionState: ENGINE_ABSTENTION_STATE.ABSTAIN_STALE,
      ruleKey: 'excluded_stale_without_usable_included',
      conflictKinds: [],
    };
  }

  if (included.length === 0) {
    return {
      uncertaintyState: ENGINE_UNCERTAINTY_STATE.INSUFFICIENT_EVIDENCE,
      abstentionState: ENGINE_ABSTENTION_STATE.ABSTAIN_INSUFFICIENT,
      ruleKey: 'missing_or_empty_included_evidence',
      conflictKinds: [],
      missingCount: missing.length,
    };
  }

  const materialDirectional = material.filter((c) => DIRECTIONAL_CONFLICT_KINDS.has(conflictKind(c)));
  if (materialDirectional.length) {
    return {
      uncertaintyState: ENGINE_UNCERTAINTY_STATE.CONFLICTING_EVIDENCE,
      abstentionState: ENGINE_ABSTENTION_STATE.ABSTAIN_CONFLICT,
      ruleKey: 'material_directional_conflict_represented_not_voted',
      conflictKinds: uniqueSorted(materialDirectional.map(conflictKind)),
    };
  }

  const materialFreshness = material.filter(
    (c) => conflictKind(c) === CONFLICT_KIND.FRESHNESS_INCOMPATIBILITY,
  );
  if (materialFreshness.length) {
    return {
      uncertaintyState: ENGINE_UNCERTAINTY_STATE.STALE_CONTEXT,
      abstentionState: ENGINE_ABSTENTION_STATE.ABSTAIN_STALE,
      ruleKey: 'material_freshness_incompatibility',
      conflictKinds: uniqueSorted(materialFreshness.map(conflictKind)),
    };
  }

  const materialIncompatible = material.filter((c) => INCOMPATIBLE_CONFLICT_KINDS.has(conflictKind(c)));
  if (materialIncompatible.length) {
    return {
      uncertaintyState: ENGINE_UNCERTAINTY_STATE.INCOMPATIBLE_EVIDENCE,
      abstentionState: ENGINE_ABSTENTION_STATE.ABSTAIN_INCOMPATIBLE,
      ruleKey: 'material_incompatible_conflict',
      conflictKinds: uniqueSorted(materialIncompatible.map(conflictKind)),
    };
  }

  return {
    uncertaintyState: ENGINE_UNCERTAINTY_STATE.SUFFICIENT_EVIDENCE,
    abstentionState: ENGINE_ABSTENTION_STATE.NOT_ABSTAINING,
    ruleKey: 'usable_included_without_material_conflict',
    conflictKinds: uniqueSorted(conflicts.map(conflictKind)),
  };
}

function buildReasoningSummary(analysis, classification) {
  const includedCount = analysis.included.length;
  const excludedCount = analysis.excluded.length;
  const missingCount = analysis.missing.length;
  const conflictCount = analysis.conflicts.length;
  const conflictKinds = uniqueSorted(analysis.conflicts.map(conflictKind));
  const blockedExcluded = analysis.excluded.filter(isBlockedExcluded).length;
  const unavailableExcluded = analysis.excluded.filter(isUnavailableExcluded).length;
  const staleExcluded = analysis.excluded.filter(isStaleExcluded).length;

  const parts = [
    `deterministic_rule=${classification.ruleKey}`,
    `uncertainty=${classification.uncertaintyState}`,
    `abstention=${classification.abstentionState}`,
    `included=${includedCount}`,
    `excluded=${excludedCount}`,
    `missing=${missingCount}`,
    `conflicts=${conflictCount}`,
    `conflict_kinds=${conflictKinds.join('|') || 'none'}`,
    `excluded_blocked=${blockedExcluded}`,
    `excluded_unavailable=${unavailableExcluded}`,
    `excluded_stale=${staleExcluded}`,
    'voting=none',
    'confidence_averaging=none',
    'execution=not_authorized',
  ];
  return parts.join('; ').slice(0, 2048);
}

function buildCognitiveAnalysisResult({
  decisionContextId,
  orchestrationSets,
  classification,
  analysis,
  generatedAt,
}) {
  const orchestrationSetReferences = orchestrationSets.map((set) => ({
    orchestrationSetId: set.orchestrationId,
    orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
  }));
  const orchestrationSetIds = orchestrationSetReferences.map((ref) => ref.orchestrationSetId);

  const limitations = uniqueSorted([
    ...ENGINE_INTERFACE_LIMITATIONS,
    ...DETERMINISTIC_REASONING_LIMITATIONS,
    `rule:${classification.ruleKey}`,
  ]);

  return {
    schemaVersion: ENGINE_INTERFACE_SCHEMA_VERSION,
    contractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
    engineInterfaceContractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
    decisionContextId,
    orchestrationSetReferences,
    lineage: {
      decisionContextId,
      decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
      orchestrationSetIds,
      orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
      kernelContractVersion: KERNEL_CONTRACT_VERSION,
      engineInterfaceContractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
      policyVersion: DETERMINISTIC_REASONING_POLICY_VERSION,
      stage: DETERMINISTIC_REASONING_STAGE,
    },
    provenance: {
      writer: DETERMINISTIC_REASONING_WRITER,
      methodKey: DETERMINISTIC_REASONING_METHOD_KEY,
      stage: DETERMINISTIC_REASONING_STAGE,
      note: 'stage_7_2b2_deterministic_reasoning_pipeline_non_executing',
      recordedAt: generatedAt,
    },
    uncertaintyState: classification.uncertaintyState,
    abstentionState: classification.abstentionState,
    limitations,
    reasoningSummary: buildReasoningSummary(analysis, classification),
    analyticalConclusion: null,
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    cognitiveEngineStarted: false,
    sideEffects: { ...ZERO_ENGINE_INTERFACE_SIDE_EFFECTS },
    policyVersion: DETERMINISTIC_REASONING_POLICY_VERSION,
    implementationVersion: DETERMINISTIC_REASONING_POLICY_VERSION,
    generatedAt,
  };
}

/**
 * Run the Stage 7.2.b.2 deterministic analytical reasoning pipeline.
 *
 * @param {object} input
 * @param {object} input.decisionContext frozen Stage 7.1 Decision Context
 * @param {object} input.kernelInput validated Cognitive Kernel contract input shape
 * @param {object[]} input.orchestrationSets Stage 6 EvidenceOrchestrationSet artifacts
 * @param {string} [input.generatedAt] ISO timestamp for determinism
 */
export function runDeterministicCognitiveReasoning(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Deterministic reasoning input must be a plain object');
  }

  const errors = [];
  rejectForbiddenKeys(input, errors);
  rejectExecutionAuthorityStrings(input, errors);

  const secretKeys = collectForbiddenSecretKeys(input);
  if (secretKeys.length) {
    errors.push({ field: 'input', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  const decisionContext = validateFrozenDecisionContext(input.decisionContext, errors);
  const kernelInput = input.kernelInput;
  const kernelValidation = validateCognitiveKernelInput(kernelInput);
  if (!kernelValidation.ok) {
    errors.push({
      field: 'kernelInput',
      code: kernelValidation.code || 'kernel_input_invalid',
      errors: kernelValidation.errors || [],
    });
  }

  const orchestrationSets = validateOrchestrationSets(input.orchestrationSets, errors);

  if (decisionContext && kernelValidation.ok) {
    if (normalizeId(kernelInput.decisionContextId) !== normalizeId(decisionContext.contextId)) {
      errors.push({
        field: 'kernelInput.decisionContextId',
        code: 'must_match_decision_context_id',
      });
    }
  }

  if (decisionContext && orchestrationSets.length) {
    assertIdSetsEqual(
      orchestrationSets.map((s) => s.orchestrationId),
      asArray(decisionContext.evidenceReferences?.orchestrationSetIds),
      'orchestrationSets',
      errors,
    );
  }

  if (kernelValidation.ok && orchestrationSets.length) {
    assertIdSetsEqual(
      orchestrationSets.map((s) => s.orchestrationId),
      asArray(kernelInput.orchestrationSetReferences).map((r) => r.orchestrationSetId),
      'kernelInput.orchestrationSetReferences',
      errors,
    );
  }

  const generatedAt = input.generatedAt
    ?? decisionContext?.generatedAt
    ?? new Date().toISOString();
  if (!isIsoTimestamp(generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_iso_timestamp' });
  }

  if (decisionContext && kernelValidation.ok && orchestrationSets.length && !errors.length) {
    const interfaceRequest = {
      schemaVersion: ENGINE_INTERFACE_SCHEMA_VERSION,
      contractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
      engineInterfaceContractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
      decisionContextId: decisionContext.contextId,
      decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
      kernelContractVersion: KERNEL_CONTRACT_VERSION,
      orchestrationSetReferences: orchestrationSets.map((set) => ({
        orchestrationSetId: set.orchestrationId,
        orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
      })),
      lineage: {
        decisionContextId: decisionContext.contextId,
        decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
        orchestrationSetIds: orchestrationSets.map((set) => set.orchestrationId),
        orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        kernelContractVersion: KERNEL_CONTRACT_VERSION,
        engineInterfaceContractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
        policyVersion: DETERMINISTIC_REASONING_POLICY_VERSION,
        stage: DETERMINISTIC_REASONING_STAGE,
      },
      provenance: {
        writer: DETERMINISTIC_REASONING_WRITER,
        methodKey: DETERMINISTIC_REASONING_METHOD_KEY,
        stage: DETERMINISTIC_REASONING_STAGE,
        note: 'stage_7_2b2_interface_request_gate',
        recordedAt: generatedAt,
      },
      limitations: [...DETERMINISTIC_REASONING_LIMITATIONS],
      sideEffects: { ...ZERO_ENGINE_INTERFACE_SIDE_EFFECTS },
    };
    const interfaceValidation = validateCognitiveEngineInterfaceRequest(interfaceRequest);
    if (!interfaceValidation.ok) {
      errors.push({
        field: 'engineInterfaceRequest',
        code: interfaceValidation.code || 'engine_interface_invalid',
        errors: interfaceValidation.errors || [],
      });
    }
  }

  if (errors.length) {
    return fail('validation_failed', 'Deterministic reasoning input failed validation', { errors });
  }

  const analysis = flattenAnalysis(orchestrationSets);
  const classification = classifyDeterministicUncertainty(analysis);
  const result = buildCognitiveAnalysisResult({
    decisionContextId: decisionContext.contextId,
    orchestrationSets,
    classification,
    analysis,
    generatedAt,
  });

  const resultValidation = validateCognitiveAnalysisResult(result);
  if (!resultValidation.ok) {
    return fail('result_validation_failed', 'Cognitive Analysis Result failed interface validation', {
      errors: resultValidation.errors || [],
      classification,
    });
  }

  const bytes = utf8ByteLength(result);
  if (bytes > MAX_REASONING_UTF8_BYTES) {
    return fail('result_too_large', 'Cognitive Analysis Result exceeds size bound', {
      bytes,
      limit: MAX_REASONING_UTF8_BYTES,
    });
  }

  return {
    ok: true,
    code: 'DETERMINISTIC_REASONING_COMPLETE',
    message: 'Deterministic Cognitive Analysis Result produced',
    result,
    classification: {
      ruleKey: classification.ruleKey,
      uncertaintyState: classification.uncertaintyState,
      abstentionState: classification.abstentionState,
      conflictKinds: classification.conflictKinds || [],
    },
    analysisCounts: {
      included: analysis.included.length,
      excluded: analysis.excluded.length,
      missing: analysis.missing.length,
      conflicts: analysis.conflicts.length,
    },
    bytes,
    sideEffects: { ...ZERO_ENGINE_INTERFACE_SIDE_EFFECTS },
  };
}

export default {
  DETERMINISTIC_REASONING_STAGE,
  DETERMINISTIC_REASONING_POLICY_VERSION,
  DETERMINISTIC_REASONING_WRITER,
  DETERMINISTIC_REASONING_METHOD_KEY,
  DETERMINISTIC_REASONING_LIMITATIONS,
  classifyDeterministicUncertainty,
  runDeterministicCognitiveReasoning,
};
