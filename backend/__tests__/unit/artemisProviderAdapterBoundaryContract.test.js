/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.2.b.3.c.3 — Provider Adapter Boundary fail-closed tests.
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
  MODEL_INVOCATION_STATUS,
  buildContractOnlyModelInvocationRequest,
} from '../../contracts/artemisModelInvocationContract.js';
import {
  planContractOnlyGatewayInvocation,
} from '../../contracts/artemisModelInvocationGatewayContract.js';
import {
  PROVIDER_ADAPTER_BOUNDARY_CONTRACT_VERSION,
  PROVIDER_ADAPTER_BOUNDARY_POLICY_VERSION,
  PROVIDER_ADAPTER_BOUNDARY_SCHEMA_VERSION,
  PROVIDER_ADAPTER_BOUNDARY_STAGE,
  PROVIDER_ADAPTER_VERSION,
  PROVIDER_CAPABILITY,
  PROVIDER_FALLBACK_STATUS,
  ZERO_PROVIDER_ADAPTER_SIDE_EFFECTS,
  buildContractOnlyProviderAdapterResponse,
  mapContractOnlyProviderAdapterRequest,
  normalizeProviderAdapterFailure,
  validateProviderAdapterBoundaryInput,
  validateProviderAdapterRequest,
  validateProviderAdapterResponse,
  validateProviderCapability,
} from '../../contracts/artemisProviderAdapterBoundaryContract.js';

const CONTEXT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const INVOCATION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const GATEWAY_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ADAPTER_REQUEST_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const NOW = '2026-09-04T01:00:00.000Z';

function analysisReference() {
  return {
    decisionContextId: CONTEXT_ID,
    engineInterfaceContractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
    uncertaintyState: ENGINE_UNCERTAINTY_STATE.SUFFICIENT_EVIDENCE,
    abstentionState: ENGINE_ABSTENTION_STATE.NOT_ABSTAINING,
    analysisGeneratedAt: NOW,
  };
}

function validGatewayPlan() {
  const planned = planContractOnlyGatewayInvocation({
    gatewayId: GATEWAY_ID,
    invocationRequest: buildContractOnlyModelInvocationRequest({
      invocationId: INVOCATION_ID,
      decisionContextId: CONTEXT_ID,
      cognitiveAnalysisReference: analysisReference(),
      generatedAt: NOW,
    }),
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
  });
  expect(planned.ok).toBe(true);
  return planned.plan;
}

function validAdapterInput(overrides = {}) {
  return {
    adapterRequestId: ADAPTER_REQUEST_ID,
    gatewayPlan: validGatewayPlan(),
    generatedAt: NOW,
    ...overrides,
  };
}

describe('Stage 7.2.b.3.c.3 Provider Adapter Boundary — happy path', () => {
  it('maps gateway plan to unavailable boundary response with hard non-executing flags', () => {
    const mapped = mapContractOnlyProviderAdapterRequest(validAdapterInput());
    expect(mapped.ok).toBe(true);
    expect(mapped.code).toBe('PROVIDER_ADAPTER_MAPPED_UNAVAILABLE');
    expect(mapped.request.schemaVersion).toBe(PROVIDER_ADAPTER_BOUNDARY_SCHEMA_VERSION);
    expect(mapped.request.contractVersion).toBe(PROVIDER_ADAPTER_BOUNDARY_CONTRACT_VERSION);
    expect(mapped.request.policyVersion).toBe(PROVIDER_ADAPTER_BOUNDARY_POLICY_VERSION);
    expect(mapped.request.transportArmed).toBe(false);
    expect(mapped.request.providerConnected).toBe(false);
    expect(mapped.request.advisoryOnly).toBe(true);
    expect(mapped.request.authoritative).toBe(false);
    expect(mapped.request.decisionEligible).toBe(false);
    expect(mapped.request.executionEligible).toBe(false);
    expect(mapped.request.approvedForExecution).toBe(false);
    expect(mapped.request.capability).toMatchObject(PROVIDER_CAPABILITY);
    expect(mapped.request.provenance.providerFamily).toBe('none');
    expect(mapped.request.provenance.providerVersion).toBeNull();
    expect(mapped.request.provenance.adapterVersion).toBe(PROVIDER_ADAPTER_VERSION);
    expect(mapped.request.provenance.latencyMs).toBe(0);
    expect(mapped.request.provenance.fallbackStatus).toBe(PROVIDER_FALLBACK_STATUS.NOT_APPLICABLE);
    expect(mapped.request.sideEffects).toEqual(ZERO_PROVIDER_ADAPTER_SIDE_EFFECTS);

    expect(validateProviderAdapterRequest(mapped.request).ok).toBe(true);
    expect(validateProviderAdapterResponse(mapped.response).ok).toBe(true);
    expect(mapped.response.normalizedStatus).toBe(MODEL_INVOCATION_STATUS.UNAVAILABLE);
    expect(mapped.response.advisoryOnly).toBe(true);
    expect(mapped.response.authoritative).toBe(false);
    expect(mapped.response.executionEligible).toBe(false);
    expect(mapped.response.approvedForExecution).toBe(false);
    expect(mapped.response.decisionEligible).toBe(false);
    expect(mapped.response.sideEffects.llmCallCount).toBe(0);
    expect(mapped.response.sideEffects.networkRequestCount).toBe(0);
  });

  it('is deterministic for identical inputs', () => {
    const input = validAdapterInput();
    const a = mapContractOnlyProviderAdapterRequest(input);
    const b = mapContractOnlyProviderAdapterRequest(input);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.request).toEqual(b.request);
    expect(a.response.normalizedStatus).toBe(b.response.normalizedStatus);
    expect(a.response.failureCode).toBe(b.response.failureCode);
  });

  it('normalizes provider unavailable failures without claiming success', () => {
    const normalized = normalizeProviderAdapterFailure({
      code: 'provider_unavailable',
      message: 'provider down',
    });
    expect(normalized.normalizedStatus).toBe(MODEL_INVOCATION_STATUS.UNAVAILABLE);
    expect(normalized.advisoryOnly).toBe(true);
    expect(normalized.executionEligible).toBe(false);
    expect(normalized.approvedForExecution).toBe(false);
  });
});

