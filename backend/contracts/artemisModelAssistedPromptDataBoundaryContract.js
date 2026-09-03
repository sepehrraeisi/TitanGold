/**
 * Artemis Core Stage 7.2.b.3.b — Model-assisted Prompt/Data Boundary.
 *
 * Builds and validates BoundedModelInputArtifact for future model-assisted
 * adapter use. Treats all evidence/analysis text as DATA, not INSTRUCTION.
 *
 * Does NOT:
 *   - call LLMs or provider SDKs
 *   - open network sockets
 *   - create executable prompts for live model invocation
 *   - store model responses
 *   - authorize execution or start the Cognitive Engine product
 *
 * Placement:
 *   Deterministic Reasoning (7.2.b.2)
 *     → Model-assisted Adapter Contract (7.2.b.3.a)
 *       → Prompt/Data Boundary (this stage)
 *         → future bounded model invocation (NOT here)
 */

import { DECISION_CONTEXT_CONTRACT_VERSION } from './artemisDecisionContextContract.js';
import {
  ENGINE_INTERFACE_CONTRACT_VERSION,
  ENGINE_INTERFACE_SCHEMA_VERSION,
  validateCognitiveAnalysisResult,
} from './artemisCognitiveEngineInterfaceContract.js';
import {
  MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
} from './artemisModelAssistedAdapterContract.js';
import {
  collectForbiddenSecretKeys,
  isCanonicalUuid,
  isIsoTimestamp,
  utf8ByteLength,
} from './artemisEvidenceContract.js';

export const PROMPT_DATA_BOUNDARY_STAGE = '7.2.b.3.b';
export const PROMPT_DATA_BOUNDARY_SCHEMA_VERSION = '1.0.0';
export const PROMPT_DATA_BOUNDARY_CONTRACT_VERSION = 'artemis-model-assisted-prompt-data-boundary-1.0.0';
export const PROMPT_DATA_BOUNDARY_VERSION = 'stage7-2b3b-prompt-data-boundary-1.0.0';
export const PROMPT_DATA_BOUNDARY_POLICY_VERSION = 'stage7-2b3b-prompt-data-boundary-1.0.0';
export const PROMPT_DATA_BOUNDARY_WRITER = 'artemisModelAssistedPromptDataBoundaryContract';

export const REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION = DECISION_CONTEXT_CONTRACT_VERSION;
export const REQUIRED_ENGINE_INTERFACE_CONTRACT_VERSION = ENGINE_INTERFACE_CONTRACT_VERSION;
export const REQUIRED_ENGINE_INTERFACE_SCHEMA_VERSION = ENGINE_INTERFACE_SCHEMA_VERSION;
export const REQUIRED_ADAPTER_CONTRACT_VERSION = MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION;

export const MAX_BOUNDARY_UTF8_BYTES = 24 * 1024;
export const MAX_SAFE_SUMMARY_CHARS = 1500;
export const MAX_FIELD_CHARS = 512;
export const MAX_METADATA_KEYS = 16;
export const MAX_METADATA_VALUE_CHARS = 256;
export const MAX_LIMITATIONS = 64;
export const MAX_INJECTION_FINDINGS = 32;
export const MAX_REDACTED_KEYS = 64;

export const PROMPT_DATA_BOUNDARY_LIMITATIONS = Object.freeze([
  'stage7_2b3b_prompt_data_boundary_only',
  'no_llm_provider_calls',
  'no_network_invocation',
  'no_provider_sdk',
  'no_live_prompt_execution',
  'no_model_response_storage',
  'evidence_text_is_data_not_instruction',
  'model_input_untrusted_until_later_stage',
  'cannot_override_deterministic_analysis',
  'cannot_approve_execution',
  'cannot_change_controls',
  'no_execution_authorization',
  'no_order_intent',
  'cognitive_engine_product_not_started',
  'live_trading_not_authorized',
]);

export const ZERO_PROMPT_DATA_BOUNDARY_SIDE_EFFECTS = Object.freeze({
  dbWriteCount: 0,
  redisWriteCount: 0,
  agentExecutionCount: 0,
  providerRequestCount: 0,
  orderOperationCount: 0,
  financialExecutionCount: 0,
  llmCallCount: 0,
  networkRequestCount: 0,
});

