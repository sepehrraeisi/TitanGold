/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.3.1 — Control Chain contract foundation unit tests.
 */
import { describe, expect, it } from '@jest/globals';
import {
  AUTHORITY_CLASS,
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  FRESHNESS_STATUS,
  MARKET_TYPE,
} from '../../contracts/artemisEvidenceContract.js';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
  DECISION_CONTEXT_LIFECYCLE,
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
  CONTROL_CHAIN_POLICY_VERSION,
  CONTROL_CHAIN_SCHEMA_VERSION,
  CONTROL_CHAIN_STAGE,
  CONTROL_OUTCOME,
  LIQUIDITY_BLOCKED_REASON,
  LIQUIDITY_GATE_OUTCOME,
  ORDER_MECHANICS_READINESS_STATUS,
  PORTFOLIO_GATE_OUTCOME,
  REQUESTED_OPERATION_CLASS,
  RISK_GATE_OUTCOME,
  RUNTIME_GATE_OUTCOME,
  ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
  buildContractOnlyControlChainArtifact,
  deriveAggregateControlOutcome,
  validateControlChainArtifact,
  validateControlChainInput,
} from '../../contracts/artemisControlChainContract.js';

const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RUN_A = '11111111-1111-4111-8111-111111111111';
const RUN_B = '22222222-2222-4222-8222-222222222222';
const ORCH_ID = '33333333-3333-4333-8333-333333333333';
const ARTIFACT_ID = '44444444-4444-4444-8444-444444444444';
const RECORDED_AT = '2026-09-05T12:00:00.000Z';

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
    sourceWindow: { start: '2026-09-05T10:00:00.000Z', end: '2026-09-05T11:00:00.000Z' },
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
      requested: REQUESTED_RUNTIME_MODE.ADVISORY,
      effective: EFFECTIVE_RUNTIME_MODE.ADVISORY,
    },
    sourceWindow: {
      since: '2026-09-05T10:00:00.000Z',
      until: '2026-09-05T11:00:00.000Z',
    },
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    ...overrides,
  };
}

function baseLineage(overrides = {}) {
  return {
    decisionId: DECISION_ID,
    decisionContextId: CONTEXT_ID,
    contributingAgentRunIds: [RUN_A, RUN_B],
    orchestrationSetIds: [ORCH_ID],
    decisionContractVersion: DECISION_CONTRACT_VERSION,
    decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
    orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
    controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    ...overrides,
  };
}

function baseProvenance(overrides = {}) {
  return {
    writer: 'unit_test',
    methodKey: 'stage7_3_1_test',
    stage: CONTROL_CHAIN_STAGE,
    recordedAt: RECORDED_AT,
    note: 'unit',
    ...overrides,
  };
}

function clearRuntime(overrides = {}) {
  return {
    killSwitchActive: false,
    requestedRuntimeMode: REQUESTED_RUNTIME_MODE.ADVISORY,
    effectiveRuntimeMode: EFFECTIVE_RUNTIME_MODE.ADVISORY,
    capabilityState: CAPABILITY_STATE.GRANTED,
    ssotAvailable: true,
    ssotOwner: 'runtimeExecutionStateService',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    artemisCognitiveDecision: baseDecision(),
    decisionContext: baseContext(),
    lineage: baseLineage(),
    provenance: baseProvenance(),
    requestedOperationClass: REQUESTED_OPERATION_CLASS.OBSERVE,
    runtimeSnapshot: clearRuntime(),
    ...overrides,
  };
}