describe('Stage 7.2.b.3.c.3 Provider Adapter Boundary — fail-closed', () => {
  it('rejects invalid provider adapter requests', () => {
    const bad = validateProviderAdapterBoundaryInput({
      adapterRequestId: 'not-a-uuid',
      gatewayPlan: { not: 'a plan' },
    });
    expect(bad.ok).toBe(false);
    expect(bad.code).toBe('invalid_adapter_input');
  });

  it('rejects authority escalation on response', () => {
    const base = buildContractOnlyProviderAdapterResponse({
      adapterRequestId: ADAPTER_REQUEST_ID,
      gatewayId: GATEWAY_ID,
      invocationId: INVOCATION_ID,
      decisionContextId: CONTEXT_ID,
      generatedAt: NOW,
    });
    const escalated = {
      ...base,
      authoritative: true,
      decisionEligible: true,
      executionEligible: true,
      approvedForExecution: true,
    };
    const check = validateProviderAdapterResponse(escalated);
    expect(check.ok).toBe(false);
    const fields = (check.errors || []).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining([
      'authoritative',
      'decisionEligible',
      'executionEligible',
      'approvedForExecution',
    ]));
  });

  it('rejects secret / credential fields', () => {
    const mapped = mapContractOnlyProviderAdapterRequest(validAdapterInput({
      apiKey: 'sk-test',
    }));
    expect(mapped.ok).toBe(false);
    expect(JSON.stringify(mapped.errors)).toMatch(/forbidden_secret|forbidden_key|apiKey/i);

    const withSecretInPlanWrapper = validateProviderAdapterBoundaryInput({
      adapterRequestId: ADAPTER_REQUEST_ID,
      gatewayPlan: validGatewayPlan(),
      credentials: { token: 'x' },
      generatedAt: NOW,
    });
    expect(withSecretInPlanWrapper.ok).toBe(false);
  });

  it('rejects capability that claims connected/network', () => {
    const bad = validateProviderCapability({
      ...PROVIDER_CAPABILITY,
      connected: true,
      networkEnabled: true,
    });
    expect(bad.ok).toBe(false);
  });

  it('rejects real providerFamily / providerVersion provenance values', () => {
    const mapped = mapContractOnlyProviderAdapterRequest(validAdapterInput());
    expect(mapped.ok).toBe(true);
    const request = {
      ...mapped.request,
      provenance: {
        ...mapped.request.provenance,
        providerFamily: 'openai',
        providerVersion: 'gpt-4o',
      },
    };
    const check = validateProviderAdapterRequest(request);
    expect(check.ok).toBe(false);
    const fields = (check.errors || []).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining([
      'provenance.providerFamily',
      'provenance.providerVersion',
    ]));
  });

  it('handles provider unavailable as normalized non-executing response', () => {
    const response = buildContractOnlyProviderAdapterResponse({
      adapterRequestId: ADAPTER_REQUEST_ID,
      gatewayId: GATEWAY_ID,
      invocationId: INVOCATION_ID,
      decisionContextId: CONTEXT_ID,
      normalizedStatus: MODEL_INVOCATION_STATUS.UNAVAILABLE,
      failureCode: 'provider_unavailable',
      failureMessage: 'no transport',
      generatedAt: NOW,
    });
    expect(validateProviderAdapterResponse(response).ok).toBe(true);
    expect(response.providerConnected).toBe(false);
    expect(response.transportArmed).toBe(false);
    expect(response.invocationResponse.status).toBe(MODEL_INVOCATION_STATUS.UNAVAILABLE);
  });
});

describe('Stage 7.2.b.3.c.3 Provider Adapter Boundary — zero side effects', () => {
  it('source declares no provider SDK / HTTP / network clients', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      path.join(here, '../../contracts/artemisProviderAdapterBoundaryContract.js'),
      'utf8',
    );
    expect(src).not.toMatch(/from ['"]openai['"]|from ['"]@anthropic|from ['"]@google\/generative/);
    expect(src).not.toMatch(/\bfetch\s*\(|\baxios\b|createHttpClient|process\.env\./);
    expect(src).not.toMatch(/require\(['"]https?['"]\)|import\s+.*\s+from\s+['"]node:https?['"]/);
    expect(src).toContain(PROVIDER_ADAPTER_BOUNDARY_STAGE);
    expect(src).toContain('UNTRUSTED EXTERNAL CAPABILITY');
  });

  it('side-effect ledger remains zero after mapping', () => {
    const mapped = mapContractOnlyProviderAdapterRequest(validAdapterInput());
    expect(mapped.request.sideEffects).toEqual(ZERO_PROVIDER_ADAPTER_SIDE_EFFECTS);
    expect(mapped.response.sideEffects).toEqual(ZERO_PROVIDER_ADAPTER_SIDE_EFFECTS);
    expect(mapped.response.sideEffects.llmCallCount).toBe(0);
    expect(mapped.response.sideEffects.networkRequestCount).toBe(0);
  });
});
