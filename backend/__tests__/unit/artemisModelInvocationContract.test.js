/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.2.b.3.c.1 — Model Invocation Contract fail-closed tests.
 * Contract foundation only; no LLM, provider SDK, network, credentials, DB, Redis.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { ORCHESTRATION_CONTRACT_VERSION } from '../../contracts/artemisEvidenceOrchestrationContract.js';
import {
  ENGINE_ABSTENTION_STATE,
  ENGINE_INTERFACE_CONTRACT_VERSION,
  ENGINE_UNCERTAINTY_STATE,
  buildInterfaceOnlyCognitiveAnalysisResult,
} from '../../contracts/artemisCognitiveEngineInterfaceContract.js';
import {
  MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
  MODEL_ASSISTED_ADAPTER_VERSION,
} from '../../contracts/artemisModelAssistedAdapterContract.js';
import {
  PROMPT_DATA_BOUNDARY_CONTRACT_VERSION,
  PROMPT_DATA_BOUNDARY_VERSION,
  buildBoundedModelInputArtifact,
} from '../../contracts/artemisModelAssistedPromptDataBoundaryContract.js';
import {
  MODEL_INVOCATION_CONTRACT_VERSION,
  MODEL_INVOCATION_LIMITATIONS,
  MODEL_INVOCATION_POLICY_VERSION,
  MODEL_INVOCATION_SCHEMA_VERSION,
  MODEL_INVOCATION_STAGE,
  MODEL_INVOCATION_STATUS,
  ZERO_MODEL_INVOCATION_SIDE_EFFECTS,
  buildContractOnlyModelInvocationRequest,
  buildContractOnlyModelInvocationResponse,
  validateModelInvocationRequest,
  validateModelInvocationResponse,
} from '../../contracts/artemisModelInvocationContract.js';

const CONTEXT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORCH_SET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const INVOCATION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NOW = '2026-09-03T19:00:00.000Z';

function decisionContext(overrides = {}) {
  return {
    contextId: CONTEXT_ID,
    taskDomain: 'market_analysis',
    requestedOutcome: 'advisory_assessment',
    provider: 'mexc',
    marketType: 'spot',
    symbol: 'BTC/USDT',
    timeframe: '1h',
    analysisHorizon: 'intraday',
    decisionMaturityMode: 'advisory',
    lifecycleState: 'active',
    ...overrides,
  };
}

function cognitiveAnalysis(overrides = {}) {
  return buildInterfaceOnlyCognitiveAnalysisResult({
    decisionContextId: CONTEXT_ID,
    orchestrationSetReferences: [
      {
        orchestrationSetId: ORCH_SET_ID,
        orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
      },
    ],
    uncertaintyState: ENGINE_UNCERTAINTY_STATE.SUFFICIENT_EVIDENCE,
    abstentionState: ENGINE_ABSTENTION_STATE.NOT_ABSTAINING,
    generatedAt: NOW,
    ...overrides,
  });
}