/** Top-level keys forbidden on boundary request / artifact. */
export const FORBIDDEN_BOUNDARY_KEYS = Object.freeze([
  'orderId',
  'order_id',
  'executionCommand',
  'execution_command',
  'executionIntent',
  'execution_intent',
  'walletAction',
  'wallet_action',
  'walletData',
  'wallet_data',
  'tradeInstruction',
  'trade_instruction',
  'approved',
  'apiKey',
  'api_key',
  'apiSecret',
  'api_secret',
  'credentials',
  'jwt',
  'JWT',
  'signedQuery',
  'signed_query',
  'providerPayload',
  'provider_payload',
  'raw',
  'payload',
  'rawAgentOutput',
  'raw_agent_output',
  'rawAgentObject',
  'raw_agent_object',
  'modelResponse',
  'model_response',
  'prompt',
  'promptText',
  'prompt_text',
  'systemPrompt',
  'system_prompt',
]);

export const FORBIDDEN_EXECUTION_AUTHORITY_VALUES = Object.freeze([
  'BUY',
  'SELL',
  'EXECUTE',
  'LONG',
  'SHORT',
]);

/**
 * Injection / authority-elevation patterns. Matches are contained as DATA,
 * never treated as instructions. Findings are recorded in redactionReport.
 */
export const INJECTION_PATTERN_SPECS = Object.freeze([
  {
    id: 'ignore_previous_instructions',
    re: /\bignore\s+(all\s+)?(previous|prior|above)\s+instructions?\b/i,
  },
  {
    id: 'disregard_system',
    re: /\b(disregard|override)\s+(the\s+)?(system|safety|policy)\b/i,
  },
  {
    id: 'hidden_system_instruction',
    re: /<\s*\/?\s*system\s*>|\[\s*system\s*\]|SYSTEM\s*:\s*/i,
  },
  {
    id: 'tool_invocation_attempt',
    re: /\b(tool_call|function_call|invoke_tool|call_tool)\b|\btools?\s*\.\s*\w+\s*\(/i,
  },
  {
    id: 'authority_elevation',
    re: /\b(you\s+are\s+now\s+(admin|root|authorized)|grant\s+(yourself|me)\s+(admin|root|permission)|elevate\s+privileges?)\b/i,
  },
  {
    id: 'execution_request',
    re: /\b(place\s+order|execute\s+trade|send\s+withdrawal|transfer\s+funds|approve\s+for\s+execution)\b/i,
  },
  {
    id: 'jailbreak_dan',
    re: /\b(do\s+anything\s+now|jailbreak|developer\s+mode\s+enabled)\b/i,
  },
]);

const ALLOWED_REQUEST_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'boundaryVersion',
  'decisionContext',
  'cognitiveAnalysisResult',
  'boundedEvidenceMetadata',
  'generatedAt',
]);

const ALLOWED_ARTIFACT_TOP = Object.freeze([
  'schemaVersion',
  'contractVersion',
  'boundaryVersion',
  'decisionContextId',
  'sourceReferences',
  'sanitizedContext',
  'redactionReport',
  'limitations',
  'provenance',
  'authoritative',
  'decisionEligible',
  'executionEligible',
  'approvedForExecution',
  'cognitiveEngineStarted',
  'sideEffects',
  'policyVersion',
  'implementationVersion',
  'generatedAt',
]);

const ALLOWED_SOURCE_REFERENCES = Object.freeze([
  'decisionContextId',
  'decisionContextContractVersion',
  'engineInterfaceContractVersion',
  'engineInterfaceSchemaVersion',
  'adapterContractVersion',
  'analysisGeneratedAt',
  'uncertaintyState',
  'abstentionState',
]);

const ALLOWED_SANITIZED_CONTEXT = Object.freeze([
  'textAsDataNotInstruction',
  'decisionContextSummary',
  'analysisSummary',
  'evidenceMetadata',
  'containedSegments',
]);

const ALLOWED_DECISION_CONTEXT_SUMMARY = Object.freeze([
  'contextId',
  'taskDomain',
  'requestedOutcome',
  'provider',
  'marketType',
  'symbol',
  'timeframe',
  'analysisHorizon',
  'decisionMaturityMode',
  'lifecycleState',
]);

const ALLOWED_ANALYSIS_SUMMARY = Object.freeze([
  'decisionContextId',
  'uncertaintyState',
  'abstentionState',
  'reasoningSummary',
  'orchestrationSetCount',
  'limitationCount',
]);

const ALLOWED_REDACTION_REPORT = Object.freeze([
  'secretKeysRemoved',
  'forbiddenKeysRejected',
  'injectionFindings',
  'truncatedFields',
  'bytesBefore',
  'bytesAfter',
  'containmentApplied',
]);

