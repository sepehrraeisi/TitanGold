/**
 * @jest-environment node
 *
 * Artemis Core Stage 8 — S8-SHADOW-TASK-CYCLE-BINDING
 * Shadow Task Cycle Composition Boundary unit tests.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
  DECISION_MATURITY_MODE,
} from '../../contracts/artemisDecisionContextContract.js';
import { DECISION_CONTRACT_VERSION } from '../../contracts/artemisDecisionContract.js';
import { ORCHESTRATION_CONTRACT_VERSION } from '../../contracts/artemisEvidenceOrchestrationContract.js';
import { CONTROL_CHAIN_CONTRACT_VERSION } from '../../contracts/artemisControlChainContract.js';
import { MARKET_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisMarketContextContract.js';
import { SHADOW_RECORDING_CONTRACT_VERSION } from '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js';
import { SHADOW_RUNTIME_CONTRACT_VERSION } from '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js';
import {
  SHADOW_TASK_STATE_ARTIFACT_TYPE,
  SHADOW_TASK_STATE_CONTRACT_VERSION,
  SHADOW_TASK_STATUS,
  SHADOW_TASK_TYPE,
  buildShadowTaskState,
} from '../../contracts/artemisShadowTaskStateBoundaryContract.js';
import {
  REQUIRED_HARD_FLAGS,
  SHADOW_TASK_CYCLE_BINDING_ARTIFACT_TYPE,
  SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
  SHADOW_TASK_CYCLE_BINDING_LIMITATIONS,
  SHADOW_TASK_CYCLE_BINDING_METHOD_KEY,
  SHADOW_TASK_CYCLE_BINDING_POLICY_VERSION,
  SHADOW_TASK_CYCLE_BINDING_SCHEMA_VERSION,
  SHADOW_TASK_CYCLE_BINDING_STAGE,
  SHADOW_TASK_CYCLE_BINDING_WRITER,
  ZERO_SHADOW_TASK_CYCLE_BINDING_SIDE_EFFECTS,
  buildShadowTaskCycleBinding,
  validateShadowTaskCycleBinding,
} from '../../contracts/artemisShadowTaskCycleCompositionBoundaryContract.js';

const MC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORCH_ID = '33333333-3333-4333-8333-333333333333';
const CONTROL_ID = '44444444-4444-4444-8444-444444444444';
const CYCLE_ID = '55555555-5555-4555-8555-555555555555';
const RECORDING_ID = '66666666-6666-4666-8666-666666666666';
const CORRELATION_ID = '77777777-7777-4777-8777-777777777777';
const OTHER_TASK_ID = '88888888-8888-4888-8888-888888888888';
const CREATED_AT = '2026-09-20T11:00:00.000Z';
const TASK_RECORDED_AT = '2026-09-20T12:00:00.000Z';
const BIND_RECORDED_AT = '2026-09-20T12:05:00.000Z';

const CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisShadowTaskCycleCompositionBoundaryContract.js',
);

function thinMarketContextRef(overrides = {}) {
  return {
    marketContextId: MC_ID,
    contractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
    ...overrides,
  };
}

function fullMarketContextRef(overrides = {}) {
  return {
    marketContextId: MC_ID,
    contractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
    venue: 'mexc',
    marketType: 'spot',
    symbol: 'BTC/USDT',
    timeframe: '1h',
    freshnessStatus: 'FRESH',
    sourceTimestamp: '2026-09-20T11:59:00.000Z',
    availability: 'available',
    ...overrides,
  };
}

function decisionContextRef(overrides = {}) {
  return {
    contextId: CONTEXT_ID,
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    maturity: DECISION_MATURITY_MODE.SHADOW,
    ...overrides,
  };
}

function allRefs(overrides = {}) {
  return {
    marketContextRef: thinMarketContextRef(),
    decisionContextRef: decisionContextRef(),
    decisionRef: { decisionId: DECISION_ID, contractVersion: DECISION_CONTRACT_VERSION },
    evidenceOrchestrationRef: {
      orchestrationId: ORCH_ID,
      contractVersion: ORCHESTRATION_CONTRACT_VERSION,
    },
    controlChainRef: {
      controlChainArtifactId: CONTROL_ID,
      contractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
    },
    shadowCycleEnvelopeRef: {
      shadowCycleEnvelopeId: CYCLE_ID,
      contractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
    },
    shadowRecordingRef: {
      shadowRecordingArtifactId: RECORDING_ID,
      contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
      maturity: DECISION_MATURITY_MODE.SHADOW,
    },
    ...overrides,
  };
}

function readyTaskState(overrides = {}) {
  const result = buildShadowTaskState({
    taskType: SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE,
    status: SHADOW_TASK_STATUS.READY,
    createdAt: CREATED_AT,
    recordedAt: TASK_RECORDED_AT,
    attempt: 1,
    correlationId: CORRELATION_ID,
    marketContextRef: fullMarketContextRef(),
    decisionContextRef: decisionContextRef(),
    ...allRefs(),
    ...overrides,
  });
  if (!result.ok) {
    throw new Error(`READY task state fixture failed: ${result.code} ${JSON.stringify(result.errors)}`);
  }
  return result.artifact;
}

function baseBindingInput(overrides = {}) {
  const taskState = overrides.taskState !== undefined
    ? overrides.taskState
    : readyTaskState();
  return {
    taskState,
    recordedAt: BIND_RECORDED_AT,
    ...allRefs(),
    ...overrides,
    taskState: overrides.taskState !== undefined ? overrides.taskState : taskState,
  };
}

describe('S8-SHADOW-TASK-CYCLE-BINDING — Shadow Task Cycle Composition Boundary', () => {
  it('1. valid READY binding', () => {
    const result = buildShadowTaskCycleBinding(baseBindingInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.artifactType).toBe(SHADOW_TASK_CYCLE_BINDING_ARTIFACT_TYPE);
    expect(result.artifact.contractVersion).toBe(SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION);
    expect(result.artifact.schemaVersion).toBe(SHADOW_TASK_CYCLE_BINDING_SCHEMA_VERSION);
    expect(result.artifact.policyVersion).toBe(SHADOW_TASK_CYCLE_BINDING_POLICY_VERSION);
    expect(result.artifact.taskType).toBe(SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE);
    expect(result.artifact.taskStateRef.status).toBe(SHADOW_TASK_STATUS.READY);
    expect(result.artifact.shadowCycleEnvelopeRef.shadowCycleEnvelopeId).toBe(CYCLE_ID);
    expect(result.artifact.shadowRecordingRef.shadowRecordingArtifactId).toBe(RECORDING_ID);
    expect(result.taskStateMutation).toBe(0);
  });

  it('2. deterministic identical output', () => {
    const a = buildShadowTaskCycleBinding(baseBindingInput());
    const b = buildShadowTaskCycleBinding(baseBindingInput());
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.artifact.bindingId).toBe(b.artifact.bindingId);
    expect(JSON.stringify(a.artifact)).toBe(JSON.stringify(b.artifact));
  });

  it('3. missing Task State', () => {
    const result = buildShadowTaskCycleBinding({
      recordedAt: BIND_RECORDED_AT,
      ...allRefs(),
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('missing_task_state');
  });

  it('4. wrong Task State status', () => {
    const created = buildShadowTaskState({
      taskType: SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE,
      status: SHADOW_TASK_STATUS.CREATED,
      createdAt: CREATED_AT,
      recordedAt: TASK_RECORDED_AT,
      attempt: 1,
      marketContextRef: fullMarketContextRef(),
    });
    expect(created.ok).toBe(true);
    const result = buildShadowTaskCycleBinding(baseBindingInput({ taskState: created.artifact }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('task_state_not_ready');
  });

  it('5. wrong taskType', () => {
    const taskState = readyTaskState();
    const mutated = { ...taskState, taskType: 'OTHER_TYPE' };
    Object.setPrototypeOf(mutated, null);
    const result = buildShadowTaskCycleBinding(baseBindingInput({ taskState: mutated }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('invalid_task_type');
  });

  it('6. missing taskId on Task State', () => {
    const taskState = readyTaskState();
    const { taskId, ...rest } = taskState;
    const result = buildShadowTaskCycleBinding(baseBindingInput({ taskState: rest }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('missing_task_id');
  });

  it('7. taskId mismatch', () => {
    const taskState = readyTaskState();
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      taskState,
      taskId: OTHER_TASK_ID,
    }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('task_id_mismatch');
  });

  it('8. attempt mismatch', () => {
    const taskState = readyTaskState();
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      taskState,
      attempt: 99,
    }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('attempt_mismatch');
  });

  it('9. malformed recordedAt', () => {
    expect(buildShadowTaskCycleBinding(baseBindingInput({ recordedAt: 'not-iso' })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ recordedAt: undefined })).code)
      .toBe('invalid_recorded_at');
  });

  it('10. marketContextId mismatch', () => {
    const taskState = readyTaskState();
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      taskState,
      marketContextRef: thinMarketContextRef({
        marketContextId: '99999999-9999-4999-8999-999999999999',
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'marketContextRef_mismatch' })]),
    );
  });

  it('11. contextId mismatch', () => {
    const taskState = readyTaskState();
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      taskState,
      decisionContextRef: decisionContextRef({
        contextId: '99999999-9999-4999-8999-999999999999',
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'decisionContextRef_mismatch' })]),
    );
  });

  it('12. decisionId mismatch', () => {
    const taskState = readyTaskState();
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      taskState,
      decisionRef: {
        decisionId: '99999999-9999-4999-8999-999999999999',
        contractVersion: DECISION_CONTRACT_VERSION,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'decisionRef_mismatch' })]),
    );
  });

  it('13. orchestrationId mismatch', () => {
    const taskState = readyTaskState();
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      taskState,
      evidenceOrchestrationRef: {
        orchestrationId: '99999999-9999-4999-8999-999999999999',
        contractVersion: ORCHESTRATION_CONTRACT_VERSION,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'evidenceOrchestrationRef_mismatch' })]),
    );
  });

  it('14. controlChainArtifactId mismatch', () => {
    const taskState = readyTaskState();
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      taskState,
      controlChainRef: {
        controlChainArtifactId: '99999999-9999-4999-8999-999999999999',
        contractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'controlChainRef_mismatch' })]),
    );
  });

  it('15. shadowCycleEnvelopeId mismatch', () => {
    const taskState = readyTaskState();
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      taskState,
      shadowCycleEnvelopeRef: {
        shadowCycleEnvelopeId: '99999999-9999-4999-8999-999999999999',
        contractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'shadowCycleEnvelopeRef_mismatch' })]),
    );
  });

  it('16. shadowRecordingArtifactId mismatch', () => {
    const taskState = readyTaskState();
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      taskState,
      shadowRecordingRef: {
        shadowRecordingArtifactId: '99999999-9999-4999-8999-999999999999',
        contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
        maturity: DECISION_MATURITY_MODE.SHADOW,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'shadowRecordingRef_mismatch' })]),
    );
  });

  it('17. maturity mismatch', () => {
    const taskState = readyTaskState();
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      taskState,
      decisionContextRef: decisionContextRef({ maturity: 'live' }),
      shadowRecordingRef: {
        shadowRecordingArtifactId: RECORDING_ID,
        contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
        maturity: 'live',
      },
    }));
    expect(result.ok).toBe(false);
  });

  it('18. unknown fields', () => {
    const result = buildShadowTaskCycleBinding(baseBindingInput({ unexpectedField: true }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('unknown_field');
  });

  it('19. runId contamination', () => {
    const result = buildShadowTaskCycleBinding(baseBindingInput({ runId: 'r1' }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'forbidden_run_id' })]),
    );
  });

  it('20. worker/lease/lock contamination', () => {
    expect(buildShadowTaskCycleBinding(baseBindingInput({ workerId: 'w1' })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ lease: {} })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ lock: {} })).ok).toBe(false);
  });

  it('21. scheduler contamination', () => {
    expect(buildShadowTaskCycleBinding(baseBindingInput({ scheduler: {} })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ scheduleAt: BIND_RECORDED_AT })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ shadowScheduler: true })).ok).toBe(false);
  });

  it('22. queue contamination', () => {
    expect(buildShadowTaskCycleBinding(baseBindingInput({ queueState: {} })).ok).toBe(false);
  });

  it('23. order/execution contamination', () => {
    expect(buildShadowTaskCycleBinding(baseBindingInput({ order: {} })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ orderId: 'o1' })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ executionIntent: {} })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ executionCommand: {} })).ok).toBe(false);
  });

  it('24. wallet/transfer/withdrawal contamination', () => {
    expect(buildShadowTaskCycleBinding(baseBindingInput({ transfer: {} })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ withdrawal: {} })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ walletAction: {} })).ok).toBe(false);
  });

  it('25. provider/network contamination', () => {
    expect(buildShadowTaskCycleBinding(baseBindingInput({ providerPayload: {} })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ apiKey: 'k' })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ credentials: {} })).ok).toBe(false);
  });

  it('26. raw market contamination', () => {
    expect(buildShadowTaskCycleBinding(baseBindingInput({ ohlcv: [] })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ ticker: {} })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ orderBook: {} })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ candles: [] })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ rawSeries: [] })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ marketSnapshot: {} })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ bid: 1, ask: 2, spread: 1 })).ok).toBe(false);
  });

  it('27. outcome/lookahead contamination', () => {
    expect(buildShadowTaskCycleBinding(baseBindingInput({ observedOutcome: {} })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ realizedPnl: 1 })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ evaluationResult: {} })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ calibrationScore: 1 })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ lookahead: true })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ prompt: 'x' })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ modelResponse: {} })).ok).toBe(false);
  });

  it('28. B10 contamination', () => {
    expect(buildShadowTaskCycleBinding(baseBindingInput({ b10: true })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({ shadowWorker: true })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({
      emergencyStopClear: true,
    })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({
      requestedRuntimeMode: 'live',
    })).ok).toBe(false);
    expect(buildShadowTaskCycleBinding(baseBindingInput({
      effectiveRuntimeMode: 'live',
    })).ok).toBe(false);
  });

  it('29. authority=true rejection', () => {
    for (const key of Object.keys(REQUIRED_HARD_FLAGS)) {
      const result = buildShadowTaskCycleBinding(baseBindingInput({ [key]: true }));
      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: key, code: 'authority_flag_must_be_false' }),
        ]),
      );
    }
  });

  it('30. hard-false output flags', () => {
    const result = buildShadowTaskCycleBinding(baseBindingInput());
    expect(result.ok).toBe(true);
    for (const [key, value] of Object.entries(REQUIRED_HARD_FLAGS)) {
      expect(result.artifact[key]).toBe(value);
      expect(result.artifact[key]).toBe(false);
    }
  });

  it('31. deterministic bindingId', () => {
    const a = buildShadowTaskCycleBinding(baseBindingInput());
    const b = buildShadowTaskCycleBinding(baseBindingInput());
    expect(a.artifact.bindingId).toBe(b.artifact.bindingId);
    expect(a.artifact.bindingId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('32. different attempt behavior', () => {
    const t1 = readyTaskState({ attempt: 1 });
    const t2 = buildShadowTaskState({
      taskType: SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE,
      status: SHADOW_TASK_STATUS.READY,
      createdAt: CREATED_AT,
      recordedAt: TASK_RECORDED_AT,
      attempt: 2,
      correlationId: CORRELATION_ID,
      marketContextRef: fullMarketContextRef(),
      decisionContextRef: decisionContextRef(),
      ...allRefs(),
    });
    expect(t2.ok).toBe(true);
    expect(t1.taskId).not.toBe(t2.artifact.taskId);
    const b1 = buildShadowTaskCycleBinding(baseBindingInput({ taskState: t1 }));
    const b2 = buildShadowTaskCycleBinding(baseBindingInput({ taskState: t2.artifact }));
    expect(b1.ok).toBe(true);
    expect(b2.ok).toBe(true);
    expect(b1.artifact.bindingId).not.toBe(b2.artifact.bindingId);
    expect(b1.artifact.attempt).toBe(1);
    expect(b2.artifact.attempt).toBe(2);
  });

  it('33. same task + different refs rejection', () => {
    const first = buildShadowTaskCycleBinding(baseBindingInput());
    expect(first.ok).toBe(true);
    const conflict = buildShadowTaskCycleBinding(baseBindingInput({
      existingArtifact: first.artifact,
      decisionRef: {
        decisionId: '99999999-9999-4999-8999-999999999999',
        contractVersion: DECISION_CONTRACT_VERSION,
      },
      // Drop taskState decisionRef match by using task state without decisionRef override conflict
      // Force mismatch via existingArtifact fingerprint vs next refs — remove taskState decisionRef
      taskState: (() => {
        const ts = readyTaskState();
        const { decisionRef, ...rest } = ts;
        return rest;
      })(),
    }));
    // When taskState lacks decisionRef, input decisionRef is used; existingArtifact has different decisionId
    expect(conflict.ok).toBe(false);
    expect(conflict.code).toBe('task_ref_lineage_conflict');
  });

  it('34. same envelope + different task rejection', () => {
    const first = buildShadowTaskCycleBinding(baseBindingInput());
    expect(first.ok).toBe(true);
    const otherTask = buildShadowTaskState({
      taskType: SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE,
      status: SHADOW_TASK_STATUS.READY,
      createdAt: CREATED_AT,
      recordedAt: TASK_RECORDED_AT,
      attempt: 1,
      correlationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',
      marketContextRef: fullMarketContextRef({
        marketContextId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc',
      }),
      decisionContextRef: decisionContextRef({
        contextId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccd',
      }),
      ...allRefs({
        marketContextRef: thinMarketContextRef({
          marketContextId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc',
        }),
        decisionContextRef: decisionContextRef({
          contextId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccd',
        }),
      }),
    });
    expect(otherTask.ok).toBe(true);
    expect(otherTask.artifact.taskId).not.toBe(first.artifact.taskId);
    const conflict = buildShadowTaskCycleBinding(baseBindingInput({
      taskState: otherTask.artifact,
      existingArtifact: first.artifact,
      marketContextRef: thinMarketContextRef({
        marketContextId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc',
      }),
      decisionContextRef: decisionContextRef({
        contextId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccd',
      }),
    }));
    expect(conflict.ok).toBe(false);
    expect(conflict.code).toBe('envelope_task_lineage_conflict');
  });

  it('35. no embedded upstream payloads', () => {
    const result = buildShadowTaskCycleBinding(baseBindingInput());
    expect(result.ok).toBe(true);
    const keys = Object.keys(result.artifact);
    expect(keys).not.toContain('shadowRecordingArtifact');
    expect(keys).not.toContain('decision');
    expect(keys).not.toContain('evidence');
    expect(keys).not.toContain('evidenceOrchestrationSet');
    expect(keys).not.toContain('controlChain');
    expect(keys).not.toContain('marketContext');
    expect(keys).not.toContain('decisionContext');
    expect(result.artifact.marketContextRef).toEqual({
      marketContextId: MC_ID,
      contractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
    });
  });

  it('36. no duplicate SoT', () => {
    const src = readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).not.toMatch(/isSourceOfTruth\s*=\s*true/);
    expect(src).toMatch(/composition_and_lineage_only/);
    expect(src).toMatch(/does_not_create_parallel_sot/);
  });

  it('37. import hygiene', () => {
    const src = readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).not.toMatch(/from ['"]fs['"]/);
    expect(src).not.toMatch(/from ['"]http['"]/);
    expect(src).not.toMatch(/from ['"]net['"]/);
    expect(src).not.toMatch(/from ['"]pg['"]/);
    expect(src).not.toMatch(/from ['"]ioredis['"]/);
    expect(src).not.toMatch(/from ['"]redis['"]/);
    expect(src).not.toMatch(/openai|anthropic|mexc|ccxt/i);
    expect(src).not.toMatch(/Date\.now\(/);
    expect(src).not.toMatch(/Math\.random\(/);
    expect(src).not.toMatch(/randomUUID\(/);
    expect(src).not.toMatch(/randomBytes\(/);
  });

  it('38. zero side effects', () => {
    const result = buildShadowTaskCycleBinding(baseBindingInput());
    expect(result.ok).toBe(true);
    expect(result.sideEffects).toEqual(ZERO_SHADOW_TASK_CYCLE_BINDING_SIDE_EFFECTS);
    expect(result.artifact.sideEffects).toEqual(ZERO_SHADOW_TASK_CYCLE_BINDING_SIDE_EFFECTS);
    for (const v of Object.values(result.sideEffects)) {
      expect(v).toBe(0);
    }
  });

  it('39. Task State remains unchanged', () => {
    const taskState = readyTaskState();
    const before = JSON.stringify(taskState);
    const result = buildShadowTaskCycleBinding(baseBindingInput({ taskState }));
    expect(result.ok).toBe(true);
    expect(JSON.stringify(taskState)).toBe(before);
    expect(result.taskStateMutation).toBe(0);
    expect(taskState.status).toBe(SHADOW_TASK_STATUS.READY);
  });

  it('40. upstream refs remain unchanged', () => {
    const refs = allRefs();
    const before = JSON.stringify(refs);
    const result = buildShadowTaskCycleBinding(baseBindingInput(refs));
    expect(result.ok).toBe(true);
    expect(JSON.stringify(refs)).toBe(before);
  });

  it('41. C8.1 remains unchanged (read/reference only)', () => {
    const src = readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).toMatch(/c8_1_read_reference_only/);
    expect(src).toMatch(/artemisShadowDecisionRecordingBoundaryContract/);
  });

  it('42. S8-MC-SOT remains unchanged', () => {
    const src = readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).toMatch(/s8_mc_sot_read_reference_only/);
    expect(src).not.toMatch(/artemisMarketContextSourceOfTruthService/);
  });

  it('43. RT boundary remains unchanged', () => {
    const src = readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).toMatch(/s8_shadow_rt_read_reference_only/);
    expect(src).toMatch(/SHADOW_RUNTIME_CONTRACT_VERSION/);
  });

  it('44. C1–C6 regression — contract versions preserved', () => {
    const result = buildShadowTaskCycleBinding(baseBindingInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.controlChainRef.contractVersion).toBe(CONTROL_CHAIN_CONTRACT_VERSION);
    expect(result.artifact.lineage.controlChainContractVersion).toBe(CONTROL_CHAIN_CONTRACT_VERSION);
  });

  it('45. Control Chain regression — thin ref only', () => {
    const result = buildShadowTaskCycleBinding(baseBindingInput());
    expect(result.ok).toBe(true);
    expect(Object.keys(result.artifact.controlChainRef).sort()).toEqual([
      'contractVersion',
      'controlChainArtifactId',
    ]);
  });

  it('46. Decision/Evidence/Orchestration regression — thin refs', () => {
    const result = buildShadowTaskCycleBinding(baseBindingInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.decisionRef.contractVersion).toBe(DECISION_CONTRACT_VERSION);
    expect(result.artifact.evidenceOrchestrationRef.contractVersion)
      .toBe(ORCHESTRATION_CONTRACT_VERSION);
  });

  it('47. unknown field recursive contamination', () => {
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      lineage: { taskId: 'x', unexpectedNested: true },
    }));
    expect(result.ok).toBe(false);
  });

  it('48. forbidden field recursive contamination', () => {
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      provenance: {
        writer: SHADOW_TASK_CYCLE_BINDING_WRITER,
        orderId: 'o1',
      },
    }));
    expect(result.ok).toBe(false);
  });

  it('49. provenance mismatch', () => {
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      provenance: {
        writer: 'spoofed-writer',
        methodKey: SHADOW_TASK_CYCLE_BINDING_METHOD_KEY,
        stage: SHADOW_TASK_CYCLE_BINDING_STAGE,
        recordedAt: BIND_RECORDED_AT,
        note: 'x',
        policyVersion: SHADOW_TASK_CYCLE_BINDING_POLICY_VERSION,
        implementationVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('provenance_mismatch');
  });

  it('50. lineage mismatch', () => {
    const taskState = readyTaskState();
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      taskState,
      lineage: {
        taskId: OTHER_TASK_ID,
        marketContextId: MC_ID,
        contextId: CONTEXT_ID,
        decisionId: DECISION_ID,
        orchestrationId: ORCH_ID,
        controlChainArtifactId: CONTROL_ID,
        shadowCycleEnvelopeId: CYCLE_ID,
        shadowRecordingArtifactId: RECORDING_ID,
        shadowTaskCycleBindingContractVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
        shadowTaskStateContractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
        marketContextContractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
        decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
        decisionContractVersion: DECISION_CONTRACT_VERSION,
        orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION,
        controlChainContractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
        shadowRuntimeContractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
        shadowRecordingContractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('lineage_mismatch');
  });

  it('51. correlationId optional path', () => {
    const without = buildShadowTaskState({
      taskType: SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE,
      status: SHADOW_TASK_STATUS.READY,
      createdAt: CREATED_AT,
      recordedAt: TASK_RECORDED_AT,
      attempt: 1,
      marketContextRef: fullMarketContextRef(),
      decisionContextRef: decisionContextRef(),
      ...allRefs(),
    });
    expect(without.ok).toBe(true);
    expect(without.artifact.correlationId).toBeUndefined();
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      taskState: without.artifact,
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.correlationId).toBeUndefined();

    const withCorr = buildShadowTaskCycleBinding(baseBindingInput());
    expect(withCorr.ok).toBe(true);
    expect(withCorr.artifact.correlationId).toBe(CORRELATION_ID);
  });

  it('52. canonical version mismatch', () => {
    const taskState = readyTaskState();
    const { shadowCycleEnvelopeRef, ...restTs } = taskState;
    const result = buildShadowTaskCycleBinding(baseBindingInput({
      taskState: restTs,
      shadowCycleEnvelopeRef: {
        shadowCycleEnvelopeId: CYCLE_ID,
        contractVersion: 'wrong-version',
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'contract_version_mismatch' })]),
    );
  });

  it('53. contract/policy version validation', () => {
    const result = buildShadowTaskCycleBinding(baseBindingInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.contractVersion).toBe(SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION);
    expect(result.artifact.policyVersion).toBe(SHADOW_TASK_CYCLE_BINDING_POLICY_VERSION);
    expect(result.artifact.provenance.policyVersion).toBe(SHADOW_TASK_CYCLE_BINDING_POLICY_VERSION);
    expect(result.artifact.limitations).toEqual(
      expect.arrayContaining([...SHADOW_TASK_CYCLE_BINDING_LIMITATIONS]),
    );
  });

  it('54. frozen/immutable output', () => {
    const result = buildShadowTaskCycleBinding(baseBindingInput());
    expect(result.ok).toBe(true);
    expect(Object.isFrozen(result.artifact)).toBe(true);
    expect(Object.isFrozen(result.artifact.marketContextRef)).toBe(true);
    expect(Object.isFrozen(result.artifact.lineage)).toBe(true);
    expect(() => {
      result.artifact.bindingId = 'mutated';
    }).toThrow();
  });

  it('55. idempotent replay with existingArtifact', () => {
    const first = buildShadowTaskCycleBinding(baseBindingInput());
    expect(first.ok).toBe(true);
    const second = buildShadowTaskCycleBinding(baseBindingInput({
      existingArtifact: first.artifact,
    }));
    expect(second.ok).toBe(true);
    expect(second.idempotent).toBe(true);
    expect(second.artifact.bindingId).toBe(first.artifact.bindingId);
  });

  it('56. validateShadowTaskCycleBinding alias', () => {
    const a = buildShadowTaskCycleBinding(baseBindingInput());
    const b = validateShadowTaskCycleBinding(baseBindingInput());
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.artifact.bindingId).toBe(b.artifact.bindingId);
  });

  it('57. FAILED / CANCELLED / RUNNING / SUCCEEDED cannot bind', () => {
    for (const status of [
      SHADOW_TASK_STATUS.FAILED,
      SHADOW_TASK_STATUS.CANCELLED,
      SHADOW_TASK_STATUS.RUNNING,
      SHADOW_TASK_STATUS.SUCCEEDED,
    ]) {
      const taskState = {
        ...readyTaskState(),
        status,
        artifactType: SHADOW_TASK_STATE_ARTIFACT_TYPE,
        contractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
      };
      const result = buildShadowTaskCycleBinding(baseBindingInput({ taskState }));
      expect(result.ok).toBe(false);
      expect(result.code).toBe('task_state_not_ready');
    }
  });

  it('58. writer / stage / methodKey constants', () => {
    expect(SHADOW_TASK_CYCLE_BINDING_WRITER)
      .toBe('artemisShadowTaskCycleCompositionBoundaryContract');
    expect(SHADOW_TASK_CYCLE_BINDING_METHOD_KEY)
      .toBe('build_shadow_task_cycle_binding_fail_closed');
    expect(SHADOW_TASK_CYCLE_BINDING_STAGE)
      .toBe('ARTEMIS_CORE_STAGE_8_SHADOW_TASK_CYCLE_COMPOSITION_BOUNDARY');
  });
});