function baseArtifact(overrides = {}) {
  return {
    schemaVersion: CONTROL_CHAIN_SCHEMA_VERSION,
    contractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    policyVersion: CONTROL_CHAIN_POLICY_VERSION,
    controlChainArtifactId: ARTIFACT_ID,
    decisionId: DECISION_ID,
    decisionContextId: CONTEXT_ID,
    lifecycle: CONTROL_CHAIN_LIFECYCLE.CONTRACT_ONLY,
    controlOutcome: CONTROL_OUTCOME.HOLD_EVALUATION,
    requestedOperationClass: REQUESTED_OPERATION_CLASS.OBSERVE,
    riskGate: {
      authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
      outcome: RISK_GATE_OUTCOME.UNAVAILABLE,
      freshness: FRESHNESS_STATUS.UNKNOWN,
      reasonKey: 'missing_required_risk_evidence',
      terminalVeto: false,
    },
    portfolioGate: {
      authorityClass: AUTHORITY_CLASS.CONTROL_SIZING,
      outcome: PORTFOLIO_GATE_OUTCOME.UNAVAILABLE,
      reasonKey: 'portfolio_not_evaluated',
      usableSizingEmitted: false,
    },
    liquidityGate: {
      authorityClass: AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
      outcome: LIQUIDITY_GATE_OUTCOME.BLOCKED,
      reasonKey: LIQUIDITY_BLOCKED_REASON,
      freshness: FRESHNESS_STATUS.UNKNOWN,
    },
    runtimeGate: {
      authorityClass: 'titangold_runtime_safety_ssot',
      outcome: RUNTIME_GATE_OUTCOME.CLEAR,
      killSwitchActive: false,
      requestedRuntimeMode: REQUESTED_RUNTIME_MODE.ADVISORY,
      effectiveRuntimeMode: EFFECTIVE_RUNTIME_MODE.ADVISORY,
      capabilityState: CAPABILITY_STATE.GRANTED,
      ssotAvailable: true,
      ssotOwner: 'runtimeExecutionStateService',
      reasonKey: 'runtime_gate_contract_only',
    },
    orderMechanicsReadiness: {
      status: ORDER_MECHANICS_READINESS_STATUS.CONTRACT_ONLY,
      authorityClass: AUTHORITY_CLASS.EXECUTION,
      orderPresent: false,
      executionIntentPresent: false,
      providerSubmittable: false,
      idempotencyKeyPresent: false,
      reasonKey: 'order_mechanics_readiness_only',
    },
    lineage: baseLineage(),
    provenance: {
      writer: 'artemisControlChainContract',
      methodKey: 'buildContractOnlyControlChainArtifact',
      stage: CONTROL_CHAIN_STAGE,
      recordedAt: RECORDED_AT,
      note: 'control_chain_contract_only',
    },
    limitations: ['stage7_3_1_control_chain_contract_only'],
    sideEffects: { ...ZERO_CONTROL_CHAIN_SIDE_EFFECTS },
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    controlChainStarted: false,
    ordersCreated: 0,
    liveTradingEnabled: false,
    generatedAt: RECORDED_AT,
    ...overrides,
  };
}

