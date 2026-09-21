/**
 * @jest-environment node
 *
 * Artemis Core Stage 8 — S8-SHADOW-TASK-STATE-ACTIVATION
 * Shadow Task State Activation Boundary unit tests.
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
import {
  SHADOW_CYCLE_ARTIFACT_TYPE,
  SHADOW_RUNTIME_CONTRACT_VERSION,
} from '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js';
import {
  SHADOW_TASK_STATE_CONTRACT_VERSION,
  SHADOW_TASK_STATUS,
  SHADOW_TASK_TYPE,
  buildShadowTaskState,
} from '../../contracts/artemisShadowTaskStateBoundaryContract.js';
import {
  SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
  buildShadowTaskCycleBinding,
} from '../../contracts/artemisShadowTaskCycleCompositionBoundaryContract.js';
import {
  REQUIRED_HARD_FLAGS,
  SHADOW_TASK_STATE_ACTIVATION_ARTIFACT_TYPE,
  SHADOW_TASK_STATE_ACTIVATION_CONTRACT_VERSION,
  SHADOW_TASK_STATE_ACTIVATION_LIMITATIONS,
  SHADOW_TASK_STATE_ACTIVATION_METHOD_KEY,
  SHADOW_TASK_STATE_ACTIVATION_POLICY_VERSION,
  SHADOW_TASK_STATE_ACTIVATION_SCHEMA_VERSION,
  SHADOW_TASK_STATE_ACTIVATION_STAGE,
  SHADOW_TASK_STATE_ACTIVATION_WRITER,
  ZERO_SHADOW_TASK_STATE_ACTIVATION_SIDE_EFFECTS,
  activateShadowTaskStateCycle,
  completeRunningToSucceeded,
  transitionReadyToRunning,
  validateShadowTaskStateActivation,
} from '../../contracts/artemisShadowTaskStateActivationBoundaryContract.js';

const MC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORCH_ID = '33333333-3333-4333-8333-333333333333';
const CONTROL_ID = '44444444-4444-4444-8444-444444444444';
const CYCLE_ID = '55555555-5555-4555-8555-555555555555';
const RECORDING_ID = '66666666-6666-4666-8666-666666666666';
const CORRELATION_ID = '77777777-7777-4777-8777-777777777777';
const OTHER_UUID = '88888888-8888-4888-8888-888888888888';
const CREATED_AT = '2026-09-20T11:00:00.000Z';
const TASK_RECORDED_AT = '2026-09-20T12:00:00.000Z';
const BIND_RECORDED_AT = '2026-09-20T12:05:00.000Z';
const ACTIVATE_RECORDED_AT = '2026-09-20T12:10:00.000Z';

const CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisShadowTaskStateActivationBoundaryContract.js',
);
const TASK_STATE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisShadowTaskStateBoundaryContract.js',
);
const BINDING_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisShadowTaskCycleCompositionBoundaryContract.js',
);
const RT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js',
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
    throw new Error(`READY fixture failed: ${result.code} ${JSON.stringify(result.errors)}`);
  }
  return result.artifact;
}

function cycleEnvelope(overrides = {}) {
  return {
    artifactType: SHADOW_CYCLE_ARTIFACT_TYPE,
    contractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
    shadowCycleEnvelopeId: CYCLE_ID,
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
    shadowRecordingRef: {
      shadowRecordingArtifactId: RECORDING_ID,
      contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
      maturity: DECISION_MATURITY_MODE.SHADOW,
    },
    ...overrides,
  };
}

function bindingFor(taskState) {
  const result = buildShadowTaskCycleBinding({
    taskState,
    recordedAt: BIND_RECORDED_AT,
    ...allRefs(),
  });
  if (!result.ok) {
    throw new Error(`Binding fixture failed: ${result.code} ${JSON.stringify(result.errors)}`);
  }
  return result.artifact;
}

function baseActivationInput(overrides = {}) {
  const taskState = overrides.taskState !== undefined
    ? overrides.taskState
    : readyTaskState();
  const binding = overrides.binding !== undefined
    ? overrides.binding
    : bindingFor(taskState && taskState.status === SHADOW_TASK_STATUS.READY
      ? taskState
      : readyTaskState());
  return {
    taskState,
    cycleEnvelope: cycleEnvelope(),
    binding,
    recordedAt: ACTIVATE_RECORDED_AT,
    ...overrides,
    taskState: overrides.taskState !== undefined ? overrides.taskState : taskState,
    binding: overrides.binding !== undefined ? overrides.binding : binding,
  };
}

function assertZeroSideEffects(sideEffects) {
  expect(sideEffects).toEqual(ZERO_SHADOW_TASK_STATE_ACTIVATION_SIDE_EFFECTS);
  for (const [k, v] of Object.entries(sideEffects)) {
    expect(v).toBe(0);
  }
}

function assertAuthorityIsolation(result) {
  const targets = [result.artifact, result.runningArtifact, result.succeededArtifact]
    .filter(Boolean);
  for (const target of targets) {
    for (const [flag, expected] of Object.entries(REQUIRED_HARD_FLAGS)) {
      if (Object.prototype.hasOwnProperty.call(target, flag)) {
        expect(target[flag]).toBe(expected);
      }
    }
    expect(target.shadowRuntimeActivated).toBe(false);
    expect(target.persistenceEnabled).toBe(false);
    expect(target.b10WriteAttempted).toBe(false);
  }
  if (result.artifact?.artifactType === SHADOW_TASK_STATE_ACTIVATION_ARTIFACT_TYPE) {
    expect(result.artifact.taskStateActivated).toBe(true);
    expect(result.taskStateActivated).toBe(true);
    expect(result.shadowRuntimeActivated).toBe(false);
  }
  if (result.runningArtifact) {
    expect(result.runningArtifact.taskStateActivated).toBe(false);
  }
  if (result.succeededArtifact) {
    expect(result.succeededArtifact.taskStateActivated).toBe(false);
  }
}

describe('S8-SHADOW-TASK-STATE-ACTIVATION — Activation Boundary', () => {
  it('1. READY → RUNNING valid', () => {
    const result = transitionReadyToRunning(baseActivationInput());
    expect(result.ok).toBe(true);
    expect(result.code).toBe('SHADOW_TASK_STATE_RUNNING');
    expect(result.artifact.status).toBe(SHADOW_TASK_STATUS.RUNNING);
    expect(result.runningArtifact.taskId).toBe(result.artifact.taskId);
    expect(result.taskStateActivated).toBe(true);
    expect(result.shadowRuntimeActivated).toBe(false);
    assertZeroSideEffects(result.sideEffects);
    assertAuthorityIsolation(result);
  });

  it('2. RUNNING → SUCCEEDED valid', () => {
    const running = transitionReadyToRunning(baseActivationInput());
    expect(running.ok).toBe(true);
    const completed = completeRunningToSucceeded({
      ...baseActivationInput(),
      runningArtifact: running.artifact,
    });
    expect(completed.ok).toBe(true);
    expect(completed.code).toBe('SHADOW_TASK_STATE_SUCCEEDED');
    expect(completed.artifact.status).toBe(SHADOW_TASK_STATUS.SUCCEEDED);
    expect(completed.succeededArtifact.shadowCycleEnvelopeRef.shadowCycleEnvelopeId).toBe(CYCLE_ID);
    expect(completed.succeededArtifact.shadowRecordingRef.shadowRecordingArtifactId).toBe(RECORDING_ID);
    assertZeroSideEffects(completed.sideEffects);
    assertAuthorityIsolation(completed);
  });

  it('2b. full READY → RUNNING → SUCCEEDED activation', () => {
    const result = activateShadowTaskStateCycle(baseActivationInput());
    expect(result.ok).toBe(true);
    expect(result.code).toBe('SHADOW_TASK_STATE_ACTIVATION_COMPLETE');
    expect(result.artifact.artifactType).toBe(SHADOW_TASK_STATE_ACTIVATION_ARTIFACT_TYPE);
    expect(result.artifact.contractVersion).toBe(SHADOW_TASK_STATE_ACTIVATION_CONTRACT_VERSION);
    expect(result.artifact.schemaVersion).toBe(SHADOW_TASK_STATE_ACTIVATION_SCHEMA_VERSION);
    expect(result.artifact.policyVersion).toBe(SHADOW_TASK_STATE_ACTIVATION_POLICY_VERSION);
    expect(result.artifact.fromStatus).toBe(SHADOW_TASK_STATUS.READY);
    expect(result.artifact.toStatus).toBe(SHADOW_TASK_STATUS.SUCCEEDED);
    expect(result.runningArtifact.status).toBe(SHADOW_TASK_STATUS.RUNNING);
    expect(result.succeededArtifact.status).toBe(SHADOW_TASK_STATUS.SUCCEEDED);
    expect(result.runningArtifact.taskId).toBe(result.succeededArtifact.taskId);
    expect(result.artifact.taskStateActivated).toBe(true);
    expect(result.artifact.shadowRuntimeActivated).toBe(false);
    expect(result.artifact.provenance.writer).toBe(SHADOW_TASK_STATE_ACTIVATION_WRITER);
    expect(result.artifact.provenance.methodKey).toBe(SHADOW_TASK_STATE_ACTIVATION_METHOD_KEY);
    expect(result.artifact.provenance.stage).toBe(SHADOW_TASK_STATE_ACTIVATION_STAGE);
    expect(result.artifact.limitations).toEqual(expect.arrayContaining([
      ...SHADOW_TASK_STATE_ACTIVATION_LIMITATIONS.slice(0, 3),
    ]));
    assertZeroSideEffects(result.sideEffects);
    assertAuthorityIsolation(result);
  });

  it('3. CREATED → RUNNING rejected', () => {
    const created = buildShadowTaskState({
      taskType: SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE,
      status: SHADOW_TASK_STATUS.CREATED,
      createdAt: CREATED_AT,
      recordedAt: TASK_RECORDED_AT,
      attempt: 1,
      marketContextRef: fullMarketContextRef(),
    });
    expect(created.ok).toBe(true);
    const result = transitionReadyToRunning(baseActivationInput({
      taskState: created.artifact,
      binding: bindingFor(readyTaskState()),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'task_state_not_ready')).toBe(true);
  });

  it('4. CREATED → SUCCEEDED rejected', () => {
    const created = buildShadowTaskState({
      taskType: SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE,
      status: SHADOW_TASK_STATUS.CREATED,
      createdAt: CREATED_AT,
      recordedAt: TASK_RECORDED_AT,
      attempt: 1,
      marketContextRef: fullMarketContextRef(),
    });
    expect(created.ok).toBe(true);
    const result = activateShadowTaskStateCycle(baseActivationInput({
      taskState: created.artifact,
      binding: bindingFor(readyTaskState()),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'task_state_not_ready')).toBe(true);
  });

  it('5. READY with malformed taskId rejected', () => {
    const ready = readyTaskState();
    const result = activateShadowTaskStateCycle(baseActivationInput({
      taskState: { ...ready, taskId: 'not-a-uuid' },
      binding: bindingFor(ready),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'invalid_task_id' || e.field?.includes('taskId'))).toBe(true);
  });

  it('6. attempt mismatch rejected', () => {
    const ready = readyTaskState();
    const binding = bindingFor(ready);
    const result = activateShadowTaskStateCycle(baseActivationInput({
      taskState: ready,
      binding: { ...binding, attempt: 99 },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'attempt_mismatch')).toBe(true);
  });

  it('7. taskId mismatch rejected', () => {
    const ready = readyTaskState();
    const binding = bindingFor(ready);
    const result = activateShadowTaskStateCycle(baseActivationInput({
      taskState: ready,
      binding: { ...binding, taskId: OTHER_UUID },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'task_id_mismatch')).toBe(true);
  });

  it('8. cycle envelope mismatch rejected', () => {
    const result = activateShadowTaskStateCycle(baseActivationInput({
      cycleEnvelope: cycleEnvelope({ shadowCycleEnvelopeId: OTHER_UUID }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'cycle_envelope_mismatch')).toBe(true);
  });

  it('9. cycle binding mismatch rejected', () => {
    const ready = readyTaskState();
    const binding = bindingFor(ready);
    const result = activateShadowTaskStateCycle(baseActivationInput({
      binding: {
        ...binding,
        shadowCycleEnvelopeRef: {
          ...binding.shadowCycleEnvelopeRef,
          shadowCycleEnvelopeId: OTHER_UUID,
        },
      },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'cycle_envelope_mismatch')).toBe(true);
  });

  it('10. C8.1 recording ref mismatch rejected', () => {
    const result = activateShadowTaskStateCycle(baseActivationInput({
      cycleEnvelope: cycleEnvelope({
        shadowRecordingRef: {
          shadowRecordingArtifactId: OTHER_UUID,
          contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
          maturity: DECISION_MATURITY_MODE.SHADOW,
        },
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'c8_1_recording_ref_mismatch')).toBe(true);
  });

  it('11. marketContextRef lineage mismatch rejected', () => {
    const result = activateShadowTaskStateCycle(baseActivationInput({
      cycleEnvelope: cycleEnvelope({
        marketContextRef: thinMarketContextRef({ marketContextId: OTHER_UUID }),
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'market_context_ref_lineage_mismatch')).toBe(true);
  });

  it('12. decisionContextRef mismatch rejected', () => {
    const result = activateShadowTaskStateCycle(baseActivationInput({
      cycleEnvelope: cycleEnvelope({
        decisionContextRef: decisionContextRef({ contextId: OTHER_UUID }),
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'decision_context_ref_mismatch')).toBe(true);
  });

  it('13. decisionRef mismatch rejected', () => {
    const ready = readyTaskState();
    const result = activateShadowTaskStateCycle(baseActivationInput({
      cycleEnvelope: cycleEnvelope({
        decisionRef: { decisionId: OTHER_UUID, contractVersion: DECISION_CONTRACT_VERSION },
      }),
      binding: bindingFor(ready),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'decision_ref_mismatch')).toBe(true);
  });

  it('14. evidenceOrchestrationRef mismatch rejected', () => {
    const ready = readyTaskState();
    const result = activateShadowTaskStateCycle(baseActivationInput({
      cycleEnvelope: cycleEnvelope({
        evidenceOrchestrationRef: {
          orchestrationId: OTHER_UUID,
          contractVersion: ORCHESTRATION_CONTRACT_VERSION,
        },
      }),
      binding: bindingFor(ready),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'evidence_orchestration_ref_mismatch')).toBe(true);
  });

  it('15. controlChainRef mismatch rejected', () => {
    const ready = readyTaskState();
    const result = activateShadowTaskStateCycle(baseActivationInput({
      cycleEnvelope: cycleEnvelope({
        controlChainRef: {
          controlChainArtifactId: OTHER_UUID,
          contractVersion: CONTROL_CHAIN_CONTRACT_VERSION,
        },
      }),
      binding: bindingFor(ready),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'control_chain_ref_mismatch')).toBe(true);
  });

  it('16. contractVersion mismatch rejected', () => {
    const ready = readyTaskState();
    const result = activateShadowTaskStateCycle(baseActivationInput({
      cycleEnvelope: cycleEnvelope({ contractVersion: 'wrong-version' }),
      binding: bindingFor(ready),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'contract_version_mismatch')).toBe(true);
  });

  it('17. maturity != shadow rejected', () => {
    const result = activateShadowTaskStateCycle(baseActivationInput({
      cycleEnvelope: cycleEnvelope({
        decisionContextRef: decisionContextRef({ maturity: 'paper' }),
      }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'maturity_must_be_shadow')).toBe(true);
  });

  it('18. unknown fields rejected', () => {
    const result = activateShadowTaskStateCycle({
      ...baseActivationInput(),
      unexpectedField: true,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('unknown_field');
  });

  it('19. raw market payload rejected', () => {
    const result = activateShadowTaskStateCycle({
      ...baseActivationInput(),
      marketSnapshot: { mid: 1 },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'forbidden_key' || e.field === 'marketSnapshot')).toBe(true);
  });

  it('20. OHLCV rejected', () => {
    const result = activateShadowTaskStateCycle({
      ...baseActivationInput(),
      ohlcv: [[1, 2, 3, 4]],
    });
    expect(result.ok).toBe(false);
  });

  it('21. ticker rejected', () => {
    const result = activateShadowTaskStateCycle({
      ...baseActivationInput(),
      ticker: { last: 1 },
    });
    expect(result.ok).toBe(false);
  });

  it('22. orderBook rejected', () => {
    const result = activateShadowTaskStateCycle({
      ...baseActivationInput(),
      orderBook: { bids: [] },
    });
    expect(result.ok).toBe(false);
  });

  it('23. provider/network fields rejected', () => {
    const result = activateShadowTaskStateCycle({
      ...baseActivationInput(),
      providerPayload: { ok: true },
    });
    expect(result.ok).toBe(false);
  });

  it('24. order/execution/wallet fields rejected', () => {
    const result = activateShadowTaskStateCycle({
      ...baseActivationInput(),
      order: { side: 'buy' },
      walletAction: { transfer: true },
    });
    expect(result.ok).toBe(false);
  });

  it('25. Outcome/lookahead fields rejected', () => {
    const result = activateShadowTaskStateCycle({
      ...baseActivationInput(),
      observedOutcome: { pnl: 1 },
      lookahead: true,
    });
    expect(result.ok).toBe(false);
  });

  it('26. B10/persistence fields rejected', () => {
    const result = activateShadowTaskStateCycle({
      ...baseActivationInput(),
      b10: { write: true },
    });
    expect(result.ok).toBe(false);
  });

  it('27. worker/scheduler/queue/lease/lock fields rejected', () => {
    const result = activateShadowTaskStateCycle({
      ...baseActivationInput(),
      workerId: OTHER_UUID,
      lease: { id: 1 },
      lock: { id: 2 },
      scheduler: { cron: '* * * * *' },
      queue: { name: 'shadow' },
    });
    expect(result.ok).toBe(false);
  });

  it('28. any hard authority flag=true rejected', () => {
    const result = activateShadowTaskStateCycle({
      ...baseActivationInput(),
      executionEligible: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'hard_flag_must_be_false')).toBe(true);
  });

  it('29. taskStateActivated=true from untrusted input rejected', () => {
    const result = activateShadowTaskStateCycle({
      ...baseActivationInput(),
      taskStateActivated: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'task_state_activated_from_input_forbidden')).toBe(true);
  });

  it('30. duplicate RUNNING request idempotent', () => {
    const input = baseActivationInput();
    const first = transitionReadyToRunning(input);
    expect(first.ok).toBe(true);
    const second = transitionReadyToRunning({
      ...input,
      existingRunningArtifact: first.artifact,
    });
    expect(second.ok).toBe(true);
    expect(second.idempotent).toBe(true);
    expect(JSON.stringify(second.artifact)).toBe(JSON.stringify(first.artifact));
  });

  it('31. duplicate SUCCEEDED request idempotent', () => {
    const input = baseActivationInput();
    const first = activateShadowTaskStateCycle(input);
    expect(first.ok).toBe(true);
    const second = activateShadowTaskStateCycle({
      ...input,
      existingRunningArtifact: first.runningArtifact,
      existingSucceededArtifact: first.succeededArtifact,
      existingActivationResult: first.artifact,
    });
    expect(second.ok).toBe(true);
    expect(second.code === 'SHADOW_TASK_STATE_ACTIVATION_IDEMPOTENT'
      || second.idempotent === true).toBe(true);
    expect(JSON.stringify(second.succeededArtifact)).toBe(JSON.stringify(first.succeededArtifact));
  });

  it('32. conflicting duplicate rejected', () => {
    const input = baseActivationInput();
    const first = activateShadowTaskStateCycle(input);
    expect(first.ok).toBe(true);
    const conflicting = {
      ...first.artifact,
      toStatus: SHADOW_TASK_STATUS.RUNNING,
    };
    const second = activateShadowTaskStateCycle({
      ...input,
      existingActivationResult: conflicting,
    });
    expect(second.ok).toBe(false);
    expect(second.code).toBe('idempotency_conflict');
  });

  it('33. deterministic output equality', () => {
    const input = baseActivationInput();
    const a = activateShadowTaskStateCycle(input);
    const b = activateShadowTaskStateCycle(input);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(JSON.stringify(a.artifact)).toBe(JSON.stringify(b.artifact));
    expect(JSON.stringify(a.runningArtifact)).toBe(JSON.stringify(b.runningArtifact));
    expect(JSON.stringify(a.succeededArtifact)).toBe(JSON.stringify(b.succeededArtifact));
    expect(a.runningArtifact.taskId).toBe(input.taskState.taskId);
    expect(a.succeededArtifact.taskId).toBe(input.taskState.taskId);
    expect(a.runningArtifact.recordedAt).toBe(TASK_RECORDED_AT);
    expect(a.artifact.recordedAt).toBe(ACTIVATE_RECORDED_AT);
  });

  it('34. zero side-effect counters', () => {
    const result = activateShadowTaskStateCycle(baseActivationInput());
    expect(result.ok).toBe(true);
    assertZeroSideEffects(result.sideEffects);
    expect(result.sideEffects).toMatchObject({
      dbWrites: 0,
      redisWrites: 0,
      network: 0,
      provider: 0,
      llm: 0,
      orders: 0,
      wallet: 0,
      financialExecution: 0,
      worker: 0,
      scheduler: 0,
      queue: 0,
      lease: 0,
      lock: 0,
    });
  });

  it('35. protected-surface regression (imports / no Date.now / no random)', () => {
    const src = readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).not.toMatch(/\bDate\.now\s*\(/);
    expect(src).not.toMatch(/\bMath\.random\s*\(/);
    expect(src).not.toMatch(/\brandomUUID\s*\(/);
    expect(src).not.toMatch(/\brandomBytes\s*\(/);
    expect(src).not.toMatch(/engineWorkerLeader/);
    expect(src).not.toMatch(/messageQueue/);
    expect(src).not.toMatch(/startArtemisScheduler/);
    expect(src).not.toMatch(/artemisOrchestrator/);
    expect(src).not.toMatch(/artemisExecutionGate/);
    expect(src).not.toMatch(/tradingEngine/);
    expect(src).not.toMatch(/setInterval|setTimeout/);

    const taskSrc = readFileSync(TASK_STATE_PATH, 'utf8');
    expect(taskSrc).toMatch(/composeActivatedShadowTaskState/);
    expect(taskSrc).toMatch(/ACTIVATABLE_SHADOW_TASK_STATUSES/);

    // Binding / RT contracts remain importable and closed.
    expect(readFileSync(BINDING_PATH, 'utf8')).toMatch(SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION);
    expect(readFileSync(RT_PATH, 'utf8')).toMatch(SHADOW_RUNTIME_CONTRACT_VERSION);
    expect(SHADOW_TASK_STATE_CONTRACT_VERSION).toBeTruthy();
  });

  it('36. validateShadowTaskStateActivation alias', () => {
    const result = validateShadowTaskStateActivation(baseActivationInput());
    expect(result.ok).toBe(true);
  });

  it('37. terminal FAILED cannot activate', () => {
    const failed = buildShadowTaskState({
      taskType: SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE,
      status: SHADOW_TASK_STATUS.FAILED,
      createdAt: CREATED_AT,
      recordedAt: TASK_RECORDED_AT,
      attempt: 1,
      marketContextRef: fullMarketContextRef(),
      failureReason: 'test_fail',
    });
    expect(failed.ok).toBe(true);
    const result = activateShadowTaskStateCycle(baseActivationInput({
      taskState: failed.artifact,
      binding: bindingFor(readyTaskState()),
    }));
    expect(result.ok).toBe(false);
  });

  it('38. cycle envelope contaminating ohlcv rejected', () => {
    const result = activateShadowTaskStateCycle(baseActivationInput({
      cycleEnvelope: { ...cycleEnvelope(), ohlcv: [[1]] },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field?.includes('ohlcv'))).toBe(true);
  });

  it('39. identity preserved across activation', () => {
    const ready = readyTaskState();
    const result = activateShadowTaskStateCycle(baseActivationInput({ taskState: ready }));
    expect(result.ok).toBe(true);
    expect(result.runningArtifact.taskId).toBe(ready.taskId);
    expect(result.succeededArtifact.taskId).toBe(ready.taskId);
    expect(result.runningArtifact.attempt).toBe(ready.attempt);
    expect(result.succeededArtifact.attempt).toBe(ready.attempt);
  });

  it('40. hard-false flags on activation result', () => {
    const result = activateShadowTaskStateCycle(baseActivationInput());
    expect(result.ok).toBe(true);
    for (const key of Object.keys(REQUIRED_HARD_FLAGS)) {
      expect(result.artifact[key]).toBe(false);
    }
    expect(result.artifact.taskStateActivated).toBe(true);
  });
});
