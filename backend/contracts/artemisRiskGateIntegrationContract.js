/**
 * Artemis Core Stage 7.3.2.c.1 — Risk Gate → Control Chain integration adapter.
 *
 * Library-only adapter around Stage 7.3.1 `buildContractOnlyControlChainArtifact`.
 * Maps validated Cognitive Decision + Decision Context + riskEvidenceRef
 * (direct or extracted from Stage 7.3.2.b evaluation artifact) into a
 * ControlChainArtifact without reimplementing gate aggregation.
 *
 * Does NOT:
 *   - modify / re-export Stage 7.3.1 gate derivation
 *   - call legacy Risk service modules or Agent Risk entrypoints
 *   - import legacy Artemis orchestrator or MoE consensus
 *   - invent BUY/SELL/direction/thesis/execution approval
 *   - wire Portfolio / Liquidity / Runtime / Order owners
 *   - call LLM / provider / HTTP / network
 *   - mutate DB / Redis
 */

import {
  AUTHORITY_CLASS,
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  FRESHNESS_STATUS,
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';
import {
  DECISION_CONTRACT_VERSION,
  validateArtemisDecision,
} from './artemisDecisionContract.js';
import { DECISION_CONTEXT_CONTRACT_VERSION } from './artemisDecisionContextContract.js';
import { ORCHESTRATION_CONTRACT_VERSION } from './artemisEvidenceOrchestrationContract.js';
import {
  CONTROL_CHAIN_CONTRACT_VERSION,
  CONTROL_CHAIN_STAGE,
  CONTROL_OUTCOME,
  FORBIDDEN_CONTROL_CHAIN_KEYS,
  FORBIDDEN_EXECUTION_AUTHORITY_VALUES,
  REQUESTED_OPERATION_CLASS,
  RISK_GATE_OUTCOME,
  ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
  buildContractOnlyControlChainArtifact,
  validateControlChainArtifact,
} from './artemisControlChainContract.js';
import {
  ALLOWED_RISK_EVIDENCE_FIELDS,
  RISK_PROJECTOR_CONTRACT_VERSION,
  validateProjectedRiskEvidenceRef,
} from './artemisRiskControlProjectorContract.js';
import {
  RISK_EVALUATION_CONTRACT_VERSION,
  RISK_EVALUATION_STAGE,
} from './artemisRiskControlEvaluationContract.js';

export const RISK_GATE_INTEGRATION_STAGE = '7.3.2.c';
export const RISK_GATE_INTEGRATION_SCHEMA_VERSION = '1.0.0';
export const RISK_GATE_INTEGRATION_CONTRACT_VERSION = 'artemis-risk-gate-integration-1.0.0';
export const RISK_GATE_INTEGRATION_POLICY_VERSION = 'stage7-3-2c-risk-gate-integration-1.0.0';
export const RISK_GATE_INTEGRATION_WRITER = 'artemisRiskGateIntegrationContract';
export const RISK_GATE_INTEGRATION_METHOD_KEY = 'integrate_artemis_risk_control_into_chain';

export const REQUIRED_CONTROL_CHAIN_STAGE = CONTROL_CHAIN_STAGE;
export const REQUIRED_CONTROL_CHAIN_CONTRACT_VERSION = CONTROL_CHAIN_CONTRACT_VERSION;
export const REQUIRED_DECISION_CONTRACT_VERSION = DECISION_CONTRACT_VERSION;
export const REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION = DECISION_CONTEXT_CONTRACT_VERSION;
export const REQUIRED_EVIDENCE_CONTRACT_VERSION = EVIDENCE_CONTRACT_VERSION;
export const REQUIRED_ORCHESTRATION_CONTRACT_VERSION = ORCHESTRATION_CONTRACT_VERSION;
export const REQUIRED_PROJECTOR_CONTRACT_VERSION = RISK_PROJECTOR_CONTRACT_VERSION;
export const REQUIRED_EVALUATION_CONTRACT_VERSION = RISK_EVALUATION_CONTRACT_VERSION;

export const MAX_INTEGRATION_UTF8_BYTES = 48 * 1024;
export const MAX_STRING_CHARS = 512;
export const MAX_ID_LIST = 64;

export const ZERO_RISK_GATE_INTEGRATION_SIDE_EFFECTS = Object.freeze({
  ...ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
});

export const REQUIRED_HARD_FLAGS = Object.freeze({
  decisionEligible: false,
  executionEligible: false,
  approvedForExecution: false,
  controlChainStarted: false,
  ordersCreated: 0,
  liveTradingEnabled: false,
});

export const RISK_GATE_INTEGRATION_LIMITATIONS = Object.freeze([
  'stage7_3_2c_risk_gate_integration_only',
  'library_only',
  'adapter_around_stage7_3_1_builder',
  'does_not_reimplement_gate_aggregation',
  'does_not_call_legacy_risk_services',
  'does_not_import_legacy_moe',
  'does_not_call_llm_or_provider',
  'does_not_access_db_or_redis',
  'does_not_wire_portfolio_liquidity_runtime_order',
  'does_not_approve_execution',
  'control_pass_bounded_not_implied_by_risk_pass',
  'live_trading_not_authorized',
]);

/** Control-chain lineage allowlist (exact). */
export const ALLOWED_CONTROL_CHAIN_LINEAGE = Object.freeze([
  'decisionId',
  'decisionContextId',
  'contributingAgentRunIds',
  'orchestrationSetIds',
  'decisionContractVersion',
  'decisionContextContractVersion',
  'evidenceContractVersion',
  'orchestrationContractVersion',
  'controlChainContractVersion',
]);

const ALLOWED_INPUT_TOP = Object.freeze([
  'artemisCognitiveDecision',
  'decisionContext',
  'riskEvidenceRef',
  'riskEvaluationArtifact',
  'lineage',
  'contributingAgentRunIds',
  'orchestrationSetIds',
  'recordedAt',
  'requestedOperationClass',
  'runtimeSnapshot',
]);

const ALLOWED_EVALUATION_ARTIFACT_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'policyVersion',
  'stage',
  'riskEvidenceRef',
  'riskGate',
  'controlOutcome',
  'projector',
  'lineage',
  'provenance',
  'limitations',
  'evaluationNotes',
  'sideEffects',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
]);

