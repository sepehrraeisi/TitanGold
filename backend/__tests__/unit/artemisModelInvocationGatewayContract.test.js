/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.2.b.3.c.2 — Invocation Gateway foundation fail-closed tests.
 * No LLM, provider SDK, network, credentials, DB, or Redis.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import {
  ENGINE_ABSTENTION_STATE,
  ENGINE_INTERFACE_CONTRACT_VERSION,
  ENGINE_UNCERTAINTY_STATE,
} from '../../contracts/artemisCognitiveEngineInterfaceContract.js';
import {
  buildContractOnlyModelInvocationRequest,
  MODEL_INVOCATION_STATUS,
} from '../../contracts/artemisModelInvocationContract.js';
import {
  INVOCATION_GATEWAY_CONTRACT_VERSION,
  INVOCATION_GATEWAY_LIFECYCLE,
  INVOCATION_GATEWAY_POLICY_VERSION,
  INVOCATION_GATEWAY_SCHEMA_VERSION,
  INVOCATION_GATEWAY_STAGE,
  ZERO_GATEWAY_SIDE_EFFECTS,
  normalizeGatewayFailure,
  planContractOnlyGatewayInvocation,
  validateBudgetPolicy,
  validateGatewayInvocationInput,
  validateGatewayPlan,
  validateGatewayResult,
  validateRetryPolicy,
  validateTimeoutPolicy,
} from '../../contracts/artemisModelInvocationGatewayContract.js';

const CONTEXT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const INVOCATION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const GATEWAY_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const NOW = '2026-09-03T21:00:00.000Z';

function analysisReference() {
  return {
    decisionContextId: CONTEXT_ID,
    engineInterfaceContractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
    uncertaintyState: ENGINE_UNCERTAINTY_STATE.SUFFICIENT_EVIDENCE,
    abstentionState: ENGINE_ABSTENTION_STATE.NOT_ABSTAINING,
    analysisGeneratedAt: NOW,
  };
}

function validRequest(overrides = {}) {
  return buildContractOnlyModelInvocationRequest({
    invocationId: INVOCATION_ID,
    decisionContextId: CONTEXT_ID,
    cognitiveAnalysisReference: analysisReference(),
    generatedAt: NOW,
    ...overrides,
  });
}

function validInput(overrides = {}) {
  return {
    gatewayId: GATEWAY_ID,
    invocationRequest: validRequest(),
    timeoutPolicy: {
      timeoutMs: 15000,
      softTimeoutMs: 10000,
      hardFailOnTimeout: true,
      note: 'test_timeout',
    },
    budgetPolicy: {
      maxUtf8Bytes: 24 * 1024,
      maxTokens: 4096,
      maxCostUnits: 0,
      hardFailOnExhaustion: true,
      note: 'test_budget',
    },
    retryPolicy: {
      maxAttempts: 0,
      backoffMs: 0,
      retryOnTimeout: false,
      retryOnUnavailable: false,
      retryOnInvalidSchema: false,
      note: 'test_retry',
    },
    generatedAt: NOW,
    ...overrides,
  };
}

describe('Stage 7.2.b.3.c.2 Invocation Gateway — happy path', () => {
  it('plans a deferred gateway invocation with hard non-executing flags', () => {
    const planned = planContractOnlyGatewayInvocation(validInput());
    expect(planned.ok).toBe(true);
    expect(planned.code).toBe('GATEWAY_PLAN_DEFERRED_NO_TRANSPORT');
    expect(planned.plan.schemaVersion).toBe(INVOCATION_GATEWAY_SCHEMA_VERSION);
    expect(planned.plan.contractVersion).toBe(INVOCATION_GATEWAY_CONTRACT_VERSION);
    expect(planned.plan.policyVersion).toBe(INVOCATION_GATEWAY_POLICY_VERSION);
    expect(planned.plan.lifecycleState).toBe(INVOCATION_GATEWAY_LIFECYCLE.DEFERRED_NO_TRANSPORT);
    expect(planned.plan.transportArmed).toBe(false);
    expect(planned.plan.providerSelected).toBe(false);
    expect(planned.plan.advisoryOnly).toBe(true);
    expect(planned.plan.authoritative).toBe(false);
    expect(planned.plan.decisionEligible).toBe(false);
    expect(planned.plan.executionEligible).toBe(false);
    expect(planned.plan.approvedForExecution).toBe(false);
    expect(planned.plan.sideEffects).toEqual(ZERO_GATEWAY_SIDE_EFFECTS);
    expect(planned.plan.provenance.stage).toBe(INVOCATION_GATEWAY_STAGE);
    expect(planned.plan.provenance.providerFamily).toBe('none');
    expect(planned.plan.provenance.transportMode).toBe('none');

    expect(validateGatewayPlan(planned.plan).ok).toBe(true);
    expect(validateGatewayResult(planned.result).ok).toBe(true);
    expect(planned.result.normalizedStatus).toBe(MODEL_INVOCATION_STATUS.UNAVAILABLE);
    expect(planned.result.invocationResponse.advisoryOnly).toBe(true);
    expect(planned.result.invocationResponse.llmCallCount).toBeUndefined();
    expect(planned.result.sideEffects.llmCallCount).toBe(0);
    expect(planned.result.sideEffects.networkRequestCount).toBe(0);
  });

  it('is deterministic for identical inputs', () => {
    const input = validInput();
    const a = planContractOnlyGatewayInvocation(input);
    const b = planContractOnlyGatewayInvocation(input);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.plan).toEqual(b.plan);
    expect(a.result.lifecycleState).toBe(b.result.lifecycleState);
    expect(a.result.normalizedStatus).toBe(b.result.normalizedStatus);
    expect(a.result.failureCode).toBe(b.result.failureCode);
  });
});