function analysisReference(overrides = {}) {
  return {
    decisionContextId: CONTEXT_ID,
    engineInterfaceContractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
    uncertaintyState: ENGINE_UNCERTAINTY_STATE.SUFFICIENT_EVIDENCE,
    abstentionState: ENGINE_ABSTENTION_STATE.NOT_ABSTAINING,
    analysisGeneratedAt: NOW,
    ...overrides,
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

describe('Stage 7.2.b.3.c.1 Model Invocation Contract — happy path', () => {
  it('builds and validates a contract-only request with budget/timeout/provenance', () => {
    const request = validRequest();
    expect(request.schemaVersion).toBe(MODEL_INVOCATION_SCHEMA_VERSION);
    expect(request.contractVersion).toBe(MODEL_INVOCATION_CONTRACT_VERSION);
    expect(request.adapterVersion).toBe(MODEL_ASSISTED_ADAPTER_VERSION);
    expect(request.adapterContractVersion).toBe(MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION);
    expect(request.boundaryVersion).toBe(PROMPT_DATA_BOUNDARY_VERSION);
    expect(request.boundaryContractVersion).toBe(PROMPT_DATA_BOUNDARY_CONTRACT_VERSION);
    expect(request.policyVersion).toBe(MODEL_INVOCATION_POLICY_VERSION);
    expect(request.inputReference.decisionContextId).toBe(CONTEXT_ID);
    expect(request.budget.maxUtf8Bytes).toBeGreaterThan(0);
    expect(request.timeout.timeoutMs).toBeGreaterThan(0);
    expect(request.provenance.stage).toBe(MODEL_INVOCATION_STAGE);
    expect(request.provenance.providerId).toBeUndefined();
    expect(request.sideEffects).toEqual(ZERO_MODEL_INVOCATION_SIDE_EFFECTS);
    expect(request.limitations).toEqual(expect.arrayContaining(MODEL_INVOCATION_LIMITATIONS.slice(0, 3)));

    const validated = validateModelInvocationRequest(request);
    expect(validated.ok).toBe(true);
    expect(validated.code).toBe('MODEL_INVOCATION_REQUEST_VALID');
  });

  it('accepts an attached BoundedModelInputArtifact that matches context', () => {
    const built = buildBoundedModelInputArtifact({
      decisionContext: decisionContext(),
      cognitiveAnalysisResult: cognitiveAnalysis({
        reasoningSummary: 'Deterministic summary: evidence compatible.',
      }),
      boundedEvidenceMetadata: { correlationFamily: 'ohlcv', freshness: 'fresh' },
      generatedAt: NOW,
    });
    expect(built.ok).toBe(true);

    const request = validRequest({
      boundedModelInputArtifact: built.artifact,
      inputReference: {
        decisionContextId: CONTEXT_ID,
        boundaryGeneratedAt: built.artifact.generatedAt,
        contentHash: 'sha256:contract-test',
      },
    });
    const validated = validateModelInvocationRequest(request);
    expect(validated.ok).toBe(true);
  });

  it('validates advisory responses for each allowed status', () => {
    for (const status of Object.values(MODEL_INVOCATION_STATUS)) {
      const response = buildContractOnlyModelInvocationResponse({
        invocationId: INVOCATION_ID,
        status,
        generatedAt: NOW,
        advisorySummary: status === MODEL_INVOCATION_STATUS.SUCCESS
          ? 'Advisory-only contract placeholder'
          : null,
      });
      expect(response.advisoryOnly).toBe(true);
      expect(response.authoritative).toBe(false);
      expect(response.decisionEligible).toBe(false);
      expect(response.executionEligible).toBe(false);
      expect(response.approvedForExecution).toBe(false);
      expect(response.cognitiveEngineStarted).toBe(false);
      expect(response.sideEffects.llmCallCount).toBe(0);
      expect(response.sideEffects.networkRequestCount).toBe(0);

      const validated = validateModelInvocationResponse(response);
      expect(validated.ok).toBe(true);
      expect(validated.code).toBe('MODEL_INVOCATION_RESPONSE_VALID');
    }
  });
});

describe('Stage 7.2.b.3.c.1 Model Invocation Contract — fail-closed', () => {
  it('rejects secrets and credentials on the request', () => {
    const request = validRequest({
      // injected after build
    });
    request.apiKey = 'sk-test';
    const validated = validateModelInvocationRequest(request);
    expect(validated.ok).toBe(false);
    expect(validated.errors.some((e) => e.code === 'unknown_field' || e.code === 'forbidden_key'
      || e.code === 'forbidden_secret_keys')).toBe(true);
  });

  it('rejects wallet / execution / order fields', () => {
    const request = validRequest();
    request.walletAction = 'withdraw';
    const validated = validateModelInvocationRequest(request);
    expect(validated.ok).toBe(false);
  });

  it('rejects raw provider payloads', () => {
    const request = validRequest();
    request.providerPayload = { choices: [] };
    const validated = validateModelInvocationRequest(request);
    expect(validated.ok).toBe(false);
  });

  it('rejects mismatched adapter / boundary versions', () => {
    const request = validRequest();
    request.adapterVersion = 'wrong';
    const validated = validateModelInvocationRequest(request);
    expect(validated.ok).toBe(false);
    expect(validated.errors.some((e) => e.field === 'adapterVersion')).toBe(true);
  });

  it('rejects live provider provenance on contract-only stage', () => {
    const request = validRequest();
    request.provenance.providerId = 'openai';
    request.provenance.modelId = 'gpt-test';
    const validated = validateModelInvocationRequest(request);
    expect(validated.ok).toBe(false);
    expect(validated.errors.some((e) => e.code === 'forbidden_in_contract_only_stage')).toBe(true);
  });

  it('rejects non-zero LLM / network side effects', () => {
    const request = validRequest();
    request.sideEffects.llmCallCount = 1;
    const validated = validateModelInvocationRequest(request);
    expect(validated.ok).toBe(false);
    expect(validated.errors.some((e) => e.field === 'sideEffects.llmCallCount')).toBe(true);
  });

  it('rejects response that claims authority or execution eligibility', () => {
    const response = buildContractOnlyModelInvocationResponse({
      invocationId: INVOCATION_ID,
      status: MODEL_INVOCATION_STATUS.SUCCESS,
      generatedAt: NOW,
      advisorySummary: 'x',
    });
    response.authoritative = true;
    response.executionEligible = true;
    const validated = validateModelInvocationResponse(response);
    expect(validated.ok).toBe(false);
    expect(validated.errors.some((e) => e.field === 'authoritative')).toBe(true);
    expect(validated.errors.some((e) => e.field === 'executionEligible')).toBe(true);
  });

  it('rejects unknown response status', () => {
    const response = buildContractOnlyModelInvocationResponse({
      invocationId: INVOCATION_ID,
      status: MODEL_INVOCATION_STATUS.UNAVAILABLE,
      generatedAt: NOW,
    });
    response.status = 'streamed';
    const validated = validateModelInvocationResponse(response);
    expect(validated.ok).toBe(false);
    expect(validated.errors.some((e) => e.field === 'status')).toBe(true);
  });

  it('rejects BUY/SELL execution authority strings', () => {
    const response = buildContractOnlyModelInvocationResponse({
      invocationId: INVOCATION_ID,
      status: MODEL_INVOCATION_STATUS.SUCCESS,
      generatedAt: NOW,
      advisorySummary: 'BUY',
    });
    const validated = validateModelInvocationResponse(response);
    expect(validated.ok).toBe(false);
    expect(validated.errors.some((e) => e.code === 'forbidden_execution_authority_value')).toBe(true);
  });

  it('rejects analysis reference context mismatch', () => {
    const request = validRequest({
      cognitiveAnalysisReference: analysisReference({
        decisionContextId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      }),
    });
    const validated = validateModelInvocationRequest(request);
    expect(validated.ok).toBe(false);
    expect(validated.errors.some((e) => e.code === 'must_match_input_reference')).toBe(true);
  });
});

describe('Stage 7.2.b.3.c.1 Model Invocation Contract — source hygiene', () => {
  it('does not import provider SDKs, HTTP clients, or credential modules', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      path.join(here, '../../contracts/artemisModelInvocationContract.js'),
      'utf8',
    );
    expect(source).not.toMatch(/openai|anthropic|@google\/generative-ai|axios|node-fetch|undici|fetch\(/i);
    expect(source).not.toMatch(/createCipheriv|MASTER_KEY|process\.env\./);
    expect(source).toMatch(/no_llm_provider_calls/);
    expect(source).toMatch(/provider_independent_interface_only/);
  });
});