const DIRECTION_FORBIDDEN_KEYS = Object.freeze([
  'direction',
  'side',
  'action',
  'buy',
  'sell',
]);

const LEGACY_MOE_FORBIDDEN_KEYS = Object.freeze([
  'moe',
  'vote',
  'votes',
  'weightedVote',
  'weighted_vote',
  'majority',
  'majorityVote',
  'experts',
  'mixtureOfExperts',
  'artemisOrchestrator',
  'agentVotes',
  'consensus',
  'legacyMoe',
]);

const MODEL_ASSISTED_FORBIDDEN_KEYS = Object.freeze([
  'modelAssistedContribution',
  'ModelAssistedContribution',
  'modelAssisted',
  'modelContribution',
  'modelResponse',
  'prompt',
  'providerPayload',
]);

const EXTRA_FORBIDDEN_KEYS = Object.freeze([
  ...FORBIDDEN_CONTROL_CHAIN_KEYS,
  'orderId',
  'executionIntent',
  'walletAction',
  'tradeInstruction',
  'executionCommand',
  'credentials',
  'apiKey',
  'raw',
  'payload',
  'signedQuery',
  'BUY',
  'SELL',
  'EXECUTE',
  'LONG',
  'SHORT',
  'place_order',
  'approved',
]);

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function assertAllowlist(obj, allowed, field, errors) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push({ field, code: 'required_object' });
    return false;
  }
  const unknown = Object.keys(obj).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    errors.push({ field, code: 'unknown_field', fields: unknown });
    return false;
  }
  return true;
}

function collectKeysDeep(obj, acc = []) {
  if (!obj || typeof obj !== 'object') return acc;
  if (Array.isArray(obj)) {
    obj.forEach((item) => collectKeysDeep(item, acc));
    return acc;
  }
  for (const [key, nested] of Object.entries(obj)) {
    acc.push(key);
    collectKeysDeep(nested, acc);
  }
  return acc;
}

