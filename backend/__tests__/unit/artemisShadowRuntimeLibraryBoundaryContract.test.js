/**
 * @jest-environment node
 *
 * Artemis Core Stage 8 — S8-SHADOW-RT-BOUNDARY
 * Shadow Runtime Library Boundary unit tests.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTHORITY_CLASS,
  AVAILABILITY,
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  FRESHNESS_STATUS,
  MARKET_TYPE,
} from '../../contracts/artemisEvidenceContract.js';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
  DECISION_CONTEXT_LIFECYCLE,
  DECISION_MATURITY_MODE,
  EFFECTIVE_RUNTIME_MODE,
  ENVIRONMENT,
  REQUESTED_RUNTIME_MODE,
} from '../../contracts/artemisDecisionContextContract.js';
import {
  DECISION_CONTRACT_VERSION,
  buildContractOnlyArtemisDecision,
} from '../../contracts/artemisDecisionContract.js';
import { ORCHESTRATION_CONTRACT_VERSION } from '../../contracts/artemisEvidenceOrchestrationContract.js';
import {
  CAPABILITY_STATE,
  CONTROL_CHAIN_CONTRACT_VERSION,
  CONTROL_CHAIN_LIFECYCLE,
  CONTROL_OUTCOME,
  LIQUIDITY_GATE_OUTCOME,
  PORTFOLIO_GATE_OUTCOME,
  REQUESTED_OPERATION_CLASS,
  RISK_GATE_OUTCOME,
  buildContractOnlyControlChainArtifact,
} from '../../contracts/artemisControlChainContract.js';
import { MARKET_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisMarketContextContract.js';
import {
  REQUIRED_HARD_FLAGS as C81_HARD_FLAGS,
  buildShadowDecisionRecording,
} from '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js';
import {
  REQUIRED_HARD_FLAGS,
  SHADOW_CYCLE_ARTIFACT_TYPE,
  SHADOW_RUNTIME_CONTRACT_VERSION,
  SHADOW_RUNTIME_LIMITATIONS,
  SHADOW_RUNTIME_METHOD_KEY,
  SHADOW_RUNTIME_POLICY_VERSION,
  SHADOW_RUNTIME_SCHEMA_VERSION,
  SHADOW_RUNTIME_STAGE,
  SHADOW_RUNTIME_WRITER,
  ZERO_SHADOW_RUNTIME_SIDE_EFFECTS,
  buildShadowCycleComposition,
  validateShadowCycleComposition,
} from '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js';

const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RUN_A = '11111111-1111-4111-8111-111111111111';
const RUN_B = '22222222-2222-4222-8222-222222222222';
const RUN_EXCLUDED = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const ORCH_ID = '33333333-3333-4333-8333-333333333333';
const MC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RECORDED_AT = '2026-09-20T12:00:00.000Z';

const CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js',
);

function baseDecision(overrides = {}) {
  return buildContractOnlyArtemisDecision({
    decisionId: DECISION_ID,
    decisionContextId: CONTEXT_ID,
    symbol: 'BTC/USDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    venue: 'mexc',
    marketType: MARKET_TYPE.SPOT,
    timeframe: '1h',
    analysisHorizon: 'intraday',
    createdAt: RECORDED_AT,
    analysisAt: RECORDED_AT,
    sourceWindow: { start: '2026-09-20T10:00:00.000Z', end: '2026-09-20T11:00:00.000Z' },
    ...overrides,
  });
}

function baseContext(overrides = {}) {
  return {
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    contextId: CONTEXT_ID,
    lifecycleState: DECISION_CONTEXT_LIFECYCLE.FROZEN,
    environment: ENVIRONMENT.TEST,
    timeframe: '1h',
    analysisHorizon: 'intraday',
    marketScope: {
      provider: 'mexc',
      venue: 'mexc',
      marketType: MARKET_TYPE.SPOT,
      symbol: 'BTC/USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
    },
    mode: {
      requested: REQUESTED_RUNTIME_MODE.SHADOW,
      effective: EFFECTIVE_RUNTIME_MODE.SHADOW,
      maturity: DECISION_MATURITY_MODE.SHADOW,
    },
    sourceWindow: {
      since: '2026-09-20T10:00:00.000Z',
      until: '2026-09-20T11:00:00.000Z',
    },
    evidenceReferences: {
      orchestrationSetIds: [ORCH_ID],
      orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
    },
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    ...overrides,
  };
}

function baseEvidenceSet(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    contractVersion: ORCHESTRATION_CONTRACT_VERSION,
    orchestrationId: ORCH_ID,
    generatedAt: RECORDED_AT,
    stage: 6,
    includedEvidence: [
      { agentId: 'technical', runId: RUN_A, authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE },
      { agentId: 'trend', runId: RUN_B, authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE },
    ],
    excludedEvidence: [
      {
        agentId: 'sentiment',
        runId: RUN_EXCLUDED,
        disposition: 'UNAVAILABLE',
        usable: false,
      },
    ],
    conflicts: [],
    missingEvidence: [],
    lineage: {
      evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
      orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
      contributingRunIds: [RUN_A, RUN_B],
      excludedRunIds: [RUN_EXCLUDED],
    },
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    ...overrides,
  };
}

function controlChainContext(overrides = {}) {
  return {
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    contextId: CONTEXT_ID,
    lifecycleState: DECISION_CONTEXT_LIFECYCLE.FROZEN,
    environment: ENVIRONMENT.TEST,
    timeframe: '1h',
    analysisHorizon: 'intraday',
    marketScope: {
      provider: 'mexc',
      venue: 'mexc',
      marketType: MARKET_TYPE.SPOT,
      symbol: 'BTC/USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
    },
    mode: {
      requested: REQUESTED_RUNTIME_MODE.ADVISORY,
      effective: EFFECTIVE_RUNTIME_MODE.ADVISORY,
    },
    sourceWindow: {
      since: '2026-09-20T10:00:00.000Z',
      until: '2026-09-20T11:00:00.000Z',
    },
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    ...overrides,
  };
}

function baseControlChain(overrides = {}) {
  const built = buildContractOnlyControlChainArtifact({
    artemisCognitiveDecision: baseDecision(),
    decisionContext: controlChainContext(),
    lineage: {
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      contributingAgentRunIds: [RUN_A, RUN_B],
      orchestrationSetIds: [ORCH_ID],
      decisionContractVersion: DECISION_CONTRACT_VERSION,
      decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
      evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
      orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
      controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    },
    provenance: {
      writer: 'unit_test',
      methodKey: 'stage8_rt_test',
      stage: '7.3.1',
      recordedAt: RECORDED_AT,
    },
    requestedOperationClass: REQUESTED_OPERATION_CLASS.OBSERVE,
    runtimeSnapshot: {
      killSwitchActive: false,
      requestedRuntimeMode: REQUESTED_RUNTIME_MODE.ADVISORY,
      effectiveRuntimeMode: EFFECTIVE_RUNTIME_MODE.ADVISORY,
      capabilityState: CAPABILITY_STATE.GRANTED,
      ssotAvailable: true,
      ssotOwner: 'runtimeExecutionStateService',
    },
  });
  expect(built.ok).toBe(true);
  return {
    ...built.artifact,
    ...overrides,
  };
}

function validMarketContextRef(overrides = {}) {
  return {
    marketContextId: MC_ID,
    contractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
    venue: 'mexc',
    marketType: MARKET_TYPE.SPOT,
    symbol: 'BTC/USDT',
    timeframe: '1h',
    freshnessStatus: FRESHNESS_STATUS.FRESH,
    sourceTimestamp: RECORDED_AT,
    availability: AVAILABILITY.AVAILABLE,
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    decision: baseDecision(),
    decisionContext: baseContext(),
    evidenceOrchestrationSet: baseEvidenceSet(),
    controlChainArtifact: baseControlChain(),
    marketContextRef: validMarketContextRef(),
    recordedAt: RECORDED_AT,
    ...overrides,
  };
}

function expectReject(input, fieldSubstring, code) {
  const result = buildShadowCycleComposition(input);
  expect(result.ok).toBe(false);
  const hit = (result.errors || []).some(
    (e) => String(e.field || '').includes(fieldSubstring)
      && (code == null || e.code === code),
  );
  expect(hit).toBe(true);
  return result;
}

describe('artemisShadowRuntimeLibraryBoundaryContract — S8-SHADOW-RT-BOUNDARY', () => {
  it('1. builds a valid complete Shadow cycle envelope', () => {
    const result = buildShadowCycleComposition(baseInput());
    expect(result.ok).toBe(true);
    expect(result.envelope.artifactType).toBe(SHADOW_CYCLE_ARTIFACT_TYPE);
    expect(result.envelope.schemaVersion).toBe(SHADOW_RUNTIME_SCHEMA_VERSION);
    expect(result.envelope.contractVersion).toBe(SHADOW_RUNTIME_CONTRACT_VERSION);
    expect(result.envelope.policyVersion).toBe(SHADOW_RUNTIME_POLICY_VERSION);
    expect(result.envelope.decisionRef.decisionId).toBe(DECISION_ID);
    expect(result.envelope.decisionContextRef.contextId).toBe(CONTEXT_ID);
    expect(result.envelope.evidenceOrchestrationRef.orchestrationId).toBe(ORCH_ID);
    expect(result.envelope.controlChainRef.controlChainArtifactId).toBeTruthy();
    expect(result.envelope.shadowRecordingArtifact).toBeTruthy();
    expect(result.envelope.shadowRecordingRef.shadowRecordingArtifactId).toBe(
      result.envelope.shadowRecordingArtifact.shadowRecordingArtifactId,
    );
    expect(result.envelope.limitations).toEqual(expect.arrayContaining([
      'stage8_shadow_runtime_library_boundary_only',
      'does_not_activate_shadow_runtime_worker_or_scheduler',
      'observed_outcome_deferred',
      'b10_not_activated',
    ]));
    expect(result.envelope.sideEffects).toEqual(ZERO_SHADOW_RUNTIME_SIDE_EFFECTS);
    expect(result.envelope.provenance.writer).toBe(SHADOW_RUNTIME_WRITER);
    expect(result.envelope.provenance.methodKey).toBe(SHADOW_RUNTIME_METHOD_KEY);
    expect(result.envelope.provenance.stage).toBe(SHADOW_RUNTIME_STAGE);
  });

  it('2. requires and preserves canonical marketContextRef', () => {
    const result = buildShadowCycleComposition(baseInput());
    expect(result.ok).toBe(true);
    expect(result.envelope.marketContextRef.marketContextId).toBe(MC_ID);
    expect(result.envelope.marketContextRef.symbol).toBe('BTC/USDT');
    expect(result.envelope.marketContextRef.venue).toBe('mexc');
  });

  it('3. rejects missing Decision', () => {
    expectReject({ ...baseInput(), decision: undefined }, 'decision', 'missing_decision');
  });

  it('4. rejects missing Decision Context', () => {
    expectReject(
      { ...baseInput(), decisionContext: undefined },
      'decisionContext',
      'missing_decision_context',
    );
  });

  it('5. rejects missing Evidence Orchestration', () => {
    expectReject(
      { ...baseInput(), evidenceOrchestrationSet: undefined },
      'evidenceOrchestrationSet',
      'missing_evidence_orchestration_set',
    );
  });

  it('6. rejects missing Control Chain', () => {
    expectReject(
      { ...baseInput(), controlChainArtifact: undefined },
      'controlChainArtifact',
      'missing_control_chain',
    );
  });

  it('7. rejects missing marketContextRef', () => {
    expectReject(
      { ...baseInput(), marketContextRef: undefined },
      'marketContextRef',
      'missing_market_context_ref',
    );
  });

  it('7b. rejects malformed marketContextRef', () => {
    expectReject(
      { ...baseInput(), marketContextRef: 'not-an-object' },
      'marketContextRef',
      'malformed_market_context_ref',
    );
  });

  it('8. rejects marketContextRef mismatch vs Decision Context marketScope', () => {
    const result = buildShadowCycleComposition(baseInput({
      marketContextRef: validMarketContextRef({ symbol: 'ETH/USDT' }),
    }));
    expect(result.ok).toBe(false);
    expect((result.errors || []).some(
      (e) => String(e.field || '').includes('marketContextRef')
        || String(e.code || '').includes('mismatch')
        || String(e.code || '').includes('market'),
    )).toBe(true);
  });

  it('9. rejects invalid lineage', () => {
    const result = buildShadowCycleComposition(baseInput({
      lineage: { unknownLineageField: true },
    }));
    expect(result.ok).toBe(false);
  });

  it('10. rejects invalid provenance', () => {
    const result = buildShadowCycleComposition(baseInput({
      provenance: { writer: 123 },
    }));
    expect(result.ok).toBe(false);
  });

  it('11. rejects unknown top-level fields', () => {
    expectReject(
      { ...baseInput(), unexpectedField: true },
      'input.unexpectedField',
      'unknown_field',
    );
  });

  it('12. rejects raw market payload keys', () => {
    expectReject(
      { ...baseInput(), marketSnapshot: { price: 1 } },
      'marketSnapshot',
    );
  });

  it('13. rejects OHLCV', () => {
    expectReject({ ...baseInput(), ohlcv: [] }, 'ohlcv');
  });

  it('14. rejects ticker', () => {
    expectReject({ ...baseInput(), ticker: { last: 1 } }, 'ticker');
  });

  it('15. rejects orderbook', () => {
    expectReject({ ...baseInput(), orderBook: { bids: [] } }, 'orderBook');
  });

  it('16. rejects order', () => {
    expectReject({ ...baseInput(), order: { side: 'buy' } }, 'order');
  });

  it('17. rejects executionIntent', () => {
    expectReject({ ...baseInput(), executionIntent: {} }, 'executionIntent');
  });

  it('18. rejects wallet/transfer/withdrawal', () => {
    expectReject({ ...baseInput(), walletAction: {} }, 'walletAction');
    expectReject({ ...baseInput(), transfer: {} }, 'transfer');
    expectReject({ ...baseInput(), withdrawal: {} }, 'withdrawal');
  });

  it('19. rejects provider/network payload', () => {
    expectReject({ ...baseInput(), providerPayload: {} }, 'providerPayload');
    expectReject({ ...baseInput(), signedQuery: 'x' }, 'signedQuery');
  });

  it('20. rejects observedOutcome', () => {
    expectReject({ ...baseInput(), observedOutcome: {} }, 'observedOutcome');
  });

  it('21. rejects realizedPnl', () => {
    expectReject({ ...baseInput(), realizedPnl: 1.5 }, 'realizedPnl');
  });

  it('22. rejects lookahead data', () => {
    expectReject({ ...baseInput(), lookahead: {} }, 'lookahead');
    expectReject({ ...baseInput(), evaluationResult: {} }, 'evaluationResult');
  });

  it('23. keeps all authority flags hard-false including paperTradingEnabled', () => {
    const result = buildShadowCycleComposition(baseInput());
    expect(result.ok).toBe(true);
    for (const [key, value] of Object.entries(REQUIRED_HARD_FLAGS)) {
      expect(result.envelope[key]).toBe(value);
    }
    expect(result.envelope.paperTradingEnabled).toBe(false);
    expect(result.envelope.shadowRuntimeActivated).toBe(false);
    expect(result.envelope.persistenceEnabled).toBe(false);
    expect(result.envelope.b10WriteAttempted).toBe(false);
  });

  it('23b. rejects non-false authority flags on input', () => {
    expectReject(
      { ...baseInput(), paperTradingEnabled: true },
      'paperTradingEnabled',
      'hard_flag_must_be_false',
    );
    expectReject(
      { ...baseInput(), shadowRuntimeActivated: true },
      'shadowRuntimeActivated',
      'hard_flag_must_be_false',
    );
  });

  it('24. does not import or invoke B10 persistence helpers', () => {
    const src = readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).not.toMatch(/from ['"].*persistArtemisDecision/);
    expect(src).not.toMatch(/import\s+\{[^}]*persistArtemisDecision/);
    expect(src).not.toMatch(/artemis_decisions/);
    expect(src).not.toMatch(/051_artemis/);
    expect(src).not.toMatch(/053_artemis_market_context/);
  });

  it('25. derives deterministic identity', () => {
    const a = buildShadowCycleComposition(baseInput());
    const b = buildShadowCycleComposition(baseInput());
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.envelope.shadowCycleEnvelopeId).toBe(b.envelope.shadowCycleEnvelopeId);
    expect(a.envelope.shadowRecordingRef.shadowRecordingArtifactId)
      .toBe(b.envelope.shadowRecordingRef.shadowRecordingArtifactId);
  });

  it('26. identical input → identical frozen result', () => {
    const input = baseInput();
    const a = buildShadowCycleComposition(input);
    const b = buildShadowCycleComposition(input);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(JSON.stringify(a.envelope)).toBe(JSON.stringify(b.envelope));
  });

  it('27. source has no Date.now / Math.random / randomUUID / randomBytes', () => {
    const src = readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).not.toMatch(/Date\.now\s*\(/);
    expect(src).not.toMatch(/Math\.random\s*\(/);
    expect(src).not.toMatch(/randomUUID\s*\(/);
    expect(src).not.toMatch(/randomBytes\s*\(/);
  });

  it('28–35. zero side-effect counters on success', () => {
    const result = buildShadowCycleComposition(baseInput());
    expect(result.ok).toBe(true);
    expect(result.sideEffects).toEqual(ZERO_SHADOW_RUNTIME_SIDE_EFFECTS);
    expect(result.envelope.sideEffects.dbWriteCount).toBe(0);
    expect(result.envelope.sideEffects.redisWriteCount).toBe(0);
    expect(result.envelope.sideEffects.networkRequestCount).toBe(0);
    expect(result.envelope.sideEffects.providerRequestCount).toBe(0);
    expect(result.envelope.sideEffects.llmCallCount).toBe(0);
    expect(result.envelope.sideEffects.orderOperationCount).toBe(0);
    expect(result.envelope.sideEffects.financialExecutionCount).toBe(0);
    expect(result.envelope.sideEffects.runtimeMutationCount).toBe(0);
  });

  it('validateShadowCycleComposition alias matches builder', () => {
    const input = baseInput();
    const a = buildShadowCycleComposition(input);
    const b = validateShadowCycleComposition(input);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.envelope.shadowCycleEnvelopeId).toBe(b.envelope.shadowCycleEnvelopeId);
  });

  it('rejects top-level runId and taskId', () => {
    const runIdResult = buildShadowCycleComposition({ ...baseInput(), runId: RUN_A });
    expect(runIdResult.ok).toBe(false);
    expect((runIdResult.errors || []).some(
      (e) => e.field === 'runId'
        && (e.code === 'forbidden_recording_identity' || e.code === 'forbidden_key'),
    )).toBe(true);

    const taskIdResult = buildShadowCycleComposition({ ...baseInput(), taskId: RUN_A });
    expect(taskIdResult.ok).toBe(false);
    expect((taskIdResult.errors || []).some(
      (e) => e.field === 'taskId'
        && (e.code === 'task_state_forbidden' || e.code === 'forbidden_key'),
    )).toBe(true);
  });

  it('rejects invalid recordedAt', () => {
    expectReject(
      { ...baseInput(), recordedAt: 'not-iso' },
      'recordedAt',
      'invalid_iso_timestamp',
    );
  });

  it('limitations include library isolation markers', () => {
    expect(SHADOW_RUNTIME_LIMITATIONS).toEqual(expect.arrayContaining([
      'library_only',
      'in_memory_only',
      'deterministic_non_executing_composition',
      'does_not_create_task_state',
      'legacy_runtime_not_canonical',
    ]));
  });
});

describe('artemisShadowRuntimeLibraryBoundaryContract — regressions', () => {
  it('36. C8.1 still builds without marketContextRef (optional)', () => {
    const c81 = buildShadowDecisionRecording({
      decision: baseDecision(),
      decisionContext: baseContext(),
      evidenceOrchestrationSet: baseEvidenceSet(),
      controlChainArtifact: baseControlChain(),
      recordedAt: RECORDED_AT,
    });
    expect(c81.ok).toBe(true);
    expect(c81.artifact.marketContextRef == null).toBe(true);
    for (const [key, value] of Object.entries(C81_HARD_FLAGS)) {
      expect(c81.artifact[key]).toBe(value);
    }
  });

  it('36b. C8.1 still accepts optional marketContextRef', () => {
    const c81 = buildShadowDecisionRecording({
      decision: baseDecision(),
      decisionContext: baseContext(),
      evidenceOrchestrationSet: baseEvidenceSet(),
      controlChainArtifact: baseControlChain(),
      marketContextRef: validMarketContextRef(),
      recordedAt: RECORDED_AT,
    });
    expect(c81.ok).toBe(true);
    expect(c81.artifact.marketContextRef.marketContextId).toBe(MC_ID);
  });

  it('37. S8-MC contract version remains the MC ref contractVersion', () => {
    const result = buildShadowCycleComposition(baseInput());
    expect(result.ok).toBe(true);
    expect(result.envelope.marketContextRef.contractVersion)
      .toBe(MARKET_CONTEXT_CONTRACT_VERSION);
  });

  it('38–39. Control Chain / C1–C6 artifact remains usable and non-executing', () => {
    const cc = baseControlChain();
    expect(cc.decisionEligible).toBe(false);
    expect(cc.executionEligible).toBe(false);
    expect(cc.approvedForExecution).toBe(false);
    const result = buildShadowCycleComposition(baseInput({ controlChainArtifact: cc }));
    expect(result.ok).toBe(true);
    expect(result.envelope.controlChainRef.controlChainArtifactId)
      .toBe(cc.controlChainArtifactId);
  });

  it('40. Decision / Context / Evidence / Orchestration refs stay consistent', () => {
    const result = buildShadowCycleComposition(baseInput());
    expect(result.ok).toBe(true);
    expect(result.envelope.decisionRef.decisionId).toBe(DECISION_ID);
    expect(result.envelope.decisionContextRef.contextId).toBe(CONTEXT_ID);
    expect(result.envelope.evidenceOrchestrationRef.orchestrationId).toBe(ORCH_ID);
    expect(result.envelope.shadowRecordingArtifact.decisionRef.decisionId).toBe(DECISION_ID);
  });

  it('source does not import network/db/redis/runtime owners', () => {
    const src = readFileSync(CONTRACT_PATH, 'utf8');
    const importLines = src.split('\n').filter((line) => /^\s*import\s/.test(line)).join('\n');
    expect(importLines).not.toMatch(/['"].*pg['"]/);
    expect(importLines).not.toMatch(/['"].*ioredis['"]/);
    expect(importLines).not.toMatch(/['"].*redis['"]/);
    expect(importLines).not.toMatch(/engineWorkerLeader/);
    expect(importLines).not.toMatch(/artemisOrchestrator/);
    expect(importLines).not.toMatch(/artemisExecutionGate/);
    expect(importLines).not.toMatch(/tradingEngine/);
    expect(importLines).not.toMatch(/messageQueue/);
    expect(importLines).not.toMatch(/startArtemisScheduler/);
    expect(importLines).not.toMatch(/market-proxy/);
    expect(importLines).not.toMatch(/ccxt/);
  });
});
