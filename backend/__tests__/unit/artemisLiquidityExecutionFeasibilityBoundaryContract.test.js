/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.3.2.c.4 — Liquidity EXECUTION_FEASIBILITY boundary unit tests.
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
  LIQUIDITY_GATE_OUTCOME,
  PORTFOLIO_GATE_OUTCOME,
  RISK_GATE_OUTCOME,
} from '../../contracts/artemisControlChainContract.js';
import {
  LIQUIDITY_FEASIBILITY_CONTRACT_VERSION,
  LIQUIDITY_FEASIBILITY_METHOD_KEY,
  LIQUIDITY_FEASIBILITY_POLICY,
  LIQUIDITY_FEASIBILITY_POLICY_VERSION,
  LIQUIDITY_FEASIBILITY_STAGE,
  LIQUIDITY_FEASIBILITY_WRITER,
  LIQUIDITY_SIDE,
  PROVIDER_CAPABILITY,
  VENUE_STATE,
  ZERO_LIQUIDITY_FEASIBILITY_SIDE_EFFECTS,
  projectLiquidityEvidenceRef,
  validateLiquidityFeasibilityInput,
  validateProjectedLiquidityEvidenceRef,
} from '../../contracts/artemisLiquidityExecutionFeasibilityBoundaryContract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT_SOURCE = readFileSync(
  join(__dirname, '../../contracts/artemisLiquidityExecutionFeasibilityBoundaryContract.js'),
  'utf8',
);

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const RISK_RUN_ID = '22222222-2222-4222-8222-222222222222';
const PORTFOLIO_RUN_ID = '33333333-3333-4333-8333-333333333333';
const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RECORDED_AT = '2026-09-05T12:00:00.000Z';
const BOOK_TS = '2026-09-05T11:59:30.000Z';
const EXPIRY_TS = '2026-09-05T12:05:00.000Z';
const SOURCE_EVIDENCE_ID = 'liquidity-evidence-source-1';
const SOURCE_CONTRACT_VERSION = 'artemis-evidence-1.0.0';