describe('Artemis Stage 7.3.1 Control Chain Contract', () => {
  it('1 valid contract-only artifact', () => {
    const built = buildContractOnlyControlChainArtifact(baseInput());
    expect(built.ok).toBe(true);
    expect(built.artifact.schemaVersion).toBe(CONTROL_CHAIN_SCHEMA_VERSION);
    expect(built.artifact.contractVersion).toBe(CONTROL_CHAIN_CONTRACT_VERSION);
    expect(built.artifact.lifecycle).toBe(CONTROL_CHAIN_LIFECYCLE.CONTRACT_ONLY);
    expect(built.artifact.decisionEligible).toBe(false);
    expect(built.artifact.executionEligible).toBe(false);
    expect(built.artifact.approvedForExecution).toBe(false);
    expect(built.artifact.controlChainStarted).toBe(false);
    expect(built.artifact.ordersCreated).toBe(0);
    expect(built.artifact.liveTradingEnabled).toBe(false);
    expect(built.artifact.liquidityGate.outcome).toBe(LIQUIDITY_GATE_OUTCOME.BLOCKED);
    expect(built.artifact.liquidityGate.reasonKey).toBe(LIQUIDITY_BLOCKED_REASON);
    expect(validateControlChainArtifact(built.artifact).ok).toBe(true);
  });

  it('2 invalid cognitive decision', () => {
    const result = validateControlChainInput(baseInput({ artemisCognitiveDecision: { not: 'a decision' } }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'artemisCognitiveDecision')).toBe(true);
  });

  it('3 executionEligible=true', () => {
    const decision = { ...baseDecision(), executionEligible: true };
    const result = validateControlChainInput(baseInput({ artemisCognitiveDecision: decision }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'execution_eligible_rejected')).toBe(true);
  });

  it('4 approvedForExecution=true', () => {
    const decision = { ...baseDecision(), approvedForExecution: true };
    const result = validateControlChainInput(baseInput({ artemisCognitiveDecision: decision }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'approved_for_execution_rejected')).toBe(true);
  });

  it('5 decisionEligible=true', () => {
    const decision = { ...baseDecision(), decisionEligible: true };
    const result = validateControlChainInput(baseInput({ artemisCognitiveDecision: decision }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'decision_eligible_rejected')).toBe(true);
  });

  it('6 orderId forbidden', () => {
    const result = validateControlChainInput({ ...baseInput(), orderId: 'ord-1' });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.field === 'orderId' || e.code === 'unknown_field' || e.code === 'forbidden_key'),
    ).toBe(true);
  });

  it('7 apiKey forbidden', () => {
    const result = validateControlChainInput({ ...baseInput(), apiKey: 'secret' });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.field === 'apiKey' || e.code === 'unknown_field' || e.code === 'forbidden_key'),
    ).toBe(true);
  });

  it('8 BUY rejected as authority', () => {
    const result = validateControlChainInput(baseInput({
      provenance: baseProvenance({ note: 'BUY' }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'buy_rejected')).toBe(true);
  });

  it('9 SELL rejected as authority', () => {
    const result = validateControlChainInput(baseInput({
      provenance: baseProvenance({ note: 'SELL' }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'sell_rejected')).toBe(true);
  });

  it('10 place_order rejected', () => {
    const result = validateControlChainInput(baseInput({
      requestedOperationClass: 'place_order',
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'place_order_rejected')).toBe(true);
  });

  it('11 missing lineage', () => {
    const input = baseInput();
    delete input.lineage;
    const result = validateControlChainInput(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage')).toBe(true);
  });

  it('12 missing provenance', () => {
    const input = baseInput();
    delete input.provenance;
    const result = validateControlChainInput(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'provenance')).toBe(true);
  });

  it('13 context mismatch', () => {
    const result = validateControlChainInput(baseInput({
      artemisCognitiveDecision: baseDecision({ symbol: 'ETH/USDT' }),
    }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe(CONTROL_CHAIN_LIFECYCLE.INCOMPATIBLE_CONTEXT);
    expect(result.errors.some((e) => e.code === 'incompatible_context')).toBe(true);
  });

  it('14 Risk REJECT -> VETOED', () => {
    const built = buildContractOnlyControlChainArtifact(baseInput({
      riskEvidenceRef: {
        agentId: 'risk',
        authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
        outcome: RISK_GATE_OUTCOME.REJECT,
        freshness: FRESHNESS_STATUS.FRESH,
        reasonKey: 'risk_reject',
      },
    }));
    expect(built.ok).toBe(true);
    expect(built.artifact.controlOutcome).toBe(CONTROL_OUTCOME.VETOED);
    expect(built.artifact.riskGate.terminalVeto).toBe(true);
    expect(built.artifact.portfolioGate.usableSizingEmitted).toBe(false);
  });

  it('15 Risk UNAVAILABLE -> fail-closed', () => {
    const built = buildContractOnlyControlChainArtifact(baseInput({
      riskEvidenceRef: {
        agentId: 'risk',
        authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
        outcome: RISK_GATE_OUTCOME.UNAVAILABLE,
        freshness: FRESHNESS_STATUS.UNKNOWN,
        reasonKey: 'risk_down',
      },
    }));
    expect(built.ok).toBe(true);
    expect(built.artifact.controlOutcome).toBe(CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE);
  });

  it('16 missing Risk -> insufficient evidence', () => {
    const built = buildContractOnlyControlChainArtifact(baseInput());
    expect(built.ok).toBe(true);
    expect(built.artifact.riskGate.outcome).toBe(RISK_GATE_OUTCOME.UNAVAILABLE);
    expect(built.artifact.controlOutcome).toBe(CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE);
  });

  it('17 Risk LIMIT -> bounded portfolio', () => {
    const built = buildContractOnlyControlChainArtifact(baseInput({
      riskEvidenceRef: {
        agentId: 'risk',
        authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
        outcome: RISK_GATE_OUTCOME.LIMIT,
        freshness: FRESHNESS_STATUS.FRESH,
        limit: 1.5,
        reasonKey: 'risk_limit',
      },
      portfolioEvidenceRef: {
        agentId: 'portfolio',
        authorityClass: AUTHORITY_CLASS.CONTROL_SIZING,
        outcome: PORTFOLIO_GATE_OUTCOME.AVAILABLE,
        accountStateAvailable: true,
        unit: 'quote',
        min: 0.1,
        max: 1.0,
        recommended: 0.5,
      },
    }));
    expect(built.ok).toBe(true);
    expect(built.artifact.controlOutcome).toBe(CONTROL_OUTCOME.LIMITED);
    expect(built.artifact.portfolioGate.max).toBe(1.0);
    expect(built.artifact.portfolioGate.usableSizingEmitted).toBe(true);
  });

  it('18 invalid portfolio bounds', () => {
    const result = validateControlChainInput(baseInput({
      riskEvidenceRef: {
        agentId: 'risk',
        authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
        outcome: RISK_GATE_OUTCOME.PASS,
        freshness: FRESHNESS_STATUS.FRESH,
      },
      portfolioEvidenceRef: {
        agentId: 'portfolio',
        authorityClass: AUTHORITY_CLASS.CONTROL_SIZING,
        outcome: PORTFOLIO_GATE_OUTCOME.AVAILABLE,
        accountStateAvailable: true,
        min: 2,
        max: 1,
        recommended: 1.5,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_bounds' || e.code === 'recommended_out_of_bounds')).toBe(true);
  });

  it('19 liquidity BLOCKED', () => {
    const built = buildContractOnlyControlChainArtifact(baseInput({
      riskEvidenceRef: {
        agentId: 'risk',
        authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
        outcome: RISK_GATE_OUTCOME.PASS,
        freshness: FRESHNESS_STATUS.FRESH,
      },
    }));
    expect(built.ok).toBe(true);
    expect(built.artifact.liquidityGate.outcome).toBe(LIQUIDITY_GATE_OUTCOME.BLOCKED);
    expect(built.artifact.liquidityGate.reasonKey).toBe(LIQUIDITY_BLOCKED_REASON);
    expect(Object.prototype.hasOwnProperty.call(built.artifact.liquidityGate, 'spread')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(built.artifact.liquidityGate, 'depth')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(built.artifact.liquidityGate, 'slippage')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(built.artifact.liquidityGate, 'maxFeasibleSize')).toBe(false);
  });

  it('20 stale liquidity cannot FEASIBLE', () => {
    const result = validateControlChainInput(baseInput({
      liquidityEvidenceRef: {
        agentId: 'liquidity',
        authorityClass: AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
        outcome: LIQUIDITY_GATE_OUTCOME.FEASIBLE,
        freshness: FRESHNESS_STATUS.STALE,
        bookTimestamp: RECORDED_AT,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'stale_liquidity_cannot_be_feasible')).toBe(true);
  });

  it('21 runtime kill switch active', () => {
    const built = buildContractOnlyControlChainArtifact(baseInput({
      runtimeSnapshot: clearRuntime({ killSwitchActive: true }),
      riskEvidenceRef: {
        agentId: 'risk',
        authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
        outcome: RISK_GATE_OUTCOME.PASS,
        freshness: FRESHNESS_STATUS.FRESH,
      },
    }));
    expect(built.ok).toBe(true);
    expect(built.artifact.runtimeGate.outcome).toBe(RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED);
    expect(built.artifact.controlOutcome).toBe(CONTROL_OUTCOME.RUNTIME_BLOCKED);
  });

  it('22 runtime kill switch unknown', () => {
    const built = buildContractOnlyControlChainArtifact(baseInput({
      runtimeSnapshot: clearRuntime({ killSwitchActive: 'unknown' }),
    }));
    expect(built.ok).toBe(true);
    expect(built.artifact.runtimeGate.outcome).toBe(RUNTIME_GATE_OUTCOME.RUNTIME_BLOCKED);
    expect(built.artifact.runtimeGate.reasonKey).toBe('kill_switch_unknown');
  });

  it('23 LIVE mode rejected', () => {
    const result = validateControlChainInput(baseInput({
      runtimeSnapshot: clearRuntime({
        requestedRuntimeMode: REQUESTED_RUNTIME_MODE.LIVE,
        effectiveRuntimeMode: EFFECTIVE_RUNTIME_MODE.ADVISORY,
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'live_runtime_mode_rejected')).toBe(true);
  });

  it('24 CONTROL_PASS_BOUNDED remains non-authorizing', () => {
    const outcome = deriveAggregateControlOutcome({
      riskPresent: true,
      riskGate: { outcome: RISK_GATE_OUTCOME.PASS },
      portfolioGate: { usableSizingEmitted: true },
      liquidityGate: { outcome: LIQUIDITY_GATE_OUTCOME.FEASIBLE },
      runtimeGate: { outcome: RUNTIME_GATE_OUTCOME.CLEAR },
    });
    expect(outcome).toBe(CONTROL_OUTCOME.CONTROL_PASS_BOUNDED);

    const artifact = baseArtifact({
      controlOutcome: CONTROL_OUTCOME.CONTROL_PASS_BOUNDED,
      lifecycle: CONTROL_CHAIN_LIFECYCLE.CONTRACT_ONLY,
      riskGate: {
        authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
        outcome: RISK_GATE_OUTCOME.PASS,
        freshness: FRESHNESS_STATUS.FRESH,
        reasonKey: 'risk_pass',
        terminalVeto: false,
      },
      portfolioGate: {
        authorityClass: AUTHORITY_CLASS.CONTROL_SIZING,
        outcome: PORTFOLIO_GATE_OUTCOME.AVAILABLE,
        unit: 'quote',
        min: 0.1,
        max: 1,
        recommended: 0.5,
        usableSizingEmitted: true,
        reasonKey: 'sized',
      },
      liquidityGate: {
        authorityClass: AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
        outcome: LIQUIDITY_GATE_OUTCOME.FEASIBLE,
        reasonKey: 'feasible_test',
        freshness: FRESHNESS_STATUS.FRESH,
        bookTimestamp: RECORDED_AT,
        expiryTimestamp: '2026-09-05T13:00:00.000Z',
      },
      decisionEligible: false,
      executionEligible: false,
      approvedForExecution: false,
      controlChainStarted: false,
      ordersCreated: 0,
      liveTradingEnabled: false,
    });
    const validated = validateControlChainArtifact(artifact);
    expect(validated.ok).toBe(true);
    expect(artifact.approvedForExecution).toBe(false);
    expect(artifact.executionEligible).toBe(false);
    expect(artifact.controlChainStarted).toBe(false);
    expect(artifact.ordersCreated).toBe(0);

    const authorizing = validateControlChainArtifact({
      ...artifact,
      approvedForExecution: true,
    });
    expect(authorizing.ok).toBe(false);
  });

  it('25 order readiness remains non-order', () => {
    const built = buildContractOnlyControlChainArtifact(baseInput());
    expect(built.ok).toBe(true);
    const readiness = built.artifact.orderMechanicsReadiness;
    expect(readiness.orderPresent).toBe(false);
    expect(readiness.executionIntentPresent).toBe(false);
    expect(readiness.providerSubmittable).toBe(false);
    expect(readiness.status).toBe(ORDER_MECHANICS_READINESS_STATUS.CONTRACT_ONLY);

    const bad = validateControlChainArtifact(baseArtifact({
      orderMechanicsReadiness: {
        ...readiness,
        orderPresent: true,
      },
    }));
    expect(bad.ok).toBe(false);
    expect(bad.errors.some((e) => e.code === 'readiness_cannot_become_order')).toBe(true);
  });

  it('26 deterministic identical inputs', () => {
    const input = baseInput({
      riskEvidenceRef: {
        agentId: 'risk',
        authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
        outcome: RISK_GATE_OUTCOME.PASS,
        freshness: FRESHNESS_STATUS.FRESH,
      },
    });
    const a = buildContractOnlyControlChainArtifact(input);
    const b = buildContractOnlyControlChainArtifact(input);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.artifact.controlChainArtifactId).toBe(b.artifact.controlChainArtifactId);
    expect(JSON.stringify(a.artifact)).toBe(JSON.stringify(b.artifact));
  });

  it('27 zero side effects', () => {
    const built = buildContractOnlyControlChainArtifact(baseInput());
    expect(built.ok).toBe(true);
    expect(built.artifact.sideEffects).toEqual(ZERO_CONTROL_CHAIN_SIDE_EFFECTS);
    for (const value of Object.values(built.artifact.sideEffects)) {
      expect(value).toBe(0);
    }
  });

  it('Risk LIMIT constrains portfolio max on input', () => {
    const result = validateControlChainInput(baseInput({
      riskEvidenceRef: {
        agentId: 'risk',
        authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
        outcome: RISK_GATE_OUTCOME.LIMIT,
        freshness: FRESHNESS_STATUS.FRESH,
        limit: 1,
      },
      portfolioEvidenceRef: {
        agentId: 'portfolio',
        authorityClass: AUTHORITY_CLASS.CONTROL_SIZING,
        outcome: PORTFOLIO_GATE_OUTCOME.AVAILABLE,
        accountStateAvailable: true,
        min: 0,
        max: 5,
        recommended: 2,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'portfolio_max_exceeds_risk_limit')).toBe(true);
  });

  it('stale Risk cannot PASS', () => {
    const result = validateControlChainInput(baseInput({
      riskEvidenceRef: {
        agentId: 'risk',
        authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
        outcome: RISK_GATE_OUTCOME.PASS,
        freshness: FRESHNESS_STATUS.STALE,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'stale_risk_cannot_pass')).toBe(true);
  });

  it('missing cognitive decision rejected', () => {
    const input = baseInput();
    delete input.artemisCognitiveDecision;
    const result = validateControlChainInput(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_cognitive_decision')).toBe(true);
  });
});
