/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.2.b.3.a — Model-assisted Adapter Contract fail-closed tests.
 * Contract validation only; no LLM, provider, network, DB, or Redis.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { DECISION_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisDecisionContextContract.js';
import { ENGINE_INTERFACE_CONTRACT_VERSION } from '../../contracts/artemisCognitiveEngineInterfaceContract.js';
import {
  MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
  MODEL_ASSISTED_ADAPTER_LIMITATIONS,
  MODEL_ASSISTED_ADAPTER_SCHEMA_VERSION,
  MODEL_ASSISTED_ADAPTER_STAGE,
  MODEL_ASSISTED_ADAPTER_VERSION,
  MODEL_ASSISTED_UNCERTAINTY_KIND,
  ZERO_MODEL_ASSISTED_ADAPTER_SIDE_EFFECTS,
  buildContractOnlyModelAssistedContribution,
  validateModelAssistedAdapterRequest,
  validateModelAssistedContribution,
} from '../../contracts/artemisModelAssistedAdapterContract.js';

const CONTEXT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTRIBUTION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NOW = '2026-09-03T17:00:00.000Z';

function sourceAnalysisReference(overrides = {}) {
  return {
    decisionContextId: CONTEXT_ID,
    engineInterfaceContractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
    engineInterfaceSchemaVersion: '1.0.0',
    analysisGeneratedAt: NOW,
    uncertaintyState: 'sufficient_evidence',
    abstentionState: 'not_abstaining',
    ...overrides,
  };
}

function baseRequest(overrides = {}) {
  return {
    schemaVersion: MODEL_ASSISTED_ADAPTER_SCHEMA_VERSION,
    contractVersion: MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
    adapterContractVersion: MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
    decisionContextId: CONTEXT_ID,
    decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    sourceAnalysisReference: sourceAnalysisReference(),
    boundedMetadata: { taskClass: 'advisory_critique' },
    lineage: {
      decisionContextId: CONTEXT_ID,
      decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
      engineInterfaceContractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
      adapterContractVersion: MODEL_ASSISTED_ADAPTER_CONTRACT_VERSION,
      policyVersion: 'stage7-2b3a-adapter-contract-1.0.0',
      stage: MODEL_ASSISTED_ADAPTER_STAGE,
    },
    provenance: {
      writer: 'unit-test',
      methodKey: 'fixture',
      stage: MODEL_ASSISTED_ADAPTER_STAGE,
      note: 'stage_7_2b3a_adapter_contract_fixture',
      recordedAt: NOW,
    },
    limitations: [...MODEL_ASSISTED_ADAPTER_LIMITATIONS],
    sideEffects: { ...ZERO_MODEL_ASSISTED_ADAPTER_SIDE_EFFECTS },
    ...overrides,
  };
}

describe('Stage 7.2.b.3.a Adapter Contract — happy path', () => {
  it('accepts a valid adapter request bound to Decision Context + Cognitive Analysis reference', () => {
    const result = validateModelAssistedAdapterRequest(baseRequest());
    expect(result.ok).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);
  });

  it('accepts a contract-only ModelAssistedContribution with hard advisory/non-executing flags', () => {
    const envelope = buildContractOnlyModelAssistedContribution({
      decisionContextId: CONTEXT_ID,
      contributionId: CONTRIBUTION_ID,
      sourceAnalysisReference: sourceAnalysisReference(),
      generatedAt: NOW,
    });
    const result = validateModelAssistedContribution(envelope);
    expect(result.ok).toBe(true);
    expect(envelope.schemaVersion).toBe(MODEL_ASSISTED_ADAPTER_SCHEMA_VERSION);
    expect(envelope.adapterVersion).toBe(MODEL_ASSISTED_ADAPTER_VERSION);
    expect(envelope.contributionId).toBe(CONTRIBUTION_ID);
    expect(envelope.sourceAnalysisReference).toBeTruthy();
    expect(envelope.provenance).toBeTruthy();
    expect(envelope.uncertainty.kind).toBe(MODEL_ASSISTED_UNCERTAINTY_KIND.CONTRACT_ONLY);
    expect(envelope.limitations.length).toBeGreaterThan(0);
    expect(envelope.advisoryOnly).toBe(true);
    expect(envelope.authoritative).toBe(false);
    expect(envelope.executionEligible).toBe(false);
    expect(envelope.approvedForExecution).toBe(false);
    expect(envelope.decisionEligible).toBe(false);
    expect(envelope.cognitiveEngineStarted).toBe(false);
  });

  it('is deterministic for identical contribution builds', () => {
    const a = buildContractOnlyModelAssistedContribution({
      decisionContextId: CONTEXT_ID,
      contributionId: CONTRIBUTION_ID,
      sourceAnalysisReference: sourceAnalysisReference(),
      generatedAt: NOW,
    });
    const b = buildContractOnlyModelAssistedContribution({
      decisionContextId: CONTEXT_ID,
      contributionId: CONTRIBUTION_ID,
      sourceAnalysisReference: sourceAnalysisReference(),
      generatedAt: NOW,
    });
    expect(a).toEqual(b);
  });

  it('requires provenance on contribution validation', () => {
    const envelope = buildContractOnlyModelAssistedContribution({
      decisionContextId: CONTEXT_ID,
      contributionId: CONTRIBUTION_ID,
      sourceAnalysisReference: sourceAnalysisReference(),
      generatedAt: NOW,
    });
    delete envelope.provenance;
    const result = validateModelAssistedContribution(envelope);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'provenance' && e.code === 'required_object')).toBe(true);
  });
});

