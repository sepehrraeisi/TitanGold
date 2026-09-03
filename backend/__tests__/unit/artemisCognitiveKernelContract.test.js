/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.2.a — Cognitive Kernel contract fail-closed tests.
 * Contract validation only; no reasoning engine, DB, Redis, or providers.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { DECISION_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisDecisionContextContract.js';
import { ORCHESTRATION_CONTRACT_VERSION } from '../../contracts/artemisEvidenceOrchestrationContract.js';
import {
  KERNEL_ABSTENTION_STATE,
  KERNEL_CONTRACT_VERSION,
  KERNEL_LIMITATIONS,
  KERNEL_SCHEMA_VERSION,
  KERNEL_UNCERTAINTY_STATE,
  ZERO_KERNEL_SIDE_EFFECTS,
  buildKernelContractOnlyCandidate,
  validateCognitiveKernelCandidateOutput,
  validateCognitiveKernelInput,
} from '../../contracts/artemisCognitiveKernelContract.js';

const CONTEXT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORCH_SET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW = '2026-09-03T08:00:00.000Z';

function baseInput(overrides = {}) {
  return {
    schemaVersion: KERNEL_SCHEMA_VERSION,
    kernelContractVersion: KERNEL_CONTRACT_VERSION,
    decisionContextId: CONTEXT_ID,
    decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
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
      policyVersion: 'stage7-2a-kernel-contract-1.0.0',
      stage: '7.2.a',
    },
    provenance: {
      writer: 'unit-test',
      methodKey: 'fixture',
      stage: '7.2.a',
      note: 'stage_7_2a_kernel_contract_fixture',
      recordedAt: NOW,
    },
    limitations: [...KERNEL_LIMITATIONS],
    sideEffects: { ...ZERO_KERNEL_SIDE_EFFECTS },
    ...overrides,
  };
}

