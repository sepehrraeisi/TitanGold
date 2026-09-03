/**
 * @jest-environment node
 *
 * Artemis Core Stage 7.1 — Decision Context foundation tests.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const {
  AUTHORITY_CLASS,
  DATA_QUALITY_STATUS,
  FRESHNESS_STATUS,
} = await import('../../contracts/artemisEvidenceContract.js');
const { INGESTION_DISPOSITION } = await import('../../contracts/artemisEvidenceIngestionContract.js');
const { ORCHESTRATION_CONTRACT_VERSION } = await import('../../contracts/artemisEvidenceOrchestrationContract.js');
const {
  DECISION_CONTEXT_CONTRACT_VERSION,
  DECISION_CONTEXT_LIFECYCLE,
  DECISION_CONTEXT_SCHEMA_VERSION,
  DECISION_CONTEXT_WRITER,
  DECISION_MATURITY_MODE,
  ENVIRONMENT,
  EVIDENCE_REF_SEMANTICS,
  OWNERSHIP_SCOPE_TYPE,
  PRIVACY_CLASS,
  REQUESTED_RUNTIME_MODE,
  TASK_DOMAIN,
  ZERO_DECISION_CONTEXT_SIDE_EFFECTS,
} = await import('../../contracts/artemisDecisionContextContract.js');
const {
  buildDecisionContext,
  freezeDecisionContext,
  validateDecisionContext,
} = await import('../../services/artemisDecisionContextService.js');

const NOW = Date.parse('2026-09-03T06:50:00.000Z');
const SINCE = '2026-09-03T05:00:00.000Z';
const UNTIL = '2026-09-03T06:00:00.000Z';
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-0000000000a1';
const TENANT = 'bbbbbbbb-bbbb-4bbb-8bbb-0000000000b1';
const ORCH_ID = 'cccccccc-cccc-4ccc-8ccc-0000000000c1';
const RUN_TECHNICAL = 'dddddddd-dddd-4ddd-8ddd-0000000000d1';
const RUN_RISK = 'eeeeeeee-eeee-4eee-8eee-0000000000e1';

function orchestrationSet(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    contractVersion: ORCHESTRATION_CONTRACT_VERSION,
    orchestrationId: ORCH_ID,
    generatedAt: UNTIL,
    stage: 6,
    context: {
      decisionContextId: null,
      provider: 'mexc',
      venue: 'mexc',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      timeframe: '1h',
      analysisHorizon: 'intraday',
      ownershipScope: 'user',
      ownerUserId: OWNER,
    },
    evidenceWindow: { since: SINCE, until: UNTIL, limit: 50, maxLimit: 50, queriedAt: UNTIL },
    includedEvidence: [
      {
        agentId: 'technical',
        runId: RUN_TECHNICAL,
        authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
        independentConfirmation: false,
      },
    ],
    excludedEvidence: [
      {
        agentId: 'sentiment',
        runId: 'ffffffff-ffff-4fff-8fff-0000000000f1',
        disposition: INGESTION_DISPOSITION.UNAVAILABLE,
        semantics: EVIDENCE_REF_SEMANTICS.UNAVAILABLE_NOT_NEUTRAL,
        usable: false,
        neutralVote: false,
        negativeVote: false,
      },
      {
        agentId: 'liquidity',
        runId: 'ffffffff-ffff-4fff-8fff-0000000000f2',
        disposition: INGESTION_DISPOSITION.BLOCKED,
        semantics: EVIDENCE_REF_SEMANTICS.BLOCKED_NOT_NEUTRAL,
        usable: false,
        neutralVote: false,
        negativeVote: false,
      },
    ],
    missingEvidence: [
      {
        agentId: 'fundamental',
        status: 'MISSING',
        semantics: EVIDENCE_REF_SEMANTICS.MISSING_NOT_NEGATIVE,
        negativeVote: false,
        neutralVote: false,
        authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
      },
    ],
    lineage: {
      ingestionContractVersion: 'artemis-evidence-ingestion-1.0.0',
      evidenceContractVersion: 'artemis-evidence-1.0.0',
      orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
      contributingRunIds: [RUN_TECHNICAL],
      excludedRunIds: [RUN_RISK],
    },
    provenance: {
      writer: 'artemisEvidenceOrchestrationService',
      stage: 'ARTEMIS_CORE_STAGE_6',
      inputOwner: 'artemisEvidenceIngestionService',
      inputMethod: 'ingestEvidenceBatch',
      note: 'evidence_orchestration_set_not_artemis_decision',
    },
    readiness: {
      canonicalEvidenceOrchestration: 'AVAILABLE',
      cognitiveDecision: 'NOT_IMPLEMENTED',
      executionEligible: false,
      approvedForExecution: false,
      decisionEligible: false,
    },
    executionEligible: false,
    decisionEligible: false,
    approvedForExecution: false,
    synthesizedDirection: null,
    financialRecommendation: null,
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    owner: { userId: OWNER, tenantId: TENANT },
    tenantScope: { tenantId: TENANT, scopeType: OWNERSHIP_SCOPE_TYPE.USER },
    taskDomain: TASK_DOMAIN.MARKET_ANALYSIS,
    marketScope: {
      provider: 'mexc',
      venue: 'mexc',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
    },
    timeframe: '1h',
    analysisHorizon: 'intraday',
    sourceWindow: { since: SINCE, until: UNTIL },
    environment: ENVIRONMENT.TEST,
    mode: {
      requested: REQUESTED_RUNTIME_MODE.ADVISORY,
      effective: REQUESTED_RUNTIME_MODE.ADVISORY,
      maturity: DECISION_MATURITY_MODE.ADVISORY,
    },
    freshnessConstraints: {
      maxAgeMs: 3_600_000,
      requiredStatuses: [FRESHNESS_STATUS.FRESH],
    },
    qualityConstraints: {
      requiredStatuses: [DATA_QUALITY_STATUS.OK],
    },
    privacyClass: PRIVACY_CLASS.INTERNAL_PRODUCT_SAFE,
    evidenceReferences: {
      orchestrationSetIds: [ORCH_ID],
    },
    orchestrationSet: orchestrationSet(),
    ...overrides,
  };
}

describe('Stage 7.1 Decision Context — happy path', () => {
  it('freezes a validated Decision Context from a Stage 6 OrchestrationSet', () => {
    const result = buildDecisionContext(baseInput(), { nowMs: NOW });
    expect(result.ok).toBe(true);
    const ctx = result.context;
    expect(ctx.schemaVersion).toBe(DECISION_CONTEXT_SCHEMA_VERSION);
    expect(ctx.contractVersion).toBe(DECISION_CONTEXT_CONTRACT_VERSION);
    expect(ctx.lifecycleState).toBe(DECISION_CONTEXT_LIFECYCLE.FROZEN);
    expect(ctx.stage).toBe(7.1);
    expect(ctx.owner.userId).toBe(OWNER);
    expect(ctx.tenantScope.tenantId).toBe(TENANT);
    expect(ctx.taskDomain).toBe(TASK_DOMAIN.MARKET_ANALYSIS);
    expect(ctx.marketScope.symbol).toBe('BTC/USDT');
    expect(ctx.timeframe).toBe('1h');
    expect(ctx.sourceWindow.since).toBe(SINCE);
    expect(ctx.environment).toBe(ENVIRONMENT.TEST);
    expect(ctx.mode.maturity).toBe(DECISION_MATURITY_MODE.ADVISORY);
    expect(ctx.freshnessConstraints.requiredStatuses).toContain(FRESHNESS_STATUS.FRESH);
    expect(ctx.qualityConstraints.requiredStatuses).toContain(DATA_QUALITY_STATUS.OK);
    expect(ctx.privacyClass).toBe(PRIVACY_CLASS.INTERNAL_PRODUCT_SAFE);
    expect(ctx.evidenceReferences.orchestrationSetIds).toEqual([ORCH_ID]);
    expect(ctx.provenance.writer).toBe(DECISION_CONTEXT_WRITER);
    expect(ctx.provenance.note).toBe('decision_context_not_artemis_decision');
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it('is deterministic for the same input and nowMs', () => {
    const a = buildDecisionContext(baseInput(), { nowMs: NOW }).context;
    const b = buildDecisionContext(baseInput(), { nowMs: NOW }).context;
    expect(a.contextId).toBe(b.contextId);
    expect(a.generatedAt).toBe(b.generatedAt);
  });

  it('validateDecisionContext and freezeDecisionContext share the frozen snapshot', () => {
    const validated = validateDecisionContext(baseInput(), { nowMs: NOW });
    const frozen = freezeDecisionContext(baseInput(), { nowMs: NOW });
    expect(validated.ok).toBe(true);
    expect(frozen.context.contextId).toBe(validated.context.contextId);
    expect(frozen.context.lifecycleState).toBe(DECISION_CONTEXT_LIFECYCLE.FROZEN);
  });
});

describe('Stage 7.1 Decision Context — rejection', () => {
  it('rejects invalid owner identity', () => {
    const result = buildDecisionContext(baseInput({ owner: { userId: 'not-a-uuid' } }), { nowMs: NOW });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'owner.userId')).toBe(true);
  });

  it('rejects missing EvidenceOrchestrationSet references', () => {
    const result = buildDecisionContext(baseInput({
      evidenceReferences: { orchestrationSetIds: [] },
      orchestrationSet: undefined,
      orchestrationSets: undefined,
    }), { nowMs: NOW });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_evidence_references')).toBe(true);
  });

  it('rejects a referenced OrchestrationSet that was not provided', () => {
    const result = buildDecisionContext(baseInput({
      orchestrationSet: undefined,
      evidenceReferences: { orchestrationSetIds: [ORCH_ID] },
    }), { nowMs: NOW });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_orchestration_set')).toBe(true);
  });

  it('rejects an incompatible OrchestrationSet contract version', () => {
    const result = buildDecisionContext(baseInput({
      orchestrationSet: orchestrationSet({ contractVersion: 'not-stage-6' }),
    }), { nowMs: NOW });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'incompatible_orchestration_contract')).toBe(true);
  });

  it('rejects unknown request fields', () => {
    const result = buildDecisionContext(baseInput({ extraVoteWeight: 3 }), { nowMs: NOW });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'unknown_field')).toBe(true);
  });

  it('rejects forbidden execution fields such as orderId', () => {
    const result = buildDecisionContext(baseInput({ orderId: 'order-1' }), { nowMs: NOW });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'unknown_field' || e.code === 'forbidden_field')).toBe(true);
  });

  it('rejects BUY/SELL authority on the Decision Context request', () => {
    const result = buildDecisionContext(baseInput({
      mode: {
        requested: 'BUY',
        effective: REQUESTED_RUNTIME_MODE.ADVISORY,
        maturity: DECISION_MATURITY_MODE.ADVISORY,
      },
    }), { nowMs: NOW });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => (
      e.code === 'forbidden_execution_authority' || e.code === 'invalid_enum'
    ))).toBe(true);
  });

  it('rejects secret-bearing request keys', () => {
    const result = buildDecisionContext(baseInput({ apiSecret: 'nope' }), { nowMs: NOW });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => (
      e.code === 'unknown_field' || e.code === 'forbidden_field' || e.code === 'forbidden_secret_field'
    ))).toBe(true);
  });

  it('rejects incompatible OrchestrationSet market context', () => {
    const result = buildDecisionContext(baseInput({
      orchestrationSet: orchestrationSet({
        context: {
          provider: 'binance',
          venue: 'binance',
          marketType: 'spot',
          symbol: 'ETH/USDT',
          timeframe: '1h',
        },
      }),
    }), { nowMs: NOW });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'context_incompatible')).toBe(true);
  });
});

describe('Stage 7.1 Decision Context — availability semantics', () => {
  it('does not treat UNAVAILABLE as NEUTRAL', () => {
    const ctx = buildDecisionContext(baseInput(), { nowMs: NOW }).context;
    const unavailable = ctx.evidenceAvailability[0].excluded.filter((r) => r.disposition === INGESTION_DISPOSITION.UNAVAILABLE);
    expect(unavailable.length).toBeGreaterThan(0);
    expect(unavailable.every((r) => r.neutralVote === false)).toBe(true);
    expect(unavailable.every((r) => r.semantics === EVIDENCE_REF_SEMANTICS.UNAVAILABLE_NOT_NEUTRAL)).toBe(true);
  });

  it('does not treat BLOCKED as NEUTRAL', () => {
    const ctx = buildDecisionContext(baseInput(), { nowMs: NOW }).context;
    const blocked = ctx.evidenceAvailability[0].excluded.filter((r) => r.disposition === INGESTION_DISPOSITION.BLOCKED);
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.every((r) => r.neutralVote === false)).toBe(true);
    expect(blocked.every((r) => r.semantics === EVIDENCE_REF_SEMANTICS.BLOCKED_NOT_NEUTRAL)).toBe(true);
  });

  it('does not treat MISSING as a negative or NEUTRAL vote', () => {
    const ctx = buildDecisionContext(baseInput(), { nowMs: NOW }).context;
    const missing = ctx.evidenceAvailability[0].missing;
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((r) => r.negativeVote === false)).toBe(true);
    expect(missing.every((r) => r.neutralVote === false)).toBe(true);
    expect(missing.every((r) => r.semantics === EVIDENCE_REF_SEMANTICS.MISSING_NOT_NEGATIVE)).toBe(true);
  });
});

describe('Stage 7.1 Decision Context — lineage and non-execution', () => {
  it('preserves OrchestrationSet lineage and provenance', () => {
    const ctx = buildDecisionContext(baseInput(), { nowMs: NOW }).context;
    expect(ctx.lineage.orchestrationSetIds).toEqual([ORCH_ID]);
    expect(ctx.lineage.contributingRunIds).toContain(RUN_TECHNICAL);
    expect(ctx.lineage.excludedRunIds).toContain(RUN_RISK);
    expect(ctx.lineage.orchestrationContractVersion).toBe(ORCHESTRATION_CONTRACT_VERSION);
    expect(ctx.evidenceAvailability[0].provenance.stage).toBe('ARTEMIS_CORE_STAGE_6');
  });

  it('never sets execution or Cognitive Kernel flags', () => {
    const ctx = buildDecisionContext(baseInput(), { nowMs: NOW }).context;
    expect(ctx.executionEligible).toBe(false);
    expect(ctx.decisionEligible).toBe(false);
    expect(ctx.approvedForExecution).toBe(false);
    expect(ctx.cognitiveKernelStarted).toBe(false);
    expect(ctx.readiness.cognitiveKernelStarted).toBe(false);
    expect(ctx.readiness.cognitiveDecision).toBe('NOT_IMPLEMENTED');
    expect(ctx.synthesizedDirection).toBeNull();
    expect(ctx.financialRecommendation).toBeNull();
    expect(ctx.sideEffects).toEqual(ZERO_DECISION_CONTEXT_SIDE_EFFECTS);
    expect(ctx).not.toHaveProperty('orderId');
  });

  it('records a Live request without authorizing Live or silently claiming Demo success', () => {
    const result = buildDecisionContext(baseInput({
      mode: {
        requested: REQUESTED_RUNTIME_MODE.LIVE,
        maturity: DECISION_MATURITY_MODE.ADVISORY,
      },
    }), { nowMs: NOW });
    expect(result.ok).toBe(true);
    expect(result.context.mode.requested).toBe(REQUESTED_RUNTIME_MODE.LIVE);
    expect(result.context.mode.effective).toBe(REQUESTED_RUNTIME_MODE.ADVISORY);
    expect(result.context.mode.liveRequested).toBe(true);
    expect(result.context.mode.liveAuthorized).toBe(false);
    expect(result.context.mode.liveSilentlyForcedToDemo).toBe(false);
    expect(result.context.limitations).toContain('live_requested_not_authorized_stage_7_1');
  });

  it('rejects an explicit effective Live mode', () => {
    const result = buildDecisionContext(baseInput({
      mode: {
        requested: REQUESTED_RUNTIME_MODE.LIVE,
        effective: REQUESTED_RUNTIME_MODE.LIVE,
        maturity: DECISION_MATURITY_MODE.ADVISORY,
      },
    }), { nowMs: NOW });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_enum' || e.code === 'live_mode_not_authorized')).toBe(true);
  });
});

describe('Stage 7.1 static safety — production source', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const serviceSrc = readFileSync(path.join(root, 'services/artemisDecisionContextService.js'), 'utf8');
  const contractSrc = readFileSync(path.join(root, 'contracts/artemisDecisionContextContract.js'), 'utf8');

  it('does not import legacy orchestrator, providers, DB, Redis or order execution', () => {
    expect(serviceSrc).not.toMatch(/from ['"].*artemisOrchestrator/);
    expect(serviceSrc).not.toMatch(/import\(.*artemisOrchestrator/);
    expect(serviceSrc).not.toMatch(/from ['"].*\/db\.js/);
    expect(serviceSrc).not.toMatch(/from ['"].*redis/i);
    expect(serviceSrc).not.toMatch(/@google\/generative-ai|\bfrom ['"]openai['"]/);
    expect(serviceSrc).not.toMatch(/\bplaceOrder\s*\(|\bexecuteOrder\s*\(|\btradingEngine\b/);
    expect(serviceSrc).not.toMatch(/ingestEvidenceBatch|orchestrateEvidence/);
    expect(serviceSrc).toMatch(/EvidenceOrchestrationSet/);
  });

  it('does not synthesize decisions or votes in the contract', () => {
    expect(contractSrc).toMatch(/no_cognitive_kernel/);
    expect(contractSrc).toMatch(/no_majority_voting/);
    expect(contractSrc).toMatch(/no_execution_authorization/);
    expect(contractSrc).not.toMatch(/weighted_vote/);
    expect(serviceSrc).not.toMatch(/majorityVote\s*\(|weightedVote\s*\(|averageConfidence\s*\(/);
  });
});