function collectStringValuesDeep(value, acc = []) {
  if (typeof value === 'string') {
    acc.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStringValuesDeep(item, acc));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStringValuesDeep(item, acc));
  }
  return acc;
}

function assertUuidList(field, value, errors, { required = true } = {}) {
  if (value == null) {
    if (required) errors.push({ field, code: 'required_array' });
    return;
  }
  if (!Array.isArray(value)) {
    errors.push({ field, code: 'required_array' });
    return;
  }
  if (value.length > MAX_ID_LIST) {
    errors.push({ field, code: 'too_many', max: MAX_ID_LIST });
  }
  value.forEach((id, index) => {
    if (!isCanonicalUuid(id)) errors.push({ field: `${field}[${index}]`, code: 'invalid_uuid' });
  });
}

/**
 * Contamination scan for Risk integration surfaces only.
 * Cognitive Decision / Decision Context are validated by their own contracts
 * (they may legitimately contain schema keys like `direction` as unavailable).
 */
function detectContamination(input, errors) {
  for (const key of Object.keys(input)) {
    if (MODEL_ASSISTED_FORBIDDEN_KEYS.includes(key)) {
      errors.push({ field: key, code: 'model_assisted_contamination' });
    }
    if (LEGACY_MOE_FORBIDDEN_KEYS.includes(key)) {
      errors.push({ field: key, code: 'legacy_moe_forbidden' });
    }
    if (EXTRA_FORBIDDEN_KEYS.includes(key)) {
      errors.push({ field: key, code: 'forbidden_key' });
    }
    if (DIRECTION_FORBIDDEN_KEYS.includes(key)) {
      errors.push({ field: key, code: 'direction_forbidden' });
    }
  }

  const riskSurfaces = [];
  if (input.riskEvidenceRef != null) riskSurfaces.push(input.riskEvidenceRef);
  if (input.riskEvaluationArtifact?.riskEvidenceRef != null) {
    riskSurfaces.push(input.riskEvaluationArtifact.riskEvidenceRef);
  }
  // Also reject MoE/model contamination nested under evaluation artifact extras.
  if (input.riskEvaluationArtifact != null) {
    riskSurfaces.push(input.riskEvaluationArtifact);
  }

  for (const surface of riskSurfaces) {
    const keys = collectKeysDeep(surface);
    for (const key of keys) {
      if (MODEL_ASSISTED_FORBIDDEN_KEYS.includes(key)) {
        errors.push({ field: key, code: 'model_assisted_contamination' });
      }
      if (LEGACY_MOE_FORBIDDEN_KEYS.includes(key)) {
        errors.push({ field: key, code: 'legacy_moe_forbidden' });
      }
      if (EXTRA_FORBIDDEN_KEYS.includes(key)) {
        errors.push({ field: key, code: 'forbidden_key' });
      }
      if (DIRECTION_FORBIDDEN_KEYS.includes(key)) {
        errors.push({ field: key, code: 'direction_forbidden' });
      }
    }
    const values = collectStringValuesDeep(surface);
    for (const value of values) {
      if (FORBIDDEN_EXECUTION_AUTHORITY_VALUES.includes(value)) {
        errors.push({ field: 'riskEvidenceRef', code: 'forbidden_execution_authority_value', value });
      }
      const lower = value.toLowerCase();
      if (lower === 'majority' || lower === 'weighted_vote' || lower === 'weightedvote') {
        errors.push({ field: 'riskEvidenceRef', code: 'vote_contamination', value });
      }
    }
  }

  const secrets = collectForbiddenSecretKeys({
    riskEvidenceRef: input.riskEvidenceRef,
    riskEvaluationArtifact: input.riskEvaluationArtifact,
    lineage: input.lineage,
  });
  if (secrets.length) {
    errors.push({ field: 'input', code: 'forbidden_secret_keys', keys: [...new Set(secrets)] });
  }
}

function isRiskEvaluationArtifact(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return (
    obj.stage === RISK_EVALUATION_STAGE
    || obj.contractVersion === RISK_EVALUATION_CONTRACT_VERSION
  ) && Object.prototype.hasOwnProperty.call(obj, 'riskEvidenceRef');
}

