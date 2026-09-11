/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.3.2.c.2 — Risk Control Chain Runtime Boundary unit tests.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTHORITY_CLASS,
  AVAILABILITY,
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
import { buildContractOnlyArtemisDecision } from '../../contracts/artemisDecisionContract.js';
import {
  CAPABILITY_STATE,
  CONTROL_CHAIN_CONTRACT_VERSION,
  CONTROL_CHAIN_STAGE,
  CONTROL_OUTCOME,
  RISK_GATE_OUTCOME,
  ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
} from '../../contracts/artemisControlChainContract.js';
import {
  RISK_GATE_INTEGRATION_CONTRACT_VERSION,
  RISK_GATE_INTEGRATION_STAGE,
  ZERO_RISK_GATE_INTEGRATION_SIDE_EFFECTS,
  integrateArtemisRiskControlIntoChain,
} from '../../contracts/artemisRiskGateIntegrationContract.js';
import {
  BOUNDARY_DISPOSITION,
  EXECUTION_AUTHORIZATION_STATUS,
  ORDER_AUTHORIZATION_STATUS,
  RISK_CONTROL_RUNTIME_BOUNDARY_CONTRACT_VERSION,
  RISK_CONTROL_RUNTIME_BOUNDARY_METHOD_KEY,
  RISK_CONTROL_RUNTIME_BOUNDARY_STAGE,
  RISK_CONTROL_RUNTIME_BOUNDARY_WRITER,
  TRADE_EXECUTION_STATUS,
  ZERO_RISK_CONTROL_RUNTIME_BOUNDARY_SIDE_EFFECTS,
  acceptRiskControlChainRuntimeBoundary,
  validateRiskControlRuntimeBoundaryInput,
  validateRiskControlRuntimeBoundaryResult,
} from '../../contracts/artemisRiskControlRuntimeBoundaryContract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOUNDARY_SOURCE = readFileSync(
  join(__dirname, '../../contracts/artemisRiskControlRuntimeBoundaryContract.js'),
  'utf8',
);

const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RUN_A = '11111111-1111-4111-8111-111111111111';
const RUN_B = '22222222-2222-4222-8222-222222222222';
const ORCH_ID = '33333333-3333-4333-8333-333333333333';
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

function passRiskRef(overrides = {}) {
  return {
    agentId: 'risk',
    runId: RUN_A,
    authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
    outcome: RISK_GATE_OUTCOME.PASS,
    freshness: FRESHNESS_STATUS.FRESH,
    availability: AVAILABILITY.AVAILABLE,
    reasonKey: 'risk_level_pass',
    ...overrides,
  };
}

