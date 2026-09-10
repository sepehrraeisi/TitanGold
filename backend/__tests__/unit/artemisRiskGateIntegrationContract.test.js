/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.3.2.c.1 — Risk Gate integration adapter unit tests.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
  CONTROL_CHAIN_STAGE,
  CONTROL_OUTCOME,
  RISK_GATE_OUTCOME,
  ZERO_CONTROL_CHAIN_SIDE_EFFECTS,
} from '../../contracts/artemisControlChainContract.js';
import {
  RISK_PROJECTOR_CONTRACT_VERSION,
  projectRiskEvidenceRef,
} from '../../contracts/artemisRiskControlProjectorContract.js';
import {
  CANONICAL_OVERALL_RISK_LEVEL,
  RISK_ASSESSMENT_STATUS,
  RISK_EVALUATION_CONTRACT_VERSION,
  RISK_EVALUATION_STAGE,
  evaluateArtemisRiskControl,
} from '../../contracts/artemisRiskControlEvaluationContract.js';
import {
  RISK_GATE_INTEGRATION_CONTRACT_VERSION,
  RISK_GATE_INTEGRATION_METHOD_KEY,
  RISK_GATE_INTEGRATION_STAGE,
  RISK_GATE_INTEGRATION_WRITER,
  ZERO_RISK_GATE_INTEGRATION_SIDE_EFFECTS,
  integrateArtemisRiskControlIntoChain,
  validateRiskGateIntegrationInput,
} from '../../contracts/artemisRiskGateIntegrationContract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INTEGRATION_SOURCE = readFileSync(
  join(__dirname, '../../contracts/artemisRiskGateIntegrationContract.js'),
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

/**
 * Stage 7.3.1 contract-only fixture: clear advisory runtime so Risk semantics
 * are observable (without it, unknown kill-switch forces RUNTIME_BLOCKED).
 * Does not enable execution; liquidity remains BLOCKED by builder default.
 */
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

function baseIntegrationInput(overrides = {}) {
  return {
    artemisCognitiveDecision: baseDecision(),
    decisionContext: baseContext(),
    contributingAgentRunIds: [RUN_A, RUN_B],
    orchestrationSetIds: [ORCH_ID],
    recordedAt: RECORDED_AT,
    riskEvidenceRef: passRiskRef(),
    runtimeSnapshot: clearRuntimeSnapshot(),
    ...overrides,
  };
}