function extractRiskEvidenceRefFromEvaluation(artifact, errors) {
  if (!assertAllowlist(artifact, ALLOWED_EVALUATION_ARTIFACT_TOP, 'riskEvaluationArtifact', errors)) {
    return null;
  }
  if (artifact.stage !== RISK_EVALUATION_STAGE) {
    errors.push({ field: 'riskEvaluationArtifact.stage', code: 'invalid_evaluation_stage' });
  }
  if (artifact.contractVersion !== RISK_EVALUATION_CONTRACT_VERSION) {
    errors.push({ field: 'riskEvaluationArtifact.contractVersion', code: 'invalid_evaluation_contract' });
  }
  if (artifact.riskEvidenceRef == null) {
    errors.push({ field: 'riskEvaluationArtifact.riskEvidenceRef', code: 'missing_risk_evidence_ref' });
    return null;
  }
  // Extract ONLY riskEvidenceRef — never forward lineage/provenance/gates.
  return cloneRiskEvidenceRef(artifact.riskEvidenceRef, errors);
}

function cloneRiskEvidenceRef(ref, errors) {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
    errors.push({ field: 'riskEvidenceRef', code: 'required_object' });
    return null;
  }
  if (!assertAllowlist(ref, ALLOWED_RISK_EVIDENCE_FIELDS, 'riskEvidenceRef', errors)) {
    return null;
  }
  const cloned = {};
  for (const key of ALLOWED_RISK_EVIDENCE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(ref, key)) {
      cloned[key] = ref[key];
    }
  }
  return cloned;
}

function rebuildLineage(input, decision, context, errors) {
  const hints = input.lineage;
  if (hints != null) {
    if (!assertAllowlist(hints, ALLOWED_CONTROL_CHAIN_LINEAGE, 'lineage', errors)) {
      return null;
    }
    if (hints.decisionId != null && hints.decisionId !== decision.decisionId) {
      errors.push({ field: 'lineage.decisionId', code: 'lineage_decision_mismatch' });
    }
    if (hints.decisionContextId != null && hints.decisionContextId !== context.contextId) {
      errors.push({ field: 'lineage.decisionContextId', code: 'lineage_context_mismatch' });
    }
  }

  const contributingAgentRunIds = input.contributingAgentRunIds
    ?? hints?.contributingAgentRunIds;
  const orchestrationSetIds = input.orchestrationSetIds
    ?? hints?.orchestrationSetIds;

  assertUuidList('contributingAgentRunIds', contributingAgentRunIds, errors, { required: true });
  assertUuidList('orchestrationSetIds', orchestrationSetIds, errors, { required: true });

  // Rebuild versions from canonical contracts — never forward 7.3.2.b extras.
  return {
    decisionId: decision.decisionId,
    decisionContextId: context.contextId,
    contributingAgentRunIds: [...(contributingAgentRunIds ?? [])],
    orchestrationSetIds: [...(orchestrationSetIds ?? [])],
    decisionContractVersion: DECISION_CONTRACT_VERSION,
    decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
    orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
    controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
  };
}

function rebuildProvenance(input, errors) {
  const recordedAt = input.recordedAt
    ?? input.lineage?.recordedAt
    ?? null;
  // recordedAt may also come from a prior evaluation provenance if caller
  // placed it on top-level recordedAt only — never copy evaluation provenance.
  if (!isIsoTimestamp(recordedAt)) {
    errors.push({ field: 'recordedAt', code: 'invalid_timestamp' });
    return null;
  }
  return {
    writer: RISK_GATE_INTEGRATION_WRITER,
    methodKey: RISK_GATE_INTEGRATION_METHOD_KEY,
    stage: CONTROL_CHAIN_STAGE,
    recordedAt,
    note: 'stage7_3_2c_risk_gate_integration_adapter',
  };
}

function assertHardFlags(artifact, errors) {
  for (const [key, expected] of Object.entries(REQUIRED_HARD_FLAGS)) {
    if (artifact[key] !== expected) {
      errors.push({ field: key, code: 'hard_flag_violation', expected, actual: artifact[key] });
    }
  }
}

