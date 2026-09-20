/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import {
  CONFIRMATION_STATUS,
  EXECUTION_INTENT_OPERATION,
  EXECUTION_INTENT_STATUS,
  ORDER_TYPE,
  PROVIDER_CAPABILITY,
  validateExecutionIntent,
  classifyProviderOutcome,
  validateExecutionIntentArtifact,
} from '../../contracts/artemisOrderManagementExecutionBoundaryContract.js';

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const UUID_3 = '33333333-3333-4333-8333-333333333333';
const UUID_4 = '44444444-4444-4444-8444-444444444444';

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
      controlChainContractVersion: 'test-control-chain',
      riskRunId: UUID_1,
      portfolioRunId: UUID_2,
      liquidityRunId: UUID_3,
      runtimeRunId: UUID_4,
      sourceEvidenceIds: ['risk-1', 'portfolio-1', 'liquidity-1', 'runtime-1'],
    },
    provenance: {
      writer: 'test',
      methodKey: 'test_fixture',
      stage: '7.3.2.c.6',
      source: 'unit-test',
      recordedAt: '2026-09-20T06:01:00.000Z',
    },
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
    controlOutcome: 'CONTROL_PASS_BOUNDED',
    riskEvidenceRef: {
      agentId: 'risk',
      authorityClass: 'CONTROL_VETO',
      outcome: 'PASS',
      reasonKey: 'risk_pass',
      runId: UUID_1,
      freshness: 'FRESH',
    },
    portfolioEvidenceRef: {
      agentId: 'portfolio',
      authorityClass: 'CONTROL_SIZING',
      outcome: 'AVAILABLE',
      reasonKey: 'portfolio_available',
      runId: UUID_2,
      freshness: 'FRESH',
    },
    liquidityEvidenceRef: {
      agentId: 'liquidity',
      authorityClass: 'EXECUTION_FEASIBILITY',
      outcome: 'FEASIBLE',
      reasonKey: 'liquidity_feasible',
      runId: UUID_3,
      freshness: 'FRESH',
    },
    runtimeGate: {
      outcome: 'CLEAR',
      authorityClass: 'titangold_runtime_safety_ssot',
      capabilityState: 'granted',
    },
    now: '2026-09-20T06:10:00.000Z',
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
    const base = fixture();
    const merged = { ...base, ...patch };
    if (patch.riskEvidenceRef) merged.riskEvidenceRef = { ...base.riskEvidenceRef, ...patch.riskEvidenceRef };
    if (patch.portfolioEvidenceRef) merged.portfolioEvidenceRef = { ...base.portfolioEvidenceRef, ...patch.portfolioEvidenceRef };
    if (patch.liquidityEvidenceRef) merged.liquidityEvidenceRef = { ...base.liquidityEvidenceRef, ...patch.liquidityEvidenceRef };
    if (patch.runtimeGate) merged.runtimeGate = { ...base.runtimeGate, ...patch.runtimeGate };
    const result = validateExecutionIntent(merged);
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
    expect(result.ok).toBe(false);
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
});