function baseLiquidityEvidence(overrides = {}) {
  return {
    agentId: 'liquidity',
    runId: RUN_ID,
    authorityClass: AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
    outcome: 'FEASIBLE',
    freshness: FRESHNESS_STATUS.FRESH,
    availability: AVAILABILITY.AVAILABLE,
    reasonKey: 'liquidity_feasible',
    venue: 'mexc',
    symbol: 'BTCUSDT',
    marketScope: 'spot',
    side: LIQUIDITY_SIDE.BID,
    proposedSize: 1000,
    bookTimestamp: BOOK_TS,
    spread: 0.1,
    expectedSlippage: 0.2,
    marketImpact: 0.3,
    maxFeasibleSize: 5000,
    depth: 10000,
    expiryTimestamp: EXPIRY_TS,
    venueState: VENUE_STATE.OPEN,
    providerCapability: PROVIDER_CAPABILITY.GRANTED,
    unit: 'quote',
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

function basePortfolioRef(overrides = {}) {
  return {
    agentId: 'portfolio',
    runId: PORTFOLIO_RUN_ID,
    authorityClass: AUTHORITY_CLASS.CONTROL_SIZING,
    outcome: PORTFOLIO_GATE_OUTCOME.AVAILABLE,
    freshness: FRESHNESS_STATUS.FRESH,
    availability: AVAILABILITY.AVAILABLE,
    reasonKey: 'portfolio_allocation_available',
    unit: 'quote',
    min: 100,
    max: 2000,
    recommended: 1000,
    accountStateAvailable: true,
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    liquidityEvidence: baseLiquidityEvidence(),
    riskEvidenceRef: baseRiskRef(),
    portfolioEvidenceRef: basePortfolioRef(),
    recordedAt: RECORDED_AT,
    decisionId: DECISION_ID,
    decisionContextId: CONTEXT_ID,
    sourceEvidenceId: SOURCE_EVIDENCE_ID,
    sourceContractVersion: SOURCE_CONTRACT_VERSION,
    orchestrationSetIds: ['orch-set-1'],
    lineage: {
      decisionId: DECISION_ID,
      decisionContextId: CONTEXT_ID,
      agentId: 'liquidity',
      runId: RUN_ID,
      contributingAgentRunIds: [RUN_ID],
      orchestrationSetIds: ['orch-set-1'],
      sourceEvidenceId: SOURCE_EVIDENCE_ID,
      sourceContractVersion: SOURCE_CONTRACT_VERSION,
    },
    provenance: {
      writer: 'liquidity_adapter_test',
      methodKey: 'map_liquidity_persisted_run',
      stage: 'test',
      recordedAt: RECORDED_AT,
      sourceProviderId: 'mexc',
      sourceEvidenceIdentity: SOURCE_EVIDENCE_ID,
    },
    identity: {
      venue: 'mexc',
      symbol: 'BTCUSDT',
      marketScope: 'spot',
      side: LIQUIDITY_SIDE.BID,
      proposedSize: 1000,
    },
    ...overrides,
  };
}

describe('artemisLiquidityExecutionFeasibilityBoundaryContract — C.4', () => {
  it('1. FEASIBLE with valid truthful evidence', () => {
    const result = projectLiquidityEvidenceRef(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.FEASIBLE);
    expect(result.artifact.liquidityEvidenceRef.bookTimestamp).toBe(BOOK_TS);
    expect(result.artifact.liquidityEvidenceRef.agentId).toBe('liquidity');
    expect(result.artifact.liquidityEvidenceRef.authorityClass).toBe(
      AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
    );
    expect(result.artifact.measuredMetrics).toMatchObject({
      venue: 'mexc',
      symbol: 'BTCUSDT',
      side: LIQUIDITY_SIDE.BID,
      proposedSize: 1000,
      spread: 0.1,
      maxFeasibleSize: 5000,
    });
    expect(result.artifact.sideEffects).toEqual(ZERO_LIQUIDITY_FEASIBILITY_SIDE_EFFECTS);
    expect(result.artifact.controlOutcome).toBe(CONTROL_OUTCOME.CONTROL_PASS_BOUNDED);
    expect(result.artifact.contractVersion).toBe(LIQUIDITY_FEASIBILITY_CONTRACT_VERSION);
    expect(result.artifact.stage).toBe(LIQUIDITY_FEASIBILITY_STAGE);
    expect(validateProjectedLiquidityEvidenceRef(result.artifact.liquidityEvidenceRef).ok).toBe(true);
  });

  it('2. INFEASIBLE due to insufficient depth', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ depth: 100, proposedSize: 1000 }),
      identity: {
        venue: 'mexc', symbol: 'BTCUSDT', marketScope: 'spot',
        side: LIQUIDITY_SIDE.BID, proposedSize: 1000,
      },
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.INFEASIBLE);
    expect(result.artifact.liquidityEvidenceRef.reasonKey).toBe('insufficient_depth');
  });

  it('3. INFEASIBLE due to excessive spread', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({
        spread: LIQUIDITY_FEASIBILITY_POLICY.maxSpreadPct + 0.1,
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.INFEASIBLE);
    expect(result.artifact.liquidityEvidenceRef.reasonKey).toBe('excessive_spread');
  });

  it('4. INFEASIBLE due to excessive expected slippage', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({
        expectedSlippage: LIQUIDITY_FEASIBILITY_POLICY.maxExpectedSlippagePct + 0.1,
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.INFEASIBLE);
    expect(result.artifact.liquidityEvidenceRef.reasonKey).toBe('excessive_expected_slippage');
  });

  it('5. INFEASIBLE due to excessive market impact', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({
        marketImpact: LIQUIDITY_FEASIBILITY_POLICY.maxMarketImpactPct + 0.1,
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.INFEASIBLE);
    expect(result.artifact.liquidityEvidenceRef.reasonKey).toBe('excessive_market_impact');
  });

  it('6. INFEASIBLE when proposedSize > maxFeasibleSize', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ proposedSize: 6000, maxFeasibleSize: 5000, depth: 20000 }),
      portfolioEvidenceRef: basePortfolioRef({ max: 10000 }),
      identity: {
        venue: 'mexc', symbol: 'BTCUSDT', marketScope: 'spot',
        side: LIQUIDITY_SIDE.BID, proposedSize: 6000,
      },
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.INFEASIBLE);
    expect(result.artifact.liquidityEvidenceRef.reasonKey).toBe('proposed_size_exceeds_max_feasible');
  });

  it('7. STALE freshness cannot become FEASIBLE', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ freshness: FRESHNESS_STATUS.STALE }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.STALE);
    expect(result.artifact.liquidityEvidenceRef.outcome).not.toBe(LIQUIDITY_GATE_OUTCOME.FEASIBLE);
  });

  it('8. EXPIRED freshness cannot become FEASIBLE', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ freshness: FRESHNESS_STATUS.EXPIRED }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).not.toBe(LIQUIDITY_GATE_OUTCOME.FEASIBLE);
    expect(result.artifact.liquidityEvidenceRef.reasonKey).toBe('expired_liquidity_cannot_be_feasible');
  });

  it('9. UNKNOWN freshness cannot become FEASIBLE', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ freshness: FRESHNESS_STATUS.UNKNOWN }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).not.toBe(LIQUIDITY_GATE_OUTCOME.FEASIBLE);
  });

  it('10. UNAVAILABLE freshness cannot become FEASIBLE', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ freshness: FRESHNESS_STATUS.UNAVAILABLE }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.UNAVAILABLE);
    expect(result.artifact.measuredMetrics).toBeNull();
  });

  it('11. missing liquidity evidence → fail-closed', () => {
    const input = baseInput();
    delete input.liquidityEvidence;
    const result = projectLiquidityEvidenceRef(input);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_INPUT');
    expect(result.errors.some((e) => e.code === 'missing_liquidity_evidence')).toBe(true);
  });

  it('12. malformed evidence (unknown field) → fail-closed', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ fakeField: 1 }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'unknown_field')).toBe(true);
  });

  it('13. missing bookTimestamp → fail-closed / not FEASIBLE', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ bookTimestamp: undefined }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).not.toBe(LIQUIDITY_GATE_OUTCOME.FEASIBLE);
    expect(result.artifact.liquidityEvidenceRef.reasonKey).toBe('missing_book_timestamp');
  });

  it('14. missing required metric → fail-closed / no fabrication', () => {
    const evidence = baseLiquidityEvidence();
    delete evidence.spread;
    const result = projectLiquidityEvidenceRef(baseInput({ liquidityEvidence: evidence }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).not.toBe(LIQUIDITY_GATE_OUTCOME.FEASIBLE);
    expect(result.artifact.liquidityEvidenceRef.reasonKey).toBe('missing_required_liquidity_metric');
    expect(result.artifact.measuredMetrics).toBeNull();
  });

  it('15. missing/unknown venue state → BLOCKED', () => {
    const missing = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ venueState: undefined }),
    }));
    expect(missing.ok).toBe(true);
    expect(missing.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.BLOCKED);

    const unknown = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ venueState: VENUE_STATE.UNKNOWN }),
    }));
    expect(unknown.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.BLOCKED);
  });

  it('16. provider capability unknown/denied → BLOCKED', () => {
    const unknown = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({
        providerCapability: PROVIDER_CAPABILITY.UNKNOWN,
      }),
    }));
    expect(unknown.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.BLOCKED);

    const denied = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({
        providerCapability: PROVIDER_CAPABILITY.DENIED,
      }),
    }));
    expect(denied.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.BLOCKED);
  });

  it('17. Portfolio proposedSize binding within max stays FEASIBLE', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ proposedSize: 1500 }),
      portfolioEvidenceRef: basePortfolioRef({ max: 2000 }),
      identity: {
        venue: 'mexc', symbol: 'BTCUSDT', marketScope: 'spot',
        side: LIQUIDITY_SIDE.BID, proposedSize: 1500,
      },
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.FEASIBLE);
  });

  it('18. Portfolio max cannot be exceeded', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ proposedSize: 2500, maxFeasibleSize: 10000, depth: 20000 }),
      portfolioEvidenceRef: basePortfolioRef({ max: 2000 }),
      identity: {
        venue: 'mexc', symbol: 'BTCUSDT', marketScope: 'spot',
        side: LIQUIDITY_SIDE.BID, proposedSize: 2500,
      },
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.INFEASIBLE);
    expect(result.artifact.liquidityEvidenceRef.reasonKey).toBe('proposed_size_exceeds_portfolio_max');
  });

  it('19. Risk REJECT cannot yield FEASIBLE', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      riskEvidenceRef: baseRiskRef({ outcome: RISK_GATE_OUTCOME.REJECT }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.BLOCKED);
    expect(result.artifact.liquidityEvidenceRef.reasonKey).toBe(
      'risk_reject_blocks_liquidity_feasibility',
    );
  });

  it('20. Risk UNAVAILABLE cannot yield FEASIBLE', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      riskEvidenceRef: baseRiskRef({ outcome: RISK_GATE_OUTCOME.UNAVAILABLE }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.BLOCKED);
    expect(result.artifact.liquidityEvidenceRef.reasonKey).toBe(
      'risk_unavailable_blocks_liquidity_feasibility',
    );
  });

  it('21. Risk LIMIT interaction — proposedSize > limit → INFEASIBLE', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      riskEvidenceRef: baseRiskRef({ outcome: RISK_GATE_OUTCOME.LIMIT, limit: 500 }),
      liquidityEvidence: baseLiquidityEvidence({ proposedSize: 1000 }),
      portfolioEvidenceRef: basePortfolioRef({ max: 2000 }),
      identity: {
        venue: 'mexc', symbol: 'BTCUSDT', marketScope: 'spot',
        side: LIQUIDITY_SIDE.BID, proposedSize: 1000,
      },
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.INFEASIBLE);
    expect(result.artifact.liquidityEvidenceRef.reasonKey).toBe('proposed_size_exceeds_risk_limit');
  });

  it('22. venue mismatch → fail-closed', () => {
    const result = validateLiquidityFeasibilityInput(baseInput({
      identity: {
        venue: 'binance', symbol: 'BTCUSDT', marketScope: 'spot',
        side: LIQUIDITY_SIDE.BID, proposedSize: 1000,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'venue_mismatch')).toBe(true);
  });

  it('23. symbol mismatch → fail-closed', () => {
    const result = validateLiquidityFeasibilityInput(baseInput({
      identity: {
        venue: 'mexc', symbol: 'ETHUSDT', marketScope: 'spot',
        side: LIQUIDITY_SIDE.BID, proposedSize: 1000,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'symbol_mismatch')).toBe(true);
  });

  it('24. side mismatch → fail-closed', () => {
    const result = validateLiquidityFeasibilityInput(baseInput({
      identity: {
        venue: 'mexc', symbol: 'BTCUSDT', marketScope: 'spot',
        side: LIQUIDITY_SIDE.ASK, proposedSize: 1000,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'side_mismatch')).toBe(true);
  });

  it('25. proposedSize mismatch → fail-closed', () => {
    const result = validateLiquidityFeasibilityInput(baseInput({
      identity: {
        venue: 'mexc', symbol: 'BTCUSDT', marketScope: 'spot',
        side: LIQUIDITY_SIDE.BID, proposedSize: 999,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'proposed_size_mismatch')).toBe(true);
  });

  it('26. decisionId mismatch → fail-closed', () => {
    const result = validateLiquidityFeasibilityInput(baseInput({
      lineage: {
        ...baseInput().lineage,
        decisionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'lineage_decision_mismatch')).toBe(true);
  });

  it('27. decisionContextId mismatch → fail-closed', () => {
    const result = validateLiquidityFeasibilityInput(baseInput({
      lineage: {
        ...baseInput().lineage,
        decisionContextId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'lineage_context_mismatch')).toBe(true);
  });

  it('28. agent/run lineage mismatch → fail-closed', () => {
    const agent = validateLiquidityFeasibilityInput(baseInput({
      lineage: { ...baseInput().lineage, agentId: 'risk' },
    }));
    expect(agent.ok).toBe(false);
    expect(agent.errors.some((e) => e.code === 'lineage_agent_mismatch')).toBe(true);

    const run = validateLiquidityFeasibilityInput(baseInput({
      lineage: {
        ...baseInput().lineage,
        runId: RISK_RUN_ID,
        contributingAgentRunIds: [RUN_ID],
      },
    }));
    expect(run.ok).toBe(false);
    expect(run.errors.some((e) => e.code === 'lineage_run_mismatch')).toBe(true);
  });

  it('29. sourceEvidenceId / sourceContractVersion mismatch → fail-closed', () => {
    const eid = validateLiquidityFeasibilityInput(baseInput({
      lineage: { ...baseInput().lineage, sourceEvidenceId: 'other-source' },
    }));
    expect(eid.ok).toBe(false);
    expect(eid.errors.some((e) => e.code === 'lineage_source_evidence_mismatch')).toBe(true);

    const ver = validateLiquidityFeasibilityInput(baseInput({
      lineage: { ...baseInput().lineage, sourceContractVersion: 'other-1.0.0' },
    }));
    expect(ver.ok).toBe(false);
    expect(ver.errors.some((e) => e.code === 'lineage_source_contract_version_mismatch')).toBe(true);
  });

  it('30. orchestration / contributing-run mismatch → fail-closed', () => {
    const orch = validateLiquidityFeasibilityInput(baseInput({
      lineage: { ...baseInput().lineage, orchestrationSetIds: ['other-orch'] },
    }));
    expect(orch.ok).toBe(false);
    expect(orch.errors.some((e) => e.code === 'lineage_orchestration_set_mismatch')).toBe(true);

    const contrib = validateLiquidityFeasibilityInput(baseInput({
      lineage: {
        ...baseInput().lineage,
        contributingAgentRunIds: [RUN_ID, RISK_RUN_ID],
      },
    }));
    expect(contrib.ok).toBe(false);
    expect(contrib.errors.some((e) => e.code === 'lineage_contributing_agent_run_mismatch')).toBe(true);
  });

  it('31. provenance spoof → fail-closed', () => {
    const result = validateLiquidityFeasibilityInput(baseInput({
      provenance: {
        writer: LIQUIDITY_FEASIBILITY_WRITER,
        methodKey: 'spoofed_method',
        stage: LIQUIDITY_FEASIBILITY_STAGE,
        recordedAt: RECORDED_AT,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'provenance_mismatch')).toBe(true);
  });

  it('32. provider identity allowlist OK; providerPayload spoof fail-closed', () => {
    const ok = validateLiquidityFeasibilityInput(baseInput({
      provenance: {
        ...baseInput().provenance,
        sourceProviderId: 'mexc',
        sourceEvidenceIdentity: SOURCE_EVIDENCE_ID,
      },
    }));
    expect(ok.ok).toBe(true);

    const spoof = validateLiquidityFeasibilityInput(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ providerPayload: { book: [] } }),
    }));
    expect(spoof.ok).toBe(false);
  });

  it('33. authority contamination BUY/SELL/LONG/SHORT/direction → fail-closed', () => {
    for (const poison of [
      { direction: 'BUY' },
      { BUY: true },
      { SELL: true },
      { LONG: 1 },
      { SHORT: 1 },
    ]) {
      const result = validateLiquidityFeasibilityInput(baseInput(poison));
      expect(result.ok).toBe(false);
    }
    const buySide = validateLiquidityFeasibilityInput(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ side: 'BUY' }),
      identity: undefined,
    }));
    expect(buySide.ok).toBe(false);
  });

  it('34. order/execution/wallet contamination → fail-closed', () => {
    for (const poison of [
      { orderId: 'o-1' },
      { executionIntent: {} },
      { walletAction: 'transfer' },
    ]) {
      const result = validateLiquidityFeasibilityInput(baseInput(poison));
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'execution_contamination' || e.code === 'forbidden_key')).toBe(true);
    }
  });

  it('35. MoE / votes / consensus / ModelAssisted contamination → fail-closed', () => {
    for (const poison of [
      { votes: [] },
      { consensus: true },
      { moe: {} },
      { ModelAssistedContribution: {} },
      { majority: 3 },
    ]) {
      const result = validateLiquidityFeasibilityInput(baseInput(poison));
      expect(result.ok).toBe(false);
    }
  });

  it('36. providerPayload / credentials / apiKey / prompt / modelResponse → fail-closed', () => {
    for (const poison of [
      { providerPayload: {} },
      { credentials: {} },
      { apiKey: 'x' },
      { prompt: 'p' },
      { modelResponse: 'r' },
      { secret: 's' },
    ]) {
      const result = validateLiquidityFeasibilityInput(baseInput(poison));
      expect(result.ok).toBe(false);
    }
  });

  it('37. deterministic identical input/output', () => {
    const input = baseInput();
    const a = projectLiquidityEvidenceRef(input);
    const b = projectLiquidityEvidenceRef(input);
    expect(a.ok).toBe(true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('38. zero-side-effect proof and import hygiene', () => {
    const result = projectLiquidityEvidenceRef(baseInput());
    expect(result.artifact.sideEffects).toEqual({
      dbWriteCount: 0,
      redisWriteCount: 0,
      agentExecutionCount: 0,
      providerRequestCount: 0,
      orderOperationCount: 0,
      financialExecutionCount: 0,
      llmCallCount: 0,
      networkRequestCount: 0,
    });
    expect(result.artifact.liveTradingEnabled).toBe(false);
    expect(result.artifact.executionEligible).toBe(false);
    expect(result.artifact.providerConnected).toBe(false);

    // Import / call hygiene — allow listed forbidden *keys* in allowlists, but no runtime I/O.
    expect(CONTRACT_SOURCE).not.toMatch(/\bDate\.now\s*\(/);
    expect(CONTRACT_SOURCE).not.toMatch(/\bMath\.random\s*\(/);
    expect(CONTRACT_SOURCE).not.toMatch(/\bcrypto\.random(?:UUID|Bytes|Int)/);
    expect(CONTRACT_SOURCE).not.toMatch(/\bfetch\s*\(/);
    expect(CONTRACT_SOURCE).not.toMatch(/from\s+['"]axios['"]/);
    expect(CONTRACT_SOURCE).not.toMatch(/from\s+['"]pg['"]/);
    expect(CONTRACT_SOURCE).not.toMatch(/from\s+['"]ioredis['"]/);
    expect(CONTRACT_SOURCE).not.toMatch(/from\s+['"][^'"]*redis[^'"]*['"]/);
    expect(CONTRACT_SOURCE).not.toMatch(/from\s+['"][^'"]*tradingEngine[^'"]*['"]/);
    expect(CONTRACT_SOURCE).not.toMatch(/from\s+['"][^'"]*orderExecutor[^'"]*['"]/);
    expect(CONTRACT_SOURCE).not.toMatch(/from\s+['"][^'"]*artemisOrchestrator[^'"]*['"]/);
    expect(CONTRACT_SOURCE).not.toMatch(/require\s*\(\s*['"]http['"]\s*\)/);
    expect(CONTRACT_SOURCE).not.toMatch(/require\s*\(\s*['"]https['"]\s*\)/);
    expect(CONTRACT_SOURCE.includes('artemisEvidenceContract.js')).toBe(true);
    expect(CONTRACT_SOURCE.includes('artemisControlChainContract.js')).toBe(true);
  });

  it('39. unknown top-level fields → fail-closed', () => {
    const result = validateLiquidityFeasibilityInput(baseInput({ extraTop: 1 }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'unknown_field')).toBe(true);
  });

  it('40. nested forbidden authority fields → fail-closed', () => {
    const result = validateLiquidityFeasibilityInput(baseInput({
      lineage: {
        ...baseInput().lineage,
        ModelAssistedContribution: { x: 1 },
      },
    }));
    expect(result.ok).toBe(false);
  });

  it('Portfolio UNAVAILABLE cannot yield FEASIBLE', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      portfolioEvidenceRef: basePortfolioRef({
        outcome: PORTFOLIO_GATE_OUTCOME.UNAVAILABLE,
        min: undefined,
        max: undefined,
        recommended: undefined,
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).toBe(LIQUIDITY_GATE_OUTCOME.BLOCKED);
  });

  it('expired expiryTimestamp before recordedAt cannot be FEASIBLE', () => {
    const result = projectLiquidityEvidenceRef(baseInput({
      liquidityEvidence: baseLiquidityEvidence({
        expiryTimestamp: '2026-09-05T11:00:00.000Z',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.liquidityEvidenceRef.outcome).not.toBe(LIQUIDITY_GATE_OUTCOME.FEASIBLE);
  });

  it('missing freshness → fail-closed (no FEASIBLE / no fabrication)', () => {
    const evidence = baseLiquidityEvidence();
    delete evidence.freshness;
    const result = projectLiquidityEvidenceRef(baseInput({ liquidityEvidence: evidence }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_INPUT');
    expect(result.errors.some((e) => (
      e.field === 'liquidityEvidence.freshness' && e.code === 'missing_freshness'
    ))).toBe(true);
    expect(result.artifact).toBeUndefined();
    expect(result.liquidityEvidenceRef).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(LIQUIDITY_GATE_OUTCOME.FEASIBLE);
    expect(JSON.stringify(result)).not.toMatch(/"freshness"\s*:\s*"(fresh|stale|expired|unknown|unavailable)"/);
    expect(result).not.toHaveProperty('sideEffects');
  });

  it('malformed freshness → fail-closed (no normalization / no FEASIBLE)', () => {
    const malformedForms = [
      {},
      { status: FRESHNESS_STATUS.FRESH, extra: true },
      42,
      true,
      ['fresh'],
    ];
    for (const freshness of malformedForms) {
      const result = projectLiquidityEvidenceRef(baseInput({
        liquidityEvidence: baseLiquidityEvidence({ freshness }),
      }));
      expect(result.ok).toBe(false);
      expect(result.code).toBe('INVALID_INPUT');
      expect(result.errors.some((e) => (
        e.field === 'liquidityEvidence.freshness' && e.code === 'malformed_freshness'
      ))).toBe(true);
      expect(result.artifact).toBeUndefined();
      expect(result.liquidityEvidenceRef).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain(`"outcome":"${LIQUIDITY_GATE_OUTCOME.FEASIBLE}"`);
      // Must not silently reinterpret malformed input as a canonical freshness status.
      expect(result.errors.some((e) => e.code === 'missing_freshness')).toBe(false);
      expect(result).not.toHaveProperty('sideEffects');
    }

    const validation = validateLiquidityFeasibilityInput(baseInput({
      liquidityEvidence: baseLiquidityEvidence({ freshness: { status: FRESHNESS_STATUS.FRESH, extra: 1 } }),
    }));
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.code === 'malformed_freshness')).toBe(true);
  });

  it('exports policy/version constants for audit', () => {
    expect(LIQUIDITY_FEASIBILITY_POLICY_VERSION).toContain('c4');
    expect(LIQUIDITY_FEASIBILITY_METHOD_KEY).toBe('project_liquidity_evidence_ref_fail_closed');
    expect(LIQUIDITY_FEASIBILITY_WRITER).toBe('artemisLiquidityExecutionFeasibilityBoundaryContract');
  });
});
