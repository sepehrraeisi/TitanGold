/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import {
  CONFIRMATION_STATUS,
  REQUIRED_CONTROL_CHAIN_CONTRACT_VERSION,
  EXECUTION_INTENT_METHOD_KEY,
  EXECUTION_INTENT_OPERATION,
  EXECUTION_INTENT_STATUS,
  EXECUTION_INTENT_WRITER,
  ORDER_TYPE,
  PROVIDER_CAPABILITY,
  validateExecutionIntent,
  classifyProviderOutcome,
  validateExecutionIntentArtifact,
} from '../../contracts/artemisOrderManagementExecutionBoundaryContract.js';
import { AUTHORITY_CLASS, FRESHNESS_STATUS } from '../../contracts/artemisEvidenceContract.js';

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const UUID_3 = '33333333-3333-4333-8333-333333333333';
const UUID_4 = '44444444-4444-4444-8444-444444444444';
const UUID_5 = '55555555-5555-4555-8555-555555555555';

function fixture(overrides = {}) {
  const intent = {
    intentId: UUID_1,
    decisionId: UUID_2,
    decisionContextId: UUID_3,
    runId: UUID_4,
    createdAt: '2026-09-20T06:00:00.000Z',
    expiresAt: '2026-09-20T07:00:00.000Z',
    idempotencyKey: 'c6-test-idempotency-1',
    operation: {
      kind: EXECUTION_INTENT_OPERATION.PLACE,
      orderType: ORDER_TYPE.LIMIT,
      side: 'buy',
      symbol: 'BTC/USDT',
      quantity: 1,
      price: 100000,
      providerId: 'paper-provider',
      clientOrderId: 'client-1',
    },
    limits: { maxNotional: 100000, maxQuantity: 1, maxAttempts: 1 },
    confirmation: {
      status: CONFIRMATION_STATUS.CONFIRMED,
      confirmationId: 'confirm-1',
      confirmedAt: '2026-09-20T06:01:00.000Z',
      actor: 'owner',
    },
    providerCapability: {
      providerId: 'paper-provider',
      capability: PROVIDER_CAPABILITY.AVAILABLE,
      capabilityVersion: 'paper-1',
      observedAt: '2026-09-20T06:01:00.000Z',
    },
    lineage: {
      controlChainContractVersion: REQUIRED_CONTROL_CHAIN_CONTRACT_VERSION,
      riskRunId: UUID_1,
      portfolioRunId: UUID_2,
      liquidityRunId: UUID_3,
      runtimeRunId: UUID_4,
      sourceEvidenceIds: ['risk-1', 'portfolio-1', 'liquidity-1', 'runtime-1'],
    },
    provenance: {
      writer: EXECUTION_INTENT_WRITER,
      methodKey: EXECUTION_INTENT_METHOD_KEY,
      stage: '7.3.2.c.6',
      source: 'unit-test',
      recordedAt: '2026-09-20T06:01:00.000Z',
    },
  };

  const riskEvidenceRef = {
    agentId: 'risk',
    authorityClass: AUTHORITY_CLASS.CONTROL_VETO,
    outcome: 'PASS',
    reasonKey: 'risk_pass',
    runId: UUID_1,
    freshness: FRESHNESS_STATUS.FRESH,
  };
  const portfolioEvidenceRef = {
    agentId: 'portfolio',
    authorityClass: AUTHORITY_CLASS.CONTROL_SIZING,
    outcome: 'AVAILABLE',
    reasonKey: 'portfolio_available',
    runId: UUID_2,
    freshness: FRESHNESS_STATUS.FRESH,
  };
  const liquidityEvidenceRef = {
    agentId: 'liquidity',
    authorityClass: AUTHORITY_CLASS.EXECUTION_FEASIBILITY,
    outcome: 'FEASIBLE',
    reasonKey: 'liquidity_feasible',
    runId: UUID_3,
    freshness: FRESHNESS_STATUS.FRESH,
  };
  const runtimeGate = {
    outcome: 'CLEAR',
    authorityClass: 'titangold_runtime_safety_ssot',
    requestedRuntimeMode: 'paper',
    effectiveRuntimeMode: 'paper',
    capabilityState: 'granted',
    killSwitchActive: false,
    ssotAvailable: true,
    ssotOwner: 'runtimeExecutionStateService',
    runId: UUID_4,
  };

  return {
    executionIntent: {
      ...intent,
      ...overrides.intent,
      operation: { ...intent.operation, ...(overrides.intent?.operation || {}) },
      limits: { ...intent.limits, ...(overrides.intent?.limits || {}) },
      confirmation: { ...intent.confirmation, ...(overrides.intent?.confirmation || {}) },
      providerCapability: { ...intent.providerCapability, ...(overrides.intent?.providerCapability || {}) },
      lineage: { ...intent.lineage, ...(overrides.intent?.lineage || {}) },
      provenance: { ...intent.provenance, ...(overrides.intent?.provenance || {}) },
    },
    controlOutcome: overrides.controlOutcome ?? 'CONTROL_PASS_BOUNDED',
    riskEvidenceRef: { ...riskEvidenceRef, ...(overrides.riskEvidenceRef || {}) },
    portfolioEvidenceRef: { ...portfolioEvidenceRef, ...(overrides.portfolioEvidenceRef || {}) },
    liquidityEvidenceRef: { ...liquidityEvidenceRef, ...(overrides.liquidityEvidenceRef || {}) },
    runtimeGate: { ...runtimeGate, ...(overrides.runtimeGate || {}) },
    now: overrides.now ?? '2026-09-20T06:10:00.000Z',
    seenIdempotencyKeys: overrides.seenIdempotencyKeys || [],
  };
}

