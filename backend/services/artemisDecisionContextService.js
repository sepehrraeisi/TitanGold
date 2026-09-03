/**
 * Artemis Core Stage 7.1 — Decision Context foundation service.
 *
 * Input: requested context fields + Stage 6 EvidenceOrchestrationSet artifact(s).
 * Output: frozen Decision Context snapshot (deterministic, library-only).
 *
 * Does NOT:
 * - invoke Cognitive Kernel / Artemis Decision synthesis
 * - call LLM / providers
 * - majority, weighted, or confidence aggregation
 * - write DB / Redis
 * - connect POST /api/v1/artemis/decision or artemisOrchestrator
 * - produce execution intent, orders, or Live authorization
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  collectForbiddenSecretKeys,
  DATA_QUALITY_STATUS,
  FRESHNESS_STATUS,
  isCanonicalUuid,
  isIsoTimestamp,
  MARKET_TYPE,
  utf8ByteLength,
} from '../contracts/artemisEvidenceContract.js';
import { INGESTION_DISPOSITION } from '../contracts/artemisEvidenceIngestionContract.js';
import { ORCHESTRATION_CONTRACT_VERSION } from '../contracts/artemisEvidenceOrchestrationContract.js';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
  DECISION_CONTEXT_LIFECYCLE,
  DECISION_CONTEXT_LIMITATIONS,
  DECISION_CONTEXT_POLICY_VERSION,
  DECISION_CONTEXT_SCHEMA_VERSION,
  DECISION_CONTEXT_STAGE,
  DECISION_CONTEXT_WRITER,
  DECISION_MATURITY_MODE,
  EFFECTIVE_RUNTIME_MODE,
  ENVIRONMENT,
  EVIDENCE_REF_SEMANTICS,
  FORBIDDEN_DECISION_CONTEXT_KEYS,
  FORBIDDEN_EXECUTION_AUTHORITY_VALUES,
  MAX_DECISION_CONTEXT_UTF8_BYTES,
  MAX_ORCHESTRATION_SET_REFS,
  OWNERSHIP_SCOPE_TYPE,
  PRIVACY_CLASS,
  REQUESTED_RUNTIME_MODE,
  REQUIRED_ORCHESTRATION_CONTRACT_VERSION,
  TASK_DOMAIN,
  ZERO_DECISION_CONTEXT_SIDE_EFFECTS,
} from '../contracts/artemisDecisionContextContract.js';

const TASK_DOMAIN_SET = new Set(Object.values(TASK_DOMAIN));
const OWNERSHIP_SET = new Set(Object.values(OWNERSHIP_SCOPE_TYPE));
const ENVIRONMENT_SET = new Set(Object.values(ENVIRONMENT));
const MATURITY_SET = new Set(Object.values(DECISION_MATURITY_MODE));
const REQUESTED_MODE_SET = new Set(Object.values(REQUESTED_RUNTIME_MODE));
const EFFECTIVE_MODE_SET = new Set(Object.values(EFFECTIVE_RUNTIME_MODE));
const PRIVACY_SET = new Set(Object.values(PRIVACY_CLASS));
const MARKET_TYPE_SET = new Set(Object.values(MARKET_TYPE));
const FRESHNESS_SET = new Set(Object.values(FRESHNESS_STATUS));
const QUALITY_SET = new Set(Object.values(DATA_QUALITY_STATUS));
const FORBIDDEN_KEY_SET = new Set(FORBIDDEN_DECISION_CONTEXT_KEYS);
const FORBIDDEN_VALUE_SET = new Set(FORBIDDEN_EXECUTION_AUTHORITY_VALUES);

const ALLOWED_INPUT_KEYS = new Set([
  'owner',
  'tenantScope',
  'taskDomain',
  'marketScope',
  'timeframe',
  'analysisHorizon',
  'sourceWindow',
  'environment',
  'mode',
  'freshnessConstraints',
  'qualityConstraints',
  'privacyClass',
  'evidenceReferences',
  'orchestrationSet',
  'orchestrationSets',
]);

const ALLOWED_OWNER_KEYS = new Set(['userId', 'tenantId']);
const ALLOWED_TENANT_KEYS = new Set(['tenantId', 'scopeType']);
const ALLOWED_MARKET_KEYS = new Set([
  'provider',
  'venue',
  'marketType',
  'symbol',
  'baseAsset',
  'quoteAsset',
]);
const ALLOWED_SOURCE_WINDOW_KEYS = new Set(['since', 'until']);
const ALLOWED_MODE_KEYS = new Set(['requested', 'effective', 'maturity']);
const ALLOWED_FRESHNESS_CONSTRAINT_KEYS = new Set(['maxAgeMs', 'requiredStatuses']);
const ALLOWED_QUALITY_CONSTRAINT_KEYS = new Set(['requiredStatuses']);
const ALLOWED_EVIDENCE_REF_KEYS = new Set(['orchestrationSetIds', 'orchestrationSets', 'orchestrationSet']);

const STALE_DISPOSITIONS = new Set([
  INGESTION_DISPOSITION.REJECTED_STALE,
  INGESTION_DISPOSITION.REJECTED_EXPIRED,
]);

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

function nowIso(nowMs) {
  return new Date(nowMs).toISOString();
}

function fail(code, message, errors = []) {
  return { ok: false, code, message, errors, context: null };
}

function error(code, message, field = null) {
  return field ? { code, message, field } : { code, message };
}

function inSet(value, set) {
  return typeof value === 'string' && set.has(value);
}

function rejectUnknownKeys(obj, allowed, field, errors) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      errors.push(error('unknown_field', `Unknown field '${key}'`, field ? `${field}.${key}` : key));
    }
  }
}

function collectForbiddenKeys(value, acc = []) {
  if (!value || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    value.forEach((item) => collectForbiddenKeys(item, acc));
    return acc;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEY_SET.has(key)) acc.push(key);
    collectForbiddenKeys(nested, acc);
  }
  return acc;
}

function collectForbiddenAuthorityValues(value, acc = []) {
  if (value == null) return acc;
  if (typeof value === 'string' && FORBIDDEN_VALUE_SET.has(value)) acc.push(value);
  if (!value || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    value.forEach((item) => collectForbiddenAuthorityValues(item, acc));
    return acc;
  }
  for (const nested of Object.values(value)) collectForbiddenAuthorityValues(nested, acc);
  return acc;
}

function normalizeText(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeUuid(value, field, errors, { required = false } = {}) {
  if (value == null || value === '') {
    if (required) errors.push(error('missing_field', `${field} is required`, field));
    return null;
  }
  if (!isCanonicalUuid(value)) {
    errors.push(error('invalid_identifier', `${field} must be a canonical UUID`, field));
    return null;
  }
  return String(value).trim().toLowerCase();
}

function normalizeTimestamp(value, field, errors, { required = false } = {}) {
  if (value == null || value === '') {
    if (required) errors.push(error('missing_field', `${field} is required`, field));
    return null;
  }
  if (!isIsoTimestamp(value)) {
    errors.push(error('invalid_timestamp', `${field} must be an ISO-8601 UTC timestamp`, field));
    return null;
  }
  return value;
}

function hashToUuid(seed) {
  const digest = createHash('sha256').update(String(seed)).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function semanticsForDisposition(disposition) {
  if (disposition === INGESTION_DISPOSITION.UNAVAILABLE) return EVIDENCE_REF_SEMANTICS.UNAVAILABLE_NOT_NEUTRAL;
  if (disposition === INGESTION_DISPOSITION.BLOCKED) return EVIDENCE_REF_SEMANTICS.BLOCKED_NOT_NEUTRAL;
  if (disposition === INGESTION_DISPOSITION.NOT_APPLICABLE) return EVIDENCE_REF_SEMANTICS.NOT_APPLICABLE_NOT_NEUTRAL;
  if (STALE_DISPOSITIONS.has(disposition)) return EVIDENCE_REF_SEMANTICS.STALE_OR_EXPIRED_NOT_CURRENT;
  return EVIDENCE_REF_SEMANTICS.EXCLUDED_NOT_USABLE;
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function collectOrchestrationSets(input) {
  const refs = input?.evidenceReferences && typeof input.evidenceReferences === 'object'
    ? input.evidenceReferences
    : {};
  const nested = [
    ...asArray(input?.orchestrationSet),
    ...asArray(input?.orchestrationSets),
    ...asArray(refs.orchestrationSet),
    ...asArray(refs.orchestrationSets),
  ].filter((item) => item && typeof item === 'object' && !Array.isArray(item));
  const byId = new Map();
  for (const set of nested) {
    if (typeof set.orchestrationId === 'string' && set.orchestrationId) {
      byId.set(String(set.orchestrationId).trim().toLowerCase(), set);
    }
  }
  return { list: nested, byId };
}

function collectOrchestrationIds(input, collectedSets) {
  const refs = input?.evidenceReferences && typeof input.evidenceReferences === 'object'
    ? input.evidenceReferences
    : {};
  const explicit = asArray(refs.orchestrationSetIds)
    .filter((id) => typeof id === 'string' && id.trim())
    .map((id) => id.trim().toLowerCase());
  if (explicit.length) return [...new Set(explicit)];
  return [...collectedSets.byId.keys()];
}

function validateOrchestrationSet(set, errors, index) {
  const prefix = `orchestrationSets[${index}]`;
  if (!set || typeof set !== 'object' || Array.isArray(set)) {
    errors.push(error('invalid_orchestration_set', 'OrchestrationSet must be an object', prefix));
    return null;
  }
  const orchestrationId = normalizeUuid(set.orchestrationId, `${prefix}.orchestrationId`, errors, { required: true });
  if (set.contractVersion !== REQUIRED_ORCHESTRATION_CONTRACT_VERSION) {
    errors.push(error(
      'incompatible_orchestration_contract',
      `OrchestrationSet contractVersion must be ${REQUIRED_ORCHESTRATION_CONTRACT_VERSION}`,
      `${prefix}.contractVersion`,
    ));
  }
  if (set.executionEligible === true || set.decisionEligible === true || set.approvedForExecution === true) {
    errors.push(error(
      'forbidden_execution_claim',
      'OrchestrationSet must not claim execution or decision eligibility',
      prefix,
    ));
  }
  if (set.readiness && set.readiness.cognitiveDecision && set.readiness.cognitiveDecision !== 'NOT_IMPLEMENTED') {
    errors.push(error(
      'cognitive_kernel_not_authorized',
      'OrchestrationSet must not claim a Cognitive Kernel',
      `${prefix}.readiness.cognitiveDecision`,
    ));
  }
  return orchestrationId ? { ...set, orchestrationId } : null;
}

function classifyEvidence(set) {
  const included = asArray(set.includedEvidence).map((ref) => freezeDeep({
    agentId: ref?.agentId ?? null,
    runId: ref?.runId ?? null,
    authorityClass: ref?.authorityClass ?? null,
    disposition: INGESTION_DISPOSITION.ACCEPTED,
    semantics: EVIDENCE_REF_SEMANTICS.USABLE_CURRENT,
    usable: true,
    independentConfirmation: false,
    neutralVote: false,
    negativeVote: false,
  }));

  const excluded = asArray(set.excludedEvidence).map((ref) => {
    const disposition = ref?.disposition || null;
    const semantics = ref?.semantics || semanticsForDisposition(disposition);
    return freezeDeep({
      agentId: ref?.agentId ?? null,
      runId: ref?.runId ?? null,
      authorityClass: ref?.authorityClass ?? null,
      disposition,
      semantics,
      usable: false,
      independentConfirmation: false,
      neutralVote: false,
      negativeVote: false,
    });
  });

  const missing = asArray(set.missingEvidence).map((ref) => freezeDeep({
    agentId: ref?.agentId ?? null,
    runId: null,
    authorityClass: ref?.authorityClass ?? null,
    disposition: null,
    status: 'MISSING',
    semantics: EVIDENCE_REF_SEMANTICS.MISSING_NOT_NEGATIVE,
    usable: false,
    independentConfirmation: false,
    neutralVote: false,
    negativeVote: false,
  }));

  return {
    included,
    excluded,
    missing,
    unavailableCount: excluded.filter((r) => r.disposition === INGESTION_DISPOSITION.UNAVAILABLE).length,
    blockedCount: excluded.filter((r) => r.disposition === INGESTION_DISPOSITION.BLOCKED).length,
    notApplicableCount: excluded.filter((r) => r.disposition === INGESTION_DISPOSITION.NOT_APPLICABLE).length,
    missingCount: missing.length,
    neverNeutralized: true,
    neverNegativeMissing: true,
  };
}

function contextMatchesMarket(setContext, marketScope) {
  if (!setContext || typeof setContext !== 'object') return true;
  const pairs = [
    ['provider', marketScope.provider],
    ['venue', marketScope.venue],
    ['marketType', marketScope.marketType],
    ['symbol', marketScope.symbol],
    ['timeframe', marketScope.timeframe],
  ];
  for (const [key, expected] of pairs) {
    const observed = normalizeText(setContext[key]);
    if (observed && expected && observed !== expected) return false;
  }
  return true;
}

function resolveMarketScope(input, sets, errors) {
  const requested = input?.marketScope && typeof input.marketScope === 'object' ? input.marketScope : {};
  rejectUnknownKeys(requested, ALLOWED_MARKET_KEYS, 'marketScope', errors);
  const fromSet = sets[0]?.context && typeof sets[0].context === 'object' ? sets[0].context : {};
  const marketType = requested.marketType ?? fromSet.marketType ?? null;
  if (marketType != null && !inSet(marketType, MARKET_TYPE_SET)) {
    errors.push(error('invalid_enum', 'marketScope.marketType is not a canonical market type', 'marketScope.marketType'));
  }
  const scope = {
    provider: normalizeText(requested.provider ?? fromSet.provider),
    venue: normalizeText(requested.venue ?? fromSet.venue ?? requested.provider ?? fromSet.provider),
    marketType: inSet(marketType, MARKET_TYPE_SET) ? marketType : (marketType == null ? null : marketType),
    symbol: normalizeText(requested.symbol ?? fromSet.symbol),
    baseAsset: normalizeText(requested.baseAsset),
    quoteAsset: normalizeText(requested.quoteAsset),
  };
  if (!scope.provider || !scope.marketType || !scope.symbol) {
    errors.push(error(
      'incomplete_market_scope',
      'marketScope requires provider, marketType and symbol',
      'marketScope',
    ));
  }
  for (const set of sets) {
    if (!contextMatchesMarket(set.context, { ...scope, timeframe: normalizeText(input?.timeframe ?? set.context?.timeframe) })) {
      errors.push(error(
        'context_incompatible',
        'OrchestrationSet context is incompatible with Decision Context market scope',
        'marketScope',
      ));
      break;
    }
  }
  return scope;
}

function resolveMode(input, errors) {
  const mode = input?.mode && typeof input.mode === 'object' ? input.mode : {};
  rejectUnknownKeys(mode, ALLOWED_MODE_KEYS, 'mode', errors);
  const requested = mode.requested ?? REQUESTED_RUNTIME_MODE.ADVISORY;
  const maturity = mode.maturity ?? DECISION_MATURITY_MODE.ADVISORY;
  if (!inSet(requested, REQUESTED_MODE_SET)) {
    errors.push(error('invalid_enum', 'mode.requested is not a supported runtime mode', 'mode.requested'));
  }
  if (!inSet(maturity, MATURITY_SET)) {
    errors.push(error('invalid_enum', 'mode.maturity is not a supported decision maturity', 'mode.maturity'));
  }
  const liveRequested = requested === REQUESTED_RUNTIME_MODE.LIVE;
  let effective = mode.effective ?? null;
  if (effective == null) {
    effective = liveRequested ? EFFECTIVE_RUNTIME_MODE.ADVISORY : (
      inSet(requested, EFFECTIVE_MODE_SET) ? requested : EFFECTIVE_RUNTIME_MODE.ADVISORY
    );
  }
  if (!inSet(effective, EFFECTIVE_MODE_SET)) {
    errors.push(error('invalid_enum', 'mode.effective cannot be Live or an unknown mode', 'mode.effective'));
    effective = EFFECTIVE_RUNTIME_MODE.ADVISORY;
  }
  if (effective === REQUESTED_RUNTIME_MODE.LIVE) {
    errors.push(error('live_mode_not_authorized', 'Effective runtime mode cannot be live in Stage 7.1', 'mode.effective'));
  }
  return {
    requested: inSet(requested, REQUESTED_MODE_SET) ? requested : REQUESTED_RUNTIME_MODE.ADVISORY,
    effective,
    maturity: inSet(maturity, MATURITY_SET) ? maturity : DECISION_MATURITY_MODE.ADVISORY,
    liveRequested,
    liveAuthorized: false,
    liveSilentlyForcedToDemo: false,
  };
}

function resolveFreshnessConstraints(input, errors) {
  const raw = input?.freshnessConstraints && typeof input.freshnessConstraints === 'object'
    ? input.freshnessConstraints
    : {};
  rejectUnknownKeys(raw, ALLOWED_FRESHNESS_CONSTRAINT_KEYS, 'freshnessConstraints', errors);
  const requiredStatuses = asArray(raw.requiredStatuses ?? [FRESHNESS_STATUS.FRESH]);
  for (const status of requiredStatuses) {
    if (!inSet(status, FRESHNESS_SET)) {
      errors.push(error('invalid_enum', 'freshnessConstraints.requiredStatuses contains an unknown status', 'freshnessConstraints.requiredStatuses'));
    }
  }
  let maxAgeMs = raw.maxAgeMs ?? null;
  if (maxAgeMs != null) {
    maxAgeMs = Number(maxAgeMs);
    if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) {
      errors.push(error('invalid_constraint', 'freshnessConstraints.maxAgeMs must be a non-negative number', 'freshnessConstraints.maxAgeMs'));
      maxAgeMs = null;
    }
  }
  return {
    maxAgeMs,
    requiredStatuses: requiredStatuses.filter((status) => inSet(status, FRESHNESS_SET)),
    staleIsNotCurrent: true,
    staleIsNotNeutral: true,
  };
}

function resolveQualityConstraints(input, errors) {
  const raw = input?.qualityConstraints && typeof input.qualityConstraints === 'object'
    ? input.qualityConstraints
    : {};
  rejectUnknownKeys(raw, ALLOWED_QUALITY_CONSTRAINT_KEYS, 'qualityConstraints', errors);
  const requiredStatuses = asArray(raw.requiredStatuses ?? [DATA_QUALITY_STATUS.OK]);
  for (const status of requiredStatuses) {
    if (!inSet(status, QUALITY_SET)) {
      errors.push(error('invalid_enum', 'qualityConstraints.requiredStatuses contains an unknown status', 'qualityConstraints.requiredStatuses'));
    }
  }
  return {
    requiredStatuses: requiredStatuses.filter((status) => inSet(status, QUALITY_SET)),
    insufficientIsNotNeutral: true,
  };
}

function resolveOwner(input, errors) {
  const owner = input?.owner && typeof input.owner === 'object' ? input.owner : {};
  const tenantScope = input?.tenantScope && typeof input.tenantScope === 'object' ? input.tenantScope : {};
  rejectUnknownKeys(owner, ALLOWED_OWNER_KEYS, 'owner', errors);
  rejectUnknownKeys(tenantScope, ALLOWED_TENANT_KEYS, 'tenantScope', errors);
  const userId = normalizeUuid(owner.userId, 'owner.userId', errors, { required: true });
  const tenantId = normalizeUuid(owner.tenantId ?? tenantScope.tenantId, 'tenantScope.tenantId', errors);
  const scopeType = tenantScope.scopeType ?? OWNERSHIP_SCOPE_TYPE.USER;
  if (!inSet(scopeType, OWNERSHIP_SET)) {
    errors.push(error('invalid_enum', 'tenantScope.scopeType is not a canonical ownership scope', 'tenantScope.scopeType'));
  }
  return {
    owner: { userId, tenantId },
    tenantScope: {
      tenantId,
      scopeType: inSet(scopeType, OWNERSHIP_SET) ? scopeType : OWNERSHIP_SCOPE_TYPE.USER,
    },
  };
}

/**
 * Create, validate, normalize and freeze a Stage 7.1 Decision Context.
 * Same input + same options.nowMs → same contextId.
 */