describe('Stage 7.2.a Kernel contract — happy path', () => {
  it('accepts a valid Kernel input bound to Decision Context 7.1 + OrchestrationSet 6', () => {
    const result = validateCognitiveKernelInput(baseInput());
    expect(result.ok).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);
  });

  it('accepts a contract-only candidate output skeleton with hard-false execution flags', () => {
    const candidate = buildKernelContractOnlyCandidate({
      decisionContextId: CONTEXT_ID,
      orchestrationSetReferences: [
        {
          orchestrationSetId: ORCH_SET_ID,
          orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        },
      ],
      generatedAt: NOW,
    });
    const result = validateCognitiveKernelCandidateOutput(candidate);
    expect(result.ok).toBe(true);
    expect(candidate.kernelContractVersion).toBe(KERNEL_CONTRACT_VERSION);
    expect(candidate.uncertaintyState).toBe(KERNEL_UNCERTAINTY_STATE.NOT_EVALUATED);
    expect(candidate.abstentionState).toBe(KERNEL_ABSTENTION_STATE.CONTRACT_ONLY);
    expect(candidate.executionEligible).toBe(false);
    expect(candidate.approvedForExecution).toBe(false);
    expect(candidate.decisionEligible).toBe(false);
    expect(candidate.cognitiveKernelStarted).toBe(false);
    expect(candidate.synthesizedDirection).toBeNull();
  });

  it('is deterministic for identical candidate builds', () => {
    const a = buildKernelContractOnlyCandidate({
      decisionContextId: CONTEXT_ID,
      orchestrationSetReferences: [
        {
          orchestrationSetId: ORCH_SET_ID,
          orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        },
      ],
      generatedAt: NOW,
    });
    const b = buildKernelContractOnlyCandidate({
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

describe('Stage 7.2.a Kernel contract — rejection', () => {
  it('rejects invalid Decision Context id', () => {
    const result = validateCognitiveKernelInput(baseInput({ decisionContextId: 'not-a-uuid' }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'decisionContextId')).toBe(true);
  });

  it('rejects missing lineage', () => {
    const input = baseInput();
    delete input.lineage;
    const result = validateCognitiveKernelInput(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'lineage' && e.code === 'required_object')).toBe(true);
  });

  it('rejects missing provenance', () => {
    const input = baseInput();
    delete input.provenance;
    const result = validateCognitiveKernelInput(input);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'provenance' && e.code === 'required_object')).toBe(true);
  });

  it('rejects empty orchestrationSetReferences', () => {
    const result = validateCognitiveKernelInput(baseInput({
      orchestrationSetReferences: [],
      lineage: {
        ...baseInput().lineage,
        orchestrationSetIds: [],
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'orchestrationSetReferences')).toBe(true);
  });

  it('rejects incompatible Decision Context contract version', () => {
    const result = validateCognitiveKernelInput(baseInput({
      decisionContextContractVersion: 'not-stage-7-1',
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'incompatible_decision_context_contract')).toBe(true);
  });

  it('rejects incompatible OrchestrationSet contract version', () => {
    const result = validateCognitiveKernelInput(baseInput({
      orchestrationSetReferences: [
        {
          orchestrationSetId: ORCH_SET_ID,
          orchestrationContractVersion: 'wrong-orch',
        },
      ],
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'incompatible_orchestration_contract')).toBe(true);
  });

  it('rejects execution fields on input such as orderId', () => {
    const result = validateCognitiveKernelInput(baseInput({ orderId: 'order-1' }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'orderId')).toBe(true);
  });

  it('rejects provider/secret fields on input', () => {
    const result = validateCognitiveKernelInput(baseInput({ apiSecret: 'x' }));
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.field === 'apiSecret' || e.code === 'forbidden_secret_keys'),
    ).toBe(true);
  });

  it('rejects BUY/SELL authority values', () => {
    const result = validateCognitiveKernelInput(baseInput({
      provenance: {
        ...baseInput().provenance,
        note: 'BUY',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'forbidden_execution_authority_value')).toBe(true);
  });

  it('rejects candidate output with executionEligible true', () => {
    const candidate = buildKernelContractOnlyCandidate({
      decisionContextId: CONTEXT_ID,
      orchestrationSetReferences: [
        {
          orchestrationSetId: ORCH_SET_ID,
          orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        },
      ],
      generatedAt: NOW,
    });
    candidate.executionEligible = true;
    const result = validateCognitiveKernelCandidateOutput(candidate);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'executionEligible')).toBe(true);
  });

  it('rejects candidate output with approvedForExecution true', () => {
    const candidate = buildKernelContractOnlyCandidate({
      decisionContextId: CONTEXT_ID,
      orchestrationSetReferences: [
        {
          orchestrationSetId: ORCH_SET_ID,
          orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        },
      ],
      generatedAt: NOW,
    });
    candidate.approvedForExecution = true;
    const result = validateCognitiveKernelCandidateOutput(candidate);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'approvedForExecution')).toBe(true);
  });

  it('rejects candidate output that claims Cognitive Kernel started', () => {
    const candidate = buildKernelContractOnlyCandidate({
      decisionContextId: CONTEXT_ID,
      orchestrationSetReferences: [
        {
          orchestrationSetId: ORCH_SET_ID,
          orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        },
      ],
      generatedAt: NOW,
    });
    candidate.cognitiveKernelStarted = true;
    const result = validateCognitiveKernelCandidateOutput(candidate);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'cognitiveKernelStarted')).toBe(true);
  });
});

describe('Stage 7.2.a Kernel contract — static safety', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const contractSrc = readFileSync(
    path.join(root, 'contracts/artemisCognitiveKernelContract.js'),
    'utf8',
  );

  it('does not import orchestrator, DB, Redis, providers, or Stage 6/7.1 services', () => {
    expect(contractSrc).not.toMatch(/artemisOrchestrator/);
    expect(contractSrc).not.toMatch(/from ['"].*\/db\.js/);
    expect(contractSrc).not.toMatch(/from ['"].*redis/i);
    expect(contractSrc).not.toMatch(/@google\/generative-ai|\bfrom ['"]openai['"]/);
    expect(contractSrc).not.toMatch(/artemisEvidenceOrchestrationService|artemisDecisionContextService/);
    expect(contractSrc).not.toMatch(/\bplaceOrder\s*\(|\bexecuteOrder\s*\(/);
    expect(contractSrc).toMatch(/Decision Context/);
    expect(contractSrc).toMatch(/EvidenceOrchestrationSet/);
  });

  it('documents non-execution and non-engine limitations', () => {
    expect(contractSrc).toMatch(/no_cognitive_reasoning_engine/);
    expect(contractSrc).toMatch(/no_llm_provider_calls/);
    expect(contractSrc).toMatch(/no_execution_authorization/);
    expect(KERNEL_LIMITATIONS).toContain('stage7_2a_kernel_contract_only');
  });
});