describe('Artemis C.6 Execution Intent Boundary', () => {
  it('accepts a fully validated paper/dry-run intent without side effects', () => {
    const result = validateExecutionIntent(fixture());
    expect(result.ok).toBe(true);
    expect(result.status).toBe(EXECUTION_INTENT_STATUS.ACCEPTED);
    expect(result.dispatch.realProviderTransport).toBe(false);
    expect(result.dispatch.financialMutation).toBe(false);
    expect(result.sideEffects.providerRequestCount).toBe(0);
    expect(result.sideEffects.financialExecutionCount).toBe(0);
  });

  it.each([
    ['risk reject', { riskEvidenceRef: { outcome: 'REJECT' } }],
    ['risk unavailable', { riskEvidenceRef: { outcome: 'UNAVAILABLE' } }],
    ['portfolio unavailable', { portfolioEvidenceRef: { outcome: 'UNAVAILABLE' } }],
    ['liquidity infeasible', { liquidityEvidenceRef: { outcome: 'INFEASIBLE' } }],
    ['runtime blocked', { runtimeGate: { outcome: 'RUNTIME_BLOCKED' } }],
  ])('blocks when upstream gate is unsafe: %s', (_name, patch) => {
    const result = validateExecutionIntent(fixture(patch));
    expect(result.ok).toBe(true);
    expect(result.status).toBe(EXECUTION_INTENT_STATUS.BLOCKED);
  });

  it('fails closed when confirmation is missing', () => {
    const result = validateExecutionIntent(fixture({
      intent: { confirmation: { status: 'unknown', confirmationId: 'x', confirmedAt: '2026-09-20T06:01:00.000Z', actor: 'owner' } },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'confirmation_required')).toBe(true);
  });

  it('fails closed when provider capability is unknown', () => {
    const result = validateExecutionIntent(fixture({
      intent: { providerCapability: { capability: 'unknown' } },
    }));
    expect(result.ok).toBe(true);
    expect(result.status).toBe(EXECUTION_INTENT_STATUS.BLOCKED);
  });

  it('fails closed on expired intent', () => {
    const result = validateExecutionIntent(fixture({ intent: { expiresAt: '2026-09-20T06:05:00.000Z' } }));
    expect(result.status).toBe(EXECUTION_INTENT_STATUS.EXPIRED);
  });

  it('rejects quantity and notional over limits', () => {
    const quantity = validateExecutionIntent(fixture({ intent: { operation: { quantity: 2 } } }));
    expect(quantity.ok).toBe(false);
    const notional = validateExecutionIntent(fixture({ intent: { operation: { price: 200000 } } }));
    expect(notional.ok).toBe(false);
  });

  it('rejects duplicate idempotency keys before dispatch', () => {
    const result = validateExecutionIntent(fixture({ seenIdempotencyKeys: ['c6-test-idempotency-1'] }));
    expect(result.ok).toBe(true);
    expect(result.status).toBe(EXECUTION_INTENT_STATUS.DUPLICATE);
  });

  it('fails closed when deterministic evaluation time is missing', () => {
    const input = fixture();
    delete input.now;
    const result = validateExecutionIntent(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'required_deterministic_timestamp')).toBe(true);
  });

  it('fails closed when runtime mode is live', () => {
    const result = validateExecutionIntent(fixture({
      runtimeGate: {
        requestedRuntimeMode: 'live',
        effectiveRuntimeMode: 'paper',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_runtime_mode')).toBe(true);
  });

  it('fails closed when runtime mode is malformed', () => {
    const result = validateExecutionIntent(fixture({
      runtimeGate: {
        requestedRuntimeMode: 'not_a_runtime_mode',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_runtime_mode')).toBe(true);
  });

  it('never retries an unknown provider outcome', () => {
    const result = classifyProviderOutcome('timeout');
    expect(result.retryable).toBe(false);
    expect(result.failClosed).toBe(true);
    expect(result.requiresReconciliation).toBe(true);
  });

  it('rejects forged execution transport flags', () => {
    const result = validateExecutionIntentArtifact({
      status: EXECUTION_INTENT_STATUS.ACCEPTED,
      dispatch: { realProviderTransport: true, financialMutation: false },
      sideEffects: { providerRequestCount: 0, financialExecutionCount: 0 },
    });
    expect(result.ok).toBe(false);
  });

  describe('deep-audit remediation — runtime lineage', () => {
    it('requires runtimeGate.runId and matches lineage.runtimeRunId (positive)', () => {
      const result = validateExecutionIntent(fixture({
        runtimeGate: { runId: UUID_4 },
        intent: { lineage: { runtimeRunId: UUID_4 } },
      }));
      expect(result.ok).toBe(true);
      expect(result.status).toBe(EXECUTION_INTENT_STATUS.ACCEPTED);
    });

    it('fails closed when runtimeGate.runId is missing', () => {
      const input = fixture();
      delete input.runtimeGate.runId;
      const result = validateExecutionIntent(input);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.field === 'runtimeGate.runId' && e.code === 'required')).toBe(true);
    });

    it('blocks when lineage.runtimeRunId mismatches runtimeGate.runId', () => {
      const result = validateExecutionIntent(fixture({
        runtimeGate: { runId: UUID_4 },
        intent: { lineage: { runtimeRunId: UUID_5 } },
      }));
      expect(result.ok).toBe(true);
      expect(result.status).toBe(EXECUTION_INTENT_STATUS.BLOCKED);
      expect(result.blockedReasons).toContain('runtime_lineage_mismatch');
    });
  });

  describe('deep-audit remediation — upstream freshness', () => {
    it('accepts FRESH upstream evidence (positive)', () => {
      const result = validateExecutionIntent(fixture({
        riskEvidenceRef: { freshness: FRESHNESS_STATUS.FRESH },
        portfolioEvidenceRef: { freshness: FRESHNESS_STATUS.FRESH },
        liquidityEvidenceRef: { freshness: FRESHNESS_STATUS.FRESH },
      }));
      expect(result.status).toBe(EXECUTION_INTENT_STATUS.ACCEPTED);
    });

    it('fails closed on non-enum freshness', () => {
      const result = validateExecutionIntent(fixture({
        riskEvidenceRef: { freshness: 'FRESH' },
      }));
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'invalid_freshness')).toBe(true);
    });

    it('blocks when risk usable outcome carries stale freshness', () => {
      const result = validateExecutionIntent(fixture({
        riskEvidenceRef: { freshness: FRESHNESS_STATUS.STALE },
      }));
      expect(result.status).toBe(EXECUTION_INTENT_STATUS.BLOCKED);
      expect(result.blockedReasons).toContain('risk_freshness_unsafe');
    });

    it('blocks when portfolio AVAILABLE carries unknown freshness', () => {
      const result = validateExecutionIntent(fixture({
        portfolioEvidenceRef: { freshness: FRESHNESS_STATUS.UNKNOWN },
      }));
      expect(result.status).toBe(EXECUTION_INTENT_STATUS.BLOCKED);
      expect(result.blockedReasons).toContain('portfolio_freshness_unsafe');
    });

    it('blocks when liquidity FEASIBLE is not exactly FRESH', () => {
      const result = validateExecutionIntent(fixture({
        liquidityEvidenceRef: { freshness: FRESHNESS_STATUS.AGED },
      }));
      expect(result.status).toBe(EXECUTION_INTENT_STATUS.BLOCKED);
      expect(result.blockedReasons).toContain('liquidity_freshness_not_fresh');
    });
  });

  describe('deep-audit remediation — providerCapability observedAt', () => {
    it('accepts observedAt within [createdAt, now] (positive)', () => {
      const result = validateExecutionIntent(fixture({
        intent: { providerCapability: { observedAt: '2026-09-20T06:05:00.000Z' } },
        now: '2026-09-20T06:10:00.000Z',
      }));
      expect(result.status).toBe(EXECUTION_INTENT_STATUS.ACCEPTED);
    });

    it('fails closed when observedAt is in the future vs now', () => {
      const result = validateExecutionIntent(fixture({
        intent: { providerCapability: { observedAt: '2026-09-20T06:30:00.000Z' } },
        now: '2026-09-20T06:10:00.000Z',
      }));
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'provider_capability_observed_in_future')).toBe(true);
    });

    it('fails closed when observedAt predates intent createdAt (stale)', () => {
      const result = validateExecutionIntent(fixture({
        intent: { providerCapability: { observedAt: '2026-09-20T05:00:00.000Z' } },
        now: '2026-09-20T06:10:00.000Z',
      }));
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'provider_capability_stale')).toBe(true);
    });
  });

  describe('deep-audit remediation — provenance ownership', () => {
    it('accepts canonical writer/methodKey (positive)', () => {
      const result = validateExecutionIntent(fixture({
        intent: {
          provenance: {
            writer: EXECUTION_INTENT_WRITER,
            methodKey: EXECUTION_INTENT_METHOD_KEY,
          },
        },
      }));
      expect(result.status).toBe(EXECUTION_INTENT_STATUS.ACCEPTED);
    });

    it('fails closed on forged provenance writer', () => {
      const result = validateExecutionIntent(fixture({
        intent: { provenance: { writer: 'spoofed-writer' } },
      }));
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'invalid_writer')).toBe(true);
    });

    it('fails closed on forged provenance methodKey', () => {
      const result = validateExecutionIntent(fixture({
        intent: { provenance: { methodKey: 'spoofed_method' } },
      }));
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === 'invalid_method_key')).toBe(true);
    });
  });
});