export function buildDecisionContext(input = {}, options = {}) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input', 'Decision Context input must be an object');
  }

  rejectUnknownKeys(input, ALLOWED_INPUT_KEYS, null, errors);
  if (input.evidenceReferences) {
    rejectUnknownKeys(input.evidenceReferences, ALLOWED_EVIDENCE_REF_KEYS, 'evidenceReferences', errors);
  }

  const requestSurface = {
    ...input,
    orchestrationSet: undefined,
    orchestrationSets: undefined,
    evidenceReferences: input.evidenceReferences
      ? {
        orchestrationSetIds: input.evidenceReferences.orchestrationSetIds,
      }
      : undefined,
  };
  const forbiddenKeys = collectForbiddenKeys(requestSurface);
  if (forbiddenKeys.length) {
    errors.push(error('forbidden_field', `Forbidden execution/secret field: ${forbiddenKeys.join(', ')}`, forbiddenKeys[0]));
  }
  const forbiddenValues = collectForbiddenAuthorityValues(requestSurface);
  if (forbiddenValues.length) {
    errors.push(error(
      'forbidden_execution_authority',
      `Decision Context must not carry BUY/SELL/EXECUTE authority (${forbiddenValues.join(', ')})`,
      'mode',
    ));
  }
  const secretKeys = collectForbiddenSecretKeys(requestSurface);
  if (secretKeys.length) {
    errors.push(error('forbidden_secret_field', `Secret-bearing keys are prohibited: ${secretKeys.join(', ')}`, secretKeys[0]));
  }

  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const collected = collectOrchestrationSets(input);
  const requestedIds = collectOrchestrationIds(input, collected);

  if (!requestedIds.length) {
    errors.push(error(
      'missing_evidence_references',
      'Decision Context requires at least one EvidenceOrchestrationSet id',
      'evidenceReferences.orchestrationSetIds',
    ));
  }
  if (requestedIds.length > MAX_ORCHESTRATION_SET_REFS) {
    errors.push(error(
      'evidence_reference_limit',
      `At most ${MAX_ORCHESTRATION_SET_REFS} OrchestrationSet references are allowed`,
      'evidenceReferences.orchestrationSetIds',
    ));
  }

  const resolvedSets = [];
  requestedIds.forEach((id, index) => {
    if (!isCanonicalUuid(id)) {
      errors.push(error('invalid_identifier', 'orchestrationSetId must be a canonical UUID', `evidenceReferences.orchestrationSetIds[${index}]`));
      return;
    }
    const set = collected.byId.get(id);
    if (!set) {
      errors.push(error(
        'missing_orchestration_set',
        'Referenced EvidenceOrchestrationSet was not provided; Stage 7.1 does not load evidence from DB',
        `evidenceReferences.orchestrationSetIds[${index}]`,
      ));
      return;
    }
    const validated = validateOrchestrationSet(set, errors, index);
    if (validated) resolvedSets.push(validated);
  });

  const { owner, tenantScope } = resolveOwner(input, errors);
  const taskDomain = input.taskDomain ?? TASK_DOMAIN.MARKET_ANALYSIS;
  if (!inSet(taskDomain, TASK_DOMAIN_SET)) {
    errors.push(error('invalid_enum', 'taskDomain is not a supported Decision Context domain', 'taskDomain'));
  }
  const environment = input.environment ?? ENVIRONMENT.TEST;
  if (!inSet(environment, ENVIRONMENT_SET)) {
    errors.push(error('invalid_enum', 'environment must be test, staging or production', 'environment'));
  }
  const privacyClass = input.privacyClass ?? PRIVACY_CLASS.INTERNAL_PRODUCT_SAFE;
  if (!inSet(privacyClass, PRIVACY_SET)) {
    errors.push(error('invalid_enum', 'privacyClass is not a supported privacy class', 'privacyClass'));
  }

  const marketScope = resolveMarketScope(input, resolvedSets, errors);
  const timeframe = normalizeText(input.timeframe ?? resolvedSets[0]?.context?.timeframe);
  const analysisHorizon = normalizeText(input.analysisHorizon ?? resolvedSets[0]?.context?.analysisHorizon);
  if (!timeframe) {
    errors.push(error('missing_field', 'timeframe is required', 'timeframe'));
  }

  const sourceWindowInput = input.sourceWindow && typeof input.sourceWindow === 'object' ? input.sourceWindow : {};
  rejectUnknownKeys(sourceWindowInput, ALLOWED_SOURCE_WINDOW_KEYS, 'sourceWindow', errors);
  const windowFromSet = resolvedSets[0]?.evidenceWindow || {};
  const sourceWindow = {
    since: normalizeTimestamp(sourceWindowInput.since ?? windowFromSet.since, 'sourceWindow.since', errors),
    until: normalizeTimestamp(sourceWindowInput.until ?? windowFromSet.until, 'sourceWindow.until', errors),
  };
  if (sourceWindow.since && sourceWindow.until && Date.parse(sourceWindow.since) > Date.parse(sourceWindow.until)) {
    errors.push(error('invalid_source_window', 'sourceWindow.since must not be after sourceWindow.until', 'sourceWindow'));
  }

  const mode = resolveMode(input, errors);
  const freshnessConstraints = resolveFreshnessConstraints(input, errors);
  const qualityConstraints = resolveQualityConstraints(input, errors);

  if (errors.length) {
    return fail('invalid_decision_context', 'Decision Context failed validation', errors);
  }

  const evidenceAvailability = resolvedSets.map((set) => freezeDeep({
    orchestrationSetId: set.orchestrationId,
    ...classifyEvidence(set),
    lineage: {
      contributingRunIds: asArray(set.lineage?.contributingRunIds),
      excludedRunIds: asArray(set.lineage?.excludedRunIds),
      orchestrationContractVersion: set.contractVersion ?? ORCHESTRATION_CONTRACT_VERSION,
      ingestionContractVersion: set.lineage?.ingestionContractVersion ?? null,
      evidenceContractVersion: set.lineage?.evidenceContractVersion ?? null,
    },
    provenance: set.provenance ?? null,
  }));

  const limitations = [...DECISION_CONTEXT_LIMITATIONS];
  if (mode.liveRequested) {
    limitations.push('live_requested_not_authorized_stage_7_1');
  }

  const seedParts = [
    DECISION_CONTEXT_CONTRACT_VERSION,
    String(nowMs),
    owner.userId,
    tenantScope.tenantId || '',
    taskDomain,
    marketScope.provider,
    marketScope.venue,
    marketScope.marketType,
    marketScope.symbol,
    timeframe,
    analysisHorizon || '',
    sourceWindow.since || '',
    sourceWindow.until || '',
    environment,
    mode.requested,
    mode.effective,
    mode.maturity,
    privacyClass,
    ...requestedIds.slice().sort(),
  ];
  const contextId = options.contextId
    || (options.deterministicId === false ? randomUUID() : hashToUuid(seedParts.join('|')));

  const generatedAt = nowIso(nowMs);
  const artifact = {
    schemaVersion: DECISION_CONTEXT_SCHEMA_VERSION,
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    policyVersion: DECISION_CONTEXT_POLICY_VERSION,
    contextId,
    generatedAt,
    frozenAt: generatedAt,
    stage: DECISION_CONTEXT_STAGE,
    lifecycleState: DECISION_CONTEXT_LIFECYCLE.FROZEN,
    owner: freezeDeep(owner),
    tenantScope: freezeDeep(tenantScope),
    taskDomain,
    marketScope: freezeDeep(marketScope),
    timeframe,
    analysisHorizon,
    sourceWindow: freezeDeep(sourceWindow),
    environment,
    mode: freezeDeep(mode),
    freshnessConstraints: freezeDeep(freshnessConstraints),
    qualityConstraints: freezeDeep(qualityConstraints),
    privacyClass,
    evidenceReferences: freezeDeep({
      orchestrationSetIds: requestedIds,
      orchestrationContractVersion: REQUIRED_ORCHESTRATION_CONTRACT_VERSION,
    }),
    evidenceAvailability: freezeDeep(evidenceAvailability),
    limitations,
    lineage: freezeDeep({
      decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
      orchestrationContractVersion: REQUIRED_ORCHESTRATION_CONTRACT_VERSION,
      orchestrationSetIds: requestedIds,
      contributingRunIds: evidenceAvailability.flatMap((item) => item.lineage.contributingRunIds).filter(Boolean),
      excludedRunIds: evidenceAvailability.flatMap((item) => item.lineage.excludedRunIds).filter(Boolean),
      inputProvenance: evidenceAvailability.map((item) => item.provenance).filter(Boolean),
    }),
    provenance: freezeDeep({
      writer: DECISION_CONTEXT_WRITER,
      stage: 'ARTEMIS_CORE_STAGE_7_1',
      inputOwner: 'artemisEvidenceOrchestrationService',
      inputArtifact: 'EvidenceOrchestrationSet',
      note: 'decision_context_not_artemis_decision',
    }),
    readiness: freezeDeep({
      decisionContext: 'AVAILABLE',
      cognitiveDecision: 'NOT_IMPLEMENTED',
      cognitiveKernelStarted: false,
      executionEligible: false,
      approvedForExecution: false,
      decisionEligible: false,
    }),
    sideEffects: { ...ZERO_DECISION_CONTEXT_SIDE_EFFECTS },
    executionEligible: false,
    decisionEligible: false,
    approvedForExecution: false,
    cognitiveKernelStarted: false,
    synthesizedDirection: null,
    financialRecommendation: null,
  };

  const bytes = utf8ByteLength(artifact);
  if (bytes > MAX_DECISION_CONTEXT_UTF8_BYTES) {
    return fail('decision_context_too_large', `Decision Context exceeds ${MAX_DECISION_CONTEXT_UTF8_BYTES} bytes`, [
      error('decision_context_too_large', `utf8 bytes=${bytes}`),
    ]);
  }

  return { ok: true, code: 'FROZEN', message: 'Decision Context frozen', errors: [], context: freezeDeep(artifact) };
}

export function validateDecisionContext(input, options = {}) {
  const result = buildDecisionContext(input, options);
  if (!result.ok) return result;
  return { ok: true, code: 'VALID', message: 'Decision Context is valid', errors: [], context: result.context };
}

export function freezeDecisionContext(input, options = {}) {
  return buildDecisionContext(input, options);
}

export default {
  buildDecisionContext,
  validateDecisionContext,
  freezeDecisionContext,
};
