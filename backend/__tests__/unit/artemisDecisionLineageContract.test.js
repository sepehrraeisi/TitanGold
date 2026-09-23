/**
 * @jest-environment node
 *
 * Artemis Core Stage 9 — S9-DECISION-LINEAGE-CONTRACT
 * Decision Lineage Contract Boundary unit tests.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { DECISION_CONTRACT_VERSION } from '../../contracts/artemisDecisionContract.js';
import { DECISION_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisDecisionContextContract.js';
import { ORCHESTRATION_CONTRACT_VERSION } from '../../contracts/artemisEvidenceOrchestrationContract.js';
import { CONTROL_CHAIN_CONTRACT_VERSION } from '../../contracts/artemisControlChainContract.js';
import { SHADOW_RECORDING_CONTRACT_VERSION } from '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js';
import { MARKET_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisMarketContextContract.js';
import { SHADOW_RUNTIME_CONTRACT_VERSION } from '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js';
import { SHADOW_TASK_STATE_CONTRACT_VERSION } from '../../contracts/artemisShadowTaskStateBoundaryContract.js';
import { SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION } from '../../contracts/artemisShadowTaskCycleCompositionBoundaryContract.js';
import { OBSERVED_OUTCOME_CONTRACT_VERSION } from '../../contracts/artemisObservedOutcomeContract.js';
import { OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION } from '../../contracts/artemisObservedOutcomeEvaluationContract.js';
import {
  DECISION_LINEAGE_ARTIFACT_TYPE,
  DECISION_LINEAGE_AUTHORITY_CLASS,
  DECISION_LINEAGE_CONTRACT_VERSION,
  DECISION_LINEAGE_IS_SOURCE_OF_TRUTH,
  DECISION_LINEAGE_OWNERSHIP_ROLE,
  DECISION_LINEAGE_SLICE_ID,
  RECONSTRUCTABILITY_STATUS,
  REQUIRED_HARD_FLAGS,
  ZERO_LINEAGE_SIDE_EFFECTS,
  buildDecisionLineage,
  validateDecisionLineage,
} from '../../contracts/artemisDecisionLineageContract.js';

const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORCH_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CONTROL_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const MC_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const RECORDING_ID = '66666666-6666-4666-8666-666666666666';
const TASK_ID = '77777777-7777-4777-8777-777777777777';
const BINDING_ID = '88888888-8888-4888-8888-888888888888';
const CYCLE_ID = '55555555-5555-4555-8555-555555555555';
const OUTCOME_ID = '99999999-9999-4999-8999-999999999999';
const EVAL_ID = '10101010-1010-4101-8101-101010101010';
const OTHER_UUID = '11111111-1111-4111-8111-111111111111';

const ANALYSIS_AT = '2026-09-22T10:00:00.000Z';
const CREATED_AT = '2026-09-22T10:00:01.000Z';
const SOURCE_TS = '2026-09-22T09:59:00.000Z';
const OUTCOME_OBSERVED_AT = '2026-09-22T11:00:00.000Z';
const OUTCOME_RECORDED_AT = '2026-09-22T11:00:01.000Z';
const EVAL_RECORDED_AT = '2026-09-22T11:00:02.000Z';
const LINEAGE_RECORDED_AT = '2026-09-22T11:00:03.000Z';

const CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisDecisionLineageContract.js',
);

const PROTECTED_CONTRACT_PATHS = [
  '../../contracts/artemisRiskControlRuntimeBoundaryContract.js',
  '../../contracts/artemisPortfolioControlSizingBoundaryContract.js',
  '../../contracts/artemisLiquidityExecutionFeasibilityBoundaryContract.js',
  '../../contracts/artemisRuntimeCapabilityBoundaryContract.js',
  '../../contracts/artemisOrderManagementExecutionBoundaryContract.js',
  '../../contracts/artemisControlChainContract.js',
  '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js',
  '../../contracts/artemisMarketContextContract.js',
  '../../contracts/artemisMarketContextSourceOfTruthContract.js',
  '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js',
  '../../contracts/artemisShadowTaskStateBoundaryContract.js',
  '../../contracts/artemisShadowTaskCycleCompositionBoundaryContract.js',
  '../../contracts/artemisShadowTaskStateActivationBoundaryContract.js',
  '../../contracts/artemisObservedOutcomeContract.js',
  '../../contracts/artemisObservedOutcomeSourceOfTruthContract.js',
  '../../contracts/artemisObservedOutcomeEvaluationContract.js',
  '../../contracts/artemisObservedOutcomeEvaluationSourceOfTruthContract.js',
  '../../contracts/artemisDecisionContract.js',
  '../../contracts/artemisDecisionContextContract.js',
  '../../contracts/artemisEvidenceOrchestrationContract.js',
];

const BASELINE_PROTECTED_HASHES = new Map(
  PROTECTED_CONTRACT_PATHS.map((rel) => {
    const abs = path.join(path.dirname(fileURLToPath(import.meta.url)), rel);
    const sha = createHash('sha256').update(readFileSync(abs)).digest('hex');
    return [rel, sha];
  }),
);

function decisionRef(overrides = {}) {
  return {
    decisionId: DECISION_ID,
    contractVersion: DECISION_CONTRACT_VERSION,
    decisionContextId: CONTEXT_ID,
    analysisAt: ANALYSIS_AT,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function validMinimumInput(overrides = {}) {
  return {
    decisionRef: decisionRef(),
    recordedAt: LINEAGE_RECORDED_AT,
    ...overrides,
  };
}

function validRichInput(overrides = {}) {
  return {
    decisionRef: decisionRef(),
    decisionContextRef: {
      contextId: CONTEXT_ID,
      contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    },
    evidenceOrchestrationRef: {
      orchestrationId: ORCH_ID,
      contractVersion: ORCHESTRATION_CONTRACT_VERSION,
    },
    controlChainRef: {
      controlChainArtifactId: CONTROL_ID,
      contractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    },
    marketContextRef: {
      marketContextId: MC_ID,
      contractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
      venue: 'mexc',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      timeframe: '1h',
      sourceTimestamp: SOURCE_TS,
    },
    shadowRecordingRef: {
      shadowRecordingArtifactId: RECORDING_ID,
      contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
    },
    taskRef: {
      taskId: TASK_ID,
      contractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
      attempt: 1,
    },
    bindingRef: {
      bindingId: BINDING_ID,
      contractVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
    },
    shadowCycleEnvelopeRef: {
      shadowCycleEnvelopeId: CYCLE_ID,
      contractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
    },
    outcomeRef: {
      outcomeId: OUTCOME_ID,
      contractVersion: OBSERVED_OUTCOME_CONTRACT_VERSION,
      outcomeObservedAt: OUTCOME_OBSERVED_AT,
      recordedAt: OUTCOME_RECORDED_AT,
    },
    evaluationRef: {
      evaluationId: EVAL_ID,
      contractVersion: OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
      recordedAt: EVAL_RECORDED_AT,
    },
    recordedAt: LINEAGE_RECORDED_AT,
    ...overrides,
  };
}

function expectReject(result, fieldOrCode, code) {
  expect(result.ok).toBe(false);
  expect(result.artifact).toBeNull();
  const errors = result.errors || [];
  if (code) {
    expect(errors.some((e) => e.field === fieldOrCode && e.code === code)).toBe(true);
  } else {
    expect(
      errors.some((e) => e.code === fieldOrCode || e.field === fieldOrCode)
        || result.code === fieldOrCode,
    ).toBe(true);
  }
}

describe('artemisDecisionLineageContract — S9 Decision Lineage Contract Boundary', () => {
  it('1. builds a valid minimum Decision lineage artifact', () => {
    const result = buildDecisionLineage(validMinimumInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.decision.decisionRef.decisionId).toBe(DECISION_ID);
    expect(result.artifact.lineageId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('2. isSourceOfTruth=false', () => {
    const result = buildDecisionLineage(validMinimumInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.isSourceOfTruth).toBe(false);
    expect(DECISION_LINEAGE_IS_SOURCE_OF_TRUTH).toBe(false);
  });

  it('3. authorityClass=DECISION_LINEAGE and ownershipRole=VALIDATION_BOUNDARY', () => {
    const result = buildDecisionLineage(validMinimumInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.authorityClass).toBe(DECISION_LINEAGE_AUTHORITY_CLASS);
    expect(result.artifact.ownershipRole).toBe(DECISION_LINEAGE_OWNERSHIP_ROLE);
    expect(result.artifact.artifactType).toBe(DECISION_LINEAGE_ARTIFACT_TYPE);
    expect(result.artifact.sliceId).toBe(DECISION_LINEAGE_SLICE_ID);
    expect(result.artifact.contractVersion).toBe(DECISION_LINEAGE_CONTRACT_VERSION);
  });

  it('4–5. deterministic lineageId; identical input → identical artifact', () => {
    const a = buildDecisionLineage(validRichInput());
    const b = buildDecisionLineage(validRichInput());
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.artifact.lineageId).toBe(b.artifact.lineageId);
    expect(JSON.stringify(a.artifact)).toBe(JSON.stringify(b.artifact));
  });

  it('6. caller-supplied matching lineageId accepted', () => {
    const first = buildDecisionLineage(validMinimumInput());
    const second = buildDecisionLineage(
      validMinimumInput({ lineageId: first.artifact.lineageId }),
    );
    expect(second.ok).toBe(true);
    expect(second.artifact.lineageId).toBe(first.artifact.lineageId);
  });

  it('7. conflicting lineageId rejected', () => {
    const result = buildDecisionLineage(
      validMinimumInput({ lineageId: OTHER_UUID }),
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe('lineage_id_conflict');
  });

  it('8. canonical Decision ref required', () => {
    const { decisionRef: _d, ...rest } = validMinimumInput();
    expectReject(buildDecisionLineage(rest), 'decisionRef', 'required_decision_ref');
  });

  it('9. invalid decisionId rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({
        decisionRef: decisionRef({ decisionId: 'not-a-uuid' }),
      })),
      'decisionRef.decisionId',
      'invalid_decision_id',
    );
  });

  it('10. Decision Context ref consistency', () => {
    const ok = buildDecisionLineage(validRichInput());
    expect(ok.ok).toBe(true);
    expect(ok.artifact.preDecision.decisionContextRef.contextId).toBe(CONTEXT_ID);

    expectReject(
      buildDecisionLineage(validRichInput({
        decisionContextRef: {
          contextId: OTHER_UUID,
          contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
        },
      })),
      'decisionContextRef.contextId',
      'context_id_mismatch',
    );
  });

  it('11. shadow recording ref consistency', () => {
    const ok = buildDecisionLineage(validRichInput());
    expect(ok.ok).toBe(true);
    expect(ok.artifact.decision.shadowRecordingRef.shadowRecordingArtifactId)
      .toBe(RECORDING_ID);

    expectReject(
      buildDecisionLineage(validRichInput({
        shadowRecordingRef: {
          shadowRecordingArtifactId: 'bad',
          contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
        },
      })),
      'shadowRecordingRef.shadowRecordingArtifactId',
      'invalid_shadow_recording_id',
    );
  });

  it('12. market context ref consistency', () => {
    const ok = buildDecisionLineage(validRichInput());
    expect(ok.ok).toBe(true);
    expect(ok.artifact.preDecision.marketContextRef.marketContextId).toBe(MC_ID);

    expectReject(
      buildDecisionLineage(validRichInput({
        marketContextRef: {
          marketContextId: 'bad',
          contractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
          sourceTimestamp: SOURCE_TS,
        },
      })),
      'marketContextRef.marketContextId',
      'invalid_market_context_id',
    );
  });

  it('13. task ref consistency', () => {
    const ok = buildDecisionLineage(validRichInput());
    expect(ok.ok).toBe(true);
    expect(ok.artifact.decision.taskRef.taskId).toBe(TASK_ID);
  });

  it('14. binding ref consistency', () => {
    const ok = buildDecisionLineage(validRichInput());
    expect(ok.ok).toBe(true);
    expect(ok.artifact.decision.bindingRef.bindingId).toBe(BINDING_ID);
  });

  it('15. optional shadow-cycle ref consistency', () => {
    const ok = buildDecisionLineage(validRichInput());
    expect(ok.ok).toBe(true);
    expect(ok.artifact.decision.shadowCycleEnvelopeRef.shadowCycleEnvelopeId)
      .toBe(CYCLE_ID);
  });

  it('16. optional Outcome descendant consistency', () => {
    const ok = buildDecisionLineage(validRichInput());
    expect(ok.ok).toBe(true);
    expect(ok.artifact.postDecision.outcomeRef.outcomeId).toBe(OUTCOME_ID);
  });

  it('17. optional Evaluation descendant consistency', () => {
    const ok = buildDecisionLineage(validRichInput());
    expect(ok.ok).toBe(true);
    expect(ok.artifact.postDecision.evaluationRef.evaluationId).toBe(EVAL_ID);
  });

  it('18. Outcome forbidden as pre-decision ancestor', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({
        preDecision: {
          outcomeRef: {
            outcomeId: OUTCOME_ID,
            contractVersion: OBSERVED_OUTCOME_CONTRACT_VERSION,
          },
        },
      })),
      'preDecision.outcomeRef',
      'post_decision_descendant_in_pre_decision',
    );
  });

  it('19. Evaluation forbidden as pre-decision ancestor', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({
        preDecision: {
          evaluationId: EVAL_ID,
        },
      })),
      'preDecision.evaluationId',
      'post_decision_descendant_in_pre_decision',
    );
  });

  it('20. pre/post directionality preserved', () => {
    const result = buildDecisionLineage(validRichInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.preDecision.decisionContextRef).toBeDefined();
    expect(result.artifact.preDecision.marketContextRef).toBeDefined();
    expect(result.artifact.preDecision.outcomeRef).toBeUndefined();
    expect(result.artifact.preDecision.evaluationRef).toBeUndefined();
    expect(result.artifact.decision.decisionRef).toBeDefined();
    expect(result.artifact.postDecision.outcomeRef).toBeDefined();
    expect(result.artifact.postDecision.evaluationRef).toBeDefined();
    expect(result.artifact.postDecision.decisionContextRef).toBeUndefined();
  });

  it('21. lookahead rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({ lookahead: true })),
      'forbidden_field',
    );
  });

  it('22. futureData rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({ futureData: {} })),
      'forbidden_field',
    );
  });

  it('23. raw OHLCV rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({ ohlcv: [] })),
      'forbidden_field',
    );
  });

  it('24. ticker rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({ ticker: {} })),
      'forbidden_field',
    );
  });

  it('25. orderbook/depth rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({ orderBook: {}, depth: {} })),
      'forbidden_field',
    );
  });

  it('26. provider payload rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({ providerPayload: {} })),
      'forbidden_field',
    );
  });

  it('27. order contamination rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({ orderId: OTHER_UUID })),
      'forbidden_field',
    );
  });

  it('28. wallet contamination rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({ wallet: {} })),
      'forbidden_field',
    );
  });

  it('29. financial contamination rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({ realizedPnl: 1, ROI: 0.1 })),
      'forbidden_field',
    );
  });

  it('30–31. Replay fields and replayId rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({ replayId: OTHER_UUID, replay: true })),
      'forbidden_field',
    );
  });

  it('32. replay execution data rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({ replayExecution: {} })),
      'forbidden_field',
    );
  });

  it('33. unknown top-level field rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({ unexpectedTop: 1 })),
      'input.unexpectedTop',
      'unknown_field',
    );
  });

  it('34. unknown nested field rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({
        decisionRef: { ...decisionRef(), extraNested: true },
      })),
      'decisionRef.extraNested',
      'unknown_field',
    );
  });

  it('35. hard authority true rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({ decisionEligible: true })),
      'decisionEligible',
      'hard_flag_must_be_false',
    );
    expectReject(
      buildDecisionLineage(validMinimumInput({ replayActivated: true })),
      'replayActivated',
      'hard_flag_must_be_false',
    );
  });

  it('36. provenance preserved', () => {
    const result = buildDecisionLineage(validMinimumInput({
      provenance: {
        writer: 'testWriter',
        methodKey: 'test_method',
        stage: 'TEST_STAGE',
        recordedAt: LINEAGE_RECORDED_AT,
        policyVersion: 'policy-test',
        implementationVersion: '9.9.9',
        note: 'qa',
      },
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.provenance.writer).toBe('testWriter');
    expect(result.artifact.provenance.note).toBe('qa');
  });

  it('37. unavailable provenance not fabricated beyond defaults', () => {
    const result = buildDecisionLineage(validMinimumInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.provenance.modelVersion).toBeUndefined();
    expect(result.artifact.provenance.configurationVersion).toBeUndefined();
    expect(result.artifact.modelVersion).toBeUndefined();
  });

  it('38. version linkage preserved', () => {
    const result = buildDecisionLineage(validRichInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.versions.decisionContractVersion).toBe(DECISION_CONTRACT_VERSION);
    expect(result.artifact.versions.decisionContextContractVersion)
      .toBe(DECISION_CONTEXT_CONTRACT_VERSION);
    expect(result.artifact.versions.observedOutcomeContractVersion)
      .toBe(OBSERVED_OUTCOME_CONTRACT_VERSION);
    expect(result.artifact.versions.observedOutcomeEvaluationContractVersion)
      .toBe(OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION);
    expect(result.artifact.versions.decisionLineageContractVersion)
      .toBe(DECISION_LINEAGE_CONTRACT_VERSION);
  });

  it('39. temporal contradiction rejected (market after decision)', () => {
    expectReject(
      buildDecisionLineage(validRichInput({
        marketContextRef: {
          marketContextId: MC_ID,
          contractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
          sourceTimestamp: '2026-09-22T12:00:00.000Z',
        },
      })),
      'preDecision.marketContextRef.sourceTimestamp',
      'pre_decision_after_decision',
    );
  });

  it('40. post-decision descendant timestamp ordering validated', () => {
    expectReject(
      buildDecisionLineage(validRichInput({
        outcomeRef: {
          outcomeId: OUTCOME_ID,
          contractVersion: OBSERVED_OUTCOME_CONTRACT_VERSION,
          outcomeObservedAt: '2026-09-22T09:00:00.000Z',
          recordedAt: '2026-09-22T09:00:01.000Z',
        },
      })),
      'postDecision.outcomeRef.outcomeObservedAt',
      'outcome_before_decision',
    );

    expectReject(
      buildDecisionLineage(validRichInput({
        evaluationRef: {
          evaluationId: EVAL_ID,
          contractVersion: OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
          recordedAt: '2026-09-22T10:30:00.000Z',
        },
      })),
      'postDecision.evaluationRef.recordedAt',
      'evaluation_before_outcome',
    );
  });

  it('41. no outcome/evaluation contamination of Decision-side refs', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({
        decision: {
          decisionRef: decisionRef(),
          outcomeId: OUTCOME_ID,
        },
      })),
      'decision.outcomeId',
      'post_decision_descendant_in_pre_decision',
    );
  });

  it('42. immutable result', () => {
    const result = buildDecisionLineage(validRichInput());
    expect(result.ok).toBe(true);
    expect(Object.isFrozen(result.artifact)).toBe(true);
    expect(Object.isFrozen(result.artifact.decision)).toBe(true);
    expect(Object.isFrozen(result.artifact.preDecision)).toBe(true);
    expect(Object.isFrozen(result.artifact.postDecision)).toBe(true);
    expect(() => {
      result.artifact.authorityClass = 'HACK';
    }).toThrow();
  });

  it('43. zero side effects', () => {
    const result = buildDecisionLineage(validRichInput());
    expect(result.ok).toBe(true);
    expect(result.sideEffects).toEqual(ZERO_LINEAGE_SIDE_EFFECTS);
    expect(result.artifact.sideEffects).toEqual(ZERO_LINEAGE_SIDE_EFFECTS);
    for (const key of Object.keys(REQUIRED_HARD_FLAGS)) {
      expect(result.artifact[key]).toBe(false);
    }
  });

  it('44–49. import hygiene — no DB/Redis/provider/network/LLM/worker/scheduler/B10', () => {
    const source = readFileSync(CONTRACT_PATH, 'utf8');
    expect(source).not.toMatch(/from ['"].*pg['"]/);
    expect(source).not.toMatch(/from ['"].*ioredis['"]/);
    expect(source).not.toMatch(/from ['"].*redis['"]/);
    expect(source).not.toMatch(/axios|node-fetch|undici|http\.request|https\.request/);
    expect(source).not.toMatch(/openai|anthropic|mexc|ccxt/i);
    expect(source).not.toMatch(/engineWorkerLeader|messageQueue|startArtemisScheduler|scheduler\.js/);
    expect(source).not.toMatch(/artemisDecisionPersistenceService|runtimeExecutionStateService/);
    expect(source).not.toMatch(/Date\.now\(|Math\.random\(|randomUUID\(|randomBytes\(/);
    expect(source).toMatch(/isSourceOfTruth:\s*DECISION_LINEAGE_IS_SOURCE_OF_TRUTH/);
  });

  it('50. Stage 8 / C1–C6 protected contracts unchanged (hash)', () => {
    for (const [rel, baseline] of BASELINE_PROTECTED_HASHES) {
      const abs = path.join(path.dirname(fileURLToPath(import.meta.url)), rel);
      const sha = createHash('sha256').update(readFileSync(abs)).digest('hex');
      expect({ rel, sha }).toEqual({ rel, sha: baseline });
    }
  });

  it('adversarial: evaluation without outcome rejected', () => {
    const { outcomeRef: _o, ...rest } = validRichInput();
    expectReject(
      buildDecisionLineage({
        ...rest,
        evaluationRef: {
          evaluationId: EVAL_ID,
          contractVersion: OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
          recordedAt: EVAL_RECORDED_AT,
        },
      }),
      'evaluationRef',
      'evaluation_requires_outcome_descendant',
    );
  });

  it('adversarial: lookAhead / futureEvidence / candles / fill rejected', () => {
    for (const key of ['lookAhead', 'futureEvidence', 'candles', 'fill', 'fillPrice', 'b10']) {
      expectReject(
        buildDecisionLineage(validMinimumInput({ [key]: 1 })),
        'forbidden_field',
      );
    }
  });

  it('adversarial: contract version mismatch on decisionRef rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({
        decisionRef: decisionRef({ contractVersion: 'wrong-version' }),
      })),
      'decisionRef.contractVersion',
      'contract_version_mismatch',
    );
  });

  it('adversarial: validateDecisionLineage alias matches builder', () => {
    const a = buildDecisionLineage(validMinimumInput());
    const b = validateDecisionLineage(validMinimumInput());
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.artifact.lineageId).toBe(b.artifact.lineageId);
  });

  it('adversarial: reconstructability COMPLETE for rich input', () => {
    const result = buildDecisionLineage(validRichInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.reconstructabilityStatus)
      .toBe(RECONSTRUCTABILITY_STATUS.COMPLETE);
  });

  it('adversarial: reconstructability INSUFFICIENT for decision-only', () => {
    const result = buildDecisionLineage(validMinimumInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.reconstructabilityStatus)
      .toBe(RECONSTRUCTABILITY_STATUS.INSUFFICIENT);
  });

  it('adversarial: reconstructability PARTIAL when only context present', () => {
    const result = buildDecisionLineage(validMinimumInput({
      decisionContextRef: {
        contextId: CONTEXT_ID,
        contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
      },
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.reconstructabilityStatus)
      .toBe(RECONSTRUCTABILITY_STATUS.PARTIAL);
  });

  it('adversarial: expectedReconstructabilityStatus mismatch rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({
        expectedReconstructabilityStatus: RECONSTRUCTABILITY_STATUS.COMPLETE,
      })),
      'expectedReconstructabilityStatus',
      'reconstructability_mismatch',
    );
  });

  it('adversarial: flat + section decisionId mismatch rejected', () => {
    expectReject(
      buildDecisionLineage(validMinimumInput({
        decision: {
          decisionRef: decisionRef({ decisionId: OTHER_UUID }),
        },
      })),
      'decision.decisionRef',
      'decision_id_mismatch',
    );
  });

  it('adversarial: evidence orchestration and control chain land in preDecision', () => {
    const result = buildDecisionLineage(validRichInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.preDecision.evidenceOrchestrationRef.orchestrationId)
      .toBe(ORCH_ID);
    expect(result.artifact.preDecision.controlChainRef.controlChainArtifactId)
      .toBe(CONTROL_ID);
  });

  it('adversarial: missing recordedAt rejected', () => {
    const { recordedAt: _r, ...rest } = validMinimumInput();
    expectReject(buildDecisionLineage(rest), 'recordedAt', 'required_recorded_at');
  });
});