describe('Stage 7.2.b.3.c.2 Invocation Gateway — policy validation', () => {
  it('validates timeout policy and rejects invalid values', () => {
    expect(validateTimeoutPolicy({
      timeoutMs: 1000,
      softTimeoutMs: 500,
      hardFailOnTimeout: true,
    }).ok).toBe(true);

    const bad = validateTimeoutPolicy({
      timeoutMs: 0,
      softTimeoutMs: 5000,
      hardFailOnTimeout: true,
    });
    expect(bad.ok).toBe(false);
  });

  it('validates budget policy and rejects oversize limits', () => {
    expect(validateBudgetPolicy({
      maxUtf8Bytes: 1024,
      maxTokens: 100,
      maxCostUnits: 0,
      hardFailOnExhaustion: true,
    }).ok).toBe(true);

    const bad = validateBudgetPolicy({
      maxUtf8Bytes: 999999999,
      maxTokens: 100,
      maxCostUnits: 0,
      hardFailOnExhaustion: true,
    });
    expect(bad.ok).toBe(false);
  });

  it('validates retry policy and forbids transport retries in foundation', () => {
    expect(validateRetryPolicy({
      maxAttempts: 0,
      backoffMs: 0,
      retryOnTimeout: false,
      retryOnUnavailable: false,
      retryOnInvalidSchema: false,
    }).ok).toBe(true);

    const bad = validateRetryPolicy({
      maxAttempts: 1,
      backoffMs: 100,
      retryOnTimeout: true,
      retryOnUnavailable: false,
      retryOnInvalidSchema: false,
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors.some((e) => e.code === 'transport_retry_forbidden_in_foundation')).toBe(true);
  });
});

describe('Stage 7.2.b.3.c.2 Invocation Gateway — fail-closed', () => {
  it('rejects invalid invocation requests', () => {
    const input = validInput();
    input.invocationRequest.invocationId = 'not-a-uuid';
    const validated = validateGatewayInvocationInput(input);
    expect(validated.ok).toBe(false);

    const planned = planContractOnlyGatewayInvocation(input);
    expect(planned.ok).toBe(false);
    expect(planned.result.lifecycleState).toBe(INVOCATION_GATEWAY_LIFECYCLE.FAILED_INVALID);
  });

  it('rejects secrets / credentials', () => {
    const input = validInput();
    input.apiKey = 'sk-test';
    const validated = validateGatewayInvocationInput(input);
    expect(validated.ok).toBe(false);
  });

  it('rejects wallet / execution / order fields', () => {
    const input = validInput();
    input.walletAction = 'withdraw';
    expect(validateGatewayInvocationInput(input).ok).toBe(false);
  });

  it('rejects raw provider payloads', () => {
    const input = validInput();
    input.providerPayload = { choices: [] };
    expect(validateGatewayInvocationInput(input).ok).toBe(false);
  });

  it('rejects budget exhaustion against request size', () => {
    const planned = planContractOnlyGatewayInvocation(validInput({
      budgetPolicy: {
        maxUtf8Bytes: 64,
        maxTokens: 10,
        maxCostUnits: 0,
        hardFailOnExhaustion: true,
        note: 'tiny',
      },
    }));
    expect(planned.ok).toBe(false);
    expect(planned.code).toBe('GATEWAY_BUDGET_EXHAUSTED');
    expect(planned.result.lifecycleState).toBe(
      INVOCATION_GATEWAY_LIFECYCLE.BUDGET_EXHAUSTED_POLICY,
    );
    expect(planned.result.sideEffects.llmCallCount).toBe(0);
  });

  it('normalizes failures without claiming authority', () => {
    const normalized = normalizeGatewayFailure({
      code: 'timed_out_policy',
      message: 'policy timeout',
    });
    expect(normalized.normalizedStatus).toBe(MODEL_INVOCATION_STATUS.TIMEOUT);
    expect(normalized.advisoryOnly).toBe(true);
    expect(normalized.authoritative).toBe(false);
    expect(normalized.executionEligible).toBe(false);
    expect(normalized.approvedForExecution).toBe(false);
    expect(normalized.decisionEligible).toBe(false);
  });
});

describe('Stage 7.2.b.3.c.2 Invocation Gateway — source hygiene', () => {
  it('does not import provider SDKs, HTTP clients, or credential modules', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      path.join(here, '../../contracts/artemisModelInvocationGatewayContract.js'),
      'utf8',
    );
    expect(source).not.toMatch(/openai|anthropic|@google\/generative-ai|axios|node-fetch|undici|fetch\(/i);
    expect(source).not.toMatch(/createCipheriv|MASTER_KEY|process\.env\./);
    expect(source).not.toMatch(/artemisOrchestrator|ioredis|from 'pg'|express/);
    expect(source).toMatch(/no_llm_provider_calls/);
    expect(source).toMatch(/transport_deferred/);
  });
});
