/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.2.b.1 — Cognitive Engine Interface fail-closed tests.
 * Interface validation only; no reasoning engine, DB, Redis, or providers.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { DECISION_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisDecisionContextContract.js';
import { KERNEL_CONTRACT_VERSION } from '../../contracts/artemisCognitiveKernelContract.js';
import { ORCHESTRATION_CONTRACT_VERSION } from '../../contracts/artemisEvidenceOrchestrationContract.js';
import {
  ENGINE_ABSTENTION_STATE,
  ENGINE_INTERFACE_CONTRACT_VERSION,
  ENGINE_INTERFACE_LIMITATIONS,
  ENGINE_INTERFACE_SCHEMA_VERSION,
  ENGINE_UNCERTAINTY_STATE,
  ZERO_ENGINE_INTERFACE_SIDE_EFFECTS,
  buildInterfaceOnlyCognitiveAnalysisResult,
  validateCognitiveAnalysisResult,
  validateCognitiveEngineInterfaceRequest,
} from '../../contracts/artemisCognitiveEngineInterfaceContract.js';

const CONTEXT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORCH_SET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW = '2026-09-03T09:00:00.000Z';

function baseRequest(overrides = {}) {
  return {
    schemaVersion: ENGINE_INTERFACE_SCHEMA_VERSION,
    contractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
    engineInterfaceContractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
    decisionContextId: CONTEXT_ID,
    decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    kernelContractVersion: KERNEL_CONTRACT_VERSION,
    orchestrationSetReferences: [
      {
        orchestrationSetId: ORCH_SET_ID,
        orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
      },
    ],
    lineage: {
      decisionContextId: CONTEXT_ID,
      decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
      orchestrationSetIds: [ORCH_SET_ID],
      orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
      kernelContractVersion: KERNEL_CONTRACT_VERSION,
      engineInterfaceContractVersion: ENGINE_INTERFACE_CONTRACT_VERSION,
      policyVersion: 'stage7-2b1-engine-interface-1.0.0',
      stage: '7.2.b.1',
    },
    provenance: {
      writer: 'unit-test',
      methodKey: 'fixture',
      stage: '7.2.b.1',
      note: 'stage_7_2b1_engine_interface_fixture',
      recordedAt: NOW,
    },
    limitations: [...ENGINE_INTERFACE_LIMITATIONS],
    sideEffects: { ...ZERO_ENGINE_INTERFACE_SIDE_EFFECTS },
    ...overrides,
  };
}

describe('Stage 7.2.b.1 Engine Interface — happy path', () => {
  it('accepts a valid request bound to Context 7.1 + Kernel 7.2.a + OrchestrationSet 6', () => {
    const result = validateCognitiveEngineInterfaceRequest(baseRequest());
    expect(result.ok).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);
  });

  it('accepts an interface-only Cognitive Analysis Result with hard-false execution flags', () => {
    const envelope = buildInterfaceOnlyCognitiveAnalysisResult({
      decisionContextId: CONTEXT_ID,
      orchestrationSetReferences: [
        {
          orchestrationSetId: ORCH_SET_ID,
          orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        },
      ],
      generatedAt: NOW,
    });
    const result = validateCognitiveAnalysisResult(envelope);
    expect(result.ok).toBe(true);
    expect(envelope.contractVersion).toBe(ENGINE_INTERFACE_CONTRACT_VERSION);
    expect(envelope.uncertaintyState).toBe(ENGINE_UNCERTAINTY_STATE.NOT_EVALUATED);
    expect(envelope.abstentionState).toBe(ENGINE_ABSTENTION_STATE.CONTRACT_ONLY);
    expect(envelope.executionEligible).toBe(false);
    expect(envelope.approvedForExecution).toBe(false);
    expect(envelope.decisionEligible).toBe(false);
    expect(envelope.cognitiveEngineStarted).toBe(false);
    expect(envelope.analyticalConclusion).toBeNull();
  });

  it('is deterministic for identical result builds', () => {
    const a = buildInterfaceOnlyCognitiveAnalysisResult({
      decisionContextId: CONTEXT_ID,
      orchestrationSetReferences: [
        {
          orchestrationSetId: ORCH_SET_ID,
          orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        },
      ],
      generatedAt: NOW,
    });
    const b = buildInterfaceOnlyCognitiveAnalysisResult({
      decisionContextId: CONTEXT_ID,
      orchestrationSetReferences: [
        {
          orchestrationSetId: ORCH_SET_ID,
          orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        },
      ],
      generatedAt: NOW,
    });
    expect(a).toEqual(b);
  });
});