const ALLOWED_PROVENANCE = Object.freeze([
  'writer',
  'methodKey',
  'stage',
  'note',
  'recordedAt',
]);

const ALLOWED_INJECTION_FINDING = Object.freeze([
  'id',
  'field',
  'action',
]);

const SECRET_VALUE_RE = Object.freeze([
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
]);

function fail(code, message, extra = {}) {
  return { ok: false, code, message, artifact: null, ...extra };
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

function assertForbiddenKeys(obj, forbidden, errors, fieldPrefix = '') {
  if (!obj || typeof obj !== 'object') return;
  const stack = [{ value: obj, path: fieldPrefix || 'root' }];
  while (stack.length) {
    const { value, path } = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) {
      value.forEach((item, idx) => stack.push({ value: item, path: `${path}[${idx}]` }));
      continue;
    }
    for (const [key, nested] of Object.entries(value)) {
      if (forbidden.includes(key)) {
        errors.push({ field: `${path}.${key}`, code: 'forbidden_key', key });
      }
      stack.push({ value: nested, path: `${path}.${key}` });
    }
  }
}

function rejectExecutionAuthorityStrings(value, errors, path = 'root') {
  if (typeof value === 'string') {
    if (FORBIDDEN_EXECUTION_AUTHORITY_VALUES.includes(value)) {
      errors.push({ field: path, code: 'forbidden_execution_authority_value', value });
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, idx) => rejectExecutionAuthorityStrings(item, errors, `${path}[${idx}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    rejectExecutionAuthorityStrings(nested, errors, `${path}.${key}`);
  }
}

function truncateString(value, maxChars, field, truncatedFields) {
  if (typeof value !== 'string') return value;
  if (value.length <= maxChars) return value;
  truncatedFields.push(field);
  return `${value.slice(0, maxChars)}…`;
}

function redactSecretSubstrings(text, field, secretKeysRemoved) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const re of SECRET_VALUE_RE) {
    const copy = new RegExp(re.source, re.flags);
    if (copy.test(out)) {
      secretKeysRemoved.push(`${field}:secret_substring`);
      out = out.replace(new RegExp(re.source, re.flags), '[REDACTED]');
    }
  }
  return out;
}

/**
 * Scan text for injection patterns. Returns findings; caller isolates text.
 */
export function detectPromptInjection(text, field = 'text') {
  if (typeof text !== 'string' || !text) return [];
  const findings = [];
  for (const spec of INJECTION_PATTERN_SPECS) {
    if (spec.re.test(text)) {
      findings.push({
        id: spec.id,
        field,
        action: 'contained_as_data',
      });
      if (findings.length >= MAX_INJECTION_FINDINGS) break;
    }
  }
  return findings;
}

/**
 * Sanitize a free-form string: redact secret-like substrings, detect injection,
 * and truncate. Always returns data-classified text.
 */
export function sanitizeDataText(text, field, report) {
  if (text == null) return null;
  if (typeof text !== 'string') {
    report.forbiddenKeysRejected.push(`${field}:non_string`);
    return null;
  }
  let value = redactSecretSubstrings(text, field, report.secretKeysRemoved);
  const findings = detectPromptInjection(value, field);
  if (findings.length) {
    report.injectionFindings.push(...findings);
    report.containmentApplied = true;
    report.containedSegments = report.containedSegments || [];
    report.containedSegments.push({
      field,
      patternIds: findings.map((f) => f.id),
      note: 'treated_as_untrusted_data_not_instruction',
    });
  }
  value = truncateString(value, MAX_SAFE_SUMMARY_CHARS, field, report.truncatedFields);
  return value;
}

function pickAllowlisted(source, allowed, fieldPrefix, report) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const out = {};
  for (const key of allowed) {
    if (!(key in source)) continue;
    const value = source[key];
    if (typeof value === 'string') {
      out[key] = sanitizeDataText(value, `${fieldPrefix}.${key}`, report);
    } else if (value == null || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    } else if (Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      out[key] = value.slice(0, 32).map((v, idx) => (
        typeof v === 'string'
          ? sanitizeDataText(v, `${fieldPrefix}.${key}[${idx}]`, report)
          : v
      ));
    }
  }
  return out;
}

function sanitizeEvidenceMetadata(metadata, report, errors) {
  if (metadata == null) return {};
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    errors.push({ field: 'boundedEvidenceMetadata', code: 'must_be_object' });
    return null;
  }
  const keys = Object.keys(metadata);
  if (keys.length > MAX_METADATA_KEYS) {
    errors.push({
      field: 'boundedEvidenceMetadata',
      code: 'too_many_keys',
      count: keys.length,
      limit: MAX_METADATA_KEYS,
    });
    return null;
  }
  assertForbiddenKeys(metadata, FORBIDDEN_BOUNDARY_KEYS, errors, 'boundedEvidenceMetadata');
  const secretKeys = collectForbiddenSecretKeys(metadata);
  if (secretKeys.length) {
    for (const key of secretKeys) {
      report.secretKeysRemoved.push(key);
    }
  }
  const out = {};
  for (const key of keys) {
    if (FORBIDDEN_BOUNDARY_KEYS.includes(key)) continue;
    if (secretKeys.includes(key)) continue;
    const value = metadata[key];
    if (typeof value === 'string') {
      out[key] = truncateString(
        redactSecretSubstrings(value, `boundedEvidenceMetadata.${key}`, report.secretKeysRemoved),
        MAX_METADATA_VALUE_CHARS,
        `boundedEvidenceMetadata.${key}`,
        report.truncatedFields,
      );
      const findings = detectPromptInjection(out[key], `boundedEvidenceMetadata.${key}`);
      if (findings.length) {
        report.injectionFindings.push(...findings);
        report.containmentApplied = true;
      }
    } else if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
      out[key] = value;
    } else {
      report.forbiddenKeysRejected.push(`boundedEvidenceMetadata.${key}:unsupported_type`);
    }
  }
  return out;
}

function buildDecisionContextSummary(decisionContext, report, errors) {
  if (!decisionContext || typeof decisionContext !== 'object' || Array.isArray(decisionContext)) {
    errors.push({ field: 'decisionContext', code: 'required_object' });
    return null;
  }
  assertForbiddenKeys(decisionContext, FORBIDDEN_BOUNDARY_KEYS, errors, 'decisionContext');
  const secretKeys = collectForbiddenSecretKeys(decisionContext);
  if (secretKeys.length) {
    errors.push({
      field: 'decisionContext',
      code: 'forbidden_secret_keys',
      keys: [...new Set(secretKeys)],
    });
    return null;
  }
  if (!isCanonicalUuid(decisionContext.contextId) && !isCanonicalUuid(decisionContext.decisionContextId)) {
    errors.push({ field: 'decisionContext.contextId', code: 'invalid_uuid' });
    return null;
  }
  const summary = pickAllowlisted(
    {
      contextId: decisionContext.contextId || decisionContext.decisionContextId,
      taskDomain: decisionContext.taskDomain ?? decisionContext.task?.domain ?? null,
      requestedOutcome: decisionContext.requestedOutcome ?? null,
      provider: decisionContext.provider ?? decisionContext.venue ?? null,
      marketType: decisionContext.marketType ?? null,
      symbol: decisionContext.symbol ?? null,
      timeframe: decisionContext.timeframe ?? null,
      analysisHorizon: decisionContext.analysisHorizon ?? null,
      decisionMaturityMode: decisionContext.decisionMaturityMode ?? null,
      lifecycleState: decisionContext.lifecycleState ?? null,
    },
    ALLOWED_DECISION_CONTEXT_SUMMARY,
    'sanitizedContext.decisionContextSummary',
    report,
  );
  return summary;
}

function buildAnalysisSummary(cognitiveAnalysisResult, report, errors) {
  const validation = validateCognitiveAnalysisResult(cognitiveAnalysisResult);
  if (!validation.ok) {
    errors.push({
      field: 'cognitiveAnalysisResult',
      code: validation.code || 'invalid_cognitive_analysis_result',
      errors: validation.errors || [],
    });
    return null;
  }
  assertForbiddenKeys(cognitiveAnalysisResult, FORBIDDEN_BOUNDARY_KEYS, errors, 'cognitiveAnalysisResult');
  const secretKeys = collectForbiddenSecretKeys(cognitiveAnalysisResult);
  if (secretKeys.length) {
    errors.push({
      field: 'cognitiveAnalysisResult',
      code: 'forbidden_secret_keys',
      keys: [...new Set(secretKeys)],
    });
    return null;
  }

  const orchestrationSetCount = Array.isArray(cognitiveAnalysisResult.orchestrationSetReferences)
    ? cognitiveAnalysisResult.orchestrationSetReferences.length
    : 0;
  const limitationCount = Array.isArray(cognitiveAnalysisResult.limitations)
    ? cognitiveAnalysisResult.limitations.length
    : 0;

  return pickAllowlisted(
    {
      decisionContextId: cognitiveAnalysisResult.decisionContextId,
      uncertaintyState: cognitiveAnalysisResult.uncertaintyState,
      abstentionState: cognitiveAnalysisResult.abstentionState,
      reasoningSummary: cognitiveAnalysisResult.reasoningSummary ?? null,
      orchestrationSetCount,
      limitationCount,
    },
    ALLOWED_ANALYSIS_SUMMARY,
    'sanitizedContext.analysisSummary',
    report,
  );
}

function emptyRedactionReport() {
  return {
    secretKeysRemoved: [],
    forbiddenKeysRejected: [],
    injectionFindings: [],
    truncatedFields: [],
    bytesBefore: 0,
    bytesAfter: 0,
    containmentApplied: false,
  };
}

function validateRedactionReport(report, errors) {
  if (!assertAllowlist(report, ALLOWED_REDACTION_REPORT, 'redactionReport', errors)) return;
  for (const listField of [
    'secretKeysRemoved',
    'forbiddenKeysRejected',
    'truncatedFields',
  ]) {
    if (!Array.isArray(report[listField])) {
      errors.push({ field: `redactionReport.${listField}`, code: 'must_be_array' });
    }
  }
  if (!Array.isArray(report.injectionFindings)) {
    errors.push({ field: 'redactionReport.injectionFindings', code: 'must_be_array' });
  } else {
    for (let i = 0; i < report.injectionFindings.length; i += 1) {
      assertAllowlist(
        report.injectionFindings[i],
        ALLOWED_INJECTION_FINDING,
        `redactionReport.injectionFindings[${i}]`,
        errors,
      );
    }
  }
  if (typeof report.bytesBefore !== 'number' || typeof report.bytesAfter !== 'number') {
    errors.push({ field: 'redactionReport.bytes', code: 'must_be_number' });
  }
  if (typeof report.containmentApplied !== 'boolean') {
    errors.push({ field: 'redactionReport.containmentApplied', code: 'must_be_boolean' });
  }
}

/**
 * Validate a boundary build request (Decision Context + Cognitive Analysis + metadata).
 */
export function validatePromptDataBoundaryRequest(request) {
  const errors = [];
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return fail('invalid_request', 'Boundary request must be a plain object', { errors: [{ field: 'request', code: 'required_object' }] });
  }
  assertAllowlist(request, ALLOWED_REQUEST_TOP, 'request', errors);
  assertForbiddenKeys(request, FORBIDDEN_BOUNDARY_KEYS, errors, 'request');
  rejectExecutionAuthorityStrings(request, errors, 'request');

  const secretKeys = collectForbiddenSecretKeys(request);
  if (secretKeys.length) {
    errors.push({ field: 'request', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  if (request.schemaVersion != null && request.schemaVersion !== PROMPT_DATA_BOUNDARY_SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'unsupported_schema_version' });
  }
  if (request.contractVersion != null
    && request.contractVersion !== PROMPT_DATA_BOUNDARY_CONTRACT_VERSION) {
    errors.push({ field: 'contractVersion', code: 'unsupported_contract_version' });
  }
  if (request.boundaryVersion != null
    && request.boundaryVersion !== PROMPT_DATA_BOUNDARY_VERSION) {
    errors.push({ field: 'boundaryVersion', code: 'unsupported_boundary_version' });
  }
  if (request.generatedAt != null && !isIsoTimestamp(request.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_iso_timestamp' });
  }

  if (errors.length) {
    return fail('validation_failed', 'Prompt/data boundary request failed validation', { errors });
  }
  return { ok: true, code: 'BOUNDARY_REQUEST_VALID', message: 'Boundary request accepted', errors: [] };
}

/**
 * Validate a BoundedModelInputArtifact.
 */
export function validateBoundedModelInputArtifact(artifact) {
  const errors = [];
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    return fail('invalid_artifact', 'BoundedModelInputArtifact must be a plain object', {
      errors: [{ field: 'artifact', code: 'required_object' }],
    });
  }

  assertAllowlist(artifact, ALLOWED_ARTIFACT_TOP, 'artifact', errors);
  assertForbiddenKeys(artifact, FORBIDDEN_BOUNDARY_KEYS, errors, 'artifact');
  rejectExecutionAuthorityStrings(artifact, errors, 'artifact');

  const secretKeys = collectForbiddenSecretKeys(artifact);
  if (secretKeys.length) {
    errors.push({ field: 'artifact', code: 'forbidden_secret_keys', keys: [...new Set(secretKeys)] });
  }

  if (artifact.schemaVersion !== PROMPT_DATA_BOUNDARY_SCHEMA_VERSION) {
    errors.push({ field: 'schemaVersion', code: 'unsupported_schema_version' });
  }
  if (artifact.contractVersion !== PROMPT_DATA_BOUNDARY_CONTRACT_VERSION) {
    errors.push({ field: 'contractVersion', code: 'unsupported_contract_version' });
  }
  if (artifact.boundaryVersion !== PROMPT_DATA_BOUNDARY_VERSION) {
    errors.push({ field: 'boundaryVersion', code: 'unsupported_boundary_version' });
  }
  if (!isCanonicalUuid(artifact.decisionContextId)) {
    errors.push({ field: 'decisionContextId', code: 'invalid_uuid' });
  }
  if (!isIsoTimestamp(artifact.generatedAt)) {
    errors.push({ field: 'generatedAt', code: 'invalid_iso_timestamp' });
  }

  if (!assertAllowlist(artifact.sourceReferences, ALLOWED_SOURCE_REFERENCES, 'sourceReferences', errors)) {
    // already recorded
  } else if (
    String(artifact.sourceReferences.decisionContextId || '').trim().toLowerCase()
    !== String(artifact.decisionContextId || '').trim().toLowerCase()
  ) {
    errors.push({ field: 'sourceReferences.decisionContextId', code: 'must_match_decision_context_id' });
  }

  if (assertAllowlist(artifact.sanitizedContext, ALLOWED_SANITIZED_CONTEXT, 'sanitizedContext', errors)) {
    if (artifact.sanitizedContext.textAsDataNotInstruction !== true) {
      errors.push({ field: 'sanitizedContext.textAsDataNotInstruction', code: 'must_be_true' });
    }
    if (artifact.sanitizedContext.decisionContextSummary) {
      assertAllowlist(
        artifact.sanitizedContext.decisionContextSummary,
        ALLOWED_DECISION_CONTEXT_SUMMARY,
        'sanitizedContext.decisionContextSummary',
        errors,
      );
    }
    if (artifact.sanitizedContext.analysisSummary) {
      assertAllowlist(
        artifact.sanitizedContext.analysisSummary,
        ALLOWED_ANALYSIS_SUMMARY,
        'sanitizedContext.analysisSummary',
        errors,
      );
    }
  }

  validateRedactionReport(artifact.redactionReport, errors);

  if (!Array.isArray(artifact.limitations) || !artifact.limitations.length) {
    errors.push({ field: 'limitations', code: 'required_non_empty_array' });
  } else if (artifact.limitations.length > MAX_LIMITATIONS) {
    errors.push({ field: 'limitations', code: 'too_many' });
  }

  assertAllowlist(artifact.provenance, ALLOWED_PROVENANCE, 'provenance', errors);

  if (artifact.authoritative !== false) {
    errors.push({ field: 'authoritative', code: 'must_be_false' });
  }
  if (artifact.decisionEligible !== false) {
    errors.push({ field: 'decisionEligible', code: 'must_be_false' });
  }
  if (artifact.executionEligible !== false) {
    errors.push({ field: 'executionEligible', code: 'must_be_false' });
  }
  if (artifact.approvedForExecution !== false) {
    errors.push({ field: 'approvedForExecution', code: 'must_be_false' });
  }
  if (artifact.cognitiveEngineStarted !== false) {
    errors.push({ field: 'cognitiveEngineStarted', code: 'must_be_false' });
  }

  const bytes = utf8ByteLength(artifact);
  if (bytes > MAX_BOUNDARY_UTF8_BYTES) {
    errors.push({
      field: 'artifact',
      code: 'too_large',
      bytes,
      limit: MAX_BOUNDARY_UTF8_BYTES,
    });
  }

  if (errors.length) {
    return fail('validation_failed', 'BoundedModelInputArtifact failed validation', { errors, bytes });
  }
  return {
    ok: true,
    code: 'BOUNDED_MODEL_INPUT_VALID',
    message: 'BoundedModelInputArtifact accepted',
    errors: [],
    bytes,
  };
}

/**
 * Build a BoundedModelInputArtifact from validated Decision Context +
 * Cognitive Analysis Result + optional bounded evidence metadata.
 * No model call. Deterministic for identical inputs.
 */
export function buildBoundedModelInputArtifact(input = {}) {
  const requestCheck = validatePromptDataBoundaryRequest({
    schemaVersion: PROMPT_DATA_BOUNDARY_SCHEMA_VERSION,
    contractVersion: PROMPT_DATA_BOUNDARY_CONTRACT_VERSION,
    boundaryVersion: PROMPT_DATA_BOUNDARY_VERSION,
    decisionContext: input.decisionContext,
    cognitiveAnalysisResult: input.cognitiveAnalysisResult,
    boundedEvidenceMetadata: input.boundedEvidenceMetadata,
    generatedAt: input.generatedAt,
  });
  if (!requestCheck.ok) {
    return requestCheck;
  }

  const errors = [];
  const report = emptyRedactionReport();
  const bytesBefore = utf8ByteLength({
    decisionContext: input.decisionContext,
    cognitiveAnalysisResult: input.cognitiveAnalysisResult,
    boundedEvidenceMetadata: input.boundedEvidenceMetadata || {},
  });
  report.bytesBefore = bytesBefore;

  const decisionContextSummary = buildDecisionContextSummary(
    input.decisionContext,
    report,
    errors,
  );
  const analysisSummary = buildAnalysisSummary(
    input.cognitiveAnalysisResult,
    report,
    errors,
  );
  const evidenceMetadata = sanitizeEvidenceMetadata(
    input.boundedEvidenceMetadata || {},
    report,
    errors,
  );

  if (decisionContextSummary && analysisSummary) {
    const ctxId = String(decisionContextSummary.contextId || '').trim().toLowerCase();
    const analysisCtx = String(analysisSummary.decisionContextId || '').trim().toLowerCase();
    if (ctxId && analysisCtx && ctxId !== analysisCtx) {
      errors.push({ field: 'decisionContextId', code: 'context_analysis_mismatch' });
    }
  }

  if (errors.length || !decisionContextSummary || !analysisSummary || evidenceMetadata == null) {
    return fail('validation_failed', 'Failed to build BoundedModelInputArtifact', { errors });
  }

  const generatedAt = input.generatedAt
    || input.cognitiveAnalysisResult?.generatedAt
    || new Date().toISOString();
  if (!isIsoTimestamp(generatedAt)) {
    return fail('invalid_generated_at', 'generatedAt must be ISO-8601', {
      errors: [{ field: 'generatedAt', code: 'invalid_iso_timestamp' }],
    });
  }

  const decisionContextId = String(decisionContextSummary.contextId).trim().toLowerCase();
  const containedSegments = Array.isArray(report.containedSegments)
    ? report.containedSegments.slice(0, MAX_INJECTION_FINDINGS)
    : [];
  delete report.containedSegments;

  // Cap report arrays for determinism / size.
  report.secretKeysRemoved = [...new Set(report.secretKeysRemoved)].slice(0, MAX_REDACTED_KEYS).sort();
  report.forbiddenKeysRejected = [...new Set(report.forbiddenKeysRejected)].slice(0, MAX_REDACTED_KEYS).sort();
  report.truncatedFields = [...new Set(report.truncatedFields)].slice(0, MAX_REDACTED_KEYS).sort();
  report.injectionFindings = report.injectionFindings.slice(0, MAX_INJECTION_FINDINGS);

  const artifact = {
    schemaVersion: PROMPT_DATA_BOUNDARY_SCHEMA_VERSION,
    contractVersion: PROMPT_DATA_BOUNDARY_CONTRACT_VERSION,
    boundaryVersion: PROMPT_DATA_BOUNDARY_VERSION,
    decisionContextId,
    sourceReferences: {
      decisionContextId,
      decisionContextContractVersion: REQUIRED_DECISION_CONTEXT_CONTRACT_VERSION,
      engineInterfaceContractVersion: REQUIRED_ENGINE_INTERFACE_CONTRACT_VERSION,
      engineInterfaceSchemaVersion: REQUIRED_ENGINE_INTERFACE_SCHEMA_VERSION,
      adapterContractVersion: REQUIRED_ADAPTER_CONTRACT_VERSION,
      analysisGeneratedAt: input.cognitiveAnalysisResult.generatedAt ?? null,
      uncertaintyState: analysisSummary.uncertaintyState,
      abstentionState: analysisSummary.abstentionState,
    },
    sanitizedContext: {
      textAsDataNotInstruction: true,
      decisionContextSummary,
      analysisSummary,
      evidenceMetadata,
      containedSegments,
    },
    redactionReport: report,
    limitations: [...PROMPT_DATA_BOUNDARY_LIMITATIONS],
    provenance: {
      writer: PROMPT_DATA_BOUNDARY_WRITER,
      methodKey: 'bounded_model_input_sanitize',
      stage: PROMPT_DATA_BOUNDARY_STAGE,
      note: 'stage_7_2b3b_prompt_data_boundary_no_model_call',
      recordedAt: generatedAt,
    },
    authoritative: false,
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    cognitiveEngineStarted: false,
    sideEffects: { ...ZERO_PROMPT_DATA_BOUNDARY_SIDE_EFFECTS },
    policyVersion: PROMPT_DATA_BOUNDARY_POLICY_VERSION,
    implementationVersion: PROMPT_DATA_BOUNDARY_POLICY_VERSION,
    generatedAt,
  };

  report.bytesAfter = utf8ByteLength(artifact);

  if (report.bytesAfter > MAX_BOUNDARY_UTF8_BYTES) {
    return fail('artifact_too_large', 'BoundedModelInputArtifact exceeds size budget', {
      errors: [{
        field: 'artifact',
        code: 'too_large',
        bytes: report.bytesAfter,
        limit: MAX_BOUNDARY_UTF8_BYTES,
      }],
      bytes: report.bytesAfter,
    });
  }

  const validation = validateBoundedModelInputArtifact(artifact);
  if (!validation.ok) {
    return fail('result_validation_failed', 'Built artifact failed validation', {
      errors: validation.errors || [],
      bytes: validation.bytes,
    });
  }

  return {
    ok: true,
    code: 'BOUNDED_MODEL_INPUT_BUILT',
    message: 'BoundedModelInputArtifact produced without model invocation',
    artifact,
    bytes: validation.bytes,
    sideEffects: { ...ZERO_PROMPT_DATA_BOUNDARY_SIDE_EFFECTS },
  };
}

/**
 * Convenience: build a short safe summary string from an already-built artifact.
 * Still DATA-classified; not an executable prompt.
 */
export function buildSafeSummary(artifact) {
  const validation = validateBoundedModelInputArtifact(artifact);
  if (!validation.ok) {
    return fail('invalid_artifact', 'Cannot summarize invalid BoundedModelInputArtifact', {
      errors: validation.errors || [],
    });
  }
  const ctx = artifact.sanitizedContext.decisionContextSummary || {};
  const analysis = artifact.sanitizedContext.analysisSummary || {};
  const parts = [
    'DATA_NOT_INSTRUCTION',
    `context=${ctx.contextId || artifact.decisionContextId}`,
    ctx.symbol ? `symbol=${ctx.symbol}` : null,
    ctx.timeframe ? `timeframe=${ctx.timeframe}` : null,
    analysis.uncertaintyState ? `uncertainty=${analysis.uncertaintyState}` : null,
    analysis.abstentionState ? `abstention=${analysis.abstentionState}` : null,
    analysis.reasoningSummary
      ? `reasoning=${String(analysis.reasoningSummary).slice(0, 240)}`
      : null,
    `containment=${artifact.redactionReport.containmentApplied ? 'yes' : 'no'}`,
  ].filter(Boolean);
  const summary = parts.join(' | ').slice(0, MAX_SAFE_SUMMARY_CHARS);
  return {
    ok: true,
    code: 'SAFE_SUMMARY_BUILT',
    summary,
    textAsDataNotInstruction: true,
  };
}

export default {
  PROMPT_DATA_BOUNDARY_STAGE,
  PROMPT_DATA_BOUNDARY_SCHEMA_VERSION,
  PROMPT_DATA_BOUNDARY_CONTRACT_VERSION,
  PROMPT_DATA_BOUNDARY_VERSION,
  PROMPT_DATA_BOUNDARY_POLICY_VERSION,
  PROMPT_DATA_BOUNDARY_WRITER,
  PROMPT_DATA_BOUNDARY_LIMITATIONS,
  ZERO_PROMPT_DATA_BOUNDARY_SIDE_EFFECTS,
  FORBIDDEN_BOUNDARY_KEYS,
  INJECTION_PATTERN_SPECS,
  detectPromptInjection,
  sanitizeDataText,
  validatePromptDataBoundaryRequest,
  validateBoundedModelInputArtifact,
  buildBoundedModelInputArtifact,
  buildSafeSummary,
};