function assertZeroSideEffects(sideEffects, errors) {
  if (!sideEffects || typeof sideEffects !== 'object') {
    errors.push({ field: 'sideEffects', code: 'required_object' });
    return;
  }
  for (const [key, expected] of Object.entries(ZERO_RISK_GATE_INTEGRATION_SIDE_EFFECTS)) {
    if (sideEffects[key] !== expected) {
      errors.push({ field: `sideEffects.${key}`, code: 'nonzero_side_effect', expected, actual: sideEffects[key] });
    }
  }
}

/**
 * Validate integration input allowlists before builder invocation.
 * @returns {{ ok: true } | { ok: false, code: string, message: string, errors: object[] }}
 */
export function validateRiskGateIntegrationInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Risk gate integration input must be a plain object', {
      errors: [{ field: 'input', code: 'required_object' }],
    });
  }
  const errors = [];
  if (!assertAllowlist(input, ALLOWED_INPUT_TOP, 'input', errors)) {
    return fail('unknown_field', 'Unknown risk gate integration input fields', { errors });
  }
  detectContamination(input, errors);

  const hasRef = Object.prototype.hasOwnProperty.call(input, 'riskEvidenceRef');
  const hasEval = Object.prototype.hasOwnProperty.call(input, 'riskEvaluationArtifact');
  if (hasRef && hasEval) {
    errors.push({ field: 'input', code: 'ambiguous_risk_source' });
  }
  if (!hasRef && !hasEval) {
    errors.push({ field: 'riskEvidenceRef', code: 'missing_risk_evidence_ref' });
  }

  if (input.artemisCognitiveDecision == null) {
    errors.push({ field: 'artemisCognitiveDecision', code: 'invalid_cognitive_decision' });
  } else {
    const decision = input.artemisCognitiveDecision;
    if (decision.decisionEligible === true
      || decision.executionEligible === true
      || decision.approvedForExecution === true) {
      errors.push({ field: 'artemisCognitiveDecision', code: 'authority_escalation' });
    }
    const validated = validateArtemisDecision(decision);
    if (!validated.ok) {
      errors.push({
        field: 'artemisCognitiveDecision',
        code: 'invalid_cognitive_decision',
        details: validated.errors || validated.fields || validated.code,
      });
    }
  }

  if (input.decisionContext == null) {
    errors.push({ field: 'decisionContext', code: 'invalid_decision_context' });
  } else {
    const context = input.decisionContext;
    if (context.decisionEligible === true
      || context.executionEligible === true
      || context.approvedForExecution === true) {
      errors.push({ field: 'decisionContext', code: 'authority_escalation' });
    }
    if (context.contractVersion !== DECISION_CONTEXT_CONTRACT_VERSION) {
      errors.push({ field: 'decisionContext.contractVersion', code: 'incompatible_decision_context_contract' });
    }
    if (!isCanonicalUuid(context.contextId)) {
      errors.push({ field: 'decisionContext.contextId', code: 'invalid_uuid' });
    }
    if (
      input.artemisCognitiveDecision?.decisionContextId
      && context.contextId
      && input.artemisCognitiveDecision.decisionContextId !== context.contextId
    ) {
      errors.push({ field: 'compatibility.decisionContextId', code: 'incompatible_context' });
    }
  }

  if (errors.length) {
    return fail('validation_failed', 'Risk gate integration input failed validation', { errors });
  }
  return { ok: true };
}

/**
 * Integrate Risk CONTROL_VETO evidence into a Stage 7.3.1 ControlChainArtifact.
 *
 * @param {object} input
 * @returns {{ ok: true, artifact: object } | { ok: false, code: string, message: string, errors?: object[] }}
 */
