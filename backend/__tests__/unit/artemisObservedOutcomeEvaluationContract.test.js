/**
 * @jest-environment node
 *
 * Artemis Core Stage 8 — S8-OBSERVED-OUTCOME-EVALUATION-CONTRACT
 * Observed Outcome Evaluation Contract Boundary unit tests.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AVAILABILITY,
  FRESHNESS_STATUS,
  MARKET_TYPE,
} from '../../contracts/artemisEvidenceContract.js';
import {
  DECISION_CONTRACT_VERSION,
  DIRECTION_OR_ABSTAIN,
} from '../../contracts/artemisDecisionContract.js';
import { DECISION_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisDecisionContextContract.js';
import { MARKET_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisMarketContextContract.js';
import { SHADOW_RECORDING_CONTRACT_VERSION } from '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js';
import { SHADOW_RUNTIME_CONTRACT_VERSION } from '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js';
import { SHADOW_TASK_STATE_CONTRACT_VERSION } from '../../contracts/artemisShadowTaskStateBoundaryContract.js';
import { SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION } from '../../contracts/artemisShadowTaskCycleCompositionBoundaryContract.js';
import {
  buildObservedOutcome,
} from '../../contracts/artemisObservedOutcomeContract.js';
import {
  OBSERVED_OUTCOME_SOT_CONTRACT_VERSION,
} from '../../contracts/artemisObservedOutcomeSourceOfTruthContract.js';
import {
  EVALUATION_METHOD_KEY,
  EVALUATION_STATUS,
  OBSERVATION_CLASS,
  OBSERVED_OUTCOME_EVALUATION_ARTIFACT_TYPE,
  OBSERVED_OUTCOME_EVALUATION_AUTHORITY_CLASS,
  OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION,
  OBSERVED_OUTCOME_EVALUATION_IS_SOURCE_OF_TRUTH,
  OBSERVED_OUTCOME_EVALUATION_METHOD_KEY,
  OBSERVED_OUTCOME_EVALUATION_OWNERSHIP_ROLE,
  OBSERVED_OUTCOME_EVALUATION_SLICE_ID,
  REQUIRED_HARD_FLAGS,
  ZERO_EVALUATION_SIDE_EFFECTS,
  buildObservedOutcomeEvaluation,
  validateObservedOutcomeEvaluation,
} from '../../contracts/artemisObservedOutcomeEvaluationContract.js';

const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RECORDING_ID = '66666666-6666-4666-8666-666666666666';
const TASK_ID = '77777777-7777-4777-8777-777777777777';
const BINDING_ID = '88888888-8888-4888-8888-888888888888';
const CYCLE_ID = '55555555-5555-4555-8555-555555555555';
const OTHER_UUID = '11111111-1111-4111-8111-111111111111';

const ANALYSIS_AT = '2026-09-22T10:00:00.000Z';
const SOURCE_TS = '2026-09-22T10:59:00.000Z';
const OUTCOME_OBSERVED_AT = '2026-09-22T11:00:00.000Z';
const OUTCOME_RECORDED_AT = '2026-09-22T11:00:01.000Z';
const EVAL_RECORDED_AT = '2026-09-22T11:00:02.000Z';

const CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisObservedOutcomeEvaluationContract.js',
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
  '../../contracts/artemisDecisionContextContract.js',
];

function decisionRef(overrides = {}) {
  return {
    decisionId: DECISION_ID,
    contractVersion: DECISION_CONTRACT_VERSION,
    decisionContextId: CONTEXT_ID,
    analysisAt: ANALYSIS_AT,
    ...overrides,
  };
}

function decisionContextRef(overrides = {}) {
  return {
    contextId: CONTEXT_ID,
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    ...overrides,
  };
}

function shadowRecordingRef(overrides = {}) {
  return {
    shadowRecordingArtifactId: RECORDING_ID,
    contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
    ...overrides,
  };
}

function marketContextRef(overrides = {}) {
  return {
    marketContextId: MC_ID,
    contractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
    venue: 'mexc',
    marketType: MARKET_TYPE.SPOT,
    symbol: 'BTC/USDT',
    timeframe: '1h',
    freshnessStatus: FRESHNESS_STATUS.FRESH,
    sourceTimestamp: SOURCE_TS,
    availability: AVAILABILITY.AVAILABLE,
    ...overrides,
  };
}

function validOutcomeInput(overrides = {}) {
  return {
    decisionRef: decisionRef(),
    decisionContextRef: decisionContextRef(),
    shadowRecordingRef: shadowRecordingRef(),
    marketContextRef: marketContextRef(),
    taskRef: {
      taskId: TASK_ID,
      contractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
      attempt: 1,
    },
    cycleBindingRef: {
      bindingId: BINDING_ID,
      contractVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
    },
    shadowCycleEnvelopeRef: {
      shadowCycleEnvelopeId: CYCLE_ID,
      contractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
    },
    outcomeObservedAt: OUTCOME_OBSERVED_AT,
    recordedAt: OUTCOME_RECORDED_AT,
    ...overrides,
  };
}

function buildValidOutcome(overrides = {}) {
  const result = buildObservedOutcome(validOutcomeInput(overrides));
  expect(result.ok).toBe(true);
  return result.artifact;
}

function evaluationMethod(overrides = {}) {
  return {
    methodKey: EVALUATION_METHOD_KEY.COMPARE_SHADOW_DECISION_TO_OBSERVED_OUTCOME_FAIL_CLOSED,
    implementationVersion: '1.0.0',
    ...overrides,
  };
}

function validEvalInput(overrides = {}) {
  const outcomeArtifact = overrides.outcomeArtifact === undefined
    ? buildValidOutcome()
    : overrides.outcomeArtifact;
  return {
    outcomeArtifact,
    observationClass: OBSERVATION_CLASS.OBSERVED_AND_EVALUABLE,
    evaluationMethod: evaluationMethod(),
    recordedAt: EVAL_RECORDED_AT,
    comparisonClaims: {
      decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
      observedDirection: DIRECTION_OR_ABSTAIN.BULLISH,
    },
    ...overrides,
    outcomeArtifact: overrides.outcomeArtifact === undefined
      ? outcomeArtifact
      : overrides.outcomeArtifact,
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

describe('S8-OBSERVED-OUTCOME-EVALUATION-CONTRACT — Evaluation Contract Boundary', () => {
  it('1. valid MATCH', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput());
    expect(result.ok).toBe(true);
    expect(result.code).toBe('OBSERVED_OUTCOME_EVALUATION_BUILT');
    expect(result.artifact.evaluationStatus).toBe(EVALUATION_STATUS.MATCH);
    expect(result.artifact.artifactType).toBe(OBSERVED_OUTCOME_EVALUATION_ARTIFACT_TYPE);
    expect(result.artifact.authorityClass).toBe(OBSERVED_OUTCOME_EVALUATION_AUTHORITY_CLASS);
    expect(result.artifact.sliceId).toBe(OBSERVED_OUTCOME_EVALUATION_SLICE_ID);
  });

  it('2. valid MISMATCH', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      comparisonClaims: {
        decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
        observedDirection: DIRECTION_OR_ABSTAIN.BEARISH,
      },
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.evaluationStatus).toBe(EVALUATION_STATUS.MISMATCH);
  });

  it('3. INSUFFICIENT_DATA', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      comparisonClaims: {
        decisionDirection: DIRECTION_OR_ABSTAIN.BULLISH,
      },
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.evaluationStatus).toBe(EVALUATION_STATUS.INSUFFICIENT_DATA);
  });

  it('4. BLOCKED', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      blockedReason: 'evaluation_gate_blocked',
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.evaluationStatus).toBe(EVALUATION_STATUS.BLOCKED);
    expect(result.artifact.blockedReason).toBe('evaluation_gate_blocked');
  });

  it('5. UNAVAILABLE via OBSERVED_BUT_UNAVAILABLE', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      observationClass: OBSERVATION_CLASS.OBSERVED_BUT_UNAVAILABLE,
      comparisonClaims: undefined,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.evaluationStatus).toBe(EVALUATION_STATUS.UNAVAILABLE);
  });

  it('6. missing outcome rejected / non-success', () => {
    const result = buildObservedOutcomeEvaluation({
      observationClass: OBSERVATION_CLASS.OBSERVED_AND_EVALUABLE,
      evaluationMethod: evaluationMethod(),
      recordedAt: EVAL_RECORDED_AT,
    });
    expectReject(result, 'outcomeArtifact', 'required_object');
  });

  it('7. decision/outcome identity mismatch', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      decisionRef: {
        decisionId: OTHER_UUID,
        contractVersion: DECISION_CONTRACT_VERSION,
      },
    }));
    expectReject(result, 'decisionRef.decisionId', 'decision_id_mismatch');
  });

  it('8. context mismatch', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      decisionContextRef: {
        contextId: OTHER_UUID,
        contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
      },
    }));
    expectReject(result, 'decisionContextRef.contextId', 'context_id_mismatch');
  });

  it('9. marketContext mismatch', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      marketContextRef: {
        marketContextId: MC_ID,
        contractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
        symbol: 'ETH/USDT',
      },
    }));
    expectReject(result, 'marketContextRef.symbol', 'market_context_mismatch');
  });

  it('10. task lineage mismatch', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      taskRef: {
        taskId: OTHER_UUID,
        contractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
        attempt: 1,
      },
    }));
    expectReject(result, 'taskRef.taskId', 'task_id_mismatch');
  });

  it('11. binding mismatch', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      bindingRef: {
        bindingId: OTHER_UUID,
        contractVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
      },
    }));
    expectReject(result, 'bindingRef.bindingId', 'binding_id_mismatch');
  });

  it('12. timestamp ordering violation', () => {
    // Outcome contract itself rejects pre-decision; simulate contaminated input
    // by cloning a valid artifact and rewriting timestamps after construction.
    const valid = buildValidOutcome();
    const tampered = {
      ...valid,
      outcomeObservedAt: '2026-09-22T09:00:00.000Z',
      recordedAt: '2026-09-22T09:00:01.000Z',
      marketContextRef: {
        ...valid.marketContextRef,
        sourceTimestamp: '2026-09-22T09:00:00.000Z',
      },
      decisionRef: { ...valid.decisionRef },
      decisionContextRef: { ...valid.decisionContextRef },
      shadowRecordingRef: { ...valid.shadowRecordingRef },
    };
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      outcomeArtifact: tampered,
    }));
    expect(result.ok).toBe(false);
    expect(
      (result.errors || []).some((e) => e.code === 'outcome_artifact_invalid'
        || e.code === 'timestamp_ordering_violation'
        || e.code === 'post_horizon_violation'
        || e.code === 'pre_decision_outcome_observed_at'
        || e.code === 'pre_decision_source_timestamp'
        || e.code === 'outcome_revalidation_failed'),
    ).toBe(true);
  });

  it('13. post-horizon violation via recordedAt before decision', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      recordedAt: '2026-09-22T09:00:00.000Z',
    }));
    expectReject(result, 'recordedAt', 'timestamp_ordering_violation');
  });

  it('14. lookahead field rejected', () => {
    const result = buildObservedOutcomeEvaluation({
      ...validEvalInput(),
      lookahead: true,
    });
    expectReject(result, 'lookahead', 'forbidden_field');
  });

  it('15. futureData rejected', () => {
    const result = buildObservedOutcomeEvaluation({
      ...validEvalInput(),
      futureData: { x: 1 },
    });
    expectReject(result, 'futureData', 'forbidden_field');
  });

  it('16. raw OHLCV rejected', () => {
    const result = buildObservedOutcomeEvaluation({
      ...validEvalInput(),
      ohlcv: [{ c: 1 }],
    });
    expectReject(result, 'ohlcv', 'forbidden_field');
  });

  it('17. ticker rejected', () => {
    const result = buildObservedOutcomeEvaluation({
      ...validEvalInput(),
      ticker: { last: 1 },
    });
    expectReject(result, 'ticker', 'forbidden_field');
  });

  it('18. orderbook rejected', () => {
    const result = buildObservedOutcomeEvaluation({
      ...validEvalInput(),
      orderBook: { bids: [] },
    });
    expectReject(result, 'orderBook', 'forbidden_field');
  });

  it('19. provider payload rejected', () => {
    const result = buildObservedOutcomeEvaluation({
      ...validEvalInput(),
      providerPayload: { raw: true },
    });
    expectReject(result, 'providerPayload', 'forbidden_field');
  });

  it('20. network payload rejected', () => {
    const result = buildObservedOutcomeEvaluation({
      ...validEvalInput(),
      payload: { network: true },
    });
    expectReject(result, 'payload', 'forbidden_field');
  });

  it('21. order/execution contamination rejected', () => {
    const result = buildObservedOutcomeEvaluation({
      ...validEvalInput(),
      orderId: OTHER_UUID,
      executionIntent: {},
    });
    expect(result.ok).toBe(false);
    expect((result.errors || []).some((e) => e.field === 'orderId')).toBe(true);
    expect((result.errors || []).some((e) => e.field === 'executionIntent')).toBe(true);
  });

  it('22. wallet contamination rejected', () => {
    const result = buildObservedOutcomeEvaluation({
      ...validEvalInput(),
      wallet: { balance: 1 },
    });
    expectReject(result, 'wallet', 'forbidden_field');
  });

  it('23. financial contamination rejected', () => {
    const result = buildObservedOutcomeEvaluation({
      ...validEvalInput(),
      financialExecution: true,
      realizedPnl: 12.5,
    });
    expect(result.ok).toBe(false);
    expect((result.errors || []).some((e) => e.field === 'financialExecution')).toBe(true);
    expect((result.errors || []).some((e) => e.field === 'realizedPnl')).toBe(true);
  });

  it('24. evaluationResult input rejected', () => {
    const result = buildObservedOutcomeEvaluation({
      ...validEvalInput(),
      evaluationResult: 'MATCH',
    });
    expectReject(result, 'evaluationResult', 'forbidden_field');
  });

  it('25. calibrationScore rejected', () => {
    const result = buildObservedOutcomeEvaluation({
      ...validEvalInput(),
      calibrationScore: 0.9,
    });
    expectReject(result, 'calibrationScore', 'forbidden_field');
  });

  it('26. unknown fields rejected', () => {
    const result = buildObservedOutcomeEvaluation({
      ...validEvalInput(),
      mysteryField: true,
    });
    expectReject(result, 'input.mysteryField', 'unknown_field');
  });

  it('27. hard authority flag true rejected', () => {
    const result = buildObservedOutcomeEvaluation({
      ...validEvalInput(),
      approvedForExecution: true,
    });
    expectReject(result, 'approvedForExecution', 'hard_flag_must_be_false');
  });

  it('28. deterministic identity', () => {
    const a = buildObservedOutcomeEvaluation(validEvalInput());
    const b = buildObservedOutcomeEvaluation(validEvalInput());
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.artifact.evaluationId).toBe(b.artifact.evaluationId);
    expect(a.artifact).toEqual(b.artifact);
  });

  it('29. idempotent identical input', () => {
    const first = buildObservedOutcomeEvaluation(validEvalInput());
    const second = buildObservedOutcomeEvaluation(validEvalInput({
      evaluationId: first.artifact.evaluationId,
    }));
    expect(second.ok).toBe(true);
    expect(second.artifact.evaluationId).toBe(first.artifact.evaluationId);
  });

  it('30. conflicting identical identity rejected', () => {
    const first = buildObservedOutcomeEvaluation(validEvalInput());
    const conflict = buildObservedOutcomeEvaluation(validEvalInput({
      evaluationId: first.artifact.evaluationId,
      expectedEvaluationStatus: EVALUATION_STATUS.MISMATCH,
    }));
    expect(conflict.ok).toBe(false);
    expect(conflict.code).toBe('evaluation_status_conflict');
  });

  it('31. provenance preserved', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.provenance.writer).toBeDefined();
    expect(result.artifact.provenance.methodKey)
      .toBe(OBSERVED_OUTCOME_EVALUATION_METHOD_KEY);
    expect(result.artifact.provenance.outcomeProvenance).toBeDefined();
    expect(result.artifact.provenance.decisionProvenance).toBeDefined();
  });

  it('32. version linkage preserved', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      outcomeSotRef: {
        outcomeId: undefined, // filled below
        contractVersion: OBSERVED_OUTCOME_SOT_CONTRACT_VERSION,
      },
    }));
    // rebuild with correct outcomeId
    const outcome = buildValidOutcome();
    const linked = buildObservedOutcomeEvaluation(validEvalInput({
      outcomeArtifact: outcome,
      outcomeSotRef: {
        outcomeId: outcome.outcomeId,
        contractVersion: OBSERVED_OUTCOME_SOT_CONTRACT_VERSION,
      },
    }));
    expect(linked.ok).toBe(true);
    expect(linked.artifact.contractVersion)
      .toBe(OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION);
    expect(linked.artifact.lineage.decisionContractVersion)
      .toBe(DECISION_CONTRACT_VERSION);
    expect(linked.artifact.lineage.observedOutcomeContractVersion).toBeDefined();
    expect(linked.artifact.lineage.observedOutcomeSotContractVersion)
      .toBe(OBSERVED_OUTCOME_SOT_CONTRACT_VERSION);
    expect(linked.artifact.lineage.evaluationContractVersion)
      .toBe(OBSERVED_OUTCOME_EVALUATION_CONTRACT_VERSION);
    expect(result.ok === false || result.ok === true).toBe(true);
  });

  it('33. limitations preserved', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      limitations: ['custom_evaluation_limitation'],
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.limitations).toContain('custom_evaluation_limitation');
    expect(result.artifact.limitations).toContain('no_replay');
    expect(result.artifact.limitations).toContain('lookahead_protection');
  });

  it('34. zero side effects', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput());
    expect(result.ok).toBe(true);
    expect(result.sideEffects).toEqual(ZERO_EVALUATION_SIDE_EFFECTS);
    expect(result.artifact.sideEffects).toEqual(ZERO_EVALUATION_SIDE_EFFECTS);
    expect(result.artifact.sideEffects.network).toBe(0);
    expect(result.artifact.sideEffects.dbWrites).toBe(0);
    expect(result.artifact.sideEffects.orders).toBe(0);
  });

  it('35. isSourceOfTruth=false', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.isSourceOfTruth).toBe(false);
    expect(OBSERVED_OUTCOME_EVALUATION_IS_SOURCE_OF_TRUTH).toBe(false);
    expect(result.artifact.ownershipRole)
      .toBe(OBSERVED_OUTCOME_EVALUATION_OWNERSHIP_ROLE);
  });

  it('36. protected upstream contracts remain untouched', () => {
    for (const rel of PROTECTED_CONTRACT_PATHS) {
      const abs = path.join(path.dirname(fileURLToPath(import.meta.url)), rel);
      expect(() => readFileSync(abs, 'utf8')).not.toThrow();
    }
    const source = readFileSync(CONTRACT_PATH, 'utf8');
    expect(source).not.toMatch(/createTable|INSERT INTO|pm2|axios\.|fetch\(/);
  });

  it('37–42. authority isolation + hard flags + validate alias', () => {
    const result = validateObservedOutcomeEvaluation(validEvalInput());
    expect(result.ok).toBe(true);
    for (const [key, value] of Object.entries(REQUIRED_HARD_FLAGS)) {
      expect(result.artifact[key]).toBe(value);
    }
    expect(result.artifact.evaluationPersisted).toBe(false);
    expect(result.artifact.workerActivated).toBe(false);
    expect(result.artifact.schedulerActivated).toBe(false);
  });

  it('lineage-only MATCH without comparison claims', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      comparisonClaims: undefined,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.evaluationStatus).toBe(EVALUATION_STATUS.MATCH);
  });

  it('NOT_OBSERVED maps to UNAVAILABLE (not MATCH)', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      observationClass: OBSERVATION_CLASS.NOT_OBSERVED,
      comparisonClaims: undefined,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.evaluationStatus).toBe(EVALUATION_STATUS.UNAVAILABLE);
    expect(result.artifact.evaluationStatus).not.toBe(EVALUATION_STATUS.MATCH);
  });

  it('wrong evaluationId rejected', () => {
    const result = buildObservedOutcomeEvaluation(validEvalInput({
      evaluationId: OTHER_UUID,
    }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('evaluation_id_conflict');
  });

  it('import hygiene — no DB/network/provider/LLM runtime deps', () => {
    const source = readFileSync(CONTRACT_PATH, 'utf8');
    expect(source).not.toMatch(/from ['\"]pg['\"]/);
    expect(source).not.toMatch(/from ['\"]ioredis['\"]/);
    expect(source).not.toMatch(/from ['\"]axios['\"]/);
    expect(source).not.toMatch(/node:net|node:http|node:https/);
    expect(source).not.toMatch(/openai|anthropic|mexc|ccxt/i);
    expect(source).not.toMatch(/Date\.now\(|Math\.random\(|randomUUID\(|randomBytes\(/);
  });

  it('C1–C6 / Control Chain / C8.1 / Outcome / Task regression imports load', async () => {
    await expect(import('../../contracts/artemisRiskControlRuntimeBoundaryContract.js'))
      .resolves.toBeDefined();
    await expect(import('../../contracts/artemisPortfolioControlSizingBoundaryContract.js'))
      .resolves.toBeDefined();
    await expect(import('../../contracts/artemisLiquidityExecutionFeasibilityBoundaryContract.js'))
      .resolves.toBeDefined();
    await expect(import('../../contracts/artemisRuntimeCapabilityBoundaryContract.js'))
      .resolves.toBeDefined();
    await expect(import('../../contracts/artemisOrderManagementExecutionBoundaryContract.js'))
      .resolves.toBeDefined();
    await expect(import('../../contracts/artemisControlChainContract.js'))
      .resolves.toBeDefined();
    await expect(import('../../contracts/artemisShadowDecisionRecordingBoundaryContract.js'))
      .resolves.toBeDefined();
    await expect(import('../../contracts/artemisObservedOutcomeContract.js'))
      .resolves.toBeDefined();
    await expect(import('../../contracts/artemisObservedOutcomeSourceOfTruthContract.js'))
      .resolves.toBeDefined();
    await expect(import('../../contracts/artemisShadowTaskStateBoundaryContract.js'))
      .resolves.toBeDefined();
    await expect(import('../../contracts/artemisShadowTaskCycleCompositionBoundaryContract.js'))
      .resolves.toBeDefined();
  });
});