describe('Stage 7.2.b.1 Engine Interface — rejection', () => {
  it('rejects invalid Decision Context id', () => {
    const result = validateCognitiveEngineInterfaceRequest(
      baseRequest({ decisionContextId: 'not-a-uuid' }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'decisionContextId')).toBe(true);
  });

  it('rejects missing lineage', () => {
    const request = baseRequest();
    delete request.lineage;
    const result = validateCognitiveEngineInterfaceRequest(request);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage' && e.code === 'required_object')).toBe(true);
  });

  it('rejects missing provenance', () => {
    const request = baseRequest();
    delete request.provenance;
    const result = validateCognitiveEngineInterfaceRequest(request);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'provenance' && e.code === 'required_object')).toBe(true);
  });

  it('rejects incompatible Kernel contract version', () => {
    const result = validateCognitiveEngineInterfaceRequest(
      baseRequest({ kernelContractVersion: 'wrong-kernel' }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'incompatible_kernel_contract')).toBe(true);
  });

  it('rejects incompatible Decision Context contract version', () => {
    const result = validateCognitiveEngineInterfaceRequest(
      baseRequest({ decisionContextContractVersion: 'wrong-context' }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'incompatible_decision_context_contract')).toBe(true);
  });

  it('rejects execution fields such as orderId', () => {
    const result = validateCognitiveEngineInterfaceRequest(baseRequest({ orderId: 'order-1' }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'orderId')).toBe(true);
  });

  it('rejects wallet fields', () => {
    const result = validateCognitiveEngineInterfaceRequest(
      baseRequest({ walletAction: 'withdraw' }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'walletAction')).toBe(true);
  });

  it('rejects provider/secret fields', () => {
    const result = validateCognitiveEngineInterfaceRequest(baseRequest({ apiSecret: 'x' }));
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.field === 'apiSecret' || e.code === 'forbidden_secret_keys'),
    ).toBe(true);
  });

  it('rejects raw model responses', () => {
    const result = validateCognitiveEngineInterfaceRequest(
      baseRequest({ modelResponse: { text: 'hi' } }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'modelResponse')).toBe(true);
  });

  it('rejects BUY/SELL authority values', () => {
    const result = validateCognitiveEngineInterfaceRequest(baseRequest({
      provenance: {
        ...baseRequest().provenance,
        note: 'BUY',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'forbidden_execution_authority_value')).toBe(true);
  });

  it('rejects result with executionEligible true', () => {
    const envelope = buildInterfaceOnlyCognitiveAnalysisResult({
      decisionContextId: CONTEXT_ID,
      orchestrationSetReferences: [
        {
          orchestrationSetId: ORCH_SET_ID,
          orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        },
      ],
      generatedAt: NOW,
    });
    envelope.executionEligible = true;
    const result = validateCognitiveAnalysisResult(envelope);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'executionEligible')).toBe(true);
  });

  it('rejects result with approvedForExecution true', () => {
    const envelope = buildInterfaceOnlyCognitiveAnalysisResult({
      decisionContextId: CONTEXT_ID,
      orchestrationSetReferences: [
        {
          orchestrationSetId: ORCH_SET_ID,
          orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        },
      ],
      generatedAt: NOW,
    });
    envelope.approvedForExecution = true;
    const result = validateCognitiveAnalysisResult(envelope);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'approvedForExecution')).toBe(true);
  });

  it('rejects result with decisionEligible true', () => {
    const envelope = buildInterfaceOnlyCognitiveAnalysisResult({
      decisionContextId: CONTEXT_ID,
      orchestrationSetReferences: [
        {
          orchestrationSetId: ORCH_SET_ID,
          orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        },
      ],
      generatedAt: NOW,
    });
    envelope.decisionEligible = true;
    const result = validateCognitiveAnalysisResult(envelope);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'decisionEligible')).toBe(true);
  });

  it('rejects result that claims Cognitive Engine started', () => {
    const envelope = buildInterfaceOnlyCognitiveAnalysisResult({
      decisionContextId: CONTEXT_ID,
      orchestrationSetReferences: [
        {
          orchestrationSetId: ORCH_SET_ID,
          orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        },
      ],
      generatedAt: NOW,
    });
    envelope.cognitiveEngineStarted = true;
    const result = validateCognitiveAnalysisResult(envelope);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'cognitiveEngineStarted')).toBe(true);
  });
});

describe('Stage 7.2.b.1 Engine Interface — static safety', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const contractSrc = readFileSync(
    path.join(root, 'contracts/artemisCognitiveEngineInterfaceContract.js'),
    'utf8',
  );

  it('does not import orchestrator, DB, Redis, providers, or engine/services', () => {
    expect(contractSrc).not.toMatch(/artemisOrchestrator/);
    expect(contractSrc).not.toMatch(/from ['"].*\/db\.js/);
    expect(contractSrc).not.toMatch(/from ['"].*redis/i);
    expect(contractSrc).not.toMatch(/@google\/generative-ai|\bfrom ['"]openai['"]/);
    expect(contractSrc).not.toMatch(/artemisEvidenceOrchestrationService|artemisDecisionContextService/);
    expect(contractSrc).not.toMatch(/\bplaceOrder\s*\(|\bexecuteOrder\s*\(/);
    expect(contractSrc).toMatch(/Cognitive Kernel Contract/);
    expect(contractSrc).toMatch(/Decision Context/);
  });

  it('documents non-engine and non-execution limitations', () => {
    expect(contractSrc).toMatch(/no_cognitive_reasoning_logic/);
    expect(contractSrc).toMatch(/no_llm_provider_calls/);
    expect(contractSrc).toMatch(/no_execution_authorization/);
    expect(ENGINE_INTERFACE_LIMITATIONS).toContain('stage7_2b1_cognitive_engine_interface_only');
  });
});
