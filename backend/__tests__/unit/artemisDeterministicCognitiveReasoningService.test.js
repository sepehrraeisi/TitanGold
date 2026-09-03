/**
 * @jest-environment node
 */
/**
 * Artemis Core Stage 7.2.b.2 — Deterministic Cognitive Reasoning Pipeline tests.
 * Pure library: no DB, Redis, providers, LLM, or legacy orchestrator mutation.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
  DECISION_CONTEXT_SCHEMA_VERSION,
} from '../../contracts/artemisDecisionContextContract.js';
import { AUTHORITY_CLASS } from '../../contracts/artemisEvidenceContract.js';
import {
  KERNEL_CONTRACT_VERSION,
  KERNEL_LIMITATIONS,
  KERNEL_SCHEMA_VERSION,
  ZERO_KERNEL_SIDE_EFFECTS,
} from '../../contracts/artemisCognitiveKernelContract.js';
import {
  CONFLICT_KIND,
  CONFLICT_SEVERITY,
  ORCHESTRATION_CONTRACT_VERSION,
} from '../../contracts/artemisEvidenceOrchestrationContract.js';
import { INGESTION_DISPOSITION } from '../../contracts/artemisEvidenceIngestionContract.js';
import {
  ENGINE_ABSTENTION_STATE,
  ENGINE_UNCERTAINTY_STATE,
  validateCognitiveAnalysisResult,
} from '../../contracts/artemisCognitiveEngineInterfaceContract.js';
import {
  DETERMINISTIC_REASONING_METHOD_KEY,
  DETERMINISTIC_REASONING_POLICY_VERSION,
  DETERMINISTIC_REASONING_STAGE,
  DETERMINISTIC_REASONING_WRITER,
  runDeterministicCognitiveReasoning,
} from '../../services/artemisDeterministicCognitiveReasoningService.js';

const CONTEXT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORCH_SET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RUN_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RUN_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const NOW = '2026-09-03T12:00:00.000Z';

function decisionContext(overrides = {}) {
  return {
    schemaVersion: DECISION_CONTEXT_SCHEMA_VERSION,
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    contextId: CONTEXT_ID,
    generatedAt: NOW,
    evidenceReferences: {
      orchestrationSetIds: [ORCH_SET_ID],
    },
    ...overrides,
  };
}

function kernelInput(overrides = {}) {
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
      note: 'stage_7_2b2_kernel_input_fixture',
      recordedAt: NOW,
    },
    limitations: [...KERNEL_LIMITATIONS],
    sideEffects: { ...ZERO_KERNEL_SIDE_EFFECTS },
    ...overrides,
  };
}

function orchestrationSet(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    contractVersion: ORCHESTRATION_CONTRACT_VERSION,
    orchestrationId: ORCH_SET_ID,
    generatedAt: NOW,
    stage: 6,
    includedEvidence: [
      {
        agentId: 'technical',
        runId: RUN_A,
        authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
        usable: true,
      },
    ],
    excludedEvidence: [],
    missingEvidence: [
      {
        agentId: 'sentiment',
        status: 'MISSING',
        semantics: 'missing_not_negative',
      },
    ],
    conflicts: [],
    ...overrides,
  };
}

function run(partial = {}) {
  return runDeterministicCognitiveReasoning({
    decisionContext: decisionContext(partial.decisionContext),
    kernelInput: kernelInput(partial.kernelInput),
    orchestrationSets: partial.orchestrationSets || [orchestrationSet(partial.orchestrationSet)],
    generatedAt: partial.generatedAt ?? NOW,
  });
}

describe('Stage 7.2.b.2 Deterministic Reasoning — happy path', () => {
  it('produces a Cognitive Analysis Result with hard-false execution flags', () => {
    const out = run();
    expect(out.ok).toBe(true);
    expect(out.result.executionEligible).toBe(false);
    expect(out.result.approvedForExecution).toBe(false);
    expect(out.result.decisionEligible).toBe(false);
    expect(out.result.cognitiveEngineStarted).toBe(false);
    expect(out.result.analyticalConclusion).toBeNull();
    expect(out.result.provenance.writer).toBe(DETERMINISTIC_REASONING_WRITER);
    expect(out.result.provenance.methodKey).toBe(DETERMINISTIC_REASONING_METHOD_KEY);
    expect(out.result.lineage.stage).toBe(DETERMINISTIC_REASONING_STAGE);
    expect(out.result.policyVersion).toBe(DETERMINISTIC_REASONING_POLICY_VERSION);
    expect(validateCognitiveAnalysisResult(out.result).ok).toBe(true);
  });

  it('is deterministic for identical inputs', () => {
    const a = run();
    const b = run();
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.result).toEqual(b.result);
    expect(a.classification).toEqual(b.classification);
  });

  it('classifies usable included evidence without material conflict as sufficient / not abstaining', () => {
    const out = run();
    expect(out.classification.uncertaintyState).toBe(ENGINE_UNCERTAINTY_STATE.SUFFICIENT_EVIDENCE);
    expect(out.classification.abstentionState).toBe(ENGINE_ABSTENTION_STATE.NOT_ABSTAINING);
    expect(out.result.reasoningSummary).toContain('voting=none');
    expect(out.result.reasoningSummary).toContain('confidence_averaging=none');
  });
});

describe('Stage 7.2.b.2 Deterministic Reasoning — evidence semantics', () => {
  it('abstains on missing / empty included evidence', () => {
    const out = run({
      orchestrationSet: {
        includedEvidence: [],
        missingEvidence: [
          { agentId: 'technical', status: 'MISSING', semantics: 'missing_not_negative' },
        ],
      },
    });
    expect(out.ok).toBe(true);
    expect(out.classification.uncertaintyState).toBe(ENGINE_UNCERTAINTY_STATE.INSUFFICIENT_EVIDENCE);
    expect(out.classification.abstentionState).toBe(ENGINE_ABSTENTION_STATE.ABSTAIN_INSUFFICIENT);
    expect(out.classification.ruleKey).toContain('missing');
  });

  it('handles stale evidence without treating it as current', () => {
    const out = run({
      orchestrationSet: {
        includedEvidence: [],
        excludedEvidence: [
          {
            agentId: 'technical',
            runId: RUN_A,
            disposition: INGESTION_DISPOSITION.REJECTED_STALE,
            semantics: 'stale_or_expired_not_current',
            usable: false,
          },
        ],
        conflicts: [
          {
            conflictId: 'freshness-1',
            kind: CONFLICT_KIND.FRESHNESS_INCOMPATIBILITY,
            severity: CONFLICT_SEVERITY.MATERIAL,
          },
        ],
      },
    });
    expect(out.ok).toBe(true);
    expect(out.classification.uncertaintyState).toBe(ENGINE_UNCERTAINTY_STATE.STALE_CONTEXT);
    expect(out.classification.abstentionState).toBe(ENGINE_ABSTENTION_STATE.ABSTAIN_STALE);
  });

  it('represents directional conflicts without voting', () => {
    const out = run({
      orchestrationSet: {
        includedEvidence: [
          {
            agentId: 'technical',
            runId: RUN_A,
            authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
            usable: true,
          },
          {
            agentId: 'trend',
            runId: RUN_B,
            authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
            usable: true,
          },
        ],
        conflicts: [
          {
            conflictId: 'dir-1',
            kind: CONFLICT_KIND.DIRECTIONAL_DISAGREEMENT,
            severity: CONFLICT_SEVERITY.MATERIAL,
          },
        ],
      },
    });
    expect(out.ok).toBe(true);
    expect(out.classification.uncertaintyState).toBe(ENGINE_UNCERTAINTY_STATE.CONFLICTING_EVIDENCE);
    expect(out.classification.abstentionState).toBe(ENGINE_ABSTENTION_STATE.ABSTAIN_CONFLICT);
    expect(out.classification.ruleKey).toContain('represented');
    expect(out.result.reasoningSummary).toContain('voting=none');
    expect(JSON.stringify(out.result)).not.toMatch(/"BUY"|"SELL"|"EXECUTE"/);
  });

  it('does not treat unavailable as neutral', () => {
    const out = run({
      orchestrationSet: {
        includedEvidence: [],
        excludedEvidence: [
          {
            agentId: 'sentiment',
            runId: RUN_B,
            disposition: INGESTION_DISPOSITION.UNAVAILABLE,
            semantics: 'unavailable_not_neutral',
            usable: false,
            neutralVote: false,
          },
        ],
      },
    });
    expect(out.ok).toBe(true);
    expect(out.classification.uncertaintyState).toBe(ENGINE_UNCERTAINTY_STATE.UNAVAILABLE);
    expect(out.classification.abstentionState).toBe(ENGINE_ABSTENTION_STATE.ABSTAIN_UNAVAILABLE);
    expect(out.result.reasoningSummary).toContain('excluded_unavailable=1');
  });

  it('does not treat blocked as neutral', () => {
    const out = run({
      orchestrationSet: {
        includedEvidence: [],
        excludedEvidence: [
          {
            agentId: 'risk',
            runId: RUN_B,
            disposition: INGESTION_DISPOSITION.BLOCKED,
            semantics: 'blocked_not_neutral',
            usable: false,
            neutralVote: false,
          },
        ],
      },
    });
    expect(out.ok).toBe(true);
    expect(out.classification.uncertaintyState).toBe(ENGINE_UNCERTAINTY_STATE.BLOCKED);
    expect(out.classification.abstentionState).toBe(ENGINE_ABSTENTION_STATE.ABSTAIN_BLOCKED);
  });
});

describe('Stage 7.2.b.2 Deterministic Reasoning — rejection / safety', () => {
  it('rejects execution fields', () => {
    const out = runDeterministicCognitiveReasoning({
      decisionContext: decisionContext(),
      kernelInput: kernelInput(),
      orchestrationSets: [orchestrationSet()],
      orderId: 'should-not-pass',
      generatedAt: NOW,
    });
    expect(out.ok).toBe(false);
    expect(out.errors.some((e) => e.code === 'forbidden_execution_or_provider_field')).toBe(true);
  });

  it('rejects wallet fields', () => {
    const out = runDeterministicCognitiveReasoning({
      decisionContext: decisionContext(),
      kernelInput: kernelInput(),
      orchestrationSets: [orchestrationSet()],
      walletAction: 'withdraw',
      generatedAt: NOW,
    });
    expect(out.ok).toBe(false);
    expect(out.errors.some((e) => e.field === 'walletAction')).toBe(true);
  });

  it('rejects provider / secret fields', () => {
    const out = runDeterministicCognitiveReasoning({
      decisionContext: decisionContext(),
      kernelInput: kernelInput(),
      orchestrationSets: [orchestrationSet()],
      apiKey: 'secret',
      generatedAt: NOW,
    });
    expect(out.ok).toBe(false);
  });

  it('rejects mismatched orchestration set ids', () => {
    const out = runDeterministicCognitiveReasoning({
      decisionContext: decisionContext(),
      kernelInput: kernelInput(),
      orchestrationSets: [
        orchestrationSet({
          orchestrationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        }),
      ],
      generatedAt: NOW,
    });
    expect(out.ok).toBe(false);
    expect(out.errors.some((e) => e.code === 'orchestration_set_id_mismatch')).toBe(true);
  });

  it('rejects invalid kernel input', () => {
    const out = runDeterministicCognitiveReasoning({
      decisionContext: decisionContext(),
      kernelInput: {
        decisionContextId: CONTEXT_ID,
      },
      orchestrationSets: [orchestrationSet()],
      generatedAt: NOW,
    });
    expect(out.ok).toBe(false);
    expect(out.errors.some((e) => e.field === 'kernelInput')).toBe(true);
  });

  it('does not import orchestrator, DB, Redis, providers, or LLM SDKs', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      path.join(here, '../../services/artemisDeterministicCognitiveReasoningService.js'),
      'utf8',
    );
    const importBlock = source
      .split('\n')
      .filter((line) => /^\s*import\s/.test(line))
      .join('\n');
    expect(importBlock).not.toMatch(/artemisOrchestrator/);
    expect(importBlock).not.toMatch(/db\.js/);
    expect(importBlock).not.toMatch(/ioredis|createClient/);
    expect(importBlock).not.toMatch(/openai|anthropic|generative-ai|axios/);
    expect(importBlock).not.toMatch(/artemisDeterministicSynthesisService/);
    expect(source).toMatch(/no_majority_voting/);
  });

  it('keeps side-effect ledger at zero', () => {
    const out = run();
    expect(out.ok).toBe(true);
    expect(out.sideEffects).toEqual({
      dbWriteCount: 0,
      redisWriteCount: 0,
      agentExecutionCount: 0,
      providerRequestCount: 0,
      orderOperationCount: 0,
      financialExecutionCount: 0,
      llmCallCount: 0,
    });
  });
});