describe('artemisRiskGateIntegrationContract — Stage 7.3.2.c.1', () => {
  it('1 valid PASS → riskGate PASS, non-executing HOLD_EVALUATION', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.riskGate.outcome).toBe(RISK_GATE_OUTCOME.PASS);
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.HOLD_EVALUATION);
    expect(result.artifact.controlOutcome).not.toBe(CONTROL_OUTCOME.CONTROL_PASS_BOUNDED);
    expect(result.artifact.approvedForExecution).toBe(false);
    expect(result.artifact.executionEligible).toBe(false);
    expect(result.artifact.provenance.stage).toBe(CONTROL_CHAIN_STAGE);
    // Stage 7.3.1 builder is SoT for artifact provenance writer/methodKey.
    expect(result.artifact.provenance.writer).toBe('artemisControlChainContract');
    expect(result.artifact.provenance.methodKey).toBe('buildContractOnlyControlChainArtifact');
    expect(result.integration.stage).toBe(RISK_GATE_INTEGRATION_STAGE);
    expect(result.integration.contractVersion).toBe(RISK_GATE_INTEGRATION_CONTRACT_VERSION);
    expect(RISK_GATE_INTEGRATION_WRITER).toBe('artemisRiskGateIntegrationContract');
    expect(RISK_GATE_INTEGRATION_METHOD_KEY).toBe('integrate_artemis_risk_control_into_chain');
  });

  it('2 valid LIMIT with numeric limit → LIMITED + preserved limit', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: passRiskRef({
        outcome: RISK_GATE_OUTCOME.LIMIT,
        reasonKey: 'risk_level_limits',
        limit: 0.25,
        unit: 'quote',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskGate.outcome).toBe(RISK_GATE_OUTCOME.LIMIT);
    expect(result.artifact.riskGate.limit).toBe(0.25);
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.LIMITED);
  });

  it('3 valid REJECT → VETOED + terminalVeto', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: passRiskRef({
        outcome: RISK_GATE_OUTCOME.REJECT,
        reasonKey: 'risk_level_blocks',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskGate.outcome).toBe(RISK_GATE_OUTCOME.REJECT);
    expect(result.artifact.riskGate.terminalVeto).toBe(true);
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.VETOED);
  });

  it('4 UNAVAILABLE → INSUFFICIENT_CONTROL_EVIDENCE', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: passRiskRef({
        outcome: RISK_GATE_OUTCOME.UNAVAILABLE,
        freshness: FRESHNESS_STATUS.UNKNOWN,
        reasonKey: 'risk_unavailable_fail_closed',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE);
    expect(result.artifact.riskGate.outcome).not.toBe(RISK_GATE_OUTCOME.PASS);
  });

  it('5 missing riskEvidenceRef → fail closed', () => {
    const input = baseIntegrationInput();
    delete input.riskEvidenceRef;
    const result = integrateArtemisRiskControlIntoChain(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_risk_evidence_ref')).toBe(true);
  });

  it('6 malformed riskEvidenceRef → fail closed', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: {
        agentId: 'risk',
        authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
        outcome: RISK_GATE_OUTCOME.PASS,
        freshness: FRESHNESS_STATUS.FRESH,
        unexpectedField: true,
      },
    }));
    expect(result.ok).toBe(false);
  });

  it('7 stale PASS → fail closed', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: passRiskRef({ freshness: FRESHNESS_STATUS.STALE }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'stale_risk_cannot_pass')).toBe(true);
  });

  it('8 expired PASS → fail closed', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: passRiskRef({ freshness: FRESHNESS_STATUS.EXPIRED }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'stale_risk_cannot_pass')).toBe(true);
  });

  it('9 unknown freshness PASS → fail closed', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: passRiskRef({ freshness: FRESHNESS_STATUS.UNKNOWN }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'stale_risk_cannot_pass')).toBe(true);
  });

  it('10 unavailable freshness PASS → fail closed (projector precheck)', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: passRiskRef({ freshness: FRESHNESS_STATUS.UNAVAILABLE }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'stale_risk_cannot_pass')).toBe(true);
  });

  it('11 invalid negative limit → fail closed', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: passRiskRef({
        outcome: RISK_GATE_OUTCOME.LIMIT,
        limit: -1,
        reasonKey: 'risk_level_limits',
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_limit' || e.field === 'riskEvidenceRef.limit')).toBe(true);
  });

  it('12 non-finite NaN limit → fail closed', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: passRiskRef({
        outcome: RISK_GATE_OUTCOME.LIMIT,
        limit: Number.NaN,
        reasonKey: 'risk_level_limits',
      }),
    }));
    expect(result.ok).toBe(false);
  });

  it('13 LIMIT without numeric limit → LIMITED without fabricated limit', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: passRiskRef({
        outcome: RISK_GATE_OUTCOME.LIMIT,
        reasonKey: 'risk_level_limits',
        min: 0,
        max: 1,
        recommended: 0.5,
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskGate.outcome).toBe(RISK_GATE_OUTCOME.LIMIT);
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.LIMITED);
    expect(result.artifact.riskGate.limit).toBeUndefined();
  });

  it('14 decisionId lineage mismatch → fail closed', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      lineage: {
        decisionId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        decisionContextId: CONTEXT_ID,
        contributingAgentRunIds: [RUN_A],
        orchestrationSetIds: [ORCH_ID],
        decisionContractVersion: DECISION_CONTRACT_VERSION,
        decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
        evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
        orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'lineage_decision_mismatch')).toBe(true);
  });

  it('15 decisionContextId lineage mismatch → fail closed', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      lineage: {
        decisionId: DECISION_ID,
        decisionContextId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        contributingAgentRunIds: [RUN_A],
        orchestrationSetIds: [ORCH_ID],
        decisionContractVersion: DECISION_CONTRACT_VERSION,
        decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
        evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
        orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'lineage_context_mismatch')).toBe(true);
  });

  it('16 cognitive authority escalation → fail closed', () => {
    const decision = baseDecision({ decisionEligible: true });
    // buildContractOnly may force false; mutate after build
    decision.decisionEligible = true;
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      artemisCognitiveDecision: decision,
    }));
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === 'authority_escalation'
        || e.code === 'decision_eligible_rejected'
        || e.code === 'invalid_cognitive_decision'),
    ).toBe(true);
  });

  it('17 ModelAssistedContribution contamination → fail closed', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      modelAssistedContribution: { conclusion: 'BUY' },
    }));
    expect(result.ok).toBe(false);
    // unknown top-level OR contamination depending on allowlist order
    expect(result.ok).toBe(false);
  });

  it('18 legacy MoE contamination → fail closed', () => {
    const result = validateRiskGateIntegrationInput({
      ...baseIntegrationInput(),
      legacyMoe: { votes: 3 },
    });
    // unknown field at top-level fails allowlist first
    expect(result.ok).toBe(false);
  });

  it('19 vote / majority / weighted_vote contamination → fail closed', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: passRiskRef({ reasonKey: 'majority' }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'vote_contamination')).toBe(true);
  });

  it('20 direction / BUY / SELL contamination → fail closed', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: passRiskRef({ reasonKey: 'BUY' }),
    }));
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === 'forbidden_execution_authority_value' || e.value === 'BUY'),
    ).toBe(true);
  });

  it('21 orderId / executionIntent / walletAction contamination → fail closed', () => {
    const result = integrateArtemisRiskControlIntoChain({
      ...baseIntegrationInput(),
      riskEvidenceRef: {
        ...passRiskRef(),
        orderId: 'ord-1',
      },
    });
    expect(result.ok).toBe(false);
  });

  it('22 hard flags always false', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.decisionEligible).toBe(false);
    expect(result.artifact.executionEligible).toBe(false);
    expect(result.artifact.approvedForExecution).toBe(false);
    expect(result.artifact.controlChainStarted).toBe(false);
    expect(result.artifact.ordersCreated).toBe(0);
    expect(result.artifact.liveTradingEnabled).toBe(false);
  });

  it('23 deterministic identical input', () => {
    const a = integrateArtemisRiskControlIntoChain(baseIntegrationInput());
    const b = integrateArtemisRiskControlIntoChain(baseIntegrationInput());
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.artifact.controlChainArtifactId).toBe(b.artifact.controlChainArtifactId);
    expect(a.artifact.riskGate).toEqual(b.artifact.riskGate);
    expect(a.artifact.controlOutcome).toBe(b.artifact.controlOutcome);
  });

  it('24 zero side effects', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.sideEffects).toEqual(ZERO_CONTROL_CHAIN_SIDE_EFFECTS);
    expect(result.integration.sideEffects).toEqual(ZERO_RISK_GATE_INTEGRATION_SIDE_EFFECTS);
  });

  it('25 evaluation artifact input → extract only riskEvidenceRef', () => {
    const evaluation = evaluateArtemisRiskControl({
      assessmentStatus: RISK_ASSESSMENT_STATUS.OK,
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.LOW,
      freshness: FRESHNESS_STATUS.FRESH,
      availability: AVAILABILITY.AVAILABLE,
      runId: RUN_A,
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      recordedAt: RECORDED_AT,
      sourceEvidenceId: 'risk-src-1',
      lineage: {
        decisionId: DECISION_ID,
        decisionContextId: CONTEXT_ID,
        agentId: 'risk',
        runId: RUN_A,
      },
      provenance: {
        writer: 'test',
        methodKey: 'eval',
        stage: '3',
        recordedAt: RECORDED_AT,
      },
    });
    expect(evaluation.ok).toBe(true);
    expect(evaluation.artifact.stage).toBe(RISK_EVALUATION_STAGE);
    expect(evaluation.artifact.contractVersion).toBe(RISK_EVALUATION_CONTRACT_VERSION);

    const input = baseIntegrationInput();
    delete input.riskEvidenceRef;
    input.riskEvaluationArtifact = evaluation.artifact;

    const result = integrateArtemisRiskControlIntoChain(input);
    expect(result.ok).toBe(true);
    expect(result.artifact.riskGate.outcome).toBe(RISK_GATE_OUTCOME.PASS);
    // Provenance must be Control Chain stage, not evaluation stage.
    expect(result.artifact.provenance.stage).toBe(CONTROL_CHAIN_STAGE);
    expect(result.artifact.provenance.stage).not.toBe(RISK_EVALUATION_STAGE);
    // Lineage must not carry evaluation-only keys.
    expect(result.artifact.lineage.evaluationContractVersion).toBeUndefined();
    expect(result.artifact.lineage.projectorContractVersion).toBeUndefined();
    expect(result.artifact.lineage.controlChainContractVersion).toBe(CONTROL_CHAIN_CONTRACT_VERSION);
  });

  it('26 projected riskEvidenceRef input → consume directly', () => {
    const projected = projectRiskEvidenceRef({
      riskEvidence: {
        agentId: 'risk',
        runId: RUN_A,
        authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
        outcome: RISK_GATE_OUTCOME.PASS,
        freshness: FRESHNESS_STATUS.FRESH,
        availability: AVAILABILITY.AVAILABLE,
        reasonKey: 'risk_level_pass',
      },
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      recordedAt: RECORDED_AT,
      lineage: {
        decisionId: DECISION_ID,
        decisionContextId: CONTEXT_ID,
        evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
        controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
        projectorContractVersion: RISK_PROJECTOR_CONTRACT_VERSION,
      },
      provenance: {
        writer: 'test_projector',
        methodKey: 'project',
        stage: '7.3.2.a',
        recordedAt: RECORDED_AT,
      },
    });
    expect(projected.ok).toBe(true);

    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: projected.artifact.riskEvidenceRef,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskGate.outcome).toBe(RISK_GATE_OUTCOME.PASS);
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.HOLD_EVALUATION);
  });

  it('27 unknown top-level field rejection', () => {
    const result = validateRiskGateIntegrationInput({
      ...baseIntegrationInput(),
      unexpectedTop: true,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('unknown_field');
  });

  it('28 Decision/Context mismatch → fail closed', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      decisionContext: baseContext({
        marketScope: {
          provider: 'binance',
          venue: 'binance',
          marketType: MARKET_TYPE.SPOT,
          symbol: 'ETH/USDT',
          baseAsset: 'ETH',
          quoteAsset: 'USDT',
        },
      }),
    }));
    expect(result.ok).toBe(false);
  });

  it('29 no Portfolio/Liquidity/Runtime/Order imports', () => {
    expect(INTEGRATION_SOURCE).not.toMatch(/from ['"].*portfolioOptimizer/);
    expect(INTEGRATION_SOURCE).not.toMatch(/from ['"].*orderExecutor/);
    expect(INTEGRATION_SOURCE).not.toMatch(/from ['"].*orderTracker/);
    expect(INTEGRATION_SOURCE).not.toMatch(/from ['"].*tradingEngine/);
    expect(INTEGRATION_SOURCE).not.toMatch(/from ['"].*liquidity\//);
    expect(INTEGRATION_SOURCE).not.toMatch(/from ['"].*portfolio/i);
    expect(INTEGRATION_SOURCE).not.toMatch(/from ['"].*orderExecutor/);
    expect(INTEGRATION_SOURCE).not.toMatch(/from ['"].*tradingEngine/);
    // Behavioral: Portfolio/Liquidity refs are not accepted on allowlist.
    const result = validateRiskGateIntegrationInput({
      ...baseIntegrationInput(),
      portfolioEvidenceRef: { agentId: 'portfolio' },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('unknown_field');
  });

  it('30 no risk-gate/risk-agent/LLM/provider/network imports', () => {
    expect(INTEGRATION_SOURCE).not.toMatch(/from ['"].*risk-gate/);
    expect(INTEGRATION_SOURCE).not.toMatch(/from ['"].*risk-agent/);
    expect(INTEGRATION_SOURCE).not.toMatch(/from ['"].*agents\/risk/);
    expect(INTEGRATION_SOURCE).not.toMatch(/from ['"].*artemisOrchestrator/);
    expect(INTEGRATION_SOURCE).not.toMatch(/from ['"]openai|from ['"]anthropic|fetch\(|https?\./);
    expect(INTEGRATION_SOURCE).toContain('buildContractOnlyControlChainArtifact');
    expect(INTEGRATION_SOURCE).toContain('validateProjectedRiskEvidenceRef');
    expect(INTEGRATION_SOURCE).toContain(RISK_GATE_INTEGRATION_STAGE);
    expect(INTEGRATION_SOURCE).toContain(RISK_GATE_INTEGRATION_CONTRACT_VERSION);
  });

  it('NOT_APPLICABLE preserves Stage 7.3.1 aggregate semantics', () => {
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: passRiskRef({
        outcome: RISK_GATE_OUTCOME.NOT_APPLICABLE,
        reasonKey: 'risk_not_applicable',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.riskGate.outcome).toBe(RISK_GATE_OUTCOME.NOT_APPLICABLE);
    // With default liquidity BLOCKED: HOLD_EVALUATION (not PASS / not VETOED).
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.HOLD_EVALUATION);
  });

  it('ambiguous riskEvidenceRef + evaluation artifact → fail closed', () => {
    const evaluation = evaluateArtemisRiskControl({
      assessmentStatus: RISK_ASSESSMENT_STATUS.OK,
      overallRiskLevel: CANONICAL_OVERALL_RISK_LEVEL.LOW,
      freshness: FRESHNESS_STATUS.FRESH,
      availability: AVAILABILITY.AVAILABLE,
      runId: RUN_A,
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      recordedAt: RECORDED_AT,
    });
    expect(evaluation.ok).toBe(true);
    const result = integrateArtemisRiskControlIntoChain(baseIntegrationInput({
      riskEvidenceRef: passRiskRef(),
      riskEvaluationArtifact: evaluation.artifact,
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'ambiguous_risk_source')).toBe(true);
  });
});