export function integrateArtemisRiskControlIntoChain(input = {}) {
  const pre = validateRiskGateIntegrationInput(input);
  if (!pre.ok) return pre;

  const errors = [];
  const decision = input.artemisCognitiveDecision;
  const context = input.decisionContext;

  let riskEvidenceRef = null;
  if (Object.prototype.hasOwnProperty.call(input, 'riskEvaluationArtifact')) {
    if (!isRiskEvaluationArtifact(input.riskEvaluationArtifact)) {
      return fail('invalid_evaluation_artifact', 'riskEvaluationArtifact is not a Stage 7.3.2.b evaluation artifact', {
        errors: [{ field: 'riskEvaluationArtifact', code: 'invalid_evaluation_artifact' }],
      });
    }
    riskEvidenceRef = extractRiskEvidenceRefFromEvaluation(input.riskEvaluationArtifact, errors);
  } else {
    riskEvidenceRef = cloneRiskEvidenceRef(input.riskEvidenceRef, errors);
  }

  if (errors.length) {
    return fail('validation_failed', 'Risk evidence extraction failed', { errors });
  }
  if (!riskEvidenceRef) {
    return fail('missing_risk_evidence_ref', 'riskEvidenceRef is required', {
      errors: [{ field: 'riskEvidenceRef', code: 'missing_risk_evidence_ref' }],
    });
  }

  // Mandatory pre-validation: covers PASS + freshness=UNAVAILABLE (7.3.1 gap).
  const projectedOk = validateProjectedRiskEvidenceRef(riskEvidenceRef);
  if (!projectedOk.ok) {
    return fail(
      projectedOk.code ?? 'INVALID_REF',
      projectedOk.message ?? 'Projected riskEvidenceRef validation failed',
      { errors: projectedOk.errors ?? [] },
    );
  }

  if (riskEvidenceRef.authorityClass !== AUTHORITY_CLASS.CONTROL_VETO) {
    return fail('invalid_authority_class', 'riskEvidenceRef.authorityClass must be CONTROL_VETO', {
      errors: [{ field: 'riskEvidenceRef.authorityClass', code: 'invalid_authority_class' }],
    });
  }

  // Extra fail-closed for PASS + unsafe freshness (explicit UNAVAILABLE).
  if (
    riskEvidenceRef.outcome === RISK_GATE_OUTCOME.PASS
    && (
      riskEvidenceRef.freshness === FRESHNESS_STATUS.STALE
      || riskEvidenceRef.freshness === FRESHNESS_STATUS.EXPIRED
      || riskEvidenceRef.freshness === FRESHNESS_STATUS.UNKNOWN
      || riskEvidenceRef.freshness === FRESHNESS_STATUS.UNAVAILABLE
    )
  ) {
    return fail('stale_risk_cannot_pass', 'PASS riskEvidenceRef cannot survive unsafe freshness', {
      errors: [{ field: 'riskEvidenceRef', code: 'stale_risk_cannot_pass' }],
    });
  }

  if (
    riskEvidenceRef.limit != null
    && !(typeof riskEvidenceRef.limit === 'number'
      && Number.isFinite(riskEvidenceRef.limit)
      && riskEvidenceRef.limit >= 0)
  ) {
    return fail('invalid_limit', 'riskEvidenceRef.limit must be finite and >= 0', {
      errors: [{ field: 'riskEvidenceRef.limit', code: 'invalid_limit' }],
    });
  }

  const lineage = rebuildLineage(input, decision, context, errors);
  const provenance = rebuildProvenance(input, errors);
  if (errors.length || !lineage || !provenance) {
    return fail('validation_failed', 'Lineage/provenance rebuild failed', { errors });
  }

  const builderInput = {
    artemisCognitiveDecision: decision,
    decisionContext: context,
    lineage,
    provenance,
    riskEvidenceRef,
    requestedOperationClass: input.requestedOperationClass ?? REQUESTED_OPERATION_CLASS.OBSERVE,
  };
  if (input.runtimeSnapshot != null) {
    builderInput.runtimeSnapshot = input.runtimeSnapshot;
  }

  // Sole gate authority: Stage 7.3.1 builder.
  const built = buildContractOnlyControlChainArtifact(builderInput);
  if (!built.ok) return built;

  const artifact = built.artifact;
  const post = validateControlChainArtifact(artifact);
  if (!post.ok) return post;

  const postErrors = [];
  assertHardFlags(artifact, postErrors);
  assertZeroSideEffects(artifact.sideEffects, postErrors);

  // Risk semantics invariants (builder remains SoT; adapter asserts expectations).
  if (riskEvidenceRef.outcome === RISK_GATE_OUTCOME.PASS) {
    if (artifact.riskGate?.outcome !== RISK_GATE_OUTCOME.PASS) {
      postErrors.push({ field: 'riskGate.outcome', code: 'expected_pass' });
    }
    if (artifact.controlOutcome === CONTROL_OUTCOME.CONTROL_PASS_BOUNDED
      && !input.liquidityEvidenceRef) {
      // Risk-only path must not invent CONTROL_PASS_BOUNDED without other control layers.
      postErrors.push({ field: 'controlOutcome', code: 'control_pass_bounded_not_from_risk_alone' });
    }
    if (artifact.approvedForExecution === true || artifact.executionEligible === true) {
      postErrors.push({ field: 'artifact', code: 'execution_authority_forbidden' });
    }
  }
  if (riskEvidenceRef.outcome === RISK_GATE_OUTCOME.LIMIT) {
    if (artifact.riskGate?.outcome !== RISK_GATE_OUTCOME.LIMIT) {
      postErrors.push({ field: 'riskGate.outcome', code: 'expected_limit' });
    }
    if (artifact.controlOutcome !== CONTROL_OUTCOME.LIMITED) {
      postErrors.push({ field: 'controlOutcome', code: 'expected_limited' });
    }
    if (typeof riskEvidenceRef.limit === 'number') {
      if (artifact.riskGate?.limit !== riskEvidenceRef.limit) {
        postErrors.push({ field: 'riskGate.limit', code: 'limit_not_preserved' });
      }
    } else if (Object.prototype.hasOwnProperty.call(artifact.riskGate ?? {}, 'limit')) {
      postErrors.push({ field: 'riskGate.limit', code: 'fabricated_limit' });
    }
  }
  if (riskEvidenceRef.outcome === RISK_GATE_OUTCOME.REJECT) {
    if (artifact.riskGate?.outcome !== RISK_GATE_OUTCOME.REJECT) {
      postErrors.push({ field: 'riskGate.outcome', code: 'expected_reject' });
    }
    if (artifact.riskGate?.terminalVeto !== true) {
      postErrors.push({ field: 'riskGate.terminalVeto', code: 'expected_terminal_veto' });
    }
    if (artifact.controlOutcome !== CONTROL_OUTCOME.VETOED) {
      postErrors.push({ field: 'controlOutcome', code: 'expected_vetoed' });
    }
  }
  if (riskEvidenceRef.outcome === RISK_GATE_OUTCOME.UNAVAILABLE) {
    if (artifact.controlOutcome !== CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE) {
      postErrors.push({ field: 'controlOutcome', code: 'expected_insufficient_control_evidence' });
    }
    if (artifact.riskGate?.outcome === RISK_GATE_OUTCOME.PASS) {
      postErrors.push({ field: 'riskGate.outcome', code: 'unavailable_cannot_pass' });
    }
  }

  if (artifact.provenance?.stage !== CONTROL_CHAIN_STAGE) {
    postErrors.push({ field: 'provenance.stage', code: 'invalid_stage' });
  }

  if (utf8ByteLength(artifact) > MAX_INTEGRATION_UTF8_BYTES) {
    postErrors.push({ field: 'artifact', code: 'too_large' });
  }

  if (postErrors.length) {
    return fail('postcondition_failed', 'ControlChainArtifact failed Risk integration postconditions', {
      errors: postErrors,
    });
  }

  return {
    ok: true,
    artifact,
    integration: {
      stage: RISK_GATE_INTEGRATION_STAGE,
      contractVersion: RISK_GATE_INTEGRATION_CONTRACT_VERSION,
      policyVersion: RISK_GATE_INTEGRATION_POLICY_VERSION,
      schemaVersion: RISK_GATE_INTEGRATION_SCHEMA_VERSION,
      limitations: [...RISK_GATE_INTEGRATION_LIMITATIONS],
      sideEffects: { ...ZERO_RISK_GATE_INTEGRATION_SIDE_EFFECTS },
    },
  };
}

export default {
  integrateArtemisRiskControlIntoChain,
  validateRiskGateIntegrationInput,
  RISK_GATE_INTEGRATION_CONTRACT_VERSION,
  RISK_GATE_INTEGRATION_STAGE,
};
