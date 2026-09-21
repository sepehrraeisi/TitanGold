/**
 * @jest-environment node
 *
 * Artemis Core Stage 8 — S8-SHADOW-TASK-STATE
 * Shadow Task State Boundary unit tests.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
  DECISION_MATURITY_MODE,
} from '../../contracts/artemisDecisionContextContract.js';
import { MARKET_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisMarketContextContract.js';
import {
  SHADOW_RECORDING_CONTRACT_VERSION,
} from '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js';
import { SHADOW_RUNTIME_CONTRACT_VERSION } from '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js';
import {
  COMPOSABLE_SHADOW_TASK_STATUSES,
  FUTURE_VALIDATION_ONLY_STATUSES,
  REQUIRED_HARD_FLAGS,
  SHADOW_TASK_STATE_ARTIFACT_TYPE,
  SHADOW_TASK_STATE_CONTRACT_VERSION,
  SHADOW_TASK_STATE_LIMITATIONS,
  SHADOW_TASK_STATE_METHOD_KEY,
  SHADOW_TASK_STATE_POLICY_VERSION,
  SHADOW_TASK_STATE_SCHEMA_VERSION,
  SHADOW_TASK_STATE_STAGE,
  SHADOW_TASK_STATE_WRITER,
  SHADOW_TASK_STATUS,
  SHADOW_TASK_TYPE,
  ZERO_SHADOW_TASK_STATE_SIDE_EFFECTS,
  buildShadowTaskState,
  isAllowedShadowTaskTransition,
  isComposableShadowTaskStatus,
  isTerminalShadowTaskStatus,
  validateFutureTaskStateArtifact,
  validateShadowTaskState,
  validateShadowTaskStateTransition,
} from '../../contracts/artemisShadowTaskStateBoundaryContract.js';

const MC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORCH_ID = '33333333-3333-4333-8333-333333333333';
const CONTROL_ID = '44444444-4444-4444-8444-444444444444';
const CYCLE_ID = '55555555-5555-4555-8555-555555555555';
const RECORDING_ID = '66666666-6666-4666-8666-666666666666';
const CORRELATION_ID = '77777777-7777-4777-8777-777777777777';
const CREATED_AT = '2026-09-20T11:00:00.000Z';
const RECORDED_AT = '2026-09-20T12:00:00.000Z';

const CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisShadowTaskStateBoundaryContract.js',
);

function baseMarketContextRef(overrides = {}) {
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

function baseDecisionContextRef(overrides = {}) {
  return {
    contextId: CONTEXT_ID,
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    maturity: DECISION_MATURITY_MODE.SHADOW,
    ...overrides,
  };
}

function baseCreated(overrides = {}) {
  return {
    taskType: SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE,
    status: SHADOW_TASK_STATUS.CREATED,
    createdAt: CREATED_AT,
    recordedAt: RECORDED_AT,
    attempt: 1,
    marketContextRef: baseMarketContextRef(),
    ...overrides,
  };
}

function baseReady(overrides = {}) {
  return baseCreated({
    status: SHADOW_TASK_STATUS.READY,
    decisionContextRef: baseDecisionContextRef(),
    ...overrides,
  });
}

function baseSucceededInput(overrides = {}) {
  return {
    taskType: SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE,
    status: SHADOW_TASK_STATUS.SUCCEEDED,
    createdAt: CREATED_AT,
    recordedAt: RECORDED_AT,
    attempt: 1,
    marketContextRef: baseMarketContextRef(),
    decisionContextRef: baseDecisionContextRef(),
    shadowCycleEnvelopeRef: {
      shadowCycleEnvelopeId: CYCLE_ID,
      contractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
    },
    shadowRecordingRef: {
      shadowRecordingArtifactId: RECORDING_ID,
      contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
      maturity: DECISION_MATURITY_MODE.SHADOW,
    },
    decisionRef: { decisionId: DECISION_ID, contractVersion: 'artemis-decision-1.0.0' },
    evidenceOrchestrationRef: {
      orchestrationId: ORCH_ID,
      contractVersion: 'artemis-evidence-orchestration-1.0.0',
    },
    controlChainRef: {
      controlChainArtifactId: CONTROL_ID,
      contractVersion: 'artemis-control-chain-1.0.0',
    },
    ...overrides,
  };
}

describe('S8-SHADOW-TASK-STATE — Shadow Task State Boundary', () => {
  it('1. valid CREATED composition', () => {
    const result = buildShadowTaskState(baseCreated());
    expect(result.ok).toBe(true);
    expect(result.artifact.status).toBe(SHADOW_TASK_STATUS.CREATED);
    expect(result.artifact.artifactType).toBe(SHADOW_TASK_STATE_ARTIFACT_TYPE);
    expect(result.artifact.taskType).toBe(SHADOW_TASK_TYPE.SHADOW_EVALUATION_CYCLE);
    expect(result.artifact.decisionContextRef).toBeUndefined();
    expect(result.taskStateActivated).toBe(false);
  });

  it('2. valid READY composition', () => {
    const result = buildShadowTaskState(baseReady());
    expect(result.ok).toBe(true);
    expect(result.artifact.status).toBe(SHADOW_TASK_STATUS.READY);
    expect(result.artifact.decisionContextRef.contextId).toBe(CONTEXT_ID);
    expect(result.artifact.decisionContextRef.maturity).toBe(DECISION_MATURITY_MODE.SHADOW);
  });

  it('3. taskType validation — missing and unknown', () => {
    expect(buildShadowTaskState(baseCreated({ taskType: undefined })).ok).toBe(false);
    expect(buildShadowTaskState(baseCreated({ taskType: undefined })).errors)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'missing_task_type' })]));
    expect(buildShadowTaskState(baseCreated({ taskType: 'OTHER' })).code).toBe('shadow_task_state_invalid');
    expect(buildShadowTaskState(baseCreated({ taskType: 'OTHER' })).errors)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'unknown_task_type' })]));
  });

  it('4–5. deterministic taskId; identical input => identical taskId', () => {
    const a = buildShadowTaskState(baseCreated());
    const b = buildShadowTaskState(baseCreated());
    expect(a.ok).toBe(true);
    expect(a.artifact.taskId).toBe(b.artifact.taskId);
    expect(a.artifact.taskId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('6. retry attempt changes identity', () => {
    const a = buildShadowTaskState(baseCreated({ attempt: 1 }));
    const b = buildShadowTaskState(baseCreated({ attempt: 2 }));
    expect(a.artifact.taskId).not.toBe(b.artifact.taskId);
  });

  it('7. malformed marketContextRef', () => {
    const result = buildShadowTaskState(baseCreated({
      marketContextRef: ['not', 'an', 'object'],
    }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'malformed_market_context_ref' })]),
    );
  });

  it('8. missing marketContextRef', () => {
    const result = buildShadowTaskState(baseCreated({ marketContextRef: undefined }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'missing_market_context_ref' })]),
    );
  });

  it('9. missing decisionContextRef for READY', () => {
    const result = buildShadowTaskState(baseReady({ decisionContextRef: undefined }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'missing_decision_context_ref' })]),
    );
  });

  it('10. maturity != shadow rejected for READY', () => {
    const result = buildShadowTaskState(baseReady({
      decisionContextRef: baseDecisionContextRef({ maturity: DECISION_MATURITY_MODE.ADVISORY }),
    }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'maturity_must_be_shadow' })]),
    );
  });

  it('11. unknown status rejected', () => {
    const result = buildShadowTaskState(baseCreated({ status: 'QUEUED' }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('unknown_status');
  });

  it('12. illegal transitions rejected', () => {
    expect(isAllowedShadowTaskTransition(
      SHADOW_TASK_STATUS.CREATED,
      SHADOW_TASK_STATUS.RUNNING,
    )).toBe(false);
    expect(isAllowedShadowTaskTransition(
      SHADOW_TASK_STATUS.CREATED,
      SHADOW_TASK_STATUS.SUCCEEDED,
    )).toBe(false);
    expect(isAllowedShadowTaskTransition(
      SHADOW_TASK_STATUS.READY,
      SHADOW_TASK_STATUS.SUCCEEDED,
    )).toBe(false);

    const illegal = validateShadowTaskStateTransition({
      fromStatus: SHADOW_TASK_STATUS.CREATED,
      toStatus: SHADOW_TASK_STATUS.RUNNING,
      toInput: baseReady({ status: undefined }),
    });
    expect(illegal.ok).toBe(false);
    expect(illegal.code).toBe('illegal_transition');
  });

  it('13. terminal transition rejection', () => {
    const created = buildShadowTaskState(baseCreated({
      status: SHADOW_TASK_STATUS.FAILED,
      failureReason: 'upstream_unavailable',
    }));
    expect(created.ok).toBe(true);
    const again = validateShadowTaskStateTransition({
      fromStatus: SHADOW_TASK_STATUS.FAILED,
      toStatus: SHADOW_TASK_STATUS.READY,
      fromArtifact: created.artifact,
      toInput: baseReady({ status: undefined }),
    });
    expect(again.ok).toBe(false);
    expect(again.code).toBe('terminal_mutation_rejected');
  });

  it('14. FAILED requires failureReason', () => {
    const missing = buildShadowTaskState(baseCreated({
      status: SHADOW_TASK_STATUS.FAILED,
    }));
    expect(missing.ok).toBe(false);
    expect(missing.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'missing_failure_reason' })]),
    );
    const ok = buildShadowTaskState(baseCreated({
      status: SHADOW_TASK_STATUS.FAILED,
      failureReason: 'validation_failed',
    }));
    expect(ok.ok).toBe(true);
    expect(ok.artifact.failureReason).toBe('validation_failed');
  });

  it('15. CANCELLED requires cancelReason', () => {
    const missing = buildShadowTaskState(baseCreated({
      status: SHADOW_TASK_STATUS.CANCELLED,
    }));
    expect(missing.ok).toBe(false);
    expect(missing.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'missing_cancel_reason' })]),
    );
    const ok = buildShadowTaskState(baseCreated({
      status: SHADOW_TASK_STATUS.CANCELLED,
      cancelReason: 'owner_cancelled',
    }));
    expect(ok.ok).toBe(true);
    expect(ok.artifact.cancelReason).toBe('owner_cancelled');
  });

  it('16. future RUNNING validation blocked from activation', () => {
    const built = buildShadowTaskState(baseReady({ status: SHADOW_TASK_STATUS.RUNNING }));
    expect(built.ok).toBe(false);
    expect(built.code).toBe('running_activation_forbidden');

    const structural = validateFutureTaskStateArtifact({
      ...baseReady(),
      status: SHADOW_TASK_STATUS.RUNNING,
    });
    expect(structural.ok).toBe(true);
    expect(structural.futureValidationOnly).toBe(true);
    expect(structural.runtimeActivation).toBe(false);
    expect(structural.artifact.taskStateActivated).toBe(false);
    expect(structural.artifact.shadowRuntimeActivated).toBe(false);

    const transition = validateShadowTaskStateTransition({
      fromStatus: SHADOW_TASK_STATUS.READY,
      toStatus: SHADOW_TASK_STATUS.RUNNING,
      toInput: baseReady({ status: undefined }),
    });
    expect(transition.ok).toBe(true);
    expect(transition.runtimeActivation).toBe(false);
    expect(transition.futureValidationOnly).toBe(true);
  });

  it('17. SUCCEEDED validation requires cycle + recording refs', () => {
    const built = buildShadowTaskState(baseSucceededInput());
    expect(built.ok).toBe(false);
    expect(built.code).toBe('succeeded_activation_forbidden');

    const missingCycle = validateFutureTaskStateArtifact(
      baseSucceededInput({ shadowCycleEnvelopeRef: undefined }),
    );
    expect(missingCycle.ok).toBe(false);
    expect(missingCycle.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'shadowCycleEnvelopeRef' })]),
    );

    const missingRecording = validateFutureTaskStateArtifact(
      baseSucceededInput({ shadowRecordingRef: undefined }),
    );
    expect(missingRecording.ok).toBe(false);

    const ok = validateFutureTaskStateArtifact(baseSucceededInput());
    expect(ok.ok).toBe(true);
    expect(ok.executionImplied).toBeUndefined();
    expect(ok.artifact.approvedForExecution).toBe(false);
    expect(ok.futureValidationOnly).toBe(true);
  });

  it('18. execution contamination rejected', () => {
    const result = buildShadowTaskState({
      ...baseCreated(),
      executionIntent: { side: 'buy' },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'forbidden_key' || e.code === 'unknown_field')).toBe(true);
  });

  it('19. wallet/order contamination rejected', () => {
    expect(buildShadowTaskState({ ...baseCreated(), orderId: 'x' }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), wallet: {} }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), transfer: {} }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), withdrawal: {} }).ok).toBe(false);
  });

  it('20. provider/network contamination rejected', () => {
    expect(buildShadowTaskState({ ...baseCreated(), providerPayload: {} }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), signedQuery: 'x' }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), credentials: {} }).ok).toBe(false);
  });

  it('21. outcome contamination rejected', () => {
    expect(buildShadowTaskState({ ...baseCreated(), observedOutcome: {} }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), realizedPnl: 1 }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), evaluationResult: {} }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), lookahead: true }).ok).toBe(false);
  });

  it('22. worker/scheduler contamination rejected', () => {
    expect(buildShadowTaskState({ ...baseCreated(), workerId: 'w' }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), lease: {} }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), lock: {} }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), schedulerState: {} }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), queueState: {} }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), scheduleAt: RECORDED_AT }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), cron: '* * * * *' }).ok).toBe(false);
  });

  it('23. B10 / persistArtemisDecision contamination rejected', () => {
    expect(buildShadowTaskState({ ...baseCreated(), b10: true }).ok).toBe(false);
    expect(buildShadowTaskState({
      ...baseCreated(),
      persistArtemisDecision: true,
    }).ok).toBe(false);
  });

  it('24. unknown fields rejected', () => {
    const result = buildShadowTaskState({ ...baseCreated(), surprise: 1 });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('unknown_field');
  });

  it('25. lineage mismatch rejected', () => {
    const result = buildShadowTaskState(baseCreated({
      lineage: { marketContextId: '99999999-9999-4999-8999-999999999999' },
    }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('lineage_mismatch');
  });

  it('26. provenance mismatch rejected', () => {
    const result = buildShadowTaskState(baseCreated({
      provenance: { writer: 'spoofed-writer' },
    }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('provenance_mismatch');
  });

  it('27. hard flags true rejected; artifact forces false', () => {
    for (const key of Object.keys(REQUIRED_HARD_FLAGS)) {
      const result = buildShadowTaskState({ ...baseCreated(), [key]: true });
      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: key, code: 'hard_flag_must_be_false' })]),
      );
    }
    const ok = buildShadowTaskState(baseCreated());
    for (const [key, value] of Object.entries(REQUIRED_HARD_FLAGS)) {
      expect(ok.artifact[key]).toBe(value);
    }
  });

  it('28. zero side effects', () => {
    const result = buildShadowTaskState(baseReady());
    expect(result.sideEffects).toEqual(ZERO_SHADOW_TASK_STATE_SIDE_EFFECTS);
    expect(result.artifact.sideEffects).toEqual(ZERO_SHADOW_TASK_STATE_SIDE_EFFECTS);
    expect(result.sideEffects.dbWrites).toBe(0);
    expect(result.sideEffects.redisWrites).toBe(0);
    expect(result.sideEffects.network).toBe(0);
    expect(result.sideEffects.worker).toBe(0);
    expect(result.sideEffects.scheduler).toBe(0);
  });

  it('29. import hygiene — no IO / network / redis / pm2 imports', () => {
    const source = readFileSync(CONTRACT_PATH, 'utf8');
    expect(source).not.toMatch(/from ['"][^'"]*pg['"]/);
    expect(source).not.toMatch(/from ['"][^'"]*ioredis['"]/);
    expect(source).not.toMatch(/from ['"][^'"]*redis['"]/);
    expect(source).not.toMatch(/from ['"][^'"]*node:net['"]/);
    expect(source).not.toMatch(/from ['"][^'"]*node:http['"]/);
    expect(source).not.toMatch(/from ['"][^'"]*node:https['"]/);
    expect(source).not.toMatch(/require\(['"]fs['"]\)/);
    expect(source).not.toMatch(/from ['"][^'"]*pm2['"]/);
    expect(source).not.toMatch(/require\(['"]pm2['"]\)/);
    expect(source).not.toMatch(/from ['"][^'"]*artemisOrchestrator/);
    expect(source).not.toMatch(/from ['"][^'"]*tradingEngine/);
    expect(source).not.toMatch(/from ['"][^'"]*runtimeExecutionStateService/);
  });

  it('30. protected-owner isolation — does not import mutation owners', () => {
    const source = readFileSync(CONTRACT_PATH, 'utf8');
    expect(source).not.toMatch(/artemisMarketContextSourceOfTruthService/);
    expect(source).not.toMatch(/engineWorkerLeader/);
    expect(source).not.toMatch(/messageQueue/);
    expect(source).not.toMatch(/artemisExecutionGate/);
  });

  it('31. no nondeterministic identity API', () => {
    const source = readFileSync(CONTRACT_PATH, 'utf8');
    expect(source).not.toMatch(/Date\.now\s*\(/);
    expect(source).not.toMatch(/Math\.random\s*\(/);
    expect(source).not.toMatch(/randomUUID\s*\(/);
    expect(source).not.toMatch(/randomBytes\s*\(/);
  });

  it('32. no persistence', () => {
    const result = buildShadowTaskState(baseCreated());
    expect(result.artifact.persistenceEnabled).toBe(false);
    expect(result.artifact.b10WriteAttempted).toBe(false);
    expect(result.artifact.limitations).toEqual(
      expect.arrayContaining(['persistence_not_enabled', 'b10_not_activated']),
    );
  });

  it('33. no worker', () => {
    const result = buildShadowTaskState(baseCreated());
    expect(result.sideEffects.worker).toBe(0);
    expect(result.artifact.limitations).toEqual(
      expect.arrayContaining(['no_worker_scheduler_queue_lease_lock']),
    );
  });

  it('34. no scheduler', () => {
    const result = buildShadowTaskState(baseCreated());
    expect(result.sideEffects.scheduler).toBe(0);
  });

  it('35. no runtime activation', () => {
    const result = buildShadowTaskState(baseReady());
    expect(result.runtimeActivation).toBe(false);
    expect(result.artifact.taskStateActivated).toBe(false);
    expect(result.artifact.shadowRuntimeActivated).toBe(false);
    expect(result.artifact.liveTradingEnabled).toBe(false);
    expect(result.artifact.paperTradingEnabled).toBe(false);
  });

  it('allowed transitions CREATED->READY and READY->FAILED', () => {
    expect(isAllowedShadowTaskTransition(
      SHADOW_TASK_STATUS.CREATED,
      SHADOW_TASK_STATUS.READY,
    )).toBe(true);
    const ready = validateShadowTaskStateTransition({
      fromStatus: SHADOW_TASK_STATUS.CREATED,
      toStatus: SHADOW_TASK_STATUS.READY,
      toInput: baseReady({ status: undefined }),
    });
    expect(ready.ok).toBe(true);
    expect(ready.artifact.status).toBe(SHADOW_TASK_STATUS.READY);

    const failed = validateShadowTaskStateTransition({
      fromStatus: SHADOW_TASK_STATUS.READY,
      toStatus: SHADOW_TASK_STATUS.FAILED,
      toInput: {
        ...baseReady({ status: undefined }),
        failureReason: 'blocked',
      },
    });
    expect(failed.ok).toBe(true);
    expect(failed.artifact.status).toBe(SHADOW_TASK_STATUS.FAILED);
  });

  it('idempotent same taskId + identical payload; conflict on different payload', () => {
    const first = buildShadowTaskState(baseCreated());
    const same = buildShadowTaskState({
      ...baseCreated(),
      existingArtifact: first.artifact,
    });
    expect(same.ok).toBe(true);
    expect(same.idempotent).toBe(true);

    const conflict = buildShadowTaskState({
      ...baseCreated({ correlationId: CORRELATION_ID }),
      taskId: first.artifact.taskId,
      existingArtifact: first.artifact,
    });
    // Either identity_mismatch (derived id differs) or if forced same id somehow conflict
    expect(conflict.ok).toBe(false);
  });

  it('caller taskId identity mismatch rejected', () => {
    const result = buildShadowTaskState(baseCreated({
      taskId: '99999999-9999-4999-8999-999999999999',
    }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('identity_mismatch');
  });

  it('createdAt > recordedAt rejected', () => {
    const result = buildShadowTaskState(baseCreated({
      createdAt: '2026-09-21T00:00:00.000Z',
      recordedAt: '2026-09-20T00:00:00.000Z',
    }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'created_after_recorded' })]),
    );
  });

  it('attempt < 1 rejected', () => {
    expect(buildShadowTaskState(baseCreated({ attempt: 0 })).ok).toBe(false);
    expect(buildShadowTaskState(baseCreated({ attempt: -1 })).ok).toBe(false);
  });

  it('runId contamination rejected', () => {
    const result = buildShadowTaskState({ ...baseCreated(), runId: CORRELATION_ID });
    expect(result.ok).toBe(false);
  });

  it('market data contamination (ohlcv/ticker/orderBook/rawSeries) rejected', () => {
    expect(buildShadowTaskState({ ...baseCreated(), ohlcv: [] }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), ticker: {} }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), orderBook: {} }).ok).toBe(false);
    expect(buildShadowTaskState({ ...baseCreated(), rawSeries: [] }).ok).toBe(false);
  });

  it('composable / terminal / future-status helpers', () => {
    expect(isComposableShadowTaskStatus(SHADOW_TASK_STATUS.CREATED)).toBe(true);
    expect(isComposableShadowTaskStatus(SHADOW_TASK_STATUS.RUNNING)).toBe(false);
    expect(isTerminalShadowTaskStatus(SHADOW_TASK_STATUS.FAILED)).toBe(true);
    expect(COMPOSABLE_SHADOW_TASK_STATUSES).toContain(SHADOW_TASK_STATUS.READY);
    expect(FUTURE_VALIDATION_ONLY_STATUSES).toEqual([
      SHADOW_TASK_STATUS.RUNNING,
      SHADOW_TASK_STATUS.SUCCEEDED,
    ]);
  });

  it('validateShadowTaskState routes future statuses to validation-only path', () => {
    const result = validateShadowTaskState(baseSucceededInput());
    expect(result.ok).toBe(true);
    expect(result.futureValidationOnly).toBe(true);
  });

  it('artifact contract metadata and limitations present', () => {
    const result = buildShadowTaskState(baseReady({ correlationId: CORRELATION_ID }));
    expect(result.artifact.schemaVersion).toBe(SHADOW_TASK_STATE_SCHEMA_VERSION);
    expect(result.artifact.contractVersion).toBe(SHADOW_TASK_STATE_CONTRACT_VERSION);
    expect(result.artifact.policyVersion).toBe(SHADOW_TASK_STATE_POLICY_VERSION);
    expect(result.artifact.provenance.writer).toBe(SHADOW_TASK_STATE_WRITER);
    expect(result.artifact.provenance.methodKey).toBe(SHADOW_TASK_STATE_METHOD_KEY);
    expect(result.artifact.provenance.stage).toBe(SHADOW_TASK_STATE_STAGE);
    expect(result.artifact.limitations).toEqual(expect.arrayContaining([...SHADOW_TASK_STATE_LIMITATIONS]));
    expect(result.artifact.correlationId).toBe(CORRELATION_ID);
  });

  it('SUCCEEDED transition structural path does not imply execution', () => {
    const transition = validateShadowTaskStateTransition({
      fromStatus: SHADOW_TASK_STATUS.RUNNING,
      toStatus: SHADOW_TASK_STATUS.SUCCEEDED,
      toInput: baseSucceededInput({ status: undefined }),
    });
    expect(transition.ok).toBe(true);
    expect(transition.executionImplied).toBe(false);
    expect(transition.artifact.approvedForExecution).toBe(false);
    expect(transition.runtimeActivation).toBe(false);
  });
});
