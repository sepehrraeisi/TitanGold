/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.3.2.c.3 — Portfolio CONTROL_SIZING boundary unit tests.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTHORITY_CLASS,
  AVAILABILITY,
  FRESHNESS_STATUS,
} from '../../contracts/artemisEvidenceContract.js';
import {
  CONTROL_OUTCOME,
  PORTFOLIO_GATE_OUTCOME,
  RISK_GATE_OUTCOME,
} from '../../contracts/artemisControlChainContract.js';
import {
  PORTFOLIO_SIZING_CONTRACT_VERSION,
  PORTFOLIO_SIZING_METHOD_KEY,
  PORTFOLIO_SIZING_POLICY_VERSION,
  PORTFOLIO_SIZING_STAGE,
  PORTFOLIO_SIZING_WRITER,
  ZERO_PORTFOLIO_SIZING_SIDE_EFFECTS,
  projectPortfolioEvidenceRef,
  validatePortfolioSizingInput,
  validateProjectedPortfolioEvidenceRef,
} from '../../contracts/artemisPortfolioControlSizingBoundaryContract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT_SOURCE = readFileSync(
  join(__dirname, '../../contracts/artemisPortfolioControlSizingBoundaryContract.js'),
  'utf8',
);

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const RISK_RUN_ID = '22222222-2222-4222-8222-222222222222';
const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RECORDED_AT = '2026-09-05T12:00:00.000Z';
const SOURCE_EVIDENCE_ID = 'portfolio-evidence-source-1';

function basePortfolioEvidence(overrides = {}) {
  return {
    agentId: 'portfolio',
    runId: RUN_ID,
    authorityClass: AUTHORITY_CLASS.CONTROL_SIZING,
    outcome: 'AVAILABLE',
    freshness: FRESHNESS_STATUS.FRESH,
    availability: AVAILABILITY.AVAILABLE,
    reasonKey: 'portfolio_allocation_available',
    unit: 'weight_ratio',
    min: 0.05,
    max: 0.35,
    recommended: 0.2,
    accountStateAvailable: true,
    ...overrides,
  };
}

function baseRiskRef(overrides = {}) {
  return {
    agentId: 'risk',
    runId: RISK_RUN_ID,
    authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
    outcome: RISK_GATE_OUTCOME.PASS,
    freshness: FRESHNESS_STATUS.FRESH,
    availability: AVAILABILITY.AVAILABLE,
    reasonKey: 'risk_level_pass',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    portfolioEvidence: basePortfolioEvidence(),
    riskEvidenceRef: baseRiskRef(),
    recordedAt: RECORDED_AT,
    decisionId: DECISION_ID,
    decisionContextId: CONTEXT_ID,
    sourceEvidenceId: SOURCE_EVIDENCE_ID,
    sourceContractVersion: 'artemis-evidence-1.0.0',
    lineage: {
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      agentId: 'portfolio',
      runId: RUN_ID,
      contributingAgentRunIds: [RUN_ID],
      orchestrationSetIds: ['orch-set-1'],
      sourceEvidenceId: SOURCE_EVIDENCE_ID,
      sourceContractVersion: 'artemis-evidence-1.0.0',
    },
    provenance: {
      writer: 'portfolio_adapter_test',
      methodKey: 'map_portfolio_persisted_run',
      stage: '3',
      recordedAt: RECORDED_AT,
    },
    ...overrides,
  };
}