function clearRuntimeSnapshot(overrides = {}) {
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

function integrate(overrides = {}) {
  return integrateArtemisRiskControlIntoChain({
    artemisCognitiveDecision: baseDecision(),
    decisionContext: baseContext(),
    contributingAgentRunIds: [RUN_A, RUN_B],
    orchestrationSetIds: [ORCH_ID],
    recordedAt: RECORDED_AT,
    riskEvidenceRef: passRiskRef(),
    runtimeSnapshot: clearRuntimeSnapshot(),
    ...overrides,
  });
}

function boundaryInputFromIntegration(integrationResult, extra = {}) {
  expect(integrationResult.ok).toBe(true);
  return {
    controlChainArtifact: integrationResult.artifact,
    integration: integrationResult.integration,
    ...extra,
  };
}

describe('artemisRiskControlRuntimeBoundaryContract — Stage 7.3.2.c.2', () => {
  it('1 PASS → ADVISORY_NON_EXECUTING; never execution approval', () => {
    const integrated = integrate();
    const result = acceptRiskControlChainRuntimeBoundary(boundaryInputFromIntegration(integrated));
    expect(result.ok).toBe(true);
    expect(result.result.boundaryDisposition).toBe(BOUNDARY_DISPOSITION.ADVISORY_NON_EXECUTING);
    expect(result.result.controlOutcome).toBe(CONTROL_OUTCOME.HOLD_EVALUATION);
    expect(result.result.riskGateSummary.outcome).toBe(RISK_GATE_OUTCOME.PASS);
    expect(result.result.executionAuthorizationStatus).toBe(EXECUTION_AUTHORIZATION_STATUS.NOT_AUTHORIZED);
    expect(result.result.orderAuthorizationStatus).toBe(ORDER_AUTHORIZATION_STATUS.NOT_AUTHORIZED);
    expect(result.result.tradeExecutionStatus).toBe(TRADE_EXECUTION_STATUS.NOT_EXECUTED);
    expect(result.result.approvedForExecution).toBe(false);
    expect(result.result.executionEligible).toBe(false);
    expect(result.result.runtimeArmed).toBe(false);
    expect(result.result.stage).toBe(RISK_CONTROL_RUNTIME_BOUNDARY_STAGE);
    expect(result.result.provenance.sourceControlChainStage).toBe(CONTROL_CHAIN_STAGE);
  });

  it('2 LIMIT → LIMITED_CONTROL with numeric limit preserved', () => {
    const integrated = integrate({
      riskEvidenceRef: passRiskRef({
        outcome: RISK_GATE_OUTCOME.LIMIT,
        reasonKey: 'risk_level_limits',
        limit: 0.25,
        unit: 'quote',
      }),
    });
    const result = acceptRiskControlChainRuntimeBoundary(boundaryInputFromIntegration(integrated));
    expect(result.ok).toBe(true);
    expect(result.result.boundaryDisposition).toBe(BOUNDARY_DISPOSITION.LIMITED_CONTROL);
    expect(result.result.controlOutcome).toBe(CONTROL_OUTCOME.LIMITED);
    expect(result.result.riskGateSummary.limit).toBe(0.25);
    expect(result.result.approvedForExecution).toBe(false);
  });

  it('3 REJECT → VETOED_CONTROL terminal non-executing', () => {
    const integrated = integrate({
      riskEvidenceRef: passRiskRef({
        outcome: RISK_GATE_OUTCOME.REJECT,
        reasonKey: 'risk_level_blocks',
      }),
    });
    const result = acceptRiskControlChainRuntimeBoundary(boundaryInputFromIntegration(integrated));
    expect(result.ok).toBe(true);
    expect(result.result.boundaryDisposition).toBe(BOUNDARY_DISPOSITION.VETOED_CONTROL);
    expect(result.result.controlOutcome).toBe(CONTROL_OUTCOME.VETOED);
    expect(result.result.riskGateSummary.terminalVeto).toBe(true);
    expect(result.result.executionAuthorizationStatus).toBe(EXECUTION_AUTHORIZATION_STATUS.NOT_AUTHORIZED);
  });

  it('4 UNAVAILABLE → INSUFFICIENT_CONTROL', () => {
    const integrated = integrate({
      riskEvidenceRef: passRiskRef({
        outcome: RISK_GATE_OUTCOME.UNAVAILABLE,
        freshness: FRESHNESS_STATUS.UNKNOWN,
        reasonKey: 'risk_unavailable_fail_closed',
      }),
    });
    const result = acceptRiskControlChainRuntimeBoundary(boundaryInputFromIntegration(integrated));
    expect(result.ok).toBe(true);
    expect(result.result.boundaryDisposition).toBe(BOUNDARY_DISPOSITION.INSUFFICIENT_CONTROL);
    expect(result.result.controlOutcome).toBe(CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE);
  });

  it('5 NOT_APPLICABLE → ADVISORY_NON_EXECUTING', () => {
    const integrated = integrate({
      riskEvidenceRef: passRiskRef({
        outcome: RISK_GATE_OUTCOME.NOT_APPLICABLE,
        reasonKey: 'risk_not_applicable',
      }),
    });
    const result = acceptRiskControlChainRuntimeBoundary(boundaryInputFromIntegration(integrated));
    expect(result.ok).toBe(true);
    expect(result.result.boundaryDisposition).toBe(BOUNDARY_DISPOSITION.ADVISORY_NON_EXECUTING);
    expect(result.result.riskGateSummary.outcome).toBe(RISK_GATE_OUTCOME.NOT_APPLICABLE);
  });

  it('6 missing artifact → fail closed', () => {
    const result = acceptRiskControlChainRuntimeBoundary({});
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_artifact')).toBe(true);
  });

  it('7 malformed artifact → fail closed', () => {
    const result = acceptRiskControlChainRuntimeBoundary({
      controlChainArtifact: 'not-an-object',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'malformed_artifact')).toBe(true);
  });

  it('8 wrong stage → fail closed', () => {
    const integrated = integrate();
    const artifact = { ...integrated.artifact, provenance: { ...integrated.artifact.provenance, stage: '7.3.2.c' } };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === 'wrong_stage' || e.code === 'invalid_stage'),
    ).toBe(true);
  });

  it('9 wrong contract version → fail closed', () => {
    const integrated = integrate();
    const artifact = { ...integrated.artifact, contractVersion: 'artemis-control-chain-0.0.0' };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
  });

  it('10 wrong provenance writer/stage path → fail closed', () => {
    const integrated = integrate();
    const artifact = {
      ...integrated.artifact,
      provenance: {
        ...integrated.artifact.provenance,
        writer: 'forgedWriter',
        stage: '99',
      },
    };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
  });

  it('11 missing lineage → fail closed', () => {
    const integrated = integrate();
    const artifact = { ...integrated.artifact };
    delete artifact.lineage;
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
  });

  it('12 lineage mismatch → fail closed', () => {
    const integrated = integrate();
    const artifact = {
      ...integrated.artifact,
      lineage: {
        ...integrated.artifact.lineage,
        controlChainContractVersion: 'wrong-version',
      },
    };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === 'lineage_mismatch'
        || e.code === 'incompatible_control_chain_contract'),
    ).toBe(true);
  });

  it('13 PASS with STALE freshness on gate → fail closed', () => {
    const integrated = integrate();
    const artifact = {
      ...integrated.artifact,
      riskGate: { ...integrated.artifact.riskGate, freshness: FRESHNESS_STATUS.STALE },
    };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'stale_risk_cannot_pass')).toBe(true);
  });

  it('14 PASS with EXPIRED freshness → fail closed', () => {
    const integrated = integrate();
    const artifact = {
      ...integrated.artifact,
      riskGate: { ...integrated.artifact.riskGate, freshness: FRESHNESS_STATUS.EXPIRED },
    };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'stale_risk_cannot_pass')).toBe(true);
  });

  it('15 PASS with UNKNOWN freshness → fail closed', () => {
    const integrated = integrate();
    const artifact = {
      ...integrated.artifact,
      riskGate: { ...integrated.artifact.riskGate, freshness: FRESHNESS_STATUS.UNKNOWN },
    };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
  });

  it('16 PASS with UNAVAILABLE freshness → fail closed', () => {
    const integrated = integrate();
    const artifact = {
      ...integrated.artifact,
      riskGate: { ...integrated.artifact.riskGate, freshness: FRESHNESS_STATUS.UNAVAILABLE },
    };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
  });

  it('17 invalid LIMIT (negative) → fail closed', () => {
    const integrated = integrate({
      riskEvidenceRef: passRiskRef({
        outcome: RISK_GATE_OUTCOME.LIMIT,
        reasonKey: 'risk_level_limits',
        limit: 0.25,
      }),
    });
    const artifact = {
      ...integrated.artifact,
      riskGate: { ...integrated.artifact.riskGate, limit: -1 },
    };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_limit')).toBe(true);
  });

  it('18 REJECT without terminalVeto → fail closed', () => {
    const integrated = integrate({
      riskEvidenceRef: passRiskRef({
        outcome: RISK_GATE_OUTCOME.REJECT,
        reasonKey: 'risk_level_blocks',
      }),
    });
    const artifact = {
      ...integrated.artifact,
      riskGate: { ...integrated.artifact.riskGate, terminalVeto: false },
    };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'reject_requires_terminal_veto')).toBe(true);
  });

  it('19 inconsistent controlOutcome vs riskGate → fail closed', () => {
    const integrated = integrate({
      riskEvidenceRef: passRiskRef({
        outcome: RISK_GATE_OUTCOME.REJECT,
        reasonKey: 'risk_level_blocks',
      }),
    });
    const artifact = {
      ...integrated.artifact,
      controlOutcome: CONTROL_OUTCOME.HOLD_EVALUATION,
    };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === 'inconsistent_control_outcome_vs_risk_gate'
        || e.code === 'terminal_veto_requires_vetoed'),
    ).toBe(true);
  });

  it('20 approvedForExecution=true → fail closed', () => {
    const integrated = integrate();
    const artifact = { ...integrated.artifact, approvedForExecution: true };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === 'approved_for_execution_forbidden'
        || e.code === 'hard_flag_violation'
        || e.code === 'must_be_false'),
    ).toBe(true);
  });

  it('21 executionEligible=true → fail closed', () => {
    const integrated = integrate();
    const artifact = { ...integrated.artifact, executionEligible: true };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
  });

  it('22 decisionEligible=true → fail closed', () => {
    const integrated = integrate();
    const artifact = { ...integrated.artifact, decisionEligible: true };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
  });

  it('23 ordersCreated != 0 → fail closed', () => {
    const integrated = integrate();
    const artifact = { ...integrated.artifact, ordersCreated: 1 };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === 'orders_created_nonzero' || e.code === 'must_be_zero'),
    ).toBe(true);
  });

  it('24 liveTradingEnabled=true → fail closed', () => {
    const integrated = integrate();
    const artifact = { ...integrated.artifact, liveTradingEnabled: true };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
  });

  it('25 controlChainStarted=true → fail closed', () => {
    const integrated = integrate();
    const artifact = { ...integrated.artifact, controlChainStarted: true };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
  });

  it('26 BUY execution authority value → fail closed', () => {
    const integrated = integrate();
    const artifact = {
      ...integrated.artifact,
      riskGate: { ...integrated.artifact.riskGate, reasonKey: 'BUY' },
    };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === 'forbidden_execution_authority_value' || e.value === 'BUY'),
    ).toBe(true);
  });

  it('27 SELL / LONG / SHORT contamination → fail closed', () => {
    for (const value of ['SELL', 'LONG', 'SHORT']) {
      const integrated = integrate();
      const artifact = {
        ...integrated.artifact,
        riskGate: { ...integrated.artifact.riskGate, reasonKey: value },
      };
      const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
      expect(result.ok).toBe(false);
    }
  });

  it('28 direction / side / action fields → fail closed', () => {
    const integrated = integrate();
    const artifact = {
      ...integrated.artifact,
      riskGate: { ...integrated.artifact.riskGate, direction: 'long' },
    };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
  });

  it('29 orderId / executionIntent / walletAction / tradeInstruction → fail closed', () => {
    const integrated = integrate();
    const artifact = { ...integrated.artifact, orderId: 'ord-1' };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
  });

  it('30 executionCommand contamination → fail closed', () => {
    const result = validateRiskControlRuntimeBoundaryInput({
      controlChainArtifact: integrate().artifact,
      executionCommand: 'place',
    });
    expect(result.ok).toBe(false);
  });

  it('31 model-assisted contamination → fail closed', () => {
    const result = validateRiskControlRuntimeBoundaryInput({
      controlChainArtifact: integrate().artifact,
      modelAssistedContribution: { conclusion: 'x' },
    });
    expect(result.ok).toBe(false);
  });

  it('32 legacy MoE / vote / consensus contamination → fail closed', () => {
    const result = validateRiskControlRuntimeBoundaryInput({
      controlChainArtifact: integrate().artifact,
      consensus: { votes: 3 },
    });
    expect(result.ok).toBe(false);
  });

  it('33 providerPayload / credentials / apiKey → fail closed', () => {
    const integrated = integrate();
    const artifact = { ...integrated.artifact, apiKey: 'secret' };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
  });

  it('34 unknown top-level fields → fail closed', () => {
    const result = validateRiskControlRuntimeBoundaryInput({
      controlChainArtifact: integrate().artifact,
      unexpectedTop: true,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('unknown_field');
  });

  it('35 deterministic identical input → identical output', () => {
    const input = boundaryInputFromIntegration(integrate());
    const a = acceptRiskControlChainRuntimeBoundary(input);
    const b = acceptRiskControlChainRuntimeBoundary(input);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.result.boundaryResultId).toBe(b.result.boundaryResultId);
    expect(a.result).toEqual(b.result);
  });

  it('36 zero side-effect ledger', () => {
    const result = acceptRiskControlChainRuntimeBoundary(boundaryInputFromIntegration(integrate()));
    expect(result.ok).toBe(true);
    expect(result.result.sideEffects).toEqual(ZERO_RISK_CONTROL_RUNTIME_BOUNDARY_SIDE_EFFECTS);
    expect(result.result.sideEffects).toEqual(ZERO_CONTROL_CHAIN_SIDE_EFFECTS);
    expect(result.result.sideEffects.dbWriteCount).toBe(0);
    expect(result.result.sideEffects.redisWriteCount).toBe(0);
    expect(result.result.sideEffects.agentExecutionCount).toBe(0);
    expect(result.result.sideEffects.providerRequestCount).toBe(0);
    expect(result.result.sideEffects.orderOperationCount).toBe(0);
    expect(result.result.sideEffects.financialExecutionCount).toBe(0);
    expect(result.result.sideEffects.llmCallCount).toBe(0);
    expect(result.result.sideEffects.networkRequestCount).toBe(0);
  });

  it('37 does not mutate supplied controlChainArtifact', () => {
    const integrated = integrate();
    const artifact = integrated.artifact;
    const before = JSON.stringify(artifact);
    Object.freeze(artifact);
    Object.freeze(artifact.riskGate);
    Object.freeze(artifact.lineage);
    Object.freeze(artifact.provenance);
    const result = acceptRiskControlChainRuntimeBoundary({
      controlChainArtifact: artifact,
      integration: integrated.integration,
    });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(artifact)).toBe(before);
  });

  it('38 optional valid integration metadata accepted', () => {
    const integrated = integrate();
    expect(integrated.integration.stage).toBe(RISK_GATE_INTEGRATION_STAGE);
    expect(integrated.integration.contractVersion).toBe(RISK_GATE_INTEGRATION_CONTRACT_VERSION);
    expect(integrated.integration.sideEffects).toEqual(ZERO_RISK_GATE_INTEGRATION_SIDE_EFFECTS);
    const result = acceptRiskControlChainRuntimeBoundary(boundaryInputFromIntegration(integrated));
    expect(result.ok).toBe(true);
    expect(result.result.lineage.integrationContractVersion).toBe(RISK_GATE_INTEGRATION_CONTRACT_VERSION);
    expect(result.result.lineage.controlChainContractVersion).toBe(CONTROL_CHAIN_CONTRACT_VERSION);
    expect(result.result.lineage.boundaryContractVersion).toBe(RISK_CONTROL_RUNTIME_BOUNDARY_CONTRACT_VERSION);
  });

  it('39 invalid integration stage → fail closed', () => {
    const integrated = integrate();
    const result = acceptRiskControlChainRuntimeBoundary({
      controlChainArtifact: integrated.artifact,
      integration: { ...integrated.integration, stage: 'wrong' },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_integration_stage')).toBe(true);
  });

  it('40 artifact-only input (without integration) still admits', () => {
    const integrated = integrate();
    const result = acceptRiskControlChainRuntimeBoundary({
      controlChainArtifact: integrated.artifact,
    });
    expect(result.ok).toBe(true);
    expect(result.result.lineage.integrationContractVersion).toBeUndefined();
  });

  it('41 validateRiskControlRuntimeBoundaryResult rejects wrong stage', () => {
    const accepted = acceptRiskControlChainRuntimeBoundary(boundaryInputFromIntegration(integrate()));
    expect(accepted.ok).toBe(true);
    const forged = { ...accepted.result, stage: '7.3.1' };
    const validated = validateRiskControlRuntimeBoundaryResult(forged);
    expect(validated.ok).toBe(false);
  });

  it('42 Risk PASS structurally separated from execution/order/trade statuses', () => {
    const result = acceptRiskControlChainRuntimeBoundary(boundaryInputFromIntegration(integrate()));
    expect(result.ok).toBe(true);
    expect(result.result.riskGateSummary.outcome).toBe(RISK_GATE_OUTCOME.PASS);
    expect(result.result.executionAuthorizationStatus).not.toBe('AUTHORIZED');
    expect(result.result.executionAuthorizationStatus).toBe('NOT_AUTHORIZED');
    expect(result.result.orderAuthorizationStatus).toBe('NOT_AUTHORIZED');
    expect(result.result.tradeExecutionStatus).toBe('NOT_EXECUTED');
    expect(Object.keys(result.result)).not.toContain('executionApproved');
    expect(Object.keys(result.result)).not.toContain('orderAuthorized');
  });

  it('43 import hygiene — no forbidden runtime/provider/LLM/DB imports', () => {
    expect(BOUNDARY_SOURCE).not.toMatch(/from ['"].*risk-gate/);
    expect(BOUNDARY_SOURCE).not.toMatch(/from ['"].*agents\/risk/);
    expect(BOUNDARY_SOURCE).not.toMatch(/from ['"].*artemisOrchestrator/);
    expect(BOUNDARY_SOURCE).not.toMatch(/from ['"].*orderExecutor/);
    expect(BOUNDARY_SOURCE).not.toMatch(/from ['"].*orderTracker/);
    expect(BOUNDARY_SOURCE).not.toMatch(/from ['"].*tradingEngine/);
    expect(BOUNDARY_SOURCE).not.toMatch(/from ['"].*artemisExecutionGate/);
    expect(BOUNDARY_SOURCE).not.toMatch(/from ['"].*runtimeExecutionStateService/);
    expect(BOUNDARY_SOURCE).not.toMatch(/from ['"]openai|from ['"]anthropic|fetch\(|https?\./);
    expect(BOUNDARY_SOURCE).not.toMatch(/from ['"].*\/db\.js|from ['"].*redis/i);
    expect(BOUNDARY_SOURCE).toContain('validateControlChainArtifact');
    expect(BOUNDARY_SOURCE).toContain(RISK_CONTROL_RUNTIME_BOUNDARY_STAGE);
    expect(BOUNDARY_SOURCE).toContain(RISK_CONTROL_RUNTIME_BOUNDARY_CONTRACT_VERSION);
    expect(BOUNDARY_SOURCE).not.toMatch(/Math\.random\(|Date\.now\(/);
    expect(RISK_CONTROL_RUNTIME_BOUNDARY_WRITER).toBe('artemisRiskControlRuntimeBoundaryContract');
    expect(RISK_CONTROL_RUNTIME_BOUNDARY_METHOD_KEY).toBe('accept_risk_control_chain_runtime_boundary');
  });

  it('44 vote contamination in artifact strings → fail closed', () => {
    const integrated = integrate();
    const artifact = {
      ...integrated.artifact,
      riskGate: { ...integrated.artifact.riskGate, reasonKey: 'majority' },
    };
    const result = acceptRiskControlChainRuntimeBoundary({ controlChainArtifact: artifact });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'vote_contamination')).toBe(true);
  });
});