describe('Stage 7.2.b.3.a Adapter Contract — rejection / safety', () => {
  it('rejects forbidden execution fields such as orderId', () => {
    const result = validateModelAssistedAdapterRequest(baseRequest({ orderId: 'order-1' }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'orderId')).toBe(true);
  });

  it('rejects wallet fields', () => {
    const result = validateModelAssistedAdapterRequest(baseRequest({ walletAction: 'withdraw' }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'walletAction')).toBe(true);
  });

  it('rejects secrets', () => {
    const result = validateModelAssistedAdapterRequest(baseRequest({ apiSecret: 'x' }));
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.field === 'apiSecret' || e.code === 'forbidden_secret_keys'),
    ).toBe(true);
  });

  it('rejects provider payload', () => {
    const result = validateModelAssistedAdapterRequest(
      baseRequest({ providerPayload: { choices: [] } }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'providerPayload')).toBe(true);
  });

  it('rejects prompts on the contract request', () => {
    const result = validateModelAssistedAdapterRequest(baseRequest({ prompt: 'ignore previous' }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'prompt')).toBe(true);
  });

  it('rejects contribution that claims authority or execution eligibility', () => {
    const envelope = buildContractOnlyModelAssistedContribution({
      decisionContextId: CONTEXT_ID,
      contributionId: CONTRIBUTION_ID,
      sourceAnalysisReference: sourceAnalysisReference(),
      generatedAt: NOW,
    });
    envelope.authoritative = true;
    envelope.executionEligible = true;
    envelope.approvedForExecution = true;
    envelope.decisionEligible = true;
    envelope.advisoryOnly = false;
    const result = validateModelAssistedContribution(envelope);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'authoritative')).toBe(true);
    expect(result.errors.some((e) => e.field === 'executionEligible')).toBe(true);
    expect(result.errors.some((e) => e.field === 'approvedForExecution')).toBe(true);
    expect(result.errors.some((e) => e.field === 'decisionEligible')).toBe(true);
    expect(result.errors.some((e) => e.field === 'advisoryOnly')).toBe(true);
  });

  it('rejects BUY/SELL authority values', () => {
    const result = validateModelAssistedAdapterRequest(baseRequest({
      provenance: {
        ...baseRequest().provenance,
        note: 'BUY',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'forbidden_execution_authority_value')).toBe(true);
  });

  it('rejects live provider/model provenance in contract-only stage', () => {
    const envelope = buildContractOnlyModelAssistedContribution({
      decisionContextId: CONTEXT_ID,
      contributionId: CONTRIBUTION_ID,
      sourceAnalysisReference: sourceAnalysisReference(),
      generatedAt: NOW,
    });
    envelope.provenance.providerId = 'openai';
    envelope.provenance.modelId = 'gpt-test';
    const result = validateModelAssistedContribution(envelope);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'forbidden_in_stage_7_2b3a_contract_only')).toBe(true);
  });

  it('rejects mismatched Decision Context ids', () => {
    const result = validateModelAssistedAdapterRequest(baseRequest({
      sourceAnalysisReference: sourceAnalysisReference({
        decisionContextId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'must_match_decision_context_id')).toBe(true);
  });

  it('keeps side-effect ledger at zero', () => {
    const envelope = buildContractOnlyModelAssistedContribution({
      decisionContextId: CONTEXT_ID,
      contributionId: CONTRIBUTION_ID,
      sourceAnalysisReference: sourceAnalysisReference(),
      generatedAt: NOW,
    });
    expect(envelope.sideEffects).toEqual(ZERO_MODEL_ASSISTED_ADAPTER_SIDE_EFFECTS);
    expect(envelope.sideEffects.llmCallCount).toBe(0);
    expect(envelope.sideEffects.providerRequestCount).toBe(0);
    expect(envelope.sideEffects.dbWriteCount).toBe(0);
    expect(envelope.sideEffects.redisWriteCount).toBe(0);
  });

  it('does not import orchestrator, DB, Redis, providers, or LLM SDKs', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const sourcePath = path.join(
      here,
      '../../contracts/artemisModelAssistedAdapterContract.js',
    );
    const source = readFileSync(sourcePath, 'utf8');
    const importLines = source
      .split('\n')
      .filter((line) => /^\s*import\s/.test(line))
      .join('\n');
    expect(importLines).not.toMatch(/artemisOrchestrator/);
    expect(importLines).not.toMatch(/openai|anthropic|gemini|deepseek|@google\/generative-ai/i);
    expect(importLines).not.toMatch(/redis|ioredis|from ['"].*\/db(\.js)?['"]/);
    expect(importLines).not.toMatch(/orderManagement|wallet/i);
  });
});