describe('artemisPortfolioControlSizingBoundaryContract — Stage 7.3.2.c.3', () => {
  it('1 valid PASS sizing (AVAILABLE)', () => {
    const result = projectPortfolioEvidenceRef(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.outcome).toBe(PORTFOLIO_GATE_OUTCOME.AVAILABLE);
    expect(result.artifact.portfolioEvidenceRef.authorityClass).toBe(AUTHORITY_CLASS.CONTROL_SIZING);
    expect(result.artifact.portfolioEvidenceRef.agentId).toBe('portfolio');
    expect(result.artifact.portfolioEvidenceRef.min).toBe(0.05);
    expect(result.artifact.portfolioEvidenceRef.max).toBe(0.35);
    expect(result.artifact.portfolioEvidenceRef.recommended).toBe(0.2);
    expect(result.artifact.executionEligible).toBe(false);
    expect(result.artifact.approvedForExecution).toBe(false);
    expect(result.artifact.decisionEligible).toBe(false);
    expect(result.artifact.liveTradingEnabled).toBe(false);
    expect(result.artifact.providerConnected).toBe(false);
    expect(result.artifact.llmCallCount).toBe(0);
    expect(result.artifact.networkRequestCount).toBe(0);
  });

  it('2 valid bounded sizing (PENDING with bounds)', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: basePortfolioEvidence({
        outcome: 'PENDING',
        reasonKey: 'portfolio_allocation_pending',
        min: 0.1,
        max: 0.25,
        recommended: 0.15,
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.outcome).toBe(PORTFOLIO_GATE_OUTCOME.PENDING);
    expect(result.artifact.portfolioEvidenceRef.min).toBe(0.1);
    expect(result.artifact.portfolioEvidenceRef.max).toBe(0.25);
    expect(result.artifact.portfolioEvidenceRef.recommended).toBe(0.15);
  });

  it('3 Risk LIMIT caps max', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      riskEvidenceRef: baseRiskRef({
        outcome: RISK_GATE_OUTCOME.LIMIT,
        limit: 0.2,
        reasonKey: 'risk_level_limits',
      }),
      portfolioEvidence: basePortfolioEvidence({ max: 0.35, recommended: 0.3 }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.max).toBe(0.2);
    expect(result.artifact.portfolioEvidenceRef.recommended).toBe(0.2);
    expect(result.artifact.projectionNotes).toContain('risk_limit_capped_max');
  });

  it('3A Risk LIMIT below Portfolio min fails closed (no usable contradictory bounds)', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: basePortfolioEvidence({
        min: 0.3,
        max: 0.5,
        recommended: 0.4,
      }),
      riskEvidenceRef: baseRiskRef({
        outcome: RISK_GATE_OUTCOME.LIMIT,
        limit: 0.2,
        reasonKey: 'risk_level_limits',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.outcome).toBe(PORTFOLIO_GATE_OUTCOME.UNAVAILABLE);
    expect(result.artifact.portfolioEvidenceRef.reasonKey).toBe('risk_limit_makes_bounds_contradictory');
    expect(result.artifact.portfolioEvidenceRef.min).toBeUndefined();
    expect(result.artifact.portfolioEvidenceRef.max).toBeUndefined();
    expect(result.artifact.portfolioEvidenceRef.recommended).toBeUndefined();
    expect(result.artifact.projectionNotes).toContain('risk_limit_contradictory_bounds');
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE);
    // Must never emit usable contradictory artifact min=0.30 max=0.20 recommended=0.20
    const ref = result.artifact.portfolioEvidenceRef;
    expect(ref.min === 0.3 && ref.max === 0.2 && ref.recommended === 0.2).toBe(false);
  });

  it('3B Risk LIMIT equal to Portfolio min yields valid bounded result', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: basePortfolioEvidence({
        min: 0.3,
        max: 0.5,
        recommended: 0.4,
      }),
      riskEvidenceRef: baseRiskRef({
        outcome: RISK_GATE_OUTCOME.LIMIT,
        limit: 0.3,
        reasonKey: 'risk_level_limits',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.outcome).toBe(PORTFOLIO_GATE_OUTCOME.AVAILABLE);
    expect(result.artifact.portfolioEvidenceRef.min).toBe(0.3);
    expect(result.artifact.portfolioEvidenceRef.max).toBe(0.3);
    expect(result.artifact.portfolioEvidenceRef.recommended).toBe(0.3);
    expect(result.artifact.portfolioEvidenceRef.recommended)
      .toBeLessThanOrEqual(result.artifact.portfolioEvidenceRef.max);
    expect(result.artifact.portfolioEvidenceRef.min)
      .toBeLessThanOrEqual(result.artifact.portfolioEvidenceRef.max);
    expect(result.artifact.projectionNotes).toContain('risk_limit_capped_max');
  });

  it('4 Risk REJECT blocks sizing', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      riskEvidenceRef: baseRiskRef({
        outcome: RISK_GATE_OUTCOME.REJECT,
        reasonKey: 'risk_level_blocks',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.outcome).toBe(PORTFOLIO_GATE_OUTCOME.UNAVAILABLE);
    expect(result.artifact.portfolioEvidenceRef.min).toBeUndefined();
    expect(result.artifact.portfolioEvidenceRef.max).toBeUndefined();
    expect(result.artifact.portfolioEvidenceRef.recommended).toBeUndefined();
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.VETOED);
    expect(result.artifact.projectionNotes).toContain('risk_reject_blocks_sizing');
  });

  it('5 Risk UNAVAILABLE fails closed', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      riskEvidenceRef: baseRiskRef({
        outcome: RISK_GATE_OUTCOME.UNAVAILABLE,
        reasonKey: 'risk_unavailable',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.outcome).toBe(PORTFOLIO_GATE_OUTCOME.UNAVAILABLE);
    expect(result.artifact.portfolioEvidenceRef.max).toBeUndefined();
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.INSUFFICIENT_CONTROL_EVIDENCE);
    expect(result.artifact.projectionNotes).toContain('risk_unavailable_blocks_sizing');
  });

  it('6 missing Portfolio evidence', () => {
    const input = baseInput();
    delete input.portfolioEvidence;
    const result = projectPortfolioEvidenceRef(input);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_INPUT');
    expect(result.errors.some((e) => e.field === 'portfolioEvidence' && e.code === 'required')).toBe(true);
  });

  it('7 malformed Portfolio evidence', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: 'not-an-object',
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'required_object')).toBe(true);
  });

  it('8 stale freshness fail-closed', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: basePortfolioEvidence({ freshness: FRESHNESS_STATUS.STALE }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.outcome).toBe(PORTFOLIO_GATE_OUTCOME.UNAVAILABLE);
    expect(result.artifact.portfolioEvidenceRef.max).toBeUndefined();
    expect(result.artifact.projectionNotes).toContain('freshness_blocked_available');
  });

  it('9 expired freshness fail-closed', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: basePortfolioEvidence({ freshness: FRESHNESS_STATUS.EXPIRED }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.outcome).toBe(PORTFOLIO_GATE_OUTCOME.UNAVAILABLE);
    expect(result.artifact.portfolioEvidenceRef.reasonKey).toBe('expired_portfolio_cannot_be_available');
  });

  it('10 unknown freshness fail-closed', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: basePortfolioEvidence({ freshness: FRESHNESS_STATUS.UNKNOWN }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.outcome).toBe(PORTFOLIO_GATE_OUTCOME.UNAVAILABLE);
    expect(result.artifact.portfolioEvidenceRef.reasonKey).toBe('unknown_freshness_portfolio_fail_closed');
  });

  it('11 unavailable account/exposure', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: basePortfolioEvidence({ accountStateAvailable: false }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.outcome).toBe(PORTFOLIO_GATE_OUTCOME.UNAVAILABLE);
    expect(result.artifact.portfolioEvidenceRef.reasonKey).toBe('missing_canonical_account_state');
    expect(result.artifact.portfolioEvidenceRef.max).toBeUndefined();
  });

  it('12 invalid negative bounds', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: basePortfolioEvidence({ min: -0.1 }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_negative_bounds')).toBe(true);
  });

  it('13 non-finite bounds', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: basePortfolioEvidence({ max: Number.POSITIVE_INFINITY }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_bounds')).toBe(true);
  });

  it('14 contradictory min > max', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: basePortfolioEvidence({ min: 0.5, max: 0.2, recommended: 0.3 }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'contradictory_bounds')).toBe(true);
  });

  it('15 recommended outside bounds', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: basePortfolioEvidence({ min: 0.1, max: 0.2, recommended: 0.5 }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'recommended_out_of_bounds')).toBe(true);
  });

  it('16 direction BUY/SELL/LONG/SHORT rejected', () => {
    for (const value of ['BUY', 'SELL', 'LONG', 'SHORT']) {
      const result = validatePortfolioSizingInput(baseInput({
        portfolioEvidence: basePortfolioEvidence({ reasonKey: value }),
      }));
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'execution_authority_forbidden' || e.value === value)).toBe(true);
    }
    const withDirectionKey = projectPortfolioEvidenceRef({
      ...baseInput(),
      direction: 'BUY',
    });
    expect(withDirectionKey.ok).toBe(false);
  });

  it('17 order/execution/wallet contamination rejected', () => {
    const result = projectPortfolioEvidenceRef({
      ...baseInput(),
      orderId: 'ord-1',
      executionIntent: { side: 'buy' },
      walletAction: 'transfer',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'execution_contamination' || e.code === 'forbidden_key')).toBe(true);
  });

  it('18 legacy MoE/vote contamination rejected', () => {
    const result = projectPortfolioEvidenceRef({
      ...baseInput(),
      votes: [{ agent: 'technical', vote: 'buy' }],
      majority: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'legacy_moe_forbidden')).toBe(true);
  });

  it('19 ModelAssistedContribution contamination rejected', () => {
    const result = projectPortfolioEvidenceRef({
      ...baseInput(),
      ModelAssistedContribution: { text: 'size up' },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'model_assisted_forbidden')).toBe(true);
  });

  it('20 lineage decisionId mismatch', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      decisionId: DECISION_ID,
      lineage: {
        decisionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        decisionContextId: CONTEXT_ID,
        agentId: 'portfolio',
        runId: RUN_ID,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'lineage_decision_mismatch')).toBe(true);
  });

  it('21 lineage decisionContextId mismatch', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      decisionContextId: CONTEXT_ID,
      lineage: {
        decisionId: DECISION_ID,
        decisionContextId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        agentId: 'portfolio',
        runId: RUN_ID,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'lineage_context_mismatch')).toBe(true);
  });

  it('21A lineage.agentId mismatch fails closed (no silent normalize)', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      lineage: {
        decisionId: DECISION_ID,
        decisionContextId: CONTEXT_ID,
        agentId: 'risk',
        runId: RUN_ID,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'lineage_agent_mismatch')).toBe(true);
    expect(result.artifact).toBeUndefined();
  });

  it('21B lineage.runId mismatch fails closed (no silent normalize)', () => {
    const OTHER_RUN = '33333333-3333-4333-8333-333333333333';
    const result = projectPortfolioEvidenceRef(baseInput({
      lineage: {
        decisionId: DECISION_ID,
        decisionContextId: CONTEXT_ID,
        agentId: 'portfolio',
        runId: OTHER_RUN,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'lineage_run_mismatch')).toBe(true);
    expect(result.artifact).toBeUndefined();
  });

  it('22 provenance mismatch', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      provenance: {
        writer: PORTFOLIO_SIZING_WRITER,
        methodKey: 'spoofed_method',
        stage: PORTFOLIO_SIZING_STAGE,
        recordedAt: RECORDED_AT,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'provenance_mismatch')).toBe(true);
  });

  it('23 unknown fields rejected', () => {
    const result = projectPortfolioEvidenceRef({
      ...baseInput(),
      unexpectedField: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'unknown_field')).toBe(true);
  });

  it('24 authority escalation rejected', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: basePortfolioEvidence({
        authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'authority_escalation')).toBe(true);
  });

  it('25 deterministic identical inputs', () => {
    const input = baseInput({
      riskEvidenceRef: baseRiskRef({
        outcome: RISK_GATE_OUTCOME.LIMIT,
        limit: 0.22,
        reasonKey: 'risk_level_limits',
      }),
    });
    const a = projectPortfolioEvidenceRef(input);
    const b = projectPortfolioEvidenceRef(input);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('26 zero side effects + hard flags', () => {
    const result = projectPortfolioEvidenceRef(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.sideEffects).toEqual(ZERO_PORTFOLIO_SIZING_SIDE_EFFECTS);
    expect(result.artifact.decisionEligible).toBe(false);
    expect(result.artifact.executionEligible).toBe(false);
    expect(result.artifact.approvedForExecution).toBe(false);
    expect(result.artifact.liveTradingEnabled).toBe(false);
    expect(result.artifact.providerConnected).toBe(false);
    expect(result.artifact.llmCallCount).toBe(0);
    expect(result.artifact.networkRequestCount).toBe(0);
    for (const value of Object.values(result.artifact.sideEffects)) {
      expect(value).toBe(0);
    }
  });

  it('27 Risk LIMIT with no numeric limit does not fabricate one', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      riskEvidenceRef: baseRiskRef({
        outcome: RISK_GATE_OUTCOME.LIMIT,
        reasonKey: 'risk_level_limits_no_numeric',
      }),
      portfolioEvidence: basePortfolioEvidence({ max: 0.4, recommended: 0.3 }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.max).toBe(0.4);
    expect(result.artifact.portfolioEvidenceRef.recommended).toBe(0.3);
    expect(result.artifact.projectionNotes).toContain('risk_limit_without_numeric_bound_not_fabricated');
    expect(result.artifact.portfolioEvidenceRef.limit).toBeUndefined();
  });

  it('28 canonical Portfolio SoT field compatibility', () => {
    // Shape expected from portfolioAdapter CONTROL_SIZING mapping: weights → min/max/recommended
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: basePortfolioEvidence({
        unit: 'weight_ratio',
        min: 0,
        max: 0.4,
        recommended: 0.18,
        accountStateAvailable: true,
        reasonKey: 'portfolio_optimal_allocation',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.unit).toBe('weight_ratio');
    expect(result.artifact.contractVersion).toBe(PORTFOLIO_SIZING_CONTRACT_VERSION);
    expect(result.artifact.policyVersion).toBe(PORTFOLIO_SIZING_POLICY_VERSION);
    expect(result.artifact.stage).toBe(PORTFOLIO_SIZING_STAGE);
    expect(result.artifact.lineage.controlChainContractVersion).toBeTruthy();
    expect(result.artifact.lineage.contributingAgentRunIds).toEqual([RUN_ID]);
    expect(result.artifact.lineage.orchestrationSetIds).toEqual(['orch-set-1']);
  });

  it('29 Control Chain portfolioEvidenceRef shape compatibility', () => {
    const result = projectPortfolioEvidenceRef(baseInput());
    expect(result.ok).toBe(true);
    const validated = validateProjectedPortfolioEvidenceRef(
      result.artifact.portfolioEvidenceRef,
      baseRiskRef(),
    );
    expect(validated.ok).toBe(true);
    expect(result.artifact.provenance.writer).toBe(PORTFOLIO_SIZING_WRITER);
    expect(result.artifact.provenance.methodKey).toBe(PORTFOLIO_SIZING_METHOD_KEY);
    expect(result.artifact.provenance.sourceWriter).toBe('portfolio_adapter_test');
    expect(result.artifact.provenance.sourceMethodKey).toBe('map_portfolio_persisted_run');
  });

  it('30 no dependency/import of Risk gate, Liquidity, Runtime, Order, LLM/provider/network', () => {
    const fromSpecs = [...CONTRACT_SOURCE.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)]
      .map((match) => match[1]);
    expect(fromSpecs.sort()).toEqual([
      './artemisControlChainContract.js',
      './artemisEvidenceContract.js',
    ]);
    const forbiddenImportSubstrings = [
      'risk-gate',
      'RiskGate',
      'artemisRiskGate',
      'artemisRiskControlEvaluation',
      'artemisRiskControlRuntime',
      'liquidity',
      'Liquidity',
      'runtimeGate',
      'orderExecutor',
      'OrderManagement',
      'tradingEngine',
      'artemisExecutionGate',
      'artemisOrchestrator',
      'routes/artemis',
      'agents/portfolio',
      'portfolioOptimizer',
      'portfolioAdapter',
      'node-fetch',
      'openai',
      'axios',
      'ioredis',
      'node:http',
      'node:https',
      'node:net',
      'node:dns',
    ];
    for (const from of fromSpecs) {
      for (const needle of forbiddenImportSubstrings) {
        expect(from.includes(needle)).toBe(false);
      }
    }
    // Determinism: no non-deterministic primitives in this library module.
    expect(CONTRACT_SOURCE.includes('Math.random')).toBe(false);
    expect(CONTRACT_SOURCE.includes('crypto.random')).toBe(false);
    expect(CONTRACT_SOURCE.includes('Date.now')).toBe(false);
    expect(CONTRACT_SOURCE.includes('require(')).toBe(false);
  });

  it('adapter-shaped freshness { status } normalizes', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      portfolioEvidence: basePortfolioEvidence({
        freshness: { status: FRESHNESS_STATUS.FRESH },
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.freshness).toBe(FRESHNESS_STATUS.FRESH);
  });

  it('missing riskEvidenceRef fails closed', () => {
    const input = baseInput();
    delete input.riskEvidenceRef;
    const result = projectPortfolioEvidenceRef(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'riskEvidenceRef' && e.code === 'required')).toBe(true);
  });

  it('Risk LIMIT clamps but does not invent max when portfolio max absent', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      riskEvidenceRef: baseRiskRef({
        outcome: RISK_GATE_OUTCOME.LIMIT,
        limit: 0.15,
        reasonKey: 'risk_level_limits',
      }),
      portfolioEvidence: basePortfolioEvidence({
        min: 0.05,
        recommended: 0.1,
        max: undefined,
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.max).toBeUndefined();
    expect(result.artifact.portfolioEvidenceRef.recommended).toBe(0.1);
    expect(result.artifact.projectionNotes).toContain('risk_limit_present_no_portfolio_max_not_fabricated');
  });

  it('Risk PASS leaves Portfolio own constraints', () => {
    const result = projectPortfolioEvidenceRef(baseInput({
      riskEvidenceRef: baseRiskRef({ outcome: RISK_GATE_OUTCOME.PASS }),
      portfolioEvidence: basePortfolioEvidence({ min: 0.1, max: 0.3, recommended: 0.2 }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.portfolioEvidenceRef.max).toBe(0.3);
    expect(result.artifact.portfolioEvidenceRef.min).toBe(0.1);
  });
});
